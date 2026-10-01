# ==============================================================================
# JavaScope Phase 1 Quality Gate Verification Script (PowerShell)
# PRD Sections 12.4 & 12.5 Definition of Done Verification
# ==============================================================================
$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$WebDir = Join-Path $RootDir "apps\web"
$TracerDir = Join-Path $RootDir "services\tracer"
$ApiDir = Join-Path $RootDir "services\api"

$StartTime = Get-Date

$Results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Report-Gate {
    param(
        [string]$Name,
        [bool]$Success,
        [string]$Duration
    )
    $statusText = if ($Success) { "PASS" } else { "FAIL" }
    $color = if ($Success) { "Green" } else { "Red" }
    Write-Host "[$statusText] $Name ($Duration)" -ForegroundColor $color
    $Results.Add([PSCustomObject]@{
        Gate = $Name
        Status = $statusText
        Duration = $Duration
    })
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "            JavaScope Full Stack Verification Suite                   " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Working Directory: $RootDir"
Write-Host ""

# Gate 1: Tracer Unit & Golden Tests
$gateStart = Get-Date
Write-Host "--> Running Gate 1: Java Tracer Unit & Golden Tests..." -ForegroundColor Yellow
$proc = Start-Process -FilePath "mvn.cmd" -ArgumentList "test", "-B" -WorkingDirectory $TracerDir -NoNewWindow -Wait -PassThru
$gateDuration = [math]::Round(((Get-Date) - $gateStart).TotalSeconds, 2).ToString() + "s"
Report-Gate "1. Tracer Unit & Golden Tests" ($proc.ExitCode -eq 0) $gateDuration

# Gate 2: API Unit & Validation Tests
$gateStart = Get-Date
Write-Host "--> Running Gate 2: API Unit & Validation Tests..." -ForegroundColor Yellow
$proc = Start-Process -FilePath "mvn.cmd" -ArgumentList "test", "-B", "-Dtest=!HostileContainerTest" -WorkingDirectory $ApiDir -NoNewWindow -Wait -PassThru
$gateDuration = [math]::Round(((Get-Date) - $gateStart).TotalSeconds, 2).ToString() + "s"
Report-Gate "2. API Unit & Validation Tests" ($proc.ExitCode -eq 0) $gateDuration

# Gate 3: Docker Sandbox & Hostile Security Tests
$gateStart = Get-Date
Write-Host "--> Running Gate 3: Docker Hostile Security Suite..." -ForegroundColor Yellow
$secScript = Join-Path $ScriptDir "test-security.ps1"
$secSuccess = $false
if (Test-Path $secScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $secScript
    $secSuccess = ($LASTEXITCODE -eq 0)
} else {
    $secSuccess = $false
}
$gateDuration = [math]::Round(((Get-Date) - $gateStart).TotalSeconds, 2).ToString() + "s"
Report-Gate "3. Docker Hostile Security Suite" $secSuccess $gateDuration

# Gate 4: Frontend Lint
$gateStart = Get-Date
Write-Host "--> Running Gate 4: Web Frontend Lint..." -ForegroundColor Yellow
Push-Location $WebDir
$lintOutput = npm run lint 2>&1
$lintSuccess = ($LASTEXITCODE -eq 0)
Pop-Location
$gateDuration = [math]::Round(((Get-Date) - $gateStart).TotalSeconds, 2).ToString() + "s"
Report-Gate "4. Web Frontend Lint" $lintSuccess $gateDuration

# Gate 5: Frontend Unit & Component Tests (Vitest)
$gateStart = Get-Date
Write-Host "--> Running Gate 5: Web Frontend Unit & Component Tests (Vitest)..." -ForegroundColor Yellow
Push-Location $WebDir
$testOutput = npx vitest run 2>&1
$testSuccess = ($LASTEXITCODE -eq 0)
Pop-Location
$gateDuration = [math]::Round(((Get-Date) - $gateStart).TotalSeconds, 2).ToString() + "s"
Report-Gate "5. Web Frontend Unit & Component Tests" $testSuccess $gateDuration

# Gate 6: Frontend Production Build
$gateStart = Get-Date
Write-Host "--> Running Gate 6: Web Frontend Production Build..." -ForegroundColor Yellow
Push-Location $WebDir
$buildOutput = npm run build 2>&1
$buildSuccess = ($LASTEXITCODE -eq 0)
Pop-Location
$gateDuration = [math]::Round(((Get-Date) - $gateStart).TotalSeconds, 2).ToString() + "s"
Report-Gate "6. Web Frontend Production Build" $buildSuccess $gateDuration

# Gate 7: Playwright End-to-End & Visual Sanity Tests
$gateStart = Get-Date
Write-Host "--> Running Gate 7: Playwright E2E & Visual Sanity Suite..." -ForegroundColor Yellow
$apiJar = Join-Path $RootDir "services\api\target\api-1.0.0-SNAPSHOT.jar"
if (-not (Test-Path $apiJar)) {
    Write-Host "--> Packaging API and tracer JARs for E2E runner..."
    Start-Process -FilePath "mvn.cmd" -ArgumentList "package", "-DskipTests", "-B", "-pl", "services/tracer,services/api" -WorkingDirectory $RootDir -NoNewWindow -Wait
}
Push-Location $WebDir
$e2eOutput = npx playwright test 2>&1
$e2eSuccess = ($LASTEXITCODE -eq 0)
Pop-Location
$gateDuration = [math]::Round(((Get-Date) - $gateStart).TotalSeconds, 2).ToString() + "s"
Report-Gate "7. Playwright E2E & Visual Sanity" $e2eSuccess $gateDuration

# Final Summary Table
$TotalDuration = [math]::Round(((Get-Date) - $StartTime).TotalSeconds, 2).ToString() + "s"
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "                         VERIFICATION SUMMARY                         " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
$allPassed = $true
foreach ($res in $Results) {
    $col = if ($res.Status -eq "PASS") { "Green" } else { "Red"; $allPassed = $false }
    Write-Host ("  {0,-40} : [{1}] ({2})" -f $res.Gate, $res.Status, $res.Duration) -ForegroundColor $col
}
Write-Host "----------------------------------------------------------------------"
Write-Host "Total Execution Time: $TotalDuration"
if ($allPassed) {
    Write-Host ">>> ALL QUALITY GATES PASSED! Ready for deployment. <<<" -ForegroundColor Green
    exit 0
} else {
    Write-Host ">>> SOME QUALITY GATES FAILED. Check logs above. <<<" -ForegroundColor Red
    exit 1
}
