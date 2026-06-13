const path = require('path')
const { getFormatString } = require('./shared/formats')

let activeProcesses = new Map()
let downloadIdCounter = 0

function getFfmpegPath() {
  try {
    const ffmpeg = require('@ffmpeg-installer/ffmpeg')
    if (ffmpeg.path && require('fs').existsSync(ffmpeg.path)) return ffmpeg.path
    return 'ffmpeg'
  } catch {
    return 'ffmpeg'
  }
}

function parseProgressLine(line) {
  const pctMatch = line.match(/(\d+(?:\.\d+)?)%/)
  if (!pctMatch) return null
  return {
    percent: parseFloat(pctMatch[1]),
    speed: (line.match(/at\s+([\d.]+[KMG]?i?B\/s)/) || [])[1] || null,
    eta: (line.match(/ETA\s+(\d{2}:\d{2}(?::\d{2})?)/) || [])[1] || null,
    totalSize: (line.match(/of\s+~?([\d.]+[KMG]?i?B)/) || [])[1] || null,
  }
}

function parseJsonLines(raw) {
  const results = []
  let buf = raw
  while (buf.length > 0) {
    const idx = buf.indexOf('\n')
    const line = idx === -1 ? buf.trim() : buf.slice(0, idx).trim()
    buf = idx === -1 ? '' : buf.slice(idx + 1)
    if (!line) continue
    if (line === '[' || line === ']') continue
    let str = line
    if (str.charCodeAt(0) === 0xFEFF) str = str.slice(1)
    if (str.charCodeAt(0) === 0xFFFE) str = str.slice(1)
    str = str.trim()
    if (!str) continue
    if (str.startsWith('[') && str.endsWith(']')) {
      try {
        const arr = JSON.parse(str)
        if (Array.isArray(arr)) results.push(...arr)
        continue
      } catch {}
    }
    try {
      results.push(JSON.parse(str))
    } catch {}
  }
  return results
}

async function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = require('child_process').spawn('yt-dlp', args, {
      windowsHide: true,
    })
    let stdout = Buffer.alloc(0)
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout = Buffer.concat([stdout, d]) })
    proc.stderr.on('data', (d) => { stderr += d.toString('utf8') })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0 && stdout.length === 0) {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`))
        return
      }
      const out = stdout.toString('utf8')
      resolve({ stdout: out, stderr })
    })
  })
}

async function fetchVideoInfo(url) {
  const args = ['--flat-playlist', '--dump-json', '--no-warnings', '--ignore-errors', '--socket-timeout', '30', '--extractor-retries', '2', url]
  const { stdout, stderr } = await runYtDlp(args)
  const items = parseJsonLines(stdout)
  if (items.length === 0) {
    const snippet = stdout.slice(0, 300).replace(/\r?\n/g, '\\n')
    const stderrSnippet = stderr.slice(0, 300)
    throw new Error(`No videos found. Check the URL.\nstdout: ${snippet}\nstderr: ${stderrSnippet}`)
  }
  return items
}

async function fetchVideoDetails(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`
  const args = ['--dump-json', '--no-warnings', url]
  const { stdout } = await runYtDlp(args)
  const parsed = parseJsonLines(stdout)
  if (parsed.length === 0) throw new Error('No data for video ' + videoId)
  return parsed[0]
}

async function downloadVideo(url, outputDir, type, preset, videoId, onProgress) {
  const id = ++downloadIdCounter
  return new Promise((resolve, reject) => {
    const fmt = getFormatString(type, preset)
    const template = path.join(outputDir, '%(title)s.%(ext)s')
    const args = [
      '--newline', '--no-warnings', '--no-playlist', '--continue',
      '--socket-timeout', '30', '--extractor-retries', '2',
      '-f', fmt, '-o', template,
    ]
    if (type === 'mp3') {
      args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', preset.quality || '0')
    }
    if (type === 'mkv') {
      args.push('--merge-output-format', 'mkv')
    }
    args.push('--ffmpeg-location', getFfmpegPath())
    args.push(url)

    const proc = require('child_process').spawn('yt-dlp', args, { windowsHide: true })
    activeProcesses.set(id, proc)

    let stderrBuf = ''
    const onStdout = (data) => {
      for (const line of data.toString().split('\n')) {
        const p = parseProgressLine(line)
        if (p) onProgress?.({ ...p, videoId })
      }
    }
    const onStderr = (data) => { stderrBuf += data.toString() }
    proc.stdout.on('data', onStdout)
    proc.stderr.on('data', onStderr)
    proc.on('error', (err) => { activeProcesses.delete(id); reject(err) })
    proc.on('close', (code) => {
      activeProcesses.delete(id)
      if (code === 0) { onProgress?.({ percent: 100, videoId }); resolve({ success: true }) }
      else if (code === null) reject(new Error('Download cancelled'))
      else {
        const errMsg = stderrBuf.trim().slice(0, 500)
        reject(new Error(errMsg || `yt-dlp exited with code ${code}`))
      }
    })
  })
}

function cancelAll() {
  for (const [id, proc] of activeProcesses) {
    try { proc.kill('SIGTERM') } catch {}
    activeProcesses.delete(id)
  }
}

module.exports = { fetchVideoInfo, fetchVideoDetails, downloadVideo, cancelAll }
