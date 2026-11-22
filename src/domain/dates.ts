// 日期工具：所有日期都是“日历日期”，与设备时区解耦。
// 关键规则：读取“今天”必须走 Asia/Kuala_Lumpur，绝不使用 toISOString() 取本地日期。

import type { DateKey, Weekday } from './types'

export const TZ = 'Asia/Kuala_Lumpur'
export const DAY_MS = 86_400_000

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 当前时刻在马来西亚的日历日期 */
export function todayKey(now: Date = new Date()): DateKey {
  return keyFormatter.format(now)
}

/** 解析为 UTC 零点的毫秒时间戳（仅用于日期算术，不代表真实时区） */
export function keyToUtc(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function utcToKey(ms: number): DateKey {
  return new Date(ms).toISOString().slice(0, 10)
}

export function isValidKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(keyToUtc(key))
}

export function addDays(key: DateKey, n: number): DateKey {
  return utcToKey(keyToUtc(key) + n * DAY_MS)
}

/** 含首尾的日期序列 */
export function dateRange(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = []
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k)
  if (out.length === 0) return []
  if (out[out.length - 1] !== end) out.push(end)
  return out
}

export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS)
}

export function isoWeekday(key: DateKey): Weekday {
  const w = new Date(keyToUtc(key)).getUTCDay()
  return (w === 0 ? 7 : w) as Weekday
}

export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, 1 - isoWeekday(key))
}

export function endOfWeek(key: DateKey): DateKey {
  return addDays(startOfWeek(key), 6)
}

export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`
}

export function endOfMonth(key: DateKey): DateKey {
  const [y, m] = key.split('-').map(Number)
  return utcToKey(Date.UTC(y, m, 0))
}

export function addMonths(key: DateKey, n: number): DateKey {
  const [y, m] = key.split('-').map(Number)
  const d = Number(key.slice(8, 10))
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** 6 行 × 7 列（周一起始）的月视图矩阵 */
export function monthMatrix(key: DateKey): DateKey[][] {
  const first = startOfMonth(key)
  const gridStart = startOfWeek(first)
  const rows: DateKey[][] = []
  for (let r = 0; r < 6; r++) {
    const row: DateKey[] = []
    for (let c = 0; c < 7; c++) row.push(addDays(gridStart, r * 7 + c))
    rows.push(row)
  }
  return rows
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const
export const WEEKDAY_FULL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

export function weekdayLabel(key: DateKey): string {
  return WEEKDAY_FULL[isoWeekday(key) - 1]
}

/** '11/23 周一' */
export function formatShort(key: DateKey): string {
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))} ${weekdayLabel(key)}`
}

/** '2026年11月23日 周一' */
export function formatCn(key: DateKey): string {
  return `${key.slice(0, 4)}年${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日 ${weekdayLabel(key)}`
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(total)))
  const h = Math.floor(clamped / 60) % 24
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}
