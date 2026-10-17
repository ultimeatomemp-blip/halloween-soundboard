/**
 * ============================================================================
 * HALLOWEEN SOUNDBOARD SPATIALISÉE - APP.JS
 * - Barre latérale d'outils à GAUCHE de chaque Pad (Hors zone de clic Panoramique !)
 * - Glisser-Déposer (SortableJS) par poignée ⠿ ou en "Mode Déplacement" sans déclencher de son
 * - Classement par durée (Court -> Long, Long -> Court, A-Z, ou Mon Ordre personnalisé)
 * - Favoris ⭐ et Suppression/Masquage ✕ sur les Pads ET sur les Ambiances
 * - Système complet de Sauvegarde / Chargement / Export / Import de Configurations (Profils)
 * ============================================================================
 */

const STORAGE_KEYS = {
  ACTIVE_CONFIG: "halloween_sb_active_config_v2",
  SAVED_PRESETS: "halloween_sb_presets_v2"
};

const AppState = {
  soundsData: [],
  howlInstances: {},
  failedLoads: new Set(),

  // --- PERSONNALISATION & ORDRE DU BOARD (Sauvegardés dans les Configurations) ---
  favorites: new Set(),        // IDs des sons favoris (oneshots ET loops)
  hiddenSounds: new Set(),     // IDs des sons masqués (oneshots ET loops)
  customOrderOneshots: [],     // Ordre personnalisé des Pads par glisser-déposer
  customOrderLoops: [],        // Ordre personnalisé des Ambiances par glisser-déposer

  // Instances SortableJS
  oneshotSortable: null,
  loopSortable: null,
  dragModeEnabled: false,      // Mode déplacement global (bloque le son pour déplacer à pleine main)
  isDraggingNow: false,        // Verrou anti-déclenchement pendant un glisser-déposer

  // --- AMBIANCE UNIQUE (LOOP) AVEC CROSSFADE ---
  activeLoopId: null,
  loopVolume: 0.70,
  crossfadeDurationMs: 2000,
  fadeIntervals: {},

  // --- FILTRES & TRI DES PADS (ONESHOT) ---
  oneshotVolume: 1.0,
  selectedOneshotCategory: "TOUT",
  selectedDurationFilter: "ALL", // ALL | SHORT (<3s) | MEDIUM (3-8s) | LONG (>8s)
  oneshotSortMode: "CUSTOM",     // CUSTOM | DURATION_ASC | DURATION_DESC | NAME_ASC | CATEGORY
  oneshotSearchQuery: "",
  onlyFavoritesFilter: false,
  showHiddenMode: false,

  // --- FILTRES & TRI DES AMBIANCES (LOOP) ---
  selectedLoopCategory: "TOUT",
  loopSortMode: "CUSTOM",        // CUSTOM | DURATION_ASC | DURATION_DESC | NAME_ASC
  loopSearchQuery: "",
  onlyLoopFavoritesFilter: false,
  showLoopHiddenMode: false,

  // --- RANDOMIZER ---
  randomizer: {
    enabled: false,
    timeoutId: null,
    countdownIntervalId: null,
    nextTriggerTimestamp: null,
    allowedCategories: new Set(),
    delayMinSec: 5,
    delayMaxSec: 20,
    volMin: 0.3,
    volMax: 1.0,
    randomStereo: true,
    onlyFavorites: false
  }
};

const CATEGORY_META = {
  "Ambiances":        { icon: "🌫️", code: "AMB" },
  "Fantômes":         { icon: "👻", code: "FAN" },
  "Monstres":         { icon: "👹", code: "MON" },
  "Sorcières":        { icon: "🧙‍♀️", code: "SOR" },
  "Animaux":          { icon: "🦇", code: "ANI" },
  "Orages":           { icon: "⛈️", code: "ORA" },
  "Musiques":         { icon: "🎹", code: "MUS" },
  "Voix et cris":     { icon: "😱", code: "VOX" },
  "Objets":           { icon: "🗝️", code: "OBJ" },
  "Effets sonores":   { icon: "💥", code: "FX"  },
  "Interface et jeu": { icon: "🎮", code: "JEU" }
};

const PREFIX_CATEGORY_MAP = {
  AMB: "Ambiances",
  FAN: "Fantômes",
  MON: "Monstres",
  SOR: "Sorcières",
  ANI: "Animaux",
  ORA: "Orages",
  MUS: "Musiques",
  VOX: "Voix et cris",
  OBJ: "Objets",
  FX:  "Effets sonores",
  JEU: "Interface et jeu"
};

/**
 * ============================================================================
 * 1. INITIALISATION & SYSTÈME DE CONFIGURATIONS (PROFILS)
 * ============================================================================
 */
document.addEventListener("DOMContentLoaded", async () => {
  loadActiveConfiguration();
  initMainTabs();
  initMasterAndAmbienceControls();
  initOneshotFiltersAndToolbar();
  initLoopFiltersAndToolbar();
  initRandomizerControls();
  initPresetsModal();
  initFolderScanner();
  updateStereoStatusBadge();

  await loadSoundsDatabase();
});

/**
 * Exporte l'état complet de personnalisation sous forme d'objet sérialisable
 */
function serializeCurrentConfig() {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    favorites: [...AppState.favorites],
    hiddenSounds: [...AppState.hiddenSounds],
    customOrderOneshots: AppState.customOrderOneshots,
    customOrderLoops: AppState.customOrderLoops,
    oneshotSortMode: AppState.oneshotSortMode,
    loopSortMode: AppState.loopSortMode,
    oneshotVolume: AppState.oneshotVolume,
    loopVolume: AppState.loopVolume,
    crossfadeDurationMs: AppState.crossfadeDurationMs,
    randomizer: {
      delayMinSec: AppState.randomizer.delayMinSec,
      delayMaxSec: AppState.randomizer.delayMaxSec,
      volMin: AppState.randomizer.volMin,
      volMax: AppState.randomizer.volMax,
      randomStereo: AppState.randomizer.randomStereo,
      onlyFavorites: AppState.randomizer.onlyFavorites,
      allowedCategories: [...AppState.randomizer.allowedCategories]
    }
  };
}

/**
 * Applique un objet de configuration à l'application et met à jour les contrôles visuels
 */
