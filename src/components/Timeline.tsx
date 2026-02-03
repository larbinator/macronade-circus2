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
  const trackRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef(false)
  const rafRef = React.useRef<number | null>(null)
  const lastTimeRef = React.useRef<number | null>(null)
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
  const durationSpan = Math.max(1, timeline.endFrame - timeline.startFrame)
  const playheadPercent =
    ((timeline.currentFrame - timeline.startFrame) / durationSpan) * 100
  const timeLabel = formatTime(timeline.currentFrame, timeline.fps)
  const keyframes = timeline.keyframes.filter(
    (frame) => frame >= timeline.startFrame && frame <= timeline.endFrame,
  )
  const getFrameFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) {
      return timeline.currentFrame
    }
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
    return Math.round(timeline.startFrame + ratio * durationSpan)
  }

  const tickStep = Math.max(1, Math.floor(timeline.fps / 4))
  const majorStep = Math.max(timeline.fps, tickStep * 4)
  const rulerTicks: number[] = []
  for (let frame = timeline.startFrame; frame <= timeline.endFrame; frame += tickStep) {
    rulerTicks.push(frame)
  }

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
      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-[#111827]">
        <div
          ref={trackRef}
          className="relative h-16 cursor-pointer select-none"
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
          <div className="timeline-ruler absolute inset-x-0 top-0 h-7 border-b border-border/70">
            {rulerTicks.map((frame) => {
              const left = ((frame - timeline.startFrame) / durationSpan) * 100
              const isMajor = (frame - timeline.startFrame) % majorStep === 0
              return (
                <div
                  key={`tick-${frame}`}
                  className="absolute top-0 h-full"
                  style={{ left: `${left}%` }}
                >
                  <div
                    className={
                      isMajor
                        ? "h-5 w-px bg-[#94A3B8]"
                        : "h-3 w-px bg-[#475569]"
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
          <div className="timeline-track absolute inset-x-0 bottom-0 h-9">
            {keyframes.map((frame) => (
              <div
                key={frame}
                className="absolute top-3 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border border-[#C53030] bg-[#E53E3E] shadow-[0_0_6px_rgba(229,62,62,0.65)]"
                style={{
                  left: `${((frame - timeline.startFrame) / durationSpan) * 100}%`,
                }}
              />
            ))}
          </div>
          <div
            className="absolute top-0 z-20 h-full w-[2px] bg-accent"
            style={{ left: `${playheadPercent}%` }}
          />
          <div
            className="absolute top-0 z-20 h-0 w-0 -translate-x-1/2 border-x-4 border-t-0 border-b-6 border-transparent border-b-[#E53E3E]"
            style={{ left: `${playheadPercent}%` }}
          />
          <div
            className="absolute top-1 z-20 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground"
            style={{ left: `${playheadPercent}%` }}
          >
            {timeLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
