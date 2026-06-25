#!/usr/bin/env python3
"""从 rejected/ 恢复误删的 wav/txt（新目录布局 video/00N、word/00N）。"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def _restore_tree(rej_root: Path, ok_root: Path) -> int:
    n = 0
    if not rej_root.is_dir():
        return 0
    for slot_dir in sorted(rej_root.iterdir()):
        if not slot_dir.is_dir():
            continue
        dst_dir = ok_root / slot_dir.name
        dst_dir.mkdir(parents=True, exist_ok=True)
        for f in slot_dir.iterdir():
            if f.is_file():
                dst = dst_dir / f.name
                if dst.exists():
                    dst.unlink()
                shutil.move(str(f), str(dst))
                n += 1
    return n


def main() -> int:
    p = argparse.ArgumentParser(description="从 rejected/ 恢复 wav 与 txt")
    p.add_argument("--output", type=Path, default=Path("output/taizhou"))
    p.add_argument(
        "--kind",
        choices=["quality", "mandarin", "both"],
        default="both",
    )
    args = p.parse_args()

    out = args.output
    n = 0
    kinds = ["quality", "mandarin"] if args.kind == "both" else [args.kind]
    for kind in kinds:
        n += _restore_tree(out / "rejected" / kind / "video", out / "video")
        n += _restore_tree(out / "rejected" / kind / "word", out / "word")

    print(f"已恢复 {n} 个文件 -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
