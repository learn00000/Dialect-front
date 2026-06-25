# dialect-data：方言新闻 → TTS 训练数据（一站式）

将 `taizhou-news`、`wenzhou-news` 下**全部视频**自动处理为按小组分工的目录结构：

```text
output/taizhou/
  video/001/001.wav  002.wav  ...     # 第 1 个源视频的所有切片音频
  word/001/001.txt   002.txt  ...     # 对应字幕文本
  video/002/ ...
  word/002/ ...
  video_index.json                    # 001、002 对应哪个 mp4
  metadata/metadata.jsonl             # 全量索引
  logs/work/*.srt                     # OCR + LLM 后的字幕

output/wenzhou/
  video/001/ ...
  word/001/ ...
```

**一条命令跑完全流程**：OCR → LLM 校对 → 切片 → 听感剔 BGM → 本地 ASR 剔普通话。

---

## 快速开始（给队友）

```bash
cd dialect-data
python3 -m venv .venv && source .venv/bin/activate
pip install -U pip && pip install -r requirements.txt
pip install paddlepaddle -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
bash scripts/setup_local_asr.sh

export DASHSCOPE_API_KEY='你的百炼密钥'   # 勿提交 Git

# 台州 + 温州 全部视频，一站式
python main.py all --profile all --audio-only

# 或
bash run_final.sh
```

仅跑温州、且已有 SRT 时：

```bash
python main.py all --profile wenzhou --reuse-srt --audio-only
```

---

## 流水线说明

| 步骤 | 做什么 | 配置块 |
|------|--------|--------|
| 1 | 软字幕 / **OCR 硬字幕** | `ocr` / `profiles.*.ocr` |
| 2 | **LLM** 批量校对 SRT | `llm_proofread` |
| 3 | 按字幕 **切 wav + txt** | `pre_roll`、`short_clip_merge`、`profiles.*` |
| 4 | **听感质检**（BGM、偏普通话专题） | `quality_filter` |
| 5 | **普通话 ASR** 过滤（本地 sherpa） | `mandarin_filter` |

子命令：

```bash
python main.py all              # 默认：全流程
python main.py slice            # 仅 OCR + LLM + 切片
python main.py filter           # 仅两步过滤
python main.py filter-quality   # 仅听感
python main.py filter-mandarin  # 仅 ASR 剔普通话
```

常用参数：

| 参数 | 说明 |
|------|------|
| `--profile all\|taizhou\|wenzhou` | 处理哪些地区（默认 `all`） |
| `--audio-only` | 只出 wav，不切 mp4（**强烈推荐**） |
| `--reuse-srt` | 跳过 OCR，用已有 `logs/work/*.srt` |
| `--llm-force` | 强制重新 LLM 校对 |
| `--dry-run` | 过滤阶段只出报告、不移动文件 |
| `-v` | 普通话过滤详细日志 |

---

## 输入 / 输出

### 输入（在 `config.yaml` → `pipeline.regions`）

| 地区 | 目录 | 参数档 |
|------|------|--------|
| 台州 | `taizhou-news/`（递归所有 mp4） | `profiles.taizhou` |
| 温州 | `wenzhou-news/` | `profiles.wenzhou` |

把视频放进对应目录即可，**无需改文件名**；编号按扫描顺序：`001`、`002`…

### 输出编号规则

- 第 N 个视频 → 文件夹 `video/00N/`、`word/00N/`
- 该视频内第 k 条切片 → `00k.wav` + `00k.txt`
- 全局 ID（metadata）：`taizhou_v001_c002` = 台州 + 视频 001 + 第 2 条 clip

查看视频对应关系：

```bash
cat output/taizhou/video_index.json
```

### 剔除的文件

| 类型 | 位置 |
|------|------|
| 听感剔除 | `rejected/quality/video/00N/`、`rejected/quality/word/00N/` |
| 普通话剔除 | `rejected/mandarin/video/00N/`、`rejected/mandarin/word/00N/` |

报告：`metadata/quality_report.json`、`metadata/mandarin_filter_report.json`

---

## 地区差异（参数档）

### 台州 `profiles.taizhou`

- 节目：《阿福讲白搭》
- OCR ROI：`x:0.14 y:0.88 w:0.70 h:0.075`
- 切片：`pre_roll:0.34` `clip_end_trim_sec:0.26`（句首多留、句尾收紧）

### 温州 `profiles.wenzhou`

- OCR ROI：**`x:0.22 y:0.89 w:0.70 h:0.075`**（字幕偏右、360p）
- 切片：`pre_roll:0.30` 等（可按听感再调）

调 ROI 预览：

```bash
python test_roi.py --video "wenzhou-news/video/xxx.mp4" \
  --x 0.22 --y 0.89 --w 0.70 --h 0.075 --times 120,400 --ocr
```

---

## 调参后重跑

只改切片参数、不重 OCR：

```bash
# 删掉某地区某视频的切片（保留 SRT）
rm -rf output/wenzhou/video/001/* output/wenzhou/word/001/*

python main.py slice --profile wenzhou --reuse-srt --audio-only
python main.py filter --profile wenzhou
```

---

## 合并给 TTS 训练

全量索引：

- `output/taizhou/metadata/metadata.txt` → `video/001/001.wav|文本`
- `output/taizhou/metadata/metadata.csv` / `.jsonl` 含 `video_slot`、`wav_path`

小组可按 `video/001`、`word/001` 分工，最后用 `metadata.jsonl` 合并。

---

## 环境要求

| 依赖 | 用途 |
|------|------|
| Python 3.10+ | 主程序 |
| FFmpeg | 切片、转 wav |
| `DASHSCOPE_API_KEY` | LLM 校对 |
| sherpa-onnx 模型 | 普通话过滤（`scripts/setup_local_asr.sh`） |

---

## 项目结构

```text
main.py                 # 一站式入口（推荐）
run_final.sh            # 封装 main.py all
config.yaml             # 全局 + profiles.taizhou / wenzhou
filter_clips.py         # 单独跑听感（可选）
filter_mandarin.py      # 单独跑 ASR（可选）
test_roi.py             # OCR 区域调试
src/layout.py           # video/001、word/001 路径
src/pipeline_filters.py # 过滤逻辑
```

---

## 常见问题

**Q：终端很久没输出？**  
切片时会打印 `[taizhou 视频001 3/50]`；OCR 阶段看 `logs/*.log`。

**Q：txt 里有多了一句、wav 里没有？**  
已修复：只拼接与当前音频时间窗重叠的字幕。改代码后需 `--reuse-srt` 重切。

**Q：只想跑某一个视频？**  
`python main.py slice --profile wenzhou --input "wenzhou-news/video/xxx.mp4" --audio-only`

**Q：旧版 `output/audio_wavs/taizhou_000001.wav` 布局？**  
已改为分视频目录；旧数据可保留，新跑用 `output/taizhou/video/001/`。

---

## 安全

勿将 `DASHSCOPE_API_KEY` 写入仓库。视频仅供组内研究，注意版权。