function applyConfigurationObject(cfg) {
  if (!cfg) return;
  AppState.favorites = new Set(cfg.favorites || []);
  AppState.hiddenSounds = new Set(cfg.hiddenSounds || []);
  AppState.customOrderOneshots = Array.isArray(cfg.customOrderOneshots) ? cfg.customOrderOneshots : [];
  AppState.customOrderLoops = Array.isArray(cfg.customOrderLoops) ? cfg.customOrderLoops : [];

  if (cfg.oneshotSortMode) {
    AppState.oneshotSortMode = cfg.oneshotSortMode;
    const sel = document.getElementById("oneshot-sort");
    if (sel) sel.value = cfg.oneshotSortMode;
  }
  if (cfg.loopSortMode) {
    AppState.loopSortMode = cfg.loopSortMode;
    const selLoop = document.getElementById("loop-sort");
    if (selLoop) selLoop.value = cfg.loopSortMode;
  }

  if (typeof cfg.oneshotVolume === "number") {
    AppState.oneshotVolume = cfg.oneshotVolume;
    const s = document.getElementById("oneshot-volume");
    const l = document.getElementById("oneshot-volume-val");
    if (s) s.value = cfg.oneshotVolume;
    if (l) l.textContent = `${Math.round(cfg.oneshotVolume * 100)}%`;
  }

  if (typeof cfg.loopVolume === "number") {
    AppState.loopVolume = cfg.loopVolume;
    const s = document.getElementById("loop-master-volume");
    const l = document.getElementById("loop-master-volume-val");
    if (s) s.value = cfg.loopVolume;
    if (l) l.textContent = `${Math.round(cfg.loopVolume * 100)}%`;
  }

  if (typeof cfg.crossfadeDurationMs === "number") {
    AppState.crossfadeDurationMs = cfg.crossfadeDurationMs;
    const s = document.getElementById("crossfade-duration");
    const l = document.getElementById("crossfade-duration-val");
    if (s) s.value = (cfg.crossfadeDurationMs / 1000).toFixed(1);
    if (l) l.textContent = `${(cfg.crossfadeDurationMs / 1000).toFixed(1)}s`;
  }

  if (cfg.randomizer) {
    const r = cfg.randomizer;
    if (r.delayMinSec) {
      AppState.randomizer.delayMinSec = r.delayMinSec;
      document.getElementById("rand-delay-min").value = r.delayMinSec;
      document.getElementById("rand-delay-min-val").textContent = `${r.delayMinSec}s`;
    }
    if (r.delayMaxSec) {
      AppState.randomizer.delayMaxSec = r.delayMaxSec;
      document.getElementById("rand-delay-max").value = r.delayMaxSec;
      document.getElementById("rand-delay-max-val").textContent = `${r.delayMaxSec}s`;
    }
    if (r.volMin) {
      AppState.randomizer.volMin = r.volMin;
      document.getElementById("rand-vol-min").value = r.volMin;
      document.getElementById("rand-vol-min-val").textContent = `${Math.round(r.volMin * 100)}%`;
    }
    if (r.volMax) {
      AppState.randomizer.volMax = r.volMax;
      document.getElementById("rand-vol-max").value = r.volMax;
      document.getElementById("rand-vol-max-val").textContent = `${Math.round(r.volMax * 100)}%`;
    }
    if (typeof r.randomStereo === "boolean") {
      AppState.randomizer.randomStereo = r.randomStereo;
      document.getElementById("rand-stereo-random").checked = r.randomStereo;
    }
    if (typeof r.onlyFavorites === "boolean") {
      AppState.randomizer.onlyFavorites = r.onlyFavorites;
      document.getElementById("rand-only-favorites").checked = r.onlyFavorites;
    }
    if (Array.isArray(r.allowedCategories) && r.allowedCategories.length > 0) {
      AppState.randomizer.allowedCategories = new Set(r.allowedCategories);
      document.querySelectorAll(".rand-cat-checkbox").forEach((cb) => {
        cb.checked = AppState.randomizer.allowedCategories.has(cb.value);
      });
    }
  }

  saveActiveConfiguration();
  updateCustomCountersUI();
  if (AppState.soundsData.length > 0) {
    renderOneshotsSection();
    renderLoopsSection();
  }
}

function saveActiveConfiguration() {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CONFIG, JSON.stringify(serializeCurrentConfig()));
  } catch (e) {}
  updateCustomCountersUI();
}

function loadActiveConfiguration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_CONFIG);
    if (raw) {
      applyConfigurationObject(JSON.parse(raw));
    }
  } catch (e) {}
}

function updateCustomCountersUI() {
  const allOneshots = AppState.soundsData.filter((s) => s.type === "oneshot");
  const allLoops = AppState.soundsData.filter((s) => s.type === "loop");

  const oneshotFavs = allOneshots.filter((s) => AppState.favorites.has(s.id)).length;
  const oneshotHidden = allOneshots.filter((s) => AppState.hiddenSounds.has(s.id)).length;
  const loopFavs = allLoops.filter((s) => AppState.favorites.has(s.id)).length;
  const loopHidden = allLoops.filter((s) => AppState.hiddenSounds.has(s.id)).length;

  const favCountEl = document.getElementById("fav-count");
  const hiddenCountEl = document.getElementById("hidden-count");
  const restoreAllBtn = document.getElementById("btn-restore-all-hidden");

  if (favCountEl) favCountEl.textContent = oneshotFavs;
  if (hiddenCountEl) hiddenCountEl.textContent = oneshotHidden;
  if (restoreAllBtn) {
    restoreAllBtn.style.display = AppState.showHiddenMode && oneshotHidden > 0 ? "inline-block" : "none";
  }

  const loopFavCountEl = document.getElementById("loop-fav-count");
  const loopHiddenCountEl = document.getElementById("loop-hidden-count");
  const restoreLoopsBtn = document.getElementById("btn-restore-all-loops");

  if (loopFavCountEl) loopFavCountEl.textContent = loopFavs;
  if (loopHiddenCountEl) loopHiddenCountEl.textContent = loopHidden;
  if (restoreLoopsBtn) {
    restoreLoopsBtn.style.display = AppState.showLoopHiddenMode && loopHidden > 0 ? "inline-block" : "none";
  }
}

/**
 * Fenêtre Modale de Gestion des Configurations (Sauvegarder par pièce, Charger, Exporter en .json, Importer)
 */
function initPresetsModal() {
  const modal = document.getElementById("presets-modal");
  const openBtn = document.getElementById("btn-open-presets");
  const closeBtn = document.getElementById("btn-close-presets");
  const saveBtn = document.getElementById("btn-save-preset");
  const nameInput = document.getElementById("preset-name-input");
  const exportFileBtn = document.getElementById("btn-export-config-file");
  const importFileBtn = document.getElementById("btn-import-config-file");
  const importInput = document.getElementById("import-config-input");
  const resetBtn = document.getElementById("btn-reset-default-config");

  if (!modal || !openBtn) return;

  openBtn.addEventListener("click", () => {
    renderSavedPresetsList();
    modal.style.display = "flex";
  });

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  saveBtn.addEventListener("click", () => {
    const name = (nameInput.value || "").trim() || `Config du ${new Date().toLocaleTimeString("fr-FR")}`;
    const presets = getSavedPresetsMap();
    presets[name] = serializeCurrentConfig();
    localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
    nameInput.value = "";
    renderSavedPresetsList();
  });

  // Exporter la configuration actuelle en fichier .json (pour l'envoyer sur téléphone/tablette)
  exportFileBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(serializeCurrentConfig(), null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "halloween-board-config.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // Importer un fichier .json de configuration
  importFileBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const cfg = JSON.parse(ev.target.result);
        applyConfigurationObject(cfg);
        modal.style.display = "none";
      } catch (err) {
        alert("Fichier de configuration invalide.");
      }
    };
    reader.readAsText(file);
  });

  // Réinitialiser tout par défaut
  resetBtn.addEventListener("click", () => {
    if (!confirm("Réinitialiser l'ordre des pads, les favoris et les sons masqués par défaut ?")) return;
    AppState.favorites.clear();
    AppState.hiddenSounds.clear();
    AppState.customOrderOneshots = [];
    AppState.customOrderLoops = [];
    AppState.oneshotSortMode = "CUSTOM";
    AppState.loopSortMode = "CUSTOM";
    saveActiveConfiguration();
    renderOneshotsSection();
    renderLoopsSection();
    modal.style.display = "none";
  });
}

function getSavedPresetsMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_PRESETS) || "{}");
  } catch (e) {
    return {};
  }
}

function renderSavedPresetsList() {
  const listEl = document.getElementById("presets-list");
  if (!listEl) return;
  const presets = getSavedPresetsMap();
  const names = Object.keys(presets);

  if (names.length === 0) {
    listEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem; padding: 0.5rem;">Aucun profil enregistré pour l'instant.</div>`;
    return;
  }

  listEl.innerHTML = "";
  names.forEach((name) => {
    const row = document.createElement("div");
    row.className = "preset-item";
    row.innerHTML = `
      <span class="preset-item-name">🎃 ${name}</span>
      <div class="preset-item-actions">
        <button type="button" class="btn-secondary btn-load-p">Charger</button>
        <button type="button" class="btn-tiny btn-del-p">🗑️</button>
      </div>
    `;

    row.querySelector(".btn-load-p").addEventListener("click", () => {
      applyConfigurationObject(presets[name]);
      document.getElementById("presets-modal").style.display = "none";
    });

    row.querySelector(".btn-del-p").addEventListener("click", () => {
      delete presets[name];
      localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
      renderSavedPresetsList();
    });

    listEl.appendChild(row);
  });
}

