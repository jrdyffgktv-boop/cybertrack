// 运动页：独立记录、独立统计，不和学习任务混在一起。

import { useMemo, useState } from 'react'
import { useRequiredState, useStore } from '../data/store'
import { SPORTS, sportById } from '../data/content/sports'
import {
  caloriesOf,
  dailyExercise,
  exerciseDistance,
  exerciseKcal,
  exerciseMinutes,
  exerciseStreak,
  logsBetween,
  sportTotals,
} from '../domain/exercise'
import { endOfMonth, endOfWeek, formatShort, startOfMonth, startOfWeek, WEEKDAY_LABELS } from '../domain/dates'
import { Icon } from '../components/Icons'
import { pushToast } from '../lib/notify'

/** 配速文本，例如 5 分 42 秒/公里 */
function paceText(minutes: number, km: number): string {
  const perKm = minutes / km
  const whole = Math.floor(perKm)
  const seconds = Math.round((perKm - whole) * 60)
  if (seconds >= 60) return `${whole + 1}'00"/公里`
  return `${whole}'${String(seconds).padStart(2, '0')}"/公里`
}

export function ExerciseScreen() {
  const state = useRequiredState()
  const { today, logExercise, removeExerciseLog, updateSettings } = useStore()
  const [sportId, setSportId] = useState<string | null>(null)
  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('30')
  const [km, setKm] = useState('')
  const [weightDraft, setWeightDraft] = useState(String(state.settings.weightKg))

  // 体重输入：输入过程中只写草稿，失焦/回车时才校验并落库（否则边打字边取整会跳成 200）
  function commitWeight() {
    const parsed = Number(weightDraft)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setWeightDraft(String(state.settings.weightKg))
      return
    }
    const next = Math.min(220, Math.max(30, Math.round(parsed * 10) / 10))
    setWeightDraft(String(next))
    if (next !== state.settings.weightKg) updateSettings({ weightKg: next })
  }

  const weekStart = startOfWeek(today)
  const weekEnd = endOfWeek(today)
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const stats = useMemo(() => {
    const weekDaily = dailyExercise(weekStart, weekEnd, state)
    return {
      todayMinutes: exerciseMinutes(today, today, state),
      todayKcal: exerciseKcal(today, today, state),
      todayCount: logsBetween(today, today, state).length,
      todayKm: exerciseDistance(today, today, state),
      weekMinutes: exerciseMinutes(weekStart, weekEnd, state),
      weekKcal: exerciseKcal(weekStart, weekEnd, state),
      weekKm: exerciseDistance(weekStart, weekEnd, state),
      monthMinutes: exerciseMinutes(monthStart, monthEnd, state),
      monthKcal: exerciseKcal(monthStart, monthEnd, state),
      monthKm: exerciseDistance(monthStart, monthEnd, state),
      weekDaily,
      monthTotals: sportTotals(monthStart, monthEnd, state),
      streak: exerciseStreak(today, state),
    }
  }, [state, today, weekStart, weekEnd, monthStart, monthEnd])

  const todayLogs = logsBetween(today, today, state).slice().reverse()
  const activeSport = sportId ? sportById(sportId) : undefined
  const pickedMinutes = Math.max(0, Number(hours) || 0) * 60 + Math.max(0, Number(minutes) || 0)
  const pickedKcal = sportId ? caloriesOf(sportId, pickedMinutes, state.settings.weightKg) : 0
  const weekMax = Math.max(30, ...stats.weekDaily.map((d) => d.minutes))

  function openSheet(id: string) {
    setSportId(id)
    setHours('0')
    setMinutes('30')
    setKm('')
  }

  function handleSave() {
    if (!sportId) return
    if (pickedMinutes <= 0) {
      pushToast('先填时长', '小时和分钟至少填一个')
      return
    }
    const distance = sportId === 'run' && Number(km) > 0 ? Number(km) : undefined
    logExercise(sportId, pickedMinutes, today, distance)
    pushToast(
      `已记录${sportById(sportId)?.name ?? '运动'} ${pickedMinutes} 分钟`,
      `${distance ? `${distance} 公里 · ` : ''}≈ ${pickedKcal} 千卡（按 ${state.settings.weightKg}kg 估算）`,
    )
    setSportId(null)
  }

  return (
    <div className="screen ex-screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">独立页面 · 不占学习时长</p>
          <h1>运动</h1>
        </div>
        <span className="pill">连续 {stats.streak} 天</span>
      </header>

      <section className="card ex-hero">
        <p className="eyebrow">今日运动</p>
        <div className="ex-hero-row">
          <div>
            <strong className="ex-big">{stats.todayMinutes}</strong>
            <span className="muted">分钟</span>
          </div>
          <div>
            <strong className="ex-big">{stats.todayKcal}</strong>
            <span className="muted">千卡</span>
          </div>
          <div>
            <strong className="ex-big">{stats.todayCount}</strong>
            <span className="muted">次</span>
          </div>
        </div>
        {stats.todayKm > 0 && <p className="hint">今天跑步 {stats.todayKm} 公里</p>}        <label className="ex-weight">
          <span>体重</span>
          <input
            type="number"
            inputMode="decimal"
            min={30}
            max={200}
            value={weightDraft}
            onChange={(e) => setWeightDraft(e.target.value)}
            onBlur={commitWeight}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitWeight()
            }}
            aria-label="体重（公斤）"
          />
          <span className="muted">kg</span>
          <span className="hint">用于按 MET × 体重 × 小时 估算卡路里</span>
        </label>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>今天练什么</h2>
          <span className="muted">点一下记录时长</span>
        </div>
        <div className="sport-grid">
          {SPORTS.map((sport) => (
            <button key={sport.id} type="button" className="sport-card" onClick={() => openSheet(sport.id)}>
              <strong>{sport.name}</strong>
              <span className="muted">MET {sport.met}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>今日记录</h2>
          <span className="muted">{stats.todayCount} 次</span>
        </div>
        {todayLogs.length === 0 ? (
          <p className="hint">还没有记录。上面选一个项目，填时长就能打卡。</p>
        ) : (
          <ul className="ex-log-list">
            {todayLogs.map((log) => (
              <li key={log.id} className="ex-log-row">
                <div>
                  <strong>{sportById(log.sportId)?.name ?? '运动'}</strong>
                  <span className="muted">
                    {log.minutes} 分钟{log.distanceKm ? ` · ${log.distanceKm} 公里` : ''} ≈{' '}
                    {caloriesOf(log.sportId, log.minutes, state.settings.weightKg)} 千卡
                  </span>
                </div>
                <button type="button" className="icon-btn" onClick={() => removeExerciseLog(log.id)} aria-label="删除记录">
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>本周</h2>
          <span className="muted">
            {stats.weekMinutes} 分钟 · {stats.weekKcal} 千卡
            {stats.weekKm > 0 ? ` · ${stats.weekKm} 公里` : ''}
          </span>
        </div>
        <div className="ex-bars">
          {stats.weekDaily.map((day, index) => (
            <div key={day.date} className="ex-bar-col">
              <div className="ex-bar-track">
                <div
                  className="ex-bar-fill"
                  style={{ height: `${day.minutes > 0 ? Math.max(6, Math.round((day.minutes / weekMax) * 100)) : 0}%` }}
                />
              </div>
              <span className="ex-bar-label">{WEEKDAY_LABELS[index]}</span>
            </div>
          ))}
        </div>
        <p className="hint">
          {formatShort(weekStart)} – {formatShort(weekEnd)} · 每周运动目标建议 150 分钟以上
        </p>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>本月</h2>
          <span className="muted">
            {stats.monthMinutes} 分钟 · {stats.monthKcal} 千卡
            {stats.monthKm > 0 ? ` · ${stats.monthKm} 公里` : ''}
          </span>
        </div>
        {stats.monthTotals.length === 0 ? (
          <p className="hint">这个月还没有运动记录。</p>
        ) : (
          <ul className="ex-sport-list">
            {stats.monthTotals.map((item) => (
              <li key={item.sportId}>
                <div className="row-between">
                  <span>{sportById(item.sportId)?.name ?? '运动'}</span>
                  <span className="muted">
                    {item.minutes} 分钟 · {item.kcal} 千卡
                    {item.distanceKm > 0 ? ` · ${item.distanceKm} 公里` : ''} · {item.sessions} 次
                  </span>
                </div>
                <div className="bar">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.max(4, Math.round((item.minutes / Math.max(1, stats.monthMinutes)) * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>怎么算的</h2>
        <p className="hint">
          消耗 = MET × 体重({state.settings.weightKg}kg) × 小时。MET 是运动强度系数（跑步 9.8、篮球 6.5、羽毛球 5.5…），
          数值越大越费劲。运动只记在这里，不进学习任务、不算学习连续天数、不影响每周 540 分钟学习目标。
        </p>
      </section>

      {activeSport && (
        <div className="modal-overlay" role="presentation" onClick={() => setSportId(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <div>
                <p className="eyebrow">记录运动</p>
                <h2>
                  {activeSport.name} <span className="muted">MET {activeSport.met}</span>
                </h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSportId(null)} aria-label="关闭">
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="field-row">
              <div className="field">
                <label htmlFor="ex-hours">小时</label>
                <input
                  id="ex-hours"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={12}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="ex-minutes">分钟</label>
                <input
                  id="ex-minutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
            </div>

            <p className="hint">
              合计 {pickedMinutes} 分钟 · 预计消耗 {pickedKcal} 千卡（按 {state.settings.weightKg}kg 估算）
            </p>

            {activeSport.id === 'run' && (
              <div className="field">
                <label htmlFor="ex-km">里程（公里）</label>
                <input
                  id="ex-km"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.1}
                  value={km}
                  placeholder="例如 5.0"
                  onChange={(e) => setKm(e.target.value)}
                />
                <p className="field-hint">
                  选填。{Number(km) > 0 && pickedMinutes > 0 ? `按 ${km} 公里算，配速约 ${paceText(pickedMinutes, Number(km))}。` : '只记时长也能打卡。'}
                </p>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setSportId(null)}>
                取消
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                <Icon name="check" size={16} />
                打卡
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
