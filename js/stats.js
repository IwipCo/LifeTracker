/* ==========================================================================
   stats.js
   Toutes les fonctions de calcul statistique. Elles prennent en entrée les
   entries (DataStore.getEntries()) et la config (ConfigStore.get()) et
   renvoient des objets simples, faciles à afficher ou à passer à charts.js.
   ========================================================================== */

const Stats = (() => {

  function indicatorSuccess(indicator, entries, dateStr) {
    const entry = entries[dateStr];
    if (!entry || !(indicator.id in entry)) return false;
    return getIndicatorType(indicator).isComplete(indicator, entry[indicator.id]);
  }

  // ---- Statistiques par indicateur (total, %, streak actuel, meilleur streak) ----
  function indicatorStats(indicator, entries) {
    const dates = Object.keys(entries).sort();
    let total = 0, success = 0;
    let currentStreak = 0, bestStreak = 0, running = 0;

    dates.forEach((d, idx) => {
      const has = indicator.id in entries[d];
      if (!has) return;
      total++;
      const ok = getIndicatorType(indicator).isComplete(indicator, entries[d][indicator.id]);
      if (ok) { success++; running++; bestStreak = Math.max(bestStreak, running); }
      else { running = 0; }
    });

    // Streak actuel = en partant d'aujourd'hui (ou dernier jour rempli) en remontant
    let cursor = DateUtils.today();
    let guard = 0;
    while (guard < 3660) {
      const entry = entries[cursor];
      if (!entry || !(indicator.id in entry)) {
        // Jour sans donnée : si c'est aujourd'hui on l'ignore et on continue hier,
        // sinon on arrête le streak.
        if (cursor === DateUtils.today()) { cursor = DateUtils.addDays(cursor, -1); guard++; continue; }
        break;
      }
      const ok = getIndicatorType(indicator).isComplete(indicator, entry[indicator.id]);
      if (!ok) break;
      currentStreak++;
      cursor = DateUtils.addDays(cursor, -1);
      guard++;
    }

    return {
      id: indicator.id,
      name: indicator.name,
      emoji: indicator.emoji,
      total,
      success,
      percent: total ? Math.round((success / total) * 100) : 0,
      currentStreak,
      bestStreak,
    };
  }

  function allIndicatorStats(entries) {
    return ConfigStore.getIndicators().map(ind => indicatorStats(ind, entries));
  }

  // ---- Taux de remplissage d'un jour ----
  function dayFillRate(dateStr, entries) {
    const indicators = ConfigStore.getIndicators();
    const entry = entries[dateStr] || {};
    const filled = indicators.filter(i => i.id in entry && entry[i.id] !== null && entry[i.id] !== "").length;
    return { date: dateStr, filled, total: indicators.length, rate: indicators.length ? Math.round((filled / indicators.length) * 100) : 0 };
  }

  // ---- Agrégat générique sur une liste de dates ----
  function aggregate(dates, entries) {
    const indicators = ConfigStore.getIndicators();
    const fillRates = dates.map(d => dayFillRate(d, entries).rate);
    const avgFill = fillRates.length ? Math.round(fillRates.reduce((a, b) => a + b, 0) / fillRates.length) : 0;

    const perIndicator = indicators.map(ind => {
      const type = getIndicatorType(ind);
      const values = dates.map(d => entries[d]?.[ind.id]).filter(v => v !== undefined && v !== null && v !== "");
      const numeric = values.map(v => type.numericValue(ind, v)).filter(v => v !== null && v !== undefined);
      const successCount = dates.filter(d => indicatorSuccess(ind, entries, d)).length;
      return {
        id: ind.id, name: ind.name, emoji: ind.emoji, type: ind.type,
        filledDays: values.length,
        successCount,
        percent: dates.length ? Math.round((successCount / dates.length) * 100) : 0,
        average: numeric.length ? +(numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(2) : null,
      };
    });

    const ratingIndicator = indicators.find(i => i.type === "rating");
    const avgRating = ratingIndicator
      ? perIndicator.find(p => p.id === ratingIndicator.id)?.average ?? null
      : null;

    return {
      days: dates.length,
      filledDays: dates.filter(d => dayFillRate(d, entries).filled > 0).length,
      avgFillRate: avgFill,
      avgRating,
      perIndicator,
    };
  }

  function weekStats(mondayStr, entries) {
    return { weekStart: mondayStr, ...aggregate(DateUtils.weekDates(mondayStr), entries) };
  }

  function monthStats(year, month, entries) {
    return { year, month, ...aggregate(DateUtils.monthDates(year, month), entries) };
  }

  function yearStats(year, entries) {
    const dates = Object.keys(entries).filter(d => d.startsWith(String(year))).sort();
    return { year, ...aggregate(dates, entries) };
  }

  // ---- Comparaisons ----
  function compare(aggA, aggB) {
    const deltaFill = aggA.avgFillRate - aggB.avgFillRate;
    const perIndicator = aggA.perIndicator.map(pa => {
      const pb = aggB.perIndicator.find(x => x.id === pa.id) || { percent: 0, average: null };
      return {
        id: pa.id, name: pa.name, emoji: pa.emoji,
        percentA: pa.percent, percentB: pb.percent, deltaPercent: pa.percent - pb.percent,
        averageA: pa.average, averageB: pb.average,
        deltaAverage: (pa.average !== null && pb.average !== null) ? +(pa.average - pb.average).toFixed(2) : null,
      };
    });
    return { deltaFill, perIndicator };
  }

  // ---- Classements / records ----
  function mostRegular(entries, n = 5) {
    return [...allIndicatorStats(entries)].filter(s => s.total > 0).sort((a, b) => b.percent - a.percent).slice(0, n);
  }
  function leastRegular(entries, n = 5) {
    return [...allIndicatorStats(entries)].filter(s => s.total > 0).sort((a, b) => a.percent - b.percent).slice(0, n);
  }
  function records(entries) {
    return [...allIndicatorStats(entries)].filter(s => s.total > 0).sort((a, b) => b.bestStreak - a.bestStreak);
  }

  // ---- Recherche dans les commentaires ----
  function searchComments(entries, query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const textIndicators = ConfigStore.getIndicators().filter(i => i.type === "text");
    const results = [];
    Object.entries(entries).forEach(([date, values]) => {
      textIndicators.forEach(ind => {
        const v = values[ind.id];
        if (v && String(v).toLowerCase().includes(q)) {
          results.push({ date, indicator: ind.name, text: v });
        }
      });
    });
    return results.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  // ---- Progression du mois en cours ----
  function monthProgress(year, month, entries) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayD = DateUtils.fromStr(DateUtils.today());
    const isCurrent = todayD.getFullYear() === year && todayD.getMonth() === month;
    const dayOfMonth = isCurrent ? todayD.getDate() : daysInMonth;
    return { dayOfMonth, daysInMonth, percent: Math.round((dayOfMonth / daysInMonth) * 100), isCurrent };
  }

  return {
    indicatorStats, allIndicatorStats, dayFillRate, aggregate,
    weekStats, monthStats, yearStats, compare,
    mostRegular, leastRegular, records, searchComments, monthProgress,
  };
})();
