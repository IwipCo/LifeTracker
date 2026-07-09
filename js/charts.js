/* ==========================================================================
   charts.js
   Génère des graphiques en SVG pur (aucune dépendance externe, donc ça
   marche hors-ligne et sur GitHub Pages sans rien installer). Chaque
   fonction reçoit un élément DOM cible et des données déjà calculées
   (voir stats.js), et injecte le SVG dedans.
   ========================================================================== */

const Charts = (() => {

  function svg(tag, attrs = {}, children = []) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    children.forEach(c => el.appendChild(c));
    return el;
  }

  // Calculé à l'appel (et non au chargement du script) pour respecter le
  // thème clair/sombre actif au moment où le graphique est dessiné.
  function accentColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#3d6b62";
  }

  // ---------------- Heatmap annuel (façon GitHub contributions) ----------------
  function heatmapCalendar(container, year, entries, opts = {}) {
    container.innerHTML = "";
    const cell = 12, gap = 3;
    const weeks = 53;
    const width = weeks * (cell + gap) + 30;
    const height = 7 * (cell + gap) + 20;
    const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "chart-svg", width: "100%", height: 130 });

    const jan1 = new Date(year, 0, 1);
    const startOffset = (jan1.getDay() + 6) % 7; // lundi=0

    for (let d = 0; d < 366; d++) {
      const date = new Date(year, 0, 1 + d);
      if (date.getFullYear() !== year) break;
      const dateStr = DateUtils.toStr(date);
      const rate = Stats.dayFillRate(dateStr, entries).rate;
      const col = Math.floor((d + startOffset) / 7);
      const row = (d + startOffset) % 7;
      const opacity = rate === 0 ? 0.08 : 0.25 + (rate / 100) * 0.75;
      const rect = svg("rect", {
        x: col * (cell + gap) + 20, y: row * (cell + gap) + 14,
        width: cell, height: cell, rx: 3,
        fill: accentColor(), opacity: opacity.toFixed(2),
      });
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${dateStr} — ${rate}% rempli`;
      rect.appendChild(title);
      root.appendChild(rect);
    }
    // labels des mois
    for (let m = 0; m < 12; m++) {
      const first = new Date(year, m, 1);
      const dayIndex = Math.floor((first - jan1) / 86400000);
      const col = Math.floor((dayIndex + startOffset) / 7);
      const text = svg("text", { x: col * (cell + gap) + 20, y: 9, class: "chart-label" });
      text.textContent = DateUtils.MONTH_NAMES[m].slice(0, 3);
      root.appendChild(text);
    }
    container.appendChild(root);
  }

  // ---------------- Histogramme (barres verticales) ----------------
  function barChart(container, labels, values, opts = {}) {
    container.innerHTML = "";
    const w = opts.width || 640, h = opts.height || 220;
    const pad = { l: 34, r: 10, t: 16, b: 26 };
    const max = opts.max || Math.max(1, ...values);
    const barW = (w - pad.l - pad.r) / values.length;
    const root = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "chart-svg", width: "100%", height: h });

    // axe
    root.appendChild(svg("line", { x1: pad.l, y1: h - pad.b, x2: w - pad.r, y2: h - pad.b, stroke: "var(--border)" }));

    values.forEach((v, i) => {
      const barH = ((h - pad.t - pad.b) * (v / max));
      const x = pad.l + i * barW + barW * 0.15;
      const y = h - pad.b - barH;
      root.appendChild(svg("rect", {
        x, y, width: barW * 0.7, height: barH, rx: 3, fill: opts.color || accentColor(), opacity: 0.85,
      }));
      if (labels[i] && (opts.showAllLabels || i % Math.ceil(values.length / 12) === 0)) {
        const t = svg("text", { x: x + barW * 0.35, y: h - 8, class: "chart-label", "text-anchor": "middle" });
        t.textContent = labels[i];
        root.appendChild(t);
      }
    });
    container.appendChild(root);
  }

  // ---------------- Courbe d'évolution ----------------
  function lineChart(container, labels, values, opts = {}) {
    container.innerHTML = "";
    const w = opts.width || 640, h = opts.height || 220;
    const pad = { l: 34, r: 10, t: 16, b: 26 };
    const cleanVals = values.map(v => (v === null || v === undefined ? 0 : v));
    const max = opts.max || Math.max(1, ...cleanVals);
    const stepX = (w - pad.l - pad.r) / Math.max(1, values.length - 1);
    const root = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "chart-svg", width: "100%", height: h });
    root.appendChild(svg("line", { x1: pad.l, y1: h - pad.b, x2: w - pad.r, y2: h - pad.b, stroke: "var(--border)" }));

    const points = cleanVals.map((v, i) => {
      const x = pad.l + i * stepX;
      const y = h - pad.b - (h - pad.t - pad.b) * (v / max);
      return [x, y];
    });
    const path = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    root.appendChild(svg("path", { d: path, fill: "none", stroke: opts.color || accentColor(), "stroke-width": 2.2 }));
    points.forEach(([x, y]) => root.appendChild(svg("circle", { cx: x, cy: y, r: 2.6, fill: opts.color || accentColor() })));

    labels.forEach((l, i) => {
      if (i % Math.ceil(labels.length / 10 || 1) === 0) {
        const t = svg("text", { x: points[i][0], y: h - 8, class: "chart-label", "text-anchor": "middle" });
        t.textContent = l;
        root.appendChild(t);
      }
    });
    container.appendChild(root);
  }

  // ---------------- Radar des habitudes ----------------
  function radarChart(container, labels, values, opts = {}) {
    container.innerHTML = "";
    const size = opts.size || 280;
    const cx = size / 2, cy = size / 2, r = size / 2 - 34;
    const n = labels.length;
    const root = svg("svg", { viewBox: `0 0 ${size} ${size}`, class: "chart-svg", width: "100%", height: size });

    // grille
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const pts = Array.from({ length: n }, (_, i) => polarPoint(cx, cy, r * f, i, n)).map(p => p.join(",")).join(" ");
      root.appendChild(svg("polygon", { points: pts, fill: "none", stroke: "var(--border)" }));
    });
    // axes + labels
    for (let i = 0; i < n; i++) {
      const [x, y] = polarPoint(cx, cy, r, i, n);
      root.appendChild(svg("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: "var(--border)" }));
      const [lx, ly] = polarPoint(cx, cy, r + 16, i, n);
      const t = svg("text", { x: lx, y: ly, class: "chart-label", "text-anchor": "middle" });
      t.textContent = labels[i];
      root.appendChild(t);
    }
    // données (0-100)
    const dataPts = values.map((v, i) => polarPoint(cx, cy, r * (Math.max(0, Math.min(100, v)) / 100), i, n));
    root.appendChild(svg("polygon", { points: dataPts.map(p => p.join(",")).join(" "), fill: accentColor(), "fill-opacity": 0.28, stroke: accentColor(), "stroke-width": 2 }));
    dataPts.forEach(([x, y]) => root.appendChild(svg("circle", { cx: x, cy: y, r: 2.6, fill: accentColor() })));

    container.appendChild(root);
  }
  function polarPoint(cx, cy, r, i, n) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [+(cx + r * Math.cos(angle)).toFixed(1), +(cy + r * Math.sin(angle)).toFixed(1)];
  }

  // ---------------- Donut (répartition par catégorie) ----------------
  function donutChart(container, labels, values, colors, opts = {}) {
    container.innerHTML = "";
    const size = opts.size || 220;
    const cx = size / 2, cy = size / 2, r = size / 2 - 8, thickness = opts.thickness || 26;
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const root = svg("svg", { viewBox: `0 0 ${size} ${size}`, class: "chart-svg", width: "100%", height: size });
    let angleStart = -Math.PI / 2;

    values.forEach((v, i) => {
      const angle = (v / total) * Math.PI * 2;
      const path = donutArc(cx, cy, r, thickness, angleStart, angleStart + angle);
      const p = svg("path", { d: path, fill: colors[i % colors.length] });
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${labels[i]} : ${v}`;
      p.appendChild(title);
      root.appendChild(p);
      angleStart += angle;
    });
    container.appendChild(root);
  }
  function donutArc(cx, cy, r, thickness, a0, a1) {
    const rInner = r - thickness;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p0o = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const p1o = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    const p1i = [cx + rInner * Math.cos(a1), cy + rInner * Math.sin(a1)];
    const p0i = [cx + rInner * Math.cos(a0), cy + rInner * Math.sin(a0)];
    return `M ${p0o.join(",")} A ${r},${r} 0 ${large} 1 ${p1o.join(",")} L ${p1i.join(",")} A ${rInner},${rInner} 0 ${large} 0 ${p0i.join(",")} Z`;
  }

  return { heatmapCalendar, barChart, lineChart, radarChart, donutChart };
})();
