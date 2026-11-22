import { describe, expect, it } from 'vitest'
import { dueInfo, dueTodayCount, sortAssignments } from '../domain/assignments'
import type { Assignment } from '../domain/types'

function make(partial: Partial<Assignment> & Pick<Assignment, 'id' | 'due'>): Assignment {
  return {
    courseCode: 'CYS102',
    courseTitle: '微积分',
    title: '习题 3',
    detail: '',
    createdAt: '2026-11-20T10:00:00.000Z',
    ...partial,
  }
}

describe('作业截止日期倒计时', () => {
  const today = '2026-11-23'

  it('未来、今天、逾期三种文案与色调', () => {
    expect(dueInfo('2026-11-30', today)).toEqual({ days: 7, label: '还有 7 天', tone: 'later' })
    expect(dueInfo('2026-11-25', today)).toEqual({ days: 2, label: '还有 2 天', tone: 'soon' })
    expect(dueInfo('2026-11-23', today)).toEqual({ days: 0, label: '今天到期', tone: 'today' })
    expect(dueInfo('2026-11-20', today)).toEqual({ days: -3, label: '逾期 3 天', tone: 'overdue' })
  })

  it('到期/逾期计数只看未完成', () => {
    const list = [
      make({ id: 'a', due: '2026-11-23' }),
      make({ id: 'b', due: '2026-11-21' }),
      make({ id: 'c', due: '2026-11-21', doneAt: '2026-11-22T08:00:00.000Z' }),
      make({ id: 'd', due: '2026-12-01' }),
    ]
    expect(dueTodayCount(list, today)).toBe(2)
  })
})

describe('作业排序', () => {
  it('未完成在前，然后按截止日期升序，再按创建时间', () => {
    const list = [
      make({ id: 'late', due: '2026-12-05' }),
      make({ id: 'done', due: '2026-11-24', doneAt: '2026-11-22T08:00:00.000Z' }),
      make({ id: 'soon', due: '2026-11-24' }),
      make({ id: 'same-day-later-created', due: '2026-11-24', createdAt: '2026-11-21T10:00:00.000Z' }),
    ]
    expect(sortAssignments(list).map((item) => item.id)).toEqual([
      'soon',
      'same-day-later-created',
      'late',
      'done',
    ])
  })

  it('不改原数组', () => {
    const list = [make({ id: 'b', due: '2026-12-02' }), make({ id: 'a', due: '2026-11-25' })]
    const sorted = sortAssignments(list)
    expect(sorted.map((item) => item.id)).toEqual(['a', 'b'])
    expect(list.map((item) => item.id)).toEqual(['b', 'a'])
  })
})
