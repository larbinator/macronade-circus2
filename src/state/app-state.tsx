import * as React from "react"

export type LayerItem = {
  id: number
  name: string
  visible: boolean
  locked: boolean
  kind: "background" | "item"
}

export type TimelineState = {
  fps: number
  startFrame: number
  endFrame: number
  currentFrame: number
  keyframes: number[]
  keyframeStates: Record<number, KeyframeSnapshot>
  loopEnabled: boolean
  isPlaying: boolean
}

export type SceneItem = {
  id: number
  kind: "pantin" | "objet"
  label: string
  assetPath: string
  x: number
  y: number
  scale: number
  rotation: number
  width: number
  height: number
  variants?: Record<string, string>
  memberRotations?: Record<string, number>
  attachment?: {
    pantinId: number
    memberId: string
    offsetX: number
    offsetY: number
  }
}

export type SceneState = {
  backgroundPath: string | null
  backgroundSize: { width: number; height: number } | null
  items: SceneItem[]
}

export type SceneSnapshot = {
  backgroundPath: string | null
  backgroundSize: { width: number; height: number } | null
  items: SceneItem[]
}

export type LayersSnapshot = {
  items: LayerItem[]
  activeLayerId: number | null
}

export type KeyframeSnapshot = {
  scene: SceneSnapshot
  layers: LayersSnapshot
}

export type Selection =
  | { type: "layer"; layerId: number }
  | { type: "scene"; itemId: number }
  | null

export type AppState = {
  timeline: TimelineState
  layers: {
    items: LayerItem[]
    activeLayerId: number | null
  }
  scene: SceneState
  selection: Selection
  attachmentRequest:
    | { type: "attach"; itemId: number; pantinId: number; memberId: string }
    | { type: "detach"; itemId: number }
    | null
}

type Action =
  | { type: "timeline/set-fps"; fps: number }
  | { type: "timeline/set-range"; start: number; end: number }
  | { type: "timeline/set-current"; frame: number }
  | { type: "timeline/toggle-loop"; enabled: boolean }
  | { type: "timeline/toggle-play"; playing: boolean }
  | { type: "timeline/add-keyframe"; frame: number }
  | { type: "timeline/remove-keyframe"; frame: number }
  | { type: "timeline/jump-prev" }
  | { type: "timeline/jump-next" }
  | { type: "layers/add" }
  | { type: "layers/remove"; layerId: number }
  | { type: "layers/move"; layerId: number; direction: "up" | "down" }
  | { type: "layers/toggle-visible"; layerId: number }
  | { type: "layers/toggle-locked"; layerId: number }
  | { type: "layers/set-active"; layerId: number }
  | {
      type: "scene/import-asset"
      categoryId: string
      assetId: string
      label: string
      path: string
      width?: number
      height?: number
    }
  | { type: "scene/set-background"; path: string | null; label?: string }
  | { type: "scene/set-background-size"; width: number; height: number }
  | { type: "scene/select-item"; itemId: number }
  | { type: "scene/update-item"; itemId: number; patch: Partial<SceneItem> }
  | { type: "scene/reset" }
  | { type: "scene/request-attach"; itemId: number; pantinId: number; memberId: string }
  | { type: "scene/request-detach"; itemId: number }
  | { type: "scene/clear-attachment-request" }
  | { type: "selection/clear" }

const defaultBackgroundPath = "/decors/defaut.png"

