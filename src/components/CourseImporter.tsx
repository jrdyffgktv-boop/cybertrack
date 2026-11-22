// 智能导入课表：解析教务导出的 .html 或粘贴文本，追加或替换当前学期课程。

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRequiredState, useStore } from '../data/store'
import { termForDate } from '../domain/phases'
import { formatShort, WEEKDAY_FULL } from '../domain/dates'
import { parseTimetableHtml, parseTimetableText, type ParsedSlot } from '../lib/courseImport'
import { Icon } from '../components/Icons'
import { pushToast } from '../lib/notify'

type Mode = 'append' | 'replace'

export function CourseImporter({ onClose, onManualAdd }: { onClose: () => void; onManualAdd: () => void }) {
  const state = useRequiredState()
  const { today, addSlot, removeSlot } = useStore()
  const [mode, setMode] = useState<Mode>('append')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const term = useMemo(() => termForDate(today, state.calendar), [today, state.calendar])

  const parsed: ParsedSlot[] = useMemo(() => {
    if (!text.trim()) return []
    try {
      return text.trim().startsWith('<') ? parseTimetableHtml(text) : parseTimetableText(text)
    } catch (err) {
      return []
    }
  }, [text])

  function handleFile(file: File) {
    setError(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.onerror = () => setError('读不了这个文件，换个 .html 试试。')
    reader.readAsText(file, 'utf-8')
  }

  function handleImport() {
    if (!term) {
      pushToast('没有可用学期', '先在「我的」里确认学期设置')
      return
    }
    if (parsed.length === 0) return
    let removed = 0
    if (mode === 'replace') {
      for (const slot of state.calendar.slots) {
        if (slot.termId !== term.id) continue
        removeSlot(slot.id)
        removed += 1
      }
    }
    // 替换模式下旧时段已经删掉，不该再拿它们去重
    const existing = new Set(
      mode === 'append'
        ? state.calendar.slots
            .filter((s) => s.termId === term.id)
            .map((s) => `${s.code}|${s.weekday}|${s.start}`)
        : [],
    )
    let added = 0
    for (const slot of parsed) {
      const key = `${slot.code}|${slot.weekday}|${slot.start}`
      if (existing.has(key)) continue
      existing.add(key)
      addSlot({
        termId: term.id,
        code: slot.code,
        title: slot.title,
        weekday: slot.weekday,
        start: slot.start,
        end: slot.end,
        location: slot.location,
      })
      added += 1
    }
    pushToast(`已导入 ${added} 个时段`, `${mode === 'replace' ? `替换掉 ${removed} 个旧时段 · ` : '追加 · '}${term.name}`)
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal import-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="eyebrow">仅在本机解析，不上传</p>
            <h2>智能导入课表</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>

        <button type="button" className="import-drop" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={22} />
          <strong>上传教务课表 HTML 文件</strong>
          <span className="muted">{fileName ?? '点击选择 .html 文件'}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,text/html"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        <p className="import-divider">或粘贴文本</p>
        <label className="field">
          <span>粘贴课表文本或网页源码</span>
          <textarea
            rows={5}
            value={text}
            placeholder={'例如：\nCYS102 Calculus 周一 08:00-10:00 A5#G07\nMPU1052 Malaysian Citra Tue 15:00-16:00 A4#105'}
            onChange={(e) => {
              setError(null)
              setText(e.target.value)
            }}
          />
        </label>
        <p className="hint">
          自动忽略「已缴费 / Paid」、学期号和多余额签；解析器认课程码（CYS102）、星期和 24 小时/12 小时时间。
        </p>

        <div className="row-between import-result">
          <span>识别结果：{parsed.length} 个时段</span>
          <div className="seg" role="group" aria-label="导入方式">
            <button type="button" className={mode === 'append' ? 'is-on' : ''} onClick={() => setMode('append')}>
              追加
            </button>
            <button type="button" className={mode === 'replace' ? 'is-on' : ''} onClick={() => setMode('replace')}>
              替换现有
            </button>
          </div>
        </div>

        {error && <p className="hint error">{error}</p>}

        {parsed.length > 0 && (
          <ul className="import-list">
            {parsed.map((slot, index) => (
              <li key={`${slot.code}-${slot.weekday}-${slot.start}-${index}`} className="import-row">
                <span className="import-code">{slot.code}</span>
                <span className="import-title">{slot.title}</span>
                <span className="muted">
                  {WEEKDAY_FULL[slot.weekday - 1]} {slot.start}–{slot.end}
                </span>
                {slot.location && <span className="course-loc">{slot.location}</span>}
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onManualAdd}>
            <Icon name="plus" size={16} />
            手动添加一门课
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
            disabled={parsed.length === 0 || Boolean(error)}
          >
            <Icon name="check" size={16} />
            导入 {parsed.length} 个时段
          </button>
        </div>
        <p className="hint">
          当前学期（{term ? `${term.name} · ${formatShort(term.start)} 起` : '未识别'}）导入后仍可逐门手动改时间、教室。
        </p>
      </div>
    </div>
    ,
    document.body,
  )
}
