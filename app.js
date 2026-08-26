const state = {
  playlist: [],
  vaultTracks: [],
  activeSource: "queue",
  currentIndex: 0,
  isPlaying: false,
  isShuffle: false,
  isLooping: false,
  moodMode: "late-night",
  search: "",
  vaultSearch: "",
  vaultSort: "custom",
};

const refs = {
  body: document.body,
  audio: document.getElementById("audioPlayer"),
  playlist: document.getElementById("playlist"),
  playButton: document.getElementById("playButton"),
  featuredPlayButton: document.getElementById("featuredPlayButton"),
  prevButton: document.getElementById("prevButton"),
  featuredPrevButton: document.getElementById("featuredPrevButton"),
  nextButton: document.getElementById("nextButton"),
  featuredNextButton: document.getElementById("featuredNextButton"),
  featuredLoopButton: document.getElementById("featuredLoopButton"),
  featuredShuffleButton: document.getElementById("featuredShuffleButton"),
  clearQueueButton: document.getElementById("clearQueueButton"),
  skipBackButton: document.getElementById("skipBackButton"),
  skipForwardButton: document.getElementById("skipForwardButton"),
  progressBar: document.getElementById("progressBar"),
  volumeBar: document.getElementById("volumeBar"),
  featuredVolumeBar: document.getElementById("featuredVolumeBar"),
  featuredVolumeValue: document.getElementById("featuredVolumeValue"),
  speedControls: document.getElementById("speedControls"),
  speedValue: document.getElementById("speedValue"),
  spectrumShell: document.getElementById("spectrumShell"),
  spectrumCanvas: document.getElementById("spectrumCanvas"),
  moodButtons: document.querySelectorAll(".mood-pill"),
  currentTime: document.getElementById("currentTime"),
  duration: document.getElementById("duration"),
  trackTitle: document.getElementById("trackTitle"),
  quoteDisplay: document.getElementById("quoteDisplay"),
  trackMeta: document.getElementById("trackMeta"),
  dockTitle: document.getElementById("dockTitle"),
  dockArtist: document.getElementById("dockArtist"),
  trackCount: document.getElementById("trackCount"),
  playlistDuration: document.getElementById("playlistDuration"),
  audioUploadVault: document.getElementById("audioUploadVault"),
  audioUploadQueue: document.getElementById("audioUploadQueue"),
  searchInput: document.getElementById("searchInput"),
  libraryUploadPanel: document.getElementById("libraryUploadPanel"),
  queuePanel: document.getElementById("queuePanel"),
  vaultPanel: document.getElementById("vaultPanel"),
  playbackSourceBadge: document.getElementById("playbackSourceBadge"),
  sourceToggleBtn: document.getElementById("sourceToggleBtn"),
  dockSourceBadge: document.getElementById("dockSourceBadge"),
  vaultCountBadge: document.getElementById("vaultCountBadge"),
  vaultSearchInput: document.getElementById("vaultSearchInput"),
  vaultSortContainer: document.getElementById("vaultSortContainer"),
  vaultSortToggleBtn: document.getElementById("vaultSortToggleBtn"),
  vaultSortCurrentLabel: document.getElementById("vaultSortCurrentLabel"),
  vaultSortMenu: document.getElementById("vaultSortMenu"),
  playAllVaultBtn: document.getElementById("playAllVaultBtn"),
  vaultTrackList: document.getElementById("vaultTrackList"),
};

state.playbackRate = 1;
const rotatingThemes = ["late-night", "velvet-soul", "glass-house", "skyline-ride"];

const musicQuotes = [
  "“Let the music speak.”",
  "“Lost in the rhythm.”",
  "“Music heals the soul.”",
  "“Sound is pure emotion.”",
  "“Melody of the heart.”",
  "“Live through the beat.”",
  "“Breathe the harmony.”",
  "“Music is pure magic.”",
  "“In love with the sound.”",
  "“Feel the living sound.”",
  "“Where sound meets soul.”",
  "“Infinite audio vibes.”"
];

let currentQuoteIndex = 0;

function rotateMusicQuote() {
  if (!refs.quoteDisplay) return;

  refs.quoteDisplay.classList.add("fading");
  setTimeout(() => {
    currentQuoteIndex = (currentQuoteIndex + 1) % musicQuotes.length;
    refs.quoteDisplay.textContent = musicQuotes[currentQuoteIndex];
    refs.quoteDisplay.classList.remove("fading");
  }, 520);
}
const autoThemeDelayMs = 5000;
let autoThemeTimer = null;
let themeTransitionTimer = null;
const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
let audioContext = null;
let mediaSourceNode = null;
let analyserNode = null;
let spectrumContext = null;
let spectrumData = null;
let spectrumFrame = null;
let spectrumReady = false;

