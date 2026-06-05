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


function preload() {} 

// --- SETUP ---
function setup() {
  frameRate(30); 
  pixelDensity(1); 
  templateImg = createImage(100, 100);
  
  mainCanvas = createCanvas(canvasW, canvasH);
  mainCanvas.id('myCanvas');
  mainCanvas.parent('sketch-canvas-holder'); 
  mainCanvas.style('touch-action', 'none');
  applySketchCanvasZoom();

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
    
    let jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
        try {
            let data = JSON.parse(jsonData);
            if (data.type === 'thought' && data.text) {
                dropTextAsAscii(data.text, e.clientX, e.clientY);
                return;
            }
        } catch(err) {}
    }
    
    const droppedFile = e.dataTransfer.files && e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type && droppedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => loadImage(reader.result, img => addImageLayer(img, reader.result, droppedFile.name || 'Dropped Image'));
      reader.readAsDataURL(droppedFile);
      return;
    }
    let data = e.dataTransfer.getData("text/plain");
    if (data && data.startsWith("data:image")) {
      loadImage(data, img => addImageLayer(img, data, "Dropped Image"));
    }
  };

  cols = workCols;
  rows = workRows;
  
  if (asciiLayers.length === 0) {
      addAsciiLayer("Layer 1");
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
  bindPanelToggle();
  setupSketchZoomUI();
  setupToolBindings();
  const sketchScrollArea = document.getElementById('sketch-scroll-area');
  if (sketchScrollArea) sketchScrollArea.addEventListener('scroll', saveUiState);
  restoreUiState();
  renderPropertiesUI();
  updateLayerTextVisuals(); 

  let starBtn = document.getElementById('btnShapeStar');
  if (starBtn) starBtn.style.display = 'none';
  let heartBtn = document.getElementById('btnShapeHeart');
  if (heartBtn) heartBtn.style.display = 'none';
  const tab4Btn = document.querySelector('[data-tab="tab-index"]');
  if (tab4Btn) tab4Btn.style.display = 'none';

  const performAutoSave = () => {
      saveToLocalStorage(true); 
      saveUiState();
  };
  window.addEventListener('pagehide', performAutoSave);
  window.addEventListener('beforeunload', performAutoSave);
  document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') performAutoSave();
  });

  window.switchTab(getLastActiveTab());
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
    let panelHost = document.getElementById('tab-sketch');
    if (!canvasHolder) return;
    canvasHolder.style.position = 'relative';
    if (!panelHost) panelHost = canvasHolder;
    panelHost.style.position = 'relative';

    const defaults = {
        'sketch-main-tools': { right: 20, top: 20 },
        'sketch-export-panel': { right: 20, top: 275 },
        'sketch-patterns-panel': { right: 20, top: 390 },
        'sketch-ink-panel': { right: 20, top: 645 },
        'sketch-layer-panel': { right: 20, top: 760 },
        'sketch-properties-panel': { right: 320, top: 20 }
    };

    Object.keys(defaults).forEach(id => {
        let p = document.getElementById(id);
        if (p) {
            panelHost.appendChild(p);
            p.style.position = 'absolute';
            p.style.left = 'auto';
            p.style.right = defaults[id].right + 'px';
            p.style.top = defaults[id].top + 'px';
            p.style.width = '280px';
            p.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            p.style.border = '1px solid #ddd';
            p.style.background = 'rgba(255, 255, 255, 0.95)';
            p.style.borderRadius = '5px';
            p.style.pointerEvents = 'auto'; 
            p.style.zIndex = '1500';
            makePanelDraggable(p, panelHost);
        }
    });

    restoreUiState();
}

function bindPanelToggle() {
    document.querySelectorAll('.panel-minimize-btn').forEach(btn => {
        let newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = (e) => {
            e.stopPropagation(); 
            let panel = e.target.closest('.floating-panel');
            if (panel) {
                let content = panel.querySelector('.panel-content');
                if (content) {
                    if (content.style.display === 'none') {
                        content.style.display = '';
                        newBtn.innerHTML = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIyIiB2aWV3Qm94PSIwIDAgMTAgMiI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjIiIGZpbGw9IiNmZmYiLz48L3N2Zz4=" class="pixel-icon" style="width:10px;height:2px;background:#fff;">';
                    } else {
                        content.style.display = 'none';
                        newBtn.innerHTML = '<span style="color:#0072BC; font-weight:bold; font-size:14px; line-height:0.5; display:flex; align-items:center; justify-content:center;">+</span>';
                    }
                }
            }
        };
    });
}

function getUiState() {
    const panels = {};
    const sketchScroll = document.getElementById('sketch-scroll-area');
    ['sketch-main-tools', 'sketch-export-panel', 'sketch-patterns-panel', 'sketch-ink-panel', 'sketch-layer-panel', 'sketch-properties-panel'].forEach(id => {
        const panel = document.getElementById(id);
        if (!panel) return;
        panels[id] = {
            left: panel.style.left,
            right: panel.style.right,
            top: panel.style.top,
            display: panel.style.display
        };
    });
    return {
        activeTab: activeTab,
        viewX: viewX,
        viewY: viewY,
        viewZoom: viewZoom,
        canvasCols: workCols,
        canvasRows: workRows,
        canvasRatioPreset: canvasRatioPreset,
        toolMode: toolMode,
        selectedChar: selectedChar,
        selectedColor: selectedColor,
        magicWandMatchMode: magicWandMatchMode,
        showRulers: showRulers,
        activeLayerIndex: activeLayerIndex,
        sketchScrollLeft: sketchScroll ? sketchScroll.scrollLeft : 0,
        sketchScrollTop: sketchScroll ? sketchScroll.scrollTop : 0,
        panels: panels
    };
}

function saveUiState() {
    try {
        localStorage.setItem('mi_ui_state', JSON.stringify(getUiState()));
    } catch (e) {}
}

function applySketchCanvasZoom() {
    if (!mainCanvas || !mainCanvas.elt) return;
    mainCanvas.elt.style.width = Math.round(canvasW * viewZoom) + 'px';
    mainCanvas.elt.style.height = Math.round(canvasH * viewZoom) + 'px';
    mainCanvas.elt.style.maxWidth = 'none';
    mainCanvas.elt.style.maxHeight = 'none';
    const zoomVal = document.getElementById('sketch-zoom-val');
    if (zoomVal) zoomVal.textContent = Math.round(viewZoom * 100) + '%';
}

function restoreUiState() {
    try {
        const raw = localStorage.getItem('mi_ui_state');
        if (!raw) return;
        const state = JSON.parse(raw);
        if (Number.isFinite(state.viewX)) viewX = constrain(state.viewX, 0, width - viewW);
        if (Number.isFinite(state.viewY)) viewY = constrain(state.viewY, 0, height - viewH);
        if (Number.isFinite(state.viewZoom)) viewZoom = constrain(state.viewZoom, 0.1, 5.0);
        if (state.canvasRatioPreset) canvasRatioPreset = state.canvasRatioPreset;
        if (state.toolMode) toolMode = state.toolMode;
        if (state.selectedChar) selectedChar = state.selectedChar;
        if (state.selectedColor !== undefined) selectedColor = state.selectedColor;
        if (state.magicWandMatchMode === 'char' || state.magicWandMatchMode === 'color') {
            magicWandMatchMode = state.magicWandMatchMode;
        }
        if (typeof state.showRulers === 'boolean') showRulers = state.showRulers;
        if (Number.isInteger(state.activeLayerIndex) && asciiLayers[state.activeLayerIndex]) {
            activeLayerIndex = state.activeLayerIndex;
            const l = asciiLayers[activeLayerIndex];
            grid = l.grid; colorGrid = l.colorGrid; textColorGrid = l.textColorGrid; pgColorLayer = l.pgColor; pgTextLayer = l.pgText;
        }
        if (state.panels) {
            Object.keys(state.panels).forEach(id => {
                const panel = document.getElementById(id);
                const panelState = state.panels[id];
                if (!panel || !panelState) return;
                if (panelState.left) panel.style.left = panelState.left;
                if (panelState.right) panel.style.right = panelState.right;
                if (panelState.top) panel.style.top = panelState.top;
                if (panelState.display) panel.style.display = panelState.display;
            });
        }
        const sketchScroll = document.getElementById('sketch-scroll-area');
        if (sketchScroll) {
            if (Number.isFinite(state.sketchScrollLeft)) sketchScroll.scrollLeft = state.sketchScrollLeft;
            if (Number.isFinite(state.sketchScrollTop)) sketchScroll.scrollTop = state.sketchScrollTop;
        }
        applySketchCanvasZoom();
    } catch (e) {}
}

function setToolMode(nextMode, options = {}) {
    const previousTool = toolMode;
    toolMode = nextMode;
    
    // Tự động deselect nếu đổi sang tool không liên quan đến select
    if (toolMode !== 'MAGIC_WAND' && toolMode !== 'SELECT' && toolMode !== 'MOUSE') {
        selectionMask = null;
        selStart = null;
        selEnd = null;
    }
    
    if (options.render !== false) renderPropertiesUI();
    if (options.save !== false) saveUiState();
}

function getLastActiveTab() {
    try {
        const raw = localStorage.getItem('mi_ui_state');
        if (!raw) return 'tab-thoughts';
        const state = JSON.parse(raw);
        return state.activeTab === 'tab-index' ? 'tab-sketch' : (state.activeTab || 'tab-thoughts');
    } catch (e) {
        return 'tab-thoughts';
    }
}

