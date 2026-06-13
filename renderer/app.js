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

function sanitizeFolder(name) {
  if (!name) return ''
  return name.replace(/[<>:"/\\|?*]/g, '_').trim().slice(0, 100)
}

// --- DOM refs ---
const urlInput = document.getElementById('urlInput')
const urlHistory = document.getElementById('urlHistory')
const fetchBtn = document.getElementById('fetchBtn')
const errorBar = document.getElementById('errorBar')
const mainContent = document.getElementById('mainContent')
const emptyState = document.getElementById('emptyState')
const videoList = document.getElementById('videoList')
const searchInput = document.getElementById('searchInput')
const selectAll = document.getElementById('selectAll')
const videoCount = document.getElementById('videoCount')
const formatSelect = document.getElementById('formatSelect')
const qualitySelect = document.getElementById('qualitySelect')
const subsCheck = document.getElementById('subsCheck')
const concurrentSelect = document.getElementById('concurrentSelect')
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
const statsBtn = document.getElementById('statsBtn')
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
const updateBanner = document.getElementById('updateBanner')
const updateText = document.getElementById('updateText')
const updateLink = document.getElementById('updateLink')
const updateDismiss = document.getElementById('updateDismiss')
const statsDialog = document.getElementById('statsDialog')
const statsCloseBtn = document.getElementById('statsCloseBtn')
const statTotalVideos = document.getElementById('statTotalVideos')
const statTotalSize = document.getElementById('statTotalSize')
const statSessionCount = document.getElementById('statSessionCount')
const statDownloads = document.getElementById('statDownloads')

let videos = []
let selectedDir = ''
let isDownloading = false
let removeProgressListener = null
let qualityIndex = 0
let presets = []
let urlHistoryList = []
let filterText = ''
let playlistTitle = ''
let activeDownloads = new Set()
let downloadStats = { totalVideos: 0, totalSize: 0, sessionCount: 0 }
let progressData = new Map()

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
  } else if (cfg.theme === 'oled') {
    document.documentElement.classList.add('oled')
    updateThemeIcon()
  }
  if (cfg.presets) {
    presets = cfg.presets
    populatePresets()
  }
  if (cfg.urlHistory) {
    urlHistoryList = cfg.urlHistory
    populateUrlHistory()
  }
  if (cfg.downloadStats) {
    downloadStats = cfg.downloadStats
  }
}

async function saveConfig(partial) {
  await window.api.saveConfig(partial)
}

// --- Theme ---
const THEMES = ['dark', 'light', 'oled']
function getCurrentTheme() {
  const el = document.documentElement
  if (el.classList.contains('oled')) return 'oled'
  if (el.classList.contains('light')) return 'light'
  return 'dark'
}

function updateThemeIcon() {
  const t = getCurrentTheme()
  if (t === 'light') {
    themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
  } else if (t === 'oled') {
    themeIcon.innerHTML = '<circle cx="12" cy="12" r="5" fill="currentColor"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
  } else {
    themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
  }
}

function cycleTheme() {
  const cur = getCurrentTheme()
  const nextIdx = (THEMES.indexOf(cur) + 1) % THEMES.length
  const next = THEMES[nextIdx]
  const el = document.documentElement
  el.classList.remove('light', 'oled')
  if (next !== 'dark') el.classList.add(next)
  updateThemeIcon()
  saveConfig({ theme: next })
}

themeBtn.addEventListener('click', cycleTheme)

feedbackBtn.addEventListener('click', () => {
  window.api.openUrl('https://github.com/Vlhoseny/vidsaver/issues/new?template=feature_request.md')
})

bugBtn.addEventListener('click', () => {
  window.api.openUrl('https://github.com/Vlhoseny/vidsaver/issues/new')
})

// --- URL History ---
function populateUrlHistory() {
  urlHistory.innerHTML = urlHistoryList.map(u => `<option value="${u.replace(/"/g, '&quot;')}">`).join('')
}

