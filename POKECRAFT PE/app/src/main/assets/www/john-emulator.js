// ==========================================================================
// PokéCRAFT PE - John GBA Mobile Controller, Multi-Touch & Scaling Engine
// ==========================================================================

(() => {
  let isEmuActive = true;
  let currentSpeed = 1;
  const SPEED_MODES = [1, 1.75, 2.5];
  let speedIdx = 0;

  // Haptic feedback with AndroidHost bridge & navigator fallback
  function haptic(ms = 12) {
    try {
      const hapticEnabled = localStorage.getItem('pokecraft-haptic-enabled') !== '0';
      if (!hapticEnabled) return;

      if (window.AndroidHost && window.AndroidHost.vibrate) {
        window.AndroidHost.vibrate(ms);
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch (e) {}
  }

  // Toast notification
  function toast(msg) {
    let t = document.getElementById('emulator-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'emulator-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.remove('show');
    }, 2000);
  }

  // Safe input press / release mapping
  function mapAction(action) {
    if (action === 'menu') return 'start';
    if (action === 'inventory') return 'inv';
    if (action === 'prevItem') return 'prev';
    if (action === 'nextItem') return 'next';
    return action;
  }

  function pressAction(action) {
    if (!action) return;
    action = mapAction(action);
    if (window.__pokeInput && window.__pokeInput.press) {
      window.__pokeInput.press(action);
    }
    haptic(10);
  }

  function releaseAction(action) {
    if (!action) return;
    action = mapAction(action);
    if (window.__pokeInput && window.__pokeInput.release) {
      window.__pokeInput.release(action);
    }
  }

  // Multi-Touch 8-Directional D-Pad Drag Engine
  function initDpad() {
    const dpad = document.getElementById('john-dpad');
    if (!dpad) return;

    let activePointerId = null;
    let currentDirs = new Set();

    const updateDpadFromCoords = (clientX, clientY) => {
      const rect = dpad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);

      // Deadzone threshold in pixels
      const deadzone = 12;
      const newDirs = new Set();

      if (dist >= deadzone) {
        const rad = Math.atan2(dy, dx);
        const deg = (rad * 180) / Math.PI; // -180 to 180

        // 8-directional sectors
        if (deg >= -67.5 && deg <= 67.5) newDirs.add('right');
        if (deg >= 22.5 && deg <= 157.5) newDirs.add('down');
        if (deg >= 112.5 || deg <= -112.5) newDirs.add('left');
        if (deg >= -157.5 && deg <= -22.5) newDirs.add('up');
      }

      // Diff released directions
      for (const d of currentDirs) {
        if (!newDirs.has(d)) {
          releaseAction(d);
          const btn = dpad.querySelector(`.john-dpad-btn.${d}`);
          if (btn) btn.classList.remove('pressed');
        }
      }
      // Diff newly pressed directions
      for (const d of newDirs) {
        if (!currentDirs.has(d)) {
          pressAction(d);
          const btn = dpad.querySelector(`.john-dpad-btn.${d}`);
          if (btn) btn.classList.add('pressed');
        }
      }
      currentDirs = newDirs;
    };

    const clearDpad = () => {
      for (const d of currentDirs) {
        releaseAction(d);
        const btn = dpad.querySelector(`.john-dpad-btn.${d}`);
        if (btn) btn.classList.remove('pressed');
      }
      currentDirs.clear();
      activePointerId = null;
    };

    dpad.addEventListener('pointerdown', (e) => {
      if (window.__controlsEditModeActive) return;
      e.preventDefault();
      activePointerId = e.pointerId;
      try { dpad.setPointerCapture(e.pointerId); } catch(err){}
      updateDpadFromCoords(e.clientX, e.clientY);
    });

    dpad.addEventListener('pointermove', (e) => {
      if (window.__controlsEditModeActive) return;
      if (activePointerId === e.pointerId) {
        e.preventDefault();
        updateDpadFromCoords(e.clientX, e.clientY);
      }
    });

    dpad.addEventListener('pointerup', (e) => {
      if (activePointerId === e.pointerId) {
        e.preventDefault();
        clearDpad();
      }
    });

    dpad.addEventListener('pointercancel', (e) => {
      if (activePointerId === e.pointerId) {
        clearDpad();
      }
    });
  }

  // Setup Virtual Controller Action Buttons
  function initButtons() {
    const chassis = document.getElementById('john-emu-chassis');
    if (!chassis) return;

    const actionBtns = chassis.querySelectorAll('button[data-action]');
    actionBtns.forEach((btn) => {
      const act = btn.dataset.action;
      if (!act || btn.closest('#john-dpad')) return;

      const on = (e) => {
        if (window.__controlsEditModeActive) return;
        e.preventDefault();
        btn.classList.add('pressed');
        pressAction(act);
        if (btn.id === 'john-btn-ab') {
          pressAction('a');
          pressAction('b');
        }
      };

      const off = (e) => {
        if (window.__controlsEditModeActive) return;
        e.preventDefault();
        btn.classList.remove('pressed');
        releaseAction(act);
        if (btn.id === 'john-btn-ab') {
          releaseAction('a');
          releaseAction('b');
        }
      };

      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
    });

    // Sprint Toggle Button
    const sprintBtn = document.getElementById('john-btn-sprint');
    if (sprintBtn) {
      let sprintActive = false;
      sprintBtn.addEventListener('click', (e) => {
        if (window.__controlsEditModeActive) return;
        e.preventDefault();
        sprintActive = !sprintActive;
        sprintBtn.classList.toggle('active', sprintActive);
        if (sprintActive) {
          pressAction('sprint');
          toast('⚡ Sprint: ON');
        } else {
          releaseAction('sprint');
          toast('Sprint: OFF');
        }
      });
    }

    // Top Bar Quick Save (💾) - Toggles 6-Slot Mobile Save Sheet
    function addTapListener(el, callback) {
      if (!el) return;
      let handled = false;
      const trigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (handled) return;
        handled = true;
        setTimeout(() => { handled = false; }, 250);
        callback(e);
      };
      el.addEventListener('pointerdown', trigger);
      el.addEventListener('click', trigger);
    }

    // Top Bar Quick Save (💾) - Toggles 6-Slot Mobile Save Sheet
    const btnSave = document.getElementById('john-btn-save');
    if (btnSave) {
      addTapListener(btnSave, () => {
        haptic(15);
        if (window.__pokeSaveManager && window.__pokeSaveManager.toggleDropdown) {
          window.__pokeSaveManager.toggleDropdown();
        } else {
          toast('💾 Save Slots');
        }
      });
    }

    // Top Bar Quick Load (📂) - Toggles 6-Slot Mobile Save Sheet
    const btnLoad = document.getElementById('john-btn-load');
    if (btnLoad) {
      addTapListener(btnLoad, () => {
        haptic(15);
        if (window.__pokeSaveManager && window.__pokeSaveManager.toggleDropdown) {
          window.__pokeSaveManager.toggleDropdown();
        } else {
          toast('📂 Load Slots');
        }
      });
    }

    // Fast-Forward Turbo Speed (1x / 1.75x / 2.5x)
    const btnSpeed = document.getElementById('john-btn-speed');
    const badgeSpeed = document.getElementById('john-speed-badge');
    if (btnSpeed) {
      addTapListener(btnSpeed, () => {
        haptic(15);
        speedIdx = (speedIdx + 1) % SPEED_MODES.length;
        currentSpeed = SPEED_MODES[speedIdx];
        window.__emuGameSpeed = currentSpeed;
        if (badgeSpeed) {
          badgeSpeed.textContent = currentSpeed + 'x';
        }
        btnSpeed.classList.toggle('active', currentSpeed > 1);
        toast(`⏩ Speed: ${currentSpeed}x`);
      });
    }

    // Kanto Region Town Map (🗺️) - Toggles High-DPI Town Map
    const btnMap = document.getElementById('john-btn-map');
    if (btnMap) {
      addTapListener(btnMap, () => {
        haptic(15);
        if (typeof window.__openPokeMap === 'function') {
          window.__openPokeMap();
        } else {
          toast('🗺️ Kanto Town Map');
        }
      });
    }

    // Menu / Settings (☰) - Opens Mobile Settings Sheet
    const btnMenu = document.getElementById('john-btn-menu');
    if (btnMenu) {
      addTapListener(btnMenu, () => {
        haptic(15);
        const modal = document.getElementById('settings-modal');
        if (modal) {
          modal.classList.add('active');
        }
      });
    }
  }

  // Dynamic Sizing, Aspect Ratio & Display Mode Engine
  function refitCanvas() {
    const canvas = document.getElementById('game');
    const frame = document.getElementById('john-screen-frame');
    if (!canvas || !frame) return;

    if (canvas.parentNode !== frame) {
      frame.appendChild(canvas);
    }

    const scaleMode = localStorage.getItem('pokecraft-scale-mode') || 'fit';
    const isPortrait = window.innerHeight > window.innerWidth;

    const GW = 480; // native GBA width
    const GH = 320; // native GBA height

    if (isPortrait) {
      const availW = window.innerWidth;
      const availH = Math.round(availW / 1.5);

      if (scaleMode === 'stretch') {
        const stretchH = Math.round(window.innerHeight * 0.44);
        canvas.style.width = availW + 'px';
        canvas.style.height = stretchH + 'px';
        frame.style.width = availW + 'px';
        frame.style.height = stretchH + 'px';
      } else if (scaleMode === 'crisp') {
        const factor = Math.max(1, Math.floor(Math.min(availW / GW, availH / GH)));
        canvas.style.width = (GW * factor) + 'px';
        canvas.style.height = (GH * factor) + 'px';
        frame.style.width = availW + 'px';
        frame.style.height = availH + 'px';
      } else {
        // 'fit' default (3:2)
        canvas.style.width = availW + 'px';
        canvas.style.height = availH + 'px';
        frame.style.width = availW + 'px';
        frame.style.height = availH + 'px';
      }
    } else {
      // Landscape View
      const availW = window.innerWidth;
      const availH = window.innerHeight;

      if (scaleMode === 'stretch') {
        canvas.style.width = availW + 'px';
        canvas.style.height = availH + 'px';
        frame.style.width = availW + 'px';
        frame.style.height = availH + 'px';
      } else if (scaleMode === 'crisp') {
        const factor = Math.max(1, Math.floor(Math.min(availW / GW, availH / GH)));
        const w = GW * factor;
        const h = GH * factor;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        frame.style.width = w + 'px';
        frame.style.height = h + 'px';
      } else {
        // 'fit' default (Cinema height 100vh with 3:2 aspect)
        const h = availH;
        const w = Math.round(availH * 1.5);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        frame.style.width = w + 'px';
        frame.style.height = h + 'px';
      }
    }
  }

  // Hook global display functions
  window.__refitGame = refitCanvas;

  window.__setGameScaleMode = (mode) => {
    localStorage.setItem('pokecraft-scale-mode', mode);
    refitCanvas();
    const modeName = mode === 'crisp' ? 'Pixel Crisp (Integer)' : mode === 'stretch' ? 'Stretch Fill' : 'Fit 3:2 Aspect';
    toast(`🖥️ Screen: ${modeName}`);
  };

  window.addEventListener('DOMContentLoaded', () => {
    initDpad();
    initButtons();
    refitCanvas();
    setTimeout(refitCanvas, 200);
  });

  window.addEventListener('resize', refitCanvas);
  window.addEventListener('orientationchange', () => {
    setTimeout(refitCanvas, 250);
  });
})();
