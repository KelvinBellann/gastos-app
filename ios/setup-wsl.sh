#!/usr/bin/env bash
# Instala o necessario para compilar o app iOS com xtool dentro do WSL (Ubuntu), seguindo
# https://xtool.sh/documentation/xtooldocs/installation-linux. Rode dentro do Ubuntu:
#   bash /mnt/c/Users/kelvi/OneDrive/Documentos/gastos-app/gastos-app/ios/setup-wsl.sh
# Depois disso falta so o `xtool setup` (login Apple + Xcode.xip), que e interativo.
set -euo pipefail

echo "==> Pacotes do sistema (usbmuxd para falar com o iPhone, FUSE para o AppImage)"
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg usbmuxd libimobiledevice-utils
sudo apt-get install -y libfuse2t64 || sudo apt-get install -y libfuse2

echo "==> Swift 6.4 via swiftly"
if ! command -v swiftly >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  curl -fsSL "https://download.swift.org/swiftly/linux/swiftly-$(uname -m).tar.gz" -o "$tmp/swiftly.tar.gz"
  tar -xzf "$tmp/swiftly.tar.gz" -C "$tmp"
  "$tmp/swiftly" init --assume-yes --skip-install --quiet-shell-followup
  rm -rf "$tmp"
fi
# shellcheck disable=SC1091
. "${SWIFTLY_HOME_DIR:-$HOME/.local/share/swiftly}/env.sh"
hash -r
swiftly install --assume-yes --use 6.4
swift --version

echo "==> xtool"
curl -fL "https://github.com/xtool-org/xtool/releases/latest/download/xtool-$(uname -m).AppImage" -o /tmp/xtool
chmod +x /tmp/xtool
sudo mv /tmp/xtool /usr/local/bin/xtool
xtool --help | head -3

cat <<'EOF'

Pronto. Proximos passos (interativos):
  1. Baixe o Xcode 27.1 (.xip) em https://developer.apple.com/download/all/?q=Xcode
  2. Rode `xtool setup`, faca login com seu Apple ID e informe o caminho do Xcode.xip
     (ex.: /mnt/c/Users/kelvi/Downloads/Xcode_27.1.xip)
  3. Conecte o iPhone (veja ios/README.md: usbipd no Windows) e rode, na pasta do projeto:
       cd ios && xtool dev
EOF
