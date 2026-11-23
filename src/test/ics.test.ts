import { describe, expect, it } from 'vitest'
import { createDefaultState } from '../data/defaults'
import { generateDay } from '../domain/generator'
import { buildIcs, eventsFromPlans, planIcs } from '../domain/ics'

describe('ICS 导出', () => {
  const state = createDefaultState()
  const plan = generateDay('2026-11-23', state)
  const events = eventsFromPlans([plan], state.settings)
  const text = buildIcs(events, 'CyberTrack')

  it('包含日历骨架与时区', () => {
    expect(text).toContain('BEGIN:VCALENDAR')
    expect(text).toContain('END:VCALENDAR')
    expect(text).toContain('TZID:Asia/Kuala_Lumpur')
    expect(text).toContain('BEGIN:VTIMEZONE')
    expect(text).toContain('BEGIN:VEVENT')
  })

  it('每个任务一条事件，UID 唯一', () => {
    // 没有开始时间的任务（如锻炼）不进日历
    expect(events).toHaveLength(plan.tasks.filter((t) => t.start).length)
    const uids = events.map((e) => e.uid)
    expect(new Set(uids).size).toBe(uids.length)
    for (const event of events) {
      expect(event.uid).toMatch(/@cybertrack$/)
    }
  })

  it('带提醒，考试周提前量更短', () => {
    expect(text).toContain('BEGIN:VALARM')
    expect(text).toContain('TRIGGER:-PT10M')

    // 考试周没有导入任务，用一条手动任务验证「考试周提醒提前量降到 10 分钟」
    const examState = {
      ...state,
      customTasks: [
        {
          id: 'm:exam-drill',
          date: '2027-01-12',
          domain: 'review' as const,
          title: '考题演练',
          steps: ['重做一道课后题'],
          deliverable: '一道错题订正',
          minutes: 20,
          start: '19:00',
          source: 'manual' as const,
          done: false,
        },
      ],
    }
    const examPlan = generateDay('2027-01-12', examState)
    const examEvents = eventsFromPlans([examPlan], {
      ...examState.settings,
      reminderLeadMin: 30,
      examRemindersReduced: true,
    })
    expect(examEvents.length).toBeGreaterThan(0)
    expect(examEvents.every((e) => e.alarmMinutes === 10)).toBe(true)
  })

  it('每一行不超过 75 字节（UTF-8 折行）', () => {
    const encoder = new TextEncoder()
    for (const line of text.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('planIcs 直接可用', () => {
    const ics = planIcs([plan], state.settings)
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })
})
