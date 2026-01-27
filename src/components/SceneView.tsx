import * as React from "react"
import { useAppState } from "@/state/app-state"
import { cn } from "@/lib/utils"

type SceneViewProps = {
  className?: string
  zoom?: number
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

const getSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
  const point = new DOMPoint(clientX, clientY)
  const ctm = svg.getScreenCTM()
  if (!ctm) {
    return { x: 0, y: 0 }
  }
  const transformed = point.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

export function SceneView({ className, zoom = 1 }: SceneViewProps) {
  const { state, dispatch } = useAppState()
  const { scene, layers, selection } = state
  const containerRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  const [svgAssets, setSvgAssets] = React.useState<Record<string, SvgAsset>>({})
  const svgAssetsRef = React.useRef<Record<string, SvgAsset>>({})

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
    (asset: SvgAsset, variants?: Record<string, string>) => {
      if (!variants || Object.keys(variants).length === 0) {
        return asset.inner
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
        const selected = variants[groupName]
        if (!selected) {
          return
        }
        group.setAttribute("visibility", selected === variantName ? "visible" : "hidden")
      })
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

  const backgroundLayer = layers.items.find((layer) => layer.id === 0)
  const showBackground = backgroundLayer?.visible ?? true
  const viewWidth = Math.max(1, scene.backgroundSize?.width ?? size.w)
  const viewHeight = Math.max(1, scene.backgroundSize?.height ?? size.h)
  const safeZoom = Math.max(0.1, zoom)
  const viewBoxWidth = viewWidth / safeZoom
  const viewBoxHeight = viewHeight / safeZoom
  const viewBoxX = (viewWidth - viewBoxWidth) / 2
  const viewBoxY = (viewHeight - viewBoxHeight) / 2


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
            const inner = applyVariants(asset, item.variants)
            const viewBox = asset.viewBox ?? `0 0 ${item.width} ${item.height}`
            return (
              <g key={item.id} transform={`rotate(${item.rotation} ${cx} ${cy})`}>
                <svg
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

      </svg>
    </div>
  )
}
