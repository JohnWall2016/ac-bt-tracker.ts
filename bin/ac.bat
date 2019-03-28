@ECHO OFF

SET "AC_BAT=%~dp0..\build\main\index.js"
node "%AC_BAT%" %*
