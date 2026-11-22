// 默认数据：新用户第一次打开 App 时的完整初始状态。

import type { PersistedState, Settings } from '../domain/types'
import { HOLIDAYS, SLOTS, TERMS } from './content/calendar'

export const STATE_VERSION = 6

export function defaultSettings(): Settings {
  return {
    weeklyGoalHours: 9,
    dailyStartTime: '21:00',
    nightlyCheckIn: '22:30',
    studyWindows: {
      1: { start: '21:00', maxMinutes: 60 },
      2: { start: '21:30', maxMinutes: 60 },
      3: { start: '21:00', maxMinutes: 75 },
      4: { start: '21:00', maxMinutes: 75 },
      5: { start: '20:30', maxMinutes: 90 },
      6: { start: '10:00', maxMinutes: 120 },
      7: { start: '20:00', maxMinutes: 60 },
    },
    remindersEnabled: true,
    perTaskReminders: true,
    reminderLeadMin: 10,
    examRemindersReduced: true,
    weightKg: 60,
    timezone: 'Asia/Kuala_Lumpur',
  }
}

export function defaultProjectNotes(): string {
  return [
    '项目目标：一个能演示的 AI 网络安全分析平台，作为实习 / 香港硕士申请的作品集。',
    '',
    '当前策略：先做 URL 检测（f1）的规则基线，跑通「抓取 → 特征 → 打分 → 报告」，再逐个接入情报、DeepSeek 与前端。',
    '',
    '原则：每个任务都要有可验收产物；宁可功能少，也要能跑、能演示、有 README。',
  ].join('\n')
}

export function createDefaultState(now: string = new Date().toISOString()): PersistedState {
  return {
    version: STATE_VERSION,
    settings: defaultSettings(),
    calendar: {
      terms: TERMS.map((t) => ({ ...t })),
      slots: SLOTS.map((s) => ({ ...s })),
      holidays: HOLIDAYS.map((h) => ({ ...h })),
      exceptions: [],
    },
    customTasks: [],
    hiddenTaskIds: [],
    completions: {},
    lessonDone: {},
    running: {},
    exerciseLogs: [],
    assignments: [],
    project: {
      repoUrl: '',
      notes: defaultProjectNotes(),
      taskDone: {},
    },
    createdAt: now,
    updatedAt: now,
  }
}
