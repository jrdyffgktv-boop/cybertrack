// 手动任务的时间冲突校验：新增/修改任务前先查，避免和课程或已有任务重叠。

import type { DateKey, PersistedState, Task } from './types'
import { addDays, isoWeekday, minutesToTime, rangesOverlap, timeToMinutes } from './dates'
import { generateDay } from './generator'
import { slotsForDate } from './phases'

export interface Conflict {
  kind: 'course' | 'task'
  label: string
  start: string
  end: string
}

export function findConflicts(
  date: DateKey,
  start: string,
  minutes: number,
  state: PersistedState,
  excludeTaskId?: string,
): Conflict[] {
  const s = timeToMinutes(start)
  const e = s + minutes
  const out: Conflict[] = []

  for (const slot of slotsForDate(date, state.calendar)) {
    if (rangesOverlap(s, e, timeToMinutes(slot.start), timeToMinutes(slot.end))) {
      out.push({ kind: 'course', label: `${slot.code} 上课`, start: slot.start, end: slot.end })
    }
  }

  for (const task of generateDay(date, state).tasks) {
    if (task.id === excludeTaskId || !task.start) continue
    const ts = timeToMinutes(task.start)
    if (rangesOverlap(s, e, ts, ts + task.minutes)) {
      out.push({ kind: 'task', label: task.title, start: task.start, end: minutesToTime(ts + task.minutes) })
    }
  }
  return out
}

/** 在该日已有安排之后找一个空档；找不到就返回学习窗口起点 */
export function suggestStart(date: DateKey, state: PersistedState): string {
  const plan = generateDay(date, state)
  const win = state.settings.studyWindows[isoWeekday(date)] ?? { start: state.settings.dailyStartTime, maxMinutes: 180 }
  if (plan.tasks.length === 0) return win.start
  const last = plan.tasks
    .filter((t) => t.start)
    .map((t) => timeToMinutes(t.start as string) + t.minutes)
    .sort((a, b) => b - a)[0]
  if (last == null) return win.start
  const next = last + 10
  return next <= 23 * 60 ? minutesToTime(next) : win.start
}

/** 把任务限制在合理范围：5–240 分钟 */
export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 30
  return Math.max(5, Math.min(240, Math.round(minutes)))
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** 新建任务的默认内容，避免出现空任务 */
export function emptyTaskDraft(date: DateKey, state: PersistedState): Task {
  return {
    id: `m:${date}:${Date.now().toString(36)}`,
    date,
    domain: 'python',
    title: '',
    steps: [],
    deliverable: '',
    minutes: 30,
    start: suggestStart(date, state),
    source: 'manual',
    done: false,
  }
}

/** 自动任务被改成手动任务时，用 replaces 记住原 id，生成时不会再出现 */
export function overrideIdFor(date: DateKey, autoId: string): string {
  return `o:${date}:${autoId.replace(/:/g, '-')}`
}

/** 计划期最后一天的次日（导出「整段计划」时的边界） */
export function planEndExclusive(end: DateKey): DateKey {
  return addDays(end, 1)
}
