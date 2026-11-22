import { useState } from 'react'
import { useRequiredState, useStore } from '../data/store'
import { ALL_PROJECT_TASKS, NEXT_PROJECTS, PROJECT_FEATURES } from '../data/content'
import { ProgressBar, ProgressRing } from '../components/Progress'
import { Icon } from '../components/Icons'

export function ProjectScreen() {
  const state = useRequiredState()
  const { today, toggleProjectTask, setRepoUrl, setNotes } = useStore()
  const [repoDraft, setRepoDraft] = useState(state.project.repoUrl)
  const [notesDraft, setNotesDraft] = useState(state.project.notes)
  const [openFeature, setOpenFeature] = useState<string | null>(PROJECT_FEATURES[0]?.id ?? null)

  const doneMap = state.project.taskDone
  const total = ALL_PROJECT_TASKS.length
  const done = ALL_PROJECT_TASKS.filter((t) => doneMap[t.id]).length
  const nextTask = ALL_PROJECT_TASKS.find((t) => !doneMap[t.id])
  const nextFeature = nextTask ? PROJECT_FEATURES.find((f) => f.id === nextTask.featureId) : undefined

  function saveRepo() {
    setRepoUrl(repoDraft)
  }

  function saveNotes() {
    setNotes(notesDraft)
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">作品集主线 · 逐步交付</p>
          <h1>CyberGuard AI</h1>
        </div>
        <span className={`pill ${done === total ? 'phase-review' : 'phase-normal'}`}>
          {done}/{total}
        </span>
      </header>

      <section className="card ring-card">
        <ProgressRing value={total ? done / total : 0} size={128} stroke={9}>
          <strong>{Math.round((total ? done / total : 0) * 100)}%</strong>
          <span className="ring-sub">开发进度</span>
        </ProgressRing>
        <div className="ring-side">
          <div className="mini-stat">
            <Icon name="target" size={16} />
            <span>{PROJECT_FEATURES.length} 个功能模块</span>
          </div>
          <div className="mini-stat">
            <Icon name="check" size={16} />
            <span>已完成 {done} 个任务</span>
          </div>
          <div className="mini-stat">
            <Icon name="flame" size={16} />
            <span>剩余 {total - done} 个任务</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>GitHub 仓库</h2>
          {state.project.repoUrl && (
            <a className="link" href={state.project.repoUrl} target="_blank" rel="noreferrer">
              <Icon name="link" size={14} />
              打开
            </a>
          )}
        </div>
        <div className="inline-form">
          <input
            value={repoDraft}
            onChange={(e) => setRepoDraft(e.target.value)}
            placeholder="https://github.com/你的用户名/cyberguard-ai"
            inputMode="url"
            autoComplete="off"
          />
          <button type="button" className="btn btn-small" onClick={saveRepo}>
            保存
          </button>
        </div>
      </section>

      {nextTask && (
        <section className="card next-card">
          <p className="eyebrow">下一步（{nextFeature?.name ?? '项目'}）</p>
          <h2>{nextTask.title}</h2>
          <ol className="task-steps">
            {nextTask.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p className="hint">完成标准：{nextTask.deliverable} · 建议 {nextTask.minutes} 分钟</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => toggleProjectTask(nextTask.id, true, nextTask.minutes, today)}
          >
            <Icon name="check" size={16} />
            标记完成
          </button>
        </section>
      )}

      <section className="stack">
        <div className="row-between">
          <h2>功能与任务</h2>
          <span className="muted">{PROJECT_FEATURES.length} 个模块</span>
        </div>

        {PROJECT_FEATURES.map((feature) => {
          const featureDone = feature.tasks.filter((t) => doneMap[t.id]).length
          const open = openFeature === feature.id
          return (
            <article key={feature.id} className={`card feature ${open ? 'is-open' : ''}`}>
              <button
                type="button"
                className="feature-head"
                onClick={() => setOpenFeature(open ? null : feature.id)}
                aria-expanded={open}
              >
                <div className="feature-title">
                  <h3>{feature.name}</h3>
                  <p className="hint">{feature.goal}</p>
                </div>
                <span className="muted">
                  {featureDone}/{feature.tasks.length}
                </span>
              </button>
              <ProgressBar value={feature.tasks.length ? featureDone / feature.tasks.length : 0} />
              {open && (
                <ul className="feature-tasks">
                  {feature.tasks.map((task) => {
                    const isDone = !!doneMap[task.id]
                    return (
                      <li key={task.id} className={isDone ? 'is-done' : ''}>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={(e) => toggleProjectTask(task.id, e.target.checked, task.minutes, today)}
                          />
                          <span className="check-text">
                            <strong>{task.title}</strong>
                            <span className="hint">
                              {task.minutes} 分钟 · 产出：{task.deliverable}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
          )
        })}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>项目笔记</h2>
          <button type="button" className="btn btn-small" onClick={saveNotes}>
            保存
          </button>
        </div>
        <textarea
          rows={5}
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="记录踩坑、设计取舍、下一步想法……"
        />
      </section>

      <section className="card">
        <h2>后续项目</h2>
        <ul className="plain-list">
          {NEXT_PROJECTS.map((item) => (
            <li key={item}>
              <span className="hint">{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
