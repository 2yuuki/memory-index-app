// sketch.js - FULL FEATURED + LAYOUT MODE + HOTKEYS FIXED

// --- GLOBALS FOR APP INTEGRATION ---
var activeTab = 'tab-input';

// --- CONFIG ---
let cols, rows;
let cellW = 9;  
let cellH = 14; 
let canvasW = 1600;
let canvasH = 2400;
let textStrokeWeight = 0; 
let inkColorHex = "#000000"; 

// --- DATA & BUFFERS ---
let grid = [];      
let colorGrid = []; 
let pgColorLayer;   
let pgTextLayer;    
let pgGridLayer; 
let templateImg;    

// --- STATE ---
let mainMode = "ASCII"; 
let toolMode = "DRAW";    
let selectedChar = "SMART"; 
let isEraser = false;
let selectedColor = "#FFFF00"; 
let isColorEraser = false;
let isShiftSelecting = false; 
let showTemplateImg = true;
let activePattern = null;

// --- MOUSE OPTIMIZATION ---
let prevGridX = -1, prevGridY = -1;

// --- SLIDERS ---
let bgScale = 1.0, bgX = 0, bgY = 0, bgRotate = 0; 
let sliderScale, sliderX, sliderY, sliderRotate, sliderOpacity;   
let userFontSize = 12, userOffX = 0, userOffY = 0;

// --- HISTORY & CLIPBOARD (SKETCH) ---
let history = [];
let redoHistory = []; // Add redo for sketch if needed later
const MAX_HISTORY = 50; 
let selStart = null, selEnd = null;
let clipboard = null;

// --- LAYOUT HISTORY & CLIPBOARD (TAB 3) ---
let layoutHistory = [];
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

// --- UI REFS ---
let sidebarDiv;
let mainCanvas; 

// --- PALETTE DATA ---
let blockChars = ["█", "▓", "▒", "░", "■", "□", "▌", "▐", "▀", "▄"];
let palette = [
  "SMART", "|", "-", "/", "\\", "_",
  "┌", "┐", "└", "┘", "─", "│", "┼", "┴", "┬", "┤", "├",
  "╔", "╗", "╚", "╝", "═", "║", "╬", "╩", "╦", "╣", "╠",
  "█", "▓", "▒", "░", "▀", "▄", "▌", "▐", "■", "□", 
  "●", "○", "◆", "◇", "▲", "▼", "◄", "►", 
  "(", ")", "[", "]", "{", "}", "<", ">",
    "o", "*", "+", "x", ".", ",", ":", ";", "'", "`", "^", "~", "=",
    "▚", "▞", "▦", "▩", "▤", "▥", "▧", "▨", "▩", "▪", "▫", "▬", "▭", "▮", "▯"
];
let colorPalette = [
  "#FFFF00", "#00FFFF", "#FF00FF", "#00FF00", 
  "#FF0000", "#0000FF", "#FFA500", "#800080",
  "#008000", "#808000", "#000080", "#808000",
  "#C0C0C0", "#808080", "#FFFFFF", "#000000"
];
let bitmapPatterns = [
  {
    name: "Mac Weave", w: 8, h: 8,
    data: [
      1, 1, 0, 1, 1, 1, 0, 1,
      1, 1, 1, 1, 1, 1, 1, 1,
      0, 1, 1, 1, 0, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 0, 1, 1, 1, 0, 1,
      1, 1, 1, 1, 1, 1, 1, 1,
      0, 1, 1, 1, 0, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1
    ]
  }
];

// --- CORE: TAB SWITCHING ---
window.switchTab = function(tabId) {
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
  } else {
    cnv.style.display = 'none';
  }
}

