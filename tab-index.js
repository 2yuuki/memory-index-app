// --- TAB 4: MEMORY DIAGRAM / INDEX LAYOUT ---
var layoutHistory = [];
var MAX_LAYOUT_HISTORY = 20;
var layoutRedoHistory = [];
var layoutClipboard = null;
var selectedLayoutElement = null;
var layoutScale = 1.0;
var isSnapToGrid = false;
var snapSize = 20;
var activeArtboard = null;
var layoutSidebarRef = null;
var layoutTool = 'SELECT';
var isDrawingTextBox = false;
var drawStart = { x: 0, y: 0 };
var tempDrawBox = null;
var MAX_PATTERNS = 4;
var isLayoutExporting = false;
var patternDataUrlCache = new Map();
var draggedLayerId = null;
var saveLayoutTimeout = null;
var layoutDidSetup = false;

function layoutSelect(selector) {
  if (typeof select === 'function') return select(selector);
  var el = document.querySelector(selector);
  return el ? { elt: el } : null;
}

function updateLayoutZoom(amount) {
  layoutScale += amount;
  if (typeof constrain === 'function') layoutScale = constrain(layoutScale, 0.1, 3.0);
  else layoutScale = Math.max(0.1, Math.min(3.0, layoutScale));

  var holder = document.getElementById('layout-canvas-holder');
  if (holder) {
    holder.style.transform = 'scale(' + layoutScale + ')';
    holder.style.transformOrigin = 'top center';
  }
}

function setupLayoutTab() {
  var layoutDiv = document.getElementById('layout-canvas-holder');
  if (!layoutDiv) return;

  var panel = document.getElementById('layout-tools-panel');
  if (panel) {
    showLayoutFloatingPanel(panel, '48px', '120px', '45000');
    if (typeof makePanelDraggable === 'function' && !panel.dataset.layoutDragBound) {
      makePanelDraggable(panel, document.body);
      panel.dataset.layoutDragBound = 'true';
    }
  }
  var layerPanel = ensureLayoutLayerPanel();
  if (layerPanel) {
    showLayoutFloatingPanel(layerPanel, '340px', '120px', '45001');
    if (typeof makePanelDraggable === 'function' && !layerPanel.dataset.layoutDragBound) {
      makePanelDraggable(layerPanel, document.body);
      layerPanel.dataset.layoutDragBound = 'true';
    }
  }

  var viewport = document.getElementById('layout-viewport');
  if (!viewport) {
    viewport = document.createElement('div');
    viewport.id = 'layout-viewport';
    var parent = layoutDiv.parentNode;
    if (parent) {
      parent.insertBefore(viewport, layoutDiv);
      viewport.appendChild(layoutDiv);
    }
  }
  Object.assign(viewport.style, {
    width: '100%',
    minHeight: '100%',
    overflow: 'auto',
    background: '#d0d0d0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '40px',
    boxSizing: 'border-box'
  });

  Object.assign(layoutDiv.style, {
    position: 'relative',
    overflow: 'visible',
    width: '794px',
    height: '1123px',
    background: 'transparent',
    boxShadow: 'none',
    flexShrink: '0',
    transformOrigin: 'top center'
  });

  var sheet = document.querySelector('#tab-index .paper-sheet');
  if (sheet) {
    Object.assign(sheet.style, {
      width: '100%',
      height: '100%',
      maxWidth: 'none',
      maxHeight: 'none',
      border: 'none',
      boxShadow: 'none',
      transform: 'none',
      background: 'transparent',
      overflow: 'visible'
    });
  }

  if (!layoutDiv.querySelector('.layout-page-bg')) {
    createPageBackground(layoutDiv, 0, true);
    recalculateLayoutPositions();
  }

  if (!layoutDiv.dataset.layoutDropBound) {
    layoutDiv.addEventListener('dragover', function(e) { e.preventDefault(); });
    layoutDiv.addEventListener('drop', handleLayoutDrop);
    layoutDiv.addEventListener('mousedown', handleLayoutMouseDown);
    layoutDiv.dataset.layoutDropBound = 'true';
  }

  if (!window.__layoutMouseBound) {
    window.addEventListener('mousemove', handleLayoutMouseMove);
    window.addEventListener('mouseup', handleLayoutMouseUp);
    window.__layoutMouseBound = true;
  }

  var centerPanel = document.querySelector('#tab-index .panel-center');
  if (centerPanel && !document.getElementById('layout-zoom-ctrl')) {
    var zDiv = document.createElement('div');
    zDiv.id = 'layout-zoom-ctrl';
    zDiv.className = 'zoom-float';
    zDiv.innerHTML = '<button class="btn-zoom" id="layoutZoomIn">+</button><span class="zoom-text" id="layoutZoomReset">1:1</span><button class="btn-zoom" id="layoutZoomOut">-</button>';
    centerPanel.appendChild(zDiv);
    document.getElementById('layoutZoomIn').onclick = function() { updateLayoutZoom(0.1); };
    document.getElementById('layoutZoomOut').onclick = function() { updateLayoutZoom(-0.1); };
    document.getElementById('layoutZoomReset').onclick = function() { layoutScale = 1.0; updateLayoutZoom(0); };
  }

  layoutSidebarRef = document.querySelector('#layout-tools-panel .panel-content');
  if (layoutSidebarRef && !document.getElementById('layout-load-input')) {
    var input = document.createElement('input');
    input.type = 'file';
    input.id = 'layout-load-input';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', handleLayoutLoadInput);
    layoutSidebarRef.appendChild(input);
  }

  createLayoutUI();
  createLayoutLayerUI();

  if (!layoutDidSetup) {
    loadLayoutFromLocalStorage();
    observeLayoutForAutosave();
    layoutDidSetup = true;
  } else {
    restoreLayoutState(layoutDiv.innerHTML);
    updateLayerPanel();
  }

  updateLayoutZoom(0);
}