function normalizeDigits(value) {
  return value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function getVisibleTracks() {
  const query = state.search.trim().toLowerCase();
  if (!query) {
    return state.playlist.map((track, index) => ({ track, index }));
  }

  return state.playlist
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => {
      return [track.title, track.artist, track.album]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
}

function calculatePlaylistDuration() {
  const knownSeconds = state.playlist.reduce((sum, track) => sum + (track.duration || 0), 0);
  return formatTime(knownSeconds);
}

function normalizeCommandText(value) {
  return normalizeDigits(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyAlias(command, aliases) {
  return aliases.some((alias) => command.includes(alias));
}

function matchesAliasGroups(command, groups) {
  return groups.every((group) => includesAnyAlias(command, group));
}

function resizeSpectrumCanvas() {
  if (!refs.spectrumCanvas || !spectrumContext) {
    return;
  }

  const rect = refs.spectrumCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * pixelRatio));
  const height = Math.max(1, Math.floor(rect.height * pixelRatio));

  if (refs.spectrumCanvas.width !== width || refs.spectrumCanvas.height !== height) {
    refs.spectrumCanvas.width = width;
    refs.spectrumCanvas.height = height;
  }
}

function setSpectrumPointer(clientX, clientY) {
  if (!refs.spectrumShell) {
    return;
  }

  const rect = refs.spectrumShell.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  refs.spectrumShell.style.setProperty("--mx", `${Math.max(0, Math.min(100, x))}%`);
  refs.spectrumShell.style.setProperty("--my", `${Math.max(0, Math.min(100, y))}%`);
}

function drawSpectrumIdle() {
  if (!refs.spectrumCanvas || !spectrumContext) {
    return;
  }

  resizeSpectrumCanvas();
  const width = refs.spectrumCanvas.width;
  const height = refs.spectrumCanvas.height;
  spectrumContext.clearRect(0, 0, width, height);

  const centerY = height - height * 0.2;
  const innerPadding = width * 0.06;
  const barCount = 44;
  const gap = width * 0.008;
  const availableWidth = width - innerPadding * 2;
  const barWidth = Math.max(2, (availableWidth - gap * (barCount - 1)) / barCount);
  const time = performance.now() * 0.0018;
  const computedStyle = getComputedStyle(refs.body);
  const gold = computedStyle.getPropertyValue("--gold").trim() || "#e0b774";

  const idleGradient = spectrumContext.createLinearGradient(0, 0, width, 0);
  idleGradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  idleGradient.addColorStop(0.25, "rgba(255, 110, 180, 0.16)");
  idleGradient.addColorStop(0.55, gold);
  idleGradient.addColorStop(0.82, "rgba(95, 205, 255, 0.16)");
  idleGradient.addColorStop(1, "rgba(255, 255, 255, 0.08)");

  spectrumContext.fillStyle = "rgba(255, 255, 255, 0.02)";
  spectrumContext.fillRect(0, 0, width, height);

  for (let index = 0; index < barCount; index += 1) {
    const distanceFromCenter = Math.abs(index - (barCount - 1) / 2) / ((barCount - 1) / 2);
    const wave = Math.sin(time * 1.2 + index * 0.35) * 0.5 + 0.5;
    const falloff = 1 - distanceFromCenter * 0.65;
    const amplitude = height * (0.045 + wave * 0.065 * falloff);
    const x = innerPadding + index * (barWidth + gap);
    const y = centerY - amplitude;
    const radius = Math.min(barWidth, 9);

    spectrumContext.globalAlpha = 0.58;
    spectrumContext.fillStyle = idleGradient;
    spectrumContext.beginPath();
    spectrumContext.roundRect(x, y, barWidth, amplitude, radius);
    spectrumContext.fill();
  }

  spectrumContext.globalAlpha = 0.28;
  spectrumContext.strokeStyle = idleGradient;
  spectrumContext.lineWidth = Math.max(1.4, width * 0.0024);
  spectrumContext.beginPath();
  for (let step = 0; step <= 72; step += 1) {
    const progress = step / 72;
    const x = innerPadding + progress * (width - innerPadding * 2);
    const waveY =
      centerY -
      height * 0.08 -
      Math.sin(time * 1.5 + progress * Math.PI * 4) * height * 0.012 -
      Math.cos(time * 1.1 + progress * Math.PI * 2.4) * height * 0.01;

    if (step === 0) {
      spectrumContext.moveTo(x, waveY);
    } else {
      spectrumContext.lineTo(x, waveY);
    }
  }
  spectrumContext.stroke();

  spectrumContext.globalAlpha = 1;
  spectrumContext.strokeStyle = "rgba(255, 255, 255, 0.08)";
  spectrumContext.lineWidth = Math.max(1, width * 0.002);
  spectrumContext.beginPath();
  spectrumContext.moveTo(innerPadding, centerY);
  spectrumContext.lineTo(width - innerPadding, centerY);
  spectrumContext.stroke();
}

function isSpectrumCompatibleUrl(url) {
  if (!url) {
    return false;
  }

  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return true;
  }

  try {
    const resolved = new URL(url, window.location.href);
    return resolved.origin === window.location.origin;
  } catch (error) {
    return false;
  }
}

function drawSpectrum() {
  if (!spectrumReady || !analyserNode || !spectrumData || !spectrumContext || !refs.spectrumCanvas) {
    drawSpectrumIdle();
    return;
  }

  resizeSpectrumCanvas();
  analyserNode.getByteFrequencyData(spectrumData);

  const width = refs.spectrumCanvas.width;
  const height = refs.spectrumCanvas.height;
  const barCount = 56;
  const centerY = height - height * 0.2;
  const baseLineHeight = height * 0.05;
  const innerPadding = width * 0.06;
  const availableWidth = width - innerPadding * 2;
  const gap = width * 0.006;
  const barWidth = Math.max(2, (availableWidth - gap * (barCount - 1)) / barCount);
  const computedStyle = getComputedStyle(refs.body);
  const gold = computedStyle.getPropertyValue("--gold").trim() || "#e0b774";
  const goldSoft = computedStyle.getPropertyValue("--gold-soft").trim() || "#c79a58";

  spectrumContext.clearRect(0, 0, width, height);

  const glowGradient = spectrumContext.createLinearGradient(0, 0, width, 0);
  glowGradient.addColorStop(0, "rgba(255, 95, 170, 0.24)");
  glowGradient.addColorStop(0.35, gold);
  glowGradient.addColorStop(0.7, "rgba(95, 205, 255, 0.26)");
  glowGradient.addColorStop(1, goldSoft);

  spectrumContext.fillStyle = "rgba(255, 255, 255, 0.02)";
  spectrumContext.fillRect(0, 0, width, height);

  for (let index = 0; index < barCount; index += 1) {
    const sampleIndex = Math.min(spectrumData.length - 1, Math.floor((index / barCount) * spectrumData.length * 0.82));
    const value = spectrumData[sampleIndex] / 255;
    const shapedValue = Math.pow(value, 1.35);
    const amplitude = Math.max(baseLineHeight, shapedValue * height * 0.72);
    const x = innerPadding + index * (barWidth + gap);
    const y = centerY - amplitude;
    const radius = Math.min(barWidth, 10);

    spectrumContext.fillStyle = glowGradient;
    spectrumContext.globalAlpha = 0.94;
    spectrumContext.beginPath();
    spectrumContext.roundRect(x, y, barWidth, amplitude, radius);
    spectrumContext.fill();

    spectrumContext.globalAlpha = 0.42;
    spectrumContext.fillStyle = "rgba(255, 255, 255, 0.85)";
    spectrumContext.fillRect(x, y, barWidth, Math.max(1, height * 0.012));
  }

  spectrumContext.globalAlpha = 1;
  spectrumContext.strokeStyle = "rgba(255, 255, 255, 0.08)";
  spectrumContext.lineWidth = Math.max(1, width * 0.002);
  spectrumContext.beginPath();
  spectrumContext.moveTo(innerPadding, centerY);
  spectrumContext.lineTo(width - innerPadding, centerY);
  spectrumContext.stroke();
}

function runSpectrumLoop() {
  if (spectrumFrame) {
    cancelAnimationFrame(spectrumFrame);
  }

  const animate = () => {
    drawSpectrum();
    spectrumFrame = window.requestAnimationFrame(animate);
  };

  animate();
}

async function initializeSpectrumAnalyzer() {
  if (spectrumReady || !AudioContextConstructor || !refs.spectrumCanvas) {
    return spectrumReady;
  }

  try {
    audioContext = audioContext || new AudioContextConstructor();
    spectrumContext = spectrumContext || refs.spectrumCanvas.getContext("2d");

    if (!mediaSourceNode) {
      mediaSourceNode = audioContext.createMediaElementSource(refs.audio);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.82;
      mediaSourceNode.connect(analyserNode);
      analyserNode.connect(audioContext.destination);
      spectrumData = new Uint8Array(analyserNode.frequencyBinCount);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    spectrumReady = true;
    drawSpectrumIdle();
    runSpectrumLoop();
    return true;
  } catch (error) {
    spectrumReady = false;
    drawSpectrumIdle();
    return false;
  }
}

function getActiveTrackList() {
  return state.activeSource === "vault" ? state.vaultTracks : state.playlist;
}

function getCurrentTrack() {
  const list = getActiveTrackList();
  return list[state.currentIndex] || null;
}

function activateSpectrumAnalyzer() {
  const current = getCurrentTrack();
  if (!current || !isSpectrumCompatibleUrl(current.url)) {
    drawSpectrumIdle();
    return;
  }

  initializeSpectrumAnalyzer().catch(() => false);
}

function primeTrackDuration(track) {
  if (!track || track.duration) {
    return;
  }

  const probe = new Audio();
  probe.preload = "metadata";
  probe.src = track.url;

  probe.addEventListener("loadedmetadata", () => {
    track.duration = probe.duration;
    updateLibraryStats();
    renderPlaylist();
  });
}

function updateLibraryStats() {
  refs.trackCount.textContent = String(state.playlist.length);
  refs.playlistDuration.textContent = calculatePlaylistDuration();
}

function alertNoTracks() {
  window.alert("Please add audio tracks first.");
}

function updateSourceIndicators() {
  const isVault = state.activeSource === "vault";
  const sourceName = isVault ? "Uploads Vault" : "Your Queue";

  if (refs.playbackSourceBadge) {
    refs.playbackSourceBadge.textContent = `Playing from: ${sourceName}`;
  }

  if (refs.sourceToggleBtn) {
    refs.sourceToggleBtn.className = `source-toggle-btn ${isVault ? "source-vault" : "source-queue"}`;
    refs.sourceToggleBtn.removeAttribute("title");
  }

  if (refs.dockSourceBadge) {
    refs.dockSourceBadge.textContent = isVault ? "Vault" : "Queue";
    refs.dockSourceBadge.className = `dock-source-badge ${isVault ? "source-vault" : "source-queue"}`;
  }

  if (refs.queuePanel) {
    refs.queuePanel.classList.toggle("active-source-panel", !isVault);
  }
  if (refs.vaultPanel) {
    refs.vaultPanel.classList.toggle("active-source-panel", isVault);
  }
}

function togglePlaybackSource() {
  if (state.activeSource === "queue") {
    // Switch to Vault
    if (!state.vaultTracks.length) {
      window.alert("Your Uploads Vault is empty. Please upload some tracks to the Vault first.");
      return;
    }
    setTrack(0, state.isPlaying, "vault");
  } else {
    // Switch to Queue
    if (!state.playlist.length) {
      window.alert("Your Queue is empty. Please add tracks from your Vault or local files first.");
      return;
    }
    setTrack(0, state.isPlaying, "queue");
  }
}

function updateTrackDetails() {
  const current = getCurrentTrack();
  updateSourceIndicators();

  if (!current) {
    refs.trackTitle.textContent = "No tracks loaded";
    refs.dockTitle.textContent = "No tracks loaded";
    refs.dockArtist.textContent = "Waiting for music";
    refs.duration.textContent = "0:00";
    return;
  }

  refs.trackTitle.textContent = current.title;
  refs.dockTitle.textContent = current.title;
  refs.dockArtist.textContent = current.artist;
}

function updatePlaylistPlaybackState() {
  refs.playlist.querySelectorAll(".playlist-card").forEach((card) => {
    const index = Number(card.dataset.index);
    const isActive = state.activeSource === "queue" && index === state.currentIndex;
    const playButton = card.querySelector(".playlist-play");
    const trackIndexBtn = card.querySelector(".track-index");

    card.classList.toggle("active", isActive);

    if (trackIndexBtn) {
      trackIndexBtn.classList.toggle("playing", isActive && state.isPlaying);
      if (isActive && state.isPlaying) {
        trackIndexBtn.innerHTML = `
          <div class="mini-eq-bars" aria-hidden="true"><span></span><span></span><span></span></div>
          <span class="track-remove-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </span>
        `;
      } else {
        trackIndexBtn.innerHTML = `
          <span class="track-num">${String(index + 1).padStart(2, "0")}</span>
          <span class="track-remove-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </span>
        `;
      }
    }

    if (playButton) {
      playButton.textContent = isActive && state.isPlaying ? "Pause" : "Play";
    }
  });
}

function updatePlaybackState() {
  const playbackLabel = state.isPlaying ? "Pause" : "Play";
  refs.playButton.textContent = playbackLabel;
  refs.featuredPlayButton.textContent = playbackLabel;
  refs.body.classList.toggle("is-playing", state.isPlaying);
  updatePlaylistPlaybackState();
  renderVault();
}

function updateLoopState() {
  refs.audio.loop = state.isLooping;
  refs.featuredLoopButton.classList.toggle("active", state.isLooping);
  refs.featuredLoopButton.title = state.isLooping ? "Loop is on." : "Loop the current track.";
  refs.featuredLoopButton.setAttribute(
    "aria-label",
    state.isLooping ? "Loop current track is on" : "Loop current track"
  );
}

function setLoop(enabled) {
  state.isLooping = Boolean(enabled);
  updateLoopState();
}

function triggerThemeTransition() {
  refs.body.classList.remove("theme-transition");
  void refs.body.offsetWidth;
  refs.body.classList.add("theme-transition");

  if (themeTransitionTimer) {
    clearTimeout(themeTransitionTimer);
  }

  themeTransitionTimer = setTimeout(() => {
    refs.body.classList.remove("theme-transition");
    themeTransitionTimer = null;
  }, 1200);
}

function applyTheme(theme) {
  state.theme = theme;
  triggerThemeTransition();
  refs.body.dataset.theme = theme;
  if (state.isPlaying) {
    drawSpectrum();
  } else {
    drawSpectrumIdle();
  }
}

function updateMoodButtons(mode) {
  refs.moodButtons.forEach((button) => {
    const isActive = button.dataset.theme === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function stopAutoTheme() {
  if (!autoThemeTimer) {
    return;
  }

  clearInterval(autoThemeTimer);
  autoThemeTimer = null;
}

function startAutoTheme() {
  stopAutoTheme();
  autoThemeTimer = setInterval(() => {
    const currentIndex = rotatingThemes.indexOf(state.theme);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % rotatingThemes.length : 0;
    applyTheme(rotatingThemes[nextIndex]);
  }, autoThemeDelayMs);
}

function updateTheme(theme) {
  if (theme === "auto") {
    state.moodMode = "auto";
    updateMoodButtons("auto");
    startAutoTheme();
    const nextIndex = rotatingThemes.indexOf(state.theme);
    const firstTheme = nextIndex >= 0 ? rotatingThemes[(nextIndex + 1) % rotatingThemes.length] : rotatingThemes[0];
    applyTheme(firstTheme);
    return;
  }

  stopAutoTheme();
  state.moodMode = theme;
  applyTheme(theme);
  updateMoodButtons(theme);
}

function updateShuffleState() {
  if (refs.featuredShuffleButton) {
    refs.featuredShuffleButton.classList.toggle("active", state.isShuffle);
  }
}

function setShuffle(enabled) {
  state.isShuffle = Boolean(enabled);
  updateShuffleState();
}

function syncVolumeControls(value) {
  const volume = Math.max(0, Math.min(100, Number(value) || 0));
  refs.audio.volume = volume / 100;
  refs.volumeBar.value = String(volume);
  refs.featuredVolumeBar.value = String(volume);
  refs.featuredVolumeValue.textContent = `${volume}%`;
}

function syncSpeedControls(value) {
  const playbackRate = Number(value) || 1;
  state.playbackRate = playbackRate;
  refs.audio.playbackRate = playbackRate;
  refs.speedValue.textContent = `${playbackRate.toFixed(2).replace(/\.00$/, ".0").replace(/(\.\d)0$/, "$1")}x`;

  refs.speedControls.querySelectorAll(".speed-pill").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.speed) === playbackRate);
  });
}

function playCurrentTrack() {
  let list = getActiveTrackList();
  if (!list.length) {
    if (state.activeSource === "queue" && state.vaultTracks.length > 0) {
      setTrack(0, true, "vault");
      return Promise.resolve(true);
    } else if (state.activeSource === "vault" && state.playlist.length > 0) {
      setTrack(0, true, "queue");
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  const track = list[state.currentIndex];
  if (track && track.blob && (!track.url || refs.audio.src === "")) {
    track.url = URL.createObjectURL(track.blob);
    refs.audio.src = track.url;
  }

  if (!refs.audio.src || refs.audio.src === window.location.href) {
    setTrack(state.currentIndex, true, state.activeSource);
    return Promise.resolve(true);
  }

  return refs.audio.play().then(() => {
    state.isPlaying = true;
    updatePlaybackState();
    activateSpectrumAnalyzer();
    return true;
  }).catch((err) => {
    console.warn("Audio play failed, refreshing ObjectURL:", err);
    if (track && track.blob) {
      track.url = URL.createObjectURL(track.blob);
      refs.audio.src = track.url;
      return refs.audio.play().then(() => {
        state.isPlaying = true;
        updatePlaybackState();
        activateSpectrumAnalyzer();
        return true;
      }).catch((e2) => {
        console.error("Retry failed:", e2);
        state.isPlaying = false;
        updatePlaybackState();
        return false;
      });
    }
    state.isPlaying = false;
    updatePlaybackState();
    return false;
  });
}

function pauseCurrentTrack() {
  if (refs.audio.paused) {
    return;
  }

  refs.audio.pause();
  state.isPlaying = false;
  updatePlaybackState();
}

function skipBy(seconds) {
  if (!Number.isFinite(refs.audio.duration)) {
    return;
  }

  const nextTime = refs.audio.currentTime + seconds;
  refs.audio.currentTime = Math.max(0, Math.min(nextTime, refs.audio.duration));
}

function parseVolumeCommand(command) {
  const explicitMatch = command.match(/(?:volume|sound|ভলিউম|আওয়াজ|আওয়াজ)\s*(?:to|set|at)?\s*(\d{1,3})/u);
  if (!explicitMatch) {
    return null;
  }

  return Math.max(0, Math.min(100, Number(explicitMatch[1])));
}

function findTrackIndexFromCommand(command) {
  const trackNumberMatch = command.match(/(?:track|song|music|গান|ট্র্যাক)\s*(\d{1,3})/u);
  if (trackNumberMatch) {
    const targetIndex = Number(trackNumberMatch[1]) - 1;
    return targetIndex >= 0 && targetIndex < state.playlist.length ? targetIndex : -1;
  }

  let query = command;
  query = query.replace(/^(play|listen to|song|music|গান|ট্র্যাক)\s+/u, "");
  query = query.replace(/\s+(play|please|চালাও|চালু করো|শুনতে চাই)$/u, "");
  query = query.trim();

  if (!query || ["play", "song", "music", "গান", "ট্র্যাক"].includes(query)) {
    return null;
  }

  return state.playlist.findIndex((track) => {
    const haystack = `${track.title} ${track.artist} ${track.album || ""}`.toLowerCase();
    return haystack.includes(query);
  });
}


function setTrack(index, shouldAutoplay = state.isPlaying, source = state.activeSource) {
  state.activeSource = source;
  const list = getActiveTrackList();
  const nextTrack = list[index];
  if (!nextTrack) {
    return;
  }

  if (nextTrack.blob) {
    if (!nextTrack.url) {
      nextTrack.url = URL.createObjectURL(nextTrack.blob);
    }
  }

  state.currentIndex = index;
  refs.audio.src = nextTrack.url;
  refs.audio.load();
  refs.audio.playbackRate = state.playbackRate;
  refs.currentTime.textContent = "0:00";
  refs.progressBar.value = "0";

  updateTrackDetails();
  renderPlaylist();
  renderVault();

  if (shouldAutoplay) {
    state.isPlaying = true;
    updatePlaybackState();
    refs.audio
      .play()
      .then(() => {
        state.isPlaying = true;
        updatePlaybackState();
        activateSpectrumAnalyzer();
      })
      .catch((err) => {
        console.warn("Autoplay failed, regenerating Blob URL:", err);
        if (nextTrack.blob) {
          nextTrack.url = URL.createObjectURL(nextTrack.blob);
          refs.audio.src = nextTrack.url;
          refs.audio
            .play()
            .then(() => {
              state.isPlaying = true;
              updatePlaybackState();
              activateSpectrumAnalyzer();
            })
            .catch(() => {
              state.isPlaying = false;
              updatePlaybackState();
            });
        } else {
          state.isPlaying = false;
          updatePlaybackState();
        }
      });
  } else {
    updatePlaybackState();
  }
}

function togglePlay() {
  let list = getActiveTrackList();
  if (!list.length) {
    if (state.activeSource === "queue" && state.vaultTracks.length > 0) {
      setTrack(0, true, "vault");
      return;
    } else if (state.activeSource === "vault" && state.playlist.length > 0) {
      setTrack(0, true, "queue");
      return;
    }
    alertNoTracks();
    return;
  }

  if (!refs.audio.src || refs.audio.src === window.location.href) {
    setTrack(state.currentIndex, true, state.activeSource);
    return;
  }

  if (refs.audio.paused) {
    playCurrentTrack();
  } else {
    pauseCurrentTrack();
  }
}

function getNextIndex() {
  const list = getActiveTrackList();
  if (!list.length) {
    return 0;
  }

  if (state.isShuffle && list.length > 1) {
    let candidate = state.currentIndex;
    while (candidate === state.currentIndex) {
      candidate = Math.floor(Math.random() * list.length);
    }
    return candidate;
  }

  return (state.currentIndex + 1) % list.length;
}

function getPreviousIndex() {
  const list = getActiveTrackList();
  if (!list.length) {
    return 0;
  }

  return (state.currentIndex - 1 + list.length) % list.length;
}

function removeTrack(index) {
  if (index < 0 || index >= state.playlist.length) {
    return;
  }

  const trackToRemove = state.playlist[index];
  if (trackToRemove && trackToRemove.url && trackToRemove.url.startsWith("blob:")) {
    URL.revokeObjectURL(trackToRemove.url);
  }

  const wasPlaying = state.isPlaying && state.activeSource === "queue";
  const isCurrentTrack = state.activeSource === "queue" && index === state.currentIndex;

  state.playlist.splice(index, 1);

  if (state.activeSource === "queue") {
    if (!state.playlist.length) {
      state.currentIndex = 0;
      state.isPlaying = false;
      refs.audio.pause();
      refs.audio.removeAttribute("src");
      refs.audio.load();
      refs.currentTime.textContent = "0:00";
      refs.duration.textContent = "0:00";
      refs.progressBar.value = "0";
      drawSpectrumIdle();
      updateTrackDetails();
      updatePlaybackState();
      updateLibraryStats();
      renderPlaylist();
      return;
    }

    if (isCurrentTrack) {
      if (state.currentIndex >= state.playlist.length) {
        state.currentIndex = 0;
      }
      setTrack(state.currentIndex, wasPlaying, "queue");
    } else {
      if (index < state.currentIndex) {
        state.currentIndex -= 1;
      }
      updateLibraryStats();
      renderPlaylist();
      updatePlaybackState();
    }
  } else {
    updateLibraryStats();
    renderPlaylist();
  }
}

function renderPlaylist() {
  const visibleTracks = getVisibleTracks();

  if (refs.libraryUploadPanel) {
    refs.libraryUploadPanel.style.display = state.playlist.length > 0 ? "flex" : "none";
  }

  updateBadges();

  if (!visibleTracks.length) {
    refs.playlist.innerHTML = state.playlist.length
      ? '<div class="playlist-empty">No matching tracks yet. Try another search.</div>'
      : `
        <div class="playlist-empty playlist-empty-rich">
          <strong>No audio tracks in queue.</strong>
          <span>Add songs from your Vault or add new local ones.</span>
          <label class="playlist-empty-action" for="audioUploadQueue">Add Audio Tracks</label>
        </div>
      `;
    return;
  }

  refs.playlist.innerHTML = visibleTracks
    .map(({ track, index }, visibleIndex) => {
      const isActive = state.activeSource === "queue" && index === state.currentIndex;
      return `
        <article class="playlist-card ${isActive ? "active" : ""}" data-index="${index}" draggable="true" title="Drag to reorder">
          <div class="drag-handle" title="Drag to change order" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8" cy="6" r="2"></circle>
              <circle cx="16" cy="6" r="2"></circle>
              <circle cx="8" cy="12" r="2"></circle>
              <circle cx="16" cy="12" r="2"></circle>
              <circle cx="8" cy="18" r="2"></circle>
              <circle cx="16" cy="18" r="2"></circle>
            </svg>
          </div>
          <button class="track-index ${isActive && state.isPlaying ? "playing" : ""}" type="button" data-action="remove" draggable="false" title="Remove track from queue" aria-label="Remove track ${visibleIndex + 1}">
            ${isActive && state.isPlaying
              ? `<div class="mini-eq-bars" aria-hidden="true"><span></span><span></span><span></span></div>`
              : `<span class="track-num">${String(visibleIndex + 1).padStart(2, "0")}</span>`
            }
            <span class="track-remove-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </span>
          </button>
          <div class="playlist-copy">
            <strong>${track.title}</strong>
            <span class="track-duration-sub">${formatTime(track.duration)}</span>
          </div>
          <span class="track-duration">${formatTime(track.duration)}</span>
          <button class="playlist-play" type="button" data-action="play" draggable="false">
            ${isActive && state.isPlaying ? "Pause" : "Play"}
          </button>
        </article>
      `;
    })
    .join("");
}

// --- INDEXED DB VAULT STORAGE ---
const DB_NAME = "VelouraVaultDB";
const DB_VERSION = 1;
const STORE_NAME = "vault_tracks";

function openVaultDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredVaultTracks() {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to fetch vault tracks:", err);
    return [];
  }
}

async function saveVaultTrackToDB(trackData) {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(trackData);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to save vault track:", err);
  }
}

async function deleteVaultTrackFromDB(id) {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to delete vault track:", err);
  }
}

