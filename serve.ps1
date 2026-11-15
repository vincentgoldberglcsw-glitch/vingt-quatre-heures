$root = $PSScriptRoot
$l = New-Object System.Net.HttpListener
$port = if ($env:PORT) { $env:PORT } else { 8765 }
$l.Prefixes.Add("http://localhost:$port/")
$l.Start()
Write-Output "Serving on http://localhost:$port/"
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.css'='text/css'; '.json'='application/json'; '.png'='image/png' }
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if ($p -eq '') { $p = 'index.html' }
    $f = [IO.Path]::GetFullPath((Join-Path $root $p))
    if ($f.StartsWith($root) -and (Test-Path $f -PathType Leaf)) {
      $b = [IO.File]::ReadAllBytes($f)
      $t = $types[[IO.Path]::GetExtension($f)]
      if ($t) { $c.Response.ContentType = $t }
      $c.Response.Headers.Add('Cache-Control','no-store')
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch {}
  $c.Response.Close()
}
