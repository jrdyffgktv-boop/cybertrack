"""把 XMUM_AI_Cybersecurity_Daily_Plan.xlsx 转换成 src/data/content/plan-import.ts。

用法（Windows，用 DSH 自带 Python，已装 openpyxl）：
  $env:PYTHONIOENCODING='utf-8'
  C:\\Users\\Lucas\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe scripts\\import_plan.py [xlsx 路径]

默认读仓库根目录的 XMUM_AI_Cybersecurity_Daily_Plan.xlsx。
表格结构（「每日学习任务」）：阶段/周次 | 日期范围 | 星期 | 学习主题 | 具体学习内容 | 学完后的尝试任务 | 建议用时 | 任务类型
「星期」可能是 周一 / Monday / 3月20日；「每天」表示整段日期都按同一行处理（考试周，不安排任务）。
"""

from __future__ import annotations

import datetime
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = ROOT / "XMUM_AI_Cybersecurity_Daily_Plan.xlsx"
OUT = ROOT / "src" / "data" / "content" / "plan-import.ts"

PLAN_START = datetime.date(2026, 11, 23)
PLAN_END = datetime.date(2027, 7, 23)

EN_WEEKDAY = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}
CN_WEEKDAY = {
    "周一": 0,
    "周二": 1,
    "周三": 2,
    "周四": 3,
    "周五": 4,
    "周六": 5,
    "周日": 6,
    "星期一": 0,
    "星期二": 1,
    "星期三": 2,
    "星期四": 3,
    "星期五": 4,
    "星期六": 5,
    "星期日": 6,
    "星期天": 6,
}

DOMAIN_RULES = [
    ("project", ("cyberguard", "项目", "github", "仓库")),
    ("ai", ("ai", "deepseek", "numpy", "pandas", "机器学习", "llm", "模型", "api")),
    ("security", ("linux", "网络", "安全", "ctf", "wireshark", "协议", "ip", "端口", "web", "钓鱼", "加密", "shell")),
    ("python", ("python", "函数", "循环", "变量", "字典", "列表", "类", "文件")),
]


def text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime.datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, datetime.date):
        return value.strftime("%Y-%m-%d")
    return str(value).strip()


def parse_range(value: str) -> tuple[datetime.date, datetime.date] | None:
    found = re.findall(r"(\d{4})-(\d{2})-(\d{2})", value)
    if len(found) < 2:
        return None
    start = datetime.date(*map(int, found[0]))
    end = datetime.date(*map(int, found[1]))
    return start, end


def resolve_date(start: datetime.date, weekday_text: str) -> datetime.date | None:
    w = weekday_text.strip()
    if w.lower() in EN_WEEKDAY:
        return start + datetime.timedelta(days=EN_WEEKDAY[w.lower()])
    if w in CN_WEEKDAY:
        return start + datetime.timedelta(days=CN_WEEKDAY[w])
    m = re.match(r"(\d{1,2})月(\d{1,2})日", w)
    if m:
        return datetime.date(start.year, int(m.group(1)), int(m.group(2)))
    return None


def parse_minutes(value: str) -> int:
    s = value.strip()
    if not s or s in ("0", "0分钟"):
        return 0
    total = 0
    m = re.search(r"(\d+(?:\.\d+)?)\s*(小时|h|hour)", s)
    if m:
        total += round(float(m.group(1)) * 60)
    m = re.search(r"(\d+)\s*(分钟|min)", s)
    if m:
        total += int(m.group(1))
    if total == 0:
        m = re.search(r"(\d+)", s)
        if m:
            total = int(m.group(1))
    return total


def guess_domain(theme: str, content: str, task: str) -> str:
    blob = f"{theme} {content} {task}".lower()
    if "复习" in theme or "考试" in theme:
        return "review"
    for domain, keys in DOMAIN_RULES:
        if any(k in blob for k in keys):
            return domain
    return "python"


