"""
硬字幕 OCR：底部 ROI 抽帧 -> EasyOCR / PaddleOCR -> 稳定/投票/去抖 -> 近似 SRT。

未安装 opencv / ocr 引擎时，仅在进入 OCR 管线后才会报错。
"""

from __future__ import annotations

import difflib
import math
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .srt_parser import SubtitleSegment

# OCR 句首常见误识别（台标/描边伪影）；不含正常用字如「订、叫、当、去」
_LEADING_OCR_NOISE = frozenset("我你哦洗强另佛商信#＃")


def _text_similarity(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


class _TextDebouncer:
    """时间轴文案去抖：高相似视为同句；新句需连续确认才切换。"""

    def __init__(
        self,
        *,
        enabled: bool,
        same_line_similarity: float,
        confirm_steps: int,
    ) -> None:
        self.enabled = enabled
        self.same_line_similarity = same_line_similarity
        self.confirm_steps = max(1, confirm_steps)
        self.stable_text = ""
        self.pending_text = ""
        self.pending_count = 0

    def apply(self, raw: str) -> str:
        raw = (raw or "").strip()
        if not self.enabled:
            return raw
        if not self.stable_text:
            self.stable_text = raw
            return raw
        if _text_similarity(raw, self.stable_text) >= self.same_line_similarity:
            return self.stable_text
        if raw == self.pending_text:
            self.pending_count += 1
        else:
            self.pending_text = raw
            self.pending_count = 1
        if self.pending_count >= self.confirm_steps:
            self.stable_text = self.pending_text
            self.pending_text = ""
            self.pending_count = 0
        return self.stable_text


def _pick_cluster_reference(cluster: List[Tuple[str, float]]) -> str:
    """选作对齐基准的文本：置信度加总最高；并列时取更短（减少多长一字）。"""
    scores: Dict[str, float] = defaultdict(float)
    for text, conf in cluster:
        scores[text] += conf
    return min(scores.keys(), key=lambda t: (-scores[t], len(t)))


def _supports_core_text(candidate: str, text: str) -> bool:
    """text 是否可视为 candidate，或仅多 1~2 个已知噪声首字。"""
    if not candidate or not text:
        return False
    if text == candidate:
        return True
    if len(text) == len(candidate) + 1 and text[1:] == candidate:
        return text[0] in _LEADING_OCR_NOISE
    if len(text) == len(candidate) + 2 and text[2:] == candidate:
        return text[0] in _LEADING_OCR_NOISE and text[1] in _LEADING_OCR_NOISE
    return _text_similarity(text, candidate) >= 0.9


def _strip_spurious_leading_prefix(
    text: str,
    cluster: List[Tuple[str, float]],
    *,
    min_support: float,
    max_strip: int = 2,
) -> str:
    """
    若多数帧在去掉首 1~2 字后与当前句高度一致，则剥掉首部（缓解 我/哦/洗/强 等多字）。
    """
    if len(text) < 3 or not cluster:
        return text
    total_w = sum(c for _, c in cluster)
    if total_w <= 0:
        return text

    result = text
    for _ in range(max_strip):
        if len(result) < 3:
            break
        if result[0] not in _LEADING_OCR_NOISE:
            break
        body = result[1:]
        body_w = sum(c for t, c in cluster if _supports_core_text(body, t))
        full_w = sum(
            c
            for t, c in cluster
            if t == result or (t and t[0] == result[0] and _text_similarity(t, result) >= 0.9)
        )
        if body_w >= total_w * min_support and body_w >= full_w * 0.85:
            result = body
        else:
            break
    return result


def _vote_chars_in_cluster(
    cluster: List[Tuple[str, float]],
    *,
    prefix_min_weight_ratio: float = 0.38,
) -> str:
    """
    簇内选句：各帧完全相同的文本按置信度加总，取最高者；并列取更短。
    再剥掉仅少数帧多出的噪声首字（我/哦/洗/强 等）。
    """
    if not cluster:
        return ""
    winner = _pick_cluster_reference(cluster)
    return _strip_spurious_leading_prefix(
        winner, cluster, min_support=prefix_min_weight_ratio
    )


def _vote_ocr_candidates(
    candidates: List[Tuple[str, float]],
    *,
    min_confidence: float,
    cluster_similarity: float,
    prefix_min_support: float = 0.38,
) -> Tuple[str, float]:
    """多帧 OCR 结果：先滤低置信度，再按相似聚类，簇内投票选字。"""
    valid = [
        (t.strip(), float(c))
        for t, c in candidates
        if t and t.strip() and float(c) >= min_confidence
    ]
    if not valid:
        fallback = [(t.strip(), float(c)) for t, c in candidates if t and t.strip()]
        if not fallback:
            return "", 0.0
        fallback.sort(key=lambda x: x[1], reverse=True)
        return fallback[0][0], fallback[0][1]

    if len(valid) == 1:
        return valid[0]

    clusters: List[List[Tuple[str, float]]] = []
    for text, conf in valid:
        placed = False
        for cluster in clusters:
            if _text_similarity(text, cluster[0][0]) >= cluster_similarity:
                cluster.append((text, conf))
                placed = True
                break
        if not placed:
            clusters.append([(text, conf)])

    best = max(clusters, key=lambda cl: sum(c for _, c in cl))
    voted = _vote_chars_in_cluster(
        best, prefix_min_weight_ratio=prefix_min_support
    )
    voted = _strip_spurious_leading_prefix(
        voted, best, min_support=prefix_min_support
    )
    avg_conf = sum(c for _, c in best) / len(best)
    return voted, avg_conf


def _load_easyocr_reader(languages: List[str], use_gpu: bool) -> Any:
    import easyocr  # type: ignore

    return easyocr.Reader(languages, gpu=use_gpu, verbose=False)


def _load_paddle_ocr(use_gpu: bool) -> Any:
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except ImportError as e:
        raise ImportError(
            "Paddle OCR 需要 paddleocr 与 paddlepaddle，请按 README 安装"
        ) from e

    device = "gpu:0" if use_gpu else "cpu"
    # CPU + Paddle 3.3+ 默认 mkldnn 会触发 PIR/OneDNN NotImplementedError
    kwargs: Dict[str, Any] = {
        "device": device,
        "use_textline_orientation": True,
        "lang": "ch",
    }
    if not use_gpu:
        kwargs["enable_mkldnn"] = False
    return PaddleOCR(**kwargs)


def _roi_pixels(
    frame_w: int, frame_h: int, roi_ratio: Dict[str, float]
) -> Tuple[int, int, int, int]:
    x = int(frame_w * float(roi_ratio["x"]))
    y = int(frame_h * float(roi_ratio["y"]))
    w = int(frame_w * float(roi_ratio["w"]))
    h = int(frame_h * float(roi_ratio["h"]))
    x = max(0, min(x, frame_w - 1))
    y = max(0, min(y, frame_h - 1))
    w = max(1, min(w, frame_w - x))
    h = max(1, min(h, frame_h - y))
    return x, y, w, h


def _unsharp_gray(gray: Any, cv2: Any, sigma: float, amount: float) -> Any:
    if amount <= 0 or sigma <= 0:
        return gray
    blurred = cv2.GaussianBlur(gray, (0, 0), sigma)
    sharp = cv2.addWeighted(gray, 1.0 + amount, blurred, -amount, 0)
    return sharp


def _pad_subtitle_crop(bgr: Any, cv2: Any, cfg: Dict[str, Any]) -> Any:
    """左右/上下留白，避免检测框贴边导致句首句尾漏字。"""
    pad_x = int(cfg.get("pad_x", 0))
    pad_y = int(cfg.get("pad_y", 0))
    if pad_x <= 0 and pad_y <= 0:
        return bgr
    color = cfg.get("pad_color", 255)
    if isinstance(color, (list, tuple)) and len(color) >= 3:
        value = (int(color[0]), int(color[1]), int(color[2]))
    else:
        v = int(color) if color is not None else 255
        value = (v, v, v)
    return cv2.copyMakeBorder(
        bgr, pad_y, pad_y, pad_x, pad_x, cv2.BORDER_CONSTANT, value=value
    )


def _color_binarize_subtitle(
    bgr: Any,
    cv2: Any,
    cfg: Dict[str, Any],
) -> Any:
    """
    字幕增强 -> 黑字白底。
    method:
      clahe_mask（默认）CLAHE + 高亮掩膜，保留细笔画
      hsv          按 HSV 亮/白/黄阈值二值化
      otsu         Otsu 自适应阈值
    """
    import numpy as np  # type: ignore

    method = str(cfg.get("method", "clahe_mask")).lower()

    if method == "clahe_mask":
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        if bool(cfg.get("clahe", True)):
            clip = float(cfg.get("clahe_clip", 2.0))
            gray = cv2.createCLAHE(clip, (8, 4)).apply(gray)
        v_min = int(cfg.get("v_min", 155))
        mask = cv2.inRange(gray, v_min, 255)
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        if bool(cfg.get("use_yellow_mask", True)):
            y_lo = int(cfg.get("yellow_h_low", 8))
            y_hi = int(cfg.get("yellow_h_high", 45))
            y_s = int(cfg.get("yellow_s_min", 35))
            y_v = int(cfg.get("yellow_v_min", 120))
            mask = cv2.bitwise_or(
                mask,
                cv2.inRange(hsv, (y_lo, y_s, y_v), (y_hi, 255, 255)),
            )
        morph_k = max(1, int(cfg.get("morph_kernel", 2)))
        if morph_k > 1:
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (morph_k, morph_k))
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
        dilate_iter = max(0, int(cfg.get("dilate_iter", 1)))
        if dilate_iter > 0:
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
            mask = cv2.dilate(mask, kernel, iterations=dilate_iter)
        out = np.full(gray.shape, 255, dtype=np.uint8)
        if np.any(mask):
            out[mask > 0] = np.clip(255 - gray[mask > 0], 0, 255).astype(np.uint8)
        return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)

    if method == "otsu":
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if float(np.mean(bw)) > 127:
            bw = 255 - bw
        bright = cv2.inRange(gray, int(cfg.get("v_min", 155)), 255)
        bw = cv2.bitwise_or(bw, bright)
        out = np.full(gray.shape, 255, dtype=np.uint8)
        out[bw > 0] = 0
        return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)

    # hsv: bright | white | yellow | combined
    mode = method if method != "hsv" else str(cfg.get("mode", "combined")).lower()
    v_min = int(cfg.get("v_min", 175))
    s_max_white = int(cfg.get("s_max_white", 90))
    yellow_h_low = int(cfg.get("yellow_h_low", 8))
    yellow_h_high = int(cfg.get("yellow_h_high", 45))
    yellow_s_min = int(cfg.get("yellow_s_min", 35))
    yellow_v_min = int(cfg.get("yellow_v_min", 130))
    morph_k = max(1, int(cfg.get("morph_kernel", 2)))
    dilate_iter = max(0, int(cfg.get("dilate_iter", 1)))

    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h_ch, s_ch, v_ch = cv2.split(hsv)
    mask = np.zeros(bgr.shape[:2], dtype=np.uint8)

    if mode in ("bright", "combined", "auto"):
        mask = cv2.bitwise_or(mask, cv2.inRange(v_ch, v_min, 255))
    if mode in ("white", "combined", "auto"):
        mask_white = cv2.bitwise_and(
            cv2.inRange(s_ch, 0, s_max_white),
            cv2.inRange(v_ch, v_min, 255),
        )
        mask = cv2.bitwise_or(mask, mask_white)
    if mode in ("yellow", "combined"):
        mask_yellow = cv2.inRange(
            hsv,
            (yellow_h_low, yellow_s_min, yellow_v_min),
            (yellow_h_high, 255, 255),
        )
        mask = cv2.bitwise_or(mask, mask_yellow)

    if morph_k > 1:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (morph_k, morph_k))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    if dilate_iter > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        mask = cv2.dilate(mask, kernel, iterations=dilate_iter)

    out = np.full(bgr.shape[:2], 255, dtype=np.uint8)
    out[mask > 0] = 0
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def _preprocess_subtitle_crop(
    bgr: Any,
    cv2: Any,
    preprocess: Optional[Dict[str, Any]] = None,
    *,
    upscale: Optional[int] = None,
    contrast_alpha: Optional[float] = None,
    contrast_beta: Optional[float] = None,
    unsharp_sigma: float = 0.0,
    unsharp_amount: float = 0.0,
) -> Any:
    cfg = dict(preprocess or {})
    up = int(upscale if upscale is not None else cfg.get("upscale", 2))
    ca = float(
        contrast_alpha if contrast_alpha is not None else cfg.get("contrast_alpha", 1.15)
    )
    cb = float(contrast_beta if contrast_beta is not None else cfg.get("contrast_beta", 8))
    us = float(
        unsharp_sigma
        if unsharp_sigma > 0
        else float(cfg.get("unsharp_sigma", 0.0))
    )
    ua = float(
        unsharp_amount
        if unsharp_amount > 0
        else float(cfg.get("unsharp_amount", 0.0))
    )

    pad_cfg = cfg.get("pad")
    if isinstance(pad_cfg, dict) and bool(pad_cfg.get("enabled", False)):
        bgr = _pad_subtitle_crop(bgr, cv2, pad_cfg)

    bin_cfg = cfg.get("color_binarize")
    use_bin = isinstance(bin_cfg, dict) and bool(bin_cfg.get("enabled", False))
    if use_bin:
        bgr = _color_binarize_subtitle(bgr, cv2, bin_cfg)

    if up < 1:
        up = 1
    h, w = bgr.shape[:2]
    if up > 1:
        bgr = cv2.resize(bgr, (w * up, h * up), interpolation=cv2.INTER_CUBIC)

    if use_bin:
        # 颜色增强后不再叠加强对比灰度，避免笔画发糊
        return bgr

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    if bool(cfg.get("clahe", False)):
        clip = float(cfg.get("clahe_clip", 2.0))
        gray = cv2.createCLAHE(clip, (8, 4)).apply(gray)
    gray = cv2.convertScaleAbs(gray, alpha=ca, beta=cb)
    gray = _unsharp_gray(gray, cv2, us, ua)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def _ocr_easyocr(
    reader: Any,
    bgr: Any,
    cv2: Any,
    preprocess: Optional[Dict[str, Any]],
) -> Tuple[str, float]:
    if preprocess and bool(preprocess.get("enabled", False)):
        bgr = _preprocess_subtitle_crop(bgr, cv2, preprocess)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    result = reader.readtext(rgb, detail=1, paragraph=False)
    if not result:
        return "", 0.0
    parts: List[str] = []
    scores: List[float] = []
    for item in result:
        if len(item) >= 3:
            parts.append(str(item[1]).strip())
            try:
                scores.append(float(item[2]))
            except (TypeError, ValueError):
                scores.append(0.5)
        elif len(item) >= 2:
            parts.append(str(item[1]).strip())
    text = "".join(p for p in parts if p)
    conf = sum(scores) / len(scores) if scores else 0.0
    return text, conf


