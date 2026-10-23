/**
 * 喵科大EC · 便携品牌浏览器 — 主进程
 * 基于 Electron + Chromium 内核，支持便携模式（免安装、数据跟随程序目录）
 */
const { app, BrowserWindow, ipcMain, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { session } = require('electron')

const PRODUCT_NAME = '喵科大EC'
const APP_VERSION = app.getVersion()

// ---------------------------------------------------------------------------
// 便携化：--portable 启动时，将 userData 放到程序所在文件夹旁的 data 目录，
// 使整个文件夹拷入 U 盘即开即用，设置/历史/缓存全部跟着走，不写系统安装目录。
// ---------------------------------------------------------------------------
// 便携模式：--portable 参数 或 便携版单 exe（PORTABLE_EXECUTABLE_DIR）或 Linux AppImage
const isPortable = process.argv.includes('--portable') ||
  !!process.env.PORTABLE_EXECUTABLE_DIR ||
  !!process.env.APPIMAGE

function getPortableBaseDir() {
  // Windows 便携版：electron-builder portable target 注入的可执行文件目录
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR
  // Linux AppImage：AppImage 所在目录
  if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE)
  // 开发模式：项目根目录
  return app.getAppPath()
}

if (isPortable) {
  app.setPath('userData', path.join(getPortableBaseDir(), 'data'))
}

// ---------------------------------------------------------------------------
// 配置存储：以 JSON 方式读写到 userData 目录（便携模式下即 data/config.json）
// ---------------------------------------------------------------------------
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json')
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeConfig(patch) {
  const cfg = { ...readConfig(), ...patch }
  const dir = app.getPath('userData')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf-8')
  return cfg
}

