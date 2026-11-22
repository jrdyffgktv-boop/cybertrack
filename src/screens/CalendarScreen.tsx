import { useMemo, useState } from 'react'
import type { CourseSlot, DateKey, DayPlan, Task } from '../domain/types'
import { useRequiredState, useStore } from '../data/store'
import { generateDay } from '../domain/generator'
import { slotsForDate } from '../domain/phases'
import {
  addDays,
  addMonths,
  dateRange,
  formatCn,
  monthMatrix,
  startOfMonth,
  startOfWeek,
  weekdayLabel,
  WEEKDAY_LABELS,
} from '../domain/dates'
import { completedCount, dayProgress } from '../domain/progress'
import { PHASE_LABELS } from '../domain/labels'
import { ProgressBar } from '../components/Progress'
import { TaskCard } from '../components/TaskCard'
import { TaskEditor } from '../components/TaskEditor'
import { CourseList } from '../components/CourseList'
import { CourseEditor } from '../components/CourseEditor'
import { Icon } from '../components/Icons'

const LEGEND: Array<{ phase: string; label: string }> = [
  { phase: 'normal', label: '正常学习' },
  { phase: 'review', label: '复习周' },
  { phase: 'exam', label: '考试周' },
  { phase: 'holiday', label: '假期 / 休息' },
]

export function CalendarScreen() {
  const state = useRequiredState()
  const { today, startTask, finishTask, toggleTask } = useStore()
  const [cursor, setCursor] = useState<DateKey>(startOfMonth(today))
  const [selected, setSelected] = useState<DateKey>(today)
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [editingSlot, setEditingSlot] = useState<CourseSlot | 'new' | null>(null)

  const matrix = useMemo(() => monthMatrix(cursor), [cursor])
  const plans = useMemo(() => {
    const map = new Map<DateKey, DayPlan>()
    for (const row of matrix) for (const d of row) map.set(d, generateDay(d, state))
    return map
  }, [matrix, state])

  const weekDays = useMemo(() => {
    const start = startOfWeek(selected)
    return dateRange(start, addDays(start, 6))
  }, [selected])

  const monthPrefix = cursor.slice(0, 7)
  const plan = plans.get(selected) ?? generateDay(selected, state)

  function shiftMonth(delta: number) {
    const next = startOfMonth(addMonths(cursor, delta))
    setCursor(next)
    if (!next.startsWith(today.slice(0, 7))) setSelected(next)
    else setSelected(today)
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">课程 · 考试周 · 复习周 · 假期</p>
          <h1>日历</h1>
        </div>
        <div className="seg">
          <button type="button" className={mode === 'month' ? 'is-on' : ''} onClick={() => setMode('month')}>
            月
          </button>
          <button type="button" className={mode === 'week' ? 'is-on' : ''} onClick={() => setMode('week')}>
            周
          </button>
        </div>
      </header>

      {mode === 'month' ? (
        <section className="card cal-card">
          <div className="row-between">
            <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="上个月">
              <Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <h2 className="mono">
              {cursor.slice(0, 4)} 年 {Number(cursor.slice(5, 7))} 月
            </h2>
            <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="下个月">
              <Icon name="chevron" size={18} />
            </button>
          </div>

          <div className="cal-grid cal-head">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="cal-grid">
            {matrix.flat().map((date) => {
              const dayPlan = plans.get(date)
              if (!dayPlan) return null
              const doneAll = dayPlan.plannedMinutes > 0 && dayPlan.doneMinutes >= dayPlan.plannedMinutes
              const courseCount = slotsForDate(date, state.calendar).length
              return (
                <button
                  key={date}
                  type="button"
                  className={`cal-cell ${date.slice(0, 7) !== monthPrefix ? 'is-other' : ''} ${
                    date === selected ? 'is-selected' : ''
                  } ${date === today ? 'is-today' : ''}`}
                  onClick={() => setSelected(date)}
                >
                  <span className="cal-num">{Number(date.slice(8, 10))}</span>
                  <span className={`cal-bar phase-${dayPlan.phase} ${doneAll ? 'is-done' : ''}`} />
                  {courseCount > 0 && (
                    <span className="cal-courses" aria-label={`${courseCount} 门课`}>
                      {Array.from({ length: Math.min(courseCount, 3) }, (_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                  )}
                  {dayPlan.tasks.length > 0 && <span className="cal-count">{dayPlan.tasks.length}</span>}
                </button>
              )
            })}
          </div>

          <div className="legend">
            {LEGEND.map((item) => (
              <span key={item.phase} className="legend-item">
                <i className={`legend-dot phase-${item.phase}`} />
                {item.label}
              </span>
            ))}
            <span className="legend-item">
              <span className="cal-courses" aria-hidden="true">
                <i />
                <i />
              </span>
              有课
            </span>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="row-between">
            <h2 className="mono">{formatCn(weekDays[0])} 起</h2>
            <span className="muted">周视图</span>
          </div>
          <div className="week-list">
            {weekDays.map((date) => {
              const dayPlan = plans.get(date) ?? generateDay(date, state)
              const courses = slotsForDate(date, state.calendar)
              return (
                <button
                  key={date}
                  type="button"
                  className={`week-row ${date === selected ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}`}
                  onClick={() => setSelected(date)}
                >
                  <span className="week-date">
                    {weekdayLabel(date)} {Number(date.slice(8, 10))}
                  </span>
                  <span className="week-body">
                    <span className={`pill phase-${dayPlan.phase}`}>{PHASE_LABELS[dayPlan.phase]}</span>
                    <span className="muted">{dayPlan.plannedMinutes > 0 ? `${dayPlan.plannedMinutes} 分钟` : `${dayPlan.tasks.length} 项`}</span>
                    {courses.length > 0 && (
                      <span className="week-courses">
                        {courses
                          .slice(0, 2)
                          .map((c) => `${c.start} ${c.code}${c.location ? ` ${c.location}` : ''}`)
                          .join(' · ')}
                        {courses.length > 2 ? ` 等 ${courses.length} 门` : ''}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <CourseList
        date={selected}
        onEdit={(slot) => setEditingSlot(slot)}
        onAdd={() => setEditingSlot('new')}
        showEmpty
      />

      <section className="card">
        <div className="row-between">
          <h2>{formatCn(selected)}</h2>
          <span className={`pill phase-${plan.phase}`}>{plan.phaseLabel}</span>
        </div>
        <div className="row-between hint">
          <span>
            {plan.plannedMinutes > 0 ? `${plan.plannedMinutes} 分钟` : `${plan.tasks.length} 项`} · 已完成{' '}
          {plan.doneMinutes} 分钟
          </span>
          <span>
            {completedCount(plan)}/{plan.tasks.length} 项
          </span>
        </div>
        <ProgressBar value={dayProgress(plan)} />
        {plan.note && <p className="notice">{plan.note}</p>}
        {plan.tasks.length === 0 && <p className="hint">这天没有任务。</p>}
      </section>

      <section className="stack">
        {plan.tasks.map((task, i) => (
          <TaskCard
            key={task.id}
            index={i}
            task={task}
            showSteps={false}
            runningSince={state?.running[task.id]}
            onStart={() => startTask(task)}
            onFinish={() => finishTask(task)}
            onUncheck={() => toggleTask(task, false)}
            onEdit={() => setEditing(task)}
          />
        ))}
        <button type="button" className="btn btn-outline" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} />
          在这天加任务
        </button>
      </section>

      {editing && (
        <TaskEditor
          date={selected}
          task={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {editingSlot && (
        <CourseEditor
          date={selected}
          slot={editingSlot === 'new' ? undefined : editingSlot}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  )
}
