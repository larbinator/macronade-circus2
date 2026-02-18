"""Entrées/sorties du projet Macronade pour PySide6."""

from __future__ import annotations

import json
from pathlib import Path

from .models import Project


def load_project(project_path: Path) -> Project:
    """Charge un projet depuis un fichier JSON."""
    with project_path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    return Project.from_dict(raw)


def save_project(project_path: Path, project: Project) -> None:
    """Sauvegarde le projet dans un fichier JSON lisible."""
    with project_path.open("w", encoding="utf-8") as handle:
        json.dump(project.to_dict(), handle, ensure_ascii=False, indent=2)
        handle.write("\n")
