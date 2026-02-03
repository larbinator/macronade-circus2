import * as React from "react"
import { OverlayToolbar, type ToolbarItem } from "@/components/OverlayToolbar"
import { cn } from "@/lib/utils"

type FloatingToolbarProps = {
  title: string
  items: ToolbarItem[]
  initialX: number
  initialY: number
  boundsRef?: React.RefObject<HTMLElement | null>
  storageKey?: string
  activeItems?: Record<string, boolean>
  onItemAction?: (id: string) => void
  onItemToggle?: (id: string, pressed: boolean) => void
  className?: string
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

type StoredToolbarState = {
  x: number
  y: number
  boundsW?: number
  boundsH?: number
  xPct?: number
  yPct?: number
  version?: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function FloatingToolbar({
  title,
  items,
  initialX,
  initialY,
  boundsRef,
  storageKey,
  activeItems,
  onItemAction,
  onItemToggle,
  className,
}: FloatingToolbarProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null)
  const resolvedStorageKey = React.useMemo(() => {
    if (storageKey) {
      return storageKey
    }
    return `toolbar:${title.toLowerCase().replace(/\s+/g, "-")}`
  }, [storageKey, title])

  const storedState = React.useMemo<StoredToolbarState | null>(() => {
    if (typeof window === "undefined") {
      return null
    }
    try {
      const raw = window.localStorage.getItem(resolvedStorageKey)
      if (!raw) {
        return null
      }
      const parsed = JSON.parse(raw) as StoredToolbarState
      const values = [parsed.x, parsed.y]
      if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }, [resolvedStorageKey])

  const [position, setPosition] = React.useState({
    x: storedState?.x ?? initialX,
    y: storedState?.y ?? initialY,
  })
  const positionRef = React.useRef(position)
  const sizeRef = React.useRef({ w: 0, h: 0 })
  const dragRef = React.useRef<DragState | null>(null)
  const userSelectRef = React.useRef<string | null>(null)
  const hydratedRef = React.useRef(false)
  const restoredRef = React.useRef(false)
  const storedStateRef = React.useRef<StoredToolbarState | null>(storedState)

  React.useEffect(() => {
    positionRef.current = position
  }, [position])

  React.useLayoutEffect(() => {
    hydratedRef.current = true
  }, [])

  const getBounds = React.useCallback(() => {
    if (!boundsRef?.current) {
      return null
    }
    return boundsRef.current.getBoundingClientRect()
  }, [boundsRef])

  const measure = React.useCallback(() => {
    if (!overlayRef.current) {
      return
    }
    const rect = overlayRef.current.getBoundingClientRect()
    sizeRef.current = { w: rect.width, h: rect.height }
  }, [])

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

  const persistGeometry = React.useCallback(() => {
    if (typeof window === "undefined" || !hydratedRef.current) {
      return
    }
    const bounds = getBounds()
    if (!bounds) {
      return
    }
    const payload: StoredToolbarState = {
      x: positionRef.current.x,
      y: positionRef.current.y,
      version: 1,
      boundsW: bounds.width,
      boundsH: bounds.height,
      xPct: bounds.width > 0 ? positionRef.current.x / bounds.width : 0,
      yPct: bounds.height > 0 ? positionRef.current.y / bounds.height : 0,
    }
    window.localStorage.setItem(resolvedStorageKey, JSON.stringify(payload))
  }, [getBounds, resolvedStorageKey])

  const applyStoredToBounds = React.useCallback((bounds: DOMRect) => {
    const stored = storedStateRef.current
    if (!stored || restoredRef.current) {
      return false
    }
    let nextX = stored.x
    let nextY = stored.y
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
    }
    const maxX = Math.max(0, bounds.width - sizeRef.current.w)
    const maxY = Math.max(0, bounds.height - sizeRef.current.h)
    nextX = clamp(nextX, 0, maxX)
    nextY = clamp(nextY, 0, maxY)
    setPosition({ x: nextX, y: nextY })
    restoredRef.current = true
    return true
  }, [])

  React.useLayoutEffect(() => {
    measure()
    clampToBounds()
  }, [measure, clampToBounds])

  React.useEffect(() => {
    if (!overlayRef.current || typeof ResizeObserver === "undefined") {
      return
    }
    const element = overlayRef.current
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect()
      sizeRef.current = { w: rect.width, h: rect.height }
      clampToBounds()
      persistGeometry()
    })
    observer.observe(element)
    return () => { observer.disconnect(); }
  }, [clampToBounds, persistGeometry])

  React.useEffect(() => {
    const onResize = () => {
      measure()
      clampToBounds()
    }
    window.addEventListener("resize", onResize)
    return () => { window.removeEventListener("resize", onResize); }
  }, [measure, clampToBounds])

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
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return
      }
      const applied = applyStoredToBounds(rect as DOMRect)
      if (!applied) {
        clampToBounds()
      }
      persistGeometry()
    })
    observer.observe(element)
    return () => { observer.disconnect(); }
  }, [applyStoredToBounds, boundsRef, clampToBounds, persistGeometry])

  const restoreUserSelect = React.useCallback(() => {
    if (userSelectRef.current !== null && !dragRef.current) {
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

  React.useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleDragMove)
      window.removeEventListener("pointerup", stopDrag)
      window.removeEventListener("pointercancel", stopDrag)
      restoreUserSelect()
    }
  }, [handleDragMove, restoreUserSelect, stopDrag])

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
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
  }

  const handleDragPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    if (event.target instanceof HTMLElement) {
      const interactive = event.target.closest(
        "button, [role='button'], input, select, textarea, a",
      )
      if (interactive) {
        return
      }
    }
    beginDrag(event)
  }

  return (
    <div
      ref={overlayRef}
      className={cn("absolute z-40", className)}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => {
        if (event.button === 2) {
          beginDrag(event)
        } else {
          handleDragPointerDown(event)
        }
      }}
      onContextMenu={(event) => { event.preventDefault(); }}
    >
      <OverlayToolbar
        title={title}
        items={items}
        activeItems={activeItems}
        onItemAction={onItemAction}
        onItemToggle={onItemToggle}
        dragHandleProps={{ onPointerDown: beginDrag }}
      />
    </div>
  )
}
