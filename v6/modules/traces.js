// v6/modules/traces.js
// PHASE 1 STUB — Basis-Handling für Trassen-Zeichnung und einfachen Segment-Dialog
// Vollständige Überarbeitung in Phase 2 (dynamische Kabel-Belegung, Custom-Typen).

import { openModal, closeModal, showInfo, uid, fmt, fmtEur, escapeHtml, renderPhotos } from './ui.js';
import { distMeters, totalLen, recalcSegments, cableEffectiveLength, cableUnitPrice } from './calc.js';
import { OF_DEFS, TRACE_COLOR, PRICE_GRABEN, PRICE_HAND } from './constants.js';

let currentTraceId = null;
let currentSegIdx = null;

export function initTraceDrawing(ctx) {
  ctx.currentTrace = null;

  ctx.map.on('click', (e) => {
    if (ctx.state.uiMode === 'view') return;
    if (ctx.mode === 'pin') {
      if (!ctx.state.selectedCat) {
        import('./catalog.js').then(m => m.openCatalog(ctx));
        return;
      }
      const cat = ctx.state.catalog.find(c => c.id === ctx.state.selectedCat);
      if (!cat) return;
      const o = {
        id: uid(),
        catId: cat.id,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        qty: 1,
        price: cat.price,
        amps: '', kw: '', note: '', photos: [],
        customName: '',
        iconTypeOverride: '',
        colorOverride: '',
        shapeOverride: '',
        iconOverride: '',
        linkedTraceId: null,
        linkedSegmentIdx: null
      };
      ctx.state.objects.push(o);
      ctx.render();
    } else if (ctx.mode === 'trace') {
      if (!ctx.currentTrace) ctx.currentTrace = { points: [], line: null };
      ctx.currentTrace.points.push([e.latlng.lat, e.latlng.lng]);
      if (ctx.currentTrace.line) ctx.drawLayer.removeLayer(ctx.currentTrace.line);
      ctx.currentTrace.line = L.polyline(ctx.currentTrace.points, {
        color: TRACE_COLOR, weight: 8, dashArray: '10,6', opacity: .9
      }).addTo(ctx.drawLayer);
      L.circleMarker([e.latlng.lat, e.latlng.lng], {
        radius: 6, color: '#fff', fillColor: TRACE_COLOR, fillOpacity: 1, weight: 2
      }).addTo(ctx.drawLayer);
      let len = 0;
      for (let i = 1; i < ctx.currentTrace.points.length; i++) {
        len += distMeters(ctx.currentTrace.points[i-1], ctx.currentTrace.points[i]);
      }
      showInfo(`Trasse · ${ctx.currentTrace.points.length} Pkt · ${fmt(len)} m`);
      showFinishBtn(ctx, true);
    }
  });

  ctx.map.on('dblclick', () => {
    if (ctx.mode === 'trace' && ctx.currentTrace && ctx.currentTrace.points.length >= 2) {
      finishTrace(ctx);
    }
  });
  ctx.map.doubleClickZoom.disable();
}

let finishBtn = null;
function showFinishBtn(ctx, show) {
  if (show && !finishBtn) {
    finishBtn = document.createElement('button');
    finishBtn.className = 'fab';
    finishBtn.textContent = '✓ Trasse fertig';
    finishBtn.onclick = () => finishTrace(ctx);
    document.getElementById('map').appendChild(finishBtn);
  } else if (!show && finishBtn) {
    finishBtn.remove();
    finishBtn = null;
  }
}