function showLayoutFloatingPanel(panel, left, top, zIndex) {
  if (!panel) return;
  if (panel.parentNode !== document.body) {
    document.body.appendChild(panel);
  }
  panel.style.display = 'flex';
  panel.style.visibility = 'visible';
  panel.style.opacity = '1';
  panel.style.pointerEvents = 'auto';
  panel.style.position = 'fixed';
  panel.style.left = left;
  panel.style.top = top;
  panel.style.right = 'auto';
  panel.style.width = '280px';
  panel.style.height = panel.dataset.collapsed === 'true' ? panel.style.height : '';
  panel.style.minHeight = panel.dataset.collapsed === 'true' ? panel.style.minHeight : '';
  panel.style.maxHeight = '80vh';
  panel.style.zIndex = zIndex;
  panel.dataset.hiddenByTab = 'false';

  var content = panel.querySelector('.panel-content');
  if (content && panel.dataset.collapsed !== 'true') {
    content.style.display = content.dataset.expandedDisplay || 'block';
  }
}

function hideLayoutToolsPanel() {
  ['layout-tools-panel', 'layout-layer-panel'].forEach(function(id) {
    var panel = document.getElementById(id);
    if (!panel) return;
    panel.style.display = 'none';
    panel.style.visibility = 'hidden';
    panel.style.pointerEvents = 'none';
  });
}

function ensureLayoutLayerPanel() {
  var panel = document.getElementById('layout-layer-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'layout-layer-panel';
  panel.className = 'floating-panel';
  panel.innerHTML = [
    '<div class="panel-header">',
    '<span>Layers</span>',
    '<button class="panel-minimize-btn" type="button"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIyIiB2aWV3Qm94PSIwIDAgMTAgMiI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjIiIGZpbGw9IiNmZmYiLz48L3N2Zz4=" class="pixel-icon" style="width:10px;height:2px;background:#fff;"></button>',
    '</div>',
    '<div class="panel-content" style="padding:10px; overflow-y:auto;">',
    '<div id="layout-layer-settings"></div>',
    '<div class="section-title" style="margin-top:10px;">Layers</div>',
    '<div id="layer-list" class="layer-list"></div>',
    '</div>'
  ].join('');
  document.body.appendChild(panel);
  if (typeof bindPanelToggle === 'function') bindPanelToggle();
  return panel;
}

function handleLayoutDrop(e) {
  e.preventDefault();
  var layoutDiv = document.getElementById('layout-canvas-holder');
  if (!layoutDiv) return;
  var rect = layoutDiv.getBoundingClientRect();
  var x = (e.clientX - rect.left) / layoutScale;
  var y = (e.clientY - rect.top) / layoutScale;

  var json = e.dataTransfer.getData('application/json');
  if (json) {
    try {
      var payload = JSON.parse(json);
      if (payload && payload.type === 'thought' && payload.text) {
        saveLayoutState();
        createLayoutTextBox(x - 150, y - 80, 300, 160, payload.text);
        return;
      }
      if (payload && payload.dataURL) {
        addLayoutImage(payload.dataURL, x - 75, y - 75);
        return;
      }
    } catch (err) {}
  }

  if (window.draggedLibItem && window.draggedLibItem.extraData && window.draggedLibItem.extraData.text) {
    saveLayoutState();
    createLayoutTextBox(x - 150, y - 80, 300, 160, window.draggedLibItem.extraData.text);
    window.draggedLibItem = null;
    return;
  }

  var data = e.dataTransfer.getData('text/plain');
  if (data && data.indexOf('data:image') === 0) addLayoutImage(data, x - 75, y - 75);
}

function addLayoutImage(data, x, y) {
  resizeBase64Img(data, 1600, 0.9, function(optimizedData) {
    saveLayoutState();
    var holder = document.getElementById('layout-canvas-holder');
    if (!holder) return;

    var wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      width: '150px',
      height: '150px',
      cursor: 'move'
    });
    var img = document.createElement('img');
    img.src = optimizedData;
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
      objectFit: 'contain'
    });
    wrapper.appendChild(img);
    holder.appendChild(wrapper);
    makeElementInteractive(wrapper);
    selectLayoutElement(wrapper);
    updateLayerPanel();
  });
}

function handleLayoutMouseDown(e) {
  if (layoutTool !== 'TEXT_BOX') return;
  var layoutDiv = document.getElementById('layout-canvas-holder');
  var rect = layoutDiv.getBoundingClientRect();
  isDrawingTextBox = true;
  drawStart.x = (e.clientX - rect.left) / layoutScale;
  drawStart.y = (e.clientY - rect.top) / layoutScale;
  tempDrawBox = document.createElement('div');
  tempDrawBox.className = 'drawing-box';
  Object.assign(tempDrawBox.style, {
    position: 'absolute',
    left: drawStart.x + 'px',
    top: drawStart.y + 'px',
    width: '0px',
    height: '0px',
    border: '1px dashed #0072BC',
    pointerEvents: 'none'
  });
  layoutDiv.appendChild(tempDrawBox);
  e.preventDefault();
}

function handleLayoutMouseMove(e) {
  if (!isDrawingTextBox || !tempDrawBox) return;
  var layoutDiv = document.getElementById('layout-canvas-holder');
  var rect = layoutDiv.getBoundingClientRect();
  var currX = (e.clientX - rect.left) / layoutScale;
  var currY = (e.clientY - rect.top) / layoutScale;
  var w = currX - drawStart.x;
  var h = currY - drawStart.y;
  tempDrawBox.style.width = Math.abs(w) + 'px';
  tempDrawBox.style.height = Math.abs(h) + 'px';
  tempDrawBox.style.left = (w < 0 ? currX : drawStart.x) + 'px';
  tempDrawBox.style.top = (h < 0 ? currY : drawStart.y) + 'px';
}

function handleLayoutMouseUp() {
  if (!isDrawingTextBox) return;
  isDrawingTextBox = false;
  if (tempDrawBox) {
    finalizeTextBox(tempDrawBox);
    tempDrawBox = null;
  }
  layoutTool = 'SELECT';
  document.body.style.cursor = 'default';
  var btn = document.getElementById('btn-draw-text');
  if (btn) btn.style.background = '';
}

function getBlendTarget(elmnt) {
  if (!elmnt) return null;
  return elmnt.querySelector('textarea, img') || elmnt;
}

function applyBlendMode(elmnt, mode) {
  if (!elmnt) return;
  var target = getBlendTarget(elmnt);
  if (!target) return;
  if (target !== elmnt) elmnt.style.mixBlendMode = 'normal';
  target.style.mixBlendMode = mode;
  elmnt.dataset.blendMode = mode;
}

