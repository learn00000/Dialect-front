#!/bin/bash
# 方言微调统一入口
# 用法:
#   bash run.sh minnan
#   bash run.sh zhejiang
#   bash run.sh zhejiang_v2
#   stage=0 stop_stage=2 bash run.sh minnan
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=path.sh
. "$SCRIPT_DIR/path.sh"

PIPELINE="${1:-}"
if [ -z "$PIPELINE" ]; then
  cat <<'EOF'
用法: bash run.sh <pipeline>

可用 pipeline:
  minnan       闽南话 LLM 微调
  zhejiang     温州+台州合并微调（well 数据）
  zhejiang_v2  温州+台州保守 SFT + 可选 noisy 增强

环境变量示例:
  CUDA_VISIBLE_DEVICES=0 stage=0 stop_stage=6 bash run.sh minnan
  WENZHOU_RAW_DIR=/data/wenzhou_well bash run.sh zhejiang
EOF
  exit 1
fi

RUN_SH="$TRAIN_ROOT/pipelines/$PIPELINE/run.sh"
if [ ! -f "$RUN_SH" ]; then
  echo "未知 pipeline: $PIPELINE（未找到 $RUN_SH）" >&2
  exit 1
fi

shift || true
cd "$(dirname "$RUN_SH")"
exec bash "$(basename "$RUN_SH")" "$@"
