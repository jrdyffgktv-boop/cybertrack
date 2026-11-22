// 迁移测试：把本地状态伪装成 v1（旧课表、无地点），刷新后应自动换成 v2 官方课表。
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
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails))
  return res.result.value
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url })
await wait(2000)

// 先做一次真实操作，确保状态已经落盘，再把它改写成 v1
await evaluate(`[...document.querySelectorAll('.tabbar button')].find((b) => b.textContent.includes('学习计划')).click()`)
await wait(500)
await evaluate(`document.querySelector('[aria-label="下一周"]').click()`)
await wait(400)
await evaluate(`[...document.querySelectorAll('.day-chip')].find((b) => b.textContent.includes('23')).click()`)
await wait(400)
await evaluate(`document.querySelector('.task-card .task-check').click()`)
await wait(600)

console.log(
  'seeded',
  await evaluate(`(async () => {
    const key = 'cybertrack:state:v1'
    const state = JSON.parse(localStorage.getItem(key))
    state.version = 1
    state.calendar.slots = [{ id: 'old-mon', termId: 't-2026-09', code: 'CYS102', title: 'CYS102', weekday: 1, start: '08:00', end: '10:00' }]
    const text = JSON.stringify(state)
    localStorage.setItem(key, text)
    // 主存储是 IndexedDB，必须一起写成 v1 才能真的走迁移
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('cybertrack', 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv')
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('kv', 'readwrite')
        tx.objectStore('kv').put(text, 'state')
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
    return state.calendar.slots.length
  })()`),
)

await send('Page.reload')
await wait(2200)
await evaluate(`[...document.querySelectorAll('.tabbar button')].find((b) => b.textContent.includes('学习计划')).click()`)
await wait(500)
await evaluate(`document.querySelector('[aria-label="下一周"]').click()`)
await wait(400)
await evaluate(`[...document.querySelectorAll('.day-chip')].find((b) => b.textContent.includes('23')).click()`)
await wait(400)
console.log(
  'after migrate',
  await evaluate(`JSON.stringify({
    rows: [...document.querySelectorAll('.course-row')].map((el) => el.innerText.replace(/\\n/g, ' ')),
    version: JSON.parse(localStorage.getItem('cybertrack:state:v1')).version
  })`),
)

ws.close()
