// 内容库统一出口：课时按阶段顺序拼接，项目任务按功能顺序拼接。

import type { Lesson, ProjectTask } from '../../domain/types'
import { LESSONS_S12 } from './lessons-s12'
import { LESSONS_S34 } from './lessons-s34'
import { PROJECT_FEATURES } from './project'

export { PROJECT_FEATURES, NEXT_PROJECTS } from './project'

const STAGE_ORDER = [1, 2, 3, 4]

export const ALL_LESSONS: Lesson[] = [...LESSONS_S12, ...LESSONS_S34].sort(
  (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.id.localeCompare(b.id),
)

export const ALL_PROJECT_TASKS: ProjectTask[] = PROJECT_FEATURES.flatMap((f) => f.tasks)

export const LESSONS_BY_STAGE = STAGE_ORDER.map((stage) => ({
  stage,
  lessons: ALL_LESSONS.filter((l) => l.stage === stage),
}))

export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id)
}

export function projectTaskById(id: string): ProjectTask | undefined {
  return ALL_PROJECT_TASKS.find((t) => t.id === id)
}
