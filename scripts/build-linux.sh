#!/usr/bin/env bash
# 喵科大EC · Linux 便携打包（AppImage）
# 产物：dist/*.AppImage —— 免安装、双击即用、可整体拷入 U 盘
# 用法：bash scripts/build-linux.sh
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${VERSION:-$(node -p "require('./package.json').version")}"
echo "==> 打包 Linux AppImage  v${VERSION}"

export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
npx electron-builder --linux AppImage --x64

echo "==> 完成，产物："
ls -lh dist/*.AppImage
