// 学术日历与当前学期课表（只代表 2026 September Semester）
// 依据 XMUM 2027 Academic Calendar 与用户提供的课表整理。
// 注意：后续学期课表默认留空，由用户在 App 内自行录入，不沿用本学期。

import type { CourseSlot, Holiday, Term } from '../../domain/types'

export const PLAN_START = '2026-11-23'
export const PLAN_END = '2027-07-23'
export const SUMMER_START = '2027-07-24'

export const TERMS: Term[] = [
  {
    id: 't-2026-09',
    name: '2026 September Semester',
    start: '2026-09-25',
    end: '2027-01-21',
    reviewStart: '2027-01-04',
    reviewEnd: '2027-01-10',
    examStart: '2027-01-11',
    examEnd: '2027-01-21',
  },
  {
    id: 't-2027-02',
    name: '2027 February Semester',
    start: '2027-02-12',
    end: '2027-03-26',
    examStart: '2027-03-22',
    examEnd: '2027-03-26',
  },
  {
    id: 't-2027-04',
    name: '2027 April Semester',
    start: '2027-03-26',
    end: '2027-07-23',
    reviewStart: '2027-07-05',
    reviewEnd: '2027-07-11',
    examStart: '2027-07-12',
    examEnd: '2027-07-23',
  },
]

/**
 * 当前学期课表（2026 September Semester，按 XMUM Online 官方课表核对）。
 * 其它学期必须由用户手动录入；调课/换教室在 App 里改时间与地点即可。
 */
export const SLOTS: CourseSlot[] = [
  { id: 't1-mon-1', termId: 't-2026-09', code: 'CYS102', title: '微积分', weekday: 1, start: '08:00', end: '10:00', location: 'A5#G07' },
  { id: 't1-mon-2', termId: 't-2026-09', code: 'SOF103', title: 'C 和 C++ 编程', weekday: 1, start: '11:00', end: '12:00', location: 'A4#G01' },
  { id: 't1-mon-3', termId: 't-2026-09', code: 'CYS103', title: '线性代数', weekday: 1, start: '17:00', end: '18:00', location: 'A5#G01' },
  { id: 't1-tue-1', termId: 't-2026-09', code: 'CYS101', title: '网络安全导论', weekday: 2, start: '10:00', end: '12:00', location: 'A5#G01' },
  { id: 't1-tue-2', termId: 't-2026-09', code: 'CYS102', title: '微积分', weekday: 2, start: '13:00', end: '14:00', location: 'A2#G02' },
  { id: 't1-tue-3', termId: 't-2026-09', code: 'MPU1052', title: '马来西亚 Citra', weekday: 2, start: '15:00', end: '16:00', location: 'A4#105' },
  { id: 't1-wed-1', termId: 't-2026-09', code: 'CYS103', title: '线性代数', weekday: 3, start: '09:00', end: '10:00', location: 'A3#620' },
  { id: 't1-wed-2', termId: 't-2026-09', code: 'SOF103', title: 'C 和 C++ 编程', weekday: 3, start: '16:00', end: '18:00', location: 'A1#G09' },
  { id: 't1-thu-1', termId: 't-2026-09', code: 'MPU1012', title: '马来语 2', weekday: 4, start: '10:00', end: '12:00', location: 'A3#618' },
  { id: 't1-thu-2', termId: 't-2026-09', code: 'CYS101', title: '网络安全导论', weekday: 4, start: '15:00', end: '16:00', location: 'A4#G07' },
]

/**
 * 马来西亚联邦公共假期（计划期内）。
 * 来源：kabinet.gov.my 2027 假期表 / timeanddate.com（2027 年为初版，宗教节日可能微调）。
 * 计划期内所有假期都可以在「我的 → 公共假期」里增删。
 */
export const HOLIDAYS: Holiday[] = [
  { date: '2026-12-25', name: 'Christmas Day', restOnly: true },
  { date: '2027-01-01', name: 'New Year’s Day', restOnly: true },
  { date: '2027-02-06', name: 'Chinese New Year', restOnly: true },
  { date: '2027-02-07', name: 'Chinese New Year (Day 2)', restOnly: true },
  { date: '2027-02-08', name: 'Chinese New Year Holiday', restOnly: true },
  { date: '2027-03-10', name: 'Hari Raya Aidilfitri', restOnly: true },
  { date: '2027-03-11', name: 'Hari Raya Aidilfitri (Day 2)', restOnly: true },
  { date: '2027-05-01', name: 'Labour Day', restOnly: true },
  { date: '2027-05-17', name: 'Hari Raya Haji', restOnly: true },
  { date: '2027-05-20', name: 'Wesak Day', restOnly: true },
  { date: '2027-06-06', name: 'Awal Muharram', restOnly: true },
  { date: '2027-06-07', name: 'Agong’s Birthday', restOnly: true },
]
