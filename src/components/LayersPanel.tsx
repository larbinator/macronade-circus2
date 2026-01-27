import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { useAppState } from "@/state/app-state"
import { ChevronDown, ChevronUp, Eye, Lock, Plus, Trash2 } from "lucide-react"

export function LayersPanel() {
  const { state, dispatch } = useAppState()
  const { items, activeLayerId } = state.layers
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Ajouter calque"
          onClick={() => dispatch({ type: "layers/add" })}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Supprimer calque"
          onClick={() => {
            if (activeLayerId !== null) {
              dispatch({ type: "layers/remove", layerId: activeLayerId })
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Monter calque"
          onClick={() => {
            if (activeLayerId !== null) {
              dispatch({ type: "layers/move", layerId: activeLayerId, direction: "up" })
            }
          }}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Descendre calque"
          onClick={() => {
            if (activeLayerId !== null) {
              dispatch({ type: "layers/move", layerId: activeLayerId, direction: "down" })
            }
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-xs text-muted-foreground">
        <span>Calque</span>
        <span>Vis</span>
        <span>Lock</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((layer) => (
          <div
            key={layer.id}
            className={
              layer.id === activeLayerId
                ? "grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl border border-[#C53030] bg-[#273244] px-3 py-2 text-sm shadow-sm"
                : "grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl border border-border bg-[#1F2937] px-3 py-2 text-sm"
            }
            onClick={() => dispatch({ type: "layers/set-active", layerId: layer.id })}
          >
            <span className="font-medium text-foreground">{layer.name}</span>
            <Toggle
              size="icon"
              className="h-7 w-7 border border-[#2B3444] bg-[#1F2937] text-[#CBD5E1] hover:bg-[#2F3B50] data-[state=on]:bg-[#E53E3E] data-[state=on]:text-white data-[state=on]:border-[#C53030]"
              pressed={layer.visible}
              aria-label="Visibilite"
              onClick={(event) => event.stopPropagation()}
              onPressedChange={() =>
                dispatch({ type: "layers/toggle-visible", layerId: layer.id })
              }
            >
              <Eye className="h-4 w-4" />
            </Toggle>
            <Toggle
              size="icon"
              className="h-7 w-7 border border-[#2B3444] bg-[#1F2937] text-[#CBD5E1] hover:bg-[#2F3B50] data-[state=on]:bg-[#E53E3E] data-[state=on]:text-white data-[state=on]:border-[#C53030]"
              pressed={layer.locked}
              aria-label="Verrouiller"
              onClick={(event) => event.stopPropagation()}
              onPressedChange={() =>
                dispatch({ type: "layers/toggle-locked", layerId: layer.id })
              }
            >
              <Lock className="h-4 w-4" />
            </Toggle>
          </div>
        ))}
      </div>
    </div>
  )
}
