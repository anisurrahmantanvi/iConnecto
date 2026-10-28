#!/usr/bin/env node
/**
 * Optional: self-host the emoji images so the app does not depend on a public CDN.
 *
 *   node scripts/vendor-emoji.mjs
 *   # then set VITE_EMOJI_BASE_URL=/emoji/ in .env and rebuild
 *
 * Downloads the Twemoji SVG for every emoji in the picker and the quick-reaction bar into public/emoji/.
 * Emoji that are not in that set (typed from a phone keyboard, for example) are not downloaded; the app shows
 * them with the device's native glyph if an image is missing, so nothing breaks.
 * Needs Node 18+ and internet access. Twemoji graphics are CC-BY 4.0 (https://github.com/jdecked/twemoji).
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/'
const outDir = path.join(root, 'public', 'emoji')

// Same naming rule as src/lib/emoji.ts (emojiToCodepoints).
const toCodepoints = (emoji) => {
  const raw = emoji.includes('‍') ? emoji : emoji.replace(/️/g, '')
  return Array.from(raw).map((c) => c.codePointAt(0).toString(16)).join('-')
}

const src = await readFile(path.join(root, 'src', 'lib', 'emoji.ts'), 'utf8')
const grab = (name) => {
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\n?\\]`))
  if (!m) throw new Error(`Could not find ${name} in src/lib/emoji.ts`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}
const emoji = [...new Set([...grab('QUICK_REACTIONS'), ...grab('EMOJI_PICKER_SET')])]

await mkdir(outDir, { recursive: true })
let ok = 0, skipped = 0
const failed = []
for (const e of emoji) {
  const name = `${toCodepoints(e)}.svg`
  const file = path.join(outDir, name)
  if (await access(file).then(() => true, () => false)) { skipped++; continue }
  try {
    const res = await fetch(SOURCE + name)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await writeFile(file, await res.text())
    ok++
  } catch (err) {
    failed.push(`${e} (${name}): ${err.message}`)
  }
}
console.log(`emoji in picker: ${emoji.length}, downloaded: ${ok}, already present: ${skipped}, failed: ${failed.length}`)
if (failed.length) { console.log(failed.join('\n')); process.exitCode = 1 }
else console.log('Done. Set VITE_EMOJI_BASE_URL=/emoji/ in your .env and rebuild.')
