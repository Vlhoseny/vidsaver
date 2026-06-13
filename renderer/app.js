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
    { label: '2160p (4K)', height: 2160 },
    { label: '1440p (2K)', height: 1440 },
    { label: '1080p (Full HD)', height: 1080 },
    { label: '720p (HD)', height: 720 },
    { label: '480p (SD)', height: 480 },
    { label: '360p', height: 360 },
  ],
  mp3: [
    { label: 'Best (320kbps)', quality: '0' },
    { label: 'Medium (192kbps)', quality: '5' },
    { label: 'Standard (128kbps)', quality: '9' },
  ],
}

function estimateSize(formats, type, preset) {
  if (!formats || formats.length === 0) return null
  if (type === 'mp3') {
    const audio = formats.filter(f => f.vcodec === 'none' && f.abr).sort((a, b) => (b.abr || 0) - (a.abr || 0))[0]
    return audio?.filesize || audio?.filesize_approx || null
  }
  const height = preset.height
  const video = formats.filter(f => f.vcodec !== 'none' && f.height && f.height <= height && f.acodec === 'none').sort((a, b) => (b.height || 0) - (a.height || 0))[0]
  const audio = formats.filter(f => f.vcodec === 'none' && f.abr).sort((a, b) => (b.abr || 0) - (a.abr || 0))[0]
  const vs = video?.filesize || video?.filesize_approx || 0
  const as = audio?.filesize || audio?.filesize_approx || 0
  const total = vs + as
  return total > 0 ? total : null
}

function fmtBytes(b) {
  if (!b) return 'Unknown'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let s = b
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++ }
  return `${s.toFixed(1)} ${u[i]}`
}

function fmtDur(s) {
  if (!s) return '00:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

// --- DOM refs ---
const urlInput = document.getElementById('urlInput')
const fetchBtn = document.getElementById('fetchBtn')
const errorBar = document.getElementById('errorBar')
const mainContent = document.getElementById('mainContent')
const emptyState = document.getElementById('emptyState')
const videoList = document.getElementById('videoList')
const selectAll = document.getElementById('selectAll')
const videoCount = document.getElementById('videoCount')
const formatSelect = document.getElementById('formatSelect')
const qualitySelect = document.getElementById('qualitySelect')
const pathBtn = document.getElementById('pathBtn')
const pathDisplay = document.getElementById('pathDisplay')
const totalSize = document.getElementById('totalSize')
const downloadBtn = document.getElementById('downloadBtn')
const cancelBtn = document.getElementById('cancelBtn')
const statusText = document.getElementById('statusText')
const progressContainer = document.getElementById('progressContainer')
const progressBar = document.getElementById('progressBar')
const progressLabel = document.getElementById('progressLabel')
const progressPercent = document.getElementById('progressPercent')
const themeBtn = document.getElementById('themeBtn')
const themeIcon = document.getElementById('themeIcon')
const feedbackBtn = document.getElementById('feedbackBtn')
const bugBtn = document.getElementById('bugBtn')
const presetSelect = document.getElementById('presetSelect')
const savePresetBtn = document.getElementById('savePresetBtn')
const deletePresetBtn = document.getElementById('deletePresetBtn')
const presetNameInput = document.getElementById('presetNameInput')
const presetDialog = document.getElementById('presetDialog')
const presetCancelBtn = document.getElementById('presetCancelBtn')
const presetConfirmBtn = document.getElementById('presetConfirmBtn')
const contextMenu = document.getElementById('contextMenu')
const etaInfo = document.getElementById('etaInfo')
const etaText = document.getElementById('etaText')

let videos = []
let selectedDir = ''
let isDownloading = false
let removeProgressListener = null
let qualityIndex = 0
let presets = []

// --- Config ---
async function loadConfig() {
  const cfg = await window.api.getConfig()
  if (cfg.defaultDir) {
    selectedDir = cfg.defaultDir
    pathDisplay.textContent = cfg.defaultDir
    updateDownloadBtn()
  }
  if (cfg.theme === 'light') {
    document.documentElement.classList.add('light')
    updateThemeIcon()
  }
  if (cfg.presets) {
    presets = cfg.presets
    populatePresets()
  }
}

async function saveConfig(partial) {
  await window.api.saveConfig(partial)
}

// --- Theme ---
function updateThemeIcon() {
  const isLight = document.documentElement.classList.contains('light')
  themeIcon.innerHTML = isLight
    ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
    : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
}

themeBtn.addEventListener('click', () => {
  const html = document.documentElement
  html.classList.toggle('light')
  updateThemeIcon()
  saveConfig({ theme: html.classList.contains('light') ? 'light' : 'dark' })
})

feedbackBtn.addEventListener('click', () => {
  window.api.openUrl('https://github.com/Vlhoseny/vidsaver/issues/new?template=feature_request.md')
})

bugBtn.addEventListener('click', () => {
  window.api.openUrl('https://github.com/Vlhoseny/vidsaver/issues/new')
})

// --- Presets ---
function populatePresets() {
  presetSelect.innerHTML = '<option value="">(none)</option>'
  for (const p of presets) {
    const opt = document.createElement('option')
    opt.value = p.name
    opt.textContent = p.name
    presetSelect.appendChild(opt)
  }
}

function applyPreset(name) {
  const p = presets.find(x => x.name === name)
  if (!p) return
  formatSelect.value = p.format || 'mp4'
  populateQuality()
  if (p.qualityIndex != null) {
    qualityIndex = p.qualityIndex
    qualitySelect.value = p.qualityIndex
  }
  if (p.folder && p.folder !== selectedDir) {
    selectedDir = p.folder
    pathDisplay.textContent = p.folder
  }
  updateSizes()
  updateDownloadBtn()
  deletePresetBtn.classList.toggle('hidden', false)
}

presetSelect.addEventListener('change', () => {
  if (presetSelect.value) {
    applyPreset(presetSelect.value)
  } else {
    deletePresetBtn.classList.add('hidden')
  }
})

savePresetBtn.addEventListener('click', () => {
  presetNameInput.value = ''
  presetDialog.classList.remove('hidden')
  setTimeout(() => presetNameInput.focus(), 100)
})

presetCancelBtn.addEventListener('click', () => {
  presetDialog.classList.add('hidden')
})

presetConfirmBtn.addEventListener('click', () => {
  const name = presetNameInput.value.trim()
  if (!name) return
  const idx = presets.findIndex(p => p.name === name)
  const entry = {
    name,
    format: formatSelect.value,
    qualityIndex,
    folder: selectedDir,
  }
  if (idx >= 0) presets[idx] = entry
  else presets.push(entry)
  presets.sort((a, b) => a.name.localeCompare(b.name))
  populatePresets()
  presetSelect.value = name
  deletePresetBtn.classList.toggle('hidden', false)
  presetDialog.classList.add('hidden')
  saveConfig({ presets })
})

presetNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') presetConfirmBtn.click()
})

