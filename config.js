const fs = require('fs')
const path = require('path')
const { app } = require('electron')

let configDir = ''
let configFile = ''
let cache = {}

function _init() {
  if (configDir) return
  configDir = app.getPath('userData')
  configFile = path.join(configDir, 'config.json')
}

function load() {
  _init()
  try {
    if (fs.existsSync(configFile)) {
      cache = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    }
  } catch {}
  return cache
}

function save(partial) {
  _init()
  cache = { ...cache, ...partial }
  try {
    const dir = path.dirname(configFile)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(configFile, JSON.stringify(cache, null, 2))
  } catch {}
  return cache
}

function get(key) {
  return cache[key]
}

module.exports = { load, save, get }
