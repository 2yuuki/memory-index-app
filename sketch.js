/**
 * The Memory Index
 * Copyright (C) 2025 Nguyen Thu Trang (s3926717)
 * * Author: Nguyen Thu Trang (s3926717)
 * Contact: yuuki24.work@gmail.com, @yuuwouldnever on Instagram
 * This is the final results for my Major Project COMM2754, Semester C 2025 at RMIT University
 * School of Communication and Design, RMIT University Vietnam
 * * This program is free software: you can redistribute it and/or modify with attribution to the original author and a link to the project repository.
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

// --- GLOBALS FOR APP INTEGRATION ---
var activeTab = 'tab-thoughts';

// --- CONFIG ---
let cols, rows;
let cellW = 9;  
let cellH = 14; 
let canvasW = 2400;
let canvasH = 3200; 
let inkColorHex = "#000000"; 
const workCols = 80; 
const workRows = 80;

// --- SHAPE FILL CONFIG ---
let shapeFillMode = 'Solid'; 
let shapeFillChar = '.';

function preload() {} 

// --- EXPORT OPTIONS ---
let exportTransparent = false; 

// --- DATA & BUFFERS ---
let grid = [];      
let colorGrid = []; 
let textColorGrid = []; 
let pgColorLayer;   
let pgTextLayer;    
let pgGridLayer; 
let templateImg;    
let libraryItems = []; 

// --- LAYERS (ASCII) ---
let asciiLayers = [];
let activeLayerIndex = 0;
let draggedLibItem = null; 

// VIEWPORT / RULER / SHADOWS
let viewX = 0, viewY = 0; 
let viewW = workCols * cellW; 
let viewH = workRows * cellH; 
let viewZoom = 1.0; 
let showRulers = true;
let shadowBoxes = ["█","▓","▒","░"];
let currentShadowIndex = 0;
let prevGrabMouse = null; 
let textToolInput = null; 

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

// --- MOUSE & SELECTION DRAGGING ---
let prevGridX = -1, prevGridY = -1;
let isDraggingSelection = false;
let dragOffsetX = 0, dragOffsetY = 0;
let floatingX = 0, floatingY = 0;

// --- SLIDERS & FONT SIZE ---
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

// --- CORE: TAB SWITCHING ---
window.switchTab = function(tabId) {
  if (activeTab === 'tab-image-proc' && tabId !== 'tab-image-proc') {
      if (window.resetImageProcessor) window.resetImageProcessor();
  }

  activeTab = tabId;
  document.querySelectorAll('.sidebar-tab').forEach(b => {
    b.classList.remove('active');
    b.style.color = '#000';
    b.style.webkitTextFillColor = '#000';
  });
  document.querySelectorAll('.workspace').forEach(w => w.classList.remove('active'));
  
  let btn = document.querySelector(`[data-tab="${tabId}"]`);
  if(btn) {
    btn.classList.add('active');
    btn.style.color = 'var(--text-muted)';
    btn.style.webkitTextFillColor = 'var(--text-muted)';
  }
  let ws = document.getElementById(tabId);
  if(ws) ws.classList.add('active');

  let cnv = document.getElementById('myCanvas');
  if(!cnv) return;
  
  if (tabId === 'tab-sketch') {
    cnv.style.display = 'block';
    loop(); 
    if(window.pauseImageProcessor) window.pauseImageProcessor(); 
  } else if (tabId === 'tab-image-proc') {
    cnv.style.display = 'none';
    noLoop(); 
    if(window.resumeImageProcessor) window.resumeImageProcessor(); 
    if(window.startWebcamAuto) window.startWebcamAuto(); 
  } else {
    cnv.style.display = 'none';
    noLoop(); 
    if(window.pauseImageProcessor) window.pauseImageProcessor(); 
  }
}

// --- GLOBAL KEYBOARD SHORTCUTS (CHỐNG P5.JS NUỐT PHÍM) ---
window.addEventListener('keydown', function(e) {
    if (activeTab !== 'tab-sketch') return;
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

    let isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl) {
        let key = e.key.toLowerCase();
        if (key === 'c') {
            e.preventDefault();
            copySelection();
        } else if (key === 'x') {
            e.preventDefault();
            cutSelection();
        } else if (key === 'v') {
            e.preventDefault();
            pasteClipboard();
        } else if (key === 'z') {
            e.preventDefault();
            if (e.shiftKey) redoSketch();
            else undoSketch();
        }
    }
});

// --- SETUP ---
function setup() {
  frameRate(30); 
  pixelDensity(1); 
  templateImg = createImage(100, 100);
  
  mainCanvas = createCanvas(canvasW, canvasH);
  mainCanvas.id('myCanvas');
  mainCanvas.parent('sketch-canvas-holder'); 
  mainCanvas.style('touch-action', 'none');

  try {
    const mc = mainCanvas.elt;
    if (mc && mc.style) {
      mc.style.transition = 'none'; mc.style.animation = 'none'; mc.style.opacity = '1'; 
    }
  } catch(e){}
  
  mainCanvas.drop(handleFile);
  mainCanvas.elt.ondragover = (e) => e.preventDefault();
  mainCanvas.elt.ondrop = (e) => {
    e.preventDefault();
    let data = e.dataTransfer.getData("text/plain");
    if (data && data.startsWith("data:image")) {
      loadImage(data, handleImageLoad);
    }
  };

  cols = Math.floor(width / cellW);
  rows = Math.floor(height / cellH);
  
  if (asciiLayers.length === 0) {
      addAsciiLayer("Background");
  }

  pgGridLayer = createGraphics(width, height);
  pgGridLayer.pixelDensity(1);
  preRenderGrid(pgGridLayer); 

  loadFromLocalStorage();
  saveState(); 

  // --- UI Configuration ---
  injectMouseTool(); 
  dockPanelsRight();
  renderPatternsUI();
  renderInkUI();
  renderLayersUI();
  createUI();
  setupSketchZoomUI();
  setupToolBindings();
  updateLayerTextVisuals(); 

  let starBtn = document.getElementById('btnShapeStar');
  if (starBtn) starBtn.style.display = 'none';
  let heartBtn = document.getElementById('btnShapeHeart');
  if (heartBtn) heartBtn.style.display = 'none';

  const performAutoSave = () => {
      saveToLocalStorage(true); 
  };
  window.addEventListener('pagehide', performAutoSave);
  window.addEventListener('beforeunload', performAutoSave);
  document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') performAutoSave();
  });

  window.switchTab('tab-thoughts');
  let sb = select('.app-sidebar');
  if (sb) sb.addClass('hidden');
}

// Bơm Tool MOUSE mạnh mẽ ngay trước nút Pencil
function injectMouseTool() {
    if (document.getElementById('btnMouse')) return;
    
    let pencilBtn = document.getElementById('btnPencil');
    if (pencilBtn && pencilBtn.parentNode) {
        let mouseBtn = document.createElement('button');
        mouseBtn.id = 'btnMouse';
        mouseBtn.title = 'Mouse (Move & Drag)';
        mouseBtn.innerHTML = '↖ Mouse';
        mouseBtn.style.padding = '6px';
        mouseBtn.style.cursor = 'pointer';
        mouseBtn.style.border = '1px solid #ccc';
        mouseBtn.style.background = '#fafafa';
        mouseBtn.style.fontWeight = 'bold';
        pencilBtn.parentNode.insertBefore(mouseBtn, pencilBtn); 
    }
}

function dockPanelsRight() {
    let canvasHolder = document.getElementById('sketch-canvas-holder');
    if (!canvasHolder) return;
    canvasHolder.style.position = 'relative';
    
    let rightBar = document.getElementById('mi-right-sidebar');
    if (!rightBar) {
        rightBar = document.createElement('div');
        rightBar.id = 'mi-right-sidebar';
        rightBar.style.position = 'absolute';
        rightBar.style.right = '20px';
        rightBar.style.top = '20px';
        rightBar.style.width = '300px';
        rightBar.style.height = 'calc(100% - 40px)';
        rightBar.style.pointerEvents = 'none';
        rightBar.style.display = 'flex';
        rightBar.style.flexDirection = 'column';
        rightBar.style.gap = '15px';
        rightBar.style.zIndex = '9999';
        rightBar.style.overflowY = 'auto';
        canvasHolder.appendChild(rightBar);
    }
    
    ['sketch-main-tools', 'sketch-patterns-panel', 'sketch-ink-panel', 'sketch-layer-panel'].forEach(id => {
        let p = document.getElementById(id);
        if (p) {
            p.style.position = 'relative';
            p.style.left = '0';
            p.style.top = '0';
            p.style.width = '100%';
            p.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            p.style.border = '1px solid #ddd';
            p.style.background = 'rgba(255, 255, 255, 0.95)';
            p.style.borderRadius = '5px';
            p.style.pointerEvents = 'auto'; 
            rightBar.appendChild(p);
            
            let header = p.querySelector('.panel-header') || p.querySelector('.panel-title');
            if (header) {
                header.style.cursor = 'default';
                let newHeader = header.cloneNode(true);
                header.parentNode.replaceChild(newHeader, header);
            }
        }
    });
}

function renderPatternsUI() {
    let patPanel = document.querySelector('#sketch-patterns-panel .panel-content');
    if (!patPanel) return;
    patPanel.innerHTML = '';
    patPanel.style.display = 'grid';
    patPanel.style.gridTemplateColumns = 'repeat(8, 1fr)';
    patPanel.style.gap = '4px';
    
    palette.forEach(char => {
        let btn = document.createElement('button');
        btn.textContent = char === 'SMART' ? '#' : char;
        btn.style.padding = '6px';
        btn.style.cursor = 'pointer';
        btn.style.fontFamily = 'monospace';
        btn.style.border = '1px solid #ccc';
        btn.style.background = '#fafafa';
        btn.onclick = () => { selectedChar = char; };
        patPanel.appendChild(btn);
    });
}

function renderInkUI() {
    let inkPanel = document.querySelector('#sketch-ink-panel .panel-content');
    if (!inkPanel) return;
    inkPanel.innerHTML = '';
    inkPanel.style.display = 'grid';
    inkPanel.style.gridTemplateColumns = 'repeat(5, 1fr)';
    inkPanel.style.gap = '5px';

    let colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#000000", "#FFFFFF", null];
    colors.forEach(c => {
        let btn = document.createElement('div');
        btn.style.width = '100%';
        btn.style.height = '30px';
        btn.style.backgroundColor = c || '#eee';
        btn.style.border = '1px solid #ccc';
        btn.style.cursor = 'pointer';
        if (!c) {
            btn.textContent = 'X';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.color = '#ff0000';
            btn.style.fontWeight = 'bold';
        }
        btn.onclick = () => {
            selectedColor = c;
            toolMode = 'INK'; 
            let shapeConfig = document.getElementById('shape-config-panel');
            if (shapeConfig) shapeConfig.style.display = 'none';
        };
        inkPanel.appendChild(btn);
    });
}

function renderLayersUI() {
    let layPanel = document.querySelector('#sketch-layer-panel .panel-content');
    if (!layPanel) return;
    layPanel.innerHTML = '';
    
    let addBtn = document.createElement('button');
    addBtn.textContent = '+ Add Layer';
    addBtn.style.marginBottom = '10px';
    addBtn.style.padding = '5px 10px';
    addBtn.style.width = '100%';
    addBtn.onclick = () => { addAsciiLayer('Layer ' + (asciiLayers.length + 1)); renderLayersUI(); };
    layPanel.appendChild(addBtn);
    
    asciiLayers.forEach((l, i) => {
        let div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '8px';
        div.style.background = i === activeLayerIndex ? '#d0e8ff' : '#fff';
        div.style.border = '1px solid #ccc';
        div.style.marginBottom = '5px';
        div.style.cursor = 'pointer';
        div.onclick = () => { 
            activeLayerIndex = i; 
            grid = l.grid; colorGrid = l.colorGrid; textColorGrid = l.textColorGrid; pgColorLayer = l.pgColor; pgTextLayer = l.pgText; 
            renderLayersUI(); 
        };
        
        let name = document.createElement('span');
        name.textContent = l.name;
        div.appendChild(name);
        
        let visBtn = document.createElement('button');
        visBtn.textContent = l.visible ? '👁' : '🙈';
        visBtn.onclick = (e) => { e.stopPropagation(); l.visible = !l.visible; renderLayersUI(); };
        div.appendChild(visBtn);
        
        layPanel.appendChild(div);
    });
}

function createUI() {
  try {
    if (window.__mi_ui_initialized) return;
    window.__mi_ui_initialized = true;

    const rightBar = document.getElementById('mi-right-sidebar');
    if (!rightBar) return;

    const ui = document.createElement('div');
    ui.id = 'shape-config-panel';
    ui.className = 'mi-basic-ui panel';
    ui.style.display = 'none'; 
    ui.style.flexDirection = 'column'; 
    ui.style.gap = '8px';
    ui.style.background = 'rgba(255, 255, 255, 0.95)';
    ui.style.padding = '10px';
    ui.style.border = '1px solid #ddd';
    ui.style.borderRadius = '5px';
    ui.style.pointerEvents = 'auto';

    const title = document.createElement('div');
    title.textContent = 'Shape Configuration';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    ui.appendChild(title);

    const rulerBtn = document.createElement('button');
    rulerBtn.id = 'toggle-rulers'; rulerBtn.type = 'button';
    rulerBtn.textContent = showRulers ? 'Hide rulers' : 'Show rulers';
    rulerBtn.style.padding = '4px 8px';
    rulerBtn.style.fontSize = '12px';
    rulerBtn.addEventListener('click', () => {
      showRulers = !showRulers;
      rulerBtn.textContent = showRulers ? 'Hide rulers' : 'Show rulers';
    });
    ui.appendChild(rulerBtn);

    const label = document.createElement('label');
    label.textContent = 'Shadow:'; label.style.fontSize = '12px';
    const shadowSel = document.createElement('select');
    shadowSel.id = 'shadow-select';
    shadowBoxes.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s; shadowSel.appendChild(o); });
    shadowSel.value = currentShadowIndex;
    shadowSel.addEventListener('change', () => { currentShadowIndex = parseInt(shadowSel.value, 10) || 0; });
    
    const wrapper = document.createElement('div'); 
    wrapper.style.display = 'flex'; wrapper.style.alignItems = 'center'; wrapper.style.justifyContent = 'space-between';
    wrapper.appendChild(label); wrapper.appendChild(shadowSel);
    
    const fillLabel = document.createElement('label');
    fillLabel.textContent = 'Fill:'; fillLabel.style.fontSize = '12px';
    
    const fillSel = document.createElement('select');
    ['Hollow', 'Solid', 'Space'].forEach(m => {
        const o = document.createElement('option'); o.value = m; o.textContent = m; fillSel.appendChild(o);
    });
    fillSel.value = shapeFillMode;
    fillSel.addEventListener('change', () => shapeFillMode = fillSel.value);
    
    const fillCharInput = document.createElement('input');
    fillCharInput.type = 'text'; fillCharInput.maxLength = 1; fillCharInput.value = shapeFillChar;
    fillCharInput.style.width = '24px'; fillCharInput.style.textAlign = 'center';
    fillCharInput.addEventListener('input', () => shapeFillChar = fillCharInput.value || ' ');

    const wrapperFill = document.createElement('div'); 
    wrapperFill.style.display = 'flex'; wrapperFill.style.alignItems = 'center'; wrapperFill.style.justifyContent = 'space-between';
    wrapperFill.appendChild(fillLabel); 
    
    const fillInputs = document.createElement('div');
    fillInputs.style.display = 'flex'; fillInputs.style.gap = '4px';
    fillInputs.appendChild(fillSel); fillInputs.appendChild(fillCharInput);
    wrapperFill.appendChild(fillInputs);
    
    ui.appendChild(wrapper);
    ui.appendChild(wrapperFill);

    rightBar.insertBefore(ui, rightBar.children[1]); 
  } catch (e) {}
}

function handleFile(file) {
  try {
    if (!file) return;
    if (file.type === 'image') {
      if (file.data) loadImage(file.data, handleImageLoad);
    } else if (typeof file === 'string' && file.startsWith('data:image')) {
      loadImage(file, handleImageLoad);
    }
  } catch (e) {}
}

function getCorrectedMouse() {
  let x = (typeof mouseX === 'number') ? mouseX : 0;
  let y = (typeof mouseY === 'number') ? mouseY : 0;
  x = constrain(x, 0, width);
  y = constrain(y, 0, height);
  return { x: x, y: y };
}

// --- HISTORY, UNDO/REDO & CLIPBOARD LOGIC ---
function saveState(silent) {
  try {
    const gCopy = grid.map(row => Array.isArray(row) ? row.slice() : []);
    const cCopy = colorGrid.map(row => Array.isArray(row) ? row.slice() : []);
    const tCopy = textColorGrid.map(row => Array.isArray(row) ? row.slice() : []);
    history.push({ grid: gCopy, colorGrid: cCopy, textColorGrid: tCopy });
    if (history.length > MAX_HISTORY) history.shift();
    sketchRedoHistory = []; 
  } catch (e) {}
}

function undoSketch() {
    if (history.length > 1) { 
        let currentState = history.pop();
        sketchRedoHistory.push(currentState);
        let prevState = history[history.length - 1];
        
        grid = prevState.grid.map(row => [...row]);
        colorGrid = prevState.colorGrid.map(row => [...row]);
        textColorGrid = prevState.textColorGrid.map(row => [...row]);
        
        asciiLayers[activeLayerIndex].grid = grid;
        asciiLayers[activeLayerIndex].colorGrid = colorGrid;
        asciiLayers[activeLayerIndex].textColorGrid = textColorGrid;
        
        updateLayerTextVisuals();
        updateLayerColorVisuals();
    }
}

function redoSketch() {
    if (sketchRedoHistory.length > 0) {
        let nextState = sketchRedoHistory.pop();
        history.push(nextState);
        
        grid = nextState.grid.map(row => [...row]);
        colorGrid = nextState.colorGrid.map(row => [...row]);
        textColorGrid = nextState.textColorGrid.map(row => [...row]);
        
        asciiLayers[activeLayerIndex].grid = grid;
        asciiLayers[activeLayerIndex].colorGrid = colorGrid;
        asciiLayers[activeLayerIndex].textColorGrid = textColorGrid;
        
        updateLayerTextVisuals();
        updateLayerColorVisuals();
    }
}

function copySelection() {
    if (!selStart || !selEnd) return;
    let minX = Math.min(selStart.x, selEnd.x);
    let maxX = Math.max(selStart.x, selEnd.x);
    let minY = Math.min(selStart.y, selEnd.y);
    let maxY = Math.max(selStart.y, selEnd.y);
    
    clipboard = { w: maxX - minX + 1, h: maxY - minY + 1, data: [] };
    
    for (let y = minY; y <= maxY; y++) {
        let row = [];
        for (let x = minX; x <= maxX; x++) {
            if (isValidCell(x, y)) {
                row.push({ char: grid[y][x], color: colorGrid[y][x], textColor: textColorGrid[y][x] });
            } else {
                row.push({ char: "", color: null, textColor: "#000000" });
            }
        }
        clipboard.data.push(row);
    }
}

function cutSelection() {
    if (!selStart || !selEnd) return;
    copySelection(); 
    
    let minX = Math.min(selStart.x, selEnd.x);
    let maxX = Math.max(selStart.x, selEnd.x);
    let minY = Math.min(selStart.y, selEnd.y);
    let maxY = Math.max(selStart.y, selEnd.y);
    
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (isValidCell(x, y)) {
                grid[y][x] = "";
                colorGrid[y][x] = null;
                textColorGrid[y][x] = "#000000";
            }
        }
    }
    updateLayerTextVisuals();
    updateLayerColorVisuals();
    selStart = null;
    selEnd = null;
    saveState();
}

function pasteClipboard() {
    if (!clipboard) return;
    
    let m = getCorrectedMouse();
    let x = 0; let y = 0;

    if (m.x > 0 && m.x < width && m.y > 0 && m.y < height) {
        x = Math.floor((m.x + viewX) / cellW);
        y = Math.floor((m.y + viewY) / cellH);
    } else {
        x = Math.floor(viewX / cellW) + Math.floor((viewW / cellW) / 2) - Math.floor(clipboard.w / 2);
        y = Math.floor(viewY / cellH) + Math.floor((viewH / cellH) / 2) - Math.floor(clipboard.h / 2);
    }
    
    floatingX = x;
    floatingY = y;
    isDraggingSelection = true;
    toolMode = 'MOUSE'; // Tự động bật MOUSE tool cho phép kéo thả
    selStart = null; selEnd = null; 
}

function commitFloatingSelection() {
    if (!isDraggingSelection || !clipboard) return;
    for (let cy = 0; cy < clipboard.h; cy++) {
        for (let cx = 0; cx < clipboard.w; cx++) {
            let targetX = floatingX + cx;
            let targetY = floatingY + cy;
            if (isValidCell(targetX, targetY)) {
                let d = clipboard.data[cy][cx];
                if (d.char !== "") grid[targetY][targetX] = d.char; 
                if (d.color !== null) colorGrid[targetY][targetX] = d.color;
                if (d.textColor !== "#000000" && d.char !== "") textColorGrid[targetY][targetX] = d.textColor;
            }
        }
    }
    updateLayerTextVisuals();
    updateLayerColorVisuals();
    saveState();
    isDraggingSelection = false;
}

function addAsciiLayer(name = 'Layer') {
  if (typeof cols === 'undefined' || typeof rows === 'undefined') return;

  let pgC = createGraphics(width, height);
  pgC.pixelDensity(1);
  let pgT = createGraphics(width, height);
  pgT.pixelDensity(1);

  try {
    const c3 = pgC.canvas || pgC.elt;
    if (c3 && c3.style) { c3.style.transition = 'none'; c3.style.animation = 'none'; c3.style.opacity = '1'; }
    const c4 = pgT.canvas || pgT.elt;
    if (c4 && c4.style) { c4.style.transition = 'none'; c4.style.animation = 'none'; c4.style.opacity = '1'; }
  } catch(e){}

  let layerGrid = [];
  let layerColorGrid = [];
  let layerTextColorGrid = [];
  for (let y = 0; y < rows; y++) {
    layerGrid[y] = [];
    layerColorGrid[y] = [];
    layerTextColorGrid[y] = [];
    for (let x = 0; x < cols; x++) {
      layerGrid[y][x] = "";
      layerColorGrid[y][x] = null;
      layerTextColorGrid[y][x] = "#000000";
    }
  }

  const layer = {
    name: name,
    pgColor: pgC,
    pgText: pgT,
    grid: layerGrid,
    colorGrid: layerColorGrid,
    textColorGrid: layerTextColorGrid,
    visible: true
  };

  asciiLayers.push(layer);
  activeLayerIndex = asciiLayers.length - 1;

  grid = asciiLayers[activeLayerIndex].grid;
  colorGrid = asciiLayers[activeLayerIndex].colorGrid;
  textColorGrid = asciiLayers[activeLayerIndex].textColorGrid;
  pgColorLayer = asciiLayers[activeLayerIndex].pgColor;
  pgTextLayer = asciiLayers[activeLayerIndex].pgText;

  updateLayerColorVisuals();
  updateLayerTextVisuals();
  renderLayersUI();
}

function draw() {
  if (activeTab !== 'tab-sketch') return;

  let m = getCorrectedMouse();
  mainCanvas.removeClass('cursor-pencil');
  mainCanvas.removeClass('cursor-eraser');

  if (m.x > 0 && m.x < width && m.y > 0 && m.y < height) {
    if (mainMode === "COLOR") cursor(HAND);
    else if (toolMode === "DRAW") {
      if (isEraser) mainCanvas.addClass('cursor-eraser');
      else mainCanvas.addClass('cursor-pencil');
    } else cursor(CROSS);
  } else cursor(ARROW);

  clear(); 
  
  push();
  translate(-viewX, -viewY);

  image(pgGridLayer, 0, 0);

  for (let i = 0; i < asciiLayers.length; i++) {
      let l = asciiLayers[i];
      if (l.visible) {
          blendMode(MULTIPLY);
          if (l.pgColor) image(l.pgColor, 0, 0);
          blendMode(BLEND);
          if (l.pgText) image(l.pgText, 0, 0);
      }
  }

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

  // --- DRAW FLOATING SELECTION (MOUSE DRAG) ---
  if (isDraggingSelection && clipboard) {
      for (let cy = 0; cy < clipboard.h; cy++) {
          for (let cx = 0; cx < clipboard.w; cx++) {
              let d = clipboard.data[cy][cx];
              if (d.char !== "") {
                  let drawX = (floatingX + cx) * cellW;
                  let drawY = (floatingY + cy) * cellH;
                  if (d.color) {
                      fill(d.color); noStroke();
                      rect(drawX, drawY, cellW, cellH);
                  }
                  fill(d.textColor); noStroke();
                  textFont("Consolas, monospace"); textSize(userFontSize); textAlign(CENTER, CENTER);
                  text(d.char, drawX + cellW/2, drawY + cellH/2);
              }
          }
      }
      stroke(0, 150, 255); drawingContext.setLineDash([5, 5]); noFill();
      rect(floatingX * cellW, floatingY * cellH, clipboard.w * cellW, clipboard.h * cellH);
      drawingContext.setLineDash([]);
  }
  
  if ((toolMode.startsWith('SHAPE_') || toolMode === 'TEXT' || toolMode === 'SELECT' || toolMode === 'MOUSE') && selStart && selEnd && !isDraggingSelection) {
      drawToolPreview();
  }

  drawSelectionMask();
  pop(); 

  drawViewportOverlay();
  if (showRulers) drawRulers();
}

function preRenderGrid(pg) {
  pg.clear();
  pg.stroke(220);
  pg.strokeWeight(0.5);
  pg.noFill();

  for (let i = 0; i <= workCols; i++) {
    let x = i * cellW;
    pg.line(x, 0, x, workRows * cellH);
  }
  for (let j = 0; j <= workRows; j++) {
    let y = j * cellH;
    pg.line(0, y, workCols * cellW, y);
  }
}

function drawSingleCellText(x, y) {
  if (!pgTextLayer || x >= workCols || y >= workRows) return; 
  let cx = x * cellW; let cy = y * cellH;
  pgTextLayer.erase(); 
  pgTextLayer.noStroke(); pgTextLayer.fill(255); 
  pgTextLayer.rect(cx, cy, cellW, cellH); 
  pgTextLayer.noErase();
  
  let char = grid[y][x];
  if (char !== "") {
      pgTextLayer.textFont("Consolas, monospace");
      pgTextLayer.textSize(userFontSize);
      pgTextLayer.textAlign(CENTER, CENTER);
      
      let displayColor = color(textColorGrid[y][x] || "#000000");
      let posX = cx + cellW/2; 
      let posY = cy + cellH/2;

      pgTextLayer.noStroke();
      pgTextLayer.fill(displayColor);
      pgTextLayer.text(char, posX, posY);
  }
}

function updateLayerTextVisuals() {
  if (!pgTextLayer) return; 
  pgTextLayer.clear();
  pgTextLayer.textFont("Consolas, monospace");
  pgTextLayer.textSize(userFontSize);
  pgTextLayer.textAlign(CENTER, CENTER); 

  for (let y = 0; y < workRows; y++) {
    for (let x = 0; x < workCols; x++) {
      let char = grid[y][x];
      if (char !== "") {
          let cx = x * cellW; let cy = y * cellH;
          let displayColor = color(textColorGrid[y][x] || "#000000");
          let posX = cx + cellW/2; 
          let posY = cy + cellH/2;
          
          pgTextLayer.noStroke();
          pgTextLayer.fill(displayColor);
          pgTextLayer.text(char, posX, posY);
      }
    }
  }
}

function updateLayerColorVisuals() {
  if (!pgColorLayer) return; 
  pgColorLayer.clear(); pgColorLayer.noStroke();
  for (let y = 0; y < workRows; y++) {
    for (let x = 0; x < workCols; x++) {
      let c = colorGrid[y][x];
      if(c) { pgColorLayer.fill(c); pgColorLayer.rect(x * cellW, y * cellH, cellW, cellH); }
    }
  }
}

function setAsciiCell(x, y, ch) {
  if (selectionMask && !selectionMask[y][x]) return; 
  ensureGridCell(x, y);
  grid[y][x] = ch;
  drawSingleCellText(x, y);
}

function setGridColor(x, y, col) {
  if (selectionMask && !selectionMask[y][x]) return;
  ensureGridCell(x, y);
  colorGrid[y][x] = col;
  if (!pgColorLayer) return;
  pgColorLayer.erase(); pgColorLayer.rect(x * cellW, y * cellH, cellW, cellH); pgColorLayer.noErase();
  if (col !== null) { pgColorLayer.fill(col); pgColorLayer.rect(x * cellW, y * cellH, cellW, cellH); }
  drawSingleCellText(x, y); 
}

function drawSelectionMask() {
  if (!selectionMask) return;
  fill(0, 150, 255, 80); 
  noStroke();
  for (let y = 0; y < workRows; y++) {
      for (let x = 0; x < workCols; x++) {
          if (selectionMask[y][x]) {
              rect(x * cellW, y * cellH, cellW, cellH);
          }
      }
  }
}

function drawViewportOverlay() {
  fill(250); 
  noStroke();
  rect(viewW - viewX, -viewY, width, height); 
  rect(-viewX, viewH - viewY, width, height); 
  
  stroke(255, 0, 0, 150);
  strokeWeight(2);
  noFill();
  rect(-viewX, -viewY, viewW, viewH);
}

function drawRulers() {
  fill(240); stroke(200); strokeWeight(1);
  rect(0, 0, width, 20); 
  rect(0, 0, 20, height); 
  
  fill(0); noStroke(); textSize(9); textAlign(CENTER, TOP);
  for(let x = 0; x <= viewW; x += cellW) {
      if (x % (cellW*5) === 0) {
          text(Math.floor(x/cellW), -viewX + x, 2);
          stroke(150); line(-viewX + x, 12, -viewX + x, 20); noStroke();
      } else {
          stroke(200); line(-viewX + x, 15, -viewX + x, 20); noStroke();
      }
  }
  
  textAlign(RIGHT, CENTER);
  for(let y = 0; y <= viewH; y += cellH) {
      if (y % (cellH*5) === 0) {
          text(Math.floor(y/cellH), 18, -viewY + y);
          stroke(150); line(12, -viewY + y, 20, -viewY + y); noStroke();
      } else {
          stroke(200); line(15, -viewY + y, 20, -viewY + y); noStroke();
      }
  }
}

function drawToolPreview() {
  let sx = Math.min(selStart.x, selEnd.x) * cellW;
  let sy = Math.min(selStart.y, selEnd.y) * cellH;
  let ex = Math.max(selStart.x, selEnd.x) * cellW + cellW;
  let ey = Math.max(selStart.y, selEnd.y) * cellH + cellH;
  
  noFill();
  if (toolMode === 'SELECT' || toolMode === 'MOUSE') {
      stroke(0, 150, 255);
      drawingContext.setLineDash([5, 5]);
  } else {
      stroke(255, 100, 100);
      drawingContext.setLineDash([]);
  }
  strokeWeight(2);

  if (toolMode === 'SHAPE_RECT' || toolMode === 'TEXT' || toolMode === 'SELECT' || toolMode === 'MOUSE') {
      rect(sx, sy, ex - sx, ey - sy);
  } else if (toolMode === 'SHAPE_CIRCLE') {
      ellipseMode(CORNERS);
      ellipse(sx, sy, ex, ey);
  } else if (toolMode === 'SHAPE_TRIANGLE') {
      triangle(sx + (ex-sx)/2, sy, ex, ey, sx, ey);
  }
  
  drawingContext.setLineDash([]); 
}

function magicWandSelect(startX, startY) {
  if (!isValidCell(startX, startY)) return;
  let targetChar = grid[startY][startX];
  
  if (!keyIsDown(SHIFT) || !selectionMask) {
      selectionMask = [];
      for (let y = 0; y < rows; y++) selectionMask[y] = new Array(cols).fill(false);
  }
  
  for (let y = 0; y < workRows; y++) {
      for (let x = 0; x < workCols; x++) {
          if (grid[y][x] === targetChar) {
              selectionMask[y][x] = true;
          }
      }
  }
}

function floodFill(startX, startY, targetChar, replaceChar) {
  if (targetChar === replaceChar) return;
  let queue = [{x: startX, y: startY}];
  while (queue.length > 0) {
      let p = queue.shift();
      if (isValidCell(p.x, p.y) && grid[p.y][p.x] === targetChar && (!selectionMask || selectionMask[p.y][p.x])) {
          setAsciiCell(p.x, p.y, replaceChar);
          queue.push({x: p.x + 1, y: p.y});
          queue.push({x: p.x - 1, y: p.y});
          queue.push({x: p.x, y: p.y + 1});
          queue.push({x: p.x, y: p.y - 1});
      }
  }
}

function openTextToolBox(minX, minY, maxX, maxY, px, py) {
    if (textToolInput) textToolInput.remove();
    textToolInput = createElement('textarea');
    textToolInput.position(px, py);
    
    textToolInput.style('font-family', 'Consolas, monospace');
    textToolInput.style('font-size', userFontSize + 'px');
    textToolInput.style('line-height', cellH + 'px'); 
    textToolInput.style('width', Math.max(80, (maxX - minX + 1) * cellW) + 'px');
    textToolInput.style('height', Math.max(40, (maxY - minY + 1) * cellH) + 'px');
    textToolInput.style('padding', '0px'); 
    textToolInput.style('margin', '0px');
    textToolInput.style('border', '1px dashed #f00');
    textToolInput.style('outline', 'none');
    textToolInput.style('box-sizing', 'border-box');
    textToolInput.style('overflow', 'hidden');
    textToolInput.style('white-space', 'pre'); 
    textToolInput.style('z-index', '1000');
    textToolInput.style('background', 'rgba(255, 255, 255, 0.9)');
    textToolInput.style('resize', 'none');
    textToolInput.elt.focus();
    
    let commitText = () => {
        if(!textToolInput) return;
        let txt = textToolInput.value();
        
        let drawBorderChar = selectedChar === 'SMART' ? '#' : selectedChar;
        if (maxX - minX >= 1 && maxY - minY >= 1) {
            applyShape(minX, minY, maxX, maxY, 'SHAPE_RECT', drawBorderChar, false);
            
            let innerMinX = minX + 1;
            let innerMinY = minY + 1;
            let innerMaxX = maxX - 1;
            let innerMaxY = maxY - 1;
            
            let cx = innerMinX, cy = innerMinY;
            for (let i = 0; i < txt.length; i++) {
                let char = txt[i];
                if (char === '\n') {
                    cx = innerMinX; cy++; continue;
                }
                if (cx > innerMaxX) {
                    cx = innerMinX; cy++;
                }
                if (cy > innerMaxY) break; 
                
                if (isValidCell(cx, cy)) setAsciiCell(cx, cy, char);
                cx++;
            }
        } else {
            let cx = minX, cy = minY;
            for (let i = 0; i < txt.length; i++) {
                let char = txt[i];
                if (char === '\n') {
                    cx = minX; cy++; continue;
                }
                if (isValidCell(cx, cy)) setAsciiCell(cx, cy, char);
                cx++;
            }
        }
        
        saveState();
        textToolInput.remove();
        textToolInput = null;
    };
    
    textToolInput.elt.onblur = commitText;
}

function applyShape(x1, y1, x2, y2, mode, char, withShadow) {
  let minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  let minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  let w = maxX - minX; let h = maxY - minY;
  let shadowOffset = 1;
  let shadowChar = shadowBoxes[currentShadowIndex];
  
  let drawBorder = (x, y, ox, oy, drawChar) => {
    let drawX = x + ox, drawY = y + oy;
    if (isValidCell(drawX, drawY)) setAsciiCell(drawX, drawY, drawChar);
  };

  let passes = withShadow ? 2 : 1;
  for(let p = 0; p < passes; p++) {
      let isShadowPass = withShadow && p === 0;
      let drawChar = isShadowPass ? shadowChar : char;
      let ox = isShadowPass ? shadowOffset : 0;
      let oy = isShadowPass ? shadowOffset : 0;
      
      if (mode === 'SHAPE_RECT') {
          for(let y = minY; y <= maxY; y++) {
              for(let x = minX; x <= maxX; x++) {
                  let isBorder = (x === minX || x === maxX || y === minY || y === maxY);
                  if (isBorder) {
                      drawBorder(x, y, ox, oy, drawChar);
                  } else if (!isShadowPass && shapeFillMode !== 'Hollow') {
                      drawBorder(x, y, ox, oy, shapeFillMode === 'Solid' ? shapeFillChar : ' ');
                  }
              }
          }
      } else if (mode === 'SHAPE_CIRCLE') {
          let cx = minX + w/2; let cy = minY + h/2;
          let rx = (w + 1) / 2; let ry = (h + 1) / 2;
          
          for(let y = minY; y <= maxY; y++) {
              for(let x = minX; x <= maxX; x++) {
                  let dx = (x - cx) / (rx || 1);
                  let dy = (y - cy) / (ry || 1);
                  let dist = Math.sqrt(dx*dx + dy*dy);
                  
                  if (dist >= 0.75 && dist <= 1.15) {
                      drawBorder(x, y, ox, oy, drawChar);
                  } else if (dist < 0.75 && !isShadowPass && shapeFillMode !== 'Hollow') {
                      drawBorder(x, y, ox, oy, shapeFillMode === 'Solid' ? shapeFillChar : ' ');
                  }
              }
          }
      } else if (mode === 'SHAPE_TRIANGLE') {
          let topX = minX + w/2;
          for(let y = minY; y <= maxY; y++) {
              for(let x = minX; x <= maxX; x++) {
                  let slope = h / (w/2 || 1);
                  let edgeY = slope * Math.abs(x - topX) + minY;
                  let isInside = y >= edgeY && y <= maxY;
                  let isBorder = Math.abs(y - edgeY) < 1.5 || y === maxY;
                  
                  if (isBorder && isInside) {
                      drawBorder(x, y, ox, oy, drawChar);
                  } else if (isInside && !isShadowPass && shapeFillMode !== 'Hollow') {
                      drawBorder(x, y, ox, oy, shapeFillMode === 'Solid' ? shapeFillChar : ' ');
                  }
              }
          }
      }
  }
}

// --- INPUT HANDLING ---
function isValidCell(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < workCols && y < workRows;
}

function mousePressed() {
  if (activeTab !== 'tab-sketch') return;
  if (isDraggingPanel) return;
  prevGridX = -1; prevGridY = -1;
  let m = getCorrectedMouse();
  if (m.x < 0 || m.x > width || m.y < 0 || m.y > height) return;
  
  if (toolMode === 'GRAB') {
    prevGrabMouse = {x: m.x, y: m.y};
    return;
  }

  let realX = m.x + viewX;
  let realY = m.y + viewY;
  let mx = floor(constrain(realX, 0, width-1) / cellW);
  let my = floor(constrain(realY, 0, height-1) / cellH);

  if (toolMode === 'MOUSE') {
      if (isDraggingSelection) {
          commitFloatingSelection();
          return;
      }

      if (selStart && selEnd) {
          let minX = Math.min(selStart.x, selEnd.x);
          let maxX = Math.max(selStart.x, selEnd.x);
          let minY = Math.min(selStart.y, selEnd.y);
          let maxY = Math.max(selStart.y, selEnd.y);
          
          if (mx >= minX && mx <= maxX && my >= minY && my <= maxY) {
              copySelection();
              cutSelection();
              isDraggingSelection = true;
              dragOffsetX = mx - minX;
              dragOffsetY = my - minY;
              floatingX = minX;
              floatingY = minY;
              return;
          }
      }
      
      prevGrabMouse = {x: m.x, y: m.y};
      selStart = null; selEnd = null; 
      return;
  }

  if (toolMode !== "MAGIC_WAND" && toolMode !== "SELECT" && !toolMode.startsWith("SHAPE_") && toolMode !== "TEXT") {
      if (selectionMask && (!isValidCell(mx, my) || !selectionMask[my][mx])) selectionMask = null;
  }

  if (toolMode === "MAGIC_WAND") {
      magicWandSelect(mx, my);
      return;
  }

  // Dùng e.shiftKey thông qua đối tượng phím ảo của p5js
  if (keyIsDown(16) || toolMode.startsWith('SHAPE_') || toolMode === 'TEXT') { 
      selStart = {x: mx, y: my}; 
      selEnd = {x: mx, y: my}; 
      if (!toolMode.startsWith('SHAPE_') && toolMode !== 'TEXT') toolMode = "SELECT";
      isShiftSelecting = true; 
      return; 
  }
  
  if (toolMode === "SELECT" && !isShiftSelecting) { selStart = {x: mx, y: my}; selEnd = {x: mx, y: my}; }

  handleInput(mx, my);
}

function mouseDragged() {
  if (activeTab !== 'tab-sketch') return;
  if (isDraggingPanel) return;
  let m = getCorrectedMouse();

  let realX = m.x + viewX;
  let realY = m.y + viewY;
  let mx = floor(constrain(realX, 0, width-1) / cellW);
  let my = floor(constrain(realY, 0, height-1) / cellH);

  if (toolMode === 'MOUSE') {
      if (isDraggingSelection) {
          floatingX = mx - dragOffsetX;
          floatingY = my - dragOffsetY;
      } else if (prevGrabMouse) {
          let dx = m.x - prevGrabMouse.x;
          let dy = m.y - prevGrabMouse.y;
          viewX = constrain(viewX - dx, 0, width - viewW);
          viewY = constrain(viewY - dy, 0, height - viewH);
          prevGrabMouse = {x: m.x, y: m.y};
      }
      return;
  }

  if (toolMode === 'GRAB' && prevGrabMouse) {
    let dx = m.x - prevGrabMouse.x;
    let dy = m.y - prevGrabMouse.y;
    viewX = constrain(viewX - dx, 0, width - viewW);
    viewY = constrain(viewY - dy, 0, height - viewH);
    prevGrabMouse = {x: m.x, y: m.y};
    return;
  }

  if (isShiftSelecting || toolMode.startsWith('SHAPE_') || toolMode === 'TEXT' || (toolMode === "SELECT" && keyIsDown(16))) { 
      selEnd = {x: mx, y: my}; 
      return; 
  }
  if (toolMode === "FILL") return; 

  if (mx !== prevGridX || my !== prevGridY) {
      handleInput(mx, my);
      prevGridX = mx; prevGridY = my;
  }
}

function mouseReleased() {
  if (activeTab !== 'tab-sketch') return;
  
  if (toolMode === 'MOUSE') {
      prevGrabMouse = null;
      return; 
  }

  if (toolMode.startsWith('SHAPE_') && selStart && selEnd) {
      let ch = selectedChar === 'SMART' ? '#' : selectedChar;
      applyShape(selStart.x, selStart.y, selEnd.x, selEnd.y, toolMode, ch, true);
      selStart = null; selEnd = null;
      saveState();
  } else if (toolMode === 'TEXT' && selStart && selEnd) {
      let minX = Math.min(selStart.x, selEnd.x);
      let maxX = Math.max(selStart.x, selEnd.x);
      let minY = Math.min(selStart.y, selEnd.y);
      let maxY = Math.max(selStart.y, selEnd.y);
      
      let canvasRect = mainCanvas.elt.getBoundingClientRect();
      let px = canvasRect.left + (minX * cellW) - viewX;
      let py = canvasRect.top + (minY * cellH) - viewY;
      
      openTextToolBox(minX, minY, maxX, maxY, px, py);
      selStart = null; selEnd = null;
  } else if (toolMode === "SELECT" && selStart && selEnd) {
      if (selStart.x === selEnd.x && selStart.y === selEnd.y && !isShiftSelecting) {
          selectionMask = null;
          selStart = null;
          selEnd = null;
      }
  }

  if (isShiftSelecting) isShiftSelecting = false;
  else if (toolMode === "DRAW" || toolMode === "ERASE" || toolMode === "FILL" || toolMode === "INK") saveState(); 
  
  prevGrabMouse = null;
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('mi_sketch_state');
    if (!raw) return;
    const obj = JSON.parse(raw);

    if (obj.asciiLayers && Array.isArray(obj.asciiLayers) && obj.asciiLayers.length > 0) {
      asciiLayers = [];
      for (let i = 0; i < obj.asciiLayers.length; i++) {
        addAsciiLayer(obj.asciiLayers[i].name || ('Layer ' + i));
        if (obj.asciiLayers[i].grid) asciiLayers[i].grid = obj.asciiLayers[i].grid;
      }
    } 
    if (asciiLayers.length === 0) {
        addAsciiLayer("Background");
    }

    activeLayerIndex = 0;
    grid = asciiLayers[0].grid;
    colorGrid = asciiLayers[0].colorGrid;
    textColorGrid = asciiLayers[0].textColorGrid;
    pgColorLayer = asciiLayers[0].pgColor;
    pgTextLayer = asciiLayers[0].pgText;

    if (obj.grid && Array.isArray(obj.grid)) grid = obj.grid;
    if (obj.colorGrid && Array.isArray(obj.colorGrid)) colorGrid = obj.colorGrid;
    if (obj.textColorGrid && Array.isArray(obj.textColorGrid)) textColorGrid = obj.textColorGrid;
    
  } catch (e) {
     if (asciiLayers.length === 0) {
        addAsciiLayer("Background");
     }
  }
}

function saveToLocalStorage(silent) {
  try {
    const obj = { grid: grid, colorGrid: colorGrid, textColorGrid: textColorGrid, asciiLayers: asciiLayers.map(l => ({ name: l.name, grid: l.grid })) };
    localStorage.setItem('mi_sketch_state', JSON.stringify(obj));
  } catch (e) {}
}

function handleInput(x, y) {
  if (!isValidCell(x, y)) return;
  if (toolMode === 'DRAW') {
    let ch = selectedChar === 'SMART' ? '#' : selectedChar;
    if (isEraser) ch = "";
    setAsciiCell(x, y, ch);
  } else if (toolMode === 'ERASE') {
    setAsciiCell(x, y, "");
  } else if (toolMode === 'FILL') {
    let targetChar = grid[y][x];
    let ch = selectedChar === 'SMART' ? '#' : selectedChar;
    floodFill(x, y, targetChar, ch);
  } else if (toolMode === 'INK') {
    setGridColor(x, y, selectedColor);
  }
}

function ensureGridCell(x, y) {
  if (!grid[y]) grid[y] = [];
  if (!colorGrid[y]) colorGrid[y] = [];
  if (!textColorGrid[y]) textColorGrid[y] = [];
}

function setupSketchZoomUI() {
  let btnZoomIn = select('#btnSketchZoomIn');
  let btnZoomOut = select('#btnSketchZoomOut');
  let zoomVal = select('#sketch-zoom-val');

  if (btnZoomIn) {
    btnZoomIn.mousePressed(() => {
      viewZoom = Math.min(5.0, viewZoom + 0.1);
      if(zoomVal) zoomVal.html(Math.round(viewZoom * 100) + '%');
    });
  }
  if (btnZoomOut) {
    btnZoomOut.mousePressed(() => {
      viewZoom = Math.max(0.1, viewZoom - 0.1);
      if(zoomVal) zoomVal.html(Math.round(viewZoom * 100) + '%');
    });
  }
}

function setupToolBindings() {
  const tModes = [
    {id: 'btnPencil', mode: 'DRAW'},
    {id: 'btnEraser', mode: 'ERASE'},
    {id: 'btnFill', mode: 'FILL'},
    {id: 'btnMagicWand', mode: 'MAGIC_WAND'},
    {id: 'btnGrab', mode: 'GRAB'},
    {id: 'btnMouse', mode: 'MOUSE'}, 
    {id: 'btnTextTool', mode: 'TEXT'},
    {id: 'btnShapeRect', mode: 'SHAPE_RECT'},
    {id: 'btnShapeTriangle', mode: 'SHAPE_TRIANGLE'},
    {id: 'btnShapeCircle', mode: 'SHAPE_CIRCLE'}
  ];
  
  tModes.forEach(t => {
    let btn = document.getElementById(t.id);
    if(btn) {
      btn.addEventListener('click', () => {
        if (isDraggingSelection) commitFloatingSelection();

        toolMode = t.mode;
        
        let shapeConfig = document.getElementById('shape-config-panel');
        if (shapeConfig) {
            shapeConfig.style.display = toolMode.startsWith('SHAPE_') ? 'flex' : 'none';
        }
      });
    }
  });

  let btnClear = document.getElementById('btnClearSketch');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      selectionMask = null;
      for(let y=0; y<workRows; y++) {
        for(let x=0; x<workCols; x++) {
          if (grid[y]) grid[y][x] = "";
          if (colorGrid[y]) colorGrid[y][x] = null;
          if (textColorGrid[y]) textColorGrid[y][x] = "#000000";
        }
      }
      updateLayerColorVisuals();
      updateLayerTextVisuals();
      saveState();
    });
  }
}

function handleImageLoad(img) {
  if (!img) return;
  templateImg = img;
}