async function saveAllVaultTracksOrder(tracks) {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      tracks.forEach((track, index) => {
        track.order = index;
        store.put(track);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save vault order:", err);
  }
}

async function loadVaultFromDB() {
  const stored = await getStoredVaultTracks();
  stored.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  stored.forEach((track, index) => {
    track.order = index;
    if (track.blob) {
      track.url = URL.createObjectURL(track.blob);
    }
  });
  state.vaultTracks = stored;
  renderVault();
  updateBadges();

  // If queue has no tracks and vault has tracks, initialize the first vault track on the player!
  if (state.playlist.length === 0 && state.vaultTracks.length > 0 && !refs.audio.src) {
    setTrack(0, false, "vault");
  }
}

function updateBadges() {
  if (refs.vaultCountBadge) {
    refs.vaultCountBadge.textContent = `${state.vaultTracks.length} Track${state.vaultTracks.length === 1 ? "" : "s"}`;
  }
}

function getVisibleVaultTracks() {
  const query = state.vaultSearch.trim().toLowerCase();
  let tracks = [...state.vaultTracks];

  if (query) {
    tracks = tracks.filter((track) => {
      const title = (track.title || "").toLowerCase();
      const artist = (track.artist || "").toLowerCase();
      const album = (track.album || "").toLowerCase();
      return title.includes(query) || artist.includes(query) || album.includes(query);
    });
  }

  switch (state.vaultSort) {
    case "title-asc":
      tracks.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      break;
    case "title-desc":
      tracks.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
      break;
    case "duration-asc":
      tracks.sort((a, b) => (a.duration || 0) - (b.duration || 0));
      break;
    case "duration-desc":
      tracks.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      break;
    case "newest":
      tracks.sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
      break;
    case "custom":
    default:
      tracks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      break;
  }

  return tracks;
}

function renderVault() {
  if (!refs.vaultTrackList) return;

  const visible = getVisibleVaultTracks();
  updateBadges();

  if (!state.vaultTracks.length) {
    refs.vaultTrackList.innerHTML = `
      <div class="playlist-empty" style="grid-column: 1 / -1;">
        <strong>Your Vault is empty.</strong>
        <p style="margin: 0.35rem 0 0; font-size: 0.84rem; color: var(--muted);">Click the banner above to upload your favorite tracks and save them permanently in your browser.</p>
      </div>
    `;
    return;
  }

  if (!visible.length) {
    refs.vaultTrackList.innerHTML = `
      <div class="playlist-empty" style="grid-column: 1 / -1;">
        <strong>No matching vault tracks.</strong>
        <p style="margin: 0.35rem 0 0; font-size: 0.84rem; color: var(--muted);">Try a different search query.</p>
      </div>
    `;
    return;
  }

  const currentPlayingTrack = getCurrentTrack();

  refs.vaultTrackList.innerHTML = visible
    .map((track) => {
      const isCurrentlyActive = state.activeSource === "vault" && currentPlayingTrack && currentPlayingTrack.id === track.id;
      const actualIndex = state.vaultTracks.findIndex((t) => t.id === track.id);

      return `
        <article class="vault-card ${isCurrentlyActive ? "active" : ""}" data-vault-id="${track.id}" data-index="${actualIndex}" draggable="true" title="Drag to reorder">
          <div class="drag-handle" title="Drag to change order" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8" cy="6" r="2"></circle>
              <circle cx="16" cy="6" r="2"></circle>
              <circle cx="8" cy="12" r="2"></circle>
              <circle cx="16" cy="12" r="2"></circle>
              <circle cx="8" cy="18" r="2"></circle>
              <circle cx="16" cy="18" r="2"></circle>
            </svg>
          </div>
          <button class="vault-play-btn ${isCurrentlyActive && state.isPlaying ? "playing" : ""}" type="button" data-action="play-vault" draggable="false" title="${isCurrentlyActive && state.isPlaying ? "Pause" : "Play"}">
            ${isCurrentlyActive && state.isPlaying
              ? `<div class="mini-eq-bars" aria-hidden="true"><span></span><span></span><span></span></div>`
              : `<span class="play-icon">▶</span>`
            }
          </button>
          <div class="vault-card-info">
            <strong class="vault-track-title">${track.title}</strong>
            <span class="vault-duration">${formatTime(track.duration)}</span>
          </div>
          <div class="vault-card-actions">
            <button class="vault-queue-btn" type="button" data-action="queue-vault" draggable="false" title="Add to active queue">
              + Queue
            </button>
            <button class="vault-delete-btn" type="button" data-action="delete-vault" draggable="false" title="Delete from vault" aria-label="Delete song">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function playVaultTrackDirectly(vaultTrackId) {
  const vaultIndex = state.vaultTracks.findIndex((t) => t.id === vaultTrackId);
  if (vaultIndex === -1) return;

  const currentPlayingTrack = getCurrentTrack();
  if (state.activeSource === "vault" && currentPlayingTrack && currentPlayingTrack.id === vaultTrackId) {
    togglePlay();
    renderVault();
    return;
  }

  // Play directly from vault without altering Your Queue!
  setTrack(vaultIndex, true, "vault");
}

function playAllVaultTracks() {
  if (!state.vaultTracks.length) {
    alertNoTracks();
    return;
  }

  // Play all vault tracks directly without modifying Your Queue!
  setTrack(0, true, "vault");
}

function showToast(message, icon = "✓") {
  let container = document.querySelector(".veloura-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "veloura-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "veloura-toast";
  toast.innerHTML = `
    <span class="veloura-toast-icon">${icon}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-hiding");
    setTimeout(() => {
      toast.remove();
      if (!container.children.length) {
        container.remove();
      }
    }, 360);
  }, 2400);
}

function addVaultTrackToPlaylist(vaultTrackId, queueBtnElement) {
  const vaultTrack = state.vaultTracks.find((t) => t.id === vaultTrackId);
  if (!vaultTrack) return;

  const audioUrl = URL.createObjectURL(vaultTrack.blob);
  const wasEmpty = state.playlist.length === 0;

  state.playlist.push({
    id: vaultTrack.id,
    title: vaultTrack.title,
    artist: vaultTrack.artist,
    album: vaultTrack.album || "Vault Track",
    duration: vaultTrack.duration || 0,
    url: audioUrl,
  });

  updateLibraryStats();
  renderPlaylist();

  if (wasEmpty && state.activeSource === "queue") {
    state.currentIndex = 0;
    setTrack(0, false, "queue");
  }

  const btn = queueBtnElement || document.querySelector(`.vault-card[data-vault-id="${vaultTrackId}"] .vault-queue-btn`);
  if (btn) {
    btn.classList.add("added");
    btn.textContent = "✓ Added";
    setTimeout(() => {
      btn.classList.remove("added");
      btn.textContent = "+ Queue";
    }, 1800);
  }

  showToast(`Added "${vaultTrack.title}" to Your Queue`);
}

function clearQueue() {
  state.playlist.forEach((track) => {
    if (track && track.url && track.url.startsWith("blob:")) {
      URL.revokeObjectURL(track.url);
    }
  });

  state.playlist = [];

  if (state.activeSource === "queue") {
    state.currentIndex = 0;
    state.isPlaying = false;
    refs.audio.pause();
    refs.audio.removeAttribute("src");
    refs.audio.load();
    refs.currentTime.textContent = "0:00";
    refs.duration.textContent = "0:00";
    refs.progressBar.value = "0";
    drawSpectrumIdle();
    updateTrackDetails();
  }

  updateLibraryStats();
  renderPlaylist();
  updatePlaybackState();
}

async function deleteVaultTrack(vaultTrackId) {
  await deleteVaultTrackFromDB(vaultTrackId);
  await loadVaultFromDB();
}

async function loadUploadedFiles(files) {
  const audioFiles = Array.from(files).filter((file) => file.type.startsWith("audio/"));
  if (!audioFiles.length) {
    return;
  }

  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    const id = "track_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const trackItem = {
      id,
      title: file.name.replace(/\.[^.]+$/, ""),
      artist: "Local Upload",
      album: "Music Vault",
      size: file.size,
      blob: file,
      duration: 0,
      order: state.vaultTracks.length + i,
    };

    // Calculate duration
    const tempUrl = URL.createObjectURL(file);
    const audioProbe = new Audio();
    audioProbe.src = tempUrl;
    await new Promise((resolve) => {
      audioProbe.addEventListener("loadedmetadata", () => {
        trackItem.duration = audioProbe.duration || 0;
        resolve();
      }, { once: true });
      audioProbe.addEventListener("error", () => resolve(), { once: true });
    });
    URL.revokeObjectURL(tempUrl);

    // Save to IndexedDB
    await saveVaultTrackToDB(trackItem);
  }

  // Reload vault from IndexedDB
  await loadVaultFromDB();
}

