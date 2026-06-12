#!/usr/bin/env python3
"""Applies the Volt design language (warm paper, electric blue, square corners)
to all site pages. Idempotent. Run from repo root: python3 build-restyle.py"""
import re, glob, os

PAGES = (
    ["docs.html", "compare.html", "demo/exam.html"]
    + sorted(glob.glob("*-alternative.html"))
)

# ── 1. palette: zinc/white → Volt warm paper ────────────────────────────────
COLORS = {
    "--bg: #ffffff": "--bg: #f4f3ee",
    "--fg: #09090b": "--fg: #0a0a0a",
    "--muted: #52525b": "--muted: #6b6b66",
    "--muted-2: #71717a": "--muted-2: #8a877e",
    "--border: #e4e4e7": "--border: #cfcdc4",
    "--panel: #ffffff": "--panel: #fbfaf6",
    "--hover: #fafafa": "--hover: #ebe9e1",
    "--focus: #09090b": "--focus: #2540ff",
    # header glass
    "rgba(255, 255, 255, 0.85)": "rgba(244, 243, 238, 0.9)",
    "rgba(255,255,255,0.85)": "rgba(244, 243, 238, 0.9)",
    # hero radial
    "rgba(0, 0, 0, 0.06)": "rgba(37, 64, 255, 0.07)",
    "rgba(0,0,0,0.06)": "rgba(37, 64, 255, 0.07)",
    # card hover border
    "border-color: #d4d4d8": "border-color: #2540ff",
    # primary button hover
    "background: #18181b": "background: #2540ff",
    "border-color: #18181b": "border-color: #2540ff",
    # dark snippet panel → volt dark
    "background: #0f172a": "background: #0c0d0e",
    "#7dd3fc": "#8fa3ff",
    "#a5b4fc": "#c8d0ff",
    "#64748b": "#76776f",
    "#e2e8f0": "#f4f3ee",
    "#94a3b8": "#8a877e",
    # demo status colors → blueprint mint / signal
    "--green: #16a34a": "--green: #0e8f66",
    "--green-bg: #f0fdf4": "--green-bg: #e2f4ec",
    "--amber: #d97706": "--amber: #b97309",
    "--amber-bg: #fffbeb": "--amber-bg: #f4ecd8",
    "--red: #dc2626": "--red: #e04a12",
    "--red-bg: #fef2f2": "--red-bg: #f9e4da",
    "rgba(18,183,106,0.55)": "rgba(14,143,102,0.6)",
    "rgba(247,184,75,0.6)": "rgba(185,115,9,0.6)",
    "rgba(240,68,56,0.65)": "rgba(224,74,18,0.65)",
}

FONT_SANS_OLD = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"'
FONT_SANS_NEW = '"Inter", "Inter Tight", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif'
FONT_MONO_OLD = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
FONT_MONO_NEW = '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace'

# ── 2. BMC restyle (amber → volt: square, paper, ink border, blue marker) ───
BMC_RULES = {
    # inline .bmc pill used on docs/compare/alt/demo pages
    "border: 1px solid #fde68a; background: #fffbeb; color: #92400e;":
        "border: 1px solid var(--fg); background: transparent; color: var(--fg);",
    "border: 1px solid #fde68a; background: #fffbeb; color: #92400e":
        "border: 1px solid var(--fg); background: transparent; color: var(--fg)",
    ".bmc:hover { background: #fef3c7; }":
        ".bmc:hover { background: var(--fg); color: var(--bg); }",
}

def patch(src: str) -> str:
    for old, new in COLORS.items():
        src = src.replace(old, new)
    for old, new in BMC_RULES.items():
        src = src.replace(old, new)
    src = src.replace(FONT_SANS_OLD, FONT_SANS_NEW)
    src = src.replace(FONT_MONO_OLD, FONT_MONO_NEW)
    src = src.replace("ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace", FONT_MONO_NEW)
    src = src.replace("ui-monospace, Menlo, Consolas, monospace", FONT_MONO_NEW)
    src = src.replace("ui-monospace, monospace", FONT_MONO_NEW)
    # square corners everywhere (CSS only; keep SVG attrs alone)
    src = re.sub(r"border-radius:\s*[^;}{]+;", "border-radius: 0;", src)
    # coffee emoji label → mono token
    src = src.replace("☕ Support this project", "[ ☕ support this project ]")
    src = src.replace("☕ Buy me a coffee", "[ ☕ buy me a coffee ]")
    # external links open in new tabs
    def ext(m):
        tag = m.group(0)
        if 'target=' in tag:
            return tag
        return tag[:-1].rstrip() + ' target="_blank" rel="noopener">'
    src = re.sub(r'<a\b[^>]*href="https?://[^"]*"[^>]*>', ext, src)
    return src

for page in PAGES:
    if not os.path.exists(page):
        print("skip (missing):", page)
        continue
    s = open(page, encoding="utf-8").read()
    out = patch(s)
    open(page, "w", encoding="utf-8").write(out)
    print("restyled:", page)
print("done")
