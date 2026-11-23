// 每日计划生成：纯函数，输入「日期 + 持久化状态」，输出当天的完整计划。
// 自动任务不落库；打卡、自定义、完成记录才是数据源。

import type {
  CourseSlot,
  DateKey,
  DayPlan,
  Lesson,
  PersistedState,
  Phase,
  ProjectTask,
  Task,
} from './types'
import { isoWeekday, minutesToTime, rangesOverlap, timeToMinutes } from './dates'
import { composition, dayBudget } from './budget'
import { resolvePhase, slotsForDate, termWeekInfo } from './phases'
import { ALL_LESSONS, ALL_PROJECT_TASKS } from '../data/content'
import { IMPORTED_DAYS } from '../data/content/plan-import'
import { PLAN_START } from '../data/content/calendar'

const DAY_END = 23 * 60
const GAP = 10
const MIN_TASK = 15

/** 还没学过、或“今天才完成”的课时（当天完成后任务仍显示，只是打勾） */
export function availableLessons(date: DateKey, state: PersistedState): Lesson[] {
  return ALL_LESSONS.filter((l) => {
    const done = state.lessonDone[l.id]
    return !done || done >= date
  })
}

/** 项目任务同理：只跳过“在这天之前已经完成”的任务 */
export function availableProjectTasks(date: DateKey, state: PersistedState): ProjectTask[] {
  return ALL_PROJECT_TASKS.filter((t) => {
    const done = state.project.taskDone[t.id]
    return !done || done >= date
  })
}

function reviewTask(date: DateKey, slot: CourseSlot, phase: Phase, minutes: number, week: number): Task {
  const isExam = phase === 'exam'
  return {
    id: `${isExam ? 'e' : 'r'}:${date}:${slot.code}`,
    date,
    domain: 'course',
    title: isExam ? `${slot.code} 考题演练` : `${slot.code} 复习 · 第 ${week} 周`,
    steps: isExam
      ? [
          `限时 ${Math.max(20, minutes - 15)} 分钟，闭卷做 ${slot.code} 的一道往年题或课后综合题`,
          '对答案，把不确定的 3 个点写成清单',
          '用剩下的时间只补这 3 个点，每个点写一句话总结',
        ]
      : [
          `先用 5 分钟不看笔记，回忆 ${slot.code} 本周讲过的 3 个概念并写下来`,
          '翻开课件对照，补全记错或漏掉的部分',
          '挑 1 道课后题重做，做完对照答案标出错因（概念不懂 / 看错题 / 计算错）',
        ],
    deliverable: isExam
      ? `${slot.code} 1 道题的答案 + 3 条薄弱点清单`
      : `${slot.code} 本周概念卡 + 1 道错题订正`,
    minutes,
    courseCode: slot.code,
    source: 'auto',
    done: false,
  }
}


function generalSelfTest(date: DateKey, phase: Phase, minutes: number): Task {
  return {
    id: `${phase === 'exam' ? 'e' : 'r'}:${date}:general`,
    date,
    domain: 'course',
    title: phase === 'exam' ? '综合闭卷自测（本学习期课表未录入）' : '课程复盘（本学习期课表未录入）',
    steps: [
      '打开最近一周的课程笔记，遮住内容只看标题',
      `用 ${Math.max(20, minutes - 10)} 分钟闭卷写出每个标题下的 2 个关键点`,
      '对照笔记补全说不清的地方，把最弱的 1 个点写成一句话放进下周复习清单',
    ],
    deliverable: '一份闭卷自测结果 + 1 条下周复习项',
    minutes,
    source: 'auto',
    done: false,
  }
}

function lessonTask(date: DateKey, lesson: Lesson): Task {
  return {
    id: `a:${date}:${lesson.id}`,
    date,
    domain: lesson.domain,
    title: lesson.title,
    steps: lesson.steps,
    deliverable: lesson.deliverable,
    minutes: lesson.minutes,
    lessonId: lesson.id,
    source: 'auto',
    done: false,
  }
}

function projectTask(date: DateKey, task: ProjectTask): Task {
  return {
    id: `p:${date}:${task.id}`,
    date,
    domain: 'project',
    title: `CyberGuard AI · ${task.title}`,
    steps: task.steps,
    deliverable: task.deliverable,
    minutes: task.minutes,
    projectTaskId: task.id,
    source: 'auto',
    done: false,
  }
}

