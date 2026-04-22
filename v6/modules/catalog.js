// v6/modules/catalog.js
// Katalog-Dialog (Liste + Add/Edit)

import { openModal, closeModal, fmtEur, escapeHtml, uid } from './ui.js';
import { EMOJI_PICKER_CATEGORIES } from './constants.js';

let currentEditCatId = null;

export function openCatalog(ctx) {
  const sheet = document.querySelector('#modalCatalog .sheet');
  const order = ['Ladeinfrastruktur','Verteilung','Netzanschluss','Ausstattung','Erdung','Durchbruch','Sonstiges'];
  const byCat = {};
  ctx.state.catalog.forEach(c => {
    (byCat[c.category] = byCat[c.category] || []).push(c);
  });

  sheet.innerHTML = `
    <header>
      <h2>Objekt-Katalog</h2>
      <button class="close" data-act="close">✕</button>
    </header>
    <div class="body">
      <p style="font-size:12px;color:#666;margin:4px 0 10px">Objekt antippen → in der Karte tappen zum Setzen.</p>
      <div id="catList">
        ${order.filter(k => byCat[k]).map(cat => `
          <div class="cat-section"><h3>${cat}</h3>
            ${byCat[cat].map(c => {
              const displayIcon = c.iconType === 'text' ? c.icon : (c.defaultEmoji || c.icon);
              return `
                <div class="cat-item ${ctx.state.selectedCat === c.id ? 'sel' : ''}" data-id="${c.id}">
                  <div class="icon ${c.shape || 'shape-hex'}" style="background:${c.color || '#1B2D5E'}">${escapeHtml(displayIcon)}</div>
                  <div class="info">
                    <div class="name">${escapeHtml(c.name)}</div>
                    <div class="price">${c.pos ? escapeHtml(c.pos)+' · ' : ''}${fmtEur(c.price)} / ${escapeHtml(c.unit)}${c.hasAmp?' · A':''}${c.hasKw?' · kW':''}</div>
                  </div>
                  ${ctx.state.uiMode === 'edit' ? `<button class="del" data-edit="${c.id}">✎</button>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
      ${ctx.state.uiMode === 'edit' ? `<button id="catAddBtn" style="width:100%;margin-top:14px;padding:13px;background:var(--green);color:var(--navy);border:none;border-radius:8px;font-weight:bold;font-size:14px;cursor:pointer">+ Eigenes Objekt hinzufügen</button>` : ''}
    </div>
  `;

  sheet.onclick = (e) => {
    if (e.target.dataset.act === 'close') { closeModal('modalCatalog'); return; }
    const editId = e.target.dataset.edit;
    if (editId) { editCat(editId, ctx); return; }
    if (e.target.id === 'catAddBtn') { showAddCatalog(ctx); return; }
    const item = e.target.closest('.cat-item');
    if (item) selectCat(item.dataset.id, ctx);
  };

  openModal('modalCatalog');
}

function selectCat(id, ctx) {
  ctx.state.selectedCat = id;
  closeModal('modalCatalog');
  if (ctx.setMapMode) ctx.setMapMode('pin');
  ctx.save();
}

function showAddCatalog(ctx) {
  currentEditCatId = null;
  renderAddCatSheet(ctx, null);
  openModal('modalAddCat');
}

function editCat(id, ctx) {
  const c = ctx.state.catalog.find(x => x.id === id);
  if (!c) return;
  currentEditCatId = id;
  renderAddCatSheet(ctx, c);
  openModal('modalAddCat');
}

function renderAddCatSheet(ctx, c) {
  const sheet = document.querySelector('#modalAddCat .sheet');
  sheet.innerHTML = `
    <header>
      <h2>${c ? 'Objekt bearbeiten' : 'Neues Objekt'}</h2>
      <button class="close" data-act="close">✕</button>
    </header>
    <div class="body">
      <label>Bezeichnung</label>
      <input id="acName" placeholder="z.B. NWS Netzwerkverteiler" value="${escapeHtml(c?.name || '')}">

      <label>Kürzel (max. 5 Zeichen)</label>
      <input id="acIcon" maxlength="5" placeholder="NWS" value="${escapeHtml(c?.icon || '')}">

      <label>Default-Emoji (Tap für Picker)</label>
      <div style="display:flex;gap:6px">
        <input id="acEmoji" placeholder="🔌" value="${escapeHtml(c?.defaultEmoji || '')}" style="flex:1">
        <button id="acEmojiPickBtn" style="background:var(--navy);color:#fff;border:none;border-radius:6px;padding:0 16px;cursor:pointer;font-family:inherit;font-size:14px">Wählen</button>
      </div>

      <label>Darstellungsart</label>
      <select id="acIconType">
        <option value="hybrid" ${(!c || c.iconType === 'hybrid') ? 'selected' : ''}>Emoji + Kürzel (Hybrid)</option>
        <option value="emoji" ${c?.iconType === 'emoji' ? 'selected' : ''}>Nur Emoji</option>
        <option value="text" ${c?.iconType === 'text' ? 'selected' : ''}>Nur Kürzel</option>
      </select>

      <label>LV-Position (optional)</label>
      <input id="acPos" placeholder="z.B. 24a." value="${escapeHtml(c?.pos || '')}">

      <div class="row">
        <div><label>Einzelpreis (€)</label><input id="acPrice" type="number" step="0.01" value="${c?.price || ''}"></div>
        <div><label>Einheit</label>
          <select id="acUnit">
            <option value="Stk" ${(!c || c.unit === 'Stk') ? 'selected' : ''}>Stück</option>
            <option value="m" ${c?.unit === 'm' ? 'selected' : ''}>Meter</option>
            <option value="psch" ${c?.unit === 'psch' ? 'selected' : ''}>pauschal</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div><label>Farbe</label><input id="acColor" type="color" value="${c?.color || '#1B2D5E'}"></div>
        <div><label>Form</label>
          <select id="acShape">
            <option value="shape-circle" ${c?.shape === 'shape-circle' ? 'selected' : ''}>Kreis</option>
            <option value="shape-square" ${c?.shape === 'shape-square' ? 'selected' : ''}>Quadrat</option>
            <option value="shape-hex" ${(!c || c.shape === 'shape-hex') ? 'selected' : ''}>Abgerundet</option>
          </select>
        </div>
      </div>

      <label>Kategorie</label>
      <select id="acCategory">
        <option value="Ladeinfrastruktur" ${c?.category === 'Ladeinfrastruktur' ? 'selected' : ''}>Ladeinfrastruktur</option>
        <option value="Verteilung" ${c?.category === 'Verteilung' ? 'selected' : ''}>Verteilung</option>
        <option value="Netzanschluss" ${c?.category === 'Netzanschluss' ? 'selected' : ''}>Netzanschluss</option>
        <option value="Ausstattung" ${c?.category === 'Ausstattung' ? 'selected' : ''}>Ausstattung</option>
        <option value="Erdung" ${c?.category === 'Erdung' ? 'selected' : ''}>Erdung</option>
        <option value="Durchbruch" ${c?.category === 'Durchbruch' ? 'selected' : ''}>Durchbruch</option>
        <option value="Sonstiges" ${(!c || c.category === 'Sonstiges') ? 'selected' : ''}>Sonstiges</option>
      </select>

      <label><input type="checkbox" id="acHasAmp" style="width:auto;margin-right:6px" ${c?.hasAmp ? 'checked' : ''}>Stromstärke-Feld (A) anzeigen</label>
      <label><input type="checkbox" id="acHasKw" style="width:auto;margin-right:6px" ${c?.hasKw ? 'checked' : ''}>Leistungs-Feld (kW) anzeigen</label>
    </div>
    <div class="foot">
      <button class="danger" data-act="del" style="display:${c ? 'block' : 'none'}">🗑</button>
      <button class="secondary" data-act="close">Abbruch</button>
      <button class="primary" data-act="save">Speichern</button>
    </div>
  `;

  sheet.onclick = (e) => {
    const act = e.target.dataset.act;
    if (act === 'close') closeModal('modalAddCat');
    if (act === 'save') saveCatalogItem(ctx);
    if (act === 'del') deleteCatalogItem(ctx);
    if (e.target.id === 'acEmojiPickBtn') openEmojiPicker(emoji => {
      document.getElementById('acEmoji').value = emoji;
    });
  };
}

function saveCatalogItem(ctx) {
  const name = document.getElementById('acName').value.trim();
  if (!name) { alert('Bezeichnung erforderlich'); return; }
  const data = {
    name,
    icon: document.getElementById('acIcon').value || '?',
    defaultEmoji: document.getElementById('acEmoji').value || '❓',
    iconType: document.getElementById('acIconType').value,
    pos: document.getElementById('acPos').value,
    price: parseFloat(document.getElementById('acPrice').value) || 0,
    unit: document.getElementById('acUnit').value,
    category: document.getElementById('acCategory').value,
    hasAmp: document.getElementById('acHasAmp').checked,
    hasKw: document.getElementById('acHasKw').checked,
    color: document.getElementById('acColor').value,
    shape: document.getElementById('acShape').value
  };
  if (currentEditCatId) {
    Object.assign(ctx.state.catalog.find(x => x.id === currentEditCatId), data);
  } else {
    data.id = uid();
    ctx.state.catalog.push(data);
  }
  closeModal('modalAddCat');
  openCatalog(ctx);
  ctx.render();
}

function deleteCatalogItem(ctx) {
  if (!currentEditCatId) return;
  if (!confirm('Katalog-Eintrag wirklich löschen?')) return;
  ctx.state.catalog = ctx.state.catalog.filter(x => x.id !== currentEditCatId);
  closeModal('modalAddCat');
  openCatalog(ctx);
  ctx.render();
}

// Emoji-Picker
function openEmojiPicker(onPick) {
  const sheet = document.querySelector('#modalEmojiPicker .sheet');
  let html = `
    <header>
      <h2>Emoji wählen</h2>
      <button class="close" data-act="close">✕</button>
    </header>
    <div class="body">
  `;
  EMOJI_PICKER_CATEGORIES.forEach(cat => {
    html += `<div class="emoji-cat-title">${cat.title}</div><div class="emoji-grid">`;
    cat.emojis.forEach(e => {
      html += `<button data-emoji="${e}">${e}</button>`;
    });
    html += `</div>`;
  });
  html += `
    </div>
    <div class="foot">
      <button class="secondary" data-act="close" style="flex:1">Schließen</button>
    </div>
  `;
  sheet.innerHTML = html;
  sheet.onclick = (e) => {
    if (e.target.dataset.act === 'close') closeModal('modalEmojiPicker');
    if (e.target.dataset.emoji) {
      onPick(e.target.dataset.emoji);
      closeModal('modalEmojiPicker');
    }
  };
  openModal('modalEmojiPicker');
}
