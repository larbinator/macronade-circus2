import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { useAppState } from "@/state/app-state"
import { ChevronDown, ChevronUp, Eye, Lock, Plus, Trash2 } from "lucide-react"

export function LayersPanel() {
  const { state, dispatch } = useAppState()
  const { items, activeLayerId } = state.layers
  const handleActiveLayer = (action: (layerId: number) => void) => {
    if (activeLayerId !== null) {
      action(activeLayerId)
    }
  }
  const actionButtons = [
    {
      label: "Ajouter calque",
      icon: Plus,
      onClick: () => dispatch({ type: "layers/add" }),
    },
    {
      label: "Supprimer calque",
      icon: Trash2,
      onClick: () => handleActiveLayer((layerId) =>
        dispatch({ type: "layers/remove", layerId }),
      ),
    },
    {
      label: "Monter calque",
      icon: ChevronUp,
      onClick: () => handleActiveLayer((layerId) =>
        dispatch({ type: "layers/move", layerId, direction: "up" }),
      ),
    },
    {
      label: "Descendre calque",
      icon: ChevronDown,
      onClick: () => handleActiveLayer((layerId) =>
        dispatch({ type: "layers/move", layerId, direction: "down" }),
      ),
    },
  ]
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-[#1F2937] pb-2">
        <div className="flex items-center gap-2">
          {actionButtons.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.label}
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={action.label}
                onClick={action.onClick}
              >
                <Icon className="h-4 w-4" />
              </Button>
            )
          })}
        </div>
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
            {[
              {
                label: "Visibilite",
                pressed: layer.visible,
                icon: Eye,
                onPressedChange: () =>
                  dispatch({ type: "layers/toggle-visible", layerId: layer.id }),
              },
              {
                label: "Verrouiller",
                pressed: layer.locked,
                icon: Lock,
                onPressedChange: () =>
                  dispatch({ type: "layers/toggle-locked", layerId: layer.id }),
              },
            ].map((toggle) => {
              const Icon = toggle.icon
              return (
                <Toggle
                  key={toggle.label}
                  size="icon"
                  className="h-7 w-7 border border-[#2B3444] bg-[#1F2937] text-[#CBD5E1] hover:bg-[#2F3B50] data-[state=on]:bg-[#E53E3E] data-[state=on]:text-white data-[state=on]:border-[#C53030]"
                  pressed={toggle.pressed}
                  aria-label={toggle.label}
                  onClick={(event) => event.stopPropagation()}
                  onPressedChange={toggle.onPressedChange}
                >
                  <Icon className="h-4 w-4" />
                </Toggle>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
