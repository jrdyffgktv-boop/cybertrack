// 计时打卡端到端验证：点「开始」→ 计时中 → 点「结束」→ 写入真实分钟 → 刷新后仍在
import { writeFileSync } from 'node:fs'

const port = Number(process.argv[2] ?? 9222)
const base = process.argv[3] ?? 'http://127.0.0.1:4174/'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))

let seq = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})

function send(method, params = {}) {
  const id = ++seq
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve) => pending.set(id, resolve))
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails))
  return res.result?.result?.value
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url: base })
await sleep(1500)
// 首次加载时 Service Worker 可能还在切换到新版本，先刷新一次再操作
await send('Page.reload')
await sleep(2500)

// 进「学习计划」，切到 11/23
await evaluate(`[...document.querySelectorAll('.tabbar .tab')].find((b) => b.textContent.trim() === '学习计划')?.click()`)
await sleep(400)
await evaluate(`document.querySelector('.week-nav .icon-btn[aria-label="下一周"]')?.click()`)
await sleep(400)
await evaluate(`[...document.querySelectorAll('.day-chip')].find((c) => c.textContent.replace(/\\s+/g, '').includes('23'))?.click()`)
await sleep(600)

const before = await evaluate(`
  (() => {
    const card = document.querySelector('.task-card')
    return {
      metas: [...document.querySelectorAll('.task-meta')].map((m) => m.textContent.trim()),
      startButtons: document.querySelectorAll('.task-start').length,
      done: document.querySelectorAll('.task-card.is-done').length,
    }
  })()
`)

// 点第一条任务的「开始」
await evaluate(`document.querySelector('.task-start')?.click()`)
await sleep(2500)
const running = await evaluate(`
  (() => {
    const timer = document.querySelector('.task-timer')
    return {
      hasTimer: !!timer,
      text: timer?.textContent ?? null,
      stored: JSON.parse(localStorage.getItem('cybertrack:state:v1') ?? '{}').running ?? null,
    }
  })()
`)

// 点「结束」，按真实时长写入
await evaluate(`document.querySelector('.task-timer')?.click()`)
await sleep(900)
const after = await evaluate(`
  (() => {
    const raw = JSON.parse(localStorage.getItem('cybertrack:state:v1') ?? '{}')
    const ids = Object.keys(raw.completions ?? {})
    return {
      completions: ids.map((id) => ({ id, minutes: raw.completions[id].minutes, domain: raw.completions[id].domain })),
      running: raw.running ?? null,
      header: document.querySelector('.day-card .row-between span, .day-card p')?.textContent ?? null,
      doneCards: document.querySelectorAll('.task-card.is-done').length,
    }
  })()
`)

await send('Page.reload')
await sleep(2200)
const afterReload = await evaluate(`
  (() => {
    const raw = JSON.parse(localStorage.getItem('cybertrack:state:v1') ?? '{}')
    return {
      running: raw.running ?? null,
      completions: Object.keys(raw.completions ?? {}),
      doneCards: document.querySelectorAll('.task-card.is-done').length,
      version: raw.version,
    }
  })()
`)

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync('.tmp/t9-timer.png', Buffer.from(shot.result.data, 'base64'))

console.log(JSON.stringify({ before, running, after, afterReload }, null, 2))
ws.close()
