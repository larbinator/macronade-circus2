import * as React from "react"
import { FloatingPanel } from "@/components/FloatingPanel"
import { FloatingToolbar } from "@/components/FloatingToolbar"
import { LibraryPanel } from "@/components/LibraryPanel"
import { LayersPanel } from "@/components/LayersPanel"
import { PropertiesPanel } from "@/components/PropertiesPanel"
import { SceneView } from "@/components/SceneView"
import { Timeline } from "@/components/Timeline"
import { createProjectFile, type ProjectFile, useAppState } from "@/state/app-state"
import { invoke, isTauri } from "@tauri-apps/api/core"
import { open, save } from "@tauri-apps/plugin-dialog"
import {
  BookOpen,
  Film,
  FolderOpen,
  Hand,
  Layers,
  Maximize2,
  Save,
  Settings2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

const toolsItems = [
  { id: "zoom-out", label: "Zoom arriere", icon: <ZoomOut className="h-4 w-4" /> },
  { id: "zoom-in", label: "Zoom avant", icon: <ZoomIn className="h-4 w-4" /> },
  { id: "fit", label: "Ajuster a la vue", icon: <Maximize2 className="h-4 w-4" /> },
  {
    id: "handles",
    label: "Poignees",
    icon: <Hand className="h-4 w-4" />,
    type: "toggle" as const,
  },
]

const mainItems = [
  { id: "save", label: "Enregistrer", icon: <Save className="h-4 w-4" /> },
  { id: "load", label: "Ouvrir", icon: <FolderOpen className="h-4 w-4" /> },
  {
    id: "reset-scene",
    label: "Reinitialiser scene",
    icon: <Undo2 className="h-4 w-4" />,
  },
  {
    id: "toggle-library",
    label: "Bibliotheque",
    icon: <BookOpen className="h-4 w-4" />,
    type: "toggle" as const,
  },
  {
    id: "toggle-properties",
    label: "Proprietes",
    icon: <Settings2 className="h-4 w-4" />,
    type: "toggle" as const,
  },
  {
    id: "toggle-timeline",
    label: "Timeline",
    icon: <Film className="h-4 w-4" />,
    type: "toggle" as const,
  },
  {
    id: "toggle-layers",
    label: "Calques",
    icon: <Layers className="h-4 w-4" />,
    type: "toggle" as const,
  },
]

const panelConfigs = [
  {
    key: "library",
    title: "Library",
    storageKey: "panel-library",
    initialX: 24,
    initialY: 24,
    initialWidth: 320,
    initialHeight: 520,
    Component: LibraryPanel,
  },
  {
    key: "properties",
    title: "Properties",
    storageKey: "panel-properties",
    initialX: 360,
    initialY: 24,
    initialWidth: 320,
    initialHeight: 520,
    Component: PropertiesPanel,
  },
  {
    key: "layers",
    title: "Layers",
    storageKey: "panel-layers",
    initialX: 360,
    initialY: 560,
    initialWidth: 320,
    initialHeight: 260,
    Component: LayersPanel,
  },
] as const

const panelToggleIds = {
  "toggle-library": "library",
  "toggle-properties": "properties",
  "toggle-timeline": "timeline",
  "toggle-layers": "layers",
} as const

const parseProjectFile = (contents: string): ProjectFile | null => {
  try {
    const parsed = JSON.parse(contents) as Partial<ProjectFile>
    if (!parsed || typeof parsed !== "object") {
      return null
    }
    if (!parsed.timeline || !parsed.scene || !parsed.layers) {
      return null
    }
    if (!Array.isArray(parsed.timeline.keyframes)) {
      return null
    }
    if (!Array.isArray(parsed.scene.items) || !Array.isArray(parsed.layers.items)) {
      return null
    }
    return parsed as ProjectFile
  } catch {
    return null
  }
}

export default function App() {
  const { state, dispatch } = useAppState()
  const stageRef = React.useRef<HTMLDivElement>(null)
  const [panelVisibility, setPanelVisibility] = React.useState({
    library: true,
    properties: true,
    timeline: true,
    layers: true,
  })
  const [sceneZoom, setSceneZoom] = React.useState(1)
  const [toolsToggles, setToolsToggles] = React.useState({
    handles: false,
    onion: false,
  })

  const panelToggleState = React.useMemo(() => {
    const entries = Object.entries(panelToggleIds) as Array<
      [
        keyof typeof panelToggleIds,
        (typeof panelToggleIds)[keyof typeof panelToggleIds],
      ]
    >
    return Object.fromEntries(
      entries.map(([toggleId, key]) => [toggleId, panelVisibility[key]]),
    )
  }, [panelVisibility])

  const handleMainToggle = React.useCallback((id: string, pressed: boolean) => {
    if (!(id in panelToggleIds)) {
      return
    }
    const key = panelToggleIds[id as keyof typeof panelToggleIds]
    setPanelVisibility((prev) => ({ ...prev, [key]: pressed }))
  }, [])

  const handleMainAction = React.useCallback(
    async (id: string) => {
      if (id === "reset-scene") {
        dispatch({ type: "scene/reset" })
        setSceneZoom(1)
        return
      }
      if (id === "save") {
        if (!isTauri()) {
          window.alert("Sauvegarde disponible uniquement via Tauri.")
          return
        }
        try {
          const path = await save({
            filters: [{ name: "Projet Macronade", extensions: ["json"] }],
            defaultPath: "projet-macronade.json",
          })
          if (!path) {
            return
          }
          const project = createProjectFile(state)
          await invoke("save_project", {
            path,
            contents: JSON.stringify(project, null, 2),
          })
        } catch (error) {
          console.error("Echec de la sauvegarde.", error)
          window.alert("Echec de la sauvegarde du projet.")
        }
        return
      }
      if (id === "load") {
        if (!isTauri()) {
          window.alert("Chargement disponible uniquement via Tauri.")
          return
        }
        try {
          const selection = await open({
            filters: [{ name: "Projet Macronade", extensions: ["json"] }],
            multiple: false,
          })
          const path = Array.isArray(selection) ? selection[0] : selection
          if (!path) {
            return
          }
          const contents = await invoke<string>("load_project", { path })
          const project = parseProjectFile(contents)
          if (!project) {
            window.alert("Le fichier ne ressemble pas a un projet valide.")
            return
          }
          dispatch({ type: "project/load", project })
        } catch (error) {
          console.error("Echec du chargement.", error)
          window.alert("Echec du chargement du projet.")
        }
      }
    },
    [dispatch, state],
  )

  const handleToolsAction = React.useCallback((id: string) => {
    setSceneZoom((prev) => {
      const clamp = (value: number) => Math.min(Math.max(value, 0.1), 4)
      switch (id) {
        case "zoom-in":
          return clamp(prev * 1.25)
        case "zoom-out":
          return clamp(prev * 0.8)
        case "fit":
          return 1
        default:
          return prev
      }
    })
  }, [])

  const toolsToggleState = React.useMemo(
    () => ({
      handles: toolsToggles.handles,
      onion: toolsToggles.onion,
    }),
    [toolsToggles],
  )

  const handleToolsToggle = React.useCallback((id: string, pressed: boolean) => {
    setToolsToggles((prev) => {
      switch (id) {
        case "handles":
          return { ...prev, handles: pressed }
        case "onion":
          return { ...prev, onion: pressed }
        default:
          return prev
      }
    })
  }, [])

  return (
    <div className="app-shell">
      <div className="relative z-10 flex h-full flex-col overflow-hidden">
        <main className="flex flex-1 min-h-0 overflow-hidden bg-[#0f172a]">
          <div
            ref={stageRef}
            className="scene-stage relative flex flex-1 min-h-0 w-full flex-col overflow-hidden"
          >
            <FloatingToolbar
              title="Outils"
              items={toolsItems}
              initialX={24}
              initialY={24}
              boundsRef={stageRef}
              storageKey="toolbar-tools"
              onItemAction={handleToolsAction}
              activeItems={toolsToggleState}
              onItemToggle={handleToolsToggle}
            />
            <FloatingToolbar
              title="Principal"
              items={mainItems}
              initialX={24}
              initialY={72}
              boundsRef={stageRef}
              storageKey="toolbar-main"
              activeItems={panelToggleState}
              onItemToggle={handleMainToggle}
              onItemAction={handleMainAction}
            />

            <div className="relative flex flex-1 min-h-0 w-full">
              <SceneView zoom={sceneZoom} showHandles={toolsToggles.handles} />
            </div>

            {panelConfigs.map((panel) => {
              if (!panelVisibility[panel.key]) {
                return null
              }
              const PanelComponent = panel.Component
              return (
                <FloatingPanel
                  key={panel.key}
                  title={panel.title}
                  storageKey={panel.storageKey}
                  initialX={panel.initialX}
                  initialY={panel.initialY}
                  initialWidth={panel.initialWidth}
                  initialHeight={panel.initialHeight}
                  boundsRef={stageRef}
                >
                  <PanelComponent />
                </FloatingPanel>
              )
            })}
          </div>
        </main>
        {panelVisibility.timeline ? <Timeline /> : null}
      </div>
    </div>
  )
}