deletePresetBtn.addEventListener('click', () => {
  const name = presetSelect.value
  if (!name) return
  presets = presets.filter(p => p.name !== name)
  populatePresets()
  presetSelect.value = ''
  deletePresetBtn.classList.add('hidden')
  saveConfig({ presets })
})

// --- Format/quality ---
function getQualityPreset() {
  return QUALITY_PRESETS[formatSelect.value][qualityIndex]
}

function populateQuality() {
  qualityIndex = 0
  const type = formatSelect.value
  const presets = QUALITY_PRESETS[type]
  qualitySelect.innerHTML = presets.map((p, i) => `<option value="${i}">${p.label}</option>`).join('')
}

formatSelect.addEventListener('change', () => {
  populateQuality()
  updateSizes()
})

qualitySelect.addEventListener('change', () => {
  qualityIndex = parseInt(qualitySelect.value, 10)
  updateSizes()
})

populateQuality()

// --- Fetch ---
fetchBtn.addEventListener('click', fetchVideos)
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchVideos() })

async function fetchVideos() {
  const url = urlInput.value.trim()
  if (!url) return

  setError('')
  fetchBtn.disabled = true
  fetchBtn.innerHTML = '<div class="spinner"></div>'
  mainContent.classList.add('hidden')
  emptyState.classList.add('hidden')

  try {
    const items = await window.api.fetchInfo(url)
    if (!items || items.length === 0) throw new Error('No videos found')

    videos = items.map((item, i) => ({
      id: item.id,
      index: i,
      title: item.title || 'Unknown',
      duration: item.duration || 0,
      thumbnail: getBestThumb(item.thumbnails),
      formats: item.formats || [],
      selected: true,
      status: 'idle',
    }))

    renderList()
    mainContent.classList.remove('hidden')
    updateSizes()
  } catch (err) {
    setError(err.message)
    emptyState.classList.remove('hidden')
  } finally {
    fetchBtn.disabled = false
    fetchBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/></svg> Fetch'
  }
}

function getBestThumb(thumbnails) {
  if (!thumbnails || thumbnails.length === 0) return ''
  return thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || ''
}

