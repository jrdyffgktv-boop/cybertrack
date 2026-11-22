// 用 CDP 检查 390px 视口下有没有横向溢出和越界元素（调试用）
const port = process.argv[2] ?? '9222'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) {
  console.error('no page target')
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()

function send(method, params = {}) {
  const msgId = ++id
  ws.send(JSON.stringify({ id: msgId, method, params }))
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }))
}

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  const entry = pending.get(msg.id)
  if (!entry) return
  pending.delete(msg.id)
  if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)))
  else entry.resolve(msg.result)
})

await new Promise((resolve) => ws.addEventListener('open', resolve))

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: false,
})
await send('Page.navigate', { url: process.argv[3] ?? 'http://127.0.0.1:4173/' })
await new Promise((resolve) => setTimeout(resolve, 2500))

const expression = `(() => {
  const vw = innerWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 60),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 24),
      });
    }
  }
  return JSON.stringify({
    innerWidth: vw,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    dpr: devicePixelRatio,
    offenders: offenders.slice(0, 20),
  }, null, 2);
})()`

const result = await send('Runtime.evaluate', { expression, returnByValue: true })
console.log(result.result?.value ?? JSON.stringify(result))

const shot = await send('Page.captureScreenshot', { format: 'png' })
await import('node:fs').then((fs) => fs.writeFileSync('.tmp/shot-390.png', Buffer.from(shot.data, 'base64')))
console.log('shot: .tmp/shot-390.png')
ws.close()
