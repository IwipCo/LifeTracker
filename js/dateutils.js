/* ==========================================================================
   dateutils.js — petits utilitaires de dates partagés par toute l'app.
   Toutes les dates "métier" sont des chaînes "YYYY-MM-DD" (tri alphabétique
   = tri chronologique, lisible dans le JSON, pas de souci de fuseau horaire).
   ========================================================================== */

const DateUtils = (() => {
  const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  function toStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function fromStr(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function today() { return toStr(new Date()); }

  function addDays(dateStr, n) {
    const d = fromStr(dateStr);
    d.setDate(d.getDate() + n);
    return toStr(d);
  }

  function startOfWeek(dateStr) {
    const d = fromStr(dateStr);
    const dow = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - dow);
    return toStr(d);
  }

  function weekDates(mondayStr) {
    return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
  }

  function monthDates(year, month) {
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => toStr(new Date(year, month, i + 1)));
  }

  function isWeekend(dateStr) {
    const dow = fromStr(dateStr).getDay();
    return dow === 0 || dow === 6;
  }

  function formatShort(dateStr) {
    const d = fromStr(dateStr);
    return `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()}`;
  }

  function formatLong(dateStr) {
    const d = fromStr(dateStr);
    return `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  function monthLabel(year, month) {
    return `${MONTH_NAMES[month]} ${year}`;
  }

  return { DAY_NAMES, MONTH_NAMES, toStr, fromStr, today, addDays, startOfWeek, weekDates, monthDates, isWeekend, formatShort, formatLong, monthLabel };
})();
