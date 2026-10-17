#!/usr/bin/env bash
# 喵科大EC · Windows 便携打包（portable，免安装）
# 注意：Windows 便携 exe 需要 Windows 工具链，请在 Windows 本机或 Windows CI 上执行。
# 产物命名（可自定义）：喵科大EC_<版本>_<架构>_便携版.exe
# 用法：
#   bash scripts/build-win.sh                 # x64，默认命名
#   VERSION=1.2.0 ARCH=x64 OUT_NAME=MyEC bash scripts/build-win.sh
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${VERSION:-$(node -p "require('./package.json').version")}"
ARCH="${ARCH:-x64}"
OUT_NAME="${OUT_NAME:-喵科大EC_${VERSION}_${ARCH}_便携版}"

export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
echo "==> 打包 Windows portable  v${VERSION} ${ARCH}"

npx electron-builder --win portable --${ARCH}

# 重命名产物为规范格式
EXE=$(ls -1 dist/*.exe 2>/dev/null | head -1 || true)
if [ -n "$EXE" ]; then
  mv -f "$EXE" "dist/${OUT_NAME}.exe"
  echo "==> 完成，产物：dist/${OUT_NAME}.exe"
else
  echo "==> 未找到 exe，请检查打包输出"
  exit 1
fi
