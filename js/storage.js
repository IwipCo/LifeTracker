/* ==========================================================================
   storage.js
   Gère les données quotidiennes (une entrée par jour). Comme l'application
   est 100% statique (GitHub Pages), il n'y a pas de serveur pour écrire un
   vrai fichier JSON sur disque : les données vivent dans le localStorage du
   navigateur (persistant, hors-ligne), et tu peux à tout moment les
   exporter vers un vrai fichier .json ou .csv (bouton Exporter), ou
   recharger un fichier exporté précédemment (bouton Importer / Restaurer).
   Format en mémoire, identique au fichier exporté (voir data/data.json) :
   { "entries": { "2026-07-08": { "sport": true, "note_jour": 4, ... } } }
   ========================================================================== */

const DataStore = (() => {
  const LS_KEY = "lifeTracker.data";
  const LS_FAVORITES = "lifeTracker.favorites";

  function _readAll() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { entries: {} };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.entries) parsed.entries = {};
      return parsed;
    } catch {
      return { entries: {} };
    }
  }

  function _writeAll(data) {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  function getEntries() {
    return _readAll().entries;
  }

  function getEntry(dateStr) {
    return _readAll().entries[dateStr] || {};
  }

  function setValue(dateStr, indicatorId, value) {
    const data = _readAll();
    if (!data.entries[dateStr]) data.entries[dateStr] = {};
    data.entries[dateStr][indicatorId] = value;
    _writeAll(data);
  }

  function setEntry(dateStr, values) {
    const data = _readAll();
    data.entries[dateStr] = { ...(data.entries[dateStr] || {}), ...values };
    _writeAll(data);
  }

  function deleteEntry(dateStr) {
    const data = _readAll();
    delete data.entries[dateStr];
    _writeAll(data);
  }

  function duplicateDay(fromDateStr, toDateStr) {
    const source = getEntry(fromDateStr);
    if (!source) return false;
    // On ne duplique pas le commentaire texte libre pour éviter les doublons absurdes.
    const clone = { ...source };
    setEntry(toDateStr, clone);
    return true;
  }

  // ---------------- Favoris (indicateurs épinglés en haut) ----------------
  function getFavorites() {
    try { return JSON.parse(localStorage.getItem(LS_FAVORITES)) || []; }
    catch { return []; }
  }
  function toggleFavorite(indicatorId) {
    const favs = new Set(getFavorites());
    favs.has(indicatorId) ? favs.delete(indicatorId) : favs.add(indicatorId);
    localStorage.setItem(LS_FAVORITES, JSON.stringify([...favs]));
    return favs.has(indicatorId);
  }

  // ---------------- Export / Import ----------------
  function _download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const data = _readAll();
    _download(`life-tracker-data-${todayStr()}.json`, JSON.stringify(data, null, 2), "application/json");
  }

  function exportConfigJSON() {
    _download(`life-tracker-config-${todayStr()}.json`, JSON.stringify(ConfigStore.get(), null, 2), "application/json");
  }

  function exportCSV() {
    const config = ConfigStore.get();
    const indicators = ConfigStore.getIndicators();
    const entries = getEntries();
    const dates = Object.keys(entries).sort();
    const header = ["date", ...indicators.map(i => i.id)];
    const rows = dates.map(d => {
      const e = entries[d];
      return [d, ...indicators.map(i => formatCsvValue(e[i.id]))];
    });
    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    _download(`life-tracker-data-${todayStr()}.csv`, csv, "text/csv");
  }

  function formatCsvValue(v) {
    if (v === undefined || v === null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function importJSON(fileContent) {
    const parsed = JSON.parse(fileContent);
    if (!parsed.entries) throw new Error("Fichier JSON invalide : clé 'entries' manquante.");
    _writeAll(parsed);
  }

  function mergeImportJSON(fileContent) {
    const parsed = JSON.parse(fileContent);
    if (!parsed.entries) throw new Error("Fichier JSON invalide : clé 'entries' manquante.");
    const current = _readAll();
    current.entries = { ...current.entries, ...parsed.entries };
    _writeAll(current);
  }

  // Sauvegarde complète (données + config) en un seul fichier
  function backup() {
    const payload = { data: _readAll(), config: ConfigStore.get(), exportedAt: new Date().toISOString() };
    _download(`life-tracker-backup-${todayStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function restore(fileContent) {
    const parsed = JSON.parse(fileContent);
    if (parsed.data && parsed.data.entries) _writeAll(parsed.data);
    if (parsed.config) ConfigStore.save(parsed.config);
  }

  function validateIntegrity() {
    const errors = [];
    const data = _readAll();
    const indicatorIds = new Set(ConfigStore.getIndicators().map(i => i.id));
    Object.entries(data.entries).forEach(([date, values]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`Date invalide : "${date}"`);
      Object.keys(values).forEach(id => {
        if (!indicatorIds.has(id)) errors.push(`Indicateur inconnu "${id}" dans l'entrée du ${date}`);
      });
    });
    return errors;
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  return {
    getEntries, getEntry, setValue, setEntry, deleteEntry, duplicateDay,
    getFavorites, toggleFavorite,
    exportJSON, exportConfigJSON, exportCSV, importJSON, mergeImportJSON, backup, restore,
    validateIntegrity
  };
})();
