/* ==========================================================================
   dashboard.js — page de statistiques : agrégats jour/semaine/mois/année,
   comparaisons, graphiques et classements.
   ========================================================================== */

(async function () {
  await ConfigStore.load();
  UI.initTheme();

  const now = DateUtils.fromStr(DateUtils.today());
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  const yearSelect = document.getElementById("year-select");
  const monthSelect = document.getElementById("month-select");
  populateSelectors();

  function populateSelectors() {
    const entries = DataStore.getEntries();
    const years = new Set([now.getFullYear()]);
    Object.keys(entries).forEach(d => years.add(Number(d.slice(0, 4))));
    yearSelect.innerHTML = "";
    [...years].sort((a, b) => b - a).forEach(y => yearSelect.appendChild(new Option(y, y, false, y === viewYear)));
    monthSelect.innerHTML = "";
    DateUtils.MONTH_NAMES.forEach((m, i) => monthSelect.appendChild(new Option(m, i, false, i === viewMonth)));
  }

  yearSelect.onchange = () => { viewYear = Number(yearSelect.value); renderAll(); };
  monthSelect.onchange = () => { viewMonth = Number(monthSelect.value); renderAll(); };

  function renderAll() {
    const entries = DataStore.getEntries();
    const monthAgg = Stats.monthStats(viewYear, viewMonth, entries);
    const prevMonthDate = new Date(viewYear, viewMonth - 1, 1);
    const prevMonthAgg = Stats.monthStats(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), entries);
    const yearAgg = Stats.yearStats(viewYear, entries);
    const prevYearAgg = Stats.yearStats(viewYear - 1, entries);

    renderTopCards(monthAgg, prevMonthAgg);
    renderHeatmap(entries);
    renderMonthBar(entries);
    renderRadar(monthAgg);
    renderDonut(monthAgg);
    renderRatingLine(entries);
    renderIndicatorTable(entries);
    renderRankings(entries);
    renderComparisons(monthAgg, prevMonthAgg, "vs mois précédent", "cmp-month");
    renderComparisons(yearAgg, prevYearAgg, "vs année précédente", "cmp-year");
  }

  function renderTopCards(monthAgg, prevMonthAgg) {
    const progress = Stats.monthProgress(viewYear, viewMonth, DataStore.getEntries());
    const deltaFill = monthAgg.avgFillRate - prevMonthAgg.avgFillRate;
    const wrap = document.getElementById("top-cards");
    wrap.innerHTML = "";
    const cards = [
      { label: "Taux de remplissage moyen", value: `${monthAgg.avgFillRate}%`, delta: deltaFill },
      { label: "Note moyenne", value: monthAgg.avgRating !== null ? monthAgg.avgRating : "—" },
      { label: "Jours remplis", value: `${monthAgg.filledDays}/${monthAgg.days}` },
      { label: "Progression du mois", value: `${progress.dayOfMonth}/${progress.daysInMonth}j (${progress.percent}%)` },
    ];
    cards.forEach(c => {
      const card = UI.el("div", { class: "stat-card" }, [
        UI.el("div", { class: "stat-value" }, String(c.value)),
        UI.el("div", { class: "stat-label" }, c.label),
        c.delta !== undefined ? UI.el("div", { class: "stat-delta " + (c.delta >= 0 ? "up" : "down") }, `${c.delta >= 0 ? "▲" : "▼"} ${Math.abs(c.delta)} pts vs mois préc.`) : null,
      ]);
      wrap.appendChild(card);
    });
  }

  function renderHeatmap(entries) {
    Charts.heatmapCalendar(document.getElementById("heatmap"), viewYear, entries);
  }

  function renderMonthBar(entries) {
    const dates = DateUtils.monthDates(viewYear, viewMonth);
    const values = dates.map(d => Stats.dayFillRate(d, entries).rate);
    const labels = dates.map(d => String(DateUtils.fromStr(d).getDate()));
    Charts.barChart(document.getElementById("month-bar"), labels, values, { max: 100, showAllLabels: false });
  }

  function renderRadar(monthAgg) {
    const cats = ConfigStore.getCategories();
    const labels = cats.map(c => `${c.emoji || ""} ${c.name}`);
    const values = cats.map(c => {
      const inds = ConfigStore.getIndicatorsByCategory(c.id).map(i => i.id);
      const rows = monthAgg.perIndicator.filter(p => inds.includes(p.id));
      if (!rows.length) return 0;
      return Math.round(rows.reduce((a, b) => a + b.percent, 0) / rows.length);
    });
    Charts.radarChart(document.getElementById("radar"), labels, values);
  }

  function renderDonut(monthAgg) {
    const cats = ConfigStore.getCategories();
    const labels = cats.map(c => c.name);
    const values = cats.map(c => {
      const inds = ConfigStore.getIndicatorsByCategory(c.id).map(i => i.id);
      return monthAgg.perIndicator.filter(p => inds.includes(p.id)).reduce((a, b) => a + b.successCount, 0);
    });
    const colors = cats.map(c => c.color || "#3d6b62");
    Charts.donutChart(document.getElementById("donut"), labels, values, colors);
    const legend = document.getElementById("donut-legend");
    legend.innerHTML = "";
    cats.forEach((c, i) => {
      legend.appendChild(UI.el("span", { class: "item" }, [
        UI.el("span", { class: "swatch", style: `background:${colors[i]}` }),
        `${c.name} (${values[i]})`,
      ]));
    });
  }

  function renderRatingLine(entries) {
    const ratingIndicator = ConfigStore.getIndicators().find(i => i.type === "rating");
    const el = document.getElementById("rating-line");
    if (!ratingIndicator) { el.parentElement.style.display = "none"; return; }
    const dates = DateUtils.monthDates(viewYear, viewMonth);
    const values = dates.map(d => entries[d]?.[ratingIndicator.id] ?? null);
    const labels = dates.map(d => String(DateUtils.fromStr(d).getDate()));
    Charts.lineChart(el, labels, values, { max: ratingIndicator.max || 5 });
  }

  function renderIndicatorTable(entries) {
    const stats = Stats.allIndicatorStats(entries);
    const tbody = document.getElementById("indicator-table-body");
    tbody.innerHTML = "";
    stats.forEach(s => {
      tbody.appendChild(UI.el("tr", {}, [
        UI.el("td", {}, `${s.emoji || ""} ${s.name}`),
        UI.el("td", { class: "mono" }, `${s.percent}%`),
        UI.el("td", { class: "mono" }, String(s.success)),
        UI.el("td", { class: "mono" }, String(s.currentStreak)),
        UI.el("td", { class: "mono" }, String(s.bestStreak)),
      ]));
    });
  }

  function renderRankings(entries) {
    fillList("most-regular", Stats.mostRegular(entries), s => `${s.percent}%`);
    fillList("least-regular", Stats.leastRegular(entries), s => `${s.percent}%`);
    fillList("records", Stats.records(entries).slice(0, 5), s => `${s.bestStreak}j`);
  }
  function fillList(elId, items, valueFn) {
    const el = document.getElementById(elId);
    el.innerHTML = "";
    if (!items.length) { el.appendChild(UI.el("li", { class: "subtitle" }, "Pas encore de données.")); return; }
    items.forEach(s => el.appendChild(UI.el("li", {}, `${s.emoji || ""} ${s.name} — ${valueFn(s)}`)));
  }

  function renderComparisons(aggA, aggB, label, tbodyId) {
    const cmp = Stats.compare(aggA, aggB);
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = "";
    document.getElementById(tbodyId + "-label").textContent = label;
    cmp.perIndicator.forEach(row => {
      if (row.percentA === 0 && row.percentB === 0) return;
      tbody.appendChild(UI.el("tr", {}, [
        UI.el("td", {}, `${row.emoji || ""} ${row.name}`),
        UI.el("td", { class: "mono" }, `${row.percentA}%`),
        UI.el("td", { class: "mono" }, `${row.percentB}%`),
        UI.el("td", { class: "mono " + (row.deltaPercent >= 0 ? "" : "") }, `${row.deltaPercent >= 0 ? "+" : ""}${row.deltaPercent} pts`),
      ]));
    });
  }

  // ---------------- Recherche dans les commentaires ----------------
  document.getElementById("search-input").oninput = (e) => {
    const results = Stats.searchComments(DataStore.getEntries(), e.target.value);
    const el = document.getElementById("search-results");
    el.innerHTML = "";
    results.slice(0, 30).forEach(r => {
      el.appendChild(UI.el("div", { class: "hr" }));
      el.appendChild(UI.el("div", {}, [
        UI.el("span", { class: "mono", style: "color:var(--accent)" }, r.date + " "),
        UI.el("span", {}, r.text),
      ]));
    });
  };

  document.getElementById("theme-toggle").onclick = UI.toggleTheme;

  renderAll();
})();
