import { describe, expect, it } from 'vitest'
import { elapsedSeconds, formatClock, realMinutes } from '../lib/timer'

const start = '2026-11-23T21:00:00.000+08:00'
const startMs = Date.parse(start)

describe('计时（点开始 → 点结束，按真实时长记）', () => {
  it('elapsedSeconds 按秒计，不会被时区或格式影响', () => {
    expect(elapsedSeconds(start, startMs)).toBe(0)
    expect(elapsedSeconds(start, startMs + 42_000)).toBe(42)
    expect(elapsedSeconds(start, startMs + 3_725_000)).toBe(3725)
    expect(elapsedSeconds('not-a-date', startMs)).toBe(0)
  })

  it('formatClock 输出 mm:ss，超过一小时显示 h:mm:ss', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(42)).toBe('00:42')
    expect(formatClock(605)).toBe('10:05')
    expect(formatClock(3725)).toBe('1:02:05')
  })

  it('realMinutes 不足一分钟按一分钟算（避免 0 分钟打卡）', () => {
    expect(realMinutes(start, startMs + 5_000)).toBe(1)
    expect(realMinutes(start, startMs + 90_000)).toBe(2)
    expect(realMinutes(start, startMs + 3_600_000)).toBe(60)
  })
})
