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
  // 云端 API 配置
  cloud: {
    baseUrl: cloudConfig.CLOUD_API_BASE,
    paths: cloudConfig.CLOUD_API_PATHS,
    reportOnStartup: cloudConfig.VERSION_REPORT_ON_STARTUP,
  },
})
