# Builds assets/bay-dem.png: the real height of the land round San Francisco Bay.
#
# Source: the public "Terrain Tiles" dataset on AWS Open Data (Mapzen terrarium tiles; in the US the heights come from the
# USGS 3DEP survey). Sixteen zoom-11 tiles are fetched, joined, halved to 512 x 512 (about 120 m a pixel) and written as a
# grey PNG. Brightness v (0-255) stores height h in metres as  h = (v / 255)^2 * 1000 , so low ground keeps fine steps.
# Covers longitude -122.695 to -121.992, latitude 37.579 to 38.134 (Web Mercator rows, top row is north).
param([string]$Out = (Join-Path $PSScriptRoot '..\assets\bay-dem.png'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$x0 = 326; $y0 = 789; $n = 4; $tmp = Join-Path ([IO.Path]::GetTempPath()) 'vqh-dem'
New-Item -ItemType Directory -Force $tmp | Out-Null
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Dem {
  public static float[] Read(string path) {
    using (var b = new Bitmap(path)) { var r = new Rectangle(0, 0, 256, 256); var d = b.LockBits(r, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
      var raw = new byte[d.Stride * 256]; Marshal.Copy(d.Scan0, raw, 0, raw.Length); b.UnlockBits(d); var h = new float[65536];
      for (int y = 0; y < 256; y++) for (int x = 0; x < 256; x++) { int o = y * d.Stride + x * 3; h[y * 256 + x] = raw[o + 2] * 256f + raw[o + 1] + raw[o] / 256f - 32768f; }
      return h; } }
  public static void Write(float[] h, int w, string path) {
    using (var b = new Bitmap(w, w, PixelFormat.Format24bppRgb)) { var r = new Rectangle(0, 0, w, w); var d = b.LockBits(r, ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
      var raw = new byte[d.Stride * w];
      for (int y = 0; y < w; y++) for (int x = 0; x < w; x++) { float m = Math.Max(0f, Math.Min(1000f, h[y * w + x])); byte v = (byte)Math.Round(Math.Sqrt(m / 1000.0) * 255.0); int o = y * d.Stride + x * 3; raw[o] = raw[o + 1] = raw[o + 2] = v; }
      Marshal.Copy(raw, 0, d.Scan0, raw.Length); b.UnlockBits(d); b.Save(path, ImageFormat.Png); } }
}
'@
$W = 256 * $n; $big = New-Object 'single[]' ($W * $W)
for ($ty = 0; $ty -lt $n; $ty++) { for ($tx = 0; $tx -lt $n; $tx++) {
  $f = Join-Path $tmp "11-$($x0+$tx)-$($y0+$ty).png"
  if (-not (Test-Path $f)) { Invoke-WebRequest -UseBasicParsing -Uri "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/11/$($x0+$tx)/$($y0+$ty).png" -OutFile $f }
  $h = [Dem]::Read($f)
  for ($y = 0; $y -lt 256; $y++) { [Array]::Copy($h, $y * 256, $big, (($ty * 256 + $y) * $W) + $tx * 256, 256) }
} }
$w2 = $W / 2; $small = New-Object 'single[]' ($w2 * $w2); $max = 0
for ($y = 0; $y -lt $w2; $y++) { for ($x = 0; $x -lt $w2; $x++) { $i = (2 * $y) * $W + 2 * $x; $v = ($big[$i] + $big[$i + 1] + $big[$i + $W] + $big[$i + $W + 1]) / 4; $small[$y * $w2 + $x] = $v; if ($v -gt $max) { $max = $v } } }
[Dem]::Write($small, $w2, (New-Item -ItemType File -Force $Out).FullName)
"wrote $Out  ($w2 x $w2, highest point $([math]::Round($max)) m, $((Get-Item $Out).Length) bytes)"
