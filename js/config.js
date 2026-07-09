/* ==========================================================================
   config.js
   Charge la configuration (catégories + indicateurs) et la rend disponible
   au reste de l'application. Au premier chargement, on lit data/config.json.
   Ensuite, la configuration "active" vit dans localStorage, afin que tu
   puisses aussi la modifier depuis l'app (page réglages) sans backend.
   Pour repartir du fichier config.json d'origine : bouton "Réinitialiser
   la configuration" dans la page Réglages, ou vide le localStorage.
   ========================================================================== */

const ConfigStore = (() => {
  const LS_KEY = "lifeTracker.config";

  let cache = null;

  // Types d'indicateurs valides. Pour ajouter un nouveau type, l'enregistrer
  // aussi dans indicators.js (IndicatorTypes).
  const VALID_TYPES = ["boolean", "rating", "number", "text", "select", "duration", "percentage"];

  function validate(config) {
    if (!config || !Array.isArray(config.categories) || !Array.isArray(config.indicators)) {
      throw new Error("Configuration invalide : 'categories' et 'indicators' doivent être des tableaux.");
    }
    const catIds = new Set(config.categories.map(c => c.id));
    config.indicators.forEach(ind => {
      if (!ind.id || !ind.name || !ind.type) {
        throw new Error(`Indicateur invalide (id/name/type manquant) : ${JSON.stringify(ind)}`);
      }
      if (!VALID_TYPES.includes(ind.type)) {
        throw new Error(`Type d'indicateur inconnu "${ind.type}" pour "${ind.id}".`);
      }
      if (!catIds.has(ind.category)) {
        throw new Error(`L'indicateur "${ind.id}" référence une catégorie inexistante "${ind.category}".`);
      }
    });
    return true;
  }

  async function loadDefaultFromFile() {
    const res = await fetch("data/config.json");
    if (!res.ok) throw new Error("Impossible de charger data/config.json");
    return res.json();
  }

  async function load() {
    if (cache) return cache;
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        validate(parsed);
        cache = parsed;
        return cache;
      } catch (e) {
        console.warn("Config locale invalide, retour à data/config.json :", e.message);
      }
    }
    const fromFile = await loadDefaultFromFile();
    validate(fromFile);
    cache = fromFile;
    localStorage.setItem(LS_KEY, JSON.stringify(fromFile));
    return cache;
  }

  function save(config) {
    validate(config);
    cache = config;
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  }

  async function resetToFile() {
    const fromFile = await loadDefaultFromFile();
    save(fromFile);
    return fromFile;
  }

  function get() {
    return cache;
  }

  // Helpers de lecture pratiques
  function getIndicators() {
    return [...cache.indicators].sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  function getCategories() {
    return [...cache.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  function getIndicator(id) {
    return cache.indicators.find(i => i.id === id);
  }
  function getCategory(id) {
    return cache.categories.find(c => c.id === id);
  }
  function getIndicatorsByCategory(catId) {
    return getIndicators().filter(i => i.category === catId);
  }

  return {
    load, save, resetToFile, get, validate,
    getIndicators, getCategories, getIndicator, getCategory, getIndicatorsByCategory,
    VALID_TYPES
  };
})();
