// 作业：按截止日期算「还剩几天」，并决定列表顺序与颜色。

import { diffDays, formatShort } from './dates'
import type { Assignment, DateKey } from './types'

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

export interface DueInfo {
  /** 正数=还剩多少天，0=今天，负数=逾期 */
  days: number
  label: string
  tone: DueTone
}

/** 截止日期倒计时：注意 diffDays(今天, 截止) */
export function dueInfo(due: DateKey, today: DateKey): DueInfo {
  const days = diffDays(today, due)
  if (days < 0) return { days, label: `逾期 ${-days} 天`, tone: 'overdue' }
  if (days === 0) return { days, label: '今天到期', tone: 'today' }
  if (days <= 3) return { days, label: `还有 ${days} 天`, tone: 'soon' }
  return { days, label: `还有 ${days} 天`, tone: 'later' }
}

/** 未完成在前、按截止日期升序；同一天的按创建时间 */
export function sortAssignments(list: Assignment[]): Assignment[] {
  return list.slice().sort((a, b) => {
    const doneA = a.doneAt ? 1 : 0
    const doneB = b.doneAt ? 1 : 0
    if (doneA !== doneB) return doneA - doneB
    if (a.due !== b.due) return a.due < b.due ? -1 : 1
    if (a.createdAt === b.createdAt) return 0
    return a.createdAt < b.createdAt ? -1 : 1
  })
}

/** 未完成且今天或更早到期的条数，用于首页提示 */
export function dueTodayCount(list: Assignment[], today: DateKey): number {
  return list.filter((item) => !item.doneAt && diffDays(today, item.due) <= 0).length
}

export function assignmentWhenLabel(due: DateKey): string {
  return formatShort(due)
}
