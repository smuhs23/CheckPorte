// v6/modules/kalk.js
// Kalkulations-Dialog mit voller Aufschlüsselung

import { openModal, closeModal, fmt, fmtEur, escapeHtml } from './ui.js';
import { calcTotals, cableEffectiveLength, cableUnitPrice } from './calc.js';
import { OF_DEFS } from './constants.js';

export function openKalk(ctx) {
  const t = calcTotals(ctx.state);
  const sheet = document.querySelector('#modalKalk .sheet');

  let html = `
    <header>
      <h2>Kalkulation</h2>
      <button class="close" data-act="close">✕</button>
    </header>
    <div class="body" id="kalkBody">
  `;

  // ========== HARDWARE ==========
  html += '<div class="kalk-section"><h3>📍 Hardware (AG-Eigentum inkl. Einrichtung)</h3>';
  if (Object.keys(t.byCat).length === 0) {
    html += '<div style="color:#999;padding:8px;font-size:12px">Keine Objekte erfasst</div>';
  }
  Object.entries(t.byCat).forEach(([cat, items]) => {
    html += `<div style="font-weight:bold;color:var(--navy);margin:6px 0 4px;font-size:12px">${escapeHtml(cat)}</div>`;
    html += '<div class="kalk-row head"><div>Position</div><div class="right">Menge</div><div class="right">EP</div><div class="right">Summe</div></div>';
    items.forEach(it => {
      const nameHtml = it.customName ? `${escapeHtml(it.customName)} <small style="color:#888">(${escapeHtml(it.name)})</small>` : escapeHtml(it.name);
      html += `<div class="kalk-row"><div>${nameHtml}</div><div class="right">${it.qty} ${escapeHtml(it.unit)}</div><div class="right">${fmt(it.price)}</div><div class="right">${fmt(it.sum)}</div></div>`;
    });
  });
  html += `<div class="kalk-total"><span>Σ Hardware</span><span>${fmtEur(t.sumObj)}</span></div></div>`;

  // ========== TIEFBAU ==========
  html += '<div class="kalk-section"><h3>🚧 Tiefbau & Installation</h3>';
  if (t.traceRows.length === 0) {
    html += '<div style="color:#999;padding:8px;font-size:12px">Keine Trassen</div>';
  } else {
    html += '<div class="kalk-row head"><div>Trasse</div><div class="right">Länge</div><div class="right">Reserve</div><div class="right">Summe</div></div>';
    t.traceRows.forEach((r, i) => {
      const ofs = Object.entries(r.ofBreak).map(([k, v]) => `${k}:${fmt(v)}m`).join(' · ');
      html += `<div class="kalk-row"><div>#${i+1} <small style="color:#888">${ofs}</small></div><div class="right">${fmt(r.len)} m</div><div class="right"></div><div class="right">${fmt(r.total)}</div></div>`;
      // Tiefbau-Split
      html += `<div class="kalk-row" style="font-size:10px;color:#666"><div>&nbsp;&nbsp;└ Oberfläche Aufn. + WH</div><div class="right"></div><div class="right"></div><div class="right">${fmt(r.tOF + r.tWH)}</div></div>`;
      html += `<div class="kalk-row" style="font-size:10px;color:#666"><div>&nbsp;&nbsp;└ Graben</div><div class="right"></div><div class="right"></div><div class="right">${fmt(r.tGR)}</div></div>`;
      // Kabel-Details
      (r.cableBreak || []).forEach(info => {
        const reserveStr = info.reserveMode === 'm' ? `+${info.reserveValue}m` : `+${info.reserveValue}%`;
        html += `<div class="kalk-row" style="font-size:10px;color:#666"><div>&nbsp;&nbsp;└ ${escapeHtml(info.label)} ${info.count}×</div><div class="right">${fmt(info.effLen)} m</div><div class="right">${reserveStr}</div><div class="right">${fmt(info.cost)}</div></div>`;
      });
    });
    html += `<div style="font-size:11px;color:#666;margin-top:6px;padding:6px">Oberfläche (Aufn.+WH): ${fmtEur(t.sumOF)} · Graben: ${fmtEur(t.sumGraben)} · Kabel: ${fmtEur(t.sumCable)}</div>`;
  }
  html += `<div class="kalk-total"><span>Σ Tiefbau</span><span>${fmtEur(t.sumTrace)}</span></div></div>`;

  // ========== AUFSCHLÄGE ==========
  if (t.surchargeKonta > 0 || t.surchargeDenk > 0) {
    html += '<div class="kalk-section"><h3>⚠ Aufschläge Standort</h3>';
    if (t.surchargeKonta > 0) {
      html += `<div class="kalk-row"><div>☣ Kontamination ${ctx.state.meta.kontaPct}%</div><div></div><div></div><div class="right">${fmt(t.surchargeKonta)}</div></div>`;
    }
    if (t.surchargeDenk > 0) {
      html += `<div class="kalk-row"><div>🛡 Denkmalschutz ${ctx.state.meta.denkPct}%</div><div></div><div></div><div class="right">${fmt(t.surchargeDenk)}</div></div>`;
    }
    html += '</div>';
  }

  // ========== GESAMT ==========
  html += '<div class="kalk-section"><h3>💰 Gesamt</h3>';
  html += `<div class="kalk-row"><div>Netto</div><div></div><div></div><div class="right">${fmt(t.netto)}</div></div>`;
  if (ctx.state.meta.gk > 0) html += `<div class="kalk-row"><div>GK ${ctx.state.meta.gk}%</div><div></div><div></div><div class="right">${fmt(t.gk)}</div></div>`;
  if (ctx.state.meta.wg > 0) html += `<div class="kalk-row"><div>W+G ${ctx.state.meta.wg}%</div><div></div><div></div><div class="right">${fmt(t.wg)}</div></div>`;
  html += `<div class="kalk-total"><span>GESAMT</span><span>${fmtEur(t.total)}</span></div></div>`;

  html += `
    </div>
    <div class="foot">
      <button class="secondary" data-act="close">Schließen</button>
      <button class="primary" data-act="pdf">📄 PDF exportieren</button>
    </div>
  `;

  sheet.innerHTML = html;
  sheet.onclick = async (e) => {
    const act = e.target.dataset.act;
    if (act === 'close') closeModal('modalKalk');
    if (act === 'pdf') {
      closeModal('modalKalk');
      const mod = await import('./exportPdf.js');
      mod.doExportPDF(ctx);
    }
  };

  openModal('modalKalk');
}
