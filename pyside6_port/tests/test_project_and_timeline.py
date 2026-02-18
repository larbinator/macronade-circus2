"""Tests unitaires du portage PySide6 (modèle + interpolation)."""

from __future__ import annotations

from macronade_pyside6.models import Project
from macronade_pyside6.timeline_service import (
    jump_next_keyframe,
    jump_prev_keyframe,
    snapshot_at_frame,
)


def _sample_project_dict() -> dict:
    """Construit un mini projet représentant deux keyframes."""
    return {
        "version": 1,
        "timeline": {
            "fps": 24,
            "startFrame": 0,
            "endFrame": 10,
            "currentFrame": 5,
            "keyframes": [0, 10],
            "keyframeStates": {
                "0": {
                    "scene": {
                        "backgroundPath": "/decors/defaut.png",
                        "items": [
                            {
                                "id": 1,
                                "kind": "objet",
                                "label": "Test",
                                "assetPath": "/objets/wow.svg",
                                "x": 10,
                                "y": 10,
                                "scale": 1,
                                "rotation": 0,
                                "width": 100,
                                "height": 60,
                            }
                        ],
                    },
                    "layers": {
                        "items": [
                            {
                                "id": 1,
                                "name": "Test",
                                "visible": True,
                                "locked": False,
                                "kind": "item",
                            }
                        ],
                        "activeLayerId": 1,
                    },
                },
                "10": {
                    "scene": {
                        "backgroundPath": "/decors/defaut.png",
                        "items": [
                            {
                                "id": 1,
                                "kind": "objet",
                                "label": "Test",
                                "assetPath": "/objets/wow.svg",
                                "x": 110,
                                "y": 210,
                                "scale": 2,
                                "rotation": 90,
                                "width": 100,
                                "height": 60,
                            }
                        ],
                    },
                    "layers": {
                        "items": [
                            {
                                "id": 1,
                                "name": "Test",
                                "visible": True,
                                "locked": False,
                                "kind": "item",
                            }
                        ],
                        "activeLayerId": 1,
                    },
                },
            },
        },
    }


def test_roundtrip_project_serialization() -> None:
    """Vérifie qu'une sérialisation/désérialisation garde les keyframes."""
    project = Project.from_dict(_sample_project_dict())
    serialized = project.to_dict()
    assert serialized["timeline"]["keyframes"] == [0, 10]
    assert serialized["timeline"]["keyframeStates"]["0"]["scene"]["items"][0]["x"] == 10.0


def test_interpolated_snapshot() -> None:
    """Vérifie l'interpolation linéaire entre deux keyframes."""
    project = Project.from_dict(_sample_project_dict())
    snapshot = snapshot_at_frame(project.timeline, 5)
    assert snapshot is not None
    item = snapshot.scene.items[0]
    assert item.x == 60.0
    assert item.y == 110.0
    assert item.scale == 1.5


def test_keyframe_navigation() -> None:
    """Vérifie la navigation précédente/suivante sur keyframe."""
    project = Project.from_dict(_sample_project_dict())
    assert jump_prev_keyframe(project.timeline, 8) == 0
    assert jump_next_keyframe(project.timeline, 2) == 10
