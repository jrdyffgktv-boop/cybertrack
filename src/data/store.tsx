// 全局状态：一份 PersistedState + 所有写操作，写完全部落本地存储。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Assignment,
  AssignmentInput,
  Completion,
  CourseSlot,
  DateKey,
  Holiday,
  PersistedState,
  Settings,
  Task,
} from '../domain/types'
import { clampMinutes } from '../domain/validate'
import { todayKey } from '../domain/dates'
import { createDefaultState, STATE_VERSION } from '../data/defaults'
import { clearPersisted, loadPersisted, savePersisted } from '../data/db'

const saveQueue: { pending: PersistedState | null; running: boolean } = { pending: null, running: false }

async function drainSaveQueue(): Promise<void> {
  if (saveQueue.running) return
  saveQueue.running = true
  try {
    while (saveQueue.pending) {
      const next = saveQueue.pending
      saveQueue.pending = null
      await savePersisted(next)
    }
  } finally {
    saveQueue.running = false
  }
}

function scheduleSave(state: PersistedState): void {
  saveQueue.pending = state
  void drainSaveQueue()
}

function cloneState(state: PersistedState): PersistedState {
  return JSON.parse(JSON.stringify(state)) as PersistedState
}

function migrate(saved: PersistedState): PersistedState {
  const base = createDefaultState()
  const calendar = saved.calendar
  const settings = saved.settings
  const savedVersion = saved.version ?? 1
  const previousCompletions = savedVersion < 3 ? {} : (saved.completions ?? {})
  // v3 → v4：锻炼从学习任务里拆成独立的运动页，旧的锻炼打卡（x: / domain exercise）一并清掉
  const completions: Record<string, Completion> =
    savedVersion < 4
      ? Object.fromEntries(
          Object.entries(previousCompletions).filter(
            ([id, c]) => !id.startsWith('x:') && c.domain !== 'exercise',
          ),
        )
      : previousCompletions
  return {
    ...base,
    ...saved,
    version: STATE_VERSION,
    settings: {
      ...base.settings,
      ...settings,
      studyWindows: { ...base.settings.studyWindows, ...(settings?.studyWindows ?? {}) },
    },
    calendar: {
      terms: calendar?.terms?.length ? calendar.terms : base.calendar.terms,
      // v1 → v2：课表按 XMUM Online 官方时间表重新核对（补齐地点、修正时段）。
      slots: savedVersion < 2 ? base.calendar.slots : (calendar?.slots ?? []),
      exceptions: Array.isArray(calendar?.exceptions) ? calendar.exceptions : [],
      holidays: calendar?.holidays ?? base.calendar.holidays,
    },
    customTasks: saved.customTasks ?? [],
    // v2 → v3：学习计划换成了新的 Excel（一天一条任务），旧的课时 / 项目任务 id 已失效，
    // 因此升级时清掉旧打卡与游标；课程表、锻炼、设置、手动任务都保留。
    hiddenTaskIds: savedVersion < 3 ? [] : (saved.hiddenTaskIds ?? []),
    completions,
    lessonDone: savedVersion < 3 ? {} : (saved.lessonDone ?? {}),
    running: saved.running ?? {},
    exerciseLogs: Array.isArray(saved.exerciseLogs) ? saved.exerciseLogs : [],
    assignments: Array.isArray(saved.assignments) ? saved.assignments : [],
    project: { ...base.project, ...(saved.project ?? {}), taskDone: savedVersion < 3 ? {} : (saved.project?.taskDone ?? {}) },
  }
}

