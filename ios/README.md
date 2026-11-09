# Gastos no iPhone (xtool)

App iOS que empacota o site estático do Next (`out/`) e abre num `WKWebView`. Não há servidor nem Supabase: tudo fica no `localStorage` do app, dentro do iPhone.

## Como funciona

- `Package.swift` + `xtool.yml`: projeto SwiftPM que o [xtool](https://xtool.sh) transforma em app iOS (bundle `com.kelvinbellan.gastos`).
- `Resources/AppIcon.png`: ícone do app (1024x1024, sem transparência), gerado a partir de `Resources/AppIcon.svg`.
- `Sources/GastosApp/Web/`: cópia de `out/`, gerada por `npm run build:ios`. Não vai para o git.
- `WebAppView.swift`: serve os arquivos pelo esquema `gastos://localhost`. O Next usa caminhos absolutos (`/_next/...`), que quebram em `file://`, e a origem fixa mantém o `localStorage` entre aberturas.
- Exportar no botão Backup abre a folha de compartilhar do iOS (salvar em Arquivos, AirDrop...). Importar usa o seletor de arquivos normal.
- A tela só rola na vertical: o zoom fica desligado dentro do app (o site no navegador continua ampliável) e o deslocamento horizontal é travado no `WebAppView.swift`.
- `confirm()`/`alert()` do site viram alertas nativos.
- A câmera e as fotos (leitura de cupom) pedem permissão na primeira vez.
- `DueAlerts.swift`: agenda os avisos de vencimento como notificações locais, com a lista calculada em `src/lib/dueAlerts.js`. Não usa push remoto, que exigiria servidor e Apple Developer Program pago.

O OCR (tesseract.js) baixa o motor e os idiomas da internet na primeira leitura de cupom. O resto do app funciona offline.

## Preparar o Windows (uma vez)

1. **WSL com Ubuntu**, num PowerShell como administrador, e reinicie o PC:
   ```powershell
   wsl --install -d Ubuntu
   ```
2. **USB do iPhone no WSL** ([guia da Microsoft](https://learn.microsoft.com/en-us/windows/wsl/connect-usb)):
   ```powershell
   winget install --interactive --exact dorssel.usbipd-win
   ```
   Instale também o **iTunes** ou os **Dispositivos Apple** (Microsoft Store) para o Windows reconhecer o iPhone.
3. **Swift, usbmuxd e xtool** dentro do Ubuntu:
   ```bash
   bash /mnt/c/Users/kelvi/OneDrive/Documentos/gastos-app/gastos-app/ios/setup-wsl.sh
   ```
4. **Xcode.xip**: baixe o Xcode 27.1 em <https://developer.apple.com/download/all/?q=Xcode> (pede login Apple). Só o arquivo é usado, não precisa de Mac.
5. **Login e SDK**, no Ubuntu:
   ```bash
   xtool setup
   ```
   Escolha `1: Password` se não paga o Apple Developer Program. Depois informe o caminho do `.xip`, ex.: `/mnt/c/Users/kelvi/Downloads/Xcode_27.1.xip`.

## Instalar no iPhone

1. No iPhone: **Ajustes > Privacidade e Segurança > Modo de Desenvolvedor** ligado (reinicia o aparelho).
2. Conecte o cabo e, num PowerShell como administrador, passe o iPhone para o WSL:
   ```powershell
   usbipd list                       # anote o BUSID do "Apple Mobile Device"
   usbipd bind --busid <BUSID>       # so na primeira vez
   usbipd attach --wsl --busid <BUSID>
   ```
3. No Windows, gere o site e copie para o app:
   ```bash
   npm run build:ios
   ```
4. No Ubuntu:
   ```bash
   cd /mnt/c/Users/kelvi/OneDrive/Documentos/gastos-app/gastos-app/ios
   xtool devices    # o iPhone deve aparecer
   xtool dev        # compila, assina e instala
   ```
   A primeira compilação demora (o SDK compila os módulos do sistema).
5. Na primeira abertura: **Ajustes > Geral > VPN e Gerenciamento de Dispositivos > confie no seu Apple ID**.

Para atualizar o app depois de mudar o código, repita os passos 3 e 4. Os dados continuam no iPhone porque o bundle ID não muda.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `xtool devices` vazio | Rode de novo o `usbipd attach`. No Ubuntu, `sudo usbmuxd -f -v` em outro terminal mostra se o iPhone conectou. Desbloqueie o iPhone e toque em "Confiar". |
| `AFCClient.Error.muxError` | Use a alternativa pelo iTunes do Windows descrita [nesta issue](https://github.com/xtool-org/xtool/issues/19#issuecomment-2898986718). |
| "Desenvolvedor não confiável" | Ajustes > Geral > VPN e Gerenciamento de Dispositivos > Confiar. |
| App para de abrir após 7 dias | Com Apple ID gratuito a assinatura vale 7 dias. Rode `xtool dev` de novo; os dados ficam. |
| Aviso de vencimento não chega | Abra o sino e use "Enviar aviso de teste". Se aparecer o bloqueio, libere em Ajustes, nas Notificações do app. Com Apple ID gratuito, reinstale antes dos 7 dias para o app continuar válido. |
| Tela branca / "Pasta Web ausente" | Faltou `npm run build:ios` antes do `xtool dev`. |
| Dados sumiram | Só se o app foi apagado do iPhone. Exporte backups de vez em quando. |