function getBlendModeForElement(elmnt) {
  if (!elmnt) return 'normal';
  if (elmnt.dataset && elmnt.dataset.blendMode) return elmnt.dataset.blendMode;
  var target = getBlendTarget(elmnt);
  return target ? (window.getComputedStyle(target).mixBlendMode || 'normal') : 'normal';
}

function createLayoutUI() {
  var controls = document.getElementById('layer-controls');
  if (!controls) return;
  controls.innerHTML = '';

  var group = document.createElement('div');
  group.id = 'layout-ui-group';
  controls.appendChild(group);

  addSection(group, 'History');
  var histRow = miniRow(group);
  addButton(histRow, 'UNDO', undoLayout);
  addButton(histRow, 'REDO', redoLayout);

  addSection(group, 'Paper Pattern');
  var patRow = miniRow(group);
  addButton(patRow, '<-', function() { changeActiveArtboardPattern(-1); });
  addButton(patRow, '->', function() { changeActiveArtboardPattern(1); });

  addSection(group, 'Align Object');
  var align1 = miniRow(group);
  addButton(align1, 'Left', function() { alignLayoutObject('left'); });
  addButton(align1, 'Ctr', function() { alignLayoutObject('center'); });
  addButton(align1, 'Right', function() { alignLayoutObject('right'); });
  var align2 = miniRow(group);
  addButton(align2, 'Top', function() { alignLayoutObject('top'); });
  addButton(align2, 'Mid', function() { alignLayoutObject('middle'); });
  addButton(align2, 'Bot', function() { alignLayoutObject('bottom'); });

  addSection(group, 'Text Tool');
  var txtRow = miniRow(group);
  var btnDrawText = addButton(txtRow, 'Draw Text Box', function() {
    layoutTool = 'TEXT_BOX';
    document.body.style.cursor = 'crosshair';
    btnDrawText.style.background = '#faec21';
  });
  btnDrawText.id = 'btn-draw-text';

  var textAlignRow = miniRow(group);
  addButton(textAlignRow, 'Left', function() { applyTextAlign('left'); });
  addButton(textAlignRow, 'Center', function() { applyTextAlign('center'); });
  addButton(textAlignRow, 'Right', function() { applyTextAlign('right'); });

  var styleRow = miniRow(group);
  var sizeLabel = document.createElement('span');
  sizeLabel.textContent = 'Size:';
  sizeLabel.style.fontSize = '14px';
  styleRow.appendChild(sizeLabel);
  var sizeInput = document.createElement('input');
  sizeInput.id = 'text-size-input';
  sizeInput.type = 'number';
  sizeInput.min = '1';
  sizeInput.value = '24';
  sizeInput.className = 'retro-input';
  sizeInput.style.width = '50px';
  sizeInput.oninput = function() {
    var ta = selectedLayoutElement && selectedLayoutElement.querySelector('textarea');
    if (ta && sizeInput.value) {
      ta.style.fontSize = sizeInput.value + 'px';
      saveLayoutState();
    }
  };
  styleRow.appendChild(sizeInput);

  var fontSelect = document.createElement('select');
  fontSelect.id = 'text-font-select';
  fontSelect.className = 'retro-input';
  fontSelect.style.width = '90px';
  ['KK7VCROSDMono', 'FT88', 'HLHoctro', 'BianzhidaiBase', 'ocr-a-std', 'Courier New'].forEach(function(font) {
    var opt = document.createElement('option');
    opt.value = font;
    opt.textContent = font;
    fontSelect.appendChild(opt);
  });
  fontSelect.onchange = function() {
    var ta = selectedLayoutElement && selectedLayoutElement.querySelector('textarea');
    if (ta) {
      ta.style.fontFamily = "'" + fontSelect.value + "', monospace";
      saveLayoutState();
    }
  };
  styleRow.appendChild(fontSelect);

  var colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.id = 'text-color-picker';
  colorPicker.value = '#000000';
  colorPicker.oninput = function() {
    var ta = selectedLayoutElement && selectedLayoutElement.querySelector('textarea');
    if (ta) {
      ta.style.color = colorPicker.value;
      saveLayoutState();
    }
  };
  styleRow.appendChild(colorPicker);

  addSection(group, 'Settings');
  var snapRow = miniRow(group);
  var snap = document.createElement('label');
  snap.style.fontFamily = 'monospace';
  snap.style.fontSize = '14px';
  snap.innerHTML = '<input type="checkbox" id="layout-snap"> Snap to Grid';
  snapRow.appendChild(snap);
  document.getElementById('layout-snap').checked = isSnapToGrid;
  document.getElementById('layout-snap').onchange = function(e) { isSnapToGrid = e.target.checked; };

  addSection(group, 'Export');
  var expRow = miniRow(group);
  addButton(expRow, 'Save PNG', exportActiveArtboardPNG);
  addButton(expRow, 'Save PDF', exportAllArtboardsPDF);
  var trans = document.createElement('label');
  trans.style.fontFamily = 'monospace';
  trans.style.fontSize = '14px';
  trans.innerHTML = '<input type="checkbox" id="layout-transparent"> Transparent BG';
  group.appendChild(trans);
  document.getElementById('layout-transparent').checked = !!window.exportTransparent;
  document.getElementById('layout-transparent').onchange = function(e) { window.exportTransparent = e.target.checked; };

  addSection(group, 'Project');
  var projRow = miniRow(group);
  addButton(projRow, 'Load Layout', function() {
    var input = document.getElementById('layout-load-input');
    if (input) input.click();
  });
  addButton(projRow, 'Reset', function() {
    if (!confirm('Reset layout and clear saved data?')) return;
    var holder = document.getElementById('layout-canvas-holder');
    holder.innerHTML = '';
    localStorage.removeItem('mem_idx_layout_content');
    createPageBackground(holder, 0, true);
    recalculateLayoutPositions();
    updateLayerPanel();
  });
}

