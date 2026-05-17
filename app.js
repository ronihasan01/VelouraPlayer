const state = {
  playlist: [],
  currentIndex: 0,
  isPlaying: false,
  isShuffle: false,
  isLooping: false,
  moodMode: "late-night",
  search: "",
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
  shuffleButton: document.getElementById("shuffleButton"),
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
  heroTitle: document.getElementById("heroTitle"),
  heroArtist: document.getElementById("heroArtist"),
  trackMeta: document.getElementById("trackMeta"),
  dockTitle: document.getElementById("dockTitle"),
  dockArtist: document.getElementById("dockArtist"),
  trackCount: document.getElementById("trackCount"),
  playlistDuration: document.getElementById("playlistDuration"),
  audioUpload: document.getElementById("audioUpload"),
  searchInput: document.getElementById("searchInput"),
};

state.playbackRate = 1;
const rotatingThemes = ["late-night", "velvet-soul", "glass-house", "skyline-ride"];
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

function activateSpectrumAnalyzer() {
  const current = state.playlist[state.currentIndex];
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

function updateTrackDetails() {
  const current = state.playlist[state.currentIndex];
  if (!current) {
    refs.trackTitle.textContent = "No tracks loaded";
    refs.heroTitle.textContent = "No tracks loaded";
    refs.heroArtist.textContent = "Add music to get started";
    refs.trackMeta.textContent = "Your browser session";
    refs.dockTitle.textContent = "No tracks loaded";
    refs.dockArtist.textContent = "Waiting for music";
    refs.duration.textContent = "0:00";
    return;
  }

  refs.trackTitle.textContent = current.title;
  refs.heroTitle.textContent = current.title;
  refs.heroArtist.textContent = current.artist;
  refs.trackMeta.textContent = `${current.artist} • ${current.album || "Single"}`;
  refs.dockTitle.textContent = current.title;
  refs.dockArtist.textContent = current.artist;
}

function updatePlaybackState() {
  refs.playButton.textContent = state.isPlaying ? "Pause" : "Play";
  refs.featuredPlayButton.textContent = state.isPlaying ? "Pause" : "Play";
  refs.body.classList.toggle("is-playing", state.isPlaying);
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
  }, 820);
}

