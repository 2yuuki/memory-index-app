// sketch.js - FULL FEATURED + LAYOUT MODE + HOTKEYS FIXED

// --- GLOBALS FOR APP INTEGRATION ---
var activeTab = 'tab-thoughts';

// --- CONFIG ---
let cols, rows;
let cellW = 9;  
let cellH = 14; 
let canvasW = 1600;
let canvasH = 2400; 
let inkColorHex = "#000000"; 

// --- DATA & BUFFERS ---
let grid = [];      
let colorGrid = []; 
let textColorGrid = []; // Store text color per cell
let pgColorLayer;   
let pgTextLayer;    
let pgGridLayer; 
let templateImg;    
let libraryItems = []; // Store library data
let draggedLibItem = null; // Track dragged library item

// --- INDEXEDDB HELPERS ---
const DB_NAME = 'MemoryIndexDB';
const DB_VERSION = 1;
const STORE_NAME = 'library';

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject("IndexedDB error: " + event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function addItemToDB(item) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getAllItemsFromDB() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteItemFromDB(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function clearDB() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

// --- STATE ---
let mainMode = "ASCII"; 
let toolMode = "DRAW";    
let selectedChar = "SMART"; 
let isEraser = false;
let selectedColor = "#FFFF00"; 
let isColorEraser = false;
let isShiftSelecting = false; 
let showTemplateImg = true;
let isDraggingPanel = false;

// --- MOUSE OPTIMIZATION ---
let prevGridX = -1, prevGridY = -1;

// --- SLIDERS ---
let bgScale = 1.0, bgX = 0, bgY = 0, bgRotate = 0; 
let sliderScale, sliderX, sliderY, sliderRotate, sliderOpacity;   
let userFontSize = 12;

// --- HISTORY & CLIPBOARD (SKETCH) ---
let history = [];
const MAX_HISTORY = 20; 
let selStart = null, selEnd = null;
let selectionMask = null;
let sketchRedoHistory = [];
let clipboard = null;

// --- LAYOUT HISTORY & CLIPBOARD (TAB 3) ---
let layoutHistory = [];
const MAX_LAYOUT_HISTORY = 20;
let layoutRedoHistory = [];
let layoutClipboard = null;

let selectedLayoutElement = null;
let layoutScale = 1.0;
let sketchScale = 1.0;
let isSnapToGrid = false;
let snapSize = 20;
let activeArtboard = null; // Track selected artboard for pattern changing
let layoutSidebarRef = null; // Global reference for layout sidebar
let layoutTool = 'SELECT'; // 'SELECT', 'TEXT_BOX'
let isDrawingTextBox = false;
let drawStart = {x:0, y:0};
let tempDrawBox = null;
const MAX_PATTERNS = 4;
let isLayoutExporting = false;
const patternDataUrlCache = new Map();

// --- UI REFS ---
let sidebarDiv;
let mainCanvas; 

// --- PALETTE DATA ---
let palette = [
  "SMART", "|", "-", "/", "\\", "_",
  "┌", "┐", "└", "┘", "─", "│", "┼", "┴", "┬", "┤", "├",
  "╔", "╗", "╚", "╝", "═", "║", "╬", "╩", "╦", "╣", "╠",
  "█", "▓", "▒", "░", "▀", "▄", "▌", "▐", "■", "□", 
  "●", "○", "◆", "◇", "▲", "▼", "◄", "►", 
  "(", ")", "[", "]", "{", "}", "<", ">",
    "o", "*", "+", "x", ".", ",", ":", ";", "'", "`", "^", "~", "=",
    "▚", "▞", "▦", "▩", "▤", "▥", "▧", "▨", "▩", "▪", "▫", "▬", "▭", "▮", "▯",
    "@", "#", "$", "%", "&", "8", "W", "M", "Q", "Z", "X", "O", "0", 
    "?", "!", "I", "1", "i", "l", "÷", "×", "±", "∞", "≈", "≡", "♪", "♫"
];
let paletteCMYK = [
  "#00FFFF", "#FF00FF", "#FFFF00", "#000000", "#FFFFFF"
];
let paletteStabilo = [
  "#FFFF00", "#FFCC00", "#FF9900", "#FF3333",
  "#FF0099", "#CC00CC", "#9900FF", "#0033FF",
  "#0099FF", "#00CCFF", "#00CC99", "#009900",
  "#33CC33", "#99CC00", "#CCFF00", "#555555"
];

// --- CORE: TAB SWITCHING ---
window.switchTab = function(tabId) {
  // Reset Image Processor state when leaving Tab 2
  if (activeTab === 'tab-image-proc' && tabId !== 'tab-image-proc') {
      if (window.resetImageProcessor) window.resetImageProcessor();
      resetImageProcessorState();
  }

  activeTab = tabId;
  document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.workspace').forEach(w => w.classList.remove('active'));
  
  let btn = document.querySelector(`[data-tab="${tabId}"]`);
  if(btn) btn.classList.add('active');
  let ws = document.getElementById(tabId);
  if(ws) ws.classList.add('active');

  let cnv = document.getElementById('myCanvas');
  if(!cnv) return;
  
  if (tabId === 'tab-sketch') {
    cnv.style.display = 'block';
    loop(); // Enable Sketch Loop
    if(window.pauseImageProcessor) window.pauseImageProcessor(); // Disable Image Processor
  } else if (tabId === 'tab-image-proc') {
    cnv.style.display = 'none';
    noLoop(); // Disable Sketch Loop
    if(window.resumeImageProcessor) window.resumeImageProcessor(); // Enable Image Processor
  } else {
    // Thoughts or Layout Tab
    cnv.style.display = 'none';
    noLoop(); // Disable Sketch Loop
    if(window.pauseImageProcessor) window.pauseImageProcessor(); // Disable Image Processor
  }
}

function resetImageProcessorState() {
    // Clear canvas and reset state for Tab 2
    const holder = select('#tab-image-proc #input-canvas-holder');
    if(holder) {
        // Remove canvas and fallback images, keep placeholder
        const children = holder.elt.children;
        for(let i = children.length - 1; i >= 0; i--) {
            // FIX: Do not remove the P5 Canvas!
            if(!children[i].classList.contains('placeholder-text') && children[i].tagName !== 'CANVAS') {
                children[i].remove();
            }
        }
        const ph = holder.elt.querySelector('.placeholder-text');
        if(ph) ph.style.display = 'block';
    }
    const fi = select('#fileIn');
    if(fi) fi.value('');
    const sheet = select('#tab-image-proc .paper-sheet');
    if(sheet) sheet.style('aspect-ratio', '297/210'); // Reset to default Landscape
}

// --- SETUP ---
function setup() {
  frameRate(30); // Optimized for performance
  pixelDensity(1); 
  templateImg = createImage(100, 100);
  
  mainCanvas = createCanvas(canvasW, canvasH);
  mainCanvas.id('myCanvas');
  mainCanvas.parent('sketch-canvas-holder'); 
  mainCanvas.style('touch-action', 'none');

  // Prevent any CSS animation/transition on the main canvas
  try {
    const mc = mainCanvas.elt;
    if (mc && mc.style) {
      mc.style.transition = 'none'; mc.style.animation = 'none'; mc.style.opacity = '1'; mc.style.willChange = 'auto';
    }
  } catch(e){}
  
  // Drag & Drop (Sketch Tab)
  mainCanvas.drop(handleFile);
  mainCanvas.elt.ondragover = (e) => e.preventDefault();
  mainCanvas.elt.ondrop = (e) => {
    e.preventDefault();
    let data = e.dataTransfer.getData("text/plain");
    if (data && data.startsWith("data:image")) {
      loadImage(data, handleImageLoad);
    }
  };

  // Update selector to find the content area of the floating panel
  sidebarDiv = select('#sketch-main-tools .panel-content');
  if (!sidebarDiv) {
      // Fallback logic if structure is different
      let btn = select('#btnPencil');
      if (btn) {
          let p = btn.parent();
          if (p.classList.contains('tools-grid')) sidebarDiv = new p5.Element(p.parentNode); // .panel-content
          else if (p.classList.contains('panel-content')) sidebarDiv = new p5.Element(p);
          else sidebarDiv = new p5.Element(p);
      }
  } 
  
  cols = floor(width / cellW);
  rows = floor(height / cellH);
  
  // 1. Buffers
  pgColorLayer = createGraphics(width, height);
  pgColorLayer.pixelDensity(1);
  pgColorLayer.noStroke();

  // Disable transitions on the internal canvas element
  try {
    const c1 = pgColorLayer.canvas || pgColorLayer.elt;
    if (c1 && c1.style) { c1.style.transition = 'none'; c1.style.animation = 'none'; c1.style.opacity = '1'; c1.style.willChange = 'auto'; }
  } catch(e){}

  pgTextLayer = createGraphics(width, height);
  pgTextLayer.pixelDensity(1);
  pgTextLayer.noSmooth(); // Ensure crisp pixel rendering
  pgTextLayer.textFont("Consolas, monospace"); 
  pgTextLayer.textAlign(CENTER, CENTER);
  pgTextLayer.noStroke();

  try {
    const c2 = pgTextLayer.canvas || pgTextLayer.elt;
    if (c2 && c2.style) { c2.style.transition = 'none'; c2.style.animation = 'none'; c2.style.opacity = '1'; c2.style.willChange = 'auto'; }
  } catch(e){}
  
  // 2. Pre-render Grid
  pgGridLayer = createGraphics(width, height);
  pgGridLayer.pixelDensity(1);

  try {
    const c3 = pgGridLayer.canvas || pgGridLayer.elt;
    if (c3 && c3.style) { c3.style.transition = 'none'; c3.style.animation = 'none'; c3.style.opacity = '1'; c3.style.willChange = 'auto'; }
  } catch(e){}
  preRenderGrid(pgGridLayer); 
  
  resetAllGrids();
  loadFromLocalStorage();
  loadLibrary(); // Load saved library items
  saveState(); 

  // Init UI
  if (sidebarDiv) createAlignControls();
  createUI();
  setupSketchZoomUI();
  updateLayerTextVisuals(); 
  
  // SETUP LAYOUT TAB
  setupLayoutTab(); 
  setupMusicPlayer();
  setupImageProcessorDrop();
  setupThoughtsDateHeader();

  let tInput = select('#inpThought');
  if(tInput) tInput.attribute('placeholder', 'what are you thinking right now?');

  // --- ADD THOUGHTS BUTTON LOGIC ---
  let btnCreateCard = select('#btnCreateCard');
  if (btnCreateCard) {
      btnCreateCard.mousePressed(() => {
          let inp = select('#inpThought');
          let txt = inp.value();
          if (!txt.trim()) return;

          // Create graphic for the card
          let pg = createGraphics(400, 300);
          pg.pixelDensity(1);
          pg.background(255);
          
          // Draw Paper Pattern
          pg.stroke(220); pg.strokeWeight(1);
          for(let y=40; y<300; y+=30) pg.line(0, y, 400, y);
          pg.stroke(255, 0, 0, 50); pg.line(40, 0, 40, 300); // Margin

          // Draw Text
          pg.noStroke(); pg.fill('#fa0afa');
          pg.textFont("'KK7VCROSDMono', monospace"); pg.textSize(16);
          pg.textAlign(LEFT, TOP);
          pg.text(txt.toUpperCase(), 50, 50, 340, 240);

          // Draw Date/Time
          let now = new Date();
          let dateStr = now.toLocaleDateString() + " " + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          pg.textSize(10); pg.textAlign(RIGHT, BOTTOM);
          pg.text(dateStr, 380, 290);

          // Add to Library
          if (window.addToLibrary) window.addToLibrary(pg, "Thought Card", { text: txt.toUpperCase(), date: dateStr });
          pg.remove();
          
          inp.value(''); // Clear input
      });
  }

  // Make Floating Panels Draggable
  makePanelDraggable('sketch-main-tools');
  makePanelDraggable('sketch-patterns-panel');
  makePanelDraggable('sketch-ink-panel');
  makePanelDraggable('layout-tools-panel');
  makePanelDraggable('music-player-widget');

  // --- AUTO-SAVE ON UNLOAD (TAB 3 & 4) ---
  const performAutoSave = () => {
      saveToLocalStorage(true); // Save Sketch state silently
      saveLayoutToLocalStorage(true); // Save Layout state immediately
  };
  window.addEventListener('pagehide', performAutoSave);
  window.addEventListener('beforeunload', performAutoSave);
  document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') performAutoSave();
  });

  window.switchTab('tab-thoughts');
  
  // Ensure sidebar is hidden initially (Intro Mode)
  let sb = select('.app-sidebar');
  if (sb) sb.addClass('hidden');

  // --- GLOBAL KEYBOARD LISTENER FOR LAYOUT (TAB 3) ---
  document.addEventListener('keydown', (e) => {
      // Chỉ hoạt động khi đang ở Tab 3 (Index/Layout)
      if (activeTab !== 'tab-index') return;

      // Ignore shortcuts if typing in text fields
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

      // Delete / Backspace: Xóa phần tử đang chọn
      if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedLayoutElement) {
              saveLayoutState();
              selectedLayoutElement.remove();
              selectedLayoutElement = null;
              e.preventDefault(); // Ngăn trình duyệt back lại
          }
      }

      // Ctrl / Command Shortcuts
      if (e.ctrlKey || e.metaKey) {
          // Ctrl + Z (Undo) / Ctrl + Shift + Z (Redo)
          if (e.key === 'z' || e.key === 'Z') {
              e.preventDefault();
              if (e.shiftKey) redoLayout();
              else undoLayout();
          }
          // Ctrl + C (Copy)
          if (e.key === 'c' || e.key === 'C') { 
              e.preventDefault(); 
              copyLayoutSelection(); 
          }
          // Ctrl + V (Paste)
          if (e.key === 'v' || e.key === 'V') { 
              e.preventDefault(); 
              pasteLayoutSelection(); 
          }
          // Ctrl + Enter: Add Artboard
          if (e.key === 'Enter') {
              e.preventDefault();
              let target = activeArtboard;
              if (!target) {
                  let bgs = document.querySelectorAll('.layout-page-bg');
                  if (bgs.length > 0) target = bgs[bgs.length-1];
              }
              if (target) addArtboardRelative(target);
          }
      }
  });

  // --- TOOLTIP SYSTEM ---
  const tooltip = document.getElementById('floating-tooltip');

  document.body.addEventListener('mouseover', (e) => {
      let target = e.target.closest('[data-tooltip]');
      if (target && tooltip) {
          tooltip.innerText = target.getAttribute('data-tooltip');
          tooltip.style.display = 'block';
      }
  });
  document.body.addEventListener('mouseout', (e) => {
      let target = e.target.closest('[data-tooltip]');
      if (target && tooltip) {
          tooltip.style.display = 'none';
      }
  });
  document.body.addEventListener('mousemove', (e) => {
      if (tooltip && tooltip.style.display === 'block') {
          let x = e.clientX + 15;
          let y = e.clientY + 15;
          // Boundary check to keep tooltip on screen
          if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - 5;
          if (y + tooltip.offsetHeight > window.innerHeight) y = e.clientY - tooltip.offsetHeight - 5;
          
          tooltip.style.left = x + 'px';
          tooltip.style.top = y + 'px';
      }
  });
}

// --- DRAW LOOP ---
function draw() {
  if (activeTab !== 'tab-sketch') return;

  let m = getCorrectedMouse();
  
  // Reset custom cursors
  mainCanvas.removeClass('cursor-pencil');
  mainCanvas.removeClass('cursor-eraser');

  if (m.x > 0 && m.x < width && m.y > 0 && m.y < height) {
    if (mainMode === "COLOR") {
      cursor(HAND);
    } else if (toolMode === "DRAW") {
      if (isEraser) mainCanvas.addClass('cursor-eraser');
      else mainCanvas.addClass('cursor-pencil');
    } else {
      cursor(CROSS);
    }
  } else {
    cursor(ARROW);
  }

  clear(); // Clear canvas to prevent ghosting when layers update
  image(pgGridLayer, 0, 0);

  blendMode(MULTIPLY); 
  image(pgColorLayer, 0, 0);
  blendMode(BLEND); 

  if (showTemplateImg && templateImg && templateImg.width > 1) {
      push();
      if (sliderScale) {
          bgScale = sliderScale.value(); bgX = sliderX.value(); bgY = sliderY.value(); bgRotate = sliderRotate.value(); 
          translate(bgX, bgY); rotate(radians(bgRotate)); scale(bgScale);
      }
      if (sliderOpacity) tint(255, sliderOpacity.value());
      imageMode(CENTER); blendMode(MULTIPLY); 
      let drawW = width; let drawH = drawW * (templateImg.height / templateImg.width);
      image(templateImg, 0, 0, drawW, drawH); 
      pop(); blendMode(BLEND); 
  }

  image(pgTextLayer, 0, 0); 

  drawUIOverlays();
}

