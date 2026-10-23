/**
 * 喵科大EC · 品牌壳前端逻辑
 * 负责：地址栏导航、webview 控制、启动页、状态同步
 */
;(function () {
  'use strict'

  const webview = document.getElementById('mainView')
  const homeOverlay = document.getElementById('homeOverlay')
  const addressInput = document.getElementById('addressInput')
  const homeSearch = document.getElementById('homeSearch')
  const homeSearchBtn = document.getElementById('homeSearchBtn')
  const tabTitle = document.getElementById('tabTitle')
  const tabFavicon = document.getElementById('tabFavicon')
  const addrSecure = document.getElementById('addrSecure')
  const btnBack = document.getElementById('btnBack')
  const btnForward = document.getElementById('btnForward')
  const btnReload = document.getElementById('btnReload')

  const SEARCH_ENGINE = 'https://www.bing.com/search?q='

  // 默认主页（品牌启动页）
  const HOME = 'home'

  // ------------------------------------------------------------------
  // 解析输入：网址 or 搜索词
  // ------------------------------------------------------------------
  function resolveTarget(text) {
    const raw = text.trim()
    if (!raw) return null

    if (/^(https?|ftp|file|about):\/\//i.test(raw)) return raw

    // 带协议但没写全（如 example.com/path）
    if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/|$)/i.test(raw)) {
      return 'https://' + raw
    }
    if (/^localhost(:\d+)?(\/|$)/i.test(raw)) {
      return 'http://' + raw
    }
    // 否则当作搜索词
    return SEARCH_ENGINE + encodeURIComponent(raw)
  }

  // ------------------------------------------------------------------
  // 导航控制
  // ------------------------------------------------------------------
  function navigate(text) {
    const target = resolveTarget(text)
    if (!target) return
    webview.src = target
    showPage()
  }

  function showPage() {
    homeOverlay.style.display = 'none'
    webview.hidden = false
  }

  function goHome() {
    webview.src = 'about:blank'
    webview.hidden = true
    homeOverlay.style.display = 'flex'
    homeSearch.value = ''
    addressInput.value = ''
    tabTitle.textContent = '新标签页'
    tabFavicon.textContent = '⌂'
  }

  // ------------------------------------------------------------------
  // webview 状态同步
  // ------------------------------------------------------------------
  webview.addEventListener('did-navigate', (e) => {
    const url = e.url
    if (!url || url === 'about:blank') return
    addressInput.value = url
    const lockIco = addrSecure.querySelector('i')
    if (lockIco) lockIco.textContent = url.startsWith('https:') ? 'lock' : 'lock_open'
  })
  webview.addEventListener('did-navigate-in-page', (e) => {
    if (e.url) addressInput.value = e.url
  })
  webview.addEventListener('page-title-updated', (e) => {
    if (e.title) {
      tabTitle.textContent = e.title
      document.title = e.title + ' - 喵科大EC'
    }
  })
  webview.addEventListener('page-favicon-updated', (e) => {
    const ico = e.favicons && e.favicons[0]
    if (ico) {
      tabFavicon.innerHTML = ''
      const img = document.createElement('img')
      img.src = ico
      img.style.width = '14px'
      img.style.height = '14px'
      tabFavicon.appendChild(img)
    }
  })
  webview.addEventListener('did-start-loading', () => {
    const ico = btnReload.querySelector('i')
    if (ico) ico.textContent = 'close'
    btnReload.title = '停止加载'
  })
  webview.addEventListener('did-stop-loading', () => {
    const ico = btnReload.querySelector('i')
    if (ico) ico.textContent = 'refresh'
    btnReload.title = '刷新'
    btnBack.disabled = !webview.canGoBack()
    btnForward.disabled = !webview.canGoForward()
  })

  // ------------------------------------------------------------------
  // 事件绑定
  // ------------------------------------------------------------------
  btnBack.addEventListener('click', () => { if (webview.canGoBack()) webview.goBack() })
  btnForward.addEventListener('click', () => { if (webview.canGoForward()) webview.goForward() })
  btnReload.addEventListener('click', () => {
    if (webview.isLoading()) webview.stop()
    else webview.reload()
  })
  document.getElementById('btnHome').addEventListener('click', goHome)
  document.getElementById('btnHomeShort').addEventListener('click', goHome)

  addressInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigate(addressInput.value)
  })
  homeSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigate(homeSearch.value)
  })
  homeSearchBtn.addEventListener('click', () => navigate(homeSearch.value))

  // ------------------------------------------------------------------
  // 云端账号：登录/注册/配置下发/版本上报
  // ------------------------------------------------------------------
  const cloud = window.miaokeda ? window.miaokeda.cloud : null
  const cloudModal = document.getElementById('cloudModal')
  const cloudBody = document.getElementById('cloudBody')
  const cloudStatus = document.getElementById('cloudStatus')
  const cloudTabs = document.getElementById('cloudTabs')
  const btnCloud = document.getElementById('btnCloud')
  const cloudClose = document.getElementById('cloudClose')
  let cloudTab = 'login'

  function apiUrl(p) { return cloud ? cloud.baseUrl + p : '' }
  function setStatus(msg, type) {
    cloudStatus.textContent = msg || ''
    cloudStatus.className = 'cloud-status' + (type ? ' ' + type : '')
  }
  const getToken = () => localStorage.getItem('mkec_token') || ''
  const setToken = (t) => t ? localStorage.setItem('mkec_token', t) : localStorage.removeItem('mkec_token')
  const getUser = () => { try { return JSON.parse(localStorage.getItem('mkec_user') || 'null') } catch { return null } }
  const setUser = (u) => u ? localStorage.setItem('mkec_user', JSON.stringify(u)) : localStorage.removeItem('mkec_user')

  function openCloud() {
    cloudModal.hidden = false
    getToken() ? renderLoggedIn() : renderAuthForm()
  }
  function closeCloud() { cloudModal.hidden = true }

  function switchTab(tab) {
    cloudTab = tab
    cloudTabs.querySelectorAll('.cloud-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab))
    renderAuthForm()
  }

  function renderAuthForm() {
    cloudTabs.style.display = 'flex'
    const isLogin = cloudTab === 'login'
    cloudBody.innerHTML = `
      <div class="cloud-field"><label>用户名</label>
        <input id="cloudUsername" type="text" placeholder="3-32 位" autocomplete="username" /></div>
      <div class="cloud-field"><label>密码</label>
        <input id="cloudPassword" type="password" placeholder="至少 6 位" autocomplete="${isLogin ? 'current-password' : 'new-password'}" /></div>
      <button class="cloud-submit" id="cloudSubmit">${isLogin ? '登录' : '注册并登录'}</button>`
    setStatus('')
    document.getElementById('cloudSubmit').addEventListener('click', () => {
      const u = document.getElementById('cloudUsername').value.trim()
      const p = document.getElementById('cloudPassword').value
      if (!u || !p) { setStatus('请填写用户名和密码', 'err'); return }
      isLogin ? doLogin(u, p) : doRegister(u, p)
    })
  }

  async function doLogin(u, p) {
    setStatus('登录中…')
    try {
      const r = await fetch(apiUrl('/api/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) })
      const d = await r.json()
      if (!d.ok) { setStatus(d.error === 'invalid_credentials' ? '用户名或密码错误' : '登录失败：' + d.error, 'err'); return }
      setToken(d.token); setUser({ userid: d.userid, username: d.username })
      setStatus('登录成功', 'ok')
      await fetchConfig()
      renderLoggedIn()
    } catch (e) { setStatus('网络错误：' + e.message, 'err') }
  }

  async function doRegister(u, p) {
    setStatus('注册中…')
    try {
      const r = await fetch(apiUrl('/api/register'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) })
      const d = await r.json()
      if (!d.ok) { setStatus(d.error === 'username_exists' ? '用户名已存在' : '注册失败：' + d.error, 'err'); return }
      await doLogin(u, p)
    } catch (e) { setStatus('网络错误：' + e.message, 'err') }
  }

  function doLogout() { setToken(''); setUser(null); setStatus('已退出登录', 'ok'); renderAuthForm() }

  async function fetchConfig() {
    const token = getToken()
    if (!token || !cloud) return null
    try {
      const r = await fetch(apiUrl('/api/config'), { headers: { 'Authorization': 'Bearer ' + token } })
      const d = await r.json()
      if (d.ok) { localStorage.setItem('mkec_cloud_config', JSON.stringify(d.config || {})); return d.config }
    } catch (e) { console.warn('fetchConfig', e) }
    return null
  }

  function renderLoggedIn() {
    const user = getUser() || {}
    let cfg = {}
    try { cfg = JSON.parse(localStorage.getItem('mkec_cloud_config') || '{}') } catch {}
    cloudTabs.style.display = 'none'
    const initial = (user.username || '?').charAt(0).toUpperCase()
    cloudBody.innerHTML = `
      <div class="cloud-logged">
        <div class="cloud-avatar">${initial}</div>
        <div class="cloud-username">${user.username || ''}</div>
        <div class="cloud-userid">ID: ${user.userid || ''}</div>
      </div>
      <div class="cloud-config-info">
        <b>云端配置：</b><br/>
        主页：${cfg.homepage || '（未设置）'}<br/>
        主题：${cfg.theme || '（未设置）'}<br/>
        书签：${(cfg.bookmarks || []).length} 条
      </div>
      <button class="cloud-logout" id="cloudLogout">退出登录</button>`
    document.getElementById('cloudLogout').addEventListener('click', doLogout)
    setStatus('已同步云端配置', 'ok')
  }

  async function reportVersion() {
    if (!cloud || !cloud.reportOnStartup) return
    const plat = (navigator.platform || '').toLowerCase().includes('linux') ? 'linux' : 'win'
    try {
      await fetch(apiUrl('/api/version/report'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: '1.0.0', platform: plat, arch: 'x64' }) })
    } catch (e) { console.warn('reportVersion', e) }
  }

  btnCloud.addEventListener('click', openCloud)
  cloudClose.addEventListener('click', closeCloud)
  cloudModal.addEventListener('click', (e) => { if (e.target === cloudModal) closeCloud() })
  cloudTabs.addEventListener('click', (e) => { const t = e.target.closest('.cloud-tab'); if (t) switchTab(t.dataset.tab) })

  // ------------------------------------------------------------------
  // Cloudflare WARP 控制
  // ------------------------------------------------------------------
  const btnWarp = document.getElementById('btnWarp')
  const warpModal = document.getElementById('warpModal')
  const warpClose = document.getElementById('warpClose')
  const warpDohStatus = document.getElementById('warpDohStatus')
  const warpProxyStatus = document.getElementById('warpProxyStatus')
  const warpIpInfo = document.getElementById('warpIpInfo')
  const warpToggle = document.getElementById('warpToggle')
  const warpHint = document.getElementById('warpHint')

  let warpState = { proxyAvailable: false, proxyActive: false }

  async function refreshWarpStatus() {
    try {
      const s = await window.miaokeda.warp.status()
      warpState = s
      warpDohStatus.textContent = s.dohEnabled ? '已启用 · 1.1.1.1' : '未启用'
      warpDohStatus.className = 'warp-value ' + (s.dohEnabled ? 'warp-on' : 'warp-off')
      if (s.proxyActive) {
        warpProxyStatus.textContent = '已连接'
        warpProxyStatus.className = 'warp-value warp-active'
        warpToggle.textContent = '断开 WARP'
        warpToggle.classList.add('connected')
        warpHint.innerHTML = '流量已通过 Cloudflare WARP 加密隧道'
      } else if (s.proxyAvailable) {
        warpProxyStatus.textContent = '可用 · 未连接'
        warpProxyStatus.className = 'warp-value warp-on'
        warpToggle.textContent = '连接 WARP'
        warpToggle.classList.remove('connected')
        warpToggle.disabled = false
        warpHint.innerHTML = '检测到 WARP 客户端，点击连接启用加密代理'
      } else {
        warpProxyStatus.textContent = '未检测到客户端'
        warpProxyStatus.className = 'warp-value warp-off'
        warpToggle.textContent = '连接 WARP'
        warpToggle.classList.remove('connected')
        warpToggle.disabled = true
        warpHint.innerHTML = '请先安装 <a href="https://1.1.1.1" target="_blank">Cloudflare WARP 客户端</a> 并启动，代理端口 127.0.0.1:40000'
      }
    } catch (e) {
      warpProxyStatus.textContent = '状态未知'
    }
  }

  btnWarp.addEventListener('click', () => {
    warpModal.hidden = false
    refreshWarpStatus()
  })
  warpClose.addEventListener('click', () => { warpModal.hidden = true })
  warpModal.addEventListener('click', (e) => { if (e.target === warpModal) warpModal.hidden = true })

  warpToggle.addEventListener('click', async () => {
    warpToggle.disabled = true
    if (warpState.proxyActive) {
      const r = await window.miaokeda.warp.disconnect()
      if (r.ok) warpToggle.textContent = '已断开'
    } else {
      warpToggle.textContent = '连接中…'
      const r = await window.miaokeda.warp.connect()
      if (!r.ok) {
        warpHint.textContent = r.error || '连接失败'
        warpHint.style.color = '#d9534f'
      }
    }
    setTimeout(refreshWarpStatus, 500)
  })

  // ------------------------------------------------------------------
  // 无边框窗口三色球控制
  // ------------------------------------------------------------------
  const tlClose = document.getElementById('tlClose')
  const tlMin = document.getElementById('tlMin')
  const tlMax = document.getElementById('tlMax')
  tlClose.addEventListener('click', () => window.miaokeda?.window?.close())
  tlMin.addEventListener('click', () => window.miaokeda?.window?.minimize())
  tlMax.addEventListener('click', () => window.miaokeda?.window?.maximizeToggle())

  // 启动：上报版本 + 有 token 则自动拉取云端配置
  reportVersion()
  if (getToken()) fetchConfig()

  // 初始显示主页
  goHome()
})()
