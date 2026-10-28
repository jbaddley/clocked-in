import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768
const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

const belowLarge = "(max-width: 1023px)"

function subscribeBelowLarge(onChange: () => void) {
  const mql = window.matchMedia(belowLarge)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/** Below Tailwind's lg breakpoint. */
export function useIsBelowLarge() {
  return useSyncExternalStore(
    subscribeBelowLarge,
    () => window.matchMedia(belowLarge).matches,
    () => false,
  )
}
