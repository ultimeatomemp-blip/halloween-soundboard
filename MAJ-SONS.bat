@echo off
chcp 65001 > nul
title Halloween FX - Mise a jour automatique des sons
cd /d "%~dp0"
echo ========================================================
echo   HALLOWEEN FX - SCAN DU DOSSIER "sounds" EN COURS...
echo ========================================================
echo.
node generate-sounds.js
echo.
echo ========================================================
echo   TERMINE ! Les fichiers sounds.json et sounds-data.js
echo   ont ete mis a jour avec tous vos nouveaux sons.
echo   Il ne vous reste plus qu'a cliquer sur "Commit" puis
echo   "Push origin" dans GitHub Desktop !
echo ========================================================
echo.
pause
