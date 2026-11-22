// 运动项目与 MET 值（代谢当量）：消耗 = MET × 体重(kg) × 小时。
// MET 参考 Compendium of Physical Activities 的常见区间，取整到便于理解的值。

export interface Sport {
  id: string
  name: string
  en: string
  /** MET（代谢当量） */
  met: number
}

export const SPORTS: Sport[] = [
  { id: 'run', name: '跑步', en: 'Running', met: 9.8 },
  { id: 'walk', name: '快走', en: 'Brisk walking', met: 4.3 },
  { id: 'bike', name: '骑行', en: 'Cycling', met: 7.5 },
  { id: 'basketball', name: '篮球', en: 'Basketball', met: 6.5 },
  { id: 'football', name: '足球', en: 'Football', met: 7 },
  { id: 'badminton', name: '羽毛球', en: 'Badminton', met: 5.5 },
  { id: 'tabletennis', name: '乒乓球', en: 'Table tennis', met: 4 },
  { id: 'rope', name: '跳绳', en: 'Jump rope', met: 11 },
  { id: 'swim', name: '游泳', en: 'Swimming', met: 8 },
  { id: 'strength', name: '力量 / 健身房', en: 'Strength', met: 5 },
  { id: 'yoga', name: '瑜伽 / 拉伸', en: 'Yoga & stretch', met: 2.5 },
]

export function sportById(id: string): Sport | undefined {
  return SPORTS.find((s) => s.id === id)
}

export function sportName(id: string): string {
  return sportById(id)?.name ?? '运动'
}
