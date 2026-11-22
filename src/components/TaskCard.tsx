import { useEffect, useState } from 'react'
import type { Task } from '../domain/types'
import { DOMAIN_COLORS, DOMAIN_LABELS } from '../domain/labels'
import { elapsedSeconds, formatClock } from '../lib/timer'
import { Icon } from './Icons'

interface TaskCardProps {
  task: Task
  /** 正在计时时是开始时间（ISO），由持久化的 state.running 提供 */
  runningSince?: string
  onStart: () => void
  onFinish: () => void
  onUncheck: () => void
  onEdit?: () => void
  showSteps?: boolean
  /** 当天任务顺序（0 起），用来显示「第 N 项」而不是具体钟点 */
  index?: number
}

export function TaskCard({
  task,
  runningSince,
  onStart,
  onFinish,
  onUncheck,
  onEdit,
  showSteps = true,
  index,
}: TaskCardProps) {
  const isExercise = task.domain === 'exercise'
  const isRunning = !!runningSince
  // 锻炼只显示「锻炼 · 1 小时」；导入的计划没有建议时长，就不写分钟
  const duration = isExercise
    ? `${Math.round(task.minutes / 60)} 小时`
    : task.minutes > 0
      ? `${task.minutes} 分钟`
      : null
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!isRunning) return
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isRunning])

  return (
    <article className={`task-card ${task.done ? 'is-done' : ''} ${isRunning ? 'is-running' : ''}`}>
      {isRunning && runningSince ? (
        <button type="button" className="task-timer" onClick={onFinish} aria-label="结束计时">
          <span className="timer-label">结束</span>
          <span className="timer-clock">{formatClock(elapsedSeconds(runningSince))}</span>
        </button>
      ) : task.done ? (
        <button
          type="button"
          className="task-check"
          onClick={onUncheck}
          aria-label="取消完成"
          aria-pressed
        >
          <Icon name="check" size={14} />
        </button>
      ) : (
        <button type="button" className="task-start" onClick={onStart} aria-label="开始计时">
          开始
        </button>
      )}

      <div className="task-main">
        <div className="task-meta">
          <span className="dot" style={{ background: DOMAIN_COLORS[task.domain] }} />
          <span>{DOMAIN_LABELS[task.domain]}</span>
          {index !== undefined && !isExercise && (
            <>
              <span className="meta-sep">·</span>
              <span>第 {index + 1} 项</span>
            </>
          )}
          {duration && (
            <>
              <span className="meta-sep">·</span>
              <span>{duration}</span>
            </>
          )}
          {task.source === 'manual' && <span className="tag">手动</span>}
          {task.source === 'override' && <span className="tag">已调整</span>}
          {task.reminderOffsetMin && <span className="tag">提醒 -{task.reminderOffsetMin}m</span>}
        </div>
        <h3 className="task-title">{task.title}</h3>
        {showSteps && task.steps.length > 0 && (
          <ol className="task-steps">
            {task.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        <p className="task-deliverable">产出：{task.deliverable}</p>
      </div>

      {onEdit && (
        <button type="button" className="task-edit" onClick={onEdit} aria-label="编辑任务">
          <Icon name="chevron" size={18} />
        </button>
      )}
    </article>
  )
}
