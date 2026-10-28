import { useEffect, type RefObject } from 'react'

/** Calls onOutside when the user clicks/taps outside the element or presses Escape. */
export function useOutsideClick(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = ref.current
      if (el && e.target instanceof Node && !el.contains(e.target)) onOutside()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOutside()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, onOutside, active])
}

/** Grows a textarea with its content up to maxPx. */
export function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxPx = 140) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`
  }, [ref, value, maxPx])
}

/**
 * Inserts text at the caret of an input/textarea and returns the new value and caret position.
 * `max` is the character limit; when the result would exceed it the original value is returned unchanged.
 */
export function insertAtCaret(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  text: string,
  max = Infinity,
): { value: string; caret: number } {
  const start = el?.selectionStart ?? current.length
  const end = el?.selectionEnd ?? current.length
  const next = current.slice(0, start) + text + current.slice(end)
  if (next.length > max) return { value: current, caret: start }
  return { value: next, caret: start + text.length }
}

/** Restores focus and caret after a programmatic value change (React resets the caret on controlled inputs). */
export function restoreCaret(el: HTMLInputElement | HTMLTextAreaElement | null, caret: number) {
  if (!el) return
  window.requestAnimationFrame(() => {
    el.focus()
    try {
      el.setSelectionRange(caret, caret)
    } catch {
      /* some input types do not support selection */
    }
  })
}
