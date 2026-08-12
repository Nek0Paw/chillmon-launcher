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

/**
 * Seed local distro files from the bundled copy.
 * @param {boolean} force When false, skip if local files already exist.
 */
exports.ensureLocalDistro = function (force = false) {
    const src = resolveBundledDistro()
    if (!src) {
        return false
    }
    const dir = ConfigManager.getLauncherDirectory()
    fs.ensureDirSync(dir)
    const dest = path.join(dir, 'distribution.json')
    const destDev = path.join(dir, 'distribution_dev.json')
    if (!force && fs.existsSync(dest) && fs.existsSync(destDev)) {
        logBoot('keep existing local distro', dir)
        return true
    }
    const raw = fs.readFileSync(src, 'utf8').replace(/^\uFEFF/, '')
    JSON.parse(raw)
    fs.writeFileSync(dest, raw)
    fs.writeFileSync(destDev, raw)
    logBoot('wrote local distro', dir)
    return true
}

function createApi(devMode = false) {
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
        devMode
    )
    holder.api = api
    return api
}

exports.initDistroPaths = function () {
    if (!holder.api) {
        createApi(false)
        return
    }
    holder.api.commonDir = ConfigManager.getCommonDirectory()
    holder.api.instanceDir = ConfigManager.getInstanceDirectory()
}

exports.loadLocalDistribution = async function () {
    ConfigManager.load()
    // Seed only when missing — do not overwrite a fresher R2/cache copy every boot.
    if (!exports.ensureLocalDistro(false)) {
        throw new Error('Bundled distribution.json not found')
    }
    const api = createApi(false)
    try {
        const distro = await api.getDistribution()
        logBoot('DistroAPI.getDistribution ok (remote)')
        // Keep distribution_dev.json in sync for any tooling that reads it.
        try {
            const raw = JSON.stringify(api.rawDistribution)
            fs.writeFileSync(path.join(ConfigManager.getLauncherDirectory(), 'distribution_dev.json'), raw)
        } catch {
            // ignore
        }
        return distro
    } catch (err) {
        logBoot('DistroAPI.getDistribution failed', String(err && err.message || err))
        exports.ensureLocalDistro(true)
        api.toggleDevMode(true)
        try {
            const distro = await api.getDistribution()
            logBoot('DistroAPI.getDistribution ok (local fallback)')
            return distro
        } catch (err2) {
            logBoot('local fallback failed', String(err2 && err2.message || err2))
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
}

exports.DistroAPI = new Proxy({}, {
    get(_t, prop) {
        if (!holder.api) {
            createApi(false)
        }
        const value = holder.api[prop]
        return typeof value === 'function' ? value.bind(holder.api) : value
    },
    set(_t, prop, value) {
        if (!holder.api) {
            createApi(false)
        }
        holder.api[prop] = value
        return true
    }
})
