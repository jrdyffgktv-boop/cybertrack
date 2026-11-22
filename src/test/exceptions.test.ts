import { describe, expect, it } from 'vitest'
import type { CalendarData, CourseException, CourseSlot, Term } from '../domain/types'
import { exceptionFor, slotsForDate } from '../domain/phases'

const TERM: Term = {
  id: 't-test',
  name: 'Test Semester',
  start: '2026-09-01',
  end: '2027-01-31',
}

const SLOT: CourseSlot = {
  id: 's1',
  termId: 't-test',
  code: 'CYS102',
  title: '微积分',
  weekday: 1,
  start: '08:00',
  end: '10:00',
  location: 'A5#G07',
}

function makeCalendar(exceptions: CourseException[] = []): CalendarData {
  return { terms: [TERM], slots: [SLOT], exceptions, holidays: [] }
}

const EXC = (patch: Partial<CourseException> = {}): CourseException => ({
  id: 'e1',
  date: '2026-11-30',
  slotId: 's1',
  termId: 't-test',
  code: 'CYS102',
  title: '微积分',
  weekday: 1,
  start: '09:00',
  end: '11:00',
  location: 'B1#101',
  ...patch,
})

describe('单日课表例外', () => {
  it('只改的这一天用新时间地点，下一周恢复原样', () => {
    const cal = makeCalendar([EXC()])
    const changed = slotsForDate('2026-11-30', cal)
    expect(changed).toHaveLength(1)
    expect(changed[0].start).toBe('09:00')
    expect(changed[0].location).toBe('B1#101')
    expect(changed[0].exceptionDate).toBe('2026-11-30')

    const nextWeek = slotsForDate('2026-12-07', cal)
    expect(nextWeek).toHaveLength(1)
    expect(nextWeek[0].start).toBe('08:00')
    expect(nextWeek[0].location).toBe('A5#G07')
    expect(nextWeek[0].exceptionDate).toBeUndefined()
  })

  it('removed = 这一天停课，不影响之后', () => {
    const cal = makeCalendar([EXC({ removed: true })])
    expect(slotsForDate('2026-11-30', cal)).toHaveLength(0)
    expect(slotsForDate('2026-12-07', cal)).toHaveLength(1)
  })

  it('调到别的星期：只在目标日期出现', () => {
    // 2026-12-01 是周二；原本这门课在周一
    const cal = makeCalendar([EXC({ date: '2026-12-01', weekday: 2, start: '13:00', end: '15:00' })])
    const moved = slotsForDate('2026-12-01', cal)
    expect(moved).toHaveLength(1)
    expect(moved[0].weekday).toBe(2)
    // 原来的周一那天照旧
    const monday = slotsForDate('2026-11-30', cal)
    expect(monday).toHaveLength(1)
    expect(monday[0].start).toBe('08:00')
  })

  it('exceptionFor 能按日期和 slotId 找到例外', () => {
    const cal = makeCalendar([EXC()])
    expect(exceptionFor('2026-11-30', 's1', cal)?.start).toBe('09:00')
    expect(exceptionFor('2026-12-07', 's1', cal)).toBeUndefined()
  })

  it('没有例外时按每周常规返回', () => {
    const cal = makeCalendar()
    const list = slotsForDate('2026-11-30', cal)
    expect(list).toHaveLength(1)
    expect(list[0].start).toBe('08:00')
  })
})
