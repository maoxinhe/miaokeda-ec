/**
 * 喵科大EC · 便携品牌浏览器 — 主进程
 * 基于 Electron + Chromium 内核，支持便携模式（免安装、数据跟随程序目录）
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const PRODUCT_NAME = '喵科大EC'
const APP_VERSION = app.getVersion()

// ---------------------------------------------------------------------------
// 便携化：--portable 启动时，将 userData 放到程序所在文件夹旁的 data 目录，
// 使整个文件夹拷入 U 盘即开即用，设置/历史/缓存全部跟着走，不写系统安装目录。
// ---------------------------------------------------------------------------
const isPortable = process.argv.includes('--portable')

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

  // 演示模式：自动展示 主页→打开云端面板→登录→显示云端配置→退出（仅 MIAOKEDA_DEMO=1）
  if (process.env.MIAOKEDA_DEMO === '1') {
    win.webContents.once('did-finish-load', () => {
      console.log('DEMO_READY')
      const run = (delay, code) => setTimeout(() => {
        win.webContents.executeJavaScript(code).catch((e) => console.error('DEMO_ERR', e))
      }, delay)
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

  // 品牌信息
  ipcMain.handle('app:meta', () => ({
    productName: PRODUCT_NAME,
    version: APP_VERSION,
    portable: isPortable
  }))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 跨平台便携：关闭即退出，不在后台驻留
  app.quit()
})
