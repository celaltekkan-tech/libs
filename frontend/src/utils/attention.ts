import type { ReactNode } from 'react'

const PULSE_MS = 1850

type WarningApi = {
  warning: (content: ReactNode, duration?: number) => void
}

const tokens = new WeakMap<HTMLElement, number>()
const timers = new WeakMap<HTMLElement, number>()
let pulseSeq = 0

function scrollParents(el: HTMLElement): HTMLElement[] {
  const list: HTMLElement[] = []
  let node = el.parentElement
  while (node) {
    const style = getComputedStyle(node)
    const scrollsY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 1
    const scrollsX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 1
    if (scrollsY || scrollsX) list.push(node)
    node = node.parentElement
  }
  return list
}

function clipBox(el: HTMLElement) {
  let top = 0
  let left = 0
  let right = window.innerWidth
  let bottom = window.innerHeight
  for (const parent of scrollParents(el)) {
    const box = parent.getBoundingClientRect()
    top = Math.max(top, box.top)
    left = Math.max(left, box.left)
    right = Math.min(right, box.right)
    bottom = Math.min(bottom, box.bottom)
  }
  return { top, left, right, bottom }
}

function isInView(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return false
  const clip = clipBox(el)
  const pad = 12
  const top = clip.top + pad
  const bottom = clip.bottom - pad
  const left = clip.left + pad
  const right = clip.right - pad
  if (bottom <= top || right <= left) return false

  const horizontallyIn = rect.left < right && rect.right > left
  if (!horizontallyIn) return false

  if (rect.height > bottom - top) {
    return rect.top >= top - 8 && rect.top <= top + 48
  }
  return rect.top >= top && rect.bottom <= bottom && rect.left >= left && rect.right <= right
}

function reveal(el: HTMLElement): Promise<void> {
  if (isInView(el)) return Promise.resolve()
  const height = el.getBoundingClientRect().height
  const block: ScrollLogicalPosition = height > window.innerHeight * 0.7 ? 'start' : 'center'
  el.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' })
  return new Promise((resolve) => {
    let lastTop = Number.NaN
    let stable = 0
    const started = performance.now()
    const tick = () => {
      const top = el.getBoundingClientRect().top
      if (Number.isFinite(lastTop) && Math.abs(top - lastTop) < 0.5) stable += 1
      else stable = 0
      lastTop = top
      if (stable >= 4 || performance.now() - started > 900) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

function runPulse(el: HTMLElement) {
  const token = ++pulseSeq
  tokens.set(el, token)
  el.classList.remove('attention-pulse')
  void el.offsetWidth
  el.classList.add('attention-pulse')
  const previous = timers.get(el)
  if (previous) window.clearTimeout(previous)
  timers.set(
    el,
    window.setTimeout(() => {
      if (tokens.get(el) !== token) return
      el.classList.remove('attention-pulse')
    }, PULSE_MS),
  )
}

export function attentionElement(id: string): HTMLElement | null {
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '')
  const el = document.querySelector(`[data-attention="${escaped}"]`)
  return el instanceof HTMLElement ? el : null
}

export function pulseAttention(target: Element | string | null | undefined) {
  const el = typeof target === 'string' ? attentionElement(target) : target
  if (!(el instanceof HTMLElement)) return
  const token = ++pulseSeq
  tokens.set(el, token)
  void reveal(el).then(() => {
    if (tokens.get(el) !== token) return
    runPulse(el)
  })
}

export function warnAttention(
  messageApi: WarningApi,
  content: ReactNode,
  target?: Element | string | null,
  duration?: number,
) {
  if (duration === undefined) messageApi.warning(content)
  else messageApi.warning(content, duration)
  if (target) pulseAttention(target)
}
