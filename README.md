# Starlight Beats

GitHub Pagesでそのまま公開できる、横画面向けのタッチ音ゲーです。

## Features

- 8 division touch rhythm gameplay
- Landscape-first layout for phones and tablets（縦画面では回転案内を表示）
- Direct tap input on the judgement area, with no lane buttons
- Tap, gold, flick, and hold/slide style notes
- Melodiniq（CHUNITHM X-VERSE-X / onoken a.k.a. owl＊tree, BPM 193）をイメージした、153小節のオリジナル解釈譜面を `lane-map.js` に収録
- `assets/melodiniq.mp3` playback when the file exists
- Generated Web Audio fallback music and hit sounds
- Score rank, life gauge, combo, judgement, and result screen
- 内蔵の CHART STUDIO エディターでノーツ・BPM・タイトルを自由に編集可能

## Controls

- Tap near the purple judgement line to hit notes.
- Flick notes can be cleared by swiping quickly on the note.
- Hold notes start with a touch and clear by keeping contact until the tail reaches the judgement line.
- Keyboard fallback: `A` `S` `D` `F` `J` `K` `L` `;`.

## Song File

Place your licensed audio file at `assets/melodiniq.mp3`.
The game will use that file automatically. If it is not present, it falls back to generated Web Audio.
音源が譜面より短い/長い場合は、音源終了後も残りのノーツはサイレントでそのまま進行します（バグ修正済み）。

## About the chart

`lane-map.js` の譜面は、共有いただいた譜面画像（V字/X字/波状ホールド/階段/アーチなどの配置）から読み取れる特徴を再現した非公式のオリジナル解釈です。実際の譜面データを1ノーツ単位まで完全再現したものではないため、以下の方法で自由に調整してください。

- アプリ内の `CHART EDIT` 画面から、小節ごとにノーツを追加・削除
- `EXPORT` / `IMPORT` ボタンでJSONとして書き出し・読み込み
- `lane-map.js` を直接編集（`tap` / `gold` / `flick` / `hold` などの関数で小節ごとに記述）
- BPMや小節数も、音源の長さに合わせて `CHART EDIT` 画面から変更可能

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. Open `Settings` -> `Pages`.
3. Select `Deploy from a branch`.
4. Choose your branch and `/root`.
