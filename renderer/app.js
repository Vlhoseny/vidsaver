const $ = (s) => document.querySelector(s)
const $$ = (s) => document.querySelectorAll(s)

let videoList = []
let downloading = new Map()
let activeCount = 0
let totalVideos = 0
let totalBytes = 0
let completedBytes = 0
let qualityPresets = []
let sampleFormats = []
let queue = []
let dragState = null
let clipboardInterval = null
let clipboardActive = false
let imageCache = new Map()

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

const API = window.api

function setupActionListeners() {
  $('#fetchBtn').addEventListener('click', fetchPlaylist)
  $('#urlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchPlaylist()
  })
  $('#downloadBtn').addEventListener('click', startDownload)
  $('#cancelBtn').addEventListener('click', cancelAll)
  $('#selectAll').addEventListener('change', (e) => {
    const checked = e.target.checked
    videoList.forEach(v => { v._selected = checked })
    renderPlaylist()
  })
  $('#retryFailedBtn').addEventListener('click', retryAllFailed)
  $('#pathBtn').addEventListener('click', async () => {
    const dir = await API.selectDir()
    if (dir) {
      $('#pathDisplay').textContent = dir
      API.saveConfig({ defaultDir: dir })
    }
  })
  $('#themeBtn').addEventListener('click', cycleTheme)
  $('#clipboardBtn').addEventListener('click', () => {
    clipboardActive = !clipboardActive
    API.saveConfig({ clipboardMonitor: clipboardActive })
    updateClipboardIndicator()
    if (clipboardActive) startClipboardPoll()
    else stopClipboardPoll()
  })
  $('#statsBtn').addEventListener('click', showStatsDialog)
  $('#feedbackBtn').addEventListener('click', () => API.openUrl('https://github.com/Vlhoseny/vidsaver/issues/new'))
  $('#bugBtn').addEventListener('click', () => API.openUrl('https://github.com/Vlhoseny/vidsaver/issues/new'))
}

function setupContextMenu() {
  $('#videoList').addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.video-item')
    if (!item) return
    e.preventDefault()
    const menu = $('#contextMenu')
    menu.style.left = e.clientX + 'px'
    menu.style.top = e.clientY + 'px'
    menu.classList.remove('hidden')
    menu._videoId = item.dataset.id
  })
  document.addEventListener('click', () => {
    $('#contextMenu').classList.add('hidden')
  })
  document.querySelectorAll('.ctx-item').forEach(el => {
    el.addEventListener('click', () => {
      const menu = $('#contextMenu')
      const id = menu._videoId
      const action = el.dataset.action
      menu.classList.add('hidden')
      if (!id) return
      if (action === 'copy-title') {
        const v = videoList.find(x => x.id === id)
        if (v) navigator.clipboard.writeText(v.title)
      } else if (action === 'open-browser') {
        API.openUrl(`https://www.youtube.com/watch?v=${id}`)
      } else if (action === 'retry') {
        retryVideo(id)
      }
    })
  })
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('#contextMenu').classList.add('hidden')
      document.querySelectorAll('.dialog-overlay:not(.hidden)').forEach(d => d.classList.add('hidden'))
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      $('#searchInput').focus()
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      setTimeout(fetchPlaylist, 100)
    }
  })
}

function showStatsDialog() {
  const stats = loadStats()
  const vids = stats.totalVideos || 0
  const size = stats.totalSize || 0
  const sess = stats.sessionCount || 0
  const dls = stats.downloads || 0
  $('#statTotalVideos').textContent = formatCount(vids)
  $('#statTotalSize').textContent = formatBytes(size)
  $('#statSessionCount').textContent = formatCount(sess)
  $('#statDownloads').textContent = formatCount(dls)
  $('#statsDialog').classList.remove('hidden')
}

