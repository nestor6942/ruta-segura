const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const MOBILE_ASSETS_DIR = path.join(__dirname, '..', 'mobile', 'assets');
const PUBLIC_IMG_DIR = path.join(__dirname, '..', 'public', 'img');

if (!fs.existsSync(MOBILE_ASSETS_DIR)) {
  fs.mkdirSync(MOBILE_ASSETS_DIR, { recursive: true });
}

console.log(`🚀 Using browser: "${CHROME_PATH}"`);
console.log(`📁 Mobile assets output: ${MOBILE_ASSETS_DIR}`);

// 1. App Icon SVG (1024x1024)
function getIconHtml() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1024px;
    height: 1024px;
    overflow: hidden;
    background: #0b0f19;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="50%" stop-color="#0b0f19"/>
      <stop offset="100%" stop-color="#030712"/>
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
    <filter id="shieldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="32" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bgGrad)"/>
  
  <!-- Subtle tech grid pattern / radial glow in background -->
  <circle cx="512" cy="512" r="420" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.15"/>
  <circle cx="512" cy="512" r="340" fill="none" stroke="#10b981" stroke-width="2" opacity="0.1" stroke-dasharray="16 16"/>

  <!-- Shield Outer Glowing Contour -->
  <path d="M512 140 C680 200 800 240 800 420 C800 660 640 800 512 890 C384 800 224 660 224 420 C224 240 344 200 512 140 Z" 
        fill="url(#shieldGrad)" filter="url(#shieldGlow)" opacity="0.95"/>

  <!-- Shield Inner Dark Cutout -->
  <path d="M512 190 C650 240 750 276 750 430 C750 630 616 750 512 830 C408 750 274 630 274 430 C274 276 374 240 512 190 Z" 
        fill="#0b0f19"/>

  <!-- Shield Inner Border Highlight -->
  <path d="M512 210 C635 255 725 288 725 430 C725 610 600 720 512 795 C424 720 299 610 299 430 C299 288 389 255 512 210 Z" 
        fill="none" stroke="url(#borderGrad)" stroke-width="4" opacity="0.4"/>

  <!-- GPS Pin inside shield -->
  <path d="M512 320 C446 320 392 374 392 440 C392 530 512 660 512 660 C512 660 632 530 632 440 C632 374 578 320 512 320 Z" 
        fill="url(#glowGrad)"/>

  <!-- Pin Center Circles -->
  <circle cx="512" cy="440" r="44" fill="#0b0f19"/>
  <circle cx="512" cy="440" r="22" fill="#34d399"/>

  <!-- Pulse Rings -->
  <circle cx="512" cy="440" r="84" fill="none" stroke="#10b981" stroke-width="6" opacity="0.6" stroke-dasharray="8 8"/>
  <circle cx="512" cy="440" r="124" fill="none" stroke="#38bdf8" stroke-width="4" opacity="0.3"/>
</svg>
</body>
</html>`;
}

// 2. Adaptive Icon (1024x1024) - Android Foreground with Transparent Background
// Android spec: content must fit in safe center circle (diameter 660px, center 512,512)
function getAdaptiveIconHtml() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1024px;
    height: 1024px;
    overflow: hidden;
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
    <filter id="shieldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="20" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Centered in 640px safe zone -->
  <g transform="translate(512, 512) scale(0.68) translate(-512, -512)">
    <!-- Shield Outer Glowing Contour -->
    <path d="M512 140 C680 200 800 240 800 420 C800 660 640 800 512 890 C384 800 224 660 224 420 C224 240 344 200 512 140 Z" 
          fill="url(#shieldGrad)" filter="url(#shieldGlow)" opacity="0.95"/>

    <!-- Shield Inner Dark Cutout -->
    <path d="M512 190 C650 240 750 276 750 430 C750 630 616 750 512 830 C408 750 274 630 274 430 C274 276 374 240 512 190 Z" 
          fill="#0b0f19"/>

    <!-- Shield Inner Border Highlight -->
    <path d="M512 210 C635 255 725 288 725 430 C725 610 600 720 512 795 C424 720 299 610 299 430 C299 288 389 255 512 210 Z" 
          fill="none" stroke="url(#borderGrad)" stroke-width="4" opacity="0.4"/>

    <!-- GPS Pin inside shield -->
    <path d="M512 320 C446 320 392 374 392 440 C392 530 512 660 512 660 C512 660 632 530 632 440 C632 374 578 320 512 320 Z" 
          fill="url(#glowGrad)"/>

    <!-- Pin Center Circles -->
    <circle cx="512" cy="440" r="44" fill="#0b0f19"/>
    <circle cx="512" cy="440" r="22" fill="#34d399"/>

    <!-- Pulse Rings -->
    <circle cx="512" cy="440" r="84" fill="none" stroke="#10b981" stroke-width="6" opacity="0.6" stroke-dasharray="8 8"/>
    <circle cx="512" cy="440" r="124" fill="none" stroke="#38bdf8" stroke-width="4" opacity="0.3"/>
  </g>
</svg>
</body>
</html>`;
}

