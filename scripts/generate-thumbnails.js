import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROJECT_ROOT = path.dirname(__dirname);
const MEDIA_CONFIG_PATH = path.join(PROJECT_ROOT, 'src/config/media.json');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const THUMBNAILS_DIR = path.join(PROJECT_ROOT, 'public/thumbnails');
const THUMBNAIL_SIZE = '640x360'; // 16:9 aspect ratio
const THUMBNAIL_QUALITY = 85; // JPEG quality

// Ensure thumbnails directory exists
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

// Function to check if ffmpeg is available
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('FFmpeg is not installed or not in PATH');
    console.error('Please install FFmpeg to generate video thumbnails');
    console.error('Visit: https://ffmpeg.org/download.html');
    return false;
  }
}

// Function to generate a thumbnail from a video file
async function generateThumbnail(videoPath, outputPath) {
  try {
    const fullVideoPath = path.join(PUBLIC_DIR, videoPath.replace(/^\//, ''));
    const fullOutputPath = path.join(THUMBNAILS_DIR, outputPath);
    
    // Check if video file exists
    if (!fs.existsSync(fullVideoPath)) {
      console.warn(`Video file not found: ${fullVideoPath}`);
      return false;
    }
    
    // Check if thumbnail already exists
    if (fs.existsSync(fullOutputPath)) {
      console.log(`Thumbnail already exists: ${outputPath}`);
      return true;
    }
    
    console.log(`Generating thumbnail for: ${videoPath}`);
    
    // Generate thumbnail using ffmpeg
    // Seek to 2 seconds in, resize to target size, and save as JPEG
    const command = `ffmpeg -i "${fullVideoPath}" -ss 00:00:02 -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" -q:v ${THUMBNAIL_QUALITY} -y "${fullOutputPath}"`;
    
    execSync(command, { stdio: 'ignore' });
    
    console.log(`✓ Generated thumbnail: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to generate thumbnail for ${videoPath}:`, error.message);
    return false;
  }
}

// Function to generate a thumbnail filename from a video path
function getThumbnailFilename(videoPath) {
  const ext = path.extname(videoPath);
  const baseName = path.basename(videoPath, ext);
  return `${baseName}.jpg`;
}

// Main function to process all videos
async function processVideos() {
  if (!checkFFmpeg()) {
    process.exit(1);
  }
  
  console.log('Loading media configuration...');
  
  // Load media configuration
  const mediaConfig = JSON.parse(fs.readFileSync(MEDIA_CONFIG_PATH, 'utf8'));
  let updated = false;
  
  console.log(`Found ${mediaConfig.mediaItems.length} media items`);
  
  // Process each media item
  for (const item of mediaConfig.mediaItems) {
    if (item.type === 'video' && item.thumb === item.src) {
      console.log(`\nProcessing video: ${item.title}`);
      
      const thumbnailFilename = getThumbnailFilename(item.src);
      const thumbnailPath = `/thumbnails/${thumbnailFilename}`;
      
      // Generate thumbnail
      const success = await generateThumbnail(item.src, thumbnailFilename);
      
      if (success) {
        // Update the media item configuration
        item.thumb = thumbnailPath;
        updated = true;
        console.log(`✓ Updated configuration for: ${item.title}`);
      }
    }
  }
  
  // Save updated configuration
  if (updated) {
    fs.writeFileSync(MEDIA_CONFIG_PATH, JSON.stringify(mediaConfig, null, 2));
    console.log('\n✓ Media configuration updated successfully!');
  } else {
    console.log('\n• No updates needed - all videos already have thumbnails');
  }
  
  console.log('\nThumbnail generation complete!');
}

// Run the script
processVideos().catch(error => {
  console.error('Error processing videos:', error);
  process.exit(1);
}); 