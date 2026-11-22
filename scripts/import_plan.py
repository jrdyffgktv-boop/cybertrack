# -*- coding: utf-8 -*-
"""把学习计划 xlsx（Daily Plan 工作表）转成 src/data/content/plan-import.ts。

用法（Windows，用 DSH 自带的 Python，它带 openpyxl）：
  $env:PYTHONIOENCODING='utf-8'
  C:\\Users\\Lucas\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe .\\scripts\\import_plan.py [xlsx 路径]

默认读取仓库根目录下最新的 XMUM_AI_Cybersecurity_Daily_Plan_*.xlsx。
转换规则：
  - 每天一条任务：标题「周主题 · 本日重点」，步骤 = 内容一行 + 学后实践拆句，完成标准取「今日交付：」后的文本
  - xlsx 没有时长列，minutes 记 0；真实时长由 App 里点「开始 / 结束」计时得到
  - 学期阶段里的「复习周 / 考试周」行按复盘任务处理
"""

from __future__ import annotations

import glob
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "content" / "plan-import.ts"

AI_WORDS = ("AI", "LLM", "机器学习", "模型", "DeepSeek", "提示词", "数据集", "向量")
PROJECT_WORDS = ("CyberGuard", "项目", "GitHub", "交付", "作品集")
PYTHON_WORDS = ("Python", "代码", "编程", "Git", "脚本", "库", "数据结构")
SECURITY_WORDS = ("Linux", "网络", "TCP", "HTTP", "DNS", "协议", "端口", "安全", "Wireshark", "CTF", "Web", "加密", "漏洞", "日志", "威胁", "钓鱼", "流量")


def cell_date(value: object) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text
    if re.fullmatch(r"\d{4}/\d{1,2}/\d{1,2}", text):
        y, m, d = text.split("/")
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    return None


def clean(text: object) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def split_steps(text: str) -> list[str]:
    parts = [p.strip(" 。；;") for p in re.split(r"[；;。]", text) if p.strip(" 。；;")]
    if len(parts) <= 1:
        parts = [p.strip(" 。；;") for p in re.split(r"[，,]", text) if p.strip(" 。；;")]
    merged: list[str] = []
    for part in parts:
        if merged and part[:1] in ("并", "再", "也", "且", "然后"):
            merged[-1] = f"{merged[-1]}，{part}"
        else:
            merged.append(part)
    return [p for p in merged if p][:4]


def take_after(text: str, marker: str) -> str:
    idx = text.find(marker)
    return text[idx + len(marker):].strip(" 。；;") if idx >= 0 else ""


def drop_after(text: str, marker: str) -> str:
    idx = text.find(marker)
    return text[:idx].strip(" 。；;") if idx >= 0 else text


def focus_of(content: str) -> str:
    return take_after(content, "本日重点：")


def topic_of(content: str) -> str:
    return drop_after(content, "；本日重点：").strip(" 。；;")


def match_domain(blob: str, order: tuple[tuple[str, tuple[str, ...]], ...]) -> str | None:
    for name, words in order:
        if any(w in blob for w in words):
            return name
    return None


def guess_domain(phase: str, week_theme: str, topic: str) -> str:
    if phase in ("复习周", "考试周"):
        return "review"
    # 先看周主题（它最能代表这一周的重点），再看当天的具体内容
    for blob in (week_theme, f"{week_theme} {topic}", topic):
        hit = match_domain(
            blob,
            (
                ("project", PROJECT_WORDS),
                ("ai", AI_WORDS),
                ("python", tuple(w for w in PYTHON_WORDS if w != "Git")),
                ("security", SECURITY_WORDS),
                ("python", PYTHON_WORDS),
            ),
        )
        if hit:
            return hit
    return "security"


def find_xlsx() -> Path:
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    candidates = sorted(glob.glob(str(ROOT / "XMUM_AI_Cybersecurity_Daily_Plan_*.xlsx")))
    if not candidates:
        candidates = sorted(glob.glob(str(ROOT / "*.xlsx")))
    if not candidates:
        raise SystemExit("找不到 xlsx，请把文件放到项目根目录或作为参数传入")
    return Path(candidates[-1])


