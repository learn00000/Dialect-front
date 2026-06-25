#!/bin/bash
# 语韵东方 · 方言 LLM 微调环境变量（所有 pipeline 统一引用）
if [ -n "${BASH_SOURCE[0]:-}" ]; then
  _TRAIN_PATH_SH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  _TRAIN_PATH_SH_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

export TRAIN_ROOT="$_TRAIN_PATH_SH_DIR"
export PROJECT_ROOT="$(cd "$TRAIN_ROOT/.." && pwd)"

if [ -d "$PROJECT_ROOT/backend/vendor/CosyVoice/cosyvoice" ]; then
  export COSYVOICE_ROOT="$PROJECT_ROOT/backend/vendor/CosyVoice"
elif [ -d "$PROJECT_ROOT/CosyVoice/cosyvoice" ]; then
  export COSYVOICE_ROOT="$PROJECT_ROOT/CosyVoice"
else
  echo "[train] 错误: 未找到 CosyVoice 代码目录" >&2
  exit 1
fi

export PRETRAINED_MODEL_DIR="${PRETRAINED_MODEL_DIR:-$PROJECT_ROOT/backend/models/Fun-CosyVoice3-0.5B}"
export TRAIN_SCRIPTS="$TRAIN_ROOT/scripts"
export TRAIN_CONF="$TRAIN_ROOT/conf"
export GZ_DATA_ROOT="${GZ_DATA_ROOT:-/gz-data/cosyvoice-dialect}"
export PYTHONIOENCODING=UTF-8
export PYTHONPATH="$COSYVOICE_ROOT:$COSYVOICE_ROOT/third_party/Matcha-TTS:${PYTHONPATH:-}"
export ORT_PROVIDERS="${ORT_PROVIDERS:-CPUExecutionProvider}"
