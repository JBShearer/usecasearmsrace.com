/**
 * PROCEDURAL BACKGROUND GENERATOR FOR CARD ART
 *
 * Generates deterministic SVG backgrounds from case_id hash.
 * No external art assets required - all procedurally generated.
 *
 * Design Philosophy:
 * - Deterministic: same case_id → same background always
 * - Theme-aware: Different patterns for Heaven vs Hell faction
 * - Varied: 10+ distinct pattern types
 * - Scalable: SVG renders at any resolution
 * - Performance: Fast generation, cache-friendly
 */

// ============================================================================
// PATTERN TYPES (10 variants)
// ============================================================================

export type PatternType =
  | 'geometric_grid'      // Clean tech feel
  | 'circuit_board'       // Digital/AI aesthetic
  | 'noise_field'         // Abstract chaos
  | 'gradient_wave'       // Smooth flow
  | 'concentric_circles'  // Ripple effect
  | 'triangular_mesh'     // Sharp angles
  | 'dot_matrix'          // Retro computer
  | 'topographic_lines'   // Map contours
  | 'hexagonal_grid'      // Honeycomb
  | 'radial_burst';       // Explosion/rays

// ============================================================================
// COLOR PALETTES (Theme-Aware)
// ============================================================================

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

// Heaven faction: Golds, whites, warm tones
const HEAVEN_PALETTES: ColorPalette[] = [
  { primary: '#D4A84C', secondary: '#F5E6D3', accent: '#B89A3C', background: '#FFFDF7' },
  { primary: '#C9A961', secondary: '#E8D5B7', accent: '#9B8B5C', background: '#FAF7F0' },
  { primary: '#B8945F', secondary: '#D9C8A8', accent: '#8B7555', background: '#F8F5EE' },
];

// Hell faction: Reds, blacks, stark tones
const HELL_PALETTES: ColorPalette[] = [
  { primary: '#C1121F', secondary: '#4A0E0E', accent: '#8B0000', background: '#1A0A0A' },
  { primary: '#A01515', secondary: '#3A0909', accent: '#770000', background: '#150606' },
  { primary: '#B01818', secondary: '#420C0C', accent: '#990000', background: '#180707' },
];