// --- Render ---
function renderList() {
  videoList.innerHTML = ''
  const type = formatSelect.value
  const preset = getQualityPreset()

  for (const v of videos) {
    const size = estimateSize(v.formats, type, preset)
    const item = document.createElement('div')
    item.className = `video-item${v.status !== 'idle' ? ' ' + v.status : ''}`
    item.dataset.index = v.index

    const thumb = v.thumbnail
      ? `<img class="video-thumb" src="${v.thumbnail}" alt="" loading="lazy">`
      : `<div class="video-thumb" style="background:var(--surface2)"></div>`

    const sizeText = size ? fmtBytes(size) : ''

    const statusHtml = v.status === 'downloading' ? '<span class="video-status downloading">⏳</span>'
      : v.status === 'done' ? '<span class="video-status done">✓</span>'
      : v.status === 'error' ? '<span class="video-status error">✗</span>' : ''

    item.innerHTML = `
      <input type="checkbox" ${v.selected ? 'checked' : ''} ${v.status !== 'idle' ? 'disabled' : ''}>
      ${thumb}
      <div class="video-info">
        <div class="video-title">${escapeHtml(v.title)}</div>
        <div class="video-meta">
          <span>${fmtDur(v.duration)}</span>
          <span class="video-size">${sizeText}</span>
        </div>
      </div>
      ${statusHtml}
    `

    const cb = item.querySelector('input[type="checkbox"]')
    cb.addEventListener('change', () => {
      v.selected = cb.checked
      updateSelectAllState()
      updateSizes()
    })

    item.addEventListener('contextmenu', (e) => showContextMenu(e, v))

    videoList.appendChild(item)
  }

  updateSelectAllState()
  updateCount()
}

function updateVideoItem(index) {
  const v = videos[index]
  if (!v) return
  const el = videoList.querySelector(`[data-index="${index}"]`)
  if (!el) return
  el.className = `video-item${v.status !== 'idle' ? ' ' + v.status : ''}`
  const cb = el.querySelector('input[type="checkbox"]')
  if (cb) cb.checked = v.selected
  const statusEl = el.querySelector('.video-status')
  if (v.status === 'downloading') {
    if (!statusEl) el.insertAdjacentHTML('beforeend', '<span class="video-status downloading">⏳</span>')
    else { statusEl.className = 'video-status downloading'; statusEl.textContent = '⏳' }
  } else if (v.status === 'done') {
    if (!statusEl) el.insertAdjacentHTML('beforeend', '<span class="video-status done">✓</span>')
    else { statusEl.className = 'video-status done'; statusEl.textContent = '✓' }
  } else if (v.status === 'error') {
    if (!statusEl) el.insertAdjacentHTML('beforeend', '<span class="video-status error">✗</span>')
    else { statusEl.className = 'video-status error'; statusEl.textContent = '✗' }
  } else if (statusEl) {
    statusEl.remove()
  }
}

function escapeHtml(t) {
  const d = document.createElement('div')
  d.textContent = t
  return d.innerHTML
}

function updateSelectAllState() {
  const allSelected = videos.every(v => v.selected || v.status !== 'idle')
  const someSelected = videos.some(v => v.selected)
  selectAll.checked = allSelected
  selectAll.indeterminate = someSelected && !allSelected
}

selectAll.addEventListener('change', () => {
  for (const v of videos) {
    if (v.status === 'idle') v.selected = selectAll.checked
  }
  renderList()
})

// --- Sizes ---
function updateSizes() {
  const type = formatSelect.value
  const preset = getQualityPreset()
  let total = 0
  let hasSize = false

  for (const v of videos) {
    if (!v.selected) continue
    const size = estimateSize(v.formats, type, preset)
    if (size) { total += size; hasSize = true }
  }

  totalSize.textContent = hasSize ? `~${fmtBytes(total)}` : 'Size unknown'
  updateCount()
  updateDownloadBtn()
}

function updateCount() {
  const count = videos.filter(v => v.selected).length
  videoCount.textContent = `${count} / ${videos.length} videos`
}

// --- Path ---
pathBtn.addEventListener('click', async () => {
  const dir = await window.api.selectDir()
  if (dir) {
    selectedDir = dir
    pathDisplay.textContent = dir
    saveConfig({ defaultDir: dir })
    updateDownloadBtn()
  }
})

// --- Context menu ---
let contextVideo = null

function showContextMenu(e, v) {
  e.preventDefault()
  contextVideo = v
  contextMenu.style.left = `${e.clientX}px`
  contextMenu.style.top = `${e.clientY}px`
  contextMenu.classList.remove('hidden')

  const retryItem = contextMenu.querySelector('[data-action="retry"]')
  retryItem.style.display = v.status === 'error' ? '' : 'none'
}

document.addEventListener('click', () => {
  contextMenu.classList.add('hidden')
})

contextMenu.addEventListener('click', (e) => {
  const item = e.target.closest('.ctx-item')
  if (!item) return
  const action = item.dataset.action
  const v = contextVideo
  contextMenu.classList.add('hidden')

  if (action === 'copy-title' && v) {
    navigator.clipboard.writeText(v.title).catch(() => {})
  } else if (action === 'open-browser' && v) {
    window.api.openUrl(`https://www.youtube.com/watch?v=${v.id}`)
  } else if (action === 'retry' && v) {
    v.status = 'idle'
    v.selected = true
    renderList()
  }
})

