import { useMemo, useState } from 'react'
import type { CourseSlot, DateKey, Task } from '../domain/types'
import { useRequiredState, useStore } from '../data/store'
import { generateDay } from '../domain/generator'
import { addDays, dateRange, formatCn, startOfWeek, weekdayLabel } from '../domain/dates'
import { completedCount, dayProgress } from '../domain/progress'
import { ProgressBar } from '../components/Progress'
import { TaskCard } from '../components/TaskCard'
import { TaskEditor } from '../components/TaskEditor'
import { CourseList } from '../components/CourseList'
import { CourseEditor } from '../components/CourseEditor'
import { Icon } from '../components/Icons'

export function PlanScreen() {
  const state = useRequiredState()
  const { today, startTask, finishTask, toggleTask } = useStore()
  const [selected, setSelected] = useState<DateKey>(today)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [editingSlot, setEditingSlot] = useState<CourseSlot | 'new' | null>(null)

  const days = useMemo(() => {
    const start = startOfWeek(selected)
    return dateRange(start, addDays(start, 6))
  }, [selected])

  const plans = useMemo(() => {
    const map = new Map<DateKey, ReturnType<typeof generateDay>>()
    for (const d of days) map.set(d, generateDay(d, state))
    return map
  }, [days, state])

  const plan = plans.get(selected) ?? generateDay(selected, state)

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">按日期自动生成，可随时修改</p>
          <h1>学习计划</h1>
        </div>
        <div className="week-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label="上一周"
            onClick={() => setSelected(addDays(selected, -7))}
          >
            <Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button type="button" className="btn btn-small" onClick={() => setSelected(today)}>
            回到今天
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="下一周"
            onClick={() => setSelected(addDays(selected, 7))}
          >
            <Icon name="chevron" size={18} />
          </button>
        </div>
      </header>

      <div className="week-strip">
        {days.map((date) => {
          const dayPlan = plans.get(date)
          if (!dayPlan) return null
          const doneAll = dayPlan.plannedMinutes > 0 && dayPlan.doneMinutes >= dayPlan.plannedMinutes
          return (
            <button
              key={date}
              type="button"
              className={`day-chip ${date === selected ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}`}
              onClick={() => setSelected(date)}
            >
              <span className="chip-wd">{weekdayLabel(date)}</span>
              <span className="chip-day">{Number(date.slice(8, 10))}</span>
              <span className={`chip-dot phase-${dayPlan.phase} ${doneAll ? 'is-done' : ''}`} />
            </button>
          )
        })}
      </div>

      <section className="card">
        <div className="row-between">
          <h2>{formatCn(selected)}</h2>
          <span className={`pill phase-${plan.phase}`}>{plan.phaseLabel}</span>
        </div>
        <div className="row-between hint">
          <span>
            {plan.plannedMinutes > 0
            ? `计划 ${plan.plannedMinutes} 分钟 · 已完成 ${plan.doneMinutes} 分钟`
            : `共 ${plan.tasks.length} 项 · 已计时 ${plan.doneMinutes} 分钟`}
          </span>
          <span>
            {completedCount(plan)}/{plan.tasks.length} 项
          </span>
        </div>
        <ProgressBar value={dayProgress(plan)} />
        {plan.conflict && (
          <p className="warn-inline">
            有任务和课程或其它安排时间重叠，已自动后移；点开任务可以手动改时间。
          </p>
        )}
        {plan.note && <p className="notice">{plan.note}</p>}
      </section>

      <CourseList
        date={selected}
        onEdit={(slot) => setEditingSlot(slot)}
        onAdd={() => setEditingSlot('new')}
        showEmpty
      />

      <section className="stack">
        {plan.tasks.map((task, i) => (
          <TaskCard
            key={task.id}
            index={i}
            task={task}
            runningSince={state?.running[task.id]}
            onStart={() => startTask(task)}
            onFinish={() => finishTask(task)}
            onUncheck={() => toggleTask(task, false)}
            onEdit={() => setEditing(task)}
          />
        ))}
        {plan.tasks.length === 0 && <p className="empty">这天没有任务。手动加一个，或者好好休息。</p>}
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