async function loadQueueFiles(files) {
  const audioFiles = Array.from(files).filter((file) => file.type.startsWith("audio/"));
  if (!audioFiles.length) {
    return;
  }

  const wasEmpty = state.playlist.length === 0;

  for (const file of audioFiles) {
    const id = "queue_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const url = URL.createObjectURL(file);
    const trackItem = {
      id,
      title: file.name.replace(/\.[^.]+$/, ""),
      artist: "Local Track",
      album: "Temporary Queue",
      size: file.size,
      duration: 0,
      url,
    };

    // Calculate duration
    const audioProbe = new Audio();
    audioProbe.src = url;
    await new Promise((resolve) => {
      audioProbe.addEventListener("loadedmetadata", () => {
        trackItem.duration = audioProbe.duration || 0;
        resolve();
      }, { once: true });
      audioProbe.addEventListener("error", () => resolve(), { once: true });
    });

    state.playlist.push(trackItem);
  }

  updateLibraryStats();
  renderPlaylist();

  if (wasEmpty && state.playlist.length > 0) {
    setTrack(0, false, "queue");
  }
}

refs.playButton.addEventListener("click", togglePlay);
refs.featuredPlayButton.addEventListener("click", togglePlay);
refs.prevButton.addEventListener("click", () => setTrack(getPreviousIndex(), state.isPlaying, state.activeSource));
refs.featuredPrevButton.addEventListener("click", () => setTrack(getPreviousIndex(), state.isPlaying, state.activeSource));
refs.nextButton.addEventListener("click", () => setTrack(getNextIndex(), state.isPlaying, state.activeSource));
refs.featuredNextButton.addEventListener("click", () => setTrack(getNextIndex(), state.isPlaying, state.activeSource));