const initialState: AppState = {
  timeline: {
    fps: 24,
    startFrame: 0,
    endFrame: 239,
    currentFrame: 1,
    keyframes: [],
    keyframeStates: {},
    loopEnabled: true,
    isPlaying: false,
  },
  layers: {
    items: [
      { id: 0, name: "Background", visible: true, locked: true, kind: "background" },
    ],
    activeLayerId: 0,
  },
  scene: {
    backgroundPath: defaultBackgroundPath,
    backgroundSize: null,
    items: [],
  },
  selection: null,
  attachmentRequest: null,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const sortKeyframes = (keyframes: number[]) =>
  [...new Set(keyframes)].sort((a, b) => a - b)

const cloneSceneItem = (item: SceneItem): SceneItem => ({
  ...item,
  variants: item.variants ? { ...item.variants } : undefined,
  memberRotations: item.memberRotations ? { ...item.memberRotations } : undefined,
  attachment: item.attachment ? { ...item.attachment } : undefined,
})

const cloneSnapshot = (snapshot: KeyframeSnapshot): KeyframeSnapshot => ({
  scene: {
    backgroundPath: snapshot.scene.backgroundPath,
    backgroundSize: snapshot.scene.backgroundSize
      ? { ...snapshot.scene.backgroundSize }
      : null,
    items: snapshot.scene.items.map(cloneSceneItem),
  },
  layers: {
    items: snapshot.layers.items.map((layer) => ({ ...layer })),
    activeLayerId: snapshot.layers.activeLayerId,
  },
})

const lerp = (start: number, end: number, t: number) => start + (end - start) * t

const lerpAngle = (start: number, end: number, t: number) => {
  const a = Number.isFinite(start) ? start : 0
  const b = Number.isFinite(end) ? end : 0
  const delta = ((((b - a) % 360) + 540) % 360) - 180
  return a + delta * t
}

const interpolateMemberRotations = (
  prev?: Record<string, number>,
  next?: Record<string, number>,
  t: number = 0,
) => {
  const prevMap = prev ?? {}
  const nextMap = next ?? {}
  const keys = new Set([...Object.keys(prevMap), ...Object.keys(nextMap)])
  if (keys.size === 0) {
    return undefined
  }
  const output: Record<string, number> = {}
  keys.forEach((key) => {
    const rawA = prevMap[key]
    const rawB = nextMap[key]
    const a = Number.isFinite(rawA) ? Number(rawA) : 0
    const b = Number.isFinite(rawB) ? Number(rawB) : 0
    output[key] = lerpAngle(a, b, t)
  })
  return Object.keys(output).length > 0 ? output : undefined
}

const interpolateSnapshot = (
  prev: KeyframeSnapshot,
  next: KeyframeSnapshot,
  t: number,
): KeyframeSnapshot => {
  const prevItems = prev.scene.items
  const nextItemsById = new Map(next.scene.items.map((item) => [item.id, item]))
  const items = prevItems.map((item) => {
    const other = nextItemsById.get(item.id)
    if (!other) {
      return cloneSceneItem(item)
    }
    const attachmentMatch =
      item.attachment &&
      other.attachment &&
      item.attachment.pantinId === other.attachment.pantinId &&
      item.attachment.memberId === other.attachment.memberId
    const attachment = attachmentMatch
      ? {
          pantinId: item.attachment!.pantinId,
          memberId: item.attachment!.memberId,
          offsetX: lerp(item.attachment!.offsetX, other.attachment!.offsetX, t),
          offsetY: lerp(item.attachment!.offsetY, other.attachment!.offsetY, t),
        }
      : item.attachment
        ? { ...item.attachment }
        : undefined
    return {
      ...cloneSceneItem(item),
      x: lerp(item.x, other.x, t),
      y: lerp(item.y, other.y, t),
      scale: lerp(item.scale, other.scale, t),
      rotation: lerpAngle(item.rotation, other.rotation, t),
      memberRotations: interpolateMemberRotations(item.memberRotations, other.memberRotations, t),
      attachment,
    }
  })
  return {
    scene: {
      backgroundPath: prev.scene.backgroundPath,
      backgroundSize: prev.scene.backgroundSize ? { ...prev.scene.backgroundSize } : null,
      items,
    },
    layers: {
      items: prev.layers.items.map((layer) => ({ ...layer })),
      activeLayerId: prev.layers.activeLayerId,
    },
  }
}

const buildSnapshot = (state: AppState): KeyframeSnapshot => ({
  scene: {
    backgroundPath: state.scene.backgroundPath,
    backgroundSize: state.scene.backgroundSize ? { ...state.scene.backgroundSize } : null,
    items: state.scene.items.map(cloneSceneItem),
  },
  layers: {
    items: state.layers.items.map((layer) => ({ ...layer })),
    activeLayerId: state.layers.activeLayerId,
  },
})

const updateKeyframeStateIfNeeded = (state: AppState): AppState => {
  const frame = state.timeline.currentFrame
  if (!state.timeline.keyframes.includes(frame)) {
    return state
  }
  return {
    ...state,
    timeline: {
      ...state.timeline,
      keyframeStates: {
        ...state.timeline.keyframeStates,
        [frame]: buildSnapshot(state),
      },
    },
  }
}

const resolveSelection = (
  selection: Selection,
  sceneItems: SceneItem[],
  layerItems: LayerItem[],
): Selection => {
  if (!selection) {
    return null
  }
  if (selection.type === "scene") {
    return sceneItems.some((item) => item.id === selection.itemId) ? selection : null
  }
  if (selection.type === "layer") {
    return layerItems.some((layer) => layer.id === selection.layerId) ? selection : null
  }
  return null
}

const applyFrameSnapshot = (state: AppState, frame: number): AppState => {
  const nextTimeline = { ...state.timeline, currentFrame: frame }
  const keyframes = sortKeyframes(state.timeline.keyframes)
  const keyframeStates = state.timeline.keyframeStates
  const prevFrame = [...keyframes].reverse().find((entry) => entry <= frame && keyframeStates[entry])
  const nextFrame = keyframes.find((entry) => entry >= frame && keyframeStates[entry])

  if (prevFrame === undefined && nextFrame === undefined) {
    return { ...state, timeline: nextTimeline }
  }

  if (prevFrame === undefined && nextFrame !== undefined) {
    const snapshot = keyframeStates[nextFrame]
    if (!snapshot) {
      return { ...state, timeline: nextTimeline }
    }
    const cloned = cloneSnapshot(snapshot)
    return {
      ...state,
      timeline: nextTimeline,
      scene: {
        backgroundPath: cloned.scene.backgroundPath,
        backgroundSize: cloned.scene.backgroundSize,
        items: cloned.scene.items,
      },
      layers: {
        items: cloned.layers.items,
        activeLayerId: cloned.layers.activeLayerId,
      },
      selection: resolveSelection(
        state.selection,
        cloned.scene.items,
        cloned.layers.items,
      ),
    }
  }

  if (nextFrame === undefined && prevFrame !== undefined) {
    const snapshot = keyframeStates[prevFrame]
    if (!snapshot) {
      return { ...state, timeline: nextTimeline }
    }
    const cloned = cloneSnapshot(snapshot)
    return {
      ...state,
      timeline: nextTimeline,
      scene: {
        backgroundPath: cloned.scene.backgroundPath,
        backgroundSize: cloned.scene.backgroundSize,
        items: cloned.scene.items,
      },
      layers: {
        items: cloned.layers.items,
        activeLayerId: cloned.layers.activeLayerId,
      },
      selection: resolveSelection(
        state.selection,
        cloned.scene.items,
        cloned.layers.items,
      ),
    }
  }

  if (prevFrame === nextFrame && prevFrame !== undefined) {
    const snapshot = keyframeStates[prevFrame]
    if (!snapshot) {
      return { ...state, timeline: nextTimeline }
    }
    const cloned = cloneSnapshot(snapshot)
    return {
      ...state,
      timeline: nextTimeline,
      scene: {
        backgroundPath: cloned.scene.backgroundPath,
        backgroundSize: cloned.scene.backgroundSize,
        items: cloned.scene.items,
      },
      layers: {
        items: cloned.layers.items,
        activeLayerId: cloned.layers.activeLayerId,
      },
      selection: resolveSelection(
        state.selection,
        cloned.scene.items,
        cloned.layers.items,
      ),
    }
  }

  const prevSnapshot = prevFrame !== undefined ? keyframeStates[prevFrame] : undefined
  const nextSnapshot = nextFrame !== undefined ? keyframeStates[nextFrame] : undefined
  if (!prevSnapshot || !nextSnapshot || prevFrame === undefined || nextFrame === undefined) {
    return { ...state, timeline: nextTimeline }
  }
  const t =
    nextFrame === prevFrame ? 0 : (frame - prevFrame) / (nextFrame - prevFrame)
  const interpolated = interpolateSnapshot(prevSnapshot, nextSnapshot, t)
  const cloned = cloneSnapshot(interpolated)
  return {
    ...state,
    timeline: nextTimeline,
    scene: {
      backgroundPath: cloned.scene.backgroundPath,
      backgroundSize: cloned.scene.backgroundSize,
      items: cloned.scene.items,
    },
    layers: {
      items: cloned.layers.items,
      activeLayerId: cloned.layers.activeLayerId,
    },
    selection: resolveSelection(
      state.selection,
      cloned.scene.items,
      cloned.layers.items,
    ),
  }
}
const nextLayerName = (items: LayerItem[]) => {
  const base = "Layer"
  const names = new Set(items.map((item) => item.name))
  let index = 1
  while (names.has(`${base} ${index}`)) {
    index += 1
  }
  return `${base} ${index}`
}

const nextSceneId = (state: AppState) => {
  const layerMax = state.layers.items.reduce((maxId, layer) => Math.max(maxId, layer.id), 0)
  const sceneMax = state.scene.items.reduce((maxId, item) => Math.max(maxId, item.id), 0)
  return Math.max(layerMax, sceneMax) + 1
}

const defaultItemSize = (kind: SceneItem["kind"]) => {
  if (kind === "pantin") {
    return { width: 256, height: 256 }
  }
  return { width: 192, height: 192 }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "timeline/set-fps":
      return {
        ...state,
        timeline: { ...state.timeline, fps: Math.max(1, action.fps) },
      }
    case "timeline/set-range": {
      const start = Math.max(0, Math.min(action.start, action.end))
      const end = Math.max(start, action.end)
      const currentFrame = clamp(state.timeline.currentFrame, start, end)
      return {
        ...state,
        timeline: { ...state.timeline, startFrame: start, endFrame: end, currentFrame },
      }
    }
    case "timeline/set-current": {
      const { startFrame, endFrame } = state.timeline
      const frame = clamp(action.frame, startFrame, endFrame)
      return applyFrameSnapshot(state, frame)
    }
    case "timeline/toggle-loop":
      return {
        ...state,
        timeline: { ...state.timeline, loopEnabled: action.enabled },
      }
    case "timeline/toggle-play":
      return {
        ...state,
        timeline: { ...state.timeline, isPlaying: action.playing },
      }
    case "timeline/add-keyframe": {
      const { startFrame, endFrame } = state.timeline
      const frame = clamp(action.frame, startFrame, endFrame)
      const keyframes = sortKeyframes([...state.timeline.keyframes, frame])
      const snapshot = buildSnapshot(state)
      return {
        ...state,
        timeline: {
          ...state.timeline,
          keyframes,
          keyframeStates: { ...state.timeline.keyframeStates, [frame]: snapshot },
        },
      }
    }
    case "timeline/remove-keyframe": {
      const keyframes = state.timeline.keyframes.filter((frame) => frame !== action.frame)
      const { [action.frame]: _removed, ...rest } = state.timeline.keyframeStates
      return {
        ...state,
        timeline: { ...state.timeline, keyframes, keyframeStates: rest },
      }
    }
    case "timeline/jump-prev": {
      const frames = sortKeyframes(state.timeline.keyframes)
      const current = state.timeline.currentFrame
      const prev = [...frames].reverse().find((frame) => frame < current)
      if (prev === undefined) {
        return state
      }
      return applyFrameSnapshot(state, prev)
    }
    case "timeline/jump-next": {
      const frames = sortKeyframes(state.timeline.keyframes)
      const current = state.timeline.currentFrame
      const next = frames.find((frame) => frame > current)
      if (next === undefined) {
        return state
      }
      return applyFrameSnapshot(state, next)
    }
    case "layers/add": {
      const nextId = nextSceneId(state)
      const newLayer: LayerItem = {
        id: nextId,
        name: nextLayerName(state.layers.items),
        visible: true,
        locked: false,
        kind: "item",
      }
      const nextState = {
        ...state,
        layers: {
          ...state.layers,
          items: [...state.layers.items, newLayer],
          activeLayerId: nextId,
        },
        selection: { type: "layer", layerId: nextId },
      }
      return updateKeyframeStateIfNeeded(nextState)
    }
    case "layers/remove": {
      if (action.layerId === 0) {
        return state
      }
      const layerToRemove = state.layers.items.find((layer) => layer.id === action.layerId)
      if (!layerToRemove || layerToRemove.locked) {
        return state
      }
      const items = state.layers.items.filter((layer) => layer.id !== action.layerId)
      const nextSceneItems = state.scene.items.filter((item) => item.id !== action.layerId)
      const fallback = items[items.length - 1]?.id ?? null
      const activeLayerId =
        state.layers.activeLayerId === action.layerId ? fallback : state.layers.activeLayerId
      const nextSelection: Selection =
        activeLayerId === null
          ? null
          : nextSceneItems.some((item) => item.id === activeLayerId)
            ? { type: "scene", itemId: activeLayerId }
            : { type: "layer", layerId: activeLayerId }
      const nextState = {
        ...state,
        layers: { ...state.layers, items, activeLayerId },
        scene: { ...state.scene, items: nextSceneItems },
        selection: nextSelection,
      }
      return updateKeyframeStateIfNeeded(nextState)
    }
    case "layers/move": {
      const index = state.layers.items.findIndex((layer) => layer.id === action.layerId)
      if (index === -1) {
        return state
      }
      const nextIndex = action.direction === "up" ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= state.layers.items.length) {
        return state
      }
      const items = [...state.layers.items]
      const [moved] = items.splice(index, 1)
      items.splice(nextIndex, 0, moved)
      return updateKeyframeStateIfNeeded({ ...state, layers: { ...state.layers, items } })
    }
    case "layers/toggle-visible":
      return updateKeyframeStateIfNeeded({
        ...state,
        layers: {
          ...state.layers,
          items: state.layers.items.map((layer) =>
            layer.id === action.layerId ? { ...layer, visible: !layer.visible } : layer,
          ),
        },
      })
    case "layers/toggle-locked":
      return updateKeyframeStateIfNeeded({
        ...state,
        layers: {
          ...state.layers,
          items: state.layers.items.map((layer) =>
            layer.id === action.layerId ? { ...layer, locked: !layer.locked } : layer,
          ),
        },
      })
    case "layers/set-active":
      return {
        ...state,
        layers: { ...state.layers, activeLayerId: action.layerId },
        selection: state.scene.items.some((item) => item.id === action.layerId)
          ? { type: "scene", itemId: action.layerId }
          : { type: "layer", layerId: action.layerId },
      }
    case "scene/import-asset": {
      if (action.categoryId === "decors") {
        return updateKeyframeStateIfNeeded({
          ...state,
          scene: {
            ...state.scene,
            backgroundPath: action.path,
            backgroundSize: null,
          },
          layers: {
            ...state.layers,
            items: state.layers.items.map((layer) =>
              layer.id === 0 ? { ...layer, name: action.label } : layer,
            ),
          },
        })
      }
      const kind = action.categoryId === "pantins" ? "pantin" : "objet"
      const nextId = nextSceneId(state)
      const size =
        action.width && action.height
          ? { width: action.width, height: action.height }
          : defaultItemSize(kind)
      const newItem: SceneItem = {
        id: nextId,
        kind,
        label: action.label,
        assetPath: action.path,
        x: 120 + state.scene.items.length * 24,
        y: 120 + state.scene.items.length * 24,
        scale: 1,
        rotation: 0,
        width: size.width,
        height: size.height,
        variants: kind === "pantin" ? {} : undefined,
        memberRotations: kind === "pantin" ? {} : undefined,
      }
      const newLayer: LayerItem = {
        id: nextId,
        name: action.label,
        visible: true,
        locked: false,
        kind: "item",
      }
      const nextState = {
        ...state,
        scene: { ...state.scene, items: [...state.scene.items, newItem] },
        layers: {
          ...state.layers,
          items: [...state.layers.items, newLayer],
          activeLayerId: nextId,
        },
        selection: { type: "scene", itemId: nextId },
      }
      return updateKeyframeStateIfNeeded(nextState)
    }
    case "scene/set-background":
      return updateKeyframeStateIfNeeded({
        ...state,
        scene: {
          ...state.scene,
          backgroundPath: action.path,
          backgroundSize: null,
        },
        layers: {
          ...state.layers,
          items: state.layers.items.map((layer) =>
            layer.id === 0 && action.label ? { ...layer, name: action.label } : layer,
          ),
        },
      })
    case "scene/set-background-size":
      return updateKeyframeStateIfNeeded({
        ...state,
        scene: {
          ...state.scene,
          backgroundSize: { width: action.width, height: action.height },
        },
      })
    case "scene/reset":
      return updateKeyframeStateIfNeeded({
        ...state,
        scene: {
          backgroundPath: defaultBackgroundPath,
          backgroundSize: null,
          items: [],
        },
        layers: {
          items: [
            { id: 0, name: "Background", visible: true, locked: true, kind: "background" },
          ],
          activeLayerId: 0,
        },
        selection: null,
        attachmentRequest: null,
      })
    case "scene/request-attach":
      return {
        ...state,
        attachmentRequest: {
          type: "attach",
          itemId: action.itemId,
          pantinId: action.pantinId,
          memberId: action.memberId,
        },
      }
    case "scene/request-detach":
      return {
        ...state,
        attachmentRequest: {
          type: "detach",
          itemId: action.itemId,
        },
      }
    case "scene/clear-attachment-request":
      return {
        ...state,
        attachmentRequest: null,
      }
    case "scene/select-item":
      return {
        ...state,
        layers: { ...state.layers, activeLayerId: action.itemId },
        selection: { type: "scene", itemId: action.itemId },
      }
    case "scene/update-item":
      return updateKeyframeStateIfNeeded({
        ...state,
        scene: {
          ...state.scene,
          items: state.scene.items.map((item) =>
            item.id === action.itemId ? { ...item, ...action.patch } : item,
          ),
        },
      })
    case "selection/clear":
      return { ...state, selection: null }
    default:
      return state
  }
}

type AppStateContextValue = {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const AppStateContext = React.createContext<AppStateContextValue | null>(null)

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState)
  const value = React.useMemo(() => ({ state, dispatch }), [state])
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = React.useContext(AppStateContext)
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider")
  }
  return context
}