function makePanelDraggable(panel, boundsEl) {
    if (!panel || panel.dataset.miDraggable === 'true') return;
    const header = panel.querySelector('.panel-header') || panel.querySelector('.panel-title');
    if (!header) return;
    panel.dataset.miDraggable = 'true';
    header.style.cursor = 'move';

    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    const movePanel = (clientX, clientY) => {
        const dx = clientX - startX;
        const dy = clientY - startY;
        const maxLeft = Math.max(0, boundsEl.clientWidth - panel.offsetWidth);
        const maxTop = Math.max(0, boundsEl.clientHeight - panel.offsetHeight);
        panel.style.left = constrain(originLeft + dx, 0, maxLeft) + 'px';
        panel.style.top = constrain(originTop + dy, 0, maxTop) + 'px';
        panel.style.right = 'auto';
    };

    const stopDrag = () => {
        isDraggingPanel = false;
        saveUiState();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', stopDrag);
    };

    const onMouseMove = (e) => {
        e.preventDefault();
        movePanel(e.clientX, e.clientY);
    };

    const onTouchMove = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        e.preventDefault();
        movePanel(e.touches[0].clientX, e.touches[0].clientY);
    };

    const startDrag = (clientX, clientY) => {
        isDraggingPanel = true;
        startX = clientX;
        startY = clientY;
        originLeft = parseFloat(panel.style.left) || panel.offsetLeft || 0;
        originTop = parseFloat(panel.style.top) || panel.offsetTop || 0;
        panel.style.zIndex = String(Date.now());
    };

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, select, textarea, a')) return;
        e.preventDefault();
        e.stopPropagation();
        startDrag(e.clientX, e.clientY);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stopDrag);
    });

    header.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length === 0 || e.target.closest('button, input, select, textarea, a')) return;
        e.preventDefault();
        e.stopPropagation();
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', stopDrag);
    }, { passive: false });
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
        btn.style.fontFamily = 'Consolas, monospace';
        btn.style.border = '1px solid #ccc';
        btn.style.background = '#fafafa';
        btn.onclick = () => { selectedChar = char; };
        patPanel.appendChild(btn);
    });
}

function renderInkUI() {
    let colorsContainer = document.querySelector('#sketch-colors');
    if (!colorsContainer) return;
    colorsContainer.innerHTML = '';
    
        let customInput = document.getElementById('customInkColor');
        if (customInput && !customInput.oninput) {
            customInput.oninput = (e) => {
                selectedColor = e.target.value;
                setToolMode('INK');
            };
        }

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
            setToolMode('INK');
            let customInput = document.getElementById('customInkColor');
            if (customInput && c) customInput.value = c;
        };
        colorsContainer.appendChild(btn);
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
    addBtn.onclick = () => { addAsciiLayer('Layer ' + (asciiLayers.length + 1)); renderLayersUI(); saveToLocalStorage(true); saveUiState(); };
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
        div.draggable = true;
        div.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', String(i));
        };
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (!Number.isInteger(fromIndex) || fromIndex === i) return;
            moveLayer(fromIndex, i);
        };
        div.onclick = () => { 
            setActiveLayer(i);
            renderLayersUI(); 
            renderPropertiesUI();
            saveToLocalStorage(true);
            saveUiState();
        };
        
        let name = document.createElement('span');
        name.textContent = (l.kind === 'image' ? '[IMG] ' : '') + l.name;
        name.title = 'Click to rename layer';
        name.onclick = (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = l.name;
            input.style.width = '120px';
            const commit = () => {
                l.name = input.value.trim() || l.name;
                renderLayersUI();
                renderPropertiesUI();
                saveToLocalStorage(true);
                saveUiState();
            };
            input.onblur = commit;
            input.onkeydown = (evt) => {
                if (evt.key === 'Enter') input.blur();
                if (evt.key === 'Escape') renderLayersUI();
            };
            name.replaceWith(input);
            input.focus();
            input.select();
        };
        div.appendChild(name);

        let controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '4px';
        
        let visBtn = document.createElement('button');
        visBtn.textContent = l.visible ? '👁' : '🙈';
        visBtn.onclick = (e) => { e.stopPropagation(); l.visible = !l.visible; renderLayersUI(); saveToLocalStorage(true); saveUiState(); };
        controls.appendChild(visBtn);

        let lockBtn = document.createElement('button');
        lockBtn.textContent = l.locked ? '🔒' : '🔓';
        lockBtn.title = l.locked ? 'Unlock layer' : 'Lock layer';
        lockBtn.onclick = (e) => {
            e.stopPropagation();
            l.locked = !l.locked;
            renderLayersUI();
            renderPropertiesUI();
            saveToLocalStorage(true);
            saveUiState();
        };
        controls.appendChild(lockBtn);
        div.appendChild(controls);
        
        layPanel.appendChild(div);
    });
}

function createUI() {
  try {
    if (window.__mi_ui_initialized) return;
    window.__mi_ui_initialized = true;

    const panelHost = document.getElementById('tab-sketch') || document.getElementById('sketch-canvas-holder');
    if (!panelHost) return;
    createPropertiesPanel(panelHost);
  } catch (e) {}
}

function createPropertiesPanel(panelHost) {
    if (document.getElementById('sketch-properties-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'sketch-properties-panel';
    panel.className = 'floating-panel';
    panel.style.position = 'absolute';
    panel.style.right = '320px';
    panel.style.top = '20px';
    panel.style.width = '280px';
    panel.style.background = 'rgba(255, 255, 255, 0.95)';
    panel.style.border = '1px solid #ddd';
    panel.style.borderRadius = '5px';
    panel.style.pointerEvents = 'auto';
    panel.style.zIndex = '1500';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<span>Properties</span><button class="panel-minimize-btn" type="button">-</button>';
    panel.appendChild(header);

    const content = document.createElement('div');
    content.id = 'sketch-properties-content';
    content.className = 'panel-content';
    content.style.padding = '10px';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '8px';
    panel.appendChild(content);

    panelHost.appendChild(panel);
    makePanelDraggable(panel, panelHost);
    renderPropertiesUI();
}

function renderPropertiesUI() {
    const content = document.getElementById('sketch-properties-content');
    if (!content) return;
    const layer = getActiveLayer();
    content.innerHTML = '';

    renderCanvasProperties(content);
    renderShapeProperties(content);
    renderMagicWandProperties(content);

    if (!layer) return;
    
    const opacityLabel = document.createElement('label');
    opacityLabel.style.fontSize = '11px';
    opacityLabel.textContent = 'Opacity';
    const opacity = document.createElement('input');
    opacity.type = 'range';
    opacity.min = '0';
    opacity.max = '255';
    opacity.step = '1';
    let defaultOpacity = layer.kind === 'image' ? 180 : 255;
    opacity.value = layer.imgOpacity === undefined ? defaultOpacity : layer.imgOpacity;
    opacity.disabled = !!layer.locked;
    opacity.oninput = () => {
        if (layer.locked) return;
        layer.imgOpacity = parseFloat(opacity.value);
        saveToLocalStorage(true);
        saveUiState();
    };
    opacityLabel.appendChild(opacity);
    content.appendChild(opacityLabel);

    const blendLabel = document.createElement('label');
    blendLabel.style.fontSize = '11px';
    blendLabel.textContent = 'Blend Mode';
    const blendSelect = document.createElement('select');
    ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'add'].forEach(mode => {
        const option = document.createElement('option');
        option.value = mode;
        option.textContent = mode;
        blendSelect.appendChild(option);
    });
    blendSelect.value = layer.blendMode || 'normal';
    blendSelect.disabled = !!layer.locked;
    blendSelect.onchange = () => {
        if (layer.locked) return;
        layer.blendMode = blendSelect.value;
        saveToLocalStorage(true);
        saveUiState();
    };
    blendLabel.appendChild(blendSelect);
    content.appendChild(blendLabel);

    if (layer.kind !== 'image') {
        if (!toolMode.startsWith('SHAPE_') && toolMode !== 'MAGIC_WAND') {
            const note = document.createElement('div');
            note.style.fontSize = '11px';
            note.textContent = 'Select an image layer to edit alignment and dither.';
            content.appendChild(note);
        }
        return;
    }

    const alignWrap = document.createElement('div');
    alignWrap.style.display = 'grid';
    alignWrap.style.gridTemplateColumns = 'repeat(3, 1fr)';
    alignWrap.style.gap = '4px';
    [
        ['Left', () => layer.imgCellX = 0],
        ['Center', () => layer.imgCellX = Math.round((workCols - getImageCellBounds(layer).w) / 2)],
        ['Right', () => layer.imgCellX = workCols - getImageCellBounds(layer).w],
        ['Top', () => layer.imgCellY = 0],
        ['Middle', () => layer.imgCellY = Math.round((workRows - getImageCellBounds(layer).h) / 2)],
        ['Bottom', () => layer.imgCellY = workRows - getImageCellBounds(layer).h]
    ].forEach(([labelText, action]) => {
        const btn = document.createElement('button');
        btn.className = 'btn-retro';
        btn.textContent = labelText;
        btn.disabled = !!layer.locked;
        btn.onclick = () => {
            if (layer.locked) return;
            action();
            saveToLocalStorage(true);
            saveUiState();
        };
        alignWrap.appendChild(btn);
    });
    content.appendChild(alignWrap);

    const ditherLabel = document.createElement('label');
    ditherLabel.className = 'chk';
    const ditherInput = document.createElement('input');
    ditherInput.type = 'checkbox';
    ditherInput.checked = !!layer.dither;
    ditherInput.disabled = !!layer.locked;
    ditherInput.onchange = () => {
        if (layer.locked) return;
        layer.dither = ditherInput.checked;
        saveToLocalStorage(true);
        saveUiState();
    };
    ditherLabel.appendChild(ditherInput);
    ditherLabel.appendChild(document.createTextNode(' Dither Image'));
    content.appendChild(ditherLabel);

    const convertBtn = document.createElement('button');
    convertBtn.className = 'btn-retro';
    convertBtn.textContent = 'Convert Image to ASCII';
    convertBtn.disabled = !!layer.locked;
    convertBtn.onclick = () => convertImageLayerToAscii(layer);
    content.appendChild(convertBtn);
}

function renderCanvasProperties(content) {
    const title = document.createElement('div');
    title.className = 'panel-subtitle';
    title.textContent = 'Canvas';
    content.appendChild(title);

    const presetLabel = document.createElement('label');
    presetLabel.textContent = 'Ratio';
    const presetSelect = document.createElement('select');
    [
        ['4:3', '4:3'],
        ['16:9', '16:9'],
        ['1:1', '1:1'],
        ['a4', 'A4 Portrait'],
        ['custom', 'Custom']
    ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        presetSelect.appendChild(option);
    });
    presetSelect.value = canvasRatioPreset;
    presetLabel.appendChild(presetSelect);
    content.appendChild(presetLabel);

    const sizeWrap = document.createElement('div');
    sizeWrap.style.display = 'grid';
    sizeWrap.style.gridTemplateColumns = '1fr 1fr';
    sizeWrap.style.gap = '6px';

    const colsLabel = document.createElement('label');
    colsLabel.textContent = 'Cols';
    const colsInput = document.createElement('input');
    colsInput.type = 'number';
    colsInput.min = '8';
    colsInput.max = '400';
    colsInput.step = '1';
    colsInput.value = workCols;
    colsLabel.appendChild(colsInput);

    const rowsLabel = document.createElement('label');
    rowsLabel.textContent = 'Rows';
    const rowsInput = document.createElement('input');
    rowsInput.type = 'number';
    rowsInput.min = '8';
    rowsInput.max = '300';
    rowsInput.step = '1';
    rowsInput.value = workRows;
    rowsLabel.appendChild(rowsInput);

    sizeWrap.appendChild(colsLabel);
    sizeWrap.appendChild(rowsLabel);
    content.appendChild(sizeWrap);

    presetSelect.onchange = () => {
        canvasRatioPreset = presetSelect.value;
        if (canvasRatioPreset !== 'custom') {
            const nextSize = getCanvasPresetSize(canvasRatioPreset);
            colsInput.value = nextSize.cols;
            rowsInput.value = nextSize.rows;
        }
        saveUiState();
    };

    colsInput.oninput = () => {
        if (canvasRatioPreset !== 'custom') {
            const presetRatios = { '4:3': 4 / 3, '16:9': 16 / 9, '1:1': 1, 'a4': 1 / Math.sqrt(2) };
            const ratio = presetRatios[canvasRatioPreset];
            if (ratio) {
                let c = parseInt(colsInput.value, 10) || 8;
                rowsInput.value = Math.max(8, Math.round((c * cellW) / (ratio * cellH)));
            }
        }
    };
    rowsInput.oninput = () => {
        if (canvasRatioPreset !== 'custom') {
            const presetRatios = { '4:3': 4 / 3, '16:9': 16 / 9, '1:1': 1, 'a4': 1 / Math.sqrt(2) };
            const ratio = presetRatios[canvasRatioPreset];
            if (ratio) {
                let r = parseInt(rowsInput.value, 10) || 8;
                colsInput.value = Math.max(8, Math.round((r * cellH * ratio) / cellW));
            }
        }
    };

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn-retro';
    applyBtn.textContent = 'Apply Canvas Size';
    applyBtn.onclick = () => {
        const nextCols = constrain(parseInt(colsInput.value, 10) || workCols, 8, 400);
        const nextRows = constrain(parseInt(rowsInput.value, 10) || workRows, 8, 300);
        setCanvasGridSize(nextCols, nextRows);
    };
    content.appendChild(applyBtn);
}