function finishTrace(ctx) {
  if (!ctx.currentTrace || ctx.currentTrace.points.length < 2) {
    showInfo('Mindestens 2 Punkte', 'err');
    return;
  }
  const segments = [];
  for (let i = 0; i < ctx.currentTrace.points.length - 1; i++) {
    segments.push({
      of: 'OF0', hand: false,
      len: distMeters(ctx.currentTrace.points[i], ctx.currentTrace.points[i+1])
    });
  }
  const t = {
    id: uid(),
    points: ctx.currentTrace.points,
    segments,
    cables: [],  // v6: leer starten, User fügt per + Button hinzu (Phase 2)
    note: '', photos: []
  };
  ctx.state.traces.push(t);
  ctx.drawLayer.clearLayers();
  ctx.currentTrace = null;
  showFinishBtn(ctx, false);
  ctx.render();
  openTrace(t.id, ctx);
}

// ===== Trace Detail Dialog (Phase-1-Version, basic) =====
export function openTrace(id, ctx) {
  const t = ctx.state.traces.find(x => x.id === id);
  if (!t) return;
  currentTraceId = id;
  recalcSegments(t);

  const sheet = document.querySelector('#modalTrace .sheet');
  const len = totalLen(t);

  sheet.innerHTML = `
    <header>
      <h2>Trasse · Kabelgraben</h2>
      <button class="close" data-act="close">✕</button>
    </header>
    <div class="body">
      <div id="traceInfo" style="background:var(--bg);padding:10px;border-radius:6px;margin-bottom:10px;font-size:13px">
        <b>Gesamtlänge:</b> ${fmt(len)} m · ${t.points.length} Punkte · ${t.segments.length} Segmente
      </div>

      <h3 style="color:var(--navy);font-size:13px;margin:14px 0 4px">Segmente (Oberfläche pro Abschnitt)</h3>
      <small style="color:#666">Segment antippen → Oberfläche wechseln. Geht auch direkt in der Karte.</small>
      <div id="trSegList" class="seg-list"></div>

      <h3 style="color:var(--navy);font-size:13px;margin:14px 0 4px">Leitungs-Belegung im Graben</h3>
      <small style="color:#666">${t.cables && t.cables.length ? 'Liste der im Graben liegenden Leitungen.' : 'Noch keine Leitungen zugewiesen. Vollständiger Editor kommt in Phase 2.'}</small>
      <div id="trCables" style="margin-top:4px"></div>

      <label>Notiz</label>
      <textarea id="trNote" rows="2">${escapeHtml(t.note || '')}</textarea>

      <label>Fotos</label>
      <div class="photos" id="trPhotos"></div>

      <h3 style="color:var(--navy);font-size:13px;margin:14px 0 4px">Trassen-Punkte</h3>
      <div id="trPoints" class="pt-list"></div>

      <div id="trSum" style="margin-top:12px;padding:12px;background:var(--navy);color:#fff;border-radius:6px;font-weight:bold;text-align:right;font-size:13px"></div>
    </div>
    <div class="foot">
      <button class="danger" data-act="del">🗑</button>
      <button class="secondary" data-act="close">Abbruch</button>
      <button class="primary" data-act="save">Speichern</button>
    </div>
  `;

  renderTraceSegments(t, ctx);
  renderCablesSimple(t);
  renderTracePoints(t, ctx);
  if (!t.photos) t.photos = [];
  renderPhotos('trPhotos', t.photos, () => updateTraceSum(t));
  updateTraceSum(t);

  sheet.onclick = (e) => {
    const act = e.target.dataset.act;
    if (act === 'close') closeModal('modalTrace');
    if (act === 'del') deleteCurrentTrace(ctx);
    if (act === 'save') saveCurrentTrace(ctx);
  };

  openModal('modalTrace');
}

