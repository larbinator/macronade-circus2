import * as React from "react"

type OverlayPosition = { x: number; y: number }
type OverlaySize = { w: number; h: number }

type StoredOverlayState = {
  x: number
  y: number
  w?: number
  h?: number
  boundsW?: number
  boundsH?: number
  xPct?: number
  yPct?: number
  wPct?: number
  hPct?: number
  version?: number
}

type PersistedOverlayOptions = {
  title: string
  storageKey?: string
  boundsRef?: React.RefObject<HTMLElement | null>
  initialX: number
  initialY: number
  initialWidth?: number
  initialHeight?: number
  minWidth?: number
  minHeight?: number
  persistSize?: boolean
}

type PersistedOverlayResult = {
  position: OverlayPosition
  setPosition: (next: OverlayPosition | ((prev: OverlayPosition) => OverlayPosition)) => void
  size: OverlaySize
  setSize: (next: OverlaySize | ((prev: OverlaySize) => OverlaySize)) => void
  positionRef: React.MutableRefObject<OverlayPosition>
  sizeRef: React.MutableRefObject<OverlaySize>
  resolvedStorageKey: string
  clampToBounds: () => void
  getBounds: () => DOMRect | null
  persistGeometry: () => void
  applyStoredToBounds: (bounds: DOMRect) => boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function usePersistedOverlay({
  title,
  storageKey,
  boundsRef,
  initialX,
  initialY,
  initialWidth = 0,
  initialHeight = 0,
  minWidth = 0,
  minHeight = 0,
  persistSize = false,
}: PersistedOverlayOptions): PersistedOverlayResult {
  const resolvedStorageKey = React.useMemo(() => {
    if (storageKey) {
      return storageKey
    }
    return `overlay:${title.toLowerCase().replace(/\s+/g, "-")}`
  }, [storageKey, title])

  const storedState = React.useMemo<StoredOverlayState | null>(() => {
    if (typeof window === "undefined") {
      return null
    }
    try {
      const raw = window.localStorage.getItem(resolvedStorageKey)
      if (!raw) {
        return null
      }
      const parsed = JSON.parse(raw) as StoredOverlayState
      const values = persistSize
        ? [parsed.x, parsed.y, parsed.w, parsed.h]
        : [parsed.x, parsed.y]
      if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }, [persistSize, resolvedStorageKey])

  const storedStateRef = React.useRef<StoredOverlayState | null>(storedState)
  const restoredRef = React.useRef(false)
  const hydratedRef = React.useRef(false)
  const persistTimeoutRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    storedStateRef.current = storedState
    restoredRef.current = false
  }, [storedState])

  const [positionState, setPositionState] = React.useState<OverlayPosition>(() => ({
    x: storedState?.x ?? initialX,
    y: storedState?.y ?? initialY,
  }))
  const [sizeState, setSizeState] = React.useState<OverlaySize>(() => ({
    w: Math.max((persistSize ? storedState?.w : undefined) ?? initialWidth, minWidth),
    h: Math.max((persistSize ? storedState?.h : undefined) ?? initialHeight, minHeight),
  }))

  const positionRef = React.useRef(positionState)
  const sizeRef = React.useRef(sizeState)

  React.useEffect(() => {
    positionRef.current = positionState
  }, [positionState])

  React.useEffect(() => {
    sizeRef.current = sizeState
  }, [sizeState])

  const setPosition = React.useCallback(
    (next: OverlayPosition | ((prev: OverlayPosition) => OverlayPosition)) => {
      setPositionState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next
        positionRef.current = resolved
        return resolved
      })
    },
    [],
  )

  const setSize = React.useCallback(
    (next: OverlaySize | ((prev: OverlaySize) => OverlaySize)) => {
      setSizeState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next
        const clamped = {
          w: Math.max(resolved.w, minWidth),
          h: Math.max(resolved.h, minHeight),
        }
        sizeRef.current = clamped
        return clamped
      })
    },
    [minHeight, minWidth],
  )

  React.useLayoutEffect(() => {
    hydratedRef.current = true
  }, [])

  const getBounds = React.useCallback(() => {
    if (!boundsRef?.current) {
      return null
    }
    const rect = boundsRef.current.getBoundingClientRect()
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
      return null
    }
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }
    return rect
  }, [boundsRef])

  const clampToBounds = React.useCallback(() => {
    const bounds = getBounds()
    if (!bounds) {
      return
    }
    const maxX = Math.max(0, bounds.width - sizeRef.current.w)
    const maxY = Math.max(0, bounds.height - sizeRef.current.h)
    setPosition((prev) => ({
      x: clamp(prev.x, 0, maxX),
      y: clamp(prev.y, 0, maxY),
    }))
  }, [getBounds, setPosition])

  const persistGeometry = React.useCallback(() => {
    if (typeof window === "undefined" || !hydratedRef.current) {
      return
    }
    if (storedStateRef.current && !restoredRef.current) {
      return
    }
    const bounds = getBounds()
    if (!bounds) {
      return
    }
    const payload: StoredOverlayState = {
      x: positionRef.current.x,
      y: positionRef.current.y,
      version: 1,
      boundsW: bounds.width,
      boundsH: bounds.height,
      xPct: bounds.width > 0 ? positionRef.current.x / bounds.width : 0,
      yPct: bounds.height > 0 ? positionRef.current.y / bounds.height : 0,
    }
    if (persistSize) {
      payload.w = sizeRef.current.w
      payload.h = sizeRef.current.h
      payload.wPct = bounds.width > 0 ? sizeRef.current.w / bounds.width : 0
      payload.hPct = bounds.height > 0 ? sizeRef.current.h / bounds.height : 0
    }
    window.localStorage.setItem(resolvedStorageKey, JSON.stringify(payload))
  }, [getBounds, persistSize, resolvedStorageKey])

  const schedulePersist = React.useCallback(() => {
    if (typeof window === "undefined" || !hydratedRef.current) {
      return
    }
    if (storedStateRef.current && !restoredRef.current) {
      return
    }
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }
    persistTimeoutRef.current = window.setTimeout(() => {
      persistTimeoutRef.current = null
      persistGeometry()
    }, 120)
  }, [persistGeometry])

  React.useEffect(() => {
    if (typeof window === "undefined" || !hydratedRef.current) {
      return
    }
    if (storedStateRef.current && !restoredRef.current) {
      return
    }
    schedulePersist()
  }, [positionState, schedulePersist, sizeState])

  React.useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current)
        persistTimeoutRef.current = null
      }
    }
  }, [])

  const applyStoredToBounds = React.useCallback(
    (bounds: DOMRect) => {
      const stored = storedStateRef.current
      if (!stored || restoredRef.current) {
        return false
      }
      let nextX = stored.x
      let nextY = stored.y
      let nextW = sizeRef.current.w
      let nextH = sizeRef.current.h

      if (persistSize) {
        if (typeof stored.w === "number") {
          nextW = stored.w
        }
        if (typeof stored.h === "number") {
          nextH = stored.h
        }
      }

      if (stored.boundsW && stored.boundsH) {
        const scaleX = bounds.width / stored.boundsW
        const scaleY = bounds.height / stored.boundsH
        if (typeof stored.xPct === "number") {
          nextX = stored.xPct * bounds.width
        } else {
          nextX = stored.x * scaleX
        }
        if (typeof stored.yPct === "number") {
          nextY = stored.yPct * bounds.height
        } else {
          nextY = stored.y * scaleY
        }
        if (persistSize) {
          if (typeof stored.wPct === "number") {
            nextW = stored.wPct * bounds.width
          } else {
            nextW = stored.w ? stored.w * scaleX : nextW
          }
          if (typeof stored.hPct === "number") {
            nextH = stored.hPct * bounds.height
          } else {
            nextH = stored.h ? stored.h * scaleY : nextH
          }
        }
      }

      if (persistSize) {
        nextW = clamp(nextW, minWidth, bounds.width)
        nextH = clamp(nextH, minHeight, bounds.height)
        const maxX = Math.max(0, bounds.width - nextW)
        const maxY = Math.max(0, bounds.height - nextH)
        nextX = clamp(nextX, 0, maxX)
        nextY = clamp(nextY, 0, maxY)
        setSize({ w: nextW, h: nextH })
      } else {
        const maxX = Math.max(0, bounds.width - sizeRef.current.w)
        const maxY = Math.max(0, bounds.height - sizeRef.current.h)
        nextX = clamp(nextX, 0, maxX)
        nextY = clamp(nextY, 0, maxY)
      }

      setPosition({ x: nextX, y: nextY })
      restoredRef.current = true
      return true
    },
    [minHeight, minWidth, persistSize, setPosition, setSize],
  )

  return {
    position: positionState,
    setPosition,
    size: sizeState,
    setSize,
    positionRef,
    sizeRef,
    resolvedStorageKey,
    clampToBounds,
    getBounds,
    persistGeometry,
    applyStoredToBounds,
  }
}
