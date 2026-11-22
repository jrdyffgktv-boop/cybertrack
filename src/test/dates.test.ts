import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateRange,
  diffDays,
  formatCn,
  isoWeekday,
  keyToUtc,
  monthMatrix,
  startOfWeek,
} from '../domain/dates'

describe('dates', () => {
  it('keyToUtc 不因时区偏移而换日', () => {
    const d = new Date(keyToUtc('2026-11-23'))
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(10)
    expect(d.getUTCDate()).toBe(23)
  })

  it('addDays / diffDays 跨月跨年', () => {
    expect(addDays('2026-11-23', 1)).toBe('2026-11-24')
    expect(addDays('2027-01-31', 1)).toBe('2027-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-11-23', '2027-07-23')).toBe(242)
    expect(diffDays('2027-07-23', '2026-11-23')).toBe(-242)
  })

  it('星期与计划起止日对得上', () => {
    expect(isoWeekday('2026-11-23')).toBe(1)
    expect(isoWeekday('2027-07-23')).toBe(5)
    expect(startOfWeek('2026-11-26')).toBe('2026-11-23')
  })

  it('dateRange 生成连续日期', () => {
    const days = dateRange('2026-11-23', '2026-11-27')
    expect(days).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
  })

  it('月矩阵整周且覆盖整月', () => {
    const weeks = monthMatrix('2026-11')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    const flat = weeks.flat()
    expect(flat).toContain('2026-11-01')
    expect(flat).toContain('2026-11-30')
    expect(isoWeekday(flat[0])).toBe(1)
  })

  it('中文日期格式', () => {
    expect(formatCn('2027-01-04')).toContain('1月4日')
    expect(formatCn('2027-01-04')).toContain('周一')
  })
})
