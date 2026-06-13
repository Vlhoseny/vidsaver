const QUALITY_PRESETS = {
  mp4: [
    { label: '2160p (4K)', height: 2160 },
    { label: '1440p (2K)', height: 1440 },
    { label: '1080p (Full HD)', height: 1080 },
    { label: '720p (HD)', height: 720 },
    { label: '480p (SD)', height: 480 },
    { label: '360p', height: 360 },
  ],
  mkv: [
    { label: 'Best Available', height: 2160 },
  ],
  mp3: [
    { label: 'Best (320kbps)', quality: '0' },
    { label: 'Medium (192kbps)', quality: '5' },
    { label: 'Standard (128kbps)', quality: '9' },
  ],
}

function getFormatString(type, preset) {
  if (type === 'mp3') return 'bestaudio/best'
  if (type === 'mkv') {
    return 'bestvideo+bestaudio/best'
  }

  const heights = [2160, 1440, 1080, 720, 480, 360]
  const idx = heights.indexOf(preset.height)
  if (idx === -1) return `bestvideo[height<=1080][vcodec*=avc1]+bestaudio[acodec*=mp4a]/best[height<=1080]`

  const options = heights.slice(idx).map(h =>
    `bestvideo[height<=${h}][vcodec*=avc1]+bestaudio[acodec*=mp4a]`
  )
  options.push('best[height<=2160]')
  return options.join('/')
}

function estimateSize(formats, type, preset) {
  if (!formats || formats.length === 0) return null

  if (type === 'mp3') {
    const audio = formats
      .filter(f => f.vcodec === 'none' && f.abr)
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0]
    return audio?.filesize || audio?.filesize_approx || null
  }

  let maxHeight = preset.height
  if (type === 'mkv') {
    const best = formats
      .filter(f => f.vcodec !== 'none' && f.height)
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0]
    maxHeight = best?.height || 2160
  }

  const video = formats
    .filter(f => f.vcodec !== 'none' && f.height && f.height <= maxHeight && f.acodec === 'none')
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0]
  const audio = formats
    .filter(f => f.vcodec === 'none' && f.abr)
    .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0]

  const videoSize = video?.filesize || video?.filesize_approx || 0
  const audioSize = audio?.filesize || audio?.filesize_approx || 0
  const total = videoSize + audioSize
  return total > 0 ? total : null
}

function formatBytes(bytes) {
  if (!bytes) return 'Unknown'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

function formatDuration(seconds) {
  if (!seconds) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

module.exports = { QUALITY_PRESETS, getFormatString, estimateSize, formatBytes, formatDuration }