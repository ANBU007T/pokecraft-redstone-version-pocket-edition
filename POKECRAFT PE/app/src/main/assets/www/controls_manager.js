// ==========================================================================
// PokéCRAFT Pocket Edition (PE) - Custom Controls Layout Manager
// Interactive Drag-and-Drop, Sizing (➕/➖), Collision Avoidance & Nudge
// ==========================================================================

(() => {
  const STORAGE_KEY_LAYOUT = 'pokecraft-mobile-custom-layout';
  const STORAGE_KEY_SCALE = 'pokecraft-mobile-controls-scale';
  const STORAGE_KEY_OPACITY = 'pokecraft-mobile-controls-opacity';

  let isEditing = false;
  let selectedIndex = 0;
  let activeDragTarget = null;
  let activePointerId = null;
  let isDragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startElemLeft = 0;
  let startElemTop = 0;
  let currentPositions = {};

  // Configurable elements that players can move and resize
  const MOVABLE_SELECTORS = [
    { key: 'dpad', label: 'D-PAD', selector: '#john-dpad' },
    { key: 'actions', label: 'A/B CLUSTER', selector: '.john-action-cluster' },
    { key: 'shortcuts', label: 'SHORTCUTS', selector: '.john-extra-shortcuts' },
    { key: 'bumperL', label: 'L BUMPER', selector: '.john-deck-left .john-bumper-slot' },
    { key: 'bumperR', label: 'R BUMPER', selector: '.john-deck-right .john-bumper-slot' },
    { key: 'select', label: 'SELECT', selector: '.john-sys-left' },
    { key: 'start', label: 'START', selector: '.john-sys-right' }
  ];

  function showToast(msg) {
    let t = document.getElementById('emulator-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'emulator-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function haptic(ms = 15) {
    if (window.AndroidHost && window.AndroidHost.vibrate) {
      window.AndroidHost.vibrate(ms);
    }
  }

  // Load saved positions & sizes
  function loadSavedPositions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAYOUT);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return null;
  }

  // Apply saved positions and individual scales
  function applyPositions(positions) {
    if (!positions || Object.keys(positions).length === 0) {
      MOVABLE_SELECTORS.forEach(({ selector }) => {
        const el = document.querySelector(selector);
        if (el) {
          el.style.position = '';
          el.style.left = '';
          el.style.top = '';
          el.style.right = '';
          el.style.bottom = '';
          el.style.transform = '';
        }
      });
      return;
    }
    currentPositions = { ...positions };

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    MOVABLE_SELECTORS.forEach(({ key, selector }) => {
      const el = document.querySelector(selector);
      if (!el || !positions[key]) return;

      const pos = positions[key];
      if (pos.pctX !== undefined && pos.pctY !== undefined) {
        const px = (pos.pctX / 100) * vw;
        const py = (pos.pctY / 100) * vh;

        el.style.position = 'fixed';
        el.style.left = `${Math.round(px)}px`;
        el.style.top = `${Math.round(py)}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }

      const s = pos.scale !== undefined ? pos.scale : 1.0;
      el.style.transform = s === 1.0 ? '' : `scale(${s})`;
      el.style.transformOrigin = 'center center';
    });
  }

  // Update editor toolbar badges
  function updateEditorUI() {
    const cur = MOVABLE_SELECTORS[selectedIndex];
    if (!cur) return;

    const badgeTarget = document.getElementById('editor-target-badge');
    if (badgeTarget) {
      badgeTarget.textContent = `🎯 ${cur.label}`;
    }

    const pos = currentPositions[cur.key] || {};
    const scale = pos.scale !== undefined ? pos.scale : 1.0;
    const badgeSize = document.getElementById('editor-size-val');
    if (badgeSize) {
      badgeSize.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  // Explicit selection system (prevents overlap traps)
  function selectTarget(indexOrKey) {
    let idx = 0;
    if (typeof indexOrKey === 'number') {
      idx = (indexOrKey + MOVABLE_SELECTORS.length) % MOVABLE_SELECTORS.length;
    } else {
      idx = MOVABLE_SELECTORS.findIndex(item => item.key === indexOrKey);
      if (idx === -1) idx = 0;
    }
    selectedIndex = idx;

    // Remove previous selection states
    MOVABLE_SELECTORS.forEach(({ selector }) => {
      const el = document.querySelector(selector);
      if (el) {
        el.classList.remove('layout-selected');
        el.style.zIndex = '1050';
      }
    });

    const activeItem = MOVABLE_SELECTORS[selectedIndex];
    if (activeItem) {
      const activeEl = document.querySelector(activeItem.selector);
      if (activeEl) {
        activeEl.classList.add('layout-selected');
        activeEl.style.zIndex = '99999';
      }
    }

    updateEditorUI();
    haptic(10);
  }

  // Cycle targets (◀ Prev / ▶ Next)
  function cycleTarget(dir) {
    selectTarget(selectedIndex + dir);
  }

  // Change individual element scale
  function changeSize(delta) {
    const cur = MOVABLE_SELECTORS[selectedIndex];
    if (!cur) return;

    if (!currentPositions[cur.key]) {
      const el = document.querySelector(cur.selector);
      const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0 };
      currentPositions[cur.key] = {
        pctX: (rect.left / window.innerWidth) * 100,
        pctY: (rect.top / window.innerHeight) * 100,
        scale: 1.0
      };
    }

    let scale = currentPositions[cur.key].scale !== undefined ? currentPositions[cur.key].scale : 1.0;
    scale = Math.round((scale + delta) * 10) / 10;
    scale = Math.max(0.5, Math.min(1.8, scale)); // 50% to 180%

    currentPositions[cur.key].scale = scale;

    const el = document.querySelector(cur.selector);
    if (el) {
      el.style.transform = scale === 1.0 ? '' : `scale(${scale})`;
      el.style.transformOrigin = 'center center';
    }

    updateEditorUI();
    haptic(15);
  }

  // Precision Move / Nudge Buttons
  function nudge(dir) {
    const cur = MOVABLE_SELECTORS[selectedIndex];
    if (!cur) return;
    const el = document.querySelector(cur.selector);
    if (!el) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const step = 14;

    let curLeft = parseFloat(el.style.left);
    let curTop = parseFloat(el.style.top);
    if (isNaN(curLeft) || isNaN(curTop)) {
      const rect = el.getBoundingClientRect();
      curLeft = rect.left;
      curTop = rect.top;
    }

    let newX = curLeft;
    let newY = curTop;

    if (dir === 'left') newX -= step;
    else if (dir === 'right') newX += step;
    else if (dir === 'up') newY -= step;
    else if (dir === 'down') newY += step;

    // Viewport bounds
    newX = Math.max(0, Math.min(vw - 60, newX));
    newY = Math.max(30, Math.min(vh - 40, newY));

    el.style.position = 'fixed';
    el.style.left = `${Math.round(newX)}px`;
    el.style.top = `${Math.round(newY)}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';

    const curScale = currentPositions[cur.key]?.scale !== undefined ? currentPositions[cur.key].scale : 1.0;
    currentPositions[cur.key] = {
      pctX: (newX / vw) * 100,
      pctY: (newY / vh) * 100,
      scale: curScale
    };

    haptic(12);
  }

  // Reset to default layout
  function resetPositions() {
    localStorage.removeItem(STORAGE_KEY_LAYOUT);
    currentPositions = {};

    MOVABLE_SELECTORS.forEach(({ selector }) => {
      const el = document.querySelector(selector);
      if (el) {
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.transform = '';
      }
    });

    if (isEditing) {
      setTimeout(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        MOVABLE_SELECTORS.forEach(({ key, selector }) => {
          const el = document.querySelector(selector);
          if (!el) return;
          const rect = el.getBoundingClientRect();
          currentPositions[key] = {
            pctX: (rect.left / vw) * 100,
            pctY: (rect.top / vh) * 100,
            scale: 1.0
          };
          el.style.position = 'fixed';
          el.style.left = `${Math.round(rect.left)}px`;
          el.style.top = `${Math.round(rect.top)}px`;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
        });
        selectTarget(0);
      }, 60);
    }

    showToast('🔄 Controls reset to default layout');
    haptic(25);
  }

  // Interactive Edit Mode Activation
  function startLayoutEditMode() {
    isEditing = true;
    window.__controlsEditModeActive = true;

    // Close settings modal
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.remove('active');

    // Show editor bar
    const bar = document.getElementById('controls-editor-bar');
    if (bar) bar.classList.add('active');

    // Add edit class to controls deck
    const deck = document.getElementById('john-controls-deck');
    if (deck) deck.classList.add('layout-edit-mode');

    // Snapshot existing positions
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    MOVABLE_SELECTORS.forEach(({ key, selector }) => {
      const el = document.querySelector(selector);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const existing = currentPositions[key];
      const scale = existing && existing.scale !== undefined ? existing.scale : 1.0;

      let leftPx = rect.left;
      let topPx = rect.top;

      if (existing && existing.pctX !== undefined && existing.pctY !== undefined) {
        leftPx = (existing.pctX / 100) * vw;
        topPx = (existing.pctY / 100) * vh;
      } else {
        currentPositions[key] = {
          pctX: (leftPx / vw) * 100,
          pctY: (topPx / vh) * 100,
          scale
        };
      }

      el.style.position = 'fixed';
      el.style.left = `${Math.round(leftPx)}px`;
      el.style.top = `${Math.round(topPx)}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.transform = scale === 1.0 ? '' : `scale(${scale})`;
      el.style.transformOrigin = 'center center';
    });

    selectTarget(0);
    showToast('✏️ Drag button, use MOVE arrows, or ➕/➖ SIZE');
  }

  function exitLayoutEditMode() {
    isEditing = false;
    window.__controlsEditModeActive = false;

    const bar = document.getElementById('controls-editor-bar');
    if (bar) bar.classList.remove('active');

    const deck = document.getElementById('john-controls-deck');
    if (deck) deck.classList.remove('layout-edit-mode');

    MOVABLE_SELECTORS.forEach(({ selector }) => {
      const el = document.querySelector(selector);
      if (el) {
        el.classList.remove('layout-selected');
        el.classList.remove('layout-dragging');
        el.style.zIndex = '';
      }
    });

    activeDragTarget = null;
    activePointerId = null;
    isDragging = false;
  }

  function saveLayout() {
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(currentPositions));
    } catch (e) {}
    exitLayoutEditMode();
    showToast('💾 Controls Layout & Button Sizes Saved!');
    haptic(30);
  }

  // Pointer Drag Handlers on Movable Elements
  function onPointerDown(e) {
    if (!isEditing) return;

    // Check currently selected element first if touch falls within it
    const curItem = MOVABLE_SELECTORS[selectedIndex];
    const curEl = curItem ? document.querySelector(curItem.selector) : null;
    let targetIdx = -1;

    if (curEl && (curEl === e.target || curEl.contains(e.target))) {
      targetIdx = selectedIndex;
    } else {
      // Find matching movable target
      for (let i = 0; i < MOVABLE_SELECTORS.length; i++) {
        const item = MOVABLE_SELECTORS[i];
        const el = document.querySelector(item.selector);
        if (el && (el === e.target || el.contains(e.target))) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx === -1) return;

    e.preventDefault();
    e.stopPropagation();

    selectTarget(targetIdx);

    const item = MOVABLE_SELECTORS[targetIdx];
    const el = document.querySelector(item.selector);
    activeDragTarget = el;
    activeDragTarget._key = item.key;
    activePointerId = e.pointerId;

    try { el.setPointerCapture(e.pointerId); } catch (err) {}

    activeDragTarget.classList.add('layout-dragging');

    startPointerX = e.clientX;
    startPointerY = e.clientY;

    let curLeft = parseFloat(el.style.left);
    let curTop = parseFloat(el.style.top);
    if (isNaN(curLeft) || isNaN(curTop)) {
      const rect = el.getBoundingClientRect();
      curLeft = rect.left;
      curTop = rect.top;
      el.style.position = 'fixed';
      el.style.left = `${Math.round(curLeft)}px`;
      el.style.top = `${Math.round(curTop)}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
    startElemLeft = curLeft;
    startElemTop = curTop;
    isDragging = true;
  }

  function onPointerMove(e) {
    if (!isEditing || !isDragging || !activeDragTarget) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;

    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - startPointerX;
    const dy = e.clientY - startPointerY;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let newX = startElemLeft + dx;
    let newY = startElemTop + dy;

    // Viewport bounding clamp
    newX = Math.max(0, Math.min(vw - 60, newX));
    newY = Math.max(30, Math.min(vh - 40, newY));

    activeDragTarget.style.position = 'fixed';
    activeDragTarget.style.left = `${Math.round(newX)}px`;
    activeDragTarget.style.top = `${Math.round(newY)}px`;
    activeDragTarget.style.right = 'auto';
    activeDragTarget.style.bottom = 'auto';

    const key = activeDragTarget._key;
    if (key) {
      if (!currentPositions[key]) currentPositions[key] = {};
      const curScale = currentPositions[key].scale !== undefined ? currentPositions[key].scale : 1.0;
      currentPositions[key].pctX = (newX / vw) * 100;
      currentPositions[key].pctY = (newY / vh) * 100;
      currentPositions[key].scale = curScale;
    }
  }

  function onPointerUp(e) {
    if (!isEditing || !activeDragTarget) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;

    e.preventDefault();
    try { activeDragTarget.releasePointerCapture(e.pointerId); } catch (err) {}

    activeDragTarget.classList.remove('layout-dragging');
    activeDragTarget = null;
    activePointerId = null;
    isDragging = false;
  }

  // Initialize UI controls & event listeners
  function init() {
    const addTap = (el, fn) => {
      if (!el) return;
      let handled = false;
      const h = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (handled) return;
        handled = true;
        setTimeout(() => { handled = false; }, 260);
        fn(e);
      };
      el.addEventListener('pointerdown', h);
      el.addEventListener('click', h);
    };

    // 1. Restore saved layout & individual sizes if present
    try {
      const savedPositions = loadSavedPositions();
      if (savedPositions && Object.keys(savedPositions).length > 0) {
        applyPositions(savedPositions);
      }
    } catch (e) {}

    // 2. Settings modal buttons
    const btnEdit = document.getElementById('btn-edit-controls-layout');
    addTap(btnEdit, () => startLayoutEditMode());

    const btnReset = document.getElementById('btn-reset-controls-layout');
    addTap(btnReset, () => resetPositions());

    // 3. Editor Bar Controls
    // Target Cyclers
    const btnPrevTarget = document.getElementById('btn-editor-prev-target');
    addTap(btnPrevTarget, () => cycleTarget(-1));

    const btnNextTarget = document.getElementById('btn-editor-next-target');
    addTap(btnNextTarget, () => cycleTarget(1));

    // Size Increment / Decrement (➕ / ➖)
    const btnSizeDec = document.getElementById('btn-editor-size-dec');
    addTap(btnSizeDec, () => changeSize(-0.1));

    const btnSizeInc = document.getElementById('btn-editor-size-inc');
    addTap(btnSizeInc, () => changeSize(0.1));

    // Directional Nudge Pad (⬅️ ⬆️ ⬇️ ➡️)
    const nudgeBtns = document.querySelectorAll('.editor-nudge-btn');
    nudgeBtns.forEach((btn) => {
      addTap(btn, () => {
        const dir = btn.dataset.dir;
        if (dir) nudge(dir);
      });
    });

    // Reset Selected Button in Editor
    const btnEditorReset = document.getElementById('btn-editor-reset-btn');
    addTap(btnEditorReset, () => resetPositions());

    // Save and Cancel Actions
    const btnSave = document.getElementById('btn-save-layout');
    addTap(btnSave, () => saveLayout());

    const btnCancel = document.getElementById('btn-cancel-layout');
    addTap(btnCancel, () => exitLayoutEditMode());

    // 4. Pointer Events on deck for 1-finger direct drag
    const deck = document.getElementById('john-controls-deck');
    if (deck) {
      deck.addEventListener('pointerdown', onPointerDown, { passive: false });
      deck.addEventListener('pointermove', onPointerMove, { passive: false });
      deck.addEventListener('pointerup', onPointerUp, { passive: false });
      deck.addEventListener('pointercancel', onPointerUp, { passive: false });
    }

    // 5. Handle screen rotation / resize
    window.addEventListener('resize', () => {
      const saved = loadSavedPositions();
      if (saved) applyPositions(saved);
    });
  }

  // Public API
  window.__pokeControls = {
    startEdit: startLayoutEditMode,
    saveLayout,
    resetLayout: resetPositions,
    selectTarget,
    changeSize,
    nudge
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
