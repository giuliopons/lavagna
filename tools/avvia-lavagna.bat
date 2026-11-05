@echo off
setlocal
title Lavagna
cd /d "%~dp0"

set "PORT=8765"
set "FILE=lavagna-a-mano-libera.html"
set "URL=http://localhost:%PORT%/%FILE%"

if not exist "%FILE%" (
  echo Non trovo %FILE% in questa cartella.
  echo Metti questo file .bat nella stessa cartella della lavagna.
  pause
  exit /b 1
)

rem Se il server e' gia' attivo apre solo la pagina
netstat -an | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 goto apri

where php >nul 2>&1
if not errorlevel 1 (
  start "Server lavagna - chiudi per fermare" /min php -S localhost:%PORT%
  goto attendi
)

py --version >nul 2>&1
if not errorlevel 1 (
  start "Server lavagna - chiudi per fermare" /min py -m http.server %PORT% --bind 127.0.0.1
  goto attendi
)

python --version >nul 2>&1
if not errorlevel 1 (
  start "Server lavagna - chiudi per fermare" /min python -m http.server %PORT% --bind 127.0.0.1
  goto attendi
)

echo Non trovo ne' PHP ne' Python tra i programmi disponibili.
echo Installa uno dei due, oppure aggiungi php.exe al PATH, e riprova.
pause
exit /b 1

:attendi
timeout /t 1 /nobreak >nul

:apri
if exist "%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe" (
  start "" "%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe" --new-window "%URL%"
) else (
  start "" "%URL%"
)

rem Aspetta la finestra della lavagna e la mette a tutto schermo con F11.
rem Se non la trova non invia nulla, cosi' il tasto non finisce in un altro programma.
powershell -NoProfile -WindowStyle Hidden -Command "$w = New-Object -ComObject WScript.Shell; for ($i = 0; $i -lt 40; $i++) { if ($w.AppActivate('Lavagna a mano libera')) { Start-Sleep -Milliseconds 400; $w.SendKeys('{F11}'); break }; Start-Sleep -Milliseconds 250 }"
endlocal
