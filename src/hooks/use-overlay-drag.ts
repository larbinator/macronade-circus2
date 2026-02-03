import * as React from "react"

type DragState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

type UseOverlayDragOptions = {
  getBounds: () => DOMRect | null
  sizeRef: React.MutableRefObject<{ w: number; h: number }>
  positionRef: React.MutableRefObject<{ x: number; y: number }>
  setPosition: (position: { x: number; y: number }) => void
  persistGeometry?: () => void
  userSelectRef?: React.MutableRefObject<string | null>
  shouldRestoreUserSelect?: () => boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function useOverlayDrag({
  getBounds,
  sizeRef,
  positionRef,
  setPosition,
  persistGeometry,
  userSelectRef: externalUserSelectRef,
  shouldRestoreUserSelect,
}: UseOverlayDragOptions) {
  const dragRef = React.useRef<DragState | null>(null)
  const internalUserSelectRef = React.useRef<string | null>(null)
  const userSelectRef = externalUserSelectRef ?? internalUserSelectRef
  const getBoundsRef = React.useRef(getBounds)
  const setPositionRef = React.useRef(setPosition)
  const persistGeometryRef = React.useRef(persistGeometry)
  const shouldRestoreUserSelectRef = React.useRef(shouldRestoreUserSelect)

  React.useEffect(() => {
    getBoundsRef.current = getBounds
    setPositionRef.current = setPosition
    persistGeometryRef.current = persistGeometry
    shouldRestoreUserSelectRef.current = shouldRestoreUserSelect
  }, [getBounds, persistGeometry, setPosition, shouldRestoreUserSelect])

  const restoreUserSelect = React.useCallback(() => {
    if (
      userSelectRef.current !== null &&
      !dragRef.current &&
      (shouldRestoreUserSelectRef.current
        ? shouldRestoreUserSelectRef.current()
        : true)
    ) {
      document.body.style.userSelect = userSelectRef.current
      userSelectRef.current = null
    }
  }, [userSelectRef])

  const handleDragMove = React.useCallback(
    (event: PointerEvent) => {
      const state = dragRef.current
      if (!state || state.pointerId !== event.pointerId) {
        return
      }
      const bounds = getBoundsRef.current()
      const deltaX = event.clientX - state.startX
      const deltaY = event.clientY - state.startY
      let nextX = state.originX + deltaX
      let nextY = state.originY + deltaY
      if (bounds) {
        const maxX = Math.max(0, bounds.width - sizeRef.current.w)
        const maxY = Math.max(0, bounds.height - sizeRef.current.h)
        nextX = clamp(nextX, 0, maxX)
        nextY = clamp(nextY, 0, maxY)
      }
      setPositionRef.current({ x: nextX, y: nextY })
    },
    [sizeRef],
  )

  const stopDrag = React.useCallback(
    (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) {
        return
      }
      dragRef.current = null
      window.removeEventListener("pointermove", handleDragMove)
      window.removeEventListener("pointerup", stopDrag)
      window.removeEventListener("pointercancel", stopDrag)
      if (persistGeometryRef.current) {
        persistGeometryRef.current()
      }
      restoreUserSelect()
    },
    [handleDragMove, restoreUserSelect],
  )

  const startDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault()
      if (userSelectRef.current === null) {
        userSelectRef.current = document.body.style.userSelect
        document.body.style.userSelect = "none"
      }
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: positionRef.current.x,
        originY: positionRef.current.y,
      }
      window.addEventListener("pointermove", handleDragMove)
      window.addEventListener("pointerup", stopDrag)
      window.addEventListener("pointercancel", stopDrag)
    },
    [handleDragMove, positionRef, stopDrag, userSelectRef],
  )

  React.useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleDragMove)
      window.removeEventListener("pointerup", stopDrag)
      window.removeEventListener("pointercancel", stopDrag)
      restoreUserSelect()
    }
  }, [handleDragMove, restoreUserSelect, stopDrag])

  return { startDrag, restoreUserSelect }
}
