import * as React from "react"
import { Button } from "@/components/ui/button"
import { useAppState } from "@/state/app-state"
import { cn } from "@/lib/utils"

type PantinVariant = {
  name: string
  visible: boolean
}

type PantinVariantGroup = {
  variants: PantinVariant[]
  defaultVariant?: string
}

type PantinDefinition = {
  id: string
  path: string
  rotatableMembers: string[]
  variants: Record<string, PantinVariantGroup>
}

type PantinsManifest = {
  pantins: PantinDefinition[]
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function SmallInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return (
    <input
      {...rest}
      className={cn(
        "h-7 rounded-md border border-border bg-[#111827] px-2 text-sm text-foreground focus:border-accent focus:outline-none",
        className,
      )}
    />
  )
}

function SmallSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props
  return (
    <select
      {...rest}
      className={cn(
        "h-7 appearance-none rounded-md border border-border bg-[#111827] px-2 text-sm text-foreground focus:border-accent focus:bg-[#111827] focus:outline-none",
        className,
      )}
    />
  )
}

export function PropertiesPanel() {
  const { state, dispatch } = useAppState()
  const [pantinsManifest, setPantinsManifest] = React.useState<PantinDefinition[]>([])
  const [pantinsStatus, setPantinsStatus] = React.useState<"idle" | "loading" | "error">(
    "idle",
  )
  const [attachPantinId, setAttachPantinId] = React.useState<number | null>(null)
  const [attachMember, setAttachMember] = React.useState<string>("")

  const activeLayer = state.layers.items.find(
    (layer) => layer.id === state.layers.activeLayerId,
  )
  const selectedSceneItem = React.useMemo(() => {
    if (state.selection && state.selection.type === "scene") {
      const { itemId } = state.selection
      return state.scene.items.find((item) => item.id === itemId) ?? null
    }
    return null
  }, [state.selection, state.scene.items])
  const selectionLabel = selectedSceneItem?.label ?? activeLayer?.name ?? "Aucune selection"
  const selectionType = selectedSceneItem
    ? selectedSceneItem.kind === "pantin"
      ? "Pantin"
      : "Objet"
    : state.selection
      ? "Calque"
      : "Aucun"
  const selectionKind = selectedSceneItem?.kind ?? (state.selection ? "layer" : "none")

  React.useEffect(() => {
    setPantinsStatus("loading")
    fetch("/pantins-manifest.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("manifest")
        }
        return response.json() as Promise<PantinsManifest>
      })
      .then((data) => {
        setPantinsManifest(Array.isArray(data.pantins) ? data.pantins : [])
        setPantinsStatus("idle")
      })
      .catch(() => {
        setPantinsManifest([])
        setPantinsStatus("error")
      })
  }, [])

  const resolvePantinDefinition = (assetPath: string | null | undefined) => {
    if (!assetPath) {
      return null
    }
    const fileName = assetPath.split("/").pop() ?? ""
    const id = fileName.replace(/\.[^/.]+$/, "")
    return (
      pantinsManifest.find((entry) => entry.path === assetPath) ??
      pantinsManifest.find((entry) => entry.id === id) ??
      null
    )
  }

  const selectedPantinDefinition =
    selectedSceneItem?.kind === "pantin"
      ? resolvePantinDefinition(selectedSceneItem.assetPath)
      : null
  const variantGroups = selectedPantinDefinition
    ? Object.entries(selectedPantinDefinition.variants ?? {})
    : []
  const rotatableMembers = selectedPantinDefinition?.rotatableMembers ?? []
  const itemVariants = selectedSceneItem?.variants ?? {}
  const memberRotations = selectedSceneItem?.memberRotations ?? {}

  const pantinItems = state.scene.items.filter((item) => item.kind === "pantin")
  const attachPantin =
    pantinItems.find((item) => item.id === attachPantinId) ??
    (selectedSceneItem?.kind === "pantin" ? selectedSceneItem : null) ??
    pantinItems[0] ??
    null
  const attachPantinDefinition = resolvePantinDefinition(attachPantin?.assetPath)
  const attachMembers = attachPantinDefinition?.rotatableMembers ?? []

  React.useEffect(() => {
    if (selectedSceneItem?.kind === "pantin") {
      setAttachPantinId(selectedSceneItem.id)
      return
    }
    if (!attachPantinId || !pantinItems.some((item) => item.id === attachPantinId)) {
      setAttachPantinId(pantinItems[0]?.id ?? null)
    }
  }, [selectedSceneItem?.id, selectedSceneItem?.kind, pantinItems, attachPantinId])

  React.useEffect(() => {
    if (attachMembers.length > 0) {
      setAttachMember(attachMembers[0])
    } else {
      setAttachMember("")
    }
  }, [attachPantinDefinition?.id, attachMembers.join("|")])

  if (selectionKind === "none") {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Selection
        </div>
        <div className="mt-3 grid grid-cols-[96px_1fr] items-center gap-2 text-sm">
          <span className="text-muted-foreground">Type</span>
          <div className="rounded-md border border-border bg-[#111827] px-2 py-1 text-sm text-foreground">
            {selectionType}
          </div>
          <span className="text-muted-foreground">Nom</span>
          <div className="rounded-md border border-border bg-[#111827] px-2 py-1 text-sm text-foreground">
            {selectionLabel}
          </div>
        </div>
      </div>

      {selectedSceneItem ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Transform
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <FieldRow label="Position">
              <div className="grid grid-cols-2 gap-2">
                <SmallInput
                  value={selectedSceneItem ? Math.round(selectedSceneItem.x) : ""}
                  placeholder="-"
                  disabled={!selectedSceneItem}
                  onChange={(event) => {
                    if (!selectedSceneItem) {
                      return
                    }
                    const value = Number(event.target.value)
                    if (!Number.isNaN(value)) {
                      dispatch({
                        type: "scene/update-item",
                        itemId: selectedSceneItem.id,
                        patch: { x: value },
                      })
                    }
                  }}
                />
                <SmallInput
                  value={selectedSceneItem ? Math.round(selectedSceneItem.y) : ""}
                  placeholder="-"
                  disabled={!selectedSceneItem}
                  onChange={(event) => {
                    if (!selectedSceneItem) {
                      return
                    }
                    const value = Number(event.target.value)
                    if (!Number.isNaN(value)) {
                      dispatch({
                        type: "scene/update-item",
                        itemId: selectedSceneItem.id,
                        patch: { y: value },
                      })
                    }
                  }}
                />
              </div>
            </FieldRow>
          <FieldRow label="Echelle">
            <SmallInput
              value={selectedSceneItem ? selectedSceneItem.scale.toFixed(2) : ""}
              placeholder="-"
              className="w-20"
              disabled={!selectedSceneItem}
              onChange={(event) => {
                if (!selectedSceneItem) {
                  return
                  }
                  const value = Number(event.target.value)
                  if (!Number.isNaN(value)) {
                    dispatch({
                      type: "scene/update-item",
                      itemId: selectedSceneItem.id,
                      patch: { scale: value },
                    })
                  }
                }}
              />
            </FieldRow>
          <FieldRow label="Rotation">
            <SmallInput
              value={selectedSceneItem ? Math.round(selectedSceneItem.rotation) : ""}
              placeholder="-"
              className="w-20"
              disabled={!selectedSceneItem}
              onChange={(event) => {
                if (!selectedSceneItem) {
                  return
                  }
                  const value = Number(event.target.value)
                  if (!Number.isNaN(value)) {
                    dispatch({
                      type: "scene/update-item",
                      itemId: selectedSceneItem.id,
                      patch: { rotation: value },
                    })
                  }
                }}
              />
            </FieldRow>
          </div>
        </div>
      ) : null}

      {selectedSceneItem?.kind === "pantin" ? (
        <>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Variantes
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {pantinsStatus === "loading" ? (
                <div className="text-sm text-muted-foreground">
                  Chargement du manifest...
                </div>
              ) : pantinsStatus === "error" ? (
                <div className="text-sm text-muted-foreground">
                  Manifest introuvable.
                </div>
              ) : !selectedPantinDefinition ? (
                <div className="text-sm text-muted-foreground">
                  Selectionne un pantin pour voir ses variantes.
                </div>
              ) : variantGroups.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Aucune variante detectee.
                </div>
              ) : (
                variantGroups.map(([group, data]) => {
                  const value =
                    itemVariants[group] ??
                    data.defaultVariant ??
                    data.variants.find((variant) => variant.visible)?.name ??
                    data.variants[0]?.name ??
                    ""
                  return (
                    <FieldRow key={group} label={group}>
                      <SmallSelect
                        value={value}
                        onChange={(event) => {
                          if (!selectedSceneItem) {
                            return
                          }
                          const nextValue = event.target.value
                          dispatch({
                            type: "scene/update-item",
                            itemId: selectedSceneItem.id,
                            patch: { variants: { ...itemVariants, [group]: nextValue } },
                          })
                        }}
                      >
                        {data.variants.map((variant) => (
                          <option key={variant.name} value={variant.name}>
                            {variant.name}
                          </option>
                        ))}
                      </SmallSelect>
                    </FieldRow>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Membres rotatables
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {pantinsStatus === "loading" ? (
                <div className="text-sm text-muted-foreground">Chargement...</div>
              ) : pantinsStatus === "error" ? (
                <div className="text-sm text-muted-foreground">
                  Manifest introuvable.
                </div>
              ) : !selectedPantinDefinition ? (
                <div className="text-sm text-muted-foreground">
                  Aucun pantin selectionne.
                </div>
              ) : rotatableMembers.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Aucun membre rotatable.
                </div>
              ) : (
                rotatableMembers.map((member) => (
                  <FieldRow key={member} label={member}>
                    <SmallInput
                      type="number"
                      className="w-20"
                      value={Math.round(memberRotations[member] ?? 0)}
                      onChange={(event) => {
                        if (!selectedSceneItem) {
                          return
                        }
                        const value = Number(event.target.value)
                        if (!Number.isNaN(value)) {
                          dispatch({
                            type: "scene/update-item",
                            itemId: selectedSceneItem.id,
                            patch: {
                              memberRotations: {
                                ...memberRotations,
                                [member]: value,
                              },
                            },
                          })
                        }
                      }}
                    />
                  </FieldRow>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {selectedSceneItem?.kind === "objet" ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Attaches
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <FieldRow label="Pantin">
              <SmallSelect
                value={attachPantin ? String(attachPantin.id) : ""}
                disabled={pantinItems.length === 0}
                onChange={(event) => {
                  const nextId = Number(event.target.value)
                  setAttachPantinId(Number.isNaN(nextId) ? null : nextId)
                }}
              >
                {pantinItems.length === 0 ? (
                  <option value="">Aucun pantin</option>
                ) : (
                  pantinItems.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.label}
                    </option>
                  ))
                )}
              </SmallSelect>
            </FieldRow>
            <FieldRow label="Membre">
              <SmallSelect
                value={attachMember}
                disabled={attachMembers.length === 0}
                onChange={(event) => setAttachMember(event.target.value)}
              >
                {attachMembers.length === 0 ? (
                  <option value="">Aucun membre</option>
                ) : (
                  attachMembers.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))
                )}
              </SmallSelect>
            </FieldRow>
            <div className="flex items-center gap-2">
              <Button size="sm">Attacher</Button>
              <Button variant="ghost" size="sm">Detacher</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
