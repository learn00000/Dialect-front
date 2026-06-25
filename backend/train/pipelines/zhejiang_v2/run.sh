#!/bin/bash
# 温州话 + 台州话单模型保守 SFT：clean well 数据，独立 v2 checkpoint。
set -euo pipefail
cd "$(dirname "$0")"
. ../../path.sh

stage="${stage:-0}"
stop_stage="${stop_stage:-6}"

wenzhou_raw_dir="${WENZHOU_RAW_DIR:-/root/wenzhou_well}"
taizhou_raw_dir="${TAIZHOU_RAW_DIR:-/root/taizhou_well}"
read -r -a wenzhou_noisy_dirs <<< "${WENZHOU_NOISY_DIRS:-/root/wenzhou /root/wenzhou1}"
read -r -a taizhou_noisy_dirs <<< "${TAIZHOU_NOISY_DIRS:-/root/taizhou1}"
noisy_max_per_dialect="${NOISY_MAX_PER_DIALECT:-300}"
raw_prepared_dir=data/raw_prepared
noisy_prepared_dir=data/noisy_raw_prepared
pretrained_model_dir="${PRETRAINED_MODEL_DIR}"
config_path="${CONFIG:-${TRAIN_CONF}/cosyvoice3_dialect.yaml}"

wenzhou_instruct='You are a helpful assistant. 请用温州话表达。<|endofprompt|>'
taizhou_instruct='You are a helpful assistant. 请用台州话表达。<|endofprompt|>'

init_ckpt="${INIT_CKPT:-${pretrained_model_dir}/llm.pt}"

export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}"
export ORT_PROVIDERS="${ORT_PROVIDERS:-CPUExecutionProvider}"
num_gpus=$(echo "$CUDA_VISIBLE_DEVICES" | awk -F "," '{print NF}')
job_id="${JOB_ID:-1998}"
dist_backend=nccl
num_workers="${NUM_WORKERS:-2}"
prefetch="${PREFETCH:-100}"
train_engine=torch_ddp
dialect="${DIALECT_EXP:-zhejiang_v2}"
average_num="${AVERAGE_NUM:-5}"
train_data_list="${TRAIN_DATA_LIST:-data/train.data.list}"
cv_data_list="${CV_DATA_LIST:-data/dev.data.list}"

if [ "${stage}" -le 0 ] && [ "${stop_stage}" -ge 0 ]; then
  echo "Stage 0: clean well 数据 -> 混合 CosyVoice 目录结构"
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
  echo "Stage 5: 保守训练 LLM（一个模型支持温州/台州 instruct）"
  exp_root="${GZ_DATA_ROOT}/${dialect}"
  for model in llm; do
    model_dir="${exp_root}/${model}/${train_engine}"
    tensorboard_dir="${exp_root}/tensorboard/${model}/${train_engine}"
    local_exp_dir="$(pwd)/exp/${dialect}/${model}/${train_engine}"
    mkdir -p "${model_dir}" "${tensorboard_dir}"

    max_epoch="$(grep 'max_epoch:' "${config_path}" | head -1 | awk '{print $2}')"
    load_ckpt="$(python "${TRAIN_SCRIPTS}/pick_resume_ckpt.py" \
      --search_dirs "${model_dir}" "${local_exp_dir}" \
      --fallback "${init_ckpt}" \
      --max_epoch "${max_epoch}")"
    if [[ "${load_ckpt}" == *epoch_* ]]; then
      echo "从断点恢复: ${load_ckpt}"
    elif [[ -f "${model_dir}/epoch_$((max_epoch - 1))_whole.pt" ]]; then
      echo "Stage 5 已完成 (${max_epoch} epochs)，跳过训练。"
      echo "请运行: cd train && CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES} stage=6 stop_stage=6 bash run.sh zhejiang_v2"
      continue
    else
      echo "从官方/指定初始权重开始: ${load_ckpt}"
    fi
    echo "checkpoint 保存目录: ${model_dir}"

    torchrun --nnodes=1 --nproc_per_node="${num_gpus}" \
      --rdzv_id="${job_id}" --rdzv_backend=c10d --rdzv_endpoint=localhost:1238 \
      "${COSYVOICE_ROOT}/cosyvoice/bin/train.py" \
      --train_engine "${train_engine}" \
      --config "${config_path}" \
      --train_data "${train_data_list}" \
      --cv_data "${cv_data_list}" \
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

