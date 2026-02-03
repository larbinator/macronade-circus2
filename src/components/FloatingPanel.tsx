import * as React from "react"
import { PanelShell } from "@/components/PanelShell"
import { useOverlayDrag } from "@/hooks/use-overlay-drag"
import { usePersistedOverlay } from "@/hooks/use-persisted-overlay"
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

  const {
    position,
    setPosition,
    size,
    setSize,
    positionRef,
    sizeRef,
    clampToBounds,
    getBounds,
    persistGeometry,
    applyStoredToBounds,
  } = usePersistedOverlay({
    title,
    storageKey: resolvedStorageKey,
    boundsRef,
    initialX,
    initialY,
    initialWidth,
    initialHeight,
    minWidth,
    minHeight,
    persistSize: true,
  })

  const resizeRef = React.useRef<ResizeState | null>(null)
  const userSelectRef = React.useRef<string | null>(null)
  const { startDrag, restoreUserSelect } = useOverlayDrag({
    getBounds,
    sizeRef,
    positionRef,
    setPosition,
    persistGeometry,
    userSelectRef,
    shouldRestoreUserSelect: () => !resizeRef.current,
  })
  React.useEffect(() => {
    clampToBounds()
    const onResize = () => { clampToBounds(); }
    window.addEventListener("resize", onResize)
    return () => { window.removeEventListener("resize", onResize); }
  }, [clampToBounds])

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
    return () => { observer.disconnect(); }
  }, [applyStoredToBounds, boundsRef, clampToBounds, persistGeometry])

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
      window.removeEventListener("pointermove", handleResizeMove)
      window.removeEventListener("pointerup", stopResize)
      window.removeEventListener("pointercancel", stopResize)
      restoreUserSelect()
    }
  }, [handleResizeMove, restoreUserSelect, stopResize])

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
      onContextMenu={(event) => { event.preventDefault(); }}
    >
      <PanelShell
        title={title}
        className="h-full"
        showHeader={false}
        headerProps={{
          onPointerDown: handleHeaderPointerDown,
        }}
        resizeHandleProps={{
          onPointerDown: handleResizePointerDown,
          onPointerMove: (event) => { handleResizeMove(event.nativeEvent); },
          onPointerUp: (event) => { stopResize(event.nativeEvent); },
          onPointerCancel: (event) => { stopResize(event.nativeEvent); },
        }}
      >
        {children}
      </PanelShell>
    </div>
  )
}
