import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

type CollapsibleContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

function useCollapsibleContext() {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error("Collapsible components must be used within Collapsible.")
  }
  return context
}

type CollapsibleProps = React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  asChild?: boolean
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ className, open: openProp, defaultOpen = false, onOpenChange, asChild, ...props }, ref) => {
    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean) => {
        if (onOpenChange) {
          onOpenChange(value)
        } else {
          _setOpen(value)
        }
      },
      [onOpenChange],
    )
    const Comp = asChild ? Slot : "div"
    return (
      <CollapsibleContext.Provider value={{ open, setOpen }}>
        <Comp
          ref={ref}
          data-state={open ? "open" : "closed"}
          className={className}
          {...props}
        />
      </CollapsibleContext.Provider>
    )
  },
)
Collapsible.displayName = "Collapsible"

type CollapsibleTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ asChild, onClick, ...props }, ref) => {
    const { open, setOpen } = useCollapsibleContext()
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(event)
          if (!event.defaultPrevented) {
            setOpen(!open)
          }
        }}
        {...props}
      />
    )
  },
)
CollapsibleTrigger.displayName = "CollapsibleTrigger"

type CollapsibleContentProps = React.HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean
}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ asChild, ...props }, ref) => {
    const { open } = useCollapsibleContext()
    if (!open) {
      return null
    }
    const Comp = asChild ? Slot : "div"
    return <Comp ref={ref} data-state={open ? "open" : "closed"} {...props} />
  },
)
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
