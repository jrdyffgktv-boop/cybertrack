// 勾选「锻炼」后刷新，确认打卡记录持久化且不计入学习分钟
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

async function openDay() {
  await evaluate(`
    (() => {
      const tab = [...document.querySelectorAll('.tabbar .tab')].find((b) => b.textContent.trim() === '学习计划')
      if (tab) tab.click()
    })()
  `)
  await sleep(400)
  await evaluate(`
    (() => {
      const next = document.querySelector('.week-nav .icon-btn[aria-label="下一周"]')
      if (next && ![...document.querySelectorAll('.day-chip')].some((c) => c.textContent.replace(/\\s+/g, '').includes('23'))) next.click()
    })()
  `)
  await sleep(400)
  await evaluate(`
    (() => {
      const chip = [...document.querySelectorAll('.day-chip')].find((c) => c.textContent.replace(/\\s+/g, '').includes('23'))
      if (chip) chip.click()
    })()
  `)
  await sleep(500)
}

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url: base })
await sleep(2500)
await openDay()

const before = await evaluate(`
  (() => {
    const cards = [...document.querySelectorAll('.task-card')]
    const ex = cards[cards.length - 1]
    return { total: cards.length, lastMeta: ex?.querySelector('.task-meta')?.textContent.trim(), header: document.querySelector('.day-card p')?.textContent.trim() }
  })()
`)

await evaluate(`
  (() => {
    const cards = [...document.querySelectorAll('.task-card')]
    const ex = cards[cards.length - 1]
    ex.querySelector('.task-check').click()
  })()
`)
await sleep(600)

const after = await evaluate(`
  (() => {
    const saved = JSON.parse(localStorage.getItem('cybertrack:state:v1') ?? '{}')
    const cards = [...document.querySelectorAll('.task-card')]
    return {
      doneCards: cards.filter((c) => c.classList.contains('is-done')).length,
      header: document.querySelector('.day-card p')?.textContent.trim(),
      keys: Object.keys(saved.completions ?? {}),
      exerciseCompletion: saved.completions?.['x:2026-11-23'] ?? null,
    }
  })()
`)

await evaluate(`window.location.reload()`)
await sleep(2600)
await openDay()
const reloaded = await evaluate(`
  (() => {
    const cards = [...document.querySelectorAll('.task-card')]
    const ex = cards[cards.length - 1]
    return { doneCards: cards.filter((c) => c.classList.contains('is-done')).length, exerciseDone: ex.classList.contains('is-done') }
  })()
`)

console.log(JSON.stringify({ before, after, reloaded }, null, 2))
ws.close()
