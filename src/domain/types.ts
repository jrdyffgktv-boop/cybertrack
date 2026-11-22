// CyberTrack 全局类型定义（domain 层不依赖 React / DOM）

export type DateKey = string // 'YYYY-MM-DD'，始终按 Asia/Kuala_Lumpur 解释

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7 // 周一 = 1

export type Domain = 'course' | 'python' | 'ai' | 'security' | 'project' | 'review' | 'exercise'

export type Phase = 'normal' | 'review' | 'exam' | 'holiday'

export type Stage = 1 | 2 | 3 | 4

/** 额外学习课时：一条 = 一次 25–60 分钟、有明确产出的学习单元 */
export interface Lesson {
  id: string
  stage: Stage
  domain: Domain
  title: string
  steps: string[]
  deliverable: string
  minutes: number
  tags: string[]
}

/** 学期/假期区间；review/exam 为可选子区间 */
export interface Term {
  id: string
  name: string
  start: DateKey
  end: DateKey
  reviewStart?: DateKey
  reviewEnd?: DateKey
  examStart?: DateKey
  examEnd?: DateKey
}

/** 课程时间槽：只属于某个学期，换学期必须重新录入 */
export interface CourseSlot {
  id: string
  termId: string
  code: string
  title: string
  weekday: Weekday
  start: string // 'HH:mm'
  end: string // 'HH:mm'
  location?: string
  /** 运行时标记：这一条来自某一天的「只改这一次」例外，不参与持久化 */
  exceptionDate?: DateKey
}

/**
 * 单日例外：只改某一天的那一节课（调课、换教室），下一周照旧。
 * 每个例外都保存完整快照，这样即使之后改了每周常规，这一天仍按当时的安排显示。
 */
export interface CourseException {
  id: string
  date: DateKey
  slotId: string
  /** true = 这一天停课/删掉这一节 */
  removed?: boolean
  termId: string
  code: string
  title: string
  weekday: Weekday
  start: string
  end: string
  location?: string
}

export interface Holiday {
  date: DateKey
  name: string
  /** true = 当天只休息，不生成学习任务 */
  restOnly: boolean
}

export type TaskSource = 'auto' | 'manual' | 'override'

export interface Task {
  id: string
  date: DateKey
  domain: Domain
  title: string
  steps: string[]
  deliverable: string
  minutes: number
  start?: string
  courseCode?: string
  lessonId?: string
  projectTaskId?: string
  source: TaskSource
  /** 覆盖自动任务时，被替换的自动任务 id */
  replaces?: string
  reminderOffsetMin?: number | null
  done: boolean
  doneAt?: string
  actualMinutes?: number
}

export interface Completion {
  minutes: number
  /** 记在哪个自然日（Asia/Kuala_Lumpur），统计与连续天数都按它算 */
  date: DateKey
  /** 领域：统计各技术领域投入时直接读它，不依赖重新生成的历史计划 */
  domain: Domain
  at: string
}

export interface DayPlan {
  date: DateKey
  phase: Phase
  phaseLabel: string
  tasks: Task[]
  plannedMinutes: number
  doneMinutes: number
  startTime: string | null
  conflict: boolean
  note?: string
}

export interface StudyWindow {
  start: string
  /** 该星期最多生成多少分钟（受阶段预算进一步限制） */
  maxMinutes: number
}

export interface Settings {
  weeklyGoalHours: number
  dailyStartTime: string
  nightlyCheckIn: string
  studyWindows: Record<Weekday, StudyWindow>
  remindersEnabled: boolean
  perTaskReminders: boolean
  reminderLeadMin: number
  examRemindersReduced: boolean
  /** 体重（kg）：运动卡路里按 MET × 体重 × 小时估算 */
  weightKg: number
  timezone: 'Asia/Kuala_Lumpur'
}

/** 一次运动打卡：运动页的独立记录，不混进学习任务 */
export interface ExerciseLog {
  id: string
  date: DateKey
  sportId: string
  minutes: number
  /** 跑步等有里程的项目才记，单位公里 */
  distanceKm?: number
  at: string
}

export interface ProjectTask {
  id: string
  featureId: string
  title: string
  steps: string[]
  deliverable: string
  minutes: number
}

export interface ProjectFeature {
  id: string
  name: string
  goal: string
  tasks: ProjectTask[]
}

export interface ProjectState {
  repoUrl: string
  notes: string
  /** 完成日期；生成某天的计划时只看“该天之前”是否已完成 */
  taskDone: Record<string, DateKey>
}

export interface CalendarData {
  terms: Term[]
  slots: CourseSlot[]
  /** 单日例外：只影响指定的那一天 */
  exceptions: CourseException[]
  holidays: Holiday[]
}

/** 手动添加的作业：填课程、内容、截止日期，首页按截止日期显示还剩几天 */
export interface Assignment {
  id: string
  /** 课程码，例如 CYS102；可以留空 */
  courseCode: string
  /** 课程名，冗余保存，之后改课表也不会影响已有作业 */
  courseTitle: string
  title: string
  /** 具体要完成的内容 */
  detail: string
  /** 截止日期（Asia/Kuala_Lumpur 的日期键） */
  due: DateKey
  createdAt: string
  doneAt?: string
}

export type AssignmentInput = Omit<Assignment, 'id' | 'createdAt' | 'doneAt'>

export interface PersistedState {
  version: number
  settings: Settings
  calendar: CalendarData
  customTasks: Task[]
  hiddenTaskIds: string[]
  completions: Record<string, Completion>
  /** 已完成的课时（完成日期），驱动“下一个课时”游标 */
  lessonDone: Record<string, DateKey>
  project: ProjectState
  /** 正在计时的任务：taskId -> 开始时间（ISO），刷新后继续计时 */
  running: Record<string, string>
  /** 运动记录（运动页独立统计） */
  exerciseLogs: ExerciseLog[]
  /** 手动添加的作业 */
  assignments: Assignment[]
  createdAt: string
  updatedAt: string
}