export interface StoreApi {
  state: PersistedState | null
  ready: boolean
  today: DateKey
  toggleTask: (task: Task, done: boolean, minutes?: number) => void
  startTask: (task: Task) => void
  finishTask: (task: Task, minutes?: number) => void
  resetProgress: () => void
  saveTask: (task: Task) => void
  deleteTask: (task: Task) => void
  updateSettings: (patch: Partial<Settings>) => void
  addSlot: (slot: Omit<CourseSlot, 'id'>) => void
  updateSlot: (slot: CourseSlot) => void
  removeSlot: (id: string) => void
  /** 只改某一天的那节课（scope=once）或整门课（scope=series） */
  saveSlotOccurrence: (date: DateKey, slot: CourseSlot, values: Omit<CourseSlot, 'id' | 'termId' | 'exceptionDate'>, scope: 'once' | 'series') => void
  /** 删除某一天的那节课 / 整门课 */
  deleteSlotOccurrence: (date: DateKey, slot: CourseSlot, scope: 'once' | 'series') => void
  /** 恢复这一天的每周常规安排 */
  clearSlotException: (date: DateKey, slotId: string) => void
  addHoliday: (holiday: Holiday) => void
  removeHoliday: (date: DateKey) => void
  setRepoUrl: (url: string) => void
  setNotes: (notes: string) => void
  toggleProjectTask: (taskId: string, done: boolean, minutes: number, date: DateKey) => void
  /** 运动打卡（独立于学习任务） */
  logExercise: (sportId: string, minutes: number, date?: DateKey, distanceKm?: number) => void
  removeExerciseLog: (id: string) => void
  addAssignment: (input: AssignmentInput) => void
  updateAssignment: (assignment: Assignment) => void
  deleteAssignment: (id: string) => void
  toggleAssignment: (id: string) => void
  reset: () => void
  exportJson: () => string
  importJson: (text: string) => { ok: boolean; error?: string }
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState | null>(null)
  const [ready, setReady] = useState(false)
  const skipFirstSave = useRef(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadPersisted<PersistedState>()
      if (cancelled) return
      if (saved) {
        const migrated = migrate(saved)
        // 结构升级后立刻落盘，否则下次启动会拿旧版本再迁移一遍（可能覆盖用户的课表修改）
        if ((saved.version ?? 1) < migrated.version) scheduleSave(migrated)
        setState(migrated)
      } else {
        setState(createDefaultState())
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !state) return
    if (skipFirstSave.current) {
      skipFirstSave.current = false
      return
    }
    scheduleSave(state)
  }, [state, ready])

  const update = useCallback((mutator: (draft: PersistedState) => void) => {
    setState((prev) => {
      if (!prev) return prev
      const draft = cloneState(prev)
      mutator(draft)
      draft.updatedAt = new Date().toISOString()
      return draft
    })
  }, [])

  const toggleTask = useCallback(
    (task: Task, done: boolean, minutes?: number) => {
      update((draft) => {
        if (done) {
          const completion: Completion = {
            // 计时打卡记录的是真实时长，可能不到 5 分钟，所以这里不套 clampMinutes
            minutes: Math.max(1, Math.round(minutes ?? task.minutes ?? 0)),
            date: task.date,
            domain: task.domain,
            at: new Date().toISOString(),
          }
          draft.completions[task.id] = completion
          if (task.lessonId) draft.lessonDone[task.lessonId] = task.date
          if (task.projectTaskId) draft.project.taskDone[task.projectTaskId] = task.date
        } else {
          delete draft.completions[task.id]
          if (task.lessonId && draft.lessonDone[task.lessonId] === task.date) delete draft.lessonDone[task.lessonId]
          if (task.projectTaskId && draft.project.taskDone[task.projectTaskId] === task.date) {
            delete draft.project.taskDone[task.projectTaskId]
          }
        }
      })
    },
    [update],
  )

  const startTask = useCallback(
    (task: Task) => {
      update((draft) => {
        draft.running[task.id] = new Date().toISOString()
      })
    },
    [update],
  )

  const finishTask = useCallback(
    (task: Task, minutes?: number) => {
      const startedAt = state?.running[task.id]
      const real = startedAt ? Math.max(1, Math.round((Date.now() - Date.parse(startedAt)) / 60000)) : undefined
      toggleTask(task, true, minutes ?? real ?? Math.max(1, task.minutes))
      update((draft) => {
        delete draft.running[task.id]
      })
    },
    [state, toggleTask, update],
  )

  /** 只清学习进度：打卡、课时游标、项目进度、计时；课程表/锻炼/设置/自定义任务都保留 */
  const resetProgress = useCallback(() => {
    update((draft) => {
      draft.completions = {}
      draft.lessonDone = {}
      draft.running = {}
      draft.hiddenTaskIds = []
      draft.project.taskDone = {}
    })
  }, [update])

  const saveTask = useCallback(
    (task: Task) => {
      update((draft) => {
        const clean: Task = {
          ...task,
          title: task.title.trim(),
          deliverable: task.deliverable.trim(),
          steps: task.steps.map((s) => s.trim()).filter(Boolean),
          // 导入的计划没有时长，保持 0（界面不显示分钟），别硬塞一个最小值
          minutes: task.minutes > 0 ? clampMinutes(task.minutes) : 0,
        }
        const idx = draft.customTasks.findIndex((t) => t.id === clean.id)
        if (idx >= 0) draft.customTasks[idx] = clean
        else draft.customTasks.push(clean)

        // 自动任务被改成手动覆盖时，把原来的打卡记录带过来，避免进度凭空归零
        if (clean.source === 'override' && clean.replaces) {
          const previous = draft.completions[clean.replaces]
          if (previous && !draft.completions[clean.id]) draft.completions[clean.id] = previous
          delete draft.completions[clean.replaces]
        }
      })
    },
    [update],
  )

  const deleteTask = useCallback(
    (task: Task) => {
      update((draft) => {
        const idx = draft.customTasks.findIndex((t) => t.id === task.id)
        if (idx >= 0) {
          draft.customTasks.splice(idx, 1)
          // 覆盖任务的来源自动任务也一起隐藏，否则删完它又会冒出来
          if (task.replaces && !draft.hiddenTaskIds.includes(task.replaces)) {
            draft.hiddenTaskIds.push(task.replaces)
          }
          return
        }
        if (!draft.hiddenTaskIds.includes(task.id)) draft.hiddenTaskIds.push(task.id)
      })
    },
    [update],
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update((draft) => {
        draft.settings = { ...draft.settings, ...patch }
      })
    },
    [update],
  )

  const addSlot = useCallback(
    (slot: Omit<CourseSlot, 'id'>) => {
      update((draft) => {
        const id = `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        draft.calendar.slots.push({ ...slot, id })
      })
    },
    [update],
  )

  const updateSlot = useCallback(
    (slot: CourseSlot) => {
      update((draft) => {
        const idx = draft.calendar.slots.findIndex((s) => s.id === slot.id)
        if (idx >= 0) draft.calendar.slots[idx] = slot
        else draft.calendar.slots.push(slot)
      })
    },
    [update],
  )

  const removeSlot = useCallback(
    (id: string) => {
      update((draft) => {
        draft.calendar.slots = draft.calendar.slots.filter((s) => s.id !== id)
        draft.calendar.exceptions = (draft.calendar.exceptions ?? []).filter((e) => e.slotId !== id)
      })
    },
    [update],
  )

  const saveSlotOccurrence = useCallback(
    (
      date: DateKey,
      slot: CourseSlot,
      values: Omit<CourseSlot, 'id' | 'termId' | 'exceptionDate'>,
      scope: 'once' | 'series',
    ) => {
      update((draft) => {
        if (scope === 'series') {
          draft.calendar.slots = draft.calendar.slots.map((s) => (s.id === slot.id ? { ...s, ...values } : s))
          return
        }
        draft.calendar.exceptions = draft.calendar.exceptions ?? []
        const idx = draft.calendar.exceptions.findIndex((e) => e.date === date && e.slotId === slot.id)
        const snapshot = {
          date,
          slotId: slot.id,
          termId: slot.termId,
          removed: false,
          ...values,
        }
        if (idx >= 0) {
          draft.calendar.exceptions[idx] = { ...draft.calendar.exceptions[idx], ...snapshot }
        } else {
          draft.calendar.exceptions.push({
            id: `exc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            ...snapshot,
          })
        }
      })
    },
    [update],
  )

  const deleteSlotOccurrence = useCallback(
    (date: DateKey, slot: CourseSlot, scope: 'once' | 'series') => {
      update((draft) => {
        if (scope === 'series') {
          draft.calendar.slots = draft.calendar.slots.filter((s) => s.id !== slot.id)
          draft.calendar.exceptions = (draft.calendar.exceptions ?? []).filter((e) => e.slotId !== slot.id)
          return
        }
        draft.calendar.exceptions = draft.calendar.exceptions ?? []
        const existing = draft.calendar.exceptions.find((e) => e.date === date && e.slotId === slot.id)
        if (existing) {
          existing.removed = true
        } else {
          draft.calendar.exceptions.push({
            id: `exc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            date,
            slotId: slot.id,
            termId: slot.termId,
            code: slot.code,
            title: slot.title,
            weekday: slot.weekday,
            start: slot.start,
            end: slot.end,
            location: slot.location,
            removed: true,
          })
        }
      })
    },
    [update],
  )

  const clearSlotException = useCallback(
    (date: DateKey, slotId: string) => {
      update((draft) => {
        draft.calendar.exceptions = (draft.calendar.exceptions ?? []).filter(
          (e) => !(e.date === date && e.slotId === slotId),
        )
      })
    },
    [update],
  )

  const addHoliday = useCallback(
    (holiday: Holiday) => {
      update((draft) => {
        draft.calendar.holidays = draft.calendar.holidays.filter((h) => h.date !== holiday.date)
        draft.calendar.holidays.push(holiday)
        draft.calendar.holidays.sort((a, b) => a.date.localeCompare(b.date))
      })
    },
    [update],
  )

  const removeHoliday = useCallback(
    (date: DateKey) => {
      update((draft) => {
        draft.calendar.holidays = draft.calendar.holidays.filter((h) => h.date !== date)
      })
    },
    [update],
  )

  const setRepoUrl = useCallback(
    (url: string) => {
      update((draft) => {
        draft.project.repoUrl = url.trim()
      })
    },
    [update],
  )

  const setNotes = useCallback(
    (notes: string) => {
      update((draft) => {
        draft.project.notes = notes
      })
    },
    [update],
  )

  const toggleProjectTask = useCallback(
    (taskId: string, done: boolean, minutes: number, date: DateKey) => {
      update((draft) => {
        const completionId = `p:${date}:${taskId}`
        if (done) {
          draft.project.taskDone[taskId] = date
          draft.completions[completionId] = {
            minutes: clampMinutes(minutes),
            date,
            domain: 'project',
            at: new Date().toISOString(),
          }
        } else {
          delete draft.project.taskDone[taskId]
          delete draft.completions[completionId]
        }
      })
    },
    [update],
  )

  const logExercise = useCallback(
    (sportId: string, minutes: number, date?: DateKey, distanceKm?: number) => {
      const clean = Math.max(1, Math.round(minutes))
      const km = distanceKm && distanceKm > 0 ? Math.round(distanceKm * 10) / 10 : undefined
      update((draft) => {
        draft.exerciseLogs.push({
          id: `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          date: date ?? todayKey(),
          sportId,
          minutes: clean,
          ...(km ? { distanceKm: km } : {}),
          at: new Date().toISOString(),
        })
      })
    },
    [update],
  )

  const removeExerciseLog = useCallback(
    (id: string) => {
      update((draft) => {
        draft.exerciseLogs = draft.exerciseLogs.filter((log) => log.id !== id)
      })
    },
    [update],
  )

  const addAssignment = useCallback(
    (input: AssignmentInput) => {
      const title = input.title.trim()
      if (!title) return
      update((draft) => {
        draft.assignments.push({
          id: `as-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          courseCode: input.courseCode.trim(),
          courseTitle: input.courseTitle.trim(),
          title,
          detail: input.detail.trim(),
          due: input.due,
          createdAt: new Date().toISOString(),
        })
      })
    },
    [update],
  )

  const updateAssignment = useCallback(
    (assignment: Assignment) => {
      const title = assignment.title.trim()
      if (!title) return
      update((draft) => {
        const index = draft.assignments.findIndex((item) => item.id === assignment.id)
        if (index < 0) return
        draft.assignments[index] = {
          ...draft.assignments[index],
          courseCode: assignment.courseCode.trim(),
          courseTitle: assignment.courseTitle.trim(),
          title,
          detail: assignment.detail.trim(),
          due: assignment.due,
        }
      })
    },
    [update],
  )

  const deleteAssignment = useCallback(
    (id: string) => {
      update((draft) => {
        draft.assignments = draft.assignments.filter((item) => item.id !== id)
      })
    },
    [update],
  )

  const toggleAssignment = useCallback(
    (id: string) => {
      update((draft) => {
        const item = draft.assignments.find((entry) => entry.id === id)
        if (!item) return
        if (item.doneAt) delete item.doneAt
        else item.doneAt = new Date().toISOString()
      })
    },
    [update],
  )
  const reset = useCallback(() => {
    void clearPersisted().then(() => {
      setState(createDefaultState())
    })
  }, [])

  const exportJson = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importJson = useCallback(
    (text: string): { ok: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(text) as PersistedState
        if (!parsed || typeof parsed !== 'object' || !parsed.settings || !parsed.calendar) {
          return { ok: false, error: '文件结构不对：缺少 settings 或 calendar' }
        }
        setState(migrate(parsed))
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'JSON 解析失败' }
      }
    },
    [],
  )

  const today = todayKey()

  const value = useMemo<StoreApi>(
    () => ({
      state,
      ready,
      today,
      toggleTask,
      startTask,
      finishTask,
      resetProgress,
      saveTask,
      deleteTask,
      updateSettings,
      addSlot,
      updateSlot,
      removeSlot,
      saveSlotOccurrence,
      deleteSlotOccurrence,
      clearSlotException,
      addHoliday,
      removeHoliday,
      setRepoUrl,
      setNotes,
      toggleProjectTask,
      logExercise,
      removeExerciseLog,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      toggleAssignment,
      reset,
      exportJson,
      importJson,
    }),
    [
      state,
      ready,
      today,
      toggleTask,
      startTask,
      finishTask,
      resetProgress,
      saveTask,
      deleteTask,
      updateSettings,
      addSlot,
      updateSlot,
      removeSlot,
      saveSlotOccurrence,
      deleteSlotOccurrence,
      clearSlotException,
      addHoliday,
      removeHoliday,
      setRepoUrl,
      setNotes,
      toggleProjectTask,
      logExercise,
      removeExerciseLog,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      toggleAssignment,
      reset,
      exportJson,
      importJson,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用')
  return ctx
}

/** 只用于「数据已就绪」的界面，省掉每个屏幕的 null 判断 */
export function useRequiredState(): PersistedState {
  const { state } = useStore()
  if (!state) throw new Error('状态尚未加载完成')
  return state
}
