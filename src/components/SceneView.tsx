import * as React from "react"
import { useAppState } from "@/state/app-state"
import { cn } from "@/lib/utils"

type SceneViewProps = {
  className?: string
  zoom?: number
  showHandles?: boolean
}

type DragState = {
  itemId: number
  offsetX: number
  offsetY: number
}

type SvgAsset = {
  inner: string
  viewBox: string | null
}

type RotationDragState = {
  itemId: number
  memberId: string
  startAngle: number
  startPointerAngle: number
  pivot: { x: number; y: number }
}

type HandleInfo = {
  itemId: number
  memberId: string
  x: number
  y: number
  pivotX: number
  pivotY: number
}

const getSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
  const point = new DOMPoint(clientX, clientY)
  const ctm = svg.getScreenCTM()
  if (!ctm) {
    return { x: 0, y: 0 }
  }
  const transformed = point.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

export function SceneView({ className, zoom = 1, showHandles = true }: SceneViewProps) {
  const { state, dispatch } = useAppState()
  const { scene, layers, selection } = state
  const containerRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const rotationRef = React.useRef<RotationDragState | null>(null)
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  const [svgAssets, setSvgAssets] = React.useState<Record<string, SvgAsset>>({})
  const svgAssetsRef = React.useRef<Record<string, SvgAsset>>({})
  const pantinRefs = React.useRef<Map<number, SVGSVGElement>>(new Map())
  const [handles, setHandles] = React.useState<HandleInfo[]>([])

  React.useEffect(() => {
    if (!scene.backgroundPath) {
      return
    }
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) {
        return
      }
      const width = image.naturalWidth
      const height = image.naturalHeight
      if (width > 0 && height > 0) {
        dispatch({ type: "scene/set-background-size", width, height })
      }
    }
    image.src = scene.backgroundPath
    return () => {
      cancelled = true
    }
  }, [scene.backgroundPath, dispatch])

  React.useEffect(() => {
    const pantinPaths = Array.from(
      new Set(
        scene.items
          .filter((item) => item.kind === "pantin")
          .map((item) => item.assetPath)
          .filter(Boolean),
      ),
    )
    const missing = pantinPaths.filter((path) => !svgAssetsRef.current[path])
    if (missing.length === 0) {
      return
    }
    missing.forEach((path) => {
      fetch(path)
        .then((response) => {
          if (!response.ok) {
            throw new Error("svg")
          }
          return response.text()
        })
        .then((contents) => {
          const parser = new DOMParser()
          const doc = parser.parseFromString(contents, "image/svg+xml")
          const svg = doc.querySelector("svg")
          const entry: SvgAsset = {
            inner: svg ? svg.innerHTML : contents,
            viewBox: svg?.getAttribute("viewBox") ?? null,
          }
          svgAssetsRef.current = { ...svgAssetsRef.current, [path]: entry }
          setSvgAssets((prev) => ({ ...prev, [path]: entry }))
        })
        .catch(() => null)
    })
  }, [scene.items])

  const applyVariants = React.useCallback(
    (
      asset: SvgAsset,
      variants?: Record<string, string>,
      memberRotations?: Record<string, number>,
    ) => {
      const variantMap = variants ?? {}
      if (Object.keys(variantMap).length === 0) {
        if (!memberRotations || Object.keys(memberRotations).length === 0) {
          return asset.inner
        }
      }
      const parser = new DOMParser()
      const doc = parser.parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${asset.inner}</svg>`,
        "image/svg+xml",
      )
      const groups = doc.querySelectorAll("g[data-variant-groupe][data-variant-name]")
      groups.forEach((group) => {
        const groupName = group.getAttribute("data-variant-groupe")
        const variantName = group.getAttribute("data-variant-name")
        if (!groupName || !variantName) {
          return
        }
        const selected = variantMap[groupName]
        if (!selected) {
          return
        }
        group.setAttribute("visibility", selected === variantName ? "visible" : "hidden")
      })
      if (memberRotations) {
        Object.entries(memberRotations).forEach(([memberId, angle]) => {
          const target = doc.getElementById(memberId)
          if (!target) {
            return
          }
          const normalized = Number.isFinite(angle) ? angle : 0
          if (normalized === 0) {
            return
          }
          const existing = target.getAttribute("transform") ?? ""
          const nextTransform = `${existing} rotate(${normalized})`.trim()
          target.setAttribute("transform", nextTransform)
        })
      }
      const svg = doc.querySelector("svg")
      return svg?.innerHTML ?? asset.inner
    },
    [],
  )

  React.useLayoutEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") {
      return
    }
    const element = containerRef.current
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) {
        return
      }
      setSize({ w: rect.width, h: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const layerOrder = layers.items.map((layer) => layer.id)
  const visibleItems = [...scene.items]
    .filter((item) => {
      const layer = layers.items.find((entry) => entry.id === item.id)
      return layer ? layer.visible : true
    })
    .sort((a, b) => layerOrder.indexOf(a.id) - layerOrder.indexOf(b.id))

  const isLocked = (itemId: number) => {
    const layer = layers.items.find((entry) => entry.id === itemId)
    return layer?.locked ?? false
  }

  const handlePointerDown = (event: React.PointerEvent<SVGElement>, itemId: number) => {
    if (event.button !== 0) {
      return
    }
    const svg = svgRef.current
    if (!svg) {
      return
    }
    dispatch({ type: "scene/select-item", itemId })
    if (isLocked(itemId)) {
      return
    }
    event.stopPropagation()
    const item = scene.items.find((entry) => entry.id === itemId)
    if (!item) {
      return
    }
    const point = getSvgPoint(svg, event.clientX, event.clientY)
    dragRef.current = {
      itemId,
      offsetX: point.x - item.x,
      offsetY: point.y - item.y,
    }
    svg.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (rotationRef.current) {
      const state = rotationRef.current
      const angle = Math.atan2(
        event.clientY - state.pivot.y,
        event.clientX - state.pivot.x,
      )
      const delta = ((angle - state.startPointerAngle) * 180) / Math.PI
      const nextAngle = state.startAngle + delta
      const item = scene.items.find((entry) => entry.id === state.itemId)
      if (!item) {
        return
      }
      dispatch({
        type: "scene/update-item",
        itemId: state.itemId,
        patch: {
          memberRotations: {
            ...(item.memberRotations ?? {}),
            [state.memberId]: nextAngle,
          },
        },
      })
      return
    }
    if (!dragRef.current || !svgRef.current) {
      return
    }
    const point = getSvgPoint(svgRef.current, event.clientX, event.clientY)
    dispatch({
      type: "scene/update-item",
      itemId: dragRef.current.itemId,
      patch: {
        x: point.x - dragRef.current.offsetX,
        y: point.y - dragRef.current.offsetY,
      },
    })
  }

  const stopDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (rotationRef.current) {
      rotationRef.current = null
    }
    if (dragRef.current) {
      dragRef.current = null
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const clearSelection = () => {
    dispatch({ type: "selection/clear" })
  }

  const selectedItem =
    selection?.type === "scene"
      ? scene.items.find((item) => item.id === selection.itemId) ?? null
      : null
  const selectedPantin =
    selectedItem && selectedItem.kind === "pantin" ? selectedItem : null

  const backgroundLayer = layers.items.find((layer) => layer.id === 0)
  const showBackground = backgroundLayer?.visible ?? true
  const viewWidth = Math.max(1, scene.backgroundSize?.width ?? size.w)
  const viewHeight = Math.max(1, scene.backgroundSize?.height ?? size.h)
  const safeZoom = Math.max(0.1, zoom)
  const viewBoxWidth = viewWidth / safeZoom
  const viewBoxHeight = viewHeight / safeZoom
  const viewBoxX = (viewWidth - viewBoxWidth) / 2
  const viewBoxY = (viewHeight - viewBoxHeight) / 2

  React.useLayoutEffect(() => {
    if (!showHandles || !selectedPantin) {
      setHandles([])
      return
    }
    const pantinRoot = pantinRefs.current.get(selectedPantin.id)
    if (!pantinRoot) {
      setHandles([])
      return
    }
    const frame = requestAnimationFrame(() => {
      const nextHandles: HandleInfo[] = []
      const groups = pantinRoot.querySelectorAll<SVGGElement>("g[data-isrotatable='true']")
      const sceneCtm = svgRef.current?.getScreenCTM()
      if (!sceneCtm) {
        setHandles([])
        return
      }
      const sceneInverse = sceneCtm.inverse()

      const getMemberCenter = (group: SVGGElement) => {
        const groupCTM = group.getCTM()
        if (!groupCTM) {
          return null
        }
        const groupInverse = groupCTM.inverse()
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY
        let hasBounds = false
        const elements = group.querySelectorAll<SVGGraphicsElement>("*")
        elements.forEach((element) => {
          const closest = element.closest("g[data-isrotatable='true']")
          if (closest !== group) {
            return
          }
          if (!(element instanceof SVGGraphicsElement)) {
            return
          }
          const bbox = element.getBBox()
          const elementCTM = element.getCTM()
          if (!elementCTM) {
            return
          }
          const points = [
            new DOMPoint(bbox.x, bbox.y),
            new DOMPoint(bbox.x + bbox.width, bbox.y),
            new DOMPoint(bbox.x, bbox.y + bbox.height),
            new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
          ]
          points.forEach((point) => {
            const inGroup = point
              .matrixTransform(elementCTM)
              .matrixTransform(groupInverse)
            minX = Math.min(minX, inGroup.x)
            minY = Math.min(minY, inGroup.y)
            maxX = Math.max(maxX, inGroup.x)
            maxY = Math.max(maxY, inGroup.y)
            hasBounds = true
          })
        })
        if (!hasBounds) {
          return null
        }
        return {
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
        }
      }

      groups.forEach((group) => {
        const memberId = group.id
        if (!memberId) {
          return
        }
        try {
          const center = getMemberCenter(group)
          if (!center) {
            return
          }
          const groupScreenCTM = group.getScreenCTM()
          if (!groupScreenCTM) {
            return
          }
          const pivotScreen = new DOMPoint(0, 0).matrixTransform(groupScreenCTM)
          const handleScreen = new DOMPoint(center.x, center.y).matrixTransform(
            groupScreenCTM,
          )
          const pivotScene = pivotScreen.matrixTransform(sceneInverse)
          const handleScene = handleScreen.matrixTransform(sceneInverse)
          nextHandles.push({
            itemId: selectedPantin.id,
            memberId,
            x: handleScene.x,
            y: handleScene.y,
            pivotX: pivotScene.x,
            pivotY: pivotScene.y,
          })
        } catch {
          return
        }
      })
      setHandles(nextHandles)
    })
    return () => cancelAnimationFrame(frame)
  }, [
    scene.items,
    selectedPantin?.id,
    selectedPantin?.rotation,
    selectedPantin?.assetPath,
    selectedPantin?.scale,
    selectedPantin?.width,
    selectedPantin?.height,
    selectedPantin?.x,
    selectedPantin?.y,
    svgAssets,
    showHandles,
  ])

  const startMemberRotation = (
    event: React.PointerEvent<SVGCircleElement>,
    itemId: number,
    memberId: string,
  ) => {
    event.stopPropagation()
    if (event.button !== 0) {
      return
    }
    const svgElement = pantinRefs.current.get(itemId)
    if (!svgElement) {
      return
    }
    const target = svgElement.querySelector<SVGGElement>(
      `#${CSS.escape(memberId)}`,
    )
    if (!target) {
      return
    }
    const ctm = target.getScreenCTM()
    if (!ctm) {
      return
    }
    const pivotPoint = new DOMPoint(0, 0).matrixTransform(ctm)
    const item = scene.items.find((entry) => entry.id === itemId)
    const startAngle =
      item && item.memberRotations ? item.memberRotations[memberId] ?? 0 : 0
    const startPointerAngle = Math.atan2(
      event.clientY - pivotPoint.y,
      event.clientX - pivotPoint.x,
    )
    rotationRef.current = {
      itemId,
      memberId,
      startAngle,
      startPointerAngle,
      pivot: { x: pivotPoint.x, y: pivotPoint.y },
    }
    if (svgRef.current) {
      svgRef.current.setPointerCapture(event.pointerId)
    }
  }


  return (
    <div ref={containerRef} className={cn("relative h-full w-full", className)}>
      <svg
        ref={svgRef}
        className="h-full w-full"
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={clearSelection}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        {showBackground && scene.backgroundPath ? (
          <image
            href={scene.backgroundPath}
            x={0}
            y={0}
            width={viewWidth}
            height={viewHeight}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <rect
            x={0}
            y={0}
            width={viewWidth}
            height={viewHeight}
            fill="transparent"
          />
        )}

        {visibleItems.map((item) => {
          const width = item.width * item.scale
          const height = item.height * item.scale
          const cx = item.x + width / 2
          const cy = item.y + height / 2
          if (item.kind === "pantin") {
            const asset = svgAssets[item.assetPath]
            if (!asset) {
              return (
                <g key={item.id} transform={`rotate(${item.rotation} ${cx} ${cy})`}>
                  <rect
                    x={item.x}
                    y={item.y}
                    width={width}
                    height={height}
                    fill="rgba(255,255,255,0.4)"
                    stroke="rgba(161, 98, 74, 0.6)"
                    strokeDasharray="6 4"
                    style={{ cursor: isLocked(item.id) ? "default" : "move" }}
                    onPointerDown={(event) => handlePointerDown(event, item.id)}
                  />
                </g>
              )
            }
            const inner = applyVariants(asset, item.variants, item.memberRotations)
            const viewBox = asset.viewBox ?? `0 0 ${item.width} ${item.height}`
            return (
              <g key={item.id} transform={`rotate(${item.rotation} ${cx} ${cy})`}>
                <svg
                  ref={(node) => {
                    if (node) {
                      pantinRefs.current.set(item.id, node)
                    } else {
                      pantinRefs.current.delete(item.id)
                    }
                  }}
                  x={item.x}
                  y={item.y}
                  width={width}
                  height={height}
                  viewBox={viewBox}
                  preserveAspectRatio="xMidYMid meet"
                  overflow="visible"
                  style={{
                    overflow: "visible",
                    cursor: isLocked(item.id) ? "default" : "move",
                  }}
                  onPointerDown={(event) => handlePointerDown(event, item.id)}
                  dangerouslySetInnerHTML={{ __html: inner }}
                />
              </g>
            )
          }
          return (
            <g key={item.id} transform={`rotate(${item.rotation} ${cx} ${cy})`}>
              <image
                href={item.assetPath}
                x={item.x}
                y={item.y}
                width={width}
                height={height}
                preserveAspectRatio="xMidYMid meet"
                style={{ cursor: isLocked(item.id) ? "default" : "move" }}
                onPointerDown={(event) => handlePointerDown(event, item.id)}
              />
            </g>
          )
        })}

        {selectedItem ? (
          (() => {
            const width = selectedItem.width * selectedItem.scale
            const height = selectedItem.height * selectedItem.scale
            const x = selectedItem.x
            const y = selectedItem.y
            const handleSize = 10
            return (
              <g>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill="none"
                  stroke="rgba(229, 83, 83, 0.9)"
                  strokeWidth={2}
                />
                {[
                  { cx: x, cy: y },
                  { cx: x + width, cy: y },
                  { cx: x, cy: y + height },
                  { cx: x + width, cy: y + height },
                ].map((handle, index) => (
                  <rect
                    key={index}
                    x={handle.cx - handleSize / 2}
                    y={handle.cy - handleSize / 2}
                    width={handleSize}
                    height={handleSize}
                    fill="white"
                    stroke="rgba(229, 83, 83, 0.9)"
                    strokeWidth={2}
                  />
                ))}
              </g>
            )
          })()
        ) : null}

        {showHandles && selectedPantin
          ? handles.map((handle) => (
              <g key={`${handle.itemId}:${handle.memberId}`}>
                <circle
                  cx={handle.x}
                  cy={handle.y}
                  r={6}
                  fill="#E53E3E"
                  stroke="#C53030"
                  strokeWidth={2}
                  onPointerDown={(event) =>
                    startMemberRotation(event, handle.itemId, handle.memberId)
                  }
                />
                <circle
                  cx={handle.x}
                  cy={handle.y}
                  r={12}
                  fill="transparent"
                  onPointerDown={(event) =>
                    startMemberRotation(event, handle.itemId, handle.memberId)
                  }
                />
              </g>
            ))
          : null}

      </svg>
    </div>
  )
}
