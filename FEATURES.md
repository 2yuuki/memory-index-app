# ASCII Drawing Tool + CMYK Processor - Features

## Canvas Changes

### Background Grid
- **Simplified Grid**: Clean light gray grid lines (no more blue overlay or varying thicknesses)
- **White Canvas**: Pure white background for drawing

### Text Input Mode
- **Button**: Click the "Text" button in the toolbar to activate text input mode
- **Usage**: 
  1. Click the "Text" button (turns blue when active)
  2. Click on canvas to position text cursor
  3. Type your text (appears in real-time preview with blue highlight)
  4. Press ENTER to place the text
  5. Press BACKSPACE to delete characters
  6. Press ESCAPE to cancel

---

## CMYK Processor (Stabilo Stroke ASCII)

### Panel Location
- Right sidebar, under main ASCII tools
- Pink border section labeled "Stabilo Stroke ASCII Processor"

### Features

#### Image Upload
- Click "Upload Image" button
- Select any JPG/PNG image
- File name displays next to button

#### Real-time Overlay
- **"Show as Overlay"** checkbox: Toggle CMYK effect on/off in real-time
- Draws CMYK effect over your ASCII canvas
- Blend mode: MULTIPLY (realistic paper effect)

#### Drag & Drop to Canvas
- Process your image with CMYK effect
- **"Drag result to canvas"** message indicates drop zone
- Drop the processed image result onto canvas
- Automatically converts to ASCII characters at drop position

#### Control Sliders

| Control | Range | Default | Purpose |
|---------|-------|---------|---------|
| Scale % | 10-200 | 100 | Image size in processor |
| Stroke | 0.1-5.0 | 2.0 | Line thickness |
| Offset | 0-5.0 | 2.0 | Color separation distance |
| Threshold | 0-100 | 5 | Visibility threshold |
| Gamma | 0.5-3.0 | 1.1 | Brightness contrast |
| Grid | 4-100 | 11 | ASCII cell size |

#### Save Options
- **Save CMYK PNG**: Export the effect as image
- **Clear Image**: Remove loaded image from processor

---

## Workflow Examples

### Example 1: Text on Canvas
1. Click "Text" button
2. Click canvas where you want text
3. Type your message
4. Press ENTER

### Example 2: Blend CMYK Effect with Drawing
1. Upload image in CMYK panel
2. Enable "Show as Overlay"
3. Adjust controls as needed
4. Draw ASCII on canvas - CMYK effect shows underneath
5. Both layers combine in final output

### Example 3: Convert Image to ASCII
1. Upload image
2. Adjust grid size (smaller = more detail)
3. Drop onto canvas where you want it
4. Merged into your ASCII drawing

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl+Z | Undo |
| Ctrl+C | Copy selection |
| Ctrl+X | Cut selection |
| Ctrl+V | Paste |
| Shift+Click | Select area |
| ESC | Cancel (selection, text input) |

---

## Tips

1. **Text Input**: Position text carefully before typing - you can't move it after placement
2. **CMYK Overlay**: Best for artistic effects, not for replacing main drawing
3. **Image Drag-Drop**: Works best with high-contrast images
4. **Grid Size**: Smaller grids (4-10) for detailed images, larger (20+) for bold ASCII art
