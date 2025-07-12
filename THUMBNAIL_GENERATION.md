# Image Optimization & Thumbnail Generation System

This system automatically generates static thumbnail images from video files and optimizes article images to eliminate staggered loading effects across your website.

## Prerequisites

### 1. FFmpeg Installation (For Video Thumbnails)

The system requires FFmpeg to extract frames from video files.

**Windows:**
- Download from [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
- Extract the ZIP file
- Add the `bin` folder to your system PATH
- Or install via Chocolatey: `choco install ffmpeg`

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 2. ImageMagick Installation (For Article Images)

The system requires ImageMagick to optimize article images.

**Windows:**
- Download from [https://imagemagick.org/script/download.php#windows](https://imagemagick.org/script/download.php#windows)
- Make sure to check "Add to PATH" during installation
- Or install via Chocolatey: `choco install imagemagick`

**macOS:**
```bash
brew install imagemagick
```

**Linux:**
```bash
sudo apt update
sudo apt install imagemagick
```

### 3. Node.js

Ensure Node.js is installed on your system.

## Usage

### Video Thumbnail Generation

#### Method 1: Using NPM Script (Recommended)

```bash
npm run generate-thumbnails
```

#### Method 2: Using Batch File (Windows)

Double-click `scripts/generate-thumbnails.bat` or run from PowerShell:

```powershell
.\scripts\generate-thumbnails.bat
```

#### Method 3: Direct Node.js Execution

```bash
node scripts/generate-thumbnails.js
```

### Article Image Optimization

#### Method 1: Using NPM Script (Recommended)

```bash
npm run optimize-article-images
```

#### Method 2: Using Batch File (Windows)

Double-click `scripts/optimize-article-images.bat` or run from PowerShell:

```powershell
.\scripts\optimize-article-images.bat
```

#### Method 3: Direct Node.js Execution

```bash
node scripts/optimize-article-images.js
```

## How It Works

### Video Thumbnail Generation

1. **Scans Media Configuration**: The script reads `src/config/media.json` to identify video entries where the `thumb` property matches the `src` property (indicating they need thumbnails).

2. **Generates Thumbnails**: For each video that needs a thumbnail:
   - Extracts a frame from 2 seconds into the video
   - Resizes to 640x360 pixels (16:9 aspect ratio)
   - Saves as a high-quality JPEG in `public/thumbnails/`

3. **Updates Configuration**: Updates the `media.json` file to point to the new thumbnail paths.

### Article Image Optimization

1. **Scans Article Files**: The script reads all `.mdx` files in `src/content/articles/` to identify large PNG/JPG images in the frontmatter.

2. **Optimizes Images**: For each unoptimized image:
   - Resizes to 800x450 pixels (16:9 aspect ratio)
   - Converts to WebP format for better compression
   - Saves optimized images in `public/images/articles/optimized/`

3. **Updates Article Files**: Updates the article frontmatter to point to the optimized image paths.

## Configuration

### Video Thumbnail Settings

The script can be customized by modifying the constants in `scripts/generate-thumbnails.js`:

```javascript
const THUMBNAIL_SIZE = '640x360';    // Output resolution
const THUMBNAIL_QUALITY = 85;       // JPEG quality (1-100)
const THUMBNAILS_DIR = './public/thumbnails';  // Output directory
```

### Article Image Optimization Settings

The script can be customized by modifying the constants in `scripts/optimize-article-images.js`:

```javascript
const THUMBNAIL_SIZE = '800x450';   // Output resolution (16:9 aspect ratio)
const WEBP_QUALITY = 85;           // WebP quality (1-100)
const OPTIMIZED_DIR = './public/images/articles/optimized';  // Output directory
```

## File Structure

After running the scripts, your project will have:

```
public/
├── thumbnails/           # Generated video thumbnails
│   ├── video1.jpg       # Thumbnail for video1.mp4
│   ├── video2.jpg       # Thumbnail for video2.mp4
│   └── ...
├── images/
│   └── articles/
│       └── optimized/   # Optimized article images
│           ├── article1.webp  # Optimized version of article1.png
│           ├── article2.webp  # Optimized version of article2.png
│           └── ...
└── ...
```

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Ensure FFmpeg is installed and in your system PATH
2. **Video file not found**: Check that video files exist in the `public/` directory
3. **Permission errors**: Ensure the script has write permissions to the `public/thumbnails/` directory

### Re-generating Thumbnails

The script automatically skips thumbnails that already exist. To regenerate all thumbnails:

1. Delete the `public/thumbnails/` directory
2. Run the script again

### Manual Thumbnail Override

If you want to use a custom thumbnail for a specific video:

1. Place your custom thumbnail in `public/thumbnails/`
2. Name it the same as the video file but with a `.jpg` extension
3. The script will skip generating a thumbnail for that video

## Performance Benefits

### Video Thumbnails
- **Eliminates staggered loading**: All thumbnails load instantly
- **Reduces client-side processing**: No more JavaScript thumbnail generation
- **Improves user experience**: Smoother gallery loading
- **Better caching**: Static images can be cached by browsers and CDNs

### Article Images
- **Dramatic file size reduction**: Convert 3MB+ PNG files to ~100KB WebP files
- **Faster page load times**: Optimized images load 10-30x faster
- **Better mobile experience**: Smaller images use less bandwidth
- **Improved SEO**: Faster loading pages rank better in search results
- **Better compression**: WebP format provides superior compression vs PNG/JPEG

## Integration with Build Process

You can integrate both optimization systems into your build process by adding them to your CI/CD pipeline or pre-build scripts:

```json
{
  "scripts": {
    "prebuild": "npm run generate-thumbnails && npm run optimize-article-images",
    "build": "astro build"
  }
}
``` 