# CosyVoice3 方言 LLM 微调策略总结

本文档总结「语韵东方」项目中 CosyVoice3 方言 TTS 的微调方法论、实验结论与当前部署方案。适用于温州话、台州话、闽南话等 instruct SFT 场景。

---

## 1. 总体目标

- **基座模型**：`Fun-CosyVoice3-0.5B`
- **只微调 LLM**，不训练 Flow / HiFiGAN
- **单模型多方言切换**：通过不同 `instruct` 在推理时切换方言，而不是每个方言单独一套完整模型
- **优先级**：先保证「能正常说完一整句、不早停、不拖长、不碎」，再追求方言味

当前线上采用 **多权重路由**（不是单文件硬切换）：

| 方言 | LLM 权重 | 说明 |
|------|----------|------|
| 温州话 / 台州话 | `dialect_rehearsal_llm.pt` | 浙江双方言合并微调 |
| 闽南话 | `dialect_minnan_llm.pt` | 闽南独立微调 |
| 粤语 / 四川 / 东北 / 普通话等 | 官方 `llm.pt` | 基座 instruct |

Flow、HiFiGAN、ONNX 前端特征提取均沿用官方预训练，不随方言微调。

---

## 2. 为什么不训 Flow，只训 LLM

CosyVoice3 的方言能力主要由 **LLM 生成 speech token 序列** 决定。官方 instruct SFT 路线也是：

```
文本 + instruct → LLM → speech token → Flow → HiFiGAN → wav
```

实践证明：

- 只替换 `llm.pt`，配合 `inference_instruct2()`，即可让一个模型按 instruct 说不同方言
- 微调 Flow/HiFiGAN 成本高、收益小，且容易破坏基座稳定性
- 小数据集（几百～两千条）不适合端到端全模型训练

---

## 3. 数据格式与标注原则

### 3.1 原始数据布局

```text
{dialect_root}/
  video/{slot}/{utterance_id}.wav    # 24kHz 方言音频
  word/{slot}/{utterance_id}.txt     # 对应普通话/书面文本
```

例如：

- 音频：`今天天气真好.wav`（闽南口音）
- 文本：`今天天气真好`（普通汉字文本）

这是 CosyVoice instruct SFT 的标准模式：**文本写普通话，音频是方言，方言味靠 instruct 引导**。

### 3.2 Instruct 格式

必须使用官方完整字符串，并以 `<|endofprompt|>` 结尾：

```text
You are a helpful assistant. 请用温州话表达。<|endofprompt|>
You are a helpful assistant. 请用台州话表达。<|endofprompt|>
You are a helpful assistant. 请用闽南话表达。<|endofprompt|>
```

推理时通过 `inference_instruct2(tts_text, instruct, prompt_wav)` 切换方言。

### 3.3 数据划分建议

| 数据集 | 规模 | 用途 |
|--------|------|------|
| 温州 clean (`wenzhou_well`) | ~900 | 主训练 |
| 台州 clean (`taizhou_well`) | ~900 | 主训练 |
| 温州 noisy (`wenzhou`, `wenzhou1`) | 较多 | 二阶段增强，需过滤 |
| 台州 noisy (`taizhou1`) | 较多 | 二阶段增强，需过滤 |
| 闽南 (`minnan_well`) | 180 train / 20 dev | 单方言独立训练 |

Dev 集建议 10% holdout；单 slot 小数据集可用 `--dev_ratio 0.1` 自动切分。

---

## 4. 训练流水线（Stage 0–6）

脚本入口：

- 浙江：`examples/dialect/zhejiang_v2/run.sh`（历史实验）
- 闽南：`examples/dialect/minnan/run.sh`

| Stage | 任务 | 输出 |
|-------|------|------|
| 0 | `prepare_raw_dialect.py` 原始数据 → `raw_prepared` | wav + normalized.txt |
| 1 | `prepare_data.py` 生成训练列表 | wav.scp / text / instruct / utt2spk |
| 2 | `extract_embedding.py` | utt2embedding.pt |
| 3 | `extract_speech_token.py` | utt2speech_token.pt |
| 4 | `make_parquet_list.py` | parquet + data.list |
| 5 | `train.py --model llm` | epoch_N_whole.pt |
| 6 | `average_model.py --val_best` | 最终 `llm.pt` |

关键环境变量：

```bash
export ORT_PROVIDERS=CPUExecutionProvider   # ONNX 特征提取，避免 CUDA ORT 报错
export GZ_DATA_ROOT=/gz-data/cosyvoice-dialect
export CUDA_VISIBLE_DEVICES=0
```

每个 epoch checkpoint 约 **2GB**，训练前务必预留磁盘（建议 ≥15GB 空闲）。

---

## 5. 推荐训练超参数

配置文件：`examples/dialect/conf/cosyvoice3_dialect.yaml`

