https://iwipco.github.io/LifeTracker/

# Life Tracker

Tracker d'habitudes personnel : une page web unique (HTML/CSS/JS, sans framework, sans backend), pensée pour être hébergée gratuitement sur **GitHub Pages** et synchronisée via un **dépôt GitHub séparé** qui ne contient que les données.

Aucune dépendance externe, aucun compte à créer, aucun serveur à maintenir. Les données vivent dans le `localStorage` du navigateur et, en option, dans un fichier `data.json` sur un dépôt GitHub privé.

---

## Fonctionnalités

- **Vue Jour** (par défaut) : liste à cocher du jour, note d'humeur ⭐/5, commentaire libre, raccourci « Dupliquer hier/la veille »
- **Vue Semaine** : grille 7 jours + comparaison automatique avec la semaine précédente
- **Vue Mois** : grille du mois (ou 30 derniers jours) + jauge de progression du mois en cours
- **Heatmap annuelle** façon GitHub : une ou plusieurs années empilées, avec repères jours/mois, par activité ou en moyenne sur toutes les activités
- **Statistiques** : vue d'ensemble du mois, comparaison avec le mois précédent, comparaison entre années pour un mois donné
- **Catégories & activités** : couleur par catégorie (reprise dans toute l'app), objectif par activité (tous les jours / X fois par semaine / X fois par mois)
- **Import Notion** : import ponctuel depuis un export CSV, mapping des colonnes vers activités/note/commentaire, inversion de logique par colonne
- **Synchronisation GitHub automatique** : sauvegarde après chaque modification, détection de conflit (édition depuis deux appareils), lien de configuration pour transférer les paramètres vers un autre appareil
- **Mode nuit** par défaut, bascule vers le mode jour
- **Installable comme une app** (PWA) sur iPhone, Android, et ordinateur

---

## Démarrage rapide

### 1. Héberger l'application

Le plus simple est **GitHub Pages** :

1. Crée un dépôt GitHub (public ou privé) pour le **code**, par exemple `life-tracker`
2. Dépose-y les 6 fichiers de ce dossier (`index.html`, `app.js`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`)
3. Dans les paramètres du dépôt → *Pages*, active GitHub Pages sur la branche principale
4. L'app est accessible à `https://<ton-pseudo>.github.io/life-tracker/`

Tu peux aussi simplement ouvrir `index.html` en local pour tester, ou l'héberger sur n'importe quel hébergement statique.

### 2. Créer le dépôt de données (optionnel mais recommandé)

Pour ne pas perdre tes données et les retrouver sur plusieurs appareils :

1. Crée un **second dépôt GitHub, séparé du code** (ex: `life-tracker-data`), idéalement **privé**
2. Ajoute-y un fichier `data.json` contenant simplement `{}`
3. Génère un **token GitHub fine-grained** (Settings → Developer settings → Personal access tokens → Fine-grained tokens) :
   - Repository access : uniquement ce dépôt de données
   - Permissions : Contents → **Read and write**
4. Dans l'app, onglet **Paramètres**, renseigne :
   - Propriétaire (ton pseudo GitHub)
   - Dépôt (`life-tracker-data`)
   - Branche (`main` en général)
   - Chemin du fichier (`data.json`)
   - Le token généré ci-dessus
5. Clique sur *Enregistrer la config* — la sauvegarde se fait automatiquement après chaque modification

> Le token n'a accès qu'au dépôt de données, jamais au code. Le code de l'app (public sur GitHub Pages) ne contient jamais de token ni de donnée personnelle : tout est stocké séparément, uniquement dans ton `localStorage` et ton dépôt de données privé.

### 3. Importer un historique existant (optionnel)

Si tu as déjà un tracker sur Notion :

1. Crée d'abord tes catégories et activités dans l'app (onglet Paramètres)
2. Dans Notion, exporte ta base en CSV (••• → Export → Markdown & CSV)
3. Dans l'app, section *Importer un historique depuis Notion* (dans Paramètres), colle ou importe le fichier CSV
4. Associe chaque colonne à une activité (ou à la note du jour / au commentaire), ajuste l'inversion si besoin par colonne
5. Vérifie l'aperçu avant de confirmer l'import

C'est un import pensé pour être fait **une seule fois**.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page + tous les styles (CSS inline) |
| `app.js` | Toute la logique de l'application |
| `manifest.json` | Manifeste PWA (nom, icônes, couleurs) |
| `sw.js` | Service worker (mise en cache pour l'usage hors-ligne, stratégie réseau d'abord) |
| `icon-192.png`, `icon-512.png` | Icônes de l'app |

---

## Modèle de données

Les données (catégories, activités, historique) sont stockées dans un seul objet JSON :

```json
{
  "categories": [
    { "id": "…", "name": "Santé", "color": "#1F6F5C" }
  ],
  "activities": [
    {
      "id": "…",
      "name": "Sport",
      "categoryId": "…",
      "target": { "type": "weekly", "count": 3 }
    }
  ],
  "entries": {
    "2026-08-19": {
      "checks": { "activityId1": true, "activityId2": false },
      "note": 4,
      "comment": "Bonne journée"
    }
  }
}
```

- `target.type` peut être `"daily"`, `"weekly"` ou `"monthly"` — les taux de complétion affichés partout dans l'app sont calculés par rapport à cet objectif, pas seulement sur une base 7j/7
- `note` est une note globale du jour (1 à 5), pas une note par activité
- Les catégories et activités ne sont **jamais** codées en dur dans le code : elles vivent uniquement dans ce fichier de données (local + dépôt GitHub privé)

---

## Limites connues

- Pas de multi-utilisateur : une instance = une personne (ou alors un seul jeu de données partagé)
- L'import Notion attend un CSV avec une ligne par jour et une colonne par activité ; une base Notion structurée autrement (une ligne par coche) doit être re-pivotée avant import (tableau croisé dynamique dans un tableur, par exemple)
- La résolution de conflit de synchronisation est manuelle (l'app avertit, mais ne fusionne pas automatiquement deux versions modifiées en parallèle)

---

## Version

Version actuelle affichée dans l'app : voir onglet **Paramètres**, en bas de page.
