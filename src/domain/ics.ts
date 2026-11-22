// 导出 .ics 日历：iOS 的可靠提醒靠它（导入系统日历 → 真响铃）。
// 所有时间都写入 Asia/Kuala_Lumpur 时区，UID 由任务 id 派生，重复导入不会产生重复事件。

import type { DateKey, DayPlan, Settings } from './types'
import { addDays, minutesToTime, timeToMinutes } from './dates'

const TZID = 'Asia/Kuala_Lumpur'
const encoder = new TextEncoder()

export interface IcsEvent {
  uid: string
  date: DateKey
  start: string
  minutes: number
  summary: string
  description?: string
  alarmMinutes?: number | null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function dt(date: DateKey, time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${date.replace(/-/g, '')}T${pad2(h)}${pad2(m)}00`
}

function stamp(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** RFC 5545 折行：按 UTF-8 字节数折到 75 以内，续行以空格开头 */
function fold(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (bytes + size > 73) {
      parts.push(current)
      current = ' '
      bytes = 1
    }
    current += ch
    bytes += size
  }
  if (current) parts.push(current)
  return parts.join('\r\n')
}

export function buildIcs(events: IcsEvent[], calName = 'CyberTrack 学习计划'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CyberTrack//Study Planner//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
    'X-WR-TIMEZONE:Asia/Kuala_Lumpur',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Kuala_Lumpur',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:+08',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]

  for (const e of events) {
    const startMin = timeToMinutes(e.start)
    const endTotal = startMin + e.minutes
    const endDate = addDays(e.date, Math.floor(endTotal / 1440))
    const endTime = minutesToTime(endTotal % 1440)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp()}`,
      `DTSTART;TZID=${TZID}:${dt(e.date, e.start)}`,
      `DTEND;TZID=${TZID}:${dt(endDate, endTime)}`,
      `SUMMARY:${esc(e.summary)}`,
    )
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
    lines.push('LOCATION:CyberTrack')
    if (e.alarmMinutes != null && e.alarmMinutes > 0) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(e.summary)}`,
        `TRIGGER:-PT${Math.round(e.alarmMinutes)}M`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

function uidFor(taskId: string): string {
  return `${taskId.replace(/[^A-Za-z0-9._-]/g, '-')}@cybertrack`
}

export function eventsFromPlans(plans: DayPlan[], settings: Settings): IcsEvent[] {
  const out: IcsEvent[] = []
  for (const plan of plans) {
    for (const task of plan.tasks) {
      if (!task.start) continue
      const phaseLead =
        plan.phase === 'exam' && settings.examRemindersReduced ? 10 : settings.reminderLeadMin
      const lead = task.reminderOffsetMin ?? phaseLead
      out.push({
        uid: uidFor(task.id),
        date: plan.date,
        start: task.start,
        // 导入的计划没有建议时长（0 分钟），日历里给 30 分钟占位，别导出 0 长度事件
      minutes: task.minutes > 0 ? task.minutes : 30,
        summary: task.minutes > 0 ? `${task.title}（${task.minutes} 分钟）` : task.title,
        description: `${task.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n产出：${task.deliverable}`,
        alarmMinutes: settings.remindersEnabled ? lead : null,
      })
    }
  }
  return out
}

export function planIcs(plans: DayPlan[], settings: Settings, calName?: string): string {
  return buildIcs(eventsFromPlans(plans, settings), calName)
}

export function downloadTextFile(filename: string, text: string, mime = 'text/calendar;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
