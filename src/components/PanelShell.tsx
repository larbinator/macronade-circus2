import * as React from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

type PanelShellProps = {
  title: string
  children: React.ReactNode
  className?: string
  headerProps?: React.HTMLAttributes<HTMLDivElement>
  resizeHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function PanelShell({
  title,
  children,
  className,
  headerProps,
  resizeHandleProps,
}: PanelShellProps) {
  const { className: headerClassName, style: headerStyle, ...headerRest } =
    headerProps ?? {}
  const {
    className: handleClassName,
    style: handleStyle,
    ...handleRest
  } = resizeHandleProps ?? {}
  const defaultHandleStyle: React.CSSProperties = {
    position: "absolute",
  }
  return (
    <section
      className={cn(
        "overlay-panel relative flex w-full flex-col rounded-xl p-3 text-sm",
        "overflow-hidden",
        className,
      )}
      aria-label={title}
    >
      <div
        className={cn(
          "overlay-header flex items-center justify-between rounded-lg px-3 py-1.5",
          "cursor-move select-none",
          headerClassName,
        )}
        style={{ touchAction: "none", ...headerStyle }}
        {...headerRest}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">
          {title}
        </span>
      </div>
      <ScrollArea className="mt-3 flex-1 min-h-0">{children}</ScrollArea>
      {[
        { corner: "top-left", className: "panel-corner--tl" },
        { corner: "top-right", className: "panel-corner--tr" },
        { corner: "bottom-left", className: "panel-corner--bl" },
        { corner: "bottom-right", className: "panel-corner--br" },
      ].map((handle) => (
        <div
          key={handle.corner}
          data-corner={handle.corner}
          aria-hidden="true"
          className={cn("panel-corner", handle.className, handleClassName)}
          style={{ ...defaultHandleStyle, touchAction: "none", ...handleStyle }}
          {...handleRest}
        />
      ))}
    </section>
  )
}
