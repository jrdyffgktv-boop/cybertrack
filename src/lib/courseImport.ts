// 课表解析：把教务系统导出的 HTML 表格，或用户粘贴的文本，转成课程时间槽。
// 不依赖 DOM（浏览器与 node 测试共用），只用正则扫描。

import type { Weekday } from '../domain/types'

export interface ParsedSlot {
  code: string
  title: string
  weekday: Weekday
  start: string
  end: string
  location?: string
}

const WEEKDAY_WORDS: Array<{ re: RegExp; weekday: Weekday }> = [
  { re: /\b(?:mon|monday)\b/i, weekday: 1 },
  { re: /\b(?:tue|tues|tuesday)\b/i, weekday: 2 },
  { re: /\b(?:wed|wednesday)\b/i, weekday: 3 },
  { re: /\b(?:thu|thur|thurs|thursday)\b/i, weekday: 4 },
  { re: /\b(?:fri|friday)\b/i, weekday: 5 },
  { re: /\b(?:sat|saturday)\b/i, weekday: 6 },
  { re: /\b(?:sun|sunday)\b/i, weekday: 7 },
]

const CN_WEEKDAYS: Array<{ re: RegExp; weekday: Weekday }> = [
  { re: /(?:周|星期)一/, weekday: 1 },
  { re: /(?:周|星期)二/, weekday: 2 },
  { re: /(?:周|星期)三/, weekday: 3 },
  { re: /(?:周|星期)四/, weekday: 4 },
  { re: /(?:周|星期)五/, weekday: 5 },
  { re: /(?:周|星期)六/, weekday: 6 },
  { re: /(?:周|星期)[日天]/, weekday: 7 },
]

const WEEKDAY_TOKEN = /(?:周|星期)[一二三四五六日天]|\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b/gi

export function weekdayFromText(text: string): Weekday | undefined {
  for (const item of CN_WEEKDAYS) if (item.re.test(text)) return item.weekday
  for (const item of WEEKDAY_WORDS) if (item.re.test(text)) return item.weekday
  return undefined
}

