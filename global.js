// --- GLOBALS FOR APP INTEGRATION ---
var activeTab = 'tab-thoughts';

// --- CONFIG ---
var cols, rows;
var cellW = 9;  
var cellH = 13.5;
var inkColorHex = "#000000"; 
var workCols = 160;
var workRows = 60;
var canvasW = workCols * cellW;
var canvasH = workRows * cellH;
var canvasRatioPreset = '16:9';

// --- SHAPE FILL CONFIG ---
var shapeFillMode = 'Solid'; 
var shapeFillChar = '.';

// --- EXPORT OPTIONS ---
var exportTransparent = false; 

// --- DATA & BUFFERS ---
var grid = [];      
var colorGrid = []; 
var textColorGrid = []; 
var pgColorLayer;   
var pgTextLayer;    
var pgGridLayer; 
var templateImg;    
var libraryItems = []; 

// --- LAYERS (ASCII) ---
var asciiLayers = [];
var activeLayerIndex = 0;
var draggedLibItem = null; 

// VIEWPORT / RULER / SHADOWS
var viewX = 0, viewY = 0; 
var viewW = workCols * cellW; 
var viewH = workRows * cellH; 
var viewZoom = 1.0; 
var showRulers = true;
var shadowBoxes = ["█","▓","▒","░"];
var currentShadowIndex = 0;
var prevGrabMouse = null; 
var textToolInput = null; 

// --- STATE ---
var mainMode = "ASCII"; 
var toolMode = "DRAW";    
var selectedChar = "SMART"; 
var isEraser = false;
var selectedColor = "#FFFF00"; 
var isColorEraser = false;
var magicWandMatchMode = 'char';
var isShiftSelecting = false; 
var showTemplateImg = true;
var isDraggingPanel = false;

// --- MOUSE & SELECTION DRAGGING ---
var prevGridX = -1, prevGridY = -1;
var isDraggingSelection = false;
var dragOffsetX = 0, dragOffsetY = 0;
var floatingX = 0, floatingY = 0;
var imageTransformDrag = null;

// --- SLIDERS & FONT SIZE ---
var bgScale = 1.0, bgX = 0, bgY = 0, bgRotate = 0; 
var sliderScale, sliderX, sliderY, sliderRotate, sliderOpacity;   
var userFontSize = 12;

// --- HISTORY & CLIPBOARD (SKETCH) ---
var historyState = [];
var MAX_HISTORY = 20; 
var selStart = null, selEnd = null;
var selectionMask = null; 
var sketchRedoHistory = [];
var clipboard = null;
var layerClipboard = null;

// --- UI REFS ---
var sidebarDiv;
var mainCanvas; 

// --- PALETTE DATA ---
var palette = [
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
  window.activeTab = activeTab;
  if (typeof saveUiState === 'function') saveUiState();
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
    if (typeof loop === 'function') loop(); 
    if(window.pauseImageProcessor) window.pauseImageProcessor(); 
  } else if (tabId === 'tab-image-proc') {
    cnv.style.display = 'none';
    if (typeof noLoop === 'function') noLoop(); 
    if(window.resumeImageProcessor) window.resumeImageProcessor(); 
    if(window.startWebcamAuto) window.startWebcamAuto(); 
  } else {
    cnv.style.display = 'none';
    if (typeof noLoop === 'function') noLoop(); 
    if(window.pauseImageProcessor) window.pauseImageProcessor(); 
  }
}