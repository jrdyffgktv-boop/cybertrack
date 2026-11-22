// 浏览器端冒烟测试：切 Tab、选日期、打卡、刷新后验证持久化，并逐屏截图
import fs from 'node:fs'

const port = process.argv[2] ?? '9222'
const base = process.argv[3] ?? 'http://127.0.0.1:4173/'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) {
  console.error('no page target')
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  const entry = pending.get(msg.id)
  if (!entry) return
  pending.delete(msg.id)
  if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)))
  else entry.resolve(msg.result)
})
function send(method, params = {}) {
  const msgId = ++id
  ws.send(JSON.stringify({ id: msgId, method, params }))
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }))
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

await new Promise((resolve) => ws.addEventListener('open', resolve))
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url: base })
await wait(2500)

async function evalJs(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails).slice(0, 500))
  return res.result?.value
}
async function shot(name) {
  const png = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(`.tmp/${name}.png`, Buffer.from(png.data, 'base64'))
}

const clickTab = (label) => `(() => {
  const el = [...document.querySelectorAll('.tab')].find((e) => e.textContent.trim() === ${JSON.stringify(label)});
  if (!el) return 'no-tab ' + ${JSON.stringify(label)};
  el.click();
  return 'clicked ' + ${JSON.stringify(label)};
})()`

const clickChip = (label) => `(() => {
  const el = [...document.querySelectorAll('button')].find((e) => e.textContent.replace(/\\s+/g, ' ').includes(${JSON.stringify(label)}));
  if (!el) return 'no-chip ' + ${JSON.stringify(label)};
  el.click();
  return 'clicked chip ' + el.textContent.trim().slice(0, 20);
})()`

const clickDayChip = (label) => `(() => {
  const el = [...document.querySelectorAll('.day-chip')].find((e) => e.textContent.replace(/\\s+/g, '') === ${JSON.stringify(label)});
  if (!el) return 'no-chip ' + ${JSON.stringify(label)};
  el.click();
  return 'clicked chip ' + el.textContent.replace(/\\s+/g, '');
})()`

const clickAria = (label) => `(() => {
  const el = [...document.querySelectorAll('[aria-label]')].find((e) => e.getAttribute('aria-label') === ${JSON.stringify(label)});
  if (!el) return 'no-aria ' + ${JSON.stringify(label)};
  el.click();
  return 'clicked aria ' + ${JSON.stringify(label)};
})()`

const report = {}

await shot('01-home')
report.homeText = (await evalJs(`document.querySelector('.screen').innerText.slice(0, 200)`))

report.planTab = await evalJs(clickTab('学习计划'))
await wait(600)
report.nextWeek = await evalJs(clickAria('下一周'))
await wait(600)
report.chip = await evalJs(clickDayChip('周一23'))
await wait(700)
await shot('02-plan')
report.planCards = await evalJs(`document.querySelectorAll('.task-card').length`)
report.planText = await evalJs(`document.querySelector('.screen').innerText.slice(0, 420)`)

report.openEditor = await evalJs(`(() => {
  const el = document.querySelector('.task-card .task-edit');
  if (!el) return 'no-edit-btn';
  el.click();
  return 'clicked-edit';
})()`)
await wait(600)
report.editorText = await evalJs(`document.querySelector('.modal') ? document.querySelector('.modal').innerText.slice(0, 260) : 'no-modal'`)
await shot('06-editor')
report.closeEditor = await evalJs(clickAria('关闭'))
await wait(400)

report.check = await evalJs(`(() => {
  const el = document.querySelector('.task-card .task-check');
  if (!el) return 'no-check';
  el.click();
  return 'clicked-check';
})()`)
await wait(600)
report.doneAfterClick = await evalJs(`document.querySelectorAll('.task-card.is-done').length`)
report.headerAfterClick = await evalJs(`document.querySelector('.screen').innerText.slice(0, 120)`)

await send('Page.reload')
await wait(2500)
report.reloadTab = await evalJs(clickTab('学习计划'))
await wait(600)
report.reloadNext = await evalJs(clickAria('下一周'))
await wait(600)
report.reloadChip = await evalJs(clickDayChip('周一23'))
await wait(700)
report.doneAfterReload = await evalJs(`document.querySelectorAll('.task-card.is-done').length`)
report.storage = await evalJs(`(() => {
  const raw = localStorage.getItem('cybertrack:state:v1');
  if (!raw) return 'no-local-state';
  const s = JSON.parse(raw);
  return JSON.stringify({ completions: Object.keys(s.completions).length, keys: Object.keys(s.completions).slice(0, 3), lessonDone: Object.keys(s.lessonDone).length });
})()`)

report.calendarTab = await evalJs(clickTab('日历'))
await wait(900)
await shot('03-calendar')

report.projectTab = await evalJs(clickTab('项目'))
await wait(900)
await shot('04-project')

report.meTab = await evalJs(clickTab('我的'))
await wait(900)
await shot('05-me')

report.overflow = await evalJs(`(() => {
  const vw = innerWidth;
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if ((r.width || r.height) && (r.right > vw + 0.5 || r.left < -0.5)) bad.push(el.className || el.tagName);
  }
  return JSON.stringify({ vw, sw: document.documentElement.scrollWidth, bad: bad.slice(0, 6) });
})()`)

console.log(JSON.stringify(report, null, 2))
ws.close()
