# Build the React app
Write-Host "Building React app..."
npm run build:prod

# Create necessary files
Write-Host "Creating necessary files..."

# Create .htaccess if it doesn't exist in build folder
if (-not (Test-Path "build\.htaccess")) {
    Copy-Item "public\.htaccess" -Destination "build\.htaccess"
}

# Create robots.txt if it doesn't exist
if (-not (Test-Path "build\robots.txt")) {
    @"
User-agent: *
Allow: /
Sitemap: https://olivesays.com/sitemap.xml
"@ | Out-File -FilePath "build\robots.txt" -Encoding UTF8
}

# Create sitemap.xml if it doesn't exist
if (-not (Test-Path "build\sitemap.xml")) {
    @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://olivesays.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
"@ | Out-File -FilePath "build\sitemap.xml" -Encoding UTF8
}

Write-Host "Build process completed!"
Write-Host "Please upload the contents of the 'build' folder to your Bluehost public_html/olivesays.com/ directory" 