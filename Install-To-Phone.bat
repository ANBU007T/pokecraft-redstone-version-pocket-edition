@echo off
title PokéCRAFT PE - Phone Installer
echo ========================================================
echo   POKECRAFT PE - AUTOMATIC ANDROID PHONE INSTALLER
echo ========================================================
echo.

set ADB="C:\Users\anbu\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not exist %ADB% (
    set ADB=adb
)

echo [1/3] Detecting connected Android devices...
%ADB% devices
echo.

if not exist "%~dp0PokeCraft-PE.apk" (
    echo [ERROR] PokeCraft-PE.apk not found in this folder!
    pause
    exit /b 1
)

echo [2/3] Installing PokeCraft-PE.apk to your phone...
%ADB% install -r -d "%~dp0PokeCraft-PE.apk"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Installation failed!
    echo Please make sure USB Debugging is ON and your phone is unlocked.
    pause
    exit /b 1
)

echo.
echo [3/3] Launching PokéCRAFT PE on phone...
%ADB% shell am start -n com.pokecraft.pe/.MainActivity
echo.
echo ========================================================
echo   SUCCESS! POKÉCRAFT PE IS NOW RUNNING ON YOUR PHONE!
echo ========================================================
echo.
pause