function createLayoutLayerUI() {
  var panel = ensureLayoutLayerPanel();
  var settings = document.getElementById('layout-layer-settings');
  if (!panel || !settings) return;
  settings.innerHTML = '';

  addSection(settings, 'Layer Settings');

  var blendRow = miniRow(settings);
  var blendLabel = document.createElement('span');
  blendLabel.textContent = 'Blend:';
  blendLabel.style.fontSize = '14px';
  blendRow.appendChild(blendLabel);

  var blend = document.createElement('select');
  blend.id = 'blend-mode-select';
  blend.className = 'retro-input';
  blend.style.width = '68%';
  ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion'].forEach(function(mode) {
    var opt = document.createElement('option');
    opt.value = mode;
    opt.textContent = mode;
    blend.appendChild(opt);
  });
  blend.onchange = function() {
    if (!selectedLayoutElement) return;
    saveLayoutState();
    applyBlendMode(selectedLayoutElement, blend.value);
    saveLayoutToLocalStorage();
  };
  blendRow.appendChild(blend);

  var opacityRow = miniRow(settings);
  var opacityLabel = document.createElement('span');
  opacityLabel.textContent = 'Opacity:';
  opacityLabel.style.fontSize = '14px';
  opacityRow.appendChild(opacityLabel);

  var opacity = document.createElement('input');
  opacity.type = 'range';
  opacity.id = 'layout-opacity-slider';
  opacity.min = '0';
  opacity.max = '100';
  opacity.step = '1';
  opacity.value = '100';
  opacity.style.flex = '1';
  opacityRow.appendChild(opacity);

  var opacityValue = document.createElement('input');
  opacityValue.type = 'number';
  opacityValue.id = 'layout-opacity-value';
  opacityValue.min = '0';
  opacityValue.max = '100';
  opacityValue.step = '1';
  opacityValue.value = '100';
  opacityValue.className = 'retro-input';
  opacityValue.style.width = '52px';
  opacityRow.appendChild(opacityValue);

  var applyOpacity = function(value, shouldSaveHistory) {
    if (!selectedLayoutElement) return;
    var pct = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    if (shouldSaveHistory) saveLayoutState();
    selectedLayoutElement.style.opacity = String(pct / 100);
    opacity.value = String(pct);
    opacityValue.value = String(pct);
    saveLayoutToLocalStorage();
  };

  opacity.oninput = function() { applyOpacity(opacity.value, false); };
  opacity.onchange = function() { applyOpacity(opacity.value, true); };
  opacityValue.onchange = function() { applyOpacity(opacityValue.value, true); };

  syncSelectedElementControls();
}

function addSection(parent, text) {
  var el = document.createElement('div');
  el.className = 'section-title';
  el.textContent = text;
  el.style.fontWeight = '700';
  el.style.fontSize = '16px';
  parent.appendChild(el);
}

function miniRow(parent) {
  var row = document.createElement('div');
  row.className = 'mini-row';
  row.style.gap = '4px';
  parent.appendChild(row);
  return row;
}

function addButton(parent, label, cb) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-retro';
  btn.innerHTML = label;
  btn.style.flex = '1';
  btn.style.fontSize = '10px';
  btn.onclick = cb;
  parent.appendChild(btn);
  return btn;
}

function alignLayoutObject(mode) {
  if (!selectedLayoutElement) return;
  var context = activeArtboard || document.querySelector('.layout-page-bg');
  if (!context) return;
  saveLayoutState();
  var elW = selectedLayoutElement.offsetWidth;
  var elH = selectedLayoutElement.offsetHeight;
  var bgL = context.offsetLeft;
  var bgT = context.offsetTop;
  var bgW = context.offsetWidth;
  var bgH = context.offsetHeight;
  var pad = 40;
  if (mode === 'left') selectedLayoutElement.style.left = (bgL + pad) + 'px';
  if (mode === 'center') selectedLayoutElement.style.left = (bgL + (bgW - elW) / 2) + 'px';
  if (mode === 'right') selectedLayoutElement.style.left = (bgL + bgW - elW - pad) + 'px';
  if (mode === 'top') selectedLayoutElement.style.top = (bgT + pad) + 'px';
  if (mode === 'middle') selectedLayoutElement.style.top = (bgT + (bgH - elH) / 2) + 'px';
  if (mode === 'bottom') selectedLayoutElement.style.top = (bgT + bgH - elH - pad) + 'px';
  saveLayoutToLocalStorage();
}

function applyTextAlign(align) {
  if (!selectedLayoutElement) return;
  selectedLayoutElement.style.textAlign = align;
  var ta = selectedLayoutElement.querySelector('textarea');
  if (ta) ta.style.textAlign = align;
  saveLayoutState();
}

function finalizeTextBox(tempBox) {
  saveLayoutState();
  var w = parseFloat(tempBox.style.width);
  var h = parseFloat(tempBox.style.height);
  var l = parseFloat(tempBox.style.left);
  var t = parseFloat(tempBox.style.top);
  tempBox.remove();
  if (w < 12 || h < 12) return;
  createLayoutTextBox(l, t, w, h, '');
}

function createLayoutTextBox(x, y, w, h, content) {
  var holder = document.getElementById('layout-canvas-holder');
  if (!holder) return;

  var wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position: 'absolute',
    left: x + 'px',
    top: y + 'px',
    width: w + 'px',
    height: h + 'px',
    border: 'none'
  });
  var ta = document.createElement('textarea');
  ta.value = content || '';
  ta.innerHTML = content || '';
  Object.assign(ta.style, {
    width: '100%',
    height: '100%',
    background: 'transparent',
    border: 'none',
    resize: 'none',
    fontFamily: "'KK7VCROSDMono', monospace",
    fontSize: '24px',
    outline: 'none',
    overflow: 'hidden',
    color: '#000'
  });
  wrapper.appendChild(ta);
  holder.appendChild(wrapper);
  makeElementInteractive(wrapper);
  selectLayoutElement(wrapper);
  if (!content) ta.focus();
  updateLayerPanel();
}

function selectLayoutElement(elmnt) {
  if (selectedLayoutElement && selectedLayoutElement !== elmnt) {
    selectedLayoutElement.style.outline = 'none';
    selectedLayoutElement.querySelectorAll('.resize-handle, .rotate-handle, .move-handle').forEach(function(h) {
      h.style.display = 'none';
    });
  }
  selectedLayoutElement = elmnt;
  if (selectedLayoutElement) {
    selectedLayoutElement.style.outline = '1px dashed #0072BC';
    selectedLayoutElement.querySelectorAll('.resize-handle, .rotate-handle, .move-handle').forEach(function(h) {
      h.style.display = 'block';
    });
    syncSelectedElementControls();
  }
  updateLayerPanelSelection();
}

