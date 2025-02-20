#!/bin/bash

# Build the React app
echo "Building React app..."
npm run build:prod

# Create necessary files
echo "Creating necessary files..."

# Create .htaccess if it doesn't exist in build folder
if [ ! -f "build/.htaccess" ]; then
    cp public/.htaccess build/.htaccess
fi

# Create robots.txt if it doesn't exist
if [ ! -f "build/robots.txt" ]; then
    echo "User-agent: *" > build/robots.txt
    echo "Allow: /" >> build/robots.txt
    echo "Sitemap: https://olivesays.com/sitemap.xml" >> build/robots.txt
fi

# Create sitemap.xml if it doesn't exist
if [ ! -f "build/sitemap.xml" ]; then
    echo '<?xml version="1.0" encoding="UTF-8"?>' > build/sitemap.xml
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' >> build/sitemap.xml
    echo '  <url>' >> build/sitemap.xml
    echo '    <loc>https://olivesays.com/</loc>' >> build/sitemap.xml
    echo '    <changefreq>weekly</changefreq>' >> build/sitemap.xml
    echo '    <priority>1.0</priority>' >> build/sitemap.xml
    echo '  </url>' >> build/sitemap.xml
    echo '</urlset>' >> build/sitemap.xml
fi

echo "Build process completed!"
echo "Please upload the contents of the 'build' folder to your Bluehost public_html/olivesays.com/ directory" 