def _paddle_payload_dict(item: Any) -> Dict[str, Any]:
    """统一 PaddleOCR 2.x / 3.x 返回为含 rec_texts 的 dict。"""
    if item is None:
        return {}
    if hasattr(item, "json") and callable(getattr(item, "json", None)):
        try:
            j = item.json
            if isinstance(j, dict):
                item = j
        except Exception:
            pass
    if not isinstance(item, dict):
        return {}
    inner = item.get("res")
    if isinstance(inner, dict):
        return inner
    return item


def _as_float_list(scores: Any) -> List[float]:
    if scores is None:
        return []
    if hasattr(scores, "tolist"):
        scores = scores.tolist()
    if not isinstance(scores, (list, tuple)):
        return []
    out: List[float] = []
    for s in scores:
        try:
            out.append(float(s))
        except (TypeError, ValueError):
            out.append(0.5)
    return out


def _parse_paddle_result(result: Any) -> Tuple[str, float]:
    texts: List[str] = []
    scores: List[float] = []
    if result is None:
        return "", 0.0
    items = result if isinstance(result, list) else [result]
    for item in items:
        payload = _paddle_payload_dict(item)
        if payload:
            rec_texts = payload.get("rec_texts") or payload.get("texts") or []
            rec_scores = _as_float_list(
                payload.get("rec_scores") or payload.get("scores")
            )
            for i, t in enumerate(rec_texts):
                t = str(t).strip()
                if t:
                    texts.append(t)
                    if i < len(rec_scores):
                        scores.append(rec_scores[i])
                    else:
                        scores.append(0.5)
            continue
        if isinstance(item, (list, tuple)):
            for line in item:
                if isinstance(line, (list, tuple)) and len(line) >= 2:
                    t = str(line[1][0] if isinstance(line[1], (list, tuple)) else line[1]).strip()
                    if t:
                        texts.append(t)
                        if len(line) >= 3:
                            try:
                                scores.append(float(line[2]))
                            except (TypeError, ValueError):
                                scores.append(0.5)
    text = "".join(texts)
    conf = sum(scores) / len(scores) if scores else 0.0
    return text, conf


