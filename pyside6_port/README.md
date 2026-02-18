# Portage PySide6 (Qt 6.10)

Ce répertoire contient un portage Python/PySide6 de l'application Macronade.

## Objectifs du portage

- Réutiliser le format de projet JSON existant (`projet-macronade.json`).
- Réutiliser directement les assets déjà présents dans `public/` (sans dupliquer les `.png`).
- Fournir une interface desktop native avec PySide6 6.10.

## Prérequis

- Python 3.11+
- PySide6 6.10.x

Installation rapide :

```bash
python -m pip install -e ./pyside6_port
```

## Lancer l'application

Depuis la racine du dépôt :

```bash
python -m macronade_pyside6 --project ./projet-macronade.json --assets ./public
```

## Ce qui est porté

- Chargement/sauvegarde du projet JSON.
- Timeline (navigation frame par frame + interpolation entre keyframes).
- Vue de scène (fond + objets/pantins SVG/PNG).
- Liste des calques et sélection.
- Panneau inspecteur simplifié (position, échelle, rotation).

## Limites connues

- Le rigging fin des pantins (manipulation os par os) n'est pas encore exposé dans l'UI.
- Les variantes de membres sont conservées dans le modèle mais ne sont pas encore éditables.