/**
 * ============================================================================
 * 2. CHARGEMENT DES SONS & MOTEUR AUDIO HOWLER.JS
 * ============================================================================
 */
function updateStereoStatusBadge(hasScannedBlobs = false) {
  const isFileProtocol = window.location.protocol === "file:";
  const banner = document.getElementById("file-protocol-warning");
  const unlockBtn = document.getElementById("btn-unlock-stereo");
  const folderInput = document.getElementById("folder-scanner-input");
  const badge = document.getElementById("stereo-engine-badge");

  if (isFileProtocol && !hasScannedBlobs) {
    if (banner) banner.style.display = "flex";
    if (badge) {
      badge.textContent = "⚠️ Stéréo bridée (file://)";
      badge.classList.add("warn");
    }
    if (unlockBtn && folderInput) {
      unlockBtn.onclick = () => folderInput.click();
    }
  } else {
    if (banner) banner.style.display = "none";
    if (badge) {
      badge.textContent = "🎧 Stéréo Active (-1 / +1)";
      badge.classList.remove("warn");
    }
  }
}

async function loadSoundsDatabase() {
  let data = null;

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch("./sounds.json", { cache: "no-store" });
      if (response.ok) {
        data = await response.json();
      }
    } catch (err) {
      console.warn("Fetch de sounds.json impossible, utilisation du fallback local.", err);
    }
  }

  if (!data && Array.isArray(window.SOUNDS_DATA)) {
    data = window.SOUNDS_DATA;
  }

  if (data && data.length > 0) {
    applySoundsList(data);
  }
}

function applySoundsList(data) {
  stopAllSoundsImmediate();
  Object.values(AppState.howlInstances).forEach((h) => h.unload());
  AppState.howlInstances = {};
  AppState.failedLoads.clear();
  AppState.soundsData = data;

  setupHowlerInstances(data);
  renderRandomizerCategories(data);
  renderOneshotsSection();
  renderLoopsSection();
  updateCustomCountersUI();
}

function setupHowlerInstances(sounds) {
  const isFileProtocol = window.location.protocol === "file:";

  sounds.forEach((sound) => {
    const isLoop = sound.type === "loop";
    const audioSrc = sound.blobUrl ? sound.blobUrl : encodeURI(sound.file);
    const useHtml5Audio = isFileProtocol && !sound.blobUrl;

    const howl = new Howl({
      src: [audioSrc],
      format: ["mp3", "wav", "ogg", "m4a"],
      loop: isLoop,
      preload: false,
      volume: isLoop ? AppState.loopVolume : AppState.oneshotVolume,
      html5: useHtml5Audio,
      onload: function () {
        const dur = howl.duration();
        if (dur && dur > 0 && !sound.duration) {
          sound.duration = Math.round(dur * 10) / 10;
          sound.durationFormatted = formatDurationSeconds(dur);
          updateDurationBadgeInDOM(sound.id, sound.durationFormatted);
        }
      },
      onloaderror: () => {
        AppState.failedLoads.add(sound.id);
      }
    });

    AppState.howlInstances[sound.id] = howl;
  });
}

function formatDurationSeconds(sec) {
  if (!sec || isNaN(sec)) return "--:--";
  if (sec < 10) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateDurationBadgeInDOM(soundId, formattedText) {
  document.querySelectorAll(`[data-duration-id="${soundId}"]`).forEach((el) => {
    el.textContent = `⏱️ ${formattedText}`;
  });
}

function getDisplayName(sound) {
  if (sound.name) return sound.name;
  return sound.id.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getThemeCode(sound) {
  if (sound.code) return sound.code;
  const meta = CATEGORY_META[sound.category];
  return meta ? meta.code : "FX";
}

function getCategoryIcon(category) {
  return CATEGORY_META[category]?.icon || "🎃";
}

/**
 * Fonction de tri universelle (pour les Pads et les Ambiances) :
 * - CUSTOM : Place les Favoris en tête, puis respecte l'ordre glisser-déposer de l'utilisateur
 * - DURATION_ASC : Du plus court au plus long
 * - DURATION_DESC : Du plus long au plus court
 * - NAME_ASC : Ordre alphabétique A -> Z
 * - CATEGORY : Regroupé par catégorie puis A -> Z
 */
function sortSoundsList(soundsArray, sortMode, customOrderArray) {
  const orderMap = new Map();
  customOrderArray.forEach((id, idx) => orderMap.set(id, idx));

  return [...soundsArray].sort((a, b) => {
    if (sortMode === "DURATION_ASC") {
      return (a.duration || 9999) - (b.duration || 9999);
    }
    if (sortMode === "DURATION_DESC") {
      return (b.duration || 0) - (a.duration || 0);
    }
    if (sortMode === "NAME_ASC") {
      return getDisplayName(a).localeCompare(getDisplayName(b), "fr");
    }
    if (sortMode === "CATEGORY") {
      const catCmp = (a.category || "").localeCompare(b.category || "", "fr");
      if (catCmp !== 0) return catCmp;
      return getDisplayName(a).localeCompare(getDisplayName(b), "fr");
    }

    // Mode CUSTOM par défaut :
    // 1. Si les deux ont été classés manuellement par Glisser-Déposer, on respecte cet ordre exact
    const hasPosA = orderMap.has(a.id);
    const hasPosB = orderMap.has(b.id);
    if (hasPosA && hasPosB) {
      return orderMap.get(a.id) - orderMap.get(b.id);
    }
    if (hasPosA) return -1;
    if (hasPosB) return 1;

    // 2. Sinon, les Favoris remontent automatiquement en haut
    const favA = AppState.favorites.has(a.id) ? 1 : 0;
    const favB = AppState.favorites.has(b.id) ? 1 : 0;
    if (favA !== favB) return favB - favA;

    return getDisplayName(a).localeCompare(getDisplayName(b), "fr");
  });
}

/**
 * ============================================================================
 * 3. LES PADS SPATIALISÉS (RAIL GAUCHE HORS PANORAMIQUE + GLISSER-DÉPOSER)
 * ============================================================================
 */
const PAD_SENSITIVITY_CURVE = 1.0;

function initOneshotFiltersAndToolbar() {
  const searchInput = document.getElementById("oneshot-search");
  const sortSelect = document.getElementById("oneshot-sort");
  const dragModeBtn = document.getElementById("btn-toggle-drag-mode");
  const durationChips = document.querySelectorAll(".dur-chip");
  const favBtn = document.getElementById("btn-filter-favorites");
  const hiddenBtn = document.getElementById("btn-show-hidden");
  const restoreAllBtn = document.getElementById("btn-restore-all-hidden");
  const volSlider = document.getElementById("oneshot-volume");
  const volLabel = document.getElementById("oneshot-volume-val");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      AppState.oneshotSearchQuery = e.target.value.trim().toLowerCase();
      renderOneshotsSection();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      AppState.oneshotSortMode = e.target.value;
      saveActiveConfiguration();
      renderOneshotsSection();
    });
  }

  // Bouton Mode Déplacement (verrouille le son pour glisser-déposer avec tout le bouton sur smartphone)
  if (dragModeBtn) {
    dragModeBtn.addEventListener("click", () => {
      AppState.dragModeEnabled = !AppState.dragModeEnabled;
      document.body.classList.toggle("drag-mode-active", AppState.dragModeEnabled);
      dragModeBtn.classList.toggle("active", AppState.dragModeEnabled);
      dragModeBtn.textContent = AppState.dragModeEnabled
        ? "🖐️ Mode Déplacement : ON (Sons verrouillés)"
        : "🖐️ Mode Déplacement : OFF";

      // Met à jour l'option handle de SortableJS
      if (AppState.oneshotSortable) {
        AppState.oneshotSortable.option("handle", AppState.dragModeEnabled ? ".sound-pad-card" : ".drag-handle");
      }
    });
  }

  durationChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      durationChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      AppState.selectedDurationFilter = chip.dataset.duration;
      renderOneshotsSection();
    });
  });

  if (favBtn) {
    favBtn.addEventListener("click", () => {
      AppState.onlyFavoritesFilter = !AppState.onlyFavoritesFilter;
      if (AppState.onlyFavoritesFilter) {
        AppState.showHiddenMode = false;
        hiddenBtn?.classList.remove("active");
      }
      favBtn.classList.toggle("active", AppState.onlyFavoritesFilter);
      updateCustomCountersUI();
      renderOneshotsSection();
    });
  }

  if (hiddenBtn) {
    hiddenBtn.addEventListener("click", () => {
      AppState.showHiddenMode = !AppState.showHiddenMode;
      if (AppState.showHiddenMode) {
        AppState.onlyFavoritesFilter = false;
        favBtn?.classList.remove("active");
      }
      hiddenBtn.classList.toggle("active", AppState.showHiddenMode);
      updateCustomCountersUI();
      renderOneshotsSection();
    });
  }

  if (restoreAllBtn) {
    restoreAllBtn.addEventListener("click", () => {
      AppState.soundsData
        .filter((s) => s.type === "oneshot")
        .forEach((s) => AppState.hiddenSounds.delete(s.id));
      AppState.showHiddenMode = false;
      hiddenBtn?.classList.remove("active");
      saveActiveConfiguration();
      renderOneshotsSection();
    });
  }

  if (volSlider) {
    volSlider.addEventListener("input", (e) => {
      AppState.oneshotVolume = parseFloat(e.target.value);
      volLabel.textContent = `${Math.round(AppState.oneshotVolume * 100)}%`;
      saveActiveConfiguration();
    });
  }
}

