/**
 * 喵科大EC · 云端 API 配置
 * 自定义域名已绑定 Cloudflare Worker：https://api.mcy.camzy.uno
 * 开发测试时可用环境变量 MIAOKEDA_CLOUD_API 覆盖为本地地址
 */
module.exports = {
  CLOUD_API_BASE: process.env.MIAOKEDA_CLOUD_API || 'https://api.mcy.camzy.uno',

  CLOUD_API_PATHS: {
    health: '/api/health',
    register: '/api/register',
    login: '/api/login',
    config: '/api/config',
    version: '/api/version',
    versionReport: '/api/version/report',
  },

  VERSION_REPORT_ON_STARTUP: true,
}
