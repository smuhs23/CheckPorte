// v6/modules/render.js
// Zeichnet Pins und Trassen auf die Karte, erstellt Legende

import { OF_DEFS, TRACE_COLOR } from './constants.js';
import { escapeHtml } from './ui.js';

export function getPinStyle(o, state) {
  const cat = state.catalog.find(c => c.id === o.catId) || {};
  const iconType = o.iconTypeOverride || cat.iconType || 'hybrid';
  const emoji = cat.defaultEmoji || '❓';
  const kuerz = cat.icon || '?';

  // iconOverride kann Emoji ODER Textkürzel sein
  let displayIcon = emoji;
  let displayKuerz = kuerz;
  if (o.iconOverride) {
    // Heuristik: wenn iconType emoji/hybrid → override als emoji
    if (iconType === 'text') {
      displayKuerz = o.iconOverride;
    } else {
      displayIcon = o.iconOverride;
    }
  }

  return {
    color: o.colorOverride || cat.color || '#1B2D5E',
    shape: o.shapeOverride || cat.shape || 'shape-hex',
    iconType,
    displayIcon,
    displayKuerz,
    cat
  };
}

function buildPinHtml(o, s) {
  const hasPhoto = (o.photos && o.photos.length > 0);
  const valLabel = [];
  if (s.cat.hasKw && o.kw) valLabel.push(o.kw + 'kW');
  if (s.cat.hasAmp && o.amps) valLabel.push(o.amps + 'A');
  const valHtml = valLabel.length ? `<div class="val">${valLabel.join('·')}</div>` : '';
  const qtyHtml = o.qty > 1 ? `<div class="qty">×${o.qty}</div>` : '';

  let inner;
  if (s.iconType === 'hybrid') {
    inner = `${s.displayIcon}<div class="kuerz">${escapeHtml(s.displayKuerz)}</div>${valHtml}${qtyHtml}`;
  } else if (s.iconType === 'emoji') {
    inner = `${s.displayIcon}${valHtml}${qtyHtml}`;
  } else {
    // text
    inner = `${escapeHtml(s.displayKuerz)}${valHtml}${qtyHtml}`;
  }

  const labelHtml = o.customName
    ? `<div class="pin-label">${escapeHtml(o.customName)}</div>`
    : '';

  return { inner, labelHtml, hasPhoto };
}

function renderPins(ctx) {
  const { state, objLayer, mode } = ctx;
  objLayer.clearLayers();
  if (!state.viz.hw) return;

  state.objects.forEach(o => {
    const s = getPinStyle(o, state);
    if (!s.cat.id) return;

    const { inner, labelHtml, hasPhoto } = buildPinHtml(o, s);
    const cls = `mlabel ${s.shape} ${hasPhoto ? 'has-photo' : ''} icon-${s.iconType} ${mode === 'drag' ? 'draggable-mark' : ''}`;
    const html = `<div class="${cls}" style="background:${s.color}">${inner}</div>${labelHtml}`;

    const icon = L.divIcon({ html, className:'', iconSize:[48, 48] });
    const m = L.marker([o.lat, o.lng], { icon, draggable: mode === 'drag' }).addTo(objLayer);

    // Long-press vs. tap handling
    let pressTimer = null;
    let longPressFired = false;

    const startPress = (e) => {
      longPressFired = false;
      pressTimer = setTimeout(() => {
        longPressFired = true;
        if (state.uiMode === 'edit') {
          import('./objects.js').then(mod => mod.openObjDialogEdit(o.id, ctx));
        }
      }, 500);
    };
    const clearPress = () => { clearTimeout(pressTimer); };

    m.on('mousedown', startPress);
    m.on('mouseup', clearPress);
    m.on('mouseout', clearPress);
    m.on('touchstart', startPress);
    m.on('touchend', clearPress);
    m.on('touchcancel', clearPress);

    m.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (longPressFired) { longPressFired = false; return; }
      import('./objects.js').then(mod => mod.openObjDialogInfo(o.id, ctx));
    });

    // Desktop right-click als Edit-Shortcut
    m.on('contextmenu', (e) => {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      if (state.uiMode === 'edit') {
        import('./objects.js').then(mod => mod.openObjDialogEdit(o.id, ctx));
      }
    });

    m.on('dragend', (e) => {
      const p = e.target.getLatLng();
      o.lat = p.lat; o.lng = p.lng;
      ctx.save();
    });

    // Tooltip
    const tipParts = [];
    if (o.customName) tipParts.push(o.customName);
    tipParts.push(s.cat.name);
    if (o.qty > 1) tipParts.push('×' + o.qty);
    if (o.amps) tipParts.push(o.amps + 'A');
    if (o.kw) tipParts.push(o.kw + 'kW');
    m.bindTooltip(tipParts.join(' · '), { direction:'top', offset:[0, -26] });
  });
}