function syncSelectedElementControls() {
  var ta = selectedLayoutElement && selectedLayoutElement.querySelector('textarea');
  if (ta) {
    var size = document.getElementById('text-size-input');
    if (size) size.value = parseInt(window.getComputedStyle(ta).fontSize, 10) || 24;
    var font = document.getElementById('text-font-select');
    if (font) {
      var current = window.getComputedStyle(ta).fontFamily.replace(/['"]/g, '');
      Array.from(font.options).some(function(opt) {
        if (current.indexOf(opt.value) !== -1) {
          font.value = opt.value;
          return true;
        }
        return false;
      });
    }
    var picker = document.getElementById('text-color-picker');
    if (picker) picker.value = rgbToHex(window.getComputedStyle(ta).color);
  }
  var blend = document.getElementById('blend-mode-select');
  if (blend) blend.value = getBlendModeForElement(selectedLayoutElement);

  var opacity = document.getElementById('layout-opacity-slider');
  var opacityValue = document.getElementById('layout-opacity-value');
  if (opacity || opacityValue) {
    var pct = selectedLayoutElement ? Math.round((parseFloat(window.getComputedStyle(selectedLayoutElement).opacity) || 1) * 100) : 100;
    if (opacity) opacity.value = String(pct);
    if (opacityValue) opacityValue.value = String(pct);
  }
}

function rgbToHex(value) {
  var nums = (value.match(/\d+/g) || [0, 0, 0]).map(Number);
  return '#' + nums.slice(0, 3).map(function(n) {
    return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  }).join('');
}

function makeElementInteractive(elmnt) {
  elmnt.querySelectorAll('.resize-handle, .rotate-handle, .move-handle').forEach(function(h) { h.remove(); });
  var ta = elmnt.querySelector('textarea');
  if (ta) {
    ta.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      selectLayoutElement(elmnt);
    });
    ta.addEventListener('input', function() {
      this.innerHTML = this.value;
      saveLayoutToLocalStorage();
    });
    var move = document.createElement('div');
    move.className = 'move-handle';
    move.title = 'Drag to move';
    move.style.display = 'none';
    elmnt.appendChild(move);
  }

  elmnt.onmousedown = function(e) {
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
    if (e.target.tagName === 'TEXTAREA') return;
    saveLayoutState();
    selectLayoutElement(elmnt);
    e.preventDefault();
    var startX = e.clientX;
    var startY = e.clientY;
    var startLeft = elmnt.offsetLeft;
    var startTop = elmnt.offsetTop;
    document.onmousemove = function(ev) {
      var dx = (ev.clientX - startX) / layoutScale;
      var dy = (ev.clientY - startY) / layoutScale;
      var newLeft = startLeft + dx;
      var newTop = startTop + dy;
      if (isSnapToGrid) {
        newLeft = Math.round(newLeft / snapSize) * snapSize;
        newTop = Math.round(newTop / snapSize) * snapSize;
      }
      elmnt.style.left = newLeft + 'px';
      elmnt.style.top = newTop + 'px';
    };
    document.onmouseup = function() {
      document.onmousemove = null;
      document.onmouseup = null;
      saveLayoutToLocalStorage();
    };
  };

  elmnt.oncontextmenu = function(e) {
    e.preventDefault();
    selectLayoutElement(elmnt);
    var oldMenu = document.getElementById('layout-ctx-menu');
    if (oldMenu) oldMenu.remove();
    var menu = document.createElement('div');
    menu.id = 'layout-ctx-menu';
    Object.assign(menu.style, {
      position: 'fixed',
      left: e.clientX + 'px',
      top: e.clientY + 'px',
      background: '#fff',
      border: '1px solid #0072BC',
      boxShadow: '2px 2px 0 #0072BC',
      zIndex: '10000',
      fontFamily: "'KK7VCROSDMono', monospace",
      fontSize: '14px'
    });
    menu.appendChild(contextItem('Bring to Front', function() { elmnt.parentNode.appendChild(elmnt); updateLayerPanel(); }));
    menu.appendChild(contextItem('Send to Back', function() {
      var holder = document.getElementById('layout-canvas-holder');
      var firstContent = Array.from(holder.children).find(function(child) { return !child.classList.contains('layout-page-bg'); });
      holder.insertBefore(elmnt, firstContent || null);
      updateLayerPanel();
    }));
    document.body.appendChild(menu);
    setTimeout(function() {
      window.addEventListener('click', function closeMenu() {
        menu.remove();
        window.removeEventListener('click', closeMenu);
      });
    }, 10);
  };

  var handle = document.createElement('div');
  handle.className = 'resize-handle';
  Object.assign(handle.style, {
    display: 'none',
    width: '10px',
    height: '10px',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    position: 'absolute',
    right: '0',
    bottom: '0',
    cursor: 'nwse-resize',
    zIndex: '10'
  });
  elmnt.appendChild(handle);

  if (elmnt.querySelector('img')) {
    var rot = document.createElement('div');
    rot.className = 'rotate-handle';
    Object.assign(rot.style, {
      display: 'none',
      width: '10px',
      height: '10px',
      background: '#f75397',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      position: 'absolute',
      left: '50%',
      top: '-15px',
      transform: 'translateX(-50%)',
      cursor: 'grab',
      borderRadius: '50%',
      zIndex: '10'
    });
    elmnt.appendChild(rot);
    rot.onmousedown = function(e) {
      saveLayoutState();
      e.stopPropagation();
      e.preventDefault();
      var rect = elmnt.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      document.onmousemove = function(ev) {
        var angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
        elmnt.style.transform = 'rotate(' + ((angle * 180 / Math.PI) + 90) + 'deg)';
      };
      document.onmouseup = function() {
        document.onmousemove = null;
        document.onmouseup = null;
        saveLayoutToLocalStorage();
      };
    };
  }

  handle.onmousedown = function(e) {
    saveLayoutState();
    e.stopPropagation();
    e.preventDefault();
    selectLayoutElement(elmnt);
    var startX = e.clientX;
    var startY = e.clientY;
    var startW = parseInt(window.getComputedStyle(elmnt).width, 10);
    var startH = parseInt(window.getComputedStyle(elmnt).height, 10);
    document.onmousemove = function(ev) {
      var dx = (ev.clientX - startX) / layoutScale;
      var dy = (ev.clientY - startY) / layoutScale;
      var newW = Math.max(20, startW + dx);
      var newH = Math.max(20, startH + dy);
      if (elmnt.querySelector('img') && ev.shiftKey) newH = newW / (startW / startH);
      elmnt.style.width = newW + 'px';
      elmnt.style.height = newH + 'px';
    };
    document.onmouseup = function() {
      document.onmousemove = null;
      document.onmouseup = null;
      saveLayoutToLocalStorage();
    };
  };
}

