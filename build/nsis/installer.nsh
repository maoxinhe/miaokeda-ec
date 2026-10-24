; 喵科大EC · NSIS 安装器定制脚本（安全子集）
;
; 注入时机：本脚本由 electron-builder 在模板（含 !include "MUI2.nsh"）之前
; 通过 scriptGenerator.include() 注入。因此只能做“MUI2 加载时用 !ifndef 读取”的
; 预定义。务必遵守以下红线，避免与 electron-builder 冲突导致构建失败：
;   1. 绝不在此 !include "MUI2.nsh"（模板会再 include，重复加载报错）；
;   2. 绝不 !insertmacro MUI_LANGUAGE（模板已按语言配置处理）；
;   3. 绝不重定义 MUI_ICON / MUI_UNICON（electron-builder 用命令行 -D 注入，见 installerIcon 配置）；
;   4. 绝不重定义 MUI_WELCOMEFINISHPAGE_BITMAP / MUI_UNWELCOMEFINISHPAGE_BITMAP
;      （electron-builder 由 installerSidebar / uninstallerSidebar 选项注入，本工程已配置为 build/nsis/sidebar.bmp）；
;   5. 绝不定义 MUI_FINISHPAGE_RUN（assistedInstaller.nsh 已处理 runAfterFinish）。

; ---------------------------------------------------------------
; 安装中止前二次确认：避免误触取消，专业安装器行为
; ---------------------------------------------------------------
!define MUI_ABORTWARNING

; ---------------------------------------------------------------
; 欢迎页文案（MUI2 使用 !ifndef 保护，预定义生效并覆盖默认值）
; ---------------------------------------------------------------
!define MUI_WELCOMEPAGE_TITLE "欢迎安装 喵科大EC"
!define MUI_WELCOMEPAGE_TEXT "这款浏览器基于 Chromium 内核，轻量、快速、跨平台。$\r$\n$\r$\n安装完成后，可从开始菜单或桌面快捷方式启动。$\r$\n$\r$\n点击「下一步」继续。"

; ---------------------------------------------------------------
; 完成页文案
; ---------------------------------------------------------------
!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "喵科大EC 已成功安装。$\r$\n$\r$\n感谢您的使用。$\r$\n$\r$\n点击「完成」立即启动。"

; ---------------------------------------------------------------
; 卸载确认页文案
; ---------------------------------------------------------------
!define MUI_UNCONFIRMPAGE_TEXT_TOP "即将从您的计算机移除 喵科大EC。"
!define MUI_UNCONFIRMPAGE_TEXT_LOCATION "将移除以下文件夹："