function renderShapeProperties(content) {
    if (!toolMode.startsWith('SHAPE_')) return;

    const title = document.createElement('div');
    title.className = 'panel-subtitle';
    title.textContent = 'Shape';
    content.appendChild(title);

    const rulerBtn = document.createElement('button');
    rulerBtn.id = 'toggle-rulers';
    rulerBtn.type = 'button';
    rulerBtn.className = 'btn-retro';
    rulerBtn.textContent = showRulers ? 'Hide Rulers' : 'Show Rulers';
    rulerBtn.onclick = () => {
        showRulers = !showRulers;
        renderPropertiesUI();
        saveUiState();
    };
    content.appendChild(rulerBtn);

    const shadowLabel = document.createElement('label');
    shadowLabel.textContent = 'Shadow';
    const shadowSel = document.createElement('select');
    shadowBoxes.forEach((s, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = s;
        shadowSel.appendChild(o);
    });
    shadowSel.value = currentShadowIndex;
    shadowSel.onchange = () => { currentShadowIndex = parseInt(shadowSel.value, 10) || 0; saveUiState(); };
    shadowLabel.appendChild(shadowSel);
    content.appendChild(shadowLabel);

    const fillLabel = document.createElement('label');
    fillLabel.textContent = 'Fill';
    const fillSel = document.createElement('select');
    ['Hollow', 'Solid', 'Space'].forEach(m => {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = m;
        fillSel.appendChild(o);
    });
    fillSel.value = shapeFillMode;
    fillSel.onchange = () => { shapeFillMode = fillSel.value; saveUiState(); };
    fillLabel.appendChild(fillSel);
    content.appendChild(fillLabel);

    const charLabel = document.createElement('label');
    charLabel.textContent = 'Fill Char';
    const fillCharInput = document.createElement('input');
    fillCharInput.type = 'text';
    fillCharInput.maxLength = 1;
    fillCharInput.value = shapeFillChar;
    fillCharInput.oninput = () => { shapeFillChar = fillCharInput.value || ' '; saveUiState(); };
    charLabel.appendChild(fillCharInput);
    content.appendChild(charLabel);
}

function renderMagicWandProperties(content) {
    if (toolMode !== 'MAGIC_WAND') return;

    const title = document.createElement('div');
    title.className = 'panel-subtitle';
    title.textContent = 'Magic Wand';
    content.appendChild(title);

    const modeLabel = document.createElement('label');
    modeLabel.textContent = 'Match';
    const modeSelect = document.createElement('select');
    [
        ['char', 'Same character'],
        ['color', 'Same cell color']
    ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        modeSelect.appendChild(option);
    });
    modeSelect.value = magicWandMatchMode;
    modeSelect.onchange = () => {
        magicWandMatchMode = modeSelect.value;
        saveUiState();
    };
    modeLabel.appendChild(modeSelect);
    content.appendChild(modeLabel);
}

function getCanvasPresetSize(preset) {
    const presetRatios = {
        '4:3': 4 / 3,
        '16:9': 16 / 9,
        '1:1': 1,
        'a4': 1 / Math.sqrt(2)
    };
    if (preset === '16:9') return { cols: 160, rows: 60 };
    if (preset === '4:3') return { cols: 120, rows: 60 };
    if (preset === '1:1') return { cols: 90, rows: 60 };
    const ratio = presetRatios[preset] || presetRatios['16:9'];
    const baseCols = preset === 'a4' ? 100 : 160;
    return {
        cols: baseCols,
        rows: Math.max(8, Math.round((baseCols * cellW) / (ratio * cellH)))
    };
}

function updateCanvasGeometry(nextCols, nextRows) {
    workCols = Math.max(8, Math.round(nextCols));
    workRows = Math.max(8, Math.round(nextRows));
    canvasW = workCols * cellW;
    canvasH = workRows * cellH;
    viewW = canvasW;
    viewH = canvasH;
    cols = workCols;
    rows = workRows;
    viewX = constrain(viewX, 0, Math.max(0, canvasW - viewW));
    viewY = constrain(viewY, 0, Math.max(0, canvasH - viewH));

    if (typeof resizeCanvas === 'function' && mainCanvas) {
        resizeCanvas(canvasW, canvasH);
    }
    pgGridLayer = createGraphics(canvasW, canvasH);
    pgGridLayer.pixelDensity(1);
    preRenderGrid(pgGridLayer);
    applySketchCanvasZoom();
}

function rebuildLayerGraphics(layer) {
    if (!layer) return;
    layer.grid = normalizeGridArray(layer.grid, "");
    layer.colorGrid = normalizeGridArray(layer.colorGrid, null);
    layer.textColorGrid = normalizeGridArray(layer.textColorGrid, "#000000");
    layer.pgColor = createGraphics(canvasW, canvasH);
    layer.pgColor.pixelDensity(1);
    layer.pgText = createGraphics(canvasW, canvasH);
    layer.pgText.pixelDensity(1);
    if (layer.kind === 'image') {
        const b = getImageCellBounds(layer);
        layer.imgCellX = b.x;
        layer.imgCellY = b.y;
        layer.imgCellW = b.w;
        layer.imgCellH = b.h;
    }
}

function refreshAllLayerGraphics() {
    const active = getActiveLayer();
    asciiLayers.forEach(layer => {
        rebuildLayerGraphics(layer);
        const prevGrid = grid;
        const prevColorGrid = colorGrid;
        const prevTextColorGrid = textColorGrid;
        const prevColorLayer = pgColorLayer;
        const prevTextLayer = pgTextLayer;
        grid = layer.grid;
        colorGrid = layer.colorGrid;
        textColorGrid = layer.textColorGrid;
        pgColorLayer = layer.pgColor;
        pgTextLayer = layer.pgText;
        updateLayerColorVisuals();
        updateLayerTextVisuals();
        grid = prevGrid;
        colorGrid = prevColorGrid;
        textColorGrid = prevTextColorGrid;
        pgColorLayer = prevColorLayer;
        pgTextLayer = prevTextLayer;
    });
    activeLayerIndex = Math.max(0, asciiLayers.indexOf(active));
    if (!asciiLayers[activeLayerIndex]) activeLayerIndex = 0;
    setActiveLayer(activeLayerIndex);
}

function setCanvasGridSize(nextCols, nextRows) {
    syncActiveAsciiLayer();
    updateCanvasGeometry(nextCols, nextRows);
    refreshAllLayerGraphics();
    selectionMask = null;
    selStart = null;
    selEnd = null;
    renderLayersUI();
    renderPropertiesUI();
    historyState = [];
    sketchRedoHistory = [];
    saveState();
    saveToLocalStorage(true);
    saveUiState();
}

function convertImageLayerToAscii(layer) {
    if (!layer || layer.kind !== 'image' || !layer.img || layer.locked) return;
    const chars = " .:-=+*#%@";
    const bayer4 = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ];
    const img = layer.img;
    img.loadPixels();

    addAsciiLayer((layer.name || 'Image') + ' ASCII');
    const target = getActiveLayer();
    target.locked = false;

    const bounds = getImageCellBounds(layer);

    for (let y = 0; y < workRows; y++) {
        for (let x = 0; x < workCols; x++) {
            if (x < bounds.x || x >= bounds.x + bounds.w || y < bounds.y || y >= bounds.y + bounds.h) continue;
            const localX = ((x - bounds.x + 0.5) / bounds.w) * img.width;
            const localY = ((y - bounds.y + 0.5) / bounds.h) * img.height;
            const sx = Math.floor(localX);
            const sy = Math.floor(localY);
            if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
            const idx = 4 * (sy * img.width + sx);
            const r = img.pixels[idx] || 0;
            const g = img.pixels[idx + 1] || 0;
            const b = img.pixels[idx + 2] || 0;
            const a = img.pixels[idx + 3] === undefined ? 255 : img.pixels[idx + 3];
            if (a < 20) continue;
            let bright = (r + g + b) / 3;
            if (layer.dither) {
                const threshold = ((bayer4[y % 4][x % 4] / 15) - 0.5) * 64;
                bright = constrain(bright + threshold, 0, 255);
            }
            const charIndex = Math.floor(map(bright, 255, 0, 0, chars.length - 1));
            grid[y][x] = chars[constrain(charIndex, 0, chars.length - 1)];
            textColorGrid[y][x] = '#000000';
        }
    }

    updateLayerTextVisuals();
    updateLayerColorVisuals();
    renderLayersUI();
    renderPropertiesUI();
    saveState();
    saveToLocalStorage(true);
    saveUiState();
}