// --- RENDER HELPERS ---
function preRenderGrid(pg) {
  pg.clear();

  // A light, solid gray color with a thin but visible line weight
  pg.stroke(220);
  pg.strokeWeight(0.5);
  pg.noFill();

  for (let i = 0; i <= cols; i++) {
    let x = i * cellW;
    pg.line(x, 0, x, height);
  }
  for (let j = 0; j <= rows; j++) {
    let y = j * cellH;
    pg.line(0, y, width, y);
  }
}

function drawSingleCellText(x, y) {
  let cx = x * cellW; let cy = y * cellH;
  pgTextLayer.erase(); pgTextLayer.rect(cx, cy, cellW, cellH); pgTextLayer.noErase();
  
  let char = grid[y][x];
  if (char !== "") {
      pgTextLayer.textSize(userFontSize);
      let displayColor = color(textColorGrid[y][x] || "#000000");
      let posX = cx + cellW/2; let posY = cy + cellH/2;

      pgTextLayer.noStroke();
      pgTextLayer.fill(displayColor);
      pgTextLayer.text(char, posX, posY);
  }
}

function updateLayerTextVisuals() {
  pgTextLayer.clear();
  pgTextLayer.textSize(userFontSize);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let char = grid[y][x];
      if (char !== "") {
          let cx = x * cellW; let cy = y * cellH;
          let displayColor = color(textColorGrid[y][x] || "#000000");
          let posX = cx + cellW/2; let posY = cy + cellH/2;
          pgTextLayer.noStroke();
          pgTextLayer.fill(displayColor);
          pgTextLayer.text(char, posX, posY);
      }
    }
  }
}

function updateLayerColorVisuals() {
  pgColorLayer.clear(); pgColorLayer.noStroke();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let c = colorGrid[y][x];
      if(c) { pgColorLayer.fill(c); pgColorLayer.rect(x * cellW, y * cellH, cellW, cellH); }
    }
  }
}

function setGridColor(x, y, col) {
  if (!colorGrid[y]) colorGrid[y] = [];
  colorGrid[y][x] = col;
  pgColorLayer.erase(); pgColorLayer.rect(x * cellW, y * cellH, cellW, cellH); pgColorLayer.noErase();
  if (col !== null) { pgColorLayer.fill(col); pgColorLayer.rect(x * cellW, y * cellH, cellW, cellH); }
  drawSingleCellText(x, y); 
}

// --- INPUT HANDLING ---
function mousePressed() {
  if (activeTab !== 'tab-sketch') return;
  if (isDraggingPanel) return;
  prevGridX = -1; prevGridY = -1;
  let m = getCorrectedMouse();
  if (m.x < 0 || m.x > width || m.y < 0 || m.y > height) return;
  
  let mx = floor(constrain(m.x, 0, width-1) / cellW);
  let my = floor(constrain(m.y, 0, height-1) / cellH);

  if (toolMode === "MAGIC_WAND") {
      magicWandSelect(mx, my);
      return;
  }

  if (keyIsDown(SHIFT)) { toolMode = "SELECT"; selStart = {x: mx, y: my}; selEnd = {x: mx, y: my}; selectionMask = null; isShiftSelecting = true; return; }
  if (toolMode === "PASTE" && clipboard) { pasteClipboard(mx, my); saveState(); return; }
  if (toolMode === "SELECT" && !isShiftSelecting) { selStart = {x: mx, y: my}; selEnd = {x: mx, y: my}; selectionMask = null; }

  handleInput(mx, my);
}

function mouseDragged() {
  if (activeTab !== 'tab-sketch') return;
  if (isDraggingPanel) return;
  let m = getCorrectedMouse();
  let mx = floor(constrain(m.x, 0, width-1) / cellW);
  let my = floor(constrain(m.y, 0, height-1) / cellH);

  if (isShiftSelecting || (toolMode === "SELECT" && keyIsDown(SHIFT))) { selEnd = {x: mx, y: my}; return; }
  if (toolMode === "FILL") return; 

  if (mx !== prevGridX || my !== prevGridY) {
      handleInput(mx, my);
      prevGridX = mx; prevGridY = my;
  }
}

function mouseReleased() {
  if (activeTab !== 'tab-sketch') return;
  if (isShiftSelecting) isShiftSelecting = false;
  else if (toolMode === "DRAW") saveState(); 
}

function handleInput(x, y) {
  if (!isValidCell(x, y)) return;
  let m = getCorrectedMouse();

  if (mainMode === "ASCII") {
    if (toolMode === "FILL") {
        // Nếu có vùng chọn Magic Wand
        if (selectionMask && selectionMask.size > 0) {
             const k = `${x},${y}`;
             if (selectionMask.has(k)) {
                 let fillChar = (selectedChar === "SMART") ? "." : selectedChar;
                 if (isEraser) fillChar = "";
                 selectionMask.forEach(key => {
                     let [cx, cy] = key.split(',').map(Number);
                     grid[cy][cx] = fillChar;
                     if(fillChar !== "") textColorGrid[cy][cx] = inkColorHex;
                 });
                 updateLayerTextVisuals(); saveState(); return;
             }
        }
        // Nếu có vùng chọn và click chuột nằm trong vùng chọn -> Đổ màu cả vùng
        if (selStart && selEnd) {
            let x1 = min(selStart.x, selEnd.x), y1 = min(selStart.y, selEnd.y);
            let x2 = max(selStart.x, selEnd.x), y2 = max(selStart.y, selEnd.y);
            if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                let fillChar = (selectedChar === "SMART") ? "." : selectedChar;
                if (isEraser) fillChar = "";
                for(let r = y1; r <= y2; r++) {
                    for(let c = x1; c <= x2; c++) {
                        grid[r][c] = fillChar;
                        if(fillChar !== "") textColorGrid[r][c] = inkColorHex;
                    }
                }
                updateLayerTextVisuals(); saveState(); return;
            }
        }
        let fillChar = (selectedChar === "SMART") ? "." : selectedChar;
        if (isEraser) fillChar = "";
        floodFillAscii(x, y, fillChar); return;
    }
    if (toolMode === "DRAW") {
      let charToDraw = isEraser ? "" : selectedChar;
      if (!isEraser && selectedChar === "SMART") {
           charToDraw = "."; 
           if (mouseIsPressed && (m.x !== m.px || m.y !== m.py)) {
              let c = calculateDirectionChar(m.x, m.y, m.px, m.py);
              if (c) charToDraw = c;
           }
      }
      grid[y][x] = charToDraw;
      if (!isEraser) textColorGrid[y][x] = inkColorHex;
      drawSingleCellText(x, y);
    }
  } else if (mainMode === "COLOR") {
    if (toolMode === "FILL") {
        // Nếu có vùng chọn Magic Wand
        if (selectionMask && selectionMask.size > 0) {
             const k = `${x},${y}`;
             if (selectionMask.has(k)) {
                 let fillColor = isColorEraser ? null : selectedColor;
                 selectionMask.forEach(key => {
                     let [cx, cy] = key.split(',').map(Number);
                     colorGrid[cy][cx] = fillColor;
                 });
                 updateLayerColorVisuals(); saveState(); return;
             }
        }
        // Nếu có vùng chọn và click chuột nằm trong vùng chọn -> Đổ màu cả vùng
        if (selStart && selEnd) {
            let x1 = min(selStart.x, selEnd.x), y1 = min(selStart.y, selEnd.y);
            let x2 = max(selStart.x, selEnd.x), y2 = max(selStart.y, selEnd.y);
            if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                let fillColor = isColorEraser ? null : selectedColor;
                for(let r = y1; r <= y2; r++) {
                    for(let c = x1; c <= x2; c++) {
                        colorGrid[r][c] = fillColor;
                    }
                }
                updateLayerColorVisuals(); saveState(); return;
            }
        }
        let fillColor = isColorEraser ? null : selectedColor;
        floodFillColor(x, y, fillColor); return;
    }
    if (toolMode === "DRAW") {
      let targetColor = isColorEraser ? null : selectedColor;
      if (colorGrid[y][x] !== targetColor) setGridColor(x, y, targetColor);
    }
  }
}

// --- FLOOD FILL ---
function floodFillAscii(x, y, newChar) {
  let target = grid[y][x];
  
  // Case 1: Changing Character (Standard)
  if (target !== newChar) {
      let stack = [[x, y]];
      while(stack.length > 0) {
        let [cx, cy] = stack.pop();
        if (grid[cy][cx] !== target) continue;
        let lx = cx; while (lx > 0 && grid[cy][lx - 1] === target) lx--;
        let rx = cx; while (rx < cols - 1 && grid[cy][rx + 1] === target) rx++;
        for (let i = lx; i <= rx; i++) { grid[cy][i] = newChar; if(newChar !== "") textColorGrid[cy][i] = inkColorHex; }
        if (cy > 0) scanLine(lx, rx, cy - 1, target, stack);
        if (cy < rows - 1) scanLine(lx, rx, cy + 1, target, stack);
      }
      updateLayerTextVisuals(); saveState();
  }
  // Case 2: Same Character, Different Color (Recolor)
  else if (newChar !== "" && target === newChar) {
      let stack = [[x, y]];
      let visited = new Set();
      const key = (c, r) => `${c},${r}`;
      
      while(stack.length > 0) {
          let [cx, cy] = stack.pop();
          if (visited.has(key(cx, cy))) continue;
          
          let lx = cx; while (lx > 0 && grid[cy][lx - 1] === target && !visited.has(key(lx - 1, cy))) lx--;
          let rx = cx; while (rx < cols - 1 && grid[cy][rx + 1] === target && !visited.has(key(rx + 1, cy))) rx++;
          
          for (let i = lx; i <= rx; i++) { visited.add(key(i, cy)); textColorGrid[cy][i] = inkColorHex; }
          
          const scan = (row) => {
              let spanAdded = false;
              for (let i = lx; i <= rx; i++) {
                  if (grid[row][i] === target && !visited.has(key(i, row))) { if (!spanAdded) { stack.push([i, row]); spanAdded = true; } } else spanAdded = false;
              }
          };
          if (cy > 0) scan(cy - 1);
          if (cy < rows - 1) scan(cy + 1);
      }
      updateLayerTextVisuals(); saveState();
  }
}
function scanLine(lx, rx, y, target, stack) {
  let spanAdded = false;
  for (let i = lx; i <= rx; i++) {
    if (grid[y][i] === target) { if (!spanAdded) { stack.push([i, y]); spanAdded = true; } } else spanAdded = false;
  }
}
function floodFillColor(x, y, newColor) {
  let target = colorGrid[y][x]; if (target === newColor) return;
  let stack = [[x, y]];
  while(stack.length > 0) {
    let [cx, cy] = stack.pop();
    if (colorGrid[cy][cx] !== target) continue;
    let lx = cx; while (lx > 0 && colorGrid[cy][lx-1] === target) lx--;
    let rx = cx; while (rx < cols - 1 && colorGrid[cy][rx+1] === target) rx++;
    for (let i = lx; i <= rx; i++) { colorGrid[cy][i] = newColor; }
    if (cy > 0) scanLineColor(lx, rx, cy - 1, target, stack);
    if (cy < rows - 1) scanLineColor(lx, rx, cy + 1, target, stack);
  }
  updateLayerColorVisuals(); saveState();
}

function magicWandSelect(x, y) {
  if (!isValidCell(x, y)) return;
  
  selectionMask = new Set();
  let targetChar = grid[y][x];
  let targetColor = colorGrid[y][x];
  
  let minX = x, maxX = x, minY = y, maxY = y;
  let stack = [[x, y]];
  const key = (c, r) => `${c},${r}`;

  while(stack.length > 0) {
    let [cx, cy] = stack.pop();
    let k = key(cx, cy);
    
    if (selectionMask.has(k)) continue;
    
    let match = false;
    if (mainMode === "ASCII") {
        if (grid[cy][cx] === targetChar) match = true;
    } else {
        if (colorGrid[cy][cx] === targetColor) match = true;
    }
    
    if (match) {
        selectionMask.add(k);
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        if (cx > 0) stack.push([cx - 1, cy]);
        if (cx < cols - 1) stack.push([cx + 1, cy]);
        if (cy > 0) stack.push([cx, cy - 1]);
        if (cy < rows - 1) stack.push([cx, cy + 1]);
    }
  }
  selStart = {x: minX, y: minY};
  selEnd = {x: maxX, y: maxY};
  // We stay in MAGIC_WAND mode, but the selection overlay will appear
}

function scanLineColor(lx, rx, y, target, stack) {
  let spanAdded = false;
  for (let i = lx; i <= rx; i++) {
    if (colorGrid[y][i] === target) { if (!spanAdded) { stack.push([i, y]); spanAdded = true; } } else spanAdded = false;
  }
}

// --- UTILS ---
function isValidCell(x, y) { return x >= 0 && x < cols && y >= 0 && y < rows; }
function resetAllGrids() {
  grid = []; colorGrid = []; textColorGrid = [];
  for (let y = 0; y < rows; y++) {
    let r1 = []; let r2 = []; let r3 = [];
    for(let x=0; x<cols; x++) { r1.push(""); r2.push(null); r3.push("#000000"); }
    grid.push(r1); colorGrid.push(r2); textColorGrid.push(r3);
  }
  if(pgColorLayer) pgColorLayer.clear(); if(pgTextLayer) pgTextLayer.clear();
}
function isColorDark(hex) { if(!hex) return false; return brightness(color(hex)) < 150; }
function calculateDirectionChar(x, y, px, py) {
  let dx = x - px; let dy = y - py;
  if (abs(dx) < 2 && abs(dy) < 2) return null;
  let deg = degrees(atan2(dy, dx)); if (deg < 0) deg += 180;
  if (deg >= 30 && deg < 70) return "\\"; if (deg >= 70 && deg < 110) return "|"; if (deg >= 110 && deg < 150) return "/"; return "-";
}
function getCorrectedMouse() {
  if (!mainCanvas) return { x: mouseX, y: mouseY, px: pmouseX, py: pmouseY };
  const rect = mainCanvas.elt.getBoundingClientRect();
  const scaleX = width / rect.width; const scaleY = height / rect.height;
  return { x: (winMouseX - rect.left) * scaleX, y: (winMouseY - rect.top) * scaleY, px: (pwinMouseX - rect.left) * scaleX, py: (pwinMouseY - rect.top) * scaleY };
}

