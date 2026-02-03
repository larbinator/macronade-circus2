import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useJsonManifest } from "@/hooks/use-json-manifest"
import { useAppState } from "@/state/app-state"
import { Box, Image as ImageIcon, RotateCw, User } from "lucide-react"

type AssetItem = {
  id: string
  label: string
  path: string
  type: string
}

type AssetCategory = {
  id: string
  label: string
  items: AssetItem[]
}

const iconMap: Record<string, typeof User> = {
  pantins: User,
  decors: ImageIcon,
  objets: Box,
}

const emptyCategories: AssetCategory[] = []

const parseAssetsManifest = (data: unknown): AssetCategory[] => {
  const parsed = data as { categories?: AssetCategory[] } | null
  return Array.isArray(parsed?.categories) ? parsed.categories : []
}

export function LibraryPanel() {
  const { state, dispatch } = useAppState()
  const { data: categories, status, reload } = useJsonManifest("/assets-manifest.json", {
    initialData: emptyCategories,
    parse: parseAssetsManifest,
  })
  const [activeTab, setActiveTab] = React.useState<string>("")
  const [selectedLibraryAsset, setSelectedLibraryAsset] = React.useState<string | null>(
    null,
  )
  const svgSizeCacheRef = React.useRef<Map<string, { width: number; height: number }>>(
    new Map(),
  )

  React.useEffect(() => {
    if (categories.length === 0) {
      setActiveTab("")
      return
    }
    if (!activeTab || !categories.some((category) => category.id === activeTab)) {
      setActiveTab(categories[0].id)
    }
  }, [activeTab, categories])

  const selectedSceneItem = React.useMemo(() => {
    if (state.selection && state.selection.type === "scene") {
      const { itemId } = state.selection
      return state.scene.items.find((item) => item.id === itemId) ?? null
    }
    return null
  }, [state.selection, state.scene.items])
  const selectedAssetPath = selectedSceneItem?.assetPath ?? selectedLibraryAsset

  const dispatchImport = React.useCallback(
    (categoryId: string, item: AssetItem, size?: { width: number; height: number }) => {
      dispatch({
        type: "scene/import-asset",
        categoryId,
        assetId: item.id,
        label: item.label,
        path: item.path,
        ...size,
      })
    },
    [dispatch],
  )

  const getSvgSize = React.useCallback((contents: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(contents, "image/svg+xml")
    const svg = doc.querySelector("svg")
    const viewBox = svg?.getAttribute("viewBox")
    if (viewBox) {
      const parts = viewBox
        .trim()
        .split(/[\s,]+/)
        .map((value) => Number(value))
      if (parts.length === 4 && parts.every((value) => !Number.isNaN(value))) {
        const width = Math.abs(parts[2])
        const height = Math.abs(parts[3])
        if (width > 0 && height > 0) {
          return { width, height }
        }
      }
    }
    const widthAttr = svg?.getAttribute("width")
    const heightAttr = svg?.getAttribute("height")
    const width = widthAttr ? Number.parseFloat(widthAttr) : Number.NaN
    const height = heightAttr ? Number.parseFloat(heightAttr) : Number.NaN
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height }
    }
    return null
  }, [])

  const handleImport = (categoryId: string, item: AssetItem) => {
    const dispatchFallback = () => {
      const image = new window.Image()
      image.onload = () => {
        dispatchImport(categoryId, item, {
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }
      image.onerror = () => {
        dispatchImport(categoryId, item)
      }
      image.src = item.path
    }

    if (item.type === "svg") {
      const cachedSize = svgSizeCacheRef.current.get(item.path)
      if (cachedSize) {
        dispatchImport(categoryId, item, cachedSize)
        return
      }
      fetch(item.path)
        .then((response) => {
          if (!response.ok) {
            throw new Error("svg")
          }
          return response.text()
        })
        .then((contents) => {
          const size = getSvgSize(contents)
          if (size) {
            svgSizeCacheRef.current.set(item.path, size)
            dispatchImport(categoryId, item, size)
            return
          }
          dispatchFallback()
        })
        .catch(() => { dispatchFallback(); })
      return
    }

    dispatchFallback()
  }

  if (status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Manifest introuvable.
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Aucun asset disponible.
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-[#1F2937] pb-2">
        <TabsList className="h-9 justify-start gap-2 rounded-lg bg-transparent p-0">
          {categories.map((category) => {
            const Icon = iconMap[category.id] ?? User
            return (
              <TabsTrigger
                key={category.id}
                value={category.id}
                title={category.label}
                aria-label={category.label}
                className="h-9 w-9 rounded-lg border border-[#2B3444] bg-[#1F2937] p-0 text-[#CBD5E1] data-[state=active]:bg-[#E53E3E] data-[state=active]:text-white data-[state=active]:border-[#C53030]"
              >
                <Icon className="h-4 w-4" />
              </TabsTrigger>
            )
          })}
        </TabsList>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          aria-label="Rafraichir"
          title="Rafraichir"
          onClick={() => reload()}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>
      {categories.map((category) => {
        return (
          <TabsContent key={category.id} value={category.id}>
            <div className="grid auto-rows-[96] grid-cols-[repeat(auto-fill,96px)] gap-[2px] content-start justify-start">
              {category.items.map((item) => (
                <button
                  key={item.id}
                  className={
                    selectedAssetPath === item.path
                      ? "group relative flex h-[96px] w-full items-center justify-center rounded-lg bg-[rgba(229,62,62,0.18)] shadow-sm transition ring-1 ring-[#C53030]"
                      : "group relative flex h-[96px] w-full items-center justify-center rounded-lg bg-transparent transition hover:bg-[#2D3748] ring-1 ring-transparent hover:ring-[#4B5563]"
                  }
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => { setSelectedLibraryAsset(item.path); }}
                  onDoubleClick={() => { handleImport(category.id, item); }}
                >
                  <div className="flex h-[96px] w-[96px] items-center justify-center rounded-md border border-[#2B3444] bg-[#111827]">
                    <img
                      src={item.path}
                      alt={item.label}
                      className="max-h-[88px] max-w-[88px] object-contain"
                      loading="lazy"
                    />
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
