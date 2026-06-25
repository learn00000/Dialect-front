#!/bin/bash
# 闽南话日常对话 -> CosyVoice3 LLM instruct SFT（stage 0-6）
set -euo pipefail
cd "$(dirname "$0")"
. ../../path.sh

stage="${stage:-0}"
stop_stage="${stop_stage:-6}"

minnan_raw_dir="${MINNAN_RAW_DIR:-/root/minnan_well}"
raw_prepared_dir=data/raw_prepared
minnan_instruct='You are a helpful assistant. 请用闽南话表达。<|endofprompt|>'
pretrained_model_dir="${PRETRAINED_MODEL_DIR}"
exp_dir="${GZ_DATA_ROOT}/minnan"
model_dir="${exp_dir}/llm/torch_ddp"
export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}"

if [ "${stage}" -le 0 ] && [ "${stop_stage}" -ge 0 ]; then
  echo "Stage 0: minnan_well -> CosyVoice raw_prepared"
  rm -rf "${raw_prepared_dir}"
  python "${TRAIN_SCRIPTS}/prepare_raw_dialect.py" \
    --raw_dir "${minnan_raw_dir}" \
    --out_dir "${raw_prepared_dir}" \
    --spk_id minnan \
    --dev_slots "" \
    --dev_ratio 0.1 \
    --symlink
fi

if [ "${stage}" -le 1 ] && [ "${stop_stage}" -ge 1 ]; then
  echo "Stage 1: raw_prepared -> wav.scp / text / instruct"
  for split in train dev; do
    python "${TRAIN_SCRIPTS}/prepare_data.py" \
      --src_dir "${raw_prepared_dir}/${split}" \
      --des_dir "data/${split}" \
      --instruct "${minnan_instruct}"
  done
fi

if [ "${stage}" -le 2 ] && [ "${stop_stage}" -ge 2 ]; then
  echo "Stage 2: extract campplus speaker embedding"
  for split in train dev; do
    python "${COSYVOICE_ROOT}/tools/extract_embedding.py" --dir "data/${split}" \
      --onnx_path "${pretrained_model_dir}/campplus.onnx"
  done
fi

if [ "${stage}" -le 3 ] && [ "${stop_stage}" -ge 3 ]; then
  echo "Stage 3: extract discrete speech token"
  for split in train dev; do
    python "${COSYVOICE_ROOT}/tools/extract_speech_token.py" --dir "data/${split}" \
      --onnx_path "${pretrained_model_dir}/speech_tokenizer_v3.onnx"
  done
fi

if [ "${stage}" -le 4 ] && [ "${stop_stage}" -ge 4 ]; then
  echo "Stage 4: parquet + data.list"
  for split in train dev; do
    mkdir -p "data/${split}/parquet"
    python "${COSYVOICE_ROOT}/tools/make_parquet_list.py" --num_utts_per_parquet 200 \
      --num_processes 4 \
      --src_dir "data/${split}" \
      --des_dir "data/${split}/parquet"
  done
  cat data/train/parquet/data.list > data/train.data.list
  cat data/dev/parquet/data.list > data/dev.data.list
fi

if [ "${stage}" -le 5 ] && [ "${stop_stage}" -ge 5 ]; then
  echo "Stage 5: train llm only (full-parameter low-lr SFT)"
  num_gpus=$(echo "${CUDA_VISIBLE_DEVICES}" | awk -F "," '{print NF}')
  job_id=2026
  dist_backend="nccl"
  num_workers=2
  prefetch=100
  train_engine=torch_ddp
  mkdir -p "${model_dir}"
  torchrun --nnodes=1 --nproc_per_node="${num_gpus}" \
    --rdzv_id="${job_id}" --rdzv_backend="c10d" --rdzv_endpoint="localhost:1236" \
    "${COSYVOICE_ROOT}/cosyvoice/bin/train.py" \
    --train_engine "${train_engine}" \
    --config "${TRAIN_CONF}/cosyvoice3_dialect.yaml" \
    --train_data data/train.data.list \
    --cv_data data/dev.data.list \
    --qwen_pretrain_path "${pretrained_model_dir}/CosyVoice-BlankEN" \
    --onnx_path "${pretrained_model_dir}" \
    --model llm \
    --checkpoint "${pretrained_model_dir}/llm.pt" \
    --model_dir "${model_dir}" \
    --tensorboard_dir "${exp_dir}/tensorboard/llm/${train_engine}" \
    --ddp.dist_backend "${dist_backend}" \
    --num_workers "${num_workers}" \
    --prefetch "${prefetch}" \
    --pin_memory \
    --deepspeed_config "${TRAIN_CONF}/ds_stage2.json" \
    --deepspeed.save_states model+optimizer
fi

if [ "${stage}" -le 6 ] && [ "${stop_stage}" -ge 6 ]; then
  echo "Stage 6: average best checkpoints -> dialect_minnan_llm.pt"
  python "${COSYVOICE_ROOT}/cosyvoice/bin/average_model.py" \
    --dst_model "${model_dir}/llm.pt" \
    --src_path "${model_dir}" \
    --num 3 \
    --val_best
  cp -f "${model_dir}/llm.pt" "${GZ_DATA_ROOT}/dialect_minnan_llm.pt"
  rm -f "${model_dir}/init.pt" "${model_dir}"/epoch_*_whole.pt 2>/dev/null || true
  echo "exported: ${GZ_DATA_ROOT}/dialect_minnan_llm.pt"
  echo "部署: cp ${GZ_DATA_ROOT}/dialect_minnan_llm.pt backend/models/weights/"
fi

echo "done minnan pipeline (stage ${stage}-${stop_stage})"
