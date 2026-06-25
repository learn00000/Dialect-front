"""写入 metadata.txt、metadata.csv、metadata.jsonl。"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List


@dataclass
class MetadataRow:
    id: str
    wav_basename: str
    text: str
    start_sec: float
    end_sec: float
    source_video: str
    profile: str = ""
    video_slot: str = ""
    wav_path: str = ""
    txt_path: str = ""


def write_metadata_txt(path: Path, rows: Iterable[MetadataRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: List[str] = []
    for r in rows:
        rel = r.wav_path or r.wav_basename
        lines.append(f"{rel}|{r.text}")
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def write_metadata_csv(path: Path, rows: Iterable[MetadataRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "id",
                "profile",
                "video_slot",
                "wav",
                "txt",
                "text",
                "start",
                "end",
                "source_video",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r.id,
                    r.profile,
                    r.video_slot,
                    r.wav_path or r.wav_basename,
                    r.txt_path,
                    r.text,
                    f"{r.start_sec:.3f}",
                    f"{r.end_sec:.3f}",
                    r.source_video,
                ]
            )


def write_metadata_jsonl(path: Path, rows: Iterable[MetadataRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(
                json.dumps(
                    {
                        "id": r.id,
                        "profile": r.profile,
                        "video_slot": r.video_slot,
                        "wav": r.wav_basename,
                        "wav_path": r.wav_path,
                        "txt_path": r.txt_path,
                        "text": r.text,
                        "start": round(r.start_sec, 3),
                        "end": round(r.end_sec, 3),
                        "source_video": r.source_video,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
