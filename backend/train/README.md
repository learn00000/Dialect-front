# 方言 LLM 微调（CosyVoice3 instruct SFT）

本目录包含语韵东方项目全部微调代码，与 `backend`（推理）和 `Dialect-front`（前端）并列。

## 目录结构

```
train/
├── run.sh                 # 统一入口
├── path.sh                # 环境变量（CosyVoice 路径、预训练模型、GZ_DATA_ROOT）
├── conf/                  # 训练超参
│   ├── cosyvoice3_dialect.yaml
│   └── ds_stage2.json
├── scripts/               # 数据准备 Python 脚本
│   ├── prepare_raw_dialect.py
│   ├── prepare_data.py
│   ├── prepare_mixed_data.py
│   ├── prepare_filtered_raw_dialect.py
│   ├── pick_resume_ckpt.py
│   └── prepare_minnan_well.py
├── pipelines/             # 各方言完整流水线（stage 0-6+）
│   ├── minnan/run.sh
│   ├── zhejiang/run.sh
│   └── zhejiang_v2/run.sh
├── eval/
│   └── plot_dialect_radar.py
└── docs/
    └── FINETUNE_STRATEGY.md
```

## 依赖

- CosyVoice 代码：`backend/vendor/CosyVoice`（或 `CosyVoice/`）
- 预训练模型：`backend/models/Fun-CosyVoice3-0.5B`
- 训练产物默认输出：`/gz-data/cosyvoice-dialect/`（可用 `GZ_DATA_ROOT` 覆盖）

## 快速开始

```bash
cd 文化/train

# 闽南话微调（stage 0-6 全流程）
CUDA_VISIBLE_DEVICES=0 bash run.sh minnan

# 温州+台州合并微调
CUDA_VISIBLE_DEVICES=0 bash run.sh zhejiang

# 温州+台州 v2（含可选 noisy 增强 stage 7-10）
CUDA_VISIBLE_DEVICES=0 bash run.sh zhejiang_v2

# 只跑部分 stage
stage=0 stop_stage=2 bash run.sh minnan
```

## 原始数据路径（环境变量）

| 变量 | 默认 | 说明 |
|------|------|------|
| `MINNAN_RAW_DIR` | `/root/minnan_well` | 闽南训练数据 |
| `WENZHOU_RAW_DIR` | `/root/wenzhou_well` | 温州 clean 数据 |
| `TAIZHOU_RAW_DIR` | `/root/taizhou_well` | 台州 clean 数据 |
| `MINNAN_SRC_DIR` | `/root/日常对话-闽南` | 闽南 m4a 源（`prepare_minnan_well.py`） |
| `PRETRAINED_MODEL_DIR` | `backend/models/Fun-CosyVoice3-0.5B` | 基座模型 |
| `GZ_DATA_ROOT` | `/gz-data/cosyvoice-dialect` | checkpoint 输出根目录 |

## 数据准备

```bash
# 将闽南 m4a 整理为 well 结构
python scripts/prepare_minnan_well.py

# 或指定路径
MINNAN_SRC_DIR=/path/to/m4a MINNAN_WELL_DIR=/path/to/minnan_well python scripts/prepare_minnan_well.py
```

## 部署微调权重到后端

训练完成后将权重复制到 `backend/models/weights/`：

```bash
cp ${GZ_DATA_ROOT}/dialect_minnan_llm.pt ../backend/models/weights/
cp ${GZ_DATA_ROOT}/dialect_rehearsal_llm.pt ../backend/models/weights/
```

详细策略见 `docs/FINETUNE_STRATEGY.md`。
