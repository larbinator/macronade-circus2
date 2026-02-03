import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import fs from "node:fs/promises"

const assetCategories = [
  { id: "pantins", label: "Pantins", dir: "pantins" },
  { id: "decors", label: "Decors", dir: "decors" },
  { id: "objets", label: "Objets", dir: "objets" },
]

const assetExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"])

const humanize = (name: string) =>
  name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const parseAttributes = (raw: string) => {
  const attributes: Record<string, string> = {}
  const regex = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(raw))) {
    attributes[match[1]] = match[2] ?? match[3] ?? ""
  }
  return attributes
}

const parsePantinSvg = (contents: string) => {
  const rotatable = new Set<string>()
  const variants: Record<
    string,
    { variants: { name: string; visible: boolean }[]; defaultVariant?: string }
  > = {}
  const tagRegex = /<g\b[^>]*>/gi
  let match: RegExpExecArray | null = null
  while ((match = tagRegex.exec(contents))) {
    const attrs = parseAttributes(match[0])
    if (attrs["data-isrotatable"] === "true" || attrs["data-isrotatable"] === "1") {
      const id = attrs.id.trim()
      if (id) {
        rotatable.add(id)
      }
    }
    const variantGroup = attrs["data-variant-groupe"]
    const variantName = attrs["data-variant-name"]
    if (variantGroup && variantName) {
      const visibility = (attrs.visibility ?? "").toLowerCase()
      const isVisible = visibility === "true" || visibility === "visible"
      if (!variants[variantGroup]) {
        variants[variantGroup] = { variants: [], defaultVariant: undefined }
      }
      variants[variantGroup].variants.push({ name: variantName, visible: isVisible })
      if (isVisible && !variants[variantGroup].defaultVariant) {
        variants[variantGroup].defaultVariant = variantName
      }
    }
  }
  return {
    rotatableMembers: Array.from(rotatable),
    variants,
  }
}

const generateAssetsManifest = async () => {
  const publicDir = path.resolve(__dirname, "public")
  const categories = await Promise.all(
    assetCategories.map(async (category) => {
      const dirPath = path.join(publicDir, category.dir)
      let entries: { name: string; isFile: () => boolean }[] = []
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true })
      } catch {
        entries = []
      }
      const items = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => assetExtensions.has(path.extname(name).toLowerCase()))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => {
          const ext = path.extname(name).toLowerCase()
          const base = path.basename(name, ext)
          return {
            id: base,
            label: humanize(base),
            path: `/${category.dir}/${name}`,
            type: ext.slice(1),
          }
        })
      return {
        id: category.id,
        label: category.label,
        items,
      }
    }),
  )
  const manifestPath = path.join(publicDir, "assets-manifest.json")
  await fs.writeFile(manifestPath, JSON.stringify({ categories }, null, 2))
}

const generatePantinsManifest = async () => {
  const publicDir = path.resolve(__dirname, "public")
  const pantinsDir = path.join(publicDir, "pantins")
  let entries: { name: string; isFile: () => boolean }[] = []
  try {
    entries = await fs.readdir(pantinsDir, { withFileTypes: true })
  } catch {
    entries = []
  }
  const pantins = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".svg"))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        const filePath = path.join(pantinsDir, entry.name)
        const contents = await fs.readFile(filePath, "utf8")
        const parsed = parsePantinSvg(contents)
        const id = path.basename(entry.name, path.extname(entry.name))
        return {
          id,
          path: `/pantins/${entry.name}`,
          rotatableMembers: parsed.rotatableMembers,
          variants: parsed.variants,
        }
      }),
  )
  const manifestPath = path.join(publicDir, "pantins-manifest.json")
  await fs.writeFile(manifestPath, JSON.stringify({ pantins }, null, 2))
}

const assetsManifestPlugin = () => {
  let timer: NodeJS.Timeout | null = null
  const schedule = (onReload?: () => void) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      Promise.all([generateAssetsManifest(), generatePantinsManifest()])
        .then(() => {
          if (onReload) {
            onReload()
          }
        })
        .catch((error) => {
          console.warn("[assets-manifest] Failed to generate manifest", error)
        })
    }, 50)
  }
  return {
    name: "assets-manifest",
    async buildStart() {
      await Promise.all([generateAssetsManifest(), generatePantinsManifest()])
    },
    async configResolved() {
      await Promise.all([generateAssetsManifest(), generatePantinsManifest()])
    },
    configureServer(server: { watcher: unknown; ws: any }) {
      const publicDir = path.resolve(__dirname, "public")
      const watchDirs = assetCategories.map((category) => path.join(publicDir, category.dir))
      server.watcher.add(watchDirs)
      const onFsEvent = () => {
        schedule(() => {
          server.ws.send({ type: "full-reload", path: "/assets-manifest.json" })
        })
      }
      server.watcher.on("add", onFsEvent)
      server.watcher.on("unlink", onFsEvent)
      server.watcher.on("change", onFsEvent)
    },
  }
}

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    assetsManifestPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
})
