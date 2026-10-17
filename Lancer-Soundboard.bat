@echo off
chcp 65001 > nul
echo ========================================================
echo   🎃 LANCEMENT DE LA SOUNDBOARD D'HALLOWEEN (LOCAL)
echo   Ouverture du serveur local pour activer la Stereo...
echo ========================================================
start "" "http://localhost:8080"
npx --yes serve -l 8080 .
