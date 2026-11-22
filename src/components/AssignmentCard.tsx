// 首页「作业」模块：手动添加作业（课程 / 内容 / 截止日期），按截止日期显示还剩几天。

import { useState } from 'react'
import type { Assignment } from '../domain/types'
import { useRequiredState, useStore } from '../data/store'
import { sortAssignments, dueInfo, assignmentWhenLabel } from '../domain/assignments'
import { addDays } from '../domain/dates'
import { termForDate } from '../domain/phases'
import { Icon } from './Icons'
import { pushToast } from '../lib/notify'

export function AssignmentCard() {
  const state = useRequiredState()
  const { today, toggleAssignment } = useStore()
  const [editing, setEditing] = useState<Assignment | 'new' | null>(null)

  const list = sortAssignments(state.assignments)
  const pending = list.filter((item) => !item.doneAt).length
  const dueSoon = list.filter((item) => !item.doneAt && dueInfo(item.due, today).days <= 0).length

  return (
    <section className="card asgn-card">
      <div className="row-between">
        <h2>作业</h2>
        <div className="asgn-head-actions">
          {dueSoon > 0 && <span className="asgn-alert">{dueSoon} 项到期/逾期</span>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing('new')}>
            <Icon name="plus" size={14} />
            添加
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="hint">还没有作业。点「添加」记一条：选课程、写清楚要做什么、设个截止日期。</p>
      ) : (
        <>
          <ul className="asgn-list">
            {list.map((item) => {
              const info = dueInfo(item.due, today)
              const done = Boolean(item.doneAt)
              return (
                <li key={item.id} className={`asgn-item${done ? ' is-done' : ''}`}>
                  <button
                    type="button"
                    className="task-check"
                    onClick={() => toggleAssignment(item.id)}
                    aria-label={done ? '标记为未完成' : '标记为已完成'}
                  >
                    {done && <Icon name="check" size={13} />}
                  </button>
                  <button type="button" className="asgn-main" onClick={() => setEditing(item)}>
                    <span className="asgn-meta">
                      <span className="asgn-course">{item.courseCode || '未标课程'}</span>
                      {done ? (
                        <span className="asgn-due is-later">已完成</span>
                      ) : (
                        <span className={`asgn-due is-${info.tone}`}>{info.label}</span>
                      )}
                      <span className="asgn-date">{assignmentWhenLabel(item.due)}</span>
                    </span>
                    <strong className="asgn-title">{item.title}</strong>
                    {item.detail && <span className="asgn-detail">{item.detail}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="hint">{pending} 项未完成 · 点一条可以改内容或截止日期</p>
        </>
      )}

      {editing !== null && (
        <AssignmentEditor
          assignment={editing === 'new' ? null : editing}
          today={today}
          courses={Array.from(
            new Map(
              state.calendar.slots
                .filter((slot) => slot.termId === termForDate(today, state.calendar)?.id)
                .map((slot) => [slot.code, `${slot.code} ${slot.title}`]),
            ).values(),
          )}
          onClose={() => setEditing(null)}
          onSaved={(name) => pushToast(`已保存作业「${name}」`, '截止日期到了会显示还剩几天')}
        />
      )}
    </section>
  )
}

interface AssignmentEditorProps {
  assignment: Assignment | null
  today: string
  courses: string[]
  onClose: () => void
  onSaved: (title: string) => void
}

function AssignmentEditor({ assignment, today, courses, onClose, onSaved }: AssignmentEditorProps) {
  const { addAssignment, updateAssignment, deleteAssignment } = useStore()
  const [courseText, setCourseText] = useState(
    assignment ? `${assignment.courseCode} ${assignment.courseTitle}`.trim() : '',
  )
  const [title, setTitle] = useState(assignment?.title ?? '')
  const [detail, setDetail] = useState(assignment?.detail ?? '')
  const [due, setDue] = useState(assignment?.due ?? addDays(today, 7))

  /** 把「CYS102 微积分」拆成课程码 + 课程名；认不出课程码就整串当课程名 */
  function parseCourse(text: string): { courseCode: string; courseTitle: string } {
    const clean = text.trim()
    if (!clean) return { courseCode: '', courseTitle: '' }
    const known = courses.find((item) => item === clean)
    const source = known ?? clean
    const match = source.match(/^([A-Za-z]{2,5}\s?\d{3,4}[A-Za-z]?)\s+(.+)$/)
    if (match) return { courseCode: match[1].replace(/\s+/g, '').toUpperCase(), courseTitle: match[2].trim() }
    if (/^[A-Za-z]{2,5}\s?\d{3,4}[A-Za-z]?$/.test(clean)) {
      return { courseCode: clean.replace(/\s+/g, '').toUpperCase(), courseTitle: '' }
    }
    return { courseCode: '', courseTitle: clean }
  }

  function handleSave() {
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    const { courseCode, courseTitle } = parseCourse(courseText)
    const payload = { courseCode, courseTitle, title: cleanTitle, detail, due }
    if (assignment) {
      updateAssignment({ ...assignment, ...payload })
      onSaved(cleanTitle)
    } else {
      addAssignment(payload)
      onSaved(cleanTitle)
    }
    onClose()
  }

  function handleDelete() {
    if (!assignment) return
    if (!window.confirm(`删除作业「${assignment.title}」？`)) return
    deleteAssignment(assignment.id)
    onClose()
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="eyebrow">{assignment ? '修改作业' : '新增作业'}</p>
            <h2>作业详情</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="field">
          <label htmlFor="asgn-course">课程</label>
          <input
            id="asgn-course"
            list="asgn-course-options"
            value={courseText}
            placeholder="例如 CYS102 微积分"
            onChange={(event) => setCourseText(event.target.value)}
          />
          <datalist id="asgn-course-options">
            {courses.map((course) => (
              <option key={course} value={course} />
            ))}
          </datalist>
          {courseText.trim() && (
            <p className="field-hint">
              将保存为 {parseCourse(courseText).courseCode || '（未标课程码）'} ·
              {' '}
              {parseCourse(courseText).courseTitle || '（未填课程名）'}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="asgn-title">作业标题</label>
          <input
            id="asgn-title"
            value={title}
            placeholder="例如 习题 3：极限与连续"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="asgn-detail">具体要完成的内容</label>
          <textarea
            id="asgn-detail"
            rows={4}
            value={detail}
            placeholder="写清楚要做哪几题、交什么、有什么要求"
            onChange={(event) => setDetail(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="asgn-due">截止日期</label>
          <input id="asgn-due" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
          {due && <p className="field-hint">按马来西亚时间计算，今天 {today}。</p>}
        </div>

        <div className="modal-actions">
          {assignment && (
            <button type="button" className="btn btn-ghost" onClick={handleDelete}>
              <Icon name="trash" size={16} />
              删除
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!title.trim()}>
            <Icon name="check" size={16} />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
