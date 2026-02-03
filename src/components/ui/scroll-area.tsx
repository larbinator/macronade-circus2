import * as React from "react"
import { cn } from "@/lib/utils"

type ScrollMetrics = {
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  scrollWidth: number
  clientHeight: number
  clientWidth: number
}

type DragState = {
  axis: "x" | "y"
  startPointer: number
  startScroll: number
  maxThumb: number
  maxScroll: number
}

type ScrollAreaProps = {
  children: React.ReactNode
  className?: string
  showScrollbars?: boolean
}

const readMetrics = (element: HTMLDivElement): ScrollMetrics => ({
  scrollTop: element.scrollTop,
  scrollLeft: element.scrollLeft,
  scrollHeight: element.scrollHeight,
  scrollWidth: element.scrollWidth,
  clientHeight: element.clientHeight,
  clientWidth: element.clientWidth,
})

export function ScrollArea({
  children,
  className,
  showScrollbars = false,
}: ScrollAreaProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const hideTimerRef = React.useRef<number | null>(null)
  const [metrics, setMetrics] = React.useState<ScrollMetrics>(() => ({
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientHeight: 0,
    clientWidth: 0,
  }))
  const [isHovering, setIsHovering] = React.useState(false)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)

  const updateMetrics = React.useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }
    setMetrics(readMetrics(viewport))
  }, [])

  const scheduleUpdate = React.useCallback(() => {
    if (rafRef.current !== null) {
      return
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      updateMetrics()
    })
  }, [updateMetrics])

  React.useLayoutEffect(() => {
    updateMetrics()
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content || typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(() => { scheduleUpdate(); })
    observer.observe(viewport)
    observer.observe(content)
    return () => { observer.disconnect(); }
  }, [scheduleUpdate, updateMetrics])

  React.useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }
    const onScroll = () => {
      setIsScrolling(true)
      scheduleUpdate()
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => { viewport.removeEventListener("scroll", onScroll); }
  }, [scheduleUpdate])

  React.useEffect(() => {
    if (!isScrolling) {
      return
    }
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
    }
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null
      setIsScrolling(false)
    }, 900)
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [isScrolling])

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [])

  const showVertical = metrics.scrollHeight > metrics.clientHeight + 1
  const showHorizontal = metrics.scrollWidth > metrics.clientWidth + 1

  const trackHeight = metrics.clientHeight
  const trackWidth = metrics.clientWidth
  const maxScrollTop = Math.max(0, metrics.scrollHeight - metrics.clientHeight)
  const maxScrollLeft = Math.max(0, metrics.scrollWidth - metrics.clientWidth)

  const thumbHeight = showVertical
    ? Math.max(24, (metrics.clientHeight * metrics.clientHeight) / metrics.scrollHeight)
    : 0
  const thumbWidth = showHorizontal
    ? Math.max(24, (metrics.clientWidth * metrics.clientWidth) / metrics.scrollWidth)
    : 0

  const maxThumbTop = Math.max(0, trackHeight - thumbHeight)
  const maxThumbLeft = Math.max(0, trackWidth - thumbWidth)
  const thumbTop =
    maxScrollTop > 0 ? (metrics.scrollTop / maxScrollTop) * maxThumbTop : 0
  const thumbLeft =
    maxScrollLeft > 0 ? (metrics.scrollLeft / maxScrollLeft) * maxThumbLeft : 0

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, axis: "x" | "y") => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }
    event.preventDefault()
    setIsDragging(true)
    const maxScroll = axis === "y" ? maxScrollTop : maxScrollLeft
    const maxThumb = axis === "y" ? maxThumbTop : maxThumbLeft
    dragRef.current = {
      axis,
      startPointer: axis === "y" ? event.clientY : event.clientX,
      startScroll: axis === "y" ? viewport.scrollTop : viewport.scrollLeft,
      maxThumb,
      maxScroll,
    }
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) {
        return
      }
      const { startPointer, startScroll, axis: dragAxis, maxScroll, maxThumb } =
        dragRef.current
      const delta =
        (dragAxis === "y" ? moveEvent.clientY : moveEvent.clientX) - startPointer
      if (maxThumb <= 0 || maxScroll <= 0) {
        return
      }
      const scrollDelta = (delta / maxThumb) * maxScroll
      if (dragAxis === "y") {
        viewport.scrollTop = startScroll + scrollDelta
      } else {
        viewport.scrollLeft = startScroll + scrollDelta
      }
    }
    const handlePointerUp = () => {
      dragRef.current = null
      setIsDragging(false)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }

  const showTracks = showScrollbars && (isHovering || isScrolling || isDragging)
  const showVerticalTrack = showScrollbars && showVertical && showTracks
  const showHorizontalTrack = showScrollbars && showHorizontal && showTracks

  return (
    <div
      className={cn(
        "scroll-area relative",
        showScrollbars ? "scroll-area--with-bars" : "",
        className,
      )}
      onPointerEnter={() => { setIsHovering(true); }}
      onPointerLeave={() => { setIsHovering(false); }}
      onWheel={() => { setIsScrolling(true); }}
    >
      <div ref={viewportRef} className="scroll-area-viewport h-full w-full overflow-auto">
        <div ref={contentRef}>{children}</div>
      </div>
      {showScrollbars && showVertical ? (
        <div
          className="scroll-area-track scroll-area-track-y"
          data-visible={showVerticalTrack ? "true" : "false"}
        >
          <div
            className="scroll-area-thumb"
            style={{
              height: `${thumbHeight}px`,
              width: "100%",
              transform: `translateY(${thumbTop}px)`,
            }}
            onPointerDown={(event) => { startDrag(event, "y"); }}
          />
        </div>
      ) : null}
      {showScrollbars && showHorizontal ? (
        <div
          className="scroll-area-track scroll-area-track-x"
          data-visible={showHorizontalTrack ? "true" : "false"}
        >
          <div
            className="scroll-area-thumb"
            style={{
              width: `${thumbWidth}px`,
              height: "100%",
              transform: `translateX(${thumbLeft}px)`,
            }}
            onPointerDown={(event) => { startDrag(event, "x"); }}
          />
        </div>
      ) : null}
    </div>
  )
}
