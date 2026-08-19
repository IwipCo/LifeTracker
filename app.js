/* ===================== Constantes ===================== */
const LS_DATA = 'habitudes_data_v1';
const LS_SETTINGS = 'habitudes_settings_v1';
const LS_THEME = 'habitudes_theme';

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DOW = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
const DOW_FULL = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const FR_MONTHS = {
  janvier:0, février:1, fevrier:1, mars:2, avril:3, mai:4, juin:5,
  juillet:6, août:7, aout:7, septembre:8, octobre:9, novembre:10, décembre:11, decembre:11
};
const FALSY = new Set(['', 'no', 'non', 'false', '0', '-', '❌', 'off', 'unchecked', 'uncheck']);

/* ===================== Modèle de données ===================== */
function defaultData(){ return { categories: [], activities: [], entries: {} }; }
function defaultSettings(){ return { github: { owner:'', repo:'', branch:'main', path:'data.json', token:'' }, sha: null }; }

function normalizeTarget(t){
  if(t && (t.type === 'daily' || t.type === 'weekly' || t.type === 'monthly')){
    return { type: t.type, count: t.type === 'daily' ? 1 : (Number(t.count) > 0 ? Number(t.count) : 1) };
  }
  return { type: 'daily', count: 1 };
}
function migrateEntries(entries){
  const out = {};
  Object.keys(entries || {}).forEach(date => {
    const v = entries[date];
    if(!v || typeof v !== 'object') return;
    if('checks' in v){
      out[date] = {
        checks: (v.checks && typeof v.checks === 'object') ? v.checks : {},
        note: (typeof v.note === 'number') ? v.note : null,
        comment: (typeof v.comment === 'string') ? v.comment : ''
      };
    } else {
      out[date] = { checks: { ...v }, note: null, comment: '' };
    }
  });
  return out;
}
function normalizeData(parsed){
  parsed = parsed || {};
  const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
  const activities = (Array.isArray(parsed.activities) ? parsed.activities : []).map(a => ({
    id: a.id, name: a.name, categoryId: (a.categoryId !== undefined ? a.categoryId : null),
    target: normalizeTarget(a.target)
  }));
  const entries = migrateEntries(parsed.entries);
  return { categories, activities, entries };
}

function loadData(){
  try{
    const raw = localStorage.getItem(LS_DATA);
    if(raw) return normalizeData(JSON.parse(raw));
  }catch(e){ console.error('loadData', e); }
  return defaultData();
}
function loadSettings(){
  try{
    const raw = localStorage.getItem(LS_SETTINGS);
    if(raw) return Object.assign(defaultSettings(), JSON.parse(raw));
  }catch(e){ console.error('loadSettings', e); }
  return defaultSettings();
}

let DATA = loadData();
let SETTINGS = loadSettings();

function persistLocal(){ localStorage.setItem(LS_DATA, JSON.stringify(DATA)); }
function persistSettings(){ localStorage.setItem(LS_SETTINGS, JSON.stringify(SETTINGS)); }

function ensureDay(date){
  if(!DATA.entries[date]) DATA.entries[date] = { checks: {}, note: null, comment: '' };
  return DATA.entries[date];
}
function isChecked_(date, actId){
  const d = DATA.entries[date];
  return !!(d && d.checks && d.checks[actId]);
}

/* ===================== État des vues ===================== */
let gridMode = 'month';
let viewMonth = new Date().getMonth();
let viewYear = new Date().getFullYear();
let dayDate = new Date();
let weekRefDate = new Date();

/* ===================== Utilitaires date/format ===================== */
function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function pad2(n){ return String(n).padStart(2,'0'); }
function isoDate(d){ return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function hexToRgba(hex, alpha){
  if(!hex) return `rgba(148,164,158,${alpha})`;
  let h = hex.replace('#','');
  if(h.length === 3) h = h.split('').map(c => c+c).join('');
  const bigint = parseInt(h, 16);
  if(isNaN(bigint)) return `rgba(148,164,158,${alpha})`;
  const r = (bigint>>16)&255, g = (bigint>>8)&255, b = bigint&255;
  return `rgba(${r},${g},${b},${alpha})`;
}
function categoryColorFor(categoryId){
  const cat = DATA.categories.find(c => c.id === categoryId);
  return cat ? cat.color : null;
}
function dotHtml(color){
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color || 'var(--ink-soft)'};margin-right:7px;flex-shrink:0;vertical-align:middle;"></span>`;
}
function activityLabelHtml(act){
  return dotHtml(categoryColorFor(act.categoryId)) + escapeHtml(act.name);
}
function categoryHeaderStyle(color){
  return color ? ` style="background:${hexToRgba(color,0.18)}; color:${color};"` : '';
}
function daysOfMonth(y,m){
  const n = new Date(y, m+1, 0).getDate();
  const arr = [];
  for(let d=1; d<=n; d++) arr.push(new Date(y,m,d));
  return arr;
}
function daysOfYear(y){
  let arr = [];
  for(let m=0; m<12; m++) arr = arr.concat(daysOfMonth(y,m));
  return arr;
}
function last30Days(){
  const arr = [];
  const today = new Date();
  for(let i=29; i>=0; i--){
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    arr.push(d);
  }
  return arr;
}
function startOfWeek(d){
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // 0 = lundi
  dt.setDate(dt.getDate() - day);
  dt.setHours(0,0,0,0);
  return dt;
}
function weekDays(refDate){
  const start = startOfWeek(refDate);
  const arr = [];
  for(let i=0;i<7;i++){ const d = new Date(start); d.setDate(d.getDate()+i); arr.push(d); }
  return arr;
}
function formatDayLabel(d){
  return DOW_FULL[(d.getDay()+6)%7] + ' ' + d.getDate() + ' ' + MONTHS_FR[d.getMonth()].toLowerCase() + ' ' + d.getFullYear();
}
function formatWeekLabel(days){
  const a = days[0], b = days[6];
  return `${a.getDate()} ${MONTHS_FR[a.getMonth()].slice(0,3)} – ${b.getDate()} ${MONTHS_FR[b.getMonth()].slice(0,3)} ${b.getFullYear()}`;
}
function yearsWithData(){
  const years = new Set([new Date().getFullYear()]);
  Object.keys(DATA.entries).forEach(iso => { const y = +iso.slice(0,4); if(!isNaN(y)) years.add(y); });
  return Array.from(years).sort((a,b) => a-b);
}
function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let toastTimer;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ===================== Thème (mode nuit par défaut) ===================== */
function loadTheme(){
  try{ const t = localStorage.getItem(LS_THEME); return t === 'light' ? 'light' : 'dark'; }
  catch(e){ return 'dark'; }
}
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('themeToggle');
  if(btn){
    btn.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    const thumb = btn.querySelector('.theme-switch-thumb');
    if(thumb) thumb.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', theme === 'dark' ? '#0E1513' : '#EEF2F0');
  try{ localStorage.setItem(LS_THEME, theme); }catch(e){}
}
document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  if(document.getElementById('view-heatmap').classList.contains('active')) renderHeatmap();
});

