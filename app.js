/**
 * ============================================================================
 * HALLOWEEN FX — APP.JS (Design Maquette Illustrée & Moteur Spatialisé)
 * - Vignettes illustrées gothiques générées pour chaque son (Loup, Porte, Cri, Vent, Corbeau, Citrouille, Tonnerre, Cloches, Fantôme, etc.)
 * - Déclenchement Panoramique Stéréo Gauche (-1.0) <-> Droite (+1.0) sur chaque carte
 * - Lecteur d'Ambiance en arrière-plan avec barre de progression, temps réel et Crossfade
 * - Générateur Automatique (Randomizer) avec badges de catégories à coche verte
 * - Glisser-Déposer (SortableJS), Tri par durée, Favoris ★, Masqués ✕, Profils Configs & Anti-Veille
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

  // Personnalisation utilisateur
  favorites: new Set(),
  hiddenSounds: new Set(),
  customOrderOneshots: [],
  customOrderLoops: [],

  oneshotSortable: null,
  loopSortable: null,
  dragModeEnabled: false,
  isDraggingNow: false,

  // Ambiance unique en arrière-plan (Loop) avec Crossfade
  activeLoopId: null,
  loopVolume: 0.70,
  crossfadeDurationMs: 2000,
  fadeIntervals: {},
  ambienceProgressTimer: null,

  // Filtres & Tri des Pads
  oneshotVolume: 1.0,
  selectedOneshotCategory: "TOUT",
  selectedDurationFilter: "ALL",
  oneshotSortMode: "CUSTOM",
  oneshotSearchQuery: "",
  onlyFavoritesFilter: false,
  showHiddenMode: false,

  // Filtres & Tri du Catalogue d'Ambiances
  selectedLoopCategory: "TOUT",
  loopSortMode: "CUSTOM",
  loopSearchQuery: "",
  onlyLoopFavoritesFilter: false,
  showLoopHiddenMode: false,

  // Randomizer
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
    fixedPan: 0.0,
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
 * GÉNÉRATEUR D'ILLUSTRATIONS GOTHIQUES SVG (Style Maquette : Loup, Porte, Cri, Corbeau, Citrouille, Éclair, Cloche, Manoir...)
 * Analyse le titre et la catégorie du son pour dessiner une scène nocturne illustrée unique !
 * ============================================================================
 */
function getSoundArtworkSVG(sound) {
  const text = `${sound.name || ""} ${sound.category || ""}`.toLowerCase();
  const code = sound.code || "FX";

  // 1. Loup / Loup-garou / Hurlement
  if (text.includes("loup")) {
    return `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="moonG" cx="72%" cy="28%" r="45%">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="45%" stop-color="#38bdf8" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#090d16" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="skyW" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b132b"/>
          <stop offset="100%" stop-color="#1c2541"/>
        </linearGradient>
      </defs>
      <rect width="160" height="110" fill="url(#skyW)"/>
      <circle cx="115" cy="32" r="24" fill="#f8fafc" opacity="0.9"/>
      <circle cx="115" cy="32" r="46" fill="url(#moonG)"/>
      <path d="M0 110 L0 85 L35 72 L75 82 L120 68 L160 80 L160 110 Z" fill="#060810"/>
      <!-- Silhouette de loup hurlant -->
      <path d="M46 82 L52 60 L49 48 L56 42 L68 25 L73 27 L69 35 L75 37 L70 46 L76 58 L86 78 Z" fill="#05070c" stroke="#64748b" stroke-width="0.8"/>
      <path d="M10 30 Q40 45 90 25" stroke="#94a3b8" stroke-width="0.6" fill="none" opacity="0.25"/>
    </svg>`;
  }

  // 2. Porte / Bois / Clé / Verrou / Maison
  if (text.includes("porte") || text.includes("bois") || text.includes("clé") || text.includes("verrou")) {
    return `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="doorGlow" cx="50%" cy="55%" r="50%">
          <stop offset="0%" stop-color="#ff9e00" stop-opacity="0.85"/>
          <stop offset="60%" stop-color="#9a3412" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0c0908" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="160" height="110" fill="#0f0a07"/>
      <circle cx="80" cy="58" r="52" fill="url(#doorGlow)"/>
      <!-- Cadre de porte entrouverte avec rayon lumineux -->
      <rect x="52" y="14" width="56" height="86" rx="3" fill="#29170b" stroke="#78350f" stroke-width="2"/>
      <line x1="80" y1="14" x2="80" y2="100" stroke="#ffb703" stroke-width="2.5"/>
      <line x1="66" y1="18" x2="66" y2="96" stroke="#180d06" stroke-width="1.5"/>
      <line x1="94" y1="18" x2="94" y2="96" stroke="#180d06" stroke-width="1.5"/>
      <circle cx="74" cy="58" r="2.5" fill="#fbbf24"/>
      <circle cx="86" cy="58" r="2.5" fill="#fbbf24"/>
    </svg>`;
  }

  // 3. Corbeau / Chouette / Oiseau
  if (text.includes("corbeau") || text.includes("chouette") || code === "ANI") {
    return `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="crowSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#1f2937"/>
        </linearGradient>
      </defs>
      <rect width="160" height="110" fill="url(#crowSky)"/>
      <circle cx="42" cy="30" r="18" fill="#e5e7eb" opacity="0.75"/>
      <!-- Branche morte et silhouette de corbeau -->
      <path d="M0 88 Q60 76 160 92" stroke="#090b10" stroke-width="5" fill="none"/>
      <path d="M68 82 C65 60, 74 44, 86 40 C92 38, 97 41, 100 44 L112 43 L101 48 C102 58, 96 72, 85 83 L95 96 L82 84 Z" fill="#05070b"/>
      <circle cx="93" cy="44" r="1.6" fill="#f59e0b"/>
    </svg>`;
  }

  // 4. Tonnerre / Orage / Éclair
  if (text.includes("tonnerre") || text.includes("orage") || code === "ORA") {
    return `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="110" fill="#090d1a"/>
      <path d="M20 20 Q50 5 85 18 Q120 4 148 22 Q130 40 30 35 Z" fill="#1e293b" opacity="0.85"/>
      <!-- Éclair ramifié lumineux -->
      <path d="M88 12 L68 48 L86 50 L62 98" stroke="#38bdf8" stroke-width="5" fill="none" opacity="0.35"/>
      <path d="M88 12 L68 48 L86 50 L62 98" stroke="#e0f2fe" stroke-width="2" fill="none"/>
      <path d="M74 48 L52 72" stroke="#7dd3fc" stroke-width="1.3" fill="none"/>
      <path d="M80 62 L104 84" stroke="#7dd3fc" stroke-width="1.2" fill="none"/>
    </svg>`;
  }

  // 5. Cloches / Boîte à musique / Orgue / Piano / Musique
  if (text.includes("cloche") || text.includes("musique") || text.includes("orgue") || text.includes("piano") || code === "MUS") {
    return `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bellGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0b0914" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="160" height="110" fill="#0d0b14"/>
      <circle cx="80" cy="55" r="50" fill="url(#bellGlow)"/>
      <!-- Cloche gothique en bronze -->
      <path d="M68 24 C68 18, 92 18, 92 24 L98 68 L108 78 L52 78 L62 68 Z" fill="#475569" stroke="#94a3b8" stroke-width="1.5"/>
      <circle cx="80" cy="83" r="6" fill="#d97706"/>
      <path d="M40 35 Q30 55 40 75" stroke="#fb7185" stroke-width="1.5" fill="none" opacity="0.6"/>
      <path d="M120 35 Q130 55 120 75" stroke="#fb7185" stroke-width="1.5" fill="none" opacity="0.6"/>
    </svg>`;
  }

  // 6. Cri / Voix / Femme / Fantôme / Spectre
  if (text.includes("cri") || text.includes("voix") || text.includes("fantôme") || text.includes("fantomatique") || code === "FAN" || code === "VOX") {
    return `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ghostG" cx="50%" cy="48%" r="48%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45"/>
          <stop offset="60%" stop-color="#1e293b" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#090b10" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="160" height="110" fill="#080c14"/>
      <circle cx="80" cy="52" r="48" fill="url(#ghostG)"/>
      <!-- Visage spectral hurlant dans la brume -->
      <ellipse cx="80" cy="48" rx="22" ry="28" fill="#cbd5e1" opacity="0.82"/>
      <ellipse cx="72" cy="42" rx="4.5" ry="6" fill="#090d16"/>
      <ellipse cx="88" cy="42" rx="4.5" ry="6" fill="#090d16"/>
      <ellipse cx="80" cy="60" rx="6.5" ry="10" fill="#090d16"/>
      <path d="M52 28 Q45 65 56 98 M108 28 Q115 65 104 98" stroke="#64748b" stroke-width="3" fill="none" opacity="0.5"/>
    </svg>`;
  }

  // 7. Rire / Sorcière / Monstre / Citrouille maléfique
  if (text.includes("rire") || text.includes("ricanement") || text.includes("sorci") || text.includes("monstre") || text.includes("zombie") || code === "SOR" || code === "MON") {
    return `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pumpG" cx="50%" cy="55%" r="48%">
          <stop offset="0%" stop-color="#ff7b00" stop-opacity="0.7"/>
          <stop offset="65%" stop-color="#7c2d12" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#0a0708" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="160" height="110" fill="#0c070a"/>
      <circle cx="80" cy="58" r="50" fill="url(#pumpG)"/>
      <!-- Citrouille grimaçante illuminée de l'intérieur -->
      <ellipse cx="80" cy="60" rx="34" ry="27" fill="#2b1206" stroke="#ea580c" stroke-width="1.5"/>
      <path d="M77 33 Q80 22 86 25" stroke="#4d7c0f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <polygon points="62,52 73,46 70,57" fill="#ffbe0b"/>
      <polygon points="98,52 87,46 90,57" fill="#ffbe0b"/>
      <polygon points="77,58 83,58 80,64" fill="#ff9e00"/>
      <path d="M58 68 L66 74 L72 69 L80 76 L88 69 L94 74 L102 68 L95 79 L80 82 L65 79 Z" fill="#ffbe0b"/>
    </svg>`;
  }

  // 8. Vent / Forêt / Cimetière / Nuit / Ambiance (Arbres morts dans la brume)
  return `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fogSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="65%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
    </defs>
    <rect width="160" height="110" fill="url(#fogSky)"/>
    <circle cx="122" cy="28" r="14" fill="#cbd5e1" opacity="0.55"/>
    <!-- Arbres morts tortueux et brume -->
    <path d="M35 110 L35 55 L18 32 M35 65 L54 40 M35 48 L30 22" stroke="#060911" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M115 110 L115 60 L96 38 M115 68 L136 44" stroke="#060911" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <ellipse cx="80" cy="86" rx="75" ry="12" fill="#94a3b8" opacity="0.18"/>
    <path d="M0 95 Q80 82 160 96 L160 110 L0 110 Z" fill="#05070c"/>
  </svg>`;
}

