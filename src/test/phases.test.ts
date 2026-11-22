import { describe, expect, it } from 'vitest'
import { HOLIDAYS, SLOTS, TERMS, PLAN_END, PLAN_START } from '../data/content/calendar'
import { resolvePhase, slotsForDate, termForDate, weekOfTerm } from '../domain/phases'
import type { CalendarData } from '../domain/types'

const cal: CalendarData = { terms: TERMS, slots: SLOTS, holidays: HOLIDAYS }

describe('学期与阶段判定', () => {
  it('计划期起止', () => {
    expect(PLAN_START).toBe('2026-11-23')
    expect(PLAN_END).toBe('2027-07-23')
  })

  it('学期归属', () => {
    expect(termForDate('2026-11-23', cal)?.id).toBe('t-2026-09')
    expect(termForDate('2027-03-01', cal)?.id).toBe('t-2027-02')
    expect(termForDate('2027-07-23', cal)?.id).toBe('t-2027-04')
    expect(termForDate('2027-01-22', cal)).toBeUndefined()
    expect(termForDate('2027-07-24', cal)).toBeUndefined()
  })

  it('考试周优先于复习周与新学期', () => {
    expect(resolvePhase('2027-01-11', cal).phase).toBe('exam')
    expect(resolvePhase('2027-03-22', cal).phase).toBe('exam')
    expect(resolvePhase('2027-03-26', cal).phase).toBe('exam')
    expect(resolvePhase('2027-07-12', cal).phase).toBe('exam')
    expect(resolvePhase('2027-07-23', cal).phase).toBe('exam')
  })

  it('复习周', () => {
    expect(resolvePhase('2027-01-04', cal).phase).toBe('review')
    expect(resolvePhase('2027-07-05', cal).phase).toBe('review')
    expect(resolvePhase('2027-07-11', cal).phase).toBe('review')
  })

  it('正常学期与假期', () => {
    expect(resolvePhase('2026-11-23', cal).phase).toBe('normal')
    expect(resolvePhase('2027-02-12', cal).phase).toBe('normal')
    expect(resolvePhase('2027-01-25', cal).phase).toBe('holiday')
  })

  it('公共假期优先休息', () => {
    expect(resolvePhase('2026-12-25', cal).phase).toBe('holiday')
    expect(resolvePhase('2027-02-06', cal).phase).toBe('holiday')
  })

  it('暑假从 07-24 开始', () => {
    expect(resolvePhase('2027-07-24', cal).phase).toBe('holiday')
    expect(resolvePhase('2027-08-10', cal).phase).toBe('holiday')
  })

  it('只返回当前学期的课', () => {
    expect(slotsForDate('2026-11-23', cal)).toHaveLength(3)
    expect(slotsForDate('2027-03-02', cal)).toHaveLength(0)
  })

  it('学期周次从 1 开始', () => {
    const term = TERMS[0]
    expect(weekOfTerm('2026-09-25', term)).toBe(1)
    expect(weekOfTerm('2026-10-02', term)).toBe(2)
  })
})
