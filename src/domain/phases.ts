// 阶段判定：把“某一天”映射到 正常 / 复习 / 考试 / 假期，并给出课程。

import type { CalendarData, CourseSlot, DateKey, Holiday, Phase, Term } from './types'
import { diffDays, isoWeekday } from './dates'
import { PLAN_START, SUMMER_START } from '../data/content/calendar'

export interface PhaseInfo {
  phase: Phase
  label: string
  term?: Term
  holiday?: Holiday
  /** 用于调试/展示的判定依据 */
  reason: string
}

function within(date: DateKey, start?: DateKey, end?: DateKey): boolean {
  if (!start || !end) return false
  return date >= start && date <= end
}

export function termForDate(date: DateKey, cal: CalendarData): Term | undefined {
  return cal.terms.find((t) => within(date, t.start, t.end))
}

/** 该日期生效的课程槽（按学期归属过滤，避免跨学期串课） */
export function slotsForDate(date: DateKey, cal: CalendarData): CourseSlot[] {
  const activeTermIds = new Set(cal.terms.filter((t) => within(date, t.start, t.end)).map((t) => t.id))
  const weekday = isoWeekday(date)
  return cal.slots.filter((s) => activeTermIds.has(s.termId) && s.weekday === weekday)
}

export function holidayForDate(date: DateKey, cal: CalendarData): Holiday | undefined {
  return cal.holidays.find((h) => h.date === date)
}

export function weekOfTerm(date: DateKey, term: Term): number {
  return Math.floor(diffDays(term.start, date) / 7) + 1
}

export function resolvePhase(date: DateKey, cal: CalendarData): PhaseInfo {
  const holiday = holidayForDate(date, cal)
  if (holiday) {
    return { phase: 'holiday', label: `公共假期 · ${holiday.name}`, holiday, reason: 'public-holiday' }
  }

  const examTerm = cal.terms.find((t) => within(date, t.examStart, t.examEnd))
  if (examTerm) {
    return { phase: 'exam', label: '考试周 · 只做课程复习', term: examTerm, reason: 'exam-week' }
  }

  const reviewTerm = cal.terms.find((t) => within(date, t.reviewStart, t.reviewEnd))
  if (reviewTerm) {
    return { phase: 'review', label: '复习周 · 大学课程优先', term: reviewTerm, reason: 'review-week' }
  }

  if (date >= SUMMER_START) {
    return { phase: 'holiday', label: '暑假', reason: 'summer' }
  }
  if (date < PLAN_START) {
    return { phase: 'holiday', label: '计划尚未开始', reason: 'before-plan' }
  }

  const term = termForDate(date, cal)
  if (term) {
    return { phase: 'normal', label: term.name, term, reason: 'semester' }
  }
  return { phase: 'holiday', label: '学期假期 · 项目实践', reason: 'semester-break' }
}

/** 学期内第几天（从 1 开始），用于复习文案里的“第 N 周” */
export function termWeekInfo(date: DateKey, cal: CalendarData): { term: Term; week: number } | undefined {
  const term = termForDate(date, cal)
  if (!term) return undefined
  return { term, week: Math.min(weekOfTerm(date, term), Math.ceil(diffDays(term.start, term.end) / 7) + 1) }
}
