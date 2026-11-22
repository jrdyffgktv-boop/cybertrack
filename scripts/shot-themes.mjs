// 五屏主题色 + 任务卡「无具体时间」的截图与断言
import { writeFileSync } from 'node:fs'

const port = Number(process.argv[2] ?? 9222)
const base = process.argv[3] ?? 'http://127.0.0.1:4174/'
const tabs = ['首页', '学习计划', '日历', '项目', '我的']

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

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: false,
})
await send('Page.navigate', { url: base })
await new Promise((r) => setTimeout(r, 2500))

const out = []
for (const [i, label] of tabs.entries()) {
  await evaluate(`
    (() => {
      const btn = [...document.querySelectorAll('.tabbar .tab')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})
      if (btn) btn.click()
      window.scrollTo(0, 0)
    })()
  `)
  await new Promise((r) => setTimeout(r, 600))
  const info = await evaluate(`
    (() => {
      const app = document.querySelector('.app')
      const cs = getComputedStyle(app)
      const metas = [...document.querySelectorAll('.task-meta')].map((e) => e.textContent.trim())
      return {
        cls: app.className,
        accent: cs.getPropertyValue('--accent').trim(),
        tabColor: getComputedStyle(document.querySelector('.tab.is-active')).color,
        clockInMeta: metas.filter((m) => /\\d{1,2}:\\d{2}/.test(m)),
        metas: metas.slice(0, 3),
        vw: innerWidth,
        sw: document.documentElement.scrollWidth,
      }
    })()
  `)
  await shot(`.tmp/t${i + 1}-${['home', 'plan', 'calendar', 'project', 'me'][i]}.png`)
  out.push({ label, ...info })
}

console.log(JSON.stringify(out, null, 2))
ws.close()
