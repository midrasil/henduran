param(
  [string]$AssetRoot = "assets/tilesets/ui/franuka",
  [string]$OutputRoot = "docs/ui-ux"
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$assetPath = (Resolve-Path (Join-Path $repo $AssetRoot)).Path
$outputPath = Join-Path $repo $OutputRoot
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

function Read-BigEndian32([byte[]]$bytes, [int]$offset) {
  return [uint32](([uint32]$bytes[$offset] -shl 24) -bor ([uint32]$bytes[$offset + 1] -shl 16) -bor ([uint32]$bytes[$offset + 2] -shl 8) -bor [uint32]$bytes[$offset + 3])
}

function Get-ImageInfo([string]$path, [string]$ext) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if ($ext -eq ".png" -and $bytes.Length -ge 24) {
    return @{ width = [int](Read-BigEndian32 $bytes 16); height = [int](Read-BigEndian32 $bytes 20); frames = 1 }
  }
  if ($ext -eq ".gif" -and $bytes.Length -ge 10) {
    $w = [BitConverter]::ToUInt16($bytes, 6); $h = [BitConverter]::ToUInt16($bytes, 8)
    return @{ width = [int]$w; height = [int]$h; frames = $null }
  }
  return @{ width = $null; height = $null; frames = $null }
}

function Get-State([string]$name) {
  foreach ($state in @("Normal", "Pressed", "Selected", "Outline", "Opening", "Closing", "NextPage", "PreviousPage", "Empty")) {
    if ($name -match "(?i)(?:_|\b)$state(?:\b|\.)") { return $state }
  }
  return "Default"
}

$files = Get-ChildItem -LiteralPath $assetPath -File -Recurse | Sort-Object FullName
$items = foreach ($file in $files) {
  $relative = $file.FullName.Substring($assetPath.Length).TrimStart([char]'\', [char]'/').Replace("\", "/")
  $parts = $relative.Split("/")
  $scale = if ($relative -match "Individual files/(1x|2x|3x)/") { $Matches[1] } elseif ($file.BaseName -match "\((1x|2x|3x)\)") { $Matches[1] } else { "n/a" }
  $category = if ($relative.StartsWith("Individual files/")) { $parts[2] } elseif ($relative.StartsWith("Examples/")) { "Examples" } elseif ($relative.StartsWith("Fonts/")) { "Fonts" } else { "Package root" }
  $info = Get-ImageInfo $file.FullName $file.Extension.ToLowerInvariant()
  $family = $file.BaseName -replace "_(Normal|Pressed|Selected|Outline|Opening|Closing|NextPage|PreviousPage|Empty)$", ""
  [pscustomobject][ordered]@{
    path = $relative; extension = $file.Extension.ToLowerInvariant(); bytes = $file.Length
    width = $info.width; height = $info.height; frames = $info.frames
    scale = $scale; category = $category; family = $family; state = Get-State $file.Name
  }
}

$summary = [pscustomobject][ordered]@{
  assetRoot = $AssetRoot.Replace("\", "/")
  total = $items.Count
  extensions = @($items | Group-Object extension | Sort-Object Name | ForEach-Object { [pscustomobject][ordered]@{ extension=$_.Name; count=$_.Count } })
  categories = @($items | Group-Object category | Sort-Object Name | ForEach-Object { [pscustomobject][ordered]@{ category=$_.Name; count=$_.Count } })
  items = @($items)
}
$json = $summary | ConvertTo-Json -Depth 6
$manifest = Join-Path $outputPath "franuka-manifest.json"
[IO.File]::WriteAllText($manifest, $json, (New-Object Text.UTF8Encoding $false))

$rows = foreach ($item in $items | Where-Object { $_.extension -in @(".png", ".gif") }) {
  $src = "../../assets/tilesets/ui/franuka/" + [Uri]::EscapeUriString($item.path)
  $safePath = [Net.WebUtility]::HtmlEncode($item.path)
  $safeCategory = [Net.WebUtility]::HtmlEncode($item.category)
  "<article data-category='$safeCategory' data-scale='$($item.scale)' data-state='$($item.state)' data-search='$safePath'><img loading='lazy' src='$src' alt='' /><code>$safePath</code><small>$($item.width)x$($item.height) · $($item.scale) · $($item.state)</small></article>"
}
$html = @"
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Catálogo local Franuka</title>
<style>body{font:14px system-ui;background:#17131b;color:#eee;margin:20px}header{position:sticky;top:0;background:#17131bee;padding:12px;z-index:2}input,select{font:inherit;padding:8px;margin:4px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}article{display:grid;gap:6px;background:#292231;padding:10px;min-height:140px;overflow:hidden}img{max-width:100%;max-height:180px;object-fit:contain;image-rendering:pixelated;margin:auto}code{font-size:11px;overflow-wrap:anywhere}small{color:#c8bdcf}.warning{color:#ffd37a}</style></head><body>
<header><h1>Catálogo local Franuka</h1><p class="warning">Uso local. Os binários comerciais não estão incorporados; esta página apenas referencia <code>assets/tilesets/ui/franuka</code>.</p>
<input id="q" placeholder="Filtrar caminho"><select id="scale"><option value="">Todas escalas</option><option>1x</option><option>2x</option><option>3x</option><option>n/a</option></select><span id="count"></span></header><main>$($rows -join "`n")</main>
<script>const cards=[...document.querySelectorAll('article')],q=document.querySelector('#q'),s=document.querySelector('#scale'),n=document.querySelector('#count');function f(){let c=0;for(const x of cards){const ok=x.dataset.search.toLowerCase().includes(q.value.toLowerCase())&&(!s.value||x.dataset.scale===s.value);x.hidden=!ok;if(ok)c++}n.textContent=c+' / '+cards.length}q.oninput=s.onchange=f;for(const i of document.images)i.onerror=()=>{i.alt='Asset local ausente';i.closest('article').classList.add('missing')};f()</script></body></html>
"@
[IO.File]::WriteAllText((Join-Path $outputPath "catalogo-franuka.local.html"), $html, (New-Object Text.UTF8Encoding $false))

$hash = (Get-FileHash -Algorithm SHA256 $manifest).Hash
Write-Output "Arquivos: $($items.Count)"
Write-Output (($summary.extensions | ForEach-Object { "$($_.extension)=$($_.count)" }) -join "; ")
Write-Output "Manifesto SHA256: $hash"