function selectPalette(seed: number, faction: 'heaven' | 'hell'): ColorPalette {
  const palettes = faction === 'heaven' ? HEAVEN_PALETTES : HELL_PALETTES;
  return palettes[seed % palettes.length];
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Convert case_id (UUID) to deterministic seed array
 * Returns: [patternSeed, paletteSeed, param1, param2, param3]
 */
export function hashToSeeds(caseId: string): number[] {
  // Remove dashes from UUID
  const hex = caseId.replace(/-/g, '');

  // Extract 5 segments for different parameters
  const seeds = [
    parseInt(hex.slice(0, 8), 16),  // Pattern selection
    parseInt(hex.slice(8, 16), 16), // Palette selection
    parseInt(hex.slice(16, 24), 16), // Param 1 (density, scale, etc.)
    parseInt(hex.slice(24, 32), 16), // Param 2 (rotation, offset, etc.)
    parseInt(hex.slice(32), 16),    // Param 3 (opacity, variation, etc.)
  ];

  return seeds;
}

/**
 * Seeded random number generator (xorshift)
 * Deterministic for same seed
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this.state = x;
    return Math.abs(x) / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }
}

// ============================================================================
// PATTERN GENERATORS
// ============================================================================

function geometricGrid(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  const gridSize = rng.int(20, 40);
  const rotation = rng.range(-5, 5);
  let svg = `<g transform="rotate(${rotation} ${width / 2} ${height / 2})">`;

  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const opacity = rng.range(0.1, 0.4);
      const size = rng.range(gridSize * 0.3, gridSize * 0.8);
      svg += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${palette.primary}" opacity="${opacity}"/>`;
    }
  }

  svg += '</g>';
  return svg;
}

function circuitBoard(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  let svg = '<g>';
  const lineCount = rng.int(15, 30);

  for (let i = 0; i < lineCount; i++) {
    const x1 = rng.range(0, width);
    const y1 = rng.range(0, height);
    const x2 = x1 + rng.range(-200, 200);
    const y2 = y1 + rng.range(-200, 200);
    const strokeWidth = rng.range(1, 3);

    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${palette.secondary}" stroke-width="${strokeWidth}" opacity="0.3"/>`;

    // Add circuit nodes
    svg += `<circle cx="${x1}" cy="${y1}" r="${strokeWidth * 2}" fill="${palette.accent}" opacity="0.5"/>`;
  }

  svg += '</g>';
  return svg;
}

function noiseField(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  let svg = '<g>';
  const dotCount = rng.int(200, 400);

  for (let i = 0; i < dotCount; i++) {
    const x = rng.range(0, width);
    const y = rng.range(0, height);
    const radius = rng.range(1, 4);
    const opacity = rng.range(0.1, 0.5);

    svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${palette.primary}" opacity="${opacity}"/>`;
  }

  svg += '</g>';
  return svg;
}

function gradientWave(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  const waveCount = rng.int(3, 6);
  const id = `grad-${rng.int(1000, 9999)}`;

  let svg = `<defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.primary}" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="${palette.secondary}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0.3"/>
    </linearGradient>
  </defs>`;

  svg += '<g>';
  for (let i = 0; i < waveCount; i++) {
    const yOffset = (i / waveCount) * height;
    const amplitude = rng.range(20, 50);
    const frequency = rng.range(0.01, 0.03);

    let path = `M 0 ${yOffset}`;
    for (let x = 0; x <= width; x += 10) {
      const y = yOffset + Math.sin(x * frequency) * amplitude;
      path += ` L ${x} ${y}`;
    }
    path += ` L ${width} ${height} L 0 ${height} Z`;

    svg += `<path d="${path}" fill="url(#${id})" opacity="0.4"/>`;
  }
  svg += '</g>';

  return svg;
}

function concentricCircles(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  const cx = rng.range(width * 0.3, width * 0.7);
  const cy = rng.range(height * 0.3, height * 0.7);
  const ringCount = rng.int(8, 15);
  const maxRadius = Math.max(width, height);

  let svg = '<g>';
  for (let i = 0; i < ringCount; i++) {
    const radius = (i / ringCount) * maxRadius;
    const opacity = rng.range(0.05, 0.2);
    const strokeWidth = rng.range(1, 3);

    svg += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${palette.primary}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
  }
  svg += '</g>';

  return svg;
}

function triangularMesh(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  let svg = '<g>';
  const triCount = rng.int(20, 40);

  for (let i = 0; i < triCount; i++) {
    const x1 = rng.range(0, width);
    const y1 = rng.range(0, height);
    const x2 = x1 + rng.range(-100, 100);
    const y2 = y1 + rng.range(-100, 100);
    const x3 = x1 + rng.range(-100, 100);
    const y3 = y1 + rng.range(-100, 100);
    const opacity = rng.range(0.1, 0.3);

    svg += `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${palette.secondary}" opacity="${opacity}"/>`;
  }

  svg += '</g>';
  return svg;
}

function dotMatrix(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  const spacing = rng.int(15, 30);
  const radius = spacing * 0.15;

  let svg = '<g>';
  for (let x = spacing; x < width; x += spacing) {
    for (let y = spacing; y < height; y += spacing) {
      const opacity = rng.range(0.1, 0.5);
      svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${palette.primary}" opacity="${opacity}"/>`;
    }
  }
  svg += '</g>';

  return svg;
}

function topographicLines(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  let svg = '<g>';
  const lineCount = rng.int(15, 30);

  for (let i = 0; i < lineCount; i++) {
    const yBase = (i / lineCount) * height;
    const amplitude = rng.range(10, 30);
    const frequency = rng.range(0.02, 0.05);

    let path = `M 0 ${yBase}`;
    for (let x = 0; x <= width; x += 5) {
      const y = yBase + Math.sin(x * frequency) * amplitude;
      path += ` L ${x} ${y}`;
    }

    svg += `<path d="${path}" fill="none" stroke="${palette.secondary}" stroke-width="1.5" opacity="0.3"/>`;
  }
  svg += '</g>';

  return svg;
}

function hexagonalGrid(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  const hexSize = rng.int(25, 45);
  const hexHeight = hexSize * Math.sqrt(3);

  let svg = '<g>';
  for (let row = 0; row < height / hexHeight + 2; row++) {
    for (let col = 0; col < width / (hexSize * 1.5) + 2; col++) {
      const x = col * hexSize * 1.5;
      const y = row * hexHeight + (col % 2) * (hexHeight / 2);
      const opacity = rng.range(0.05, 0.2);

      // Hexagon points
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = x + hexSize * Math.cos(angle);
        const py = y + hexSize * Math.sin(angle);
        points.push(`${px},${py}`);
      }

      svg += `<polygon points="${points.join(' ')}" fill="none" stroke="${palette.primary}" stroke-width="1.5" opacity="${opacity}"/>`;
    }
  }
  svg += '</g>';

  return svg;
}

function radialBurst(
  width: number,
  height: number,
  palette: ColorPalette,
  rng: SeededRandom
): string {
  const cx = width / 2;
  const cy = height / 2;
  const rayCount = rng.int(16, 32);
  const maxLength = Math.max(width, height) * 0.6;

  let svg = '<g>';
  for (let i = 0; i < rayCount; i++) {
    const angle = (2 * Math.PI * i) / rayCount;
    const length = rng.range(maxLength * 0.5, maxLength);
    const x2 = cx + Math.cos(angle) * length;
    const y2 = cy + Math.sin(angle) * length;
    const opacity = rng.range(0.1, 0.3);
    const strokeWidth = rng.range(1, 3);

    svg += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${palette.accent}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
  }
  svg += '</g>';

  return svg;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

const PATTERN_GENERATORS = {
  geometric_grid: geometricGrid,
  circuit_board: circuitBoard,
  noise_field: noiseField,
  gradient_wave: gradientWave,
  concentric_circles: concentricCircles,
  triangular_mesh: triangularMesh,
  dot_matrix: dotMatrix,
  topographic_lines: topographicLines,
  hexagonal_grid: hexagonalGrid,
  radial_burst: radialBurst,
};

/**
 * Generate deterministic SVG background from case_id
 *
 * @param caseId - UUID of the case
 * @param faction - 'heaven' or 'hell' (affects color palette)
 * @param width - SVG width (default 1024)
 * @param height - SVG height (default 768)
 * @returns SVG string ready for embedding in card
 */
export function generateBackground(
  caseId: string,
  faction: 'heaven' | 'hell',
  width = 1024,
  height = 768
): string {
  const seeds = hashToSeeds(caseId);
  const patternTypes = Object.keys(PATTERN_GENERATORS) as PatternType[];
  const patternType = patternTypes[seeds[0] % patternTypes.length];
  const palette = selectPalette(seeds[1], faction);
  const rng = new SeededRandom(seeds[2]);

  const generator = PATTERN_GENERATORS[patternType];
  const pattern = generator(width, height, palette, rng);

  // Wrap in SVG with background color
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${palette.background}"/>
  ${pattern}
</svg>`;
}

/**
 * Get pattern info for a given case_id (for debugging/preview)
 */
export function getPatternInfo(caseId: string): {
  patternType: PatternType;
  paletteIndex: number;
} {
  const seeds = hashToSeeds(caseId);
  const patternTypes = Object.keys(PATTERN_GENERATORS) as PatternType[];
  return {
    patternType: patternTypes[seeds[0] % patternTypes.length],
    paletteIndex: seeds[1] % 3,
  };
}
