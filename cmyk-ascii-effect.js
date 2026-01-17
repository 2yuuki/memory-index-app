// cmyk-ascii-effect.js - UNIVERSAL ASCII GENERATOR (Instance Mode)

const cmykSketch = (p) => {
  let blobImg = null, gfxFrame;
  let showImage = false;
  let isAnimated = false;
  let isJittering = false; // Trạng thái animation jitter
  let needsUpdate = true; // OPTIMIZATION: Flag to only redraw when necessary
  let gifLength = 30; // Frames for seamless GIF loop
  let currentFile = null; // Store current file for re-processing

  // --- UNIVERSAL ASCII SETTINGS ---
  let mode = "replica"; // replica, replicaSolid, mask, maskSolid, track
  let renderMode = "ascii"; // ascii, dither
  let colorMode = "cmyk"; // Default to CMYK
  
  // Colors
  let cMono, cDark, cLight, bgColor;
  let stabiloPalette, cmykPalette;
  let cHeat1, cHeat2, cHeat3;
  
  // CMYK Stroke Settings
  let cmykSettings = {
    weight: 2.5,
    threshold: 40,
    gamma: 1.3,
    jitter: 1.5,
    probPow: 1.3
  };

  // Dynamics
  let sizeMin = 0.85, sizeMax = 1.25;
  let speed = 1.0; // ASCII animation smoothing speed
  let _lumPrev = [], _rPrev = [], _gPrev = [], _bPrev = [];

  // Mask & Track
  let maskThreshold = 55;
  let maskSoftness = 25;
  let trackThresh = 48;
  let sampleStep = 4;
  let centroid = { x: 0, y: 0, ok: false }, fade = 0;

  // ASCII settings
  let asciiGrid = 5; // Renamed to avoid conflict with global grid in sketch.js
  let baseFont = 14;
  let asciiOpacity = 240;
  let rampReplica = " .'`^,:;~-_+*=!/?|()[]{}<>i!lI;:o0O8&%$#@";
  const rampDense = " .:-=+*#%@";
  let invertRamp = true;

  // Presets
  const rampPresets = {
    "Default": " .'`^,:;~-_+*=!/?|()[]{}<>i!lI;:o0O8&%$#@",
    "Minimal": " .:-=+*#%@",
    "Classic": " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    "Blocks": " ▁▂▃▄▅▆▇█░▒▓█▀▄█",
    "Numbers": " 1234567890",
    "Letters": " iIlLqQW",
    "Symbols": " .,:;!oO@#",
    "Chunky": " `-~+=*%@"
  };

  // Image handling
  let imgOpacity = 255;
  let imgScale = 1.0; 
  let imgSpeed = 1.0; 
  
  // Buffers
  let imgBuffer; 
  let smallBuffer; // Optimization: Downsampled buffer for ASCII analysis
  let lastSampleTime = 0; 
  let baseFPS = 15; 
  let minSamplePeriod = 1000 / 60; 

  // Helper for optimized canvas with willReadFrequently
  function createOptimizedGraphics(w, h) {
    const cnv = document.createElement('canvas');
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    return {
      canvas: cnv,
      elt: cnv, // Alias for p5 compatibility
      width: w,
      height: h,
      ctx: ctx,
      pixels: null,
      imageData: null,
      clear: function() {
        this.ctx.clearRect(0, 0, this.width, this.height);
      },
      image: function(img, x, y, w, h) {
        const src = img.canvas || img.elt || img;
        if (w !== undefined && h !== undefined) this.ctx.drawImage(src, x, y, w, h);
        else this.ctx.drawImage(src, x, y);
      },
      loadPixels: function() {
        this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        this.pixels = this.imageData.data;
      },
      updatePixels: function() {
        if (this.imageData) this.ctx.putImageData(this.imageData, 0, 0);
      }
    };
  }

  p.setup = function() {
    let cnv = p.createCanvas(800, 800);
    // FIX: Target the correct container ID from index.html
    let container = p.select('#input-canvas-holder');
    if (container) {
      cnv.parent(container);
      // Responsive Canvas Styles
      cnv.style('max-width', '100%');
      cnv.style('max-height', '100%');
      cnv.style('display', 'block');
      cnv.style('margin', '0 auto');
      cnv.style('mix-blend-mode', 'multiply');
      cnv.elt.getContext('2d', { willReadFrequently: true }); // Hint to suppress warnings
    }

    p.frameRate(30); // OPTIMIZATION: Reduce FPS to save resources
    p.pixelDensity(1);
    p.textFont("'ocr-a-std', monospace");
    p.textAlign(p.CENTER, p.CENTER);
    p.noStroke();
    
    gfxFrame = createOptimizedGraphics(p.width, p.height);

    imgBuffer = p.createGraphics(p.width, p.height);
    imgBuffer.pixelDensity(1);
    imgBuffer.elt.getContext('2d', { willReadFrequently: true }); // Fix Canvas2D warning
    imgBuffer.clear();

    // Default Colors
    cMono  = p.color(255);
    cDark  = p.color(180, 200, 255);
    cLight = p.color(255, 255, 255);
    bgColor = p.color("#ffffff");
    
    // Heatmap Colors for Brightness Mode
    cHeat1 = p.color(20, 0, 50);    // Dark Purple
    cHeat2 = p.color(220, 20, 60);  // Crimson
    cHeat3 = p.color(255, 220, 0);  // Gold

    // Color Presets
    stabiloPalette = [
      p.color(60, 190, 185),   // Turquoise
      p.color(240, 130, 150),  // Pink Blush
      p.color(245, 225, 80),   // Milky Yellow
      p.color(160, 130, 190)   // Lilac Haze
    ];
    cmykPalette = [
      p.color(0, 174, 239),    // Cyan
      p.color(236, 0, 140),    // Magenta
      p.color(245, 230, 0),    // Yellow
      p.color(0, 166, 81)      // Green
    ];

    bindExistingUI(); // Bind to HTML controls instead of creating new ones

    // --- OBSERVER TO STYLE P5.JS DEFAULT PROGRESS BAR ---
    // p5.saveGif creates a status div at bottom-left. We force it to bottom-right and style it.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // 1. Detect when p5 adds the progress bar
        for (const node of m.addedNodes) {
          if (node.tagName === 'DIV') {
             const txt = node.innerText || "";
             // Check keywords: Saving, Frame, Save
             if (txt.includes('Saving') || txt.includes('Frame') || txt.includes('Save')) {
               // A. Hide the original p5 bar completely
               node.style.display = 'none';
               
               // B. Mirror the text to OUR custom status bar (which is correctly positioned)
               showStatus(txt);
               
               // C. Watch for text updates (e.g. "Frame 10/120") and update our bar
               const innerObs = new MutationObserver(() => {
                 showStatus(node.innerText);
               });
               innerObs.observe(node, { characterData: true, childList: true, subtree: true });
             }
          }
        }
        
        // 2. Detect when p5 removes the progress bar (Saving done)
        for (const node of m.removedNodes) {
          if (node.tagName === 'DIV') {
             const txt = node.innerText || "";
             if (txt.includes('Saving') || txt.includes('Frame') || txt.includes('Save')) {
               showStatus(""); // Clear our custom status
             }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });

    // --- EXPOSE RESET FUNCTION GLOBALLY ---
    window.resetImageProcessor = () => {
      blobImg = null;
      currentFile = null;
      showImage = false;
      isAnimated = false;
      p.background(255); // Clear canvas
      p.redraw(); // Force clear visual
      
      // Reset UI elements
      const previewBox = p.select('#preview-area');
      if(previewBox) previewBox.html('');
      const fileIn = p.select('#fileIn');
      if(fileIn) fileIn.elt.value = '';
    };

    // --- EXPOSE PAUSE/RESUME FOR PERFORMANCE ---
    window.pauseImageProcessor = () => {
      p.noLoop();
    };
    
    window.resumeImageProcessor = () => {
      p.loop();
      needsUpdate = true; // Force one draw upon resume
    };
  };

  p.draw = function() {
    // OPTIMIZATION: Skip rendering if image is static and no settings changed
    if (blobImg && !isAnimated && !isJittering && !needsUpdate) return;
    needsUpdate = false; // Reset flag

    p.background(255);

    // FIX: Ngăn không cho vẽ hiệu ứng (gây nhiễu màu) khi chưa có ảnh
    if (!blobImg) return;

    if (blobImg) {
      let shouldUpdateBuffer = true;

      if (isAnimated) {
        const now = p.millis();
        const desiredPeriod = p.max(minSamplePeriod, (1000 / baseFPS) / p.max(0.1, imgSpeed));
        if (now - lastSampleTime < desiredPeriod) {
           shouldUpdateBuffer = false;
        } else {
           lastSampleTime = now;
        }
      }

      if (shouldUpdateBuffer) {
        imgBuffer.clear();
        
        // FIX: Giữ nguyên tỉ lệ khung hình (Aspect Ratio) của ảnh gốc
        let aspect = blobImg.width / blobImg.height;
        let canvasAspect = p.width / p.height;
        let drawW, drawH;
        
        if (aspect > canvasAspect) { drawW = p.width * imgScale; drawH = drawW / aspect; } 
        else { drawH = p.height * imgScale; drawW = drawH * aspect; }

        // Use native context to avoid p5.image type errors
        const ctx = imgBuffer.drawingContext;
        const dx = (p.width - drawW) / 2;
        const dy = (p.height - drawH) / 2;
        const src = blobImg.canvas || blobImg.elt;
        if(src) ctx.drawImage(src, dx, dy, drawW, drawH);
      }

      if (showImage) {
        p.drawingContext.save();
        p.drawingContext.globalAlpha = imgOpacity / 255;
        p.drawingContext.drawImage(imgBuffer.elt, 0, 0, p.width, p.height);
        p.drawingContext.restore();
      }
    }

    // Copy frame for sampling (Only needed for Dither or Track modes)
    if (renderMode === 'dither' || mode === 'track') {
      gfxFrame.clear();
      gfxFrame.image(imgBuffer, 0, 0);
    }

    // --- SEAMLESS ANIMATION SEEDING ---
    // Ensure random values loop perfectly for GIF export
    let seed = 12345;
    if (isJittering) {
      let loopFrame = p.frameCount % gifLength;
      seed += p.floor(loopFrame / 6); // Change seed every 6 frames
    }
    p.randomSeed(seed);

    // --- DITHER MODE ---
    if (renderMode === 'dither') {
      drawDither();
      return; // Skip ASCII rendering
    }

    if ((mode === "track") && blobImg) centroid = estimateCentroidFromBuffer();

    if (mode === "replica" || mode === "replicaSolid" || mode === "mask" || mode === "maskSolid") {
      drawAsciiReplicaOrMask();
    } else {
      drawAsciiTrack();
    }
  };

  /* ---------------- Replica / Mask ---------------- */
  function drawAsciiReplicaOrMask() {
    const cell = asciiGrid;
    const cols = p.floor(p.width / cell);
    const rows = p.floor(p.height / cell);
    const n = cols * rows;

    if (_lumPrev.length !== n) {
      _lumPrev = new Array(n).fill(255); _rPrev = new Array(n).fill(255);
      _gPrev = new Array(n).fill(255); _bPrev = new Array(n).fill(255);
    }

    // OPTIMIZATION: Downsample image to grid size for faster pixel access
    if (!smallBuffer || smallBuffer.width !== cols || smallBuffer.height !== rows) {
      if (smallBuffer) smallBuffer.remove();
      smallBuffer = p.createGraphics(cols, rows);
      smallBuffer.pixelDensity(1);
    }
    smallBuffer.clear();
    smallBuffer.image(imgBuffer, 0, 0, cols, rows);
    smallBuffer.loadPixels();

    // Animation smoothing
    const alphaT = p.constrain(p.map(speed, 0.2, 2.0, 0.18, 0.95), 0.08, 0.98);
    const sizeBuckets = 6;

    const useGradient = colorMode === "gradient";
    const useMono     = colorMode === "mono";
    const mono = cMono.levels;
    const dark = cDark.levels;
    const light = cLight.levels;
    
    const ramp = invertRamp ? rampReplica.split("").reverse().join("") : rampReplica;
    const rampLen = p.max(1, ramp.length - 1);
    const haveImg = !!blobImg;

    p.blendMode(p.MULTIPLY);
    p.noFill();
    p.strokeWeight(cmykSettings.weight);
    p.textSize(baseFont);
    
    p.textAlign(p.CENTER, p.CENTER);

    // OPTIMIZATION: Define offsets outside the loop to avoid GC churn
    const offsets = [
      { x: -cmykSettings.jitter, y: -cmykSettings.jitter },
      { x: cmykSettings.jitter, y: -cmykSettings.jitter },
      { x: 0, y: cmykSettings.jitter },
      { x: 0, y: 0 }
    ];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idxCell = y * cols + x;
        const cx = (x * cell + cell * 0.5);
        const cy = (y * cell + cell * 0.5);

        let r=255,g=255,b=255,a=0; 
        if (haveImg) {
          // OPTIMIZATION: Read from downsampled buffer (1 pixel = 1 cell)
          const i = 4 * (y * cols + x);
          if (i >= 0 && i < smallBuffer.pixels.length - 3) {
            r = smallBuffer.pixels[i];
            g = smallBuffer.pixels[i+1];
            b = smallBuffer.pixels[i+2];
            a = smallBuffer.pixels[i+3];
          }
        }

        // FIX: Nếu pixel trong suốt (vùng trống quanh ảnh), coi như màu trắng để không vẽ mực
        if (a < 50) {
          r = 255; g = 255; b = 255;
        }

        const lumNow = 0.2126*r + 0.7152*g + 0.0722*b;
        
        // FIX: NaN safety for lerp (from new logic)
        let safeLum = Number.isFinite(_lumPrev[idxCell]) ? _lumPrev[idxCell] : 255;
        const lum = _lumPrev[idxCell] = p.lerp(safeLum, lumNow, alphaT);
        
        let safeR = Number.isFinite(_rPrev[idxCell]) ? _rPrev[idxCell] : 255;
        let safeG = Number.isFinite(_gPrev[idxCell]) ? _gPrev[idxCell] : 255;
        let safeB = Number.isFinite(_bPrev[idxCell]) ? _bPrev[idxCell] : 255;
        const rr  = _rPrev[idxCell]   = p.lerp(safeR, r, alphaT);
        const gg  = _gPrev[idxCell]   = p.lerp(safeG, g, alphaT);
        const bb  = _bPrev[idxCell]   = p.lerp(safeB, b, alphaT);

        const t = lum / 255;
        const rampIdx = (t * rampLen) | 0;
        const ch = ramp[rampIdx] || " ";


        // mask alpha
        let maskA = 1.0;
        if ((mode === "mask" || mode === "maskSolid") && haveImg) {
          const m = (r + g) * 0.5 - b; // less blue → blob
          maskA = smoothstep(maskThreshold - maskSoftness, maskThreshold + maskSoftness, m);
        } else if (haveImg) {
          const blueBias = b - (r + g) * 0.5;
          if (blueBias > 25) maskA = 0.35; // gentle fade outside blob in replica
        }

        // opacity per mode
        let finalAlpha;
        if (mode === "replicaSolid") {
          finalAlpha = 255;                 
        } else if (mode === "maskSolid") {
          finalAlpha = 255 * maskA;         
        } else {
          finalAlpha = asciiOpacity * maskA; 
        }

        
        // CMYK Separation Math (Used for density calculation in all modes)
        let cVal = 255 - rr;
        let mVal = 255 - gg;
        let yVal = 255 - bb;
        let gVal = (255 - gg); // Greenish/Black channel
        if (mVal > 80) gVal -= mVal * 0.6;
        gVal = p.constrain(gVal, 0, 255);

        // Gamma
        let gamma = cmykSettings.gamma;
        cVal = p.pow(cVal / 255.0, gamma) * 255.0;
        mVal = p.pow(mVal / 255.0, gamma) * 255.0;
        yVal = p.pow(yVal / 255.0, gamma) * 255.0;
        gVal = p.pow(gVal / 255.0, gamma) * 255.0;

        let values = [cVal, mVal, yVal, gVal];
        
        // Use Stabilo palette if selected, otherwise default to CMYK angles/colors
        let palette = (colorMode === 'stabilo') ? stabiloPalette : cmykPalette;
        

        for (let layer = 0; layer < 4; layer++) {
          let val = values[layer];
          if (val < cmykSettings.threshold) continue;

          let prob = p.map(val, cmykSettings.threshold, 255, 0, 1);
          prob = p.pow(prob, cmykSettings.probPow) * 1.2;

          if (p.random(1.0) < prob) {
            // Determine Color based on Mode
            if (colorMode === 'mono') {
              p.stroke(0, finalAlpha); // Black ink
            } else if (colorMode === 'image') {
              p.stroke(rr, gg, bb, finalAlpha); // Original pixel color
            } else if (colorMode === 'brightness') {
              // Dynamic color based on luminance (Heatmap style)
              let t = lum / 255;
              let c;
              if (t < 0.5) c = p.lerpColor(cHeat1, cHeat2, t * 2);
              else c = p.lerpColor(cHeat2, cHeat3, (t - 0.5) * 2);
              c.setAlpha(finalAlpha);
              p.stroke(c);
            } else {
              p.stroke(palette[layer]); // CMYK/Stabilo ink
            }
            
            p.text(ch, cx + offsets[layer].x, cy + offsets[layer].y);
          }
        }
      }
    }
    
    // Reset blend mode
    p.blendMode(p.BLEND);
  }

  /* ---------------- Dither (Floyd-Steinberg) ---------------- */
  function drawDither() {
    // 1. Convert to Grayscale -> REMOVED to keep colors
    // gfxFrame.filter(p.GRAY);
    
    // 2. Load Pixels
    gfxFrame.loadPixels();

    // 2.1 Pre-process: Increase Contrast (Tăng độ tương phản để hạt màu rõ hơn)
    const contrast = 1.3; // Tăng 30% tương phản
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < gfxFrame.pixels.length; i+=4) {
      gfxFrame.pixels[i]   = p.constrain(gfxFrame.pixels[i]   * contrast + intercept, 0, 255);
      gfxFrame.pixels[i+1] = p.constrain(gfxFrame.pixels[i+1] * contrast + intercept, 0, 255);
      gfxFrame.pixels[i+2] = p.constrain(gfxFrame.pixels[i+2] * contrast + intercept, 0, 255);
    }
    
    const w = gfxFrame.width;
    const h = gfxFrame.height;
    
    // 3. Apply Algorithm
    for (let y = 0; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (x + y * w) * 4;
        
        // Get old pixel value
        const oldR = gfxFrame.pixels[idx];
        const oldG = gfxFrame.pixels[idx+1];
        const oldB = gfxFrame.pixels[idx+2];
        
        // Jitter Noise (Thêm nhiễu động)
        let noise = 0;
        if (isJittering) noise = p.random(-20, 20);

        // Quantize (Thresholding)
        const thresh = cmykSettings.threshold;
        const newR = (oldR + noise < thresh) ? 0 : 255;
        const newG = (oldG + noise < thresh) ? 0 : 255;
        const newB = (oldB + noise < thresh) ? 0 : 255;
        
        // Set new pixel color
        gfxFrame.pixels[idx] = newR;     // R
        gfxFrame.pixels[idx+1] = newG;   // G
        gfxFrame.pixels[idx+2] = newB;   // B
        // Alpha (idx+3) remains unchanged
        
        // Calculate Error
        const errR = oldR - newR;
        const errG = oldG - newG;
        const errB = oldB - newB;
        
        // Distribute Error to Neighbors
        // Helper to add error to a pixel index (updates RGB)
        const addError = (i, factor) => {
          gfxFrame.pixels[i]   += errR * factor;
          gfxFrame.pixels[i+1] += errG * factor;
          gfxFrame.pixels[i+2] += errB * factor;
        };

        addError((x + 1 + y * w) * 4,       7 / 16); // Right
        addError((x - 1 + (y + 1) * w) * 4, 3 / 16); // Bottom Left
        addError((x + (y + 1) * w) * 4,     5 / 16); // Bottom
        addError((x + 1 + (y + 1) * w) * 4, 1 / 16); // Bottom Right
      }
    }
    
    gfxFrame.updatePixels();
    // FIX: Use native drawImage to avoid p5.js type checking errors with raw canvas
    p.drawingContext.drawImage(gfxFrame.canvas, 0, 0);
  }

  /* ---------------- Track ---------------- */
  function drawAsciiTrack() {
    const cell = asciiGrid;
    const cols = p.floor(p.width / cell);
    const rows = p.floor(p.height / cell);

    if (centroid.ok) fade = (fade + 0.04) % p.TWO_PI;

    p.textSize(baseFont);
    p.textAlign(p.CENTER, p.CENTER);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = x * cell + cell * 0.5;
        const cy = y * cell + cell * 0.5;

        let ch = ".";
        let alpha = asciiOpacity;

        if (centroid.ok) {
          const dx = centroid.x - cx;
          const dy = centroid.y - cy;
          const d = p.sqrt(dx*dx + dy*dy);

          const proximity = p.constrain(p.map(d, 0, p.width*0.6, 1, 0), 0, 1);
          const pulse = 0.5 + 0.5 * p.sin(fade + d*0.02);
          const denseIdx = p.floor(p.map(proximity * (0.6 + 0.4*pulse), 0, 1, 0, rampDense.length-1));
          ch = (d < 160) ? rampDense[denseIdx] : angleToChar(p.atan2(dy, dx));

          alpha = p.map(proximity, 0, 1, asciiOpacity*0.35, asciiOpacity);
        }

        p.fill(255, alpha);
        p.stroke(255, alpha);
        p.strokeWeight(1.5);
        p.strokeJoin(p.ROUND);
        p.text(ch, cx, cy);
      }
    }

    if (centroid.ok) {
      p.push();
      p.noStroke();
      // Note: drawingContext is on the main canvas, but in instance mode it's p.drawingContext
      const ctx = p.drawingContext;
      const g = ctx.createRadialGradient(
        centroid.x, centroid.y, 4,
        centroid.x, centroid.y, 120
      );
      g.addColorStop(0, "rgba(255,255,255,0.08)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      p.circle(centroid.x, centroid.y, 240);
      p.pop();
    }
  }

  function loadAndProcessImage(file) {
    if (!file) return;
    currentFile = file;

    // Show Spinner
    const spinner = document.getElementById('loading-spinner');
    if(spinner) spinner.style.display = 'block';

    isAnimated = (file.type === 'image/gif');
    // Toggle Speed Slider
    const rowSpeed = p.select('#rowSpeed');
    if(rowSpeed) rowSpeed.style('display', isAnimated ? 'flex' : 'none');

    const url = URL.createObjectURL(file);
    p.loadImage(url, img => {
      blobImg = img;
      
      // FIX: Auto-rescale large images for performance
      let w = img.width;
      let h = img.height;
      
      // Resize based on dimensions to prevent canvas crashes with large images
      const MAX_DIM = 800; // Automatic compression for performance
      if (w > MAX_DIM || h > MAX_DIM) {
          let ratio = w / h;
          if (w > h) { w = MAX_DIM; h = Math.floor(MAX_DIM / ratio); }
          else { h = MAX_DIM; w = Math.floor(MAX_DIM * ratio); }
          blobImg.resize(w, h); 
      }

      p.resizeCanvas(w, h);
      
      // Recreate buffers with new size
      gfxFrame = createOptimizedGraphics(w, h);
      
      if (imgBuffer) imgBuffer.remove(); // Prevent memory leak
      imgBuffer = p.createGraphics(w, h);
      imgBuffer.pixelDensity(1);
      imgBuffer.elt.getContext('2d', { willReadFrequently: true });
      imgBuffer.clear();

      // Show preview in sidebar
      const previewBox = p.select('#preview-area');
      if(previewBox) {
        previewBox.html('');
        let domImg = p.createImg(url, 'preview');
        domImg.parent(previewBox);
        domImg.style('max-width','100%'); domImg.style('max-height','100%');
      }

      // Auto enable animate for seamless experience
      isJittering = true;
      const sAnimate = p.select('#chkAnimate');
      if(sAnimate) sAnimate.checked(true);

      // Hide Spinner
      if(spinner) spinner.style.display = 'none';
      needsUpdate = true; // Trigger redraw
      p.redraw(); // Force draw immediately
    }, (e) => {
      if(window.customAlert) window.customAlert("Failed to load image.");
      else alert("Failed to load image.");
      if(spinner) spinner.style.display = 'none';
    });
  }

  // --- UI BINDING (Connects to index.html controls) ---
  function bindExistingUI() {
    // 1. Image Loading
    const btnLoad = p.select('#btnLoadImage');
    const fileIn = p.select('#fileIn');
    
    if (btnLoad && fileIn) {
      btnLoad.mousePressed(() => { fileIn.elt.click(); });
      fileIn.changed((e) => {
        loadAndProcessImage(e.target.files[0]);
      });
    }

    // --- Mapped Controls ---
    const sRenderMode = p.select('#selRenderMode');
    const asciiControls = p.select('#ascii-controls');
    if(sRenderMode) {
      sRenderMode.changed(() => {
        renderMode = sRenderMode.value();
        if(asciiControls) asciiControls.style('display', renderMode === 'ascii' ? 'block' : 'none');
        needsUpdate = true;
      });
    }

    const sColorMode = p.select('#selColorMode');
    if(sColorMode) sColorMode.changed(() => {
      colorMode = sColorMode.value();
      needsUpdate = true;
    });

    // Map "Pattern" slider to Stroke Weight
    const sWeight = p.select('#cfgWeight');
    if(sWeight) sWeight.input(() => { cmykSettings.weight = parseFloat(sWeight.value()); needsUpdate = true; });

    // Map "Threshold" slider (CMYK Threshold)
    const sThreshold = p.select('#cfgThreshold');
    if(sThreshold) sThreshold.input(() => {
      cmykSettings.threshold = parseFloat(sThreshold.value());
      needsUpdate = true;
    });
    
    const sSrcOpacity = p.select('#cfgSrcOpacity');
    if(sSrcOpacity) sSrcOpacity.input(() => {
      imgOpacity = parseFloat(sSrcOpacity.value());
      needsUpdate = true;
    });

    const sScale = p.select('#sldScale');
    if(sScale) sScale.input(() => { imgScale = parseFloat(sScale.value()); needsUpdate = true; });

    const sShowSource = p.select('#chkShowSrc');
    if(sShowSource) sShowSource.changed(() => { showImage = sShowSource.checked(); needsUpdate = true; });

    const sChars = p.select('#inpChars');
    if(sChars) sChars.input(() => { rampReplica = sChars.value(); needsUpdate = true; });

    // Map "Invert" checkbox
    const sInvert = p.select('#chkInvert');
    if(sInvert) sInvert.changed(() => { invertRamp = sInvert.checked(); needsUpdate = true; });

    // Map "Animate" checkbox
    const sAnimate = p.select('#chkAnimate');
    if(sAnimate) sAnimate.changed(() => { 
      isJittering = sAnimate.checked(); 
      needsUpdate = true; 
    });

    // --- NEW: Preset Dropdown ---
    const sPreset = p.select('#selAsciiPreset');
    if(sPreset) {
      // Populate options
      sPreset.html(''); // Clear existing
      Object.keys(rampPresets).forEach(key => {
        sPreset.option(key);
      });
      // Bind change event
      sPreset.changed(() => {
        rampReplica = rampPresets[sPreset.value()];
        needsUpdate = true;
      });
    }

    // 4. Save Button
    const btnSave = p.select('#cmykSaveBtn');
    if(btnSave) {
      btnSave.mousePressed(() => {
        if (!blobImg) {
          if(window.customAlert) window.customAlert("No image to save!");
          else alert("No image to save!");
          return;
        }

        let res = p.get();
        let name = "Memory_" + p.millis();
        if(window.addToLibrary) window.addToLibrary(res, name);
        
        // --- RESET STATE TO REDUCE LAG ---
        blobImg = null; // Quan trọng: Ngắt vòng lặp xử lý ảnh nặng
        currentFile = null;
        showImage = false;
        isAnimated = false;
        
        // Reset UI (Xóa tên file và ảnh preview)
        const fileIn = p.select('#fileIn');
        if(fileIn) fileIn.elt.value = ''; 
        const previewBox = p.select('#preview-area');
        if(previewBox) previewBox.html('<span class="muted">EMPTY</span>');
        p.background(255); // Xóa trắng canvas

        showStatus("SAVED TO LIBRARY");
        setTimeout(() => showStatus(""), 3000);
      });
    }

    // --- NEW: Download PNG Button ---
    const btnDownload = p.select('#btnSavePNG');
    if(btnDownload) {
      btnDownload.mousePressed(() => {
        if (isJittering) {
          // Save GIF 30 frames (faster) instead of 120. 30 frames @ 30fps = 1 second loop.
          p.saveGif("memory_jitter.gif", gifLength, { units: 'frames' });
        } else {
          p.save("memory_static.png");
          showStatus("IMAGE SAVED");
          setTimeout(() => showStatus(""), 2000);
        }
      });
    }

  }

  let statusDiv;
  function showStatus(msg) {
    if (!statusDiv) {
      statusDiv = p.createDiv('');
      statusDiv.parent(document.body); // Move to body to avoid transform issues
      statusDiv.style('position', 'fixed');
      statusDiv.style('bottom', '20px');
      statusDiv.style('right', '20px');
      statusDiv.style('left', 'auto'); // Ensure it doesn't stick to the left
      statusDiv.style('font-family', '"ocr-a-std", monospace');
      statusDiv.style('font-size', '10pt');
      statusDiv.style('color', '#000');
      statusDiv.style('background', '#fff');
      statusDiv.style('padding', '4px 8px');
      statusDiv.style('border', '1px solid #000');
      statusDiv.style('z-index', '9999');
      statusDiv.style('text-transform', 'uppercase');
    }
    if (msg) {
      statusDiv.html(msg);
      statusDiv.style('display', 'block');
    } else {
      statusDiv.style('display', 'none');
    }
  }

  /* ---------------- Helpers ---------------- */
  function smoothstep(edge0, edge1, x) {
    const t = p.constrain((x - edge0) / p.max(1e-6, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function angleToChar(a) {
    const dirs = [
      { a: -p.PI,     c: "<" },
      { a: -3*p.PI/4, c: "/" },
      { a: -p.PI/2,   c: "^" },
      { a: -p.PI/4,   c: "\\" },
      { a: 0,         c: ">" },
      { a: p.PI/4,    c: "/" },
      { a: p.PI/2,    c: "v" },
      { a: 3*p.PI/4,  c: "\\" },
      { a: p.PI,      c: "<" },
    ];
    let best = dirs[0], md = 1e9;
    for (const d of dirs) {
      const diff = p.abs(a - d.a) % p.TWO_PI;
      const dist = diff > p.PI ? p.TWO_PI - diff : diff;
      if (dist < md) { md = dist; best = d; }
    }
    return best.c;
  }

  function estimateCentroidFromBuffer() {
    gfxFrame.loadPixels();
    let sumX=0, sumY=0, count=0;
    for (let y = 0; y < p.height; y += sampleStep) {
      for (let x = 0; x < p.width; x += sampleStep) {
        const i = 4 * (y * p.width + x);
        const r = gfxFrame.pixels[i], g = gfxFrame.pixels[i+1], b = gfxFrame.pixels[i+2], a = gfxFrame.pixels[i+3];
        if (a > 10) {
          const blueBias = b - (r + g) * 0.5;
          if (blueBias < -trackThresh) { sumX += x; sumY += y; count++; }
        }
      }
    }
    gfxFrame.updatePixels();
    if (count > 200) return { x: sumX / count, y: sumY / count, ok: true };
    return { x: p.width/2, y: p.height/2, ok: false };
  }
};

// Khởi tạo Instance P5 cho CMYK tab
new p5(cmykSketch);