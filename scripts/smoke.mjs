// Loads the production build in headless Chromium (phone-sized) and reports what happens.
// Results are printed as GitHub Actions annotations so they can be read without opening the logs.
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4173
const base = `http://localhost:${PORT}`
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A').slice(0, 1800)
const note = (level, title, msg) => console.log(`::${level} title=${title}::${esc(msg)}`)

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const problems = []
const events = []
let browser

try {
  let up = false
  for (let i = 0; i < 60 && !up; i++) {
    try { up = (await fetch(base)).ok } catch { await new Promise((r) => setTimeout(r, 500)) }
  }
  if (!up) throw new Error('preview server did not start')

  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
    else if (m.type() === 'warning') events.push(`console.warn: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message} | ${(e.stack || '').split('\n').slice(1, 4).join(' | ')}`))
  page.on('requestfailed', (r) => events.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`))
  page.on('response', (r) => { if (r.status() >= 400) events.push(`http ${r.status()}: ${r.url()}`) })

  for (const path of ['/', '/login']) {
    await page.goto(base + path, { waitUntil: 'networkidle' }).catch((e) => problems.push(`goto ${path}: ${e.message}`))
    await page.waitForTimeout(2500)
    const info = await page.evaluate(() => ({
      url: location.pathname,
      rootLen: document.getElementById('root')?.innerHTML.length ?? -1,
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
    }))
    note('notice', `Page ${path}`, `ended at ${info.url}; root html length ${info.rootLen}; text: ${info.text || '(empty)'}`)
    if (info.rootLen < 50) problems.push(`BLANK PAGE on ${path}: #root is empty`)
  }
} catch (e) {
  problems.push(`script: ${e.message}`)
} finally {
  if (events.length) note('warning', 'Network and console events', events.slice(0, 15).join('\n'))
  if (problems.length) {
    note('error', 'Problems found', problems.slice(0, 10).join('\n'))
    process.exitCode = 1
  } else {
    note('notice', 'Smoke test', 'Page rendered with no console errors.')
  }
  await browser?.close()
  server.kill()
}