function matchesDurationFilter(sound, filterType) {
  if (filterType === "ALL") return true;
  const d = sound.duration || 0;
  if (filterType === "SHORT") return d > 0 && d < 3.0;
  if (filterType === "MEDIUM") return d >= 3.0 && d <= 8.0;
  if (filterType === "LONG") return d > 8.0;
  return true;
}

function renderOneshotsSection() {
  const allOneshots = AppState.soundsData.filter((s) => s.type === "oneshot");
  const categories = ["TOUT", ...new Set(allOneshots.map((s) => s.category || "Autres"))];

  // Pastilles de catégories colorées
  const pillsContainer = document.getElementById("oneshots-category-pills");
  if (pillsContainer) {
    pillsContainer.innerHTML = "";
    categories.forEach((cat) => {
      const pill = document.createElement("button");
      pill.className = `cat-pill ${AppState.selectedOneshotCategory === cat ? "active" : ""}`;
      if (cat !== "TOUT" && CATEGORY_META[cat]) {
        pill.setAttribute("data-theme", CATEGORY_META[cat].code);
      }
      const icon = cat === "TOUT" ? "⚡" : getCategoryIcon(cat);
      const count =
        cat === "TOUT"
          ? allOneshots.filter((s) => !AppState.hiddenSounds.has(s.id)).length
          : allOneshots.filter((s) => (s.category || "Autres") === cat && !AppState.hiddenSounds.has(s.id)).length;

      pill.textContent = `${icon} ${cat} (${count})`;
      pill.addEventListener("click", () => {
        AppState.selectedOneshotCategory = cat;
        renderOneshotsSection();
      });
      pillsContainer.appendChild(pill);
    });
  }

  // Filtrage
  const filteredOneshots = allOneshots.filter((sound) => {
    const isHidden = AppState.hiddenSounds.has(sound.id);
    if (AppState.showHiddenMode ? !isHidden : isHidden) return false;
    if (AppState.onlyFavoritesFilter && !AppState.favorites.has(sound.id)) return false;
    if (
      AppState.selectedOneshotCategory !== "TOUT" &&
      (sound.category || "Autres") !== AppState.selectedOneshotCategory
    ) {
      return false;
    }
    if (!matchesDurationFilter(sound, AppState.selectedDurationFilter)) return false;
    if (AppState.oneshotSearchQuery) {
      const haystack = `${getDisplayName(sound)} ${sound.category} ${sound.code}`.toLowerCase();
      if (!haystack.includes(AppState.oneshotSearchQuery)) return false;
    }
    return true;
  });

  // Tri selon le mode choisi (Mon Ordre, Durée Croissante, Durée Décroissante, Nom, Catégorie)
  const sortedOneshots = sortSoundsList(
    filteredOneshots,
    AppState.oneshotSortMode,
    AppState.customOrderOneshots
  );

  const container = document.getElementById("oneshots-container");
  if (!container) return;
  container.innerHTML = "";

  if (sortedOneshots.length === 0) {
    container.innerHTML = `
      <div class="setting-group" style="grid-column: 1 / -1; text-align: center; padding: 1.5rem;">
        <p style="color: var(--text-muted);">Aucun pad ne correspond aux filtres sélectionnés.</p>
      </div>`;
    return;
  }

  sortedOneshots.forEach((sound) => {
    const themeCode = getThemeCode(sound);
    const isFav = AppState.favorites.has(sound.id);
    const isHidden = AppState.hiddenSounds.has(sound.id);
    const durText = sound.durationFormatted || "--:--";

    const padCard = document.createElement("div");
    padCard.className = "sound-pad-card";
    padCard.id = `wide-pad-${sound.id}`;
    padCard.dataset.id = sound.id;
    padCard.setAttribute("data-theme", themeCode);

    // Architecture séparée en 2 zones :
    // 1. `.pad-left-rail` à GAUCHE : contient Poignée de déplacement ⠿, Favori ★ et Masquer ✕ (HORS zone panoramique)
    // 2. `.pad-stereo-surface` à DROITE : 100% dédiée au clic panoramique Gauche (-1.0) <-> Droite (+1.0)
    padCard.innerHTML = `
      <div class="pad-left-rail" title="Outils du Pad (Hors zone de déclenchement)">
        <button type="button" class="rail-btn drag-handle" title="Maintenir et glisser pour déplacer ce Pad">⠿</button>
        <button type="button" class="rail-btn btn-fav ${isFav ? "fav-active" : ""}" title="${isFav ? "Retirer des favoris" : "Ajouter aux favoris"}">
          ${isFav ? "★" : "☆"}
        </button>
        <button type="button" class="rail-btn btn-hide" title="${isHidden ? "Restaurer ce son" : "Supprimer/Masquer de la liste"}">
          ${isHidden ? "♻️" : "✕"}
        </button>
      </div>

      <div class="pad-stereo-surface" role="button" tabindex="0">
        <span class="pad-card-title">${getDisplayName(sound)}</span>
        <div class="pad-card-footer">
          <span class="pad-pan-hint">◀ G | D ▶</span>
          <div class="pad-meta-right">
            <span class="theme-tag">${getCategoryIcon(sound.category)} ${themeCode}</span>
            <span class="duration-badge" data-duration-id="${sound.id}">⏱️ ${durText}</span>
          </div>
        </div>
      </div>
    `;

    // Actions de la colonne de gauche (Favoris & Masquer)
    const favBtn = padCard.querySelector(".btn-fav");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (AppState.favorites.has(sound.id)) AppState.favorites.delete(sound.id);
      else AppState.favorites.add(sound.id);
      saveActiveConfiguration();
      renderOneshotsSection();
    });

    const hideBtn = padCard.querySelector(".btn-hide");
    hideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (AppState.hiddenSounds.has(sound.id)) AppState.hiddenSounds.delete(sound.id);
      else AppState.hiddenSounds.add(sound.id);
      saveActiveConfiguration();
      renderOneshotsSection();
    });

    // Zone de déclenchement Panoramique Stéréo (uniquement sur `.pad-stereo-surface`)
    const stereoSurface = padCard.querySelector(".pad-stereo-surface");
    let startX = 0;
    let startY = 0;

    stereoSurface.addEventListener("pointerdown", (e) => {
      if (AppState.dragModeEnabled || AppState.isDraggingNow) return;
      startX = e.clientX;
      startY = e.clientY;

      const howl = AppState.howlInstances[sound.id];
      if (howl && howl.state() === "unloaded") {
        howl.load();
      }
    });

    stereoSurface.addEventListener("pointerup", (e) => {
      // Si on est en Mode Déplacement ou en train de glisser un pad, aucun son n'est déclenché !
      if (AppState.dragModeEnabled || AppState.isDraggingNow) return;
      if (Math.abs(e.clientX - startX) > 15 || Math.abs(e.clientY - startY) > 15) return;

      // Le calcul de X se fait uniquement sur la largeur de `.pad-stereo-surface` (hors colonne d'outils gauche)
      const rect = stereoSurface.getBoundingClientRect();
      const relX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const relY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

      const normalizedX = (relX / rect.width) * 2 - 1;
      const pan = Math.max(
        -1,
        Math.min(1, Math.sign(normalizedX) * Math.pow(Math.abs(normalizedX), PAD_SENSITIVITY_CURVE))
      );

      spawnRippleOnPad(stereoSurface, padCard, relX, relY);

      const sideLabel = pan < -0.15 ? "Gauche" : pan > 0.15 ? "Droite" : "Centre";
      const panBadge = document.getElementById("last-pan-value");
      if (panBadge) {
        panBadge.textContent = `Pan : ${sideLabel} (${pan >= 0 ? "+" : ""}${pan.toFixed(2)})`;
      }

      triggerOneshotSound(sound.id, AppState.oneshotVolume, pan);
    });

    container.appendChild(padCard);
  });

  // Activation du Glisser-Déposer (SortableJS) sur la grille de Pads
  initOneshotSortableGrid(container);
}

