// ==========================================================================
// PokéCRAFT PE - Mobile Settings & Native Android Bridge
// ==========================================================================

(() => {
  const modal = document.getElementById('settings-modal');
  const btnClose = document.getElementById('settings-close-btn');
  const btnResume = document.getElementById('btn-resume-game');
  const btnQuit = document.getElementById('btn-quit-game');

  // Display elements
  const scaleBtns = document.querySelectorAll('.opt-scale-btn');
  const orientBtns = document.querySelectorAll('.opt-orient-btn');

  // Audio elements
  const masterSlider = document.getElementById('slider-master-vol');
  const masterVal = document.getElementById('val-master-vol');
  const musicSlider = document.getElementById('slider-music-vol');
  const musicVal = document.getElementById('val-music-vol');
  const sfxSlider = document.getElementById('slider-sfx-vol');
  const sfxVal = document.getElementById('val-sfx-vol');
  const musicMuteCheck = document.getElementById('check-music-mute');

  // Controls elements
  const checkHaptic = document.getElementById('check-haptic-vibrate');
  const sprintBtns = document.querySelectorAll('.opt-sprint-btn');
  const checkAlwaysSprint = document.getElementById('check-always-sprint');

  const addTap = (el, fn) => {
    if (!el) return;
    let handled = false;
    const h = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (handled) return;
      handled = true;
      setTimeout(() => { handled = false; }, 300);
      fn(e);
    };
    el.addEventListener('pointerdown', h);
    el.addEventListener('click', h);
  };

  // Tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach((btn) => {
    addTap(btn, () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Modal open / close
  function openSettings() {
    if (!modal) return;
    modal.classList.add('active');
    syncSettingsUI();
  }

  function closeSettings() {
    if (!modal) return;
    modal.classList.remove('active');
    if (window.__refitGame) window.__refitGame();
  }

  if (btnClose) addTap(btnClose, closeSettings);
  if (btnResume) addTap(btnResume, closeSettings);

  // Screen scaling mode
  scaleBtns.forEach((btn) => {
    addTap(btn, () => {
      scaleBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.scale;
      try { localStorage.setItem('pokecraft-scale-mode', mode); } catch(e){}
      if (typeof window.__setGameScaleMode === 'function') {
        window.__setGameScaleMode(mode);
      }
      if (typeof window.__refitGame === 'function') {
        window.__refitGame();
      }
    });
  });

  // Screen orientation lock
  orientBtns.forEach((btn) => {
    addTap(btn, () => {
      orientBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const orient = btn.dataset.orient;
      localStorage.setItem('pokecraft-orient-lock', orient);

      if (window.AndroidHost && window.AndroidHost.setOrientation) {
        window.AndroidHost.setOrientation(orient);
      }

      const toast = document.getElementById('emulator-toast');
      if (toast) {
        const lbl = orient === 'portrait' ? '📱 Portrait' : orient === 'landscape' ? '🖥️ Landscape' : '🔄 Auto Sensor';
        toast.textContent = `Screen: ${lbl}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1800);
      }
    });
  });

  // Audio UI Sync
  function syncSettingsUI() {
    // Sync Scale mode active class
    const currentScale = localStorage.getItem('pokecraft-scale-mode') || 'fit';
    scaleBtns.forEach((b) => {
      b.classList.toggle('active', b.dataset.scale === currentScale);
    });

    // Sync Orientation mode active class
    const currentOrient = localStorage.getItem('pokecraft-orient-lock') || 'auto';
    orientBtns.forEach((b) => {
      b.classList.toggle('active', b.dataset.orient === currentOrient);
    });

    // Sync Audio
    if (window.__pokeAudio) {
      const mVol = Math.round(window.__pokeAudio.getMasterVolume() * 100);
      const muVol = Math.round(window.__pokeAudio.getMusicVolume() * 100);
      const sVol = Math.round(window.__pokeAudio.getSfxVolume() * 100);
      const muted = window.__pokeAudio.isMusicMuted();

      if (masterSlider) { masterSlider.value = mVol; masterVal.textContent = mVol + '%'; }
      if (musicSlider) { musicSlider.value = muVol; musicVal.textContent = muVol + '%'; }
      if (sfxSlider) { sfxSlider.value = sVol; sfxVal.textContent = sVol + '%'; }
      if (musicMuteCheck) musicMuteCheck.checked = muted;
    }

    if (checkHaptic) {
      checkHaptic.checked = localStorage.getItem('pokecraft-haptic-enabled') !== '0';
    }

    const currentSprint = localStorage.getItem('pokecraft-sprint-speed') || 'balanced';
    sprintBtns.forEach((b) => {
      b.classList.toggle('active', b.dataset.sprint === currentSprint);
    });
  }

  if (masterSlider) {
    masterSlider.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      masterVal.textContent = e.target.value + '%';
      if (window.__pokeAudio) window.__pokeAudio.setMasterVolume(v);
    });
  }

  if (musicSlider) {
    musicSlider.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      musicVal.textContent = e.target.value + '%';
      if (window.__pokeAudio) window.__pokeAudio.setMusicVolume(v);
    });
  }

  if (sfxSlider) {
    sfxSlider.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      sfxVal.textContent = e.target.value + '%';
      if (window.__pokeAudio) window.__pokeAudio.setSfxVolume(v);
    });
  }

  if (musicMuteCheck) {
    musicMuteCheck.addEventListener('change', (e) => {
      if (window.__pokeAudio) window.__pokeAudio.setMusicMuted(e.target.checked);
    });
  }

  // Haptics toggle
  if (checkHaptic) {
    checkHaptic.addEventListener('change', (e) => {
      localStorage.setItem('pokecraft-haptic-enabled', e.target.checked ? '1' : '0');
    });
  }

  // Sprint speed mode
  sprintBtns.forEach((btn) => {
    addTap(btn, () => {
      const mode = btn.dataset.sprint;
      sprintBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      window.__sprintSpeedMode = mode;
      localStorage.setItem('pokecraft-sprint-speed', mode);
      const toast = document.getElementById('emulator-toast');
      if (toast) {
        toast.textContent = `🏃 Sprint: ${mode.toUpperCase()}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1800);
      }
    });
  });

  // Quit Game -> Native Android Exit
  if (btnQuit) {
    addTap(btnQuit, () => {
      if (confirm('Quit PokéCRAFT PE?')) {
        if (window.AndroidHost && window.AndroidHost.exitApp) {
          window.AndroidHost.exitApp();
        } else {
          window.close();
        }
      }
    });
  }

  window.addEventListener('DOMContentLoaded', syncSettingsUI);
})();