def _ocr_paddle(
    ocr: Any,
    bgr: Any,
    cv2: Any,
    preprocess: Optional[Dict[str, Any]],
) -> Tuple[str, float]:
    if preprocess and bool(preprocess.get("enabled", False)):
        bgr = _preprocess_subtitle_crop(bgr, cv2, preprocess)
    try:
        result = ocr.predict(bgr, use_textline_orientation=True)
    except TypeError:
        result = ocr.ocr(bgr, cls=True)
    return _parse_paddle_result(result)


def _roi_mean_diff(gray_a: Any, gray_b: Any) -> float:
    import numpy as np  # type: ignore

    if gray_a.shape != gray_b.shape:
        return 999.0
    return float(np.mean(np.abs(gray_a.astype(np.int16) - gray_b.astype(np.int16))))


def _read_frame_at(cap: Any, cv2: Any, t: float) -> Optional[Any]:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
    ok, frame = cap.read()
    return frame if ok and frame is not None else None


def _recognize_at_time(
    *,
    engine: str,
    easy_reader: Any,
    paddle_ocr: Any,
    cap: Any,
    cv2: Any,
    t: float,
    roi_ratio: Dict[str, float],
    preprocess: Optional[Dict[str, Any]],
) -> Tuple[str, float]:
    frame = _read_frame_at(cap, cv2, t)
    if frame is None:
        return "", 0.0
    h0, w0 = frame.shape[:2]
    x, y, rw, rh = _roi_pixels(w0, h0, roi_ratio)
    crop = frame[y : y + rh, x : x + rw]
    if engine == "paddle":
        return _ocr_paddle(paddle_ocr, crop, cv2, preprocess)
    return _ocr_easyocr(easy_reader, crop, cv2, preprocess)