/**
 * ============================================================================
 * 1. INITIALISATION & CHARGEMENT DES PRÉFÉRENCES
 * ============================================================================
 */
document.addEventListener("DOMContentLoaded", async () => {
  await loadSoundsDatabase();
  await loadSharedPresetsAndUrlImport();
  loadActiveConfiguration();

  initMainTabsAndAccordions();
  initMasterAndAmbienceControls();
  initOneshotFiltersAndToolbar();
  initLoopFiltersAndToolbar();
  initRandomizerControls();
  initPresetsModal();
  initFolderScanner();
  initKeepAwakeSystem();
  updateStereoStatusBadge();
  renderQuickPresetsBar();
});

function serializeCurrentConfig() {
  const quickSelectVal = document.getElementById("ambience-quick-select")?.value || null;
  const currentAmbienceId = AppState.activeLoopId || quickSelectVal || null;
  const masterSlider = document.getElementById("master-volume");

  return {
    version: 3,
    savedAt: new Date().toISOString(),
    activeLoopId: currentAmbienceId,
    activeLoopPlaying: Boolean(AppState.activeLoopId || quickSelectVal),
    masterVolume: masterSlider ? parseFloat(masterSlider.value) : 1.0,
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
      enabled: Boolean(AppState.randomizer.enabled),
      delayMinSec: AppState.randomizer.delayMinSec,
      delayMaxSec: AppState.randomizer.delayMaxSec,
      volMin: AppState.randomizer.volMin,
      volMax: AppState.randomizer.volMax,
      randomStereo: AppState.randomizer.randomStereo,
      fixedPan: AppState.randomizer.fixedPan,
      onlyFavorites: AppState.randomizer.onlyFavorites,
      allowedCategories: [...AppState.randomizer.allowedCategories]
    }
  };
}

