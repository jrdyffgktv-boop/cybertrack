import { useState } from 'react'
import type { Task } from '../domain/types'
import { useRequiredState, useStore } from '../data/store'
import { generateDay } from '../domain/generator'
import { formatShort } from '../domain/dates'
import {
  completedCount,
  cumulativeMinutes,
  currentStage,
  dayProgress,
  daysToSummer,
  stageStats,
  streakDays,
  weekSummary,
} from '../domain/progress'
import { STAGE_LABELS } from '../domain/labels'
import { ProgressBar, ProgressRing } from '../components/Progress'
import { TaskCard } from '../components/TaskCard'
import { TaskEditor } from '../components/TaskEditor'
import { TimetableCard } from '../components/TimetableCard'
import { AssignmentCard } from '../components/AssignmentCard'
import { Icon } from '../components/Icons'
import { downloadTextFile, planIcs } from '../domain/ics'

interface HomeScreenProps {
  onOpenPlan: () => void
  onOpenTab: (tab: 'calendar' | 'me') => void
}

export function HomeScreen({ onOpenPlan, onOpenTab }: HomeScreenProps) {
  const state = useRequiredState()
  const { today, startTask, finishTask, toggleTask } = useStore()
  const [editing, setEditing] = useState<Task | 'new' | null>(null)

  const plan = generateDay(today, state)
  const progress = dayProgress(plan)
  const stage = currentStage(state)
  const stageStat = stageStats(state).find((s) => s.stage === stage)
  const streak = streakDays(today, state)
  const week = weekSummary(today, state)
  const totalHours = Math.round(cumulativeMinutes(today, state) / 60)

  function exportToday() {
    downloadTextFile(`cybertrack-${today}.ics`, planIcs([plan], state.settings))
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{formatShort(today)}</p>
          <h1>今天</h1>
        </div>
        <span className={`pill phase-${plan.phase}`}>{plan.phaseLabel}</span>
      </header>

      <section className="card ring-card">
        <ProgressRing value={progress}>
          <strong>{Math.round(progress * 100)}%</strong>
          <span className="ring-sub">
            {plan.doneMinutes}/{plan.plannedMinutes} 分钟
          </span>
        </ProgressRing>
        <div className="ring-side">
          <div className="mini-stat">
            <Icon name="check" size={16} />
            <span>
              已完成 {completedCount(plan)} / {plan.tasks.length} 项
            </span>
          </div>
          <div className="mini-stat">
            <Icon name="clock" size={16} />
            <span>{plan.plannedMinutes > 0 ? `计划 ${plan.plannedMinutes} 分钟` : `今日 ${plan.tasks.length} 项`}</span>
          </div>
          <div className="mini-stat">
            <Icon name="flame" size={16} />
            <span>连续 {streak} 天</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>本周目标</h2>
          <span className="muted">
            {week.doneMinutes} / {week.goalMinutes} 分钟
          </span>
        </div>
        <ProgressBar value={week.goalRate} />
        <p className="hint">
          目标完成率 {Math.round(week.goalRate * 100)}% · 还差 {Math.max(0, week.goalMinutes - week.doneMinutes)} 分钟
        </p>
      </section>

      <TimetableCard onOpenCalendarSettings={() => onOpenTab('me')} />

      <AssignmentCard />

      <div className="action-row">
        <button type="button" className="btn btn-ghost" onClick={exportToday}>
          <Icon name="download" size={16} />
          导出今日日历
        </button>
        <button type="button" className="btn btn-ghost" onClick={onOpenPlan}>
          <Icon name="plan" size={16} />
          全部任务
        </button>
      </div>

      <section className="stack">
        <div className="row-between">
          <h2>今日任务</h2>
          <span className="muted">{plan.tasks.length} 项</span>
        </div>
        {plan.note && <p className="notice">{plan.note}</p>}
        {plan.tasks.length === 0 && (
          <p className="empty">今天按计划休息，不安排任务。想学一点的话，在下面手动加一个。</p>
        )}
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
        <button type="button" className="btn btn-outline" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} />
          加一个任务
        </button>
      </section>

      <section className="card">
        <div className="row-between">
          <div>
            <p className="eyebrow">当前学习阶段</p>
            <h2>{STAGE_LABELS[stage]}</h2>
          </div>
          <span className="muted">{stageStat ? `${stageStat.done}/${stageStat.total}` : ''}</span>
        </div>
        <ProgressBar value={stageStat ? stageStat.percent / 100 : 0} color="var(--accent)" />
        <div className="grid-2 spread">
          <div>
            <span className="muted">距离暑假</span>
            <strong className="big">{daysToSummer(today)} 天</strong>
          </div>
          <div>
            <span className="muted">累计学习</span>
            <strong className="big">{totalHours} 小时</strong>
          </div>
        </div>
      </section>

      {editing && (
        <TaskEditor
          date={today}
          task={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
