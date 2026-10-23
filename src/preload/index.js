/**
 * 喵科大EC · preload 脚本
 * 通过 contextBridge 向渲染进程安全暴露品牌信息、配置能力与云端配置
 */
const { contextBridge, ipcRenderer } = require('electron')
const cloudConfig = require('../main/cloud-config')

contextBridge.exposeInMainWorld('miaokeda', {
  // 品牌信息
  meta: () => ipcRenderer.invoke('app:meta'),
  // 配置读写
  configGet: () => ipcRenderer.invoke('config:get'),
  configSet: (patch) => ipcRenderer.invoke('config:set', patch),
  // 窗口控制（无边框三色球）
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximizeToggle: () => ipcRenderer.invoke('window:maximize-toggle'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  // 云端 API 配置
  cloud: {
    baseUrl: cloudConfig.CLOUD_API_BASE,
    paths: cloudConfig.CLOUD_API_PATHS,
    reportOnStartup: cloudConfig.VERSION_REPORT_ON_STARTUP,
  },
  // Cloudflare WARP 集成
  warp: {
    status: () => ipcRenderer.invoke('warp:status'),
    connect: () => ipcRenderer.invoke('warp:connect'),
    disconnect: () => ipcRenderer.invoke('warp:disconnect'),
  },
})