async function checkForUpdate() {
  try {
    const info = await API.checkUpdate()
    if (info && info.hasUpdate) {
      $('#updateVersionName').textContent = info.version || ''
      $('#updateBanner').classList.remove('hidden')
      $('#updateShowBtn').onclick = () => {
        $('#updateDialog').classList.remove('hidden')
      }
      $('#updateDismiss').onclick = () => {
        $('#updateBanner').classList.add('hidden')
      }
      $('#updateGoBtn').onclick = () => {
        API.openUrl(info.url || 'https://github.com/Vlhoseny/vidsaver/releases')
      }
      $('#updateLaterBtn').onclick = () => {
        $('#updateDialog').classList.add('hidden')
      }
    }
  } catch {
    /* silent */
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  loadTheme()
  await loadConfig()
  setupFormatListeners()
  setupQualityDropdown('mp4')
  setupActionListeners()
  setupContextMenu()
  setupKeyboardShortcuts()
  setupSearch()
  setupStats()
  setupDialogs()
  setupClipboard()
  setupDragReorder()
  checkForUpdate()
})

function loadTheme() {
  const saved = localStorage.getItem('vidsaver-theme') || 'dark'
  document.documentElement.setAttribute('data-theme', saved)
  updateThemeIcon(saved)
}

function cycleTheme() {
  const cur = document.documentElement.getAttribute('data-theme')
  const next = cur === 'dark' ? 'light' : cur === 'light' ? 'oled' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('vidsaver-theme', next)
  updateThemeIcon(next)
}

function updateThemeIcon(theme) {
  const icon = $('#themeIcon')
  if (theme === 'dark') {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`
  } else if (theme === 'light') {
    icon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
  } else {
    icon.innerHTML = `<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z"/>`
  }
}

async function loadConfig() {
  const cfg = await API.getConfig()
  if (cfg.defaultDir) {
    $('#pathDisplay').textContent = cfg.defaultDir
  }
  if (cfg.clipboardMonitor !== undefined) {
    clipboardActive = cfg.clipboardMonitor
    updateClipboardIndicator()
  }
  if (cfg.format) {
    $('#formatSelect').value = cfg.format
    setupQualityDropdown(cfg.format)
  }
  if (cfg.quality !== undefined) {
    const qs = $('#qualitySelect')
    if (qs.options[cfg.quality]) {
      qs.selectedIndex = cfg.quality
    }
  }
}

function loadStats() {
  try {
    const raw = localStorage.getItem('vidsaver-stats')
    return raw ? JSON.parse(raw) : { totalVideos: 0, totalSize: 0, sessionCount: 0, downloads: 0 }
  } catch {
    return { totalVideos: 0, totalSize: 0, sessionCount: 0, downloads: 0 }
  }
}

function saveStats(stats) {
  localStorage.setItem('vidsaver-stats', JSON.stringify(stats))
}

function setupFormatListeners() {
  $('#formatSelect').addEventListener('change', () => {
    const fmt = $('#formatSelect').value
    setupQualityDropdown(fmt)
    API.saveConfig({ format: fmt })
    updateSizeEstimate()
  })
  $('#qualitySelect').addEventListener('change', () => {
    API.saveConfig({ quality: $('#qualitySelect').selectedIndex })
    updateSizeEstimate()
  })
}

function setupQualityDropdown(format) {
  const qs = $('#qualitySelect')
  qs.innerHTML = ''
  const list = QUALITY_PRESETS[format] || []
  list.forEach((p, i) => {
    const opt = document.createElement('option')
    opt.value = String(p.height ?? p.quality ?? '')
    opt.textContent = p.label
    if (i === 0) opt.selected = true
    qs.appendChild(opt)
  })
  qualityPresets = list
}

function getFormatAndPreset() {
  const fmt = $('#formatSelect').value
  const idx = $('#qualitySelect').selectedIndex
  const preset = qualityPresets[idx]
  return { format: fmt, preset, qualityIndex: idx }
}

