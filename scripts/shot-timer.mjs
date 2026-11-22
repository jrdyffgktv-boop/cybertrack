// 截「计时中」「已结束」「我的-清空进度按钮」三张图
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
async function shot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(name, Buffer.from(res.result.data, 'base64'))
}

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url: base })
await sleep(1500)
await send('Page.reload')
await sleep(2300)

await evaluate(`[...document.querySelectorAll('.tabbar .tab')].find((b) => b.textContent.trim() === '学习计划')?.click()`)
await sleep(500)
await evaluate(`document.querySelector('.week-nav .icon-btn[aria-label="下一周"]')?.click()`)
await sleep(400)
await evaluate(`[...document.querySelectorAll('.day-chip')].find((c) => c.textContent.replace(/\\s+/g, '').includes('23'))?.click()`)
await sleep(600)
await evaluate(`document.querySelector('.task-start')?.click()`)
await sleep(3200)
await shot('.tmp/t9-running.png')
await evaluate(`document.querySelector('.task-timer')?.click()`)
await sleep(900)
await shot('.tmp/t10-done.png')
console.log(
  await evaluate(`JSON.stringify({ metas: [...document.querySelectorAll('.task-meta')].map((m) => m.textContent), done: document.querySelectorAll('.task-card.is-done').length })`),
)

await evaluate(`[...document.querySelectorAll('.tabbar .tab')].find((b) => b.textContent.trim() === '我的')?.click()`)
await sleep(700)
await evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`)
await sleep(500)
await shot('.tmp/t11-me-bottom.png')
console.log(await evaluate(`[...document.querySelectorAll('.btn')].map((b) => b.textContent.trim()).filter((t) => t.includes('清空'))`))
ws.close()
