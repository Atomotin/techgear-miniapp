# Запуск TechGear на этом компьютере для проверки в Telegram с ТЕСТОВЫМ ботом.
#
#   npm run start:local
#   (или: powershell -ExecutionPolicy Bypass -File .\start-local.ps1)
#
# Настройки берутся из local.env (файл не попадает в git).
# Скрипт поднимает туннель cloudflared, передаёт его адрес серверу и
# запускает server.js. Остановка: Ctrl+C (туннель тоже закроется).

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$EnvFile = Join-Path $PSScriptRoot "local.env"
$TunnelLog = Join-Path $env:TEMP "techgear-cloudflared.log"
$TunnelOutLog = Join-Path $env:TEMP "techgear-cloudflared.out.log"

function New-RandomSecret {
    param([int]$Bytes = 24)
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return ([BitConverter]::ToString($buffer) -replace "-", "").ToLower()
}

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

# --- 1. Файл настроек --------------------------------------------------------
if (-not (Test-Path $EnvFile)) {
    $template = @"
# Настройки для локального запуска (start-local.ps1). Этот файл не попадает в git.

# Токен ТЕСТОВОГО бота из @BotFather. Не вставляй сюда токен настоящего бота
# магазина: сервер при запуске переключит бота на этот компьютер.
TELEGRAM_BOT_TOKEN=

# Пароль для входа в /admin. Сгенерирован автоматически, можно заменить (12+ символов).
ADMIN_PASSWORD=$(New-RandomSecret 12)

# Ключ подписи токенов админки. Менять не нужно.
ADMIN_SECRET=$(New-RandomSecret 32)

# Необязательно: твой chat ID (узнать у @userinfobot), чтобы получать уведомления менеджера.
TELEGRAM_MANAGER_CHAT_ID=

PORT=3000
"@
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($EnvFile, $template, $utf8NoBom)

    Write-Host "Создан файл настроек: $EnvFile" -ForegroundColor Yellow
    Write-Host "Вставь в него токен тестового бота (TELEGRAM_BOT_TOKEN=...), сохрани и запусти скрипт ещё раз."
    Start-Process notepad.exe $EnvFile
    exit 1
}

$settings = @{}
foreach ($line in [System.IO.File]::ReadAllLines($EnvFile)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) { continue }
    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim().Trim('"')
    $settings[$key] = $value
}

$token = [string]$settings["TELEGRAM_BOT_TOKEN"]
if ($token -notmatch '^\d+:[A-Za-z0-9_-]{30,}$') {
    Write-Host "В local.env нет корректного TELEGRAM_BOT_TOKEN." -ForegroundColor Red
    Write-Host "Открой $EnvFile и вставь токен тестового бота от @BotFather."
    exit 1
}

if (-not $settings["ADMIN_PASSWORD"]) {
    Write-Host "В local.env пустой ADMIN_PASSWORD." -ForegroundColor Red
    exit 1
}

$port = 3000
if ($settings["PORT"]) { $port = [int]$settings["PORT"] }

# --- 2. Проверки ----------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Не найден Node.js. Установи его: winget install OpenJS.NodeJS.LTS" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "Не найден cloudflared (нужен для HTTPS-адреса, который видит Telegram)." -ForegroundColor Red
    Write-Host "Установи его командой:"
    Write-Host "    winget install --id Cloudflare.cloudflared -e"
    Write-Host "Потом закрой и снова открой терминал и запусти скрипт ещё раз."
    exit 1
}

$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "Порт $port уже занят (PID $($busy[0].OwningProcess)). Останови другой сервер или поменяй PORT в local.env." -ForegroundColor Red
    exit 1
}

# --- 3. Туннель -----------------------------------------------------------
Write-Step "Запускаю туннель cloudflared..."
Remove-Item $TunnelLog, $TunnelOutLog -ErrorAction SilentlyContinue
$tunnel = Start-Process -FilePath "cloudflared" `
    -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:$port") `
    -RedirectStandardError $TunnelLog `
    -RedirectStandardOutput $TunnelOutLog `
    -WindowStyle Hidden `
    -PassThru

$publicUrl = ""
for ($i = 0; $i -lt 60 -and -not $publicUrl; $i++) {
    Start-Sleep -Milliseconds 500
    if ($tunnel.HasExited) { break }
    foreach ($logPath in @($TunnelLog, $TunnelOutLog)) {
        if (Test-Path $logPath) {
            $match = Select-String -Path $logPath -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($match) { $publicUrl = $match.Matches[0].Value }
        }
    }
}

if (-not $publicUrl) {
    Write-Host "Не удалось получить адрес туннеля. Последние строки лога:" -ForegroundColor Red
    if (Test-Path $TunnelLog) { Get-Content $TunnelLog -Tail 15 }
    if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
    exit 1
}

# Новому адресу нужно несколько секунд, чтобы появиться в DNS. Иначе Telegram
# не примет вебхук при запуске сервера.
$tunnelHost = ([Uri]$publicUrl).Host
for ($i = 0; $i -lt 30; $i++) {
    try {
        [System.Net.Dns]::GetHostAddresses($tunnelHost) | Out-Null
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
Start-Sleep -Seconds 3

# --- 4. Сервер ------------------------------------------------------------
foreach ($key in $settings.Keys) {
    Set-Item -Path "env:$key" -Value $settings[$key]
}
# Обязательные настройки для запуска за туннелем:
$env:PUBLIC_BASE_URL = $publicUrl
$env:PORT = "$port"
$env:HOST = "127.0.0.1"   # только через туннель, не из локальной сети
$env:TRUST_PROXY = "true" # настоящий IP клиента из заголовка туннеля (для лимитов)

Write-Host ""
Write-Host "Магазин доступен по адресу: $publicUrl" -ForegroundColor Green
Write-Host "Админка: http://localhost:$port/admin  (пароль: ADMIN_PASSWORD в local.env)"
Write-Host "Открой тестового бота в Telegram, отправь /start и нажми кнопку «Магазин»."
Write-Host "Если бот не отвечает, останови скрипт (Ctrl+C) и запусти снова: у туннеля будет новый адрес."
Write-Host "Остановить: Ctrl+C"
Write-Host ""

try {
    & node server.js
} finally {
    if ($tunnel -and -not $tunnel.HasExited) {
        Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Туннель остановлен."
}