def main() -> None:
    path = find_xlsx()
    wb = load_workbook(path, data_only=True)
    ws = wb["Daily Plan"]

    header_row = None
    headers: list[str] = []
    for row in ws.iter_rows(min_row=1, max_row=12, values_only=True):
        cells = [clean(c) for c in row]
        if "日期" in cells and "课外学习内容" in cells:
            header_row = ws.iter_rows(min_row=1, max_row=12).__next__  # placeholder
            headers = cells
            break
    if not headers:
        raise SystemExit("表头没找到")

    rows = []
    for row in ws.iter_rows(min_row=1, values_only=True):
        raw = list(row)
        cells = [clean(c) for c in raw]
        if not cells or cells[0] == "日期":
            continue
        key = cell_date(raw[0])
        if not key:
            continue
        record = dict(zip(headers, cells))
        record["__date__"] = key
        rows.append(record)

    days: dict[str, dict[str, object]] = {}
    weeks: dict[str, dict[str, str]] = {}
    for record in rows:
        key = str(record["__date__"])
        if not key:
            continue
        content = clean(record.get("课外学习内容"))
        practice_text = clean(record.get("学后实践任务"))
        phase = clean(record.get("学期阶段")) or "授课阶段"
        week_theme = clean(record.get("周主题")) or "学习计划"
        week = clean(record.get("周次")) or ""
        unit = clean(record.get("主题单元")) or ""

        topic = topic_of(content)
        focus = focus_of(content)
        if not focus:
            focus = {"复习周": "轻量复盘", "考试周": "轻量保持"}.get(phase, "当日任务")

        deliverable = take_after(practice_text, "今日交付：") or take_after(practice_text, "今日交付:") 
        practice_body = drop_after(drop_after(practice_text, "今日交付："), "今日交付:")
        practice_body = drop_after(practice_body, "与本周成果对照：") if "今日交付" not in practice_text else practice_body
        steps = split_steps(practice_body) or split_steps(practice_text)
        if not deliverable:
            deliverable = {
                "复习周": "记录今天复盘的一个发现",
                "考试周": "考试优先：有余力再做一个轻量动作",
            }.get(phase, "完成今天的练习，并把结果记到项目笔记")

        days[key] = {
            "week": week,
            "unit": unit,
            "weekTheme": week_theme,
            "phase": phase,
            "topic": topic,
            "focus": focus,
            "practice": steps,
            "deliverable": deliverable,
            "domain": guess_domain(phase, week_theme, topic),
        }
        weeks.setdefault(week, {"week": week, "theme": week_theme, "phase": phase})

    ordered = dict(sorted(days.items()))
    missing = []
    for start, end in (("2026-11-23", "2027-07-23"),):
        cursor = date.fromisoformat(start)
        last = date.fromisoformat(end)
        while cursor <= last:
            if cursor.isoformat() not in ordered:
                missing.append(cursor.isoformat())
            cursor = date.fromordinal(cursor.toordinal() + 1)

    lines = [
        "// 由 scripts/import_plan.py 生成，不要手改；改 xlsx 后重新运行脚本。",
        "import type { DateKey, Domain } from '../../domain/types'",
        "",
        "export interface ImportedDay {",
        "  week: string",
        "  unit: string",
        "  weekTheme: string",
        "  phase: string",
        "  topic: string",
        "  focus: string",
        "  practice: string[]",
        "  deliverable: string",
        "  domain: Domain",
        "}",
        "",
        "export interface ImportedWeek {",
        "  week: string",
        "  theme: string",
        "  phase: string",
        "}",
        "",
        "export const IMPORTED_DAYS: Record<DateKey, ImportedDay> = {",
    ]
    for key, value in ordered.items():
        lines.append(f"  '{key}': {json.dumps(value, ensure_ascii=False)},")
    lines += ["}", "", "export const IMPORTED_WEEKS: ImportedWeek[] = ["]
    for value in weeks.values():
        lines.append(f"  {json.dumps(value, ensure_ascii=False)},")
    lines += ["]", ""]
    OUT.write_text("\n".join(lines), encoding="utf-8")

    print(f"source={path.name}")
    print(f"days={len(ordered)} weeks={len(weeks)} missing={len(missing)} -> {OUT}")
    if missing:
        print("缺日：", ", ".join(missing[:10]))


if __name__ == "__main__":
    main()
