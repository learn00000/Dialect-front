"""使用阿里百炼（DashScope OpenAI 兼容）批量校对 OCR 字幕文本。"""

from __future__ import annotations

import json
import os
import re
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .srt_parser import (
    SubtitleSegment,
    collapse_similar_ocr_segments,
    drop_single_char_segments,
    parse_srt_file,
    write_srt_file,
)

_JSON_BLOCK = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _reject_correction(before: str, after: str) -> bool:
    """过滤明显劣化：空文本、相邻重复短语等。"""
    after = (after or "").strip()
    before = (before or "").strip()
    if not after:
        return True
    if after == before:
        return False
    # 相邻重复片段（如「订了一台订了一台」）
    for width in range(3, min(24, len(after) // 2 + 1)):
        for i in range(0, len(after) - 2 * width + 1):
            chunk = after[i : i + width]
            if after[i + width : i + 2 * width] != chunk:
                continue
            if before.count(chunk) >= after.count(chunk):
                continue
            return True
    return False


from .api_keys import resolve_dashscope_api_key


def _resolve_api_key(cfg: Dict[str, Any]) -> str:
    return resolve_dashscope_api_key(cfg)


def _build_batch_prompt(items: List[Dict[str, Any]], dialect_hint: str) -> str:
    payload = json.dumps(items, ensure_ascii=False, indent=2)
    hint = dialect_hint.strip() or "台州方言新闻口播，字幕来自视频硬字幕 OCR"
    return f"""你是中文新闻字幕校对助手。以下 JSON 数组来自视频硬字幕 OCR，可能存在错字、漏字、多余符号或英文误识别。

场景：{hint}

要求：
1. 只修正明显的 OCR 错误，保持口语与方言用词习惯，不要润色或扩写。
2. 不要改动数字、专名、地名；不确定时保留原文。
3. 若某条只有一个字且像 OCR 噪声（如单独的「商」「我」「哦」），text 请输出空字符串 ""。
4. 禁止叠字、禁止重复短语；原文已通顺则 text 与输入完全一致。
5. 每条必须保留 id，只输出 text 字段的修正结果。
6. 仅返回 JSON 对象，不要 markdown、不要解释。格式：{{"items": [{{"id": 1, "text": "..."}}, ...]}}

待校对：
{payload}"""


def _extract_json_array(text: str) -> List[Dict[str, Any]]:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("模型返回为空")
    m = _JSON_BLOCK.search(raw)
    if m:
        raw = m.group(1).strip()
    # 直接数组
    if raw.startswith("["):
        data = json.loads(raw)
    else:
        # 包在对象里
        obj = json.loads(raw)
        if isinstance(obj, list):
            data = obj
        elif isinstance(obj, dict):
            for k in ("items", "results", "subtitles", "data"):
                if isinstance(obj.get(k), list):
                    data = obj[k]
                    break
            else:
                raise ValueError(f"无法从 JSON 对象中解析数组: {list(obj.keys())}")
        else:
            raise ValueError("返回不是 JSON 数组")
    if not isinstance(data, list):
        raise ValueError("返回不是 JSON 数组")
    out: List[Dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        rid = row.get("id")
        txt = row.get("text")
        if rid is None or txt is None:
            continue
        out.append({"id": int(rid), "text": str(txt).strip()})
    if not out:
        raise ValueError("解析后无有效条目")
    return out


def _chat_completion(
    *,
    api_key: str,
    base_url: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
    timeout_sec: float,
    enable_thinking: bool,
) -> str:
    url = base_url.rstrip("/") + "/chat/completions"
    body: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "enable_thinking": enable_thinking,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"API HTTP {e.code}: {err_body[:500]}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"API 请求失败: {e}") from e

    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError(f"API 无 choices: {payload}")
    msg = choices[0].get("message") or {}
    content = msg.get("content") or ""
    if not content and msg.get("reasoning_content"):
        content = msg["reasoning_content"]
    return str(content).strip()


def consolidate_text_variants(
    variants: List[str],
    cfg: Dict[str, Any],
    logger: Optional[Any] = None,
) -> str:
    """多条高度相似 OCR 文本 -> 一条最合适字幕。"""
    cleaned = [v.strip() for v in variants if (v or "").strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]

    api_key = _resolve_api_key(cfg)
    payload = json.dumps(
        {"variants": cleaned},
        ensure_ascii=False,
        indent=2,
    )
    hint = str(cfg.get("dialect_hint") or "台州方言新闻口播硬字幕 OCR")
    prompt = f"""以下是同一句台词的多次 OCR 识别结果（可能有错字、漏字、括号全半角差异）。

场景：{hint}

请从中选出或轻微修正为**一条**最完整、最符合口播习惯的字幕。
要求：
1. 只输出 JSON：{{"text": "..."}}
2. 不要合并成两句；不要解释；不要 markdown。
3. 禁止叠字或重复短语；优先保留正确量词（如「订了一台」优于「订一台」「订台」）。

{payload}"""

    messages = [
        {"role": "system", "content": "你只输出合法 JSON 对象。"},
        {"role": "user", "content": prompt},
    ]
    raw = _chat_completion(
        api_key=api_key,
        base_url=str(
            cfg.get("base_url") or "https://dashscope.aliyuncs.com/compatible-mode/v1"
        ),
        model=str(cfg.get("model") or "deepseek-v4-flash"),
        messages=messages,
        temperature=float(cfg.get("temperature", 0.1)),
        max_tokens=int(cfg.get("max_tokens", 1024)),
        timeout_sec=float(cfg.get("timeout_sec", 60)),
        enable_thinking=bool(cfg.get("enable_thinking", False)),
    )
    text = raw.strip()
    if text.startswith("{"):
        obj = json.loads(text)
        out = str(obj.get("text") or "").strip()
    else:
        m = _JSON_BLOCK.search(text)
        body = m.group(1).strip() if m else text
        obj = json.loads(body)
        out = str(obj.get("text") or "").strip()
    if not out:
        raise ValueError("LLM 未返回 text 字段")
    from .text_dedupe import pick_best_local

    if _reject_correction(cleaned[0], out):
        return pick_best_local(cleaned)
    return out


def _proofread_batch(
    batch: List[Tuple[int, str]],
    cfg: Dict[str, Any],
    api_key: str,
    logger: Optional[Any],
) -> Dict[int, str]:
    items = [{"id": i, "text": t} for i, t in batch]
    prompt = _build_batch_prompt(items, str(cfg.get("dialect_hint") or ""))
    messages = [
        {
            "role": "system",
            "content": "你是字幕 OCR 校对助手，只输出合法 JSON。",
        },
        {"role": "user", "content": prompt},
    ]
    model = str(cfg.get("model") or "deepseek-v4-flash")
    base_url = str(
        cfg.get("base_url") or "https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
    temperature = float(cfg.get("temperature", 0.1))
    max_tokens = int(cfg.get("max_tokens", 4096))
    timeout_sec = float(cfg.get("timeout_sec", 120))
    enable_thinking = bool(cfg.get("enable_thinking", False))
    retries = int(cfg.get("retries", 2))
    retry_sleep = float(cfg.get("retry_sleep_sec", 2.0))

    last_err: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            raw = _chat_completion(
                api_key=api_key,
                base_url=base_url,
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout_sec=timeout_sec,
                enable_thinking=enable_thinking,
            )
            parsed = _extract_json_array(raw)
            return {row["id"]: row["text"] for row in parsed}
        except Exception as e:
            last_err = e
            if logger:
                logger.warning(
                    "LLM 批次校对失败 (attempt %s/%s): %s",
                    attempt + 1,
                    retries + 1,
                    e,
                )
            if attempt < retries:
                time.sleep(retry_sleep)
    raise RuntimeError(f"批次校对失败: {last_err}") from last_err


def proofread_segments(
    segments: List[SubtitleSegment],
    cfg: Dict[str, Any],
    logger: Optional[Any] = None,
) -> Tuple[List[SubtitleSegment], List[Dict[str, Any]]]:
    """校对字幕列表，返回新 segments 与变更记录。"""
    if not segments:
        return [], []

    api_key = _resolve_api_key(cfg)
    batch_size = max(1, int(cfg.get("batch_size", 30)))
    changes: List[Dict[str, Any]] = []
    texts = list(segments)

    for start in range(0, len(segments), batch_size):
        chunk = segments[start : start + batch_size]
        batch: List[Tuple[int, str]] = [
            (start + j + 1, seg.text) for j, seg in enumerate(chunk)
        ]
        if logger:
            logger.info(
                "LLM 校对批次 %s-%s / %s",
                batch[0][0],
                batch[-1][0],
                len(segments),
            )
        mapping = _proofread_batch(batch, cfg, api_key, logger)
        for j, seg in enumerate(chunk):
            sid = start + j + 1
            new_text = mapping.get(sid, seg.text).strip()
            if new_text and new_text != seg.text:
                if _reject_correction(seg.text, new_text):
                    if logger:
                        logger.debug(
                            "LLM 修改已丢弃 id=%s: %r -> %r",
                            sid,
                            seg.text[:60],
                            new_text[:60],
                        )
                    continue
                changes.append(
                    {
                        "id": sid,
                        "before": seg.text,
                        "after": new_text,
                    }
                )
                texts[start + j] = SubtitleSegment(
                    start=seg.start, end=seg.end, text=new_text
                )

    return texts, changes


def proofread_srt_file(
    srt_path: Path,
    cfg: Dict[str, Any],
    logger: Optional[Any] = None,
    *,
    force: bool = False,
) -> bool:
    """就地校对 SRT：备份 .bak，写入 diff JSON。成功返回 True。"""
    srt_path = Path(srt_path)
    if not srt_path.is_file():
        if logger:
            logger.warning("LLM 校对跳过：SRT 不存在 %s", srt_path)
        return False

    skip_if_exists = bool(cfg.get("skip_if_proofread_exists", True))
    marker = srt_path.with_suffix(srt_path.suffix + ".proofread")
    if skip_if_exists and marker.is_file() and not force:
        if logger:
            logger.info("LLM 校对跳过（已有标记 %s）", marker.name)
        return True

    segments = parse_srt_file(srt_path)
    if not segments:
        if logger:
            logger.warning("LLM 校对跳过：SRT 无有效条目 %s", srt_path)
        return False

    backup = srt_path.with_suffix(srt_path.suffix + ".bak")
    if not backup.is_file():
        shutil.copy2(srt_path, backup)
        if logger:
            logger.info("已备份 SRT -> %s", backup)

    new_segments, changes = proofread_segments(segments, cfg, logger)

    collapse_cfg = dict(cfg.get("collapse_similar") or {})
    if collapse_cfg.get("enabled", True):
        fuzzy = collapse_cfg
        n_before = len(new_segments)
        new_segments = collapse_similar_ocr_segments(
            new_segments,
            float(fuzzy.get("max_gap_sec", 0.45)),
            float(fuzzy.get("similarity_threshold", 0.80)),
            llm_cfg=cfg,
            logger=logger,
        )
        if logger and len(new_segments) != n_before:
            logger.info(
                "相似字幕合并: %d -> %d 条（间隙≤%.2fs，相似度≥%.2f）",
                n_before,
                len(new_segments),
                float(fuzzy.get("max_gap_sec", 0.45)),
                float(fuzzy.get("similarity_threshold", 0.80)),
            )

    drop_cfg = dict(cfg.get("drop_single_char") or {})
    if drop_cfg.get("enabled", True):
        allow = list(drop_cfg.get("allowlist") or cfg.get("single_char_allowlist") or [])
        n0 = len(new_segments)
        new_segments = drop_single_char_segments(new_segments, allowlist=allow)
        if logger and len(new_segments) != n0:
            logger.info("去掉单字噪声条: %d -> %d 条", n0, len(new_segments))

    write_srt_file(srt_path, new_segments)

    diff_path = srt_path.with_suffix(srt_path.suffix + ".proofread.json")
    diff_path.write_text(
        json.dumps(
            {
                "srt": str(srt_path),
                "model": cfg.get("model"),
                "changed_count": len(changes),
                "changes": changes,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    marker.write_text(
        f"proofread_at={time.strftime('%Y-%m-%dT%H:%M:%S')}\n",
        encoding="utf-8",
    )
    if logger:
        logger.info(
            "LLM 校对完成：%s 条修改 / %s 条字幕，diff=%s",
            len(changes),
            len(segments),
            diff_path.name,
        )
    return True