// --- CLIPBOARD (SKETCH) ---
function saveState() {
  let t = grid.map(r => [...r]); let c = colorGrid.map(r => [...r]); let tc = textColorGrid.map(r => [...r]);
  history.push({ text: t, color: c, textColor: tc }); 
  if (history.length > MAX_HISTORY) history.shift();
  sketchRedoHistory = []; // Clear redo history on new action
  saveToLocalStorage();
}
function undo() {
  if (history.length > 1) {
    let currentState = history.pop();
    sketchRedoHistory.push(currentState);
    let s = history[history.length - 1];
    grid = s.text.map(r => [...r]); colorGrid = s.color.map(r => [...r]); textColorGrid = s.textColor.map(r => [...r]);
    updateLayerColorVisuals(); updateLayerTextVisuals();
  }
}
function redo() {
  if (sketchRedoHistory.length > 0) {
    let s = sketchRedoHistory.pop();
    history.push(s);
    grid = s.text.map(r => [...r]); colorGrid = s.color.map(r => [...r]); textColorGrid = s.textColor.map(r => [...r]);
    updateLayerColorVisuals(); updateLayerTextVisuals();
  }
}
function copySelection() {
  if(!selStart || !selEnd) return;
  let x1 = min(selStart.x, selEnd.x); let y1 = min(selStart.y, selEnd.y);
  let x2 = max(selStart.x, selEnd.x); let y2 = max(selStart.y, selEnd.y);
  let ct = [], cc = [], ctc = [];
  for (let y = y1; y <= y2; y++) {
    let rt = [], rc = [], rtc = [];
    for (let x = x1; x <= x2; x++) { rt.push(grid[y][x]); rc.push(colorGrid[y][x]); rtc.push(textColorGrid[y][x]); }
    ct.push(rt); cc.push(rc); ctc.push(rtc);
  }
  clipboard = { text: ct, color: cc, textColor: ctc };
  let btn = select('#btnCopy'); if(btn) { btn.style('background', '#69f0ae'); setTimeout(()=>btn.style('background','#fff'),300); }
}
function cutSelection() {
  copySelection();
  let x1 = min(selStart.x, selEnd.x); let y1 = min(selStart.y, selEnd.y);
  let x2 = max(selStart.x, selEnd.x); let y2 = max(selStart.y, selEnd.y);
  for (let y = y1; y <= y2; y++) { for (let x = x1; x <= x2; x++) { grid[y][x] = ""; textColorGrid[y][x] = "#000000"; setGridColor(x, y, null); } }
  updateLayerTextVisuals(); saveState(); toolMode="DRAW"; selStart=null; selEnd=null; selectionMask=null;
}
function deleteSelection() {
  let changed = false;
  if (selectionMask && selectionMask.size > 0) {
      selectionMask.forEach(key => {
          let [cx, cy] = key.split(',').map(Number);
          grid[cy][cx] = "";
          textColorGrid[cy][cx] = "#000000";
          setGridColor(cx, cy, null);
      });
      changed = true;
  } else if (selStart && selEnd) {
      let x1 = min(selStart.x, selEnd.x); let y1 = min(selStart.y, selEnd.y);
      let x2 = max(selStart.x, selEnd.x); let y2 = max(selStart.y, selEnd.y);
      for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
              grid[y][x] = "";
              textColorGrid[y][x] = "#000000";
              setGridColor(x, y, null);
          }
      }
      changed = true;
  }
  if (changed) {
      updateLayerTextVisuals();
      saveState();
  }
}
function pasteClipboard(sx, sy) {
  if (!clipboard) return;
  let cr = clipboard.text.length; let cc = clipboard.text[0].length;
  for(let r = 0; r < cr; r++) {
    for(let c = 0; c < cc; c++) {
      let char = clipboard.text[r][c]; let col = clipboard.color[r][c]; let tcol = clipboard.textColor[r][c];
      let tx = sx + c; let ty = sy + r;
      if (isValidCell(tx, ty)) { if (char !== "") { grid[ty][tx] = char; textColorGrid[ty][tx] = tcol; } setGridColor(tx, ty, col); }
    }
  }
  updateLayerTextVisuals(); saveState();
}
function keyPressed() {
  if (activeTab !== 'tab-sketch') return;
  let isCtrl = keyIsDown(CONTROL) || keyIsDown(91) || keyIsDown(224);
  if (isCtrl) {
    if (key === 'z' || key === 'Z') { 
        if (keyIsDown(SHIFT)) redo();
        else undo(); 
        return false; 
    }
    if (key === 'y' || key === 'Y') { redo(); return false; }
    if (key === 'c' || key === 'C') { copySelection(); return false; }
    if (key === 'x' || key === 'X') { cutSelection(); return false; }
    if (key === 'v' || key === 'V') { let m = getCorrectedMouse(); pasteClipboard(floor(m.x/cellW), floor(m.y/cellH)); return false; }
  }
  if (keyCode === ESCAPE) { toolMode = "DRAW"; selStart = null; selEnd = null; selectionMask = null; isShiftSelecting = false; }
  if (keyCode === DELETE || keyCode === BACKSPACE) { deleteSelection(); return false; }
}

function mouseWheel(event) {
  if (activeTab === 'tab-sketch') {
    if (event.ctrlKey || event.metaKey) {
      let delta = event.delta > 0 ? -0.1 : 0.1;
      updateSketchZoom(delta);
      return false;
    }
  }
}

// --- AUTO SAVE ---
let sketchSaveToastTimeout;
let sketchStorageTimeout; // Debounce timer
function saveToLocalStorage(silent = false) {
  clearTimeout(sketchStorageTimeout);
  sketchStorageTimeout = setTimeout(() => {
    try {
      if (typeof grid !== 'undefined' && typeof colorGrid !== 'undefined') {
          localStorage.setItem('mem_idx_grid', JSON.stringify(grid));
          localStorage.setItem('mem_idx_color', JSON.stringify(colorGrid));
          localStorage.setItem('mem_idx_textcolor', JSON.stringify(textColorGrid));
      }
    } catch(e) {}
  }, 1000); // Save only after 1 second of inactivity
}
function loadFromLocalStorage() {
  try {
    let g = localStorage.getItem('mem_idx_grid'); let c = localStorage.getItem('mem_idx_color'); let tc = localStorage.getItem('mem_idx_textcolor');
    if(g && c) {
      let lg = JSON.parse(g); let lc = JSON.parse(c); let ltc = tc ? JSON.parse(tc) : null;
      if(lg.length === rows && lg[0].length === cols) { 
          grid = lg; colorGrid = lc; 
          if(ltc && ltc.length === rows && ltc[0].length === cols) textColorGrid = ltc;
          else { textColorGrid = []; for(let y=0; y<rows; y++) { let r=[]; for(let x=0; x<cols; x++) r.push("#000000"); textColorGrid.push(r); } }
          updateLayerTextVisuals(); updateLayerColorVisuals(); 
      }
    }
  } catch(e) {}
}

function savePanelState(panelId, isVisible) {
  try {
    let states = JSON.parse(localStorage.getItem('mem_idx_panel_states') || '{}');
    states[panelId] = isVisible;
    localStorage.setItem('mem_idx_panel_states', JSON.stringify(states));
  } catch(e) {}
}

function getPanelState(panelId) {
  try {
    let states = JSON.parse(localStorage.getItem('mem_idx_panel_states') || '{}');
    return states[panelId];
  } catch(e) { return undefined; }
}

// --- UI GENERATION ---
function createAlignControls() {
  if (select('#ref-image-group')) return;
  let group = createDiv(''); group.id('ref-image-group').parent(sidebarDiv);
  sidebarDiv.elt.insertBefore(group.elt, sidebarDiv.elt.firstChild); 
  group.style('background', '#eee'); group.style('padding', '10px'); group.style('margin-bottom', '15px');
  createDiv('Input a reference image (optional)').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
  
  let fileInp = createFileInput(handleFile); fileInp.parent(group).style('margin-bottom', '10px').style('width', '100%');
  let rowShow = createDiv('').parent(group).style('display','flex').style('margin-bottom','5px');
  let chkShow = createCheckbox('Show Template', true).parent(rowShow); chkShow.changed(() => { showTemplateImg = chkShow.checked(); });

  function addSlider(label, min, max, val, step, parent) {
      let row = createDiv('').parent(parent).style('display','flex').style('justify-content','space-between');
      createSpan(label).parent(row).style('font-size','14px');
      let s = createSlider(min, max, val, step); s.parent(row); s.style('width','60%'); return s;
  }
  createDiv('<i>Background:</i>').parent(group).style('font-size','14px');
  sliderScale = addSlider('Zoom:', 0.1, 3.0, 1.0, 0.01, group);
  sliderX = addSlider('Pos X:', -500, 2000, canvasW/2, 1, group);
  sliderY = addSlider('Pos Y:', -500, 2000, canvasH/2, 1, group);
  sliderRotate = addSlider('Rotate:', 0, 360, 0, 1, group); 
  sliderOpacity = addSlider('Opacity:', 0, 255, 120, 1, group);
}

function createUI() {
  let btnPencil = select('#btnPencil'); let btnEraser = select('#btnEraser'); let btnFill = select('#btnFill'); let btnClear = select('#btnClearSketch');
  let btnMagicWand = select('#btnMagicWand');
  
  // --- VISUAL UPDATE HELPER FOR TOOLS ---
  const updateToolVisuals = () => {
      [btnPencil, btnEraser, btnFill, btnMagicWand].forEach(b => {
          if(b) {
              b.style('background', '');
              b.style('color', '');
              b.style('border', '');
          }
      });
      let activeBtn = null;
      if (toolMode === "FILL") activeBtn = btnFill;
      else if (toolMode === "MAGIC_WAND") activeBtn = btnMagicWand;
      else if (toolMode === "DRAW") {
          if (isEraser) activeBtn = btnEraser;
          else activeBtn = btnPencil;
      }
      if (activeBtn) {
          activeBtn.style('background', '#faec21'); // Active Highlight (Yellow)
          activeBtn.style('color', '#000');
          activeBtn.style('border', '1px solid #000');
      }
  };
  // --------------------------------------

  if (btnPencil && btnEraser && btnFill && btnClear && btnMagicWand) {
      let sidebarNode = btnPencil.parent();
      let toolsGroup = sidebarNode;
      if (sidebarNode && !sidebarNode.classList.contains('tools-grid')) {
          toolsGroup = createDiv(''); toolsGroup.addClass('tools-grid'); sidebarNode.insertBefore(toolsGroup.elt, btnPencil.elt);
          btnPencil.parent(toolsGroup); btnEraser.parent(toolsGroup); btnFill.parent(toolsGroup); btnMagicWand.parent(toolsGroup); btnClear.parent(toolsGroup);
      }

      // Add Undo/Redo Buttons if not present
      if (!select('#btnSketchUndo')) {
          let btnUndo = createButton('UNDO').id('btnSketchUndo').parent(toolsGroup).class('btn-retro').style('font-size','10px').mousePressed(undo);
          let btnRedo = createButton('REDO').id('btnSketchRedo').parent(toolsGroup).class('btn-retro').style('font-size','10px').mousePressed(redo);
          btnUndo.attribute('data-tooltip', 'Undo (Ctrl+Z)');
          btnRedo.attribute('data-tooltip', 'Redo (Ctrl+Shift+Z)');
      }
  }
  if(btnPencil) btnPencil.mousePressed(() => { toolMode = "DRAW"; isEraser = false; mainMode = "ASCII"; updateToolVisuals(); });
  if(btnEraser) btnEraser.mousePressed(() => { toolMode = "DRAW"; isEraser = true; updateToolVisuals(); });
  if(btnFill) btnFill.mousePressed(() => { toolMode = "FILL"; updateToolVisuals(); });
  if(btnMagicWand) btnMagicWand.mousePressed(() => { toolMode = "MAGIC_WAND"; updateToolVisuals(); });
  if(btnClear) btnClear.mousePressed(() => { resetAllGrids(); saveState(); });
  
  // Initial call
  updateToolVisuals();

  // --- BIND CUSTOM INK INPUT ---
  let customInkInput = select('#customInkColor');
  if(customInkInput) {
      customInkInput.input(() => {
          inkColorHex = customInkInput.value();
          selectedColor = inkColorHex;
      });
  }

  let divAscii = select('#sketch-palette');
  if (!divAscii && sidebarDiv) { createDiv('2. Patterns').parent(sidebarDiv).class('section-title').style('font-weight','700').style('font-size','16px'); divAscii = createDiv('').parent(sidebarDiv).id('sketch-palette').class('palette-grid'); }
  if(divAscii) {
    divAscii.html('');
    palette.forEach(item => {
      let btn = createButton(item).parent(divAscii);
      btn.attribute('data-tooltip', `Select '${item}' character`);
      if (item === "SMART") btn.style('grid-column', 'span 2'); 
      btn.mousePressed(() => {
        selectedChar = item; isEraser = false; if (toolMode !== "FILL") toolMode = "DRAW"; mainMode = "ASCII";
        divAscii.elt.querySelectorAll('button').forEach(b => b.style.background = ''); btn.elt.style.background = '#ddd';
      });
    });
  }
  

  let divColor = select('#sketch-colors');
  if (!divColor && sidebarDiv) { createDiv('4. Ink Color').parent(sidebarDiv).class('section-title').style('font-weight','700').style('font-size','16px'); divColor = createDiv('').parent(sidebarDiv).id('sketch-colors'); }
  if(divColor) {
    divColor.removeClass('palette-grid'); // Remove grid class from container to allow stacking
    divColor.removeClass('palette-ink');
    divColor.html('');
    
    // NEW: Helper for color buttons
    const highlightColorBtn = (targetBtn) => {
        divColor.elt.querySelectorAll('button').forEach(b => {
            b.style.border = '1px solid #ccc';
            b.style.transform = 'scale(1)';
            b.style.zIndex = '0';
            b.style.boxShadow = 'none';
        });
        if(targetBtn) {
            targetBtn.style.border = '2px solid #000';
            targetBtn.style.transform = 'scale(1.15)';
            targetBtn.style.zIndex = '1';
            targetBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        }
    };

    // CMYK Section
    createDiv('CMYK').parent(divColor).style('font-size','12px').style('font-weight','bold').style('margin-bottom','4px').style('margin-top','0px');
    let cmykGrid = createDiv('').parent(divColor).class('palette-grid palette-ink').style('grid-template-columns', 'repeat(5, 1fr)').style('gap', '4px').style('margin-bottom', '10px');
    paletteCMYK.forEach(col => {
      let btn = createButton('').parent(cmykGrid).style('width', '100%').style('height', '28px').style('background', col).style('border', '1px solid #ccc');
      btn.attribute('data-tooltip', `Select CMYK ${col}`);
      
      // Initial highlight
      if(col === selectedColor) setTimeout(() => highlightColorBtn(btn.elt), 0);

      btn.mousePressed(() => { 
          selectedColor = col;
          inkColorHex = col; // Update text color
          if(customInkInput) customInkInput.value(col); // Sync input

          isColorEraser = false; 
          if (toolMode !== "FILL") toolMode = "DRAW";
          // Note: We switch to COLOR mode for blocks, but text color is also updated.
          mainMode = "ASCII"; 
          highlightColorBtn(btn.elt);
          updateToolVisuals();
      });
    });

    // Stabilo Section
    createDiv('Stabilo').parent(divColor).style('font-size','12px').style('font-weight','bold').style('margin-bottom','4px');
    let stabiloGrid = createDiv('').parent(divColor).class('palette-grid palette-ink').style('grid-template-columns', 'repeat(4, 1fr)').style('gap', '4px');
    paletteStabilo.forEach(col => {
      let btn = createButton('').parent(stabiloGrid).style('width', '100%').style('height', '28px').style('background', col).style('border', '1px solid #ccc');
      btn.attribute('data-tooltip', `Select Stabilo ${col}`);
      
      // Initial highlight
      if(col === selectedColor) setTimeout(() => highlightColorBtn(btn.elt), 0);

      btn.mousePressed(() => { 
          selectedColor = col;
          inkColorHex = col; // Update text color
          if(customInkInput) customInkInput.value(col); // Sync input

          isColorEraser = false; 
          if (toolMode !== "FILL") toolMode = "DRAW"; 
          // Note: We switch to COLOR mode for blocks, but text color is also updated.
          mainMode = "ASCII"; 
          highlightColorBtn(btn.elt);
          updateToolVisuals();
      });
    });
  }

  let exportGroup = select('#export-group');
  if (!exportGroup && sidebarDiv) {
      createDiv('Files').parent(sidebarDiv).class('section-title').style('font-weight','700').style('font-size','16px'); exportGroup = createDiv('').parent(sidebarDiv).id('export-group');
      exportGroup.style('display','flex').style('flex-direction','column').style('gap','8px');
      let btnPng = createButton('EXPORT PNG').parent(exportGroup).class('btn-retro').attribute('data-tooltip', 'Save sketch as PNG image.'); btnPng.mousePressed(saveArtworkPNG);
      let btnTxt = createButton('EXPORT TXT').parent(exportGroup).class('btn-retro').attribute('data-tooltip', 'Save sketch as Text file.'); btnTxt.mousePressed(saveArtworkTXT);
      let btnSvg = createButton('EXPORT SVG (TO EDIT)').parent(exportGroup).class('btn-retro').attribute('data-tooltip', 'Save sketch as SVG vector.'); btnSvg.mousePressed(exportSVG);
      let importWrapper = createDiv('').parent(exportGroup).style('position','relative');
      createButton('IMPORT SVG (TO EDIT)').parent(importWrapper).class('btn-retro').attribute('data-tooltip', 'Import SVG to edit.');
      let fileInp = createFileInput(handleSVGImport).parent(importWrapper); fileInp.style('position','absolute').style('top','0').style('left','0').style('opacity','0').style('width','100%').style('height','100%').style('cursor','pointer');
      createDiv('').parent(exportGroup).class('divider');
      let btnLib = createButton('ADD TO LIBRARY').parent(exportGroup).class('btn-retro').attribute('data-tooltip', 'Save sketch to Memory Archive.');
      btnLib.mousePressed(() => {
          let name = select('#sSketchName') ? select('#sSketchName').value() : "Sketch";
          let pg = createGraphics(canvasW, canvasH); pg.pixelDensity(1); pg.background(255);
          pg.image(pgColorLayer, 0, 0); pg.image(pgTextLayer, 0, 0);
          if(window.addToLibrary) { window.addToLibrary(pg, name); } pg.remove();
      });
  }
}

