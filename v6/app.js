// v6/app.js — TiefbauPorte v6 Bootstrapping

import { DEFAULT_CATALOG, DEFAULT_CABLE_TYPES } from './modules/constants.js';
import { loadState, saveState } from './modules/storage.js';
import { showInfo, fmtEur } from './modules/ui.js';
import { render as renderAll } from './modules/render.js';
import { calcTotals } from './modules/calc.js';
import { initModeToggle, initMapMode } from './modules/mode.js';
import { openCatalog } from './modules/catalog.js';
import { initTraceDrawing } from './modules/traces.js';

// ========== State ==========
let state = loadState();
if (!state) {
  state = {
    meta: {
      we: '', loc: '', date: new Date().toISOString().slice(0, 10),
      author: '', note: '',
      gk: 0, wg: 0,
      konta: false, denk: false, kontaPct: 20, denkPct: 15
    },
    catalog: JSON.parse(JSON.stringify(DEFAULT_CATALOG)),
    cableTypes: JSON.parse(JSON.stringify(DEFAULT_CABLE_TYPES)),
    objects: [],
    traces: [],
    selectedCat: null,
    viz: { hw: true, tr: true, links: false },
    uiMode: 'edit',
    schemaVersion: 6
  };
}

function save() { saveState(state); }

// ========== Map ==========
const map = L.map('map', { zoomControl: false, tap: true }).setView([52.4512, 13.2890], 18);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const layerOSM = L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap', maxZoom: 19, subdomains: 'abc', crossOrigin: true
});
const layerSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri', maxZoom: 20, crossOrigin: true
});
layerOSM.addTo(map);
let activeLayer = 'map';

const objLayer = L.layerGroup().addTo(map);
const traceLayer = L.layerGroup().addTo(map);
const drawLayer = L.layerGroup().addTo(map);
const linkLayer = L.layerGroup().addTo(map);

// Overlay click-propagation blocken
['searchbar', 'srchRes', 'legend'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }
});
const lyrEl = document.querySelector('.layerctl');
if (lyrEl) {
  L.DomEvent.disableClickPropagation(lyrEl);
  L.DomEvent.disableScrollPropagation(lyrEl);
}

// ========== Gemeinsamer Context ==========
// Der ctx wird an alle Module gereicht, damit sie auf State und gemeinsame
// Funktionen zugreifen können, ohne in app.js hineinimportieren zu müssen.
const ctx = {
  get state() { return state; },
  map,
  objLayer,
  traceLayer,
  drawLayer,
  linkLayer,
  mode: 'pin',
  currentTrace: null,
  save,
  render: () => renderAll(ctx),
  updateTotal
};

// ========== Update-Total Header ==========
function updateTotal() {
  const t = calcTotals(state);
  document.getElementById('sumTotal').textContent = fmtEur(t.total);
  let sub = 'Vor-Ort-Check · Union E';
  if (state.meta.we) sub = 'WE ' + state.meta.we;
  document.getElementById('hdrSub').textContent = sub;
}

// ========== Layer-Controls ==========
document.getElementById('lyrMap').onclick = () => {
  if (activeLayer === 'map') return;
  map.removeLayer(layerSat);
  layerOSM.addTo(map);
  document.getElementById('lyrMap').classList.add('active');
  document.getElementById('lyrSat').classList.remove('active');
  activeLayer = 'map';
};
document.getElementById('lyrSat').onclick = () => {
  if (activeLayer === 'sat') return;
  map.removeLayer(layerOSM);
  layerSat.addTo(map);
  document.getElementById('lyrSat').classList.add('active');
  document.getElementById('lyrMap').classList.remove('active');
  activeLayer = 'sat';
};
document.getElementById('lyrHW').onclick = function() {
  state.viz.hw = !state.viz.hw;
  this.classList.toggle('active', state.viz.hw);
  ctx.render();
};
document.getElementById('lyrTR').onclick = function() {
  state.viz.tr = !state.viz.tr;
  this.classList.toggle('active', state.viz.tr);
  ctx.render();
};
document.getElementById('lyrLinks').onclick = function() {
  state.viz.links = !state.viz.links;
  this.classList.toggle('active', state.viz.links);
  ctx.render();
};
document.getElementById('lyrLinks').classList.toggle('active', state.viz.links);