function toggleShuffle() {
  setShuffle(!state.isShuffle);
}

function toggleLoop() {
  setLoop(!state.isLooping);
}

if (refs.clearQueueButton) {
  refs.clearQueueButton.addEventListener("click", clearQueue);
}
if (refs.featuredShuffleButton) {
  refs.featuredShuffleButton.addEventListener("click", toggleShuffle);
}
if (refs.featuredLoopButton) {
  refs.featuredLoopButton.addEventListener("click", toggleLoop);
}
refs.skipBackButton.addEventListener("click", () => skipBy(-5));
refs.skipForwardButton.addEventListener("click", () => skipBy(5));

refs.progressBar.addEventListener("input", (event) => {
  const percent = Number(event.target.value);
  if (!Number.isFinite(refs.audio.duration)) {
    return;
  }

  refs.audio.currentTime = (percent / 100) * refs.audio.duration;
});

refs.volumeBar.addEventListener("input", (event) => {
  syncVolumeControls(event.target.value);
});

refs.featuredVolumeBar.addEventListener("input", (event) => {
  syncVolumeControls(event.target.value);
});

refs.speedControls.addEventListener("click", (event) => {
  const button = event.target.closest(".speed-pill");
  if (!button) {
    return;
  }

  syncSpeedControls(button.dataset.speed);
});