// --- IO FUNCTIONS ---
function handleFile(file) { 
    if (file.type === 'image') loadImage(file.data, handleImageLoad, () => alert("Failed to load image.")); 
    else alert("Invalid file type. Please drop an image.");
}
function handleImageLoad(img) { templateImg = img; showTemplateImg = true; if(sliderScale) sliderScale.value(1.0); if(sliderX) sliderX.value(canvasW/2); }

// Helper to find content bounding box
function getContentBounds() {
    let minX = cols, minY = rows, maxX = -1, maxY = -1;
    let hasContent = false;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (grid[y][x] !== "" || colorGrid[y][x] !== null) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasContent = true;
            }
        }
    }
    if (!hasContent) return { x: 0, y: 0, w: canvasW, h: canvasH, minC: 0, minR: 0, maxC: cols-1, maxR: rows-1 };
    
    // Add 1 cell padding
    minX = Math.max(0, minX - 1); minY = Math.max(0, minY - 1);
    maxX = Math.min(cols - 1, maxX + 1); maxY = Math.min(rows - 1, maxY + 1);

    return {
        x: minX * cellW, y: minY * cellH,
        w: (maxX - minX + 1) * cellW, h: (maxY - minY + 1) * cellH,
        minC: minX, minR: minY, maxC: maxX, maxR: maxY
    };
}

function saveArtworkPNG() { 
    let b = getContentBounds();
    let pg = createGraphics(b.w, b.h); pg.pixelDensity(1); pg.background(255); 
    pg.image(pgColorLayer, -b.x, -b.y); pg.image(pgTextLayer, -b.x, -b.y); 
    save(pg, 'artwork.png'); pg.remove(); 
}