function contextItem(text, action) {
  var item = document.createElement('div');
  item.textContent = text;
  item.style.padding = '6px 12px';
  item.style.cursor = 'pointer';
  item.onmouseenter = function() { item.style.background = '#0072BC'; item.style.color = '#fff'; };
  item.onmouseleave = function() { item.style.background = ''; item.style.color = '#000'; };
  item.onclick = function(e) {
    e.stopPropagation();
    action();
    var menu = document.getElementById('layout-ctx-menu');
    if (menu) menu.remove();
  };
  return item;
}

function saveLayoutState() {
  var holder = document.getElementById('layout-canvas-holder');
  if (!holder) return;
  syncLayoutTextareas(holder);
  layoutHistory.push(holder.innerHTML);
  if (layoutHistory.length > MAX_LAYOUT_HISTORY) layoutHistory.shift();
  layoutRedoHistory = [];
}

function undoLayout() {
  if (!layoutHistory.length) return;
  var holder = document.getElementById('layout-canvas-holder');
  layoutRedoHistory.push(holder.innerHTML);
  restoreLayoutState(layoutHistory.pop());
}

function redoLayout() {
  if (!layoutRedoHistory.length) return;
  var holder = document.getElementById('layout-canvas-holder');
  layoutHistory.push(holder.innerHTML);
  restoreLayoutState(layoutRedoHistory.pop());
}

function restoreLayoutState(htmlState) {
  var holder = document.getElementById('layout-canvas-holder');
  if (!holder) return;
  holder.innerHTML = htmlState || '';
  var oldBtn = holder.querySelector('#btn-add-artboard-canvas');
  if (oldBtn) oldBtn.remove();

  Array.from(holder.children).forEach(function(el) {
    if (el.classList.contains('layout-page-bg')) {
      normalizePageBackground(el);
      el.onclick = function(e) {
        e.stopPropagation();
        setActiveArtboard(el);
        selectLayoutElement(null);
      };
      return;
    }
    makeElementInteractive(el);
    if (el.dataset && el.dataset.blendMode) applyBlendMode(el, el.dataset.blendMode);
  });

  selectedLayoutElement = null;
  var firstBg = holder.querySelector('.layout-page-bg');
  if (firstBg) setActiveArtboard(firstBg);
  else createPageBackground(holder, 0, true);
  recalculateLayoutPositions();
  updateLayerPanel();
}

function copyLayoutSelection() {
  if (selectedLayoutElement) layoutClipboard = { type: 'element', html: selectedLayoutElement.outerHTML };
}

function pasteLayoutSelection() {
  if (!layoutClipboard || layoutClipboard.type !== 'element') return;
  saveLayoutState();
  var holder = document.getElementById('layout-canvas-holder');
  var temp = document.createElement('div');
  temp.innerHTML = layoutClipboard.html;
  var el = temp.firstElementChild;
  el.querySelectorAll('.resize-handle, .rotate-handle, .move-handle').forEach(function(h) { h.remove(); });
  el.style.left = (parseInt(el.style.left || 0, 10) + 20) + 'px';
  el.style.top = (parseInt(el.style.top || 0, 10) + 20) + 'px';
  el.style.outline = 'none';
  holder.appendChild(el);
  makeElementInteractive(el);
  selectLayoutElement(el);
  updateLayerPanel();
}

function createPageBackground(parent, index, setAsActive) {
  var h = 1123;
  var gap = 20;
  var bg = document.createElement('div');
  bg.className = 'layout-page-bg';
  bg.dataset.pattern = '1';
  Object.assign(bg.style, {
    position: 'absolute',
    left: '0px',
    top: (index * (h + gap)) + 'px',
    width: '100%',
    height: h + 'px',
    backgroundColor: 'white',
    border: '1px dashed #0072BC',
    boxSizing: 'border-box',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    zIndex: '0',
    pointerEvents: 'auto',
    overflow: 'hidden',
    cursor: 'pointer'
  });
  bg.onclick = function(e) {
    e.stopPropagation();
    setActiveArtboard(bg);
    selectLayoutElement(null);
  };

  var pattern = document.createElement('div');
  pattern.className = 'layout-pattern-layer';
  Object.assign(pattern.style, {
    position: 'absolute',
    width: h + 'px',
    height: '794px',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    backgroundImage: "url('assets/canvas%20template/paper%20pattern%201.png')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    pointerEvents: 'none'
  });
  bg.appendChild(pattern);

  var label = document.createElement('div');
  label.className = 'artboard-label';
  label.textContent = 'Artboard ' + (index + 1);
  Object.assign(label.style, {
    position: 'absolute',
    top: '-20px',
    left: '-1px',
    background: '#0072BC',
    color: 'white',
    fontSize: '14px',
    padding: '2px 6px',
    fontWeight: 'bold',
    fontFamily: "'KK7VCROSDMono', monospace",
    textTransform: 'lowercase',
    pointerEvents: 'none'
  });
  bg.appendChild(label);
  parent.appendChild(bg);
  if (setAsActive) setActiveArtboard(bg);
  return bg;
}

function normalizePageBackground(bg) {
  if (!bg) return;
  Object.assign(bg.style, {
    position: 'absolute',
    left: '0px',
    width: '100%',
    height: '1123px',
    backgroundColor: 'white',
    boxSizing: 'border-box',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    zIndex: '0',
    pointerEvents: 'auto',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'block'
  });
  if (!bg.getAttribute('data-pattern')) bg.setAttribute('data-pattern', '1');

  var pattern = bg.querySelector('.layout-pattern-layer');
  if (!pattern) {
    pattern = document.createElement('div');
    pattern.className = 'layout-pattern-layer';
    bg.insertBefore(pattern, bg.firstChild);
  }
  var pat = bg.getAttribute('data-pattern') || '1';
  Object.assign(pattern.style, {
    position: 'absolute',
    width: '1123px',
    height: '794px',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    backgroundImage: "url('assets/canvas%20template/paper%20pattern%20" + pat + ".png')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    pointerEvents: 'none'
  });
}