function initOneshotSortableGrid(container) {
  if (typeof Sortable === "undefined") return;
  if (AppState.oneshotSortable) {
    AppState.oneshotSortable.destroy();
  }

  AppState.oneshotSortable = new Sortable(container, {
    animation: 180,
    handle: AppState.dragModeEnabled ? ".sound-pad-card" : ".drag-handle",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    onStart: () => {
      AppState.isDraggingNow = true;
    },
    onEnd: () => {
      // Petit délai de sécurité pour qu'aucun événement pointerup ne déclenche le son au relâchement
      setTimeout(() => {
        AppState.isDraggingNow = false;
      }, 80);

      // Enregistre le nouvel ordre des IDs et bascule automatiquement le sélecteur sur "Mon ordre"
      const currentDomIds = Array.from(container.querySelectorAll(".sound-pad-card")).map(
        (el) => el.dataset.id
      );

      // Conserve aussi les IDs qui n'étaient pas affichés à cause d'un filtre éventuel
      const remainingIds = AppState.customOrderOneshots.filter((id) => !currentDomIds.includes(id));
      AppState.customOrderOneshots = [...currentDomIds, ...remainingIds];

      AppState.oneshotSortMode = "CUSTOM";
      const sortSel = document.getElementById("oneshot-sort");
      if (sortSel) sortSel.value = "CUSTOM";

      saveActiveConfiguration();
    }
  });
}

function spawnRippleOnPad(surfaceElement, cardElement, x, y) {
  const ripple = document.createElement("div");
  ripple.className = "pad-ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  cardElement.classList.add("pad-active-flash");
  surfaceElement.appendChild(ripple);

  setTimeout(() => cardElement.classList.remove("pad-active-flash"), 250);
  setTimeout(() => ripple.remove(), 550);
}

function triggerOneshotSound(soundId, volume = 1.0, stereoPan = 0.0) {
  const howl = AppState.howlInstances[soundId];
  if (!howl) return;

  if (Howler.ctx && Howler.ctx.state === "suspended") {
    Howler.ctx.resume();
  }

  const playAndPan = () => {
    const playId = howl.play();
    howl.volume(volume, playId);
    howl.stereo(stereoPan, playId);
  };

  if (howl.state() === "unloaded") {
    howl.once("load", playAndPan);
    howl.load();
  } else if (howl.state() === "loading") {
    howl.once("load", playAndPan);
  } else {
    playAndPan();
  }
}

/**
 * ============================================================================
 * 4. ÉCRAN AMBIANCES & MUSIQUES (AVEC FAVORIS ⭐, SUPPRESSION ✕, TRI DURÉE & DRAG)
 * ============================================================================
 */
function initLoopFiltersAndToolbar() {
  const loopSearchInput = document.getElementById("loop-search");
  const loopSortSelect = document.getElementById("loop-sort");
  const loopFavBtn = document.getElementById("btn-loop-favorites");
  const loopHiddenBtn = document.getElementById("btn-loop-hidden");
  const restoreLoopsBtn = document.getElementById("btn-restore-all-loops");

  if (loopSearchInput) {
    loopSearchInput.addEventListener("input", (e) => {
      AppState.loopSearchQuery = e.target.value.trim().toLowerCase();
      renderLoopsSection();
    });
  }

  if (loopSortSelect) {
    loopSortSelect.addEventListener("change", (e) => {
      AppState.loopSortMode = e.target.value;
      saveActiveConfiguration();
      renderLoopsSection();
    });
  }

  if (loopFavBtn) {
    loopFavBtn.addEventListener("click", () => {
      AppState.onlyLoopFavoritesFilter = !AppState.onlyLoopFavoritesFilter;
      if (AppState.onlyLoopFavoritesFilter) {
        AppState.showLoopHiddenMode = false;
        loopHiddenBtn?.classList.remove("active");
      }
      loopFavBtn.classList.toggle("active", AppState.onlyLoopFavoritesFilter);
      updateCustomCountersUI();
      renderLoopsSection();
    });
  }

  if (loopHiddenBtn) {
    loopHiddenBtn.addEventListener("click", () => {
      AppState.showLoopHiddenMode = !AppState.showLoopHiddenMode;
      if (AppState.showLoopHiddenMode) {
        AppState.onlyLoopFavoritesFilter = false;
        loopFavBtn?.classList.remove("active");
      }
      loopHiddenBtn.classList.toggle("active", AppState.showLoopHiddenMode);
      updateCustomCountersUI();
      renderLoopsSection();
    });
  }

  if (restoreLoopsBtn) {
    restoreLoopsBtn.addEventListener("click", () => {
      AppState.soundsData
        .filter((s) => s.type === "loop")
        .forEach((s) => AppState.hiddenSounds.delete(s.id));
      AppState.showLoopHiddenMode = false;
      loopHiddenBtn?.classList.remove("active");
      saveActiveConfiguration();
      renderLoopsSection();
    });
  }
}