function renderTraces(ctx) {
  const { state, traceLayer, mode } = ctx;
  traceLayer.clearLayers();
  if (!state.viz.tr) return;

  state.traces.forEach(t => {
    for (let i = 0; i < t.segments.length; i++) {
      const seg = t.segments[i];
      const a = t.points[i], b = t.points[i+1];
      const col = OF_DEFS[seg.of]?.color || TRACE_COLOR;
      const pl = L.polyline([a, b], { color:col, weight:9, opacity:.95, lineCap:'round' }).addTo(traceLayer);

      pl.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (state.uiMode !== 'edit') return;
        import('./traces.js').then(mod => {
          if (e.originalEvent && e.originalEvent.shiftKey) mod.openTrace(t.id, ctx);
          else mod.openSeg(t.id, i, ctx);
        });
      });
      pl.bindTooltip(
        `Seg ${i+1}: ${seg.of} ${OF_DEFS[seg.of]?.label||''}${seg.hand?' · Hand':''} · ${seg.len.toFixed(1)} m`,
        { sticky: true }
      );
    }

    // Vertex-Punkte
    t.points.forEach((p, i) => {
      if (mode === 'drag' && state.uiMode === 'edit') {
        const col = i < t.segments.length
          ? (OF_DEFS[t.segments[i].of]?.color || TRACE_COLOR)
          : (i > 0 ? OF_DEFS[t.segments[i-1].of]?.color || TRACE_COLOR : TRACE_COLOR);
        const vm = L.marker(p, {
          icon: L.divIcon({
            html: `<div style="background:#fff;border:3px solid ${col};border-radius:50%;width:24px;height:24px;margin-left:-12px;margin-top:-12px;box-shadow:0 2px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:10px;color:${col};font-weight:bold">${i+1}</div>`,
            className: '', iconSize:[24,24]
          }),
          draggable: true
        }).addTo(traceLayer);

        let lastTap = 0;
        vm.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const now = Date.now();
          if (now - lastTap < 500) {
            if (t.points.length <= 2) {
              import('./ui.js').then(m => m.showInfo('Mindestens 2 Punkte erforderlich', 'err'));
              return;
            }
            if (confirm(`Punkt #${i+1} löschen?`)) {
              t.points.splice(i, 1);
              if (i === 0) t.segments.splice(0, 1);
              else if (i === t.points.length) t.segments.splice(i-1, 1);
              else t.segments.splice(i-1, 1);
              import('./calc.js').then(m => {
                m.recalcSegments(t);
                ctx.save();
                ctx.render();
              });
            }
          }
          lastTap = now;
        });
        vm.on('drag', (e) => {
          const np = e.target.getLatLng();
          t.points[i] = [np.lat, np.lng];
          renderTraces(ctx);
        });
        vm.on('dragend', () => {
          import('./calc.js').then(m => {
            m.recalcSegments(t);
            ctx.save();
            ctx.render();
          });
        });
      } else {
        const col = i < t.segments.length
          ? (OF_DEFS[t.segments[i].of]?.color || TRACE_COLOR)
          : (i > 0 ? OF_DEFS[t.segments[i-1].of]?.color || TRACE_COLOR : TRACE_COLOR);
        L.circleMarker(p, { radius:4, color:'#fff', fillColor:col, fillOpacity:1, weight:2 }).addTo(traceLayer);
      }
    });
  });
}

export function renderLegend(state) {
  const el = document.getElementById('legend');
  if (!el) return;
  const usedCats = new Set();
  state.objects.forEach(o => {
    const cat = state.catalog.find(c => c.id === o.catId);
    if (!cat) return;
    const iconType = o.iconTypeOverride || cat.iconType || 'hybrid';
    const disp = iconType === 'text' ? cat.icon : (cat.defaultEmoji || cat.icon);
    usedCats.add(cat.id + '|' + (o.colorOverride || cat.color) + '|' + disp + '|' + cat.name);
  });
  const hasTraces = state.traces.length > 0;
  const hasObjects = usedCats.size > 0;

  el.style.display = 'block';
  let html = '';
  if (hasObjects) {
    html += '<div class="title">Assets</div>';
    Array.from(usedCats).forEach(k => {
      const [id, col, ic, nm] = k.split('|');
      html += `<div class="row"><div class="sw" style="background:${col}"></div>${escapeHtml(ic)} · ${escapeHtml(nm)}</div>`;
    });
  }
  if (hasTraces) {
    if (hasObjects) html += '<hr>';
    html += '<div class="title">Kabelgräben (Oberfläche)</div>';
    Object.entries(OF_DEFS).forEach(([k, d]) => {
      html += `<div class="row"><div class="sw line" style="background:${d.color};height:5px"></div>${k} ${d.label}</div>`;
    });
  }
  if (!hasObjects && !hasTraces) {
    html += '<div style="font-size:10px;color:#999">Noch keine Objekte erfasst</div>';
  }
  html += '<button class="lgBtn" id="lgCatalogBtn">📋 Katalog öffnen</button>';
  el.innerHTML = html;
  L.DomEvent.disableClickPropagation(el);

  const btn = document.getElementById('lgCatalogBtn');
  if (btn) btn.onclick = () => document.getElementById('btnCatalog').click();
}

export function render(ctx) {
  renderPins(ctx);
  renderTraces(ctx);
  renderLegend(ctx.state);
  ctx.updateTotal();
  ctx.save();
}
