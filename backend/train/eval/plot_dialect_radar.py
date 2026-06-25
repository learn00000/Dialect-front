#!/usr/bin/env python3
"""绘制方言 TTS 五维雷达图（参照美学度量风格）。"""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from matplotlib import font_manager
from matplotlib.collections import PolyCollection

# ── 评分数据 ──────────────────────────────────────────────────────────────
SCORES = {
    "温州话": [7.5, 7.2, 7.0, 5.8, 7.8],
    "台州话": [7.8, 7.5, 6.8, 6.2, 7.5],
    "闽南-基座": [7.4, 7.2, 7.2, 6.5, 7.8],
    "闽南-精调": [7.6, 7.4, 7.5, 6.8, 8.0],
}

LABELS = [
    "听感美感",
    "情感表现",
    "字音地道",
    "连续变调",
    "鲁棒一致",
]

LABELS_EN = ["Audio", "Prosody", "Lexical", "Sandhi", "Robustness"]

# 参考图配色
STYLE = {
    "primary": "#5B9BD5",
    "primary_light": "#BDD7EE",
    "secondary": "#ED7D31",
    "grid_line": "#D9D9D9",
    "band_even": "#FFFFFF",
    "band_odd": "#F2F2F2",
    "label": "#404040",
    "score": "#2F5597",
}

DIALECT_COLORS = {
    "温州话": "#5B9BD5",
    "台州话": "#70AD47",
    "闽南-基座": "#A8C8E8",
    "闽南-精调": "#5B9BD5",
}


def _setup_font() -> font_manager.FontProperties:
    for path in font_manager.findSystemFonts():
        if "NotoSansCJK" in path and "Regular" in path:
            font_manager.fontManager.addfont(path)
            fp = font_manager.FontProperties(fname=path)
            plt.rcParams["font.family"] = fp.get_name()
            plt.rcParams["axes.unicode_minus"] = False
            return fp
    for path in font_manager.findSystemFonts():
        if "NotoSerifCJK" in path:
            font_manager.fontManager.addfont(path)
            fp = font_manager.FontProperties(fname=path)
            plt.rcParams["font.family"] = fp.get_name()
            plt.rcParams["axes.unicode_minus"] = False
            return fp
    return font_manager.FontProperties()


def _polygon_xy(values: np.ndarray, angles: np.ndarray) -> np.ndarray:
    """极坐标 → 笛卡尔，values 与 angles 等长。"""
    x = values * np.cos(angles)
    y = values * np.sin(angles)
    return np.column_stack([x, y])


def _draw_banded_grid(ax, angles: np.ndarray, rmax: float = 10, step: float = 2) -> None:
    """绘制多边形斑马纹背景 + 细网格线。"""
    levels = np.arange(step, rmax + step, step)
    for i, r in enumerate(levels):
        verts = _polygon_xy(np.full(len(angles), r), angles)
        color = STYLE["band_odd"] if i % 2 else STYLE["band_even"]
        poly = mpatches.Polygon(verts, closed=True, facecolor=color, edgecolor="none", zorder=0)
        ax.add_patch(poly)
    # 网格线
    for r in levels:
        verts = _polygon_xy(np.full(len(angles), r), angles)
        xs, ys = verts[:, 0], verts[:, 1]
        xs = np.append(xs, xs[0])
        ys = np.append(ys, ys[0])
        ax.plot(xs, ys, color=STYLE["grid_line"], linewidth=0.6, zorder=1)
    for ang in angles:
        ax.plot([0, rmax * np.cos(ang)], [0, rmax * np.sin(ang)],
                color=STYLE["grid_line"], linewidth=0.6, zorder=1)


def _draw_series(
    ax,
    stats: np.ndarray,
    angles: np.ndarray,
    color: str,
    *,
    label: str | None = None,
    show_scores: bool = True,
    linewidth: float = 2.2,
    alpha_fill: float = 0.18,
    marker_size: float = 9,
    linestyle: str = "-",
    zorder: int = 3,
) -> None:
    closed_stats = np.concatenate([stats, [stats[0]]])
    closed_angles = np.concatenate([angles, [angles[0]]])
    verts = _polygon_xy(closed_stats, closed_angles)

    fill = mpatches.Polygon(verts, closed=True, facecolor=color, edgecolor="none", alpha=alpha_fill, zorder=zorder)
    ax.add_patch(fill)
    ax.plot(verts[:, 0], verts[:, 1], color=color, linewidth=linewidth, linestyle=linestyle,
            solid_capstyle="round", zorder=zorder + 1, label=label)

    for ang, val in zip(angles, stats):
        x, y = val * np.cos(ang), val * np.sin(ang)
        ax.scatter(x, y, s=marker_size ** 2, facecolors="white", edgecolors=color,
                   linewidths=2.0, zorder=zorder + 2)
        if show_scores:
            lx, ly = (val + 0.55) * np.cos(ang), (val + 0.55) * np.sin(ang)
            ax.text(lx, ly, f"{val:.1f}", ha="center", va="center", fontsize=9.5,
                    color=STYLE["score"], fontweight="bold", zorder=zorder + 3)


