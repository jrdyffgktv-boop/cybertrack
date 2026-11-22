# CyberTrack 运行脚本：本机 node 不在 PATH，统一通过 DSH 运行时调用。
# 用法：pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\ct.ps1 install|dev|build|test|preview
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('install', 'dev', 'build', 'test', 'preview', 'icons')]
  [string]$Task
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Resolve-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    'C:\Users\Lucas\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe',
    "$env:ProgramFiles\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  throw '找不到 node.exe，请安装 Node.js 22+ 或修改 scripts\ct.ps1'
}

function Resolve-Pnpm($nodePath) {
  $deps = Split-Path -Parent (Split-Path -Parent $nodePath)
  $candidates = @(
    (Join-Path $deps 'pnpm\bin\pnpm.mjs'),
    'C:\Users\Lucas\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  throw '找不到 pnpm.mjs；可执行 corepack enable 后改用 pnpm 命令'
}

$node = Resolve-Node
$nodeDir = Split-Path -Parent $node
# 让 pnpm 子进程、vite 插件找到 node
$env:PATH = "$nodeDir;$env:PATH"

Push-Location $root
try {
  switch ($Task) {
    'install' {
      $pnpm = Resolve-Pnpm $node
      & $node $pnpm install
    }
    'dev' {
      & $node node_modules\vite\bin\vite.js --host
    }
    'build' {
      & $node node_modules\typescript\bin\tsc --noEmit
      if ($LASTEXITCODE -ne 0) { throw 'TypeScript 类型检查失败' }
      & $node node_modules\vite\bin\vite.js build
    }
    'test' {
      & $node node_modules\vitest\vitest.mjs run
    }
    'preview' {
      & $node node_modules\vite\bin\vite.js preview --host
    }
    'icons' {
      & python scripts\make-icons.py
      if ($LASTEXITCODE -ne 0) { throw '图标生成失败（需要 Python + Pillow）' }
    }
  }
}
finally {
  Pop-Location
}

exit $LASTEXITCODE
