param([switch]$StatusOnly)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$lanes = @(
  @{ Name='admission'; Script='scripts/preparation-worker.mjs'; Extra='--lane=admission'; Dir='.local/preparation-worker/admission' },
  @{ Name='flow-repair'; Script='scripts/preparation-worker.mjs'; Extra='--lane=repair'; Dir='.local/preparation-worker/repair' },
  @{ Name='protocol-analysis'; Script='scripts/protocol-analysis-worker.mjs'; Extra=''; Dir='.local/protocol-analysis-worker' },
  @{ Name='capture-handoff'; Script='scripts/capture-handoff-worker.mjs'; Extra=''; Dir='.local/capture-handoff-worker' }
)
foreach ($lane in $lanes) {
  $laneDir = Join-Path $taskRoot $lane.Dir
  $lockPath = Join-Path $laneDir 'producer.lock'
  $processInfo = $null
  if (Test-Path -LiteralPath $lockPath) {
    $lockInfo = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    $processInfo = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$lockInfo.pid)
    if ($processInfo) {
      if ($processInfo.Name -ne 'node.exe' -or
          $processInfo.CommandLine -notlike ('*' + $lane.Script + '*') -or
          ($lane.Extra -and $processInfo.CommandLine -notlike ('*' + $lane.Extra + '*'))) {
        throw ('WORK_LINE_OWNER_MISMATCH: ' + $lane.Name)
      }
    } elseif (-not $StatusOnly) {
      # Only remove a fixed lane lock after its exact owner has exited.
      # Unfinished inventory claims remain fenced and require review.
      Remove-Item -LiteralPath $lockPath
    }
  }
  if (-not $processInfo -and -not $StatusOnly) {
    New-Item -ItemType Directory -Path $laneDir -Force | Out-Null
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $argsList = @($lane.Script)
    if ($lane.Extra) { $argsList += $lane.Extra }
    $started = Start-Process -FilePath $nodeExe -ArgumentList $argsList -WorkingDirectory $taskRoot `
      -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $laneDir ('startup-' + $stamp + '.log')) `
      -RedirectStandardError (Join-Path $laneDir ('startup-' + $stamp + '.stderr'))
    Start-Sleep -Milliseconds 500
    if ($started.HasExited -or -not (Test-Path -LiteralPath $lockPath)) { throw ('WORK_LINE_START_FAILED: ' + $lane.Name) }
    $lockInfo = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    if ([int]$lockInfo.pid -ne $started.Id) { throw ('WORK_LINE_LOCK_CHANGED: ' + $lane.Name) }
    $processInfo = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $started.Id)
  }
  [pscustomobject]@{ Lane=$lane.Name; Running=[bool]$processInfo; Pid=if ($processInfo) { $processInfo.ProcessId } else { $null }; SourceAuthority=$false }
}
# This starts offline work and capture handoff only. It neither enables source
# nor calls GitHub; actual capture requires the independent online controller.
