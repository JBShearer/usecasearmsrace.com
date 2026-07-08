# UCAR Theme System Handoff

## Current State

The site has a partial light/dark theme implementation. The CSS variables and UI components are themed, but **the SVG illustration functions still have ~58 hardcoded `#EDE6D6` color values** that need to be replaced with dynamic stroke colors.

## What's Done

### CSS Theme System (Working)
```css
:root {
  /* Light mode: THE DOSSIER - military caps, black marker on cream */
  --cream:#F5F0E6;--marker:#1A1817;--stamp:#C1121F;--pencil:#6B6560;
  /* Dark mode: THE BRAIN LAB - pink shadows, gold spotlight */
  --brain-bg:#1A0A12;--brain-fg:#E8E0E4;--spotlight:#D4A84C;--shadow:#4A3045;
  /* Semantic tokens (light mode default) */
  --bg:var(--cream);--fg:var(--marker);--accent:var(--stamp);--muted:var(--pencil);
}
[data-theme="dark"] {
  --bg:var(--brain-bg);--fg:var(--brain-fg);--accent:var(--spotlight);--muted:var(--shadow);
}
```

### Theme Toggle (Working)
- Button in header toggles between ☀️ (light) and 🧠 (dark)
- Respects `prefers-color-scheme` on first load
- Persists to localStorage as `ucar_theme`

### SVG Palette System (Partially Working)
```javascript
// These exist and work:
const PALETTES_LIGHT = [...];  // 5 cream/document-style palettes
const PALETTES_DARK = [...];   // 5 brain-pink/spotlight palettes
function getPalettes() { ... } // Returns correct palette for current theme
function getStrokeColor() { ... } // Returns #E8E0E4 (dark) or #1A1817 (light)
function sceneDefs(id) { ... } // Generates theme-aware filters/patterns
```

### Character Figures (Updated)
These functions now use `getStrokeColor()`:
- `figGI()` ✅
- `figGary()` ✅
- `figSupes()` ✅
- `figBrain()` ✅
- `figBrainiac()` ✅

## What Needs Fixing

### 1. `setPieces()` Function (~lines 617-740)
This function generates category-specific set pieces (surveillance cameras, hospital monitors, conveyor belts, etc.). It has ~30 hardcoded `#EDE6D6` values.

**Pattern to apply:**
```javascript
// At start of function, this exists:
const sc = getStrokeColor();

// Replace all instances of:
stroke="#EDE6D6"  →  stroke="'+sc+'"
fill="#EDE6D6"    →  fill="'+sc+'"
```

### 2. `props()` Function (~lines 741-810)
Generates props like desks, podiums, vehicles. Has ~25 hardcoded `#EDE6D6` values.

**Same pattern - use the `sc` variable.**

### 3. Scene Frame Border (~line 990)
```javascript
// Current:
+'<rect ... stroke="#EDE6D6" ...'
// Should be:
+'<rect ... stroke="'+getStrokeColor()+'" ...'
```

### 4. Background Fill Colors
Some places use `#0E0E0E` for dark backgrounds in SVG. These should use:
```javascript
const bgColor = document.documentElement.getAttribute('data-theme')==='dark' ? '#1A0A12' : '#F5F0E6';
```

## File Location

**Single file:** `/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com/index.html`

All CSS is in a `<style>` tag at the top.
All JavaScript is in a `<script>` tag at the bottom.

## Search Patterns

To find remaining hardcoded colors:
```bash
grep -n "#EDE6D6" index.html   # Light stroke color (needs to be dynamic)
grep -n "#0E0E0E" index.html   # Dark background (needs to be dynamic)
grep -n "'#" index.html        # All hardcoded colors in JS
```

## Testing

1. Load site - should be light mode (cream background)
2. Click ☀️ button in header - should switch to dark (brain pink)
3. Refresh - theme should persist
4. Check SVG illustrations - characters should have correct contrast in both modes

## Design Intent

### Light Mode: "The Dossier"
- Warm cream background like a military file folder
- Crisp black marker strokes
- Red accent for stamps/urgency
- Feel: declassified document, bureaucratic, begging for red stamps

### Dark Mode: "The Brain Lab"
- Deep brain pink/mauve background
- Pale clinical strokes
- Gold spotlight accent
- Feel: Evil Brain's lair, specimen under examination, sinister

## Quick Reference

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | #F5F0E6 (cream) | #1A0A12 (brain pink) |
| Foreground/Strokes | #1A1817 (marker) | #E8E0E4 (clinical) |
| Accent | #C1121F (stamp red) | #D4A84C (spotlight gold) |
| Muted | #6B6560 (pencil) | #4A3045 (shadow) |
