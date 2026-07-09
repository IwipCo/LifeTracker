/* ==========================================================================
   csvimport.js — assistant d'import d'un export CSV Notion.
   3 étapes : 1) charger le fichier  2) associer les colonnes aux indicateurs
   3) prévisualiser puis importer. Pensé pour une migration ponctuelle mais
   réutilisable à tout moment.
   ========================================================================== */

(async function () {
  await ConfigStore.load();
  UI.initTheme();
  document.getElementById("theme-toggle").onclick = UI.toggleTheme;

  let csvRows = [];   // tableau de tableaux (lignes brutes, header inclus)
  let mapping = {};   // { columnIndex: indicatorId | "__date__" | "__ignore__" }
  let convertedEntries = {};

  const fileStep = document.getElementById("step-file");
  const mapStep = document.getElementById("step-map");
  const previewStep = document.getElementById("step-preview");

  document.getElementById("btn-pick-csv").onclick = () => {
    UI.pickFile(".csv,text/csv", (content) => {
      csvRows = parseCSV(content);
      if (csvRows.length < 2) { UI.toast("Ce fichier CSV semble vide."); return; }
      renderMappingStep();
    });
  };

  function parseCSV(text) {
    // Parseur simple gérant les guillemets et les virgules internes.
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n" || c === "\r") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          row.push(field); field = "";
          if (row.some(f => f.trim() !== "")) rows.push(row);
          row = [];
        } else field += c;
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function renderMappingStep() {
    fileStep.style.display = "none";
    mapStep.style.display = "block";
    const header = csvRows[0];
    const wrap = document.getElementById("mapping-list");
    wrap.innerHTML = "";
    const indicators = ConfigStore.getIndicators();

    header.forEach((colName, idx) => {
      const row = UI.el("div", { class: "indicator-row" });
      row.appendChild(UI.el("span", { class: "label" }, `Colonne : "${colName || "(sans nom)"}"`));
      const select = document.createElement("select");
      select.appendChild(new Option("Ignorer cette colonne", "__ignore__"));
      select.appendChild(new Option("→ C'est la date du jour", "__date__"));
      indicators.forEach(ind => select.appendChild(new Option(`${ind.emoji || ""} ${ind.name}`, ind.id)));
      // Pré-sélection intelligente basique sur le nom de colonne
      const guess = guessMapping(colName, indicators);
      select.value = guess;
      select.onchange = () => { mapping[idx] = select.value; };
      mapping[idx] = guess;
      row.appendChild(select);
      wrap.appendChild(row);
    });
  }

  function guessMapping(colName, indicators) {
    const n = (colName || "").toLowerCase();
    if (/date|jour/.test(n)) return "__date__";
    const found = indicators.find(i => n.includes(i.name.toLowerCase()) || n.includes(i.id));
    return found ? found.id : "__ignore__";
  }

  document.getElementById("btn-to-preview").onclick = () => {
    const dateCol = Object.entries(mapping).find(([, v]) => v === "__date__");
    if (!dateCol) { UI.toast("Sélectionne quelle colonne contient la date."); return; }
    convertedEntries = convert(dateCol[0]);
    renderPreview();
  };

  function convert(dateColIdx) {
    const entries = {};
    const dataRows = csvRows.slice(1);
    const indicators = ConfigStore.getIndicators();
    dataRows.forEach(r => {
      const rawDate = r[dateColIdx];
      const dateStr = normalizeDate(rawDate);
      if (!dateStr) return;
      const values = {};
      Object.entries(mapping).forEach(([idxStr, indId]) => {
        if (indId === "__ignore__" || indId === "__date__") return;
        const ind = indicators.find(i => i.id === indId);
        if (!ind) return;
        values[indId] = coerceValue(ind, r[Number(idxStr)]);
      });
      entries[dateStr] = values;
    });
    return entries;
  }

  function normalizeDate(raw) {
    if (!raw) return null;
    raw = raw.trim();
    // déjà au format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    // format JJ/MM/AAAA ou JJ-MM-AAAA
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(raw);
    return isNaN(d) ? null : DateUtils.toStr(d);
  }

  function coerceValue(indicator, raw) {
    if (raw === undefined) return undefined;
    const v = raw.trim();
    switch (indicator.type) {
      case "boolean": return /^(oui|yes|true|x|✓|1)$/i.test(v);
      case "rating": case "number": case "percentage": case "duration":
        return v === "" ? null : Number(v.replace(",", "."));
      default: return v;
    }
  }

  function renderPreview() {
    mapStep.style.display = "none";
    previewStep.style.display = "block";
    const dates = Object.keys(convertedEntries).sort();
    document.getElementById("preview-summary").textContent = `${dates.length} jour(s) prêt(s) à être importé(s), du ${dates[0] || "?"} au ${dates[dates.length - 1] || "?"}.`;
    const table = document.getElementById("preview-table");
    table.innerHTML = "";
    const indicators = ConfigStore.getIndicators().filter(i => Object.values(mapping).includes(i.id));
    const head = UI.el("tr", {}, [UI.el("th", {}, "Date"), ...indicators.map(i => UI.el("th", {}, i.emoji || i.name))]);
    table.appendChild(UI.el("thead", {}, head));
    const body = UI.el("tbody");
    dates.slice(0, 15).forEach(d => {
      body.appendChild(UI.el("tr", {}, [
        UI.el("td", { class: "mono" }, d),
        ...indicators.map(i => UI.el("td", {}, getIndicatorType(i).displayValue(i, convertedEntries[d][i.id]))),
      ]));
    });
    table.appendChild(body);
  }

  document.getElementById("btn-confirm-import").onclick = () => {
    const current = DataStore.getEntries();
    Object.entries(convertedEntries).forEach(([date, values]) => {
      DataStore.setEntry(date, values);
    });
    UI.toast(`Import terminé : ${Object.keys(convertedEntries).length} jour(s) importés.`);
    previewStep.style.display = "none";
    document.getElementById("step-done").style.display = "block";
  };

  document.getElementById("btn-restart-import").onclick = () => location.reload();
})();