function renderTraceSegments(t, ctx) {
  const c = document.getElementById('trSegList');
  c.innerHTML = '';
  t.segments.forEach((seg, i) => {
    const def = OF_DEFS[seg.of];
    const d = document.createElement('div');
    d.className = 'seg';
    d.innerHTML = `
      <div class="n">#${i+1}</div>
      <div class="of" style="background:${def?.color || TRACE_COLOR}">${seg.of}</div>
      <div class="len">${escapeHtml(def?.label || '')} · ${fmt(seg.len)} m</div>
      ${seg.hand ? '<div class="hand">HAND</div>' : ''}
      <button class="seg-del" data-seg="${i}" title="Segment löschen">🗑</button>
      <div style="color:#999;font-size:16px">›</div>
    `;
    d.onclick = (e) => {
      if (e.target.classList.contains('seg-del')) {
        e.stopPropagation();
        deleteSegment(t, i, ctx);
        return;
      }
      openSeg(t.id, i, ctx);
    };
    c.appendChild(d);
  });
}

function renderCablesSimple(t) {
  const c = document.getElementById('trCables');
  if (!t.cables || !t.cables.length) {
    c.innerHTML = '<div style="padding:10px;color:#999;font-size:12px;background:var(--bg);border-radius:6px">Keine Leitungen eingetragen.</div>';
    return;
  }
  let html = '<div style="border:1px solid #e0e0e0;border-radius:6px">';
  t.cables.forEach(cab => {
    const reserveStr = cab.reserveMode === 'm' ? `+${cab.reserveValue} m` : `+${cab.reserveValue} %`;
    html += `
      <div style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;display:flex;align-items:center;gap:8px">
        <div style="flex:1">
          <div style="font-weight:600;color:var(--navy)">${escapeHtml(cab.label)}</div>
          <small style="color:#888">${cab.count}× · Reserve ${reserveStr} · ${fmt(cableUnitPrice(cab))} €/m</small>
        </div>
      </div>
    `;
  });
  html += '</div>';
  c.innerHTML = html;
}

function renderTracePoints(t, ctx) {
  const c = document.getElementById('trPoints');
  c.innerHTML = '';
  t.points.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'pt';
    d.innerHTML = `
      <div class="n">${i+1}</div>
      <div class="coords">${p[0].toFixed(6)}, ${p[1].toFixed(6)}</div>
    `;
    const btn = document.createElement('button');
    btn.className = 'del';
    btn.textContent = '🗑';
    btn.onclick = () => {
      if (t.points.length <= 2) { alert('Mindestens 2 Punkte erforderlich'); return; }
      if (!confirm(`Punkt #${i+1} löschen?`)) return;
      t.points.splice(i, 1);
      if (i === 0) t.segments.splice(0, 1);
      else if (i >= t.points.length) t.segments.splice(i-1, 1);
      else t.segments.splice(i-1, 1);
      recalcSegments(t);
      renderTracePoints(t, ctx);
      renderTraceSegments(t, ctx);
      updateTraceSum(t);
      ctx.render();
    };
    d.appendChild(btn);
    c.appendChild(d);
  });
}

function deleteSegment(t, idx, ctx) {
  if (t.segments.length <= 1) { alert('Letztes Segment kann nicht gelöscht werden. Ganze Trasse löschen?'); return; }
  if (!confirm(`Segment #${idx+1} löschen? Die verbleibenden Punkte werden neu verbunden.`)) return;
  // Endpunkt des Segments entfernen
  const pointToRemove = idx + 1; // segment idx endet am Punkt idx+1
  if (pointToRemove >= t.points.length) return;
  t.points.splice(pointToRemove, 1);
  t.segments.splice(idx, 1);
  recalcSegments(t);
  renderTraceSegments(t, ctx);
  renderTracePoints(t, ctx);
  updateTraceSum(t);
  ctx.render();
}

function updateTraceSum(t) {
  const len = totalLen(t);
  let sumTiefbau = 0;
  t.segments.forEach(seg => {
    const def = OF_DEFS[seg.of]; if (!def) return;
    sumTiefbau += seg.len * (def.prOF + def.prWH + (seg.hand ? PRICE_HAND : PRICE_GRABEN));
  });
  let sumCable = 0;
  (t.cables || []).forEach(c => {
    const n = Number(c.count) || 0;
    if (n <= 0) return;
    sumCable += cableEffectiveLength(c, len) * n * cableUnitPrice(c);
  });
  const total = sumTiefbau + sumCable;
  const sumEl = document.getElementById('trSum');
  if (sumEl) {
    sumEl.innerHTML = `Tiefbau: ${fmtEur(sumTiefbau)} · Kabel: ${fmtEur(sumCable)}<br><span style="font-size:16px">Σ Trasse: ${fmtEur(total)}</span>`;
  }
}

