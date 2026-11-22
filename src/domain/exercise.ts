// 运动统计：全部从 exerciseLogs 算，和学习时长完全分开。

import type { DateKey, ExerciseLog, PersistedState } from './types'
import { addDays, dateRange } from './dates'
import { sportById } from '../data/content/sports'

/** 消耗（千卡）= MET × 体重(kg) × 小时 */
export function caloriesOf(sportId: string, minutes: number, weightKg: number): number {
  const sport = sportById(sportId)
  if (!sport || minutes <= 0) return 0
  return Math.round(sport.met * Math.max(30, weightKg) * (minutes / 60))
}

export function logsBetween(start: DateKey, end: DateKey, state: PersistedState): ExerciseLog[] {
  return state.exerciseLogs.filter((log) => log.date >= start && log.date <= end)
}

export function exerciseMinutes(start: DateKey, end: DateKey, state: PersistedState): number {
  return logsBetween(start, end, state).reduce((sum, log) => sum + log.minutes, 0)
}

export function exerciseDistance(start: DateKey, end: DateKey, state: PersistedState): number {
  return Math.round(logsBetween(start, end, state).reduce((sum, log) => sum + (log.distanceKm ?? 0), 0) * 10) / 10
}

export function exerciseKcal(start: DateKey, end: DateKey, state: PersistedState): number {
  const weight = state.settings.weightKg
  return logsBetween(start, end, state).reduce((sum, log) => sum + caloriesOf(log.sportId, log.minutes, weight), 0)
}

export function dailyExercise(start: DateKey, end: DateKey, state: PersistedState): Array<{ date: DateKey; minutes: number }> {
  const map = new Map<DateKey, number>()
  for (const log of state.exerciseLogs) {
    if (log.date >= start && log.date <= end) map.set(log.date, (map.get(log.date) ?? 0) + log.minutes)
  }
  return dateRange(start, end).map((date) => ({ date, minutes: map.get(date) ?? 0 }))
}

export interface SportTotal {
  sportId: string
  minutes: number
  kcal: number
  distanceKm: number
  sessions: number
}

export function sportTotals(start: DateKey, end: DateKey, state: PersistedState): SportTotal[] {
  const weight = state.settings.weightKg
  const out = new Map<string, SportTotal>()
  for (const log of logsBetween(start, end, state)) {
    const item = out.get(log.sportId) ?? { sportId: log.sportId, minutes: 0, kcal: 0, distanceKm: 0, sessions: 0 }
    item.minutes += log.minutes
    item.distanceKm = Math.round((item.distanceKm + (log.distanceKm ?? 0)) * 10) / 10
    item.kcal += caloriesOf(log.sportId, log.minutes, weight)
    item.sessions += 1
    out.set(log.sportId, item)
  }
  return [...out.values()].sort((a, b) => b.minutes - a.minutes)
}

/** 连续运动天数：今天还没动就从昨天开始算，和学习连续天数互不影响 */
export function exerciseStreak(today: DateKey, state: PersistedState, limit = 3650): number {
  const days = new Set<DateKey>()
  for (const log of state.exerciseLogs) if (log.minutes > 0) days.add(log.date)
  let cursor = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(cursor) && streak < limit) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}
