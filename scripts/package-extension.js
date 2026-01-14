const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files to include in the Chrome Web Store package
const filesToInclude = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'styles.css',
  'lordicon-animation.json',
  'icons/'
];

// Files to exclude (development/documentation files)
const filesToExclude = [
  'README.md',
  'ARCHITECTURE.md',
  'DIAGNOSTIC_SCRIPT.js',
  'diagnostic.js',
  'CLEAR_OLD_TOKEN.js'
];

const extensionDir = path.join(__dirname, '..', 'wist-extension');
const outputDir = path.join(__dirname, '..');
const zipName = 'wist-extension-chrome-store.zip';

console.log('📦 Packaging Chrome Extension for Web Store...\n');

// Check if extension directory exists
if (!fs.existsSync(extensionDir)) {
  console.error('❌ Extension directory not found:', extensionDir);
  process.exit(1);
}

// Create a temporary directory for the clean package
const tempDir = path.join(__dirname, '..', '.extension-package');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// Copy required files
console.log('📋 Copying required files...');
filesToInclude.forEach(file => {
  const sourcePath = path.join(extensionDir, file);
  const destPath = path.join(tempDir, file);
  
  if (fs.existsSync(sourcePath)) {
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      // Copy entire directory
      fs.cpSync(sourcePath, destPath, { recursive: true });
      console.log(`  ✓ Copied directory: ${file}`);
    } else {
      // Copy file
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(sourcePath, destPath);
      console.log(`  ✓ Copied file: ${file}`);
    }
  } else {
    console.warn(`  ⚠️  File not found: ${file}`);
  }
});

// Create ZIP file
console.log('\n🗜️  Creating ZIP file...');
const zipPath = path.join(outputDir, zipName);

try {
  // Use PowerShell's Compress-Archive on Windows
  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    // Use zip command on Unix-like systems
    execSync(
      `cd "${tempDir}" && zip -r "${zipPath}" .`,
      { stdio: 'inherit' }
    );
  }
  
  console.log(`\n✅ Successfully created: ${zipName}`);
  console.log(`\n📤 Ready to upload to Chrome Web Store:`);
  console.log(`   ${zipPath}\n`);
  
  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
  
} catch (error) {
  console.error('❌ Error creating ZIP file:', error.message);
  process.exit(1);
}
