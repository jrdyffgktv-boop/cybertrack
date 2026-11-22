import { useMemo, useState } from 'react'
import type { DateKey, Domain, Task } from '../domain/types'
import { DOMAIN_LABELS } from '../domain/labels'
import { clampMinutes, findConflicts, overrideIdFor } from '../domain/validate'
import { formatCn, isValidKey } from '../domain/dates'
import { useRequiredState, useStore } from '../data/store'
import { Icon } from './Icons'

const DOMAIN_OPTIONS: Domain[] = ['python', 'ai', 'security', 'course', 'project', 'review']
const MINUTE_OPTIONS = [15, 25, 30, 45, 60, 75, 90, 120]
const EMPTY_STEPS = ''

interface TaskEditorProps {
  date: DateKey
  task?: Task
  onClose: () => void
}

export function TaskEditor({ date, task, onClose }: TaskEditorProps) {
  const state = useRequiredState()
  const { saveTask, deleteTask } = useStore()

  const [title, setTitle] = useState(task?.title ?? '')
  const [domain, setDomain] = useState<Domain>(task?.domain ?? 'python')
  const [minutes, setMinutes] = useState(task?.minutes ?? 30)
  const [start, setStart] = useState(task?.start ?? '21:00')
  const [reminder, setReminder] = useState(task?.reminderOffsetMin ? String(task.reminderOffsetMin) : 'default')
  const [steps, setSteps] = useState(task ? task.steps.join('\n') : EMPTY_STEPS)
  const [deliverable, setDeliverable] = useState(task?.deliverable ?? '')
  const [error, setError] = useState<string | null>(null)

  const conflicts = useMemo(
    () => findConflicts(date, start, clampMinutes(minutes), state, task?.id),
    [state, date, start, minutes, task?.id],
  )

  // 自动任务的时长可能是 20 分钟这类不在预设里的值，必须保留，否则保存时会被悄悄改掉
  const minuteChoices = useMemo(() => {
    const set = new Set([...MINUTE_OPTIONS, clampMinutes(minutes)])
    return [...set].sort((a, b) => a - b)
  }, [minutes])

  const isAuto = task?.source === 'auto'

  function handleSave() {
    if (!title.trim()) {
      setError('标题要写清具体学什么，例如「CYS102 第 3 章：进程与线程」')
      return
    }
    const id = isAuto && task ? overrideIdFor(date, task.id) : (task?.id ?? `m:${date}:${Date.now().toString(36)}`)
    saveTask({
      id,
      date,
      domain,
      title: title.trim(),
      steps: steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      deliverable: deliverable.trim() || '（还没写产出）',
      minutes: clampMinutes(minutes),
      start,
      source: isAuto ? 'override' : (task?.source ?? 'manual'),
      replaces: isAuto ? task?.id : task?.replaces,
      reminderOffsetMin: reminder === 'default' ? undefined : Number(reminder),
      done: task?.done ?? false,
      courseCode: task?.courseCode,
      lessonId: task?.lessonId,
      projectTaskId: task?.projectTaskId,
    })
    onClose()
  }

  function handleDelete() {
    if (!task) return
    if (!window.confirm('删除这个任务？自动任务删除后不会再生成。')) return
    deleteTask(task)
    onClose()
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="eyebrow">{isAuto ? '修改自动任务' : task ? '编辑任务' : '新增任务'}</p>
            <h2>{isValidKey(date) ? formatCn(date) : date}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="field">
          <label htmlFor="task-title">学什么</label>
          <input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：CYS103 Lab 2 —— 用 Wireshark 抓一次 HTTP 请求"
            autoComplete="off"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="task-domain">领域</label>
            <select id="task-domain" value={domain} onChange={(e) => setDomain(e.target.value as Domain)}>
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-minutes">时长（分钟）</label>
            <select id="task-minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {minuteChoices.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-start">开始时间</label>
            <input id="task-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
        </div>
        <p className="field-hint">
          开始时间只用于「导出日历」和到点提醒，任务列表里只显示顺序和时长。
        </p>

        <div className="field">
          <label htmlFor="task-reminder">提醒</label>
          <select id="task-reminder" value={reminder} onChange={(e) => setReminder(e.target.value)}>
            <option value="default">跟随全局设置</option>
            <option value="5">提前 5 分钟</option>
            <option value="10">提前 10 分钟</option>
            <option value="15">提前 15 分钟</option>
            <option value="30">提前 30 分钟</option>
            <option value="60">提前 60 分钟</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="task-steps">操作步骤（一行一步）</label>
          <textarea
            id="task-steps"
            rows={4}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={'例：\n先看 10 分钟课件\n再手写一遍代码\n最后跑通并截图'}
          />
        </div>

        <div className="field">
          <label htmlFor="task-deliverable">完成标准（产出）</label>
          <input
            id="task-deliverable"
            value={deliverable}
            onChange={(e) => setDeliverable(e.target.value)}
            placeholder="例：一份能跑的脚本 + 一张运行截图"
          />
        </div>

        {conflicts.length > 0 && (
          <div className="warn">
            <strong>这个时间和已有安排冲突：</strong>
            <ul>
              {conflicts.map((c, i) => (
                <li key={i}>
                  {c.label} {c.start}–{c.end}
                </li>
              ))}
            </ul>
            <p>仍然可以保存，但建议换个开始时间。</p>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          {task && (
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              <Icon name="trash" size={16} />
              删除
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