function weeklyReviewTask(date: DateKey, minutes: number): Task {
  return {
    id: `w:${date}`,
    date,
    domain: 'review',
    title: '本周复盘 + GitHub 更新',
    steps: [
      '打开「我的 → 统计」，记下本周计划分钟数与实际完成分钟数，找出完成率最低的 2 个领域',
      '到 CyberGuard AI 仓库更新 README 或学习笔记，写清本周新增内容（一条 commit 即可）',
      '为下周写 3 个具体目标，其中至少 1 个要有可验收的产物',
    ],
    deliverable: '一条 GitHub 提交 + 下周 3 个目标',
    minutes,
    source: 'auto',
    done: false,
  }
}

/**
 * 给任务排开始时间：避开当天课程；冲突时向后顺延。
 * 显式设置了 start 的任务保持原时间，但仍参与占用，冲突会被标记。
 */
function assignTimes(tasks: Task[], slots: CourseSlot[], windowStart: string): boolean {
  const occupied: Array<{ start: number; end: number }> = slots.map((s) => ({
    start: timeToMinutes(s.start),
    end: timeToMinutes(s.end),
  }))
  const startMin = timeToMinutes(windowStart)
  let conflict = false

  for (const t of tasks) {
    if (!t.start) continue
    const s = timeToMinutes(t.start)
    if (occupied.some((o) => rangesOverlap(s, s + t.minutes, o.start, o.end))) conflict = true
    occupied.push({ start: s, end: s + t.minutes })
  }

  let cursor = startMin
  for (const t of tasks) {
    if (t.start) continue
    let clock = Math.max(cursor, startMin)
    for (let attempt = 0; attempt < 16; attempt++) {
      const hit = occupied.find((o) => rangesOverlap(clock, clock + t.minutes, o.start, o.end))
      if (!hit) break
      clock = hit.end + GAP
    }
    if (clock + t.minutes > DAY_END) {
      conflict = true
      clock = Math.max(startMin, DAY_END - t.minutes)
    }
    if (occupied.some((o) => rangesOverlap(clock, clock + t.minutes, o.start, o.end))) conflict = true
    t.start = minutesToTime(clock)
    occupied.push({ start: clock, end: clock + t.minutes })
    cursor = clock + t.minutes + GAP
  }
  return conflict
}

