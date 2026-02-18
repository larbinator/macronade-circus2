"""Services d'interpolation et de navigation de timeline."""

from __future__ import annotations

from dataclasses import replace

from .models import KeyframeSnapshot, SceneItem, SceneSnapshot, Timeline


def _lerp(start: float, end: float, t: float) -> float:
    """Interpoler linéairement entre deux valeurs."""
    return start + (end - start) * t


def _lerp_angle(start: float, end: float, t: float) -> float:
    """Interpoler des angles en prenant le plus court chemin circulaire."""
    delta = (((end - start) % 360.0) + 540.0) % 360.0 - 180.0
    return start + delta * t


def _interpolate_item(base: SceneItem, other: SceneItem, t: float) -> SceneItem:
    """Interpoler un item de scène entre deux keyframes."""
    return replace(
        base,
        x=_lerp(base.x, other.x, t),
        y=_lerp(base.y, other.y, t),
        scale=_lerp(base.scale, other.scale, t),
        rotation=_lerp_angle(base.rotation, other.rotation, t),
    )


def interpolate_snapshot(
    prev: KeyframeSnapshot,
    nxt: KeyframeSnapshot,
    t: float,
) -> KeyframeSnapshot:
    """Calcule un snapshot intermédiaire entre deux keyframes."""
    other_map = {item.item_id: item for item in nxt.scene.items}
    items = [
        _interpolate_item(item, other_map[item.item_id], t)
        if item.item_id in other_map
        else replace(item)
        for item in prev.scene.items
    ]
    return KeyframeSnapshot(
        scene=SceneSnapshot(
            background_path=prev.scene.background_path,
            background_size=prev.scene.background_size,
            items=items,
        ),
        layers=[replace(layer) for layer in prev.layers],
        active_layer_id=prev.active_layer_id,
    )


def snapshot_at_frame(timeline: Timeline, frame: int) -> KeyframeSnapshot | None:
    """Retourne l'état de la scène pour une frame donnée avec interpolation."""
    if not timeline.keyframe_states:
        return None
    if frame in timeline.keyframe_states:
        return timeline.keyframe_states[frame]

    keyframes = sorted(set(timeline.keyframes))
    before = [key for key in keyframes if key < frame]
    after = [key for key in keyframes if key > frame]
    if not before:
        return timeline.keyframe_states[keyframes[0]]
    if not after:
        return timeline.keyframe_states[keyframes[-1]]

    prev_frame = before[-1]
    next_frame = after[0]
    prev_snapshot = timeline.keyframe_states[prev_frame]
    next_snapshot = timeline.keyframe_states[next_frame]
    ratio = (frame - prev_frame) / (next_frame - prev_frame)
    return interpolate_snapshot(prev_snapshot, next_snapshot, ratio)


def jump_prev_keyframe(timeline: Timeline, frame: int) -> int:
    """Trouve la keyframe précédente (ou la même si aucune)."""
    prev = [key for key in timeline.keyframes if key < frame]
    return prev[-1] if prev else frame


def jump_next_keyframe(timeline: Timeline, frame: int) -> int:
    """Trouve la keyframe suivante (ou la même si aucune)."""
    nxt = [key for key in timeline.keyframes if key > frame]
    return nxt[0] if nxt else frame
