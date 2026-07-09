# 📓 Life Tracker

Application statique (HTML / CSS / JS vanilla) de suivi quotidien d'habitudes,
santé et humeur. Aucune dépendance, aucun serveur, compatible GitHub Pages,
fonctionne hors-ligne une fois chargée.

## Comment lancer l'app

- **En local** : ouvre `index.html` dans un navigateur, ou lance un petit
  serveur (`python3 -m http.server` puis `http://localhost:8000`) — un
  serveur local est recommandé pour que `config.json` se charge correctement
  (certains navigateurs bloquent `fetch()` sur `file://`).
- **Sur GitHub Pages** : pousse tout le dossier sur un repo GitHub, active
  Pages sur la branche principale, et l'app fonctionne telle quelle.

## ⚠️ Important : comment sont stockées les données

Une application 100% statique ne peut pas écrire de fichier sur ton disque
toute seule (il n'y a pas de serveur). Les données quotidiennes vivent donc
dans le **localStorage** de ton navigateur (persistant, propre à cet
appareil/navigateur). C'est ce qui permet la saisie hors-ligne instantanée.

En pratique :
- `data/config.json` est le fichier **source** des indicateurs, lu au tout
  premier chargement puis copié en localStorage (modifiable depuis
  Réglages).
- `data/data.json` est un **exemple** du format de données — l'app ne le lit
  pas automatiquement.
- Pour avoir un vrai fichier JSON/CSV sur ton disque (sauvegarde, partage,
  changement de navigateur…), utilise les boutons **Export** de la page
  *Import / Export*, ou **Sauvegarde complète** dans *Réglages*.
- Pense à exporter régulièrement : vider le cache du navigateur effacerait
  le localStorage.

## Structure du projet

```
index.html        → saisie du jour + tableau (ledger) semaine/mois
dashboard.html     → statistiques, graphiques, comparaisons, classements
import.html        → export JSON/CSV + assistant d'import Notion (CSV)
settings.html       → sauvegarde/restauration, intégrité, édition config

css/style.css       → thème clair/sombre, responsive, tout en variables CSS

js/config.js        → chargement + validation de data/config.json
js/storage.js       → CRUD des données du jour (localStorage), export/import
js/indicators.js    → un "type" = un rendu + une règle de succès (extensible)
js/stats.js         → agrégats, streaks, comparaisons, classements
js/charts.js        → graphiques SVG faits main (heatmap, barres, courbe,
                       radar, donut) — pas de librairie externe
js/dateutils.js      → utilitaires de dates (chaînes "YYYY-MM-DD")
js/common.js        → thème, toasts, helpers DOM
js/app.js            → contrôleur de index.html
js/dashboard.js      → contrôleur de dashboard.html
js/csvimport.js      → contrôleur de l'assistant d'import Notion

data/config.json    → indicateurs & catégories (modifiable sans coder)
data/data.json      → exemple de format de données exportées
```

## Ajouter / modifier un indicateur (sans toucher au code)

Ouvre `data/config.json` (ou la page **Réglages → éditeur de configuration**)
et ajoute une entrée dans `indicators`, par exemple :

```json
{ "id": "sommeil", "name": "Sommeil", "emoji": "😴", "category": "sante",
  "type": "duration", "order": 5, "default": null }
```

Champs disponibles : `id` (unique), `name`, `emoji`, `category` (doit exister
dans `categories`), `type`, `order` (ordre d'affichage), `color` (optionnel),
`default`, et selon le type : `max` (rating), `options` (select).

Types disponibles : `boolean`, `rating`, `number`, `text`, `select`,
`duration` (stocké en minutes), `percentage`.

Depuis Réglages, colle le JSON modifié dans l'éditeur puis clique
**Enregistrer** — aucune réécriture de code nécessaire, et cela vaut aussi
pour ajouter une nouvelle catégorie (`categories`).

## Ajouter un nouveau TYPE d'indicateur

Un seul fichier à toucher : `js/indicators.js`. Ajoute une entrée dans
l'objet `IndicatorTypes` avec les 5 fonctions attendues
(`renderCompact`, `renderForm`, `isComplete`, `numericValue`,
`displayValue` — copie un type existant comme modèle), puis ajoute son nom
dans `VALID_TYPES` (`js/config.js`). Le reste de l'app (tableau, formulaire,
statistiques, graphiques) s'adapte automatiquement.

## Idées d'évolutions déjà prévues par l'architecture

- **Humeur, café, méditation** : ajouter simplement des indicateurs dans
  `config.json` (types `rating` ou `boolean`/`number`).
- **Météo détaillée automatique** : créerait un nouveau petit module
  `js/weather.js` qui appelle une API météo publique et pré-remplit
  l'indicateur du jour — s'intègre sans changer le reste du code, car
  chaque fonctionnalité est indépendante.
- **Nouvelles catégories** : ajout direct dans `config.json`.

## Fonctionnalités incluses

Saisie rapide (jour courant, favoris, duplication de la veille) · tableau
semaine/mois avec édition en ligne · tableau de bord (totaux, %, séries
actuelle/meilleure, taux de remplissage jour/semaine/mois/année) ·
comparaisons (mois précédent, année précédente) · graphiques (heatmap
annuel, histogramme, courbe, radar, donut) · recherche dans les commentaires
· classements (plus/moins régulières, records) · progression du mois ·
import CSV Notion avec association de colonnes · export JSON/CSV ·
sauvegarde/restauration complète · validation d'intégrité · mode clair/sombre
· responsive mobile/tablette/desktop.
