# File content discussion
_Exported on 2026/5/16 at GMT+8 22:06:45 from Cursor (2.6.20)_

---

**User**

@\root\.cursor\projects\home-dialect-data\terminals\1.txt:163-164 

---

**Cursor**

`winget` 是 Windows 的包管理器；当前环境是 Linux（bash + 容器），应使用 `apt` 等安装。正在用 `apt` 安装 `ffmpeg`：



**原因：** `winget` 只在 **Windows** 上有。你当前是 **Linux**（Ubuntu 22.04 容器），所以会提示 `command not found`。

**已在本机替你装好 ffmpeg：** 使用 `apt-get install -y ffmpeg`，当前版本为 **4.4.2**。可直接运行：

```bash
ffmpeg -version
```

以后在同类 Linux 环境里安装，用：

```bash
sudo apt update && sudo apt install -y ffmpeg
```

（若已是 root 且无需 `sudo`，可去掉 `sudo`。）

---

**User**

@\root\.cursor\projects\home-dialect-data\terminals\1.txt:169-170 

---

**Cursor**

正在分析 `main.py` 如何查找视频文件，并检查输入路径是否存在。



正在验证 bash 如何解析该参数：



**原因：** 在 **Linux / bash** 里，路径里的 `\` 不是目录分隔符。像 `taizhou-news\video\video2` 会被拆成：`taizhou-news` + `\v`（变成普通字符 `v`）+ `ideo` + …，最终传给程序的是 **`taizhou-newsvideovideo2`** 这一个“连在一起”的名字，目录并不存在，所以 `collect_videos` 里 `d.exists()` 为假，就会报「未找到任何视频文件」。

你的真实目录是：`/home/dialect-data/taizhou-news/video/video2`（里面有 `20260429.mp4`）。

**正确写法示例：**

```bash
python main.py --input taizhou-news/video/video2 --output ./output
```

或绝对路径：

```bash
python main.py --input /home/dialect-data/taizhou-news/video/video2 --output /home/dialect-data/output
```

**说明：** Windows 用 `\` 和 `.\output`；在 Linux 上请用 **`/`** 和 **`./output`**。若路径里有空格，用引号包起来，例如 `"taizhou-news/video/video2"`。

---

**User**

帮我开一下代码里的gpu，好跑的快一点

---

**Cursor**

正在查找项目中与 GPU/CUDA 相关的配置。



发现 EasyOCR 在 `ocr_subtitle.py` 中被硬编码为 `gpu=False`。正在改为通过 `config.yaml` 的 `use_gpu` 控制，并默认启用 GPU。



已改好：**OCR（EasyOCR）** 是唯一用深度学习的地方，之前写死了 `gpu=False`。

### 改动说明

1. **`src/ocr_subtitle.py`**  
   - `_load_easyocr_reader(..., use_gpu=...)`  
   - `generate_segments_from_video_ocr(..., use_gpu=True)`  
   - `try_generate_srt_via_ocr` 从配置读取 `use_gpu`（缺省为 `True`）。

2. **`config.yaml`**（`ocr` 段）  
   - 增加 `use_gpu: true`；没有 GPU 或只有 CPU 版 PyTorch 时改成 `false`。

### 你需要知道的

- **FFmpeg 切片/抽音频** 仍是 CPU（和这次改动无关）。  
- **GPU 只加速 OCR**。要真正用到显卡，环境里需要 **带 CUDA 的 PyTorch**。若 `pip install` 下来的是 CPU 版 torch，把 `use_gpu: true` 可能报错或仍很慢。可在容器里检查：

```bash
python -c "import torch; print(torch.cuda.is_available(), torch.version.cuda)"
```

若为 `False`，需按你机器 CUDA 版本安装对应 [PyTorch CUDA 轮子](https://pytorch.org/get-started/locally/)，再跑 `main.py`。

无 GPU 时把配置里改成：

```yaml
use_gpu: false
```

---

**User**

主要花时间的部分是哪里？我想着要不做一个测试版的入口，就只切视频和字幕，不用转换音频，让我先调这个切片的效果

---

**Cursor**

查看 `main.py` 的完整处理流程与可跳过步骤。



确认：项目已有 `--video-only`，会跳过 WAV 导出。主要耗时通常在 OCR（若走硬字幕）或每条片段的两次 FFmpeg（切视频 + 从 clip 抽 WAV）。添加更明确的 `--slice-test` 入口：等同只切视频+字幕，并跳过汇总 `metadata.csv`/`metadata.txt`，避免指向不存在的 WAV。



## 时间主要花在哪？

按常见情况大致是：

1. **硬字幕 OCR（EasyOCR）**  
   没有可用软字幕时会整片按时间间隔抽帧 + 识别，通常**最慢**（尤其之前若在用 CPU）。

2. **每条字幕一段的 FFmpeg**  
   - **切小视频**（`libx264` 重编码）  
   - **再导出 WAV**（`--video-only` 时会跳过第二步）  
   片段多的时候，这里累计时间也很可观。

3. **软字幕**  
   一般比 OCR 快很多（导出一条 SRT）。

调切片参数时，若已有 `output/logs/work/<视频名>.srt`，务必加 **`--reuse-srt`**，可跳过软字幕/OCR，只重跑切片，会省大量时间。

---

## 测试入口（只切视频 + 字幕，不要音频）

项目里本来就有 **`--video-only`**：只生成 `video_clips/*.mp4` 和 `subtitles/*.txt`，**不导出 WAV**。

在此基础上加了一个更贴合「先调切片」的 **`--slice-test`**：

- 与 `--video-only` 一样：**不切音频 / 不产 WAV**  
- 额外：**不写** `metadata/metadata.txt` 和 `metadata/metadata.csv`（避免汇总里还写着不存在的 wav）  
- 仍会写 **`output/logs/`** 和 **`failed_videos.txt`**，便于排查  

示例：

```bash
python main.py --input taizhou-news/video/video2 --output ./output --slice-test --reuse-srt
```

第一次需要字幕时去掉 `--reuse-srt`；调好 `config.yaml` 里 `pre_roll`、`merge_*`、`min_duration_sec` 等之后，用 **`--reuse-srt`** 反复试切片会快很多。

---

**User**

这个ocr是不是只做底部区域的会准确率高一点？反正字幕只在底部固定区域出现

---

**Cursor**

是的，**只认底部那一块**通常会更准，你们现在的实现也是这么做的。

在 `src/ocr_subtitle.py` 里，每一帧会先按 `config.yaml` 里的 **`ocr.roi_ratio`**（相对整幅画面的 `x, y, w, h`，0～1）裁出一条带子，再送给 EasyOCR，**不会**对整帧做识别。这样一般能：

- 少掉画面上半部分标题、角标、人脸等干扰，**误检更少**  
- 同样分辨率下，字幕在裁剪图里占比更大，**相对更清晰**（再配合你们已有的 `preprocess` 放大、对比度等）

所以：**“只做底部区域”本身就有利于准确率**；你要做的是把 **`roi_ratio` 和实际新闻条对齐**：

- 条带**太宽/太高**：会带进无关像素，略降准、略变慢  
- **太窄或 `y` 偏上/偏下**：可能切掉字或只切到一半，**漏字、错行**

你们默认大概是底部一条（例如 `y: 0.80, h: 0.18` 这类）。若字幕始终在更靠下的一条细带里，可以把 **`h` 略减小**、**`y` 略增大**（更贴底），**`x` / `w`** 按左右边距收紧一点，往往又准又快。

**小结：** OCR 已经只在底部 ROI 上跑；固定字幕在底部时，**把 ROI 收紧到刚好包住字幕条**比全图识别更合适，准确率通常会更好，记得用短视频肉眼看几条切片，避免裁过头。

---

**User**

问题一，这个范围可以改到3-15s嘛？问题二，为什么就切出来这些呢？明明视频还挺长的。问题三，字幕的读取 @output/metadata/metadata.csv 实在是很有问题。问题四，有些切出来的视频会存在开头或结尾的少数几个字没截取完整。

---

**Cursor**

分析问题并查看配置、流水线逻辑及你当前的 `metadata.csv` 与日志。



定位到关键 bug：`filter_segment` 在应用 `pre_roll`/`post_roll` 后用 **物理切片时长** 与 `max_duration_sec` 比较，导致接近上限的片段被误判为超长并丢弃。正在修复并落实你要求的 3–15s 与其它改进。



修复 `filter_segment` 的误判（导致 45 条打包结果只剩约 20 条），并更新配置与元数据导出。



下面分四点说明原因和已做的改动。

---

### 问题一：范围改成 3～15 秒

已在 `config.yaml` 里把 **`max_duration_sec` 改为 `15.0`**（`min_duration_sec` 仍是 **3.0**）。  
同时把 **`merge_max_span_sec` 设为 `15.0`**，和打包上限一致，减轻 OCR 在「相邻合并」阶段把特别长的一段糊成一大坨文本。

---

### 问题二：视频很长为什么只切出二十来段？

日志里是：**1495 条 OCR 原子段 → 相邻合并成 48 条 → 打包成 45 条**，但最终进 `metadata` 的只有约 **20 条**。

主要原因是代码里的一个逻辑错误：  
`filter_segment` 在加了 **`pre_roll` / `post_roll`** 之后，用**物理切片长度**去和 **`max_duration_sec`** 比较。  
打包好的字幕段本身已经接近 15～20 秒时，再加上前后各约 0.18s，很容易 **略大于 `max_duration_sec`**，整条被 **`return None` 静默丢掉**，所以中间大段时间「像没切」。

已改为：只用 **字幕时间轴上的 `seg.end - seg.start`** 判断是否在 `[min_d, max_d]`；**roll 只影响实际切点，不再参与上限判断**。  
重跑后（建议加 **`--reuse-srt`** 复用已有 SRT，避免再跑一遍 OCR）片段数应接近打包后的条数（例如四十多条量级，视 SRT 而定）。

大段「空白」还可能来自：**当时画面没有底部字幕 / OCR 为空**，时间轴上就没有可切条目，这是数据本身的问题，不是切片上限 alone。

---

### 问题三：`metadata.csv` 读起来很糟

常见有几层原因：

1. **CSV 规范**：字段里若有逗号、引号，会用双引号包起来，**这是正常 CSV**，用 Excel 直接打开有时仍别扭。  
2. **内容本身**：当前文本来自 **OCR**，本来就有错字、重复帧识别结果；再经 **相邻条合并**（间隙 ≤0.35s 就拼成一条），会像「同一句变体」连在一起，所以会像一整段乱码作文。  
3. **Excel 编码**：已把 CSV 改成 **`utf-8-sig`**，双击用 Excel 打开时中文列更不容易乱码。

另外增加了 **`metadata/metadata.jsonl`**：一行一个 JSON，用脚本或 `pandas.read_json(..., lines=True)` 读 **`text`** 字段，不必和 CSV 引号纠缠。

合并相邻字幕时，已在 **`_join_subtitle_text`** 里改为中间加 **空格**，可读性会略好一点（根子上仍依赖 OCR 质量）。

---

### 问题四：开头/结尾少几个字

多半是 **人声比硬字幕起止更早/更晚**，只靠字幕时间轴切会 **切掉字头/字尾**。  
已把 **`pre_roll` / `post_roll` 从 0.18 调到 0.32**（秒），给前后多留一点余量。若仍偶发，可再微调到 **0.4～0.5**，或与 **`sample_interval_sec`**、关键帧精度一起权衡（重编码切片比 `copy` 更准，你们已在用 `libx264`）。

---

**建议你本地验证（复用已有 OCR 结果）：**

```bash
python main.py --input taizhou-news/video/video2 --output ./output --reuse-srt
```

然后看 `metadata.csv`、`metadata.jsonl` 和 `video_clips` 数量是否明显变多、时间空白是否仍集中在「无字幕」区间。若你愿意，我可以再根据新一版日志帮你对一下时间轴。

---

**User**

这个 @output/subtitles/taizhou_000001.txt 是我训练时拿来参照的文本吗？会不会太离谱了，难道要我人为每一个对照过去吗？

---

**Cursor**

是的。**`output/subtitles/taizhou_000001.txt` 和同名的 `taizhou_000001.wav`（以及 `metadata` 里的 `text`）就是「这一小段音频对应的训练文本」**，用来做语音/TTS 等任务的**文本侧标注**。

你现在这份之所以会**特别离谱**，并不是因为程序「随便写的」，而是因为这条片**没有可用的软字幕轨**，走的是 **底部画面 OCR**；再叠加上「相邻时间很近的识别结果会被合并成一条」，就会把**同一句的多种错法**拼成一长串，看起来像复读机 + 错字合集——**当训练标注用质量很差**，模型很容易学到乱七八糟的读音或语言模型。

**不一定要你一条条人工对完整个库**，更现实的路线一般是：

1. **优先用真字幕**  
   若源视频能拿到 **SRT/ASS 或带文本字幕轨** 的版本，用那条链路导出的 `subtitles/*.txt` 会正常很多，不必靠 OCR。

2. **没有真字幕时**  
   - **换识别手段**：例如对**切出来的 wav** 再跑 **Whisper 等 ASR** 当伪标签（方言场景要选对模型/微调），往往比新闻条 OCR 稳。  
   - **质量控制**：随机抽一部分听音对照，设个简单规则（长度、重复率、字符集）**自动丢掉明显垃圾条**，只训「过得去」的子集。  
   - **真要精标**：通常也是**抽样**或**只标高价值片段**，而不是全量逐条死磕。

**结论：**  
- **是**，这些 txt 就是你当前管线里的**训练参照文本**。  
- **以你现在这路 OCR 结果，直接当金标训练确实太离谱**；更合理的期待是：**有真字幕就用真字幕**，没有就 **ASR 伪标或过滤 + 部分人工**，而不是默认「每条都要人对到完美」。

---

**User**

可是我就是没有真字幕，所以才想要用这样的方法来获取字幕的。你有什么更好的方法可以获取字幕嘛？这个准确率好低。

---

**Cursor**

没有真字幕时，**继续靠「认屏幕上的字」**（EasyOCR）做新闻条，本身就很难：字体小、描边、滚动、压缩块效应，再叠加方言用词，**准确率上限往往就不高**。更稳妥的思路通常是：**尽量从「人声」里出字，而不是从「像素」里出字**。

---

### 1. 用语音识别（ASR）——一般更推荐当「没字幕时的主方案」

训练数据是 **wav + 文本**，和 **「听到的内容」** 对齐比和 **「屏上 OCR」** 对齐更合理。

- **Whisper 系列**（`large-v3` 等）：通用品，对普通话还行；**方言要预期会差一截**，可用台州/浙江相关语料做 **微调** 或选国内方言友好模型。  
- **FunASR、Paraformer、WeNet** 等：**中文场景多、工程化好**，有的带标点、长音频切分。  
- 流程可以是：你们已经切好的 **短 wav** → 逐段 ASR → 直接当 `subtitles/*.txt` 或替换 `metadata` 里的 `text`（必要时再加简单规则过滤）。

**缺点**：方言没适配时也会错，但通常比「新闻条 OCR 把同一句错十遍拼成一行」要干净。

---

### 2. 仍用 OCR，但提高「可用率」（不用换大框架也能做）

若必须坚持画面字幕：

- **换引擎**：同一 ROI 下，很多人反馈 **PaddleOCR** 在中文新闻条上比 EasyOCR 更稳，可对比一小段。  
- **按「字幕条」识别，而不是按固定时间戳盲扫**：检测 ROI 里 **文字变化** 再识别，**同一条字幕在屏期间对多帧结果做投票/选最长公共子串**，减少一行里叠十几种错字。  
- **ROI 再收紧**、适当 **放大预处理**（你们已有 preprocess，可再调 `roi_ratio` / `upscale`）。

这些能**减轻**离谱拼接，但**不能从根上超过**「看清屏幕」的难度。

---

### 3. 实用组合（很多项目在用）

- **ASR 做主标注**；  
- **OCR 仅作辅助**（例如只用来切句边界、或检测「有没有字幕条」）；  
- 或 **ASR + 轻量人工**：只改明显错句/抽检。

---

### 4. 预期要说清楚

没有真字幕时，**不存在「又全自动又接近人工听写」的免费银弹**；合理目标是：

- **ASR**：错在「音近、词表」，相对平滑，适合后续微调或过滤；  
- **OCR**：错在「形近、碎片、整行堆叠」，对 TTS/ASR 训练往往更毒。

如果你愿意在 **当前仓库** 里加一条可选路径（例如：**切完 wav 后自动调 Whisper/FunASR 写 `subtitles/*.txt`**），可以说一下你更倾向 **Whisper** 还是 **FunASR**，以及是否有 **GPU**，我可以按你现有 `output` 结构帮你设计最小改动的接入方式（新脚本或 `main.py` 开关均可）。

---

**User**

不可能用asr的啊，这是方言，还是温州话和台州话，怎么识别啊。只能根据画面进行识别了。我要根据画面进行识别的更好的方法。

---

**Cursor**

方言场景下 ASR 不可靠时，应从画面取字。我们改进 OCR 管线：在 ROI 内做帧差检测（字幕未变则跳过识别），并在字幕变化时用多帧 OCR 并按置信度选最佳结果，以减少“同一句多种错法拼成一行”。



实现两项改进：(1) ROI 帧差稳定：画面未变则复用上次识别，避免同一句被识别成多种版本；(2) 换字幕时在邻近时刻多帧 OCR，按 EasyOCR 置信度选最佳。可选加入 **PaddleOCR** 引擎（中文场景常更稳）。



先说结论：**方言没法用 ASR 时，只能靠画面；要提升效果，靠的是「更稳的 OCR + 时间维上少犯错」**，而不是再堆同一种采样方式。

---

### 思路（比「多扫几遍 EasyOCR」更重要）

1. **字幕条在屏期间，画面 ROI 几乎不变**  
   若每隔 0.35s 都重新识别，同一条字会因噪声得到十几种写法，后面再合并就会成「一整段乱码」。  
   **做法**：ROI 灰度变化很小时**直接复用上一时刻的识别结果**（只在新画面/新字幕时才算一次）。

2. **刚换字幕时，多取几帧再决选**  
   在 `t, t+0.06, t+0.12` 等邻近时刻各跑一遍 OCR，**取平均置信度最高**的那一帧整行字，减少单帧偶然错字。

3. **换引擎**  
   中文**新闻条、印刷体**，很多人实测 **PaddleOCR** 比 EasyOCR 更稳。你已可在配置里写 `engine: paddle`（需自行安装 `paddleocr` 和对应 `paddlepaddle` / `paddlepaddle-gpu`）。

---

### 已在项目里做的改动

- 在 `config.yaml` 的 `ocr` 下增加了：
  - **`engine`**：`easyocr`（默认）或 `paddle`
  - **`stability`**：`enabled`、`diff_threshold`、`vote_offsets_sec`
- 在 `src/ocr_subtitle.py` 里实现了上述 **帧差稳定 + 多帧置信度投票**，并保持原 EasyOCR 流程可切换 Paddle。

删旧 OCR 结果后重跑一段对比即可（或删掉 `output/logs/work/20260429.srt` 再跑）：

```bash
# 若仍用 EasyOCR，只享受稳定+投票
python main.py --input taizhou-news/video/video2 --output ./output
```

若装好了 Paddle，可把配置里改成：

```yaml
engine: paddle
```

---

### 调参提示

- **`diff_threshold` 偏大**：字幕已经换了还可能沿用上一句 → 适当**减小**（例如 4～6 之间试）。  
- **偏小**：稳定作用弱，仍容易同句多版本。  
- **`vote_offsets_sec`**：略增帧数会更慢，但换行瞬间可能更稳。

即使这样，**硬字幕 OCR 也不会变成「人工听写」级别**；若仍不够，下一步通常是 **再收紧 ROI、略提高 `preprocess.upscale`**，或针对台/温地区收集一点数据做 **检测/识别小模型微调**（工程量会大很多）。若你愿意，我可以根据你一段样例视频帮你压一版更保守的默认 `stability` / `roi_ratio`。

---

**User**

怎么安装paddle？

---

**Cursor**

正在查看你的 Python 与 CUDA 环境，以便给出准确的安装命令：



你这边是 **Python 3.12 + NVIDIA GPU（4080 SUPER）**，可以按下面方式装。**具体 wheel 以飞桨官网生成的命令为准**（CUDA 版本要和官网选项一致）。

---

### 1. 先看驱动支持的 CUDA 版本

```bash
nvidia-smi
```

右上角 **CUDA Version**（例如 12.x）表示驱动能支持的**最高** CUDA 版本，选 **≤ 该版本** 的 `paddlepaddle-gpu` 即可。

---

### 2. 安装（推荐走官网一键命令）

打开：**[飞桨安装页](https://www.paddlepaddle.org.cn/install/quick)**  

依次选择：**Linux → pip → Python 3.12 → GPU → 你的 CUDA 版本**，页面会给出**唯一正确**的 `pip` 命令（国内用官网自带源即可）。

装完核心库再装 OCR：

```bash
python -m pip install -U "paddleocr>=2.7"
```

---

### 3. 若你暂时不想查官网，可试常见 GPU 源（不保证与你环境 100% 匹配）

**CUDA 11.8 对应 wheel：**

```bash
python -m pip install paddlepaddle-gpu -i https://www.paddlepaddle.org.cn/packages/stable/cu118/
python -m pip install -U "paddleocr>=2.7"
```

若官网当前主推 **CUDA 12**（例如 cu124），把上面链接里的 `cu118` 换成页面里写的路径（如 `cu124`）再装。

**只要 CPU（无 GPU 或装 GPU 版失败）：**

```bash
python -m pip install paddlepaddle -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
python -m pip install -U "paddleocr>=2.7"
```

---

### 4. 验证

```bash
python -c "import paddle; paddle.utils.run_check(); print('version', paddle.__version__)"
```

---

### 5. 和你这个项目联动

`config.yaml` 里设：

```yaml
ocr:
  engine: paddle
  use_gpu: true
```

若 **Python 3.12 没有对应 wheel**（偶发），可用 conda 建 **Python 3.10/3.11** 环境再按官网命令装一遍。

需要的话我可以根据你本机 `nvidia-smi` 里那一行 **CUDA Version** 帮你对一下该用 `cu118` 还是 `cu12x`。

---

**User**

那我赶紧这个切分要不还是改成初版，就是如果字幕是一样的就不切，如果字幕变了就切。（就是如果字幕识别的差不多就不用动了），就还是按字幕进行切分吧。太长了感觉不好把控。以及我下好了paddle

---

**Cursor**

实现「仅按字幕变化切分」：关闭按时长打包；用文本相似度合并 OCR 抖动；并将默认 OCR 引擎设为 `paddle`。



正在实现 `subtitle` 切分模式：用相似度合并“差不多”的相邻条，关闭按时长打包；并把默认 OCR 改为 `paddle`。



已按你的需求改成 **「字幕模式」**：**只在字幕内容变化（且相似度不够高）时切开**；**识别结果差不多**的相邻条会先合成一条再切，**不再做 3～15 秒那种按时长打包**。`config.yaml` 里已把 **`ocr.engine` 设为 `paddle`**（你已装好）。

---

### 行为说明

| 项目 | 说明 |
|------|------|
| **`segment_split_mode: subtitle`** | 关闭「按时长窗口打包」；**一条字幕（含 OCR 抖动合并）→ 一个切片**。 |
| **`subtitle_fuzzy_merge`** | 相邻两条 **间隙 ≤ `max_gap_sec`** 且 **文本相似度 ≥ `similarity_threshold`**（`difflib`）→ 视为同一句，**合并不切**。文案取 **较长** 的那条。 |
| **`max_duration_sec: 0`** | 与 subtitle 模式一致：**不按目标时长**去捆长片。 |
| **`min_duration_sec: 0.35`** | 允许很短的单句；若不想切太碎可调到 `0.5`～`1.0`。 |
| **过滤** | subtitle 模式下 **不再用 `max_duration_sec` 丢「过长」条**（只按字幕条本身时长切）。 |

---

### 若以后要回「按时长打包」的旧逻辑

在 `config.yaml` 里例如：

```yaml
segment_split_mode: packed
merge_adjacent_gap_sec: 0.35
min_duration_sec: 3.0
max_duration_sec: 15.0
```

---

### 调参提示

- **合并过多**（不同句被当成一句）：把 **`similarity_threshold` 调高**（如 `0.85`～`0.92`），或略减小 **`max_gap_sec`**。  
- **同一句被切成很多段**：略**降低** `similarity_threshold` 或略**增大** `max_gap_sec`。

代码改动：`src/srt_parser.py` 新增 `merge_consecutive_fuzzy_similar`；`main.py` 按 `segment_split_mode` 分支；`config.yaml` 为当前默认策略。  
删去或覆盖 `output/logs/work/*.srt` 后重跑，才会用新策略重新切片（加 **`--reuse-srt`** 则仍沿用旧 SRT，只影响切分逻辑时建议先删或不用 reuse）。

---

**User**

好！给我运行命令吧

---

**Cursor**

未找到可复用的 `work/*.srt`，将运行完整流程（含 Paddle OCR，耗时较长）。已在后台启动：



已经在后台帮你跑了一条完整命令（当前工作目录在 `/home/dialect-data`）：

```bash
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output
```

**说明：**

- 会按现在的 **`config.yaml`**（Paddle、`subtitle` 切分等）整段处理，**含 OCR，会比较久**，可在终端里看进度。
- 结果在 **`./output`**：`video_clips/`、`audio_wavs/`、`subtitles/`、`metadata/`。

**以后常用：**

- **只处理别的目录**：把 `--input` 换成你的路径（Linux 用 `/`，不要用 `\`）。
- **已有 `output/logs/work/<视频名>.srt`、只想改切分不重跑 OCR**（省时间）：

```bash
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output --reuse-srt
```

- **只要小视频 + 字幕、不要 WAV**（调参预览）：

```bash
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output --slice-test --reuse-srt
```

若后台任务报错（例如 Paddle 导入失败），把终端里最后几十行贴出来即可。

---

**User**

@output/logs/20260429.log 报错了

---

**Cursor**

正在查看新版 PaddleOCR 的初始化参数：已移除 `use_gpu`。



正在修复 PaddleOCR 3.x 的 API：将 `use_gpu` 改为 `device`，并更新 `ocr`/`predict` 的调用与返回解析。



正在修复：PaddleOCR 3.x 已移除 `use_gpu`，应改用 `device`；`predict` 的返回格式为含 `rec_texts` / `rec_scores` 的结果对象。



**原因：** 你装的是 **PaddleOCR 3.x**（走 PaddleX 管线），构造函数里**不再支持** `use_gpu`、`show_log`，只认 **`device`**，所以报了 `Unknown argument: use_gpu`。

**已改：** `src/ocr_subtitle.py` 里 Paddle 初始化改为 `device="gpu:0"` / `device="cpu"`，识别改为走 **`predict(..., use_textline_orientation=True)`**，并解析新版结果里的 **`rec_texts` / `rec_scores`**（同时保留旧版列表格式的兼容）。

请重新跑（会重新 OCR）：

```bash
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output
```

**说明：** 若把 `ocr.use_gpu` 改成 `false` 用纯 CPU，当前环境里 Paddle 有可能触发 **oneDNN** 相关 `NotImplementedError`；你这边 **`use_gpu: true`** 时实测可正常 `predict`。若必须 CPU，可先在命令前加：`OMP_NUM_THREADS=1`（或升级/重装与官方匹配的 `paddlepaddle`）。

---

**User**

@\root\.cursor\projects\home-dialect-data\terminals\2.txt:410-438 

---

**Cursor**

这段输出**不是报错**，是 **PaddleOCR 3.x 在启动时依次加载子模型** 的提示，属于正常现象：

| 日志里的模型 | 作用（简化） |
|-------------|----------------|
| `PP-LCNet_x1_0_doc_ori` | 文档方向分类 |
| `UVDoc` | 文档矫正相关 |
| `PP-LCNet_x1_0_textline_ori` | 文本行方向 |
| `PP-OCRv5_server_det` | 文字检测 |
| `PP-OCRv5_server_rec` | 文字识别 |

`Model files already exist. Using cached files` 表示**权重已缓存**，不会重复下载。

接下来程序会开始对整段视频按时间采样做 OCR，**可能要跑很久**（十几分钟到更久，视时长和 GPU 而定），终端里后面还会出现大量 `OCR t=...` 的调试日志（若日志级别是 DEBUG）。

**关于 `OMP_NUM_THREADS` 的警告：** 若你遇到过奇怪崩溃，可以在运行前加上：

```bash
export OMP_NUM_THREADS=1
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output
```

**`RequestsDependencyWarning`：** 只是 `urllib3`/`charset_normalizer` 版本和 `requests` 声明不完全一致，一般**不影响**当前 OCR。

如果你关心的是「卡在这里不动」：加载完这 5 个模型后，第一次 `predict` 可能还要再编译/预热几秒，之后才会持续跑；可以看 `output/logs/20260429.log` 是否在刷新时间戳。若长时间完全无新日志，把日志末尾贴出来再排查。

---

**User**

我觉得这一版效果很不错了，可以加一个过滤，就是单句不超过3s的就去掉吧。

---

**Cursor**

`filter_segment` 已用 `min_duration_sec` 判断字幕时间轴时长；将 `min_duration_sec` 设为 `3.0` 即可过滤不足 3 秒的片段。



已经改好了。

项目里本来就用 **`min_duration_sec`** 控制：在 `filter_segment` 里按 **字幕条的起止时间**（`seg.end - seg.start`）判断，**小于这个值的整条会跳过**，不会生成 mp4/wav/txt。

我已把 **`config.yaml` 里的 `min_duration_sec` 从 `0.35` 改成 `3.0`**，并写了注释说明。重跑一遍（有 `--reuse-srt` 会快很多）后，**单句不足 3 秒的都会被丢掉**。

若以后想改成 2.5 秒之类，只改这一处数字即可。

---

**User**

--reuse-srt这个是什么意思我不是很懂

---

**Cursor**

## `--reuse-srt` 是干什么的？

处理每条视频时，程序会先在 **`output/logs/work/`** 下面生成（或复用）一个 **中间字幕文件**：`<视频文件名>.srt`，里面是带时间轴的字幕。

- **不加 `--reuse-srt`**：  
  每次都会重新 **抽软字幕** 或跑 **OCR**，再写这个 `work/*.srt`。  
  **最慢**，尤其是整片 OCR。

- **加了 `--reuse-srt`**：  
  若发现 **`work` 里已经有** 对应视频的 `.srt`，且内容看起来正常（不是空文件、里面有时间轴 `-->`），就 **不再抽轨、不再 OCR**，**直接读这个 SRT** 去做后面的 **合并字幕、按配置切片段、导出视频/音频**。  
  **快很多**，适合你已经满意当前字幕，只想改 **切分参数**（例如 `pre_roll`、`min_duration_sec`、subtitle 模式等）再跑一遍。

---

## 小结

| 场景 | 是否加 `--reuse-srt` |
|------|----------------------|
| 第一次处理 / 想换 OCR 或重新识别画面字幕 | **不要加**（或删掉旧 `work/*.srt`） |
| 字幕已经 OK，只调切片、过滤、roll 等 | **加上**，省时间 |

**注意：** 复用的是 **`output/logs/work/`** 里那份 SRT，不是 `output/subtitles/` 里按片段拆好的 `taizhou_xxxxx.txt`。

---

**User**

我觉得现在对字幕的识别效果以及很不错了，但是还可以再提高一点吗？还有什么好方法？以及其实我发现字幕的切分是不是要严一点点？因为我想保证音频的清晰，其实视频字幕稍微露一点也没事？

---

**Cursor**

分两部分处理：1) 给出可操作的 OCR 提升建议；2) 实现更严的字幕合并配置，并支持“视频略宽、音频略紧”的独立 `pre_roll`/`post_roll`（若合理）。



实现两件事：1. 在配置中收紧字幕合并并加入“视频略宽、音频略紧”的独立 `audio_pre_roll` / `audio_post_roll`；2. 在回复中简要列出可继续提升 OCR 的方法。



下面分三块说明：**还能怎么提 OCR**、**切分更严**、**视频略宽 / 音频更紧（已实现）**。

---

### 1. 识别还能怎么再好一点（思路）

这些是「边际收益」，可按精力选做：

- **ROI**：把 `ocr.roi_ratio` 再对准新闻条，少带进台标/底纹，识别会稳一点。  
- **采样**：略减小 `ocr.sample_interval_sec`（如 0.28～0.30）换行更准，但整片更慢。  
- **稳定 / 投票**：微调 `ocr.stability.diff_threshold`、`vote_offsets_sec`，在「跟得住换行」和「少抖动」之间平衡。  
- **模型**：Paddle 侧 `PP-OCRv5_server` 偏准、`mobile` 偏快；你已是 server 路线，一般够用。  
- **再往上**：针对台/温新闻条做 **检测/识别微调** 或专用数据，成本会高很多。

---

### 2. 切分「严一点」

已在 **`config.yaml`** 里把 **`subtitle_fuzzy_merge`** 略收紧：

- **`max_gap_sec: 0.38`**（原 0.5）— 相邻条要更近才考虑合并。  
- **`similarity_threshold: 0.84`**（原 0.78）— 要更「像」才当成同一句 OCR 抖动。

若仍觉得两句常被糊成一条，可再把阈值提到 **0.86～0.90**；若切太碎，再往回调一点。

---

### 3. 视频字幕多露一点、音频更干净

已实现 **两套 roll**：

| 配置 | 作用 |
|------|------|
| **`pre_roll` / `post_roll`** | 只用于 **切视频**（略宽，字幕条多露一点）。当前默认 **0.42**。 |
| **`audio_pre_roll` / `audio_post_roll`** | 只用于 **从原片导出 WAV**（更紧，少夹前后句）。当前默认 **0.14**。 |

逻辑上会把 **音频时间窗夹在视频窗里面**，避免对不齐。  
**`metadata.csv` 里的 `start`/`end` 现在对应的是音频窗**（和 `wav` 一致），方便你对训练数据。

WAV 一律从 **原视频** 按 `[start_a, end_a]` 抽取，不再从 mp4 再抽一层。

---

重跑前若字幕不用重做，可加：

```bash
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output --reuse-srt
```

---

**User**

但是我担心你音频太紧的话会不会直接缺漏完整语音啊？给我你认为更可行，更保守，切完后音频更适合用于方言生成训练的方案。以及提升字幕辨认能力的方案

---

**Cursor**

采用更保守策略：取消“音频比视频更紧”，使音视频使用同一时间窗，降低切掉字头/字尾的风险；并微调 OCR 与配置说明。



## 更稳妥的「方言生成训练」切片策略（已按此改配置）

你的担心是对的：**音频窗比视频紧很多**（例如 0.14 vs 0.42）时，**更容易切掉字头、字尾或入声**，方言里尤其吃亏。

更稳妥、也更省事的做法是：

- **训练用 WAV 和画面 MP4 用同一套时间窗**（程序里：**不写 `audio_pre_roll` / `audio_post_roll`** 就会这样）。
- **`pre_roll` / `post_roll` 用偏保守的略宽值**（宁可多带几十毫秒邻接声，后期再在训练里做静音裁剪/VAD），**也不要为了「干净」切得太狠**。

我已把默认改成：

- **去掉**单独的 `audio_pre_roll` / `audio_post_roll` → **音视频完全一致**，最适合你现在的目标。  
- **`pre_roll` / `post_roll` = 0.38** —— 在「少夹前后句」和「不截断本句」之间折中；若仍偶发缺字，可再试 **0.40～0.45**，不建议比 **0.22** 还紧的单独音频窗做默认。

`subtitle_fuzzy_merge` 也略放宽一点（**0.82 / 0.42**），减少 OCR 噪声把**同一句拆成两段**，对训练数据量更友好。

---

## 字幕辨认还能怎么抬（按性价比排序）

| 优先级 | 做法 |
|--------|------|
| 高 | **ROI** 尽量只包住新闻条，少背景（你已在调 `roi_ratio`）。 |
| 高 | **采样略密**（已改为 **0.32s**）+ **多帧投票**（已加一格 **0.05～0.15s**）。 |
| 中 | **预处理**：略提对比度（已微调 `contrast_*`）；小字可试 `upscale: 3`（明显变慢）。 |
| 中 | **`stability.diff_threshold`**：换行跟不上就略**减小**，画面易抖、同句多版本就略**增大**。 |
| 低 | 收集一批「框好的字幕条」做 **检测/识别微调** 或换专用模型 —— 上限高、成本高。 |

---

重跑时若 SRT 不用重做：

```bash
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output --reuse-srt
```

若你以后仍想「画面再宽一点、音频略紧一点」，可以再加回 `audio_pre_roll` / `audio_post_roll`，但建议 **不要低于约 0.22**，并先听几条再决定。

---

**User**

@\root\.cursor\projects\home-dialect-data\terminals\2.txt:463-520 

---

**Cursor**

这段日志里**没有程序报错**，最后一行是 **`KeyboardInterrupt`**：表示任务在跑 **`cut_video_segment`（ffmpeg 切视频）** 时被 **手动中断**（一般是终端里按了 **Ctrl+C**），所以 Python 抛了键盘中断并退出。

前面的内容含义大致是：

- **`RequestsDependencyWarning`**：`requests` 和 `urllib3`/`charset_normalizer` 版本声明不完全一致，一般**可以忽略**。
- **`Creating model: ...`**：PaddleOCR 在加载子模型，**正常**。
- **`OMP_NUM_THREADS set to 17`**：Paddle/OpenMP 的线程提示；若想少点啰嗦、有时也更稳，可以先执行：  
  `export OMP_NUM_THREADS=1`  
  再跑 `python main.py ...`（**不是必须**）。

**接下来你可以：**

1. **重新跑完**：不要中断，等整条流水线结束（OCR 慢、切片也会跑一阵）。
2. **已经有过 OCR 结果**：用复用字幕，跳过最耗时的 OCR：  
   `python main.py --input taizhou-news/video/video2 --output ./output --reuse-srt`
3. **只想试切片、不要 WAV**：加 `--slice-test`（会更快一点）。

如果你本意不是按 Ctrl+C，而是**自己停住不动**，把卡住时的最后几行日志或 `output/logs/20260429.log` 末尾贴出来，再帮你查是不是某个 ffmpeg 子进程卡住。

---

**User**

目前重新运行后出现了一个新问题，就是出现了好几幕一起的10s左右的切分，但是字幕并没有每一幕都存下来。我还是希望就按单幅字幕来分吧，只不过加一个判断3s的逻辑。

---

**Cursor**

正在关闭会把多幕合并成一条的「相似字幕合并」，保留 OCR 在单幕内对相同识别结果的合并；`min_duration_sec: 3.0` 继续过滤不足 3 秒的片段。



原因已经能对上：**`subtitle_fuzzy_merge` 打开时**，会把时间上挨得近、**文案又比较像**的多条 SRT **合成一条**，时间轴被拉成一段（你看到的 **~10 秒、多幕一条**），**文本只会保留合并后的那一份**，不会按每一幕各存一条。

### 已改的配置

- 把 **`subtitle_fuzzy_merge.enabled` 设成 `false`**  
- 这样会 **严格按 `work/*.srt` 里每一条的时间段各切一片**，**一条字幕对应一个 `txt` + 一段音视频**（你说的「单幅字幕」）。  
- **`min_duration_sec: 3.0` 没动**：**不足 3 秒的整条仍会丢掉**。

说明：在 **OCR 写 SRT** 时，**同一幕里连续、识别字符串完全一样**的采样本来就会并成 **一条 SRT**，这不算「多幕糊一起」，关掉 fuzzy 也不会把同一幕再拆碎。

### 你怎么跑

**不必重跑 OCR**，只要 SRT 里本来就是多条，用复用即可：

```bash
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output --reuse-srt
```

若你希望 **连 SRT 也按新 OCR 参数重生成**，删掉对应的 `output/logs/work/20260429.srt` 后再跑（不要加 `--reuse-srt`）。

以后若又觉得 **OCR 同一句被拆成很多条**、想轻微并一下，再把 **`enabled: true`** 打开，并把 **`similarity_threshold` 提到 0.9 以上**（只并「几乎一模一样」的）。

---

**User**

SRT我觉得还是有改进的必要的，这个字幕识别能力你看还有啥方法可以做不？我想提一个点，就是有一些识别 @output/logs/20260429.log:273-286 其实这个'未纳人基本医保报销范围需要自费'是对的，但是后面没有采纳这句话。我觉得关于这个是不是也可以优化一下。当然还是要优化本身的字幕提取能力为主。

---

**Cursor**

分析 OCR 流水线并加入“去抖/多数表决”逻辑：避免单行末尾单次误识别打断稳定文本。



识别到问题：稳定复用多帧后，某一时刻 ROI 差分略超阈值会触发重新 OCR，单次结果（如「未纳入」或带 CAIZHO）会打断此前稳定的「未纳人…」。添加基于“连续确认”的去抖，并在配置中暴露参数。



将 `same_line_similarity` 设为 `0.92`：「未纳人」与「未纳入」的相似度约为 0.933，原先 0.94 无法合并。



## 原因说明（对应你贴的日志）

前面一长串 **`未纳人基本医保报销范围需要自费`** 多半是 **stability** 在 ROI 几乎不变时一直复用上一识别结果。到 **t≈97.65** 时，画面差分略大，**又重新跑了一次 OCR**，得到 **`未纳入…`** 或带 **`CAIZHO`** 的版本，时间轴上就把「稳定句」打断了，SRT 里就容易变成 **短句/错句**，而不是你一直认可的那版。

也就是说：问题不只在「模型认字」，还在于 **「单次重识别 + 字符串必须完全一致才合并」** 太脆。

---

## 已做的两类优化（代码 + 默认配置）

### 1. 时间轴 **文案去抖** `text_debounce`（新）

- **高相似**（默认 **≥ 0.92**）→ 仍视为 **同一句**，继续输出 **当前已稳定的那版字**（例如保留先出现的 `未纳人…`，不把一两字差的 `未纳入…` 当场当成换新句）。  
  我算过：`未纳人…` vs `未纳入…` 的 `SequenceMatcher` 比例约 **0.933**，所以把默认从 0.94 调到 **0.92** 才能吃到这条规则。
- **明显是新句** → 要 **连续 `confirm_steps` 次采样（默认 2）** 都是新文案，才真正切换，避免 **一帧鬼畜**（如 `CAIZHO…`）打断长句。

### 2. 减轻「没必要就重跑 OCR」

- 把 **`stability.diff_threshold`** 从 **5.0 提到 6.0**（可按素材在 **5～7** 微调）：略钝一点，减少 **轻微压缩/亮度抖动** 就触发整段重识别。

---

## 辨认能力本身还能怎么抬（简要）

- **ROI / 预处理**：仍然是最划算的（条带贴字、`upscale`、对比度）。  
- **Paddle**：继续用 **server** 档；有精力再上 **领域微调**。  
- **去抖参数**：换行 **变慢** 可把 `confirm_steps` 提到 **3**；若 **不同句被粘成一句** 就把 **`same_line_similarity` 提到 0.93～0.94**。

---

## 你需要怎么跑

去抖和 diff 只影响 **重新 OCR 写 SRT**，请 **删掉**（或改名）旧的  
`output/logs/work/20260429.srt` 后 **全量重跑**，**不要**加 `--reuse-srt`，例如：

```bash
rm -f /home/dialect-data/output/logs/work/20260429.srt
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output
```

切片仍由你现在的 **`subtitle_fuzzy_merge: false`** + **`min_duration_sec: 3.0`** 控制。

---

**User**

ROI / 预处理：仍然是最划算的（条带贴字、upscale、对比度）。这个怎么加？加上去试试看

---

**Cursor**

发现配置错误：`vote_offsets_sec` 被误放在 `text_debounce` 下，代码从 `stability` 读取，导致投票帧未生效。正在修复 YAML 结构并加强 ROI 与预处理参数。



已经帮你 **改好 `config.yaml` 里的 OCR 参数**，并修掉一个 **隐藏问题**。

---

### 1. 配置错误（已修）

`vote_offsets_sec` 之前写在 **`text_debounce`** 下面，但代码是从 **`ocr.stability`** 里读的，所以你的 **多帧投票一直没生效**。  
现已挪到 **`stability` 下面**，和程序一致。

---

### 2. ROI（更贴底、略收紧）

| 项 | 原值 | 新值 | 说明 |
|----|------|------|------|
| `x` | 0.05 | **0.04** | 左右多留一点，少裁字 |
| `y` | 0.80 | **0.83** | 框更靠下，对准常见新闻底条 |
| `w` | 0.90 | **0.92** | 略加宽 |
| `h` | 0.18 | **0.15** | 条带略扁，减少条带上沿无关画面 |

若发现 **字被切掉** 或 **台标进框**：把 `y` 略减小（如 0.81）或把 `h` 略加大（如 0.16）。

---

### 3. 预处理（放大 + 对比 + 锐化）

| 项 | 原值 | 新值 |
|----|------|------|
| `upscale` | 2 | **3** |
| `contrast_alpha` | 1.22 | **1.28** |
| `contrast_beta` | 14 | **18** |
| `unsharp_sigma` | 0.85 | **0.72** |
| `unsharp_amount` | 0.35 | **0.42** |

**`upscale: 3` 会明显拖慢整片 OCR**，显存/时间吃紧时可改回 **2**。

---

### 4. 采样

- **`sample_interval_sec`：0.32 → 0.30**（换行对齐略好一点，也更慢一点）

---

### 5. 你怎么试

要看到 ROI/预处理效果，需要 **重新跑 OCR**（不要 `--reuse-srt`），例如先删旧 SRT 再跑：

```bash
rm -f /home/dialect-data/output/logs/work/20260429.srt
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output
```

如果你愿意，可以截一张 **带字幕的全屏**，我可以按画面帮你微调 `roi_ratio` 的 `y/h`。

---

**User**

运行后我发现几个问题，首先还是存在3句话被切在一起，那既然这么切，就要保证字幕是完整的呀，实际上只有第一幕的字幕，要不就保证严格按字幕分。以及我觉得这个边界可以稍微严一点，因为普遍有结尾出现下一句话的一两个字的感觉。

---

**Cursor**

定位到问题：在 ROI 背景（蓝条）变化很小时，`stability` 会长期复用 `prev_text`，导致多幕画面仍显示第一句文案。将加入强制刷新 OCR，并收紧片尾边界（减小 `post_roll` + 可选片尾修剪）。



修复中：`stability` 在底条背景不变时会一直复用上一句文案，导致多幕被合并成一条且文本仍是第一句。将添加强制周期性重新 OCR，并收紧片尾（`post_roll` + `clip_end_trim_sec`），同时提高 `text_debounce` 的相似度阈值，避免把不同句判成同一句。



## 原因说明

1. **多幕并成一条、文案只有第一句**  
   新闻 **底条背景几乎不变** 时，`stability` 只看 ROI **灰度差**，差值长期低于阈值就会 **一直复用 `prev_text`**，画面已经换了两三句字幕，识别串仍是第一句 → SRT 一条很长，**文本却对不上后面几幕**。

2. **结尾像带进下一句一两个字**  
   **`post_roll` 偏大** 或片尾略长，时间轴会 **多盖住下一句开头**。

---

## 已做修改

### 1. `ocr.stability.max_reuse_sec`（新）

- 无论灰度是否像「没动」，**每隔这么多秒强制重新 OCR 一次**。  
- 默认 **`0.29`**，和 **`sample_interval_sec: 0.30`** 一起用时，**几乎每个采样点都会真跑 OCR**，等于在「底条不动」时也不再卡死在上一句文案上，**按幕分句会严很多**。  
- 若机器吃力，可把 `max_reuse_sec` 调到 **0.5～0.6** 省算力，但换行可能略钝。

### 2. 片尾收紧

- **`pre_roll: 0.34`**，**`post_roll: 0.24`**（头略松、尾更紧）。  
- 新增 **`clip_end_trim_sec: 0.07`**：在 roll 之后再从 **片尾向内裁 70ms**（音视频一起裁），减轻 **下一句露头**。

### 3. `text_debounce.same_line_similarity: 0.96`

- **不同句** 只因略像就被当成同一句的情况会减少；**单句里一两字抖动** 仍主要靠 **`confirm_steps`** 挡。

---

## 你需要做的

必须 **重新 OCR** 写 SRT（旧 SRT 仍是「糊句」逻辑）：

```bash
rm -f /home/dialect-data/output/logs/work/20260429.srt
cd /home/dialect-data && python main.py --input taizhou-news/video/video2 --output ./output
```

若发现 **本句尾音被切掉**，先把 **`clip_end_trim_sec` 改成 `0.04` 或 `0`**，或把 **`post_roll` 略加大**（例如 `0.28`）再试。

---

**User**

我准备外包这个处理任务了，现在要跟他将任务要求。你帮我总结一下吧

---

**Cursor**

下面是一份可直接发给外包方的**任务说明摘要**（可按你们合同再补商务与排期条款）。

---

## 一、项目目标

把**方言新闻类视频**（温州话、台州话等，**无可靠软字幕**）加工成 **TTS / 语音合成训练用数据**：  
**短视频片段 + 对齐 WAV + 对应文本**，并尽量保证**画面字幕与音频时间轴合理**。

---

## 二、输入与输出

**输入**

- 原始视频（如 `mp4`），可能**无文本字幕轨**或仅有**硬字幕**（烧在画面上）。
- 批量目录或文件列表，由需求方指定。

**输出（建议目录结构）**

- `video_clips/`：按句切出的小视频（`libx264` 等，与现流程一致即可）。
- `audio_wavs/`：与片段一一对应的 **WAV**（如 22050 Hz、单声道、PCM）。
- `subtitles/`：与片段同名的 **txt**，一行/一段即该条训练文本。
- `metadata/`：`metadata.csv` / `metadata.jsonl`（或等价表），字段至少含：**片段 id、wav 文件名、文本、起止时间、源视频路径**；可有 **失败列表**（如 `failed_videos.txt`）。
- `logs/work/*.srt`：中间**全片 OCR 近似 SRT**（便于复跑、验收与排错）。

---

## 三、核心技术路线（需外包方理解并沿用或等价实现）

1. **字幕来源**  
   - 优先检测**可导出文本的软字幕**；若无，则对**画面底部固定 ROI** 做 **OCR**（当前方案为 **PaddleOCR 3.x**，GPU）。  
   - 需处理：**底条背景几乎不变导致「多幕被当成一句」**的问题——通过**周期性强制重识别**、**时间轴去抖**、**相似度阈值**等策略，保证**尽量一句一屏一条 SRT**，而不是多句糊成一条只保留首句文案。

2. **切分策略**  
   - **按 SRT 每条时间段切段**（单条字幕对应一个 clip + 一条 txt），**不要用「多句按时长打包成 10s+」**替代单句切分。  
   - **时长过滤**：例如**单条字幕时长不足 3 秒整段丢弃**（具体秒数以需求方 `config` 为准）。

3. **音视频边界**  
   - 使用 **`pre_roll` / `post_roll`** 微调起止，兼顾**不全截字头字尾**与**少带进下一句**。  
   - 可按需求加**片尾再内裁**（如 `clip_end_trim_sec`），减轻**结尾冒出下一句一两个字**。  
   - 训练侧若要求**音视频时间轴一致**，需明确：**WAV 与 MP4 是否同窗**；若曾采用「视频略宽、音频略紧」，也需在交付说明里写清。

4. **工程依赖**  
   - **FFmpeg / ffprobe** 必备；OCR 依赖 **Paddle + PaddleOCR**（及可选 EasyOCR 对比）。  
   - 支持 **Linux** 路径、`config.yaml` 集中调参；支持 **`--reuse-srt`**：在已有 `work/*.srt` 时**只重跑切片与导出、不重跑 OCR**，便于调参验收。

---

## 四、质量与验收要点

- **字幕与画面对齐**：每条 `txt` 应能对应**该段视频里主字幕内容**，避免「一条 SRT 覆盖多幕但 txt 只有第一句」。  
- **音频可用性**：无明显长期静音或大量串入**相邻句**人声（可通过抽听 + 看 `metadata` 时间轴抽查）。  
- **编码与命名**：片段编号连续、与 `metadata` 一致；失败样本有日志可追溯。  
- **可复现**：提供**运行环境说明**（Python 版本、主要依赖版本）、**配置文件**及**一条完整示例命令**。

---

## 五、建议外包方交付物清单

1. 可运行的**脚本/工程** + `README`（安装、配置项说明、示例命令）。  
2. **默认 `config.yaml`** 及**各关键参数含义**（ROI、采样间隔、OCR 稳定/去抖、切分与 3s 过滤、roll 与片尾修剪等）。  
3. **小样本试跑结果**（例如 1～2 条完整新闻）供需求方听辨与对字幕。  
4. 已知限制说明（如：强压缩、极端花字、滚动过快、台标遮挡等场景的预期准确率）。

---

## 六、可选说明（给外包方）

- 方言**不宜依赖通用 ASR 作为主标注**时，以**画面 OCR** 为主、ASR 仅作辅助需单独约定。  
- 若需**加速或降本**，可讨论：降采样间隔、换轻量 OCR、或仅输出音频+文本不做小视频等**范围裁剪**。

---

如果你愿意，我可以根据你们**最终版 `config.yaml`** 再压一版「仅参数表 + 验收 checklist」的极简附件，方便贴在合同技术附件里。

