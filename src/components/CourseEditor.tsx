import { useState } from 'react'
import type { CourseSlot, Weekday } from '../domain/types'
import { WEEKDAY_FULL, isoWeekday } from '../domain/dates'
import { useRequiredState, useStore } from '../data/store'
import { termForDate } from '../domain/phases'
import { pushToast } from '../lib/notify'
import { Icon } from './Icons'

interface CourseEditorProps {
  /** 传入 = 修改这门课；不传 = 新增一门课 */
  slot?: CourseSlot
  /** 新增时默认用这一天的星期与学期 */
  date: string
  onClose: () => void
}

/** 改课表：调课、换教室都在这里改，改完学习计划和日历立刻同步。 */
export function CourseEditor({ slot, date, onClose }: CourseEditorProps) {
  const state = useRequiredState()
  const { addSlot, updateSlot, removeSlot } = useStore()

  const term = termForDate(date, state.calendar)
  const [code, setCode] = useState(slot?.code ?? '')
  const [title, setTitle] = useState(slot?.title ?? '')
  const [weekday, setWeekday] = useState<Weekday>(slot?.weekday ?? isoWeekday(date))
  const [start, setStart] = useState(slot?.start ?? '10:00')
  const [end, setEnd] = useState(slot?.end ?? '12:00')
  const [location, setLocation] = useState(slot?.location ?? '')
  const [allTimes, setAllTimes] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!code.trim()) {
      setError('课程码不能为空，例如 CYS102')
      return
    }
    if (start >= end) {
      setError('结束时间要晚于开始时间')
      return
    }
    const trimmed = {
      code: code.trim(),
      title: title.trim() || code.trim(),
      weekday,
      start,
      end,
      location: location.trim() || undefined,
    }
    if (slot) {
      if (allTimes) {
        // 整门课一起改：同一课程码的所有时段都套用这次的课程码/课名/地点
        for (const other of state.calendar.slots) {
          if (other.code !== slot.code) continue
          updateSlot({ ...other, code: trimmed.code, title: trimmed.title, location: trimmed.location })
        }
        pushToast('这门课的所有时段已更新', `${trimmed.code} × ${state.calendar.slots.filter((s) => s.code === slot.code).length} 个时段`)
      } else {
        updateSlot({ ...slot, ...trimmed })
        pushToast('这一节课已更新', `${trimmed.code} ${WEEKDAY_FULL[trimmed.weekday - 1]} ${trimmed.start}–${trimmed.end}`)
      }
    } else {
      addSlot({ termId: term?.id ?? '', ...trimmed })
      pushToast('课程已添加', `${trimmed.code} 每周${WEEKDAY_FULL[trimmed.weekday - 1]}`)
    }
    onClose()
  }

  function handleDelete() {
    if (!slot) return
    if (!window.confirm(`删除 ${slot.code} 这门课？删除后日历和学习计划里都不再显示。`)) return
    removeSlot(slot.id)
    pushToast('课程已删除', slot.code)
    onClose()
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="eyebrow">{slot ? '改课表' : '添加课程'}</p>
            <h2>{slot ? `${slot.code} · ${slot.title}` : '新课程'}</h2>
            {slot && (
              <p className="hint">
                每周{WEEKDAY_FULL[slot.weekday - 1]} {slot.start}–{slot.end}
                {slot.location ? ` · ${slot.location}` : ''}
              </p>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="field-row">
          <div className="field">
            <label htmlFor="course-code">课程码</label>
            <input id="course-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CYS102" />
          </div>
          <div className="field">
            <label htmlFor="course-title">课程名</label>
            <input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="微积分" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="course-weekday">星期</label>
          <select
            id="course-weekday"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value) as Weekday)}
          >
            {WEEKDAY_FULL.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="course-start">开始</label>
            <input id="course-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="course-end">结束</label>
            <input id="course-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="course-location">地点</label>
          <input
            id="course-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="A5#G07"
            autoComplete="off"
          />
          <p className="hint">调课或换教室时改这里；默认只改这一节课，其他时段不动。</p>
        </div>

        {slot && (
          <label className="check-row">
            <input type="checkbox" checked={allTimes} onChange={(e) => setAllTimes(e.target.checked)} />
            <span>同时修改 {slot.code} 的所有时段（整门课一起改）</span>
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          {slot && (
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