function saveArtworkTXT() {
  let content = "";
  for(let y=0; y<rows; y++) {
    let line = "";
    for(let x=0; x<cols; x++) {
      let c = grid[y][x];
      // Nếu ô trống thì thay bằng khoảng trắng để giữ định dạng
      line += (c === "" ? " " : c);
    }
    content += line + "\n";
  }
  let blob = new Blob([content], {type: "text/plain;charset=utf-8"});
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = "drawing.txt";
  a.click();
}
function exportSVG() {
  let b = getContentBounds();
  let svg = `<?xml version="1.0" standalone="no"?><svg width="${b.w}" height="${b.h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>`;
  
  // Only loop through bounds
  for(let y=b.minR; y<=b.maxR; y++) {
      for(let x=b.minC; x<=b.maxC; x++) {
          if(colorGrid[y][x]) svg += `<rect x="${(x - b.minC)*cellW}" y="${(y - b.minR)*cellH}" width="${cellW}" height="${cellH}" fill="${colorGrid[y][x]}" stroke="none"/>`;
      }
  }
  for(let y=b.minR; y<=b.maxR; y++) {
      for(let x=b.minC; x<=b.maxC; x++) {
          let char = grid[y][x];
          if (char !== "") {
              // use per-cell text color when available, otherwise fallback to current ink color
              let fill = (textColorGrid[y] && textColorGrid[y][x]) ? textColorGrid[y][x] : inkColorHex;
              // escape common XML entities
              let safe = String(char).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              svg += `<text x="${(x - b.minC)*cellW+cellW/2}" y="${(y - b.minR)*cellH+cellH/2}" font-family="monospace" font-size="${userFontSize}" text-anchor="middle" dominant-baseline="middle" fill="${fill}">${safe}</text>`;
          }
      }
  }
  svg += `</svg>`; let blob = new Blob([svg], {type: "image/svg+xml"}); let url = URL.createObjectURL(blob); let a = document.createElement("a"); a.href = url; a.download = "drawing.svg"; a.click();
}
function handleSVGImport(file) {
  if (file.type === 'image' || file.name.toLowerCase().endsWith('.svg')) {
    if (file.file) { let reader = new FileReader(); reader.onload = (e) => { let content = e.target.result; if (content.startsWith('data:')) try { content = atob(content.split(',')[1]); } catch(err){} parseSVGAndLoadToGrid(content); }; reader.readAsText(file.file); } 
    else if (file.data) { let data = file.data; if (typeof data === 'string') { if (data.startsWith('data:')) try { parseSVGAndLoadToGrid(atob(data.split(',')[1])); } catch(e){} else parseSVGAndLoadToGrid(data); } } 
  }
}
function parseSVGAndLoadToGrid(svgText) {
  try { resetAllGrids(); let parser = new DOMParser(); let doc = parser.parseFromString(svgText, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return;
  let rects = doc.getElementsByTagName("rect"); for (let r of rects) { if (r.getAttribute("width") == "100%") continue; let x = parseFloat(r.getAttribute("x")), y = parseFloat(r.getAttribute("y")), c = Math.round(x/cellW), r_ = Math.round(y/cellH); if (isValidCell(c, r_)) colorGrid[r_][c] = r.getAttribute("fill"); } 
  let texts = doc.getElementsByTagName("text"); for (let t of texts) { let x = parseFloat(t.getAttribute("x")), y = parseFloat(t.getAttribute("y")), c = Math.round((x - cellW/2)/cellW), r_ = Math.round((y - cellH/2)/cellH); if (isValidCell(c, r_)) grid[r_][c] = t.textContent; } 
  updateLayerColorVisuals(); updateLayerTextVisuals(); saveState();
  } catch(e) {}
}

// --- SKETCH ZOOM HELPERS (TAB 2) ---
function updateSketchZoom(amount) {
    sketchScale += amount;
    sketchScale = constrain(sketchScale, 0.1, 5.0);
    let holder = select('#sketch-canvas-holder');
    if(holder) {
        holder.style('transform', `scale(${sketchScale})`);
        holder.style('transform-origin', '0 0');
    }
    let lbl = select('#sketch-zoom-val');
    if(lbl) lbl.html(Math.round(sketchScale * 100) + '%');
}

function setupSketchZoomUI() {
    // 1. Try to attach to existing HTML elements first
    let btnIn = select('#btnSketchZoomIn');
    let btnOut = select('#btnSketchZoomOut');
    let lblZoom = select('#sketch-zoom-val');

    if (btnIn && btnOut) {
        btnIn.mousePressed(() => updateSketchZoom(0.1));
        btnOut.mousePressed(() => updateSketchZoom(-0.1));
        if(lblZoom) {
             lblZoom.style('cursor', 'pointer');
             lblZoom.mousePressed(() => { sketchScale = 1.0; updateSketchZoom(0); });
        }
        return;
    }

    let centerPanel = select('#tab-sketch .panel-center');
    if (!centerPanel) {
        let holder = select('#sketch-canvas-holder');
        if (holder) {
             let p = holder.elt.parentNode;
             while(p) {
                 if (p.classList && p.classList.contains('panel-center')) { centerPanel = new p5.Element(p); break; }
                 p = p.parentNode;
                 if (!p || p.tagName === 'BODY') break;
             }
        }
    }
    
    if (centerPanel && !select('#sketch-zoom-ctrl')) {
        let zDiv = createDiv('').id('sketch-zoom-ctrl').parent(centerPanel).class('zoom-float');
        let btnIn = createButton('+').parent(zDiv).class('btn-zoom').style('height','30px').style('width','30px');
        let btnReset = createButton('1:1').parent(zDiv).class('zoom-text').style('cursor','pointer');
        let btnOut = createButton('-').parent(zDiv).class('btn-zoom').style('height','30px').style('width','30px');
        
        btnIn.mousePressed(() => updateSketchZoom(0.1));
        btnOut.mousePressed(() => updateSketchZoom(-0.1));
        btnReset.mousePressed(() => { sketchScale = 1.0; updateSketchZoom(0); });
    }
}

// --- LAYOUT ZOOM HELPERS ---
function updateLayoutZoom(amount) {
    layoutScale += amount;
    layoutScale = constrain(layoutScale, 0.1, 3.0);
    let holder = select('#layout-canvas-holder');
    if(holder) {
        holder.style('transform', `scale(${layoutScale})`);
        holder.style('transform-origin', 'top center');
    }
}

// --- LAYOUT TAB LOGIC (NEW FEATURES) ---
function setupLayoutTab() {
  let layoutDiv = select('#layout-canvas-holder');
  if (!layoutDiv) return;

  // 1. Create Viewport Wrapper (if not exists)
  let viewport = select('#layout-viewport');
  if (!viewport) {
      viewport = createDiv('').id('layout-viewport');
      let p = layoutDiv.elt.parentNode;
      if (p) {
          p.insertBefore(viewport.elt, layoutDiv.elt);
          viewport.elt.appendChild(layoutDiv.elt);
      }
      viewport.style('width', '100%').style('height', '100%');
      viewport.style('overflow', 'auto').style('background', '#d0d0d0');
      viewport.style('display', 'flex').style('justify-content', 'center');
      viewport.style('padding', '40px').style('box-sizing', 'border-box');
  }

  layoutDiv.style('position', 'relative'); layoutDiv.style('overflow', 'hidden');
  layoutDiv.style('width', '794px'); layoutDiv.style('height', '1123px'); // A4 Size
  layoutDiv.style('background', 'transparent'); layoutDiv.style('box-shadow', 'none');
  layoutDiv.style('flex-shrink', '0');
  layoutDiv.style('transform-origin', 'top center');
  // layoutDiv.style('transition', 'transform 0.2s ease');
  
  if (layoutDiv.elt.querySelectorAll('.layout-page-bg').length === 0) {
      createPageBackground(layoutDiv, 0, true);
      recalculateLayoutPositions();
  }

  layoutDiv.elt.addEventListener('dragover', (e) => e.preventDefault());
  layoutDiv.elt.addEventListener('drop', (e) => {
    e.preventDefault();
    
    // 1. Handle Thought Card Drop (Convert to Text Box)
    if (draggedLibItem && draggedLibItem.extraData && draggedLibItem.extraData.text) {
       saveLayoutState(); 
       let rect = layoutDiv.elt.getBoundingClientRect();
       let boxW = 300;
       let boxH = 200;
       let x = (e.clientX - rect.left) / layoutScale - (boxW / 2);
       let y = (e.clientY - rect.top) / layoutScale - (boxH / 2);
       
       createLayoutTextBox(x, y, boxW, boxH, draggedLibItem.extraData.text);
       draggedLibItem = null;
       return;
    }

    let data = e.dataTransfer.getData("text/plain");
    if (data && data.startsWith("data:image")) {
       // OPTIMIZATION: Resize dropped image to save LocalStorage space
       resizeBase64Img(data, 400, 0.6, (optimizedData) => {
           saveLayoutState(); // Save before drop
           let wrapper = createDiv(''); wrapper.parent(layoutDiv);
           wrapper.style('position', 'absolute'); wrapper.style('width', '150px'); wrapper.style('cursor', 'move');
           
           let rect = layoutDiv.elt.getBoundingClientRect();
           wrapper.style('left', ((e.clientX - rect.left) / layoutScale - 75) + 'px');
           wrapper.style('top', ((e.clientY - rect.top) / layoutScale - 75) + 'px');

           let img = createImg(optimizedData, ''); img.parent(wrapper);
           img.style('width', '100%'); img.style('height', '100%');
           img.style('display', 'block'); img.style('pointer-events', 'none');
           
           makeElementInteractive(wrapper.elt);
           selectLayoutElement(wrapper.elt);
       });
    }
  });

  // Drawing Listeners for Text Box
  layoutDiv.elt.addEventListener('mousedown', (e) => {
      if (layoutTool === 'TEXT_BOX') {
          isDrawingTextBox = true;
          let rect = layoutDiv.elt.getBoundingClientRect();
          drawStart.x = (e.clientX - rect.left) / layoutScale;
          drawStart.y = (e.clientY - rect.top) / layoutScale;
          
          tempDrawBox = createDiv('');
          tempDrawBox.parent(layoutDiv);
          tempDrawBox.class('drawing-box');
          tempDrawBox.style('left', drawStart.x + 'px');
          tempDrawBox.style('top', drawStart.y + 'px');
          tempDrawBox.style('width', '0px');
          tempDrawBox.style('height', '0px');
          e.preventDefault(); // Prevent text selection during drag
      }
  });

  window.addEventListener('mousemove', (e) => {
      if (isDrawingTextBox && tempDrawBox) {
          let rect = layoutDiv.elt.getBoundingClientRect();
          let currX = (e.clientX - rect.left) / layoutScale;
          let currY = (e.clientY - rect.top) / layoutScale;
          
          let w = currX - drawStart.x;
          let h = currY - drawStart.y;
          
          tempDrawBox.style('width', Math.abs(w) + 'px');
          tempDrawBox.style('height', Math.abs(h) + 'px');
          tempDrawBox.style('left', (w < 0 ? currX : drawStart.x) + 'px');
          tempDrawBox.style('top', (h < 0 ? currY : drawStart.y) + 'px');
      }
  });

  window.addEventListener('mouseup', (e) => {
      if (isDrawingTextBox) {
          isDrawingTextBox = false;
          if (tempDrawBox) {
              finalizeTextBox(tempDrawBox);
              tempDrawBox = null;
          }
          layoutTool = 'SELECT'; // Reset tool
          document.body.style.cursor = 'default';
          // Update UI button state
          let btn = select('#btn-draw-text');
          if(btn) btn.style('background', '');
      }
  });
  
  // Full panel size override 
  let sheet = select('#tab-index .paper-sheet');
  if(sheet) {
      sheet.style('width', '100%'); sheet.style('height', '100%');
      sheet.style('max-width', 'none'); sheet.style('max-height', 'none');
      sheet.style('border', 'none'); sheet.style('box-shadow', 'none');
      sheet.style('transform', 'none');
  }
  
  // Zoom Controls (Center Panel - Floating)
  let centerPanel = null;
  let holder = select('#layout-canvas-holder');
  if (holder) {
      // FIX: Dùng DOM traversal (parentNode) thay vì p5 parent() để tìm đúng panel cha
      let p = holder.elt.parentNode;
      while(p) {
          if (p.classList && p.classList.contains('panel-center')) { centerPanel = new p5.Element(p); break; }
          p = p.parentNode;
          if (!p || p.tagName === 'BODY') break;
      }
  }
  if (!centerPanel) centerPanel = select('#tab-index .panel-center');

  if (centerPanel && !select('#layout-zoom-ctrl')) {
      let zDiv = createDiv('').id('layout-zoom-ctrl').parent(centerPanel).class('zoom-float');
      let btnIn = createButton('+').parent(zDiv).class('btn-zoom').style('height','30px').style('width','30px');
      let btnReset = createButton('1:1').parent(zDiv).class('zoom-text').style('cursor','pointer');
      let btnOut = createButton('-').parent(zDiv).class('btn-zoom').style('height','30px').style('width','30px');
      
      btnIn.mousePressed(() => updateLayoutZoom(0.1));
      btnOut.mousePressed(() => updateLayoutZoom(-0.1));
      btnReset.mousePressed(() => { layoutScale = 1.0; updateLayoutZoom(0); });
  }

  // Initialize global sidebar ref
  let sbEl = select('#layout-tools-panel .panel-content');
  if (sbEl) layoutSidebarRef = sbEl;

  // Create persistent file input for loading (prevents UI destruction issues)
  if (layoutSidebarRef && !select('#layout-load-input')) {
      let fi = createFileInput(handleLayoutLoad).id('layout-load-input');
      fi.style('display', 'none');
      layoutSidebarRef.child(fi);
  }

  createLayoutUI();
  updateLayoutZoom(0); // Force initial render/transform to show artboard immediately

  // --- Load Saved Layout ---
  loadLayoutFromLocalStorage();

  // --- Setup Observer for Auto-Save and Layer Panel ---
  const artboard = document.getElementById('layout-canvas-holder');
  if (artboard) {
      const observer = new MutationObserver((mutations) => {
          // Auto-save on any change (debounced)
          saveLayoutToLocalStorage();
          
          // Update Layer Panel only on structural changes (add/remove nodes)
          const structureChanged = mutations.some(m => m.type === 'childList');
          if (structureChanged) updateLayerPanel();
      });

      observer.observe(artboard, { childList: true, attributes: true, subtree: true, attributeFilter: ['style', 'class', 'src'] });
      
      // Initial population is handled by loadLayoutFromLocalStorage or default creation
  }
}

function getBlendTarget(elmnt) {
    if (!elmnt) return null;
    return elmnt.querySelector('textarea, img') || elmnt;
}

function applyBlendMode(elmnt, mode) {
    if (!elmnt) return;
    let target = getBlendTarget(elmnt);
    if (!target) return;
    if (target !== elmnt) {
        elmnt.style.mixBlendMode = 'normal';
    }
    target.style.mixBlendMode = mode;
    elmnt.dataset.blendMode = mode;
}

function getBlendModeForElement(elmnt) {
    if (!elmnt) return 'normal';
    if (elmnt.dataset && elmnt.dataset.blendMode) return elmnt.dataset.blendMode;
    let target = getBlendTarget(elmnt);
    if (!target) return 'normal';
    return window.getComputedStyle(target).mixBlendMode || 'normal';
}

function createLayoutUI() {
    // Ensure sidebar is available
    if (!layoutSidebarRef) {
        let sbEl = select('#layout-tools-panel .panel-content');
        if (sbEl) layoutSidebarRef = sbEl;
    }
    if (!layoutSidebarRef) return;
    
    // Remove existing group using native DOM to be safe
    let existing = document.getElementById('layout-ui-group');
    if (existing) existing.remove();

    let group = createDiv('').id('layout-ui-group').parent(select('#layer-controls'));
    layoutSidebarRef.child(group);
    
    // 0. History
    createDiv('History').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let histRow = createDiv('').parent(group).class('mini-row').style('gap','4px');
    let btnUndo = createButton('UNDO').parent(histRow).class('btn-retro').style('flex','1').style('font-size','10px').attribute('data-tooltip', 'Undo (Ctrl+Z)');
    let btnRedo = createButton('REDO').parent(histRow).class('btn-retro').style('flex','1').style('font-size','10px').attribute('data-tooltip', 'Redo (Ctrl+Shift+Z)');
    btnUndo.mousePressed(undoLayout);
    btnRedo.mousePressed(redoLayout);

    // 1. Paper Patterns (Interactive Images)
    createDiv('Paper Pattern').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let patRow = createDiv('').parent(group).class('mini-row').style('justify-content', 'center').style('gap', '10px');
    
    let btnPrev = createButton('').parent(patRow).class('btn-retro').style('width','40px').html('<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIyIiB2aWV3Qm94PSIwIDAgMTAgMiI+PHJlY3Qgd2lkdGg9" class="pixel-icon" style="width:10px;height:2px;background:#fff;">').attribute('data-tooltip', 'Previous Pattern');
    let btnNext = createButton('').parent(patRow).class('btn-retro').style('width','40px').html('<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDEwIDEwIj48cGF0aCBmaWxsPSIjMDAwIiBkPSJNNiAyTDEyIDhMNiAxNFYyWiIvPjwvc3ZnPg==" class="pixel-icon">').attribute('data-tooltip', 'Next Pattern');

    btnPrev.mousePressed(() => {
        changeActiveArtboardPattern(-1);
    });

    btnNext.mousePressed(() => {
        changeActiveArtboardPattern(1);
    });

    // MOVED: Blend Mode (Above Text Tool)
    let blendRow = createDiv('').parent(group).class('mini-row').style('margin-top','6px');
    createSpan('Blend:').parent(blendRow).style('font-size','14px');
    let selBlend = createSelect().id('blend-mode-select').parent(blendRow).class('retro-input').style('width','60%').style('height','24px').style('padding','0');
    ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion'].forEach(m => selBlend.option(m));
    
    selBlend.changed(() => {
        if(selectedLayoutElement) {
            applyBlendMode(selectedLayoutElement, selBlend.value());
            saveLayoutState();
        }
    });

    // 2. Add Text Tool
    createDiv('Text Tool').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let txtRow = createDiv('').parent(group).class('mini-row');
    
    let btnDrawText = createButton('Draw Text Box').id('btn-draw-text').parent(txtRow).class('btn-retro').attribute('data-tooltip', 'Click and drag to create a text box.');
    btnDrawText.mousePressed(() => {
        layoutTool = 'TEXT_BOX';
        document.body.style.cursor = 'crosshair';
        btnDrawText.style('background', '#faec21'); // Active highlight
    });
    
    // Text Alignment
    let alignRow = createDiv('').parent(group).class('mini-row').style('margin-top','6px').style('gap','4px');
    let btnLeft = createButton('Left').parent(alignRow).class('btn-retro').style('flex','1').attribute('data-tooltip', 'Align text left.');
    let btnCenter = createButton('Center').parent(alignRow).class('btn-retro').style('flex','1').attribute('data-tooltip', 'Align text center.');
    let btnRight = createButton('Right').parent(alignRow).class('btn-retro').style('flex','1').attribute('data-tooltip', 'Align text right.');

    const applyAlign = (align) => {
        if(selectedLayoutElement) {
            selectedLayoutElement.style.textAlign = align;
            // Also apply to textarea if exists
            let ta = selectedLayoutElement.querySelector('textarea');
            if(ta) ta.style.textAlign = align;
            saveLayoutState();
        }
    };
    btnLeft.mousePressed(() => applyAlign('left'));
    btnCenter.mousePressed(() => applyAlign('center'));
    btnRight.mousePressed(() => applyAlign('right'));

    // Text Settings (Size & Color)
    let styleRow = createDiv('').parent(group).class('mini-row').style('margin-top','6px');
    createSpan('Size (pt):').parent(styleRow).style('font-size','14px');
    let sizeInput = createInput('24', 'number').id('text-size-input').parent(styleRow).class('retro-input').style('width','50px');
    sizeInput.attribute('min', '1');
    
    // NEW: Font Family Selector
    let fontSelect = createSelect().id('text-font-select').parent(styleRow).class('retro-input').style('width','90px').style('margin-left','4px');
    ['KK7VCROSDMono', 'FT88', 'HLHoctro', 'BianzhidaiBase', 'ocr-a-std', 'Courier New'].forEach(f => fontSelect.option(f));

    let colorPicker = createColorPicker('#000000').id('text-color-picker').parent(styleRow).style('width','30px').style('height','30px').style('border','none').style('box-shadow','0 2px 5px rgba(0,0,0,0.1)');

    sizeInput.input(() => {
        if(selectedLayoutElement) {
            let ta = selectedLayoutElement.querySelector('textarea');
            if(ta) {
                let val = sizeInput.value();
                if(val) ta.style.fontSize = val + 'px';
                saveLayoutState();
            }
        }
    });

    fontSelect.changed(() => {
        if(selectedLayoutElement) {
            let ta = selectedLayoutElement.querySelector('textarea');
            if(ta) {
                ta.style.fontFamily = fontSelect.value();
                saveLayoutState();
            }
        }
    });

    colorPicker.input(() => {
        if(selectedLayoutElement) {
            let ta = selectedLayoutElement.querySelector('textarea');
            if(ta) {
                ta.style.color = colorPicker.value();
                saveLayoutState();
            }
        }
    });

    // 4. Settings (Snap)
    createDiv('Settings').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let settingRow = createDiv('').parent(group).class('mini-row');
    let chkSnap = createCheckbox('Snap to Grid', isSnapToGrid).parent(settingRow).attribute('data-tooltip', 'Toggle grid snapping.');
    chkSnap.style('font-family', 'monospace').style('font-size', '14px');
    chkSnap.changed(() => { isSnapToGrid = chkSnap.checked(); });

    // Export Tools (Moved Below Settings)
    createDiv('Export').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let expRow = createDiv('').parent(group).class('mini-row').style('gap','4px');
    let btnPng = createButton('Save PNG').parent(expRow).class('btn-retro').style('flex','1').attribute('data-tooltip', 'Export active artboard as PNG.');
    let btnPdf = createButton('Save PDF').parent(expRow).class('btn-retro').style('flex','1').attribute('data-tooltip', 'Export all artboards as PDF.');
    btnPng.mousePressed(exportActiveArtboardPNG);
    btnPdf.mousePressed(exportAllArtboardsPDF);

    // 5. Project (Save/Load)
    createDiv('Project').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let projRow = createDiv('').parent(group).class('mini-row');
    let btnLoad = createButton('Load Layout').parent(projRow).class('btn-retro').style('flex','1').attribute('data-tooltip', 'Load project from JSON.');
    btnLoad.mousePressed(() => {
        let fi = select('#layout-load-input');
        if(fi) fi.elt.click();
    });

    let btnClearLayout = createButton('Reset').parent(projRow).class('btn-retro').style('flex','1').style('margin-left','4px').style('background','#e74c3c').style('color','white').attribute('data-tooltip', 'Clear layout and storage.');
    btnClearLayout.mousePressed(() => {
        if(confirm("Reset layout and clear saved data? This cannot be undone.")) {
            let holder = select('#layout-canvas-holder');
            if(holder) {
                holder.html('');
                localStorage.removeItem('mem_idx_layout_content');
                createPageBackground(holder, 0, true);
                recalculateLayoutPositions();
                updateLayerPanel();
            }
        }
    });
}

function finalizeTextBox(tempBox) {
    let holder = select('#layout-canvas-holder');
    if (!holder) return;
    saveLayoutState();

    let w = tempBox.style('width');
    let h = tempBox.style('height');
    let l = tempBox.style('left');
    let t = tempBox.style('top');
    tempBox.remove();

    createLayoutTextBox(parseFloat(l), parseFloat(t), parseFloat(w), parseFloat(h), "");
}

function createLayoutTextBox(x, y, w, h, content = "") {
    let holder = select('#layout-canvas-holder');
    if (!holder) return;

    let wrapper = createDiv('');
    wrapper.parent(holder);
    wrapper.style('position', 'absolute');
    wrapper.style('left', x + 'px');
    wrapper.style('top', y + 'px');
    wrapper.style('width', w + 'px');
    wrapper.style('height', h + 'px');
    wrapper.style('border', 'none');
    
    let ta = createElement('textarea', content);
    ta.parent(wrapper);
    ta.style('width', '100%').style('height', '100%');
    ta.style('background', 'transparent').style('border', 'none').style('resize', 'none');
    ta.style('font-family', "'KK7VCROSDMono', monospace"); // Ensure correct font
    ta.style('font-size', '24px');
    ta.style('outline', 'none').style('overflow', 'hidden');

    makeElementInteractive(wrapper.elt);
    selectLayoutElement(wrapper.elt);
    if (!content) ta.elt.focus();
}

// Helper: Select Element & Toggle Handles
function selectLayoutElement(elmnt) {
    if (selectedLayoutElement && selectedLayoutElement !== elmnt) {
        selectedLayoutElement.style.outline = 'none';
        // Hide handles of previous element
        let handles = selectedLayoutElement.querySelectorAll('.resize-handle, .rotate-handle');
        handles.forEach(h => h.style.display = 'none');
        let moveH = selectedLayoutElement.querySelector('.move-handle');
        if(moveH) moveH.style.display = 'none';
    }
    selectedLayoutElement = elmnt;
    if (selectedLayoutElement) {
        selectedLayoutElement.style.outline = '1px dashed #0072BC';
        // Show handles of current element
        let handles = selectedLayoutElement.querySelectorAll('.resize-handle, .rotate-handle, .move-handle');
        handles.forEach(h => h.style.display = 'block');

        // Sync UI controls if it's a text box
        let ta = selectedLayoutElement.querySelector('textarea');
        if (ta) {
            let input = select('#text-size-input');
            if(input) {
                let fs = parseInt(window.getComputedStyle(ta).fontSize);
                if(!isNaN(fs)) input.value(fs);
            }
            
            // Sync Font Select
            let fontSel = select('#text-font-select');
            if(fontSel) {
                let currentFont = window.getComputedStyle(ta).fontFamily.replace(/['"]/g, '');
                for(let opt of fontSel.elt.options) {
                    if(currentFont.includes(opt.value)) {
                        fontSel.value(opt.value);
                        break;
                    }
                }
            }

            let picker = select('#text-color-picker');
            if(picker) {
                let col = color(window.getComputedStyle(ta).color);
                picker.value(col.toString('#rrggbb'));
            }
        }

        // Sync Blend Mode
        let blendSel = select('#blend-mode-select');
        if(blendSel) {
            blendSel.value(getBlendModeForElement(selectedLayoutElement));
        }
    }

    // Update visual selection in layer panel
    const layerList = document.getElementById('layer-list');
    if (layerList) {
        // Remove all 'selected' classes
        layerList.querySelectorAll('.layer-item').forEach(item => item.classList.remove('selected'));
        
        // Add 'selected' to the new one
        if (selectedLayoutElement && selectedLayoutElement.id) {
            const newSelectedItem = layerList.querySelector(`[data-target-id="${selectedLayoutElement.id}"]`);
            if (newSelectedItem) {
                newSelectedItem.classList.add('selected');
            }
        }
    }
}

// --- THOUGHTS TAB HEADER ---
function setupThoughtsDateHeader() {
    let panel = select('#tab-thoughts .panel-left');
    if (panel && !select('#notebook-date-header')) {
        let container = createDiv('');
        container.id('notebook-date-header');
        
        createSpan('Ngày ').parent(container);
        createInput('').parent(container).class('date-input');
        createSpan(' Tháng ').parent(container);
        createInput('').parent(container).class('date-input');
        createSpan(' Năm ').parent(container);
        createInput('').parent(container).class('date-input');

        panel.elt.insertBefore(container.elt, panel.elt.firstChild);
        
        // Add Instruction Text
        let instr = createDiv('Write down your thought then go to the tab 2, tab 3...').parent(panel);
        instr.style('font-size', '11px').style('color', '#666').style('font-style', 'italic').style('margin-bottom', '10px');
        // Insert after the section title (which is usually the second child after date header)
        let title = panel.elt.querySelector('.section-title');
        if(title) {
            panel.elt.insertBefore(instr.elt, title.nextSibling);
        }

        // Inject CSS for obvious blinking cursor
        let style = document.createElement('style');
        style.innerHTML = `
            #inpThought { caret-color: #f75397; caret-shape: block; }
            #inpThought:focus { outline: 2px solid #f75397; }
        `;
        document.head.appendChild(style);
    }
}

// --- MUSIC PLAYER LOGIC ---
function setupMusicPlayer() {
    let btnPlay = select('#btn-play-music');
    let btnToggle = select('#btn-toggle-music');
    let input = select('#music-url-input');
    let container = select('#music-embed-container');
    let content = select('#music-content');

    // Playlist for auto-play
    const playlist = [
        "https://www.youtube.com/watch?v=LDeQqaXzr8o",
        "https://www.youtube.com/watch?v=BhhFOfRaCkU",
        "https://www.youtube.com/watch?v=ZeHEehWlllg"
    ];

    // Helper to load URL
    const loadMusic = (url) => {
        let embed = "";
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let vId = "";
            if (url.includes('v=')) vId = url.split('v=')[1].split('&')[0];
            else if (url.includes('youtu.be/')) vId = url.split('youtu.be/')[1].split('?')[0];
            // Added autoplay=1
            if (vId) embed = `<iframe width="100%" height="100" src="https://www.youtube.com/embed/${vId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; compute-pressure" allowfullscreen></iframe>`;
        } else if (url.includes('spotify.com')) {
            let cleanUrl = url.split('?')[0];
            let parts = cleanUrl.split('spotify.com/');
            if (parts.length > 1 && !parts[1].startsWith('embed')) {
                embed = `<iframe style="border-radius:12px" src="https://open.spotify.com/embed/${parts[1]}" width="100%" height="80" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; compute-pressure"></iframe>`;
            } else {
                 embed = `<iframe style="border-radius:12px" src="${cleanUrl}" width="100%" height="80" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; compute-pressure"></iframe>`;
            }
        }
        
        if (embed) {
            container.html(embed);
            if(input) input.value(url);
        } 
        else if (url) alert("Please enter a valid YouTube or Spotify link.");
    };

    // Expose function to play random music globally
    window.playRandomMusic = function() {
        // Only play if container is empty (not already playing)
        if (playlist.length > 0 && container.html().trim() === "") {
            let r = Math.floor(Math.random() * playlist.length);
            loadMusic(playlist[r]);
        }
    };

    // Restore state for Music Player
    const savedState = getPanelState('music-player-widget');
    if (savedState === false) {
        content.elt.style.display = 'none';
        btnToggle.html('<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDEwIDEwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNNCAwSDZWNEgxMFY2SDZWMTBINVY2SDBWNEg0VjBaIi8+PC9zdmc+" class="pixel-icon" style="width:10px;height:10px;">');
    }

    if (btnToggle) {
        btnToggle.mousePressed(() => {
            if (content.elt.style.display === 'none') {
                content.elt.style.display = 'flex';
                btnToggle.html('<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIyIiB2aWV3Qm94PSIwIDAgMTAgMiI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjIiIGZpbGw9IiNmZmYiLz48L3N2Zz4=" class="pixel-icon" style="width:10px;height:2px;background:#fff;">');
                savePanelState('music-player-widget', true);
            } else {
                content.elt.style.display = 'none';
                btnToggle.html('<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDEwIDEwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNNCAwSDZWNEgxMFY2SDZWMTBINVY2SDBWNEg0VjBaIi8+PC9zdmc+" class="pixel-icon" style="width:10px;height:10px;">');
                savePanelState('music-player-widget', false);
            }
        });
    }

    if (btnPlay) {
        btnPlay.mousePressed(() => {
            loadMusic(input.value());
        });
    }
}

// --- IMAGE PROCESSOR DROP (TAB 2) ---
function setupImageProcessorDrop() {
    const dropZone = document.querySelector('#tab-image-proc #input-canvas-holder');
    const fileInput = document.getElementById('fileIn');

    if (dropZone && fileInput) {
        // Drag Over
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = 'rgba(0,0,0,0.05)';
        });

        // Drag Leave
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = 'transparent';
        });

        // Drop
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = 'transparent';

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    // Assign to hidden input
                    fileInput.files = e.dataTransfer.files;
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);

                    // Hide placeholder
                    const ph = dropZone.querySelector('.placeholder-text');
                    if (ph) ph.style.display = 'none';

                    // Manual Preview (Fallback)
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        // Remove previous fallback images
                        const old = dropZone.querySelectorAll('.fallback-img');
                        old.forEach(el => el.remove());
                        
                        // Only append if no canvas exists (assuming processor creates canvas)
                        if (!dropZone.querySelector('canvas')) {
                            const img = document.createElement('img');
                            img.src = ev.target.result;
                            img.className = 'fallback-img';
                            img.style.maxWidth = '100%';
                            img.style.maxHeight = '100%';
                            img.style.objectFit = 'contain';
                            dropZone.appendChild(img);
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    alert("Invalid file type! Please drop an image file (JPG, PNG, GIF).");
                }
            }
        });
        
        // Click to upload (since button is gone)
        dropZone.addEventListener('click', (e) => {
            if (e.target === dropZone || e.target.classList.contains('placeholder-text')) {
                fileInput.click();
            }
        });
        
        fileInput.addEventListener('change', () => {
             if (fileInput.files.length > 0) {
                 const ph = dropZone.querySelector('.placeholder-text');
                 if (ph) ph.style.display = 'none';
                 
                 // Update aspect ratio to match input image
                 const file = fileInput.files[0];
                 const img = new Image();
                 img.onload = () => {
                     const sheet = select('#tab-image-proc .paper-sheet');
                     if(sheet) sheet.style('aspect-ratio', `${img.width}/${img.height}`);
                 };
                 img.src = URL.createObjectURL(file);
             }
        });
    }
}

