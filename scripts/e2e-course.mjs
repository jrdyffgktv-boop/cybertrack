// 端到端：改一门课的开始时间与地点 → 保存 → 刷新后仍在（再改回原值）。
const port = process.argv[2] ?? '9227'
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const firstRow = () => evaluate(`document.querySelector('.course-row')?.innerText.replace(/\\n/g, ' ')`)

const setInput = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)})
  if (!el) return 'missing'
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return el.value
})()`

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url })
await wait(2200)

await evaluate(`[...document.querySelectorAll('.tabbar button')].find((b) => b.textContent.includes('学习计划')).click()`)
await wait(500)
await evaluate(`document.querySelector('[aria-label="下一周"]').click()`)
await wait(400)
await evaluate(`[...document.querySelectorAll('.day-chip')].find((b) => b.textContent.includes('23')).click()`)
await wait(400)
console.log('before', await firstRow())

await evaluate(`document.querySelector('.course-row .icon-btn').click()`)
await wait(400)
console.log('start set ->', await evaluate(setInput('#course-start', '07:30')))
console.log('loc set ->', await evaluate(setInput('#course-location', 'B1#101')))
await wait(200)
console.log('save ->', await evaluate(`[...document.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent.includes('保存')).click(), 'clicked'`))
await wait(600)
console.log('after save', await firstRow())

await send('Page.reload')
await wait(2000)
await evaluate(`[...document.querySelectorAll('.tabbar button')].find((b) => b.textContent.includes('学习计划')).click()`)
await wait(500)
await evaluate(`document.querySelector('[aria-label="下一周"]').click()`)
await wait(400)
await evaluate(`[...document.querySelectorAll('.day-chip')].find((b) => b.textContent.includes('23')).click()`)
await wait(400)
console.log('after reload', await firstRow())
console.log(
  'storage',
  await evaluate(`(() => { const raw = localStorage.getItem('cybertrack:state:v1'); const s = JSON.parse(raw); const slot = s.calendar.slots.find((x) => x.id === 't1-mon-1'); return JSON.stringify({ version: s.version, slot }) })()`),
)

// 改回原值，保持课表干净
console.log('before restore', await firstRow())
await evaluate(`document.querySelector('.course-row .icon-btn').click()`)
await wait(400)
await evaluate(setInput('#course-start', '08:00'))
await evaluate(setInput('#course-location', 'A5#G07'))
await wait(200)
await evaluate(`[...document.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent.includes('保存')).click()`)
await wait(500)
console.log('restored', await firstRow())

ws.close()
