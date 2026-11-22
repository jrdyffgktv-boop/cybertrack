// 首页「智能课表」卡：签到/Moodle 快捷入口、本周教学周、下一堂课倒计时、
// 今天课程、完整课表（周视图 + .ics）、分组编辑、智能导入。

import { useEffect, useMemo, useState } from 'react'
import type { CourseSlot } from '../domain/types'
import { useRequiredState, useStore } from '../data/store'
import { slotsForDate, termForDate, weekOfTerm } from '../domain/phases'
import { addDays, isoWeekday, timeToMinutes, TZ, WEEKDAY_FULL } from '../domain/dates'
import { CourseList } from './CourseList'
import { CourseEditor } from './CourseEditor'
import { CourseGroupEditor } from './CourseGroupEditor'
import { CourseImporter } from './CourseImporter'
import { TimetableModal } from './TimetableModal'
import { Icon } from './Icons'

const ATTENDANCE_URL = 'https://portal.xmu.edu.my/#/Studentpage'
const MOODLE_URL = 'https://l.xmu.edu.my/login/index.php'

/** 吉隆坡当地的「现在几点」分钟数 */
function nowMinutes(): number {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
  return timeToMinutes(text)
}

function countdownText(diffMinutes: number): string {
  if (diffMinutes <= 0) return '马上开始'
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  if (hours === 0) return `还有 ${minutes} 分钟`
  if (minutes === 0) return `还有 ${hours} 小时`
  return `还有 ${hours} 小时 ${minutes} 分钟`
}

interface TimetableCardProps {
  onOpenCalendarSettings: () => void
}

export function TimetableCard({ onOpenCalendarSettings }: TimetableCardProps) {
  const state = useRequiredState()
  const { today } = useStore()
  const [tick, setTick] = useState(0)
  const [editingSlot, setEditingSlot] = useState<CourseSlot | null>(null)
  const [groupOpen, setGroupOpen] = useState(false)
  const [weekOpen, setWeekOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const info = useMemo(() => {
    const term = termForDate(today, state.calendar)
    const week = term ? weekOfTerm(today, term) : 0
    const now = nowMinutes()

    let next: { slot: CourseSlot; offset: number; date: string } | null = null
    for (let offset = 0; offset < 8 && !next; offset++) {
      const date = addDays(today, offset)
      const slots = slotsForDate(date, state.calendar)
        .slice()
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
      for (const slot of slots) {
        if (offset > 0 || timeToMinutes(slot.start) > now) {
          next = { slot, offset, date }
          break
        }
      }
    }

    return { term, week, now, next }
    // tick 只用来让倒计时每 30 秒刷新
  }, [state.calendar, today, tick])

  const nextLabel = info.next
    ? info.next.offset === 0
      ? '今天'
      : info.next.offset === 1
        ? '明天'
        : WEEKDAY_FULL[isoWeekday(info.next.date) - 1]
    : null

  const nextDiff = info.next
    ? info.next.offset * 1440 + timeToMinutes(info.next.slot.start) - info.now
    : 0

  return (
    <section className="card tt-card">
      <div className="tt-head">
        <div className="tt-title">
          <Icon name="calendar" size={20} />
          <h2>智能课表</h2>
        </div>
        <div className="tt-actions">
          <button type="button" className="btn-mini" onClick={() => setWeekOpen(true)}>
            <Icon name="plan" size={14} />
            完整课表
          </button>
          <button type="button" className="btn-mini" onClick={() => setGroupOpen(true)}>
            编辑
          </button>
        </div>
      </div>

      <div className="tt-quick">
        <a className="tt-quick-btn is-primary" href={ATTENDANCE_URL} target="_blank" rel="noreferrer">
          <Icon name="check" size={18} />
          <span>
            <strong>一键直达上课签到</strong>
            <small>Attendance</small>
          </span>
        </a>
        <a className="tt-quick-btn" href={MOODLE_URL} target="_blank" rel="noreferrer">
          <Icon name="link" size={18} />
          <span>
            <strong>Moodle</strong>
            <small>课程资料</small>
          </span>
        </a>
      </div>

      <p className="tt-week">
        {info.term ? `第 ${info.week} 教学周 · ${info.term.name}` : '当前在学期之外，课表不生效'}
      </p>

      {info.next && nextLabel && (
        <div className="tt-next">
          <div className="row-between">
            <span className="tt-next-label">
              <span className="dot" />
              下一堂课
            </span>
            <span className="muted">{nextLabel}</span>
          </div>
          <strong className="tt-course">
            {info.next.slot.code} {info.next.slot.title}
          </strong>
          <span className="tt-meta">
            {info.next.slot.start} – {info.next.slot.end}
            {info.next.slot.location ? ` · ${info.next.slot.location}` : ''}
          </span>
          <span className="tt-countdown">距离上课{countdownText(nextDiff)}</span>
        </div>
      )}

      {!info.next && <p className="hint">接下来 7 天没有排课。</p>}

      <CourseList date={today} compact showEmpty onEdit={(slot) => setEditingSlot(slot)} />

      <div className="tt-actions-row">
        <button type="button" className="btn btn-ghost" onClick={() => setImportOpen(true)}>
          <Icon name="upload" size={16} />
          智能导入课表
        </button>
        <button type="button" className="btn btn-ghost" onClick={onOpenCalendarSettings}>
          <Icon name="plus" size={16} />
          校历设置
        </button>
      </div>

      {editingSlot && <CourseEditor date={today} slot={editingSlot} onClose={() => setEditingSlot(null)} />}
      {manualOpen && <CourseEditor date={today} onClose={() => setManualOpen(false)} />}
      {groupOpen && <CourseGroupEditor onClose={() => setGroupOpen(false)} />}
      {weekOpen && (
        <TimetableModal
          onClose={() => setWeekOpen(false)}
          onReimport={() => {
            setWeekOpen(false)
            setImportOpen(true)
          }}
        />
      )}
      {importOpen && (
        <CourseImporter
          onClose={() => setImportOpen(false)}
          onManualAdd={() => {
            setImportOpen(false)
            setManualOpen(true)
          }}
        />
      )}
    </section>
  )
}
