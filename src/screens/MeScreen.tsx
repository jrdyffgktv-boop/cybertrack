import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { CourseSlot, StudyWindow, Weekday } from '../domain/types'
import { useRequiredState, useStore } from '../data/store'
import {
  addDays,
  dateRange,
  formatCn,
  weekdayLabel,
  WEEKDAY_FULL,
} from '../domain/dates'
import { termForDate } from '../domain/phases'
import { generateDay } from '../domain/generator'
import {
  DOMAINS,
  cumulativeMinutes,
  dailyMinutes,
  domainMinutes,
  streakDays,
  weekSummary,
} from '../domain/progress'
import { DOMAIN_COLORS, DOMAIN_LABELS } from '../domain/labels'
import { downloadTextFile, planIcs } from '../domain/ics'
import { ensureNotificationPermission, notificationPermission, pushToast } from '../lib/notify'
import { Icon } from '../components/Icons'
import { ProgressBar } from '../components/Progress'
import { CourseImporter } from '../components/CourseImporter'

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  )
}

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

export function MeScreen() {
  const state = useRequiredState()
  const {
    today,
    updateSettings,
    addSlot,
    updateSlot,
    removeSlot,
    addHoliday,
    removeHoliday,
    reset,
    resetProgress,
    exportJson,
    importJson,
  } = useStore()

  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [holidayDate, setHolidayDate] = useState(today)
  const [holidayName, setHolidayName] = useState('')
  const term = termForDate(today, state.calendar)
  const [importOpen, setImportOpen] = useState(false)
  const [slotForm, setSlotForm] = useState<Omit<CourseSlot, 'id'>>({
    termId: term?.id ?? state.calendar.terms[0]?.id ?? 't-2026-09',
    code: '',
    title: '',
    weekday: 1,
    start: '08:00',
    end: '10:00',
    location: '',
  })

  const weekStart = addDays(today, -6)
  const last7 = useMemo(() => dailyMinutes(weekStart, today, state), [weekStart, today, state])
  const byDomain = useMemo(() => domainMinutes(weekStart, today, state), [weekStart, today, state])
  const week = weekSummary(today, state)
  const maxDaily = Math.max(60, ...last7.map((d) => d.minutes))
  const domainTotal = DOMAINS.reduce((sum, d) => sum + byDomain[d], 0)

  function patchWindow(wd: Weekday, patch: Partial<StudyWindow>) {
    const next = { ...state.settings.studyWindows }
    next[wd] = { ...next[wd], ...patch }
    updateSettings({ studyWindows: next })
  }

  function handleExportJson() {
    downloadTextFile(`cybertrack-backup-${today}.json`, exportJson(), 'application/json;charset=utf-8')
    pushToast('已导出备份', '把 JSON 文件存到 iCloud 或邮件里留底。')
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = () => {
      const result = importJson(String(reader.result ?? ''))
      setImporting(false)
      pushToast(result.ok ? '已导入备份' : '导入失败', result.ok ? undefined : result.error)
    }
    reader.onerror = () => {
      setImporting(false)
      pushToast('导入失败', '文件读不出来')
    }
    reader.readAsText(file)
  }

  function handleResetProgress() {
    if (!window.confirm('清空打卡记录、课时进度和项目进度？课程表、锻炼、提醒设置和手动任务都会保留。')) return
    resetProgress()
    pushToast('学习进度已清空', '课程表、锻炼和设置都保留着。')
  }

  function handleReset() {
    if (!window.confirm('清空所有打卡、笔记和课表改动，恢复到初始状态？这个操作不能撤销。')) return
    reset()
    pushToast('已恢复初始状态')
  }

  async function askPermission() {
    const result = await ensureNotificationPermission()
    pushToast(
      result === 'granted' ? '通知权限已打开' : '通知权限没打开',
      result === 'granted' ? 'App 在前台或刚回到前台时，会弹出系统通知。' : '可以在 iPhone 设置里手动允许通知。',
    )
  }

  function exportIcs(days: number) {
    const start = days === 1 ? today : addDays(today, -(days - 1))
    const plans = dateRange(start, today).map((d) => generateDay(d, state))
    const name = days === 1 ? `cybertrack-${today}.ics` : 'cybertrack-week.ics'
    downloadTextFile(name, planIcs(plans, state.settings), 'text/calendar;charset=utf-8')
    pushToast('已生成 .ics', '在 iPhone 上用「日历」打开它，就能导入并真响铃提醒。')
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">统计 · 提醒 · 课表 · 数据</p>
          <h1>我的</h1>
        </div>
      </header>

      <section className="card">
        <div className="row-between">
          <h2>最近 7 天</h2>
          <span className="muted">
            共 {last7.reduce((s, d) => s + d.minutes, 0)} 分钟 · 连续 {streakDays(today, state)} 天
          </span>
        </div>
        <div className="bar-chart" role="img" aria-label="最近 7 天学习分钟数">
          {last7.map((d) => (
            <div key={d.date} className="bar-col">
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${Math.round((d.minutes / maxDaily) * 100)}%` }} />
              </div>
              <span className="bar-label">{weekdayLabel(d.date).slice(1)}</span>
            </div>
          ))}
        </div>
        <div className="row-between hint">
          <span>累计学习 {Math.round(cumulativeMinutes(today, state) / 60)} 小时</span>
          <span>
            本周 {week.doneMinutes}/{week.goalMinutes} 分钟
          </span>
        </div>
        <ProgressBar value={week.goalRate} />
      </section>

      <Section title="各领域投入（最近 7 天）">
        {DOMAINS.map((domain) => {
          const minutes = byDomain[domain]
          const percent = domainTotal ? minutes / domainTotal : 0
          return (
            <div key={domain} className="domain-row">
              <div className="row-between">
                <span className="domain-name">
                  <i className="dot" style={{ background: DOMAIN_COLORS[domain] }} />
                  {DOMAIN_LABELS[domain]}
                </span>
                <span className="muted">{minutes} 分钟</span>
              </div>
              <ProgressBar value={percent} color={DOMAIN_COLORS[domain]} height={4} />
            </div>
          )
        })}
        {domainTotal === 0 && <p className="hint">还没有打卡记录。完成一个任务就会出现在这里。</p>}
      </Section>

      <Section title="提醒" hint="网页/PWA 在 iPhone 后台无法本地定时；最可靠的提醒是导出 .ics 导入系统日历。">
        <label className="toggle-row">
          <span>开启提醒</span>
          <input
            type="checkbox"
            checked={state.settings.remindersEnabled}
            onChange={(e) => updateSettings({ remindersEnabled: e.target.checked })}
          />
        </label>
        <label className="toggle-row">
          <span>每项任务单独提醒</span>
          <input
            type="checkbox"
            checked={state.settings.perTaskReminders}
            onChange={(e) => updateSettings({ perTaskReminders: e.target.checked })}
          />
        </label>
        <label className="toggle-row">
          <span>考试周自动减少提醒</span>
          <input
            type="checkbox"
            checked={state.settings.examRemindersReduced}
            onChange={(e) => updateSettings({ examRemindersReduced: e.target.checked })}
          />
        </label>
        <div className="field-row">
          <div className="field">
            <label htmlFor="lead">提前（分钟）</label>
            <input
              id="lead"
              type="number"
              min={0}
              max={120}
              value={state.settings.reminderLeadMin}
              onChange={(e) => updateSettings({ reminderLeadMin: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="field">
            <label htmlFor="nightly">每晚检查时间</label>
            <input
              id="nightly"
              type="time"
              value={state.settings.nightlyCheckIn}
              onChange={(e) => updateSettings({ nightlyCheckIn: e.target.value })}
            />
          </div>
        </div>
        <p className="hint">当前通知权限：{notificationPermission()}</p>
        <div className="action-row">
          <button type="button" className="btn btn-ghost" onClick={() => void askPermission()}>
            <Icon name="bell" size={16} />
            打开通知权限
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => exportIcs(1)}>
            <Icon name="download" size={16} />
            导出今日 .ics
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => exportIcs(7)}>
            <Icon name="download" size={16} />
            导出本周 .ics
          </button>
        </div>
      </Section>

      <Section title="学习时间" hint="每周目标按真实可用的时间设，别照抄 9 小时。">
        <div className="field-row">
          <div className="field">
            <label htmlFor="goal">每周目标（小时）</label>
            <input
              id="goal"
              type="number"
              min={1}
              max={40}
              value={state.settings.weeklyGoalHours}
              onChange={(e) => updateSettings({ weeklyGoalHours: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="field">
            <label htmlFor="daily-start">默认开始时间</label>
            <input
              id="daily-start"
              type="time"
              value={state.settings.dailyStartTime}
              onChange={(e) => updateSettings({ dailyStartTime: e.target.value })}
            />
          </div>
        </div>
        <div className="window-list">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="window-row">
              <span className="window-day">{WEEKDAY_FULL[wd - 1]}</span>
              <input
                type="time"
                value={state.settings.studyWindows[wd].start}
                onChange={(e) => patchWindow(wd, { start: e.target.value })}
              />
              <input
                type="number"
                min={0}
                max={480}
                value={state.settings.studyWindows[wd].maxMinutes}
                onChange={(e) => patchWindow(wd, { maxMinutes: Math.max(0, Number(e.target.value) || 0) })}
              />
              <span className="muted">分钟</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="课程表"
        hint={`当前学期：${term?.name ?? '未识别'}。换学期后请重新录入课程；留空表示那天没课。`}
      >
        <div className="import-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={16} />
            智能导入课表
          </button>
          <span className="muted">支持教务导出的 .html，或直接粘贴文本</span>
        </div>
        <div className="slot-list">
          {state.calendar.slots.map((slot) => (
            <div key={slot.id} className="slot-row">
              <div className="slot-main">
                <strong>{slot.code}</strong>
                <span className="muted">{slot.title}</span>
              </div>
              <div className="slot-edit">
                <select
                  value={slot.weekday}
                  onChange={(e) => updateSlot({ ...slot, weekday: Number(e.target.value) as Weekday })}
                  aria-label="星期"
                >
                  {WEEKDAY_FULL.map((label, i) => (
                    <option key={label} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) => updateSlot({ ...slot, start: e.target.value })}
                  aria-label="开始"
                />
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) => updateSlot({ ...slot, end: e.target.value })}
                  aria-label="结束"
                />
                <input
                  className="slot-loc-input"
                  value={slot.location ?? ''}
                  onChange={(e) => updateSlot({ ...slot, location: e.target.value || undefined })}
                  placeholder="地点 A5#G07"
                  aria-label="地点"
                />
                <button type="button" className="icon-btn" onClick={() => removeSlot(slot.id)} aria-label="删除课程">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))}
          {state.calendar.slots.length === 0 && <p className="hint">还没有课程。下面添加当前学期的课。</p>}
        </div>

        <div className="inline-form">
          <input
            value={slotForm.code}
            placeholder="课程码 CYS102"
            onChange={(e) => setSlotForm({ ...slotForm, code: e.target.value })}
          />
          <input
            value={slotForm.title}
            placeholder="课程名"
            onChange={(e) => setSlotForm({ ...slotForm, title: e.target.value })}
          />
        </div>
        <div className="inline-form">
          <select
            value={slotForm.weekday}
            onChange={(e) => setSlotForm({ ...slotForm, weekday: Number(e.target.value) as Weekday })}
            aria-label="星期"
          >
            {WEEKDAY_FULL.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={slotForm.start}
            onChange={(e) => setSlotForm({ ...slotForm, start: e.target.value })}
            aria-label="开始"
          />
          <input
            type="time"
            value={slotForm.end}
            onChange={(e) => setSlotForm({ ...slotForm, end: e.target.value })}
            aria-label="结束"
          />
          <input
            value={slotForm.location ?? ''}
            onChange={(e) => setSlotForm({ ...slotForm, location: e.target.value })}
            placeholder="地点 A5#G07"
            aria-label="地点"
          />
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              if (!slotForm.code.trim()) {
                pushToast('先填课程码', '例如 CYS102')
                return
              }
              addSlot({
                ...slotForm,
                code: slotForm.code.trim(),
                title: slotForm.title.trim() || slotForm.code.trim(),
                location: slotForm.location?.trim() || undefined,
              })
              setSlotForm({ ...slotForm, code: '', title: '' })
              pushToast('已添加课程')
            }}
          >
            添加
          </button>
        </div>
      </Section>

      {importOpen && <CourseImporter onClose={() => setImportOpen(false)} onManualAdd={() => setImportOpen(false)} />}

      <Section title="公共假期 / 休息日" hint="这些天默认不排任务。2027 年部分宗教节日可能微调，可自行改。">
        <ul className="plain-list">
          {state.calendar.holidays.map((holiday) => (
            <li key={holiday.date} className="holiday-row">
              <span>
                <strong>{formatCn(holiday.date)}</strong>
                <span className="hint">{holiday.name}</span>
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeHoliday(holiday.date)}
                aria-label="删除假期"
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
        <div className="inline-form">
          <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} aria-label="日期" />
          <input
            value={holidayName}
            placeholder="名称，例如 春节"
            onChange={(e) => setHolidayName(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              if (!holidayName.trim()) {
                pushToast('先填假期名称')
                return
              }
              addHoliday({ date: holidayDate, name: holidayName.trim(), restOnly: true })
              setHolidayName('')
              pushToast('已添加休息日')
            }}
          >
            添加
          </button>
        </div>
      </Section>

      <Section title="数据" hint="所有数据只存在这台 iPhone 的本地，不联网、不上传。换设备请先导出备份。">
        <div className="action-row">
          <button type="button" className="btn btn-ghost" onClick={handleExportJson}>
            <Icon name="download" size={16} />
            导出备份
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Icon name="refresh" size={16} />
            {importing ? '导入中…' : '导入备份'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleResetProgress}>
            <Icon name="refresh" size={16} />
            清空学习进度
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleReset}>
            <Icon name="trash" size={16} />
            清空数据
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </Section>

      <Section title="关于 CyberTrack">
        <p className="hint">
          CyberTrack 1.0 · 为 XMUM 网络安全大一设计的学习计划器。计划期 2026-11-23 到 2027-07-23，时区
          Asia/Kuala_Lumpur。
        </p>
        <p className="hint">
          iPhone 使用建议：Safari 打开后「分享 → 添加到主屏」，像 App 一样全屏使用；想靠系统提醒，请在「提醒」里导出
          .ics 并用日历打开导入。iOS 16.4 起网页推送需要先添加到主屏并授权，且服务端推送不在本 MVP 范围内。
        </p>
      </Section>
    </div>
  )
}