// ========== GPS ==========
document.getElementById('btnLocate').onclick = () => {
  if (!navigator.geolocation) { showInfo('GPS nicht verfügbar', 'err'); return; }
  showInfo('Standort wird gesucht...');
  navigator.geolocation.getCurrentPosition(
    p => { map.setView([p.coords.latitude, p.coords.longitude], 20); showInfo('Standort ✓'); },
    e => showInfo('GPS Fehler: ' + e.message, 'err'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

// ========== Toolbar ==========
document.getElementById('btnCatalog').onclick = () => openCatalog(ctx);
document.getElementById('btnMeta').onclick = () => openMetaDialog();
document.getElementById('btnExport').onclick = () => showInfo('Export wird in Phase 2 überarbeitet — bitte v5 nutzen bis dahin');
document.getElementById('btnKalk').onclick = () => showInfo('Kalkulations-Modal wird in Phase 2 überarbeitet');

// ========== Meta-Dialog (einfach, für Header-Update) ==========
function openMetaDialog() {
  const sheet = document.querySelector('#modalMeta .sheet');
  sheet.innerHTML = `
    <header>
      <h2>Projekt-Daten</h2>
      <button class="close" data-act="close">✕</button>
    </header>
    <div class="body">
      <label>WE-Nummer</label>
      <input id="metaWE" value="${state.meta.we || ''}" placeholder="z.B. 127798">
      <label>Liegenschaft</label>
      <input id="metaLoc" value="${state.meta.loc || ''}" placeholder="z.B. Fabeckstraße, Berlin">
      <label>Datum Begehung</label>
      <input id="metaDate" type="date" value="${state.meta.date || ''}">
      <label>Ersteller</label>
      <input id="metaAuthor" value="${state.meta.author || ''}" placeholder="Christian Galka">
      <label>Bemerkung</label>
      <textarea id="metaNote" rows="3">${state.meta.note || ''}</textarea>
    </div>
    <div class="foot">
      <button class="secondary" data-act="close">Abbruch</button>
      <button class="primary" data-act="save">Speichern</button>
    </div>
  `;
  sheet.onclick = (e) => {
    const act = e.target.dataset.act;
    if (act === 'close') document.getElementById('modalMeta').classList.remove('open');
    if (act === 'save') {
      state.meta.we = document.getElementById('metaWE').value;
      state.meta.loc = document.getElementById('metaLoc').value;
      state.meta.date = document.getElementById('metaDate').value;
      state.meta.author = document.getElementById('metaAuthor').value;
      state.meta.note = document.getElementById('metaNote').value;
      document.getElementById('modalMeta').classList.remove('open');
      updateTotal();
      save();
    }
  };
  document.getElementById('modalMeta').classList.add('open');
}

// ========== Addresse-Suche (Nominatim) ==========
const srchInput = document.getElementById('srchInput');
const srchBtn = document.getElementById('srchBtn');
const srchRes = document.getElementById('srchRes');

async function doSearch() {
  const q = srchInput.value.trim();
  if (!q) { srchRes.classList.remove('show'); return; }
  showInfo('Suche ...');
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1&countrycodes=de,at,ch`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Accept-Language': 'de' } });
    const data = await res.json();
    if (data.length === 0) { showInfo('Keine Treffer', 'err'); srchRes.classList.remove('show'); return; }
    srchRes.innerHTML = data.map((d, i) => `<div class="item" data-i="${i}"><b>${d.display_name.split(',').slice(0,2).join(',')}</b><span style="color:#888;font-size:11px">${d.display_name}</span></div>`).join('');
    srchRes.classList.add('show');
    srchRes._data = data;
    srchRes.querySelectorAll('.item').forEach(el => {
      el.addEventListener('mousedown', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const d = srchRes._data[+el.dataset.i];
        map.setView([+d.lat, +d.lon], 19);
        srchRes.classList.remove('show');
        srchInput.value = d.display_name.split(',')[0];
        showInfo('✓ ' + d.display_name.split(',')[0]);
      });
      el.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        const d = srchRes._data[+el.dataset.i];
        map.setView([+d.lat, +d.lon], 19);
        srchRes.classList.remove('show');
        srchInput.value = d.display_name.split(',')[0];
        showInfo('✓ ' + d.display_name.split(',')[0]);
      }, { passive: false });
    });
  } catch (e) {
    showInfo('Suche fehlgeschlagen', 'err');
    console.warn(e);
  }
}
srchBtn.onclick = doSearch;
srchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
srchInput.addEventListener('focus', () => { if (srchRes.innerHTML) srchRes.classList.add('show'); });
document.addEventListener('mousedown', e => {
  if (!srchRes.contains(e.target) && e.target !== srchInput && e.target !== srchBtn) {
    srchRes.classList.remove('show');
  }
});

// ========== Initialisierung ==========
initModeToggle(ctx);
initMapMode(ctx);
initTraceDrawing(ctx);

// Erste Zeichnung
ctx.render();
setTimeout(() => map.invalidateSize(), 300);
window.addEventListener('resize', () => map.invalidateSize());

// State ins Fenster exponieren für Debugging
window.__tbp = { state, ctx };
console.log('TiefbauPorte v6 · bereit', { catalog: state.catalog.length, objects: state.objects.length, traces: state.traces.length });
