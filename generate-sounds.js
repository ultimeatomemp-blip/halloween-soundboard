/**
 * ============================================================================
 * SCRIPT DE SCAN AUTOMATIQUE DU DOSSIER "sounds/" -> "sounds.json" & "sounds-data.js"
 * Usage : node generate-sounds.js
 * ============================================================================
 */
const fs = require("fs");
const path = require("path");

const SOUNDS_DIR = path.join(__dirname, "sounds");
const OUTPUT_JSON = path.join(__dirname, "sounds.json");
const OUTPUT_JS = path.join(__dirname, "sounds-data.js");

const CATEGORY_MAP = {
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

// Tables de référence MPEG pour calculer la durée exacte des MP3 (CBR et VBR Xing/Info)
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0], // MPEG 1 Layer 3
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]      // MPEG 2 / 2.5 Layer 3
};
const SAMPLERATES = {
  3: [44100, 48000, 32000, 0], // MPEG 1
  2: [22050, 24000, 16000, 0], // MPEG 2
  0: [11025, 12000, 8000, 0]   // MPEG 2.5
};

/**
 * Calcule la durée exacte d'un fichier MP3 en parcourant ses frames audio
 */
function getMp3DurationSeconds(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    let offset = 0;

    // Ignorer le tag ID3v2 en début de fichier s'il est présent
    if (buf.length >= 10 && buf.toString("ascii", 0, 3) === "ID3") {
      const size =
        ((buf[6] & 0x7f) << 21) |
        ((buf[7] & 0x7f) << 14) |
        ((buf[8] & 0x7f) << 7) |
        (buf[9] & 0x7f);
      offset = 10 + size;
    }

    let totalDuration = 0;
    let framesFound = 0;

    while (offset < buf.length - 4) {
      // Recherche du Frame Sync (11 bits à 1 : 0xFF et top 3 bits >= 0xE0)
      if (buf[offset] === 0xff && (buf[offset + 1] & 0xe0) === 0xe0) {
        const b1 = buf[offset + 1];
        const b2 = buf[offset + 2];

        const versionBits = (b1 >> 3) & 0x03; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
        const layerBits = (b1 >> 1) & 0x03;   // 1 = Layer III
        const bitrateIdx = (b2 >> 4) & 0x0f;
        const sampleIdx = (b2 >> 2) & 0x03;
        const padding = (b2 >> 1) & 0x01;

        if (versionBits !== 1 && layerBits === 1 && bitrateIdx > 0 && bitrateIdx < 15 && sampleIdx < 3) {
          const isMpeg1 = versionBits === 3;
          const bitrate = BITRATES[isMpeg1 ? 1 : 2][bitrateIdx] * 1000;
          const sampleRate = SAMPLERATES[versionBits][sampleIdx];

          if (bitrate > 0 && sampleRate > 0) {
            const samplesPerFrame = isMpeg1 ? 1152 : 576;
            const frameSize = Math.floor((samplesPerFrame / 8 * bitrate) / sampleRate) + padding;

            if (frameSize > 4) {
              totalDuration += samplesPerFrame / sampleRate;
              framesFound++;
              offset += frameSize;
              continue;
            }
          }
        }
      }
      offset++;
    }

    if (framesFound > 0 && totalDuration > 0.05) {
      return Math.round(totalDuration * 10) / 10;
    }
  } catch (e) {
    // Fallback estimation
  }
  return null;
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return "--:--";
  if (sec < 10) {
    return `${sec.toFixed(1)}s`;
  }
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function slugify(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectSoundType(prefix, cleanName) {
  const lowerName = cleanName.toLowerCase();
  if (lowerName.includes("en boucle") || lowerName.includes("loop")) return "loop";
  if (prefix === "AMB") return "loop";
  if (prefix === "MUS") {
    return lowerName.startsWith("accord ") ? "oneshot" : "loop";
  }
  if (
    lowerName.includes("effets d'halloween avec tonnerre") ||
    lowerName.includes("orage violent") ||
    lowerName.includes("chant fantomatique") ||
    lowerName.includes("fête des zombies")
  ) {
    return "loop";
  }
  return "oneshot";
}

function scanSoundsDirectory() {
  if (!fs.existsSync(SOUNDS_DIR)) {
    console.error(`Le dossier ${SOUNDS_DIR} n'existe pas.`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(SOUNDS_DIR)
    .filter((f) => /\.(mp3|wav|ogg|m4a)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, "fr"));

  const soundsList = [];
  const usedIds = new Set();

  files.forEach((filename) => {
    const fullPath = path.join(SOUNDS_DIR, filename);
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext).trim();

    const match = baseName.match(/^\[([A-Z]+)\]\s*(.+)$/i);
    let prefix = "AUT";
    let cleanName = baseName;

    if (match) {
      prefix = match[1].toUpperCase();
      cleanName = match[2].trim();
    }

    const category = CATEGORY_MAP[prefix] || "Autres";
    const type = detectSoundType(prefix, cleanName);
    const durationSec = getMp3DurationSeconds(fullPath);

    let id = slugify(`${prefix}_${cleanName}`);
    let counter = 2;
    while (usedIds.has(id)) {
      id = `${slugify(`${prefix}_${cleanName}`)}_${counter}`;
      counter++;
    }
    usedIds.add(id);

    soundsList.push({
      id: id,
      name: cleanName,
      code: prefix,
      file: `sounds/${filename}`,
      category: category,
      type: type,
      duration: durationSec,
      durationFormatted: formatDuration(durationSec)
    });
  });

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(soundsList, null, 2), "utf8");
  fs.writeFileSync(
    OUTPUT_JS,
    `// Auto-généré par generate-sounds.js (permet d'ouvrir index.html en double-clic local file://)\nwindow.SOUNDS_DATA = ${JSON.stringify(soundsList, null, 2)};\n`,
    "utf8"
  );
  console.log(`✅ ${soundsList.length} fichiers audio scannés (avec durées exactes) dans sounds.json et sounds-data.js !`);
}

scanSoundsDirectory();
