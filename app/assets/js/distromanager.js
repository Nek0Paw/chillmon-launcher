const fs = require('fs-extra')
const path = require('path')
const { DistributionAPI, HeliosDistribution } = require('helios-core/common')

const ConfigManager = require('./configmanager')

exports.REMOTE_DISTRO_URL = process.env.RUN_DISTRO_URL || 'https://pub-27c396805e334927b5344d81092b6279.r2.dev/distribution.json'

const holder = { api: null }

function logBoot(msg, extra) {
    try {
        const line = `[${new Date().toISOString()}] ${msg}${extra ? ' ' + extra : ''}\n`
        const dir = ConfigManager.getLauncherDirectory()
        fs.appendFileSync(path.join(dir, 'distro-boot.log'), line)
    } catch {
        // ignore
    }
}

function resolveBundledDistro() {
    const remoteApp = (() => {
        try {
            return require('@electron/remote').app
        } catch {
            return null
        }
    })()
    const appPath = remoteApp ? remoteApp.getAppPath() : ''
    const candidates = [
        path.join(__dirname, '..', 'distribution.json'),
        path.join(process.resourcesPath || '', 'distribution.json'),
        appPath ? path.join(appPath, 'app', 'assets', 'distribution.json') : '',
        appPath ? path.join(appPath, 'distribution.json') : '',
        path.join('C:', 'Users', 'yansr', 'Projects', 'run-cobblemon-pack', 'distribution.json')
    ]
    const found = candidates.find(p => p && fs.existsSync(p)) || null
    logBoot('resolveBundledDistro', found || ('none | tried ' + candidates.filter(Boolean).join(' | ')))
    return found
}

exports.ensureLocalDistro = function () {
    const src = resolveBundledDistro()
    if (!src) {
        return false
    }
    const dir = ConfigManager.getLauncherDirectory()
    fs.ensureDirSync(dir)
    const raw = fs.readFileSync(src, 'utf8').replace(/^\uFEFF/, '')
    JSON.parse(raw)
    fs.writeFileSync(path.join(dir, 'distribution.json'), raw)
    fs.writeFileSync(path.join(dir, 'distribution_dev.json'), raw)
    logBoot('wrote local distro', dir)
    return true
}

function createApi() {
    try {
        ConfigManager.load()
    } catch {
        // already loaded or first-run defaults handled inside load()
    }
    const api = new DistributionAPI(
        ConfigManager.getLauncherDirectory(),
        ConfigManager.getCommonDirectory(),
        ConfigManager.getInstanceDirectory(),
        exports.REMOTE_DISTRO_URL,
        true
    )
    holder.api = api
    return api
}

exports.initDistroPaths = function () {
    if (!holder.api) {
        createApi()
        return
    }
    holder.api.commonDir = ConfigManager.getCommonDirectory()
    holder.api.instanceDir = ConfigManager.getInstanceDirectory()
}

exports.loadLocalDistribution = async function () {
    ConfigManager.load()
    if (!exports.ensureLocalDistro()) {
        throw new Error('Bundled distribution.json not found')
    }
    const api = createApi()
    api.toggleDevMode(true)
    try {
        const distro = await api.getDistribution()
        logBoot('DistroAPI.getDistribution ok')
        return distro
    } catch (err) {
        logBoot('DistroAPI.getDistribution failed', String(err && err.message || err))
        const dest = path.join(ConfigManager.getLauncherDirectory(), 'distribution_dev.json')
        const raw = fs.readFileSync(dest, 'utf8').replace(/^\uFEFF/, '')
        const json = JSON.parse(raw)
        const distro = new HeliosDistribution(
            json,
            ConfigManager.getCommonDirectory(),
            ConfigManager.getInstanceDirectory()
        )
        api.rawDistribution = json
        api.distribution = distro
        logBoot('manual HeliosDistribution ok')
        return distro
    }
}

exports.DistroAPI = new Proxy({}, {
    get(_t, prop) {
        if (!holder.api) {
            createApi()
        }
        const value = holder.api[prop]
        return typeof value === 'function' ? value.bind(holder.api) : value
    },
    set(_t, prop, value) {
        if (!holder.api) {
            createApi()
        }
        holder.api[prop] = value
        return true
    }
})
