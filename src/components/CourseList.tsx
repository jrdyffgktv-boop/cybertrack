import type { CourseSlot, DateKey } from '../domain/types'
import { slotsForDate } from '../domain/phases'
import { useRequiredState } from '../data/store'
import { Icon } from './Icons'

interface CourseListProps {
  date: DateKey
  onEdit?: (slot: CourseSlot) => void
  onAdd?: () => void
  /** 首页用紧凑版本：不显示标题行 */
  compact?: boolean
  /** 没有课时是否仍然显示卡片 */
  showEmpty?: boolean
}

/** 当天大学课程：时间、课程码、课名、地点一眼可见，点右侧箭头可改时间/地点。 */
export function CourseList({ date, onEdit, onAdd, compact = false, showEmpty = false }: CourseListProps) {
  const state = useRequiredState()
  const slots = slotsForDate(date, state.calendar)

  if (slots.length === 0 && !showEmpty) return null

  return (
    <section className="card course-card">
      {!compact && (
        <div className="row-between">
          <h2>当天课程</h2>
          <span className="muted">{slots.length > 0 ? `${slots.length} 门` : '没课'}</span>
        </div>
      )}

      {slots.length === 0 ? (
        <p className="hint">这天没有课。</p>
      ) : (
        <ul className="course-list">
          {slots.map((slot) => (
            <li key={slot.id} className="course-row">
              <span className="course-time mono">
                {slot.start}–{slot.end}
              </span>
              <span className="course-info">
                <strong>{slot.code}</strong>
                <span className="muted">{slot.title}</span>
              </span>
              {slot.location && (
                <span className="course-loc">
                  <Icon name="pin" size={13} />
                  {slot.location}
                </span>
              )}
              {onEdit && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onEdit(slot)}
                  aria-label={`编辑 ${slot.code} 的时间与地点`}
                >
                  <Icon name="chevron" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {onAdd && (
        <button type="button" className="btn btn-outline btn-small" onClick={onAdd}>
          <Icon name="plus" size={15} />
          添加这门课
        </button>
      )}
    </section>
  )
}