function applyTheme(theme) {
  state.theme = theme;
  triggerThemeTransition();
  refs.body.dataset.theme = theme;
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
  refs.shuffleButton.classList.toggle("active", state.isShuffle);
  refs.featuredShuffleButton.classList.toggle("active", state.isShuffle);
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
  if (!state.playlist.length) {
    return Promise.resolve(false);
  }

  if (!refs.audio.src) {
    setTrack(state.currentIndex, true);
    return Promise.resolve(true);
  }

  return refs.audio.play().then(() => {
    state.isPlaying = true;
    updatePlaybackState();
    activateSpectrumAnalyzer();
    return true;
  }).catch(() => {
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

function speakableThemeName(theme) {
  return theme
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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


function setTrack(index, shouldAutoplay = state.isPlaying) {
  const nextTrack = state.playlist[index];
  if (!nextTrack) {
    return;
  }

  state.currentIndex = index;
  refs.audio.src = nextTrack.url;
  refs.audio.load();
  refs.audio.playbackRate = state.playbackRate;
  refs.currentTime.textContent = "0:00";
  refs.progressBar.value = "0";
  updateTrackDetails();
  renderPlaylist();

  if (shouldAutoplay) {
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
  }
}

function togglePlay() {
  if (!state.playlist.length) {
    alertNoTracks();
    return;
  }

  if (!refs.audio.src) {
    setTrack(state.currentIndex, true);
    return;
  }

  if (refs.audio.paused) {
    playCurrentTrack();
  } else {
    pauseCurrentTrack();
  }
}

function getNextIndex() {
  if (!state.playlist.length) {
    return 0;
  }

  if (state.isShuffle && state.playlist.length > 1) {
    let candidate = state.currentIndex;
    while (candidate === state.currentIndex) {
      candidate = Math.floor(Math.random() * state.playlist.length);
    }
    return candidate;
  }

  return (state.currentIndex + 1) % state.playlist.length;
}

function getPreviousIndex() {
  if (!state.playlist.length) {
    return 0;
  }

  return (state.currentIndex - 1 + state.playlist.length) % state.playlist.length;
}

function renderPlaylist() {
  const visibleTracks = getVisibleTracks();

  if (!visibleTracks.length) {
    refs.playlist.innerHTML = state.playlist.length
      ? '<div class="playlist-empty">No matching tracks yet. Try another search.</div>'
      : `
        <div class="playlist-empty playlist-empty-rich">
          <strong>No audio tracks yet.</strong>
          <span>Add your songs to start building the Veloura playlist.</span>
          <label class="playlist-empty-action" for="audioUpload">Add Audio Tracks</label>
        </div>
      `;
    return;
  }

  refs.playlist.innerHTML = visibleTracks
    .map(({ track, index }, visibleIndex) => {
      const isActive = index === state.currentIndex;
      return `
        <article class="playlist-card ${isActive ? "active" : ""}" data-index="${index}">
          <div class="track-index">${String(visibleIndex + 1).padStart(2, "0")}</div>
          <div class="playlist-copy">
            <strong>${track.title}</strong>
            <span>${track.artist} • ${track.album || "Single"}</span>
          </div>
          <span class="track-duration">${formatTime(track.duration)}</span>
          <button class="playlist-play" type="button" data-action="play">
            ${isActive && state.isPlaying ? "Pause" : "Play"}
          </button>
        </article>
      `;
    })
    .join("");
}

function loadUploadedFiles(files) {
  const tracks = Array.from(files)
    .filter((file) => file.type.startsWith("audio/"))
    .map((file) => ({
      title: file.name.replace(/\.[^.]+$/, ""),
      artist: "Local Upload",
      album: "Your Session",
      url: URL.createObjectURL(file),
    }));

  if (!tracks.length) {
    return;
  }

  if (!state.playlist.length) {
    state.currentIndex = 0;
  }

  state.playlist = state.playlist.concat(tracks);

  tracks.forEach(primeTrackDuration);
  updateLibraryStats();
  renderPlaylist();
  setTrack(state.currentIndex, false);
}

refs.playButton.addEventListener("click", togglePlay);
refs.featuredPlayButton.addEventListener("click", togglePlay);
refs.prevButton.addEventListener("click", () => setTrack(getPreviousIndex(), state.isPlaying));
refs.featuredPrevButton.addEventListener("click", () => setTrack(getPreviousIndex(), state.isPlaying));
refs.nextButton.addEventListener("click", () => setTrack(getNextIndex(), state.isPlaying));
refs.featuredNextButton.addEventListener("click", () => setTrack(getNextIndex(), state.isPlaying));

function toggleShuffle() {
  setShuffle(!state.isShuffle);
}

function toggleLoop() {
  setLoop(!state.isLooping);
}

refs.shuffleButton.addEventListener("click", toggleShuffle);
refs.featuredShuffleButton.addEventListener("click", toggleShuffle);
refs.featuredLoopButton.addEventListener("click", toggleLoop);
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

refs.audioUpload.addEventListener("change", (event) => {
  loadUploadedFiles(event.target.files);
  event.target.value = "";
});

refs.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderPlaylist();
});

refs.playlist.addEventListener("click", (event) => {
  const trigger = event.target.closest(".playlist-card, .playlist-play");
  if (!trigger) {
    return;
  }

  const card = trigger.closest(".playlist-card");
  if (!card) {
    return;
  }

  const selectedIndex = Number(card.dataset.index);
  const isCurrentTrack = selectedIndex === state.currentIndex;

  if (isCurrentTrack) {
    togglePlay();
    return;
  }

  state.isPlaying = true;
  updatePlaybackState();
  setTrack(selectedIndex, true);
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
  const current = state.playlist[state.currentIndex];
  if (current) {
    current.duration = refs.audio.duration;
  }

  refs.duration.textContent = formatTime(refs.audio.duration);
  updateLibraryStats();
  renderPlaylist();
});

refs.audio.addEventListener("ended", () => {
  setTrack(getNextIndex(), true);
});

window.addEventListener("resize", () => {
  drawSpectrum();
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
  if (event.target instanceof HTMLInputElement) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
  }

  if (event.code === "ArrowRight" && Number.isFinite(refs.audio.duration)) {
    skipBy(10);
  }

  if (event.code === "ArrowLeft" && Number.isFinite(refs.audio.duration)) {
    skipBy(-10);
  }
});

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
