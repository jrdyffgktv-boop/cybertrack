// 进度、统计与连续天数：全部从「完成记录 + 课时游标」计算，不额外存冗余数据。

import type { DateKey, DayPlan, Domain, PersistedState, Stage } from './types'
import { addDays, dateRange, diffDays, endOfWeek, startOfMonth, startOfWeek } from './dates'
import { generateDay } from './generator'
import { ALL_LESSONS } from '../data/content'
import { SUMMER_START } from '../data/content/calendar'

// 运动不再算进学习领域（独立运动页统计），这里只列学习相关领域
export const DOMAINS: Domain[] = ['course', 'python', 'ai', 'security', 'project', 'review']

/** 锻炼单独算，不算学习时长/连续学习天数 */
export const EXERCISE_DOMAIN: Domain = 'exercise'

export type DomainTotals = Record<Domain, number>

export function emptyDomainTotals(): DomainTotals {
  return { course: 0, python: 0, ai: 0, security: 0, project: 0, review: 0, exercise: 0 }
}

export interface StageStat {
  stage: Stage
  total: number
  done: number
  percent: number
}

export function stageStats(state: PersistedState): StageStat[] {
  return ([1, 2, 3, 4] as Stage[]).map((stage) => {
    const list = ALL_LESSONS.filter((l) => l.stage === stage)
    const done = list.filter((l) => !!state.lessonDone[l.id]).length
    return { stage, total: list.length, done, percent: list.length ? Math.round((done / list.length) * 100) : 0 }
  })
}

/** 当前阶段 = 第一个还没学完的阶段 */
export function currentStage(state: PersistedState): Stage {
  const next = stageStats(state).find((s) => s.done < s.total)
  return next?.stage ?? 4
}

export function daysToSummer(today: DateKey): number {
  return Math.max(0, diffDays(today, SUMMER_START))
}

export function dayProgress(plan: DayPlan): number {
  if (plan.plannedMinutes <= 0) {
    // 导入的计划没有建议时长，进度按「完成项数 / 总项数」算
    const total = plan.tasks.length
    const done = plan.tasks.filter((t) => t.done).length
    return total > 0 ? done / total : 0
  }
  return Math.min(1, plan.doneMinutes / plan.plannedMinutes)
}

export function completedCount(plan: DayPlan): number {
  return plan.tasks.filter((t) => t.done).length
}

export function dailyMinutes(start: DateKey, end: DateKey, state: PersistedState): Array<{ date: DateKey; minutes: number }> {
  const map = new Map<DateKey, number>()
  for (const c of Object.values(state.completions)) {
    if (c.domain === EXERCISE_DOMAIN) continue
    map.set(c.date, (map.get(c.date) ?? 0) + c.minutes)
  }
  return dateRange(start, end).map((date) => ({ date, minutes: map.get(date) ?? 0 }))
}

export function totalMinutes(start: DateKey, end: DateKey, state: PersistedState): number {
  let sum = 0
  for (const c of Object.values(state.completions)) {
    if (c.date >= start && c.date <= end && c.domain !== EXERCISE_DOMAIN) sum += c.minutes
  }
  return sum
}

export function domainMinutes(start: DateKey, end: DateKey, state: PersistedState): DomainTotals {
  const out = emptyDomainTotals()
  for (const c of Object.values(state.completions)) {
    if (c.date >= start && c.date <= end) out[c.domain] += c.minutes
  }
  return out
}

export function weekPlans(today: DateKey, state: PersistedState): DayPlan[] {
  const start = startOfWeek(today)
  return dateRange(start, addDays(start, 6)).map((d) => generateDay(d, state))
}

export interface WeekSummary {
  start: DateKey
  end: DateKey
  plannedMinutes: number
  doneMinutes: number
  goalMinutes: number
  goalRate: number
  byDomain: DomainTotals
  plans: DayPlan[]
}

export function weekSummary(today: DateKey, state: PersistedState): WeekSummary {
  const start = startOfWeek(today)
  const end = endOfWeek(today)
  const plans = dateRange(start, end).map((d) => generateDay(d, state))
  const plannedMinutes = plans.reduce((s, p) => s + p.plannedMinutes, 0)
  const doneMinutes = totalMinutes(start, end, state)
  const goalMinutes = Math.max(1, Math.round(state.settings.weeklyGoalHours * 60))
  return {
    start,
    end,
    plannedMinutes,
    doneMinutes,
    goalMinutes,
    goalRate: Math.min(1, doneMinutes / goalMinutes),
    byDomain: domainMinutes(start, end, state),
    plans,
  }
}

/** 连续学习天数：今天还没学则从昨天开始算，不把“今天尚未开始”当成断档 */
export function streakDays(today: DateKey, state: PersistedState): number {
  const dates = new Set<DateKey>()
  for (const c of Object.values(state.completions)) {
    if (c.minutes > 0 && c.domain !== EXERCISE_DOMAIN) dates.add(c.date)
  }
  let cursor = dates.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (dates.has(cursor) && streak < 3650) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function monthDailyMinutes(monthStart: DateKey, state: PersistedState): Array<{ date: DateKey; minutes: number }> {
  const [y, m] = monthStart.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const start = `${monthStart.slice(0, 7)}-01`
  const end = `${monthStart.slice(0, 7)}-${String(last).padStart(2, '0')}`
  return dailyMinutes(start, end, state)
}

/** 本周剩余的学习分钟数，用于首页提示 */
export function weekRemaining(today: DateKey, state: PersistedState): number {
  const s = weekSummary(today, state)
  return Math.max(0, s.goalMinutes - s.doneMinutes)
}

/** 到今天为止，计划期内累计学习分钟 */
export function cumulativeMinutes(today: DateKey, state: PersistedState): number {
  return totalMinutes('2026-11-23', today, state)
}

/** 下一天有课/有任务的日子，用于「下一节课」提示 */
export function nextStudyDate(today: DateKey, state: PersistedState, limit = 30): DateKey | undefined {
  for (let i = 1; i <= limit; i++) {
    const d = addDays(today, i)
    const plan = generateDay(d, state)
    if (plan.tasks.length > 0) return d
  }
  return undefined
}

export { startOfMonth }