### 5.1 当前推荐（小数据集全参数低学习率 SFT）

```yaml
train_conf:
  optim: adam
  optim_conf:
    lr: 1.0e-05          # 闽南 180 条；浙江 clean 可用 1e-5 ~ 4e-5
  scheduler: warmuplr
  scheduler_conf:
    warmup_steps: 50     # 浙江大数据可用 100
  max_epoch: 6           # 磁盘紧张时 6；数据多时可 8
  grad_clip: 5
  accum_grad: 2
  log_interval: 25
```

训练命令核心参数：

```bash
torchrun ... cosyvoice/bin/train.py \
  --model llm \
  --checkpoint ../../../pretrained_models/Fun-CosyVoice3-0.5B/llm.pt \
  --config ../conf/cosyvoice3_dialect.yaml \
  --train_engine torch_ddp
```

**不要**在 `train_conf` 里使用 `trainable_param_patterns: ['^llm_decoder\\.']`。

### 5.2 浙江双方言（温州+台州）最终成功方案

经过多轮实验，浙江方言采用 **全参数 SFT + 排练数据（rehearsal）**：

1. **Stage A**：只用 `wenzhou_well + taizhou_well`（各约 900 条）做 clean SFT
2. **Stage B**：用官方 base 模型生成闽南/粤语/四川/东北/上海等方言的「排练音频」
3. **Stage C**：将温州/台州 clean 数据 + 排练数据合并，从 base `llm.pt` 低学习率重训
4. **Stage D**：`average_model.py --val_best --num 3` 导出最终权重

目的：在学会温州/台州的同时，**防止遗忘**其他基座支持的方言。

导出权重：

```text
/gz-data/cosyvoice-dialect/dialect_rehearsal_llm.pt   # 当前线上浙江权重
/gz-data/cosyvoice-dialect/dialect_llm.pt              # 早期浙江权重，边界稳定性较差
```

### 5.3 闽南话独立方案

闽南数据单独训练，不与浙江混训：

```text
输入：/root/minnan_well（180 train / 20 dev）
输出：/gz-data/cosyvoice-dialect/dialect_minnan_llm.pt
instruct：请用闽南话表达。<|endofprompt|>
```

闽南与浙江分开的原因：

- 数据规模、口音机制、语速特征差异大
- 单文件混太多方言会加重遗忘和边界不稳定
- 后端可按方言热切换不同 `llm.pt`

---

## 6. 失败方案与教训（非常重要）

### 6.1 不要：decoder-only SFT

曾尝试只训练 `llm_decoder`（约 1.2% 参数）：

```yaml
trainable_param_patterns: ['^llm_decoder\\.']  # 已废弃
lr: 1e-4
```

结果：

- 有的句子 **过早 EOS**，只生成 0.3～0.5 秒
- 有的句子能说完，但方言味弱
- 平均多个 epoch 后问题更明显

**结论**：`llm_decoder` 含 EOS 相关分类能力，单独高学习率训练会破坏「何时停止」的判断。

### 6.2 不要：高学习率全参数 SFT

`lr=1e-4` 全参数 + 小数据集 → 验证 loss 下降，但听感出现：

- 生成时长暴增（同一句 2s → 11s）
- speech token 重复、停顿异常
- CV acc 长期徘徊在 ~18%，说明没真正学会 token 序列

### 6.3 不要：只看 CV loss 选模型

必须用 **听感 smoke test** 辅助选 checkpoint：

- 时长是否接近文本长度
- 是否有真实长停顿（>250ms）
- 开头是否发虚、结尾是否有爆音

推荐工具：`examples/dialect/zhejiang/infer_demo.py`

### 6.4 不要：无排练地只训目标方言

只训温州/台州会导致：

- 闽南、粤语、四川等 **灾难性遗忘**
- 后端切换回这些方言时质量明显下降

因此浙江最终模型必须包含 **rehearsal 数据** 一起训练。

---

## 7. Checkpoint 策略

### 7.1 保存与平均

- 每个 epoch 结束保存 `epoch_N_whole.pt`（约 2GB）
- 同时写 `epoch_N_whole.yaml`，记录 CV loss / acc
- 用 `average_model.py --val_best --num 3` 取验证集最优的 3 个 epoch 平均

```bash
python ../../../cosyvoice/bin/average_model.py \
  --dst_model "${model_dir}/llm.pt" \
  --src_path "${model_dir}" \
  --num 3 \
  --val_best
```

### 7.2 磁盘管理

训练完成后删除中间 checkpoint，只保留：

- 最终 `llm.pt`
- 若干 `epoch_N_whole.yaml`（可选）

```bash
rm -f init.pt epoch_*_whole.pt
```

---

## 8. 推理与后端部署策略

### 8.1 多方言权重路由

