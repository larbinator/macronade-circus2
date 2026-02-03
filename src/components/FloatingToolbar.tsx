import * as React from "react"
import { OverlayToolbar, type ToolbarItem } from "@/components/OverlayToolbar"
import { useOverlayDrag } from "@/hooks/use-overlay-drag"
import { usePersistedOverlay } from "@/hooks/use-persisted-overlay"
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

  const {
    position,
    setPosition,
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
  })

  const measure = React.useCallback(() => {
    if (!overlayRef.current) {
      return
    }
    const rect = overlayRef.current.getBoundingClientRect()
    setSize({ w: rect.width, h: rect.height })
  }, [setSize])

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
      setSize({ w: rect.width, h: rect.height })
      clampToBounds()
      persistGeometry()
    })
    observer.observe(element)
    return () => { observer.disconnect(); }
  }, [clampToBounds, persistGeometry, setSize])

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

  const { startDrag } = useOverlayDrag({
    getBounds,
    sizeRef,
    positionRef,
    setPosition,
    persistGeometry,
  })

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
    startDrag(event)
  }

  return (
    <div
      ref={overlayRef}
      className={cn("absolute z-40", className)}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => {
        if (event.button === 2) {
          startDrag(event)
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
        dragHandleProps={{ onPointerDown: startDrag }}
      />
    </div>
  )
}