function renderLoopsSection() {
  const loopSounds = AppState.soundsData.filter((s) => s.type === "loop");
  const categories = ["TOUT", ...new Set(loopSounds.map((s) => s.category || "Autres"))];

  const pillsContainer = document.getElementById("loops-category-pills");
  if (pillsContainer) {
    pillsContainer.innerHTML = "";
    categories.forEach((cat) => {
      const pill = document.createElement("button");
      pill.className = `cat-pill ${AppState.selectedLoopCategory === cat ? "active" : ""}`;
      if (cat !== "TOUT" && CATEGORY_META[cat]) {
        pill.setAttribute("data-theme", CATEGORY_META[cat].code);
      }
      const icon = cat === "TOUT" ? "🌫️" : getCategoryIcon(cat);
      const count =
        cat === "TOUT"
          ? loopSounds.filter((s) => !AppState.hiddenSounds.has(s.id)).length
          : loopSounds.filter((s) => (s.category || "Autres") === cat && !AppState.hiddenSounds.has(s.id)).length;
      pill.textContent = `${icon} ${cat} (${count})`;

      pill.addEventListener("click", () => {
        AppState.selectedLoopCategory = cat;
        renderLoopsSection();
      });
      pillsContainer.appendChild(pill);
    });
  }

  const listContainer = document.getElementById("loops-container");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  const filteredLoops = loopSounds.filter((sound) => {
    const isHidden = AppState.hiddenSounds.has(sound.id);
    if (AppState.showLoopHiddenMode ? !isHidden : isHidden) return false;
    if (AppState.onlyLoopFavoritesFilter && !AppState.favorites.has(sound.id)) return false;
    if (
      AppState.selectedLoopCategory !== "TOUT" &&
      (sound.category || "Autres") !== AppState.selectedLoopCategory
    ) {
      return false;
    }
    if (AppState.loopSearchQuery) {
      const haystack = `${getDisplayName(sound)} ${sound.category}`.toLowerCase();
      if (!haystack.includes(AppState.loopSearchQuery)) return false;
    }
    return true;
  });

  const sortedLoops = sortSoundsList(
    filteredLoops,
    AppState.loopSortMode,
    AppState.customOrderLoops
  );

  if (sortedLoops.length === 0) {
    listContainer.innerHTML = `
      <div class="setting-group" style="grid-column: 1 / -1; text-align: center; padding: 1.5rem;">
        <p style="color: var(--text-muted);">Aucune ambiance ne correspond aux filtres sélectionnés.</p>
      </div>`;
    return;
  }

  sortedLoops.forEach((sound) => {
    const isPlaying = AppState.activeLoopId === sound.id;
    const isFav = AppState.favorites.has(sound.id);
    const isHidden = AppState.hiddenSounds.has(sound.id);
    const themeCode = getThemeCode(sound);
    const icon = getCategoryIcon(sound.category);
    const durText = sound.durationFormatted || "--:--";

    const card = document.createElement("div");
    card.className = `loop-card-wrapper ${isPlaying ? "playing" : ""}`;
    card.id = `loop-btn-${sound.id}`;
    card.dataset.id = sound.id;
    card.setAttribute("data-theme", themeCode);

    card.innerHTML = `
      <div class="pad-left-rail" title="Outils de l'ambiance">
        <button type="button" class="rail-btn drag-handle" title="Glisser pour réorganiser">⠿</button>
        <button type="button" class="rail-btn btn-fav ${isFav ? "fav-active" : ""}" title="${isFav ? "Retirer des favoris" : "Ajouter aux favoris"}">
          ${isFav ? "★" : "☆"}
        </button>
        <button type="button" class="rail-btn btn-hide" title="${isHidden ? "Restaurer cette ambiance" : "Masquer cette ambiance"}">
          ${isHidden ? "♻️" : "✕"}
        </button>
      </div>

      <button type="button" class="loop-main-trigger">
        <div class="loop-item-left">
          <span class="loop-play-icon">${isPlaying ? "⏸️" : "▶️"}</span>
          <div class="loop-title-group">
            <span class="loop-title">${getDisplayName(sound)}</span>
            <span class="loop-cat-sub">${icon} ${sound.category}</span>
          </div>
        </div>
        <span class="duration-badge" data-duration-id="${sound.id}">⏱️ ${durText}</span>
      </button>
    `;

    card.querySelector(".btn-fav").addEventListener("click", (e) => {
      e.stopPropagation();
      if (AppState.favorites.has(sound.id)) AppState.favorites.delete(sound.id);
      else AppState.favorites.add(sound.id);
      saveActiveConfiguration();
      renderLoopsSection();
    });

    card.querySelector(".btn-hide").addEventListener("click", (e) => {
      e.stopPropagation();
      if (AppState.hiddenSounds.has(sound.id)) AppState.hiddenSounds.delete(sound.id);
      else AppState.hiddenSounds.add(sound.id);
      saveActiveConfiguration();
      renderLoopsSection();
    });

    card.querySelector(".loop-main-trigger").addEventListener("click", () => {
      if (AppState.isDraggingNow) return;
      handleLoopClick(sound);
    });

    listContainer.appendChild(card);
  });

  initLoopSortableGrid(listContainer);
}

function initLoopSortableGrid(container) {
  if (typeof Sortable === "undefined") return;
  if (AppState.loopSortable) {
    AppState.loopSortable.destroy();
  }

  AppState.loopSortable = new Sortable(container, {
    animation: 180,
    handle: ".drag-handle",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    onStart: () => {
      AppState.isDraggingNow = true;
    },
    onEnd: () => {
      setTimeout(() => {
        AppState.isDraggingNow = false;
      }, 80);

      const currentDomIds = Array.from(container.querySelectorAll(".loop-card-wrapper")).map(
        (el) => el.dataset.id
      );
      const remainingIds = AppState.customOrderLoops.filter((id) => !currentDomIds.includes(id));
      AppState.customOrderLoops = [...currentDomIds, ...remainingIds];

      AppState.loopSortMode = "CUSTOM";
      const sortSel = document.getElementById("loop-sort");
      if (sortSel) sortSel.value = "CUSTOM";

      saveActiveConfiguration();
    }
  });
}

function handleLoopClick(sound) {
  const targetId = sound.id;

  if (AppState.activeLoopId === targetId) {
    fadeOutAndStopLoop(targetId, AppState.crossfadeDurationMs);
    AppState.activeLoopId = null;
    updateAmbienceStatusUI();
    return;
  }

  if (AppState.activeLoopId && AppState.activeLoopId !== targetId) {
    fadeOutAndStopLoop(AppState.activeLoopId, AppState.crossfadeDurationMs);
  }

  AppState.activeLoopId = targetId;
  fadeInAndStartLoop(sound, AppState.crossfadeDurationMs);
  updateAmbienceStatusUI();
}

function clearFadeInterval(soundId) {
  if (AppState.fadeIntervals[soundId]) {
    clearInterval(AppState.fadeIntervals[soundId]);
    delete AppState.fadeIntervals[soundId];
  }
}

function startSmoothFade(soundId, howl, fromVol, toVol, durationMs, onComplete) {
  clearFadeInterval(soundId);

  const steps = Math.max(1, Math.round(durationMs / 50));
  let currentStep = 0;
  howl.volume(fromVol);

  AppState.fadeIntervals[soundId] = setInterval(() => {
    currentStep++;
    const ratio = Math.min(1, currentStep / steps);
    const newVol = fromVol + (toVol - fromVol) * ratio;
    howl.volume(Math.max(0, Math.min(1, newVol)));

    if (currentStep >= steps) {
      clearFadeInterval(soundId);
      if (onComplete) onComplete();
    }
  }, 50);
}

function fadeInAndStartLoop(sound, durationMs) {
  const howl = AppState.howlInstances[sound.id];
  if (!howl) return;

  if (Howler.ctx && Howler.ctx.state === "suspended") {
    Howler.ctx.resume();
  }

  clearFadeInterval(sound.id);

  const launchPlay = () => {
    if (AppState.activeLoopId !== sound.id) return;

    howl.volume(0.05);
    if (!howl.playing()) {
      howl.play();
    }
    startSmoothFade(sound.id, howl, 0.05, AppState.loopVolume, durationMs);
  };

  if (howl.state() === "unloaded") {
    howl.once("load", launchPlay);
    howl.load();
  } else if (howl.state() === "loading") {
    howl.once("load", launchPlay);
  } else {
    launchPlay();
  }
}

function fadeOutAndStopLoop(soundId, durationMs) {
  const howl = AppState.howlInstances[soundId];
  if (!howl) return;

  const startVol = howl.volume() || AppState.loopVolume;
  startSmoothFade(soundId, howl, startVol, 0, durationMs, () => {
    if (AppState.activeLoopId !== soundId) {
      howl.stop();
    }
  });
}