// 3. Splash Screen (2048x2048) with brand typography
function getSplashHtml() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 2048px;
    height: 2048px;
    overflow: hidden;
    background: #0b0f19;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" width="2048" height="2048">
  <defs>
    <radialGradient id="splashGlow" cx="50%" cy="45%" r="45%">
      <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="#0b0f19" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#0b0f19" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <linearGradient id="subGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="30" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background Ambient Glow -->
  <rect width="2048" height="2048" fill="#0b0f19"/>
  <circle cx="1024" cy="850" r="800" fill="url(#splashGlow)"/>

  <!-- Orbital Rings -->
  <circle cx="1024" cy="850" r="540" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.2"/>
  <circle cx="1024" cy="850" r="440" fill="none" stroke="#10b981" stroke-width="2" opacity="0.25" stroke-dasharray="16 16"/>

  <!-- Centered Emblem -->
  <g transform="translate(1024, 850) scale(0.9) translate(-512, -512)">
    <!-- Shield Outer -->
    <path d="M512 140 C680 200 800 240 800 420 C800 660 640 800 512 890 C384 800 224 660 224 420 C224 240 344 200 512 140 Z" 
          fill="url(#shieldGrad)" filter="url(#glow)" opacity="0.95"/>

    <!-- Shield Inner -->
    <path d="M512 190 C650 240 750 276 750 430 C750 630 616 750 512 830 C408 750 274 630 274 430 C274 276 374 240 512 190 Z" 
          fill="#0b0f19"/>

    <!-- GPS Pin -->
    <path d="M512 320 C446 320 392 374 392 440 C392 530 512 660 512 660 C512 660 632 530 632 440 C632 374 578 320 512 320 Z" 
          fill="url(#glowGrad)"/>

    <circle cx="512" cy="440" r="44" fill="#0b0f19"/>
    <circle cx="512" cy="440" r="22" fill="#34d399"/>

    <circle cx="512" cy="440" r="84" fill="none" stroke="#10b981" stroke-width="6" opacity="0.6" stroke-dasharray="8 8"/>
  </g>

  <!-- Typography: RUTA SEGURA -->
  <text x="1024" y="1460" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
        font-size="88" 
        font-weight="900" 
        letter-spacing="8" 
        fill="url(#textGrad)" 
        text-anchor="middle">RUTA SEGURA</text>

  <!-- Subtitle: MONITOREO GPS & AUXILIO 24/7 -->
  <text x="1024" y="1530" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
        font-size="28" 
        font-weight="700" 
        letter-spacing="12" 
        fill="url(#subGrad)" 
        text-anchor="middle">MONITOREO GPS &amp; AUXILIO 24/7</text>

  <!-- Bottom Safe Journey Badge -->
  <rect x="834" y="1740" width="380" height="52" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
  <circle cx="866" cy="1766" r="6" fill="#10b981"/>
  <text x="1034" y="1775" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
        font-size="19" 
        font-weight="600" 
        fill="#94a3b8" 
        text-anchor="middle">Protección Satelital Activa</text>