def generate_segments_from_video_ocr(
    ffprobe: str,
    video_path: Path,
    *,
    sample_interval_sec: float,
    roi_ratio: Dict[str, float],
    languages: List[str],
    min_segment_sec: float,
    engine: str = "easyocr",
    use_gpu: bool = True,
    stability: Optional[Dict[str, Any]] = None,
    text_debounce_cfg: Optional[Dict[str, Any]] = None,
    vote_cfg: Optional[Dict[str, Any]] = None,
    preprocess: Optional[Dict[str, Any]] = None,
    logger: Optional[Any] = None,
) -> List[SubtitleSegment]:
    try:
        import cv2  # type: ignore
    except ImportError as e:
        raise ImportError(
            "OCR 需要 opencv-python-headless，请执行: pip install opencv-python-headless"
        ) from e

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"无法打开视频: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if fps > 0 else 0.0
    if duration <= 0:
        from .utils import get_video_duration_sec

        duration = get_video_duration_sec(ffprobe, video_path)

    engine = (engine or "easyocr").lower()
    easy_reader = None
    paddle_ocr = None
    if engine == "paddle":
        paddle_ocr = _load_paddle_ocr(use_gpu)
    else:
        easy_reader = _load_easyocr_reader(list(languages), use_gpu)

    stab = dict(stability or {})
    stab_enabled = bool(stab.get("enabled", True))
    diff_threshold = float(stab.get("diff_threshold", 6.0))
    max_reuse_sec = float(stab.get("max_reuse_sec", 0.29))
    vote_offsets = [float(x) for x in (stab.get("vote_offsets_sec") or [0.06, 0.12])]

    vc = dict(vote_cfg or {})
    min_vote_conf = float(vc.get("min_confidence", 0.35))
    cluster_sim = float(vc.get("cluster_similarity", 0.85))
    merge_sim = float(vc.get("merge_similarity", 0.88))
    prefix_min_support = float(vc.get("prefix_strip_min_support", 0.52))

    debouncer = _TextDebouncer(
        enabled=bool((text_debounce_cfg or {}).get("enabled", True)),
        same_line_similarity=float(
            (text_debounce_cfg or {}).get("same_line_similarity", 0.96)
        ),
        confirm_steps=int((text_debounce_cfg or {}).get("confirm_steps", 2)),
    )

    step = max(0.1, float(sample_interval_sec))
    times: List[float] = []
    t = 0.0
    while t <= duration + 1e-6:
        times.append(t)
        t += step

    prev_gray: Optional[Any] = None
    prev_text = ""
    last_ocr_t = -1e9
    samples: List[Tuple[float, str, float]] = []

    for t in times:
        frame = _read_frame_at(cap, cv2, t)
        if frame is None:
            continue
        h0, w0 = frame.shape[:2]
        x, y, rw, rh = _roi_pixels(w0, h0, roi_ratio)
        crop = frame[y : y + rh, x : x + rw]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

        reuse = False
        if stab_enabled and prev_gray is not None and prev_text:
            diff = _roi_mean_diff(prev_gray, gray)
            time_since_ocr = t - last_ocr_t
            if diff < diff_threshold and time_since_ocr < max_reuse_sec:
                reuse = True

        if reuse:
            text = prev_text
            conf = 1.0
        else:
            vote_times = [t] + [t + off for off in vote_offsets if t + off <= duration]
            frame_candidates: List[Tuple[str, float]] = []
            for vt in vote_times:
                raw, c = _recognize_at_time(
                    engine=engine,
                    easy_reader=easy_reader,
                    paddle_ocr=paddle_ocr,
                    cap=cap,
                    cv2=cv2,
                    t=vt,
                    roi_ratio=roi_ratio,
                    preprocess=preprocess,
                )
                if raw and raw.strip():
                    frame_candidates.append((raw.strip(), float(c)))
            voted_text, voted_conf = _vote_ocr_candidates(
                frame_candidates,
                min_confidence=min_vote_conf,
                cluster_similarity=cluster_sim,
                prefix_min_support=prefix_min_support,
            )
            text = debouncer.apply(voted_text)
            prev_text = text
            prev_gray = gray
            last_ocr_t = t
            conf = voted_conf

        samples.append((t, text.strip(), float(conf)))
        if logger:
            logger.debug("OCR t=%.2f text=%r conf=%.3f reuse=%s", t, text, conf, reuse)

    cap.release()

    segments: List[SubtitleSegment] = []
    if not samples:
        return segments

    i = 0
    n = len(samples)
    while i < n:
        t0, txt, _ = samples[i]
        if not txt:
            i += 1
            continue
        j = i
        cluster: List[Tuple[str, float]] = [(txt, samples[i][2])]
        while j + 1 < n:
            tj, txtj, cj = samples[j + 1]
            if not txtj:
                break
            if _text_similarity(txtj, txt) >= merge_sim:
                cluster.append((txtj, cj))
                j += 1
            else:
                break
        canonical, _ = _vote_ocr_candidates(
            cluster,
            min_confidence=0.0,
            cluster_similarity=cluster_sim,
            prefix_min_support=prefix_min_support,
        )
        if not canonical:
            canonical = txt
        t_last = samples[j][0]
        end = min(duration, t_last + step * 0.5)
        start = t0
        if end - start < min_segment_sec:
            end = min(duration, start + min_segment_sec)
        segments.append(SubtitleSegment(start=start, end=end, text=canonical))
        i = j + 1

    cleaned: List[SubtitleSegment] = []
    for s in segments:
        if not s.text.strip():
            continue
        e = max(s.end, s.start + 0.05)
        cleaned.append(
            SubtitleSegment(start=s.start, end=min(duration, e), text=s.text.strip())
        )
    return cleaned