function updateAmbienceStatusUI() {
  const activeSound = AppState.soundsData.find((s) => s.id === AppState.activeLoopId);
  const nameEl = document.getElementById("active-loop-name");
  const miniBar = document.getElementById("mini-ambience-bar");
  const dotEl = document.getElementById("ambience-dot");
  const stopLoopBtn = document.getElementById("btn-stop-loop");

  if (activeSound) {
    nameEl.textContent = `${getCategoryIcon(activeSound.category)} ${getDisplayName(activeSound)}`;
    miniBar?.classList.add("playing");
    dotEl?.classList.add("playing");
    if (stopLoopBtn) stopLoopBtn.disabled = false;
  } else {
    nameEl.textContent = "Aucune (Silence)";
    miniBar?.classList.remove("playing");
    dotEl?.classList.remove("playing");
    if (stopLoopBtn) stopLoopBtn.disabled = true;
  }

  document.querySelectorAll(".loop-card-wrapper").forEach((card) => {
    const isThisActive = card.id === `loop-btn-${AppState.activeLoopId}`;
    card.classList.toggle("playing", isThisActive);
    const iconSpan = card.querySelector(".loop-play-icon");
    if (iconSpan) iconSpan.textContent = isThisActive ? "⏸️" : "▶️";
  });
}

/**
 * ============================================================================
 * 5. LE MODE "RANDOMIZER" (GÉNÉRATEUR AUTOMATIQUE)
 * ============================================================================
 */
function renderRandomizerCategories(sounds) {
  const container = document.getElementById("randomizer-categories");
  if (!container) return;
  const oneshotSounds = sounds.filter((s) => s.type === "oneshot");
  const categories = [...new Set(oneshotSounds.map((s) => s.category || "Autres"))];

  container.innerHTML = "";
  if (AppState.randomizer.allowedCategories.size === 0) {
    categories.forEach((c) => AppState.randomizer.allowedCategories.add(c));
  }

  categories.forEach((cat) => {
    const isChecked = AppState.randomizer.allowedCategories.has(cat);
    const label = document.createElement("label");
    label.className = "checkbox-card";
    if (CATEGORY_META[cat]) {
      label.setAttribute("data-theme", CATEGORY_META[cat].code);
    }
    label.innerHTML = `
      <input type="checkbox" class="rand-cat-checkbox" value="${cat}" ${isChecked ? "checked" : ""}>
      <span>${getCategoryIcon(cat)} ${cat}</span>
    `;

    const checkbox = label.querySelector("input");
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) AppState.randomizer.allowedCategories.add(cat);
      else AppState.randomizer.allowedCategories.delete(cat);
      saveActiveConfiguration();
    });

    container.appendChild(label);
  });
}

function initRandomizerControls() {
  const toggle = document.getElementById("randomizer-toggle");
  const delayMinSlider = document.getElementById("rand-delay-min");
  const delayMaxSlider = document.getElementById("rand-delay-max");
  const volMinSlider = document.getElementById("rand-vol-min");
  const volMaxSlider = document.getElementById("rand-vol-max");
  const stereoCheckbox = document.getElementById("rand-stereo-random");
  const onlyFavCheckbox = document.getElementById("rand-only-favorites");
  const selectAllBtn = document.getElementById("rand-select-all");
  const selectNoneBtn = document.getElementById("rand-select-none");

  toggle.addEventListener("change", (e) => {
    if (e.target.checked) startRandomizer();
    else stopRandomizer();
  });

  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      document.querySelectorAll(".rand-cat-checkbox").forEach((cb) => {
        cb.checked = true;
        AppState.randomizer.allowedCategories.add(cb.value);
      });
      saveActiveConfiguration();
    });
  }

  if (selectNoneBtn) {
    selectNoneBtn.addEventListener("click", () => {
      document.querySelectorAll(".rand-cat-checkbox").forEach((cb) => {
        cb.checked = false;
      });
      AppState.randomizer.allowedCategories.clear();
      saveActiveConfiguration();
    });
  }

  delayMinSlider.addEventListener("input", (e) => {
    let minVal = parseInt(e.target.value, 10);
    let maxVal = parseInt(delayMaxSlider.value, 10);
    if (minVal > maxVal) {
      delayMaxSlider.value = minVal;
      AppState.randomizer.delayMaxSec = minVal;
      document.getElementById("rand-delay-max-val").textContent = `${minVal}s`;
    }
    AppState.randomizer.delayMinSec = minVal;
    document.getElementById("rand-delay-min-val").textContent = `${minVal}s`;
    saveActiveConfiguration();
  });

  delayMaxSlider.addEventListener("input", (e) => {
    let maxVal = parseInt(e.target.value, 10);
    let minVal = parseInt(delayMinSlider.value, 10);
    if (maxVal < minVal) {
      delayMinSlider.value = maxVal;
      AppState.randomizer.delayMinSec = maxVal;
      document.getElementById("rand-delay-min-val").textContent = `${maxVal}s`;
    }
    AppState.randomizer.delayMaxSec = maxVal;
    document.getElementById("rand-delay-max-val").textContent = `${maxVal}s`;
    saveActiveConfiguration();
  });

  volMinSlider.addEventListener("input", (e) => {
    let minVal = parseFloat(e.target.value);
    let maxVal = parseFloat(volMaxSlider.value);
    if (minVal > maxVal) {
      volMaxSlider.value = minVal;
      AppState.randomizer.volMax = minVal;
      document.getElementById("rand-vol-max-val").textContent = `${Math.round(minVal * 100)}%`;
    }
    AppState.randomizer.volMin = minVal;
    document.getElementById("rand-vol-min-val").textContent = `${Math.round(minVal * 100)}%`;
    saveActiveConfiguration();
  });

  volMaxSlider.addEventListener("input", (e) => {
    let maxVal = parseFloat(e.target.value);
    let minVal = parseFloat(volMinSlider.value);
    if (maxVal < minVal) {
      volMinSlider.value = maxVal;
      AppState.randomizer.volMin = maxVal;
      document.getElementById("rand-vol-min-val").textContent = `${Math.round(maxVal * 100)}%`;
    }
    AppState.randomizer.volMax = maxVal;
    document.getElementById("rand-vol-max-val").textContent = `${Math.round(maxVal * 100)}%`;
    saveActiveConfiguration();
  });

  stereoCheckbox.addEventListener("change", (e) => {
    AppState.randomizer.randomStereo = e.target.checked;
    saveActiveConfiguration();
  });

  if (onlyFavCheckbox) {
    onlyFavCheckbox.addEventListener("change", (e) => {
      AppState.randomizer.onlyFavorites = e.target.checked;
      saveActiveConfiguration();
    });
  }
}

function startRandomizer() {
  AppState.randomizer.enabled = true;
  const statusBox = document.getElementById("randomizer-status-box");
  statusBox.classList.remove("inactive");
  statusBox.classList.add("active");
  document.getElementById("randomizer-state-text").textContent = "Randomizer Actif";

  scheduleNextRandomSound();

  AppState.randomizer.countdownIntervalId = setInterval(() => {
    if (!AppState.randomizer.enabled || !AppState.randomizer.nextTriggerTimestamp) return;
    const remainingSec = Math.max(0, (AppState.randomizer.nextTriggerTimestamp - Date.now()) / 1000);
    document.getElementById("randomizer-countdown").textContent =
      `Prochain son dans : ${remainingSec.toFixed(1)}s`;
  }, 200);
}

function stopRandomizer() {
  AppState.randomizer.enabled = false;
  if (AppState.randomizer.timeoutId) {
    clearTimeout(AppState.randomizer.timeoutId);
    AppState.randomizer.timeoutId = null;
  }
  if (AppState.randomizer.countdownIntervalId) {
    clearInterval(AppState.randomizer.countdownIntervalId);
    AppState.randomizer.countdownIntervalId = null;
  }

  const statusBox = document.getElementById("randomizer-status-box");
  statusBox.classList.remove("active");
  statusBox.classList.add("inactive");
  document.getElementById("randomizer-state-text").textContent = "Randomizer Désactivé";
  document.getElementById("randomizer-countdown").textContent = "--";
}

function scheduleNextRandomSound() {
  if (!AppState.randomizer.enabled) return;

  const { delayMinSec, delayMaxSec } = AppState.randomizer;
  const randomDelaySec = delayMinSec + Math.random() * (delayMaxSec - delayMinSec);
  const delayMs = Math.round(randomDelaySec * 1000);

  AppState.randomizer.nextTriggerTimestamp = Date.now() + delayMs;

  AppState.randomizer.timeoutId = setTimeout(() => {
    executeRandomSoundPick();
    scheduleNextRandomSound();
  }, delayMs);
}

