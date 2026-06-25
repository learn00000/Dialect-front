"""OCR 重复句本地聚类与择优（必要时交 LLM）。"""

from __future__ import annotations

import difflib
import re
from typing import Any, Dict, List, Optional

_PUNCT_MAP = str.maketrans(
    {
        "（": "(",
        "）": ")",
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
        "，": ",",
        "。": ".",
        "：": ":",
        "；": ";",
    }
)


def normalize_for_compare(text: str) -> str:
    t = (text or "").strip().translate(_PUNCT_MAP)
    t = re.sub(r"\s+", "", t)
    # 比对前去标点：避免「你好」vs「你好。」被算成 88% 子串相似
    t = re.sub(r"[^\w]", "", t, flags=re.UNICODE)
    return t


def text_similarity(a: str, b: str) -> float:
    na, nb = normalize_for_compare(a), normalize_for_compare(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
        return max(0.88, len(shorter) / len(longer))
    return difflib.SequenceMatcher(None, na, nb).ratio()


def cluster_similar_texts(
    texts: List[str],
    *,
    threshold: float = 0.82,
) -> List[List[str]]:
    """将相似文本聚成若干簇（保持首次出现顺序）。"""
    clusters: List[List[str]] = []
    for t in texts:
        t = (t or "").strip()
        if not t:
            continue
        placed = False
        for cluster in clusters:
            if text_similarity(t, cluster[0]) >= threshold:
                cluster.append(t)
                placed = True
                break
        if not placed:
            clusters.append([t])
    return clusters


def pick_best_local(variants: List[str]) -> str:
    """无 LLM 时从若干相似句里选一条更完整的。"""
    uniq: List[str] = []
    seen = set()
    for v in variants:
        v = v.strip()
        key = normalize_for_compare(v)
        if not key or key in seen:
            continue
        seen.add(key)
        uniq.append(v)
    if len(uniq) == 1:
        return uniq[0]

    def score(s: str) -> tuple:
        n = normalize_for_compare(s)
        return (
            len(n),
            len(s),
            1 if "（" in s or "）" in s else 0,
            1 if "了" in s else 0,
        )

    return max(uniq, key=score)


def join_distinct_clip_texts(
    texts: List[str],
    *,
    similarity_threshold: float = 0.82,
    llm_cfg: Optional[Dict[str, Any]] = None,
    logger: Optional[Any] = None,
) -> str:
    """合并同一 clip 内多条 OCR：相似句只保留一条，不同句用空格连接。"""
    cleaned = [t.strip() for t in texts if (t or "").strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]

    clusters = cluster_similar_texts(cleaned, threshold=similarity_threshold)
    parts: List[str] = []
    use_llm = bool((llm_cfg or {}).get("consolidate_clip_variants", True))

    for cluster in clusters:
        if len(cluster) == 1:
            parts.append(cluster[0])
            continue
        if use_llm and len(cluster) >= 2:
            try:
                from .llm_proofread import consolidate_text_variants

                parts.append(consolidate_text_variants(cluster, llm_cfg or {}, logger))
                continue
            except Exception as e:
                if logger:
                    logger.debug("LLM 择优失败，回退本地规则: %s", e)
        parts.append(pick_best_local(cluster))

    return " ".join(parts)
