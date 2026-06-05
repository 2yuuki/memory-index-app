/**
 * The Memory Index - CMYK ASCII Effect
 * Copyright (C) 2025 Nguyen Thu Trang (s3926717)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const cmykSketch = (p) => {
  let blobImg = null, gfxFrame;
  let showImage = false;
  let isAnimated = false;
  let isJittering = false; 
  let needsUpdate = true; 
  let gifLength = 30; 
  let currentFile = null; 
  let videoStream = null; 
  let videoEl = null;     
  const webcamFlipX = true;
  const webcamMaxDim = 720;
  const webcamBaseFPS = 10;
  const webcamAsciiGrid = 6;
  const webcamSampleStep = 6;
  const webcamBrightness = 1.3;

  // --- UNIVERSAL ASCII SETTINGS ---
  let mode = "replica"; 
  let renderMode = "ascii"; 
  let colorMode = "cmyk"; 
  
  // Colors
  let cMono, cDark, cLight, bgColor;
  let stabiloPalette, cmykPalette;
  let cHeat1, cHeat2, cHeat3;
  
  // CMYK Stroke Settings
  let cmykSettings = {
    weight: 2.5,
    threshold: 80,
    gamma: 1.3,
    jitter: 1.5,
    probPow: 1.3
  };

  // Dynamics
  let sizeMin = 0.85, sizeMax = 1.25;
  let speed = 1.0; 
  let _lumPrev = [], _rPrev = [], _gPrev = [], _bPrev = [];

  // Mask & Track
  let maskThreshold = 55;
  let maskSoftness = 25;
  let trackThresh = 48;
  let sampleStep = 4;
  let centroid = { x: 0, y: 0, ok: false }, fade = 0;

  let handDetectIntervalId = null;
  let handposeModel = null;
  let handPredictions = [];

  // ASCII settings
  // Grid cell size in pixels (controls pixelation). Keep reasonably large to avoid very fine grids that are slow.
  const MIN_ASCII_GRID = 6;
  const MAX_ASCII_GRID = 64;
  let asciiGrid = MIN_ASCII_GRID;
   let baseFont = 14;
   let asciiOpacity = 240;
   let rampReplica = " .'`^,:;~-_+*=!/?|()[]{}<>i!lI;:o0O8&%$#@";
   const rampDense = " .:-=+*#%@";
   let rampBlocks = "▁▂▃▄▅▆▇█"; 
   let invertRamp = false;

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
  let smallBuffer; 
  let lastSampleTime = 0; 
  let baseFPS = 15; 
  let minSamplePeriod = 1000 / 60; 
  const defaultBaseFPS = baseFPS;
  const defaultAsciiGrid = asciiGrid;
  const defaultSampleStep = sampleStep;

  function createOptimizedGraphics(w, h) {
    const cnv = document.createElement('canvas');
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    return {
      canvas: cnv,
      elt: cnv, 
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
    let container = p.select('#input-canvas-holder');
    if (container) {
      cnv.parent(container);
      cnv.style('max-width', '100%');
      cnv.style('max-height', '100%');
      cnv.style('display', 'block');
      cnv.style('margin', '0 auto');
      cnv.style('mix-blend-mode', 'multiply');
      cnv.elt.getContext('2d', { willReadFrequently: true }); 
    }

    p.frameRate(30); 
    p.pixelDensity(1);
    p.textFont("'Courier New', monospace");
    p.textAlign(p.CENTER, p.CENTER);
    p.noStroke();
    
    gfxFrame = createOptimizedGraphics(p.width, p.height);

    imgBuffer = p.createGraphics(p.width, p.height);
    imgBuffer.pixelDensity(1);
    imgBuffer.elt.getContext('2d', { willReadFrequently: true });
    imgBuffer.clear();

    cMono  = p.color(255);
    cDark  = p.color(180, 200, 255);
    cLight = p.color(255, 255, 255);
    bgColor = p.color("#ffffff");
    
    cHeat1 = p.color(20, 0, 50);    
    cHeat2 = p.color(220, 20, 60);  
    cHeat3 = p.color(255, 220, 0);  

    stabiloPalette = [
      p.color(60, 190, 185),   
      p.color(240, 130, 150),  
      p.color(245, 225, 80),   
      p.color(160, 130, 190)   
    ];
    cmykPalette = [
      p.color("#000000"), // darkest
      p.color("#0000FF"),
      p.color("#FF0000"),
      p.color("#FF00FF"),
      p.color("#00FF00"),
      p.color("#00FFFF"),
      p.color("#FFFF00"),
      p.color("#FFFFFF")  // lightest
    ];

    bindExistingUI(); 

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.tagName === 'DIV') {
             const txt = node.innerText || "";
             if (txt.includes('Saving') || txt.includes('Frame') || txt.includes('Save')) {
               node.style.display = 'none';
               showStatus(txt);
               const innerObs = new MutationObserver(() => { showStatus(node.innerText); });
               innerObs.observe(node, { characterData: true, childList: true, subtree: true });
             }
          }
        }
        for (const node of m.removedNodes) {
          if (node.tagName === 'DIV') {
             const txt = node.innerText || "";
             if (txt.includes('Saving') || txt.includes('Frame') || txt.includes('Save')) {
               showStatus(""); 
             }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });

    window.resetImageProcessor = () => {
      if (videoStream) {
          videoStream.getTracks().forEach(track => track.stop());
          videoStream = null;
      }
      if (videoEl) {
          videoEl.remove();
          videoEl = null;
      }
      const btnWebcam = document.getElementById('btnWebcam');
      if(btnWebcam) {
          btnWebcam.innerText = "Use Webcam";
          btnWebcam.classList.remove('active');
      }
      blobImg = null;
      currentFile = null;
      showImage = false;
      isAnimated = false;
      p.background(255); 
      p.redraw(); 
      
      const previewBox = p.select('#preview-area');
      if(previewBox) previewBox.html('');
      const fileIn = p.select('#fileIn');
      if(fileIn) fileIn.elt.value = '';
    };

    window.pauseImageProcessor = () => {
      p.noLoop();
      if (handDetectIntervalId) { clearInterval(handDetectIntervalId); handDetectIntervalId = null; }
    };
    
    window.resumeImageProcessor = () => {
      p.loop();
      needsUpdate = true; 
      if (!handDetectIntervalId && videoEl && window.ml5) setupHandposeModel();
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
        
        // Maintain original image aspect ratio
        let aspect = blobImg.width / blobImg.height;
        let canvasAspect = p.width / p.height;
        let drawW, drawH;
        const fitMode = blobImg.fit || 'contain'; // contain | cover
        
        if (fitMode === 'cover') {
          if (aspect > canvasAspect) { drawH = p.height * imgScale; drawW = drawH * aspect; }
          else { drawW = p.width * imgScale; drawH = drawW / aspect; }
        } else {
          if (aspect > canvasAspect) { drawW = p.width * imgScale; drawH = drawW / aspect; } 
          else { drawH = p.height * imgScale; drawW = drawH * aspect; }
        }

        // Use native context to avoid p5.image type errors
        const ctx = imgBuffer.drawingContext;
        const dx = (p.width - drawW) / 2;
        const dy = (p.height - drawH) / 2;
        const src = blobImg.canvas || blobImg.elt;
        if (src) {
          // If source is a live video element, apply brightness filter for better visibility
          const isVideo = (typeof HTMLVideoElement !== 'undefined') && (src instanceof HTMLVideoElement || (blobImg.elt && blobImg.elt.tagName && blobImg.elt.tagName.toLowerCase() === 'video'));
          if (isVideo) {
            ctx.save();
            ctx.filter = `brightness(${webcamBrightness})`;
            if (blobImg.flip) {
              ctx.scale(-1, 1);
              ctx.drawImage(src, -(dx + drawW), dy, drawW, drawH);
            } else {
              ctx.drawImage(src, dx, dy, drawW, drawH);
            }
            ctx.filter = 'none';
            ctx.restore();
          } else {
            if (blobImg.flip) {
              ctx.save();
              ctx.scale(-1, 1);
              ctx.drawImage(src, -(dx + drawW), dy, drawW, drawH);
              ctx.restore();
            } else {
              ctx.drawImage(src, dx, dy, drawW, drawH);
            }
          }
         }
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

  /* ---------------- Replica / Mask (FIXED PROPERTIES BINDING) ---------------- */
  function drawAsciiReplicaOrMask() {
    const cell = asciiGrid;
    const cols = p.floor(p.width / cell);
    const rows = p.floor(p.height / cell);

    // OPTIMIZATION: Use our lightweight optimized canvas for downsampling to avoid p5.getImageData warnings
    if (!smallBuffer || smallBuffer.width !== cols || smallBuffer.height !== rows) {
      // Release previous buffer if any
      if (smallBuffer) {
        try { if (typeof smallBuffer.remove === 'function') smallBuffer.remove(); } catch(e) {}
      }
      smallBuffer = createOptimizedGraphics(cols, rows);
    }
    smallBuffer.clear();
    // Draw downsampled source into optimized buffer
    smallBuffer.image(imgBuffer, 0, 0, cols, rows);
    // Use optimized loadPixels that uses willReadFrequently context
    smallBuffer.loadPixels();

    p.push();
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);

    // Character sets
    const blocks = rampBlocks; // shadows (configurable)
    const mids = rampReplica || rampDense;      // midtones (user-editable)
    const highlightChar = " "; // highlights -> space

    // Dynamic thresholds tied to UI 'threshold' control
    let t_adj = p.max(0.1, cmykSettings.threshold / 40.0); // 40 => neutral
    const shadowCut = p.constrain(0.33 * t_adj, 0.0, 0.85);
    const midCut = p.constrain(1.0 - (0.1 / t_adj), shadowCut + 0.05, 0.99);

    // Text size now derived directly from cell size; pattern scale controls asciiGrid
    const txtSize = p.max(4, Math.floor(cell * 0.95));
    p.textSize(txtSize);
    if (cell >= 8) p.textStyle(p.BOLD); else p.textStyle(p.NORMAL);

    // Color mode helpers
    const useGradient = (colorMode === 'gradient');
    const useMono = (colorMode === 'mono');
    const mono = cMono ? cMono.levels : [255,255,255];
    const dark = cDark ? cDark.levels : [0,0,0];
    const light = cLight ? cLight.levels : [255,255,255];
    const haveImg = !!blobImg;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = 4 * (y * cols + x);
        let r = 255, g = 255, b = 255, a = 255;
        if (smallBuffer && smallBuffer.pixels && i >= 0 && i + 3 < smallBuffer.pixels.length) {
          r = smallBuffer.pixels[i];
          g = smallBuffer.pixels[i+1];
          b = smallBuffer.pixels[i+2];
          a = smallBuffer.pixels[i+3];
        }

        // Treat transparent as white (no ink)
        if (a < 50) { r = 255; g = 255; b = 255; }

        // Luminance (0 dark .. 255 bright)
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        let t = p.constrain(lum / 255, 0, 1);

        // Compute maskAlpha similar to previous logic to respect mask mode
        let maskA = 1.0;
        if ((mode === "mask" || mode === "maskSolid") && blobImg) {
          const m = (r + g) * 0.5 - b; // less blue → blob
          maskA = smoothstep(maskThreshold - maskSoftness, maskThreshold + maskSoftness, m);
        } else if (blobImg) {
          const blueBias = b - (r + g) * 0.5;
          if (blueBias > 25) maskA = 0.35; // gentle fade outside blob
        }

        // Apply gamma (UI) and invert (UI)
        if (cmykSettings.gamma !== 1.0 && cmykSettings.gamma > 0) t = Math.pow(t, cmykSettings.gamma);
        if (invertRamp) t = 1.0 - t;

        // final alpha (respect mode)
        let finalAlpha;
        if (mode === "replicaSolid") finalAlpha = 255;
        else if (mode === "maskSolid") finalAlpha = 255 * maskA;
        else finalAlpha = asciiOpacity * maskA;

        // Choose character based on luminance band
        let ch = highlightChar;
        if (t <= shadowCut) {
          // Shadow: map darker values to heavier block (reverse mapping: darker => larger block)
          const subT = p.map(t, 0, shadowCut, 1, 0); // 1..0 where 1 = darkest
          const idx = p.constrain(Math.floor(subT * (blocks.length)), 0, blocks.length - 1);
          ch = blocks[idx];
        } else if (t < midCut) {
          // Midtone: use user-defined replica ramp
          const subT = p.map(t, shadowCut, midCut, 0, 1);
          const idx = p.constrain(Math.floor(subT * (mids.length)), 0, mids.length - 1);
          ch = mids[idx];
        } else {
          // Highlight: keep space (no ink)
          ch = highlightChar;
        }

        // Draw single, non-overlapping character per grid cell
        const cx = x * cell + cell * 0.5;
        const cy = y * cell + cell * 0.5;

        // Apply color/ink type
        if (ch !== highlightChar) {
          // Use marker-style overlay for CMYK/stabilo color modes
          if (colorMode === 'cmyk' || colorMode === 'markers' || colorMode === 'stabilo') {
            // select palette
            const palette = (colorMode === 'cmyk') ? cmykPalette : stabiloPalette;
            // pick color by luminance t (darker->first)
            const pi = p.constrain(Math.floor(t * palette.length), 0, palette.length - 1);
            const col = palette[pi] || p.color(0,0,0);
            const levels = col.levels || [0,0,0];
            // draw with screen composite to simulate marker blending (user requested 'screen')
            const ctx = p.drawingContext;
            ctx.save();
            try {
              // Use 'difference' only when the original source preview is shown, otherwise use 'multiply'
              const op = (typeof showImage !== 'undefined' && showImage) ? 'difference' : 'multiply';
              ctx.globalCompositeOperation = op;
            } catch (e) { /* some contexts may not support this mode, ignore */ }
            p.fill(levels[0], levels[1], levels[2], finalAlpha);
            p.text(ch, cx, cy);
            ctx.restore();
          } else if (colorMode === 'image' && haveImg) {
            p.fill(r, g, b, finalAlpha);
            p.text(ch, cx, cy);
          } else if (useMono) {
            p.fill(mono[0], mono[1], mono[2], finalAlpha);
            p.text(ch, cx, cy);
          } else if (useGradient) {
            const cr = p.lerp(dark[0], light[0], t);
            const cg = p.lerp(dark[1], light[1], t);
            const cb = p.lerp(dark[2], light[2], t);
            p.fill(cr, cg, cb, finalAlpha);
            p.text(ch, cx, cy);
          } else {
            // default (fallback)
            p.fill(0, finalAlpha);
            p.text(ch, cx, cy);
          }
         }
      }
    }

    p.pop();
  }

  /* ---------------- Dither (Floyd-Steinberg) ---------------- */
  function drawDither() {
    // 1. Convert to Grayscale -> REMOVED to keep colors
    // gfxFrame.filter(p.GRAY);
    
    // 2. Load Pixels
    gfxFrame.loadPixels();

    // 2.1 Pre-process: Increase Contrast (to make color grains clearer)
    const contrast = 1.3; // Tăng 30% tương phản
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < gfxFrame.pixels.length; i+=4) {
      gfxFrame.pixels[i]   = p.constrain(gfxFrame.pixels[i]   * contrast + intercept, 0, 255);
      gfxFrame.pixels[i+1] = p.constrain(gfxFrame.pixels[i+1] * contrast + intercept, 0, 255);
      gfxFrame.pixels[i+2] = p.constrain(gfxFrame.pixels[i+2] * contrast + intercept, 0, 255);
    }
    
    const w = gfxFrame.width;
    const h = gfxFrame.height;
    
    // Map Threshold slider (0-100) to pixel values (0-255)
    const thresh = p.map(cmykSettings.threshold, 0, 100, 0, 255);
    
    // 3. Apply Algorithm
    for (let y = 0; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (x + y * w) * 4;
        
        // Get old pixel value
        const oldR = gfxFrame.pixels[idx];
        const oldG = gfxFrame.pixels[idx+1];
        const oldB = gfxFrame.pixels[idx+2];
        
        // Jitter Noise (Add dynamic noise)
        let noise = 0;
        if (isJittering) noise = p.random(-20, 20);

        // Quantize (Thresholding)
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

  // --- UI BINDING ---
  function bindExistingUI() {
    const btnLoad = p.select('#btnLoadImage');
    const fileIn = p.select('#fileIn');
    
    if (btnLoad && fileIn) {
      btnLoad.mousePressed(() => { fileIn.elt.click(); });
      fileIn.changed((e) => {
        loadAndProcessImage(e.target.files[0]);
      });
    }

    const btnWebcam = document.getElementById('btnWebcam');
    const startWebcam = () => {
      if (videoStream) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Webcam not supported or blocked. Please use HTTPS or localhost.");
        return;
      }

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: webcamBaseFPS, max: webcamBaseFPS }
        }
      };

      navigator.mediaDevices.getUserMedia(constraints).then(stream => {
         videoStream = stream;
         videoEl = document.createElement('video');
         videoEl.srcObject = stream;
         videoEl.setAttribute('playsinline', '');
         videoEl.muted = true;
         videoEl.autoplay = true;
         videoEl.style.position = 'absolute';
         videoEl.style.left = '-9999px';
         videoEl.style.top = '0';
         videoEl.style.width = '320px';
         videoEl.style.height = '240px';
         videoEl.style.opacity = '0';
         videoEl.style.pointerEvents = 'none';
         document.body.appendChild(videoEl);
         videoEl.play().catch(e => console.error("Auto-play failed", e));

         videoEl.onloadedmetadata = () => {
           let w = videoEl.videoWidth;
           let h = videoEl.videoHeight;
           videoEl.width = w;
           videoEl.height = h;

           const MAX_DIM = 800;
           if (w > MAX_DIM || h > MAX_DIM) {
             let ratio = w / h;
             if (w > h) { w = MAX_DIM; h = Math.floor(MAX_DIM / ratio); }
             else { h = MAX_DIM; w = Math.floor(MAX_DIM * ratio); }
           }

           const sheetSize = getImageProcSheetSize();
           const targetW = sheetSize ? sheetSize.w : w;
           const targetH = sheetSize ? sheetSize.h : h;
           p.resizeCanvas(targetW, targetH);

           gfxFrame = createOptimizedGraphics(targetW, targetH);
           if (imgBuffer) imgBuffer.remove();
           imgBuffer = p.createGraphics(targetW, targetH);
           imgBuffer.pixelDensity(1);
           imgBuffer.elt.getContext('2d', { willReadFrequently: true });
           imgBuffer.clear();

           blobImg = { width: videoEl.videoWidth, height: videoEl.videoHeight, elt: videoEl, canvas: videoEl, flip: webcamFlipX, fit: 'cover' };
           isAnimated = true;

           if (btnWebcam) {
             btnWebcam.innerText = "Stop Webcam";
             btnWebcam.classList.add('active');
           }

           const ph = p.select('#tab-image-proc .placeholder-text');
           if(ph) ph.style('display', 'none');
         };
       }).catch(err => {
         console.error(err);
         alert("Could not access webcam: " + err.message);
       });
     };

    if (btnWebcam) {
      window.startWebcamAuto = () => startWebcam();
    }

    if (btnWebcam) {
      btnWebcam.addEventListener('click', () => {
        if (videoStream) {
            if (videoEl && videoEl.readyState >= 2) {
                let w = videoEl.videoWidth;
                let h = videoEl.videoHeight;
                let staticImg = p.createImage(w, h);
                staticImg.drawingContext.drawImage(videoEl, 0, 0, w, h);
                
                videoStream.getTracks().forEach(track => track.stop());
                videoStream = null;
                if (handDetectIntervalId) { clearInterval(handDetectIntervalId); handDetectIntervalId = null; }
                if (videoEl) { videoEl.remove(); videoEl = null; }
                handPredictions = [];
                 
                staticImg.flip = webcamFlipX;
                staticImg.fit = 'cover';
                blobImg = staticImg;
                isAnimated = false;
                
                btnWebcam.innerText = "Use Webcam";
                btnWebcam.classList.remove('active');
                
                needsUpdate = true;
                p.redraw();
            }
        } else {
            startWebcam();
        }
      });
    }

    const sRenderMode = p.select('#selRenderMode');
    const asciiControls = p.select('#ascii-controls');
    if(sRenderMode) {
      sRenderMode.changed(() => {
        renderMode = sRenderMode.value();
        if(asciiControls) asciiControls.style('display', renderMode === 'ascii' ? 'block' : 'none');
        needsUpdate = true;
        p.redraw();
      });
    }

    const sColorMode = p.select('#selColorMode');
    if(sColorMode) sColorMode.changed(() => {
      colorMode = sColorMode.value();
      needsUpdate = true;
      p.redraw();
    });

    const sWeight = p.select('#cfgWeight');
    // Robust binding: support both p5 element and native input element.
    // If the slider exposes min/max, map its range to the ascii grid range.
    function handleWeightChange(val, srcEl) {
      let num = parseFloat(val);
      if (isNaN(num)) return;

      // If source element has min/max, map slider proportionally to [MIN_ASCII_GRID, MAX_ASCII_GRID]
      try {
        const el = srcEl && srcEl.target ? srcEl.target : srcEl || null;
        let minV = null, maxV = null;
        if (el) {
          if (el.min !== undefined && el.max !== undefined) { minV = parseFloat(el.min); maxV = parseFloat(el.max); }
          else if (el.getAttribute) {
            const aMin = el.getAttribute('min'); const aMax = el.getAttribute('max');
            if (aMin !== null && aMax !== null) { minV = parseFloat(aMin); maxV = parseFloat(aMax); }
          }
        }

        let desiredGrid;
        if (minV !== null && maxV !== null && !isNaN(minV) && !isNaN(maxV) && maxV > minV) {
          const frac = (num - minV) / (maxV - minV);
          desiredGrid = Math.round(MIN_ASCII_GRID + frac * (MAX_ASCII_GRID - MIN_ASCII_GRID));
        } else {
          // Heuristic: if slider values are small (<=10), treat value as direct pixel size; else map 1..100 -> MIN..MAX
          if (num <= 10) desiredGrid = Math.round(Math.max(MIN_ASCII_GRID, Math.min(MAX_ASCII_GRID, num)));
          else {
            const frac = Math.max(0, Math.min(1, (num - 1) / 99));
            desiredGrid = Math.round(MIN_ASCII_GRID + frac * (MAX_ASCII_GRID - MIN_ASCII_GRID));
          }
        }

        cmykSettings.weight = num;
        desiredGrid = Math.max(MIN_ASCII_GRID, Math.min(MAX_ASCII_GRID, desiredGrid));

        if (asciiGrid !== desiredGrid) {
          asciiGrid = desiredGrid;
          baseFont = Math.max(6, Math.floor(asciiGrid * 0.95));
          if (smallBuffer) {
            try { if (typeof smallBuffer.remove === 'function') smallBuffer.remove(); } catch (e) {}
            smallBuffer = null;
          }
          needsUpdate = true;
          p.redraw();
          try { console.debug && console.debug('cfgWeight ->', num, 'mapped asciiGrid ->', asciiGrid); } catch(e){}
        }
      } catch (err) {
        // Fallback simple behavior
        cmykSettings.weight = num;
        const v = Math.max(MIN_ASCII_GRID, Math.min(MAX_ASCII_GRID, Math.round(num)));
        if (asciiGrid !== v) {
          asciiGrid = v; baseFont = Math.max(6, Math.floor(asciiGrid * 0.95));
          if (smallBuffer) { try { if (typeof smallBuffer.remove === 'function') smallBuffer.remove(); } catch (e) {} smallBuffer = null; }
          needsUpdate = true; p.redraw();
        }
      }
    }

    if (sWeight) {
      // p5 Element: pass underlying element so handler can read min/max
      sWeight.input(() => handleWeightChange(sWeight.value(), sWeight.elt));
      sWeight.changed(() => handleWeightChange(sWeight.value(), sWeight.elt));
    }
    
    // Also attempt to attach to any likely native inputs if p5 selector didn't match
    const nativeCandidates = [
      document.getElementById('cfgWeight'),
      document.getElementById('patternScale'),
      document.querySelector('input[name="weight"]'),
      document.querySelector('input[name="pattern"]'),
      document.querySelector('input[type="range"].pattern')
    ];
    for (const el of nativeCandidates) {
      if (!el) continue;
      el.addEventListener('input', (e) => handleWeightChange(e.target.value, e));
      el.addEventListener('change', (e) => handleWeightChange(e.target.value, e));
    }

    const sThreshold = p.select('#cfgThreshold');
    if(sThreshold) sThreshold.input(() => {
      cmykSettings.threshold = parseFloat(sThreshold.value());
      needsUpdate = true;
      p.redraw();
    });
    
    const sSrcOpacity = p.select('#cfgSrcOpacity');
    if(sSrcOpacity) sSrcOpacity.input(() => {
      imgOpacity = parseFloat(sSrcOpacity.value());
      needsUpdate = true;
      p.redraw();
    });

    const sScale = p.select('#sldScale');
    if(sScale) sScale.input(() => { imgScale = parseFloat(sScale.value()); needsUpdate = true; p.redraw(); });

    const sShowSource = p.select('#chkShowSrc');
    if(sShowSource) sShowSource.changed(() => { showImage = sShowSource.checked(); needsUpdate = true; p.redraw(); });

    const sChars = p.select('#inpChars');
    if(sChars) sChars.input(() => { rampReplica = sChars.value() || rampDense; needsUpdate = true; p.redraw(); });

    const sInvert = p.select('#chkInvert');
    if(sInvert) sInvert.changed(() => { invertRamp = sInvert.checked(); needsUpdate = true; p.redraw(); });

    const sAnimate = p.select('#chkAnimate');
    if(sAnimate) sAnimate.changed(() => { 
      isJittering = sAnimate.checked(); 
      needsUpdate = true; 
      p.redraw();
    });

    const sPreset = p.select('#selAsciiPreset');
    if(sPreset) {
      sPreset.html(''); 
      Object.keys(rampPresets).forEach(key => {
        sPreset.option(key);
      });
      sPreset.changed(() => {
        const key = sPreset.value();
        const presetStr = rampPresets[key];
        if (!presetStr) return;
        if (key === 'Blocks') {
          rampBlocks = presetStr;
          if (!rampReplica || rampReplica.trim().length === 0) rampReplica = rampDense;
          const inpCharsEl = p.select('#inpChars');
          if (inpCharsEl) try { inpCharsEl.value(rampReplica); } catch(e) {}
        } else {
          rampReplica = presetStr;
          const inpCharsEl = p.select('#inpChars');
          if (inpCharsEl) try { inpCharsEl.value(rampReplica); } catch(e) {}
        }
        needsUpdate = true;
        p.redraw();
      });
    }

    const gridSelectors = ['#sldGrid','#cfgGrid','#sldAsciiGrid','#inpGrid','#gridSize'];
    for (const sel of gridSelectors) {
      const el = p.select(sel);
      if (el) {
        el.input(() => {
          const v = parseInt(el.value(), 10);
          if (!isNaN(v) && v > 0) {
            // clamp to configured min/max to prevent too-small cells
            asciiGrid = Math.max(MIN_ASCII_GRID, Math.min(MAX_ASCII_GRID, v));
            baseFont = Math.max(6, Math.floor(asciiGrid * 0.95));
            if (smallBuffer) {
              try { if (typeof smallBuffer.remove === 'function') smallBuffer.remove(); } catch (e) {}
              smallBuffer = null;
            }
            needsUpdate = true;
            p.redraw();
          }
        });
        break;
      }
    }

    const btnSave = p.select('#cmykSaveBtn');
    if(btnSave) {
      try { btnSave.html && btnSave.html('Capture & Add to Library'); } catch(e) {}
      btnSave.mousePressed(() => {
        if (videoStream && videoEl) {
          let res = p.get();
          let name = "Memory_" + p.millis();
          if(window.addToLibrary) window.addToLibrary(res, name);
          showStatus("CAPTURED TO LIBRARY");
          setTimeout(() => showStatus(""), 2000);
          return;
        }

        if (!blobImg) {
          if(window.customAlert) window.customAlert("No image to save!");
          else alert("No image to save!");
          return;
        }

        let res = p.get();
        let name = "Memory_" + p.millis();
        if(window.addToLibrary) window.addToLibrary(res, name);

        blobImg = null; 
        currentFile = null;
        showImage = false;
        isAnimated = false;

        const fileIn = p.select('#fileIn');
        if(fileIn) fileIn.elt.value = ''; 
        const previewBox = p.select('#preview-area');
        if(previewBox) previewBox.html('<span class="muted">EMPTY</span>');
        p.background(255); 

        showStatus("SAVED TO LIBRARY");
        setTimeout(() => showStatus(""), 3000);
      });
    }
    
    const btnSavePng = document.getElementById('btnSavePNG');
    if(btnSavePng) {
      btnSavePng.addEventListener('click', () => {
        if (!blobImg) {
          if(window.customAlert) window.customAlert("No image to save!");
          else alert("No image to save!");
          return;
        }
        p.saveCanvas('Memory_ImageProcessor', 'png');
      });
    }
  }

  function getImageProcSheetSize() {
    try {
      const holder = document.getElementById('input-canvas-holder');
      if (!holder) return null;
      const rect = holder.getBoundingClientRect();
      let w = Math.max(320, Math.floor(rect.width) || p.width || 800);
      let h = Math.max(240, Math.floor(rect.height) || p.height || 800);
      const MAX = 1200;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.floor(w * ratio);
        h = Math.floor(h * ratio);
      }
      return { w, h };
    } catch (e) {
      return null;
    }
  }

  let statusDiv;
  function showStatus(msg) {
    if (!statusDiv) {
      statusDiv = p.createDiv('');
      statusDiv.parent(document.body); 
      statusDiv.style('position', 'fixed');
      statusDiv.style('bottom', '20px');
      statusDiv.style('right', '20px');
      statusDiv.style('left', 'auto'); 
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

// Initialize P5 Instance for CMYK tab
new p5(cmykSketch);