def try_generate_srt_via_ocr(
    ffprobe: str,
    video_path: Path,
    work_srt: Path,
    ocr_cfg: Dict[str, Any],
    logger: Optional[Any] = None,
) -> bool:
    segs = generate_segments_from_video_ocr(
        ffprobe,
        video_path,
        sample_interval_sec=float(ocr_cfg.get("sample_interval_sec", 0.4)),
        roi_ratio=dict(ocr_cfg.get("roi_ratio") or {}),
        languages=list(ocr_cfg.get("languages") or ["ch_sim", "en"]),
        min_segment_sec=float(ocr_cfg.get("min_segment_sec", 0.5)),
        engine=str(ocr_cfg.get("engine", "easyocr")),
        use_gpu=bool(ocr_cfg.get("use_gpu", True)),
        stability=dict(ocr_cfg.get("stability") or {}),
        text_debounce_cfg=dict(ocr_cfg.get("text_debounce") or {}),
        vote_cfg=dict(ocr_cfg.get("vote") or {}),
        preprocess=dict(ocr_cfg.get("preprocess") or {}) or None,
        logger=logger,
    )
    if not segs:
        return False
    work_srt.parent.mkdir(parents=True, exist_ok=True)
    lines: List[str] = []
    for i, s in enumerate(segs, start=1):

        def fmt(ts: float) -> str:
            if ts < 0:
                ts = 0.0
            ms = int(round((ts - int(ts)) * 1000))
            total = int(math.floor(ts))
            h = total // 3600
            m = (total % 3600) // 60
            sec = total % 60
            return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"

        lines.append(str(i))
        lines.append(f"{fmt(s.start)} --> {fmt(s.end)}")
        lines.append(s.text)
        lines.append("")
    work_srt.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True
