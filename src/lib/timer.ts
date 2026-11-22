/** 计时相关的小工具，纯函数，方便单测 */

export function elapsedSeconds(startedAt: string, now: number = Date.now()): number {
  const start = Date.parse(startedAt)
  if (!Number.isFinite(start)) return 0
  return Math.max(0, Math.floor((now - start) / 1000))
}

/** 00:42 / 12:05 / 1:03:20 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** 打卡时写入的真实分钟数：不足 1 分钟按 1 分钟算 */
export function realMinutes(startedAt: string, now: number = Date.now()): number {
  return Math.max(1, Math.round(elapsedSeconds(startedAt, now) / 60))
}