refs.moodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    updateTheme(button.dataset.theme);
  });
});

if (refs.audioUploadVault) {
  refs.audioUploadVault.addEventListener("change", (event) => {
    loadUploadedFiles(event.target.files);
    event.target.value = "";
  });
}

if (refs.audioUploadQueue) {
  refs.audioUploadQueue.addEventListener("change", (event) => {
    loadQueueFiles(event.target.files);
    event.target.value = "";
  });
}

if (refs.searchInput) {
  refs.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderPlaylist();
  });
}

if (refs.sourceToggleBtn) {
  refs.sourceToggleBtn.addEventListener("click", togglePlaybackSource);
}

refs.playlist.addEventListener("click", (event) => {
  const removeTrigger = event.target.closest('[data-action="remove"]');
  if (removeTrigger) {
    event.stopPropagation();
    const card = removeTrigger.closest(".playlist-card");
    if (card) {
      removeTrack(Number(card.dataset.index));
    }
    return;
  }

  const trigger = event.target.closest(".playlist-card, .playlist-play");
  if (!trigger) {
    return;
  }

  const card = trigger.closest(".playlist-card");
  if (!card) {
    return;
  }

  const selectedIndex = Number(card.dataset.index);
  const isCurrentTrack = state.activeSource === "queue" && selectedIndex === state.currentIndex;

  if (isCurrentTrack) {
    togglePlay();
    return;
  }

  state.isPlaying = true;
  setTrack(selectedIndex, true, "queue");
});