// --- Download ---
function updateDownloadBtn() {
  const hasVideos = videos.some(v => v.selected)
  const hasPath = !!selectedDir
  downloadBtn.disabled = !(hasVideos && hasPath && !isDownloading)
}

downloadBtn.addEventListener('click', startDownload)
cancelBtn.addEventListener('click', cancelDownload)

async function startDownload() {
  if (isDownloading) return
  const dir = selectedDir
  if (!dir) return

  const selected = videos.filter(v => v.selected)
  if (selected.length === 0) return

  isDownloading = true
  downloadBtn.classList.add('hidden')
  cancelBtn.classList.remove('hidden')
  progressContainer.classList.remove('hidden')
  statusText.textContent = 'Downloading...'
  progressBar.style.width = '0%'
  progressLabel.textContent = 'Preparing...'
  progressPercent.textContent = '0%'

  let completed = 0
  const total = selected.length
  const times = []

  removeProgressListener = window.api.onProgress((data) => {
    const vid = videos.find(v => v.id === data.videoId)
    if (!vid) return
    progressBar.style.width = `${Math.min(data.percent, 99)}%`
    progressPercent.textContent = `${Math.round(data.percent)}%`
    progressLabel.textContent = `${vid.title}`
    statusText.textContent = `${completed} / ${total} ${data.speed ? '· ' + data.speed : ''}`
  })

  for (const v of selected) {
    v.status = 'downloading'
    updateVideoItem(v.index)

    const type = formatSelect.value
    const preset = getQualityPreset()
    const t0 = Date.now()

    const result = await window.api.download(
      `https://www.youtube.com/watch?v=${v.id}`,
      dir, type, preset, v.id
    )

    if (result.success) times.push(Date.now() - t0)

    if (!result.success) {
      v.status = 'error'
      updateVideoItem(v.index)
      if (result.error === 'Download cancelled') {
        statusText.textContent = 'Cancelled'
        break
      }
      const msg = result.error ? result.error.slice(0, 100) : 'Download failed'
      statusText.textContent = `Error: ${msg}`
      setError(`${v.title}: ${msg}`)
    } else {
      v.status = 'done'
      completed++
      const pct = Math.round((completed / total) * 100)
      progressBar.style.width = `${pct}%`
      progressPercent.textContent = `${pct}%`
      progressLabel.textContent = `Done: ${v.title}`
      statusText.textContent = `${completed} / ${total}`
      updateVideoItem(v.index)
      updateEta(completed, total, times)
    }
  }

  finishDownload()
}

function updateEta(completed, total, times) {
  if (completed <= 0 || times.length === 0) {
    etaInfo.classList.add('hidden')
    return
  }
  const remaining = total - completed
  if (remaining <= 0) {
    etaInfo.classList.add('hidden')
    return
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const estMs = avg * remaining
  const estSec = Math.round(estMs / 1000)
  let text
  if (estSec >= 60) {
    text = `ETA ~${Math.round(estSec / 60)}m ${estSec % 60}s`
  } else {
    text = `ETA ~${estSec}s`
  }
  etaText.textContent = text
  etaInfo.classList.remove('hidden')
}

function finishDownload() {
  isDownloading = false
  downloadBtn.classList.remove('hidden')
  cancelBtn.classList.add('hidden')
  etaInfo.classList.add('hidden')

  const done = videos.filter(v => v.status === 'done').length
  const failed = videos.filter(v => v.status === 'error').length
  if (failed === 0) {
    statusText.textContent = 'All done!'
    progressLabel.textContent = `Saved to: ${selectedDir}`
    window.api.notify('VidSaver', `All ${done} downloads complete!`)
  } else {
    statusText.textContent = `${done} done, ${failed} failed`
    progressLabel.textContent = 'Some downloads failed'
    window.api.notify('VidSaver', `${done} downloaded, ${failed} failed`)
  }

  setTimeout(() => {
    progressContainer.classList.add('hidden')
    statusText.textContent = ''
  }, 8000)

  if (removeProgressListener) {
    removeProgressListener()
    removeProgressListener = null
  }
  updateDownloadBtn()
}

async function cancelDownload() {
  await window.api.cancelAll()
  isDownloading = false
  downloadBtn.classList.remove('hidden')
  cancelBtn.classList.add('hidden')
  statusText.textContent = 'Cancelled'
  progressLabel.textContent = 'Downloads cancelled'
  etaInfo.classList.add('hidden')

  if (removeProgressListener) {
    removeProgressListener()
    removeProgressListener = null
  }
  updateDownloadBtn()
}

// --- Error ---
function setError(msg) {
  errorBar.textContent = msg
  errorBar.classList.toggle('hidden', !msg)
}

// --- Init ---
loadConfig()
