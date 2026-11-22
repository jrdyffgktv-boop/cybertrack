import { describe, expect, it } from 'vitest'
import { createDefaultState } from '../data/defaults'
import {
  cumulativeMinutes,
  dailyMinutes,
  domainMinutes,
  monthDailyMinutes,
  streakDays,
  totalMinutes,
  weekSummary,
} from '../domain/progress'
import type { PersistedState } from '../domain/types'

function stateWithCompletions(): PersistedState {
  const state = createDefaultState()
  state.completions = {
    a: { minutes: 30, date: '2027-01-08', domain: 'python', at: '2027-01-08T22:00:00+08:00' },
    b: { minutes: 60, date: '2027-01-09', domain: 'course', at: '2027-01-09T22:00:00+08:00' },
    c: { minutes: 45, date: '2027-01-10', domain: 'ai', at: '2027-01-10T22:00:00+08:00' },
  }
  return state
}

describe('统计', () => {
  it('按日汇总', () => {
    const state = stateWithCompletions()
    const days = dailyMinutes('2027-01-08', '2027-01-10', state)
    expect(days.map((d) => d.minutes)).toEqual([30, 60, 45])
    expect(totalMinutes('2027-01-08', '2027-01-10', state)).toBe(135)
    expect(cumulativeMinutes('2027-01-10', state)).toBe(135)
  })

  it('按领域汇总', () => {
    const byDomain = domainMinutes('2027-01-08', '2027-01-10', stateWithCompletions())
    expect(byDomain.python).toBe(30)
    expect(byDomain.course).toBe(60)
    expect(byDomain.ai).toBe(45)
    expect(byDomain.security).toBe(0)
  })

  it('连续学习天数', () => {
    const state = stateWithCompletions()
    expect(streakDays('2027-01-10', state)).toBe(3)
    expect(streakDays('2027-01-11', state)).toBe(3)
    expect(streakDays('2027-01-12', state)).toBe(0)
  })

  it('周汇总与目标完成率', () => {
    const state = stateWithCompletions()
    const week = weekSummary('2027-01-10', state)
    expect(week.doneMinutes).toBe(135)
    expect(week.goalMinutes).toBe(state.settings.weeklyGoalHours * 60)
    expect(week.goalRate).toBeCloseTo(135 / (state.settings.weeklyGoalHours * 60), 5)
  })

  it('月视图按天返回', () => {
    const days = monthDailyMinutes('2027-01', stateWithCompletions())
    expect(days).toHaveLength(31)
    expect(days.find((d) => d.date === '2027-01-09')?.minutes).toBe(60)
  })

  it('锻炼不计入学习时长/连续天数，但算进领域投入', () => {
    const state = createDefaultState()
    state.completions = {
      x: { minutes: 60, date: '2026-11-23', domain: 'exercise', at: '2026-11-23T20:00:00+08:00' },
      y: { minutes: 30, date: '2026-11-23', domain: 'python', at: '2026-11-23T21:00:00+08:00' },
    }
    expect(dailyMinutes('2026-11-23', '2026-11-23', state)[0].minutes).toBe(30)
    expect(totalMinutes('2026-11-23', '2026-11-23', state)).toBe(30)
    expect(domainMinutes('2026-11-23', '2026-11-23', state).exercise).toBe(60)
    // 只有锻炼的那天不算学习日
    const onlyExercise = createDefaultState()
    onlyExercise.completions = { x: state.completions.x }
    expect(streakDays('2026-11-24', onlyExercise)).toBe(0)
  })
})