/* ===================== Calcul des taux (avec objectifs) ===================== */
function expectedForActivity(activity, days){
  const target = activity.target || { type: 'daily', count: 1 };
  const todayISO = isoDate(new Date());
  const elapsedDays = days.filter(d => isoDate(d) <= todayISO).length;
  if(target.type === 'weekly') return (elapsedDays / 7) * (target.count || 1);
  if(target.type === 'monthly') return (elapsedDays / 30.44) * (target.count || 1);
  return elapsedDays;
}
function computeRowStats(activity, days){
  const todayISO = isoDate(new Date());
  let checked = 0, total = 0;
  days.forEach(d => {
    const iso = isoDate(d);
    if(iso > todayISO) return;
    total++;
    if(isChecked_(iso, activity.id)) checked++;
  });
  const expected = expectedForActivity(activity, days);
  const pct = expected > 0 ? Math.min(100, Math.round(checked/expected*100)) : (total > 0 ? 0 : null);
  return { checked, total, expected: Math.round(expected*10)/10, pct };
}
function computeMonthProgress(year, month){
  const days = daysOfMonth(year, month);
  let sumChecked = 0, sumExpected = 0;
  DATA.activities.forEach(a => {
    const st = computeRowStats(a, days);
    sumChecked += st.checked;
    sumExpected += st.expected;
  });
  const pct = sumExpected > 0 ? Math.round(sumChecked/sumExpected*100) : null;
  const todayISO = isoDate(new Date());
  const elapsed = days.filter(d => isoDate(d) <= todayISO).length;
  return { pct, elapsed, totalDays: days.length };
}
function deltaBadge(prev, cur){
  if(prev == null || cur == null) return '';
  const diff = cur - prev;
  if(diff > 0) return `<span class="delta up">▲ +${diff}%</span>`;
  if(diff < 0) return `<span class="delta down">▼ ${diff}%</span>`;
  return `<span class="delta flat">= 0%</span>`;
}

/* ===================== Groupement par catégorie ===================== */
function groupActivitiesByCategory(){
  const groups = DATA.categories.map(c => ({
    id: c.id, name: c.name, color: c.color,
    activities: DATA.activities.filter(a => a.categoryId === c.id)
  }));
  const orphan = DATA.activities.filter(a => !DATA.categories.find(c => c.id === a.categoryId));
  if(orphan.length) groups.push({ id: null, name: 'Sans catégorie', color: null, activities: orphan });
  return groups;
}

/* ===================== Table grille réutilisable (mois / semaine) ===================== */
function buildTrackerTableHTML(days){
  const todayISO = isoDate(new Date());
  let html = '<table class="tracker"><thead><tr><th class="act-col">Activité</th>';
  days.forEach(d => {
    const iso = isoDate(d);
    const isToday = iso === todayISO;
    html += `<th class="${isToday ? 'today' : ''}" title="${iso}">${d.getDate()}<span class="dow">${DOW[(d.getDay()+6)%7]}</span></th>`;
  });
  html += '<th>%</th></tr></thead><tbody>';
  groupActivitiesByCategory().forEach(group => {
    if(group.activities.length === 0) return;
    html += `<tr class="cat-row"><td colspan="${days.length + 2}"${categoryHeaderStyle(group.color)}>${escapeHtml(group.name)}</td></tr>`;
    group.activities.forEach(act => {
      html += `<tr><td class="act-col" title="${escapeHtml(act.name)}">${activityLabelHtml(act)}</td>`;
      days.forEach(d => {
        const iso = isoDate(d);
        const isWeekend = (d.getDay() === 0 || d.getDay() === 6);
        const isToday = iso === todayISO;
        const isFuture = iso > todayISO;
        const checked = isChecked_(iso, act.id);
        html += `<td class="day-cell ${isWeekend ? 'weekend' : ''} ${isToday ? 'today-col' : ''}">` +
          `<div class="chk ${checked ? 'on' : ''} ${isFuture ? 'future' : ''}" data-date="${iso}" data-act="${act.id}" ` +
          `role="checkbox" aria-checked="${checked}" aria-label="${escapeHtml(act.name)} — ${iso}" tabindex="${isFuture ? '-1' : '0'}"></div></td>`;
      });
      const st = computeRowStats(act, days);
      html += `<td class="pct-col">${st.pct != null ? st.pct + '%' : '—'}</td></tr>`;
    });
  });
  html += '</tbody></table>';
  return html;
}
function toggleEntry(date, actId){
  if(date > isoDate(new Date())) return;
  const day = ensureDay(date);
  day.checks[actId] = !day.checks[actId];
  persistLocal();
  refreshTrackers();
  scheduleAutoSave();
}
function refreshTrackers(){
  renderDay();
  renderWeek();
  renderGrid();
  if(document.getElementById('view-stats').classList.contains('active')) renderStats();
  if(document.getElementById('view-heatmap').classList.contains('active')) renderHeatmap();
}

/* Clic / clavier délégués pour toutes les tables .tracker (mois + semaine) */
document.addEventListener('click', (e) => {
  const chk = e.target.closest('.chk');
  if(chk && chk.dataset.date && !chk.classList.contains('future')){
    toggleEntry(chk.dataset.date, chk.dataset.act);
  }
});
document.addEventListener('keydown', (e) => {
  const chk = e.target.closest('.chk');
  if(!chk || !chk.dataset.date) return;
  if(e.key === ' ' || e.key === 'Enter'){
    if(!chk.classList.contains('future')){ e.preventDefault(); toggleEntry(chk.dataset.date, chk.dataset.act); }
    return;
  }
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const td = chk.closest('td');
  const tr = td.closest('tr');
  const tdIndex = Array.prototype.indexOf.call(tr.children, td);
  let targetTd = null;
  if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
    let sib = e.key === 'ArrowUp' ? tr.previousElementSibling : tr.nextElementSibling;
    while(sib && !sib.querySelector('.chk')) sib = e.key === 'ArrowUp' ? sib.previousElementSibling : sib.nextElementSibling;
    if(sib) targetTd = sib.children[tdIndex];
  } else if(e.key === 'ArrowLeft'){
    targetTd = td.previousElementSibling;
    while(targetTd && !targetTd.querySelector('.chk')) targetTd = targetTd.previousElementSibling;
  } else {
    targetTd = td.nextElementSibling;
    while(targetTd && !targetTd.querySelector('.chk')) targetTd = targetTd.nextElementSibling;
  }
  if(targetTd){
    const targetChk = targetTd.querySelector('.chk');
    if(targetChk) targetChk.focus();
  }
});