function addArtboardRelative(targetBgElt) {
  saveLayoutState();
  var holder = document.getElementById('layout-canvas-holder');
  if (!holder) return null;
  var pageH = 1123;
  var gap = 20;
  var shiftAmount = pageH + gap;
  var thresholdY = targetBgElt.offsetTop + pageH;
  Array.from(holder.children).forEach(function(el) {
    if (el.classList.contains('layout-page-bg') || el.id === 'btn-add-artboard-canvas') return;
    var currentTop = parseInt(el.style.top || 0, 10);
    if (currentTop >= thresholdY - 5) el.style.top = (currentTop + shiftAmount) + 'px';
  });
  var newBg = createPageBackground(holder, 0, false);
  if (targetBgElt.nextSibling) holder.insertBefore(newBg, targetBgElt.nextSibling);
  recalculateLayoutPositions();
  setActiveArtboard(newBg);
  updateLayerPanel();
  return newBg;
}

function recalculateLayoutPositions() {
  var holder = document.getElementById('layout-canvas-holder');
  if (!holder) return;
  var bgs = holder.querySelectorAll('.layout-page-bg');
  var pageH = 1123;
  var gap = 20;
  bgs.forEach(function(bg, i) {
    bg.style.top = (i * (pageH + gap)) + 'px';
    var lbl = bg.querySelector('.artboard-label');
    if (lbl) lbl.textContent = 'Artboard ' + (i + 1);
  });
  var totalH = bgs.length * (pageH + gap);
  var btn = document.getElementById('btn-add-artboard-canvas');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btn-add-artboard-canvas';
    btn.textContent = '+';
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
      padding: '0'
    });
    btn.onclick = function() {
      var target = activeArtboard || holder.querySelector('.layout-page-bg:last-of-type');
      if (target) addArtboardRelative(target);
    };
    holder.appendChild(btn);
  }
  btn.style.top = totalH + 'px';
  holder.style.height = (totalH + 80) + 'px';
}

function setActiveArtboard(el) {
  activeArtboard = el;
  document.querySelectorAll('.layout-page-bg').forEach(function(bg) {
    bg.style.border = '1px dashed #0072BC';
  });
  if (activeArtboard) activeArtboard.style.border = '2px solid #f75397';
}

function changeActiveArtboardPattern(dir) {
  if (!activeArtboard) {
    var first = document.querySelector('.layout-page-bg');
    if (first) setActiveArtboard(first);
    else return;
  }
  var current = parseInt(activeArtboard.getAttribute('data-pattern') || activeArtboard.dataset.pattern || 1, 10);
  current += dir;
  if (current < 1) current = MAX_PATTERNS;
  if (current > MAX_PATTERNS) current = 1;
  activeArtboard.setAttribute('data-pattern', current);
  var layer = activeArtboard.querySelector('.layout-pattern-layer');
  if (layer) layer.style.backgroundImage = "url('assets/canvas%20template/paper%20pattern%20" + current + ".png')";
  saveLayoutToLocalStorage();
}

function updateLayerPanel() {
  var layerList = document.getElementById('layer-list');
  var artboard = document.getElementById('layout-canvas-holder');
  if (!layerList || !artboard) return;
  layerList.innerHTML = '';
  var layers = Array.from(artboard.children).filter(function(el) {
    return !el.classList.contains('layout-page-bg') && el.id !== 'btn-add-artboard-canvas' && el.style.position;
  });
  for (var i = layers.length - 1; i >= 0; i--) {
    var el = layers[i];
    if (!el.id) el.id = 'layout-layer-' + Date.now() + '-' + i;
    var item = document.createElement('div');
    item.className = 'layer-item';
    item.draggable = true;
    item.dataset.targetId = el.id;
    item.textContent = el.querySelector('textarea') ? 'Text Box' : 'Image';
    if (selectedLayoutElement && selectedLayoutElement.id === el.id) item.classList.add('selected');
    item.onclick = function() {
      var target = document.getElementById(this.dataset.targetId);
      if (target) selectLayoutElement(target);
    };
    item.addEventListener('dragstart', handleLayerDragStart);
    item.addEventListener('dragover', handleLayerDragOver);
    item.addEventListener('drop', handleLayerDrop);

    var visBtn = document.createElement('button');
    visBtn.className = 'layer-toggle-vis';
    visBtn.textContent = el.classList.contains('hidden-layer') ? 'off' : 'on';
    visBtn.onclick = function(e) {
      e.stopPropagation();
      var targetEl = document.getElementById(this.parentNode.dataset.targetId);
      if (targetEl) {
        targetEl.classList.toggle('hidden-layer');
        this.textContent = targetEl.classList.contains('hidden-layer') ? 'off' : 'on';
      }
    };
    item.prepend(visBtn);
    layerList.appendChild(item);
  }
}

function updateLayerPanelSelection() {
  var layerList = document.getElementById('layer-list');
  if (!layerList) return;
  layerList.querySelectorAll('.layer-item').forEach(function(item) { item.classList.remove('selected'); });
  if (selectedLayoutElement && selectedLayoutElement.id) {
    var current = layerList.querySelector('[data-target-id="' + selectedLayoutElement.id + '"]');
    if (current) current.classList.add('selected');
  }
}

function handleLayerDragStart(e) {
  draggedLayerId = this.dataset.targetId;
  e.dataTransfer.effectAllowed = 'move';
}

function handleLayerDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleLayerDrop(e) {
  e.stopPropagation();
  var layerList = document.getElementById('layer-list');
  var draggedItem = layerList.querySelector('[data-target-id="' + draggedLayerId + '"]');
  if (!draggedItem || this === draggedItem) return;
  var rect = this.getBoundingClientRect();
  if (e.clientY - rect.top > rect.height / 2) this.parentNode.insertBefore(draggedItem, this.nextSibling);
  else this.parentNode.insertBefore(draggedItem, this);
  reorderDOMFromLayerList();
}

function reorderDOMFromLayerList() {
  var layerList = document.getElementById('layer-list');
  var artboard = document.getElementById('layout-canvas-holder');
  Array.from(layerList.children).reverse().forEach(function(item) {
    var el = document.getElementById(item.dataset.targetId);
    if (el) artboard.appendChild(el);
  });
  saveLayoutToLocalStorage();
}