refs.audio.addEventListener("timeupdate", () => {
  refs.currentTime.textContent = formatTime(refs.audio.currentTime);

  if (!Number.isFinite(refs.audio.duration) || refs.audio.duration <= 0) {
    refs.progressBar.value = "0";
    return;
  }

  const completion = (refs.audio.currentTime / refs.audio.duration) * 100;
  refs.progressBar.value = String(completion);
});

refs.audio.addEventListener("loadedmetadata", () => {
  const current = getCurrentTrack();
  if (current) {
    current.duration = refs.audio.duration;
  }

  refs.duration.textContent = formatTime(refs.audio.duration);
  updateLibraryStats();
  renderPlaylist();
});

refs.audio.addEventListener("ended", () => {
  setTrack(getNextIndex(), true, state.activeSource);
});

window.addEventListener("resize", () => {
  if (state.isPlaying) {
    drawSpectrum();
  } else {
    drawSpectrumIdle();
  }
});

if (refs.spectrumShell) {
  refs.spectrumShell.addEventListener("pointermove", (event) => {
    setSpectrumPointer(event.clientX, event.clientY);
  });

  refs.spectrumShell.addEventListener("pointerleave", () => {
    refs.spectrumShell.style.setProperty("--mx", "50%");
    refs.spectrumShell.style.setProperty("--my", "50%");
  });
}

document.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement ||
    event.target?.isContentEditable
  ) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
    return;
  }

  if (event.code === "ArrowRight") {
    event.preventDefault();
    setTrack(getNextIndex(), state.isPlaying, state.activeSource);
    return;
  }

  if (event.code === "ArrowLeft") {
    event.preventDefault();
    setTrack(getPreviousIndex(), state.isPlaying, state.activeSource);
    return;
  }

  if (event.code === "ArrowUp") {
    event.preventDefault();
    syncVolumeControls(Number(refs.volumeBar.value) + 5);
    return;
  }

  if (event.code === "ArrowDown") {
    event.preventDefault();
    syncVolumeControls(Number(refs.volumeBar.value) - 5);
    return;
  }

  if (event.code === "KeyM") {
    event.preventDefault();
    syncVolumeControls(refs.audio.volume > 0 ? 0 : 72);
    return;
  }

  if (event.code === "KeyL") {
    event.preventDefault();
    toggleLoop();
    return;
  }

  if (event.code === "KeyS") {
    event.preventDefault();
    toggleShuffle();
  }
});

if (refs.vaultSearchInput) {
  refs.vaultSearchInput.addEventListener("input", (event) => {
    state.vaultSearch = event.target.value;
    renderVault();
  });
}

function setupVaultSortDropdown() {
  if (!refs.vaultSortToggleBtn || !refs.vaultSortMenu) return;

  const sortLabels = {
    custom: "Sort: Default",
    "title-asc": "Title (A → Z)",
    "title-desc": "Title (Z → A)",
    "duration-asc": "Duration ↑",
    "duration-desc": "Duration ↓",
    newest: "Recently Added",
  };

  refs.vaultSortToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = refs.vaultSortContainer.classList.toggle("open");
    refs.vaultSortToggleBtn.setAttribute("aria-expanded", String(isOpen));
  });

  refs.vaultSortMenu.addEventListener("click", (e) => {
    const option = e.target.closest(".vault-sort-option");
    if (!option) return;
    e.stopPropagation();

    const sortValue = option.dataset.value;
    state.vaultSort = sortValue;

    // Update active class on options
    refs.vaultSortMenu.querySelectorAll(".vault-sort-option").forEach((opt) => {
      const isSelected = opt.dataset.value === sortValue;
      opt.classList.toggle("active", isSelected);
      opt.setAttribute("aria-selected", String(isSelected));
    });

    // Update button label
    if (refs.vaultSortCurrentLabel) {
      refs.vaultSortCurrentLabel.textContent = sortLabels[sortValue] || "Sort: Default";
    }

    // Close menu
    refs.vaultSortContainer.classList.remove("open");
    refs.vaultSortToggleBtn.setAttribute("aria-expanded", "false");

    renderVault();
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (refs.vaultSortContainer && !refs.vaultSortContainer.contains(e.target)) {
      refs.vaultSortContainer.classList.remove("open");
      refs.vaultSortToggleBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && refs.vaultSortContainer && refs.vaultSortContainer.classList.contains("open")) {
      refs.vaultSortContainer.classList.remove("open");
      refs.vaultSortToggleBtn.setAttribute("aria-expanded", "false");
    }
  });
}

if (refs.playAllVaultBtn) {
  refs.playAllVaultBtn.addEventListener("click", playAllVaultTracks);
}

if (refs.vaultTrackList) {
  refs.vaultTrackList.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest('[data-action="delete-vault"]');
    if (deleteBtn) {
      event.stopPropagation();
      const card = deleteBtn.closest(".vault-card");
      if (card) {
        deleteVaultTrack(card.dataset.vaultId);
      }
      return;
    }

    const queueBtn = event.target.closest('[data-action="queue-vault"]');
    if (queueBtn) {
      event.stopPropagation();
      const card = queueBtn.closest(".vault-card");
      if (card) {
        addVaultTrackToPlaylist(card.dataset.vaultId, queueBtn);
      }
      return;
    }

    const playBtn = event.target.closest('[data-action="play-vault"]');
    if (playBtn) {
      event.stopPropagation();
      const card = playBtn.closest(".vault-card");
      if (card) {
        playVaultTrackDirectly(card.dataset.vaultId);
      }
      return;
    }

    const card = event.target.closest(".vault-card");
    if (card && !event.target.closest(".drag-handle")) {
      playVaultTrackDirectly(card.dataset.vaultId);
    }
  });
}