</svg>
</body>
</html>`;
}

// 4. Favicon (192x192)
function getFaviconHtml() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 192px;
    height: 192px;
    overflow: hidden;
    background: #0b0f19;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <rect width="192" height="192" rx="44" fill="#0b0f19"/>
  <rect width="186" height="186" x="3" y="3" rx="41" fill="none" stroke="url(#shieldGrad)" stroke-width="3" opacity="0.6"/>

  <g transform="translate(96, 96) scale(0.32) translate(-256, -256)">
    <path d="M256 70 C340 100 400 120 400 210 C400 330 320 400 256 445 C192 400 112 330 112 210 C112 120 172 100 256 70 Z" 
          fill="url(#shieldGrad)"/>
    <path d="M256 95 C325 120 375 138 375 215 C375 315 308 375 256 415 C204 375 137 315 137 215 C137 138 187 120 256 95 Z" 
          fill="#0b0f19"/>
    <path d="M256 160 C223 160 196 187 196 220 C196 265 256 330 256 330 C256 330 316 265 316 220 C316 187 289 160 256 160 Z" 
          fill="url(#glowGrad)"/>
    <circle cx="256" cy="220" r="22" fill="#0f172a"/>
    <circle cx="256" cy="220" r="10" fill="#34d399"/>
  </g>
</svg>
</body>
</html>`;
}

const tasks = [
  {
    name: 'icon.png',
    width: 1024,
    height: 1024,
    html: getIconHtml(),
    outputPath: path.join(MOBILE_ASSETS_DIR, 'icon.png'),
    transparent: false
  },
  {
    name: 'adaptive-icon.png',
    width: 1024,
    height: 1024,
    html: getAdaptiveIconHtml(),
    outputPath: path.join(MOBILE_ASSETS_DIR, 'adaptive-icon.png'),
    transparent: true
  },
  {
    name: 'splash.png',
    width: 2048,
    height: 2048,
    html: getSplashHtml(),
    outputPath: path.join(MOBILE_ASSETS_DIR, 'splash.png'),
    transparent: false
  },
  {
    name: 'favicon.png',
    width: 192,
    height: 192,
    html: getFaviconHtml(),
    outputPath: path.join(MOBILE_ASSETS_DIR, 'favicon.png'),
    transparent: false
  },
  // Also generate icons for public/img for the web PWA!
  {
    name: 'icon-192.png',
    width: 192,
    height: 192,
    html: getFaviconHtml(),
    outputPath: path.join(PUBLIC_IMG_DIR, 'icon-192.png'),
    transparent: false
  },
  {
    name: 'icon-512.png',
    width: 512,
    height: 512,
    html: getIconHtml(),
    outputPath: path.join(PUBLIC_IMG_DIR, 'icon-512.png'),
    transparent: false
  }
];

const tempDir = path.join(__dirname, '..', 'scratch_assets_temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

for (const t of tasks) {
  const tempHtmlPath = path.join(tempDir, `temp_${t.name}.html`);
  fs.writeFileSync(tempHtmlPath, t.html, 'utf8');

  const bgFlag = t.transparent ? '--default-background-color=00000000' : '';
  const cmd = `"${CHROME_PATH}" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=${t.width},${t.height} ${bgFlag} --screenshot="${t.outputPath}" "file://${tempHtmlPath.replace(/\\/g, '/')}"`;

  console.log(`Generating ${t.name} (${t.width}x${t.height})...`);
  try {
    execSync(cmd, { stdio: 'ignore' });
    const stat = fs.statSync(t.outputPath);
    console.log(`  ✅ Generated: ${t.outputPath} (${stat.size} bytes)`);
  } catch (err) {
    console.error(`  ❌ Failed to generate ${t.name}:`, err.message);
  }
}

// Clean up temp HTML
try {
  fs.rmSync(tempDir, { recursive: true, force: true });
} catch (_) {}

console.log('🎉 Asset generation completed successfully!');
