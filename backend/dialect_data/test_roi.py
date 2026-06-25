#!/usr/bin/env python3
"""
ROI 调试：从视频抽帧，画出 config 中的字幕区域，并保存裁剪预览。

用法示例：
  python test_roi.py
  python test_roi.py --video taizhou-news/video/video1/20260418.mp4
  python test_roi.py --x 0.14 --y 0.85 --w 0.82 --h 0.10
  python test_roi.py --times 0,120,300,600 --ocr
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import yaml

from src.ocr_subtitle import (
    _color_binarize_subtitle,
    _load_paddle_ocr,
    _ocr_paddle,
    _preprocess_subtitle_crop,
    _roi_pixels,
)


def load_config(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def parse_times(s: str) -> List[float]:
    out: List[float] = []
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        out.append(float(part))
    return out or [0.0, 30.0, 120.0, 300.0]


def draw_roi(
    frame: Any,
    roi: Dict[str, float],
    cv2: Any,
    *,
    color: Tuple[int, int, int] = (0, 255, 0),
    thickness: int = 3,
) -> Any:
    h, w = frame.shape[:2]
    x, y, rw, rh = _roi_pixels(w, h, roi)
    vis = frame.copy()
    cv2.rectangle(vis, (x, y), (x + rw, y + rh), color, thickness)
    label = f"x={roi['x']:.3f} y={roi['y']:.3f} w={roi['w']:.3f} h={roi['h']:.3f}"
    cv2.putText(
        vis,
        label,
        (x, max(24, y - 8)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        color,
        2,
        cv2.LINE_AA,
    )
    # 左侧 15% 参考线（常见台标区）
    lx = int(w * 0.15)
    cv2.line(vis, (lx, y), (lx, y + rh), (0, 180, 255), 1, cv2.LINE_AA)
    cv2.putText(
        vis,
        "15% ref",
        (lx + 4, y + 22),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (0, 180, 255),
        1,
        cv2.LINE_AA,
    )
    return vis, (x, y, rw, rh)


def read_frame_at(cap: Any, cv2: Any, t: float, duration: float) -> Any | None:
    t = max(0.0, min(t, max(0.0, duration - 0.05)))
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
    ok, frame = cap.read()
    return frame if ok and frame is not None else None


def run_ocr_on_crop(
    crop: Any,
    cv2: Any,
    preprocess: Dict[str, Any] | None,
    use_gpu: bool,
) -> Tuple[str, float]:
    ocr = _load_paddle_ocr(use_gpu)
    return _ocr_paddle(ocr, crop, cv2, preprocess)


def main() -> int:
    parser = argparse.ArgumentParser(description="字幕 ROI 可视化与试切")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("config.yaml"),
        help="配置文件路径",
    )
    parser.add_argument(
        "--video",
        type=Path,
        default=None,
        help="视频路径；默认取 config inputs 下第一个 mp4",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("output/roi_debug"),
        help="输出目录",
    )
    parser.add_argument(
        "--times",
        type=str,
        default="0,30,120,300,600,675,695",
        help="抽帧时间点（秒），逗号分隔",
    )
    parser.add_argument("--x", type=float, default=None, help="覆盖 roi x (0~1)")
    parser.add_argument("--y", type=float, default=None, help="覆盖 roi y (0~1)")
    parser.add_argument("--w", type=float, default=None, help="覆盖 roi w (0~1)")
    parser.add_argument("--h", type=float, default=None, help="覆盖 roi h (0~1)")
    parser.add_argument(
        "--compare-left",
        type=float,
        default=None,
        metavar="X",
        help="额外画一条对比 ROI（仅 x 不同，用于试去掉左侧台标）",
    )
    parser.add_argument(
        "--ocr",
        action="store_true",
        help="对每个裁剪区跑一次 PaddleOCR（较慢，用于即时看识别结果）",
    )
    parser.add_argument("--no-gpu", action="store_true", help="OCR 使用 CPU")
    args = parser.parse_args()

    try:
        import cv2  # type: ignore
    except ImportError:
        print("需要 opencv: pip install opencv-python-headless", file=sys.stderr)
        return 1

    cfg = load_config(args.config)
    ocr_cfg = dict(cfg.get("ocr") or {})
    roi = dict(ocr_cfg.get("roi_ratio") or {"x": 0.04, "y": 0.83, "w": 0.92, "h": 0.15})
    for key, val in (("x", args.x), ("y", args.y), ("w", args.w), ("h", args.h)):
        if val is not None:
            roi[key] = val

    video = args.video
    if video is None:
        inputs = cfg.get("inputs") or []
        found: Path | None = None
        for inp in inputs:
            d = Path(inp)
            if not d.is_absolute():
                d = Path.cwd() / d
            if d.is_file():
                found = d
                break
            for ext in (".mp4", ".mkv", ".mov", ".avi", ".webm"):
                for p in sorted(d.rglob(f"*{ext}")):
                    found = p
                    break
                if found:
                    break
            if found:
                break
        if not found:
            print("未找到视频，请用 --video 指定", file=sys.stderr)
            return 1
        video = found
    video = video.resolve()
    if not video.exists():
        print(f"视频不存在: {video}", file=sys.stderr)
        return 1

    times = parse_times(args.times)
    out_dir = args.out.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        print(f"无法打开: {video}", file=sys.stderr)
        return 1

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    nframes = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = nframes / fps if fps > 0 else 0.0
    fw = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    fh = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    preprocess = dict(ocr_cfg.get("preprocess") or {}) if args.ocr else None
    use_gpu = bool(ocr_cfg.get("use_gpu", True)) and not args.no_gpu

    print(f"视频: {video}")
    print(f"分辨率: {fw}x{fh}  时长: {duration:.1f}s")
    print(f"ROI: x={roi['x']:.3f} y={roi['y']:.3f} w={roi['w']:.3f} h={roi['h']:.3f}")
    print(f"输出: {out_dir}")
    print()

    summary_lines: List[str] = [
        f"video={video}",
        f"size={fw}x{fh} duration={duration:.3f}",
        f"roi x={roi['x']:.4f} y={roi['y']:.4f} w={roi['w']:.4f} h={roi['h']:.4f}",
        "",
    ]

    px_x, px_y, px_w, px_h = _roi_pixels(fw, fh, roi)
    summary_lines.append(
        f"像素区域: left={px_x} top={px_y} width={px_w} height={px_h} "
        f"(right={px_x + px_w} bottom={px_y + px_h})"
    )
    summary_lines.append("")

    for t in times:
        if duration > 0 and t > duration:
            continue
        frame = read_frame_at(cap, cv2, t, duration)
        if frame is None:
            print(f"  t={t:.1f}s  读帧失败，跳过")
            continue

        tag = f"t{int(t):04d}"
        vis, (x, y, rw, rh) = draw_roi(frame, roi, cv2)
        crop = frame[y : y + rh, x : x + rw]

        full_path = out_dir / f"{tag}_full.jpg"
        crop_path = out_dir / f"{tag}_crop.jpg"
        cv2.imwrite(str(full_path), vis)
        cv2.imwrite(str(crop_path), crop)

        line = f"t={t:7.1f}s  full={full_path.name}  crop={crop_path.name}  px=({x},{y},{rw}x{rh})"
        print(line)
        summary_lines.append(line)

        if args.compare_left is not None:
            alt = dict(roi)
            alt["x"] = float(args.compare_left)
            alt_w = float(roi["w"]) - (alt["x"] - float(roi["x"]))
            alt["w"] = max(0.05, alt_w)
            vis2, (x2, y2, rw2, rh2) = draw_roi(frame, alt, cv2, color=(255, 160, 0))
            alt_crop = frame[y2 : y2 + rh2, x2 : x2 + rw2]
            cv2.imwrite(str(out_dir / f"{tag}_full_alt.jpg"), vis2)
            cv2.imwrite(str(out_dir / f"{tag}_crop_alt.jpg"), alt_crop)
            summary_lines.append(
                f"  alt roi x={alt['x']:.3f} w={alt['w']:.3f} -> {tag}_crop_alt.jpg"
            )

        preprocess_cfg = dict(ocr_cfg.get("preprocess") or {}) if ocr_cfg else {}
        if preprocess_cfg.get("enabled"):
            bin_cfg = preprocess_cfg.get("color_binarize") or {}
            if isinstance(bin_cfg, dict) and bin_cfg.get("enabled"):
                bin_only = _color_binarize_subtitle(crop, cv2, bin_cfg)
                cv2.imwrite(str(out_dir / f"{tag}_crop_binarize.jpg"), bin_only)
            proc = _preprocess_subtitle_crop(crop, cv2, preprocess_cfg)
            cv2.imwrite(str(out_dir / f"{tag}_crop_preprocessed.jpg"), proc)

        if args.ocr:
            text, conf = run_ocr_on_crop(crop, cv2, preprocess, use_gpu)
            ocr_line = f"  OCR: {text!r}  conf={conf:.3f}"
            print(ocr_line)
            summary_lines.append(ocr_line)

    cap.release()

    readme = out_dir / "README.txt"
    readme.write_text(
        "\n".join(summary_lines)
        + "\n\n调参说明:\n"
        "  1. 打开 *_full.jpg：绿框=当前 ROI，青线=画面宽 15%（常见台标右边界参考）\n"
        "  2. 打开 *_crop.jpg：OCR 实际输入；左侧若有多余 logo/「典」等，增大 config 里 ocr.roi_ratio.x\n"
        "  3. 满意后把 x,y,w,h 写入 config.yaml 的 ocr.roi_ratio\n"
        "  4. 对比左侧收窄: python test_roi.py --compare-left 0.14 --x 0.04\n"
        "  5. 试 OCR: python test_roi.py --times 7.5,12,14 --ocr\n"
        "  6. *_crop_binarize.jpg=仅颜色二值化, *_crop_preprocessed.jpg=完整预处理(送入 OCR)\n",
        encoding="utf-8",
    )
    print()
    print(f"已写入 {out_dir}/")
    print(f"说明文件: {readme}")
    print("调好后更新 config.yaml -> ocr.roi_ratio")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
