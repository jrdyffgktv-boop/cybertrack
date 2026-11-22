// 打开 11/23 的任务列表与任务编辑弹层，确认不显示具体钟点
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

async function shot(file) {
  const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(file, Buffer.from(res.result.data, 'base64'))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const click = (selector, text) =>
  evaluate(`
    (() => {
      const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
      const el = ${text ? `nodes.find((n) => n.textContent.trim() === ${JSON.stringify(text)})` : 'nodes[0]'}
      if (!el) return 'no-match'
      el.click()
      return el.textContent.trim().slice(0, 20)
    })()
  `)

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url: base })
await sleep(2500)

await click('.tabbar .tab', '学习计划')
await sleep(500)
await click('.week-nav .icon-btn[aria-label="下一周"]')
await sleep(500)
await evaluate(`
  (() => {
    const chip = [...document.querySelectorAll('.day-chip')].find((c) => c.textContent.replace(/\s+/g, '').includes('23'))
    if (chip) chip.click()
    return chip ? chip.textContent.trim() : 'no-chip'
  })()
`)
await sleep(600)
await shot('.tmp/t6-plan-tasks.png')

const info = await evaluate(`
  (() => {
    const metas = [...document.querySelectorAll('.task-meta')].map((e) => e.textContent.trim())
    const bad = [...document.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map((el) => el.className || el.tagName)
    return { metas, clock: metas.filter((m) => /\\d{1,2}:\\d{2}/.test(m)), vw: innerWidth, sw: document.documentElement.scrollWidth, bad }
  })()
`)

await click('.task-card .task-edit')
await sleep(600)
await shot('.tmp/t7-task-editor.png')
const editor = await evaluate(`
  (() => {
    const modal = document.querySelector('.modal-body') || document.querySelector('.sheet') || document.body
    return { text: modal.innerText.replace(/\\s+/g, ' ').slice(0, 420) }
  })()
`)

console.log(JSON.stringify({ info, editor }, null, 2))
ws.close()
