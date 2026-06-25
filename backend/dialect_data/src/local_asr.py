"""本地免费 ASR（不消耗百炼语音额度）。默认使用 FunASR Paraformer-zh。"""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

_DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "models" / "sherpa-onnx-paraformer-zh-2023-09-14"
_DEFAULT_FUNASR_MODEL = "funasr/paraformer-zh"

_recognizer: Any = None
_recognizer_model_dir: Optional[Path] = None
_funasr_model: Any = None
_funasr_model_name: Optional[str] = None


def _sherpa_model_ready(cfg: Dict[str, Any]) -> bool:
    model_dir = Path(cfg.get("local_asr_model_dir") or _DEFAULT_MODEL_DIR)
    tokens = model_dir / "tokens.txt"
    paraformer = model_dir / "model.int8.onnx"
    if not paraformer.is_file():
        paraformer = model_dir / "paraformer.onnx"
    return tokens.is_file() and paraformer.is_file()


def _resolve_backend(cfg: Dict[str, Any]) -> str:
    backend = str(cfg.get("local_asr_backend", "funasr")).strip().lower()
    if backend == "funasr":
        try:
            import funasr  # noqa: F401
            return "funasr"
        except Exception:
            if _sherpa_model_ready(cfg):
                return "sherpa_onnx"
            return "funasr"
    return backend


def _resample_mono_wav(src: Path, sample_rate: int) -> Path:
    tmp = Path(tempfile.mkstemp(suffix=".asr.wav")[1])
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-ar",
            str(sample_rate),
            "-ac",
            "1",
            str(tmp),
        ],
        check=True,
        timeout=120,
    )
    return tmp


def _get_sherpa_recognizer(model_dir: Path) -> Any:
    global _recognizer, _recognizer_model_dir
    if _recognizer is not None and _recognizer_model_dir == model_dir:
        return _recognizer

    import sherpa_onnx

    tokens = model_dir / "tokens.txt"
    paraformer = model_dir / "model.int8.onnx"
    if not paraformer.is_file():
        paraformer = model_dir / "paraformer.onnx"
    if not tokens.is_file() or not paraformer.is_file():
        raise FileNotFoundError(
            f"sherpa 模型不完整: {model_dir}\n"
            "请运行: bash scripts/setup_local_asr.sh"
        )

    _recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
        paraformer=str(paraformer),
        tokens=str(tokens),
        num_threads=int(2),
        sample_rate=16000,
        feature_dim=80,
        decoding_method="greedy_search",
        debug=False,
    )
    _recognizer_model_dir = model_dir
    return _recognizer


def _get_funasr_model(model_name: str, device: str) -> Any:
    global _funasr_model, _funasr_model_name
    cache_key = f"{model_name}|{device}"
    if _funasr_model is not None and _funasr_model_name == cache_key:
        return _funasr_model

    from funasr import AutoModel

    _funasr_model = AutoModel(
        model=model_name,
        vad_model="fsmn-vad",
        punc_model="ct-punc",
        device=device,
    )
    _funasr_model_name = cache_key
    return _funasr_model


def transcribe_local(wav_path: Path, cfg: Dict[str, Any]) -> str:
    """本地 Paraformer 识别，返回文本。"""
    backend = _resolve_backend(cfg)

    if backend == "funasr":
        model_name = str(cfg.get("local_asr_model_name") or _DEFAULT_FUNASR_MODEL)
        device = str(cfg.get("local_asr_device") or "cpu")
        sample_rate = int(cfg.get("local_asr_sample_rate", 16000))
        tmp: Optional[Path] = None
        try:
            tmp = _resample_mono_wav(wav_path, sample_rate)
            model = _get_funasr_model(model_name, device)
            result = model.generate(input=str(tmp), batch_size_s=60)
            if not result:
                return ""
            first = result[0] or {}
            return str(first.get("text") or "").strip()
        finally:
            if tmp and tmp.is_file():
                try:
                    tmp.unlink()
                except OSError:
                    pass

    if backend != "sherpa_onnx":
        raise ValueError(f"未知 local_asr_backend: {backend}")

    model_dir = Path(cfg.get("local_asr_model_dir") or _DEFAULT_MODEL_DIR)
    sample_rate = int(cfg.get("local_asr_sample_rate", 16000))
    tmp: Optional[Path] = None
    try:
        tmp = _resample_mono_wav(wav_path, sample_rate)
        import numpy as np
        import wave

        with wave.open(str(tmp), "rb") as wf:
            assert wf.getframerate() == sample_rate
            assert wf.getnchannels() == 1
            assert wf.getsampwidth() == 2
            pcm = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16)
            samples = pcm.astype(np.float32) / 32768.0

        recognizer = _get_sherpa_recognizer(model_dir)
        stream = recognizer.create_stream()
        stream.accept_waveform(sample_rate, samples)
        recognizer.decode_stream(stream)
        return (stream.result.text or "").strip()
    finally:
        if tmp and tmp.is_file():
            try:
                tmp.unlink()
            except OSError:
                pass


def local_asr_available(cfg: Dict[str, Any]) -> bool:
    backend = _resolve_backend(cfg)
    if backend == "funasr":
        try:
            import funasr  # noqa: F401
        except Exception:
            return False
        return True

    return _sherpa_model_ready(cfg)
