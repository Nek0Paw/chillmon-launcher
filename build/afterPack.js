const path = require('path')
const { execFileSync } = require('child_process')
const fs = require('fs')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const exe = path.join(context.appOutDir, 'Chillmon.exe')
  const icon = path.join(context.packager.projectDir, 'build', 'icon.ico')

  try {
    const { rcedit } = require('rcedit')
    console.log('afterPack: rcedit npm ->', exe)
    await rcedit(exe, { icon })
    return
  } catch (e) {
    console.log('afterPack: npm rcedit failed, trying exe:', e.message)
  }

  const candidates = [
    path.join(context.packager.projectDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe'),
    path.join(context.packager.projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign', '000846423', 'rcedit-x64.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign', '057177339', 'rcedit-x64.exe')
  ]
  const bin = candidates.find(p => p && fs.existsSync(p))
  if (!bin) throw new Error('rcedit binary not found')
  console.log('afterPack:', bin, '->', exe)
  execFileSync(bin, [exe, '--set-icon', icon], { stdio: 'inherit' })
}