// --- FLOATING PANEL DRAG LOGIC ---
function makePanelDraggable(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    
    // Use section-title as drag handle since header is removed
    const handle = panel.querySelector('.panel-header') || panel.querySelector('.music-header') || panel;
    
    // Minimize Logic for Floating Panels
    const minBtn = panel.querySelector('.panel-minimize-btn');
    if (minBtn) {
        // Restore state
        const savedState = getPanelState(panelId);
        const content = panel.querySelector('.panel-content');
        if (content && savedState === false) {
             content.style.display = 'none';
             minBtn.innerHTML = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDEwIDEwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNNCAwSDZWNEgxMFY2SDZWMTBINVY2SDBWNEg0VjBaIi8+PC9zdmc+" class="pixel-icon" style="width:10px;height:10px;">';
        }

        minBtn.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent drag start
        minBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (content) {
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    minBtn.innerHTML = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIyIiB2aWV3Qm94PSIwIDAgMTAgMiI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjIiIGZpbGw9IiNmZmYiLz48L3N2Zz4=" class="pixel-icon" style="width:10px;height:2px;background:#fff;">';
                    savePanelState(panelId, true);
                } else {
                    content.style.display = 'none';
                    minBtn.innerHTML = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDEwIDEwIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNNCAwSDZWNEgxMFY2SDZWMTBINVY2SDBWNEg0VjBaIi8+PC9zdmc+" class="pixel-icon" style="width:10px;height:10px;">';
                    savePanelState(panelId, false);
                }
            }
        });
    }

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', (e) => {
        // Only drag on desktop (when position is absolute)
        if (window.getComputedStyle(panel).position !== 'absolute') return;

        // Fix for bottom-anchored panels (like music player)
        if (window.getComputedStyle(panel).bottom !== 'auto') {
            panel.style.top = panel.offsetTop + 'px';
            panel.style.bottom = 'auto';
        }
        
        isDragging = true;
        isDraggingPanel = true;
        startX = e.clientX; startY = e.clientY;
        initialLeft = panel.offsetLeft; initialTop = panel.offsetTop;
        document.body.style.cursor = 'move';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        panel.style.left = `${initialLeft + (e.clientX - startX)}px`;
        panel.style.top = `${initialTop + (e.clientY - startY)}px`;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        isDraggingPanel = false;
        document.body.style.cursor = 'default';
    });
}

// Helper: Kéo thả + Resize Handle
function makeElementInteractive(elmnt) {
  // Remove existing handles to prevent duplicates (crucial for Undo/Redo)
  elmnt.querySelectorAll('.resize-handle, .rotate-handle, .move-handle').forEach(h => h.remove());

  // Sync textarea content for saving
  let ta = elmnt.querySelector('textarea');
  if(ta) {
      ta.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectLayoutElement(elmnt);
      });
      ta.addEventListener('input', function() { this.innerHTML = this.value; });
  }

  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  elmnt.onmousedown = dragMouseDown;
  
  // Right-click Context Menu (Bring Front / Send Back)
  elmnt.oncontextmenu = function(e) {
      e.preventDefault();
      selectLayoutElement(elmnt);
      
      // Remove existing context menu if any
      let oldMenu = document.getElementById('layout-ctx-menu');
      if (oldMenu) oldMenu.remove();

      // Create Menu
      let menu = document.createElement('div');
      menu.id = 'layout-ctx-menu';
      menu.style.position = 'fixed';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.style.background = '#fff';
      menu.style.border = '1px solid #0072BC';
      menu.style.boxShadow = '2px 2px 0 #0072BC';
      menu.style.zIndex = '10000';
      menu.style.display = 'flex';
      menu.style.flexDirection = 'column';
      menu.style.padding = '2px';

      const createItem = (text, action) => {
          let btn = document.createElement('div');
          btn.innerText = text;
          btn.style.padding = '6px 12px';
          btn.style.cursor = 'pointer';
          btn.style.fontFamily = "'KK7VCROSDMono', monospace";
          btn.style.fontSize = '14px';
          btn.style.color = '#000';
          btn.onmouseenter = () => { btn.style.background = '#0072BC'; btn.style.color = '#fff'; };
          btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#000'; };
          btn.onclick = (ev) => {
              ev.stopPropagation();
              action();
              menu.remove();
          };
          return btn;
      };

      menu.appendChild(createItem('Bring to Front', () => {
          if(elmnt.parentNode) elmnt.parentNode.appendChild(elmnt);
      }));
      menu.appendChild(createItem('Send to Back', () => {
          if(elmnt.parentNode) elmnt.parentNode.insertBefore(elmnt, elmnt.parentNode.firstChild);
      }));

      document.body.appendChild(menu);

      // Close on click outside
      const closeMenu = () => {
          if(menu.parentNode) menu.remove();
          window.removeEventListener('click', closeMenu);
      };
      setTimeout(() => window.addEventListener('click', closeMenu), 10);
  };
  
  function dragMouseDown(e) {
    // Don't drag if clicking resize/rotate handles OR typing in textarea
    if(e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return; 
    if(e.target.tagName === 'TEXTAREA') return; // Allow typing/selection
    // Only allow drag if clicking the wrapper background (if any) or the move handle
    
    saveLayoutState(); // Save before move
    // Update Selection
    selectLayoutElement(elmnt);

    e = e || window.event; e.preventDefault();
    
    startX = e.clientX;
    startY = e.clientY;
    startLeft = elmnt.offsetLeft;
    startTop = elmnt.offsetTop;

    document.onmouseup = closeDragElement; document.onmousemove = elementDrag;
  }
  function elementDrag(e) {
    e = e || window.event; e.preventDefault();
    let dx = (e.clientX - startX) / layoutScale;
    let dy = (e.clientY - startY) / layoutScale;
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    if (isSnapToGrid) { newLeft = Math.round(newLeft / snapSize) * snapSize; newTop = Math.round(newTop / snapSize) * snapSize; }
    elmnt.style.left = newLeft + "px";
    elmnt.style.top = newTop + "px";
  }
  function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
  
  // Move Handle (Top Left) - Needed because clicking textarea focuses it
  if (elmnt.querySelector('textarea')) {
      let moveHandle = document.createElement('div');
      moveHandle.className = 'move-handle';
      moveHandle.style.display = 'none';
      moveHandle.title = 'Drag to move';
      elmnt.appendChild(moveHandle);
  }

  // Resize Handle Box (Góc dưới phải)
  let handle = document.createElement('div');
  handle.className = 'resize-handle';
  handle.style.display = 'none'; // Hidden by default
  handle.style.width = '10px'; handle.style.height = '10px';
  handle.style.background = '#fff'; 
  handle.style.border = 'none';
  handle.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
  handle.style.position = 'absolute';
  handle.style.right = '0'; handle.style.bottom = '0';
  handle.style.cursor = 'nwse-resize';
  handle.style.zIndex = '10';
  elmnt.appendChild(handle);

  // Rotate Handle (Top Center - Pink)
  if (elmnt.querySelector('img')) { // Only for images/paper wrappers
      let rotHandle = document.createElement('div');
      rotHandle.className = 'rotate-handle';
      rotHandle.style.display = 'none'; // Hidden by default
      rotHandle.style.width = '10px'; rotHandle.style.height = '10px';
      rotHandle.style.background = '#f75397'; 
      rotHandle.style.border = 'none';
      rotHandle.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
      rotHandle.style.position = 'absolute';
      rotHandle.style.left = '50%'; rotHandle.style.top = '-15px';
      rotHandle.style.transform = 'translateX(-50%)';
      rotHandle.style.cursor = 'grab';
      rotHandle.style.borderRadius = '50%';
      rotHandle.style.zIndex = '10';
      elmnt.appendChild(rotHandle);

      rotHandle.onmousedown = function(e) {
          saveLayoutState(); // Save before rotate
          e.stopPropagation(); e.preventDefault();
          let rect = elmnt.getBoundingClientRect();
          let centerX = rect.left + rect.width/2;
          let centerY = rect.top + rect.height/2;
          document.onmousemove = (e) => {
              let angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
              let deg = angle * (180 / Math.PI) + 90;
              elmnt.style.transform = `rotate(${deg}deg)`;
          };
          document.onmouseup = () => { document.onmousemove = null; document.onmouseup = null; };
      };
  }

  handle.onmousedown = function(e) {
      saveLayoutState(); // Save before resize
      e.stopPropagation(); e.preventDefault();
      
      // Select on resize click too
      selectLayoutElement(elmnt);

      let startX = e.clientX; let startY = e.clientY;
      let startW = parseInt(window.getComputedStyle(elmnt).width, 10);
      let startH = parseInt(window.getComputedStyle(elmnt).height, 10);
      let startFontSize = parseInt(window.getComputedStyle(elmnt).fontSize, 10); // For text scaling
      
      document.onmousemove = (e) => {
          let dx = (e.clientX - startX) / layoutScale;
          let dy = (e.clientY - startY) / layoutScale;
          
          if(elmnt.querySelector('img')) {
             // Scale wrapper (image scales with it)
             let newW = startW + dx;
             let newH = startH + dy;
             if (e.shiftKey) {
                 let ratio = startW / startH;
                 newH = newW / ratio;
             }
             elmnt.style.width = newW + 'px';
             elmnt.style.height = newH + 'px';
          } else if (elmnt.querySelector('textarea')) {
             // Resize text box dimensions
             elmnt.style.width = (startW + dx) + 'px';
             elmnt.style.height = (startH + dy) + 'px';
             // Optional: Scale font size with shift? For now just resize box.
          }
      };
      document.onmouseup = () => { document.onmousemove = null; document.onmouseup = null; };
  };
}

// --- LAYOUT HISTORY & CLIPBOARD FUNCTIONS ---
function saveLayoutState() {
    let holder = select('#layout-canvas-holder');
    if(holder) {
        layoutHistory.push(holder.html());
        if(layoutHistory.length > MAX_LAYOUT_HISTORY) layoutHistory.shift();
        layoutRedoHistory = [];
    }
}

function undoLayout() {
    if (layoutHistory.length > 0) {
        let holder = select('#layout-canvas-holder');
        layoutRedoHistory.push(holder.html());
        let state = layoutHistory.pop();
        restoreLayoutState(state);
    }
}

function redoLayout() {
    if (layoutRedoHistory.length > 0) {
        let holder = select('#layout-canvas-holder');
        layoutHistory.push(holder.html());
        let state = layoutRedoHistory.pop();
        restoreLayoutState(state);
    }
}

function restoreLayoutState(htmlState) {
    let holder = select('#layout-canvas-holder');
    if(!holder) return;
    holder.html(htmlState);
    
    // Remove dead button to ensure listeners are re-attached by recalculateLayoutPositions
    let oldBtn = holder.elt.querySelector('#btn-add-artboard-canvas');
    if(oldBtn) oldBtn.remove();

    // Re-bind interactivity to all children
    let children = holder.elt.children;
    for (let el of children) {
        // FIX: Check for artboard BEFORE making interactive to prevent dragging
        if (el.classList.contains('layout-page-bg')) {
            el.onclick = (e) => {
                e.stopPropagation();
                setActiveArtboard(el);
            };
            continue; // Skip makeElementInteractive for bg
        }
        makeElementInteractive(el);

        let storedBlend = (el.dataset && el.dataset.blendMode) || el.style.mixBlendMode;
        if (storedBlend) {
            applyBlendMode(el, storedBlend);
        }

        // Re-attach hover effects for text elements
        if (!el.querySelector('img') && !el.querySelector('textarea')) {
             el.onmouseover = () => el.style.border = '1px dashed #0072BC';
             el.onmouseout = () => el.style.border = '1px dashed transparent';
        }
    }
    selectedLayoutElement = null;
    
    // Auto-select first artboard
    let firstBg = holder.elt.querySelector('.layout-page-bg');
    if(firstBg) setActiveArtboard(firstBg);
    
    recalculateLayoutPositions();
}