function addUrlToHistory(url) {
  if (!url) return
  urlHistoryList = urlHistoryList.filter(u => u !== url)
  urlHistoryList.unshift(url)
  if (urlHistoryList.length > 20) urlHistoryList = urlHistoryList.slice(0, 20)
  populateUrlHistory()
  saveConfig({ urlHistory: urlHistoryList })
}

// --- Stats ---
function updateStatsDisplay() {
  statTotalVideos.textContent = downloadStats.totalVideos || 0
  statTotalSize.textContent = fmtBytes(downloadStats.totalSize || 0)
  statSessionCount.textContent = downloadStats.sessionCount || 0
  statDownloads.textContent = (downloadStats.sessionDownloads || 0)
}

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
  const qps = QUALITY_PRESETS[type]
  qualitySelect.innerHTML = qps.map((p, i) => `<option value="${i}">${p.label}</option>`).join('')
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

// --- Search ---
searchInput.addEventListener('input', () => {
  filterText = searchInput.value.trim().toLowerCase()
  applyFilter()
})

function applyFilter() {
  for (const v of videos) {
    const el = videoList.querySelector(`[data-index="${v.index}"]`)
    if (!el) continue
    const match = !filterText || v.title.toLowerCase().includes(filterText)
    el.classList.toggle('filtered-out', !match && v.status === 'idle')
  }
}

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

    playlistTitle = items[0]?.playlist_title || ''
    addUrlToHistory(url)

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
    if (filterText && !v.title.toLowerCase().includes(filterText) && v.status === 'idle') {
      item.classList.add('filtered-out')
    }
    item.dataset.index = v.index

    const thumb = v.thumbnail
      ? `<img class="video-thumb" src="${v.thumbnail}" alt="" loading="lazy">`
      : `<div class="video-thumb" style="background:var(--surface2)"></div>`

    const sizeText = size ? fmtBytes(size) : ''

    let statusHtml = ''
    if (v.status === 'downloading') {
      const pct = progressData.get(v.id)?.percent || 0
      statusHtml = `<span class="video-status downloading">${Math.round(pct)}%</span>`
    } else if (v.status === 'done') {
      statusHtml = '<span class="video-status done">&#10003;</span>'
    } else if (v.status === 'error') {
      statusHtml = '<span class="video-status error">&#10007;</span>'
    } else if (v.status === 'cancelled') {
      statusHtml = '<span class="video-status error">&#10007;</span>'
    }

    const cancelOneHtml = v.status === 'downloading'
      ? '<button class="cancel-one-btn" title="Cancel this download">&times;</button>'
      : ''

    item.innerHTML = `
      <input type="checkbox" ${v.selected ? 'checked' : ''} ${v.status !== 'idle' && v.status !== 'cancelled' ? 'disabled' : ''}>
      ${thumb}
      <div class="video-info">
        <div class="video-title">${escapeHtml(v.title)}</div>
        <div class="video-meta">
          <span>${fmtDur(v.duration)}</span>
          <span class="video-size">${sizeText}</span>
        </div>
      </div>
      ${statusHtml}
      ${cancelOneHtml}
    `

    const cb = item.querySelector('input[type="checkbox"]')
    cb.addEventListener('change', () => {
      v.selected = cb.checked
      updateSelectAllState()
      updateSizes()
    })

    const cancelBtnEl = item.querySelector('.cancel-one-btn')
    if (cancelBtnEl) {
      cancelBtnEl.addEventListener('click', (e) => {
        e.stopPropagation()
        cancelOneDownload(v)
      })
    }

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
  if (filterText && !v.title.toLowerCase().includes(filterText) && v.status === 'idle') {
    el.classList.add('filtered-out')
  }
  const cb = el.querySelector('input[type="checkbox"]')
  if (cb) cb.checked = v.selected
  const statusEl = el.querySelector('.video-status')
  const cancelBtnEl = el.querySelector('.cancel-one-btn')

  if (v.status === 'downloading') {
    const pct = progressData.get(v.id)?.percent || 0
    if (!statusEl) el.insertAdjacentHTML('beforeend', `<span class="video-status downloading">${Math.round(pct)}%</span>`)
    else { statusEl.className = 'video-status downloading'; statusEl.textContent = `${Math.round(pct)}%` }
    if (!cancelBtnEl) el.insertAdjacentHTML('beforeend', '<button class="cancel-one-btn" title="Cancel this download">&times;</button>')
  } else if (v.status === 'done') {
    if (!statusEl) el.insertAdjacentHTML('beforeend', '<span class="video-status done">&#10003;</span>')
    else { statusEl.className = 'video-status done'; statusEl.textContent = '&#10003;' }
    if (cancelBtnEl) cancelBtnEl.remove()
  } else if (v.status === 'error' || v.status === 'cancelled') {
    if (!statusEl) el.insertAdjacentHTML('beforeend', '<span class="video-status error">&#10007;</span>')
    else { statusEl.className = 'video-status error'; statusEl.textContent = '&#10007;' }
    if (cancelBtnEl) cancelBtnEl.remove()
  } else if (statusEl) {
    statusEl.remove()
    if (cancelBtnEl) cancelBtnEl.remove()
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
  retryItem.style.display = v.status === 'error' || v.status === 'cancelled' ? '' : 'none'
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
  const hasVideos = videos.some(v => v.selected && (v.status === 'idle' || v.status === 'cancelled'))
  const hasPath = !!selectedDir
  downloadBtn.disabled = !(hasVideos && hasPath && !isDownloading)
}