function applyConfigurationObject(cfg, options = { launchAmbience: false }) {
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

  if (typeof cfg.masterVolume === "number") {
    const ms = document.getElementById("master-volume");
    const ml = document.getElementById("master-volume-val");
    if (ms) ms.value = cfg.masterVolume;
    if (ml) ml.textContent = `${Math.round(cfg.masterVolume * 100)}%`;
    Howler.volume(cfg.masterVolume);
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
    if (AppState.activeLoopId && AppState.howlInstances[AppState.activeLoopId]) {
      AppState.howlInstances[AppState.activeLoopId].volume(cfg.loopVolume);
    }
  }

  if (typeof cfg.crossfadeDurationMs === "number") {
    AppState.crossfadeDurationMs = cfg.crossfadeDurationMs;
    const s = document.getElementById("crossfade-duration");
    const l = document.getElementById("crossfade-duration-val");
    if (s) s.value = (cfg.crossfadeDurationMs / 1000).toFixed(1);
    if (l) l.textContent = `${(cfg.crossfadeDurationMs / 1000).toFixed(1)} s`;
  }

  if (cfg.randomizer) {
    const r = cfg.randomizer;
    if (r.delayMinSec) {
      AppState.randomizer.delayMinSec = r.delayMinSec;
      const el = document.getElementById("rand-delay-min");
      const valEl = document.getElementById("rand-delay-min-val");
      if (el) el.value = r.delayMinSec;
      if (valEl) valEl.textContent = r.delayMinSec;
    }
    if (r.delayMaxSec) {
      AppState.randomizer.delayMaxSec = r.delayMaxSec;
      const el = document.getElementById("rand-delay-max");
      const valEl = document.getElementById("rand-delay-max-val");
      if (el) el.value = r.delayMaxSec;
      if (valEl) valEl.textContent = r.delayMaxSec;
    }
    if (r.volMin) {
      AppState.randomizer.volMin = r.volMin;
      const el = document.getElementById("rand-vol-min");
      const valEl = document.getElementById("rand-vol-min-val");
      if (el) el.value = r.volMin;
      if (valEl) valEl.textContent = `${Math.round(r.volMin * 100)}%`;
    }
    if (r.volMax) {
      AppState.randomizer.volMax = r.volMax;
      const el = document.getElementById("rand-vol-max");
      const valEl = document.getElementById("rand-vol-max-val");
      if (el) el.value = r.volMax;
      if (valEl) valEl.textContent = `${Math.round(r.volMax * 100)}%`;
    }
    if (typeof r.randomStereo === "boolean") {
      AppState.randomizer.randomStereo = r.randomStereo;
      const el = document.getElementById("rand-stereo-random");
      if (el) el.checked = r.randomStereo;
    }
    if (typeof r.onlyFavorites === "boolean") {
      AppState.randomizer.onlyFavorites = r.onlyFavorites;
      const el = document.getElementById("rand-only-favorites");
      if (el) el.checked = r.onlyFavorites;
    }
    if (Array.isArray(r.allowedCategories) && r.allowedCategories.length > 0) {
      AppState.randomizer.allowedCategories = new Set(r.allowedCategories);
    }

    if (options.launchAmbience && typeof r.enabled === "boolean") {
      const randToggle = document.getElementById("randomizer-toggle");
      if (randToggle) randToggle.checked = r.enabled;
      if (r.enabled && !AppState.randomizer.enabled) {
        startRandomizer();
      } else if (!r.enabled && AppState.randomizer.enabled) {
        stopRandomizer();
      }
    }
  }

  saveActiveConfiguration();
  updateCustomCountersUI();
  if (AppState.soundsData.length > 0) {
    renderRandomizerCategories(AppState.soundsData);
    renderOneshotsSection();
    renderLoopsSection();
  }

  // Si on charge un Preset explicitement, on lance (ou coupe) aussi son ambiance d'arrière-plan !
  if (options.launchAmbience) {
    if (cfg.activeLoopId) {
      const targetLoop = AppState.soundsData.find(
        (s) => s.id === cfg.activeLoopId && s.type === "loop"
      );
      if (targetLoop) {
        const quickSelect = document.getElementById("ambience-quick-select");
        if (quickSelect) quickSelect.value = targetLoop.id;

        if (cfg.activeLoopPlaying !== false) {
          if (AppState.activeLoopId !== targetLoop.id) {
            handleLoopClick(targetLoop);
          } else {
            const howl = AppState.howlInstances[targetLoop.id];
            if (howl && !howl.playing()) {
              fadeInAndStartLoop(targetLoop, AppState.crossfadeDurationMs);
            }
            updateAmbienceStatusUI();
          }
        } else {
          const thumbBox = document.getElementById("active-loop-thumb");
          if (thumbBox) thumbBox.innerHTML = getSoundArtworkSVG(targetLoop);
        }
      }
    } else if (AppState.activeLoopId) {
      fadeOutAndStopLoop(AppState.activeLoopId, AppState.crossfadeDurationMs);
      AppState.activeLoopId = null;
      updateAmbienceStatusUI();
    }
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
      applyConfigurationObject(JSON.parse(raw), { launchAmbience: false });
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
 * ============================================================================
 * 2. CHARGEMENT DE LA BASE DE SONS & INSTANCES HOWLER.JS
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
      badge.innerHTML = `<span class="stereo-dot"></span> Stéréo bridée (file://)`;
      badge.classList.add("warn");
    }
    if (unlockBtn && folderInput) {
      unlockBtn.onclick = () => folderInput.click();
    }
  } else {
    if (banner) banner.style.display = "none";
    if (badge) {
      badge.innerHTML = `<span class="stereo-dot"></span> Stéréo Active`;
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
  populateAmbienceQuickDropdown(data);
  renderRandomizerCategories(data);
  renderOneshotsSection();
  renderLoopsSection();
  updateCustomCountersUI();
  updateAmbienceStatusUI();
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
      onplay: function () {
        if (!isLoop) updateOneshotCardPlayingState(sound.id, true);
      },
      onend: function () {
        if (!isLoop) updateOneshotCardPlayingState(sound.id, howl.playing());
      },
      onstop: function () {
        if (!isLoop) updateOneshotCardPlayingState(sound.id, false);
      },
      onloaderror: () => {
        AppState.failedLoads.add(sound.id);
      }
    });

    AppState.howlInstances[sound.id] = howl;
  });
}

function updateOneshotCardPlayingState(soundId, isPlaying) {
  const card = document.getElementById(`wide-pad-${soundId}`);
  if (!card) return;
  card.classList.toggle("playing", isPlaying);
  const playCircle = card.querySelector(".pad-play-circle");
  if (playCircle) {
    playCircle.textContent = isPlaying ? "■" : "▶";
    playCircle.classList.toggle("is-playing", isPlaying);
    playCircle.title = isPlaying
      ? "Recliquer ici pour couper ce son"
      : "Cliquer pour jouer (ou couper si en cours)";
  }
}

