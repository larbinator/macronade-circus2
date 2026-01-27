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
}

export type SceneState = {
  backgroundPath: string | null
  backgroundSize: { width: number; height: number } | null
  items: SceneItem[]
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
  | { type: "selection/clear" }

const defaultBackgroundPath = "/decors/defaut.png"

const initialState: AppState = {
  timeline: {
    fps: 24,
    startFrame: 0,
    endFrame: 239,
    currentFrame: 1,
    keyframes: [8, 24, 36, 72, 98, 132, 164, 198],
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
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const sortKeyframes = (keyframes: number[]) =>
  [...new Set(keyframes)].sort((a, b) => a - b)

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
      return {
        ...state,
        timeline: {
          ...state.timeline,
          currentFrame: clamp(action.frame, startFrame, endFrame),
        },
      }
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
      return { ...state, timeline: { ...state.timeline, keyframes } }
    }
    case "timeline/remove-keyframe": {
      const keyframes = state.timeline.keyframes.filter((frame) => frame !== action.frame)
      return { ...state, timeline: { ...state.timeline, keyframes } }
    }
    case "timeline/jump-prev": {
      const frames = sortKeyframes(state.timeline.keyframes)
      const current = state.timeline.currentFrame
      const prev = [...frames].reverse().find((frame) => frame < current)
      if (prev === undefined) {
        return state
      }
      return {
        ...state,
        timeline: { ...state.timeline, currentFrame: prev },
      }
    }
    case "timeline/jump-next": {
      const frames = sortKeyframes(state.timeline.keyframes)
      const current = state.timeline.currentFrame
      const next = frames.find((frame) => frame > current)
      if (next === undefined) {
        return state
      }
      return {
        ...state,
        timeline: { ...state.timeline, currentFrame: next },
      }
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
      return {
        ...state,
        layers: {
          ...state.layers,
          items: [...state.layers.items, newLayer],
          activeLayerId: nextId,
        },
        selection: { type: "layer", layerId: nextId },
      }
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
      const nextSelection =
        activeLayerId === null
          ? null
          : nextSceneItems.some((item) => item.id === activeLayerId)
            ? { type: "scene", itemId: activeLayerId }
            : { type: "layer", layerId: activeLayerId }
      return {
        ...state,
        layers: { ...state.layers, items, activeLayerId },
        scene: { ...state.scene, items: nextSceneItems },
        selection: nextSelection,
      }
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
      return { ...state, layers: { ...state.layers, items } }
    }
    case "layers/toggle-visible":
      return {
        ...state,
        layers: {
          ...state.layers,
          items: state.layers.items.map((layer) =>
            layer.id === action.layerId ? { ...layer, visible: !layer.visible } : layer,
          ),
        },
      }
    case "layers/toggle-locked":
      return {
        ...state,
        layers: {
          ...state.layers,
          items: state.layers.items.map((layer) =>
            layer.id === action.layerId ? { ...layer, locked: !layer.locked } : layer,
          ),
        },
      }
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
        return {
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
        }
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
      return {
        ...state,
        scene: { ...state.scene, items: [...state.scene.items, newItem] },
        layers: {
          ...state.layers,
          items: [...state.layers.items, newLayer],
          activeLayerId: nextId,
        },
        selection: { type: "scene", itemId: nextId },
      }
    }
    case "scene/set-background":
      return {
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
      }
    case "scene/set-background-size":
      return {
        ...state,
        scene: {
          ...state.scene,
          backgroundSize: { width: action.width, height: action.height },
        },
      }
    case "scene/reset":
      return {
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
      }
    case "scene/select-item":
      return {
        ...state,
        layers: { ...state.layers, activeLayerId: action.itemId },
        selection: { type: "scene", itemId: action.itemId },
      }
    case "scene/update-item":
      return {
        ...state,
        scene: {
          ...state.scene,
          items: state.scene.items.map((item) =>
            item.id === action.itemId ? { ...item, ...action.patch } : item,
          ),
        },
      }
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
