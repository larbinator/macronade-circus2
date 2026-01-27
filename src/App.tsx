import * as React from "react"
import { FloatingPanel } from "@/components/FloatingPanel"
import { FloatingToolbar } from "@/components/FloatingToolbar"
import { LibraryPanel } from "@/components/LibraryPanel"
import { LayersPanel } from "@/components/LayersPanel"
import { PropertiesPanel } from "@/components/PropertiesPanel"
import { SceneView } from "@/components/SceneView"
import { Timeline } from "@/components/Timeline"
import { useAppState } from "@/state/app-state"
import {
  BookOpen,
  Film,
  FolderOpen,
  LayoutDashboard,
  Layers,
  Maximize2,
  Save,
  Settings2,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

const toolsItems = [
  { id: "zoom-out", label: "Zoom arriere", icon: <ZoomOut className="h-4 w-4" /> },
  { id: "zoom-in", label: "Zoom avant", icon: <ZoomIn className="h-4 w-4" /> },
  { id: "fit", label: "Ajuster a la vue", icon: <Maximize2 className="h-4 w-4" /> },
  {
    id: "onion",
    label: "Onion skin",
    icon: <Sparkles className="h-4 w-4" />,
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
    id: "reset-ui",
    label: "Reinitialiser interface",
    icon: <LayoutDashboard className="h-4 w-4" />,
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

export default function App() {
  const { dispatch } = useAppState()
  const stageRef = React.useRef<HTMLDivElement>(null)
  const [panelVisibility, setPanelVisibility] = React.useState({
    library: true,
    properties: true,
    timeline: true,
    layers: true,
  })
  const [sceneZoom, setSceneZoom] = React.useState(1)
  const [toolsToggles, setToolsToggles] = React.useState({
    onion: false,
  })

  const panelToggleState = React.useMemo(
    () => ({
      "toggle-library": panelVisibility.library,
      "toggle-properties": panelVisibility.properties,
      "toggle-timeline": panelVisibility.timeline,
      "toggle-layers": panelVisibility.layers,
    }),
    [panelVisibility],
  )

  const handleMainToggle = React.useCallback(
    (id: string, pressed: boolean) => {
      setPanelVisibility((prev) => {
        switch (id) {
          case "toggle-library":
            return { ...prev, library: pressed }
          case "toggle-properties":
            return { ...prev, properties: pressed }
          case "toggle-timeline":
            return { ...prev, timeline: pressed }
          case "toggle-layers":
            return { ...prev, layers: pressed }
          default:
            return prev
        }
      })
    },
    [],
  )

  const handleMainAction = React.useCallback(
    (id: string) => {
      if (id === "reset-scene") {
        dispatch({ type: "scene/reset" })
        setSceneZoom(1)
      }
    },
    [dispatch],
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
      onion: toolsToggles.onion,
    }),
    [toolsToggles],
  )

  const handleToolsToggle = React.useCallback((id: string, pressed: boolean) => {
    setToolsToggles((prev) => {
      switch (id) {
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
              <SceneView zoom={sceneZoom} />
            </div>

            {panelVisibility.library ? (
              <FloatingPanel
                title="Library"
                storageKey="panel-library"
                initialX={24}
                initialY={24}
                initialWidth={320}
                initialHeight={520}
                boundsRef={stageRef}
              >
                <LibraryPanel />
              </FloatingPanel>
            ) : null}
            {panelVisibility.properties ? (
              <FloatingPanel
                title="Properties"
                storageKey="panel-properties"
                initialX={360}
                initialY={24}
                initialWidth={320}
                initialHeight={520}
                boundsRef={stageRef}
              >
                <PropertiesPanel />
              </FloatingPanel>
            ) : null}
            {panelVisibility.layers ? (
              <FloatingPanel
                title="Layers"
                storageKey="panel-layers"
                initialX={360}
                initialY={560}
                initialWidth={320}
                initialHeight={260}
                boundsRef={stageRef}
              >
                <LayersPanel />
              </FloatingPanel>
            ) : null}
          </div>
        </main>
        {panelVisibility.timeline ? <Timeline /> : null}
      </div>
    </div>
  )
}
