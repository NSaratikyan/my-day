@echo off
setlocal
cd /d "%~dp0"
set "taskNode="
for /f "delims=" %%N in ('where node.exe 2^>nul') do set "taskNode=%%N"
if not defined taskNode (
  for /d %%D in ("%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*") do (
    if exist "%%~D\bin\node.exe" set "taskNode=%%~D\bin\node.exe"
  )
)
if not defined taskNode (
  echo Install Node.js 22.12 or later, then run this script again.
  exit /b 1
)
"%taskNode%" "%~dp0scripts\run.mjs" "%~1"
