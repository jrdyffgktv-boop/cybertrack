// 提醒引擎（前台）：每 20 秒检查一次，到点提醒。
// iPhone 关掉网页后它不会跑——真正可靠的是「导出 .ics 到系统日历」。

import { useEffect, useRef } from 'react'
import type { PersistedState } from '../domain/types'
import { timeToMinutes, todayKey } from '../domain/dates'
import { generateDay } from '../domain/generator'
import { notify } from './notify'

const FIRED_KEY = 'cybertrack:fired:v1'
const TICK_MS = 20_000

interface FiredState {
  date: string
  keys: string[]
}

function nowMinutesKL(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

function loadFired(): FiredState {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FiredState
      if (typeof parsed.date === 'string' && Array.isArray(parsed.keys)) return parsed
    }
  } catch {
    // 忽略损坏的记录
  }
  return { date: '', keys: [] }
}

function saveFired(fired: FiredState): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired))
  } catch {
    // ignore
  }
}

function checkReminders(state: PersistedState): void {
  const today = todayKey()
  const plan = generateDay(today, state)
  const now = nowMinutesKL()
  const fired = loadFired()
  if (fired.date !== today) {
    fired.date = today
    fired.keys = []
  }

  const mark = (key: string) => {
    if (!fired.keys.includes(key)) fired.keys.push(key)
  }

  if (state.settings.remindersEnabled && state.settings.perTaskReminders) {
    const phaseLead =
      plan.phase === 'exam' && state.settings.examRemindersReduced ? 10 : state.settings.reminderLeadMin
    for (const task of plan.tasks) {
      if (task.done || !task.start) continue
      const lead = task.reminderOffsetMin ?? phaseLead
      const startMin = timeToMinutes(task.start)
      const fireAt = startMin - lead
      if (now >= fireAt && now < startMin + 10) {
        const key = `task:${task.id}`
        if (!fired.keys.includes(key)) {
          mark(key)
          void notify('该开始学习了', `${task.title} · 计划 ${task.minutes} 分钟`)
        }
      }
    }
  }

  if (state.settings.remindersEnabled) {
    const checkIn = timeToMinutes(state.settings.nightlyCheckIn)
    if (now >= checkIn && now < checkIn + 180) {
      const key = `night:${today}`
      if (!fired.keys.includes(key)) {
        mark(key)
        const left = plan.tasks.filter((t) => !t.done).length
        void notify(
          '今天学得怎么样？',
          left > 0 ? `还有 ${left} 个任务没打卡，花 1 分钟确认一下` : '任务都完成了，花 1 分钟写句复盘，再定明天',
        )
      }
    }
  }

  saveFired(fired)
}

export function useReminderEngine(state: PersistedState | null): void {
  const stateRef = useRef(state)
  stateRef.current = state
  const active = !!state

  useEffect(() => {
    if (!active) return
    const tick = () => {
      const current = stateRef.current
      if (!current) return
      try {
        checkReminders(current)
      } catch {
        // 提醒失败不能影响界面
      }
    }
    tick()
    const id = window.setInterval(tick, TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])
}