后端在 `server.py` 中维护三套 LLM 权重，按方言切换：

```python
温州话 / 台州话 → ft_zhejiang → dialect_rehearsal_llm.pt
闽南话         → ft_minnan   → dialect_minnan_llm.pt
其他           → base        → 官方 llm.pt
```

启动时预载三套权重到 CPU，请求时 `load_state_dict` 切到 GPU，切换耗时约 0.01～0.4s。

### 8.2 精度

- 统一使用 **FP32** 推理（`model.llm.float()`）
- 不要用 BF16 权重直接 FP32 输入，会导致 dtype 崩溃或生成异常
- `transformers==4.51.3` 必须固定，5.x 会导致语音卡顿

### 8.3 语速

| 方言 | speed | 说明 |
|------|-------|------|
| 普通话 | 1.0 | 默认 |
| 温州/台州 | 1.0 | 过高会放大句首发虚、句尾杂音 |
| 其他方言 | 1.10 | 略加速 |
| 闽南 | 1.18 | 基座 instruct 偏慢，可环境变量覆盖 |

### 8.4 文本侧建议

- LLM 生成 `tts_text` 用方言写法，但 **不要太短、太碎**
- 后端已限制 80 字以内
- 合成前可做轻量后处理：句首预留 120ms、句尾淡出 80ms + 静音 160ms，减轻浏览器/Live2D 播放时的吞头和尾噪

### 8.5 基座方言不必微调

以下方言直接用官方 base + instruct，效果通常优于强行微调：

- 粤语、四川话、东北话、普通话等

后端仅为 **温州/台州/闽南** 使用微调权重。

---

## 9. 常见问题与对应策略

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 生成时长很长 | 全参 SFT 破坏 EOS；或 decoder-only 失效 | 回到全参低 lr；加 rehearsal |
| 刚开口就停 | decoder-only 破坏了 EOS 头 | 禁用 decoder-only |
| 一卡一卡 | 曾误判；实际是精度/文本过长/速度参数问题 | FP32；控制 80 字；温州/台州 speed=1.0 |
| 句首发虚 | 因果声码器冷启动 + 浏览器播放吞头 | 句首预留；speed 勿过高 |
| 句尾杂音 | wav 结尾能量未归零 | 句尾淡出 + 静音尾巴 |
| 闽南变差 | 浙江微调后遗忘 | 闽南独立权重 |
| 温州/台州变差 | 误用旧 `dialect_llm.pt` | 改用 `dialect_rehearsal_llm.pt` |

---

## 10. 当前线上权重一览

```text
/gz-data/cosyvoice-dialect/
├── dialect_rehearsal_llm.pt    # 温州/台州（推荐）
├── dialect_minnan_llm.pt       # 闽南
├── dialect_llm.pt              # 早期浙江（不推荐）
└── minnan/llm/torch_ddp/llm.pt # 闽南训练目录
```

后端默认：

```bash
COSYVOICE_FT_LLM_PT=/gz-data/cosyvoice-dialect/dialect_rehearsal_llm.pt
COSYVOICE_MINNAN_LLM_PT=/gz-data/cosyvoice-dialect/dialect_minnan_llm.pt
```

---

## 11. 后续如果要重训，建议这样做

### 11.1 浙江（温州+台州）

```bash
cd /root/文化/CosyVoice/examples/dialect/zhejiang_v2

# 1. 准备 clean 数据
stage=0 stop_stage=4 bash run.sh

# 2. 全参数低学习率训练（含 rehearsal 合并后的 train list）
stage=5 stop_stage=5 bash run.sh

# 3. 平均最优 checkpoint
stage=6 stop_stage=6 bash run.sh

# 4. 导出并替换线上权重
cp /gz-data/cosyvoice-dialect/zhejiang_rehearsal/llm/torch_ddp/llm.pt \
   /gz-data/cosyvoice-dialect/dialect_rehearsal_llm.pt
```

### 11.2 闽南

```bash
cd /root/文化/CosyVoice/examples/dialect/minnan
stage=0 stop_stage=6 bash run.sh
# 输出 dialect_minnan_llm.pt
```

### 11.3 重训前检查清单

- [ ] `transformers==4.51.3`
- [ ] `/gz-data` 空闲 ≥15GB
- [ ] `ORT_PROVIDERS=CPUExecutionProvider`
- [ ] 不用 decoder-only
- [ ] 浙江训练含 rehearsal 数据
- [ ] 训完做听感 smoke test，不只看 CV loss
- [ ] 后端切换到新权重后清音频缓存

---

## 12. 一句话原则

> **小数据方言 SFT：全参数、低学习率、带排练、按方言分权重、用听感验收；不要 decoder-only，不要高学习率硬拟合。**

---

*文档版本：2026-06-11 · 基于 Fun-CosyVoice3-0.5B 项目实测整理*
