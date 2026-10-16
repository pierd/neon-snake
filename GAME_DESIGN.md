# Neon Snake

A 2D Tron-style neon snake game where you pick the grid's shape — triangle, square or hexagon — while other players' maps glow far below.

## Vision
- Genre: arcade snake, single-player with an ambient shared world.
- Pillars: the grid shape changes how you steer (square 4 directions, triangle and hexagon 6); a glowing neon, Tron-like look; the feeling that other people are playing right now.
- Session: 1–5 minute runs, instant retry.

## Core Loop
- Pick a grid in the main menu (Triangle, Square, Hexagon).
- Steer the light-cycle snake to eat yellow energy cells (+10 points, +2 length).
- The snake speeds up with every cell eaten.
- Hitting the arena wall or your own body ends the run (DEREZZED). Retry or go back to the menu.

## Player
- Square (classic): Arrows or WASD steer in absolute directions; you can't reverse.
- Triangle and Hexagon: ←/→ or A/D turn 60° left or right; the heading is one of 6 directions. On triangles the snake zigzags edge to edge along the chosen direction.
- Hexagon only: Z / C make a sharp 120° turn left or right.
- Up to 3 turns are buffered, and one is applied per step. A chevron on the head shows the current heading.
- Camera: top-down perspective with slight mouse parallax; shakes on death and on eating.
- Glow: [ / ] (or - / =) lower or raise the bloom strength (default 55%, range 0–200%) at any time.
- Menu: keys 1/2/3 or click. During play, Esc goes to the menu. On game over, Space/Enter retries.

## Rules
- Start: 4 cells long at the board centre, heading east.
- The step interval starts at 0.135 s, drops by 0.0028 s per cell eaten, and never goes below 0.055 s.
- A best score is kept per mode for the session.

## Multiplayer
- Play is single-player; there is no shared game state and no host logic.
- Each player publishes their own board via `setState`: mode, snake cell ids, food cell, alive flag, heading, score, and menu/play status.
- Every client draws other players' boards as small maps far below the arena, labelled with their name and score in their colour.
- Empty background slots (minimum 10 maps) are filled with locally simulated AI demo snakes labelled "AI".

## World and Levels
- Square: 21×21 cells. Triangle: 31×17 alternating triangles with zigzag side walls. Hexagon: hex-shaped board of radius 10 (331 cells).
- Dead-end cells (fewer than 2 open edges, e.g. the triangle board's bottom corners) are removed so every cell can be entered and left.
- Movement on every board is generic: the snake leaves its cell through the edge whose outward direction best matches its heading.
- Backdrop: a deep grid floor, drifting neon dust, and a glow under the arena tinted to the current mode.

## Art and Audio
- Black void, glowing outlines with bloom, thick neon borders.
- Palettes: Triangle has a magenta grid and cyan snake; Square has a cyan grid and orange snake; Hexagon has a lime grid and pink snake. Energy cells are yellow.
- Synthesized WebAudio blips for turns, eating, death, and menu selection.
- Music "Grid Runner": a synthwave loop composed in code (A minor, 112 BPM, Am–F–C–G). The menu has pads and a soft bass. Play adds drums and an echoing arpeggio, and a lead melody joins as the snake speeds up. Game over leaves a muffled pad. M toggles the music.

## UI/HUD
- Menu: NEON SNAKE title, three live AI-played board previews with neon buttons under each.
- Play: mode, score, and length top-left; best score and players online top-right; control hint at the bottom.
- Game over: DEREZZED panel with score, best, Retry, and Menu.

## Code Map
- `main.js` — game states (menu, play, over), input, tick timing, camera, bloom, spark bursts, net publishing.
- `game/boards.js` — board generation for the 3 shapes, edge adjacency, `nextCell` movement.
- `game/snake.js` — snake rules (turn, steer, tick, food) and the greedy AI.
- `game/boardView.js` — neon rendering of a board, snake, heading chevron, and food; per-mode palettes.
- `game/background.js` — background maps of other players and AI demos, with name labels.
- `game/hud.js` — HTML menu, HUD, and game-over overlay.
- `game/audio.js` — shared AudioContext and synthesized sound effects.
- `game/music.js` — procedural music sequencer and its mode/intensity layers.
- `world/backdrop.js` — backdrop grid, dust, and arena glow.

## Open Questions
- Should there be a shared online leaderboard per mode?
- Power-ups or obstacles per mode?
