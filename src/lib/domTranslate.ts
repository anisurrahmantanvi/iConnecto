/**
 * Translates the texts that are on screen when the language is not English, by exact match with the dictionaries.
 * Keeps the English original of every node it changes so switching back restores it. User content (posts, chats,
 * bios, inputs) is skipped. Texts built from several parts (a name plus a sentence) stay in English.
 */
const SKIP = 'script,style,textarea,input,select,code,pre,[contenteditable],.notranslate,.bubble,.post__body,.profile-bio,.comment__body'
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt']

let dict: Record<string, string> = {}
let observer: MutationObserver | null = null
const originalText = new WeakMap<Text, string>()
const originalAttr = new WeakMap<Element, Record<string, string>>()
const touchedText = new Set<WeakRef<Text>>()
const touchedEls = new Set<WeakRef<Element>>()

const skipped = (el: Element | null) => !el || !!el.closest(SKIP)

function lookup(text: string): string | undefined {
  const t = text.trim()
  if (!t) return undefined
  const hit = dict[t]
  if (!hit) return undefined
  const lead = text.slice(0, text.indexOf(t))
  return lead + hit + text.slice(lead.length + t.length)
}

function doText(node: Text) {
  if (skipped(node.parentElement)) return
  const cur = node.nodeValue ?? ''
  const orig = originalText.get(node)
  const base = orig !== undefined && lookup(orig) === cur ? orig : cur
  const out = lookup(base)
  if (out !== undefined && out !== cur) {
    if (orig === undefined || base !== orig) originalText.set(node, base)
    touchedText.add(new WeakRef(node))
    node.nodeValue = out
  }
}

function doEl(el: Element) {
  if (skipped(el)) return
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (!v) continue
    const out = lookup(v)
    if (out !== undefined && out !== v) {
      const saved = originalAttr.get(el) ?? {}
      saved[a] = v
      originalAttr.set(el, saved)
      touchedEls.add(new WeakRef(el))
      el.setAttribute(a, out)
    }
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  doEl(el)
  const w = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let n = w.nextNode()
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text)
    else doEl(n as Element)
    n = w.nextNode()
  }
}

function restore() {
  for (const ref of touchedText) {
    const n = ref.deref()
    const o = n && originalText.get(n)
    if (n && o !== undefined) n.nodeValue = o
  }
  for (const ref of touchedEls) {
    const el = ref.deref()
    const saved = el && originalAttr.get(el)
    if (el && saved) for (const [a, v] of Object.entries(saved)) el.setAttribute(a, v)
  }
  touchedText.clear()
  touchedEls.clear()
}

/** Start (or stop, with an empty dictionary) translating the page. */
export function setDomTranslation(d: Record<string, string> | null): void {
  observer?.disconnect()
  observer = null
  restore()
  if (!d || typeof document === 'undefined' || !document.body) return
  dict = d
  walk(document.body)
  observer = new MutationObserver((records) => {
    observer?.disconnect()
    for (const r of records) {
      if (r.type === 'characterData') walk(r.target)
      else if (r.type === 'attributes') doEl(r.target as Element)
      else r.addedNodes.forEach((n) => walk(n))
    }
    observer?.observe(document.body, OPTS)
  })
  observer.observe(document.body, OPTS)
}
const OPTS: MutationObserverInit = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }
