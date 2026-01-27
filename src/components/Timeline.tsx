import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { useAppState } from "@/state/app-state"
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Play,
  Plus,
  Repeat,
  Square,
  Trash2,
  Upload,
} from "lucide-react"

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
  const durationSpan = Math.max(1, timeline.endFrame - timeline.startFrame)
  const playheadPercent =
    ((timeline.currentFrame - timeline.startFrame) / durationSpan) * 100
  const timeLabel = formatTime(timeline.currentFrame, timeline.fps)
  const keyframes = timeline.keyframes.filter(
    (frame) => frame >= timeline.startFrame && frame <= timeline.endFrame,
  )
  return (
    <div className="relative z-20 w-full border-t border-border bg-[#1F2937] px-6 pb-4 pt-3">
      <div className="flex flex-wrap items-center gap-2">
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
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Importer audio"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Retirer audio"
        >
          <Trash2 className="h-4 w-4" />
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
        <div className="timeline-ruler relative h-6 border-b border-border/70">
          <div
            className="absolute top-1 text-[10px] font-semibold text-muted-foreground"
            style={{ left: `${playheadPercent}%` }}
          >
            {timeLabel}
          </div>
        </div>
        <div className="timeline-track relative h-7">
          <div
            className="absolute top-0 h-full w-[2px] bg-accent"
            style={{ left: `${playheadPercent}%` }}
          />
          {keyframes.map((frame) => (
            <div
              key={frame}
              className="kf-dot absolute top-2 bg-accent"
              style={{
                left: `${((frame - timeline.startFrame) / durationSpan) * 100}%`,
              }}
            />
          ))}
          <div className="absolute right-4 top-1 flex h-5 w-32 items-center justify-center rounded-lg border border-dashed border-border bg-[#1F2937] text-[10px] text-muted-foreground">
            waveform
          </div>
        </div>
      </div>
    </div>
  )
}