// --- SETUP ---
function setup() {
  frameRate(60); 
  pixelDensity(1); 
  templateImg = createImage(100, 100);
  
  mainCanvas = createCanvas(canvasW, canvasH);
  mainCanvas.id('myCanvas');
  mainCanvas.parent('sketch-canvas-holder'); 
  
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

  sidebarDiv = select('#tab-sketch .panel-left');
  if (!sidebarDiv) {
      let btn = select('#btnPencil');
      if (btn) {
          let p = btn.parent();
          if (p.classList.contains('tools-grid')) sidebarDiv = new p5.Element(p.parentNode);
          else sidebarDiv = new p5.Element(p);
      }
  } 
  
  cols = floor(width / cellW);
  rows = floor(height / cellH);
  
  // 1. Buffers
  pgColorLayer = createGraphics(width, height);
  pgColorLayer.pixelDensity(1);
  pgColorLayer.noStroke();

  pgTextLayer = createGraphics(width, height);
  pgTextLayer.pixelDensity(1);
  pgTextLayer.textFont("'HP001', monospace"); 
  pgTextLayer.textAlign(CENTER, CENTER);
  
  // 2. Pre-render Grid
  pgGridLayer = createGraphics(width, height);
  pgGridLayer.pixelDensity(1);
  preRenderGrid(pgGridLayer); 
  
  resetAllGrids();
  saveState(); 

  // Init UI
  if (sidebarDiv) createAlignControls();
  createUI();
  setupSketchZoomUI();
  updateLayerTextVisuals(); 
  
  // SETUP LAYOUT TAB
  setupLayoutTab(); 
  

  window.switchTab('tab-input');

  // --- GLOBAL KEYBOARD LISTENER FOR LAYOUT (TAB 3) ---
  document.addEventListener('keydown', (e) => {
      // Chỉ hoạt động khi đang ở Tab 3 (Index/Layout)
      if (activeTab !== 'tab-index') return;

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
      }
  });
}

// --- DRAW LOOP ---
function draw() {
  if (activeTab !== 'tab-sketch') return;

  let m = getCorrectedMouse();
  if (m.x > 0 && m.x < width && m.y > 0 && m.y < height) {
    if (mainMode === "COLOR") cursor(HAND); else cursor(CROSS);
  } else {
    cursor(ARROW);
  }

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
  drawStatusPanel();
}

// --- RENDER HELPERS ---
function preRenderGrid(pg) {
  pg.background(255); 
  pg.strokeWeight(0.5); pg.stroke(230); 
  for (let i = 0; i <= cols; i++) { let x = i * cellW; pg.line(x, 0, x, height); }
  for (let j = 0; j <= rows; j++) { let y = j * cellH; pg.line(0, y, width, y); }
}

function drawSingleCellText(x, y) {
  let cx = x * cellW; let cy = y * cellH;
  pgTextLayer.erase(); pgTextLayer.rect(cx, cy, cellW, cellH); pgTextLayer.noErase();
  
  let char = grid[y][x];
  if (char !== "") {
      let purpleColor = color(inkColorHex);
      let bgColor = colorGrid[y][x];
      let displayColor = (bgColor && isColorDark(bgColor)) ? color(255) : purpleColor;
      let posX = cx + cellW/2 + userOffX; let posY = cy + cellH/2 + userOffY;

      if (blockChars.includes(char)) {
          pgTextLayer.noStroke(); pgTextLayer.fill(displayColor); pgTextLayer.text(char, posX, posY);
      } else {
          pgTextLayer.noStroke(); pgTextLayer.fill(displayColor); pgTextLayer.text(char, posX, posY);
      }
  }
}

