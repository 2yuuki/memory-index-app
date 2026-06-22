// --- GLOBALS FOR APP INTEGRATION ---
var activeTab = 'tab-thoughts';

// --- CONFIG ---
var cols, rows;
var cellW = 8;
var cellH = 12;
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
var isRestoringUiState = false;
var isSketchUiReady = false;

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
  if (!document.getElementById(tabId)) {
      tabId = 'tab-sketch';
  }
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
  document.querySelectorAll('.workspace').forEach(w => {
    w.classList.remove('active');
    w.style.display = '';
  });
  let btn = document.querySelector(`[data-tab="${tabId}"]`);
  if(btn) {
    btn.classList.add('active');
    btn.style.color = 'var(--text-muted)';
    btn.style.webkitTextFillColor = 'var(--text-muted)';
  }
  let ws = document.getElementById(tabId);
  if(ws) ws.classList.add('active');
  if (tabId === 'tab-index') {
    if (typeof window.setupLayoutTab === 'function') window.setupLayoutTab();
    requestAnimationFrame(() => {
      if (typeof window.setupLayoutTab === 'function') window.setupLayoutTab();
    });
    setTimeout(() => {
      if (typeof window.setupLayoutTab === 'function') window.setupLayoutTab();
    }, 100);
  } else if (typeof window.hideLayoutToolsPanel === 'function') {
    window.hideLayoutToolsPanel();
  }
  if (tabId === 'tab-sketch' && typeof recoverSketchPanels === 'function') {
    recoverSketchPanels();
    if (typeof hasVisibleSketchPanel === 'function' &&
        typeof resetSketchPanelsToDefault === 'function' &&
        !hasVisibleSketchPanel()) {
      resetSketchPanelsToDefault();
    }
  }
  if (typeof updateSketchPanelsVisibility === 'function') updateSketchPanelsVisibility();
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

// --- LIBRARY FUNCTIONS ---
window.addToLibrary = function(imgOrDataUrl, name, extraData = {}) {
    let src = '';
    if (typeof imgOrDataUrl === 'string') {
        src = imgOrDataUrl;
    } else if (imgOrDataUrl.canvas) {
        src = imgOrDataUrl.canvas.toDataURL('image/png');
    } else if (imgOrDataUrl.elt) {
        src = imgOrDataUrl.elt.toDataURL('image/png');
    } else if (imgOrDataUrl instanceof HTMLCanvasElement) {
        src = imgOrDataUrl.toDataURL('image/png');
    } else {
        console.error("Unknown image format passed to addToLibrary");
        return;
    }

    let item = {
        id: 'lib_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: name || 'Memory',
        src: src,
        text: extraData.text || null
    };

    libraryItems.push(item);
    if (window.renderLibrary) window.renderLibrary();
    if (window.saveLibraryToLocalStorage) window.saveLibraryToLocalStorage();

    // Hiệu ứng chớp sáng trên nút Library
    let libBtn = document.getElementById('global-lib-btn');
    if (libBtn) {
        libBtn.classList.remove('lib-saved-anim');
        void libBtn.offsetWidth; 
        libBtn.classList.add('lib-saved-anim');
    }
    
    if (window.showToast) window.showToast("Added to Library!");
};

window.renderLibrary = function() {
    let grid = document.getElementById('lib-grid');
    if (!grid) return;
    grid.innerHTML = '';
    libraryItems.forEach(item => {
        let div = document.createElement('div');
        div.className = 'lib-item';
        div.draggable = true;
        div.dataset.src = item.src;
        div.title = 'Click to preview. Drag to place on canvas.';
        if (item.text) div.dataset.text = item.text;
        
        let img = document.createElement('img');
        img.src = item.src;
        div.appendChild(img);

        div.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', item.src);
            if (item.text) {
                e.dataTransfer.setData('application/json', JSON.stringify({type: 'thought', text: item.text}));
            }
        };

        div.onclick = () => {
            previewLibraryItem(item);
        };
        
        let delBtn = document.createElement('button');
        delBtn.innerHTML = 'x';
        delBtn.style.position = 'absolute';
        delBtn.style.top = '0';
        delBtn.style.right = '0';
        delBtn.style.background = '#e74c3c';
        delBtn.style.color = 'white';
        delBtn.style.border = 'none';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '10px';
        delBtn.style.padding = '2px 5px';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            libraryItems = libraryItems.filter(i => i.id !== item.id);
            renderLibrary();
            saveLibraryToLocalStorage();
        };
        div.appendChild(delBtn);
        div.style.position = 'relative';

        grid.appendChild(div);
    });
};

