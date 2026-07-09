/* ==========================================================================
   indicators.js
   Un seul endroit définit comment chaque TYPE d'indicateur s'affiche et se
   saisit, en mode compact (tableau/ledger) et en mode formulaire (saisie
   du jour). Pour ajouter un nouveau type d'indicateur à toute
   l'application, il suffit d'ajouter une entrée ici + dans
   ConfigStore.VALID_TYPES.

   Chaque type expose :
   - renderCompact(value, onChange) -> HTMLElement (utilisé dans le tableau)
   - renderForm(indicator, value, onChange) -> HTMLElement (saisie du jour)
   - isComplete(indicator, value) -> bool (compte comme "réussi" pour les stats)
   - numericValue(indicator, value) -> number|null (pour moyennes/graphiques)
   - displayValue(indicator, value) -> string (affichage lisible)
   ========================================================================== */

const IndicatorTypes = {

  boolean: {
    renderCompact(indicator, value, onChange) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stamp" + (value ? " on" : "");
      btn.textContent = value ? "✓" : "";
      btn.title = indicator.name;
      btn.onclick = () => onChange(!value);
      return btn;
    },
    renderForm(indicator, value, onChange) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-big" + (value ? " on" : "");
      btn.textContent = value ? "✓" : "—";
      btn.onclick = () => onChange(!value);
      return btn;
    },
    isComplete: (indicator, value) => value === true,
    numericValue: (indicator, value) => (value ? 1 : 0),
    displayValue: (indicator, value) => (value ? "Oui" : "Non"),
  },

  rating: {
    renderCompact(indicator, value, onChange) {
      const wrap = document.createElement("span");
      wrap.className = "rating-inline";
      const max = indicator.max || 5;
      for (let i = 1; i <= max; i++) {
        const s = document.createElement("span");
        s.className = "star" + (i <= (value || 0) ? " on" : "");
        s.textContent = "★";
        s.onclick = () => onChange(i === value ? 0 : i);
        wrap.appendChild(s);
      }
      return wrap;
    },
    renderForm(indicator, value, onChange) {
      const wrap = document.createElement("span");
      wrap.className = "rating-big";
      const max = indicator.max || 5;
      for (let i = 1; i <= max; i++) {
        const s = document.createElement("span");
        s.className = "star" + (i <= (value || 0) ? " on" : "");
        s.textContent = "★";
        s.onclick = () => onChange(i === value ? 0 : i);
        wrap.appendChild(s);
      }
      return wrap;
    },
    isComplete: (indicator, value) => (value || 0) > 0,
    numericValue: (indicator, value) => value || 0,
    displayValue: (indicator, value) => (value ? `${value}/${indicator.max || 5}` : "—"),
  },

  number: {
    renderCompact(indicator, value, onChange) {
      const input = document.createElement("input");
      input.type = "number";
      input.value = value ?? "";
      input.oninput = () => onChange(input.value === "" ? null : Number(input.value));
      return input;
    },
    renderForm(indicator, value, onChange) {
      const input = document.createElement("input");
      input.type = "number";
      input.value = value ?? "";
      input.oninput = () => onChange(input.value === "" ? null : Number(input.value));
      return input;
    },
    isComplete: (indicator, value) => value !== null && value !== undefined && value !== 0 && value !== "",
    numericValue: (indicator, value) => (value === null || value === undefined ? null : Number(value)),
    displayValue: (indicator, value) => (value === null || value === undefined || value === "" ? "—" : String(value)),
  },

  percentage: {
    renderCompact(indicator, value, onChange) {
      const input = document.createElement("input");
      input.type = "number"; input.min = 0; input.max = 100;
      input.value = value ?? "";
      input.oninput = () => onChange(input.value === "" ? null : Number(input.value));
      return input;
    },
    renderForm(indicator, value, onChange) {
      const input = document.createElement("input");
      input.type = "number"; input.min = 0; input.max = 100;
      input.value = value ?? "";
      input.oninput = () => onChange(input.value === "" ? null : Number(input.value));
      return input;
    },
    isComplete: (indicator, value) => value !== null && value !== undefined && value !== "",
    numericValue: (indicator, value) => (value === null || value === undefined ? null : Number(value)),
    displayValue: (indicator, value) => (value === null || value === undefined || value === "" ? "—" : `${value}%`),
  },

  duration: {
    // stocké en minutes
    renderCompact(indicator, value, onChange) {
      const input = document.createElement("input");
      input.type = "number"; input.min = 0; input.placeholder = "min";
      input.value = value ?? "";
      input.oninput = () => onChange(input.value === "" ? null : Number(input.value));
      return input;
    },
    renderForm(indicator, value, onChange) {
      const input = document.createElement("input");
      input.type = "number"; input.min = 0; input.placeholder = "minutes";
      input.value = value ?? "";
      input.oninput = () => onChange(input.value === "" ? null : Number(input.value));
      return input;
    },
    isComplete: (indicator, value) => value !== null && value !== undefined && value > 0,
    numericValue: (indicator, value) => (value === null || value === undefined ? null : Number(value)),
    displayValue: (indicator, value) => {
      if (!value) return "—";
      const h = Math.floor(value / 60), m = value % 60;
      return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
    },
  },

  select: {
    renderCompact(indicator, value, onChange) {
      const select = document.createElement("select");
      const opts = indicator.options || [];
      select.appendChild(new Option("—", ""));
      opts.forEach(o => select.appendChild(new Option(o, o, false, o === value)));
      select.value = value || "";
      select.onchange = () => onChange(select.value || null);
      return select;
    },
    renderForm(indicator, value, onChange) {
      return IndicatorTypes.select.renderCompact(indicator, value, onChange);
    },
    isComplete: (indicator, value) => !!value,
    numericValue: () => null,
    displayValue: (indicator, value) => value || "—",
  },

  text: {
    renderCompact(indicator, value, onChange) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = value || "";
      input.placeholder = "…";
      input.oninput = () => onChange(input.value);
      return input;
    },
    renderForm(indicator, value, onChange) {
      const ta = document.createElement("textarea");
      ta.value = value || "";
      ta.placeholder = "Écris librement…";
      ta.oninput = () => onChange(ta.value);
      return ta;
    },
    isComplete: (indicator, value) => !!(value && value.trim()),
    numericValue: () => null,
    displayValue: (indicator, value) => value || "—",
  },
};

function getIndicatorType(indicator) {
  return IndicatorTypes[indicator.type];
}