function updateLayerTextVisuals() {
  pgTextLayer.clear();
  pgTextLayer.textSize(userFontSize);
  let purpleColor = color(inkColorHex);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let char = grid[y][x];
      if (char !== "") {
          let cx = x * cellW; let cy = y * cellH;
          let bgColor = colorGrid[y][x];
          let displayColor = (bgColor && isColorDark(bgColor)) ? color(255) : purpleColor;
          let posX = cx + cellW/2 + userOffX; let posY = cy + cellH/2 + userOffY;
          if (blockChars.includes(char)) {
              pgTextLayer.noStroke(); pgTextLayer.fill(displayColor); pgTextLayer.text(char, posX, posY);
          } else {
              pgTextLayer.noStroke(); pgTextLayer.fill(displayColor); pgTextLayer.text(char, posX, posY);
          }
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
  prevGridX = -1; prevGridY = -1;
  let m = getCorrectedMouse();
  if (m.x < 0 || m.x > width || m.y < 0 || m.y > height) return;
  
  let mx = floor(constrain(m.x, 0, width-1) / cellW);
  let my = floor(constrain(m.y, 0, height-1) / cellH);

  if (keyIsDown(SHIFT)) { toolMode = "SELECT"; selStart = {x: mx, y: my}; selEnd = {x: mx, y: my}; isShiftSelecting = true; return; }
  if (toolMode === "PASTE" && clipboard) { pasteClipboard(mx, my); saveState(); return; }
  if (toolMode === "SELECT" && !isShiftSelecting) { selStart = {x: mx, y: my}; selEnd = {x: mx, y: my}; }

  handleInput(mx, my);
}

function mouseDragged() {
  if (activeTab !== 'tab-sketch') return;
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

  // Pattern Mask Check
  if (activePattern && toolMode === "DRAW" && !isEraser) {
      let px = x % activePattern.w;
      let py = y % activePattern.h;
      let idx = py * activePattern.w + px;
      if (activePattern.data[idx] === 0) return; // Skip if pattern bit is 0
  }

  if (mainMode === "ASCII") {
    if (toolMode === "FILL") {
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
      drawSingleCellText(x, y);
    }
  } else if (mainMode === "COLOR") {
    if (toolMode === "FILL") {
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
  let target = grid[y][x]; if (target === newChar) return;
  let stack = [[x, y]];
  while(stack.length > 0) {
    let [cx, cy] = stack.pop();
    if (grid[cy][cx] !== target) continue;
    let lx = cx; while (lx > 0 && grid[cy][lx - 1] === target) lx--;
    let rx = cx; while (rx < cols - 1 && grid[cy][rx + 1] === target) rx++;
    for (let i = lx; i <= rx; i++) grid[cy][i] = newChar;
    if (cy > 0) scanLineAscii(lx, rx, cy - 1, target, stack);
    if (cy < rows - 1) scanLineAscii(lx, rx, cy + 1, target, stack);
  }
  updateLayerTextVisuals(); saveState();
}
function scanLineAscii(lx, rx, y, target, stack) {
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
    let lx = cx; while (lx > 0 && colorGrid[cy][lx - 1] === target) lx--;
    let rx = cx; while (rx < cols - 1 && colorGrid[cy][rx + 1] === target) rx++;
    for (let i = lx; i <= rx; i++) colorGrid[cy][i] = newColor;
    if (cy > 0) scanLineColor(lx, rx, cy - 1, target, stack);
    if (cy < rows - 1) scanLineColor(lx, rx, cy + 1, target, stack);
  }
  updateLayerColorVisuals(); saveState();
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
  grid = []; colorGrid = [];
  for (let y = 0; y < rows; y++) {
    let r1 = []; let r2 = [];
    for(let x=0; x<cols; x++) { r1.push(""); r2.push(null); }
    grid.push(r1); colorGrid.push(r2);
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
  let t = grid.map(r => [...r]); let c = colorGrid.map(r => [...r]);
  history.push({ text: t, color: c }); if (history.length > MAX_HISTORY) history.shift();
}
function undo() {
  if (history.length > 1) {
    history.pop(); let s = history[history.length - 1];
    grid = s.text.map(r => [...r]); colorGrid = s.color.map(r => [...r]);
    updateLayerColorVisuals(); updateLayerTextVisuals();
  }
}
function copySelection() {
  if(!selStart || !selEnd) return;
  let x1 = min(selStart.x, selEnd.x); let y1 = min(selStart.y, selEnd.y);
  let x2 = max(selStart.x, selEnd.x); let y2 = max(selStart.y, selEnd.y);
  let ct = [], cc = [];
  for (let y = y1; y <= y2; y++) {
    let rt = [], rc = [];
    for (let x = x1; x <= x2; x++) { rt.push(grid[y][x]); rc.push(colorGrid[y][x]); }
    ct.push(rt); cc.push(rc);
  }
  clipboard = { text: ct, color: cc };
  let btn = select('#btnCopy'); if(btn) { btn.style('background', '#69f0ae'); setTimeout(()=>btn.style('background','#fff'),300); }
}
function cutSelection() {
  copySelection();
  let x1 = min(selStart.x, selEnd.x); let y1 = min(selStart.y, selEnd.y);
  let x2 = max(selStart.x, selEnd.x); let y2 = max(selStart.y, selEnd.y);
  for (let y = y1; y <= y2; y++) { for (let x = x1; x <= x2; x++) { grid[y][x] = ""; setGridColor(x, y, null); } }
  updateLayerTextVisuals(); saveState(); toolMode="DRAW"; selStart=null;
}
function pasteClipboard(sx, sy) {
  if (!clipboard) return;
  let cr = clipboard.text.length; let cc = clipboard.text[0].length;
  for(let r = 0; r < cr; r++) {
    for(let c = 0; c < cc; c++) {
      let char = clipboard.text[r][c]; let col = clipboard.color[r][c];
      let tx = sx + c; let ty = sy + r;
      if (isValidCell(tx, ty)) { if (char !== "") grid[ty][tx] = char; setGridColor(tx, ty, col); }
    }
  }
  updateLayerTextVisuals(); saveState();
}
function keyPressed() {
  if (activeTab !== 'tab-sketch') return;
  let isCtrl = keyIsDown(CONTROL) || keyIsDown(91) || keyIsDown(224);
  if (isCtrl) {
    if (key === 'z' || key === 'Z') { undo(); return false; }
    if (key === 'c' || key === 'C') { copySelection(); return false; }
    if (key === 'x' || key === 'X') { cutSelection(); return false; }
    if (key === 'v' || key === 'V') { let m = getCorrectedMouse(); pasteClipboard(floor(m.x/cellW), floor(m.y/cellH)); return false; }
  }
  if (keyCode === ESCAPE) { toolMode = "DRAW"; selStart = null; isShiftSelecting = false; }
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
  if (btnPencil && btnEraser && btnFill && btnClear) {
      let sidebarNode = btnPencil.parent();
      if (sidebarNode && !sidebarNode.classList.contains('tools-grid')) {
          let toolsGroup = createDiv(''); toolsGroup.addClass('tools-grid'); sidebarNode.insertBefore(toolsGroup.elt, btnPencil.elt);
          btnPencil.parent(toolsGroup); btnEraser.parent(toolsGroup); btnFill.parent(toolsGroup); btnClear.parent(toolsGroup);
      }
  }
  if(btnPencil) btnPencil.mousePressed(() => { toolMode = "DRAW"; isEraser = false; mainMode = "ASCII"; });
  if(btnEraser) btnEraser.mousePressed(() => { toolMode = "DRAW"; isEraser = true; });
  if(btnFill) btnFill.mousePressed(() => { toolMode = "FILL"; });
  if(btnClear) btnClear.mousePressed(() => { resetAllGrids(); saveState(); });

  let divAscii = select('#sketch-palette');
  if (!divAscii && sidebarDiv) { createDiv('2. Patterns').parent(sidebarDiv).class('section-title').style('font-weight','700').style('font-size','16px'); divAscii = createDiv('').parent(sidebarDiv).id('sketch-palette').class('palette-grid'); }
  if(divAscii) {
    divAscii.html('');
    palette.forEach(item => {
      let btn = createButton(item).parent(divAscii);
      if (item === "SMART") btn.style('grid-column', 'span 2'); 
      btn.mousePressed(() => {
        selectedChar = item; isEraser = false; if (toolMode !== "FILL") toolMode = "DRAW"; mainMode = "ASCII";
        divAscii.elt.querySelectorAll('button').forEach(b => b.style.background = ''); btn.elt.style.background = '#ddd';
      });
    });
  }
  

  let divColor = select('#sketch-colors');
  if (!divColor && sidebarDiv) { createDiv('4. Ink Color').parent(sidebarDiv).class('section-title').style('font-weight','700').style('font-size','16px'); divColor = createDiv('').parent(sidebarDiv).id('sketch-colors').class('palette-grid palette-ink'); }
  if(divColor) {
    divColor.html('');
    colorPalette.forEach(col => {
      let btn = createButton('').parent(divColor).style('width', '100%').style('height', '28px').style('background', col);
      btn.mousePressed(() => { selectedColor = col; isColorEraser = false; if (toolMode !== "FILL") toolMode = "DRAW"; mainMode = "COLOR"; });
    });
  }

  let exportGroup = select('#export-group');
  if (!exportGroup && sidebarDiv) {
      createDiv('Files').parent(sidebarDiv).class('section-title').style('font-weight','700').style('font-size','16px'); exportGroup = createDiv('').parent(sidebarDiv).id('export-group');
      exportGroup.style('display','flex').style('flex-direction','column').style('gap','8px');
      let btnPng = createButton('EXPORT PNG (NO GRID)').parent(exportGroup).class('btn-retro'); btnPng.mousePressed(saveArtworkPNG);
      let btnTxt = createButton('EXPORT TXT').parent(exportGroup).class('btn-retro'); btnTxt.mousePressed(saveArtworkTXT);
      let btnSvg = createButton('EXPORT SVG').parent(exportGroup).class('btn-retro'); btnSvg.mousePressed(exportSVG);
      let importWrapper = createDiv('').parent(exportGroup).style('position','relative');
      createButton('IMPORT SVG (EDIT)').parent(importWrapper).class('btn-retro');
      let fileInp = createFileInput(handleSVGImport).parent(importWrapper); fileInp.style('position','absolute').style('top','0').style('left','0').style('opacity','0').style('width','100%').style('height','100%').style('cursor','pointer');
      createDiv('').parent(exportGroup).class('divider');
      let btnLib = createButton('ADD TO LIBRARY').parent(exportGroup).class('btn-retro');
      btnLib.mousePressed(() => {
          let name = select('#sSketchName') ? select('#sSketchName').value() : "Sketch";
          let pg = createGraphics(canvasW, canvasH); pg.pixelDensity(1); pg.background(255);
          pg.image(pgColorLayer, 0, 0); pg.image(pgTextLayer, 0, 0);
          if(window.addToLibrary) { window.addToLibrary(pg, name); alert(`Saved "${name}" to Library!`); } pg.remove();
      });
  }
}

// --- IO FUNCTIONS ---
function handleFile(file) { if (file.type === 'image') loadImage(file.data, handleImageLoad); }
function handleImageLoad(img) { templateImg = img; showTemplateImg = true; if(sliderScale) sliderScale.value(1.0); if(sliderX) sliderX.value(canvasW/2); }
function saveArtworkPNG() { let pg = createGraphics(canvasW, canvasH); pg.pixelDensity(1); pg.background(255); pg.image(pgColorLayer, 0, 0); pg.image(pgTextLayer, 0, 0); save(pg, 'artwork.png'); pg.remove(); }
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
  let svg = `<?xml version="1.0" standalone="no"?><svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>`;
  for(let y=0; y<rows; y++) for(let x=0; x<cols; x++) if(colorGrid[y][x]) svg += `<rect x="${x*cellW}" y="${y*cellH}" width="${cellW}" height="${cellH}" fill="${colorGrid[y][x]}" stroke="none"/>`;
  for(let y=0; y<rows; y++) for(let x=0; x<cols; x++) {
      let char = grid[y][x]; if(char !== "") { let fill = (colorGrid[y][x] && isColorDark(colorGrid[y][x])) ? "#FFF" : inkColorHex; let safe = char.replace(/&/g, '&amp;').replace(/</g, '&lt;'); svg += `<text x="${x*cellW+cellW/2+userOffX}" y="${y*cellH+cellH/2+userOffY}" font-family="monospace" font-size="${userFontSize}" text-anchor="middle" dominant-baseline="middle" fill="${fill}">${safe}</text>`; }
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
}

function setupSketchZoomUI() {
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
      viewport.style('overflow', 'auto').style('background', 'transparent');
      viewport.style('display', 'flex').style('justify-content', 'center');
      viewport.style('padding', '40px').style('box-sizing', 'border-box');
  }

  layoutDiv.style('position', 'relative'); layoutDiv.style('overflow', 'hidden');
  layoutDiv.style('width', '794px'); layoutDiv.style('height', '1123px'); // A4 Size
  layoutDiv.style('background', 'transparent'); layoutDiv.style('box-shadow', 'none');
  layoutDiv.style('flex-shrink', '0'); layoutDiv.style('transform-origin', 'top center');
  layoutDiv.style('transition', 'transform 0.2s ease');
  
  if (layoutDiv.elt.querySelectorAll('.layout-page-bg').length === 0) createPageBackground(layoutDiv, 0, true);

  layoutDiv.elt.addEventListener('dragover', (e) => e.preventDefault());
  layoutDiv.elt.addEventListener('drop', (e) => {
    e.preventDefault();
    let data = e.dataTransfer.getData("text/plain");
    if (data && data.startsWith("data:image")) {
       saveLayoutState(); // Save before drop
       let wrapper = createDiv(''); wrapper.parent(layoutDiv);
       wrapper.style('position', 'absolute'); wrapper.style('width', '150px'); wrapper.style('cursor', 'move');
       
       let rect = layoutDiv.elt.getBoundingClientRect();
       wrapper.style('left', ((e.clientX - rect.left) / layoutScale - 75) + 'px');
       wrapper.style('top', ((e.clientY - rect.top) / layoutScale - 75) + 'px');

       let img = createImg(data, ''); img.parent(wrapper);
       img.style('width', '100%'); img.style('height', '100%');
       img.style('display', 'block'); img.style('pointer-events', 'none');
       
       makeElementInteractive(wrapper.elt);
       selectLayoutElement(wrapper.elt);
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
  let sbEl = document.querySelector('#tab-index .panel-left');
  if (sbEl) layoutSidebarRef = new p5.Element(sbEl);

  // Create persistent file input for loading (prevents UI destruction issues)
  if (layoutSidebarRef && !select('#layout-load-input')) {
      let fi = createFileInput(handleLayoutLoad).id('layout-load-input');
      fi.style('display', 'none');
      layoutSidebarRef.child(fi);
  }

  createLayoutUI();
}

function createLayoutUI() {
    // Ensure sidebar is available
    if (!layoutSidebarRef) {
        let sbEl = document.querySelector('#tab-index .panel-left');
        if (sbEl) layoutSidebarRef = new p5.Element(sbEl);
    }
    if (!layoutSidebarRef) return;
    
    // Remove existing group using native DOM to be safe
    let existing = document.getElementById('layout-ui-group');
    if (existing) existing.remove();

    let group = createDiv('').id('layout-ui-group');
    layoutSidebarRef.child(group);
    
    // 1. Paper Patterns (Interactive Images)
    createDiv('Paper Pattern').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let patRow = createDiv('').parent(group).class('mini-row').style('justify-content', 'center').style('gap', '10px');
    
    let btnPrev = createButton('<-').parent(patRow).class('btn-retro').style('width','40px');
    let btnNext = createButton('->').parent(patRow).class('btn-retro').style('width','40px');

    btnPrev.mousePressed(() => {
        changeActiveArtboardPattern(-1);
    });

    btnNext.mousePressed(() => {
        changeActiveArtboardPattern(1);
    });

    // 2. Add Text Tool
    createDiv('Text Tool').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let txtRow = createDiv('').parent(group).class('mini-row');
    
    let btnDrawText = createButton('Draw Text Box').id('btn-draw-text').parent(txtRow).class('btn-retro');
    btnDrawText.mousePressed(() => {
        layoutTool = 'TEXT_BOX';
        document.body.style.cursor = 'crosshair';
        btnDrawText.style('background', '#faec21'); // Active highlight
    });
    
    // Text Alignment
    let alignRow = createDiv('').parent(group).class('mini-row').style('margin-top','6px').style('gap','4px');
    let btnLeft = createButton('Left').parent(alignRow).class('btn-retro').style('flex','1');
    let btnCenter = createButton('Center').parent(alignRow).class('btn-retro').style('flex','1');
    let btnRight = createButton('Right').parent(alignRow).class('btn-retro').style('flex','1');

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
    createSpan('Size:').parent(styleRow).style('font-size','14px');
    let sizeSlider = createSlider(10, 100, 24).id('text-size-slider').parent(styleRow).style('width','60px');
    let colorPicker = createColorPicker('#000000').id('text-color-picker').parent(styleRow).style('width','30px').style('height','30px').style('border','none').style('box-shadow','0 2px 5px rgba(0,0,0,0.1)');

    sizeSlider.input(() => {
        if(selectedLayoutElement) {
            let ta = selectedLayoutElement.querySelector('textarea');
            if(ta) {
                ta.style.fontSize = sizeSlider.value() + 'px';
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

    // 4. Canvas Controls (Add Artboard)
    createDiv('Canvas').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let canvasRow = createDiv('').parent(group).class('mini-row');
    let btnAddPage = createButton('Add Artboard').parent(canvasRow).class('btn-retro').style('width', '100%');
    btnAddPage.mousePressed(() => {
        let holder = select('#layout-canvas-holder');
        let pages = holder.elt.querySelectorAll('.layout-page-bg').length;
        createPageBackground(holder, pages);
        let newH = (pages + 1) * (1123 + 20); 
        holder.style('height', newH + 'px');
    });

    // 4. Settings (Snap)
    createDiv('Settings').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let settingRow = createDiv('').parent(group).class('mini-row');
    let chkSnap = createCheckbox('Snap to Grid', isSnapToGrid).parent(settingRow);
    chkSnap.style('font-family', 'monospace').style('font-size', '14px');
    chkSnap.changed(() => { isSnapToGrid = chkSnap.checked(); });

    // 5. Project (Save/Load)
    createDiv('Project').parent(group).class('section-title').style('font-weight','700').style('font-size','16px');
    let projRow = createDiv('').parent(group).class('mini-row');
    let btnSave = createButton('Save Layout').parent(projRow).class('btn-retro');
    let btnLoad = createButton('Load Layout').parent(projRow).class('btn-retro');
    btnSave.mousePressed(saveLayoutProject);
    btnLoad.mousePressed(() => {
        let fi = select('#layout-load-input');
        if(fi) fi.elt.click();
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

    // Create Wrapper
    let wrapper = createDiv('');
    wrapper.parent(holder);
    wrapper.style('position', 'absolute').style('left', l).style('top', t);
    wrapper.style('width', w).style('height', h);
    wrapper.style('border', 'none');
    
    // Create Textarea
    let ta = createElement('textarea', '');
    ta.parent(wrapper);
    ta.style('width', '100%').style('height', '100%');
    ta.style('background', 'transparent').style('border', 'none').style('resize', 'none');
    ta.style('font-family', "'FT88-School', monospace").style('font-size', '24px');
    ta.style('outline', 'none').style('overflow', 'hidden');

    makeElementInteractive(wrapper.elt);
    selectLayoutElement(wrapper.elt);
    ta.elt.focus();
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
            let slider = select('#text-size-slider');
            if(slider) {
                let fs = parseInt(window.getComputedStyle(ta).fontSize);
                if(!isNaN(fs)) slider.value(fs);
            }
            let picker = select('#text-color-picker');
            if(picker) {
                let col = color(window.getComputedStyle(ta).color);
                picker.value(col.toString('#rrggbb'));
            }
        }
    }
}

// Helper: Kéo thả + Resize Handle
function makeElementInteractive(elmnt) {
  // Remove existing handles to prevent duplicates (crucial for Undo/Redo)
  elmnt.querySelectorAll('.resize-handle, .rotate-handle, .move-handle').forEach(h => h.remove());

  // Sync textarea content for saving
  let ta = elmnt.querySelector('textarea');
  if(ta) {
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
          btn.style.fontFamily = "'HP001', monospace";
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
        if(layoutHistory.length > 50) layoutHistory.shift();
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
    // Re-bind interactivity to all children
    let children = holder.elt.children;
    for (let el of children) {
        makeElementInteractive(el);
        
        // Re-attach artboard logic
        if (el.classList.contains('layout-page-bg')) {
            el.onclick = (e) => {
                e.stopPropagation();
                setActiveArtboard(el);
            };
            continue; // Skip makeElementInteractive for bg
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
}

function copyLayoutSelection() {
    if (selectedLayoutElement) {
        layoutClipboard = selectedLayoutElement.outerHTML;
    }
}

function pasteLayoutSelection() {
    if (layoutClipboard) {
        saveLayoutState();
        let holder = select('#layout-canvas-holder');
        let temp = createDiv(layoutClipboard);
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

function drawStatusPanel() {
    fill(50); noStroke(); textAlign(RIGHT, BOTTOM); textSize(13);
    text(`MODE: ${mainMode} | TOOL: ${toolMode}`, width - 20, height - 20); textAlign(CENTER, CENTER);
}

// --- GLOBAL: ADD TO LIBRARY ---
window.addToLibrary = function(p5Img, name) {
  let libGrid = document.getElementById('lib-grid');
  if (!libGrid) return;
  p5Img.loadPixels();
  let dataURL = p5Img.canvas.toDataURL();
  let item = createDiv(''); item.class('lib-item'); item.parent(libGrid);
  let imgEl = createImg(dataURL, name || 'Artwork'); imgEl.parent(item);
  item.mousePressed(() => { if (activeTab === 'tab-sketch') loadImage(dataURL, handleImageLoad); });
  item.elt.draggable = true;
  item.elt.ondragstart = (e) => { e.dataTransfer.setData("text/plain", dataURL); };
};

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
    bg.style('border', 'none'); 
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
    };

    // Pattern Layer (Rotated 90deg)
    let pattern = createDiv('');
    pattern.class('layout-pattern-layer');
    pattern.parent(bg);
    pattern.style('position', 'absolute');
    pattern.style('width', h + 'px'); pattern.style('height', '794px'); // Swapped dimensions for rotation
    pattern.style('left', '50%'); pattern.style('top', '50%');
    pattern.style('transform', 'translate(-50%, -50%) rotate(90deg)');
    pattern.style('background-image', `url('assets/canvas template/paper pattern 1.png')`);
    pattern.style('background-size', 'cover'); pattern.style('background-position', 'center');

    // Artboard Label
    let label = createDiv(`Artboard ${index + 1}`);
    label.parent(bg);
    label.style('position', 'absolute');
    label.style('top', '-20px'); label.style('left', '-1px');
    label.style('background', '#0072BC'); label.style('color', 'white');
    label.style('font-size', '14px'); label.style('padding', '2px 6px'); label.style('font-weight', 'bold');
    label.style('font-family', "'HP001', monospace"); label.style('text-transform', 'lowercase'); label.style('pointer-events', 'none');

    if (setAsActive) setActiveArtboard(bg.elt);
}

function setActiveArtboard(el) {
    activeArtboard = el;
    // Visual feedback
    document.querySelectorAll('.layout-page-bg').forEach(b => {
        b.style.borderColor = '#0072BC';
        b.style.borderWidth = '1px';
    });
    if (activeArtboard) {
        activeArtboard.style.borderColor = '#f75397'; // Pink highlight
        activeArtboard.style.borderWidth = '2px';
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
        layer.style.backgroundImage = `url('assets/canvas template/paper pattern ${current}.png')`;
    }
}

// --- SAVE / LOAD LAYOUT ---
function saveLayoutProject() {
    let holder = select('#layout-canvas-holder');
    if (!holder) return;
    
    // Deselect before saving to avoid saving selection UI
    if (selectedLayoutElement) {
        selectedLayoutElement.style.outline = 'none';
        let handles = selectedLayoutElement.querySelectorAll('.resize-handle, .rotate-handle');
        handles.forEach(h => h.style.display = 'none');
        selectedLayoutElement = null;
    }

    let projectData = {
        html: holder.html(),
        snap: isSnapToGrid
    };
    
    saveJSON(projectData, 'layout-project.json');
}

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