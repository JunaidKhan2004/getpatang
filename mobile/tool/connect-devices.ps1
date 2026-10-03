# Points 127.0.0.1:4000 (API) and 127.0.0.1:3000 (website) on every connected Android device
# at this computer, over USB. Works for real phones and emulators; run again after reconnecting a phone.
#   powershell -File mobile/tool/connect-devices.ps1

$adb = Join-Path $env:LOCALAPPDATA 'Android\sdk\platform-tools\adb.exe'
if ($env:ANDROID_HOME) { $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' }
if (-not (Test-Path $adb)) { $adb = 'adb' }

$devices = & $adb devices | Select-String -Pattern '^(\S+)\s+device$' | ForEach-Object { $_.Matches[0].Groups[1].Value }
if (-not $devices) {
  Write-Host 'No Android device connected. Plug in the phone (USB debugging on) or start an emulator.'
  exit 0
}
foreach ($d in $devices) {
  & $adb -s $d reverse tcp:4000 tcp:4000 | Out-Null
  & $adb -s $d reverse tcp:3000 tcp:3000 | Out-Null
  Write-Host "$d -> local API (4000) and website (3000)"
}
