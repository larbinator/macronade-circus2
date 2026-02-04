import * as React from "react"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { useAppState } from "@/state/app-state"
import { ChevronLeft, ChevronRight, Minus, Play, Plus, Repeat, Square } from "lucide-react"

const formatTime = (frame: number, fps: number) => {
  if (fps <= 0) {
    return "00:00"
  }
  const totalSeconds = Math.floor(frame / fps)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0")
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  return `${minutes}:${seconds}`
}

export function Timeline() {
  const { state, dispatch } = useAppState()
  const { timeline } = state
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef(false)
  const rafRef = React.useRef<number | null>(null)
  const lastTimeRef = React.useRef<number | null>(null)
  const pendingScrollLeftRef = React.useRef<number | null>(null)
  const playbackRef = React.useRef({
    currentFrame: timeline.currentFrame,
    startFrame: timeline.startFrame,
    endFrame: timeline.endFrame,
    fps: timeline.fps,
    loopEnabled: timeline.loopEnabled,
  })

  React.useEffect(() => {
    playbackRef.current = {
      currentFrame: timeline.currentFrame,
      startFrame: timeline.startFrame,
      endFrame: timeline.endFrame,
      fps: timeline.fps,
      loopEnabled: timeline.loopEnabled,
    }
  }, [
    timeline.currentFrame,
    timeline.startFrame,
    timeline.endFrame,
    timeline.fps,
    timeline.loopEnabled,
  ])

  React.useEffect(() => {
    if (!timeline.isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      lastTimeRef.current = null
      return
    }
    const tick = (time: number) => {
      const { currentFrame, startFrame, endFrame, fps, loopEnabled } = playbackRef.current
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time
      }
      const frameDuration = fps > 0 ? 1000 / fps : 1000 / 24
      const elapsed = time - lastTimeRef.current
      const advance = Math.floor(elapsed / frameDuration)
      if (advance > 0) {
        let nextFrame = currentFrame + advance
        const span = endFrame - startFrame + 1
        if (nextFrame > endFrame) {
          if (loopEnabled && span > 0) {
            nextFrame = startFrame + ((nextFrame - startFrame) % span)
          } else {
            nextFrame = endFrame
            dispatch({ type: "timeline/toggle-play", playing: false })
          }
        }
        dispatch({ type: "timeline/set-current", frame: nextFrame })
        lastTimeRef.current = time - (elapsed % frameDuration)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      lastTimeRef.current = null
    }
  }, [timeline.isPlaying, dispatch])
  const totalFrames = Math.max(1, timeline.endFrame - timeline.startFrame + 1)
  const paddingPx = 24
  const [pixelsPerFrame, setPixelsPerFrame] = React.useState(6)
  const [viewportWidth, setViewportWidth] = React.useState(0)
  const trackWidth = Math.max(
    totalFrames * pixelsPerFrame + paddingPx * 2,
    viewportWidth,
  )
  const playheadX =
    paddingPx + (timeline.currentFrame - timeline.startFrame) * pixelsPerFrame
  const labelX = Math.min(
    Math.max(playheadX, paddingPx + 24),
    trackWidth - paddingPx - 24,
  )
  const timeLabel = formatTime(timeline.currentFrame, timeline.fps)
  const keyframes = timeline.keyframes.filter(
    (frame) => frame >= timeline.startFrame && frame <= timeline.endFrame,
  )
  const getFrameFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    const rect = viewport?.getBoundingClientRect()
    if (!rect) {
      return timeline.currentFrame
    }
    const scrollLeft = viewport?.scrollLeft ?? 0
    const x = event.clientX - rect.left + scrollLeft - paddingPx
    const frameOffset = Math.round(x / pixelsPerFrame)
    const unclamped = timeline.startFrame + frameOffset
    return Math.min(Math.max(unclamped, timeline.startFrame), timeline.endFrame)
  }

  const minPxPerTick = 16
  const tickStep = Math.max(1, Math.round(minPxPerTick / pixelsPerFrame))
  const majorStep = Math.max(Math.round(timeline.fps), tickStep * 5)
  const rulerTicks: number[] = []
  for (let frame = timeline.startFrame; frame <= timeline.endFrame; frame += tickStep) {
    rulerTicks.push(frame)
  }

  React.useLayoutEffect(() => {
    if (!viewportRef.current) {
      return
    }
    const element = viewportRef.current
    if (typeof ResizeObserver === "undefined") {
      requestAnimationFrame(() => {
        setViewportWidth(element.clientWidth)
      })
      return
    }
    const observer = new ResizeObserver(() => {
      setViewportWidth(element.clientWidth)
    })
    observer.observe(element)
    return () => { observer.disconnect(); }
  }, [])

  React.useLayoutEffect(() => {
    if (!viewportRef.current || pendingScrollLeftRef.current === null) {
      return
    }
    const maxScroll = Math.max(0, trackWidth - viewportRef.current.clientWidth)
    viewportRef.current.scrollLeft = Math.min(
      Math.max(0, pendingScrollLeftRef.current),
      maxScroll,
    )
    pendingScrollLeftRef.current = null
  }, [pixelsPerFrame, trackWidth])

  React.useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }
    const padding = 24
    const leftEdge = viewport.scrollLeft
    const rightEdge = leftEdge + viewport.clientWidth
    if (playheadX < leftEdge + padding) {
      viewport.scrollLeft = Math.max(playheadX - padding, 0)
    } else if (playheadX > rightEdge - padding) {
      viewport.scrollLeft = Math.max(playheadX - viewport.clientWidth + padding, 0)
    }
  }, [playheadX])

  React.useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }
    const handleWheel = (event: WheelEvent) => {
      if (!viewportRef.current) {
        return
      }
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const rect = viewport.getBoundingClientRect()
        const cursorX = event.clientX - rect.left
        const frameAtCursor =
          timeline.startFrame +
          (viewport.scrollLeft + cursorX - paddingPx) / pixelsPerFrame
        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
        const next = Math.min(Math.max(pixelsPerFrame * zoomFactor, 2), 20)
        if (next === pixelsPerFrame) {
          return
        }
        const nextScrollLeft =
          (frameAtCursor - timeline.startFrame) * next + paddingPx - cursorX
        pendingScrollLeftRef.current = nextScrollLeft
        setPixelsPerFrame(next)
        return
      }
      event.preventDefault()
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      viewport.scrollLeft += delta
    }
    viewport.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      viewport.removeEventListener("wheel", handleWheel)
    }
  }, [paddingPx, pixelsPerFrame, timeline.startFrame])

  return (
    <div className="relative z-20 w-full border-t border-border bg-[#1F2937] px-6 pb-4 pt-3">
      <div className="flex flex-wrap items-center gap-1">
        <Toggle
          size="icon"
          className="h-7 w-7"
          aria-label="Lecture"
          pressed={timeline.isPlaying}
          onPressedChange={(pressed) =>
            dispatch({ type: "timeline/toggle-play", playing: pressed })
          }
        >
          <Play className="h-4 w-4" />
        </Toggle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Arret"
          onClick={() => {
            dispatch({ type: "timeline/toggle-play", playing: false })
            dispatch({ type: "timeline/set-current", frame: timeline.startFrame })
          }}
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Cle precedente"
          onClick={() => dispatch({ type: "timeline/jump-prev" })}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Cle suivante"
          onClick={() => dispatch({ type: "timeline/jump-next" })}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Toggle
          size="icon"
          className="h-7 w-7"
          aria-label="Boucle"
          pressed={timeline.loopEnabled}
          onPressedChange={(pressed) =>
            dispatch({ type: "timeline/toggle-loop", enabled: pressed })
          }
        >
          <Repeat className="h-4 w-4" />
        </Toggle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Ajouter cle"
          onClick={() =>
            dispatch({ type: "timeline/add-keyframe", frame: timeline.currentFrame })
          }
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Supprimer cle"
          onClick={() =>
            dispatch({ type: "timeline/remove-keyframe", frame: timeline.currentFrame })
          }
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Temps</span>
          <input
            className="h-7 w-16 rounded-md border border-border bg-[#111827] px-2 text-xs text-foreground"
            value={timeLabel}
            readOnly
          />
          <span>Image</span>
          <input
            type="number"
            className="h-7 w-14 rounded-md border border-border bg-[#111827] px-2 text-xs text-foreground"
            value={timeline.currentFrame}
            min={timeline.startFrame}
            max={timeline.endFrame}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isNaN(value)) {
                dispatch({ type: "timeline/set-current", frame: value })
              }
            }}
          />
          <span>FPS</span>
          <input
            type="number"
            className="h-7 w-12 rounded-md border border-border bg-[#111827] px-2 text-xs text-foreground"
            value={timeline.fps}
            min={1}
            max={240}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isNaN(value)) {
                dispatch({ type: "timeline/set-fps", fps: value })
              }
            }}
          />
          <span>In</span>
          <input
            type="number"
            className="h-7 w-12 rounded-md border border-border bg-[#111827] px-2 text-xs text-foreground"
            value={timeline.startFrame}
            min={0}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isNaN(value)) {
                dispatch({ type: "timeline/set-range", start: value, end: timeline.endFrame })
              }
            }}
          />
          <span>Out</span>
          <input
            type="number"
            className="h-7 w-14 rounded-md border border-border bg-[#111827] px-2 text-xs text-foreground"
            value={timeline.endFrame}
            min={timeline.startFrame}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isNaN(value)) {
                dispatch({ type: "timeline/set-range", start: timeline.startFrame, end: value })
              }
            }}
          />
        </div>
      </div>
      <div className="mt-2 overflow-hidden rounded-md border border-white/10 bg-[#0B1220]">
        <div
          ref={viewportRef}
          className="timeline-scroll relative h-14 overflow-x-auto overflow-y-hidden"
        >
          <div
            ref={trackRef}
            className="relative h-full cursor-pointer select-none"
            style={{ width: trackWidth }}
            onPointerDown={(event) => {
              dragRef.current = true
              const frame = getFrameFromEvent(event)
              dispatch({ type: "timeline/set-current", frame })
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (!dragRef.current) {
                return
              }
              const frame = getFrameFromEvent(event)
              dispatch({ type: "timeline/set-current", frame })
            }}
            onPointerUp={(event) => {
              dragRef.current = false
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
            }}
            onPointerCancel={() => {
              dragRef.current = false
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0f172a_0%,#0b1220_60%,#0a0f1b_100%)]" />

            <div className="timeline-ruler absolute inset-x-0 top-0 h-6 border-b border-white/10 bg-[#0b1220]/70">
              {rulerTicks.map((frame) => {
                const left = paddingPx + (frame - timeline.startFrame) * pixelsPerFrame
                const isMajor = (frame - timeline.startFrame) % majorStep === 0
                return (
                  <div
                    key={`tick-${frame}`}
                    className="absolute top-0 h-full"
                    style={{ left }}
                  >
                    <div
                      className={
                        isMajor
                          ? "h-4 w-px bg-[#94A3B8]"
                          : "h-2.5 w-px bg-[#475569]"
                      }
                    />
                    {isMajor ? (
                      <div className="mt-0.5 text-[10px] font-semibold text-[#94A3B8]">
                        {frame}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className="absolute inset-x-0 top-6 bottom-0">
              {rulerTicks.map((frame) => {
                const left = paddingPx + (frame - timeline.startFrame) * pixelsPerFrame
                const isMajor = (frame - timeline.startFrame) % majorStep === 0
                return (
                  <div
                    key={`grid-${frame}`}
                    className={
                      isMajor
                        ? "absolute top-0 h-full w-px bg-[#1f2937]"
                        : "absolute top-3 h-[calc(100%-12px)] w-px bg-[#0f172a]"
                    }
                    style={{ left }}
                  />
                )
              })}
            </div>

            <div className="absolute inset-x-0 top-6 bottom-0 pointer-events-none">
              {keyframes.map((frame) => (
                <div
                  key={frame}
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border border-[#FCA5A5]/80 bg-[#E53E3E] shadow-[0_0_6px_rgba(229,62,62,0.35)]"
                  style={{
                    left: paddingPx + (frame - timeline.startFrame) * pixelsPerFrame,
                  }}
                />
              ))}
            </div>

            <div
              className="absolute top-0 z-20 h-full w-px bg-[#F87171] shadow-[0_0_12px_rgba(248,113,113,0.6)]"
              style={{ left: playheadX }}
            />
            <div
              className="absolute top-1 z-20 -translate-x-1/2 rounded-md border border-[#FCA5A5] bg-[#E53E3E] px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ left: labelX }}
            >
              {timeLabel}
            </div>
            <div
              className="absolute top-[22px] z-20 -translate-x-1/2 h-2.5 w-2.5 rotate-45 rounded-[2px] border border-[#FCA5A5] bg-[#E53E3E] shadow-[0_0_8px_rgba(229,62,62,0.35)]"
              style={{ left: playheadX }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