function updateSizeEstimate() {
  if (totalBytes <= 0) {
    $('#totalSize').textContent = 'Estimating...'
    return
  }
  const done = completedBytes
  const remaining = Math.max(0, totalBytes - done)
  if (remaining > 0 && done > 0) {
    $('#totalSize').textContent = `~${formatBytes(remaining)} remaining of ${formatBytes(totalBytes)}`
  } else {
    $('#totalSize').textContent = `~${formatBytes(totalBytes)}`
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024; i++
  }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

function formatDuration(sec) {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function estimateSize(format, presetValue, duration) {
  if (format === 'mp3') {
    const bitrates = { 0: 320, 5: 192, 9: 128 }
    const bitrate = bitrates[presetValue] || 128
    return (bitrate * 1000 * (duration || 180)) / 8
  }
  const MBperSec = { 360: 0.1, 480: 0.2, 720: 0.5, 1080: 1.2, 1440: 2.0, 2160: 4.0 }
  const mbps = MBperSec[presetValue] || 1.0
  return mbps * 1024 * 1024 * (duration || 180)
}

async function fetchPlaylist() {
  const url = $('#urlInput').value.trim()
  if (!url) { showError('Please enter a URL'); return }

  $('#fetchBtn').disabled = true
  $('#fetchBtn').textContent = 'Fetching...'
  hideError()

  try {
      const data = await API.fetchInfo(url)
      if (!data || !Array.isArray(data) || data.length === 0) {
        showError('Could not fetch playlist info. Check the URL and try again.')
        $('#fetchBtn').disabled = false
        $('#fetchBtn').textContent = 'Fetch'
        return
      }

      addToHistory(url)
      videoList = data.filter(e => e && e.id)
      totalVideos = videoList.length
      queue = videoList.map(v => v.id)
      completedBytes = 0
      totalBytes = 0
      sampleFormats = []

    const firstId = videoList[0]?.id
    if (firstId) {
      try {
        const details = await API.fetchDetails(firstId)
        if (details && details.formats) {
          sampleFormats = details.formats
        }
      } catch {}
    }

    setupQualityDropdown($('#formatSelect').value)

    videoList.forEach(v => {
      const idx = $('#qualitySelect').selectedIndex
      const sel = qualityPresets[idx]
      const val = sel?.height ?? 720
      const size = estimateSize(
        $('#formatSelect').value,
        val,
        v.duration
      )
      v.estimatedSize = size
      totalBytes += size
    })

    renderPlaylist()
    $('#mainContent').classList.remove('hidden')
    $('#emptyState').classList.add('hidden')
    $('.main-area').classList.remove('empty')
    updateSizeEstimate()
    $('#downloadBtn').disabled = false
  } catch (err) {
    showError(err.message || 'Failed to fetch playlist')
  } finally {
    $('#fetchBtn').disabled = false
    $('#fetchBtn').textContent = 'Fetch'
  }
}

function renderPlaylist() {
  const list = $('#videoList')
  list.innerHTML = ''
  const filter = $('#searchInput').value.toLowerCase().trim()
  const shown = filter ? videoList.filter(v => (v.title || '').toLowerCase().includes(filter)) : videoList

  shown.forEach((v) => {
    const downloadState = downloading.get(v.id)
    const status = downloadState?.status || 'idle'
    const paused = downloadState?.paused || false

    const item = document.createElement('div')
    item.className = `video-item ${status !== 'idle' ? status : ''} ${paused ? 'paused' : ''}`
    if (v._failed) item.classList.add('error')
    item.dataset.videoId = v.id

    const dragHandle = document.createElement('div')
    dragHandle.className = 'drag-handle'
    dragHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>`

    const check = document.createElement('input')
    check.type = 'checkbox'
    check.className = 'video-check'
    check.checked = v._selected !== false && !v._failed
    check.addEventListener('change', () => {
      v._selected = check.checked
      updateSelectAllState()
    })

    const thumb = document.createElement('div')
    thumb.className = 'thumb-wrap'
    const img = document.createElement('img')
    const cached = imageCache.get(v.id)
    if (cached) {
      img.src = cached
    } else {
      img.src = v.thumbnail || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`
      img.onload = () => imageCache.set(v.id, img.src)
      img.onerror = () => { img.src = ''; img.style.display = 'none' }
    }
    img.alt = v.title || ''
    img.loading = 'lazy'
    thumb.appendChild(img)

    const info = document.createElement('div')
    info.className = 'video-info'
    info.innerHTML = `
      <div class="video-title">${escapeHtml(v.title || 'Unknown')}</div>
      <div class="video-meta">
        <span>${v.channel || ''}</span>
        ${v.duration ? `<span>${formatDuration(v.duration)}</span>` : ''}
        ${v.view_count ? `<span>${formatCount(v.view_count)} views</span>` : ''}
      </div>
      <div class="video-size">${formatBytes(v.estimatedSize || 0)}</div>
    `

    const statusEl = document.createElement('div')
    statusEl.className = `video-status ${status !== 'idle' ? status : (v._failed ? 'error' : 'idle')}`
    if (downloadState) {
      statusEl.textContent = paused ? 'Paused' : downloadState.percent ? `${downloadState.percent}%` : status
    } else if (v._failed) {
      statusEl.textContent = 'Failed'
    } else {
      statusEl.textContent = 'Ready'
    }

    const actions = document.createElement('div')
    actions.className = 'video-actions'

    if (paused) {
      const resumeBtn = document.createElement('button')
      resumeBtn.className = 'item-action-btn'
      resumeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
      resumeBtn.title = 'Resume'
      resumeBtn.addEventListener('click', (e) => { e.stopPropagation(); resumeDownload(v.id) })
      actions.appendChild(resumeBtn)
    } else if (status === 'downloading') {
      const pauseBtn = document.createElement('button')
      pauseBtn.className = 'item-action-btn'
      pauseBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      pauseBtn.title = 'Pause'
      pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); pauseDownload(v.id) })
      actions.appendChild(pauseBtn)
    }

    if (status !== 'idle' && !paused) {
      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'item-action-btn danger'
      cancelBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
      cancelBtn.title = 'Cancel'
      cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); doCancelOne(v.id) })
      actions.appendChild(cancelBtn)
    }

    if (v._failed && !downloading.has(v.id)) {
      const retryBtn = document.createElement('button')
      retryBtn.className = 'item-action-btn'
      retryBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`
      retryBtn.title = 'Retry'
      retryBtn.addEventListener('click', (e) => { e.stopPropagation(); retryVideo(v.id) })
      actions.appendChild(retryBtn)

      checkFailedItems()
    }

    item.appendChild(dragHandle)
    item.appendChild(check)
    item.appendChild(thumb)
    item.appendChild(info)
    item.appendChild(statusEl)
    item.appendChild(actions)

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      showContextMenu(e.clientX, e.clientY, v)
    })

    item.addEventListener('dblclick', () => {
      if (v.id) {
        API.openUrl(`https://www.youtube.com/watch?v=${v.id}`)
      }
    })

    addDragListeners(item, v.id)

    list.appendChild(item)
  })

  updateSelectAllState()
  updateVideoCount()
}