def split_practice(value: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"[；;。]", value) if p.strip()]
    return parts[:4] if parts else ([value.strip()] if value.strip() else [])


def short_focus(content: str) -> str:
    head = re.split(r"[，,；;。]", content.strip())[0].strip()
    return head[:22] if head else content.strip()[:22]


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx.exists():
        raise SystemExit(f"找不到 {xlsx}")

    wb = load_workbook(xlsx, data_only=True)
    ws = wb["每日学习任务"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    days: dict[str, dict] = {}
    weeks: dict[str, dict] = {}
    too_long: list[str] = []

    for row in rows:
        stage, rng, weekday, theme, content, task, duration, kind = [
            text(v) for v in (row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7])
        ]
        if not theme and not content:
            continue
        range_dates = parse_range(rng)
        if not range_dates:
            continue
        start, end = range_dates
        minutes = parse_minutes(duration)
        entry_common = {
            "week": stage[:24],
            "weekTheme": theme,
            "phase": kind or "正常课外学习",
            "topic": content,
            "practice": split_practice(task),
            "deliverable": task or content,
            "domain": guess_domain(theme, content, task),
            "minutes": minutes,
        }

        if weekday == "每天" or not weekday:
            # 整段日期（考试周）：每天登记一次，不安排任务
            cursor = start
            while cursor <= end:
                key = cursor.isoformat()
                if PLAN_START <= cursor <= PLAN_END and key not in days:
                    days[key] = {**entry_common, "minutes": 0, "focus": short_focus(content), "note": "考试周：不安排课外任务"}
                cursor += datetime.timedelta(days=1)
            weeks.setdefault(stage[:24], {"week": stage[:24], "theme": theme, "phase": kind})
            continue

        date = resolve_date(start, weekday)
        if date is None:
            too_long.append(f"{stage} {rng} {weekday}")
            continue
        if not (PLAN_START <= date <= PLAN_END):
            continue
        key = date.isoformat()
        if key in days and minutes <= days[key]["minutes"]:
            # 同一日期被英文/中文星期重复登记时，保留用时更长的一条
            continue
        days[key] = {**entry_common, "focus": short_focus(content)}
        weeks.setdefault(stage[:24], {"week": stage[:24], "theme": theme, "phase": kind})

    # 计划期内没有出现在表里的日期（如 01-22、07-23）按休息处理
    cursor = PLAN_START
    while cursor <= PLAN_END:
        key = cursor.isoformat()
        if key not in days:
            days[key] = {
                "week": "",
                "weekTheme": "休息",
                "phase": "休息",
                "topic": "不安排课外任务",
                "practice": [],
                "deliverable": "",
                "domain": "review",
                "minutes": 0,
                "focus": "休息",
                "note": "计划表里这一天没有安排任务",
            }
        cursor += datetime.timedelta(days=1)

    lines = [
        "// 由 scripts/import_plan.py 生成，不要手改；改 xlsx 后重新运行脚本。",
        "import type { DateKey, Domain } from '../../domain/types'",
        "",
        "export interface ImportedDay {",
        "  week: string",
        "  weekTheme: string",
        "  phase: string",
        "  topic: string",
        "  focus: string",
        "  practice: string[]",
        "  deliverable: string",
        "  domain: Domain",
        "  minutes: number",
        "  note?: string",
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
    for key in sorted(days):
        payload = json.dumps(days[key], ensure_ascii=False, separators=(",", ":"))
        lines.append(f"  '{key}': {payload},")
    lines.append("}")
    lines.append("")
    lines.append("export const IMPORTED_WEEKS: ImportedWeek[] = [")
    for week in weeks.values():
        payload = json.dumps(week, ensure_ascii=False, separators=(",", ":"))
        lines.append(f"  {payload},")
    lines.append("]")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"days={len(days)} weeks={len(weeks)} -> {OUT}")
    if too_long:
        print("未识别的日期行:", too_long[:5])


if __name__ == "__main__":
    main()
