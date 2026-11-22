// 学习计划选中 11/23 后滚到底，截「锻炼 · 1 小时」任务卡
import { writeFileSync } from 'node:fs'

const port = Number(process.argv[2] ?? 9222)
const base = process.argv[3] ?? 'http://127.0.0.1:4174/'
const out = process.argv[4] ?? '.tmp/t8-plan-bottom.png'

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
await sleep(2400)

await evaluate(`
  (() => {
    const tab = [...document.querySelectorAll('.tabbar .tab')].find((b) => b.textContent.trim() === '学习计划')
    if (tab) tab.click()
  })()
`)
await sleep(500)
await evaluate(`
  (() => {
    const next = document.querySelector('.week-nav .icon-btn[aria-label="下一周"]')
    if (next) next.click()
  })()
`)
await sleep(500)
await evaluate(`
  (() => {
    const chip = [...document.querySelectorAll('.day-chip')].find((c) => c.textContent.replace(/\\s+/g, '').includes('23'))
    if (chip) chip.click()
  })()
`)
await sleep(700)
await evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`)
await sleep(600)
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
console.log(await evaluate(`document.querySelectorAll('.task-card').length`))
ws.close()