function updateVideoCount() {
  const selected = videoList.filter(v => v._selected !== false && !v._failed).length
  $('#videoCount').textContent = `${selected} / ${videoList.length} selected`
}

function updateSelectAllState() {
  const checks = $$('.video-check:not([disabled])')
  const allChecked = [...checks].every(c => c.checked)
  const anyChecked = [...checks].some(c => c.checked)
  $('#selectAll').checked = allChecked
  $('#selectAll').indeterminate = false
}

$('#selectAll').addEventListener('change', () => {
  const checked = $('#selectAll').checked
  const filter = $('#searchInput').value.toLowerCase().trim()
  videoList.forEach(v => {
    const matches = !filter || (v.title || '').toLowerCase().includes(filter)
    if (matches) v._selected = checked
  })
  renderPlaylist()
})

function escapeHtml(str) {
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML
}

function formatCount(n) {
  if (!n) return ''
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function showError(msg) {
  const bar = $('#errorBar')
  bar.textContent = msg
  bar.classList.remove('hidden')
}

function hideError() {
  $('#errorBar').classList.add('hidden')
}

function addToHistory(url) {
  const key = 'vidsaver-urls'
  let history = []
  try {
    history = JSON.parse(localStorage.getItem(key) || '[]')
  } catch {}
  if (!history.includes(url)) {
    history.unshift(url)
    if (history.length > 50) history = history.slice(0, 50)
    localStorage.setItem(key, JSON.stringify(history))
  }
  const dl = $('#urlHistory')
  dl.innerHTML = ''
  history.forEach(u => {
    const opt = document.createElement('option')
    opt.value = u
    dl.appendChild(opt)
  })
}

function setupSearch() {
  $('#searchInput').addEventListener('input', renderPlaylist)
}

function setupDialogs() {
  $('#statsCloseBtn').addEventListener('click', () => {
    $('#statsDialog').classList.add('hidden')
  })

  $('#statsBtn').addEventListener('click', () => {
    const stats = loadStats()
    $('#statTotalVideos').textContent = stats.totalVideos
    $('#statTotalSize').textContent = formatBytes(stats.totalSize)
    $('#statSessionCount').textContent = stats.sessionCount
    $('#statDownloads').textContent = stats.downloads
    $('#statsDialog').classList.remove('hidden')
  })
}

function setupStats() {
  let stats = loadStats()
  function track(type) {
    if (type === 'download') {
      stats.downloads++
      stats.sessionCount++
      saveStats(stats)
    }
  }

  const origStart = startDownload
  startDownload = function() {
    track('download')
    return origStart.apply(this, arguments)
  }
}

function setupClipboard() {
  $('#clipboardBtn').addEventListener('click', () => {
    clipboardActive = !clipboardActive
    API.saveConfig({ clipboardMonitor: clipboardActive })
    updateClipboardIndicator()
    if (clipboardActive) {
      startClipboardPoll()
    } else {
      stopClipboardPoll()
    }
  })

  if (clipboardActive) {
    startClipboardPoll()
  }
}

function updateClipboardIndicator() {
  const btn = $('#clipboardBtn')
  btn.style.color = clipboardActive ? 'var(--accent)' : ''
}

function startClipboardPoll() {
  stopClipboardPoll()
  let lastText = ''
  clipboardInterval = setInterval(async () => {
    try {
      const text = await API.readClipboard()
      if (text && text !== lastText) {
        lastText = text
        const match = text.match(/(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/[\w\-\/]+/i)
        if (match) {
          const url = match[0]
          const current = $('#urlInput').value.trim()
          if (url !== current) {
            $('#urlInput').value = url
          }
        }
      }
    } catch {}
  }, 2000)
}

function stopClipboardPoll() {
  if (clipboardInterval) {
    clearInterval(clipboardInterval)
    clipboardInterval = null
  }
}

function setupDragReorder() {
  let list = $('#videoList')

  list.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.video-item')
    if (!item) return
    dragState = { id: item.dataset.videoId }
    item.classList.add('dragging')
    e.dataTransfer.effectAllowed = 'move'
  })

  list.addEventListener('dragend', (e) => {
    const item = e.target.closest('.video-item')
    if (item) item.classList.remove('dragging')
    $$('.drag-over').forEach(el => el.classList.remove('drag-over'))
    dragState = null
  })

  list.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const target = e.target.closest('.video-item')
    if (!target || !dragState) return
    $$('.drag-over').forEach(el => el.classList.remove('drag-over'))
    target.classList.add('drag-over')
  })

  list.addEventListener('dragleave', (e) => {
    const target = e.target.closest('.video-item')
    if (target) target.classList.remove('drag-over')
  })

  list.addEventListener('drop', (e) => {
    e.preventDefault()
    const target = e.target.closest('.video-item')
    if (!target || !dragState || dragState.id === target.dataset.videoId) {
      $$('.drag-over').forEach(el => el.classList.remove('drag-over'))
      dragState = null
      return
    }
    $$('.drag-over').forEach(el => el.classList.remove('drag-over'))

    const fromId = dragState.id
    const toId = target.dataset.videoId
    dragState = null

    const fromIdx = videoList.findIndex(v => v.id === fromId)
    const toIdx = videoList.findIndex(v => v.id === toId)
    if (fromIdx === -1 || toIdx === -1) return

    const [moved] = videoList.splice(fromIdx, 1)
    const newToIdx = videoList.findIndex(v => v.id === toId)
    videoList.splice(newToIdx + 1, 0, moved)

    renderPlaylist()
  })
}

