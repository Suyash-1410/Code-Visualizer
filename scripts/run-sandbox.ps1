# Hardened run-sandbox PowerShell script enforcing PRD Section 9.2 container security flags
[CmdletBinding()]
param(
    [Parameter(ValueFromPipeline = $true)]
    [string[]]$InputObject,
    [string]$ImageName = "javascope-sandbox:latest"
)

begin {
    $lines = [System.Collections.Generic.List[string]]::new()
}

process {
    if ($InputObject) {
        foreach ($line in $InputObject) {
            $lines.Add($line)
        }
    }
}

end {
    if ($lines.Count -eq 0 -and $input) {
        foreach ($item in $input) {
            $lines.Add($item.ToString())
        }
    }
    $sourceText = ($lines -join "`n")

    $dockerArgs = @(
        "run", "-i",
        "--rm",
        "--network", "none",
        "--memory", "512m",
        "--memory-swap", "512m",
        "--cpus", "1",
        "--pids-limit", "64",
        "--read-only",
        "--tmpfs", "/tmp:rw,nosuid,size=64m",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "--user", "10001:10001",
        $ImageName
    )

    $hasNativeDocker = Get-Command docker -ErrorAction SilentlyContinue

    if ($hasNativeDocker) {
        $sourceText | docker @dockerArgs
    } else {
        # Fallback to WSL docker if installed in WSL
        $wslDockerArgs = @("docker") + $dockerArgs
        $sourceText | wsl -u root @wslDockerArgs
    }
}