def _draw_labels(ax, angles: np.ndarray, fp: font_manager.FontProperties, rmax: float = 10) -> None:
    label_r = rmax + 1.35
    for ang, cn, en in zip(angles, LABELS, LABELS_EN):
        x, y = label_r * np.cos(ang), label_r * np.sin(ang)
        ax.text(x, y, cn, ha="center", va="center", fontsize=11, color=STYLE["label"],
                fontweight="bold", fontproperties=fp, zorder=5)
        ax.text(x, y - 0.38, en, ha="center", va="center", fontsize=8.5,
                color="#888888", fontproperties=fp, zorder=5)


def plot_single_radar(
    stats: np.ndarray,
    color: str,
    title: str,
    subtitle: str,
    out: Path,
    fp: font_manager.FontProperties,
) -> None:
    n = len(LABELS)
    angles = np.linspace(np.pi / 2, np.pi / 2 + 2 * np.pi, n, endpoint=False)
    rmax = 10

    fig, ax = plt.subplots(figsize=(6.5, 6.5))
    ax.set_aspect("equal")
    ax.axis("off")
    lim = rmax + 2.2
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)

    _draw_banded_grid(ax, angles, rmax)
    _draw_series(ax, np.array(stats), angles, color, show_scores=True)

    # 刻度标注（2/4/6/8/10）
    for r in [2, 4, 6, 8, 10]:
        ax.text(0.15, r - 0.15, str(r), fontsize=7.5, color="#AAAAAA", ha="left", va="bottom")

    _draw_labels(ax, angles, fp, rmax)

    fig.text(0.5, 0.96, title, ha="center", va="top", fontsize=16, fontweight="bold",
             color="#333333", fontproperties=fp)
    fig.text(0.5, 0.91, subtitle, ha="center", va="top", fontsize=10,
             color="#888888", fontproperties=fp)

    out.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out, dpi=200, bbox_inches="tight", facecolor="white", pad_inches=0.3)
    plt.close(fig)
    print(f"Saved: {out}")


def plot_minnan_radar(out: Path, fp: font_manager.FontProperties) -> None:
    n = len(LABELS)
    angles = np.linspace(np.pi / 2, np.pi / 2 + 2 * np.pi, n, endpoint=False)
    rmax = 10

    fig, ax = plt.subplots(figsize=(7, 6.5))
    ax.set_aspect("equal")
    ax.axis("off")
    lim = rmax + 2.2
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)

    _draw_banded_grid(ax, angles, rmax)
    _draw_series(ax, np.array(SCORES["闽南-基座"]), angles, DIALECT_COLORS["闽南-基座"],
                 label="基座 instruct", linewidth=1.8, alpha_fill=0.10, linestyle="--", marker_size=7)
    _draw_series(ax, np.array(SCORES["闽南-精调"]), angles, DIALECT_COLORS["闽南-精调"],
                 label="基座 + 精调 LLM", linewidth=2.4, alpha_fill=0.20, marker_size=9)

    for r in [2, 4, 6, 8, 10]:
        ax.text(0.15, r - 0.15, str(r), fontsize=7.5, color="#AAAAAA", ha="left", va="bottom")

    _draw_labels(ax, angles, fp, rmax)

    legend = ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.02), ncol=2,
                       frameon=False, fontsize=10, prop=fp)
    for text in legend.get_texts():
        text.set_color("#555555")

    fig.text(0.5, 0.97, "闽南话 TTS 多维度评估", ha="center", va="top", fontsize=16,
             fontweight="bold", color="#333333", fontproperties=fp)
    fig.text(0.5, 0.92, "基座 instruct 能力 + 小而精 LLM 微调", ha="center", va="top",
             fontsize=10, color="#888888", fontproperties=fp)

    plt.savefig(out, dpi=200, bbox_inches="tight", facecolor="white", pad_inches=0.35)
    plt.close(fig)
    print(f"Saved: {out}")


def main() -> None:
    root = Path(__file__).parent
    fp = _setup_font()

    plot_single_radar(
        SCORES["温州话"], DIALECT_COLORS["温州话"],
        "温州话 TTS 多维度评估", "常规方言语音合成 · 五维量化指标",
        root / "dialect_radar_wenzhou.png", fp,
    )
    plot_single_radar(
        SCORES["台州话"], DIALECT_COLORS["台州话"],
        "台州话 TTS 多维度评估", "常规方言语音合成 · 五维量化指标",
        root / "dialect_radar_taizhou.png", fp,
    )
    plot_minnan_radar(root / "dialect_radar_minnan_revised.png", fp)


if __name__ == "__main__":
    main()
