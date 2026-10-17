@echo off
chcp 65001 > nul
echo ========================================================
echo   🎃 MISE A JOUR AUTOMATIQUE DES SONS (PC -> GITHUB)
echo ========================================================
echo 1. Scan du dossier "sounds/" et calcul des durees...
node generate-sounds.js

echo.
echo 2. Verification de Git...
git status >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Git n'est pas encore connecte a GitHub dans ce dossier.
    echo Les fichiers sounds.json et sounds-data.js ont bien ete mis a jour localement !
    pause
    exit /b
)

echo 3. Envoi des nouveaux sons vers GitHub Pages...
git add .
git commit -m "Mise a jour de la banque de sons Halloween"
git push
echo.
echo ✅ Termine ! Vos telephones et tablettes recevront les nouveaux sons d'ici 1 minute.
pause
