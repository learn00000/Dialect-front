# 方言活体数据库后端 sidecar

这个目录给现有前端补了一套独立的 Python sidecar，不改你原来的 Vite 页面入口，也不把 `dialect-data` 重写成 Node。

## 目录

- `backend/dialect_data/`
  - 你提供的 `dialect-data` 基线流水线，作为底层语料加工引擎
- `backend/service/`
  - FastAPI 封装层
  - SQLite 任务库
  - 双轨任务执行器

## 支持的两类任务

- `audio_upload`
  - 地图上传的音频样本
  - 走：接入 -> 音频预处理 -> 用户文本优先 / ASR 保留结果 -> 校对 -> 切分 -> 质检 -> 普通话过滤 -> 入库
- `video_source`
  - 视频语料导入
  - 走：接入 -> 软字幕/OCR -> 字幕缺失时 ASR 兜底 -> 校对 -> 切分 -> 质检 -> 普通话过滤 -> 入库

## 9 个智能体节点

1. `intake_agent`
2. `subtitle_source_agent`
3. `audio_prep_agent`
4. `transcription_agent`
5. `llm_proofread_agent`
6. `segmentation_agent`
7. `quality_filter_agent`
8. `mandarin_filter_agent`
9. `metadata_writer_agent`

## API

- `POST /api/contributions`
- `POST /api/corpora/import-video`
- `GET /api/jobs/:id`
- `GET /api/jobs/:id/stages`
- `GET /api/contributions/:id`
- `GET /api/contributions/:id/pipeline`
- `POST /api/review-tasks/:id/decision`

## 运行

先准备 Python 环境，并确保系统里有 `ffmpeg` / `ffprobe`。

```bash
cd /Users/sunyuhan/Dialect-front
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.service.app:app --reload --host 0.0.0.0 --port 8000
```

也可以先在仓库根目录创建本地环境文件：

```bash
cd /Users/sunyuhan/Dialect-front
cp .env.local.example .env.local
```

启动后：

- 健康检查：`http://localhost:8000/api/health`
- 静态产物：`http://localhost:8000/storage/...`

## 真实依赖说明

- `OCR` 依赖 `paddleocr`
- `LLM 校对` 默认读取环境变量 `DASHSCOPE_API_KEY`
- 音频转写默认优先尝试 DashScope `fun-asr-flash-2026-06-15`
- `本地 ASR` 默认使用 `funasr/paraformer-zh`
- `sherpa-onnx` 本地模型保留为兼容兜底
- 如果本地 ASR 没装，`mandarin_filter_agent` 会退化执行并自动创建复核任务

可选环境变量：

```bash
export DASHSCOPE_API_KEY=你的百炼密钥
export DIALECT_DASHSCOPE_ASR_MODEL=fun-asr-flash-2026-06-15
export DIALECT_DASHSCOPE_ASR_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
```

推荐把这些变量写到 `.env.local`，不要直接写进代码，也不要提交到 Git。

## 启动方式建议

前端和后端分开跑：

```bash
cd /Users/sunyuhan/Dialect-front
npm run dev
```

```bash
cd /Users/sunyuhan/Dialect-front
source .venv/bin/activate
uvicorn backend.service.app:app --reload --port 8000
```

## 当前实现边界

- 前端 mock 还保留着，便于你逐步接真实 API
- sidecar 已经支持任务创建、阶段追踪、复核任务和最终片段入库
- 当前 `import-video` 先按单视频文件或上传文件运行；目录级批量导入接口还没展开到多 slot 聚合
- 还没有做多进程恢复、队列持久化重试和权限系统，这些适合下一轮再补