export function generateDay(date: DateKey, state: PersistedState): DayPlan {
  const info = resolvePhase(date, state.calendar)
  const wd = isoWeekday(date)
  const win = state.settings.studyWindows[wd] ?? { start: state.settings.dailyStartTime, maxMinutes: 180 }
  const isPublicHoliday = info.phase === 'holiday' && !!info.holiday
  // 计划开始之前（导入计划从 2026-11-23 起）不排任何自动任务，避免历史日期凭空长出任务
  const beforePlan = info.phase === 'holiday' && info.reason === 'before-plan'
  const budget = beforePlan ? 0 : dayBudget(info.phase, wd, isPublicHoliday, win.maxMinutes)
  const custom = state.customTasks
    .filter((t) => t.date === date && !state.hiddenTaskIds.includes(t.id))
    .map((t) => ({ ...t }))
  const replaced = new Set(custom.map((t) => t.replaces).filter((x): x is string => !!x))
  let capacity = Math.max(0, budget - custom.reduce((s, t) => s + t.minutes, 0))
  const week = termWeekInfo(date, state.calendar)?.week ?? 1
  const courses = slotsForDate(date, state.calendar)
  const lessons = availableLessons(date, state)
  const projectTasks = availableProjectTasks(date, state)
  const imported = IMPORTED_DAYS[date]
  let li = 0
  let pi = 0
  const auto: Task[] = []

  if (imported) {
    // 用户在 xlsx 里写好的计划：一天最多一条，内容照抄；建议用时来自「建议用时」列
    if (imported.minutes > 0) {
      auto.push({
        id: `i:${date}:0`,
        date,
        domain: imported.domain,
        title: imported.focus && imported.focus !== imported.weekTheme
          ? `${imported.weekTheme} · ${imported.focus}`
          : imported.weekTheme,
        steps: [`内容：${imported.topic}`, ...imported.practice].filter((s) => s.trim().length > 2),
        deliverable: imported.deliverable,
        minutes: imported.minutes,
        source: 'auto',
        done: false,
      })
    }
  } else if (capacity >= MIN_TASK) {
    for (const seg of composition(info.phase, wd)) {
      if (capacity < MIN_TASK) break

      if (seg.kind === 'course-review' || seg.kind === 'exam-drill') {
        const segBudget = Math.min(seg.minutes, capacity)
        if (courses.length === 0) {
          auto.push(generalSelfTest(date, info.phase, segBudget))
          capacity -= segBudget
          continue
        }
        const n = courses.length
        const base = Math.max(MIN_TASK, Math.floor(segBudget / n / 5) * 5)
        let remaining = segBudget
        courses.forEach((slot, i) => {
          const m = i === n - 1 ? remaining : Math.min(base, remaining - MIN_TASK * (n - i - 1))
          if (m < MIN_TASK) return
          auto.push(reviewTask(date, slot, info.phase, m, week))
          remaining -= m
        })
        capacity -= segBudget - remaining
        continue
      }

      if (seg.kind === 'lesson') {
        const segBudget = Math.min(seg.minutes, capacity)
        let remaining = segBudget
        const maxCount = segBudget >= 75 ? 2 : 1
        let count = 0
        while (count < maxCount && remaining >= 20 && li < lessons.length) {
          const lesson = lessons[li]
          if (lesson.minutes > remaining + 15) break
          auto.push(lessonTask(date, lesson))
          remaining -= lesson.minutes
          li++
          count++
        }
        capacity -= segBudget - remaining
        continue
      }

      if (seg.kind === 'project') {
        const segBudget = Math.min(seg.minutes, capacity)
        let remaining = segBudget
        while (remaining >= 20 && pi < projectTasks.length) {
          const pt = projectTasks[pi]
          if (pt.minutes > remaining + 15) break
          auto.push(projectTask(date, pt))
          remaining -= pt.minutes
          pi++
        }
        capacity -= segBudget - remaining
        continue
      }

      if (seg.kind === 'weekly-review' && capacity >= 30) {
        const m = Math.min(seg.minutes, capacity)
        auto.push(weeklyReviewTask(date, m))
        capacity -= m
      }
    }
  }


  const keptAuto = auto.filter((t) => !replaced.has(t.id) && !state.hiddenTaskIds.includes(t.id))
  const all = [...custom, ...keptAuto].map((t) => {
    const c = state.completions[t.id]
    const projectDone = t.projectTaskId ? state.project.taskDone[t.projectTaskId] === date : false
    const lessonDone = t.lessonId ? state.lessonDone[t.lessonId] === date : false
    if (!c && !projectDone && !lessonDone) return t
    return { ...t, done: true, doneAt: c?.at, actualMinutes: c ? c.minutes : t.minutes }
  })

  const conflict = assignTimes(all, courses, win.start)
  all.sort(
    (a, b) =>
      timeToMinutes(a.start ?? '23:59') - timeToMinutes(b.start ?? '23:59') || a.id.localeCompare(b.id),
  )

  const plannedMinutes = all.reduce((s, t) => s + t.minutes, 0)
  const doneMinutes = all.reduce((s, t) => s + (t.done ? (t.actualMinutes ?? t.minutes) : 0), 0)

  let note: string | undefined
  if (isPublicHoliday) note = `公共假期（${info.holiday?.name ?? '假期'}），休息为主，不强制安排任务`
  else if (imported && imported.minutes <= 0) note = imported.note ?? '计划表里今天没有安排课外任务'
  else if (imported && info.phase === 'holiday') note = `${imported.weekTheme}：假期以休息为主，这条任务可以只做一半`
  else if (info.phase === 'holiday' && info.reason === 'semester-break') note = '学期假期：项目优先，但要留出休息日'
  else if (info.phase === 'holiday' && info.reason === 'summer') note = '暑假开始：项目实践为主，别把日程排满'
  else if (info.phase === 'holiday' && info.reason === 'before-plan') {
    note = `计划从 ${PLAN_START} 开始。今天可以先在「我的」里确认课表、学习时间和提醒设置`
  } else if (info.phase === 'exam') note = '考试周：暂停新技术学习，只做课程演练'
  else if (info.phase === 'review') note = '复习周：大学课程优先，课外项目暂停'

  return {
    date,
    phase: info.phase,
    phaseLabel: info.label,
    tasks: all,
    plannedMinutes,
    doneMinutes,
    startTime: all.find((t) => t.start)?.start ?? null,
    conflict,
    note,
  }
}