/* ===================== Vue Jour ===================== */
function renderDay(){
  document.getElementById('dayLabel').textContent = formatDayLabel(dayDate);
  const iso = isoDate(dayDate);
  const isFuture = iso > isoDate(new Date());
  const list = document.getElementById('dayChecklist');
  if(DATA.activities.length === 0){
    list.innerHTML = '<div class="empty"><h3>Aucune activité pour l’instant</h3><p>Ajoute des catégories et des activités dans l’onglet « Catégories &amp; activités ».</p></div>';
  } else {
    let html = '';
    groupActivitiesByCategory().forEach(group => {
      if(group.activities.length === 0) return;
      html += `<div class="day-cat-header"${categoryHeaderStyle(group.color)}>${escapeHtml(group.name)}</div>`;
      group.activities.forEach(act => {
        const checked = isChecked_(iso, act.id);
        html += `<div class="day-row"><div class="chk-lg ${checked ? 'on' : ''} ${isFuture ? 'future' : ''}" data-act="${act.id}" role="checkbox" aria-checked="${checked}" tabindex="${isFuture ? '-1' : '0'}"></div><span class="act-label">${activityLabelHtml(act)}</span></div>`;
      });
    });
    list.innerHTML = html;
  }
  const day = DATA.entries[iso];
  const note = day ? day.note : null;
  document.getElementById('dayNoteStars').innerHTML = [1,2,3,4,5].map(n =>
    `<span class="star ${note && n <= note ? 'on' : ''}" data-val="${n}">★</span>`).join('');
  document.getElementById('dayComment').value = day ? (day.comment || '') : '';
  document.getElementById('dupYesterdayBtn').textContent =
    (iso === isoDate(new Date())) ? '⤵ Dupliquer hier' : '⤵ Dupliquer la veille';
}
function toggleDayCheck(iso, actId){
  if(iso > isoDate(new Date())) return;
  const day = ensureDay(iso);
  day.checks[actId] = !day.checks[actId];
  persistLocal();
  renderDay();
  renderWeek();
  renderGrid();
  scheduleAutoSave();
}
document.getElementById('dayChecklist').addEventListener('click', e => {
  const chk = e.target.closest('.chk-lg');
  if(!chk || chk.classList.contains('future')) return;
  toggleDayCheck(isoDate(dayDate), chk.dataset.act);
});
document.getElementById('dayChecklist').addEventListener('keydown', e => {
  const chk = e.target.closest('.chk-lg');
  if(!chk) return;
  if(e.key === ' ' || e.key === 'Enter'){
    e.preventDefault();
    if(!chk.classList.contains('future')) toggleDayCheck(isoDate(dayDate), chk.dataset.act);
    return;
  }
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    const all = Array.from(document.querySelectorAll('#dayChecklist .chk-lg'));
    const i = all.indexOf(chk);
    const next = e.key === 'ArrowDown' ? all[i+1] : all[i-1];
    if(next) next.focus();
  }
});
document.getElementById('dayNoteStars').addEventListener('click', e => {
  const star = e.target.closest('.star');
  if(!star) return;
  const val = +star.dataset.val;
  const iso = isoDate(dayDate);
  const day = ensureDay(iso);
  day.note = (day.note === val) ? null : val;
  persistLocal();
  renderDay();
  scheduleAutoSave();
});
let commentSaveTimer;
document.getElementById('dayComment').addEventListener('input', e => {
  const iso = isoDate(dayDate);
  const val = e.target.value;
  clearTimeout(commentSaveTimer);
  commentSaveTimer = setTimeout(() => {
    const day = ensureDay(iso);
    day.comment = val;
    persistLocal();
    scheduleAutoSave();
  }, 500);
});
document.getElementById('dayPrev').addEventListener('click', () => { dayDate.setDate(dayDate.getDate()-1); renderDay(); });
document.getElementById('dayNext').addEventListener('click', () => { dayDate.setDate(dayDate.getDate()+1); renderDay(); });
document.getElementById('dayTodayBtn').addEventListener('click', () => { dayDate = new Date(); renderDay(); });
document.getElementById('dupYesterdayBtn').addEventListener('click', () => {
  const iso = isoDate(dayDate);
  if(iso > isoDate(new Date())){ toast('Impossible sur un jour futur'); return; }
  const yest = new Date(dayDate); yest.setDate(yest.getDate()-1);
  const yDay = DATA.entries[isoDate(yest)];
  if(!yDay){ toast('Aucune donnée pour la veille'); return; }
  const day = ensureDay(iso);
  day.checks = { ...yDay.checks };
  persistLocal(); renderDay(); renderWeek(); renderGrid(); scheduleAutoSave();
  toast('Coché comme la veille');
});