downloadBtn.addEventListener('click', startDownload)
cancelBtn.addEventListener('click', cancelAllDownloads)

async function startDownload() {
  if (isDownloading) return
  const dir = selectedDir
  if (!dir) return

  const items = videos.filter(v => v.selected && (v.status === 'idle' || v.status === 'cancelled'))
  if (items.length === 0) return

  isDownloading = true
  downloadBtn.classList.add('hidden')
  cancelBtn.classList.remove('hidden')
  progressContainer.classList.remove('hidden')
  statusText.textContent = 'Downloading...'
  progressBar.style.width = '0%'
  progressLabel.textContent = 'Preparing...'
  progressPercent.textContent = '0%'

  activeDownloads = new Set()
  progressData = new Map()

  const subs = subsCheck.checked
  const maxConc = parseInt(concurrentSelect.value, 10)
  const type = formatSelect.value
  const preset = getQualityPreset()
  const usePlaylistFolder = playlistTitle && items.length > 1
  const baseDir = usePlaylistFolder ? dir : ''
  let playlistDir = ''

  if (usePlaylistFolder) {
    playlistDir = sanitizeFolder(playlistTitle)
  }

  let totalCompleted = 0
  const totalItems = items.length
  const times = []

  removeProgressListener = window.api.onProgress((data) => {
    progressData.set(data.videoId, data)
    const vid = videos.find(v => v.id === data.videoId)
    if (vid) updateVideoItem(vid.index)
    const allPcts = [...progressData.values()].map(p => p.percent)
    const avgPct = allPcts.length > 0 ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length : 0
    progressBar.style.width = `${Math.min(avgPct, 99)}%`
    progressPercent.textContent = `${Math.round(avgPct)}%`
    const activeVid = videos.find(v => activeDownloads.has(v.id))
    progressLabel.textContent = activeVid ? activeVid.title : '...'
    statusText.textContent = `${totalCompleted} / ${totalItems} ${data.speed ? '· ' + data.speed : ''}`
  })

  const trackSize = (v) => {
    const s = estimateSize(v.formats, type, preset)
    if (s) downloadStats.totalSize = (downloadStats.totalSize || 0) + s
  }

  async function worker() {
    while (true) {
      const v = items.find(x => x.status === 'idle' || x.status === 'cancelled')
      if (!v) break
      activeDownloads.add(v.id)
      v.status = 'downloading'
      updateVideoItem(v.index)

      const outputDir = usePlaylistFolder
        ? baseDir + '\\' + playlistDir
        : dir

      const t0 = Date.now()
      const result = await window.api.download(
        `https://www.youtube.com/watch?v=${v.id}`,
        outputDir, type, preset, v.id, subs
      )

      activeDownloads.delete(v.id)

      if (!result.success) {
        if (result.error === 'Download cancelled') {
          v.status = 'cancelled'
        } else {
          v.status = 'error'
          const msg = result.error ? result.error.slice(0, 100) : 'Download failed'
          setError(`${v.title}: ${msg}`)
        }
        updateVideoItem(v.index)
      } else {
        v.status = 'done'
        times.push(Date.now() - t0)
        trackSize(v)
        totalCompleted++
        updateVideoItem(v.index)
        updateEta(totalCompleted, totalItems, times)
        const pct = Math.round((totalCompleted / totalItems) * 100)
        progressBar.style.width = `${pct}%`
        progressPercent.textContent = `${pct}%`
        progressLabel.textContent = `Done: ${v.title}`
        statusText.textContent = `${totalCompleted} / ${totalItems}`
      }
    }
  }

  const workerCount = Math.min(maxConc, items.length)
  const workers = []
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker())
  }
  await Promise.all(workers)

  finishDownload()
}

