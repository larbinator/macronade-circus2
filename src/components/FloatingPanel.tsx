import * as React from "react"
import { PanelShell } from "@/components/PanelShell"
import { cn } from "@/lib/utils"

type FloatingPanelProps = {
  title: string
  children: React.ReactNode
  initialX: number
  initialY: number
  initialWidth: number
  initialHeight: number
  minWidth?: number
  minHeight?: number
  boundsRef?: React.RefObject<HTMLElement | null>
  storageKey?: string
  className?: string
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

type ResizeState = {
  pointerId: number
  startX: number
  startY: number
  startW: number
  startH: number
  startLeft: number
  startTop: number
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  target?: HTMLElement
}

type StoredPanelState = {
  x: number
  y: number
  w: number
  h: number
  boundsW?: number
  boundsH?: number
  xPct?: number
  yPct?: number
  wPct?: number
  hPct?: number
  version?: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function FloatingPanel({
  title,
  children,
  initialX,
  initialY,
  initialWidth,
  initialHeight,
  minWidth = 240,
  minHeight = 200,
  boundsRef,
  storageKey,
  className,
}: FloatingPanelProps) {
  const resolvedStorageKey = React.useMemo(() => {
    if (storageKey) {
      return storageKey
    }
    return `panel:${title.toLowerCase().replace(/\s+/g, "-")}`
  }, [storageKey, title])

  const storedState = React.useMemo<StoredPanelState | null>(() => {
    if (typeof window === "undefined") {
      return null
    }
    try {
      const raw = window.localStorage.getItem(resolvedStorageKey)
      if (!raw) {
        return null
      }
      const parsed = JSON.parse(raw) as StoredPanelState
      const values = [parsed.x, parsed.y, parsed.w, parsed.h]
      if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }, [resolvedStorageKey])

  const [position, setPosition] = React.useState(() => ({
    x: storedState?.x ?? initialX,
    y: storedState?.y ?? initialY,
  }))
  const [size, setSize] = React.useState(() => ({
    w: Math.max(storedState?.w ?? initialWidth, minWidth),
    h: Math.max(storedState?.h ?? initialHeight, minHeight),
  }))
  const positionRef = React.useRef(position)
  const sizeRef = React.useRef(size)
  const dragRef = React.useRef<DragState | null>(null)
  const resizeRef = React.useRef<ResizeState | null>(null)
  const userSelectRef = React.useRef<string | null>(null)
  const hydratedRef = React.useRef(false)
  const restoredRef = React.useRef(false)
  const storedStateRef = React.useRef<StoredPanelState | null>(storedState)

  React.useEffect(() => {
    positionRef.current = position
  }, [position])

  React.useEffect(() => {
    sizeRef.current = size
  }, [size])

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
  }, [getBounds])

  React.useLayoutEffect(() => {
    hydratedRef.current = true
  }, [])

  const persistGeometry = React.useCallback(() => {
    if (typeof window === "undefined" || !hydratedRef.current) {
      return
    }
    const bounds = getBounds()
    if (!bounds) {
      return
    }
    const payload: StoredPanelState = {
      x: positionRef.current.x,
      y: positionRef.current.y,
      w: sizeRef.current.w,
      h: sizeRef.current.h,
      version: 1,
      boundsW: bounds.width,
      boundsH: bounds.height,
      xPct: bounds.width > 0 ? positionRef.current.x / bounds.width : 0,
      yPct: bounds.height > 0 ? positionRef.current.y / bounds.height : 0,
      wPct: bounds.width > 0 ? sizeRef.current.w / bounds.width : 0,
      hPct: bounds.height > 0 ? sizeRef.current.h / bounds.height : 0,
    }
    window.localStorage.setItem(resolvedStorageKey, JSON.stringify(payload))
  }, [getBounds, resolvedStorageKey])

  React.useEffect(() => {
    if (typeof window === "undefined" || !hydratedRef.current) {
      return
    }
    if (storedStateRef.current && !restoredRef.current) {
      return
    }
    persistGeometry()
  }, [persistGeometry, position, size])

  React.useEffect(() => {
    clampToBounds()
    const onResize = () => clampToBounds()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [clampToBounds])

  const applyStoredToBounds = React.useCallback(
    (bounds: DOMRect) => {
      const stored = storedStateRef.current
      if (!stored || restoredRef.current) {
        return false
      }
      let nextX = stored.x
      let nextY = stored.y
      let nextW = stored.w
      let nextH = stored.h

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
        if (typeof stored.wPct === "number") {
          nextW = stored.wPct * bounds.width
        } else {
          nextW = stored.w * scaleX
        }
        if (typeof stored.hPct === "number") {
          nextH = stored.hPct * bounds.height
        } else {
          nextH = stored.h * scaleY
        }
      }

      nextW = clamp(nextW, minWidth, bounds.width)
      nextH = clamp(nextH, minHeight, bounds.height)
      const maxX = Math.max(0, bounds.width - nextW)
      const maxY = Math.max(0, bounds.height - nextH)
      nextX = clamp(nextX, 0, maxX)
      nextY = clamp(nextY, 0, maxY)

      setPosition({ x: nextX, y: nextY })
      setSize({ w: nextW, h: nextH })
      restoredRef.current = true
      return true
    },
    [minHeight, minWidth],
  )

  React.useLayoutEffect(() => {
    if (!boundsRef?.current) {
      return
    }
    const element = boundsRef.current

    if (typeof ResizeObserver === "undefined") {
      requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          const applied = applyStoredToBounds(rect)
          if (!applied) {
            clampToBounds()
          }
          persistGeometry()
        }
      })
      return
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) {
        return
      }
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }
      const applied = applyStoredToBounds(rect as DOMRect)
      if (!applied) {
        clampToBounds()
      }
      persistGeometry()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [applyStoredToBounds, boundsRef, clampToBounds, persistGeometry])

  const restoreUserSelect = React.useCallback(() => {
    if (userSelectRef.current !== null && !dragRef.current && !resizeRef.current) {
      document.body.style.userSelect = userSelectRef.current
      userSelectRef.current = null
    }
  }, [])

  const handleDragMove = React.useCallback(
    (event: PointerEvent) => {
      const state = dragRef.current
      if (!state || state.pointerId !== event.pointerId) {
        return
      }
      const bounds = getBounds()
      const deltaX = event.clientX - state.startX
      const deltaY = event.clientY - state.startY
      let nextX = state.originX + deltaX
      let nextY = state.originY + deltaY
      if (bounds) {
        const maxX = Math.max(0, bounds.width - sizeRef.current.w)
        const maxY = Math.max(0, bounds.height - sizeRef.current.h)
        nextX = clamp(nextX, 0, maxX)
        nextY = clamp(nextY, 0, maxY)
      }
      setPosition({ x: nextX, y: nextY })
    },
    [getBounds],
  )

  const stopDrag = React.useCallback(
    (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) {
        return
      }
      dragRef.current = null
      window.removeEventListener("pointermove", handleDragMove)
      window.removeEventListener("pointerup", stopDrag)
      window.removeEventListener("pointercancel", stopDrag)
      persistGeometry()
      restoreUserSelect()
    },
    [handleDragMove, persistGeometry, restoreUserSelect],
  )

  const handleResizeMove = React.useCallback(
    (event: PointerEvent) => {
      const state = resizeRef.current
      if (!state || state.pointerId !== event.pointerId) {
        return
      }
      const bounds = getBounds()
      const deltaX = event.clientX - state.startX
      const deltaY = event.clientY - state.startY
      const isLeft = state.corner.includes("left")
      const isTop = state.corner.includes("top")
      const startRight = state.startLeft + state.startW
      const startBottom = state.startTop + state.startH

      let nextX = isLeft ? state.startLeft + deltaX : state.startLeft
      let nextY = isTop ? state.startTop + deltaY : state.startTop
      let nextW = isLeft ? startRight - nextX : state.startW + deltaX
      let nextH = isTop ? startBottom - nextY : state.startH + deltaY

      if (nextW < minWidth) {
        nextW = minWidth
        if (isLeft) {
          nextX = startRight - minWidth
        }
      }
      if (nextH < minHeight) {
        nextH = minHeight
        if (isTop) {
          nextY = startBottom - minHeight
        }
      }

      if (bounds) {
        if (nextX < 0) {
          nextX = 0
          if (isLeft) {
            nextW = startRight - nextX
          }
        }
        if (nextY < 0) {
          nextY = 0
          if (isTop) {
            nextH = startBottom - nextY
          }
        }

        const maxW = Math.max(0, bounds.width - nextX)
        const maxH = Math.max(0, bounds.height - nextY)
        nextW = clamp(nextW, Math.min(minWidth, maxW), maxW)
        nextH = clamp(nextH, Math.min(minHeight, maxH), maxH)
      }

      setPosition({ x: nextX, y: nextY })
      setSize({ w: nextW, h: nextH })
    },
    [getBounds, minHeight, minWidth],
  )

  const stopResize = React.useCallback(
    (event: PointerEvent) => {
      const current = resizeRef.current
      if (!current || current.pointerId !== event.pointerId) {
        return
      }
      if (current.target?.hasPointerCapture(event.pointerId)) {
        current.target.releasePointerCapture(event.pointerId)
      }
      resizeRef.current = null
      window.removeEventListener("pointermove", handleResizeMove)
      window.removeEventListener("pointerup", stopResize)
      window.removeEventListener("pointercancel", stopResize)
      persistGeometry()
      restoreUserSelect()
    },
    [handleResizeMove, persistGeometry, restoreUserSelect],
  )

  React.useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleDragMove)
      window.removeEventListener("pointerup", stopDrag)
      window.removeEventListener("pointercancel", stopDrag)
      window.removeEventListener("pointermove", handleResizeMove)
      window.removeEventListener("pointerup", stopResize)
      window.removeEventListener("pointercancel", stopResize)
      restoreUserSelect()
    }
  }, [handleDragMove, handleResizeMove, restoreUserSelect, stopDrag, stopResize])

  const startDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault()
      if (userSelectRef.current === null) {
        userSelectRef.current = document.body.style.userSelect
        document.body.style.userSelect = "none"
      }
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: positionRef.current.x,
        originY: positionRef.current.y,
      }
      window.addEventListener("pointermove", handleDragMove)
      window.addEventListener("pointerup", stopDrag)
      window.addEventListener("pointercancel", stopDrag)
    },
    [handleDragMove, stopDrag],
  )

  const handleHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    startDrag(event)
  }

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    const corner = event.currentTarget.dataset.corner as ResizeState["corner"] | undefined
    if (!corner) {
      return
    }
    if (userSelectRef.current === null) {
      userSelectRef.current = document.body.style.userSelect
      document.body.style.userSelect = "none"
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startW: sizeRef.current.w,
      startH: sizeRef.current.h,
      startLeft: positionRef.current.x,
      startTop: positionRef.current.y,
      corner,
      target: event.currentTarget,
    }
    window.addEventListener("pointermove", handleResizeMove)
    window.addEventListener("pointerup", stopResize)
    window.addEventListener("pointercancel", stopResize)
  }

  return (
    <div
      className={cn("absolute z-30", className)}
      style={{
        left: position.x,
        top: position.y,
        width: size.w,
        height: size.h,
      }}
      onPointerDown={(event) => {
        if (event.button === 2) {
          startDrag(event)
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <PanelShell
        title={title}
        className="h-full"
        headerProps={{
          onPointerDown: handleHeaderPointerDown,
        }}
        resizeHandleProps={{
          onPointerDown: handleResizePointerDown,
          onPointerMove: (event) => handleResizeMove(event.nativeEvent),
          onPointerUp: (event) => stopResize(event.nativeEvent),
          onPointerCancel: (event) => stopResize(event.nativeEvent),
        }}
      >
        {children}
      </PanelShell>
    </div>
  )
}
