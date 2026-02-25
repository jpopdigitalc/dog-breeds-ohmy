@echo off
echo Starting game server...
echo.
echo If you have Node.js installed, trying http-server...
npx --yes http-server -p 8000 2>nul
if errorlevel 1 (
    echo.
    echo Node.js not found. Trying Python...
    python -m http.server 8000 2>nul
    if errorlevel 1 (
        echo.
        echo Python not found. Trying Python3...
        python3 -m http.server 8000 2>nul
        if errorlevel 1 (
            echo.
            echo No server found. Please install Node.js or Python.
            echo Or just open index.html directly in your browser.
            pause
        )
    )
)
