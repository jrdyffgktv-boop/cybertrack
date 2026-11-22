import { describe, expect, it } from 'vitest'
import { parseTimetableHtml, parseTimetableText, parseTimeRange } from '../lib/courseImport'

describe('parseTimeRange', () => {
  it('识别教务的 8.00am-9.00am', () => {
    expect(parseTimeRange('8.00am-9.00am')).toMatchObject({ start: '08:00', end: '09:00', minutes: 60 })
  })

  it('识别 12 小时制与分钟数', () => {
    expect(parseTimeRange('11.00am-12.00pm')).toMatchObject({ start: '11:00', end: '12:00' })
    expect(parseTimeRange('1.00pm-2.00pm')).toMatchObject({ start: '13:00', end: '14:00' })
    expect(parseTimeRange('9:00 AM - 11:00 AM')).toMatchObject({ start: '09:00', end: '11:00' })
  })

  it('识别 24 小时制', () => {
    expect(parseTimeRange('08:30-10:30')).toMatchObject({ start: '08:30', end: '10:30', minutes: 120 })
  })
})

describe('parseTimetableHtml（教务导出表）', () => {
  const html = `
  <table class="data small solid">
    <tr><td>Time</td><td>Monday</td><td>Tuesday</td><td>Wednesday</td></tr>
    <tr>
      <td>8.00am-9.00am</td>
      <td rowspan="2">CYS102<br>Calculus<br>Saras A/P Krishnan<br>A5#G07<br>(Week 1-14)</td>
      <td></td><td></td>
    </tr>
    <tr>
      <td>9.00am-10.00am</td>
      <td></td>
      <td>CYS101<br>Cybersecurity<br>A5#G01</td>
      <td></td>
    </tr>
    <tr>
      <td>10.00am-11.00am</td><td></td><td></td>
      <td>CYS103<br>Linear Algebra<br>A3#620<br>Paid</td>
    </tr>
  </table>`

  it('按表头识别星期，rowspan 合并成连续时段', () => {
    const slots = parseTimetableHtml(html)
    const calculus = slots.find((s) => s.code === 'CYS102')
    expect(calculus).toMatchObject({ weekday: 1, start: '08:00', end: '10:00', location: 'A5#G07' })
    const security = slots.find((s) => s.code === 'CYS101')
    expect(security).toMatchObject({ weekday: 2, start: '09:00', end: '10:00' })
    const algebra = slots.find((s) => s.code === 'CYS103')
    expect(algebra).toMatchObject({ weekday: 3, start: '10:00', end: '11:00', location: 'A3#620' })
  })

  it('标题里不含教师名与 Week 标签', () => {
    const slot = parseTimetableHtml(html).find((s) => s.code === 'CYS102')
    expect(slot?.title).toBe('Calculus')
  })

  it('空单元格不产生时段', () => {
    expect(parseTimetableHtml(html)).toHaveLength(3)
  })
})

describe('parseTimetableText（粘贴文本）', () => {
  it('一行一个时段', () => {
    const slots = parseTimetableText(
      ['CYS102 Calculus 周一 08:00-10:00 A5#G07', 'MPU1052 Malaysian Citra Tue 15:00-16:00 A4#105'].join('\n'),
    )
    expect(slots).toHaveLength(2)
    expect(slots[0]).toMatchObject({ code: 'CYS102', weekday: 1, start: '08:00', end: '10:00', location: 'A5#G07' })
    expect(slots[1]).toMatchObject({ code: 'MPU1052', weekday: 2, start: '15:00', end: '16:00' })
  })

  it('一行多个时段时，星期取时间点前面那个', () => {
    const slots = parseTimetableText('CSC2001 数据结构 Tue 14:00-16:00, Thu 14:00-16:00')
    expect(slots.map((s) => s.weekday)).toEqual([2, 4])
    expect(slots.map((s) => s.title)).toEqual(['数据结构', '数据结构'])
  })

  it('识别不了的行直接跳过，不抛异常', () => {
    expect(parseTimetableText('随便写点什么\n\n')).toHaveLength(0)
  })
})
