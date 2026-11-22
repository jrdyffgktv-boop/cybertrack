// 编辑课表：按课程分组，每门课下面的时间片可以直接删，也可以整门/全部清空。

import { useMemo, useState } from 'react'
import type { CourseSlot } from '../domain/types'
import { useRequiredState, useStore } from '../data/store'
import { termForDate } from '../domain/phases'
import { WEEKDAY_FULL } from '../domain/dates'
import { CourseEditor } from './CourseEditor'
import { Icon } from './Icons'
import { pushToast } from '../lib/notify'

interface CourseGroupEditorProps {
  onClose: () => void
}

interface Group {
  key: string
  code: string
  title: string
  slots: CourseSlot[]
}

export function CourseGroupEditor({ onClose }: CourseGroupEditorProps) {
  const state = useRequiredState()
  const { today, removeSlot } = useStore()
  const [addOpen, setAddOpen] = useState(false)

  const term = termForDate(today, state.calendar)

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const slot of state.calendar.slots) {
      if (term && slot.termId !== term.id) continue
      const key = `${slot.code}|${slot.title}`
      const group = map.get(key) ?? { key, code: slot.code, title: slot.title, slots: [] }
      group.slots.push(slot)
      map.set(key, group)
    }
    return [...map.values()]
      .map((g) => ({ ...g, slots: g.slots.slice().sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)) }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [state.calendar.slots, term])

  function removeGroup(group: Group) {
    if (!window.confirm(`删除 ${group.code} ${group.title} 的全部时段？`)) return
    group.slots.forEach((slot) => removeSlot(slot.id))
    pushToast(`已删除 ${group.code}`, `${group.slots.length} 个时段`)
  }

  function clearAll() {
    if (!window.confirm('清空这个学期的全部课程？只影响课表，不影响任务和打卡。')) return
    groups.forEach((group) => group.slots.forEach((slot) => removeSlot(slot.id)))
    pushToast('已清空课表', '可以用「智能导入课表」重新导入')
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal cg-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="eyebrow">选填；改完立即生效，仅保存在本机</p>
            <h2>编辑我的课表</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="row-between">
          <strong>我的课程（{groups.length} 门）</strong>
          <button type="button" className="btn-mini" onClick={clearAll} disabled={groups.length === 0}>
            清空全部
          </button>
        </div>

        {groups.length === 0 && <p className="hint">这个学期还没有课。用「智能导入课表」或下面手动加一门。</p>}

        <ul className="cg-list">
          {groups.map((group) => (
            <li key={group.key} className="cg-group">
              <div className="row-between">
                <strong className="cg-name">
                  {group.code} {group.title}
                </strong>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeGroup(group)}
                  aria-label={`删除 ${group.code}`}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="cg-chips">
                {group.slots.map((slot) => (
                  <span key={slot.id} className="cg-chip">
                    {WEEKDAY_FULL[slot.weekday - 1]} {slot.start}–{slot.end}
                    <button
                      type="button"
                      className="cg-chip-x"
                      onClick={() => removeSlot(slot.id)}
                      aria-label={`删除 ${slot.code} ${slot.start}`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} />
            手动添加一门课
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            完成
          </button>
        </div>

        {addOpen && <CourseEditor date={today} onClose={() => setAddOpen(false)} />}
      </div>
    </div>
  )
}
