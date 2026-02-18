"""Modèles de données partagés pour le portage PySide6."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class Attachment:
    """Représente l'attache d'un objet sur un membre de pantin."""

    pantin_id: int
    member_id: str
    offset_x: float
    offset_y: float


@dataclass(slots=True)
class SceneItem:
    """Représente un élément de la scène animé sur la timeline."""

    item_id: int
    kind: str
    label: str
    asset_path: str
    x: float
    y: float
    scale: float
    rotation: float
    width: float
    height: float
    variants: dict[str, str] = field(default_factory=dict)
    member_rotations: dict[str, float] = field(default_factory=dict)
    attachment: Attachment | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> SceneItem:
        """Construit un item de scène depuis un dictionnaire JSON."""
        attachment_raw = raw.get("attachment")
        attachment = (
            Attachment(
                pantin_id=int(attachment_raw["pantinId"]),
                member_id=str(attachment_raw["memberId"]),
                offset_x=float(attachment_raw["offsetX"]),
                offset_y=float(attachment_raw["offsetY"]),
            )
            if attachment_raw
            else None
        )
        return cls(
            item_id=int(raw["id"]),
            kind=str(raw["kind"]),
            label=str(raw["label"]),
            asset_path=str(raw["assetPath"]),
            x=float(raw["x"]),
            y=float(raw["y"]),
            scale=float(raw["scale"]),
            rotation=float(raw["rotation"]),
            width=float(raw["width"]),
            height=float(raw["height"]),
            variants={str(k): str(v) for k, v in raw.get("variants", {}).items()},
            member_rotations={
                str(k): float(v) for k, v in raw.get("memberRotations", {}).items()
            },
            attachment=attachment,
        )

    def to_dict(self) -> dict[str, Any]:
        """Sérialise l'item vers le format JSON compatible avec le projet source."""
        raw = {
            "id": self.item_id,
            "kind": self.kind,
            "label": self.label,
            "assetPath": self.asset_path,
            "x": self.x,
            "y": self.y,
            "scale": self.scale,
            "rotation": self.rotation,
            "width": self.width,
            "height": self.height,
        }
        if self.variants:
            raw["variants"] = self.variants
        if self.member_rotations:
            raw["memberRotations"] = self.member_rotations
        if self.attachment:
            raw["attachment"] = {
                "pantinId": self.attachment.pantin_id,
                "memberId": self.attachment.member_id,
                "offsetX": self.attachment.offset_x,
                "offsetY": self.attachment.offset_y,
            }
        return raw


@dataclass(slots=True)
class SceneSnapshot:
    """Capture de la scène à un instant de la timeline."""

    background_path: str | None
    background_size: tuple[int, int] | None
    items: list[SceneItem]

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> SceneSnapshot:
        """Construit un snapshot de scène depuis un dictionnaire JSON."""
        size = raw.get("backgroundSize")
        background_size = (int(size["width"]), int(size["height"])) if size else None
        return cls(
            background_path=raw.get("backgroundPath"),
            background_size=background_size,
            items=[SceneItem.from_dict(item) for item in raw.get("items", [])],
        )

    def to_dict(self) -> dict[str, Any]:
        """Sérialise le snapshot de scène vers JSON."""
        raw: dict[str, Any] = {
            "backgroundPath": self.background_path,
            "items": [item.to_dict() for item in self.items],
        }
        if self.background_size:
            raw["backgroundSize"] = {
                "width": self.background_size[0],
                "height": self.background_size[1],
            }
        return raw


@dataclass(slots=True)
class Layer:
    """Décrit un calque affiché dans la pile de rendu."""

    layer_id: int
    name: str
    visible: bool
    locked: bool
    kind: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> Layer:
        """Construit un calque depuis un dictionnaire JSON."""
        return cls(
            layer_id=int(raw["id"]),
            name=str(raw["name"]),
            visible=bool(raw["visible"]),
            locked=bool(raw["locked"]),
            kind=str(raw["kind"]),
        )

    def to_dict(self) -> dict[str, Any]:
        """Sérialise un calque vers JSON."""
        return {
            "id": self.layer_id,
            "name": self.name,
            "visible": self.visible,
            "locked": self.locked,
            "kind": self.kind,
        }


@dataclass(slots=True)
class KeyframeSnapshot:
    """Capture complète (scène + calques) pour une image clé."""

    scene: SceneSnapshot
    layers: list[Layer]
    active_layer_id: int | None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> KeyframeSnapshot:
        """Construit une image clé depuis JSON."""
        layers_raw = raw.get("layers", {})
        return cls(
            scene=SceneSnapshot.from_dict(raw.get("scene", {})),
            layers=[Layer.from_dict(layer) for layer in layers_raw.get("items", [])],
            active_layer_id=layers_raw.get("activeLayerId"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Sérialise l'image clé vers JSON."""
        return {
            "scene": self.scene.to_dict(),
            "layers": {
                "items": [layer.to_dict() for layer in self.layers],
                "activeLayerId": self.active_layer_id,
            },
        }


@dataclass(slots=True)
class Timeline:
    """État global de la timeline."""

    fps: int
    start_frame: int
    end_frame: int
    current_frame: int
    keyframes: list[int]
    keyframe_states: dict[int, KeyframeSnapshot]
    loop_enabled: bool = True


@dataclass(slots=True)
class Project:
    """Représentation Python du fichier de projet Macronade."""

    version: int
    timeline: Timeline

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> Project:
        """Construit le projet depuis un dictionnaire JSON."""
        timeline_raw = raw["timeline"]
        keyframe_states = {
            int(frame): KeyframeSnapshot.from_dict(snapshot)
            for frame, snapshot in timeline_raw.get("keyframeStates", {}).items()
        }
        return cls(
            version=int(raw.get("version", 1)),
            timeline=Timeline(
                fps=int(timeline_raw["fps"]),
                start_frame=int(timeline_raw["startFrame"]),
                end_frame=int(timeline_raw["endFrame"]),
                current_frame=int(timeline_raw["currentFrame"]),
                keyframes=[int(frame) for frame in timeline_raw.get("keyframes", [])],
                keyframe_states=keyframe_states,
                loop_enabled=bool(timeline_raw.get("loopEnabled", True)),
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        """Sérialise le projet vers le format JSON d'origine."""
        timeline = self.timeline
        return {
            "version": self.version,
            "timeline": {
                "fps": timeline.fps,
                "startFrame": timeline.start_frame,
                "endFrame": timeline.end_frame,
                "currentFrame": timeline.current_frame,
                "keyframes": timeline.keyframes,
                "keyframeStates": {
                    str(frame): snapshot.to_dict()
                    for frame, snapshot in sorted(timeline.keyframe_states.items())
                },
                "loopEnabled": timeline.loop_enabled,
            },
        }


def resolve_asset_path(assets_dir: Path, public_style_path: str | None) -> Path | None:
    """Convertit un chemin `/xxx` du projet en chemin disque local."""
    if not public_style_path:
        return None
    clean = public_style_path[1:] if public_style_path.startswith("/") else public_style_path
    path = assets_dir / clean
    return path if path.exists() else None
