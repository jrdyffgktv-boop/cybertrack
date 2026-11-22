// 每周/每日时间预算：阶段决定上限，设置里的 studyWindows 只负责起始时间和单日上限。

import type { Phase, Weekday } from './types'

type Budget = Record<Weekday, number>

/** 正常授课周：合计 540 分钟 = 9 小时 */
export const NORMAL_BUDGET: Budget = { 1: 60, 2: 60, 3: 75, 4: 75, 5: 90, 6: 120, 7: 60 }
/** 复习周：合计 300 分钟 = 5 小时，全部用于大学课程 */
export const REVIEW_BUDGET: Budget = { 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 0, 7: 0 }
/** 考试周：合计 150 分钟，只做考题演练 */
export const EXAM_BUDGET: Budget = { 1: 50, 2: 50, 3: 50, 4: 0, 5: 0, 6: 0, 7: 0 }
/** 学期假期：合计 420 分钟，增加项目实践但留出休息日 */
export const BREAK_BUDGET: Budget = { 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 120, 7: 0 }
/** 公共假期：休息 */
export const REST_BUDGET: Budget = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }

export function phaseBudget(phase: Phase, weekday: Weekday): number {
  switch (phase) {
    case 'normal':
      return NORMAL_BUDGET[weekday]
    case 'review':
      return REVIEW_BUDGET[weekday]
    case 'exam':
      return EXAM_BUDGET[weekday]
    case 'holiday':
      return BREAK_BUDGET[weekday]
    default:
      return 0
  }
}

/** 公共假期覆盖：休息日不生成自动任务 */
export function dayBudget(phase: Phase, weekday: Weekday, publicHoliday: boolean, maxMinutes: number): number {
  if (publicHoliday) return 0
  return Math.min(phaseBudget(phase, weekday), maxMinutes)
}

export type SegmentKind = 'course-review' | 'lesson' | 'project' | 'weekly-review' | 'exam-drill'

export interface Segment {
  kind: SegmentKind
  minutes: number
}

/** 每周任务构成，严格对应需求里的「每周学习时间安排」 */
export function composition(phase: Phase, weekday: Weekday): Segment[] {
  if (phase === 'review') {
    return weekday <= 5 ? [{ kind: 'course-review', minutes: 60 }] : []
  }
  if (phase === 'exam') {
    return weekday <= 3 ? [{ kind: 'exam-drill', minutes: 50 }] : []
  }
  if (phase === 'holiday') {
    if (weekday <= 5) return [{ kind: 'lesson', minutes: 60 }]
    if (weekday === 6) return [{ kind: 'project', minutes: 120 }]
    return []
  }
  switch (weekday) {
    case 1:
      return [{ kind: 'course-review', minutes: 60 }]
    case 2:
      return [{ kind: 'course-review', minutes: 60 }]
    case 3:
      return [
        { kind: 'course-review', minutes: 25 },
        { kind: 'lesson', minutes: 50 },
      ]
    case 4:
      return [
        { kind: 'course-review', minutes: 45 },
        { kind: 'lesson', minutes: 30 },
      ]
    case 5:
      return [{ kind: 'lesson', minutes: 90 }]
    case 6:
      return [
        { kind: 'project', minutes: 60 },
        { kind: 'lesson', minutes: 60 },
      ]
    case 7:
      return [{ kind: 'weekly-review', minutes: 60 }]
    default:
      return []
  }
}