function syncLayoutTextareas(holder) {
  holder.querySelectorAll('textarea').forEach(function(ta) {
    ta.innerHTML = ta.value;
  });
}

function saveLayoutToLocalStorage(immediate) {
  clearTimeout(saveLayoutTimeout);
  var doSave = function() {
    if (isLayoutExporting) return;
    var holder = document.getElementById('layout-canvas-holder');
    if (!holder) return;
    syncLayoutTextareas(holder);
    try {
      localStorage.setItem('mem_idx_layout_content', holder.innerHTML);
    } catch (e) {
      console.warn('Layout auto-save skipped.', e);
    }
  };
  if (immediate) doSave();
  else saveLayoutTimeout = setTimeout(doSave, 500);
}

function loadLayoutFromLocalStorage() {
  try {
    var content = localStorage.getItem('mem_idx_layout_content');
    if (content && content.trim()) restoreLayoutState(content);
    else updateLayerPanel();
  } catch (e) {
    console.error('Layout load failed', e);
    updateLayerPanel();
  }
}

function handleLayoutLoadInput(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      if (data.snap !== undefined) isSnapToGrid = data.snap;
      if (data.html) restoreLayoutState(data.html);
      saveLayoutToLocalStorage(true);
      createLayoutUI();
    } catch (err) {
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function resizeBase64Img(base64, maxWidth, quality, callback) {
  var img = new Image();
  img.onload = function() {
    var w = img.width;
    var h = img.height;
    if (w > maxWidth) {
      h = Math.floor(h * (maxWidth / w));
      w = maxWidth;
    }
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = function() { callback(base64); };
  img.src = base64;
}

function prepareLayoutExport(holder) {
  isLayoutExporting = true;
  var savedTransform = holder.style.transform;
  holder.style.transform = 'none';
  var hidden = holder.querySelectorAll('.resize-handle, .rotate-handle, .move-handle, .artboard-label, #btn-add-artboard-canvas');
  hidden.forEach(function(el) { el.dataset.oldDisplay = el.style.display; el.style.display = 'none'; });
  var outlines = Array.from(holder.children).map(function(el) { return { el: el, outline: el.style.outline }; });
  outlines.forEach(function(state) { state.el.style.outline = 'none'; });
  return function() {
    hidden.forEach(function(el) { el.style.display = el.dataset.oldDisplay || ''; delete el.dataset.oldDisplay; });
    outlines.forEach(function(state) { state.el.style.outline = state.outline; });
    holder.style.transform = savedTransform;
    isLayoutExporting = false;
  };
}

function cropCanvasToArtboard(fullCanvas, holder, artboardBg) {
  var holderRect = holder.getBoundingClientRect();
  var artRect = artboardBg.getBoundingClientRect();
  var scaleX = fullCanvas.width / holderRect.width;
  var scaleY = fullCanvas.height / holderRect.height;
  var x = Math.round((artRect.left - holderRect.left) * scaleX);
  var y = Math.round((artRect.top - holderRect.top) * scaleY);
  var w = Math.round(artRect.width * scaleX);
  var h = Math.round(artRect.height * scaleY);
  var canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(fullCanvas, x, y, w, h, 0, 0, w, h);
  return canvas;
}

async function exportActiveArtboardPNG() {
  if (!activeArtboard) {
    alert('Please select an artboard first.');
    return;
  }
  if (typeof htmlToImage === 'undefined') {
    alert('html-to-image library not loaded.');
    return;
  }
  var holder = document.getElementById('layout-canvas-holder');
  var restore = prepareLayoutExport(holder);
  try {
    var canvas = await htmlToImage.toCanvas(holder, { pixelRatio: 2, backgroundColor: window.exportTransparent ? null : '#ffffff' });
    var cropped = cropCanvasToArtboard(canvas, holder, activeArtboard);
    var link = document.createElement('a');
    link.download = 'memory-diagram.png';
    link.href = cropped.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Export PNG failed:', err);
  } finally {
    restore();
  }
}

async function exportAllArtboardsPDF() {
  if (typeof window.jspdf === 'undefined' || typeof htmlToImage === 'undefined') {
    alert('Export library not loaded.');
    return;
  }
  var holder = document.getElementById('layout-canvas-holder');
  var artboards = holder.querySelectorAll('.layout-page-bg');
  if (!artboards.length) return;
  var restore = prepareLayoutExport(holder);
  try {
    var canvas = await htmlToImage.toCanvas(holder, { pixelRatio: 2, backgroundColor: window.exportTransparent ? null : '#ffffff' });
    var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
    artboards.forEach(function(bg, i) {
      if (i > 0) doc.addPage();
      var cropped = cropCanvasToArtboard(canvas, holder, bg);
      doc.addImage(cropped.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    });
    doc.save('memory-index.pdf');
  } catch (err) {
    console.error('Export PDF failed:', err);
  } finally {
    restore();
  }
}

function observeLayoutForAutosave() {
  var artboard = document.getElementById('layout-canvas-holder');
  if (!artboard || artboard.dataset.layoutObserved) return;
  var observer = new MutationObserver(function(mutations) {
    saveLayoutToLocalStorage();
    if (mutations.some(function(m) { return m.type === 'childList'; })) updateLayerPanel();
  });
  observer.observe(artboard, { childList: true, attributes: true, subtree: true, attributeFilter: ['style', 'class', 'src', 'data-pattern'] });
  artboard.dataset.layoutObserved = 'true';
}

window.setupLayoutTab = setupLayoutTab;
window.updateLayoutZoom = updateLayoutZoom;
window.createLayoutTextBox = createLayoutTextBox;
window.addArtboardRelative = addArtboardRelative;
window.saveLayoutToLocalStorage = saveLayoutToLocalStorage;
window.hideLayoutToolsPanel = hideLayoutToolsPanel;

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(setupLayoutTab, 0);
});

window.addEventListener('beforeunload', function() {
  saveLayoutToLocalStorage(true);
});

window.addEventListener('keydown', function(e) {
  if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && e.shiftKey) {
    e.preventDefault();
    redoLayout();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undoLayout();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
    copyLayoutSelection();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
    pasteLayoutSelection();
  }
});