function checkFailedItems() {
  const hasFailed = videoList.some(v => v._failed)
  $('#retryFailedBtn').classList.toggle('hidden', !hasFailed)
}

function retryVideo(videoId) {
  const v = videoList.find(x => x.id === videoId)
  if (v) {
    v._failed = false
    v._selected = true
    downloading.delete(videoId)
    renderPlaylist()
    checkFailedItems()
  }
}

function retryAllFailed() {
  videoList.forEach(v => {
    if (v._failed) {
      v._failed = false
      v._selected = true
      downloading.delete(v.id)
    }
  })
  renderPlaylist()
  checkFailedItems()
  $('.context-menu').classList.add('hidden')
  if (videoList.some(v => v._selected !== false)) {
    $('#downloadBtn').disabled = false
  }
}

async function startDownload() {
  const selected = videoList.filter(v => v._selected !== false && !v._failed)
  const dir = $('#pathDisplay').textContent
  const { format, preset } = getFormatAndPreset()

  if (!dir || dir === 'Choose download folder...') {
    showError('Please select a download folder')
    return
  }

  if (selected.length === 0) {
    showError('No videos selected')
    return
  }

  hideError()
  $('#downloadBtn').disabled = true
  $('#downloadBtn').classList.add('hidden')
  $('#cancelBtn').classList.remove('hidden')
  $('#retryFailedBtn').classList.add('hidden')
  $('#progressContainer').classList.remove('hidden')
  $('#progressBar').style.width = '0%'
  $('#progressPercent').textContent = '0%'
  $('#progressLabel').textContent = 'Starting...'
  $('#etaInfo').classList.add('hidden')

  const progressCleanup = API.onProgress((data) => {
    handleProgress(data)
  })

  downloading.clear()
  activeCount = 0
  completedBytes = 0
  totalVideos = selected.length
  const startedAt = Date.now()
  let completed = 0
  let failedCount = 0

  function updateETA() {
    const elapsed = (Date.now() - startedAt) / 1000
    if (completed > 0 && elapsed > 3) {
      const perItem = elapsed / completed
      const remaining = totalVideos - completed
      const etaSec = Math.round(perItem * remaining)
      if (etaSec > 0) {
        const m = Math.floor(etaSec / 60)
        const s = etaSec % 60
        $('#etaInfo').classList.remove('hidden')
        $('#etaText').textContent = `ETA ${m}m ${s}s`
      }
    }
  }

  function onVideoDone(videoId, success) {
    completed++
    if (!success) {
      failedCount++
      const v = videoList.find(x => x.id === videoId)
      if (v) v._failed = true
    }
    const status = success ? 'done' : 'error'
    const d = downloading.get(videoId)
    if (d) d.status = status

    activeCount--

    renderPlaylist()
    checkFailedItems()
    updateETA()
    updateOverallProgress()

    if (activeCount <= 0 && completed >= totalVideos) {
      finishDownload(progressCleanup, failedCount, startedAt)
    }
  }

  function finishDownload(cleanup, failed, started) {
    cleanup()
    $('#downloadBtn').disabled = false
    $('#downloadBtn').classList.remove('hidden')
    $('#cancelBtn').classList.add('hidden')

    if (failed === 0) {
      $('#progressLabel').textContent = 'All downloads complete!'
      $('#progressPercent').textContent = '100%'
      $('#progressBar').style.width = '100%'
      if (totalVideos > 0) {
        API.notify('VidSaver', `Downloaded ${totalVideos} video${totalVideos > 1 ? 's' : ''} successfully!`)
      }
    } else {
      $('#progressLabel').textContent = `${totalVideos - failed} completed, ${failed} failed`
      checkFailedItems()
      API.notify('VidSaver', `${totalVideos - failed} of ${totalVideos} downloaded (${failed} failed)`)
    }

    checkQueueState()
  }

  async function worker() {
    while (queue.length > 0) {
      const videoId = queue.shift()
      if (!videoId) break

      const v = videoList.find(x => x.id === videoId)
      if (!v || v._selected === false) continue

      const entry = { status: 'downloading', percent: 0 }
      downloading.set(videoId, entry)
      activeCount++
      renderPlaylist()

      const url = `https://www.youtube.com/watch?v=${videoId}`
      try {
        const result = await API.download(url, dir, format, preset, videoId)
        onVideoDone(videoId, result.success)
      } catch (err) {
        const d = downloading.get(videoId)
        if (d && d.paused) {
          d.status = 'paused'
          renderPlaylist()
        }
        onVideoDone(videoId, false)
      }
    }
  }

  queue = selected.map(v => v.id)
  const workers = Math.min(3, selected.length)
  for (let i = 0; i < workers; i++) {
    worker()
  }
}

