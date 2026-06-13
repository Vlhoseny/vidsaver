# VidSaver

Download YouTube playlists and videos — MP4, MKV, or MP3 with full quality control.

## Features

- **Playlist support** — fetch all videos, select individual ones with checkboxes
- **Format options** — MP4 (h264+AAC), MKV (any codec), MP3 audio
- **Quality presets** — 360p to 4K for video, 128kbps to 320kbps for audio
- **Preset profiles** — save format/quality/folder combos for quick reuse
- **Dark/light theme** — persists across sessions
- **Batch ETA** — estimated time remaining for multi-video downloads
- **Resume support** — interrupted downloads pick up where they left off
- **System notifications** — desktop notification on batch completion
- **Context menu** — copy title, open in browser, retry failed items
- **Portable build** — single `.zip`, no Node.js or npm needed to run

## Quick Start

```bash
npm install
npm start
```

## Build Portable

```bash
npm run build:portable
```

Output in `dist/VidSaver-win32-x64/` — run `VidSaver.exe` directly.

## Requirements

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (install via `pip install yt-dlp`)
- [Node.js](https://nodejs.org/) 18+ (only needed for development/building)