/** 一行里有多个星期词时，取最靠近时间点的那个（"Tue 14:00-16:00, Thu 14:00-16:00"） */
function weekdayBefore(text: string): Weekday | undefined {
  const tokens = [...text.matchAll(WEEKDAY_TOKEN)]
  if (!tokens.length) return undefined
  return weekdayFromText(tokens[tokens.length - 1][0])
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toClock(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

function addMinutes(clock: string, minutes: number): string {
  const [h, m] = clock.split(':').map(Number)
  const total = h * 60 + m + minutes
  return toClock(Math.floor((total % 1440) / 60), total % 60)
}

interface ClockPart {
  hour: number
  minute: number
  meridiem?: string
}

/** 解析 "8.00am-9.00am" / "08:30-10:30" / "9:00 AM - 11:00 AM" */
export function parseTimeRange(text: string): { start: string; end: string; minutes: number } | undefined {
  const re =
    /(\d{1,2})\s*[.:：]\s*(\d{2})\s*(am|pm)?\s*[-–—~至到]\s*(\d{1,2})\s*[.:：]\s*(\d{2})\s*(am|pm)?/i
  const m = text.match(re)
  if (!m) return undefined
  const a: ClockPart = { hour: Number(m[1]), minute: Number(m[2]), meridiem: m[3]?.toLowerCase() }
  const b: ClockPart = { hour: Number(m[4]), minute: Number(m[5]), meridiem: m[6]?.toLowerCase() }

  function hourOf(part: ClockPart, other: ClockPart): number {
    const meridiem = part.meridiem ?? other.meridiem
    let hour = part.hour
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    return hour
  }

  const startHour = hourOf(a, b)
  const endHour = hourOf(b, a)
  const start = toClock(startHour, a.minute)
  let minutes = endHour * 60 + b.minute - (startHour * 60 + a.minute)
  if (minutes <= 0) minutes += 12 * 60
  return { start, end: addMinutes(start, minutes), minutes }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
}

function cellLines(cellHtml: string): string[] {
  return decodeEntities(cellHtml.replace(/<br\s*\/?>/gi, '\n'))
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const CODE_RE = /^[A-Z]{2,4}\s?\d{3,4}[A-Z]?$/i
const LOCATION_RE = /[A-Z]{1,3}\d{0,2}#[A-Za-z0-9]+/

function parseCourseCell(lines: string[]): { code: string; title: string; location?: string } | undefined {
  const codeLine = lines.find((line) => CODE_RE.test(line.replace(/\s/g, '')))
  if (!codeLine) return undefined
  const code = codeLine.replace(/\s/g, '').toUpperCase()
  const rest = lines.filter((line) => line !== codeLine)
  const locationLine = rest.find((line) => LOCATION_RE.test(line))
  const labelLines = rest.filter((line) => /[A-Za-z\u4e00-\u9fa5]/.test(line))
  const title = labelLines.find((line) => line !== locationLine) ?? code
  const location = locationLine ? (locationLine.match(LOCATION_RE)?.[0] ?? undefined) : undefined
  return { code, title, location }
}

interface RawCell {
  attrs: string
  html: string
}

function cellsOf(rowHtml: string): RawCell[] {
  const out: RawCell[] = []
  const re = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(rowHtml))) out.push({ attrs: m[2] ?? '', html: m[3] ?? '' })
  return out
}

function spanOf(attrs: string, name: 'rowspan' | 'colspan'): number {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']?(\\d+)`, 'i'))
  const n = m ? Number(m[1]) : 1
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 1
}

const HEADER_WORDS = /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i

function sortSlots(slots: ParsedSlot[]): ParsedSlot[] {
  return slots.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
}

/** 解析教务系统导出的 HTML 课表（时间在首列，后面 7 列是周一到周日，单元格可 rowspan 合并） */
export function parseTimetableHtml(html: string): ParsedSlot[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])
  const out: ParsedSlot[] = []
  const seen = new Set<string>()
  let weekdayOrder: Weekday[] | undefined

  // 先按时间列解析每一行的时间范围，处理 rowspan 时需要知道「合并到哪一行结束」
  const rowRanges: Array<{ start: string; end: string; minutes: number } | undefined> = []
  const rowCells: RawCell[][] = []
  for (const row of rows) {
    const cells = cellsOf(row)
    rowCells.push(cells)
    rowRanges.push(cells.length ? parseTimeRange(cellLines(cells[0].html).join(' ')) : undefined)
  }

  // 模拟表格网格：被上一行 rowspan 占住的列要跳过，否则后面的单元格会整体左移一列
  // （这正是「周三的课跑到周二」的原因）
  const spanRemaining: number[] = []

  for (let r = 0; r < rowCells.length; r++) {
    const cells = rowCells[r]
    if (cells.length < 2) continue
    const range = rowRanges[r]
    if (!range) continue

    if (!weekdayOrder) {
      const headerText = cells.map((c) => cellLines(c.html).join(' ')).join(' ')
      if (HEADER_WORDS.test(headerText)) {
        weekdayOrder = cells
          .slice(1)
          .map((c) => weekdayFromText(cellLines(c.html).join(' ')))
          .filter((d): d is Weekday => d !== undefined)
        continue
      }
    }
    const order = weekdayOrder ?? ([1, 2, 3, 4, 5, 6, 7] as Weekday[])

    let cellIndex = 0
    let col = 0
    while (col < 1 + order.length) {
      if ((spanRemaining[col] ?? 0) > 0) {
        spanRemaining[col] -= 1
        col += 1
        continue
      }

      const cell = cells[cellIndex]
      if (!cell) {
        col += 1
        continue
      }
      cellIndex += 1

      const rowspan = spanOf(cell.attrs, 'rowspan')
      const colspan = spanOf(cell.attrs, 'colspan')
      if (rowspan > 1) spanRemaining[col] = rowspan - 1

      if (col > 0) {
        const lines = cellLines(cell.html)
        const parsed = lines.length ? parseCourseCell(lines) : undefined
        const weekday = order[col - 1]
        if (parsed && weekday) {
          const start = range.start
          const endRow = Math.min(r + rowspan - 1, rowRanges.length - 1)
          const end = rowRanges[endRow]?.end ?? range.end
          const key = `${weekday}-${parsed.code}-${start}-${end}`
          if (!seen.has(key)) {
            seen.add(key)
            out.push({ ...parsed, weekday, start, end })
          }
        }
      }

      col += colspan
    }
  }

  return sortSlots(out)
}

/** 解析粘贴的文本：每行「课程码 课程名 周一 08:30-10:30 A5#G07」，支持一行多个时段 */
export function parseTimetableText(text: string): ParsedSlot[] {
  const out: ParsedSlot[] = []
  const seen = new Set<string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const tokens = line.split(/\s+/)
    const codeToken = tokens.find((t) => CODE_RE.test(t))
    if (!codeToken) continue
    const code = codeToken.replace(/\s/g, '').toUpperCase()
    const location = line.match(LOCATION_RE)?.[0]

    const timeRe =
      /(\d{1,2})\s*[.:：]\s*(\d{2})\s*(am|pm)?\s*[-–—~至到]\s*(\d{1,2})\s*[.:：]\s*(\d{2})\s*(am|pm)?/gi
    const hits: Array<{ index: number; raw: string }> = []
    let m: RegExpExecArray | null
    while ((m = timeRe.exec(line))) hits.push({ index: m.index, raw: m[0] })
    if (!hits.length) continue

    const titlePart = line
      .slice(0, hits[0].index)
      .replace(codeToken, ' ')
      .replace(WEEKDAY_TOKEN, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const title = titlePart || code

    for (const hit of hits) {
      const before = line.slice(0, hit.index)
      const after = line.slice(hit.index + hit.raw.length)
      const range = parseTimeRange(hit.raw)
      if (!range) continue
      const weekday = weekdayBefore(before) ?? weekdayFromText(after.slice(0, 12))
      if (!weekday) continue
      const key = `${weekday}-${code}-${range.start}-${range.end}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ code, title, weekday, start: range.start, end: range.end, location })
    }
  }

  return sortSlots(out)
}