async function cancelOneDownload(v) {
  if (!v || v.status !== 'downloading') return
  await window.api.cancelOne(v.id)
  v.status = 'cancelled'
  activeDownloads.delete(v.id)
  updateVideoItem(v.index)
}

async function cancelAllDownloads() {
  await window.api.cancelAll()
  for (const v of videos) {
    if (v.status === 'downloading') v.status = 'cancelled'
  }
  activeDownloads.clear()
  isDownloading = false
  downloadBtn.classList.remove('hidden')
  cancelBtn.classList.add('hidden')
  statusText.textContent = 'Cancelled'
  progressLabel.textContent = 'Downloads cancelled'
  etaInfo.classList.add('hidden')
  renderList()

  if (removeProgressListener) {
    removeProgressListener()
    removeProgressListener = null
  }
  updateDownloadBtn()
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
  downloadStats.totalVideos = (downloadStats.totalVideos || 0) + done
  downloadStats.sessionDownloads = (downloadStats.sessionDownloads || 0) + done
  downloadStats.sessionCount = (downloadStats.sessionCount || 0) + 1
  saveConfig({ downloadStats })

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

// --- Auto-updater ---
async function checkForUpdate() {
  try {
    const data = await window.api.checkUpdate()
    if (!data || !data.version) return
    const current = 'v1.1.0'
    if (data.version.replace(/^v/i, '') > current.replace(/^v/i, '')) {
      updateText.textContent = `New version ${data.version} available!`
      updateLink.href = data.url
      updateLink.textContent = 'Download'
      updateBanner.classList.remove('hidden')
    }
  } catch {}
}

updateDismiss.addEventListener('click', () => {
  updateBanner.classList.add('hidden')
})

// --- Stats dialog ---
statsBtn.addEventListener('click', () => {
  updateStatsDisplay()
  statsDialog.classList.remove('hidden')
})

statsCloseBtn.addEventListener('click', () => {
  statsDialog.classList.add('hidden')
})

statsDialog.addEventListener('click', (e) => {
  if (e.target === statsDialog) statsDialog.classList.add('hidden')
})

// --- Keyboard shortcuts ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!presetDialog.classList.contains('hidden')) presetDialog.classList.add('hidden')
    if (!statsDialog.classList.contains('hidden')) statsDialog.classList.add('hidden')
    if (!contextMenu.classList.contains('hidden')) contextMenu.classList.add('hidden')
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    fetchVideos()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault()
    if (!downloadBtn.disabled) startDownload()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    searchInput.focus()
    searchInput.select()
    return
  }
})

// --- Cancel-one button styling ---
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  .cancel-one-btn {
    background: none;
    border: none;
    color: var(--danger);
    font-size: 16px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    flex-shrink: 0;
  }
  .cancel-one-btn:hover {
    background: rgba(239,68,68,0.15);
  }
`
document.head.appendChild(styleSheet)

// --- Error ---
function setError(msg) {
  errorBar.textContent = msg
  errorBar.classList.toggle('hidden', !msg)
}

// --- Init ---
loadConfig()
setTimeout(checkForUpdate, 3000)
