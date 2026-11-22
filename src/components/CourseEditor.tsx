import { useState } from 'react'
import type { CourseSlot, Weekday } from '../domain/types'
import { WEEKDAY_FULL, isoWeekday } from '../domain/dates'
import { useRequiredState, useStore } from '../data/store'
import { exceptionFor, termForDate } from '../domain/phases'
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
  const { addSlot, saveSlotOccurrence, deleteSlotOccurrence, clearSlotException } = useStore()

  const term = termForDate(date, state.calendar)
  const existingException = slot ? exceptionFor(date, slot.id, state.calendar) : undefined
  const [code, setCode] = useState(slot?.code ?? '')
  const [title, setTitle] = useState(slot?.title ?? '')
  const [weekday, setWeekday] = useState<Weekday>(slot?.weekday ?? isoWeekday(date))
  const [start, setStart] = useState(slot?.start ?? '10:00')
  const [end, setEnd] = useState(slot?.end ?? '12:00')
  const [location, setLocation] = useState(slot?.location ?? '')
  const [scope, setScope] = useState<'once' | 'series'>('once')
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
      saveSlotOccurrence(date, slot, trimmed, scope)
      pushToast(
        scope === 'once' ? '只改了这一次' : '以后每周都按新安排',
        scope === 'once'
          ? `${date} ${trimmed.start}–${trimmed.end}，下一周不变`
          : `${trimmed.code} ${WEEKDAY_FULL[trimmed.weekday - 1]} ${trimmed.start}–${trimmed.end}`,
      )
    } else {
      addSlot({ termId: term?.id ?? '', ...trimmed })
      pushToast('课程已添加', `${trimmed.code} 每周${WEEKDAY_FULL[trimmed.weekday - 1]}`)
    }
    onClose()
  }

  function handleDelete() {
    if (!slot) return
    const question =
      scope === 'once'
        ? `只删除 ${date} 这一节 ${slot.code}？其他周不变。`
        : `删除 ${slot.code} 这门课的所有时段？删除后日历和学习计划里都不再显示。`
    if (!window.confirm(question)) return
    deleteSlotOccurrence(date, slot, scope)
    pushToast(scope === 'once' ? '这一节已删除' : '这门课已删除', slot.code)
    onClose()
  }

  function handleRestore() {
    if (!slot) return
    clearSlotException(date, slot.id)
    pushToast('已恢复每周常规', `${slot.code} 回到原来的时间与地点`)
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
                {existingException ? ' · 这一天已单独调整' : ''}
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
          <p className="hint">
            默认只改这一天，下一周不变化；要整门课长期改，选「以后每周都改」。
          </p>
        </div>

        {slot && (
          <div className="field">
            <label>改动范围</label>
            <div className="seg">
              <button
                type="button"
                className={scope === 'once' ? 'is-on' : ''}
                onClick={() => setScope('once')}
              >
                只改这一天
              </button>
              <button
                type="button"
                className={scope === 'series' ? 'is-on' : ''}
                onClick={() => setScope('series')}
              >
                以后每周都改
              </button>
            </div>
            <p className="hint">
              {scope === 'once'
                ? `仅 ${date} 这一节课；其他日期按每周常规安排。`
                : `每周${WEEKDAY_FULL[weekday - 1]} ${start}–${end} 都会变。`}
            </p>
            {existingException && (
              <button type="button" className="btn btn-small btn-outline" onClick={handleRestore}>
                恢复每周常规
              </button>
            )}
          </div>
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
