# The Memory Index - Features

## Overview
The Memory Index is a web-based interactive platform for preserving memories through digital art. It consists of four main workspaces:

1.  **Thoughts**: Journaling and text capture.
2.  **Image Processor**: Converting images into ASCII and dithered art.
3.  **ASCII Sketch**: A grid-based drawing tool for ASCII art.
4.  **Memory Diagram**: A layout tool to assemble memories into a printable format.

---

## 1. Thoughts (Tab 1)
- **Journaling Area**: A space to write down thoughts and memories.
- **Date Header**: Automatically generated date fields.
- **Add to Library**: Convert written thoughts into a "Thought Card" image and save it to the global Memory Archive.

---

## 2. Image Processor (Tab 2)
Transforms uploaded images into stylized ASCII or Dithered art.

### Modes
- **ASCII**: Converts image brightness to characters.
- **Dither**: Uses Floyd-Steinberg dithering for a retro look.

### Ink Types
- **CMYK Marker**: Simulates CMYK printing with marker strokes.
- **Stabilo Marker**: Uses a vibrant highlighter palette.
- **Monochrome**: Black and white.
- **Original**: Keeps original image colors.
- **Brightness**: Heatmap-style coloring based on luminance.

### Controls
- **Pattern/Weight**: Adjusts stroke thickness or density.
- **Preset**: Select from various character sets (Default, Minimal, Blocks, etc.).
- **Threshold**: Adjusts visibility cutoff.
- **Source Opacity**: Blends the original image with the effect.
- **Invert**: Inverts the character ramp.
- **Animate**: Adds a jitter effect to the ASCII generation (can be saved as GIF).

### Output
- **Add to Library**: Save the result to the Memory Archive.
- **Download Image**: Save as PNG (or GIF if animated).

---

## 3. ASCII Sketch (Tab 3)
A grid-based drawing tool using ASCII characters.

### Tools
- **Pencil**: Draw single characters.
- **Eraser**: Remove characters.
- **Bucket Fill**: Fill connected areas.
- **Magic Wand**: Select connected areas of the same character/color.
- **Clear**: Reset the canvas.

### Features
- **Palette**: Select from a wide range of ASCII characters.
- **Smart Character**: Automatically selects directional characters (`|`, `-`, `/`, `\`) based on mouse movement.
- **Ink Color**: Choose from CMYK or Stabilo palettes, or pick a custom hex color.
- **Reference Image**: Upload an image to trace over (with opacity, scale, and rotation controls).
- **Zoom**: Zoom in/out of the canvas.

### Keyboard Shortcuts
- **Shift + Drag**: Select a rectangular area.
- **Ctrl + C / V / X**: Copy, Paste, Cut selection.
- **Ctrl + Z / Shift + Z**: Undo / Redo.
- **Delete / Backspace**: Delete content in selection.
- **Esc**: Cancel selection or tool.

---

## 4. Memory Diagram (Tab 4)
A layout workspace to arrange your artifacts.

### Features
- **Artboards**: Multiple A4-sized pages with customizable paper patterns.
- **Drag & Drop**: Drag items from the **Library** or upload images directly onto the canvas.
- **Text Tools**: Draw text boxes with customizable font, size, and alignment.
- **Layer Panel**: Manage element order (bring to front/back) and visibility.
- **Transform**: Move, resize, and rotate elements.
- **Blend Modes**: Apply blend modes (Multiply, Screen, etc.) to elements.

### Export
- **Save PNG**: Export the active artboard.
- **Save PDF**: Export all artboards as a multi-page PDF.
- **Save/Load Project**: Save the current layout state to a JSON file.

---

## Global Features
- **Memory Archive (Library)**: A persistent storage (using IndexedDB) for your sketches, processed images, and thought cards. Accessible from the right-side tab.
- **Music Player**: A floating widget to play background music (YouTube/Spotify embed support).
- **Instruction Sheet**: A built-in guide for new users.
