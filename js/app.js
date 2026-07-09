/* ==========================================================================
   app.js — page principale (index.html) : saisie rapide du jour + tableau
   (ledger) de la semaine ou du mois pour vue d'ensemble et édition en ligne.
   ========================================================================== */

(async function () {
  await ConfigStore.load();
  UI.initTheme();

  let selectedDate = DateUtils.today();
  let periodView = "week"; // "week" | "month"

  const dayFormEl = document.getElementById("day-form");
  const dayLabelEl = document.getElementById("day-label");
  const ledgerEl = document.getElementById("ledger-wrap");
  const periodLabelEl = document.getElementById("period-label");
  const fillBadgeEl = document.getElementById("fill-badge");

  // ---------------- Rendu du formulaire du jour ----------------
  function renderDayForm() {
    dayLabelEl.textContent = DateUtils.formatLong(selectedDate);
    const isToday = selectedDate === DateUtils.today();
    document.getElementById("btn-today").classList.toggle("btn-primary", !isToday);

    const entry = DataStore.getEntry(selectedDate);
    const fav = new Set(DataStore.getFavorites());
    dayFormEl.innerHTML = "";

    const categories = ConfigStore.getCategories();
    // Favoris d'abord, dans un bloc dédié, si il y en a pour ce jour
    const favIndicators = ConfigStore.getIndicators().filter(i => fav.has(i.id));
    if (favIndicators.length) {
      dayFormEl.appendChild(buildCategoryBlock({ id: "_fav", name: "Favoris", emoji: "⭐", color: "var(--accent)" }, favIndicators, entry));
    }
    categories.forEach(cat => {
      const inds = ConfigStore.getIndicatorsByCategory(cat.id);
      if (inds.length) dayFormEl.appendChild(buildCategoryBlock(cat, inds, entry));
    });

    const rate = Stats.dayFillRate(selectedDate, DataStore.getEntries());
    fillBadgeEl.textContent = `${rate.filled}/${rate.total} renseignés · ${rate.rate}%`;
  }

  function buildCategoryBlock(cat, indicators, entry) {
    const block = UI.el("div", { class: "category-block" });
    block.appendChild(UI.el("div", { class: "category-title", style: `background:${cat.color || "var(--accent)"}` }, `${cat.emoji || ""} ${cat.name}`));
    indicators.forEach(ind => {
      const value = entry[ind.id];
      const fav = new Set(DataStore.getFavorites());
      const row = UI.el("div", { class: "indicator-row" });
      const label = UI.el("span", { class: "label" }, [
        UI.el("span", { class: "badge-favorite", title: "Favori", onclick: () => { DataStore.toggleFavorite(ind.id); renderDayForm(); } }, fav.has(ind.id) ? "★" : "☆"),
        UI.el("span", {}, `${ind.emoji || ""} ${ind.name}`),
      ]);
      const control = getIndicatorType(ind).renderForm(ind, value, (newVal) => {
        DataStore.setValue(selectedDate, ind.id, newVal);
        renderDayForm();
        renderLedger();
      });
      row.appendChild(label);
      row.appendChild(control);
      block.appendChild(row);
    });
    return block;
  }

  // ---------------- Rendu du tableau (ledger) ----------------
  function renderLedger() {
    const dates = periodView === "week"
      ? DateUtils.weekDates(DateUtils.startOfWeek(selectedDate))
      : DateUtils.monthDates(DateUtils.fromStr(selectedDate).getFullYear(), DateUtils.fromStr(selectedDate).getMonth());

    periodLabelEl.textContent = periodView === "week"
      ? `Semaine du ${DateUtils.formatShort(dates[0])}`
      : DateUtils.monthLabel(DateUtils.fromStr(selectedDate).getFullYear(), DateUtils.fromStr(selectedDate).getMonth());

    const indicators = ConfigStore.getIndicators();
    const entries = DataStore.getEntries();

    const table = UI.el("table", { class: "ledger" });
    const thead = UI.el("tr");
    thead.appendChild(UI.el("th", {}, "Jour"));
    indicators.forEach(ind => thead.appendChild(UI.el("th", { title: ind.name }, `${ind.emoji || ""}`)));
    table.appendChild(UI.el("thead", {}, thead));

    const tbody = UI.el("tbody");
    dates.forEach(d => {
      const tr = UI.el("tr", {
        class: [d === DateUtils.today() ? "is-today" : "", DateUtils.isWeekend(d) ? "is-weekend" : ""].join(" "),
      });
      const dayCell = UI.el("td", { class: "day-cell", onclick: () => selectDate(d) }, DateUtils.formatShort(d));
      tr.appendChild(dayCell);
      const entry = entries[d] || {};
      indicators.forEach(ind => {
        const td = UI.el("td");
        const control = getIndicatorType(ind).renderCompact(ind, entry[ind.id], (newVal) => {
          DataStore.setValue(d, ind.id, newVal);
          if (d === selectedDate) renderDayForm();
          renderLedger();
        });
        td.appendChild(control);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    ledgerEl.innerHTML = "";
    ledgerEl.appendChild(table);
  }

  function selectDate(d) {
    selectedDate = d;
    renderDayForm();
    renderLedger();
  }

  // ---------------- Navigation ----------------
  document.getElementById("btn-prev-day").onclick = () => selectDate(DateUtils.addDays(selectedDate, -1));
  document.getElementById("btn-next-day").onclick = () => selectDate(DateUtils.addDays(selectedDate, 1));
  document.getElementById("btn-today").onclick = () => selectDate(DateUtils.today());

  document.getElementById("btn-prev-period").onclick = () => {
    selectedDate = periodView === "week" ? DateUtils.addDays(selectedDate, -7) : shiftMonth(selectedDate, -1);
    renderLedger();
  };
  document.getElementById("btn-next-period").onclick = () => {
    selectedDate = periodView === "week" ? DateUtils.addDays(selectedDate, 7) : shiftMonth(selectedDate, 1);
    renderLedger();
  };
  function shiftMonth(dateStr, delta) {
    const d = DateUtils.fromStr(dateStr);
    return DateUtils.toStr(new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.onclick = () => {
      periodView = btn.dataset.view;
      document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b === btn));
      renderLedger();
    };
  });

  document.getElementById("btn-duplicate").onclick = () => {
    const yesterday = DateUtils.addDays(selectedDate, -1);
    DataStore.duplicateDay(yesterday, selectedDate);
    renderDayForm(); renderLedger();
    UI.toast("Journée dupliquée depuis la veille.");
  };

  document.getElementById("theme-toggle").onclick = UI.toggleTheme;

  renderDayForm();
  renderLedger();
})();