function copyLayoutSelection() {
   if (selectedLayoutElement) {
        layoutClipboard = { type: 'element', html: selectedLayoutElement.outerHTML };
    } else if (activeArtboard) {
        // Copy Artboard Content
        let pageH = 1123;
        let artboardTop = activeArtboard.offsetTop;
        let content = [];

        let holder = select('#layout-canvas-holder');
        let children = holder.elt.children;

        for (let el of children) {
            if (el.classList.contains('layout-page-bg')) continue;

            let elTop = parseInt(el.style.top || 0);
            // Check overlap with active artboard
            if (elTop >= artboardTop && elTop < artboardTop + pageH) {
                content.push({
                    html: el.outerHTML,
                    relY: elTop - artboardTop,
                    relX: parseInt(el.style.left || 0)
                });
            }
        }

        layoutClipboard = {
            type: 'artboard',
            pattern: activeArtboard.getAttribute('data-pattern'),
            content: content
        };
    }
}

function pasteLayoutSelection() {
    if (!layoutClipboard) return;

    if (layoutClipboard.type === 'element') {
        saveLayoutState();
        let holder = select('#layout-canvas-holder');
        let temp = createDiv(layoutClipboard.html);
        let el = temp.elt.firstChild;
        
     // Clean up handles from clipboard content before adding
       let oldHandles = el.querySelectorAll('.resize-handle, .rotate-handle');
       oldHandles.forEach(h => h.remove());

        holder.elt.appendChild(el);
        temp.remove();
        
        // Offset position
        el.style.left = (parseInt(el.style.left||0) + 20) + 'px';
        el.style.top = (parseInt(el.style.top||0) + 20) + 'px';
        el.style.outline = 'none';
        
        makeElementInteractive(el);
       selectLayoutElement(el);
    } else if (layoutClipboard.type === 'artboard') {
        if (!activeArtboard) return;
        
        // Add new artboard after current
        let newBg = addArtboardRelative(activeArtboard);
        
        // Apply Pattern
        let pat = layoutClipboard.pattern;
       newBg.setAttribute('data-pattern', pat);
        let layer = newBg.querySelector('.layout-pattern-layer');
        if(layer) layer.style.backgroundImage = `url('assets/canvas%20template/paper%20pattern%20${pat}.png')`;
        
        // Add Content
        let holder = select('#layout-canvas-holder');
        let newTop = newBg.offsetTop;
        
        layoutClipboard.content.forEach(item => {
            let temp = createDiv(item.html);
            let el = temp.elt.firstChild;
       // Apply Pattern
        let pat = layoutClipboard.pattern;
        newBg.setAttribute('data-pattern', pat);
        let layer = newBg.querySelector('.layout-pattern-layer');
        if(layer) layer.style.backgroundImage = `url('assets/canvas%20template/paper%20pattern%20${pat}.png')`;

            
            // Clean handles
            let handles = el.querySelectorAll('.resize-handle, .rotate-handle, .move-handle');
            handles.forEach(h => h.remove());
            
            // Position relative to new artboard
            el.style.top = (newTop + item.relY) + 'px';
            el.style.left = item.relX + 'px';
            el.style.outline = 'none';
            
            holder.elt.appendChild(el);
            temp.remove();
            
            makeElementInteractive(el);
        });
        
        setActiveArtboard(newBg);
    }
}

function drawUIOverlays() {
  if (selStart) {
      let mx = floor(getCorrectedMouse().x / cellW); let my = floor(getCorrectedMouse().y / cellH);
      let endX = (mouseIsPressed && isShiftSelecting) ? mx : (selEnd ? selEnd.x : mx); 
      let endY = (mouseIsPressed && isShiftSelecting) ? my : (selEnd ? selEnd.y : my);
      let x1 = min(selStart.x, endX), y1 = min(selStart.y, endY), x2 = max(selStart.x, endX), y2 = max(selStart.y, endY);
      noFill(); stroke('#0072BC'); strokeWeight(1);
      drawingContext.setLineDash([5, 5]);
      rect(x1 * cellW, y1 * cellH, (x2 - x1 + 1) * cellW, (y2 - y1 + 1) * cellH);
      drawingContext.setLineDash([]);
  }
}

// --- EXPORT FUNCTIONS ---
function prepareLayoutExport(holder) {
    isLayoutExporting = true;
    let savedTransform = holder.style.transform;
    let savedTransformOrigin = holder.style.transformOrigin;
    holder.style.transform = 'none';
    holder.style.transformOrigin = 'top left';

    let handles = holder.querySelectorAll('.resize-handle, .rotate-handle, .move-handle, .artboard-label, #btn-add-artboard-canvas');
    let handleStates = [];
    handles.forEach(h => {
        handleStates.push({ el: h, display: h.style.display });
        h.style.display = 'none';
    });

    let bgs = holder.querySelectorAll('.layout-page-bg');
    let bgBorders = [];
    let bgZIndexes = [];
    bgs.forEach(bg => {
        bgBorders.push({ el: bg, border: bg.style.border });
        bgZIndexes.push({ el: bg, zIndex: bg.style.zIndex });
        bg.style.border = 'none';
        bg.style.zIndex = '0';
    });

    let outlineStates = [];
    let children = Array.from(holder.children);
    children.forEach(el => {
        if (el.classList.contains('layout-page-bg')) return;
        outlineStates.push({ el: el, outline: el.style.outline });
        el.style.outline = 'none';
    });

    let textareaStates = [];
    let textareas = holder.querySelectorAll('textarea');
    textareas.forEach(ta => {
        let wrapper = ta.parentElement;
        textareaStates.push({
            ta,
            taHeight: ta.style.height,
            taOverflow: ta.style.overflow,
            wrapper,
            wrapperHeight: wrapper ? wrapper.style.height : null,
            wrapperOverflow: wrapper ? wrapper.style.overflow : null
        });

        let scrollH = ta.scrollHeight;
        if (scrollH > ta.clientHeight) {
            ta.style.height = scrollH + 'px';
            ta.style.overflow = 'visible';
            if (wrapper) {
                wrapper.style.height = scrollH + 'px';
                wrapper.style.overflow = 'visible';
            }
        }
    });

    return function restoreLayoutExport() {
        handles.forEach(h => { h.style.display = ''; });
        handleStates.forEach(h => { h.el.style.display = h.display; });
        bgBorders.forEach(bg => { bg.el.style.border = bg.border; });
        bgZIndexes.forEach(bg => { bg.el.style.zIndex = bg.zIndex; });
        outlineStates.forEach(state => { state.el.style.outline = state.outline; });
        textareaStates.forEach(state => {
            state.ta.style.height = state.taHeight;
            state.ta.style.overflow = state.taOverflow;
            if (state.wrapper) {
                state.wrapper.style.height = state.wrapperHeight;
                state.wrapper.style.overflow = state.wrapperOverflow;
            }
        });
        holder.style.transform = savedTransform;
        holder.style.transformOrigin = savedTransformOrigin;
        isLayoutExporting = false;
    };
}

function extractCssUrl(value) {
    if (!value || value === 'none') return '';
    let match = value.match(/url\((['"]?)(.*?)\1\)/i);
    return match ? match[2] : '';
}

function loadImageAsDataUrl(url) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = () => {
            let canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = reject;
        img.src = url;
    });
}

function waitForImage(img) {
    if (img.decode) {
        return img.decode().catch(() => new Promise(resolve => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
        }));
    }
    return new Promise(resolve => {
        if (img.complete) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
    });
}

async function addPatternImagesForExport(holder) {
    let layers = Array.from(holder.querySelectorAll('.layout-pattern-layer'));
    let added = [];

    for (let layer of layers) {
        let bg = layer.style.backgroundImage || window.getComputedStyle(layer).backgroundImage;
        let url = extractCssUrl(bg);
        if (!url) continue;

        let img = document.createElement('img');
        img.setAttribute('data-export-pattern', 'true');
        Object.assign(img.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none'
        });

        let dataUrl = patternDataUrlCache.get(url);
        if (!dataUrl) {
            try {
                dataUrl = await loadImageAsDataUrl(url);
                patternDataUrlCache.set(url, dataUrl);
            } catch (err) {
                dataUrl = '';
            }
        }
        img.src = dataUrl || url;
        layer.appendChild(img);
        await waitForImage(img);
        added.push(img);
    }

    return function restorePatternImages() {
        added.forEach(img => img.remove());
    };
}

async function prepareLayoutExportAsync(holder) {
    let restoreBase = prepareLayoutExport(holder);
    let restorePatterns = await addPatternImagesForExport(holder);
    return function restoreAll() {
        restorePatterns();
        restoreBase();
    };
}

async function captureLayoutCanvas(holder) {
    return htmlToImage.toCanvas(holder, {
        pixelRatio: 2,
        backgroundColor: '#ffffff'
    });
}

function cropCanvasToArtboard(fullCanvas, holder, artboardBg) {
    let scaleX = fullCanvas.width / holder.offsetWidth;
    let scaleY = fullCanvas.height / holder.offsetHeight;
    let x = Math.round(artboardBg.offsetLeft * scaleX);
    let y = Math.round(artboardBg.offsetTop * scaleY);
    let w = Math.round(artboardBg.offsetWidth * scaleX);
    let h = Math.round(artboardBg.offsetHeight * scaleY);
    let canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fullCanvas, x, y, w, h, 0, 0, w, h);
    return canvas;
}

async function exportActiveArtboardPNG() {
    if (!activeArtboard) { alert("Please select an artboard first (click on its background)."); return; }
    if (typeof htmlToImage === 'undefined') { alert("html-to-image library not loaded."); return; }

    let holder = document.getElementById('layout-canvas-holder');
    if (!holder) return;
    let restoreExport = await prepareLayoutExportAsync(holder);
    try {
        let fullCanvas = await captureLayoutCanvas(holder);
        let artCanvas = cropCanvasToArtboard(fullCanvas, holder, activeArtboard);
        let link = document.createElement('a');
        link.download = 'memory-diagram.png';
        link.href = artCanvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Export PNG failed:', error);
    } finally {
        restoreExport();
    }
}

async function exportAllArtboardsPDF() {
    if (typeof window.jspdf === 'undefined') { alert("jspdf library not loaded."); return; }
    if (typeof htmlToImage === 'undefined') { alert("html-to-image library not loaded."); return; }
    const { jsPDF } = window.jspdf;
    
    let holder = document.getElementById('layout-canvas-holder');
    let artboards = holder.querySelectorAll('.layout-page-bg');
    if (artboards.length === 0) return;

    let doc = new jsPDF('p', 'mm', 'a4');
    let restoreExport = await prepareLayoutExportAsync(holder);
    try {
        let fullCanvas = await captureLayoutCanvas(holder);
        for (let i = 0; i < artboards.length; i++) {
            if (i > 0) doc.addPage();
            let artCanvas = cropCanvasToArtboard(fullCanvas, holder, artboards[i]);
            let imgData = artCanvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 0, 0, 210, 297); // A4 dimensions
        }
        doc.save('memory-index.pdf');
    } catch (err) {
        console.error("Export PDF failed:", err);
    } finally {
        restoreExport();
    }
}

// --- GLOBAL: ADD TO LIBRARY ---
window.addToLibrary = async function(p5Img, name, extraData) {
  // Use IndexedDB, so we can store higher resolution images
  // Increase target width significantly or use original if reasonable
  let targetW = 2400; 
  let scaleFactor = targetW / p5Img.width;
  if (scaleFactor > 1) scaleFactor = 1; 
  
  let w = Math.floor(p5Img.width * scaleFactor);
  let h = Math.floor(p5Img.height * scaleFactor);

  let tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  // Hint for performance to suppress warnings if read frequently
  let ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
  
  // Fill white background to ensure transparency renders correctly in JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  
  let src = p5Img.canvas || p5Img.elt || p5Img;
  ctx.drawImage(src, 0, 0, w, h);
  
  let dataURL = tempCanvas.toDataURL('image/jpeg', 0.95); // High quality
  
  let newItem = {
      id: Date.now(),
      dataURL: dataURL,
      name: name,
      extraData: extraData
  };
  
  libraryItems.push(newItem);
  
  try {
      await addItemToDB(newItem);
      createLibraryItemDOM(newItem);
      // Animation feedback on Global Library Button
      let btn = document.getElementById('global-lib-btn');
      if(btn) {
        btn.classList.remove('lib-saved-anim');
        void btn.offsetWidth; // trigger reflow
        btn.classList.add('lib-saved-anim');
      }
      alert("Saved to Memory Archive!");
  } catch(e) {
      // If save failed, remove from memory to keep state consistent
      libraryItems.pop();
      console.error("Failed to add to library:", e);
      alert("Failed to save to library.");
  }
};

function saveLibrary() {
    // Deprecated: We now save per item using addItemToDB
    // Kept empty to prevent errors if called elsewhere
}

async function loadLibrary() {
    try {
        // Load from IndexedDB
        libraryItems = await getAllItemsFromDB();
        
        let libGrid = document.getElementById('lib-grid');
        if(libGrid) libGrid.innerHTML = ''; // Clear existing
        libraryItems.forEach(item => createLibraryItemDOM(item));
        
        // Add Clear Button if not exists
        let panel = document.getElementById('global-lib-panel');
        if (panel && !document.getElementById('btn-clear-lib')) {
            let btn = createButton('CLEAR ALL');
            btn.id('btn-clear-lib');
            btn.class('btn-retro');
            btn.style('width', '100%');
            btn.style('margin-top', '10px');
            btn.style('background-color', '#e74c3c');
            btn.style('color', 'white');
            btn.style('border-color', '#c0392b');
            btn.parent(panel);
            btn.mousePressed(() => {
                if (confirm('Delete all saved memories? This cannot be undone.')) {
                    libraryItems = [];
                    clearDB().then(() => {
                        let libGrid = document.getElementById('lib-grid');
                        if (libGrid) libGrid.innerHTML = '';
                    });
                }
            });
        }
    } catch(e) { console.error("Library load failed", e); }
}

function createLibraryItemDOM(item) {
  let libGrid = document.getElementById('lib-grid');
  if (!libGrid) return;
  
  let div = createDiv(''); div.class('lib-item'); div.parent(libGrid);
  let imgEl = createImg(item.dataURL, item.name || 'Artwork'); imgEl.parent(div);
  
  div.elt.onclick = () => { 
      openLibraryModal(item);
  };
  
  div.elt.oncontextmenu = (e) => {
      e.preventDefault();
      let downloadLink = document.createElement('a');
      downloadLink.href = item.dataURL;
      let fileName = item.name || 'memory_item';
      if (!/\.(jpg|jpeg|png|gif)$/i.test(fileName)) {
          fileName += '.jpg';
      }
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
  };
  
  div.elt.draggable = true;
  div.elt.ondragstart = (e) => { 
      draggedLibItem = item; // Track item being dragged
      e.dataTransfer.setData("text/plain", item.dataURL);
      e.dataTransfer.effectAllowed = "copy";
  };
  div.elt.ondragend = () => { draggedLibItem = null; };
}

function openLibraryModal(item) {
    let modal = document.getElementById('thought-card-modal');
    let modalImg = document.getElementById('thought-card-img');
    let modalHtml = document.getElementById('thought-card-html');
    
    if(modal) {
        if (item.name === "Thought Card" && item.extraData && item.extraData.text) {
            // HTML View for Thought Cards
            if(modalImg) modalImg.style.display = 'none';
            if(modalHtml) {
                modalHtml.style.display = 'block';
                let txtEl = document.getElementById('thought-card-text-content');
                let dateEl = document.getElementById('thought-card-date');
                if(txtEl) txtEl.innerText = item.extraData.text;
                if(dateEl) dateEl.innerText = item.extraData.date || "";
            }
        } else {
            // Image View for everything else
            if(modalHtml) modalHtml.style.display = 'none';
            if(modalImg) {
                modalImg.style.display = 'block';
                modalImg.src = item.dataURL;
            }
        }
        modal.style.display = 'flex';

        // Setup Delete Button Logic
        let btnDelete = document.getElementById('btn-delete-card');
        if (btnDelete) {
            btnDelete.style.display = ''; // Ensure visible for library items
            // Clone button to remove old event listeners from previous opens
            let newBtn = btnDelete.cloneNode(true);
            btnDelete.parentNode.replaceChild(newBtn, btnDelete);
            
            newBtn.onclick = () => {
                if(confirm("Are you sure you want to delete this memory?")) {
                    libraryItems = libraryItems.filter(i => i.id !== item.id);
                    deleteItemFromDB(item.id).then(() => {
                        // Refresh Grid
                        let libGrid = document.getElementById('lib-grid');
                        if(libGrid) libGrid.innerHTML = ''; 
                        libraryItems.forEach(i => createLibraryItemDOM(i));
                        
                        modal.style.display = 'none';
                    });
                }
            };
        }

    }
}

