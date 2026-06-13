# VidSaver

Download YouTube playlists and videos — MP4, MKV, or MP3 with full quality control.

## Features

- **Playlist support** — fetch all videos, select individual ones with checkboxes
- **Format options** — MP4 (h264+AAC), MKV (any codec), MP3 audio
- **Quality presets** — 360p to 4K for video, 128kbps to 320kbps for audio
- **Dark/light/OLED themes** — persists across sessions
- **Batch ETA** — estimated time remaining for multi-video downloads
- **Resume support** — interrupted downloads pick up where they left off
- **System notifications** — desktop notification on batch completion
- **Context menu** — copy title, open in browser, retry failed, cancel individual items
- **Search/filter** — filter playlist by title in real time
- **Keyboard shortcuts** — Ctrl+A select all, Delete remove, Ctrl+F search
- **Stats dashboard** — total downloads, active/queued counts
- **Drag-reorder queue** — reorder queued downloads by dragging
- **Clipboard monitoring** — auto-detect YouTube URLs copied to clipboard
- **Auto-updater** — checks for new releases on startup
- **Portable build** — single `.zip`, no Node.js or npm needed to run

## Download (no build needed)

Download the latest portable build from [GitHub Releases](https://github.com/Vlhoseny/vidsaver/releases):

1. Download `VidSaver-*-portable.zip`
2. Extract anywhere
3. Run `VidSaver.exe`

> Windows SmartScreen may block the unsigned `.exe` — click **More info** → **Run anyway**.

## Development

### Requirements

- [Node.js](https://nodejs.org/) 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (`pip install yt-dlp`)
- ffmpeg (bundled automatically)

### Setup

```bash
npm install
npm start        # run in development mode
npm run dev      # run with dev tools open
```

### Build Portable

```bash
npm run build          # pack Electron app to dist/
npm run build:portable # pack + create portable .zip
```

Output in `dist/VidSaver-win32-x64/` — run `VidSaver.exe` directly.

## Tech Stack

- **Electron 33** — cross-platform desktop shell
- **yt-dlp** — video/audio download engine
- **ffmpeg** — stream merging and remuxing
- **Vanilla JS** — no framework, lightweight renderer

## Notes

- **MP4** uses h264 video + AAC audio (universally compatible, max 1080p h264 on YouTube). DASH downloads show two sequential progress bars (video then audio) then merge into one file.
- **MKV** uses best available video + audio codecs (VP9/AV1/opus), supports up to 4K/8K. Files use `.mkv` extension.
- **MP3** extracts audio only, transcoded to MP3 at your chosen quality.
- GitHub Releases hosts the portable `.zip`. The raw `.exe` exceeds GitHub's 100MB file limit, so it's distributed inside a zip archive.
