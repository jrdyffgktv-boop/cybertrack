// 截图：日历（月/周）→ 选中 11/23 看当天课程。
import { writeFile } from 'node:fs/promises'

const port = process.argv[2] ?? '9224'
const url = process.argv[3] ?? 'http://127.0.0.1:4174/'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
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

await evaluate(`[...document.querySelectorAll('.tabbar button')].find((b) => b.textContent.includes('日历')).click()`)
await wait(700)
await evaluate(`[...document.querySelectorAll('.cal-cell')].find((el) => el.querySelector('.cal-num')?.textContent === '23').click()`)
await wait(500)
await shot('d1-calendar-month')
console.log(
  'month',
  await evaluate(`JSON.stringify({
    courses: [...document.querySelectorAll('.course-row')].map((el) => el.innerText.replace(/\\n/g, ' ')),
    legend: [...document.querySelectorAll('.legend-item')].map((el) => el.innerText),
    sw: document.documentElement.scrollWidth
  })`),
)

await evaluate(`[...document.querySelectorAll('.seg button')].find((b) => b.textContent === '周').click()`)
await wait(600)
await shot('d2-calendar-week')
console.log(
  'week',
  await evaluate(`JSON.stringify([...document.querySelectorAll('.week-row')].map((el) => el.innerText.replace(/\\n/g, ' | ')))`),
)

ws.close()
