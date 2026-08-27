// Veloura Homepage Interactive Scripts
(function () {
  "use strict";

  // --- 1. Interactive Mood Switching ---
  const moodPills = document.querySelectorAll(".home-mood-pill");
  const heroMoodTag = document.getElementById("heroMoodTag");
  const body = document.body;

  const moodNames = {
    "late-night": "Late Night",
    "velvet-soul": "Velvet Soul",
    "glass-house": "Glass House",
    "skyline-ride": "Skyline Ride",
  };

  moodPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const selectedMood = pill.dataset.mood;
      if (!selectedMood) return;

      // Update active state
      moodPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");

      // Apply data-theme to body with smooth transition
      body.setAttribute("data-theme", selectedMood);

      // Update hero mockup tag
      if (heroMoodTag) {
        heroMoodTag.textContent = moodNames[selectedMood] || "Late Night";
      }
    });
  });

  // --- 2. Live Canvas Visualizer Demo ---
  const canvas = document.getElementById("heroVisualizerCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let isPlaying = true;
  let animationId = null;
  let phase = 0;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // Draw simulated frequency bars + smooth waveform
  function drawVisualizer() {
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, width, height);

    const barCount = 36;
    const barWidth = (width - barCount * 3) / barCount;
    const goldColor = getComputedStyle(document.body).getPropertyValue("--gold").trim() || "#e0b774";

    if (isPlaying) {
      phase += 0.04;
    }

    // Draw Frequency Bars
    for (let i = 0; i < barCount; i++) {
      const normalizedIndex = i / barCount;
      let barHeight;

      if (isPlaying) {
        // Multi-frequency wave simulation
        const wave1 = Math.sin(phase * 2 + i * 0.35);
        const wave2 = Math.cos(phase * 1.5 - i * 0.25);
        const wave3 = Math.sin(phase * 3.2 + i * 0.5);
        const combined = Math.abs((wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2));
        barHeight = Math.max(8, combined * (height * 0.72));
      } else {
        barHeight = 6;
      }

      const x = i * (barWidth + 3) + 2;
      const y = height - barHeight - 4;

      // Gradient for each bar
      const grad = ctx.createLinearGradient(0, y, 0, height);
      grad.addColorStop(0, goldColor);
      grad.addColorStop(1, "rgba(255, 255, 255, 0.05)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(2, barWidth), barHeight, [3, 3, 0, 0]);
      ctx.fill();
    }

    // Subtle center glow
    const glowGrad = ctx.createRadialGradient(width / 2, height / 2, 5, width / 2, height / 2, width / 2);
    glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.04)");
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, width, height);

    animationId = requestAnimationFrame(drawVisualizer);
  }

  drawVisualizer();

  // --- 3. Mockup Play / Pause Toggle ---
  const playToggleBtn = document.getElementById("mockupPlayToggle");
  const iconPlay = playToggleBtn ? playToggleBtn.querySelector(".icon-play") : null;
  const iconPause = playToggleBtn ? playToggleBtn.querySelector(".icon-pause") : null;
  const vinylDisc = document.querySelector(".mockup-vinyl");

  if (playToggleBtn) {
    playToggleBtn.addEventListener("click", () => {
      isPlaying = !isPlaying;

      if (isPlaying) {
        if (iconPlay) iconPlay.style.display = "none";
        if (iconPause) iconPause.style.display = "block";
        if (vinylDisc) vinylDisc.style.animationPlayState = "running";
      } else {
        if (iconPlay) iconPlay.style.display = "block";
        if (iconPause) iconPause.style.display = "none";
        if (vinylDisc) vinylDisc.style.animationPlayState = "paused";
      }
    });

    // Initial state: show pause icon (since it starts playing)
    if (iconPlay) iconPlay.style.display = "none";
    if (iconPause) iconPause.style.display = "block";
  }
})();
