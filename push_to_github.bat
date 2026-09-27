@echo off
echo =========================================================
echo Pushing SwasthFlow AI to GitHub account: Ieshuanand
echo Repository: https://github.com/Ieshuanand/SwasthFlow-AI-sarthak
echo =========================================================
echo.
echo Pushing branch 'main' to origin...
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Code pushed successfully to GitHub!
    echo Refresh your browser at: https://github.com/Ieshuanand/SwasthFlow-AI-sarthak
) else (
    echo.
    echo [NOTE] If it failed with 403 or Permission Denied:
    echo 1. Open Windows 'Credential Manager' from the Start menu.
    echo 2. Go to 'Windows Credentials' and remove 'git:https://github.com'.
    echo 3. Run this file again and sign in as 'Ieshuanand' when the browser opens.
)
echo.
pause
