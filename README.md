# AetherStation

> *Remember the first time you heard that startup sound? The anticipation as the logo faded in, controller in hand, the whole evening ahead of you. AetherStation brings that feeling back.*

A love letter to the golden era of gaming — AetherStation is a sleek, Apple-inspired PlayStation 1 emulator shell that runs on macOS, Windows, and Linux. Built with Electron, Next.js, Tailwind CSS, and a bundled WebAssembly core, it wraps the raw power of PS1 emulation in a modern, minimal interface that feels right at home on your desktop.

No setup wizards. No config files. Just drop a disc image and play.

---

## Features

- **Cross-platform** — runs natively on macOS, Windows, and Linux via Electron
- **Web-deployable** — static export works on Vercel, Netlify, or any static host
- **Zero BIOS required** — uses HLE (High-Level Emulation) so no copyrighted firmware needed
- **Drag-and-drop** — toss a `.bin`, `.img`, `.iso`, or `.mdf` onto the stage and go
- **Persistent save data** — memory card data syncs to IndexedDB automatically, your progress survives page reloads
- **Recent games library** — quick access to your last 6 sessions
- **Gamepad support** — auto-detects controllers, falls back to keyboard seamlessly
- **Fullscreen immersive mode** — one click to lose yourself in the experience
- **Keyboard overlay** — press `P` or `O` anytime to see the control map
- **Glass UI** — frosted panels, smooth transitions, and a design language inspired by modern macOS

## Quick Start

```bash
npm install
npm run dev
```

This boots Next.js on `127.0.0.1:3000` and opens the Electron shell once the dev server is ready.

## Production Build

```bash
npm run build
npm start
```

## Package for Distribution

```bash
# Directory output (for testing)
npm run pack

# Full installer (.dmg, .exe, .AppImage)
npm run dist
```

## Web Deployment

AetherStation exports as a fully static site — no server-side runtime needed.

```bash
npm run build
# Deploy the `out/` directory to Vercel, Netlify, Cloudflare Pages, etc.
```

> When deploying to the web, remove the `assetPrefix` in `next.config.ts` (it's only needed for Electron's relative paths).

## Controls

| Action        | Keyboard    |
|---------------|-------------|
| Move          | Arrow keys  |
| Cross (X)     | Z           |
| Circle (O)    | X           |
| Square        | S           |
| Triangle      | D           |
| L1 / L2       | W / E       |
| R1 / R2       | R / T       |
| Select / Start| C / V       |

Plug in any standard gamepad and it's detected automatically.

## Architecture

```
src/app/          → Next.js frontend (React 19, Tailwind CSS 4)
electron/         → Electron main + preload scripts
public/emulator/  → WASM emulator core + bridge layer
vendor/pcsxjs/    → Bundled pcsxjs WebAssembly build
scripts/          → Build-time asset copy scripts
```

The emulator runs inside an iframe. The bridge layer (`public/emulator/bridge.js`) handles communication between the React shell and the WASM core via `postMessage`. Save data is persisted to IndexedDB through Emscripten's IDBFS, synced every 5 seconds and on tab close.

## Legal

- The emulator itself is legal (see *Sony v. Connectix*, *Sony v. Bleem*)
- No copyrighted BIOS or game files are included
- Users must supply their own legally dumped PS1 disc images
- This project is for educational and preservation purposes

## Tech Stack

- **Runtime**: Electron 40 + Next.js 16 + React 19
- **Styling**: Tailwind CSS 4
- **Emulation**: pcsxjs 0.0.5 (PCSX WebAssembly port)
- **Build**: electron-builder for desktop packaging
- **Export**: Static HTML via `next export` for web deployment

---

*Some nights, all you need is a memory card and a reason to stay up too late.*
