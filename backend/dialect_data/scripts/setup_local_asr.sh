#!/usr/bin/env bash
# 下载 sherpa-onnx 中文 Paraformer（本地免费 ASR，不占用百炼语音额度）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_DIR="$ROOT/models/sherpa-onnx-paraformer-zh-2023-09-14"
ARCHIVE="$ROOT/models/sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2"
URL_GITHUB="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2"
# 国内镜像按实测速度排序（可用 ASR_MODEL_URL 覆盖）
MIRRORS=(
  "https://gh.ddlc.top/${URL_GITHUB}"
  "https://ghfast.top/${URL_GITHUB}"
  "https://gh-proxy.com/${URL_GITHUB}"
  "https://ghproxy.net/${URL_GITHUB}"
  "${URL_GITHUB}"
)

mkdir -p "$ROOT/models"
if [[ -f "$MODEL_DIR/tokens.txt" ]] && [[ -f "$MODEL_DIR/model.int8.onnx" || -f "$MODEL_DIR/paraformer.onnx" ]]; then
  echo "模型已存在: $MODEL_DIR"
  exit 0
fi

download_ok=false
if [[ -n "${ASR_MODEL_URL:-}" ]]; then
  echo "使用指定镜像: $ASR_MODEL_URL"
  wget -c "$ASR_MODEL_URL" -O "$ARCHIVE" && download_ok=true
else
  for URL in "${MIRRORS[@]}"; do
    echo "尝试下载（约 223MB）: $URL"
    if wget -c "$URL" -O "$ARCHIVE"; then
      download_ok=true
      echo "下载成功: $URL"
      break
    fi
    echo "失败，换下一个镜像..."
    rm -f "$ARCHIVE"
  done
fi

if [[ "$download_ok" != true ]]; then
  echo "所有镜像均失败" >&2
  exit 1
fi

tar -xjf "$ARCHIVE" -C "$ROOT/models"
echo "完成。测试: python filter_mandarin.py --limit 3 --dry-run"