/* ===================== Vue Semaine ===================== */
function renderWeek(){
  const days = weekDays(weekRefDate);
  document.getElementById('weekLabel').textContent = formatWeekLabel(days);
  const container = document.getElementById('weekGridContainer');
  container.innerHTML = DATA.activities.length === 0
    ? '<div class="empty"><h3>Aucune activité</h3></div>'
    : buildTrackerTableHTML(days);
  renderWeekCompare();
}
function computeSimpleRate(activity, days){
  const todayISO = isoDate(new Date());
  let checked = 0, total = 0;
  days.forEach(d => {
    const iso = isoDate(d);
    if(iso > todayISO) return;
    total++;
    if(isChecked_(iso, activity.id)) checked++;
  });
  const pct = total > 0 ? Math.round(checked/total*100) : null;
  return { checked, total, pct };
}
function renderWeekCompare(){
  const wrap = document.getElementById('weekCompareWrap');
  if(DATA.activities.length === 0){ wrap.innerHTML = '<p class="hint">Aucune activité.</p>'; return; }
  const thisWeek = weekDays(weekRefDate);
  const lastWeekRef = new Date(weekRefDate); lastWeekRef.setDate(lastWeekRef.getDate()-7);
  const lastWeek = weekDays(lastWeekRef);
  let html = '<table class="stats"><thead><tr><th>Activité</th><th>Semaine dernière</th><th>Cette semaine</th><th></th></tr></thead><tbody>';
  groupActivitiesByCategory().forEach(g => {
    g.activities.forEach(act => {
      const stPrev = computeSimpleRate(act, lastWeek);
      const stCur = computeSimpleRate(act, thisWeek);
      html += `<tr><td>${activityLabelHtml(act)}</td>
        <td class="num">${stPrev.pct != null ? stPrev.pct + '%' : '—'}</td>
        <td class="num">${stCur.pct != null ? stCur.pct + '%' : '—'}</td>
        <td>${deltaBadge(stPrev.pct, stCur.pct)}</td></tr>`;
    });
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}
document.getElementById('weekPrev').addEventListener('click', () => { weekRefDate = new Date(weekRefDate); weekRefDate.setDate(weekRefDate.getDate()-7); renderWeek(); });
document.getElementById('weekNext').addEventListener('click', () => { weekRefDate = new Date(weekRefDate); weekRefDate.setDate(weekRefDate.getDate()+7); renderWeek(); });
document.getElementById('weekTodayBtn').addEventListener('click', () => { weekRefDate = new Date(); renderWeek(); });

/* ===================== Vue Mois ===================== */
function renderGrid(){
  document.getElementById('monthNav').style.display = gridMode === 'month' ? 'flex' : 'none';
  document.getElementById('monthLabel').textContent = MONTHS_FR[viewMonth] + ' ' + viewYear;
  const container = document.getElementById('gridContainer');
  if(DATA.activities.length === 0){
    container.innerHTML = '<div class="empty"><h3>Aucune activité pour l’instant</h3><p>Ajoute des catégories et des activités dans l’onglet « Catégories &amp; activités » pour commencer à suivre tes habitudes.</p></div>';
  } else {
    const days = gridMode === 'month' ? daysOfMonth(viewYear, viewMonth) : last30Days();
    container.innerHTML = buildTrackerTableHTML(days);
  }
  renderMonthProgress();
}
function renderMonthProgress(){
  const panel = document.getElementById('monthProgressPanel');
  if(DATA.activities.length === 0){ panel.innerHTML = ''; return; }
  const now = new Date();
  const prog = computeMonthProgress(now.getFullYear(), now.getMonth());
  panel.innerHTML = `<div class="progress-block">
    <div class="big-pct">${prog.pct != null ? prog.pct + '%' : '—'}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${prog.pct ?? 0}%"></div></div>
    <div class="meta">Progression de ${MONTHS_FR[now.getMonth()]} — jour ${prog.elapsed} / ${prog.totalDays}</div>
  </div>`;
}
function setModeButtons(){
  document.getElementById('modeMonth').classList.toggle('primary', gridMode === 'month');
  document.getElementById('mode30').classList.toggle('primary', gridMode === '30');
}
document.getElementById('modeMonth').addEventListener('click', () => { gridMode = 'month'; setModeButtons(); renderGrid(); });
document.getElementById('mode30').addEventListener('click', () => { gridMode = '30'; setModeButtons(); renderGrid(); });
document.getElementById('prevMonth').addEventListener('click', () => { viewMonth--; if(viewMonth < 0){ viewMonth = 11; viewYear--; } renderGrid(); });
document.getElementById('nextMonth').addEventListener('click', () => { viewMonth++; if(viewMonth > 11){ viewMonth = 0; viewYear++; } renderGrid(); });
document.getElementById('todayBtn').addEventListener('click', () => { viewMonth = new Date().getMonth(); viewYear = new Date().getFullYear(); renderGrid(); });

/* ===================== Vue Heatmap ===================== */
function populateYearSelect(sel){
  sel.innerHTML = yearsWithData().map(y => `<option value="${y}">${y}</option>`).join('');
}
function renderHeatmapControls(){
  const actSel = document.getElementById('hmActivity');
  const prev = actSel.value;
  actSel.innerHTML = '<option value="__all__">Toutes (moyenne)</option>' +
    DATA.activities.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  if(prev && (prev === '__all__' || DATA.activities.find(a => a.id === prev))) actSel.value = prev;
  populateYearSelect(document.getElementById('hmYear'));
  document.getElementById('hmYear').value = new Date().getFullYear();
}
function dayIntensity(iso, actId){
  if(iso > isoDate(new Date())) return null;
  const day = DATA.entries[iso];
  if(actId === '__all__'){
    if(DATA.activities.length === 0) return null;
    if(!day) return 0;
    let checked = 0;
    DATA.activities.forEach(a => { if(day.checks && day.checks[a.id]) checked++; });
    return checked / DATA.activities.length;
  }
  return (day && day.checks && day.checks[actId]) ? 1 : 0;
}
function heatColor(intensity){
  const isDark = document.documentElement.dataset.theme !== 'light';
  if(isDark){
    if(intensity === null) return '#141C1A';
    if(intensity <= 0) return '#212B29';
    if(intensity < 0.34) return '#1F5240';
    if(intensity < 0.67) return '#237A58';
    if(intensity < 1) return '#2FA374';
    return '#3FD79A';
  }
  if(intensity === null) return '#F3F5F4';
  if(intensity <= 0) return '#E4E9E7';
  if(intensity < 0.34) return '#BFE0D2';
  if(intensity < 0.67) return '#7FC3A5';
  if(intensity < 1) return '#3E9A75';
  return '#1F6F5C';
}
function renderHeatmap(){
  const actId = document.getElementById('hmActivity').value || '__all__';
  const year = +document.getElementById('hmYear').value || new Date().getFullYear();
  const container = document.getElementById('heatmapContainer');
  if(DATA.activities.length === 0){
    container.innerHTML = '<p class="hint">Aucune activité.</p>';
    document.getElementById('heatmapLegend').innerHTML = '';
    return;
  }
  const dec31 = new Date(year,11,31);
  const start = startOfWeek(new Date(year,0,1));
  const weeks = [];
  let cur = new Date(start);
  while(cur <= dec31){
    const w = [];
    for(let i=0;i<7;i++){ w.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
    weeks.push(w);
  }
  let html = '<div class="heatmap-grid">';
  weeks.forEach(w => {
    html += '<div class="heatmap-week">';
    w.forEach(d => {
      if(d.getFullYear() !== year){ html += '<div class="heatmap-cell" style="background:transparent"></div>'; return; }
      const iso = isoDate(d);
      const intensity = dayIntensity(iso, actId);
      html += `<div class="heatmap-cell" style="background:${heatColor(intensity)}" title="${iso} — ${intensity==null?'à venir':Math.round(intensity*100)+'%'}"></div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  document.getElementById('heatmapLegend').innerHTML = 'Moins ' +
    '<span class="heatmap-legend-scale">' + [0,0.2,0.5,0.8,1].map(v => `<span class="sq" style="background:${heatColor(v)}"></span>`).join('') + '</span>' +
    ' Plus';
}
document.getElementById('hmActivity').addEventListener('change', renderHeatmap);
document.getElementById('hmYear').addEventListener('change', renderHeatmap);

/* ===================== Statistiques ===================== */
function populateMonthSelect(sel){
  sel.innerHTML = MONTHS_FR.map((m,i) => `<option value="${i}">${m}</option>`).join('');
}
function renderOverview(){
  const wrap = document.getElementById('overviewTableWrap');
  if(DATA.activities.length === 0){ wrap.innerHTML = '<p class="hint">Aucune activité.</p>'; return; }
  const month = +document.getElementById('ovMonth').value;
  const year = +document.getElementById('ovYear').value;
  const days = daysOfMonth(year, month);
  let html = '<table class="stats"><thead><tr><th>Activité</th><th>Taux</th></tr></thead><tbody>';
  groupActivitiesByCategory().forEach(g => {
    g.activities.forEach(act => {
      const st = computeRowStats(act, days);
      html += `<tr><td>${activityLabelHtml(act)}</td><td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${st.pct ?? 0}%"></div></div><span class="val">${st.pct != null ? st.pct + '%' : '—'}</span></div></td></tr>`;
    });
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}
function renderPrevMonthCompare(){
  const wrap = document.getElementById('prevMonthCompareWrap');
  if(DATA.activities.length === 0){ wrap.innerHTML = '<p class="hint">Aucune activité.</p>'; return; }
  const now = new Date();
  const curDays = daysOfMonth(now.getFullYear(), now.getMonth());
  const prevRef = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevDays = daysOfMonth(prevRef.getFullYear(), prevRef.getMonth());
  let html = `<table class="stats"><thead><tr><th>Activité</th><th>${MONTHS_FR[prevRef.getMonth()]}</th><th>${MONTHS_FR[now.getMonth()]}</th><th></th></tr></thead><tbody>`;
  groupActivitiesByCategory().forEach(g => {
    g.activities.forEach(act => {
      const stPrev = computeRowStats(act, prevDays);
      const stCur = computeRowStats(act, curDays);
      html += `<tr><td>${activityLabelHtml(act)}</td><td class="num">${stPrev.pct != null ? stPrev.pct + '%' : '—'}</td><td class="num">${stCur.pct != null ? stCur.pct + '%' : '—'}</td><td>${deltaBadge(stPrev.pct, stCur.pct)}</td></tr>`;
    });
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}
function renderYearCompare(){
  const wrap = document.getElementById('yearCompareWrap');
  if(DATA.activities.length === 0){ wrap.innerHTML = '<p class="hint">Aucune activité.</p>'; return; }
  const month = +document.getElementById('cmpMonth').value;
  const years = yearsWithData();
  const now = new Date();
  let html = '<table class="stats"><thead><tr><th>Activité</th>' + years.map(y => `<th>${y}</th>`).join('') + '</tr></thead><tbody>';
  groupActivitiesByCategory().forEach(g => {
    g.activities.forEach(act => {
      html += `<tr><td>${activityLabelHtml(act)}</td>`;
      years.forEach(y => {
        if(new Date(y, month, 1) > now){ html += '<td class="num">—</td>'; return; }
        const st = computeRowStats(act, daysOfMonth(y, month));
        html += `<td class="num">${st.pct != null ? st.pct + '%' : '—'}</td>`;
      });
      html += '</tr>';
    });
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}
function renderStats(){
  populateYearSelect(document.getElementById('ovYear'));
  document.getElementById('ovMonth').value = new Date().getMonth();
  document.getElementById('ovYear').value = new Date().getFullYear();
  document.getElementById('cmpMonth').value = new Date().getMonth();
  renderOverview();
  renderPrevMonthCompare();
  renderYearCompare();
}
function initStatsControls(){
  populateMonthSelect(document.getElementById('ovMonth'));
  populateMonthSelect(document.getElementById('cmpMonth'));
  document.getElementById('ovMonth').addEventListener('change', renderOverview);
  document.getElementById('ovYear').addEventListener('change', renderOverview);
  document.getElementById('cmpMonth').addEventListener('change', renderYearCompare);
}

/* ===================== Catégories & activités ===================== */
function renderManage(){
  const catList = document.getElementById('catList');
  catList.innerHTML = DATA.categories.length === 0 ? '<p class="hint">Aucune catégorie.</p>' :
    DATA.categories.map(c => `
      <div class="cat-item" data-cat="${c.id}">
        <input type="color" class="catColorInput" value="${c.color}">
        <input type="text" class="cat-name-input" value="${escapeHtml(c.name)}">
        <button class="tiny-btn ghost" data-del-cat="${c.id}">Supprimer</button>
      </div>`).join('');

  const actList = document.getElementById('actList');
  actList.innerHTML = DATA.activities.length === 0 ? '<p class="hint">Aucune activité.</p>' :
    DATA.activities.map(a => {
      const t = a.target || { type: 'daily', count: 1 };
      return `<div class="act-item" data-act="${a.id}">
        <input type="text" class="act-name-input" value="${escapeHtml(a.name)}">
        <select class="act-cat-select">
          <option value="">Sans catégorie</option>
          ${DATA.categories.map(c => `<option value="${c.id}" ${a.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select class="act-target-type">
          <option value="daily" ${t.type === 'daily' ? 'selected' : ''}>Tous les jours</option>
          <option value="weekly" ${t.type === 'weekly' ? 'selected' : ''}>X fois / semaine</option>
          <option value="monthly" ${t.type === 'monthly' ? 'selected' : ''}>X fois / mois</option>
        </select>
        <input type="number" min="1" max="31" class="act-target-count" value="${t.count}" style="width:56px; ${t.type === 'daily' ? 'display:none;' : ''}">
        <button class="tiny-btn ghost" data-del-act="${a.id}">Supprimer</button>
      </div>`;
    }).join('');

  document.getElementById('newActCat').innerHTML = '<option value="">Sans catégorie</option>' +
    DATA.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}
document.getElementById('addCatBtn').addEventListener('click', () => {
  const nameInput = document.getElementById('newCatName');
  const name = nameInput.value.trim();
  if(!name) return;
  const color = document.getElementById('newCatColor').value;
  DATA.categories.push({ id: uid(), name, color });
  nameInput.value = '';
  persistLocal(); renderManage(); refreshTrackers(); scheduleAutoSave();
});
document.getElementById('addActBtn').addEventListener('click', () => {
  const nameInput = document.getElementById('newActName');
  const name = nameInput.value.trim();
  if(!name) return;
  const categoryId = document.getElementById('newActCat').value || null;
  DATA.activities.push({ id: uid(), name, categoryId, target: { type: 'daily', count: 1 } });
  nameInput.value = '';
  persistLocal(); renderManage(); refreshTrackers(); scheduleAutoSave();
});
document.getElementById('catList').addEventListener('change', e => {
  const row = e.target.closest('.cat-item'); if(!row) return;
  const cat = DATA.categories.find(c => c.id === row.dataset.cat); if(!cat) return;
  if(e.target.classList.contains('catColorInput')) cat.color = e.target.value;
  if(e.target.classList.contains('cat-name-input')) cat.name = e.target.value.trim() || cat.name;
  persistLocal(); refreshTrackers(); scheduleAutoSave();
});
document.getElementById('catList').addEventListener('click', e => {
  const btn = e.target.closest('[data-del-cat]'); if(!btn) return;
  if(!confirm('Supprimer cette catégorie ? Les activités associées passeront en « Sans catégorie ».')) return;
  const id = btn.dataset.delCat;
  DATA.categories = DATA.categories.filter(c => c.id !== id);
  DATA.activities.forEach(a => { if(a.categoryId === id) a.categoryId = null; });
  persistLocal(); renderManage(); refreshTrackers(); scheduleAutoSave();
});
document.getElementById('actList').addEventListener('change', e => {
  const row = e.target.closest('.act-item'); if(!row) return;
  const act = DATA.activities.find(a => a.id === row.dataset.act); if(!act) return;
  if(e.target.classList.contains('act-name-input')) act.name = e.target.value.trim() || act.name;
  if(e.target.classList.contains('act-cat-select')) act.categoryId = e.target.value || null;
  if(e.target.classList.contains('act-target-type') || e.target.classList.contains('act-target-count')){
    const type = row.querySelector('.act-target-type').value;
    const count = Math.max(1, +row.querySelector('.act-target-count').value || 1);
    act.target = { type, count: type === 'daily' ? 1 : count };
    row.querySelector('.act-target-count').style.display = type === 'daily' ? 'none' : 'inline-block';
  }
  persistLocal(); refreshTrackers(); scheduleAutoSave();
});
document.getElementById('actList').addEventListener('click', e => {
  const btn = e.target.closest('[data-del-act]'); if(!btn) return;
  if(!confirm('Supprimer cette activité ? Son historique restera dans les données mais elle disparaîtra de la grille.')) return;
  const id = btn.dataset.delAct;
  DATA.activities = DATA.activities.filter(a => a.id !== id);
  persistLocal(); renderManage(); refreshTrackers(); scheduleAutoSave();
});

/* ===================== Import CSV Notion ===================== */
let csvHeaders = [];
let csvRows = [];

function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for(let i=0; i<text.length; i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}
function isChecked(raw, invert){
  const v = (raw || '').trim().toLowerCase();
  let checked = v !== '' && !FALSY.has(v);
  if(invert) checked = !checked;
  return checked;
}
function toISO(y, m, d){
  const dt = new Date(y, m, d);
  if(isNaN(dt.getTime())) return null;
  return isoDate(dt);
}
function parseDateValue(raw, format){
  if(!raw) return null;
  raw = raw.trim();
  let m;
  if(format === 'iso' || format === 'auto'){
    m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) return toISO(+m[1], +m[2]-1, +m[3]);
  }
  if(format === 'eu' || format === 'auto'){
    m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if(m) return toISO(+m[3], +m[2]-1, +m[1]);
  }
  if(format === 'us'){
    m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if(m) return toISO(+m[3], +m[1]-1, +m[2]);
  }
  m = raw.toLowerCase().match(/(\d{1,2})\s+([a-zéûàôç]+)\.?\s+(\d{4})/);
  if(m && FR_MONTHS[m[2]] !== undefined) return toISO(+m[3], FR_MONTHS[m[2]], +m[1]);
  if(format === 'auto'){
    const d = new Date(raw);
    if(!isNaN(d.getTime())) return isoDate(d);
  }
  return null;
}
document.getElementById('csvParseBtn').addEventListener('click', async () => {
  let text = document.getElementById('csvText').value;
  const file = document.getElementById('csvFile').files[0];
  if(file) text = await file.text();
  if(!text || !text.trim()){ toast('Aucun contenu CSV à analyser'); return; }
  const rows = parseCSV(text);
  if(rows.length < 2){ toast('CSV vide ou invalide'); return; }
  csvHeaders = rows[0].map(h => h.trim());
  csvRows = rows.slice(1);
  buildCsvMapUI();
  document.getElementById('csvMapZone').style.display = 'block';
  document.getElementById('csvPreview').innerHTML = '';
  document.getElementById('csvImportSummary').textContent = '';
});
function buildCsvMapUI(){
  const dateSel = document.getElementById('csvDateCol');
  dateSel.innerHTML = csvHeaders.map((h,i) => `<option value="${i}">${escapeHtml(h)}</option>`).join('');
  const guessIdx = csvHeaders.findIndex(h => /date|jour|day/i.test(h));
  dateSel.value = guessIdx >= 0 ? guessIdx : 0;
  dateSel.onchange = renderCsvMapTable;
  renderCsvMapTable();
}
function renderCsvMapTable(){
  const dateIdx = +document.getElementById('csvDateCol').value;
  const table = document.getElementById('csvMapTable');
  let html = '<tr><th>Colonne CSV</th><th>Associer à</th><th>Inverser</th></tr>';
  csvHeaders.forEach((h,i) => {
    if(i === dateIdx) return;
    const guessAct = DATA.activities.find(a => a.name.trim().toLowerCase() === h.trim().toLowerCase());
    const guessNote = /note|humeur|mood|rating/i.test(h);
    const guessComment = !guessNote && /commentaire|comment|remarque/i.test(h);
    html += `<tr>
      <td>${escapeHtml(h)}</td>
      <td>
        <select data-col="${i}" class="csvActSel">
          <option value="">Ignorer</option>
          <option value="__note__" ${guessNote ? 'selected' : ''}>★ Note du jour (1-5)</option>
          <option value="__comment__" ${guessComment ? 'selected' : ''}>💬 Commentaire</option>
          ${DATA.activities.map(a => `<option value="${a.id}" ${guessAct && guessAct.id === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
      </td>
      <td><input type="checkbox" class="csvInvertRow" data-col="${i}"></td>
    </tr>`;
  });
  table.innerHTML = html;
  if(DATA.activities.length === 0){
    table.innerHTML += '<tr><td colspan="3" class="hint">Crée d’abord tes activités dans l’onglet « Catégories &amp; activités ».</td></tr>';
  }
}
document.getElementById('csvInvertAll').addEventListener('change', (e) => {
  document.querySelectorAll('.csvInvertRow').forEach(cb => { cb.checked = e.target.checked; });
});
function getCsvMapping(){
  const dateIdx = +document.getElementById('csvDateCol').value;
  const mapping = [];
  document.querySelectorAll('.csvActSel').forEach(sel => {
    if(!sel.value) return;
    const col = +sel.dataset.col;
    if(sel.value === '__note__'){ mapping.push({ col, type: 'note' }); return; }
    if(sel.value === '__comment__'){ mapping.push({ col, type: 'comment' }); return; }
    const invertRow = document.querySelector(`.csvInvertRow[data-col="${col}"]`);
    mapping.push({ col, type: 'activity', activityId: sel.value, invert: invertRow ? invertRow.checked : false });
  });
  return { dateIdx, mapping };
}
document.getElementById('csvPreviewBtn').addEventListener('click', () => {
  const { dateIdx, mapping } = getCsvMapping();
  if(mapping.length === 0){ toast('Associe au moins une colonne'); return; }
  const format = document.getElementById('csvDateFormat').value;
  const preview = document.getElementById('csvPreview');
  let html = '<tr><th>Date</th>' + mapping.map(m => {
    if(m.type === 'note') return '<th>Note</th>';
    if(m.type === 'comment') return '<th>Commentaire</th>';
    const act = DATA.activities.find(a => a.id === m.activityId);
    return `<th>${escapeHtml(act ? act.name : '?')}</th>`;
  }).join('') + '</tr>';
  csvRows.slice(0,5).forEach(row => {
    const iso = parseDateValue(row[dateIdx] || '', format);
    html += `<tr><td>${iso || '<span style="color:#B24444">invalide</span>'}</td>`;
    mapping.forEach(m => {
      if(m.type === 'note'){ html += `<td>${escapeHtml((row[m.col]||'').trim())}</td>`; return; }
      if(m.type === 'comment'){ html += `<td>${escapeHtml((row[m.col]||'').trim().slice(0,30))}</td>`; return; }
      const checked = isChecked(row[m.col], m.invert);
      html += `<td class="${checked ? 'yes' : 'no'}">${checked ? '✔' : '—'}</td>`;
    });
    html += '</tr>';
  });
  preview.innerHTML = html;
});
document.getElementById('csvImportBtn').addEventListener('click', () => {
  const { dateIdx, mapping } = getCsvMapping();
  if(mapping.length === 0){ toast('Associe au moins une colonne'); return; }
  const format = document.getElementById('csvDateFormat').value;
  const overwrite = document.getElementById('csvOverwrite').checked;
  let imported = 0, skippedDates = 0, cellsWritten = 0;
  csvRows.forEach(row => {
    const iso = parseDateValue(row[dateIdx] || '', format);
    if(!iso){ skippedDates++; return; }
    imported++;
    const day = ensureDay(iso);
    mapping.forEach(m => {
      if(m.type === 'note'){
        if(day.note != null && !overwrite) return;
        const n = parseInt((row[m.col]||'').trim(), 10);
        if(!isNaN(n)){ day.note = Math.max(0, Math.min(5, n)); cellsWritten++; }
        return;
      }
      if(m.type === 'comment'){
        if(day.comment && !overwrite) return;
        const c = (row[m.col]||'').trim();
        if(c){ day.comment = c; cellsWritten++; }
        return;
      }
      const already = Object.prototype.hasOwnProperty.call(day.checks, m.activityId);
      if(already && !overwrite) return;
      day.checks[m.activityId] = isChecked(row[m.col], m.invert);
      cellsWritten++;
    });
  });
  persistLocal();
  refreshTrackers();
  scheduleAutoSave();
  document.getElementById('csvImportSummary').textContent =
    `${imported} ligne(s) importée(s), ${cellsWritten} case(s) écrite(s), ${skippedDates} ligne(s) ignorée(s) (date illisible).`;
  toast('Import terminé');
});

/* ===================== Synchronisation GitHub ===================== */
function isGithubConfigured(){
  const g = SETTINGS.github;
  return !!(g && g.owner && g.repo && g.token);
}
function setSyncStatus(kind, text){
  document.getElementById('syncDot').className = 'sync-dot ' + (kind || '');
  document.getElementById('syncText').textContent = text;
}
function updateSyncStatusIdle(){
  if(!isGithubConfigured()) setSyncStatus('', 'Non configuré');
  else setSyncStatus('ok', 'Prêt');
}
function ghHeaders(token){
  return { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}
async function ghGetFile(){
  const s = SETTINGS.github;
  const url = `https://api.github.com/repos/${s.owner}/${s.repo}/contents/${encodeURIComponent(s.path)}?ref=${encodeURIComponent(s.branch)}&_=${Date.now()}`;
  const res = await fetch(url, { headers: ghHeaders(s.token), cache: 'no-store' });
  if(res.status === 404) return { notFound: true };
  if(!res.ok) throw new Error('GitHub GET ' + res.status);
  const json = await res.json();
  const content = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
  return { content: normalizeData(JSON.parse(content)), sha: json.sha };
}
async function ghPutFile(dataObj, sha){
  const s = SETTINGS.github;
  const url = `https://api.github.com/repos/${s.owner}/${s.repo}/contents/${encodeURIComponent(s.path)}`;
  const body = {
    message: 'Mise à jour habitudes ' + new Date().toISOString(),
    content: btoa(unescape(encodeURIComponent(JSON.stringify(dataObj, null, 2)))),
    branch: s.branch
  };
  if(sha) body.sha = sha;
  const res = await fetch(url, { method: 'PUT', headers: { ...ghHeaders(s.token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if(res.status === 409){ const e = new Error('conflict'); e.conflict = true; throw e; }
  if(!res.ok){ const t = await res.text(); throw new Error('GitHub PUT ' + res.status + ': ' + t); }
  return await res.json();
}
let saving = false;
let pendingSave = false;
let saveTimer = null;
function scheduleAutoSave(){
  if(!isGithubConfigured()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => doAutoSave(), 2000);
}
async function doAutoSave(retries = 3){
  if(!isGithubConfigured()) return;
  if(saving){ pendingSave = true; return; }
  saving = true;
  setSyncStatus('busy', 'Sauvegarde…');
  try{
    const res = await ghPutFile(DATA, SETTINGS.sha);
    SETTINGS.sha = res.content.sha;
    persistSettings();
    setSyncStatus('ok', 'Enregistré ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  }catch(err){
    if(err.conflict && retries > 0){
      try{
        const remote = await ghGetFile();
        if(!remote.notFound){
          showConflictBanner(remote);
          setSyncStatus('err', 'Conflit détecté');
          saving = false;
          return;
        }
      }catch(e2){ console.error(e2); }
      saving = false;
      return doAutoSave(retries - 1);
    }
    setSyncStatus('err', 'Erreur de sauvegarde');
    console.error(err);
  }finally{
    saving = false;
    if(pendingSave){ pendingSave = false; scheduleAutoSave(); }
  }
}
function showConflictBanner(remote){
  const zone = document.getElementById('bannerZone');
  zone.innerHTML = `<div class="banner warn">
    <span>Conflit : la version distante a changé depuis ta dernière synchro.</span>
    <span class="row">
      <button class="tiny-btn" id="cfReload">Recharger la version distante</button>
      <button class="tiny-btn primary" id="cfForce">Écraser quand même</button>
    </span>
  </div>`;
  document.getElementById('cfReload').addEventListener('click', () => {
    DATA = remote.content; SETTINGS.sha = remote.sha;
    persistLocal(); persistSettings(); renderAll(); clearBanner(); updateSyncStatusIdle();
    toast('Version distante chargée');
  });
  document.getElementById('cfForce').addEventListener('click', () => {
    SETTINGS.sha = remote.sha; persistSettings(); clearBanner();
    doAutoSave();
  });
}
function clearBanner(){ document.getElementById('bannerZone').innerHTML = ''; }
function fillSettingsForm(){
  const g = SETTINGS.github;
  document.getElementById('ghOwner').value = g.owner || '';
  document.getElementById('ghRepo').value = g.repo || '';
  document.getElementById('ghBranch').value = g.branch || 'main';
  document.getElementById('ghPath').value = g.path || 'data.json';
  document.getElementById('ghToken').value = g.token || '';
}
document.getElementById('ghSaveBtn').addEventListener('click', () => {
  SETTINGS.github = {
    owner: document.getElementById('ghOwner').value.trim(),
    repo: document.getElementById('ghRepo').value.trim(),
    branch: document.getElementById('ghBranch').value.trim() || 'main',
    path: document.getElementById('ghPath').value.trim() || 'data.json',
    token: document.getElementById('ghToken').value.trim()
  };
  persistSettings();
  updateSyncStatusIdle();
  toast('Configuration enregistrée');
});
document.getElementById('ghLoadNowBtn').addEventListener('click', async () => {
  if(!isGithubConfigured()){ toast('Configure d’abord GitHub'); return; }
  setSyncStatus('busy', 'Chargement…');
  try{
    const remote = await ghGetFile();
    if(remote.notFound){ toast('Aucun fichier distant pour le moment'); updateSyncStatusIdle(); return; }
    if(!confirm('Charger la version distante ? Les données locales non sauvegardées seront remplacées.')){ updateSyncStatusIdle(); return; }
    DATA = remote.content; SETTINGS.sha = remote.sha;
    persistLocal(); persistSettings(); renderAll();
    setSyncStatus('ok', 'Chargé depuis GitHub');
  }catch(err){
    console.error(err);
    setSyncStatus('err', 'Erreur de chargement');
    toast('Échec du chargement : ' + err.message);
  }
});
document.getElementById('ghSaveNowBtn').addEventListener('click', () => {
  if(!isGithubConfigured()){ toast('Configure d’abord GitHub'); return; }
  clearTimeout(saveTimer);
  doAutoSave();
});

/* ===================== Lien de configuration ===================== */
function generateConfigLink(){
  const payload = JSON.stringify(SETTINGS);
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  return location.origin + location.pathname + '#cfg=' + b64;
}
document.getElementById('genLinkBtn').addEventListener('click', () => {
  document.getElementById('genLinkResult').value = generateConfigLink();
  document.getElementById('genLinkResultWrap').style.display = 'block';
});
document.getElementById('copyLinkBtn').addEventListener('click', () => {
  const ta = document.getElementById('genLinkResult');
  ta.select();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(ta.value).then(() => toast('Lien copié')).catch(() => toast('Copie impossible'));
  } else {
    document.execCommand('copy'); toast('Lien copié');
  }
});
function handleConfigLinkIfPresent(){
  if(location.hash.startsWith('#cfg=')){
    try{
      const b64 = location.hash.slice(5);
      const json = decodeURIComponent(escape(atob(b64)));
      Object.assign(SETTINGS, JSON.parse(json));
      persistSettings();
      toast('Paramètres chargés depuis le lien');
    }catch(e){ console.error(e); toast('Lien de configuration invalide'); }
    history.replaceState(null, '', location.pathname + location.search);
  }
}

/* ===================== Export / Import ===================== */
document.getElementById('exportDataBtn').addEventListener('click', () => downloadJSON(DATA, 'habitudes-data.json'));
document.getElementById('exportSettingsBtn').addEventListener('click', () => {
  if(!confirm('Le fichier exporté contiendra ton token GitHub en clair. Continuer ?')) return;
  downloadJSON(SETTINGS, 'habitudes-settings.json');
});
document.getElementById('importDataFile').addEventListener('change', (e) => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!confirm('Remplacer toutes les données locales par ce fichier ?')) return;
      DATA = normalizeData(parsed);
      persistLocal(); renderAll(); scheduleAutoSave();
      toast('Données importées');
    }catch(err){ toast('Fichier invalide'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});
document.getElementById('importSettingsFile').addEventListener('change', (e) => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      Object.assign(SETTINGS, JSON.parse(reader.result));
      persistSettings(); fillSettingsForm(); updateSyncStatusIdle();
      toast('Paramètres importés');
    }catch(err){ toast('Fichier invalide'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});
document.getElementById('wipeLocalBtn').addEventListener('click', () => {
  if(!confirm('Effacer toutes les données locales (catégories, activités, historique) ? Cette action est irréversible localement.')) return;
  localStorage.removeItem(LS_DATA);
  DATA = defaultData();
  persistLocal(); renderAll();
  toast('Données locales effacées');
});

/* ===================== Onglets ===================== */
document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    const v = btn.dataset.view;
    if(v === 'day') renderDay();
    if(v === 'week') renderWeek();
    if(v === 'month') renderGrid();
    if(v === 'heatmap'){ renderHeatmapControls(); renderHeatmap(); }
    if(v === 'stats') renderStats();
    if(v === 'manage') renderManage();
    if(v === 'settings') fillSettingsForm();
  });
});
document.getElementById('btnOpenSettings').addEventListener('click', () => {
  document.querySelector('nav.tabs button[data-view="settings"]').click();
});
function goHomeToday(){
  dayDate = new Date();
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
  document.querySelector('nav.tabs button[data-view="day"]').classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-day').classList.add('active');
  renderDay();
}
document.getElementById('brandHome').addEventListener('click', goHomeToday);
document.getElementById('brandHome').addEventListener('keydown', (e) => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); goHomeToday(); }
});

/* ===================== Rendu global & init ===================== */
function renderAll(){
  renderDay();
  renderWeek();
  renderGrid();
  renderManage();
  updateSyncStatusIdle();
  if(document.getElementById('view-stats').classList.contains('active')) renderStats();
  if(document.getElementById('view-heatmap').classList.contains('active')){ renderHeatmapControls(); renderHeatmap(); }
}
function init(){
  applyTheme(loadTheme());
  handleConfigLinkIfPresent();
  setModeButtons();
  initStatsControls();
  renderHeatmapControls();
  fillSettingsForm();
  renderAll();
}
init();

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
