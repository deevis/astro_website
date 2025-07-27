import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROJECT_ROOT = path.dirname(__dirname);
const ARTICLES_DIR = path.join(PROJECT_ROOT, 'src/content/articles');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'public/images/articles');
const OPTIMIZED_DIR = path.join(PROJECT_ROOT, 'public/images/articles/optimized');
const THUMBNAIL_SIZE = '800x450'; // 16:9 aspect ratio at reasonable size
const WEBP_QUALITY = 85; // WebP quality (0-100)

// Ensure optimized directory exists
if (!fs.existsSync(OPTIMIZED_DIR)) {
  fs.mkdirSync(OPTIMIZED_DIR, { recursive: true });
}

// Function to check if ImageMagick is available
function checkImageMagick() {
  try {
    execSync('magick -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('ImageMagick is not installed or not in PATH');
    console.error('Please install ImageMagick to optimize images');
    console.error('Visit: https://imagemagick.org/script/download.php');
    console.error('For Windows: https://imagemagick.org/script/download.php#windows');
    return false;
  }
}

// Function to optimize an image
async function optimizeImage(imagePath, outputPath) {
  try {
    const fullImagePath = path.join(IMAGES_DIR, imagePath.replace(/^\/images\/articles\//, ''));
    const fullOutputPath = path.join(OPTIMIZED_DIR, outputPath);
    
    // Check if image file exists
    if (!fs.existsSync(fullImagePath)) {
      console.warn(`Image file not found: ${fullImagePath}`);
      return false;
    }
    
    // Check if optimized image already exists
    if (fs.existsSync(fullOutputPath)) {
      console.log(`Optimized image already exists: ${outputPath}`);
      return true;
    }
    
    console.log(`Optimizing image: ${imagePath}`);
    
    // Generate optimized image using ImageMagick
    // Resize to fill the target size, then crop to exact dimensions (no padding)
    const command = `magick "${fullImagePath}" -resize ${THUMBNAIL_SIZE}^ -gravity center -crop ${THUMBNAIL_SIZE}+0+0 -quality ${WEBP_QUALITY} "${fullOutputPath}"`;
    
    execSync(command, { stdio: 'ignore' });
    
    // Get file size for reporting
    const stats = fs.statSync(fullOutputPath);
    const sizeKB = Math.round(stats.size / 1024);
    
    console.log(`✓ Optimized image: ${outputPath} (${sizeKB}KB)`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to optimize image ${imagePath}:`, error.message);
    return false;
  }
}

// Function to generate an optimized filename
function getOptimizedFilename(imagePath) {
  const ext = path.extname(imagePath);
  const baseName = path.basename(imagePath, ext);
  return `${baseName}.webp`;
}

// Function to scan article files and extract image references
function scanArticleImages() {
  const imageReferences = [];
  
  try {
    const articleFiles = fs.readdirSync(ARTICLES_DIR).filter(file => file.endsWith('.mdx'));
    
    for (const file of articleFiles) {
      const filePath = path.join(ARTICLES_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract image src from frontmatter
      const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const imageMatch = frontmatter.match(/src:\s*["']([^"']+)["']/);
        
        if (imageMatch) {
          const imageSrc = imageMatch[1];
          // Only process images that are in /images/articles/ and are PNG/JPG
          if (imageSrc.startsWith('/images/articles/') && /\.(png|jpg|jpeg)$/i.test(imageSrc)) {
            imageReferences.push({
              file: file,
              originalPath: imageSrc,
              fileName: path.basename(imageSrc)
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error scanning article files:', error.message);
  }
  
  return imageReferences;
}

// Function to update article files with optimized image paths
function updateArticleFiles(imageReferences, successfulOptimizations) {
  let updatedFiles = 0;
  
  for (const ref of imageReferences) {
    const optimizedFilename = getOptimizedFilename(ref.fileName);
    
    // Check if this image was successfully optimized
    if (successfulOptimizations.includes(optimizedFilename)) {
      const filePath = path.join(ARTICLES_DIR, ref.file);
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Update the image src in the frontmatter
      const newImagePath = `/images/articles/optimized/${optimizedFilename}`;
      content = content.replace(
        new RegExp(`src:\\s*["']${ref.originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`),
        `src: "${newImagePath}"`
      );
      
      fs.writeFileSync(filePath, content);
      console.log(`✓ Updated ${ref.file} to use optimized image`);
      updatedFiles++;
    }
  }
  
  return updatedFiles;
}

// Main function to process all images
async function processArticleImages() {
  if (!checkImageMagick()) {
    process.exit(1);
  }
  
  console.log('Scanning article files for images...');
  
  const imageReferences = scanArticleImages();
  
  if (imageReferences.length === 0) {
    console.log('No unoptimized images found in articles');
    return;
  }
  
  console.log(`Found ${imageReferences.length} images to optimize`);
  
  const successfulOptimizations = [];
  
  // Process each image
  for (const ref of imageReferences) {
    const optimizedFilename = getOptimizedFilename(ref.fileName);
    const success = await optimizeImage(ref.originalPath, optimizedFilename);
    
    if (success) {
      successfulOptimizations.push(optimizedFilename);
    }
  }
  
  // Update article files with optimized paths
  if (successfulOptimizations.length > 0) {
    console.log('\nUpdating article files with optimized image paths...');
    const updatedFiles = updateArticleFiles(imageReferences, successfulOptimizations);
    
    console.log(`\n✓ Successfully optimized ${successfulOptimizations.length} images`);
    console.log(`✓ Updated ${updatedFiles} article files`);
  } else {
    console.log('\n• No images were successfully optimized');
  }
  
  console.log('\nImage optimization complete!');
}

// Run the script
processArticleImages().catch(error => {
  console.error('Error processing article images:', error);
  process.exit(1);
}); 