function executeRandomSoundPick() {
  if (!AppState.randomizer.enabled) return;

  const eligibleSounds = AppState.soundsData.filter((s) => {
    if (s.type !== "oneshot") return false;
    if (AppState.hiddenSounds.has(s.id)) return false;
    if (!AppState.randomizer.allowedCategories.has(s.category || "Autres")) return false;
    if (AppState.randomizer.onlyFavorites && !AppState.favorites.has(s.id)) return false;
    return true;
  });

  if (eligibleSounds.length === 0) {
    document.getElementById("randomizer-last-played").textContent =
      "⚠️ Aucun son éligible selon vos filtres Randomizer !";
    return;
  }

  const pickedSound = eligibleSounds[Math.floor(Math.random() * eligibleSounds.length)];
  const { volMin, volMax, randomStereo } = AppState.randomizer;
  const randomVolume = volMin + Math.random() * (volMax - volMin);
  const randomPan = randomStereo ? Math.random() * 2 - 1 : 0.0;

  triggerOneshotSound(pickedSound.id, randomVolume, randomPan);

  const panFormatted = (randomPan >= 0 ? "+" : "") + randomPan.toFixed(2);
  document.getElementById("randomizer-last-played").textContent =
    `Dernier son : ${getDisplayName(pickedSound)} (Vol ${Math.round(randomVolume * 100)}%, Pan ${panFormatted})`;

  const padCard = document.getElementById(`wide-pad-${pickedSound.id}`);
  const surface = padCard?.querySelector(".pad-stereo-surface");
  if (padCard && surface && surface.clientWidth > 0) {
    const xPos = ((randomPan + 1) / 2) * surface.clientWidth;
    const yPos = surface.clientHeight / 2;
    spawnRippleOnPad(surface, padCard, xPos, yPos);
  }
}

/**
 * ============================================================================
 * 6. CONTRÔLES GLOBAUX & NAVIGATION PAR ONGLETS
 * ============================================================================
 */
function initMasterAndAmbienceControls() {
  const masterSlider = document.getElementById("master-volume");
  const masterVal = document.getElementById("master-volume-val");
  const stopAllBtn = document.getElementById("btn-stop-all");

  const loopVolSlider = document.getElementById("loop-master-volume");
  const loopVolVal = document.getElementById("loop-master-volume-val");
  const crossfadeSlider = document.getElementById("crossfade-duration");
  const crossfadeVal = document.getElementById("crossfade-duration-val");
  const stopLoopBtn = document.getElementById("btn-stop-loop");

  masterSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    masterVal.textContent = `${Math.round(val * 100)}%`;
    Howler.volume(val);
  });

  loopVolSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    AppState.loopVolume = val;
    loopVolVal.textContent = `${Math.round(val * 100)}%`;

    if (AppState.activeLoopId && AppState.howlInstances[AppState.activeLoopId]) {
      clearFadeInterval(AppState.activeLoopId);
      AppState.howlInstances[AppState.activeLoopId].volume(val);
    }
    saveActiveConfiguration();
  });

  crossfadeSlider.addEventListener("input", (e) => {
    const sec = parseFloat(e.target.value);
    AppState.crossfadeDurationMs = Math.round(sec * 1000);
    crossfadeVal.textContent = `${sec.toFixed(1)}s`;
    saveActiveConfiguration();
  });

  stopLoopBtn.addEventListener("click", () => {
    if (AppState.activeLoopId) {
      fadeOutAndStopLoop(AppState.activeLoopId, AppState.crossfadeDurationMs);
      AppState.activeLoopId = null;
      updateAmbienceStatusUI();
    }
  });

  stopAllBtn.addEventListener("click", () => {
    stopAllSoundsImmediate();
  });
}

function stopAllSoundsImmediate() {
  const randToggle = document.getElementById("randomizer-toggle");
  if (randToggle && randToggle.checked) {
    randToggle.checked = false;
    stopRandomizer();
  }

  Object.keys(AppState.fadeIntervals).forEach((id) => clearFadeInterval(id));
  AppState.activeLoopId = null;
  Object.values(AppState.howlInstances).forEach((howl) => howl.stop());
  updateAmbienceStatusUI();
}

function initMainTabs() {
  const tabBtns = document.querySelectorAll(".main-tabs-nav .tab-btn");
  const panels = document.querySelectorAll(".panel");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      tabBtns.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active-panel"));

      btn.classList.add("active");
      document.getElementById(targetId)?.classList.add("active-panel");
    });
  });
}

/**
 * ============================================================================
 * 7. SCANNER DE DOSSIER DANS LE NAVIGATEUR
 * ============================================================================
 */
function initFolderScanner() {
  const scanBtn = document.getElementById("btn-scan-folder");
  const folderInput = document.getElementById("folder-scanner-input");
  const exportBtn = document.getElementById("btn-export-json");

  if (!scanBtn || !folderInput) return;

  scanBtn.addEventListener("click", () => folderInput.click());

  folderInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []).filter((f) =>
      /\.(mp3|wav|ogg|m4a)$/i.test(f.name)
    );

    if (files.length === 0) {
      alert("Aucun fichier audio (.mp3, .wav, .ogg, .m4a) trouvé dans ce dossier.");
      return;
    }

    files.sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const existingDurations = {};
    AppState.soundsData.forEach((s) => {
      if (s.file && s.duration) {
        existingDurations[s.file] = {
          duration: s.duration,
          durationFormatted: s.durationFormatted
        };
      }
    });

    const usedIds = new Set();
    const scannedSounds = files.map((file) => {
      const extIndex = file.name.lastIndexOf(".");
      const baseName = (extIndex !== -1 ? file.name.slice(0, extIndex) : file.name).trim();

      const match = baseName.match(/^\[([A-Z]+)\]\s*(.+)$/i);
      let prefix = "AUT";
      let cleanName = baseName;

      if (match) {
        prefix = match[1].toUpperCase();
        cleanName = match[2].trim();
      }

      const category = PREFIX_CATEGORY_MAP[prefix] || "Autres";
      const type = detectSoundTypeInBrowser(prefix, cleanName);

      const baseSlug = `${prefix}_${cleanName}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/œ/g, "oe")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      let id = baseSlug;
      let count = 2;
      while (usedIds.has(id)) {
        id = `${baseSlug}_${count++}`;
      }
      usedIds.add(id);

      const relativeFile = `sounds/${file.name}`;
      const knownDur = existingDurations[relativeFile] || {};

      return {
        id: id,
        name: cleanName,
        code: prefix,
        file: relativeFile,
        category: category,
        type: type,
        duration: knownDur.duration || null,
        durationFormatted: knownDur.durationFormatted || "--:--",
        blobUrl: URL.createObjectURL(file)
      };
    });

    applySoundsList(scannedSounds);
    updateStereoStatusBadge(true);

    if (exportBtn) {
      exportBtn.style.display = "inline-block";
      exportBtn.textContent = `📥 sounds.json (${scannedSounds.length})`;
    }
  });

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const cleanJsonData = AppState.soundsData.map(({ blobUrl, ...rest }) => rest);
      const blob = new Blob([JSON.stringify(cleanJsonData, null, 2)], {
        type: "application/json;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sounds.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

function detectSoundTypeInBrowser(prefix, cleanName) {
  const lower = cleanName.toLowerCase();
  if (lower.includes("en boucle") || lower.includes("loop")) return "loop";
  if (prefix === "AMB") return "loop";
  if (prefix === "MUS") return lower.startsWith("accord ") ? "oneshot" : "loop";
  if (
    lower.includes("effets d'halloween avec tonnerre") ||
    lower.includes("orage violent") ||
    lower.includes("chant fantomatique") ||
    lower.includes("fête des zombies")
  ) {
    return "loop";
  }
  return "oneshot";
}