function formatDurationSeconds(sec) {
  if (!sec || isNaN(sec)) return "--:--";
  if (sec < 10) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatMMSS(sec) {
  if (!sec || isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function updateDurationBadgeInDOM(soundId, formattedText) {
  document.querySelectorAll(`[data-duration-id="${soundId}"]`).forEach((el) => {
    el.textContent = formattedText;
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

    const hasPosA = orderMap.has(a.id);
    const hasPosB = orderMap.has(b.id);
    if (hasPosA && hasPosB) return orderMap.get(a.id) - orderMap.get(b.id);
    if (hasPosA) return -1;
    if (hasPosB) return 1;

    const favA = AppState.favorites.has(a.id) ? 1 : 0;
    const favB = AppState.favorites.has(b.id) ? 1 : 0;
    if (favA !== favB) return favB - favA;

    return getDisplayName(a).localeCompare(getDisplayName(b), "fr");
  });
}

/**
 * ============================================================================
 * 3. LES PADS SPATIALISÉS ILLUSTRÉS (Style Maquette)
 * ============================================================================
 */
const PAD_SENSITIVITY_CURVE = 1.0;

function initOneshotFiltersAndToolbar() {
  const searchInput = document.getElementById("oneshot-search");
  const funnelBtn = document.getElementById("btn-toggle-advanced-filters");
  const drawer = document.getElementById("advanced-filters-drawer");
  const sortSelect = document.getElementById("oneshot-sort");
  const dragModeBtn = document.getElementById("btn-toggle-drag-mode");
  const durationChips = document.querySelectorAll(".dur-chip");
  const favBtn = document.getElementById("btn-filter-favorites");
  const hiddenBtn = document.getElementById("btn-show-hidden");
  const restoreAllBtn = document.getElementById("btn-restore-all-hidden");
  const volSlider = document.getElementById("oneshot-volume");
  const volLabel = document.getElementById("oneshot-volume-val");

  if (funnelBtn && drawer) {
    funnelBtn.addEventListener("click", () => {
      const isHidden = drawer.style.display === "none";
      drawer.style.display = isHidden ? "flex" : "none";
      funnelBtn.classList.toggle("active", isHidden);
    });
  }

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

  if (dragModeBtn) {
    dragModeBtn.addEventListener("click", () => {
      AppState.dragModeEnabled = !AppState.dragModeEnabled;
      document.body.classList.toggle("drag-mode-active", AppState.dragModeEnabled);
      dragModeBtn.classList.toggle("active", AppState.dragModeEnabled);
      dragModeBtn.innerHTML = AppState.dragModeEnabled
        ? `<span>🖐️</span><span class="drag-btn-txt">Déplacer : ON</span>`
        : `<span>🖐️</span><span class="drag-btn-txt">Déplacer</span>`;

      const container = document.getElementById("oneshots-container");
      if (container) {
        initOneshotSortableGrid(container);
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

  // Pastilles de catégories style maquette ("Tous" en violet lumineux)
  const pillsContainer = document.getElementById("oneshots-category-pills");
  if (pillsContainer) {
    pillsContainer.innerHTML = "";
    categories.forEach((cat) => {
      const pill = document.createElement("button");
      pill.className = `cat-pill ${AppState.selectedOneshotCategory === cat ? "active" : ""}`;
      pill.textContent = cat === "TOUT" ? "Tous" : cat;
      pill.addEventListener("click", () => {
        AppState.selectedOneshotCategory = cat;
        renderOneshotsSection();
      });
      pillsContainer.appendChild(pill);
    });
  }

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
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
        Aucun son ne correspond aux filtres sélectionnés.
      </div>`;
    return;
  }

  sortedOneshots.forEach((sound) => {
    const themeCode = getThemeCode(sound);
    const isFav = AppState.favorites.has(sound.id);
    const isHidden = AppState.hiddenSounds.has(sound.id);
    const isPlaying = AppState.howlInstances[sound.id]?.playing() || false;
    const durText = sound.durationFormatted || "--:--";
    const artworkSvg = getSoundArtworkSVG(sound);

    const padCard = document.createElement("div");
    padCard.className = `sound-pad-card ${isPlaying ? "playing" : ""}`;
    padCard.id = `wide-pad-${sound.id}`;
    padCard.dataset.id = sound.id;
    padCard.setAttribute("data-theme", themeCode);

    // Carte fidèle à la maquette :
    // - Vignette illustrée en haut (avec poignée ⠿ et ✕ en haut à gauche, étoile ★ en haut à droite, durée en bas à droite)
    // - Titre centré au milieu
    // - Bandeau de déclenchement stéréo en bas avec bouton Play/Stop orange (◀ G | ▶ / ■ | D ▶)
    padCard.innerHTML = `
      <div class="pad-artwork-box">
        ${artworkSvg}
        <div class="pad-top-overlay-left">
          <button type="button" class="overlay-icon-btn drag-handle" title="Maintenir et glisser pour déplacer">⠿</button>
          <button type="button" class="overlay-icon-btn btn-hide" title="${isHidden ? "Restaurer ce son" : "Masquer ce son"}">
            ${isHidden ? "♻️" : "✕"}
          </button>
        </div>
        <div class="pad-top-overlay-right">
          <button type="button" class="overlay-icon-btn btn-fav ${isFav ? "fav-active" : ""}" title="${isFav ? "Retirer des favoris" : "Ajouter aux favoris"}">
            ${isFav ? "★" : "☆"}
          </button>
        </div>
        <span class="pad-duration-pill" data-duration-id="${sound.id}">${durText}</span>
      </div>

      <div class="pad-card-title" title="${getDisplayName(sound)}">${getDisplayName(sound)}</div>

      <div class="pad-stereo-trigger-bar" role="button" tabindex="0" title="Cliquer à Gauche (-1.0), au Centre (0.0) ou à Droite (+1.0)">
        <span class="pad-side-lbl">G</span>
        <button type="button" class="pad-play-circle ${isPlaying ? "is-playing" : ""}" title="${isPlaying ? "Recliquer ici pour couper ce son" : "Cliquer pour jouer (ou couper si en cours)"}">${isPlaying ? "■" : "▶"}</button>
        <span class="pad-side-lbl">D</span>
      </div>
    `;

    // Boutons Favori & Masquer (isolés dans les coins supérieurs, hors du bandeau de déclenchement)
    const favBtn = padCard.querySelector(".btn-fav");
    favBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    favBtn.addEventListener("pointerup", (e) => e.stopPropagation());
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (AppState.favorites.has(sound.id)) AppState.favorites.delete(sound.id);
      else AppState.favorites.add(sound.id);
      saveActiveConfiguration();
      renderOneshotsSection();
    });

    const hideBtn = padCard.querySelector(".btn-hide");
    hideBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    hideBtn.addEventListener("pointerup", (e) => e.stopPropagation());
    hideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (AppState.hiddenSounds.has(sound.id)) AppState.hiddenSounds.delete(sound.id);
      else AppState.hiddenSounds.add(sound.id);
      saveActiveConfiguration();
      renderOneshotsSection();
    });

    const dragBtn = padCard.querySelector(".drag-handle");
    if (dragBtn) {
      dragBtn.addEventListener("click", (e) => e.stopPropagation());
    }

    // Déclenchement Panoramique Stéréo (sur le bandeau inférieur OU sur l'image hors icônes de coins)
    let startX = 0;
    let startY = 0;

    padCard.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".overlay-icon-btn")) return;
      if (AppState.dragModeEnabled || AppState.isDraggingNow) return;
      startX = e.clientX;
      startY = e.clientY;

      const howl = AppState.howlInstances[sound.id];
      if (howl && howl.state() === "unloaded") {
        howl.load();
      }
    });

    padCard.addEventListener("pointerup", (e) => {
      if (e.target.closest(".overlay-icon-btn")) return;
      if (AppState.dragModeEnabled || AppState.isDraggingNow) return;
      if (Math.abs(e.clientX - startX) > 15 || Math.abs(e.clientY - startY) > 15) return;

      const howl = AppState.howlInstances[sound.id];
      const clickedPlayCircle = Boolean(e.target.closest(".pad-play-circle"));

      // Si le son est en cours de lecture et qu'on reclique sur le bouton rond Play/Stop (■), on coupe ce son immédiatement !
      if (clickedPlayCircle && howl && howl.playing()) {
        howl.stop();
        updateOneshotCardPlayingState(sound.id, false);
        return;
      }

      // Calcul de la coordonnée X sur le bandeau de déclenchement (ou la carte)
      let pan = 0.0;
      if (!clickedPlayCircle) {
        const triggerBar = padCard.querySelector(".pad-stereo-trigger-bar");
        const targetRect = e.target.closest(".pad-stereo-trigger-bar")
          ? triggerBar.getBoundingClientRect()
          : padCard.getBoundingClientRect();

        const relX = Math.max(0, Math.min(e.clientX - targetRect.left, targetRect.width));
        const normalizedX = (relX / targetRect.width) * 2 - 1;
        pan = Math.max(
          -1,
          Math.min(1, Math.sign(normalizedX) * Math.pow(Math.abs(normalizedX), PAD_SENSITIVITY_CURVE))
        );
      }

      const cardRect = padCard.getBoundingClientRect();
      spawnRippleOnCard(padCard, e.clientX - cardRect.left, e.clientY - cardRect.top);

      const sideLabel = pan < -0.15 ? "Gauche" : pan > 0.15 ? "Droite" : "Centre";
      const panBadge = document.getElementById("last-pan-value");
      if (panBadge) {
        panBadge.textContent = `Pan : ${sideLabel} (${pan >= 0 ? "+" : ""}${pan.toFixed(2)})`;
      }

      triggerOneshotSound(sound.id, AppState.oneshotVolume, pan);
    });

    container.appendChild(padCard);
  });

  initOneshotSortableGrid(container);
}

function initOneshotSortableGrid(container) {
  if (typeof Sortable === "undefined") return;
  if (AppState.oneshotSortable) {
    AppState.oneshotSortable.destroy();
  }

  AppState.oneshotSortable = new Sortable(container, {
    animation: 150,
    draggable: ".sound-pad-card",
    filter: ".btn-fav, .btn-hide, .pad-play-circle",
    preventOnFilter: false,
    delay: AppState.dragModeEnabled ? 0 : 160,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    forceFallback: true,
    fallbackOnBody: true,
    fallbackClass: "sortable-fallback",
    dragClass: "sortable-drag",
    fallbackTolerance: AppState.dragModeEnabled ? 2 : 6,
    ghostClass: "sortable-ghost",
    scroll: true,
    scrollSensitivity: 70,
    scrollSpeed: 16,
    onStart: () => {
      AppState.isDraggingNow = true;
    },
    onEnd: () => {
      setTimeout(() => {
        AppState.isDraggingNow = false;
      }, 120);

      const currentDomIds = Array.from(container.querySelectorAll(".sound-pad-card")).map(
        (el) => el.dataset.id
      );
      const remainingIds = AppState.customOrderOneshots.filter((id) => !currentDomIds.includes(id));
      AppState.customOrderOneshots = [...currentDomIds, ...remainingIds];

      AppState.oneshotSortMode = "CUSTOM";
      const sortSel = document.getElementById("oneshot-sort");
      if (sortSel) sortSel.value = "CUSTOM";

      saveActiveConfiguration();
    }
  });
}

function spawnRippleOnCard(cardElement, x, y) {
  const ripple = document.createElement("div");
  ripple.className = "pad-ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  cardElement.classList.add("pad-active-flash");
  cardElement.appendChild(ripple);

  setTimeout(() => cardElement.classList.remove("pad-active-flash"), 260);
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
 * 4. AMBIANCES EN ARRIÈRE-PLAN (WIDGET DROIT + CATALOGUE COMPLET)
 * ============================================================================
 */
function populateAmbienceQuickDropdown(sounds) {
  const select = document.getElementById("ambience-quick-select");
  const thumbBox = document.getElementById("active-loop-thumb");
  if (!select) return;

  const loopSounds = sounds.filter((s) => s.type === "loop");
  select.innerHTML = `<option value="">-- Aucune ambiance (Silence) --</option>`;

  loopSounds.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${getDisplayName(s)} (${s.durationFormatted || "--:--"})`;
    select.appendChild(opt);
  });

  // Miniature par défaut dans le lecteur d'ambiance
  if (thumbBox && loopSounds.length > 0) {
    thumbBox.innerHTML = getSoundArtworkSVG(loopSounds[0]);
  }
}

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
      pill.textContent = cat === "TOUT" ? "Toutes" : cat;
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

  sortedLoops.forEach((sound) => {
    const isPlaying = AppState.activeLoopId === sound.id;
    const isFav = AppState.favorites.has(sound.id);
    const isHidden = AppState.hiddenSounds.has(sound.id);
    const themeCode = getThemeCode(sound);
    const durText = sound.durationFormatted || "--:--";
    const artworkSvg = getSoundArtworkSVG(sound);

    const card = document.createElement("div");
    card.className = `sound-pad-card ${isPlaying ? "playing" : ""}`;
    card.id = `loop-btn-${sound.id}`;
    card.dataset.id = sound.id;
    card.setAttribute("data-theme", themeCode);

    card.innerHTML = `
      <div class="pad-artwork-box">
        ${artworkSvg}
        <div class="pad-top-overlay-left">
          <button type="button" class="overlay-icon-btn drag-handle" title="Glisser pour réorganiser">⠿</button>
          <button type="button" class="overlay-icon-btn btn-hide" title="${isHidden ? "Restaurer" : "Masquer"}">
            ${isHidden ? "♻️" : "✕"}
          </button>
        </div>
        <div class="pad-top-overlay-right">
          <button type="button" class="overlay-icon-btn btn-fav ${isFav ? "fav-active" : ""}" title="Favori">
            ${isFav ? "★" : "☆"}
          </button>
        </div>
        <span class="pad-duration-pill" data-duration-id="${sound.id}">${durText}</span>
      </div>

      <div class="pad-card-title" title="${getDisplayName(sound)}">${getDisplayName(sound)}</div>

      <div class="pad-stereo-trigger-bar" role="button" tabindex="0">
        <span class="pad-side-lbl">Loop</span>
        <span class="pad-play-circle loop-play-icon">${isPlaying ? "⏸" : "▶"}</span>
        <span class="pad-side-lbl">Fade</span>
      </div>
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

    card.addEventListener("click", (e) => {
      if (e.target.closest(".overlay-icon-btn")) return;
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
    animation: 150,
    draggable: ".sound-pad-card",
    filter: ".btn-fav, .btn-hide",
    preventOnFilter: false,
    delay: 160,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    forceFallback: true,
    fallbackOnBody: true,
    fallbackClass: "sortable-fallback",
    dragClass: "sortable-drag",
    fallbackTolerance: 6,
    ghostClass: "sortable-ghost",
    scroll: true,
    scrollSensitivity: 70,
    scrollSpeed: 16,
    onStart: () => {
      AppState.isDraggingNow = true;
    },
    onEnd: () => {
      setTimeout(() => {
        AppState.isDraggingNow = false;
      }, 120);

      const currentDomIds = Array.from(container.querySelectorAll(".sound-pad-card")).map(
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

  if (!KeepAwakeManager.enabled) {
    enableKeepAwake();
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
  const stopLoopBtn = document.getElementById("btn-stop-loop");
  const select = document.getElementById("ambience-quick-select");
  const playBtn = document.getElementById("btn-ambience-play-pause");
  const thumbBox = document.getElementById("active-loop-thumb");
  const fillEl = document.getElementById("ambience-progress-fill");
  const thumbDotEl = document.getElementById("ambience-progress-thumb");
  const timeLabel = document.getElementById("ambience-time-label");

  if (AppState.ambienceProgressTimer) {
    clearInterval(AppState.ambienceProgressTimer);
    AppState.ambienceProgressTimer = null;
  }

  if (activeSound) {
    if (stopLoopBtn) stopLoopBtn.disabled = false;
    if (select) select.value = activeSound.id;
    if (playBtn) {
      playBtn.textContent = "⏸";
      playBtn.classList.add("playing");
    }
    if (thumbBox) {
      thumbBox.innerHTML = getSoundArtworkSVG(activeSound);
    }

    // Met à jour la barre de progression de l'ambiance toutes les 300ms
    AppState.ambienceProgressTimer = setInterval(() => {
      const howl = AppState.howlInstances[activeSound.id];
      if (!howl || !howl.playing()) return;
      const seek = howl.seek() || 0;
      const dur = howl.duration() || activeSound.duration || 1;
      const pct = Math.min(100, Math.max(0, (seek / dur) * 100));
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (thumbDotEl) thumbDotEl.style.left = `${pct}%`;
      if (timeLabel) timeLabel.textContent = `${formatMMSS(seek)} / ${formatMMSS(dur)}`;
    }, 300);
  } else {
    if (stopLoopBtn) stopLoopBtn.disabled = true;
    if (select) select.value = "";
    if (playBtn) {
      playBtn.textContent = "▶";
      playBtn.classList.remove("playing");
    }
    if (fillEl) fillEl.style.width = "0%";
    if (thumbDotEl) thumbDotEl.style.left = "0%";
    if (timeLabel) timeLabel.textContent = "00:00 / 00:00";
  }

  document.querySelectorAll("#loops-container .sound-pad-card").forEach((card) => {
    const isThisActive = card.id === `loop-btn-${AppState.activeLoopId}`;
    card.classList.toggle("playing", isThisActive);
    const iconSpan = card.querySelector(".loop-play-icon");
    if (iconSpan) iconSpan.textContent = isThisActive ? "⏸" : "▶";
  });
}

/**
 * ============================================================================
 * 5. GÉNÉRATEUR AUTOMATIQUE (RANDOMIZER — Style Maquette)
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
    label.className = `rand-cat-pill ${isChecked ? "checked" : ""}`;
    label.innerHTML = `
      <input type="checkbox" class="rand-cat-checkbox" value="${cat}" ${isChecked ? "checked" : ""}>
      <span class="rand-cat-check">✓</span>
      <span>${cat}</span>
    `;

    const checkbox = label.querySelector("input");
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        AppState.randomizer.allowedCategories.add(cat);
        label.classList.add("checked");
      } else {
        AppState.randomizer.allowedCategories.delete(cat);
        label.classList.remove("checked");
      }
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
  const fixedPanSlider = document.getElementById("rand-fixed-pan");
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
        cb.closest(".rand-cat-pill")?.classList.add("checked");
        AppState.randomizer.allowedCategories.add(cb.value);
      });
      saveActiveConfiguration();
    });
  }

  if (selectNoneBtn) {
    selectNoneBtn.addEventListener("click", () => {
      document.querySelectorAll(".rand-cat-checkbox").forEach((cb) => {
        cb.checked = false;
        cb.closest(".rand-cat-pill")?.classList.remove("checked");
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
      document.getElementById("rand-delay-max-val").textContent = minVal;
    }
    AppState.randomizer.delayMinSec = minVal;
    document.getElementById("rand-delay-min-val").textContent = minVal;
    saveActiveConfiguration();
  });

  delayMaxSlider.addEventListener("input", (e) => {
    let maxVal = parseInt(e.target.value, 10);
    let minVal = parseInt(delayMinSlider.value, 10);
    if (maxVal < minVal) {
      delayMinSlider.value = maxVal;
      AppState.randomizer.delayMinSec = maxVal;
      document.getElementById("rand-delay-min-val").textContent = maxVal;
    }
    AppState.randomizer.delayMaxSec = maxVal;
    document.getElementById("rand-delay-max-val").textContent = maxVal;
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

  if (fixedPanSlider) {
    fixedPanSlider.addEventListener("input", (e) => {
      AppState.randomizer.fixedPan = parseFloat(e.target.value);
      // Si l'utilisateur bouge le curseur Pan manuellement, on décoche "Aléatoire"
      stereoCheckbox.checked = false;
      AppState.randomizer.randomStereo = false;
      saveActiveConfiguration();
    });
  }

  if (onlyFavCheckbox) {
    onlyFavCheckbox.addEventListener("change", (e) => {
      AppState.randomizer.onlyFavorites = e.target.checked;
      saveActiveConfiguration();
    });
  }
}

function startRandomizer() {
  if (!KeepAwakeManager.enabled) {
    enableKeepAwake();
  }
  AppState.randomizer.enabled = true;
  const statusBox = document.getElementById("randomizer-status-box");
  statusBox.classList.remove("inactive");
  statusBox.classList.add("active");
  document.getElementById("randomizer-state-text").textContent = "🟢 Randomizer Actif";

  scheduleNextRandomSound();

  AppState.randomizer.countdownIntervalId = setInterval(() => {
    if (!AppState.randomizer.enabled || !AppState.randomizer.nextTriggerTimestamp) return;
    const remainingSec = Math.max(0, (AppState.randomizer.nextTriggerTimestamp - Date.now()) / 1000);
    document.getElementById("randomizer-countdown").textContent =
      `Prochain : ${remainingSec.toFixed(1)}s`;
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
  document.getElementById("randomizer-state-text").textContent = "Inactif";
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
      "⚠️ Aucun son éligible selon vos filtres !";
    return;
  }

  const pickedSound = eligibleSounds[Math.floor(Math.random() * eligibleSounds.length)];
  const { volMin, volMax, randomStereo, fixedPan } = AppState.randomizer;
  const randomVolume = volMin + Math.random() * (volMax - volMin);
  const pan = randomStereo ? Math.random() * 2 - 1 : fixedPan;

  // Fait bouger le curseur Pan du Randomizer pour visualiser où le son a été tiré !
  const fixedPanSlider = document.getElementById("rand-fixed-pan");
  if (fixedPanSlider && randomStereo) {
    fixedPanSlider.value = pan.toFixed(2);
  }

  triggerOneshotSound(pickedSound.id, randomVolume, pan);

  const panFormatted = (pan >= 0 ? "+" : "") + pan.toFixed(2);
  document.getElementById("randomizer-last-played").textContent =
    `Dernier : ${getDisplayName(pickedSound)} (Vol ${Math.round(randomVolume * 100)}%, Pan ${panFormatted})`;

  const padCard = document.getElementById(`wide-pad-${pickedSound.id}`);
  if (padCard && padCard.clientWidth > 0) {
    const xPos = ((pan + 1) / 2) * padCard.clientWidth;
    const yPos = padCard.clientHeight / 2;
    spawnRippleOnCard(padCard, xPos, yPos);
  }
}

/**
 * ============================================================================
 * 6. CONTRÔLES GLOBAUX, NAVIGATION & MODALE CONFIGS
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
  const quickSelect = document.getElementById("ambience-quick-select");
  const playPauseBtn = document.getElementById("btn-ambience-play-pause");
  const openCatalogBtn = document.getElementById("btn-open-loops-catalog");

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
    crossfadeVal.textContent = `${sec.toFixed(1)} s`;
    saveActiveConfiguration();
  });

  if (quickSelect) {
    quickSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (!val) {
        if (AppState.activeLoopId) {
          fadeOutAndStopLoop(AppState.activeLoopId, AppState.crossfadeDurationMs);
          AppState.activeLoopId = null;
          updateAmbienceStatusUI();
        }
        return;
      }
      const sound = AppState.soundsData.find((s) => s.id === val);
      if (sound) handleLoopClick(sound);
    });
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (AppState.activeLoopId) {
        fadeOutAndStopLoop(AppState.activeLoopId, AppState.crossfadeDurationMs);
        AppState.activeLoopId = null;
        updateAmbienceStatusUI();
      } else {
        const firstLoop = AppState.soundsData.find((s) => s.type === "loop" && !AppState.hiddenSounds.has(s.id));
        if (firstLoop) handleLoopClick(firstLoop);
      }
    });
  }

  if (openCatalogBtn) {
    openCatalogBtn.addEventListener("click", () => {
      document.querySelector('.main-tab[data-target="view-ambience"]')?.click();
    });
  }

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

function initMainTabsAndAccordions() {
  const tabs = document.querySelectorAll(".main-tab");
  const padsStage = document.getElementById("stage-pads-content");
  const loopsCatalog = document.getElementById("stage-loops-catalog");
  const widgetAmbience = document.getElementById("widget-ambience");
  const widgetRandomizer = document.getElementById("widget-randomizer");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.target;
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      if (target === "view-pads") {
        padsStage.style.display = "flex";
        loopsCatalog.style.display = "none";
      } else if (target === "view-ambience") {
        padsStage.style.display = "none";
        loopsCatalog.style.display = "flex";
        widgetAmbience.classList.remove("collapsed");
      } else if (target === "view-randomizer") {
        // Sur mobile/tablette, fait défiler directement vers le panneau Générateur Automatique
        widgetRandomizer.classList.remove("collapsed");
        widgetRandomizer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Accordéons repliables pour Tablette & Smartphone
  document.getElementById("accordion-ambience-toggle")?.addEventListener("click", () => {
    if (window.innerWidth <= 1080) {
      widgetAmbience.classList.toggle("collapsed");
    }
  });

  document.getElementById("accordion-randomizer-toggle")?.addEventListener("click", () => {
    if (window.innerWidth <= 1080) {
      widgetRandomizer.classList.toggle("collapsed");
    }
  });
}

async function loadSharedPresetsAndUrlImport() {
  const presets = getSavedPresetsMap();

  // 1. Vérifie si l'utilisateur vient de scanner un QR Code / Lien Magique (?importPresets=...)
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("importPresets");
    if (encoded) {
      const jsonStr = decodeURIComponent(escape(atob(encoded)));
      const importedMap = JSON.parse(jsonStr);
      if (importedMap && typeof importedMap === "object") {
        Object.assign(presets, importedMap);
        localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        setTimeout(() => {
          alert(`🎃 ${Object.keys(importedMap).length} Preset(s) importé(s) avec succès sur cet appareil !`);
        }, 250);
      }
    }
  } catch (err) {
    console.warn("Erreur lors de l'import des presets depuis l'URL :", err);
  }

  // 2. Charge automatiquement le fichier partagé presets.json du dépôt GitHub (pour synchroniser PC -> Tél/Tablette)
  if (window.location.protocol !== "file:") {
    try {
      const resp = await fetch("./presets.json", { cache: "no-store" });
      if (resp.ok) {
        const sharedPresets = await resp.json();
        if (sharedPresets && typeof sharedPresets === "object") {
          let changed = false;
          Object.entries(sharedPresets).forEach(([name, cfg]) => {
            if (!presets[name]) {
              presets[name] = cfg;
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
          }
        }
      }
    } catch (e) {}
  }
}

function getLoopLabelById(loopId) {
  if (!loopId) return "Silence";
  const found = AppState.soundsData.find((s) => s.id === loopId);
  return found ? getDisplayName(found) : loopId;
}

function updateModalAmbiencePreviewBadge() {
  const badgeStrong = document.getElementById("preset-current-ambience-name");
  if (!badgeStrong) return;
  const quickSelectVal = document.getElementById("ambience-quick-select")?.value || null;
  const currentAmbienceId = AppState.activeLoopId || quickSelectVal || null;
  badgeStrong.textContent = currentAmbienceId
    ? `${getLoopLabelById(currentAmbienceId)} (Lecture auto)`
    : "Aucune (Silence)";
}

function renderQuickPresetsBar() {
  const container = document.getElementById("quick-presets-pills");
  if (!container) return;

  const presets = getSavedPresetsMap();
  const names = Object.keys(presets);
  container.innerHTML = "";

  if (names.length === 0) {
    container.innerHTML = `<span style="font-size: 0.74rem; color: var(--text-muted);">Aucun preset — cliquez sur "➕ Sauver" pour créer votre 1er preset avec ambiance !</span>`;
    return;
  }

  names.forEach((name) => {
    const cfg = presets[name];
    const ambName = cfg?.activeLoopId ? getLoopLabelById(cfg.activeLoopId) : "Silence";
    const shortAmb = ambName.length > 18 ? ambName.slice(0, 17) + "…" : ambName;

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `preset-quick-pill ${AppState.activePresetName === name ? "active" : ""}`;
    pill.title = `Charger le Preset "${name}" (Ambiance : ${ambName})`;
    pill.innerHTML = `
      <span>${name}</span>
      <span class="preset-pill-amb-tag">🎵 ${shortAmb}</span>
    `;

    pill.addEventListener("click", () => {
      AppState.activePresetName = name;
      applyConfigurationObject(cfg, { launchAmbience: true });
      renderQuickPresetsBar();
    });

    container.appendChild(pill);
  });
}

function initPresetsModal() {
  const modal = document.getElementById("presets-modal");
  const openBtn = document.getElementById("btn-open-presets");
  const quickSaveBtn = document.getElementById("btn-quick-save-preset");
  const quickSyncBtn = document.getElementById("btn-quick-sync-presets");
  const closeBtn = document.getElementById("btn-close-presets");
  const saveBtn = document.getElementById("btn-save-preset");
  const nameInput = document.getElementById("preset-name-input");
  const saveProjectBtn = document.getElementById("btn-save-presets-project");
  const qrBtn = document.getElementById("btn-generate-qr-sync");
  const qrPanel = document.getElementById("qr-sync-panel");
  const qrImg = document.getElementById("qr-code-img");
  const qrInput = document.getElementById("qr-magic-link-input");
  const copyLinkBtn = document.getElementById("btn-copy-magic-link");
  const exportFileBtn = document.getElementById("btn-export-config-file");
  const importFileBtn = document.getElementById("btn-import-config-file");
  const importInput = document.getElementById("import-config-input");
  const resetBtn = document.getElementById("btn-reset-default-config");

  if (!modal || !openBtn) return;

  const openModalWithPreview = () => {
    updateModalAmbiencePreviewBadge();
    renderSavedPresetsList();
    if (qrPanel) qrPanel.style.display = "none";
    modal.style.display = "flex";
  };

  openBtn.addEventListener("click", openModalWithPreview);
  if (quickSyncBtn) {
    quickSyncBtn.addEventListener("click", openModalWithPreview);
  }

  // Bouton rapide "➕ Sauver" directement depuis la barre principale
  if (quickSaveBtn) {
    quickSaveBtn.addEventListener("click", () => {
      const quickSelectVal = document.getElementById("ambience-quick-select")?.value || null;
      const currentAmbId = AppState.activeLoopId || quickSelectVal || null;
      const ambLabel = currentAmbId ? getLoopLabelById(currentAmbId) : "Sans ambiance";
      const suggested = `🎃 ${ambLabel}`;
      const chosenName = prompt(
        `Nom du nouveau Preset à enregistrer\n(Ambiance incluse : ${ambLabel}) :`,
        suggested
      );
      if (!chosenName || !chosenName.trim()) return;
      const cleanName = chosenName.trim();
      const presets = getSavedPresetsMap();
      presets[cleanName] = serializeCurrentConfig();
      localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
      AppState.activePresetName = cleanName;
      renderQuickPresetsBar();
      renderSavedPresetsList();
    });
  }

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  saveBtn.addEventListener("click", () => {
    const quickSelectVal = document.getElementById("ambience-quick-select")?.value || null;
    const currentAmbId = AppState.activeLoopId || quickSelectVal || null;
    const defaultLabel = currentAmbId
      ? `🎃 ${getLoopLabelById(currentAmbId)}`
      : `Config ${new Date().toLocaleTimeString("fr-FR")}`;
    const name = (nameInput.value || "").trim() || defaultLabel;
    const presets = getSavedPresetsMap();
    presets[name] = serializeCurrentConfig();
    localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
    AppState.activePresetName = name;
    nameInput.value = "";
    renderSavedPresetsList();
    renderQuickPresetsBar();
  });

  // Sauvegarder presets.json dans le dossier GitHub pour que tous les appareils (Tél, Tablette, PC) l'aient automatiquement !
  if (saveProjectBtn) {
    saveProjectBtn.addEventListener("click", async () => {
      const presets = getSavedPresetsMap();
      const jsonContent = JSON.stringify(presets, null, 2);

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: "presets.json",
            types: [
              {
                description: "Fichier Presets Halloween FX",
                accept: { "application/json": [".json"] }
              }
            ]
          });
          const writable = await handle.createWritable();
          await writable.write(jsonContent);
          await writable.close();
          alert(
            "✅ Fichier presets.json enregistré !\nIl vous suffit maintenant de faire 'Commit' + 'Push' dans GitHub Desktop pour retrouver tous vos Presets sur votre téléphone et votre tablette."
          );
          return;
        } catch (err) {
          if (err.name === "AbortError") return;
        }
      }

      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "presets.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Générer un QR Code + Lien Magique pour envoyer tous les Presets du PC vers le Téléphone en 2 secondes !
  if (qrBtn && qrPanel && qrImg && qrInput) {
    qrBtn.addEventListener("click", () => {
      const presets = getSavedPresetsMap();
      if (Object.keys(presets).length === 0) {
        alert("Enregistrez d'abord au moins un Preset avant de générer le QR Code.");
        return;
      }

      // On crée une version allégée des presets pour que le QR Code reste ultra-compact et rapide à scanner
      const compactPresets = {};
      Object.entries(presets).forEach(([k, v]) => {
        compactPresets[k] = {
          version: 3,
          activeLoopId: v.activeLoopId || null,
          activeLoopPlaying: v.activeLoopPlaying !== false,
          masterVolume: v.masterVolume ?? 1,
          oneshotVolume: v.oneshotVolume ?? 1,
          loopVolume: v.loopVolume ?? 0.7,
          crossfadeDurationMs: v.crossfadeDurationMs ?? 2000,
          oneshotSortMode: v.oneshotSortMode || "CUSTOM",
          loopSortMode: v.loopSortMode || "CUSTOM",
          favorites: v.favorites || [],
          hiddenSounds: v.hiddenSounds || [],
          customOrderOneshots: (v.customOrderOneshots || []).slice(0, 40),
          randomizer: v.randomizer
        };
      });

      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(compactPresets))));
      const baseUrl =
        window.location.protocol === "file:"
          ? "https://ultimeatomemp-blip.github.io/halloween-soundboard/"
          : window.location.origin + window.location.pathname;
      const magicUrl = `${baseUrl}?importPresets=${encodeURIComponent(encoded)}`;

      qrInput.value = magicUrl;
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=${encodeURIComponent(magicUrl)}`;
      qrPanel.style.display = "flex";
    });
  }

  if (copyLinkBtn && qrInput) {
    copyLinkBtn.addEventListener("click", () => {
      qrInput.select();
      navigator.clipboard?.writeText(qrInput.value);
      copyLinkBtn.textContent = "✅ Lien copié !";
      setTimeout(() => {
        copyLinkBtn.textContent = "📋 Copier le lien";
      }, 2000);
    });
  }

  exportFileBtn.addEventListener("click", () => {
    const presets = getSavedPresetsMap();
    const payload = Object.keys(presets).length > 0 ? presets : { "Ma Config": serializeCurrentConfig() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "presets.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  importFileBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          if (parsed.version && (parsed.favorites || parsed.randomizer)) {
            applyConfigurationObject(parsed, { launchAmbience: true });
          } else {
            const presets = getSavedPresetsMap();
            Object.assign(presets, parsed);
            localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
            renderSavedPresetsList();
            renderQuickPresetsBar();
          }
        }
        modal.style.display = "none";
      } catch (err) {
        alert("Fichier de configuration invalide.");
      }
    };
    reader.readAsText(file);
  });

  resetBtn.addEventListener("click", () => {
    if (!confirm("Réinitialiser l'ordre des pads, les favoris et les sons masqués par défaut ?")) return;
    AppState.favorites.clear();
    AppState.hiddenSounds.clear();
    AppState.customOrderOneshots = [];
    AppState.customOrderLoops = [];
    AppState.oneshotSortMode = "CUSTOM";
    AppState.loopSortMode = "CUSTOM";
    AppState.activePresetName = null;
    saveActiveConfiguration();
    renderOneshotsSection();
    renderLoopsSection();
    renderQuickPresetsBar();
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
    listEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem; padding: 0.5rem;">Aucun Preset enregistré pour l'instant.</div>`;
    return;
  }

  listEl.innerHTML = "";
  names.forEach((name) => {
    const cfg = presets[name];
    const ambLabel = cfg?.activeLoopId ? getLoopLabelById(cfg.activeLoopId) : "Silence";
    const row = document.createElement("div");
    row.className = "preset-item";
    row.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.15rem; min-width:0;">
        <span style="font-weight:700; font-size:0.85rem; color:var(--text-main);">${name}</span>
        <span style="font-size:0.72rem; color:#4ade80;">🎵 Ambiance : ${ambLabel}</span>
      </div>
      <div style="display:flex; gap:0.35rem; flex-shrink:0;">
        <button type="button" class="btn-primary btn-load-p" style="padding:0.35rem 0.7rem; font-size:0.75rem;">▶ Charger</button>
        <button type="button" class="btn-secondary btn-update-p" title="Mettre à jour ce preset avec les réglages et l'ambiance actuels" style="padding:0.35rem 0.55rem;">💾</button>
        <button type="button" class="btn-tiny btn-del-p" title="Supprimer ce preset">🗑️</button>
      </div>
    `;

    row.querySelector(".btn-load-p").addEventListener("click", () => {
      AppState.activePresetName = name;
      applyConfigurationObject(presets[name], { launchAmbience: true });
      renderQuickPresetsBar();
      document.getElementById("presets-modal").style.display = "none";
    });

    row.querySelector(".btn-update-p").addEventListener("click", () => {
      presets[name] = serializeCurrentConfig();
      localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
      AppState.activePresetName = name;
      renderSavedPresetsList();
      renderQuickPresetsBar();
    });

    row.querySelector(".btn-del-p").addEventListener("click", () => {
      delete presets[name];
      localStorage.setItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(presets));
      if (AppState.activePresetName === name) AppState.activePresetName = null;
      renderSavedPresetsList();
      renderQuickPresetsBar();
    });

    listEl.appendChild(row);
  });
}

/**
 * ============================================================================
 * 7. SCANNER DE DOSSIER & EXPORT SOUNDS.JSON
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

/**
 * ============================================================================
 * 8. SYSTÈME ANTI-VEILLE & MAINTIEN AUDIO SUR SMARTPHONE VERROUILLÉ
 * ============================================================================
 */
const KeepAwakeManager = {
  enabled: false,
  wakeLockSentinel: null,
  silentAudioEl: null,
  webAudioOsc: null
};

function initKeepAwakeSystem() {
  const btn = document.getElementById("btn-keep-awake");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (KeepAwakeManager.enabled) {
      await disableKeepAwake();
    } else {
      await enableKeepAwake();
    }
  });

  document.addEventListener("visibilitychange", async () => {
    if (KeepAwakeManager.enabled && document.visibilityState === "visible") {
      await requestScreenWakeLock();
      if (Howler.ctx && Howler.ctx.state === "suspended") {
        Howler.ctx.resume();
      }
    }
  });
}

async function enableKeepAwake() {
  KeepAwakeManager.enabled = true;
  const btn = document.getElementById("btn-keep-awake");

  if (Howler.ctx && Howler.ctx.state === "suspended") {
    await Howler.ctx.resume();
  }

  await requestScreenWakeLock();
  startSilentBackgroundAudio();

  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "🎃 Halloween FX Active",
      artist: "Diffuseur d'Ambiance & Randomizer",
      album: "Halloween FX"
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      stopAllSoundsImmediate();
    });
  }

  if (btn) {
    btn.classList.add("awake-active");
  }
}

async function disableKeepAwake() {
  KeepAwakeManager.enabled = false;
  const btn = document.getElementById("btn-keep-awake");

  if (KeepAwakeManager.wakeLockSentinel) {
    try {
      await KeepAwakeManager.wakeLockSentinel.release();
    } catch (e) {}
    KeepAwakeManager.wakeLockSentinel = null;
  }

  if (KeepAwakeManager.silentAudioEl) {
    KeepAwakeManager.silentAudioEl.pause();
    KeepAwakeManager.silentAudioEl = null;
  }

  if (KeepAwakeManager.webAudioOsc) {
    try {
      KeepAwakeManager.webAudioOsc.stop();
      KeepAwakeManager.webAudioOsc.disconnect();
    } catch (e) {}
    KeepAwakeManager.webAudioOsc = null;
  }

  if (btn) {
    btn.classList.remove("awake-active");
  }
}

async function requestScreenWakeLock() {
  if ("wakeLock" in navigator) {
    try {
      KeepAwakeManager.wakeLockSentinel = await navigator.wakeLock.request("screen");
    } catch (err) {}
  }
}

function startSilentBackgroundAudio() {
  if (!KeepAwakeManager.silentAudioEl) {
    const wavUrl = createSilentWavDataUri();
    const audio = new Audio(wavUrl);
    audio.loop = true;
    audio.volume = 0.01;
    audio.setAttribute("playsinline", "true");
    audio.play().catch(() => {});
    KeepAwakeManager.silentAudioEl = audio;
  }

  if (Howler.ctx && !KeepAwakeManager.webAudioOsc) {
    try {
      const ctx = Howler.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 30;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      KeepAwakeManager.webAudioOsc = osc;
    } catch (e) {}
  }
}

function createSilentWavDataUri() {
  const sampleRate = 8000;
  const numSamples = sampleRate;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, i % 2 === 0 ? 1 : -1, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}