if [ "${stage}" -le 7 ] && [ "${stop_stage}" -ge 7 ]; then
  echo "Stage 7: 过滤 noisy 数据（仅作为二阶段增强，不进入 dev）"
  rm -rf "${noisy_prepared_dir}"
  python "${TRAIN_SCRIPTS}/prepare_filtered_raw_dialect.py" \
    --raw_dirs "${wenzhou_noisy_dirs[@]}" \
    --out_dir "${noisy_prepared_dir}" \
    --spk_id wenzhou_noisy_anchor \
    --split train \
    --max_utts "${noisy_max_per_dialect}" \
    --resample
  python "${TRAIN_SCRIPTS}/prepare_filtered_raw_dialect.py" \
    --raw_dirs "${taizhou_noisy_dirs[@]}" \
    --out_dir "${noisy_prepared_dir}" \
    --spk_id taizhou_noisy_anchor \
    --split train \
    --max_utts "${noisy_max_per_dialect}" \
    --resample
fi

if [ "${stage}" -le 8 ] && [ "${stop_stage}" -ge 8 ]; then
  echo "Stage 8: 合并 clean train + filtered noisy train"
  rm -rf data/train_aug
  mkdir -p data/train_aug
  python "${TRAIN_SCRIPTS}/prepare_mixed_data.py" \
    --src_dir "${raw_prepared_dir}/train" "${noisy_prepared_dir}/train" \
    --des_dir data/train_aug \
    --instruct_map \
      "wenzhou_anchor=${wenzhou_instruct}" \
      "taizhou_anchor=${taizhou_instruct}" \
      "wenzhou_noisy_anchor=${wenzhou_instruct}" \
      "taizhou_noisy_anchor=${taizhou_instruct}"
fi

if [ "${stage}" -le 9 ] && [ "${stop_stage}" -ge 9 ]; then
  echo "Stage 9: 为增强训练集提取 embedding / speech token"
  python "${COSYVOICE_ROOT}/tools/extract_embedding.py" --dir data/train_aug \
    --onnx_path "${pretrained_model_dir}/campplus.onnx"
  python "${COSYVOICE_ROOT}/tools/extract_speech_token.py" --dir data/train_aug \
    --onnx_path "${pretrained_model_dir}/speech_tokenizer_v3.onnx"
fi

if [ "${stage}" -le 10 ] && [ "${stop_stage}" -ge 10 ]; then
  echo "Stage 10: 生成增强训练集 parquet"
  rm -rf data/train_aug/parquet
  mkdir -p data/train_aug/parquet
  python "${COSYVOICE_ROOT}/tools/make_parquet_list.py" \
    --num_utts_per_parquet 500 \
    --num_processes 4 \
    --src_dir data/train_aug \
    --des_dir data/train_aug/parquet
  cat data/train_aug/parquet/data.list > data/train_aug.data.list
  echo "增强训练列表: data/train_aug.data.list"
  echo "二阶段: INIT_CKPT=... TRAIN_DATA_LIST=data/train_aug.data_list stage=5 stop_stage=6 bash ../../run.sh zhejiang_v2"
fi

if [ "${stage}" -le 6 ] && [ "${stop_stage}" -ge 6 ]; then
  echo "Stage 6: checkpoint 平均（支持 AVERAGE_EPOCHS 手动指定）"
  exp_root="${GZ_DATA_ROOT}/${dialect}"
  model_dir="${exp_root}/llm/${train_engine}"
  dst_model="${model_dir}/llm.pt"
  if [[ -n "${AVERAGE_EPOCHS:-}" ]]; then
    python "${COSYVOICE_ROOT}/cosyvoice/bin/average_model.py" \
      --dst_model "${dst_model}" \
      --src_path "${model_dir}" \
      --epochs "${AVERAGE_EPOCHS}"
  else
    python "${COSYVOICE_ROOT}/cosyvoice/bin/average_model.py" \
      --dst_model "${dst_model}" \
      --src_path "${model_dir}" \
      --num "${average_num}" \
      --val_best
  fi
  echo "推理用 LLM 权重: ${dst_model}"
fi
