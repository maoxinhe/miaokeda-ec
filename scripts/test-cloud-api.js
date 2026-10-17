// 喵科大EC 云端 API 端到端测试（Node http 直连，绕过代理）
const http = require('http')

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: 8788,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => resolve({ status: res.statusCode, body: d }))
      }
    )
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

async function main() {
  console.log('=== 1. 健康检查 ===')
  console.log(await req('GET', '/api/health'))

  console.log('=== 2. 注册 ===')
  console.log(await req('POST', '/api/register', { username: 'testuser', password: 'testpass123' }))

  console.log('=== 3. 登录 ===')
  const login = await req('POST', '/api/login', { username: 'testuser', password: 'testpass123' })
  console.log(login)
  const token = JSON.parse(login.body).token

  console.log('=== 4. 保存配置 ===')
  console.log(
    await req(
      'PUT',
      '/api/config',
      { config: { homepage: 'https://example.com', theme: 'pink', bookmarks: [{ name: '测试', url: 'https://example.com' }] } },
      { Authorization: `Bearer ${token}` }
    )
  )

  console.log('=== 5. 读取配置 ===')
  console.log(await req('GET', '/api/config', null, { Authorization: `Bearer ${token}` }))

  console.log('=== 6. 未授权读取(应401) ===')
  console.log(await req('GET', '/api/config'))

  console.log('=== 7. 版本查询(当前0.9.0) ===')
  console.log(await req('GET', '/api/version?platform=win&version=0.9.0'))

  console.log('=== 8. 版本上报 ===')
  console.log(await req('POST', '/api/version/report', { version: '1.0.0', platform: 'linux', arch: 'x64' }))

  console.log('=== 9. 版本管理(admin更新win到1.1.0) ===')
  console.log(
    await req(
      'PUT',
      '/api/version',
      { platform: 'win', version: '1.1.0', url: 'https://example.com/win.exe', force: false },
      { 'X-Admin-Key': 'ak_bA636FVtGVqWTIgY1BBYWWrcLgd-eCMr' }
    )
  )

  console.log('=== 10. 再次版本查询(当前1.0.0,应提示更新) ===')
  console.log(await req('GET', '/api/version?platform=win&version=1.0.0'))
}

main().catch((e) => console.error('TEST_ERROR', e))
