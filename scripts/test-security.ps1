# Automated security test runner script verifying hostile program containment (PowerShell)
$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$SecurityDir = Join-Path $RootDir "tests\security"
$RunSandbox = Join-Path $ScriptDir "run-sandbox.ps1"

$Passed = 0
$Failed = 0
$Total = 0

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "          JavaScope Hostile Security Test Suite           " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

function Run-SecurityTest {
    param(
        [string]$TestName,
        [scriptblock]$CheckBlock
    )

    $global:Total++
    Write-Host -NoNewline "Running [$TestName] ... "

    $testFile = Join-Path $SecurityDir "$TestName.java"
    if (-not (Test-Path $testFile)) {
        Write-Host "FAIL (Source file not found: $testFile)" -ForegroundColor Red
        $global:Failed++
        return
    }

    $source = Get-Content -Raw $testFile

    # Launch subprocess with hard 20-second timeout using asynchronous stream drainage
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$RunSandbox`""
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Write($source)
    $proc.StandardInput.Close()

    # Asynchronously drain stdout and stderr to prevent pipe buffer deadlocks
    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()

    $finished = $proc.WaitForExit(20000)
    $output = ""
    $exitCode = 0

    if ($finished) {
        $output = $stdoutTask.GetAwaiter().GetResult()
        $err = $stderrTask.GetAwaiter().GetResult()
        $exitCode = $proc.ExitCode
    } else {
        try { $proc.Kill($true) } catch {}
        $exitCode = 124
        $output = "Timed out after 20 seconds"
    }

    # Verify no container was left running
    $runningContainers = @()
    $hasNativeDocker = Get-Command docker -ErrorAction SilentlyContinue
    if ($hasNativeDocker) {
        $runningContainers = docker ps -q --filter "ancestor=javascope-sandbox:latest"
        if ($runningContainers) {
            docker kill $runningContainers | Out-Null
        }
    } else {
        $runningContainers = wsl -u root docker ps -q --filter "ancestor=javascope-sandbox:latest"
        if ($runningContainers) {
            wsl -u root docker kill $runningContainers | Out-Null
        }
    }

    if ($runningContainers) {
        Write-Host "FAIL (Container left running: $runningContainers)" -ForegroundColor Red
        $global:Failed++
        return
    }

    # Execute validation check
    $ok = & $CheckBlock $exitCode $output
    if ($ok) {
        Write-Host "PASS" -ForegroundColor Green
        $global:Passed++
    } else {
        Write-Host "FAIL" -ForegroundColor Red
        Write-Host "--- Output (first 30 lines) ---" -ForegroundColor Yellow
        $output.Split("`n") | Select-Object -First 30 | ForEach-Object { Write-Host $_ }
        Write-Host "-------------------------------" -ForegroundColor Yellow
        $global:Failed++
    }
}

# 1. InfiniteLoop: times out cleanly with time_limit truncation
Run-SecurityTest "InfiniteLoop" {
    param($code, $out)
    return ($out -match '"status"\s*:\s*"truncated"' -and $out -match '"reason"\s*:\s*"time_limit"')
}

# 2. ThreadBomb: blocked as unsupported multithreading
Run-SecurityTest "ThreadBomb" {
    param($code, $out)
    return ($out -match '"status"\s*:\s*"unsupported"' -and $out -match "Multithreaded programs are not supported")
}

# 3. MemoryBomb: throws OutOfMemoryError or hits container ceiling cleanly
Run-SecurityTest "MemoryBomb" {
    param($code, $out)
    return ($out -match "OutOfMemoryError" -or $code -eq 137)
}

# 4. DeepRecursion: truncated by 200 depth limit
Run-SecurityTest "DeepRecursion" {
    param($code, $out)
    return ($out -match '"status"\s*:\s*"truncated"' -and $out -match '"reason"\s*:\s*"depth_limit"')
}

# 5. NetworkAttempt: network socket blocked by --network none
Run-SecurityTest "NetworkAttempt" {
    param($code, $out)
    return ($out -match "Network access blocked as expected")
}

# 6. FileAccess: write outside /tmp blocked by --read-only, write in /tmp succeeds
Run-SecurityTest "FileAccess" {
    param($code, $out)
    return ($out -match "writeOutsideFailed=true, writeTmpSuccess=true")
}

# 7. ProcessSpawn: process execution blocked
Run-SecurityTest "ProcessSpawn" {
    param($code, $out)
    return ($out -match "Process spawn failed as expected")
}

# 8. SystemExit: exits cleanly with status ok
Run-SecurityTest "SystemExit" {
    param($code, $out)
    return ($out -match '"status"\s*:\s*"ok"' -and $out -match "Exiting cleanly via System.exit")
}

# 9. OutputFlood: capped at 64KB with truncation marker
Run-SecurityTest "OutputFlood" {
    param($code, $out)
    return ($out -match "\.\.\. \[output truncated\]")
}

# 10. TracerNameCollision: custom classes colliding with internal names work cleanly
Run-SecurityTest "TracerNameCollision" {
    param($code, $out)
    return ($out -match "User class collision handled: 42, collision")
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Results: $Passed / $Total passed ($Failed failed)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if ($Failed -gt 0) {
    exit 1
}
exit 0