function handleProgress(data) {
  const d = downloading.get(data.videoId)
  if (!d) return
  if (d.paused) return

  d.status = 'downloading'
  d.percent = data.percent || 0
  d.speed = data.speed
  d.eta = data.eta
  d.downloaded = data.downloaded
  d.total = data.total

  completedBytes += data.deltaBytes || 0
  updateSizeEstimate()
  updateOverallProgress()
  renderPlaylist()
}

function updateOverallProgress() {
  const total = totalVideos || 1
  let totalPercent = 0
  downloading.forEach(d => {
    if (d.status === 'done') totalPercent += 100
    else if (d.status === 'downloading') totalPercent += (d.percent || 0)
  })
  const avg = Math.min(100, Math.round(totalPercent / total))
  $('#progressBar').style.width = avg + '%'
  $('#progressPercent').textContent = avg + '%'

  const active = [...downloading.values()].filter(d => d.status === 'downloading').length
  if (active > 0) {
    const speeds = [...downloading.values()].filter(d => d.speed).map(d => d.speed)
    if (speeds.length > 0) {
      const totalSpeed = speeds.reduce((a, b) => a + b, 0)
      const speedStr = formatBytes(totalSpeed) + '/s'
      $('#progressLabel').textContent = `Downloading ${active} file${active > 1 ? 's' : ''} (${speedStr})`
    } else {
      $('#progressLabel').textContent = `Downloading ${active} file${active > 1 ? 's' : ''}...`
    }
  } else {
    $('#progressLabel').textContent = 'Processing...'
  }
}

