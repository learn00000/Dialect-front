#!/usr/bin/env bash
# 一站式终版：台州 + 温州全部视频 → 分地区、分视频编号输出 → 听感 + 普通话过滤
#
#   export DASHSCOPE_API_KEY='sk-...'
#   bash run_final.sh
#
# 环境变量:
#   PROFILE=all|taizhou|wenzhou   默认 all
#   REUSE_SRT=1                   已有 SRT 则跳过 OCR
#   LLM_FORCE=1                   强制重新 LLM 校对
#   DRY_RUN=1                     过滤阶段只出报告

set -euo pipefail
cd "$(dirname "$0")"

PROFILE="${PROFILE:-all}"
REUSE_SRT="${REUSE_SRT:-0}"
LLM_FORCE="${LLM_FORCE:-0}"
DRY_RUN="${DRY_RUN:-0}"

if [[ -z "${DASHSCOPE_API_KEY:-}" ]]; then
  echo "错误: 请设置 DASHSCOPE_API_KEY（LLM 字幕校对）" >&2
  exit 1
fi

if [[ ! -f models/sherpa-onnx-paraformer-zh-2023-09-14/model.int8.onnx ]] \
   && [[ ! -f models/sherpa-onnx-paraformer-zh-2023-09-14/paraformer.onnx ]]; then
  echo "错误: 缺少 models/sherpa-onnx-paraformer-zh-2023-09-14/，请运行 bash scripts/setup_local_asr.sh" >&2
  exit 1
fi

ARGS=(all --profile "$PROFILE" --audio-only --llm-proofread)
[[ "$REUSE_SRT" == "1" ]] && ARGS+=(--reuse-srt)
[[ "$LLM_FORCE" == "1" ]] && ARGS+=(--llm-force)
[[ "$DRY_RUN" == "1" ]] && ARGS+=(--dry-run)

echo ">>> python main.py ${ARGS[*]}"
python main.py "${ARGS[@]}"