function saveCurrentTrace(ctx) {
  const t = ctx.state.traces.find(x => x.id === currentTraceId);
  if (!t) return;
  t.note = document.getElementById('trNote').value;
  closeModal('modalTrace');
  ctx.render();
}

function deleteCurrentTrace(ctx) {
  if (!confirm('Trasse wirklich löschen?')) return;
  ctx.state.traces = ctx.state.traces.filter(x => x.id !== currentTraceId);
  closeModal('modalTrace');
  ctx.render();
}

// ===== Segment Editor =====
export function openSeg(traceId, segIdx, ctx) {
  const t = ctx.state.traces.find(x => x.id === traceId);
  if (!t) return;
  currentTraceId = traceId;
  currentSegIdx = segIdx;
  const seg = t.segments[segIdx];

  const sheet = document.querySelector('#modalSeg .sheet');
  sheet.innerHTML = `
    <header>
      <h2>Segment #${segIdx+1}</h2>
      <button class="close" data-act="close">✕</button>
    </header>
    <div class="body">
      <div style="background:var(--bg);padding:10px;border-radius:6px;margin-bottom:10px;font-size:13px">
        <b>Länge:</b> ${fmt(seg.len)} m · Aktuell: ${seg.of}${seg.hand?' (Hand)':''}
      </div>
      <label>Oberfläche</label>
      <select id="segOF">
        <option value="OF0" ${seg.of==='OF0'?'selected':''}>🟢 OF0 · unbefestigt / Rasen · 38,50 + 28,60 €/m</option>
        <option value="OF1" ${seg.of==='OF1'?'selected':''}>🟡 OF1 · Pflaster · 50,60 + 28,60 €/m</option>
        <option value="OF2" ${seg.of==='OF2'?'selected':''}>🟠 OF2 · Beton · 291,61 + 35,20 €/m</option>
        <option value="OF3" ${seg.of==='OF3'?'selected':''}>🔴 OF3 · Asphalt · 187,00 + 35,20 €/m</option>
      </select>
      <label><input type="checkbox" id="segHand" style="width:auto;margin-right:6px" ${seg.hand?'checked':''}>In Handschachtung (89,10 €/m statt 159,50 €/m)</label>
      <hr style="margin:16px 0">
      <button id="segOpenTrace" style="width:100%;padding:13px;background:var(--green);color:var(--navy);border:none;border-radius:8px;font-weight:bold;font-size:13px;cursor:pointer">→ Zur Kabelbelegung der gesamten Trasse</button>
    </div>
    <div class="foot">
      <button class="secondary" data-act="close">Abbruch</button>
      <button class="primary" data-act="save">Übernehmen</button>
    </div>
  `;
  sheet.onclick = (e) => {
    const act = e.target.dataset.act;
    if (act === 'close') closeModal('modalSeg');
    if (act === 'save') saveCurrentSeg(ctx);
    if (e.target.id === 'segOpenTrace') {
      saveCurrentSeg(ctx, true);
      openTrace(currentTraceId, ctx);
    }
  };
  openModal('modalSeg');
}

function saveCurrentSeg(ctx, keepOpen) {
  const t = ctx.state.traces.find(x => x.id === currentTraceId);
  if (!t) return;
  const seg = t.segments[currentSegIdx];
  seg.of = document.getElementById('segOF').value;
  seg.hand = document.getElementById('segHand').checked;
  if (!keepOpen) closeModal('modalSeg');
  ctx.render();
}
