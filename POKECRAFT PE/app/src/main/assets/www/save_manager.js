// ==========================================================================
// PokéCRAFT PE - Mobile 6-Slot Save Manager & Isolated State Storage
// 100% Isolated Mobile PE Storage with Screenshots & Live Game Details
// ==========================================================================

(() => {
  const TOTAL_SLOTS = 6;
  const PROFILE = 'mobile';
  const STORAGE_PREFIX = 'pokecraft_mobile_slot_';
  const ACTIVE_SLOT_KEY = 'pokecraft_mobile_active_slot';

  // Reliable touch / click tap handler defined at top-level scope
  const addTap = (el, fn) => {
    if (!el) return;
    let handled = false;
    const h = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (handled) return;
      handled = true;
      setTimeout(() => { handled = false; }, 280);
      fn(e);
    };
    el.addEventListener('pointerdown', h);
    el.addEventListener('click', h);
  };

  function getActiveSlot() {
    try {
      const val = localStorage.getItem(ACTIVE_SLOT_KEY);
      if (val) return Number(val);
    } catch (e) {}
    return 1;
  }

  function setActiveSlot(slotId) {
    try {
      localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
    } catch (e) {}
    activeSlot = Number(slotId);
  }

  function getSlotData(slotId) {
    try {
      return localStorage.getItem(STORAGE_PREFIX + slotId);
    } catch (e) {
      return null;
    }
  }

  let activeSlot = getActiveSlot();

  // Toast notification system
  function showToast(msg, isSuccess = true) {
    let toast = document.getElementById('emulator-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'emulator-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  // Capture canvas thumbnail (3:2 ratio)
  function captureThumbnail() {
    try {
      const canvas = document.getElementById('game');
      if (!canvas) return null;
      const thumb = document.createElement('canvas');
      thumb.width = 160;
      thumb.height = 106;
      const tctx = thumb.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
      return thumb.toDataURL('image/jpeg', 0.65);
    } catch (e) {
      return null;
    }
  }

  // Gather current save state
  async function gatherSaveState() {
    if (window.__pokeGame && window.__pokeGame.save) {
      try { await Promise.resolve(window.__pokeGame.save()); } catch (e) {}
    } else if (window.__pokeGameSave) {
      try { await Promise.resolve(window.__pokeGameSave()); } catch (e) {}
    }

    const stateData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('poke-') || key.startsWith('pokecraft-'))) {
        stateData[key] = localStorage.getItem(key);
      }
    }

    const now = new Date();
    const dateFormatted = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' +
                          now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    let location = 'Classic Kanto';
    let health = 20;
    let level = 1;
    let playTime = '0m';
    let partyCount = 0;

    // Inspect live game state if running
    try {
      if (window.__pokeGame) {
        const P = window.__pokeGame.getPlayer ? window.__pokeGame.getPlayer() : null;
        if (P) {
          level = P.level || 1;
          health = P.health !== undefined ? P.health : 20;
        }
        const W = window.__pokeGame.getWorld ? window.__pokeGame.getWorld() : null;
        if (W && W.name) {
          location = W.name;
        }
        const G = window.__pokeGame.getGame ? window.__pokeGame.getGame() : null;
        if (G) {
          if (G.playTime) playTime = `${Math.floor(G.playTime / 60)}m`;
          if (Array.isArray(G.party)) partyCount = G.party.length;
        }
      }
    } catch (e) {}

    // Fallback: inspect saved game JSON
    try {
      const mainSaveRaw = localStorage.getItem('poke-redstone-v1') || localStorage.getItem('poke-redstone');
      if (mainSaveRaw) {
        const parsed = JSON.parse(mainSaveRaw);
        if (parsed.P) {
          level = parsed.P.level || level;
          health = parsed.P.health !== undefined ? parsed.P.health : health;
        }
        if (parsed.playTime) {
          playTime = `${Math.floor(parsed.playTime / 60)}m`;
        }
        if (parsed.world && parsed.world.name) {
          location = parsed.world.name;
        } else if (parsed.layoutId) {
          location = 'Kanto (' + parsed.layoutId + ')';
        }
        if (Array.isArray(parsed.party)) {
          partyCount = parsed.party.length;
        }
      }
    } catch (e) {}

    const info = {
      timestamp: Date.now(),
      dateStr: dateFormatted,
      thumbnail: captureThumbnail(),
      location,
      playTime,
      health,
      level,
      partyCount
    };

    return {
      version: 1,
      profile: PROFILE,
      info,
      storage: stateData
    };
  }

  // Save to slot
  async function saveToSlot(slotId) {
    try {
      const bundle = await gatherSaveState();
      localStorage.setItem(STORAGE_PREFIX + slotId, JSON.stringify(bundle));
      setActiveSlot(slotId);
      setTimeout(() => updateSaveDropdownSlots(), 60);
      showToast(`💾 Saved to Mobile Slot ${slotId}`);
      if (window.AndroidHost && window.AndroidHost.vibrate) window.AndroidHost.vibrate(25);
    } catch (err) {
      console.error(err);
      showToast(`❌ Error saving to slot ${slotId}`, false);
    }
  }

  // Load from slot
  async function loadFromSlot(slotId) {
    const raw = getSlotData(slotId);
    if (!raw) {
      showToast(`⚠️ Slot ${slotId} is empty!`, false);
      return;
    }
    try {
      const bundle = JSON.parse(raw);
      if (bundle && bundle.storage) {
        for (const [k, v] of Object.entries(bundle.storage)) {
          localStorage.setItem(k, v);
        }
      }
      setActiveSlot(slotId);
      setTimeout(() => updateSaveDropdownSlots(), 60);
      showToast(`📂 Loaded Slot ${slotId}! Resuming...`);
      if (window.AndroidHost && window.AndroidHost.vibrate) window.AndroidHost.vibrate(30);
      closeSaveDropdown();

      let inMemoryLoaded = false;
      if (window.__pokeGame && typeof window.__pokeGame.load === 'function') {
        try {
          inMemoryLoaded = window.__pokeGame.load();
        } catch (e) {
          console.warn('In-memory load failed, reloading window...', e);
        }
      }
      if (!inMemoryLoaded) {
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    } catch (err) {
      console.error(err);
      showToast(`❌ Error loading slot ${slotId}`, false);
    }
  }

  // Export slot as .sav
  function exportSlot(slotId) {
    const raw = getSlotData(slotId);
    if (!raw) {
      showToast(`⚠️ Slot ${slotId} is empty!`, false);
      return;
    }
    try {
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PokeCraft_PE_Slot${slotId}_${Date.now()}.sav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`⬇ Exported Slot ${slotId} as .sav`);
    } catch (err) {
      showToast(`❌ Export failed`, false);
    }
  }

  // Import .sav file
  function importSaveFile(file, slotId) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = JSON.parse(text);
        if (!parsed.storage) throw new Error('Invalid save file');
        parsed.profile = PROFILE;
        localStorage.setItem(STORAGE_PREFIX + slotId, JSON.stringify(parsed));
        setActiveSlot(slotId);
        updateSaveDropdownSlots();
        showToast(`📥 Imported save into Slot ${slotId}!`);
      } catch (err) {
        showToast('❌ Invalid .sav file format', false);
      }
    };
    reader.readAsText(file);
  }

  // Update 6 Mobile Slots in Dropdown Sheet
  function updateSaveDropdownSlots() {
    const listEl = document.getElementById('save-dropdown-slots-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
      const raw = getSlotData(i);
      const row = document.createElement('div');
      row.className = `save-menu-slot-row ${i === activeSlot ? 'active' : ''} ${raw ? 'has-data' : 'empty'}`;
      row.dataset.slot = String(i);

      let info = {};
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          info = parsed.info || {};
        } catch (e) {}
      }

      row.innerHTML = `
        <div class="save-slot-thumb-container">
          ${info.thumbnail
            ? `<img src="${info.thumbnail}" class="save-slot-thumb-img" alt="Slot ${i}">`
            : `<div class="save-slot-thumb-empty"><span>EMPTY</span></div>`
          }
          <span class="save-slot-badge-num">SLOT ${i}</span>
        </div>

        <div class="save-slot-details-container">
          <div class="save-slot-row-top">
            <span class="save-slot-title">Slot ${i} · ${info.location || (raw ? 'Classic Kanto' : 'Empty')}</span>
            ${i === activeSlot ? `<span class="save-slot-current-badge">ACTIVE</span>` : ''}
          </div>
          <div class="save-slot-row-date">📅 ${info.dateStr || 'No data stored'}</div>
          ${raw ? `
            <div class="save-slot-row-stats">
              <span>❤️ ${info.health !== undefined ? info.health : 20}/20</span> ·
              <span>⭐ Lv.${info.level || 1}</span> ·
              <span>⏱️ ${info.playTime || '0m'}</span>
            </div>
          ` : `
            <div class="save-slot-row-empty-hint">Tap [💾 Save] to store state here</div>
          `}
        </div>

        <div class="save-slot-actions-col">
          <button type="button" class="btn-slot-quick-save" data-slot="${i}">💾 Save</button>
          ${raw ? `<button type="button" class="btn-slot-quick-load" data-slot="${i}">📂 Load</button>` : ''}
        </div>
      `;

      // Select active slot on row tap
      addTap(row, (e) => {
        if (e.target && (e.target.closest('.btn-slot-quick-save') || e.target.closest('.btn-slot-quick-load'))) return;
        setActiveSlot(i);
        updateSaveDropdownSlots();
        showToast(`Selected Slot ${i}`);
      });

      const sBtn = row.querySelector('.btn-slot-quick-save');
      if (sBtn) {
        addTap(sBtn, async () => await saveToSlot(i));
      }

      const lBtn = row.querySelector('.btn-slot-quick-load');
      if (lBtn) {
        addTap(lBtn, async () => await loadFromSlot(i));
      }

      listEl.appendChild(row);
    }
  }

  // Sheet toggle / open / close
  function toggleSaveDropdown(forceOpen) {
    const menu = document.getElementById('save-dropdown-menu');
    if (!menu) return;
    const isShowing = menu.classList.contains('show');
    const targetState = forceOpen !== undefined ? forceOpen : !isShowing;

    if (!targetState) {
      menu.classList.remove('show');
    } else {
      updateSaveDropdownSlots();
      menu.classList.add('show');
    }
  }

  function closeSaveDropdown() {
    const menu = document.getElementById('save-dropdown-menu');
    if (menu) menu.classList.remove('show');
  }

  // Initialize event bindings
  function init() {
    updateSaveDropdownSlots();

    const closeBtn = document.getElementById('save-dropdown-close-btn');
    if (closeBtn) addTap(closeBtn, () => closeSaveDropdown());

    const qsBtn = document.getElementById('save-menu-quicksave');
    if (qsBtn) addTap(qsBtn, async () => await saveToSlot(activeSlot));

    const qlBtn = document.getElementById('save-menu-quickload');
    if (qlBtn) addTap(qlBtn, async () => await loadFromSlot(activeSlot));

    const expBtn = document.getElementById('save-menu-export-file');
    if (expBtn) addTap(expBtn, () => exportSlot(activeSlot));

    document.getElementById('save-menu-import-file')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importSaveFile(e.target.files[0], activeSlot);
      }
    });

    // Close when tapping outside the sheet
    document.addEventListener('pointerdown', (e) => {
      const menu = document.getElementById('save-dropdown-menu');
      const btnSave = document.getElementById('john-btn-save');
      const btnLoad = document.getElementById('john-btn-load');
      if (!menu || !menu.classList.contains('show')) return;

      const rect = menu.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        return;
      }

      if (e.target && (menu.contains(e.target) || 
          (btnSave && btnSave.contains(e.target)) || 
          (btnLoad && btnLoad.contains(e.target)))) {
        return;
      }
      closeSaveDropdown();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Global export
  window.__pokeSaveManager = {
    saveToSlot: (s) => saveToSlot(s || activeSlot),
    loadFromSlot: (s) => loadFromSlot(s || activeSlot),
    exportSlot: (s) => exportSlot(s || activeSlot),
    importSaveFile: (f, s) => importSaveFile(f, s || activeSlot),
    toggleDropdown: toggleSaveDropdown,
    closeDropdown: closeSaveDropdown,
    getActiveSlot: () => activeSlot,
    setActiveSlot: (s) => setActiveSlot(s),
    updateSlotsUI: updateSaveDropdownSlots
  };
})();
