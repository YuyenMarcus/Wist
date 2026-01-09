/**
 * Script to generate extension icons from PNG logo
 * Run with: node scripts/generate-extension-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '../public/logo.png');
const iconsDir = path.join(__dirname, '../wist-extension/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Check if logo.png exists, fallback to logo.svg if not
let inputPath = logoPath;
if (!fs.existsSync(logoPath)) {
  const svgPath = path.join(__dirname, '../public/logo.svg');
  if (fs.existsSync(svgPath)) {
    inputPath = svgPath;
    console.log('⚠️  logo.png not found, using logo.svg instead');
  } else {
    console.error('❌ Neither logo.png nor logo.svg found in public/');
    process.exit(1);
  }
}

const sizes = [16, 32, 48, 64, 96, 128, 192, 256, 512, 1024];

async function generateIcons() {
  try {
    const inputBuffer = fs.readFileSync(inputPath);
    
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon${size}.png`);
      
      await sharp(inputBuffer)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated icon${size}.png`);
    }
    
    console.log('\n🎉 All icons generated successfully!');
    console.log('Icons saved to: wist-extension/icons/');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();