function getImageHalfWidth(layer) {
    return layer ? (getImageCellBounds(layer).w * cellW) / 2 : 0;
}

function getImageHalfHeight(layer) {
    return layer ? (getImageCellBounds(layer).h * cellH) / 2 : 0;
}

function applyImageBlendMode(layer) {
    const mode = layer.blendMode || 'normal';
    if (mode === 'multiply') blendMode(MULTIPLY);
    else if (mode === 'screen') blendMode(SCREEN);
    else if (mode === 'overlay') blendMode(OVERLAY);
    else if (mode === 'darken') blendMode(DARKEST);
    else if (mode === 'lighten') blendMode(LIGHTEST);
    else if (mode === 'color-dodge') blendMode(DODGE);
    else if (mode === 'color-burn') blendMode(BURN);
    else if (mode === 'hard-light') blendMode(HARD_LIGHT);
    else if (mode === 'soft-light') blendMode(SOFT_LIGHT);
    else if (mode === 'difference') blendMode(DIFFERENCE);
    else if (mode === 'exclusion') blendMode(EXCLUSION);
    else if (mode === 'add') blendMode(ADD);
    else blendMode(BLEND);
}

function drawImageTransformBox(layer) {
    if (!layer || layer.kind !== 'image' || !layer.img || !layer.visible) return;
    const b = getImageCellBounds(layer);
    const x = b.x * cellW;
    const y = b.y * cellH;
    const w = b.w * cellW;
    const h = b.h * cellH;
    push();
    noFill();
    stroke(layer.locked ? 160 : 0, layer.locked ? 160 : 150, 255);
    strokeWeight(2);
    drawingContext.setLineDash([6, 4]);
    rect(x, y, w, h);
    drawingContext.setLineDash([]);
    fill(255);
    stroke(0, 150, 255);
    const s = 10;
    [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(([hx, hy]) => rect(hx - s / 2, hy - s / 2, s, s));
    pop();
}

function getImageLocalPoint(layer, x, y) {
    const b = getImageCellBounds(layer);
    return { x: x - (b.x * cellW), y: y - (b.y * cellH) };
}

function hitImageTransform(layer, x, y) {
    if (!layer || layer.kind !== 'image' || !layer.img || layer.locked || !layer.visible) return null;
    const b = getImageCellBounds(layer);
    const left = b.x * cellW;
    const top = b.y * cellH;
    const w = b.w * cellW;
    const h = b.h * cellH;
    const handle = 12;
    const corners = [
        { name: 'nw', x: left, y: top },
        { name: 'ne', x: left + w, y: top },
        { name: 'se', x: left + w, y: top + h },
        { name: 'sw', x: left, y: top + h }
    ];
    for (const corner of corners) {
        if (Math.abs(x - corner.x) <= handle && Math.abs(y - corner.y) <= handle) return { type: 'scale', corner: corner.name };
    }
    if (x >= left && x <= left + w && y >= top && y <= top + h) return { type: 'move' };
    return null;
}

function handleFile(file) {
  try {
    if (!file) return;
    const fileName = (file.name || '').toLowerCase();
    const fileData = file.data || '';
    if (fileName.endsWith('.svg') || String(fileData).startsWith('data:image/svg')) {
      importAsciiSvgText(svgDataToText(fileData));
    } else if (file.type === 'image') {
      if (file.data) loadImage(file.data, img => addImageLayer(img, file.data, file.name || 'Image Layer'));
    } else if (typeof file === 'string' && file.startsWith('data:image')) {
      loadImage(file, img => addImageLayer(img, file, 'Image Layer'));
    }
  } catch (e) {}
}

function svgDataToText(data) {
  if (!data) return "";
  if (!String(data).startsWith('data:')) return String(data);
  const parts = String(data).split(',');
  if (parts.length < 2) return "";
  if (parts[0].includes(';base64')) return atob(parts[1]);
  return decodeURIComponent(parts.slice(1).join(','));
}

function clearActiveAsciiLayer() {
  if (!asciiLayers[activeLayerIndex]) addAsciiLayer("Layer 1");
  grid = asciiLayers[activeLayerIndex].grid;
  colorGrid = asciiLayers[activeLayerIndex].colorGrid;
  textColorGrid = asciiLayers[activeLayerIndex].textColorGrid;
  pgColorLayer = asciiLayers[activeLayerIndex].pgColor;
  pgTextLayer = asciiLayers[activeLayerIndex].pgText;

  for (let y = 0; y < workRows; y++) {
    for (let x = 0; x < workCols; x++) {
      ensureGridCell(x, y);
      grid[y][x] = "";
      colorGrid[y][x] = null;
      textColorGrid[y][x] = "#000000";
    }
  }
}

function normalizeGridArray(source, fallbackValue) {
  const next = [];
  for (let y = 0; y < workRows; y++) {
    next[y] = [];
    const row = Array.isArray(source && source[y]) ? source[y] : [];
    for (let x = 0; x < workCols; x++) {
      next[y][x] = row[x] !== undefined ? row[x] : fallbackValue;
    }
  }
  return next;
}

function normalizeAsciiLayer(layer) {
  if (!layer) return;
  if (!layer.kind) layer.kind = 'ascii';
  if (typeof layer.locked !== 'boolean') layer.locked = false;
  layer.grid = normalizeGridArray(layer.grid, "");
  layer.colorGrid = normalizeGridArray(layer.colorGrid, null);
  layer.textColorGrid = normalizeGridArray(layer.textColorGrid, "#000000");
}

function setActiveLayer(index) {
  if (!asciiLayers[index]) return;
  activeLayerIndex = index;
  const l = asciiLayers[activeLayerIndex];
  grid = l.grid;
  colorGrid = l.colorGrid;
  textColorGrid = l.textColorGrid;
  pgColorLayer = l.pgColor;
  pgTextLayer = l.pgText;
}

function moveLayer(fromIndex, toIndex) {
  if (!asciiLayers[fromIndex] || !asciiLayers[toIndex]) return;
  const activeLayer = getActiveLayer();
  const [moved] = asciiLayers.splice(fromIndex, 1);
  asciiLayers.splice(toIndex, 0, moved);
  activeLayerIndex = Math.max(0, asciiLayers.indexOf(activeLayer));
  setActiveLayer(activeLayerIndex);
  renderLayersUI();
  renderPropertiesUI();
  saveToLocalStorage(true);
  saveUiState();
}

function cloneLayerForClipboard(layer) {
  if (!layer) return null;
  const copy = {
    kind: layer.kind || 'ascii',
    name: layer.name,
    grid: normalizeGridArray(layer.grid, ""),
    colorGrid: normalizeGridArray(layer.colorGrid, null),
    textColorGrid: normalizeGridArray(layer.textColorGrid, "#000000"),
    visible: layer.visible !== false,
    locked: false,
    imageData: layer.imageData || null,
    img: layer.img || null,
    imgX: layer.imgX,
    imgY: layer.imgY,
    imgScale: layer.imgScale,
    imgCellX: layer.imgCellX,
    imgCellY: layer.imgCellY,
    imgCellW: layer.imgCellW,
    imgCellH: layer.imgCellH,
    imgRotate: layer.imgRotate,
    imgOpacity: layer.imgOpacity,
    blendMode: layer.blendMode || 'normal',
    dither: !!layer.dither
  };
  return copy;
}

function copyActiveLayer() {
  layerClipboard = cloneLayerForClipboard(getActiveLayer());
  clipboard = null;
}

function insertLayerFromClipboard(source, nameSuffix = ' Copy') {
  if (!source) return;
  addAsciiLayer((source.name || 'Layer') + nameSuffix);
  const layer = getActiveLayer();
  layer.kind = source.kind || 'ascii';
  layer.name = (source.name || 'Layer') + nameSuffix;
  layer.grid = normalizeGridArray(source.grid, "");
  layer.colorGrid = normalizeGridArray(source.colorGrid, null);
  layer.textColorGrid = normalizeGridArray(source.textColorGrid, "#000000");
  layer.visible = source.visible !== false;
  layer.locked = false;
  if (layer.kind === 'image') {
    layer.imageData = source.imageData || null;
    layer.img = source.img || null;
    layer.imgX = source.imgX === undefined ? canvasW / 2 : source.imgX;
    layer.imgY = source.imgY === undefined ? canvasH / 2 : source.imgY;
    layer.imgScale = source.imgScale || 1;
    layer.imgCellX = source.imgCellX;
    layer.imgCellY = source.imgCellY;
    layer.imgCellW = source.imgCellW;
    layer.imgCellH = source.imgCellH;
    layer.imgRotate = source.imgRotate || 0;
    layer.imgOpacity = source.imgOpacity === undefined ? 180 : source.imgOpacity;
    layer.blendMode = source.blendMode || 'normal';
    layer.dither = !!source.dither;
    if (!layer.img && layer.imageData) loadImage(layer.imageData, img => { layer.img = img; });
  }
  setActiveLayer(activeLayerIndex);
  updateLayerColorVisuals();
  updateLayerTextVisuals();
  renderLayersUI();
  renderPropertiesUI();
  saveToLocalStorage(true);
  saveUiState();
}

function pasteLayerClipboard() {
  insertLayerFromClipboard(layerClipboard);
}

function duplicateActiveLayer() {
  insertLayerFromClipboard(cloneLayerForClipboard(getActiveLayer()));
}

function deleteActiveLayer() {
  const layer = getActiveLayer();
  if (!layer || layer.locked) return;
  if (asciiLayers.length <= 1) {
    asciiLayers = [];
    addAsciiLayer('Layer 1');
    selectionMask = null;
    selStart = null;
    selEnd = null;
    saveToLocalStorage(true);
    saveUiState();
    return;
  }
  asciiLayers.splice(activeLayerIndex, 1);
  activeLayerIndex = constrain(activeLayerIndex, 0, asciiLayers.length - 1);
  setActiveLayer(activeLayerIndex);
  selectionMask = null;
  selStart = null;
  selEnd = null;
  renderLayersUI();
  renderPropertiesUI();
  saveToLocalStorage(true);
  saveUiState();
}

function cutActiveLayer() {
  const layer = getActiveLayer();
  if (!layer || layer.locked) return;
  copyActiveLayer();
  deleteActiveLayer();
}

function getActiveLayer() {
  return asciiLayers[activeLayerIndex] || null;
}

function isActiveLayerLocked() {
  const layer = getActiveLayer();
  return !!(layer && layer.locked);
}

function isActiveAsciiLayerEditable() {
  const layer = getActiveLayer();
  return !!(layer && layer.kind !== 'image' && !layer.locked);
}

function importAsciiSvgText(svgText) {
  if (!svgText) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector('parsererror')) {
    alert("Could not import this SVG file.");
    return;
  }

  if (asciiLayers.length === 0) addAsciiLayer("Imported SVG");
  activeLayerIndex = 0;
  asciiLayers.forEach((layer, index) => {
    layer.visible = index === 0;
    if (index === 0) layer.name = "Imported SVG";
  });
  clearActiveAsciiLayer();

  doc.querySelectorAll('rect').forEach(rect => {
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const gx = Math.round(x / cellW);
    const gy = Math.round(y / cellH);
    if (!isValidCell(gx, gy)) return;
    const fill = rect.getAttribute('fill');
    if (fill && fill !== '#ffffff' && fill !== 'white') colorGrid[gy][gx] = fill;
  });

  doc.querySelectorAll('text').forEach(node => {
    const x = parseFloat(node.getAttribute('x'));
    const y = parseFloat(node.getAttribute('y'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const gx = Math.round((x - (cellW / 2)) / cellW);
    const gy = Math.round((y - (cellH / 2)) / cellH);
    if (!isValidCell(gx, gy)) return;
    const ch = node.textContent || "";
    grid[gy][gx] = ch.slice(0, 1);
    textColorGrid[gy][gx] = node.getAttribute('fill') || "#000000";
  });

  syncActiveAsciiLayer();
  updateLayerColorVisuals();
  updateLayerTextVisuals();
  renderLayersUI();
  saveState();
  saveToLocalStorage(true);
}

function getCorrectedMouse() {
  let x = (typeof mouseX === 'number') ? mouseX : 0;
  let y = (typeof mouseY === 'number') ? mouseY : 0;
  x = constrain(x, 0, width);
  y = constrain(y, 0, height);
  return { x: x, y: y };
}

function snapCellX(value) {
  return constrain(Math.round(value), 0, workCols);
}

function snapCellY(value) {
  return constrain(Math.round(value), 0, workRows);
}

function getImageCellBounds(layer) {
  if (!layer) return { x: 0, y: 0, w: 1, h: 1 };
  if (layer.imgCellW === undefined || layer.imgCellH === undefined) {
    const pxW = layer.img ? layer.img.width * (layer.imgScale || 1) : cellW;
    const pxH = layer.img ? layer.img.height * (layer.imgScale || 1) : cellH;
    layer.imgCellW = constrain(Math.max(1, Math.round(pxW / cellW)), 1, workCols);
    layer.imgCellH = constrain(Math.max(1, Math.round(pxH / cellH)), 1, workRows);
    layer.imgCellX = snapCellX(((layer.imgX || canvasW / 2) / cellW) - layer.imgCellW / 2);
    layer.imgCellY = snapCellY(((layer.imgY || canvasH / 2) / cellH) - layer.imgCellH / 2);
  }
  layer.imgCellW = constrain(Math.max(1, Math.round(layer.imgCellW)), 1, workCols);
  layer.imgCellH = constrain(Math.max(1, Math.round(layer.imgCellH)), 1, workRows);
  layer.imgCellX = constrain(Math.round(layer.imgCellX || 0), 0, workCols - layer.imgCellW);
  layer.imgCellY = constrain(Math.round(layer.imgCellY || 0), 0, workRows - layer.imgCellH);
  return { x: layer.imgCellX, y: layer.imgCellY, w: layer.imgCellW, h: layer.imgCellH };
}

// --- HISTORY, UNDO/REDO & CLIPBOARD LOGIC ---
function saveState(silent) {
  try {
    const gCopy = grid.map(row => Array.isArray(row) ? row.slice() : []);
    const cCopy = colorGrid.map(row => Array.isArray(row) ? row.slice() : []);
    const tCopy = textColorGrid.map(row => Array.isArray(row) ? row.slice() : []);
    historyState.push({ grid: gCopy, colorGrid: cCopy, textColorGrid: tCopy });
    if (historyState.length > MAX_HISTORY) historyState.shift();
    sketchRedoHistory = []; 
  } catch (e) {}
}

function undoSketch() {
    if (historyState.length > 1) { 
        let currentState = historyState.pop();
        sketchRedoHistory.push(currentState);
        let prevState = historyState[historyState.length - 1];
        
        grid = prevState.grid.map(row => [...row]);
        colorGrid = prevState.colorGrid.map(row => [...row]);
        textColorGrid = prevState.textColorGrid.map(row => [...row]);
        
        asciiLayers[activeLayerIndex].grid = grid;
        asciiLayers[activeLayerIndex].colorGrid = colorGrid;
        asciiLayers[activeLayerIndex].textColorGrid = textColorGrid;
        
        updateLayerTextVisuals();
        updateLayerColorVisuals();
        saveToLocalStorage(true);
    }
}

function redoSketch() {
    if (sketchRedoHistory.length > 0) {
        let nextState = sketchRedoHistory.pop();
        historyState.push(nextState);
        
        grid = nextState.grid.map(row => [...row]);
        colorGrid = nextState.colorGrid.map(row => [...row]);
        textColorGrid = nextState.textColorGrid.map(row => [...row]);
        
        asciiLayers[activeLayerIndex].grid = grid;
        asciiLayers[activeLayerIndex].colorGrid = colorGrid;
        asciiLayers[activeLayerIndex].textColorGrid = textColorGrid;
        
        updateLayerTextVisuals();
        updateLayerColorVisuals();
        saveToLocalStorage(true);
    }
}

function getSelectionBounds() {
    if (selStart && selEnd) {
        return {
            minX: Math.min(selStart.x, selEnd.x),
            maxX: Math.max(selStart.x, selEnd.x),
            minY: Math.min(selStart.y, selEnd.y),
            maxY: Math.max(selStart.y, selEnd.y),
            useMask: false
        };
    }
    if (selectionMask) {
        let minX = workCols, minY = workRows, maxX = -1, maxY = -1;
        for (let y = 0; y < workRows; y++) {
            for (let x = 0; x < workCols; x++) {
                if (selectionMask[y] && selectionMask[y][x]) {
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                }
            }
        }
        if (maxX >= minX && maxY >= minY) return { minX, maxX, minY, maxY, useMask: true };
    }
    return null;
}

function copySelection() {
    const bounds = getSelectionBounds();
    if (!bounds) return;
    let { minX, maxX, minY, maxY, useMask } = bounds;
    layerClipboard = null;
    
    clipboard = { w: maxX - minX + 1, h: maxY - minY + 1, data: [] };
    
    for (let y = minY; y <= maxY; y++) {
        let row = [];
        for (let x = minX; x <= maxX; x++) {
            if (isValidCell(x, y) && (!useMask || (selectionMask[y] && selectionMask[y][x]))) {
                row.push({ char: grid[y][x], color: colorGrid[y][x], textColor: textColorGrid[y][x] });
            } else {
                row.push({ char: "", color: null, textColor: "#000000" });
            }
        }
        clipboard.data.push(row);
    }
}

function cutSelection() {
    if (!isActiveAsciiLayerEditable()) return;
    const bounds = getSelectionBounds();
    if (!bounds) return;
    copySelection(); 
    clearSelectionCells(bounds);
}

function clearSelectionCells(bounds) {
    const target = bounds || getSelectionBounds();
    if (!target || !isActiveAsciiLayerEditable()) return;
    for (let y = target.minY; y <= target.maxY; y++) {
        for (let x = target.minX; x <= target.maxX; x++) {
            if (isValidCell(x, y) && (!target.useMask || (selectionMask[y] && selectionMask[y][x]))) {
                grid[y][x] = "";
                colorGrid[y][x] = null;
                textColorGrid[y][x] = "#000000";
            }
        }
    }
    updateLayerTextVisuals();
    updateLayerColorVisuals();
    selectionMask = null;
    selStart = null;
    selEnd = null;
    saveState();
    saveToLocalStorage(true);
}

function deleteSelection() {
    if (getSelectionBounds()) clearSelectionCells();
    else deleteActiveLayer();
}

function pasteClipboard() {
    if (!clipboard) return;
    if (!isActiveAsciiLayerEditable()) return;
    
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
    setToolMode('MOUSE'); // Tự động bật MOUSE tool cho phép kéo thả
    selStart = null; selEnd = null; 
}

function commitFloatingSelection() {
    if (!isDraggingSelection || !clipboard) return;
    if (!isActiveAsciiLayerEditable()) return;
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
    kind: 'ascii',
    name: name,
    pgColor: pgC,
    pgText: pgT,
    grid: layerGrid,
    colorGrid: layerColorGrid,
    textColorGrid: layerTextColorGrid,
    visible: true,
    locked: false
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

function addImageLayer(img, dataUrl, name = 'Image Layer') {
  addAsciiLayer(name);
  const layer = asciiLayers[activeLayerIndex];
  layer.kind = 'image';
  layer.name = name;
  layer.img = img;
  layer.imageData = dataUrl || null;
  layer.imgCellW = constrain(Math.max(1, Math.round((canvasW * 0.5) / cellW)), 1, workCols);
  layer.imgCellH = constrain(Math.max(1, Math.round((layer.imgCellW * (img.height / Math.max(1, img.width)) * cellW) / cellH)), 1, workRows);
  layer.imgCellX = Math.floor((workCols - layer.imgCellW) / 2);
  layer.imgCellY = Math.floor((workRows - layer.imgCellH) / 2);
  layer.imgX = (layer.imgCellX + layer.imgCellW / 2) * cellW;
  layer.imgY = (layer.imgCellY + layer.imgCellH / 2) * cellH;
  layer.imgScale = (layer.imgCellW * cellW) / Math.max(1, img.width);
  layer.imgRotate = 0;
  layer.imgOpacity = 180;
  layer.blendMode = 'normal';
  layer.dither = false;
  updateLayerColorVisuals();
  updateLayerTextVisuals();
  renderLayersUI();
  renderPropertiesUI();
  saveToLocalStorage(true);
  saveUiState();
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

  background(208);
  
  push();
  translate(-viewX, -viewY);

  fill(255);
  noStroke();
  rect(0, 0, viewW, viewH);

  image(pgGridLayer, 0, 0);
  drawGridHoverGuide();

  for (let i = 0; i < asciiLayers.length; i++) {
      let l = asciiLayers[i];
      if (l.visible) {
          let op = l.imgOpacity === undefined ? (l.kind === 'image' ? 180 : 255) : l.imgOpacity;
          let customMode = l.blendMode && l.blendMode !== 'normal';
          
          if (l.kind === 'image' && l.img) {
              const b = getImageCellBounds(l);
              push();
              applyImageBlendMode(l);
              tint(255, op);
              imageMode(CORNER);
              image(l.img, b.x * cellW, b.y * cellH, b.w * cellW, b.h * cellH);
              noTint();
              blendMode(BLEND);
              pop();
              continue;
          }
          push();
          tint(255, op);
          if (customMode) {
              applyImageBlendMode(l);
              if (l.pgColor) image(l.pgColor, 0, 0);
              if (l.pgText) image(l.pgText, 0, 0);
          } else {
              blendMode(MULTIPLY);
              if (l.pgColor) image(l.pgColor, 0, 0);
              blendMode(BLEND);
              if (l.pgText) image(l.pgText, 0, 0);
          }
          noTint();
          blendMode(BLEND);
          pop();
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

  drawImageTransformBox(getActiveLayer());

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

function setAsciiCell(x, y, ch, textColor = null) {
  if (!isActiveAsciiLayerEditable()) return;
  if (selectionMask && !selectionMask[y][x]) return; 
  ensureGridCell(x, y);
  grid[y][x] = ch;
  if (textColor) {
      textColorGrid[y][x] = textColor;
  }
  drawSingleCellText(x, y);
}

function setGridColor(x, y, col) {
  if (!isActiveAsciiLayerEditable()) return;
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

function drawGridHoverGuide() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  const gx = Math.floor((mouseX + viewX) / cellW);
  const gy = Math.floor((mouseY + viewY) / cellH);
  if (!isValidCell(gx, gy)) return;
  noStroke();
  fill(120, 120, 120, 38);
  rect(0, gy * cellH, viewW, cellH);
  rect(gx * cellW, 0, cellW, viewH);
  noFill();
  stroke(0, 150, 255);
  strokeWeight(1);
  rect(gx * cellW, gy * cellH, cellW, cellH);
}

function drawViewportOverlay() {
  fill(208);
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
  const targetChar = grid[startY][startX];
  const targetColor = getMagicWandCellColor(startX, startY);
  
  if (!keyIsDown(SHIFT) || !selectionMask) {
      selectionMask = [];
      for (let y = 0; y < workRows; y++) selectionMask[y] = new Array(workCols).fill(false);
  }
  
  for (let y = 0; y < workRows; y++) {
      for (let x = 0; x < workCols; x++) {
          const sameChar = grid[y][x] === targetChar;
          const sameColor = getMagicWandCellColor(x, y) === targetColor;
              
              let isMatch = false;
              if (magicWandMatchMode === 'color') {
                  isMatch = sameColor;
              } else {
                  // Match char mode: Nếu là ô trống (không kí tự), yêu cầu phải cùng màu (để phân biệt với ô space thường)
                  if (targetChar === "") {
                      isMatch = sameChar && sameColor;
                  } else {
                      isMatch = sameChar;
                  }
              }
              
              if (isMatch) {
              selectionMask[y][x] = true;
          }
      }
  }
}

function normalizeMagicWandColor(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.map(v => Math.round(Number(v) || 0)).join(',');
  if (value.levels && Array.isArray(value.levels)) return value.levels.map(v => Math.round(Number(v) || 0)).join(',');
  return String(value).trim().toLowerCase();
}

function getMagicWandCellColor(x, y) {
  const value = colorGrid[y] ? colorGrid[y][x] : null;
  return normalizeMagicWandColor(value);
}

function floodFill(startX, startY, targetChar, replaceChar, textColor = null) {
  if (targetChar === replaceChar) return;
  const targetColor = colorGrid[startY][startX];
  let queue = [{x: startX, y: startY}];
  while (queue.length > 0) {
      let p = queue.shift();
      if (isValidCell(p.x, p.y)) {
          let sameChar = grid[p.y][p.x] === targetChar;
          let sameColor = colorGrid[p.y][p.x] === targetColor;
          let isMatch = sameChar && (targetChar !== "" || sameColor);
          
          if (isMatch && (!selectionMask || selectionMask[p.y][p.x])) {
              setAsciiCell(p.x, p.y, replaceChar, textColor);
              queue.push({x: p.x + 1, y: p.y});
              queue.push({x: p.x - 1, y: p.y});
              queue.push({x: p.x, y: p.y + 1});
              queue.push({x: p.x, y: p.y - 1});
          }
      }
  }
}

function openTextToolBox(minX, minY, maxX, maxY, px, py, skipBorder = false) {
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
    textToolInput.style('text-transform', 'uppercase');
    textToolInput.style('color', selectedColor || '#000000');
    textToolInput.elt.focus();
    
    let commitText = () => {
        if(!textToolInput) return;
        let txt = textToolInput.value().toUpperCase();
        
        let drawBorderChar = selectedChar === 'SMART' ? '#' : selectedChar;
        let drawTextColor = selectedColor || "#000000";
        if (!skipBorder && maxX - minX >= 1 && maxY - minY >= 1) {
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
                
                if (isValidCell(cx, cy)) setAsciiCell(cx, cy, char, drawTextColor);
                cx++;
            }
        } else {
            let cx = minX, cy = minY;
            for (let i = 0; i < txt.length; i++) {
                let char = txt[i];
                if (char === '\n') {
                    cx = minX; cy++; continue;
                }
                if (isValidCell(cx, cy)) setAsciiCell(cx, cy, char, drawTextColor);
                cx++;
            }
        }
        
        saveState();
        textToolInput.remove();
        textToolInput = null;
    };
    
    textToolInput.elt.onblur = commitText;
}

function dropTextAsAscii(text, clientX, clientY) {
    if (!isActiveAsciiLayerEditable()) {
        if (window.showToast) window.showToast("Layer is locked or not an ASCII layer!");
        return;
    }
    
    text = text.toUpperCase();

    let canvasRect = mainCanvas.elt.getBoundingClientRect();
    let mx = clientX - canvasRect.left;
    let my = clientY - canvasRect.top;

    let gx = Math.floor((mx + viewX) / cellW);
    let gy = Math.floor((my + viewY) / cellH);

    if (!isValidCell(gx, gy)) {
        gx = Math.floor(viewX / cellW) + 2;
        gy = Math.floor(viewY / cellH) + 2;
    }
    
    let lines = text.split('\n');
    let maxLen = 1;
    lines.forEach(l => maxLen = Math.max(maxLen, l.length));
    
    let minX = gx;
    let minY = gy;
    let maxX = Math.min(workCols - 1, gx + maxLen - 1);
    let maxY = Math.min(workRows - 1, gy + lines.length - 1);

    setToolMode('TEXT');
    selStart = null;
    selEnd = null;
    
    let px = canvasRect.left + (minX * cellW) - viewX;
    let py = canvasRect.top + (minY * cellH) - viewY;
    
    openTextToolBox(minX, minY, maxX, maxY, px, py, true);
    
    if (textToolInput) {
        textToolInput.value(text);
        textToolInput.style('width', Math.max(80, (maxLen + 2) * cellW) + 'px');
        textToolInput.style('height', Math.max(40, (lines.length + 2) * cellH) + 'px');
    }
}

function applyShape(x1, y1, x2, y2, mode, char, withShadow) {
  let minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  let minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  let w = maxX - minX; let h = maxY - minY;
  let shadowOffset = 1;
  let shadowChar = shadowBoxes[currentShadowIndex];
  let drawTextColor = selectedColor || "#000000";
  
  let drawBorder = (x, y, ox, oy, drawChar) => {
    let drawX = x + ox, drawY = y + oy;
    if (isValidCell(drawX, drawY)) setAsciiCell(drawX, drawY, drawChar, drawTextColor);
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
  let realX = m.x + viewX;
  let realY = m.y + viewY;

  for (let i = asciiLayers.length - 1; i >= 0; i--) {
      const layer = asciiLayers[i];
      const hit = hitImageTransform(layer, realX, realY);
      if (hit) {
          setActiveLayer(i);
          renderLayersUI();
          renderPropertiesUI();
          imageTransformDrag = {
              type: hit.type,
              corner: hit.corner,
              startX: realX,
              startY: realY,
              originCellX: getImageCellBounds(layer).x,
              originCellY: getImageCellBounds(layer).y,
              originCellW: getImageCellBounds(layer).w,
              originCellH: getImageCellBounds(layer).h
          };
          return;
      }
  }
  
  if (toolMode === 'GRAB') {
    prevGrabMouse = {x: m.x, y: m.y};
    return;
  }

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
      if (!toolMode.startsWith('SHAPE_') && toolMode !== 'TEXT') setToolMode("SELECT", { render: false });
      isShiftSelecting = true; 
      return; 
  }
  
  if (toolMode === "SELECT" && !isShiftSelecting) { selStart = {x: mx, y: my}; selEnd = {x: mx, y: my}; }

  handleInput(mx, my);
}

// --- GLOBAL KEYBOARD SHORTCUTS ---
window.addEventListener('keydown', function(e) {
    if (activeTab !== 'tab-sketch') return;
    
    // Bỏ qua nếu đang gõ text vào input/textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.isContentEditable)) return;

    // Nhận diện cả phím Control (Windows) và phím Command (Mac)
    const isCtrl = e.ctrlKey || e.metaKey;
    const key = String(e.key || '').toLowerCase();
    const code = String(e.code || '');

    if (isCtrl) {
        if (code === 'KeyC' || key === 'c') {
            e.preventDefault(); e.stopPropagation();
            if (getSelectionBounds()) copySelection();
            else copyActiveLayer();
        } else if (code === 'KeyX' || key === 'x') {
            e.preventDefault(); e.stopPropagation();
            if (getSelectionBounds()) cutSelection();
            else cutActiveLayer();
        } else if (code === 'KeyV' || key === 'v') {
            e.preventDefault(); e.stopPropagation();
            if (clipboard) pasteClipboard();
            else pasteLayerClipboard();
        } else if (code === 'KeyZ' || key === 'z') {
            e.preventDefault(); e.stopPropagation();
            if (isDraggingSelection) {
                isDraggingSelection = false;
                return;
            }
            if (e.shiftKey) redoSketch();
            else undoSketch();
        } else if (code === 'KeyD' || key === 'd') {
            e.preventDefault(); e.stopPropagation();
            duplicateActiveLayer();
        }
    } else if (code === 'Delete' || code === 'Backspace' || key === 'delete' || key === 'backspace') {
        e.preventDefault(); e.stopPropagation();
        if (isDraggingSelection) {
            isDraggingSelection = false;
            clipboard = null;
        } else {
            deleteSelection();
        }
    } else if (code === 'Escape' || key === 'escape') {
        e.preventDefault(); e.stopPropagation();
        if (isDraggingSelection) {
            commitFloatingSelection();
        } else {
            selectionMask = null;
            selStart = null;
            selEnd = null;
        }
    }
}, true);

function mouseDragged() {
  if (activeTab !== 'tab-sketch') return;
  if (isDraggingPanel) return;
  let m = getCorrectedMouse();

  let realX = m.x + viewX;
  let realY = m.y + viewY;
  let mx = floor(constrain(realX, 0, width-1) / cellW);
  let my = floor(constrain(realY, 0, height-1) / cellH);

  if (imageTransformDrag) {
      const layer = getActiveLayer();
      if (layer && layer.kind === 'image' && !layer.locked) {
          const startCellX = Math.floor(imageTransformDrag.startX / cellW);
          const startCellY = Math.floor(imageTransformDrag.startY / cellH);
          const nowCellX = Math.floor(realX / cellW);
          const nowCellY = Math.floor(realY / cellH);
          const dxCell = nowCellX - startCellX;
          const dyCell = nowCellY - startCellY;
          if (imageTransformDrag.type === 'move') {
              layer.imgCellX = constrain(imageTransformDrag.originCellX + dxCell, 0, workCols - imageTransformDrag.originCellW);
              layer.imgCellY = constrain(imageTransformDrag.originCellY + dyCell, 0, workRows - imageTransformDrag.originCellH);
          } else if (imageTransformDrag.type === 'scale') {
              let x = imageTransformDrag.originCellX;
              let y = imageTransformDrag.originCellY;
              let w = imageTransformDrag.originCellW;
              let h = imageTransformDrag.originCellH;
              if (imageTransformDrag.corner.includes('e')) w = Math.max(1, imageTransformDrag.originCellW + dxCell);
              if (imageTransformDrag.corner.includes('s')) h = Math.max(1, imageTransformDrag.originCellH + dyCell);
              if (imageTransformDrag.corner.includes('w')) {
                  x = imageTransformDrag.originCellX + dxCell;
                  w = Math.max(1, imageTransformDrag.originCellW - dxCell);
              }
              if (imageTransformDrag.corner.includes('n')) {
                  y = imageTransformDrag.originCellY + dyCell;
                  h = Math.max(1, imageTransformDrag.originCellH - dyCell);
              }
              x = constrain(x, 0, workCols - 1);
              y = constrain(y, 0, workRows - 1);
              w = constrain(w, 1, workCols - x);
              h = constrain(h, 1, workRows - y);
              layer.imgCellX = x;
              layer.imgCellY = y;
              layer.imgCellW = w;
              layer.imgCellH = h;
          }
          const b = getImageCellBounds(layer);
          layer.imgX = (b.x + b.w / 2) * cellW;
          layer.imgY = (b.y + b.h / 2) * cellH;
          layer.imgScale = (b.w * cellW) / Math.max(1, layer.img.width);
          renderPropertiesUI();
      }
      return;
  }

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

  if (imageTransformDrag) {
      imageTransformDrag = null;
      saveToLocalStorage(true);
      saveUiState();
      return;
  }
  
  if (toolMode === 'MOUSE') {
      prevGrabMouse = null;
      saveUiState();
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
  saveUiState();
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('mi_sketch_state');
    if (!raw) return;
    const obj = JSON.parse(raw);

    if (Number.isInteger(obj.canvasCols) && Number.isInteger(obj.canvasRows)) {
      updateCanvasGeometry(obj.canvasCols, obj.canvasRows);
    }
    if (obj.canvasRatioPreset) canvasRatioPreset = obj.canvasRatioPreset;

    if (obj.historyState) historyState = obj.historyState;
    if (obj.sketchRedoHistory) sketchRedoHistory = obj.sketchRedoHistory;

    if (obj.asciiLayers && Array.isArray(obj.asciiLayers) && obj.asciiLayers.length > 0) {
      asciiLayers = [];
      for (let i = 0; i < obj.asciiLayers.length; i++) {
        const storedName = obj.asciiLayers[i].name === 'Background' && i === 0 ? 'Layer 1' : (obj.asciiLayers[i].name || ('Layer ' + (i + 1)));
        addAsciiLayer(storedName);
        if (obj.asciiLayers[i].grid) asciiLayers[i].grid = obj.asciiLayers[i].grid;
        if (obj.asciiLayers[i].colorGrid) asciiLayers[i].colorGrid = obj.asciiLayers[i].colorGrid;
        if (obj.asciiLayers[i].textColorGrid) asciiLayers[i].textColorGrid = obj.asciiLayers[i].textColorGrid;
        if (typeof obj.asciiLayers[i].visible === 'boolean') asciiLayers[i].visible = obj.asciiLayers[i].visible;
        if (typeof obj.asciiLayers[i].locked === 'boolean') asciiLayers[i].locked = obj.asciiLayers[i].locked;
        if (obj.asciiLayers[i].kind) asciiLayers[i].kind = obj.asciiLayers[i].kind;
        if (asciiLayers[i].kind === 'image') {
          asciiLayers[i].imageData = obj.asciiLayers[i].imageData || null;
          asciiLayers[i].imgX = obj.asciiLayers[i].imgX || canvasW / 2;
          asciiLayers[i].imgY = obj.asciiLayers[i].imgY || canvasH / 2;
          asciiLayers[i].imgScale = obj.asciiLayers[i].imgScale || 1;
          asciiLayers[i].imgCellX = obj.asciiLayers[i].imgCellX;
          asciiLayers[i].imgCellY = obj.asciiLayers[i].imgCellY;
          asciiLayers[i].imgCellW = obj.asciiLayers[i].imgCellW;
          asciiLayers[i].imgCellH = obj.asciiLayers[i].imgCellH;
          asciiLayers[i].imgRotate = obj.asciiLayers[i].imgRotate || 0;
          asciiLayers[i].imgOpacity = obj.asciiLayers[i].imgOpacity === undefined ? 180 : obj.asciiLayers[i].imgOpacity;
          asciiLayers[i].blendMode = obj.asciiLayers[i].blendMode || 'normal';
          asciiLayers[i].dither = !!obj.asciiLayers[i].dither;
          if (asciiLayers[i].imageData) {
            const layerRef = asciiLayers[i];
            loadImage(asciiLayers[i].imageData, img => { layerRef.img = img; });
          }
        }
        normalizeAsciiLayer(asciiLayers[i]);
      }
    } 
    if (asciiLayers.length === 0) {
        addAsciiLayer("Layer 1");
    }

    activeLayerIndex = Number.isInteger(obj.activeLayerIndex) && asciiLayers[obj.activeLayerIndex] ? obj.activeLayerIndex : 0;
    grid = asciiLayers[activeLayerIndex].grid;
    colorGrid = asciiLayers[activeLayerIndex].colorGrid;
    textColorGrid = asciiLayers[activeLayerIndex].textColorGrid;
    pgColorLayer = asciiLayers[activeLayerIndex].pgColor;
    pgTextLayer = asciiLayers[activeLayerIndex].pgText;

    if (obj.grid && Array.isArray(obj.grid)) grid = obj.grid;
    if (obj.colorGrid && Array.isArray(obj.colorGrid)) colorGrid = obj.colorGrid;
    if (obj.textColorGrid && Array.isArray(obj.textColorGrid)) textColorGrid = obj.textColorGrid;
    syncActiveAsciiLayer();
    asciiLayers.forEach(normalizeAsciiLayer);
    grid = asciiLayers[activeLayerIndex].grid;
    colorGrid = asciiLayers[activeLayerIndex].colorGrid;
    textColorGrid = asciiLayers[activeLayerIndex].textColorGrid;
    asciiLayers.forEach(layer => {
      const prevGrid = grid;
      const prevColorGrid = colorGrid;
      const prevTextColorGrid = textColorGrid;
      const prevColorLayer = pgColorLayer;
      const prevTextLayer = pgTextLayer;
      grid = layer.grid;
      colorGrid = layer.colorGrid;
      textColorGrid = layer.textColorGrid;
      pgColorLayer = layer.pgColor;
      pgTextLayer = layer.pgText;
      updateLayerColorVisuals();
      updateLayerTextVisuals();
      grid = prevGrid;
      colorGrid = prevColorGrid;
      textColorGrid = prevTextColorGrid;
      pgColorLayer = prevColorLayer;
      pgTextLayer = prevTextLayer;
    });
    
  } catch (e) {
     if (asciiLayers.length === 0) {
        addAsciiLayer("Layer 1");
     }
  }
}

function saveToLocalStorage(silent) {
  try {
    syncActiveAsciiLayer();
    const obj = {
      grid: grid,
      colorGrid: colorGrid,
      textColorGrid: textColorGrid,
      canvasCols: workCols,
      canvasRows: workRows,
      canvasRatioPreset: canvasRatioPreset,
      activeLayerIndex: activeLayerIndex,
      historyState: historyState,
      sketchRedoHistory: sketchRedoHistory,
      asciiLayers: asciiLayers.map(l => ({
        name: l.name,
        grid: l.grid,
        colorGrid: l.colorGrid,
        textColorGrid: l.textColorGrid,
        visible: l.visible,
        locked: !!l.locked,
        kind: l.kind || 'ascii',
        imageData: l.imageData || null,
        imgX: l.imgX,
        imgY: l.imgY,
        imgScale: l.imgScale,
        imgCellX: l.imgCellX,
        imgCellY: l.imgCellY,
        imgCellW: l.imgCellW,
        imgCellH: l.imgCellH,
        imgRotate: l.imgRotate,
        imgOpacity: l.imgOpacity,
        blendMode: l.blendMode || 'normal',
        dither: !!l.dither
      }))
    };
    localStorage.setItem('mi_sketch_state', JSON.stringify(obj));
  } catch (e) {}
}

function handleInput(x, y) {
  if (!isValidCell(x, y)) return;
  if (!isActiveAsciiLayerEditable()) return;
  
  let drawTextColor = selectedColor || "#000000";
  
  if (toolMode === 'DRAW') {
    let ch = selectedChar === 'SMART' ? '#' : selectedChar;
    if (isEraser) ch = "";
    setAsciiCell(x, y, ch, drawTextColor);
  } else if (toolMode === 'ERASE') {
    setAsciiCell(x, y, "", "#000000");
  } else if (toolMode === 'FILL') {
    let targetChar = grid[y][x];
    let ch = selectedChar === 'SMART' ? '#' : selectedChar;
    floodFill(x, y, targetChar, ch, drawTextColor);
  } else if (toolMode === 'INK') {
        setGridTextColor(x, y, selectedColor);
  }
}

function ensureGridCell(x, y) {
  if (!grid[y]) grid[y] = [];
  if (!colorGrid[y]) colorGrid[y] = [];
  if (!textColorGrid[y]) textColorGrid[y] = [];
}

function getComposedAsciiCell(x, y) {
  let composed = { char: "", color: null, textColor: "#000000" };
  for (let i = 0; i < asciiLayers.length; i++) {
    const layer = asciiLayers[i];
    if (!layer || !layer.visible) continue;
    const layerColor = layer.colorGrid && layer.colorGrid[y] ? layer.colorGrid[y][x] : null;
    const layerChar = layer.grid && layer.grid[y] ? layer.grid[y][x] : "";
    if (layerColor) composed.color = layerColor;
    if (layerChar !== "") {
      composed.char = layerChar;
      composed.textColor = layer.textColorGrid && layer.textColorGrid[y] ? (layer.textColorGrid[y][x] || "#000000") : "#000000";
    }
  }
  return composed;
}

function syncActiveAsciiLayer() {
  if (!asciiLayers[activeLayerIndex]) return;
  asciiLayers[activeLayerIndex].grid = grid;
  asciiLayers[activeLayerIndex].colorGrid = colorGrid;
  asciiLayers[activeLayerIndex].textColorGrid = textColorGrid;
}

function getAsciiExportText() {
  syncActiveAsciiLayer();
  const lines = [];
  for (let y = 0; y < workRows; y++) {
    let line = "";
    for (let x = 0; x < workCols; x++) {
      line += getComposedAsciiCell(x, y).char || " ";
    }
    lines.push(line.replace(/\s+$/g, ""));
  }
  return lines.join("\n").replace(/\s+$/g, "");
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getNextAsciiFilename(ext) {
  let nextIndex = 1;
  try {
    nextIndex = (parseInt(localStorage.getItem('mi_ascii_export_index') || '0', 10) || 0) + 1;
    localStorage.setItem('mi_ascii_export_index', String(nextIndex));
  } catch (e) {}
  return `ascii drawing_${String(nextIndex).padStart(2, '0')}.${ext}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function exportAsciiTxt() {
  downloadTextFile(getNextAsciiFilename("txt"), getAsciiExportText(), "text/plain;charset=utf-8");
}

function exportAsciiSvg() {
  syncActiveAsciiLayer();
  const exportW = workCols * cellW;
  const exportH = workRows * cellH;
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="0 0 ${exportW} ${exportH}">`
  ];

  if (!exportTransparent) parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  for (let i = 0; i < asciiLayers.length; i++) {
    const layer = asciiLayers[i];
    if (!layer || !layer.visible) continue;
    for (let y = 0; y < workRows; y++) {
      for (let x = 0; x < workCols; x++) {
        const c = layer.colorGrid && layer.colorGrid[y] ? layer.colorGrid[y][x] : null;
        if (c) parts.push(`<rect x="${x * cellW}" y="${y * cellH}" width="${cellW}" height="${cellH}" fill="${escapeXml(c)}"/>`);
      }
    }
    for (let y = 0; y < workRows; y++) {
      for (let x = 0; x < workCols; x++) {
        const ch = layer.grid && layer.grid[y] ? layer.grid[y][x] : "";
        if (ch === "") continue;
        const textColor = layer.textColorGrid && layer.textColorGrid[y] ? (layer.textColorGrid[y][x] || "#000000") : "#000000";
        const tx = (x * cellW) + (cellW / 2);
        const ty = (y * cellH) + (cellH / 2);
        parts.push(`<text x="${tx}" y="${ty}" font-family="Consolas, monospace" font-size="${userFontSize}" text-anchor="middle" dominant-baseline="middle" fill="${escapeXml(textColor)}">${escapeXml(ch)}</text>`);
      }
    }
  }

  parts.push(`</svg>`);
  downloadTextFile(getNextAsciiFilename("svg"), parts.join(""), "image/svg+xml;charset=utf-8");
}

function applyPgBlendMode(pg, mode) {
    if (mode === 'multiply') pg.blendMode(MULTIPLY);
    else if (mode === 'screen') pg.blendMode(SCREEN);
    else if (mode === 'overlay') pg.blendMode(OVERLAY);
    else if (mode === 'darken') pg.blendMode(DARKEST);
    else if (mode === 'lighten') pg.blendMode(LIGHTEST);
    else if (mode === 'color-dodge') pg.blendMode(DODGE);
    else if (mode === 'color-burn') pg.blendMode(BURN);
    else if (mode === 'hard-light') pg.blendMode(HARD_LIGHT);
    else if (mode === 'soft-light') pg.blendMode(SOFT_LIGHT);
    else if (mode === 'difference') pg.blendMode(DIFFERENCE);
    else if (mode === 'exclusion') pg.blendMode(EXCLUSION);
    else if (mode === 'add') pg.blendMode(ADD);
    else pg.blendMode(BLEND);
}

function renderAsciiArtworkToGraphics(pg, includeBackground) {
  pg.clear();
  if (includeBackground) {
    pg.background(255);
  }
  for (let i = 0; i < asciiLayers.length; i++) {
    const layer = asciiLayers[i];
    if (!layer || !layer.visible) continue;
    let op = layer.imgOpacity === undefined ? (layer.kind === 'image' ? 180 : 255) : layer.imgOpacity;
    let customMode = layer.blendMode && layer.blendMode !== 'normal';
    
    if (layer.kind === 'image' && layer.img) {
      const b = getImageCellBounds(layer);
      pg.push();
      applyPgBlendMode(pg, layer.blendMode || 'normal');
      pg.tint(255, op);
      pg.image(layer.img, b.x * cellW, b.y * cellH, b.w * cellW, b.h * cellH);
      pg.noTint();
      pg.blendMode(BLEND);
      pg.pop();
      continue;
    }
    pg.push();
    pg.tint(255, op);
    if (customMode) {
        applyPgBlendMode(pg, layer.blendMode);
        if (layer.pgColor) pg.image(layer.pgColor, 0, 0);
        if (layer.pgText) pg.image(layer.pgText, 0, 0);
    } else {
        pg.blendMode(MULTIPLY);
        if (layer.pgColor) pg.image(layer.pgColor, 0, 0);
        pg.blendMode(BLEND);
        if (layer.pgText) pg.image(layer.pgText, 0, 0);
    }
    pg.noTint();
    pg.blendMode(BLEND);
    pg.pop();
  }
}

function exportAsciiPng(includeBackground) {
  syncActiveAsciiLayer();
  const pg = createGraphics(canvasW, canvasH);
  pg.pixelDensity(1);
  renderAsciiArtworkToGraphics(pg, includeBackground);
  save(pg, getNextAsciiFilename("png"));
  pg.remove();
}

function setupSketchZoomUI() {
  let btnZoomIn = select('#btnSketchZoomIn');
  let btnZoomOut = select('#btnSketchZoomOut');
  let zoomVal = select('#sketch-zoom-val');

  if (btnZoomIn) {
    btnZoomIn.mousePressed(() => {
      viewZoom = Math.min(5.0, viewZoom + 0.1);
      applySketchCanvasZoom();
      saveUiState();
    });
  }
  if (btnZoomOut) {
    btnZoomOut.mousePressed(() => {
      viewZoom = Math.max(0.1, viewZoom - 0.1);
      applySketchCanvasZoom();
      saveUiState();
    });
  }
}

function setGridTextColor(x, y, col) {
  if (!isActiveAsciiLayerEditable()) return;
  if (selectionMask && !selectionMask[y][x]) return;
  ensureGridCell(x, y);
  textColorGrid[y][x] = col || "#000000";
  drawSingleCellText(x, y); 
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

        setToolMode(t.mode);
      });
    }
  });

  let btnClear = document.getElementById('btnClearSketch');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (!isActiveAsciiLayerEditable()) return;
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
      saveToLocalStorage(true);
      saveUiState();
    });
  }

  let btnSaveSvg = document.getElementById('btnSaveSVG');
  if (btnSaveSvg) btnSaveSvg.addEventListener('click', exportAsciiSvg);

  let btnSaveTxt = document.getElementById('btnSaveTXT');
  if (btnSaveTxt) btnSaveTxt.addEventListener('click', exportAsciiTxt);

  let btnSavePngWhite = document.getElementById('btnSavePNGWhite');
  if (btnSavePngWhite) btnSavePngWhite.addEventListener('click', () => exportAsciiPng(true));

  let btnSavePngTransparent = document.getElementById('btnSavePNGTransparent');
  if (btnSavePngTransparent) btnSavePngTransparent.addEventListener('click', () => exportAsciiPng(false));

  let btnImportSvg = document.getElementById('btnImportSVG');
  let importSvgInput = document.getElementById('asciiSvgImportInput');
  if (btnImportSvg && importSvgInput) {
    btnImportSvg.addEventListener('click', () => importSvgInput.click());
    importSvgInput.addEventListener('change', () => {
      const file = importSvgInput.files && importSvgInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importAsciiSvgText(reader.result || "");
      reader.readAsText(file);
      importSvgInput.value = "";
    });
  }
}

function handleImageLoad(img) {
  if (!img) return;
  addImageLayer(img, null, 'Image Layer');
}
