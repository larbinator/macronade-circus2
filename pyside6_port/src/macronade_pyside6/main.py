"""Point d'entrée de l'application PySide6 portées depuis Macronade."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction, QColor, QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import (
    QApplication,
    QDockWidget,
    QFormLayout,
    QGraphicsPixmapItem,
    QGraphicsScene,
    QGraphicsView,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QPushButton,
    QSpinBox,
    QToolBar,
    QVBoxLayout,
    QWidget,
)

from .models import Project, SceneItem, resolve_asset_path
from .project_io import load_project, save_project
from .timeline_service import jump_next_keyframe, jump_prev_keyframe, snapshot_at_frame


class SceneCanvas(QGraphicsView):
    """Widget de rendu 2D de la scène."""

    def __init__(self, project: Project, assets_dir: Path) -> None:
        """Initialise la vue de scène et ses ressources."""
        super().__init__()
        self.project = project
        self.assets_dir = assets_dir
        self.scene_graphics = QGraphicsScene(self)
        self.setScene(self.scene_graphics)
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setBackgroundBrush(QColor("#1f2329"))

    def _asset_to_pixmap(self, scene_item: SceneItem) -> QPixmap | None:
        """Charge un asset (SVG/PNG) en QPixmap."""
        path = resolve_asset_path(self.assets_dir, scene_item.asset_path)
        if path is None:
            return None
        if path.suffix.lower() == ".svg":
            renderer = QSvgRenderer(str(path))
            if not renderer.isValid():
                return None
            target = QPixmap(int(scene_item.width), int(scene_item.height))
            target.fill(Qt.GlobalColor.transparent)
            painter = QPainter(target)
            renderer.render(painter)
            painter.end()
            return target
        pixmap = QPixmap(str(path))
        return pixmap if not pixmap.isNull() else None

    def render_frame(self, frame: int) -> None:
        """Rend la frame demandée dans la scène."""
        self.scene_graphics.clear()
        snapshot = snapshot_at_frame(self.project.timeline, frame)
        if snapshot is None:
            return

        background = resolve_asset_path(self.assets_dir, snapshot.scene.background_path)
        if background is not None:
            bg_pixmap = QPixmap(str(background))
            if not bg_pixmap.isNull():
                self.scene_graphics.addPixmap(bg_pixmap)

        for item in snapshot.scene.items:
            pixmap = self._asset_to_pixmap(item)
            if pixmap is None:
                continue
            element = QGraphicsPixmapItem(pixmap)
            element.setTransformOriginPoint(pixmap.width() / 2, pixmap.height() / 2)
            element.setScale(item.scale)
            element.setRotation(item.rotation)
            element.setPos(item.x, item.y)
            self.scene_graphics.addItem(element)

        self.fitInView(self.scene_graphics.itemsBoundingRect(), Qt.AspectRatioMode.KeepAspectRatio)


class MainWindow(QMainWindow):
    """Fenêtre principale du portage PySide6."""

    def __init__(self, project_path: Path, assets_dir: Path) -> None:
        """Construit la fenêtre, charge le projet et câble les interactions."""
        super().__init__()
        self.project_path = project_path
        self.assets_dir = assets_dir
        self.project = load_project(project_path)

        self.setWindowTitle("Macronade PySide6")
        self.resize(1450, 900)

        self.canvas = SceneCanvas(self.project, self.assets_dir)
        self.setCentralWidget(self.canvas)

        self._init_toolbar()
        self._init_layers_dock()
        self._init_properties_dock()
        self._sync_ui()

    def _init_toolbar(self) -> None:
        """Initialise les contrôles de navigation timeline."""
        toolbar = QToolBar("Timeline")
        self.addToolBar(toolbar)

        prev_action = QAction("◀ Key", self)
        prev_action.triggered.connect(self._on_prev_keyframe)
        toolbar.addAction(prev_action)

        next_action = QAction("Key ▶", self)
        next_action.triggered.connect(self._on_next_keyframe)
        toolbar.addAction(next_action)

        toolbar.addSeparator()
        toolbar.addWidget(QLabel("Frame"))

        self.frame_spin = QSpinBox()
        self.frame_spin.setRange(
            self.project.timeline.start_frame,
            self.project.timeline.end_frame,
        )
        self.frame_spin.valueChanged.connect(self._on_frame_changed)
        toolbar.addWidget(self.frame_spin)

        toolbar.addSeparator()
        save_action = QAction("Sauvegarder", self)
        save_action.triggered.connect(self._on_save_project)
        toolbar.addAction(save_action)

    def _init_layers_dock(self) -> None:
        """Initialise le panneau des calques."""
        dock = QDockWidget("Calques", self)
        panel = QWidget()
        layout = QVBoxLayout(panel)
        self.layers_list = QListWidget()
        layout.addWidget(self.layers_list)
        dock.setWidget(panel)
        self.addDockWidget(Qt.DockWidgetArea.LeftDockWidgetArea, dock)

    def _init_properties_dock(self) -> None:
        """Initialise le panneau d'inspection simplifié."""
        dock = QDockWidget("Inspecteur", self)
        panel = QWidget()
        form = QFormLayout(panel)
        self.label_name = QLabel("-")
        self.label_position = QLabel("-")
        self.label_transform = QLabel("-")
        form.addRow("Nom", self.label_name)
        form.addRow("Position", self.label_position)
        form.addRow("Transformation", self.label_transform)

        self.btn_focus_first = QPushButton("Cibler le premier item")
        self.btn_focus_first.clicked.connect(self._focus_first_item)
        form.addRow(self.btn_focus_first)

        dock.setWidget(panel)
        self.addDockWidget(Qt.DockWidgetArea.RightDockWidgetArea, dock)

    def _on_prev_keyframe(self) -> None:
        """Déplace la lecture à la keyframe précédente."""
        current = self.project.timeline.current_frame
        self.project.timeline.current_frame = jump_prev_keyframe(self.project.timeline, current)
        self._sync_ui()

    def _on_next_keyframe(self) -> None:
        """Déplace la lecture à la keyframe suivante."""
        current = self.project.timeline.current_frame
        self.project.timeline.current_frame = jump_next_keyframe(self.project.timeline, current)
        self._sync_ui()

    def _on_frame_changed(self, frame: int) -> None:
        """Met à jour la frame courante suite à une interaction utilisateur."""
        self.project.timeline.current_frame = frame
        self.canvas.render_frame(frame)

    def _on_save_project(self) -> None:
        """Sauvegarde le projet sur disque."""
        save_project(self.project_path, self.project)

    def _focus_first_item(self) -> None:
        """Affiche rapidement les infos du premier item de la frame active."""
        snapshot = snapshot_at_frame(self.project.timeline, self.project.timeline.current_frame)
        if not snapshot or not snapshot.scene.items:
            self.label_name.setText("(aucun item)")
            self.label_position.setText("-")
            self.label_transform.setText("-")
            return
        item = snapshot.scene.items[0]
        self.label_name.setText(item.label)
        self.label_position.setText(f"x={item.x:.1f}, y={item.y:.1f}")
        self.label_transform.setText(
            f"scale={item.scale:.2f}, rotation={item.rotation:.1f}°"
        )

    def _sync_ui(self) -> None:
        """Synchronise l'ensemble des widgets avec le modèle courant."""
        timeline = self.project.timeline
        blocked = self.frame_spin.blockSignals(True)
        self.frame_spin.setValue(timeline.current_frame)
        self.frame_spin.blockSignals(blocked)

        self.layers_list.clear()
        snapshot = snapshot_at_frame(timeline, timeline.current_frame)
        if snapshot:
            for layer in snapshot.layers:
                item = QListWidgetItem(layer.name)
                if not layer.visible:
                    item.setForeground(QColor("#999999"))
                self.layers_list.addItem(item)

        self.canvas.render_frame(timeline.current_frame)
        self._focus_first_item()


def parse_args(argv: list[str]) -> argparse.Namespace:
    """Parse les arguments CLI de l'application."""
    parser = argparse.ArgumentParser(description="Portage PySide6 de Macronade")
    parser.add_argument("--project", type=Path, required=True, help="Chemin vers le JSON projet")
    parser.add_argument("--assets", type=Path, required=True, help="Chemin du dossier public")
    return parser.parse_args(argv)


def run(argv: list[str] | None = None) -> int:
    """Lance l'application Qt et retourne un code de sortie."""
    args = parse_args(argv or sys.argv[1:])
    app = QApplication(sys.argv)
    window = MainWindow(project_path=args.project, assets_dir=args.assets)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(run())