function cancelAll() {
  queue = []
  API.cancelAll()
  downloading.forEach((d, id) => {
    d.status = 'idle'
  })
  downloading.clear()
  activeCount = 0
  $('#progressContainer').classList.add('hidden')
  $('#downloadBtn').disabled = false
  $('#downloadBtn').classList.remove('hidden')
  $('#cancelBtn').classList.add('hidden')
  videoList.forEach(v => { v._failed = false })
  renderPlaylist()
}

async function doCancelOne(videoId) {
  const result = await API.cancelOne(videoId)
  if (result) {
    const d = downloading.get(videoId)
    if (d) {
      d.status = 'idle'
      activeCount = Math.max(0, activeCount - 1)
    }
    downloading.delete(videoId)
    queue = queue.filter(id => id !== videoId)
    renderPlaylist()
    checkQueueState()
  }
}

async function pauseDownload(videoId) {
  await API.pauseOne(videoId)
  const d = downloading.get(videoId)
  if (d) {
    d.paused = true
    d.status = 'paused'
  }
  const v = videoList.find(x => x.id === videoId)
  if (v) {
    v._failed = false
  }
  queue = queue.filter(id => id !== videoId)
  checkFailedItems()
  renderPlaylist()
}

async function resumeDownload(videoId) {
  const v = videoList.find(x => x.id === videoId)
  if (!v) return
  const dir = $('#pathDisplay').textContent
  const { format, preset } = getFormatAndPreset()

  const url = `https://www.youtube.com/watch?v=${videoId}`

  const entry = { status: 'downloading', percent: 0, paused: false }
  downloading.set(videoId, entry)
  activeCount++
  renderPlaylist()

  try {
    const result = await API.download(url, dir, format, preset, videoId)
    if (result.success) {
      entry.status = 'done'
      v._failed = false
      downloading.delete(videoId)
    } else {
      entry.status = 'error'
      v._failed = true
    }
  } catch {
    entry.status = 'error'
    v._failed = true
  }

  activeCount--
  renderPlaylist()
  checkFailedItems()
  checkQueueState()
}

function checkQueueState() {
  const hasActive = [...downloading.values()].some(d => d.status === 'downloading' || d.status === 'paused')
  if (!hasActive && queue.length === 0) {
    $('#progressContainer').classList.add('hidden')
    $('#downloadBtn').disabled = false
    $('#downloadBtn').classList.remove('hidden')
    $('#cancelBtn').classList.add('hidden')
  }
}

function addDragListeners(item, videoId) {
  item.draggable = true
}
