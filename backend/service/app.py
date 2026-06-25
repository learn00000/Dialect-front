"""FastAPI entrypoint for the dual-track dialect corpus sidecar."""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import JOBS_ROOT
from .pipeline import service
from .training import training_manager

app = FastAPI(
    title="Dialect Live Database Sidecar",
    version="0.1.0",
    summary="Dual-track dialect corpus pipeline powered by copied dialect_data workflow.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/storage", StaticFiles(directory=str(JOBS_ROOT)), name="job-storage")


class ReviewDecisionPayload(BaseModel):
    decision: str
    note: str = ""


class VolunteerApplicationPayload(BaseModel):
    reviewerName: str
    province: str = ""
    city: str = ""
    district: str = ""


class VolunteerReviewPayload(BaseModel):
    reviewerName: str
    province: str = ""
    city: str = ""
    district: str = ""
    dialectAccuracy: int
    dialectNote: str = ""
    transcriptChoice: str = "user"
    transcriptFinal: str = ""
    riskFlag: bool = False
    riskNote: str = ""


class TrainingStartPayload(BaseModel):
    dialectKey: str


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/map/overview")
def get_map_overview():
    return service.get_map_overview()


@app.get("/api/map/points")
def get_map_points(
    layer: str = "",
    province: str = "",
    city: str = "",
    district: str = "",
    type: str = "",
    status: str = "",
):
    point_types = [item for item in type.split(",") if item]
    return service.list_map_points(
        layer=layer,
        province=province,
        city=city,
        district=district,
        point_type=point_types,
        status=status,
    )


@app.get("/api/pipeline/metrics")
def get_pipeline_metrics():
    return service.get_pipeline_metrics()


@app.post("/api/contributions")
async def create_contribution(
    file: UploadFile = File(...),
    area: str = Form(""),
    dialectSelfReport: str = Form(""),
    type: str = Form("audio"),
    content: str = Form(""),
    nickname: str = Form(""),
    consentGranted: str = Form("false"),
) -> dict:
    payload = await file.read()
    try:
        return service.create_audio_contribution(
            filename=file.filename or "upload.wav",
            media_content_type=file.content_type or "audio/wav",
            contribution_type=type,
            payload=payload,
            area=area,
            dialect_self_report=dialectSelfReport,
            content=content,
            nickname=nickname,
            consent_granted=_parse_bool(consentGranted),
        )
    except Exception as exc:  # pragma: no cover - HTTP translation
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/contributions")
def list_contributions(
    search: str = "",
    province: str = "",
    city: str = "",
    district: str = "",
    type: str = "",
    status: str = "",
    sourceType: str = "",
    hasReview: str = "",
    sort: str = "createdAt",
    order: str = "desc",
    page: int = 1,
    pageSize: int = 20,
):
    has_review = None
    if hasReview != "":
        has_review = _parse_bool(hasReview)
    return service.list_contributions(
        search=search,
        province=province,
        city=city,
        district=district,
        content_type=type,
        status=status,
        source_type=sourceType,
        has_review=has_review,
        sort=sort,
        order=order,
        page=page,
        page_size=pageSize,
    )


@app.post("/api/corpora/import-video")
async def import_video_corpus(
    profile: str = Form("taizhou"),
    inputPath: str = Form(""),
    region: str = Form(""),
    dialectHint: str = Form(""),
    file: Optional[UploadFile] = File(None),
) -> dict:
    uploaded_file = None
    if file is not None:
        uploaded_file = (
            file.filename or "source.mp4",
            file.content_type or "video/mp4",
            await file.read(),
        )
    try:
        return service.create_video_import(
            profile=profile,
            input_path=inputPath,
            region=region,
            dialect_hint=dialectHint,
            uploaded_file=uploaded_file,
        )
    except Exception as exc:  # pragma: no cover - HTTP translation
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    try:
        return service.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="job not found") from exc


@app.get("/api/jobs/{job_id}/stages")
def get_job_stages(job_id: str) -> dict:
    try:
        return {"jobId": job_id, "stages": service.get_job_stages(job_id)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="job not found") from exc


@app.get("/api/contributions/{contribution_id}")
def get_contribution(contribution_id: str) -> dict:
    try:
        return service.get_contribution(contribution_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="contribution not found") from exc


@app.delete("/api/contributions/{contribution_id}")
def delete_contribution(contribution_id: str) -> dict:
    try:
        return service.delete_contribution(contribution_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="contribution not found") from exc


@app.get("/api/contributions/{contribution_id}/segments")
def get_contribution_segments(contribution_id: str):
    try:
        return service.get_contribution_segments(contribution_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="contribution not found") from exc


@app.get("/api/contributions/{contribution_id}/pipeline")
def get_contribution_pipeline(contribution_id: str) -> dict:
    try:
        return service.get_contribution_pipeline(contribution_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="contribution not found") from exc


@app.post("/api/review-tasks/{review_task_id}/decision")
def decide_review_task(review_task_id: str, payload: ReviewDecisionPayload) -> dict:
    try:
        return service.decide_review_task(review_task_id, payload.decision, payload.note)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="review task not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/volunteer-applications")
def apply_volunteer(payload: VolunteerApplicationPayload) -> dict:
    try:
        return service.apply_volunteer(
            reviewer_name=payload.reviewerName,
            province=payload.province,
            city=payload.city,
            district=payload.district,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/contributions/{contribution_id}/volunteer-review")
def submit_volunteer_review(contribution_id: str, payload: VolunteerReviewPayload) -> dict:
    try:
        return service.submit_volunteer_review(
            contribution_id=contribution_id,
            reviewer_name=payload.reviewerName,
            province=payload.province,
            city=payload.city,
            district=payload.district,
            dialect_accuracy=payload.dialectAccuracy,
            dialect_note=payload.dialectNote,
            transcript_choice=payload.transcriptChoice,
            transcript_final=payload.transcriptFinal,
            risk_flag=payload.riskFlag,
            risk_note=payload.riskNote,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="contribution not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/training/dialects")
def get_training_dialects():
    return training_manager.get_dialect_stats()


@app.get("/api/training/jobs")
def list_training_jobs():
    return {"jobs": training_manager.list_jobs()}


@app.post("/api/training/jobs")
def start_training_job(payload: TrainingStartPayload):
    try:
        return training_manager.start_training(payload.dialectKey)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/training/jobs/{job_id}")
def get_training_job(job_id: str):
    try:
        return training_manager.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="training job not found") from exc


@app.get("/api/training/jobs/{job_id}/log")
def get_training_job_log(job_id: str):
    try:
        return {"jobId": job_id, "log": training_manager.read_log(job_id)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="training job not found") from exc


@app.get("/api/training/jobs/{job_id}/weights")
def download_training_weights(job_id: str):
    try:
        path = training_manager.get_weights_file(job_id)
    except KeyError as exc:
        reason = str(exc)
        if reason in {"weights_not_ready", "weights_missing"}:
            raise HTTPException(status_code=409, detail="模型权重尚未就绪") from exc
        raise HTTPException(status_code=404, detail="training job not found") from exc
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=path.name,
    )


def _parse_bool(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}
