import { describe, expect, it } from 'vitest'
import { createDefaultState } from '../data/defaults'
import { generateDay } from '../domain/generator'
import { IMPORTED_DAYS } from '../data/content/plan-import'
import type { PersistedState, Task } from '../domain/types'

function baseState(): PersistedState {
  return createDefaultState()
}

describe('generateDay（用户导入的 243 天计划）', () => {
  it('2026-11-23 当天一条导入任务，标题与产出照抄 xlsx', () => {
    const plan = generateDay('2026-11-23', baseState())
    expect(plan.phase).toBe('normal')
    expect(plan.tasks.map((t) => t.id)).toEqual(['i:2026-11-23:0'])
    const task = plan.tasks[0]
    expect(task.title).toBe('Linux与开发环境 · 认识概念与术语')
    expect(task.domain).toBe('security')
    expect(task.steps[0]).toContain('内容：')
    expect(task.steps.length).toBeGreaterThanOrEqual(2)
    expect(task.deliverable).toBe('写下5个关键词并各用一句话解释')
    // xlsx 没有时长列：不编造分钟数，等用户点开始/结束计时
    expect(task.minutes).toBe(0)
    expect(plan.plannedMinutes).toBe(0)
    expect(plan.conflict).toBe(false)
  })

  it('243 个导入日都只有 1 条导入任务，且内容不为空', () => {
    const state = baseState()
    for (const [date, day] of Object.entries(IMPORTED_DAYS)) {
      const plan = generateDay(date, state)
      const imported = plan.tasks.filter((t) => t.id.startsWith('i:'))
      expect(imported, date).toHaveLength(1)
      expect(imported[0].title, date).toContain(day.weekTheme)
      expect(imported[0].steps.length, date).toBeGreaterThan(0)
      expect(imported[0].deliverable.length, date).toBeGreaterThan(0)
    }
  })

  it('公共假期仍用导入的轻量任务，并显示假期备注', () => {
    const plan = generateDay('2026-12-25', baseState())
    expect(plan.phase).toBe('holiday')
    expect(plan.tasks.filter((t) => t.id.startsWith('i:'))).toHaveLength(1)
    expect(plan.note).toContain('Christmas')
  })

  it('考试周的导入任务是复盘类，不含新知识课时', () => {
    const plan = generateDay('2027-01-12', baseState())
    expect(plan.phase).toBe('exam')
    expect(plan.tasks).toHaveLength(1)
    expect(plan.tasks[0].domain).toBe('review')
  })

  it('复习周同样是轻量复盘任务', () => {
    const plan = generateDay('2027-07-05', baseState())
    expect(plan.phase).toBe('review')
    expect(plan.tasks.every((t) => t.domain === 'review')).toBe(true)
  })

  it('计划结束后（暑假）回到课时模板，不再有导入任务', () => {
    const plan = generateDay('2027-08-02', baseState())
    expect(plan.phase).toBe('holiday')
    expect(plan.tasks.filter((t) => t.id.startsWith('i:'))).toHaveLength(0)
    expect(plan.tasks.length).toBeGreaterThan(0)
  })

  it('完成的课时不再重复出现（游标只认更早的完成日）', () => {
    const state = baseState()
    const day = '2027-08-02'
    const first = generateDay(day, state)
    const firstLesson = first.tasks.find((t) => t.lessonId)?.lessonId
    expect(firstLesson).toBeTruthy()

    const done: PersistedState = {
      ...state,
      lessonDone: { ...state.lessonDone, [firstLesson as string]: '2027-07-01' },
    }
    const second = generateDay(day, done)
    const secondLesson = second.tasks.find((t) => t.lessonId)?.lessonId
    expect(secondLesson).toBeTruthy()
    expect(secondLesson).not.toBe(firstLesson)
  })

  it('手动任务保留开始时间，且不影响导入任务', () => {
    const custom: Task = {
      id: 'c:test-1',
      date: '2026-11-23',
      domain: 'project',
      title: '手动：写项目 README',
      steps: ['列出功能', '写安装说明'],
      deliverable: 'README.md',
      minutes: 30,
      start: '20:00',
      source: 'manual',
      done: false,
    }
    const state: PersistedState = { ...baseState(), customTasks: [custom] }
    const plan = generateDay('2026-11-23', state)
    const found = plan.tasks.find((t) => t.id === 'c:test-1')
    expect(found).toBeTruthy()
    expect(found?.start).toBe('20:00')
    expect(plan.tasks.filter((t) => t.id.startsWith('i:'))).toHaveLength(1)
  })

  it('删除导入任务后当天不再出现（hiddenTaskIds）', () => {
    const state: PersistedState = { ...baseState(), hiddenTaskIds: ['i:2026-11-23:0'] }
    const plan = generateDay('2026-11-23', state)
    expect(plan.tasks).toHaveLength(0)
  })

  it('同一天重复生成结果一致（无随机）', () => {
    const state = baseState()
    const a = generateDay('2026-11-25', state)
    const b = generateDay('2026-11-25', state)
    expect(a.tasks.map((t) => t.id)).toEqual(b.tasks.map((t) => t.id))
  })
})

describe('计划开始前（2026-11-23 之前）', () => {
  it('不生成任何自动任务，计划时长为 0', () => {
    const state = baseState()
    for (const date of ['2026-09-01', '2026-10-26', '2026-11-01', '2026-11-21', '2026-11-22']) {
      const plan = generateDay(date, state)
      expect(plan.tasks, date).toHaveLength(0)
      expect(plan.plannedMinutes, date).toBe(0)
    }
  })

  it('计划从 2026-11-23 起立刻有任务（不会多留一天空窗）', () => {
    const plan = generateDay('2026-11-23', baseState())
    expect(plan.tasks.length).toBeGreaterThan(0)
  })

  it('计划开始前的日期仍可手动加任务', () => {
    const custom: Task = {
      id: 'c:early-1',
      date: '2026-11-22',
      domain: 'python',
      title: '手动：装好 Python 环境',
      steps: ['下载 Python', '跑 hello world'],
      deliverable: 'python 能运行',
      minutes: 30,
      source: 'manual',
      done: false,
    }
    const state: PersistedState = { ...baseState(), customTasks: [custom] }
    const plan = generateDay('2026-11-22', state)
    expect(plan.tasks.map((t) => t.id)).toEqual(['c:early-1'])
  })
})
