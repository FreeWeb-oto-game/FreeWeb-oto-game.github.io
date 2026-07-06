(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.querySelector("#score");
  const comboEl = document.querySelector("#combo");
  const rankEl = document.querySelector("#rank");
  const judgementEl = document.querySelector("#judgement");
  const startButton = document.querySelector("#startButton");
  const pauseButton = document.querySelector("#pauseButton");
  const muteButton = document.querySelector("#muteButton");
  const touchBars = document.querySelector("#touchBars");
  const resultModal = document.querySelector("#resultModal");
  const resultScore = document.querySelector("#resultScore");
  const resultCombo = document.querySelector("#resultCombo");
  const resultPerfect = document.querySelector("#resultPerfect");
  const resultMiss = document.querySelector("#resultMiss");
  const resultTitle = document.querySelector("#resultTitle");

  const LANE_COUNT = 5;
  const BPM = 128;
  const BEAT = 60 / BPM;
  const LEAD_TIME = 1.85;
  const DURATION = 45;
  const HIT_WINDOWS = [
    { name: "PERFECT", ms: 84, score: 1000, color: "#30dfff" },
    { name: "GREAT", ms: 150, score: 720, color: "#a9ff68" },
    { name: "GOOD", ms: 240, score: 430, color: "#ffd166" },
  ];
  const MISS_WINDOW = 0.28;
  const laneColors = ["#ff5cbf", "#30dfff", "#ffd166", "#a9ff68", "#8f7bff"];

  let chart = [];
  let particles = [];
  let laneBursts = Array.from({ length: LANE_COUNT }, () => 0);
  let state = "idle";
  let muted = false;
  let audioContext = null;
  let masterGain = null;
  let melodyTimer = null;
  let audioStartTime = 0;
  let clockStartMs = 0;
  let pausedSongTime = 0;
  let pausedAudioAt = 0;
  let animationFrame = 0;
  let judgementTimer = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let perfect = 0;
  let miss = 0;

  const tapKeys = ["d", "f", " ", "j", "k"];

  function buildChart() {
    const pattern = [
      [2],
      [1],
      [3],
      [0, 4],
      [2],
      [0],
      [4],
      [1, 3],
      [2],
      [3],
      [1],
      [0, 4],
      [2],
      [1, 3],
      [0],
      [4],
    ];

    const notes = [];
    for (let i = 0; i < 88; i += 1) {
      const beat = i * 0.5 + 4;
      const lanes = pattern[i % pattern.length];
      lanes.forEach((lane) => {
        notes.push({
          lane,
          time: beat * BEAT,
          hit: false,
          missed: false,
          id: `${beat}-${lane}`,
        });
      });

      if (i % 8 === 6) {
        notes.push({
          lane: (i / 2) % LANE_COUNT,
          time: (beat + 0.25) * BEAT,
          hit: false,
          missed: false,
          id: `${beat}-extra`,
        });
      }
    }

    return notes.sort((a, b) => a.time - b.time);
  }

  function ensureAudio() {
    if (audioContext) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = new AudioCtx();
    masterGain = audioContext.createGain();
    masterGain.gain.value = muted ? 0 : 0.42;
    masterGain.connect(audioContext.destination);
  }

  function playTone(frequency, time, duration, type, gainValue) {
    if (!audioContext || muted) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function playNoise(time, duration, gainValue) {
    if (!audioContext || muted) return;
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    gain.gain.value = gainValue;
    source.connect(gain);
    gain.connect(masterGain);
    source.start(time);
  }

  function scheduleMusic() {
    clearInterval(melodyTimer);
    const scale = [392, 440, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33];
    let beatIndex = 0;

    const scheduleChunk = () => {
      if (state !== "playing" || !audioContext) return;
      if (audioContext.state === "suspended") return;
      const elapsed = audioContext.currentTime - audioStartTime;
      const lookAheadBeats = 8;
      while (beatIndex * BEAT < elapsed + lookAheadBeats * BEAT) {
        const beatTime = audioStartTime + beatIndex * BEAT;
        const note = scale[beatIndex % scale.length];
        playTone(note, beatTime, BEAT * 0.34, "triangle", 0.09);
        if (beatIndex % 2 === 0) playTone(98, beatTime, BEAT * 0.22, "sine", 0.14);
        if (beatIndex % 2 === 1) playNoise(beatTime, 0.05, 0.04);
        if (beatIndex % 8 === 0) playTone(196, beatTime, BEAT * 0.5, "sawtooth", 0.045);
        beatIndex += 1;
      }
    };

    scheduleChunk();
    melodyTimer = window.setInterval(scheduleChunk, 140);
  }

  function resetGame() {
    chart = buildChart();
    particles = [];
    laneBursts = Array.from({ length: LANE_COUNT }, () => 0);
    score = 0;
    combo = 0;
    maxCombo = 0;
    perfect = 0;
    miss = 0;
    updateHud();
    showJudgement("READY", "#ffffff");
  }

  function startGame() {
    ensureAudio();
    if (audioContext?.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    resetGame();
    state = "playing";
    clockStartMs = performance.now() + 400;
    audioStartTime = audioContext ? audioContext.currentTime + 0.4 : 0;
    startButton.textContent = "Restart";
    pauseButton.setAttribute("aria-pressed", "false");
    scheduleMusic();
    cancelAnimationFrame(animationFrame);
    loop();
  }

  function togglePause() {
    if (state === "idle" || state === "ended") return;
    if (state === "playing") {
      state = "paused";
      pausedSongTime = getSongTime();
      pausedAudioAt = audioContext ? audioContext.currentTime : 0;
      pauseButton.setAttribute("aria-pressed", "true");
      pauseButton.querySelector("span").textContent = "▶";
      clearInterval(melodyTimer);
      showJudgement("PAUSE", "#ffd166");
      return;
    }

    if (state === "paused") {
      const pausedAudioDuration = audioContext ? audioContext.currentTime - pausedAudioAt : 0;
      clockStartMs = performance.now() - pausedSongTime * 1000;
      audioStartTime += pausedAudioDuration;
      state = "playing";
      pauseButton.setAttribute("aria-pressed", "false");
      pauseButton.querySelector("span").textContent = "Ⅱ";
      scheduleMusic();
    }
  }

  function endGame() {
    state = "ended";
    clearInterval(melodyTimer);
    startButton.textContent = "Retry";
    pauseButton.setAttribute("aria-pressed", "false");
    pauseButton.querySelector("span").textContent = "Ⅱ";
    resultScore.textContent = score.toLocaleString("ja-JP");
    resultCombo.textContent = String(maxCombo);
    resultPerfect.textContent = String(perfect);
    resultMiss.textContent = String(miss);
    resultTitle.textContent = miss === 0 ? "Full Combo!" : "Live Clear";
    if (!resultModal.open) resultModal.showModal();
  }

  function getSongTime() {
    if (state === "paused") return pausedSongTime;
    return (performance.now() - clockStartMs) / 1000;
  }

  function updateHud() {
    scoreEl.textContent = String(score).padStart(7, "0");
    comboEl.textContent = String(combo);
    rankEl.textContent = getRank();
  }

  function getRank() {
    const maxScore = Math.max(chart.length * HIT_WINDOWS[0].score, 1);
    const rate = score / maxScore;
    if (rate >= 0.96) return "S";
    if (rate >= 0.86) return "A";
    if (rate >= 0.72) return "B";
    return "C";
  }

  function showJudgement(text, color) {
    judgementEl.textContent = text;
    judgementEl.style.color = color;
    judgementEl.classList.add("is-active");
    judgementTimer = performance.now() + 320;
  }

  function spawnParticles(lane, qualityColor) {
    const layout = getLayout();
    const x = layout.lanes[lane];
    const y = layout.hitY;
    for (let i = 0; i < 18; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const speed = 3 + Math.random() * 8;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: qualityColor,
        size: 2 + Math.random() * 4,
      });
    }
  }

  function hitLane(lane) {
    if (state !== "playing") return;
    laneBursts[lane] = 1;
    const songTime = getSongTime();
    let nearest = null;
    let nearestDelta = Infinity;

    for (const note of chart) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const delta = Math.abs(note.time - songTime);
      if (delta < nearestDelta) {
        nearest = note;
        nearestDelta = delta;
      }
    }

    const window = HIT_WINDOWS.find((quality) => nearestDelta * 1000 <= quality.ms);
    if (!nearest || !window) {
      combo = 0;
      showJudgement("MISS", "#ff7a72");
      miss += 1;
      updateHud();
      playNoise(audioContext.currentTime, 0.035, 0.025);
      return;
    }

    nearest.hit = true;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    score += window.score + Math.min(combo, 250) * 4;
    if (window.name === "PERFECT") perfect += 1;
    showJudgement(window.name, window.color);
    spawnParticles(lane, window.color);
    updateHud();
    playTone(523.25 + lane * 82, audioContext.currentTime, 0.08, "square", 0.07);
  }

  function missOldNotes(songTime) {
    for (const note of chart) {
      if (!note.hit && !note.missed && songTime - note.time > MISS_WINDOW) {
        note.missed = true;
        combo = 0;
        miss += 1;
        showJudgement("MISS", "#ff7a72");
        updateHud();
      }
    }
  }

  function getLayout() {
    const width = canvas.width;
    const height = canvas.height;
    const topY = height * 0.13;
    const hitY = height * 0.86;
    const topWidth = width * 0.22;
    const bottomWidth = width * 0.92;
    const center = width / 2;
    const lanes = Array.from({ length: LANE_COUNT }, (_, i) => {
      const t = i / (LANE_COUNT - 1) - 0.5;
      return center + t * bottomWidth;
    });
    const topLanes = Array.from({ length: LANE_COUNT }, (_, i) => {
      const t = i / (LANE_COUNT - 1) - 0.5;
      return center + t * topWidth;
    });
    return { width, height, topY, hitY, lanes, topLanes, center };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  function drawBackground(layout, songTime) {
    const { width, height, topY, hitY, lanes, topLanes, center } = layout;
    ctx.clearRect(0, 0, width, height);

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "rgba(12, 18, 42, 0.72)");
    sky.addColorStop(0.46, "rgba(23, 20, 50, 0.72)");
    sky.addColorStop(1, "rgba(8, 12, 25, 0.82)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 12; i += 1) {
      const y = ((songTime * 90 + i * 90) % (height * 0.74)) + topY - 80;
      ctx.strokeStyle = i % 2 ? "rgba(48, 223, 255, 0.24)" : "rgba(255, 92, 191, 0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(center - width * 0.42, y);
      ctx.lineTo(center + width * 0.42, y);
      ctx.stroke();
    }
    ctx.restore();

    const laneGradient = ctx.createLinearGradient(0, topY, 0, hitY);
    laneGradient.addColorStop(0, "rgba(255,255,255,0.04)");
    laneGradient.addColorStop(0.58, "rgba(255,255,255,0.11)");
    laneGradient.addColorStop(1, "rgba(255,255,255,0.2)");

    ctx.beginPath();
    ctx.moveTo(topLanes[0] - width * 0.05, topY);
    ctx.lineTo(topLanes[LANE_COUNT - 1] + width * 0.05, topY);
    ctx.lineTo(lanes[LANE_COUNT - 1] + width * 0.05, hitY);
    ctx.lineTo(lanes[0] - width * 0.05, hitY);
    ctx.closePath();
    ctx.fillStyle = laneGradient;
    ctx.fill();

    for (let i = 0; i < LANE_COUNT; i += 1) {
      const burst = laneBursts[i];
      ctx.strokeStyle = burst > 0.02 ? laneColors[i] : "rgba(255,255,255,0.22)";
      ctx.lineWidth = burst > 0.02 ? 7 : 3;
      ctx.beginPath();
      ctx.moveTo(topLanes[i], topY);
      ctx.lineTo(lanes[i], hitY);
      ctx.stroke();

      if (burst > 0.02) {
        const glow = ctx.createLinearGradient(topLanes[i], topY, lanes[i], hitY);
        glow.addColorStop(0, "rgba(255,255,255,0)");
        glow.addColorStop(1, laneColors[i]);
        ctx.globalAlpha = 0.2 * burst;
        ctx.strokeStyle = glow;
        ctx.lineWidth = width * 0.09;
        ctx.beginPath();
        ctx.moveTo(topLanes[i], topY);
        ctx.lineTo(lanes[i], hitY);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.save();
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#30dfff";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(lanes[0] - width * 0.08, hitY);
    ctx.lineTo(lanes[LANE_COUNT - 1] + width * 0.08, hitY);
    ctx.stroke();
    ctx.restore();
  }

  function projectNote(note, songTime, layout) {
    const progress = 1 - (note.time - songTime) / LEAD_TIME;
    const eased = Math.max(0, Math.min(1.12, progress)) ** 1.55;
    const x = layout.topLanes[note.lane] + (layout.lanes[note.lane] - layout.topLanes[note.lane]) * eased;
    const y = layout.topY + (layout.hitY - layout.topY) * eased;
    const size = canvas.width * (0.033 + eased * 0.024);
    return { x, y, size, progress };
  }

  function drawNotes(layout, songTime) {
    const visible = chart.filter(
      (note) => !note.hit && !note.missed && note.time - songTime < LEAD_TIME && songTime - note.time < MISS_WINDOW,
    );

    for (const note of visible) {
      const pos = projectNote(note, songTime, layout);
      if (pos.progress < 0) continue;
      const color = laneColors[note.lane];
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(Math.sin(songTime * 3 + note.lane) * 0.06);
      ctx.shadowBlur = 26;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      roundRect(-pos.size * 1.35, -pos.size * 0.48, pos.size * 2.7, pos.size * 0.96, pos.size * 0.34);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      roundRect(-pos.size * 0.86, -pos.size * 0.17, pos.size * 1.72, pos.size * 0.2, pos.size * 0.1);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    particles = particles.filter((particle) => particle.life > 0.02);
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.32;
      particle.life *= 0.92;
      ctx.save();
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawIdle(layout) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = `900 ${Math.round(canvas.width * 0.05)}px system-ui, sans-serif`;
    ctx.fillText("Tap START", layout.center, layout.height * 0.45);
    ctx.fillStyle = "rgba(174,184,215,0.86)";
    ctx.font = `800 ${Math.round(canvas.width * 0.024)}px system-ui, sans-serif`;
    ctx.fillText("5 lanes / touch, click, or D F Space J K", layout.center, layout.height * 0.5);
    ctx.restore();
  }

  function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function loop() {
    resizeCanvas();
    const layout = getLayout();
    const songTime = getSongTime();

    drawBackground(layout, songTime);
    if (state === "idle") drawIdle(layout);
    if (state === "playing" || state === "paused" || state === "ended") {
      drawNotes(layout, songTime);
      drawParticles();
    }

    for (let i = 0; i < laneBursts.length; i += 1) {
      laneBursts[i] *= 0.86;
    }

    if (performance.now() > judgementTimer) {
      judgementEl.classList.remove("is-active");
    }

    if (state === "playing") {
      missOldNotes(songTime);
      const allDone = chart.every((note) => note.hit || note.missed);
      const endTime = chart.length ? chart[chart.length - 1].time + 1.4 : DURATION;
      if ((songTime > endTime && allDone) || songTime > endTime + 1) {
        endGame();
      }
    }

    animationFrame = requestAnimationFrame(loop);
  }

  function setPressedVisual(lane, pressed) {
    const button = touchBars.querySelector(`[data-lane="${lane}"]`);
    if (!button) return;
    button.classList.toggle("is-pressed", pressed);
  }

  startButton.addEventListener("click", () => {
    startGame();
  });

  pauseButton.addEventListener("click", () => {
    togglePause();
  });

  muteButton.addEventListener("click", () => {
    muted = !muted;
    muteButton.setAttribute("aria-pressed", String(muted));
    muteButton.querySelector("span").textContent = muted ? "×" : "♪";
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.42;
  });

  touchBars.addEventListener("pointerdown", (event) => {
    const target = event.target.closest("button[data-lane]");
    if (!target) return;
    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    const lane = Number(target.dataset.lane);
    setPressedVisual(lane, true);
    hitLane(lane);
  });

  touchBars.addEventListener("pointerup", (event) => {
    const target = event.target.closest("button[data-lane]");
    if (!target) return;
    setPressedVisual(Number(target.dataset.lane), false);
  });

  touchBars.addEventListener("pointercancel", (event) => {
    const target = event.target.closest("button[data-lane]");
    if (!target) return;
    setPressedVisual(Number(target.dataset.lane), false);
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    const lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(((event.clientX - rect.left) / rect.width) * LANE_COUNT)));
    laneBursts[lane] = 1;
    setPressedVisual(lane, true);
    window.setTimeout(() => setPressedVisual(lane, false), 90);
    hitLane(lane);
  });

  window.addEventListener("keydown", (event) => {
    const lane = tapKeys.indexOf(event.key.toLowerCase());
    if (lane === -1) return;
    event.preventDefault();
    setPressedVisual(lane, true);
    hitLane(lane);
  });

  window.addEventListener("keyup", (event) => {
    const lane = tapKeys.indexOf(event.key.toLowerCase());
    if (lane === -1) return;
    setPressedVisual(lane, false);
  });

  window.addEventListener("resize", resizeCanvas);

  resetGame();
  loop();
})();
