import * as React from "react"
import { ChevronsLeft, ChevronsRight, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

export type ToolbarItem = {
  id: string
  label: string
  icon: React.ReactNode
  type?: "button" | "toggle"
}

type OverlayToolbarProps = {
  title: string
  items: ToolbarItem[]
  activeItems?: Record<string, boolean>
  onItemAction?: (id: string) => void
  onItemToggle?: (id: string, pressed: boolean) => void
  className?: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  defaultExpanded?: boolean
}

export function OverlayToolbar({
  title,
  items,
  activeItems,
  onItemAction,
  onItemToggle,
  className,
  dragHandleProps,
  defaultExpanded = true,
}: OverlayToolbarProps) {
  const {
    className: handleClassName,
    style: handleStyle,
    onPointerDown: onHandlePointerDown,
    ...handleRest
  } = dragHandleProps ?? {}
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  return (
    <div
      className={cn(
        "overlay-panel flex items-center gap-1 rounded-full px-2 py-1.5 text-sm shadow-overlay",
        className,
      )}
      aria-label={title}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={expanded ? "Replier" : "Deplier"}
        title={expanded ? "Replier" : "Deplier"}
        className="h-7 w-7 rounded-full"
        onClick={() => { setExpanded((prev) => !prev); }}
      >
        {expanded ? (
          <ChevronsLeft className="h-4 w-4" />
        ) : (
          <ChevronsRight className="h-4 w-4" />
        )}
      </Button>
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full bg-background/80",
          "text-muted-foreground",
          "cursor-move select-none",
          handleClassName,
        )}
        style={{ touchAction: "none", ...handleStyle }}
        onPointerDown={(event) => {
          onHandlePointerDown?.(event)
          event.stopPropagation()
        }}
        {...handleRest}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </div>
      {expanded && (
        <div className="flex items-center gap-1">
          {items.map((item) =>
            item.type === "toggle" ? (() => {
              const isControlled = typeof activeItems?.[item.id] === "boolean"
              return (
                <Toggle
                  key={item.id}
                  size="icon"
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "h-7 w-7 rounded-full border shadow-sm transition-colors",
                    "bg-[#273244] border-[#374151] text-[#E2E8F0]",
                    "hover:bg-[#2F3B50] hover:border-[#4B5563] cursor-pointer",
                    "data-[state=on]:bg-[#E53E3E] data-[state=on]:border-[#C53030]",
                    "data-[state=on]:text-white",
                  )}
                  pressed={isControlled ? activeItems[item.id] : undefined}
                  onPressedChange={(pressed) => onItemToggle?.(item.id, pressed)}
                >
                  {item.icon}
                </Toggle>
              )
            })() : (
              <Button
                key={item.id}
                variant="ghost"
                size="icon"
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "h-7 w-7 rounded-full border shadow-sm transition-colors",
                  "bg-[#273244] border-[#374151] text-[#E2E8F0]",
                  "hover:bg-[#2F3B50] hover:border-[#4B5563] cursor-pointer",
                )}
                onClick={() => onItemAction?.(item.id)}
              >
                {item.icon}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