// --- LAYOUT HELPERS ---
function createPageBackground(parent, index, setAsActive = false) {
    let h = 1123; let gap = 20;
    let y = index * (h + gap);
    let bg = createDiv('');
    bg.class('layout-page-bg');
    bg.parent(parent);
    bg.style('position', 'absolute');
    bg.style('left', '0'); bg.style('top', y + 'px');
    bg.style('width', '100%'); bg.style('height', h + 'px');
    bg.style('background-color', 'white');
    bg.style('border', '1px dashed #0072BC'); 
    bg.style('box-sizing', 'border-box');
    bg.style('box-shadow', '0 4px 15px rgba(0,0,0,0.08)');
    bg.style('z-index', '-1'); 
    bg.style('pointer-events', 'none'); 
    bg.style('overflow', 'hidden');

    // Store pattern index in DOM
    bg.attribute('data-pattern', '1');

    // Click handler to select artboard (using pointer-events auto on a wrapper or handling it differently)
    // Since pointer-events is none, we can't click it directly. 
    // We need to enable pointer events for selection but keep it behind elements.
    // Actually, let's make it interactive for selection.
    bg.style('pointer-events', 'auto'); 
    bg.elt.onclick = (e) => {
        e.stopPropagation();
        setActiveArtboard(bg.elt);
        selectLayoutElement(null); // Deselect content when clicking bg
    };
    bg.style('cursor', 'pointer');

    // Pattern Layer (Rotated 90deg)
    let pattern = createDiv('');
    pattern.class('layout-pattern-layer');
    pattern.parent(bg);
    pattern.style('position', 'absolute');
    pattern.style('width', h + 'px'); pattern.style('height', '794px'); // Swapped dimensions for rotation
    pattern.style('left', '50%'); pattern.style('top', '50%');
    pattern.style('transform', 'translate(-50%, -50%) rotate(90deg)');
    pattern.style('background-image', `url('assets/canvas%20template/paper%20pattern%201.png')`);
    pattern.style('background-size', 'cover'); pattern.style('background-position', 'center');

    // Artboard Label
    let label = createDiv(`Artboard ${index + 1}`);
    label.parent(bg);
    label.class('artboard-label');
    label.style('position', 'absolute');
    label.style('top', '-20px'); label.style('left', '-1px');
    label.style('background', '#0072BC'); label.style('color', 'white');
    label.style('font-size', '14px'); label.style('padding', '2px 6px'); label.style('font-weight', 'bold');
    label.style('font-family', "'KK7VCROSDMono', monospace"); label.style('text-transform', 'lowercase'); label.style('pointer-events', 'none');

    if (setAsActive) setActiveArtboard(bg.elt);
}

function addArtboardRelative(targetBgElt) {
    saveLayoutState();
    let holder = select('#layout-canvas-holder');
    
    // 1. Calculate Shift Threshold
    let pageH = 1123; let gap = 20;
    let shiftAmount = pageH + gap;
    let thresholdY = targetBgElt.offsetTop + pageH; 
    
    // 2. Shift Content Elements (push everything down)
    let children = holder.elt.children;
    for (let el of children) {
        if (el.classList.contains('layout-page-bg')) continue;
        if (el.id === 'layout-viewport') continue;
        
        let currentTop = parseInt(el.style.top || 0);
        if (currentTop >= thresholdY - 5) {
            el.style.top = (currentTop + shiftAmount) + 'px';
        }
    }
    
    // 3. Create New Artboard
    let tempContainer = createDiv('');
    createPageBackground(tempContainer, 0, false);
    let newBg = tempContainer.elt.firstChild;
    
    if (targetBgElt.nextSibling) holder.elt.insertBefore(newBg, targetBgElt.nextSibling);
    else holder.elt.appendChild(newBg);
    tempContainer.remove();
    
    // 4. Recalculate Positions
    recalculateLayoutPositions();
    setActiveArtboard(newBg);
    return newBg;
}

function recalculateLayoutPositions() {
    let holder = select('#layout-canvas-holder');
    let bgs = holder.elt.querySelectorAll('.layout-page-bg');
    let pageH = 1123; let gap = 20;
    bgs.forEach((bg, i) => {

        bg.style.top = (i * (pageH + gap)) + 'px';
        let lbl = bg.querySelector('.artboard-label');
        if (lbl) lbl.innerText = `Artboard ${i + 1}`;
    });
    
    let totalH = bgs.length * (pageH + gap);

    // Add "+" Button
    let btn = document.getElementById('btn-add-artboard-canvas');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btn-add-artboard-canvas';
        btn.innerText = '+';
        btn.className = 'btn-retro';
        Object.assign(btn.style, {
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: '100',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            padding: '0'
        });
        btn.setAttribute('data-tooltip', 'Add new Artboard');
        btn.onclick = () => {
             let target = activeArtboard;
              if (!target) {
                  let bgs = document.querySelectorAll('.layout-page-bg');
                  if (bgs.length > 0) target = bgs[bgs.length-1];
              }
              if (target) addArtboardRelative(target);
        };
        holder.elt.appendChild(btn);
    }
    
    btn.style.top = totalH + 'px';
    holder.style('height', (totalH + 80) + 'px');
}

function setActiveArtboard(el) {
    activeArtboard = el;
    // Visual feedback
    document.querySelectorAll('.layout-page-bg').forEach(b => {
        b.style.border = '1px dashed #0072BC';
    });
    if (activeArtboard) {
        activeArtboard.style.border = '2px solid #f75397'; // Pink highlight
    }
}

function changeActiveArtboardPattern(dir) {
    if (!activeArtboard) {
        // Try to select the first one if none selected
        let first = document.querySelector('.layout-page-bg');
        if (first) setActiveArtboard(first);
        else return;
    }
    let current = parseInt(activeArtboard.getAttribute('data-pattern') || 1);
    current += dir;
    if (current < 1) current = MAX_PATTERNS;
    if (current > MAX_PATTERNS) current = 1;
    activeArtboard.setAttribute('data-pattern', current);
    
    // Update visual
    let layer = activeArtboard.querySelector('.layout-pattern-layer');
    if (layer) {
        layer.style.backgroundImage = `url('assets/canvas%20template/paper%20pattern%20${current}.png')`;
    }
}

let draggedLayerId = null;

function updateLayerPanel() {
    const layerList = document.getElementById('layer-list');
    const artboard = document.getElementById('layout-canvas-holder');
    if (!layerList || !artboard) return;

    layerList.innerHTML = ''; // Clear the list

    const children = Array.from(artboard.children);
    
    // Filter valid layers first
    const layers = children.filter(el => !(el.classList.contains('layout-page-bg') || el.id === 'layout-viewport' || !el.style.position));

    // Iterate backwards so the last DOM element (Top Layer) appears first in the list
    for (let i = layers.length - 1; i >= 0; i--) {
        const el = layers[i];
        // Ignore non-layer elements
        if (el.classList.contains('layout-page-bg') || el.id === 'layout-viewport' || !el.style.position) {
            return;
        }
        
        if (!el.id) {
            el.id = 'layer-' + Date.now() + Math.floor(Math.random() * 1000);
        }

        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.draggable = true; // Enable Drag
        
        let typeIcon = '🖼️'; // Image icon
        let typeName = 'Image';
        if (el.querySelector('textarea')) {
            typeIcon = '📄'; // Text icon
            typeName = 'Text Box';
        }
        layerItem.innerHTML = `<span>${typeIcon}</span> ${typeName}`;

        layerItem.dataset.targetId = el.id;
        
        // Selection State
        if (selectedLayoutElement && selectedLayoutElement.id === el.id) {
            layerItem.classList.add('selected');
        }

        layerItem.onclick = () => {
            const targetElement = document.getElementById(layerItem.dataset.targetId);
            if (targetElement) {
                selectLayoutElement(targetElement);
            }
        };

        // Drag Events
        layerItem.addEventListener('dragstart', handleLayerDragStart);
        layerItem.addEventListener('dragover', handleLayerDragOver);
        layerItem.addEventListener('drop', handleLayerDrop);

        // Visibility Toggle
        const visBtn = document.createElement('button');
        visBtn.className = 'layer-toggle-vis';
        
        if (el.classList.contains('hidden-layer')) {
            visBtn.innerHTML = '🙈';
            layerItem.classList.add('hidden');
        } else {
            visBtn.innerHTML = '👁️';
        }

        visBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent layer selection
            const targetEl = document.getElementById(layerItem.dataset.targetId);
            if (targetEl) {
                targetEl.classList.toggle('hidden-layer');
                const isHidden = targetEl.classList.contains('hidden-layer');
                visBtn.innerHTML = isHidden ? '🙈' : '👁️';
                layerItem.classList.toggle('hidden', isHidden);
            }
        };
        layerItem.prepend(visBtn);

        layerList.appendChild(layerItem);
    }
}

function handleLayerDragStart(e) {
    draggedLayerId = this.dataset.targetId;
    e.dataTransfer.effectAllowed = 'move';
    this.style.opacity = '0.5';
}

function handleLayerDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleLayerDrop(e) {
    e.stopPropagation();
    const layerList = document.getElementById('layer-list');
    const draggedItem = layerList.querySelector(`[data-target-id="${draggedLayerId}"]`);
    if (draggedItem) draggedItem.style.opacity = '1';
    
    if (this === draggedItem) return;

    // Determine insert position (before or after based on mouse Y)
    const rect = this.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    
    if (offset > rect.height / 2) {
        this.parentNode.insertBefore(draggedItem, this.nextSibling);
    } else {
        this.parentNode.insertBefore(draggedItem, this);
    }

    // Update DOM order to match new list order
    reorderDOMFromLayerList();
}

function reorderDOMFromLayerList() {
    const layerList = document.getElementById('layer-list');
    const artboard = document.getElementById('layout-canvas-holder');
    // List is Top -> Bottom. DOM should be Bottom -> Top.
    // So we reverse the list items and append them to artboard.
    const items = Array.from(layerList.children).reverse();
    
    items.forEach(item => {
        const el = document.getElementById(item.dataset.targetId);
        if (el) artboard.appendChild(el);
    });
}

// --- LOCAL STORAGE LAYOUT PERSISTENCE ---
let saveLayoutTimeout;
function saveLayoutToLocalStorage(immediate = false) {
    clearTimeout(saveLayoutTimeout);
    const doSave = () => {
        if (isLayoutExporting) return;
        const holder = document.getElementById('layout-canvas-holder');
        if(holder) {
            // Force sync textareas on immediate save (unload) to ensure latest text is captured
            if (immediate) {
                const textareas = holder.querySelectorAll('textarea');
                textareas.forEach(ta => ta.innerHTML = ta.value);
            }

            try {
                localStorage.setItem('mem_idx_layout_content', holder.innerHTML);
            } catch(e) { 
                if (e.name === 'QuotaExceededError') {
                    // Storage full: Log warning but don't crash or spam alerts
                    console.warn("LocalStorage is full. Layout auto-save skipped.");
                    if (!window.hasWarnedQuota) {
                        showToast("Storage Full! Some changes may not save.");
                        window.hasWarnedQuota = true;
                    }
                } else {
                    console.error("Layout save failed", e);
                }
            }
        }
    };

    if (immediate) doSave();
    else saveLayoutTimeout = setTimeout(doSave, 1000); // Debounce 1s
}

function loadLayoutFromLocalStorage() {
    try {
        const content = localStorage.getItem('mem_idx_layout_content');
        if(content && content.trim() !== "") {
            const holder = select('#layout-canvas-holder');
            if(holder) {
                holder.html(content);
                // Re-bind interactivity for all elements
                restoreLayoutState(content); 
                // Update layer panel to reflect loaded content
                updateLayerPanel();
            }
        } else {
            // If no save found, ensure layer panel is built for default content
            updateLayerPanel();
        }
    } catch(e) { 
        console.error("Layout load failed", e); 
        updateLayerPanel();
    }
}

// --- TOAST NOTIFICATION ---
let toastTimeout;
function showToast(msg) {
    const toast = document.getElementById('toast-notification');
    if(!toast) return;
    
    toast.innerText = msg;
    toast.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// --- SAVE / LOAD LAYOUT ---
function handleLayoutLoad(file) {
    if (file.subtype === 'json') {
        let data = file.data;
        // Ensure data is parsed
        if (typeof data === 'string') {
             try { data = JSON.parse(data); } catch(e) { console.error(e); return; }
        }
        
        if (data.html) {
            // Restore Globals
            if (data.snap !== undefined) isSnapToGrid = data.snap;
            
            // Restore Content
            restoreLayoutState(data.html);
            
            // Sync UI (Checkbox, etc)
            setTimeout(() => createLayoutUI(), 10);
        }
    }
}

// --- HELPER: Resize Base64 Image ---
function resizeBase64Img(base64, maxWidth, quality, callback) {
    let img = new Image();
    img.src = base64;
    img.onload = function() {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
            h = Math.floor(h * (maxWidth / w));
            w = maxWidth;
        }
        let canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function() {
        callback(base64); // Fallback to original if load fails
    };
}

// --- HELPER: Create Temp Artboard Container for Export ---
function createTempArtboardContainer(artboardBg) {
    let holder = document.getElementById('layout-canvas-holder');
    let abTop = artboardBg.offsetTop;
    let abLeft = artboardBg.offsetLeft;
    let abW = artboardBg.offsetWidth;
    let abH = artboardBg.offsetHeight;

    // Create container
    let container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = abW + 'px';
    container.style.height = abH + 'px';
    container.style.backgroundColor = 'white'; 
    container.style.overflow = 'hidden'; // Clip content outside artboard
    container.style.zIndex = '-9999'; 
    
    // Clone Background
    let bgClone = artboardBg.cloneNode(true);
    bgClone.style.top = '0px';
    bgClone.style.left = '0px';
    bgClone.style.border = 'none'; 
    bgClone.style.pointerEvents = 'none';
    bgClone.querySelectorAll('.artboard-label').forEach(l => l.remove());
    container.appendChild(bgClone);

    // Clone Content
    let children = holder.children;
    for (let el of children) {
        if (el.classList.contains('layout-page-bg') || el.id === 'layout-viewport' || el.tagName === 'BUTTON' || el.id === 'layout-ui-group') continue;
        
        let elTop = parseInt(el.style.top || 0);
        let elLeft = parseInt(el.style.left || 0);
        let elH = el.offsetHeight;
        
        // Check overlap with artboard
        if (elTop + elH > abTop && elTop < abTop + abH) {
            let clone = el.cloneNode(true);
            clone.style.top = (elTop - abTop) + 'px';
            clone.style.left = (elLeft - abLeft) + 'px';
            clone.style.outline = 'none';
            clone.querySelectorAll('.resize-handle, .rotate-handle, .move-handle').forEach(h => h.remove());
            
            // Fix Textarea values
            let origTa = el.querySelector('textarea');
            let cloneTa = clone.querySelector('textarea');
            if (origTa && cloneTa) {
                cloneTa.value = origTa.value;
                cloneTa.innerHTML = origTa.value; 
                
                // AUTO-EXPAND: Resize text box to fit content for export
                // This prevents text from being cropped if it overflows on screen
                cloneTa.style.height = 'auto';
                cloneTa.style.overflow = 'visible';
                clone.style.height = 'auto';
                if (origTa.scrollHeight > origTa.clientHeight) {
                    cloneTa.style.height = origTa.scrollHeight + 'px';
                    clone.style.height = origTa.scrollHeight + 'px';
                }
            }
            container.appendChild(clone);
        }
    }
    return container;
}
