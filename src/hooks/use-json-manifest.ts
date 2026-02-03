import * as React from "react"

export type ManifestStatus = "idle" | "loading" | "error"

type UseJsonManifestOptions<T> = {
  initialData: T
  parse: (data: unknown) => T
  auto?: boolean
}

export function useJsonManifest<T>(
  url: string,
  { initialData, parse, auto = true }: UseJsonManifestOptions<T>,
) {
  const [data, setData] = React.useState<T>(initialData)
  const [status, setStatus] = React.useState<ManifestStatus>("idle")

  const load = React.useCallback(async () => {
    setStatus("loading")
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("manifest")
      }
      const json = (await response.json()) as unknown
      setData(parse(json))
      setStatus("idle")
    } catch {
      setData(initialData)
      setStatus("error")
    }
  }, [initialData, parse, url])

  React.useEffect(() => {
    if (auto) {
      void load()
    }
  }, [auto, load])

  return { data, status, reload: load }
}
