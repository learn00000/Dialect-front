#!/bin/bash
# 温州话 + 台州话合并 instruct SFT（well 对齐数据集）：最终产出一个 LLM checkpoint
set -euo pipefail
cd "$(dirname "$0")"
. ../../path.sh

stage="${stage:-0}"
stop_stage="${stop_stage:-6}"

wenzhou_raw_dir="${WENZHOU_RAW_DIR:-/root/wenzhou_well}"
taizhou_raw_dir="${TAIZHOU_RAW_DIR:-/root/taizhou_well}"
raw_prepared_dir=data/raw_prepared
pretrained_model_dir="${PRETRAINED_MODEL_DIR}"

wenzhou_instruct='You are a helpful assistant. 请用温州话表达。<|endofprompt|>'
taizhou_instruct='You are a helpful assistant. 请用台州话表达。<|endofprompt|>'

init_ckpt="${INIT_CKPT:-${pretrained_model_dir}/llm.pt}"

export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}"
export ORT_PROVIDERS=CPUExecutionProvider
num_gpus=$(echo "$CUDA_VISIBLE_DEVICES" | awk -F "," '{print NF}')
job_id=1988
dist_backend=nccl
num_workers=2
prefetch=100
train_engine=torch_ddp
dialect="${DIALECT_EXP:-zhejiang_well}"
average_num=5

if [ "${stage}" -le 0 ] && [ "${stop_stage}" -ge 0 ]; then
  echo "Stage 0: wenzhou_well / taizhou_well -> 混合 CosyVoice 目录结构"
  rm -rf "${raw_prepared_dir}"
  python "${TRAIN_SCRIPTS}/prepare_raw_dialect.py" \
    --raw_dir "${wenzhou_raw_dir}" \
    --out_dir "${raw_prepared_dir}" \
    --spk_id wenzhou_anchor \
    --dev_slots 012,013 \
    --resample
  python "${TRAIN_SCRIPTS}/prepare_raw_dialect.py" \
    --raw_dir "${taizhou_raw_dir}" \
    --out_dir "${raw_prepared_dir}" \
    --spk_id taizhou_anchor \
    --dev_slots 013,014 \
    --resample
fi

if [ "${stage}" -le 1 ] && [ "${stop_stage}" -ge 1 ]; then
  echo "Stage 1: 生成混合 wav.scp / text / utt2spk / instruct"
  for x in train dev; do
    rm -rf "data/${x}"
    mkdir -p "data/${x}"
    python "${TRAIN_SCRIPTS}/prepare_mixed_data.py" \
      --src_dir "${raw_prepared_dir}/${x}" \
      --des_dir "data/${x}" \
      --instruct_map \
        "wenzhou_anchor=${wenzhou_instruct}" \
        "taizhou_anchor=${taizhou_instruct}"
  done
fi

if [ "${stage}" -le 2 ] && [ "${stop_stage}" -ge 2 ]; then
  echo "Stage 2: 提取说话人 embedding"
  for x in train dev; do
    python "${COSYVOICE_ROOT}/tools/extract_embedding.py" --dir "data/${x}" \
      --onnx_path "${pretrained_model_dir}/campplus.onnx"
  done
fi

if [ "${stage}" -le 3 ] && [ "${stop_stage}" -ge 3 ]; then
  echo "Stage 3: 提取 speech token"
  for x in train dev; do
    python "${COSYVOICE_ROOT}/tools/extract_speech_token.py" --dir "data/${x}" \
      --onnx_path "${pretrained_model_dir}/speech_tokenizer_v3.onnx"
  done
fi

if [ "${stage}" -le 4 ] && [ "${stop_stage}" -ge 4 ]; then
  echo "Stage 4: 生成 parquet"
  for x in train dev; do
    rm -rf "data/${x}/parquet"
    mkdir -p "data/${x}/parquet"
    python "${COSYVOICE_ROOT}/tools/make_parquet_list.py" \
      --num_utts_per_parquet 500 \
      --num_processes 4 \
      --src_dir "data/${x}" \
      --des_dir "data/${x}/parquet"
  done
  cat data/train/parquet/data.list > data/train.data.list
  cat data/dev/parquet/data.list > data/dev.data.list