function previewLibraryItem(item) {
    if (!item || !item.src) return;
    const modal = document.getElementById('gallery-modal');
    const modalImg = document.getElementById('gallery-modal-img');
    const downloadBtn = document.getElementById('gallery-download-btn');
    if (!modal || !modalImg) return;

    modalImg.src = item.src;
    modalImg.alt = item.name || 'Library image';
    if (downloadBtn) {
        downloadBtn.style.display = 'inline-block';
        downloadBtn.dataset.src = item.src;
        downloadBtn.dataset.filename = getLibraryDownloadName(item);
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            downloadLibraryItem(item);
        };
    }
    modal.style.display = 'flex';
}

function downloadLibraryItem(item) {
    if (!item || !item.src) return;
    const a = document.createElement('a');
    a.href = item.src;
    a.download = getLibraryDownloadName(item);
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (window.showToast) window.showToast("Downloading image");
}

function getLibraryDownloadName(item) {
    const safeName = String(item.name || 'memory')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^a-z0-9_-]+/gi, '_')
        .replace(/^_+|_+$/g, '') || 'memory';
    const mimeMatch = String(item.src || '').match(/^data:image\/([^;,]+)/i);
    const ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'png';
    return `${safeName}.${ext}`;
}

window.saveLibraryToLocalStorage = function() {
    try {
        const itemsToSave = libraryItems.slice(-20); // Giữ lại 20 item mới nhất tránh tràn bộ nhớ đệm
        localStorage.setItem('mi_library', JSON.stringify(itemsToSave));
    } catch (e) {
        console.warn("Could not save library to localStorage", e);
    }
};

window.loadLibraryFromLocalStorage = function() {
    try {
        let data = localStorage.getItem('mi_library');
        if (data) {
            libraryItems = JSON.parse(data);
            if (window.renderLibrary) window.renderLibrary();
        }
    } catch(e) {
        console.warn("Could not load library", e);
    }
};

window.showToast = function(msg) {
    let t = document.getElementById('toast-notification');
    if(t) {
        t.innerText = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    }
};

window.exportLibraryToZip = function() {
    if (libraryItems.length === 0) {
        if (window.showToast) window.showToast("Library is empty!");
        return;
    }
    if (typeof JSZip === 'undefined') {
        alert("JSZip library is not loaded. Cannot export.");
        return;
    }
    
    let zip = new JSZip();
    
    libraryItems.forEach((item, index) => {
        let parts = item.src.split(',');
        if (parts.length === 2) {
            let base64Data = parts[1];
            let mime = parts[0].match(/:(.*?);/)[1];
            let ext = mime === 'image/jpeg' ? 'jpg' : 'png';
            zip.file(`${item.name}_${index}.${ext}`, base64Data, {base64: true});
        }
        if (item.text) {
            zip.file(`${item.name}_${index}_text.txt`, item.text);
        }
    });
    
    zip.generateAsync({type:"blob"}).then(function(content) {
        let a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        let now = new Date();
        let dateStr = now.getFullYear() + "-" +
                      String(now.getMonth() + 1).padStart(2, '0') + "-" +
                      String(now.getDate()).padStart(2, '0') + "_" +
                      String(now.getHours()).padStart(2, '0') + "-" +
                      String(now.getMinutes()).padStart(2, '0') + "-" +
                      String(now.getSeconds()).padStart(2, '0');
        a.download = `Memory_Archive_${dateStr}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        if (window.showToast) window.showToast("Exported to ZIP!");
    });
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.loadLibraryFromLocalStorage) window.loadLibraryFromLocalStorage();
    
    let btnExport = document.getElementById('btnExportLibrary');
    if (btnExport) {
        btnExport.addEventListener('click', window.exportLibraryToZip);
    }
});
