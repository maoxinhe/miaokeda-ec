/**
 * 喵科大EC · 独立云端（Cloudflare Worker + KV）
 * 功能：账号注册/登录、配置下发、版本检测与上报、版本管理（admin）
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Key',
}

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 天

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}

async function readBody(req) {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

function randomHex(len = 16) {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}

// 版本号比较：a > b 返回 1，相等 0，小于 -1（支持 1.2.3 格式）
function cmpVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

// ---------------------------------------------------------------------------
// 认证：从 Authorization Bearer 取 token，查 KV，返回 userid
// ---------------------------------------------------------------------------
async function authUser(env, req) {
  const h = req.headers.get('Authorization') || ''
  const token = h.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const rec = await env.MKEC_KV.get(`token:${token}`, { type: 'json' })
  if (!rec) return null
  if (rec.expiresAt && rec.expiresAt < Date.now()) return null
  return rec.userid
}

async function getLatestVersions(env) {
  const v = await env.MKEC_KV.get('version:latest', { type: 'json' })
  return v || {
    win: { version: '1.0.0', url: '', force: false, date: '' },
    linux: { version: '1.0.0', url: '', force: false, date: '' },
  }
}

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)
    const path = url.pathname

    // ---------- 健康检查 ----------
    if (path === '/' || path === '/api/health') {
      return json({ ok: true, service: 'miaokeda-ec-cloud', time: Date.now() })
    }

    // ---------- 注册 ----------
    if (path === '/api/register' && request.method === 'POST') {
      const { username, password } = await readBody(request)
      if (!username || !password) return json({ error: 'missing_fields' }, 400)
      if (username.length < 3 || username.length > 32) return json({ error: 'username_length' }, 400)
      if (password.length < 6) return json({ error: 'password_too_short' }, 400)

      const exists = await env.MKEC_KV.get(`user:${username}`)
      if (exists) return json({ error: 'username_exists' }, 409)

      const salt = randomHex(16)
      const passwordHash = await hashPassword(password, salt)
      const userid = crypto.randomUUID()

      await env.MKEC_KV.put(`user:${username}`, JSON.stringify({
        userid, username, passwordHash, salt, createdAt: Date.now(),
      }))

      return json({ ok: true, userid, username })
    }

    // ---------- 登录 ----------
    if (path === '/api/login' && request.method === 'POST') {
      const { username, password } = await readBody(request)
      if (!username || !password) return json({ error: 'missing_fields' }, 400)

      const user = await env.MKEC_KV.get(`user:${username}`, { type: 'json' })
      if (!user) return json({ error: 'invalid_credentials' }, 401)

      const passwordHash = await hashPassword(password, user.salt)
      if (passwordHash !== user.passwordHash) return json({ error: 'invalid_credentials' }, 401)

      const token = crypto.randomUUID()
      await env.MKEC_KV.put(`token:${token}`, JSON.stringify({
        userid: user.userid,
        username: user.username,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      }))

      return json({ ok: true, token, userid: user.userid, username: user.username })
    }

    // ---------- 配置读取 ----------
    if (path === '/api/config' && request.method === 'GET') {
      const userid = await authUser(env, request)
      if (!userid) return json({ error: 'unauthorized' }, 401)

      const config = await env.MKEC_KV.get(`config:${userid}`, { type: 'json' })
      return json({ ok: true, userid, config: config || {} })
    }

    // ---------- 配置保存 ----------
    if (path === '/api/config' && request.method === 'PUT') {
      const userid = await authUser(env, request)
      if (!userid) return json({ error: 'unauthorized' }, 401)

      const body = await readBody(request)
      const config = body.config || body
      await env.MKEC_KV.put(`config:${userid}`, JSON.stringify({
        ...config,
        updatedAt: Date.now(),
      }))
      return json({ ok: true, userid })
    }

    // ---------- 版本查询 ----------
    if (path === '/api/version' && request.method === 'GET') {
      const platform = (url.searchParams.get('platform') || 'win').toLowerCase()
      const current = url.searchParams.get('version') || ''
      const latest = await getLatestVersions(env)
      const info = latest[platform] || latest.win
      const updateAvailable = current ? cmpVersion(info.version, current) > 0 : false
      return json({ ok: true, platform, latest: info, updateAvailable })
    }

    // ---------- 版本上报（启动时调用） ----------
    if (path === '/api/version/report' && request.method === 'POST') {
      const { version, platform, arch } = await readBody(request)
      const latest = await getLatestVersions(env)
      const p = (platform || 'win').toLowerCase()
      const info = latest[p] || latest.win
      const updateAvailable = version ? cmpVersion(info.version, version) > 0 : false
      return json({
        ok: true,
        reported: { version, platform: p, arch: arch || 'x64', at: Date.now() },
        latest: info,
        updateAvailable,
      })
    }

    // ---------- 版本管理（admin，需 X-Admin-Key） ----------
    if (path === '/api/version' && request.method === 'PUT') {
      const adminKey = request.headers.get('X-Admin-Key') || ''
      if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
        return json({ error: 'forbidden' }, 403)
      }
      const body = await readBody(request)
      const platform = (body.platform || 'win').toLowerCase()
      const latest = await getLatestVersions(env)
      latest[platform] = {
        version: body.version || latest[platform].version,
        url: body.url || latest[platform].url || '',
        force: !!body.force,
        date: body.date || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      }
      await env.MKEC_KV.put('version:latest', JSON.stringify(latest))
      return json({ ok: true, latest })
    }

    return json({ error: 'not_found', path }, 404)
  },
}
