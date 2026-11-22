// 截图脚本：打开首页 → 学习计划 → 下一周 → 选中 11/23（有 3 门课的一天）。
// 用法：node scripts/shot-courses.mjs 9223 http://127.0.0.1:4174/
import { writeFile } from 'node:fs/promises'

const port = process.argv[2] ?? '9223'
const url = process.argv[3] ?? 'http://127.0.0.1:4174/'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  }
})
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))

function send(method, params = {}) {
  const current = ++id
  return new Promise((resolve, reject) => {
    pending.set(current, { resolve, reject })
    ws.send(JSON.stringify({ id: current, method, params }))
  })
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text)
  return res.result.value
}

async function shot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(`.tmp/${name}.png`, Buffer.from(res.data, 'base64'))
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url })
await wait(2200)

const layout = await evaluate(`(() => ({
  vw: window.innerWidth,
  sw: document.documentElement.scrollWidth,
  bad: [...document.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map((el) => el.className)
}))()`)
console.log('home layout', JSON.stringify(layout))
await shot('c1-home')

await evaluate(`[...document.querySelectorAll('.tabbar button')].find((b) => b.textContent.includes('学习计划')).click()`)
await wait(600)
await evaluate(`document.querySelector('[aria-label="下一周"]').click()`)
await wait(400)
await evaluate(`[...document.querySelectorAll('.day-chip')].find((b) => b.textContent.includes('23')).click()`)
await wait(500)

const plan = await evaluate(`(() => ({
  rows: [...document.querySelectorAll('.course-row')].map((el) => el.innerText.replace(/\\n/g, ' ')),
  tasks: [...document.querySelectorAll('.task-card .task-title')].map((el) => el.innerText),
  meta: [...document.querySelectorAll('.task-card .task-meta')].map((el) => el.innerText.replace(/\\n/g, ' ')),
  vw: window.innerWidth,
  sw: document.documentElement.scrollWidth
}))()`)
console.log('plan', JSON.stringify(plan, null, 0))
await shot('c2-plan')

await evaluate(`document.querySelector('.course-row .icon-btn').click()`)
await wait(500)
await shot('c3-course-editor')
const editor = await evaluate(`(() => {
  const modal = document.querySelector('.modal')
  return modal ? modal.innerText.replace(/\\n/g, ' | ') : null
})()`)
console.log('editor', editor)

ws.close()
