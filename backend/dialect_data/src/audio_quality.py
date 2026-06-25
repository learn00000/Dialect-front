"""切片音频听感质检（不依赖 ASR）。"""

from __future__ import annotations

import math
import struct
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class AudioQualityMetrics:
    duration_sec: float
    rms: float
    peak: float
    crest_db: float
    speech_ratio: float
    tail_ratio: float
    low_band_ratio: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "duration_sec": self.duration_sec,
            "rms": self.rms,
            "peak": self.peak,
            "crest_db": self.crest_db,
            "speech_ratio": self.speech_ratio,
            "tail_ratio": self.tail_ratio,
            "low_band_ratio": self.low_band_ratio,
        }


def _read_mono_pcm(path: Path) -> Tuple[List[float], int]:
    with wave.open(str(path), "rb") as wf:
        ch = wf.getnchannels()
        sw = wf.getsampwidth()
        rate = wf.getframerate()
        n = wf.getnframes()
        raw = wf.readframes(n)
    if sw != 2:
        raise ValueError(f"仅支持 16-bit PCM: {path}")
    samples = struct.unpack(f"<{n * ch}h", raw)
    if ch > 1:
        samples = [
            sum(samples[i : i + ch]) / ch for i in range(0, len(samples), ch)
        ]
    scale = 1.0 / 32768.0
    return [s * scale for s in samples], rate


def analyze_wav(path: Path, *, frame_ms: int = 30) -> AudioQualityMetrics:
    samples, rate = _read_mono_pcm(path)
    if not samples:
        return AudioQualityMetrics(0, 0, 0, 0, 0, 0, 0)

    frame_len = max(1, int(rate * frame_ms / 1000))
    energies: List[float] = []
    low_energies: List[float] = []
    for i in range(0, len(samples), frame_len):
        frame = samples[i : i + frame_len]
        if not frame:
            continue
        e = sum(x * x for x in frame) / len(frame)
        energies.append(e)
        # 简易低频占比：相邻样本差分小 → 能量偏「糊/配乐」
        diff = sum((frame[j] - frame[j - 1]) ** 2 for j in range(1, len(frame))) / max(
            1, len(frame) - 1
        )
        low_energies.append(max(0.0, e - diff * 4.0))

    if not energies:
        return AudioQualityMetrics(0, 0, 0, 0, 0, 0, 0)

    rms = math.sqrt(sum(energies) / len(energies))
    peak = math.sqrt(max(energies))
    crest_db = 20.0 * math.log10(max(peak, 1e-9) / max(rms, 1e-9))

    sorted_e = sorted(energies)
    noise_floor = sorted_e[max(0, int(len(sorted_e) * 0.15) - 1)]
    threshold = max(noise_floor * 4.0, rms * 0.12)
    speech_frames = sum(1 for e in energies if e >= threshold)
    speech_ratio = speech_frames / len(energies)

    tail_n = max(1, int(0.35 / (frame_ms / 1000.0)))
    mid_n = max(1, len(energies) // 3)
    mid_e = sum(energies[len(energies) // 2 - mid_n // 2 : len(energies) // 2 + mid_n // 2]) / mid_n
    tail_e = sum(energies[-tail_n:]) / tail_n
    tail_ratio = tail_e / max(mid_e, 1e-12)

    low_band_ratio = sum(low_energies) / max(sum(energies), 1e-12)

    return AudioQualityMetrics(
        duration_sec=len(samples) / rate,
        rms=rms,
        peak=peak,
        crest_db=crest_db,
        speech_ratio=speech_ratio,
        tail_ratio=tail_ratio,
        low_band_ratio=low_band_ratio,
    )


def evaluate_clip_quality(
    metrics: AudioQualityMetrics,
    rules: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    """返回 (是否保留, 拒绝原因列表)。

    mode=extreme_only（默认）：只剔明显静音/爆音/强配乐，不用 speech_ratio。
    方言口播停顿多，speech_ratio 会把方言误判掉，普通话专题反而容易通过。
    """
    reasons: List[str] = []
    mode = str(rules.get("mode", "extreme_only"))
    min_rms = float(rules.get("min_rms", 0.003))
    max_rms = float(rules.get("max_rms", 0.45))
    min_dur = float(rules.get("min_duration_sec", 0.5))

    if metrics.duration_sec < min_dur:
        reasons.append("too_short")
    if metrics.rms < min_rms:
        reasons.append("too_quiet")
    if metrics.rms > max_rms:
        reasons.append("too_loud_or_clipped")

    if mode == "extreme_only":
        max_low_band = float(rules.get("max_low_band_ratio", 0.97))
        min_crest = float(rules.get("min_crest_db", 2.5))
        if metrics.low_band_ratio > max_low_band:
            reasons.append("bgm_like_spectrum")
        if metrics.crest_db < min_crest:
            reasons.append("flat_dynamics")
        return (len(reasons) == 0, reasons)

    # 方言新闻：反转 speech_ratio——连续响亮的普通话专题占比高，方言口播停顿多占比低
    if mode == "dialect_news":
        max_speech = float(rules.get("max_speech_ratio", 0.26))
        min_speech = float(rules.get("min_speech_ratio", 0.08))
        max_low_band = float(rules.get("max_low_band_ratio", 0.96))
        min_crest = float(rules.get("min_crest_db", 2.0))
        if metrics.speech_ratio > max_speech:
            reasons.append("high_speech_ratio_likely_mandarin")
        if metrics.speech_ratio < min_speech:
            reasons.append("low_speech_ratio_silence_or_bgm")
        if metrics.low_band_ratio > max_low_band:
            reasons.append("bgm_like_spectrum")
        if metrics.crest_db < min_crest:
            reasons.append("flat_dynamics")
        return (len(reasons) == 0, reasons)

    # legacy strict（不推荐；等同「只要连续语音」→ 会保留普通话）
    min_speech = float(rules.get("min_speech_ratio", 0.22))
    max_tail = float(rules.get("max_tail_ratio", 1.85))
    max_low_band = float(rules.get("max_low_band_ratio", 0.92))
    min_crest = float(rules.get("min_crest_db", 4.0))
    if metrics.speech_ratio < min_speech:
        reasons.append("low_speech_ratio")
    if metrics.tail_ratio > max_tail:
        reasons.append("suspicious_tail_energy")
    if metrics.low_band_ratio > max_low_band:
        reasons.append("bgm_like_spectrum")
    if metrics.crest_db < min_crest:
        reasons.append("flat_dynamics")
    return (len(reasons) == 0, reasons)
