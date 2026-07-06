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
