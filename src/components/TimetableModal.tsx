// 完整课表：周视图（时间网格）+ 日列表，可切换周、导出 .ics、重新上传 HTML。

import { useMemo, useState } from 'react'
import type { CourseSlot } from '../domain/types'
import { useRequiredState, useStore } from '../data/store'
import { slotsForDate, termForDate, weekOfTerm } from '../domain/phases'
import {
  addDays,
  endOfWeek,
  formatShort,
  isoWeekday,
  minutesToTime,
  startOfWeek,
  timeToMinutes,
  WEEKDAY_FULL,
} from '../domain/dates'
import { buildIcs, downloadTextFile, type IcsEvent } from '../domain/ics'
import { Icon } from './Icons'

interface TimetableModalProps {
  onClose: () => void
  onReimport: () => void
}

const PALETTE = ['#7aa2ff', '#5ee0b0', '#ffd166', '#c58bff', '#ff8fab', '#7dd3fc', '#fca5a5', '#a3e635']
const DAY_START = 8 * 60
const DAY_END = 20 * 60
const HOUR_PX = 46

function colorFor(code: string): string {
  let hash = 0
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) % 997
  return PALETTE[hash % PALETTE.length]
}

export function TimetableModal({ onClose, onReimport }: TimetableModalProps) {
  const state = useRequiredState()
  const { today } = useStore()
  const [offset, setOffset] = useState(0)
  const [view, setView] = useState<'week' | 'day'>('week')

  const weekStart = addDays(startOfWeek(today), offset * 7)
  const weekEnd = endOfWeek(weekStart)
  const term = termForDate(today, state.calendar)
  const weekNo = term && offset === 0 ? weekOfTerm(today, term) : null

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const byDay = useMemo(
    () =>
      days.map((date) => ({
        date,
        slots: slotsForDate(date, state.calendar)
          .slice()
          .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
      })),
    [days, state.calendar],
  )

  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60)
  const hasAny = byDay.some((d) => d.slots.length > 0)

  function exportWeek() {
    const events: IcsEvent[] = []
    for (const day of byDay) {
      for (const slot of day.slots) {
        events.push({
          uid: `class-${slot.id}-${day.date}@cybertrack`,
          date: day.date,
          start: slot.start,
          minutes: timeToMinutes(slot.end) - timeToMinutes(slot.start),
          summary: `${slot.code} ${slot.title}`,
          description: `${formatShort(day.date)} ${slot.start}–${slot.end}${slot.location ? ` · ${slot.location}` : ''}`,
        })
      }
    }
    if (events.length === 0) return
    downloadTextFile(
      `cybertrack-timetable-${weekStart}.ics`,
      buildIcs(events, 'CyberTrack 课程表'),
    )
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal tt-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="eyebrow">完整课表</p>
            <h2>{weekNo ? `Week ${weekNo} · 本周` : `${formatShort(weekStart)} 起`}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="tt-toolbar">
          <button type="button" className="icon-btn" aria-label="上一周" onClick={() => setOffset((n) => n - 1)}>
            <Icon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span className="muted tt-range">
            {formatShort(weekStart)} – {formatShort(weekEnd)}
          </span>
          <button type="button" className="icon-btn" aria-label="下一周" onClick={() => setOffset((n) => n + 1)}>
            <Icon name="chevron" size={16} />
          </button>
          <div className="seg">
            <button type="button" className={view === 'week' ? 'is-on' : ''} onClick={() => setView('week')}>
              周视图
            </button>
            <button type="button" className={view === 'day' ? 'is-on' : ''} onClick={() => setView('day')}>
              日列表
            </button>
          </div>
        </div>

        {term && <p className="hint">{term.name}</p>}

        {!hasAny && <p className="hint">这一周没有排课。</p>}

        {hasAny && view === 'week' && (
          <div className="tt-grid">
            <div className="tt-grid-hours">
              {hours.map((m) => (
                <span key={m} style={{ top: ((m - DAY_START) / 60) * HOUR_PX }}>
                  {minutesToTime(m)}
                </span>
              ))}
            </div>
            <div className="tt-grid-days">
              {byDay.map(({ date, slots }, index) => (
                <div key={date} className="tt-grid-day">
                  <div className={`tt-day-head ${isoWeekday(date) === isoWeekday(today) ? 'is-today' : ''}`}>
                    <span>{WEEKDAY_FULL[index]}</span>
                    <strong>{Number(date.slice(8, 10))}</strong>
                  </div>
                  <div className="tt-day-track" style={{ height: ((DAY_END - DAY_START) / 60) * HOUR_PX }}>
                    {hours.map((m) => (
                      <span key={m} className="tt-hour-line" style={{ top: ((m - DAY_START) / 60) * HOUR_PX }} />
                    ))}
                    {slots.map((slot: CourseSlot) => {
                      const top = ((timeToMinutes(slot.start) - DAY_START) / 60) * HOUR_PX
                      const height = Math.max(
                        28,
                        ((timeToMinutes(slot.end) - timeToMinutes(slot.start)) / 60) * HOUR_PX,
                      )
                      return (
                        <div
                          key={slot.id}
                          className="tt-block"
                          style={{ top, height, borderColor: colorFor(slot.code) }}
                        >
                          <strong>{slot.code}</strong>
                          {slot.location && <span className="tt-block-loc">{slot.location}</span>}
                          <span className="tt-block-time">
                            {slot.start}–{slot.end}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasAny && view === 'day' && (
          <div className="tt-list">
            {byDay.map(({ date, slots }) => (
              <div key={date} className="tt-list-day">
                <div className="row-between">
                  <strong>{formatShort(date)}</strong>
                  <span className="muted">{slots.length} 门</span>
                </div>
                {slots.length === 0 ? (
                  <p className="hint">没课</p>
                ) : (
                  slots.map((slot) => (
                    <div key={slot.id} className="tt-list-row" style={{ borderLeftColor: colorFor(slot.code) }}>
                      <span className="tt-list-time">
                        {slot.start}–{slot.end}
                      </span>
                      <span className="tt-list-code">{slot.code}</span>
                      <span className="tt-list-title">{slot.title}</span>
                      {slot.location && <span className="course-loc">{slot.location}</span>}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onReimport}>
            <Icon name="upload" size={16} />
            重新上传 HTML
          </button>
          <button type="button" className="btn btn-primary" onClick={exportWeek}>
            <Icon name="download" size={16} />
            导出 .ics
          </button>
        </div>
      </div>
    </div>
  )
}
