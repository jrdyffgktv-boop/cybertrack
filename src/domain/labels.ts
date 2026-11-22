// 界面用的标签与配色（深色主题下保证对比度）

import type { Domain, Phase, Stage } from './types'

export const DOMAIN_LABELS: Record<Domain, string> = {
  course: '大学课程',
  python: 'Python',
  ai: 'AI 技术',
  security: '网络安全',
  project: '项目',
  review: '复盘',
  exercise: '锻炼',
}

export const DOMAIN_COLORS: Record<Domain, string> = {
  course: '#7aa2ff',
  python: '#ffd166',
  ai: '#c58bff',
  security: '#5ee0b0',
  project: '#ff8fab',
  review: '#9aa4b2',
  exercise: '#a3e635',
}

export const PHASE_LABELS: Record<Phase, string> = {
  normal: '正常学习',
  review: '复习周',
  exam: '考试周',
  holiday: '假期',
}

export const STAGE_LABELS: Record<Stage, string> = {
  1: '阶段 1 · 编程基础',
  2: '阶段 2 · 计算机基础',
  3: '阶段 3 · AI 技术',
  4: '阶段 4 · 网络安全实践',
}

export const STAGE_SHORT: Record<Stage, string> = {
  1: '编程基础',
  2: '计算机基础',
  3: 'AI 技术',
  4: '网安实践',
}
