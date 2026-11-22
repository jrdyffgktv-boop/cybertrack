import { describe, expect, it } from 'vitest'
import { createDefaultState } from '../data/defaults'
import {
  caloriesOf,
  dailyExercise,
  exerciseDistance,
  exerciseKcal,
  exerciseMinutes,
  exerciseStreak,
  logsBetween,
  sportTotals,
} from '../domain/exercise'
import type { PersistedState } from '../domain/types'

function stateWith(
  logs: Array<{ date: string; sportId: string; minutes: number; distanceKm?: number }>,
  weightKg = 60,
): PersistedState {
  const base = createDefaultState()
  return {
    ...base,
    settings: { ...base.settings, weightKg },
    exerciseLogs: logs.map((log, index) => ({
      id: `ex-test-${index}`,
      date: log.date,
      sportId: log.sportId,
      minutes: log.minutes,
      distanceKm: log.distanceKm,
      at: '2026-11-22T12:00:00.000Z',
    })),
  }
}

describe('卡路里 = MET × 体重 × 小时', () => {
  it('跑步 30 分钟 / 60kg → 9.8 × 60 × 0.5 = 294', () => {
    expect(caloriesOf('run', 30, 60)).toBe(294)
  })

  it('篮球 60 分钟 / 70kg → 6.5 × 70 = 455', () => {
    expect(caloriesOf('basketball', 60, 70)).toBe(455)
  })

  it('0 分钟或未知项目返回 0', () => {
    expect(caloriesOf('run', 0, 60)).toBe(0)
    expect(caloriesOf('unknown', 30, 60)).toBe(0)
  })
})

describe('运动统计（和学习时长完全分开）', () => {
  const state = stateWith([
    { date: '2026-11-20', sportId: 'run', minutes: 30 },
    { date: '2026-11-21', sportId: 'badminton', minutes: 60 },
    { date: '2026-11-21', sportId: 'run', minutes: 20 },
    { date: '2026-11-23', sportId: 'basketball', minutes: 40 },
  ])

  it('按区间汇总分钟与千卡', () => {
    expect(logsBetween('2026-11-21', '2026-11-21', state)).toHaveLength(2)
    expect(exerciseMinutes('2026-11-21', '2026-11-21', state)).toBe(80)
    // 羽毛球 5.5×60×1=330 + 跑步 9.8×60×(20/60)=196
    expect(exerciseKcal('2026-11-21', '2026-11-21', state)).toBe(526)
    expect(exerciseMinutes('2026-11-25', '2026-11-26', state)).toBe(0)
  })

  it('每日序列补齐没有运动的日子', () => {
    const days = dailyExercise('2026-11-19', '2026-11-23', state)
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
    ])
    expect(days.map((d) => d.minutes)).toEqual([0, 30, 80, 0, 40])
  })

  it('按项目汇总并按分钟降序', () => {
    const totals = sportTotals('2026-11-19', '2026-11-23', state)
    expect(totals.map((t) => t.sportId)).toEqual(['badminton', 'run', 'basketball'])
    expect(totals[1]).toMatchObject({ sportId: 'run', minutes: 50, sessions: 2 })
  })

  it('运动连续天数：今天还没动就从昨天算，断档即停', () => {
    const today = '2026-11-22'
    const before = stateWith([
      { date: '2026-11-20', sportId: 'run', minutes: 30 },
      { date: '2026-11-21', sportId: 'run', minutes: 30 },
    ])
    expect(exerciseStreak(today, before)).toBe(2)
    const gap = stateWith([
      { date: '2026-11-19', sportId: 'run', minutes: 30 },
      { date: '2026-11-21', sportId: 'run', minutes: 30 },
    ])
    expect(exerciseStreak(today, gap)).toBe(1)
  })

  it('跑步里程按区间与按项目汇总', () => {
    const withKm = stateWith([
      { date: '2026-11-21', sportId: 'run', minutes: 60, distanceKm: 10.2 },
      { date: '2026-11-22', sportId: 'run', minutes: 30, distanceKm: 5 },
      { date: '2026-11-22', sportId: 'yoga', minutes: 20 },
    ])
    expect(exerciseDistance('2026-11-21', '2026-11-22', withKm)).toBe(15.2)
    const run = sportTotals('2026-11-21', '2026-11-22', withKm).find((t) => t.sportId === 'run')
    expect(run).toMatchObject({ minutes: 90, distanceKm: 15.2, sessions: 2 })
  })

  it('学习连续天数不受运动影响（运动不进 completions）', () => {
    const onlyExercise = stateWith([{ date: '2026-11-22', sportId: 'run', minutes: 60 }])
    expect(Object.keys(onlyExercise.completions)).toHaveLength(0)
  })
})