fi

if [ "${stage}" -le 5 ] && [ "${stop_stage}" -ge 5 ]; then
  echo "Stage 5: 合并训练 LLM（一个模型支持温州/台州 instruct）"
  exp_root="${GZ_DATA_ROOT}/${dialect}"
  for model in llm; do
    model_dir="${exp_root}/${model}/${train_engine}"
    tensorboard_dir="${exp_root}/tensorboard/${model}/${train_engine}"
    local_exp_dir="$(pwd)/exp/${dialect}/${model}/${train_engine}"
    mkdir -p "${model_dir}" "${tensorboard_dir}"

    max_epoch="$(grep 'max_epoch:' "${TRAIN_CONF}/cosyvoice3_dialect.yaml" | head -1 | awk '{print $2}')"
    load_ckpt="$(python "${TRAIN_SCRIPTS}/pick_resume_ckpt.py" \
      --search_dirs "${model_dir}" "${local_exp_dir}" \
      --fallback "${init_ckpt}" \
      --max_epoch "${max_epoch}")"
    if [[ "${load_ckpt}" == *epoch_* ]]; then
      echo "从断点恢复: ${load_ckpt}"
    elif [[ -f "${model_dir}/epoch_$((max_epoch - 1))_whole.pt" ]]; then
      echo "Stage 5 已完成 (${max_epoch} epochs)，跳过训练。"
      echo "请运行: CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES} stage=6 stop_stage=6 bash run.sh"
      continue
    else
      echo "从官方/指定初始权重开始: ${load_ckpt}"
    fi
    echo "checkpoint 保存目录: ${model_dir}"

    torchrun --nnodes=1 --nproc_per_node="${num_gpus}" \
      --rdzv_id="${job_id}" --rdzv_backend=c10d --rdzv_endpoint=localhost:1236 \
      "${COSYVOICE_ROOT}/cosyvoice/bin/train.py" \
      --train_engine "${train_engine}" \
      --config "${TRAIN_CONF}/cosyvoice3_dialect.yaml" \
      --train_data data/train.data.list \
      --cv_data data/dev.data.list \
      --qwen_pretrain_path "${pretrained_model_dir}/CosyVoice-BlankEN" \
      --onnx_path "${pretrained_model_dir}" \
      --model "${model}" \
      --checkpoint "${load_ckpt}" \
      --model_dir "${model_dir}" \
      --tensorboard_dir "${tensorboard_dir}" \
      --ddp.dist_backend "${dist_backend}" \
      --num_workers "${num_workers}" \
      --prefetch "${prefetch}" \
      --pin_memory \
      --deepspeed_config "${TRAIN_CONF}/ds_stage2.json" \
      --deepspeed.save_states model+optimizer
  done
fi

if [ "${stage}" -le 6 ] && [ "${stop_stage}" -ge 6 ]; then
  echo "Stage 6: 按官方流程对 LLM checkpoint 做 val_best 平均"
  exp_root="${GZ_DATA_ROOT}/${dialect}"
  model_dir="${exp_root}/llm/${train_engine}"
  dst_model="${model_dir}/llm.pt"
  python "${COSYVOICE_ROOT}/cosyvoice/bin/average_model.py" \
    --dst_model "${dst_model}" \
    --src_path "${model_dir}" \
    --num "${average_num}" \
    --val_best
  cp -f "${dst_model}" "${GZ_DATA_ROOT}/dialect_rehearsal_llm.pt"
  echo "推理用 LLM 权重: ${dst_model}"
  echo "部署: cp ${GZ_DATA_ROOT}/dialect_rehearsal_llm.pt backend/models/weights/"
fi