// --- DRAG & DROP REORDERING & FILE UPLOAD ---

let draggedReorderItem = null;

function setupReorderingListeners() {
  // Vault Drag & Drop Reorder
  if (refs.vaultTrackList) {
    refs.vaultTrackList.addEventListener("dragstart", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a") || e.target.closest("label")) {
        e.preventDefault();
        return;
      }
      const card = e.target.closest(".vault-card");
      if (!card || state.vaultSearch.trim()) {
        e.preventDefault();
        return;
      }
      draggedReorderItem = { type: "vault", index: Number(card.dataset.index), id: card.dataset.vaultId };
      card.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.index);
    });

    refs.vaultTrackList.addEventListener("dragover", (e) => {
      if (!draggedReorderItem || draggedReorderItem.type !== "vault") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const card = e.target.closest(".vault-card");
      if (card && Number(card.dataset.index) !== draggedReorderItem.index) {
        refs.vaultTrackList.querySelectorAll(".vault-card").forEach((c) => c.classList.remove("drag-target-over"));
        card.classList.add("drag-target-over");
      }
    });

    refs.vaultTrackList.addEventListener("dragleave", (e) => {
      const card = e.target.closest(".vault-card");
      if (card && !card.contains(e.relatedTarget)) {
        card.classList.remove("drag-target-over");
      }
    });

    refs.vaultTrackList.addEventListener("dragend", () => {
      refs.vaultTrackList.querySelectorAll(".vault-card").forEach((c) => {
        c.classList.remove("is-dragging", "drag-target-over");
      });
      draggedReorderItem = null;
    });

    refs.vaultTrackList.addEventListener("drop", async (e) => {
      if (!draggedReorderItem || draggedReorderItem.type !== "vault") return;
      e.preventDefault();
      const targetCard = e.target.closest(".vault-card");
      refs.vaultTrackList.querySelectorAll(".vault-card").forEach((c) => {
        c.classList.remove("is-dragging", "drag-target-over");
      });

      if (!targetCard) return;
      const fromIndex = draggedReorderItem.index;
      const toIndex = Number(targetCard.dataset.index);

      if (fromIndex === toIndex || isNaN(fromIndex) || isNaN(toIndex)) return;

      const [movedTrack] = state.vaultTracks.splice(fromIndex, 1);
      state.vaultTracks.splice(toIndex, 0, movedTrack);

      if (state.activeSource === "vault") {
        if (state.currentIndex === fromIndex) {
          state.currentIndex = toIndex;
        } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
          state.currentIndex--;
        } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
          state.currentIndex++;
        }
      }

      renderVault();
      await saveAllVaultTracksOrder(state.vaultTracks);
      showToast(`Moved track: #${fromIndex + 1} → #${toIndex + 1}`, "⇅");
    });
  }

  // Queue Drag & Drop Reorder
  if (refs.playlist) {
    refs.playlist.addEventListener("dragstart", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a") || e.target.closest("label")) {
        e.preventDefault();
        return;
      }
      const card = e.target.closest(".playlist-card");
      if (!card || state.search.trim()) {
        e.preventDefault();
        return;
      }
      draggedReorderItem = { type: "queue", index: Number(card.dataset.index) };
      card.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.index);
    });

    refs.playlist.addEventListener("dragover", (e) => {
      if (!draggedReorderItem || draggedReorderItem.type !== "queue") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const card = e.target.closest(".playlist-card");
      if (card && Number(card.dataset.index) !== draggedReorderItem.index) {
        refs.playlist.querySelectorAll(".playlist-card").forEach((c) => c.classList.remove("drag-target-over"));
        card.classList.add("drag-target-over");
      }
    });

    refs.playlist.addEventListener("dragleave", (e) => {
      const card = e.target.closest(".playlist-card");
      if (card && !card.contains(e.relatedTarget)) {
        card.classList.remove("drag-target-over");
      }
    });

    refs.playlist.addEventListener("dragend", () => {
      refs.playlist.querySelectorAll(".playlist-card").forEach((c) => {
        c.classList.remove("is-dragging", "drag-target-over");
      });
      draggedReorderItem = null;
    });

    refs.playlist.addEventListener("drop", (e) => {
      if (!draggedReorderItem || draggedReorderItem.type !== "queue") return;
      e.preventDefault();
      const targetCard = e.target.closest(".playlist-card");
      refs.playlist.querySelectorAll(".playlist-card").forEach((c) => {
        c.classList.remove("is-dragging", "drag-target-over");
      });

      if (!targetCard) return;
      const fromIndex = draggedReorderItem.index;
      const toIndex = Number(targetCard.dataset.index);

      if (fromIndex === toIndex || isNaN(fromIndex) || isNaN(toIndex)) return;

      const [movedTrack] = state.playlist.splice(fromIndex, 1);
      state.playlist.splice(toIndex, 0, movedTrack);

      if (state.activeSource === "queue") {
        if (state.currentIndex === fromIndex) {
          state.currentIndex = toIndex;
        } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
          state.currentIndex--;
        } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
          state.currentIndex++;
        }
      }

      renderPlaylist();
      showToast(`Queue reordered: #${fromIndex + 1} → #${toIndex + 1}`, "⇅");
    });
  }
}

function setupVaultFileDropzone() {
  const dropzone = document.querySelector(".vault-dropzone-banner");
  const panel = refs.vaultPanel;

  if (!dropzone && !panel) return;

  const targetElements = [dropzone, panel].filter(Boolean);
  let dragCounter = 0;

  targetElements.forEach((el) => {
    el.addEventListener("dragenter", (e) => {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
        e.preventDefault();
        dragCounter++;
        dropzone?.classList.add("is-dragover");
        panel?.classList.add("is-dragover");
      }
    });

    el.addEventListener("dragover", (e) => {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    });

    el.addEventListener("dragleave", (e) => {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          dropzone?.classList.remove("is-dragover");
          panel?.classList.remove("is-dragover");
        }
      }
    });

    el.addEventListener("drop", async (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        dragCounter = 0;
        dropzone?.classList.remove("is-dragover");
        panel?.classList.remove("is-dragover");

        const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("audio/"));
        if (!files.length) {
          showToast("Please drop valid audio files (MP3, WAV, etc.)", "!");
          return;
        }

        showToast(`Importing ${files.length} audio track(s)...`, "⏳");
        await loadUploadedFiles(files);
        showToast(`Saved ${files.length} track(s) to Uploads Vault`, "✓");
      }
    });
  });
}

syncVolumeControls(refs.volumeBar.value);
syncSpeedControls(state.playbackRate);
spectrumContext = refs.spectrumCanvas ? refs.spectrumCanvas.getContext("2d") : null;
if (refs.spectrumShell) {
  refs.spectrumShell.style.setProperty("--mx", "50%");
  refs.spectrumShell.style.setProperty("--my", "50%");
}
drawSpectrumIdle();
runSpectrumLoop();
state.playlist.forEach(primeTrackDuration);
updateLibraryStats();
renderPlaylist();
updateTrackDetails();
updatePlaybackState();
updateShuffleState();
updateLoopState();
updateTheme("auto");
setTrack(0, false);
setInterval(rotateMusicQuote, 6500);
loadVaultFromDB();
setupReorderingListeners();
setupVaultFileDropzone();
setupVaultSortDropdown();