// ---------------------------------------------------------------------------
// 主窗口
// ---------------------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    title: PRODUCT_NAME,
    frame: false, // 去掉系统标题栏，使用自定义三色球控制（Safari/macOS 风格）
    backgroundColor: '#fdf5f8',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false
    }
  })

  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, '../renderer/index.html'))

  // 开发验证钩子：MIAOKEDA_CAPTURE 指定路径时，加载完成后截图保存
  const capturePath = process.env.MIAOKEDA_CAPTURE
  if (capturePath) {
    const navUrl = process.env.MIAOKEDA_NAV_URL
    win.webContents.once('did-finish-load', async () => {
      if (navUrl) {
        try {
          await win.webContents.executeJavaScript(`(function(){
            var wv=document.getElementById('mainView');
            document.getElementById('homeOverlay').style.display='none';
            wv.hidden=false;
            wv.src=${JSON.stringify(navUrl)};
          })()`)
        } catch (err) { console.error('NAV_ERR', err) }
      }
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage()
          require('fs').writeFileSync(capturePath, img.toPNG())
          console.log('CAPTURED:' + capturePath)
          app.quit()
        } catch (err) {
          console.error('CAPTURE_ERR', err)
          app.quit()
        }
      }, 7000)
    })
  }

  // 演示模式：MIAOKEDA_DEMO_PANEL=warp 打开 WARP 面板，否则展示云端登录（仅 MIAOKEDA_DEMO=1）
  if (process.env.MIAOKEDA_DEMO === '1') {
    win.webContents.once('did-finish-load', () => {
      console.log('DEMO_READY')
      const run = (delay, code) => setTimeout(() => {
        win.webContents.executeJavaScript(code).catch((e) => console.error('DEMO_ERR', e))
      }, delay)
      if (process.env.MIAOKEDA_DEMO_PANEL === 'warp') {
        // t=2s 打开 WARP 面板
        run(2000, `document.getElementById('btnWarp').click()`)
        setTimeout(() => app.quit(), 60000)
      } else {
        // t=2s 打开云端登录面板
        run(2000, `document.getElementById('btnCloud').click()`)
        // t=4s 填写用户名密码并点击登录
        run(4000, `(function(){
          document.getElementById('cloudUsername').value='demo';
          document.getElementById('cloudPassword').value='demo123';
          document.getElementById('cloudSubmit').click();
        })()`)
        // t=11s 退出
        setTimeout(() => app.quit(), 11000)
      }
    })
  }

  return win
}// ---------------------------------------------------------------------------
// 应用生命周期
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // 确保 userData 目录存在（便携模式下即程序旁的 data 目录）
  const userData = app.getPath('userData')
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
  if (process.env.MIAOKEDA_VERBOSE) console.log('[userData]', userData)

  // 配置 IPC
  ipcMain.handle('config:get', () => readConfig())
  ipcMain.handle('config:set', (_e, patch) => writeConfig(patch))

  // 窗口控制（无边框三色球按钮）
  ipcMain.handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.handle('window:maximize-toggle', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })
  ipcMain.handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

  // 品牌信息
  ipcMain.handle('app:meta', () => ({
    productName: PRODUCT_NAME,
    version: APP_VERSION,
    portable: isPortable
  }))

  // -------------------------------------------------------------------------
  // Cloudflare WARP 集成：DoH 加密 DNS + 本地代理检测与接入
  // -------------------------------------------------------------------------
  const WARP_PROXY_HOST = '127.0.0.1'
  const WARP_PROXY_PORT = 40000 // WARP 客户端 proxy 模式默认 SOCKS5 端口

  // 启用 Cloudflare DoH（1.1.1.1），防止 DNS 劫持与监听
  try {
    app.configureHostResolver({
      secureDnsMode: 'secure',
      secureDnsServers: ['https://cloudflare-dns.com/dns-query']
    })
    if (process.env.MIAOKEDA_VERBOSE) console.log('[DoH] Cloudflare 1.1.1.1 已启用')
  } catch (e) {
    console.error('[DoH] 配置失败:', e.message)
  }

  // 检测本地 WARP 代理端口是否开放
  async function detectWarpProxy() {
    return new Promise((resolve) => {
      const req = net.request({
        method: 'GET',
        url: `http://${WARP_PROXY_HOST}:${WARP_PROXY_PORT}`,
        timeout: 1500
      })
      req.on('response', () => resolve(true))
      req.on('error', () => resolve(false))
      req.on('timeout', () => { req.abort(); resolve(false) })
      req.end()
    })
  }

  ipcMain.handle('warp:status', async () => {
    const proxyAvailable = await detectWarpProxy()
    const cfg = readConfig()
    return {
      dohEnabled: true,
      dohServer: 'https://cloudflare-dns.com/dns-query',
      proxyAvailable,
      proxyActive: !!cfg.warpProxyActive,
      proxyHost: WARP_PROXY_HOST,
      proxyPort: WARP_PROXY_PORT
    }
  })

  ipcMain.handle('warp:connect', async () => {
    const available = await detectWarpProxy()
    if (!available) return { ok: false, error: '未检测到 WARP 客户端，请先安装并启动 Cloudflare WARP' }
    try {
      await session.defaultSession.setProxy({
        proxyRules: `socks5://${WARP_PROXY_HOST}:${WARP_PROXY_PORT}`
      })
      writeConfig({ warpProxyActive: true })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('warp:disconnect', async () => {
    try {
      await session.defaultSession.setProxy({ proxyRules: '' })
      writeConfig({ warpProxyActive: false })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // 启动时如果之前开启了 WARP 代理，自动恢复
  const cfg = readConfig()
  if (cfg.warpProxyActive) {
    detectWarpProxy().then((available) => {
      if (available) {
        session.defaultSession.setProxy({ proxyRules: `socks5://${WARP_PROXY_HOST}:${WARP_PROXY_PORT}` })
        console.log('[WARP] 已恢复代理连接')
      } else {
        writeConfig({ warpProxyActive: false })
      }
    })
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 跨平台便携：关闭即退出，不在后台驻留
  app.quit()
})
