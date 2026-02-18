// =============================================================================
// textures.js - Procedural texture generation for RETRO FURY
// =============================================================================
// Generates ALL game textures procedurally using OffscreenCanvas / Canvas 2D.
// Every texture is stored as an ImageData object so the renderer can sample
// pixel data directly from the .data Uint8ClampedArray.
//
// Wall textures: 64x64 pixels (IDs 1-8)
// Sprite sheets: variable width, frames tiled horizontally (IDs 100+)
// Item sprites:  64x64 (IDs 200-202, 210-213, 220-222, 230-233, 240)
// Weapon HUD:    multi-frame 128x128 per frame (IDs 300+)
// Effects:       various sizes (IDs 400+)
// =============================================================================

// Standard texture dimension for walls and single-frame sprites.
const TEX = 64;

// Seeded PRNG for deterministic texture generation so every session looks
// identical.  Uses a simple xorshift32 generator.
let _seed = 12345;
function _srand(s) { _seed = s; }
function _rand() {
    _seed ^= _seed << 13;
    _seed ^= _seed >> 17;
    _seed ^= _seed << 5;
    return ((_seed >>> 0) % 10000) / 10000; // 0..1
}
function _randInt(min, max) {
    return min + Math.floor(_rand() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Helpers - low-level pixel painting on ImageData
// ---------------------------------------------------------------------------

/**
 * Create a blank ImageData with the given dimensions.
 * All pixels start fully transparent (alpha = 0).
 */
function createImageData(w, h) {
    // Use OffscreenCanvas if available (workers), otherwise fall back to a
    // temporary on-screen canvas.
    if (typeof OffscreenCanvas !== 'undefined') {
        const c = new OffscreenCanvas(w, h);
        const ctx = c.getContext('2d');
        return ctx.createImageData(w, h);
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c.getContext('2d').createImageData(w, h);
}

/** Set a single pixel (bounds-checked). */
function setPixel(img, x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const i = (y * img.width + x) << 2;
    img.data[i]     = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = a;
}

/** Get a pixel color as [r,g,b,a] (bounds-checked). */
function getPixel(img, x, y) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return [0, 0, 0, 0];
    const i = (y * img.width + x) << 2;
    return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

/** Fill a rectangle with a solid color. */
function fillRect(img, x, y, w, h, r, g, b, a = 255) {
    for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
            setPixel(img, px, py, r, g, b, a);
        }
    }
}

/** Fill entire image with a color. */
function fillAll(img, r, g, b, a = 255) {
    fillRect(img, 0, 0, img.width, img.height, r, g, b, a);
}

/** Draw a horizontal line. */
function hLine(img, x1, x2, y, r, g, b, a = 255) {
    for (let x = x1; x <= x2; x++) setPixel(img, x, y, r, g, b, a);
}

/** Draw a vertical line. */
function vLine(img, x, y1, y2, r, g, b, a = 255) {
    for (let y = y1; y <= y2; y++) setPixel(img, x, y, r, g, b, a);
}

/** Draw an outlined rectangle (1px border). */
function strokeRect(img, x, y, w, h, r, g, b, a = 255) {
    hLine(img, x, x + w - 1, y, r, g, b, a);
    hLine(img, x, x + w - 1, y + h - 1, r, g, b, a);
    vLine(img, x, y, y + h - 1, r, g, b, a);
    vLine(img, x + w - 1, y, y + h - 1, r, g, b, a);
}

/** Draw a filled circle. */
function fillCircle(img, cx, cy, radius, r, g, b, a = 255) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= r2) {
                setPixel(img, cx + dx, cy + dy, r, g, b, a);
            }
        }
    }
}

/** Apply noise to an image: add random per-pixel brightness variation. */
function addNoise(img, amount) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue; // skip transparent
        const n = (_rand() - 0.5) * amount;
        d[i]     = clampByte(d[i] + n);
        d[i + 1] = clampByte(d[i + 1] + n);
        d[i + 2] = clampByte(d[i + 2] + n);
    }
}

function clampByte(v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return v | 0;
}

/** Darken a pixel at (x,y) by a factor (0..1, 1 = no change). */
function darkenPixel(img, x, y, factor) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const i = (y * img.width + x) << 2;
    img.data[i]     = (img.data[i] * factor) | 0;
    img.data[i + 1] = (img.data[i + 1] * factor) | 0;
    img.data[i + 2] = (img.data[i + 2] * factor) | 0;
}

// =============================================================================
// Wall Texture Generators (64x64, IDs 1-8)
// =============================================================================

/** ID 1: Brick - red/brown bricks with mortar lines. */
function generateBrick() {
    _srand(111);
    const img = createImageData(TEX, TEX);

    // Mortar base
    fillAll(img, 90, 85, 75);

    const brickH = 8;
    const brickW = 16;

    for (let row = 0; row < TEX / brickH; row++) {
        const offset = (row % 2 === 0) ? 0 : brickW / 2;
        for (let col = -1; col < TEX / brickW + 1; col++) {
            const bx = col * brickW + offset;
            const by = row * brickH;

            // Random brick color variation
            const baseR = 140 + _randInt(-20, 20);
            const baseG = 60 + _randInt(-15, 15);
            const baseB = 40 + _randInt(-10, 10);

            // Fill brick body (inset by 1 for mortar)
            for (let py = by + 1; py < by + brickH; py++) {
                for (let px = bx + 1; px < bx + brickW; px++) {
                    const nr = baseR + _randInt(-8, 8);
                    const ng = baseG + _randInt(-5, 5);
                    const nb = baseB + _randInt(-5, 5);
                    setPixel(img, px, py, clampByte(nr), clampByte(ng), clampByte(nb));
                }
            }
        }
    }

    return img;
}

/** ID 2: Concrete - rough grey surface with subtle cracks. */
function generateConcrete() {
    _srand(222);
    const img = createImageData(TEX, TEX);

    // Base grey
    for (let y = 0; y < TEX; y++) {
        for (let x = 0; x < TEX; x++) {
            const v = 120 + _randInt(-15, 15);
            setPixel(img, x, y, v, v, clampByte(v + 3));
        }
    }

    // Cracks - dark lines
    for (let c = 0; c < 3; c++) {
        let cx = _randInt(5, 58);
        let cy = _randInt(5, 58);
        for (let s = 0; s < 20; s++) {
            setPixel(img, cx, cy, 70, 70, 72);
            if (_rand() > 0.5) setPixel(img, cx + 1, cy, 75, 75, 77);
            cx += _randInt(-1, 1);
            cy += _randInt(0, 2);
            if (cx < 0 || cx >= TEX || cy >= TEX) break;
        }
    }

    // Subtle stains
    for (let s = 0; s < 5; s++) {
        const sx = _randInt(5, 55);
        const sy = _randInt(5, 55);
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                darkenPixel(img, sx + dx, sy + dy, 0.85);
            }
        }
    }

    return img;
}

/** ID 3: Lab Tile - clean white tiles with teal accent lines. */
function generateLabTile() {
    _srand(333);
    const img = createImageData(TEX, TEX);

    // White base
    fillAll(img, 220, 225, 225);

    // Subtle noise
    addNoise(img, 8);

    // Tile grid lines (dark teal)
    const tileSize = 16;
    for (let i = 0; i < TEX; i += tileSize) {
        hLine(img, 0, TEX - 1, i, 50, 130, 130);
        vLine(img, i, 0, TEX - 1, 50, 130, 130);
    }

    // Teal accent stripe near bottom
    for (let x = 0; x < TEX; x++) {
        setPixel(img, x, 48, 0, 160, 160);
        setPixel(img, x, 49, 0, 180, 180);
        setPixel(img, x, 50, 0, 160, 160);
    }

    return img;
}

/** ID 4: Prison Metal - dark metal plates with rivets and rust. */
function generatePrisonMetal() {
    _srand(444);
    const img = createImageData(TEX, TEX);

    // Dark metal base
    for (let y = 0; y < TEX; y++) {
        for (let x = 0; x < TEX; x++) {
            const v = 55 + _randInt(-6, 6);
            setPixel(img, x, y, v, v, clampByte(v - 3));
        }
    }

    // Horizontal plate seams
    hLine(img, 0, TEX - 1, 16, 30, 30, 28);
    hLine(img, 0, TEX - 1, 17, 70, 70, 68);
    hLine(img, 0, TEX - 1, 48, 30, 30, 28);
    hLine(img, 0, TEX - 1, 49, 70, 70, 68);

    // Rivets at corners of plates
    const rivetPositions = [
        [4, 4], [28, 4], [36, 4], [60, 4],
        [4, 20], [28, 20], [36, 20], [60, 20],
        [4, 52], [28, 52], [36, 52], [60, 52],
    ];
    for (const [rx, ry] of rivetPositions) {
        setPixel(img, rx, ry, 80, 82, 78);
        setPixel(img, rx + 1, ry, 90, 92, 88);
        setPixel(img, rx, ry + 1, 40, 40, 38);
        setPixel(img, rx + 1, ry + 1, 50, 50, 48);
    }

    // Rust patches (orange-brown)
    for (let r = 0; r < 6; r++) {
        const rx = _randInt(5, 58);
        const ry = _randInt(5, 58);
        const size = _randInt(2, 5);
        for (let dy = -size; dy <= size; dy++) {
            for (let dx = -size; dx <= size; dx++) {
                if (dx * dx + dy * dy <= size * size && _rand() > 0.3) {
                    const rr = 100 + _randInt(0, 40);
                    const rg = 50 + _randInt(0, 20);
                    const rb = 20 + _randInt(0, 10);
                    setPixel(img, rx + dx, ry + dy, rr, rg, rb);
                }
            }
        }
    }

    return img;
}

/** ID 5: Tech Panel - blue/silver computer panels with circuit lines. */
function generateTechPanel() {
    _srand(555);
    const img = createImageData(TEX, TEX);

    // Silver base
    fillAll(img, 140, 145, 155);

    // Panel border
    strokeRect(img, 0, 0, TEX, TEX, 80, 85, 95);
    strokeRect(img, 1, 1, TEX - 2, TEX - 2, 170, 175, 185);

    // Inner panel (darker blue-grey)
    fillRect(img, 4, 4, TEX - 8, TEX - 8, 50, 60, 80);

    // Circuit-like horizontal lines
    for (let i = 0; i < 5; i++) {
        const ly = 8 + i * 11;
        const lx1 = 6 + _randInt(0, 10);
        const lx2 = 50 + _randInt(0, 8);
        hLine(img, lx1, lx2, ly, 40, 80, 120);
        // Small vertical jog
        const jx = lx1 + _randInt(5, 20);
        vLine(img, jx, ly, ly + _randInt(2, 5), 40, 80, 120);
    }

    // Blinking light indicators
    const lightColors = [[0, 200, 0], [200, 0, 0], [0, 100, 200], [200, 200, 0]];
    for (let i = 0; i < 4; i++) {
        const lx = 8 + i * 14;
        const ly = 52;
        const [lr, lg, lb] = lightColors[i];
        setPixel(img, lx, ly, lr, lg, lb);
        setPixel(img, lx + 1, ly, lr, lg, lb);
        setPixel(img, lx, ly + 1, lr, lg, lb);
        setPixel(img, lx + 1, ly + 1, lr, lg, lb);
        // Glow
        setPixel(img, lx - 1, ly, (lr * 0.3) | 0, (lg * 0.3) | 0, (lb * 0.3) | 0);
        setPixel(img, lx + 2, ly, (lr * 0.3) | 0, (lg * 0.3) | 0, (lb * 0.3) | 0);
    }

    // Small screen area
    fillRect(img, 6, 8, 20, 12, 0, 40, 60);
    // Scanline inside screen
    for (let sy = 9; sy < 19; sy += 2) {
        hLine(img, 7, 24, sy, 0, 60, 90);
    }

    addNoise(img, 6);
    return img;
}

/** ID 6: Crate - wooden crate with cross-brace pattern. */
function generateCrate() {
    _srand(666);
    const img = createImageData(TEX, TEX);

    // Wood base
    for (let y = 0; y < TEX; y++) {
        for (let x = 0; x < TEX; x++) {
            const grain = Math.sin(y * 0.8 + _rand() * 2) * 10;
            const r = 140 + grain + _randInt(-5, 5);
            const g = 100 + grain + _randInt(-5, 5);
            const b = 50 + _randInt(-5, 5);
            setPixel(img, x, y, clampByte(r), clampByte(g), clampByte(b));
        }
    }

    // Outer frame (darker wood)
    for (let i = 0; i < 3; i++) {
        strokeRect(img, i, i, TEX - i * 2, TEX - i * 2, 80 - i * 10, 55 - i * 5, 25);
    }

    // Cross braces
    for (let i = 0; i < TEX; i++) {
        // Top-left to bottom-right
        setPixel(img, i, i, 90, 65, 30);
        if (i + 1 < TEX) setPixel(img, i + 1, i, 90, 65, 30);
        // Top-right to bottom-left
        setPixel(img, TEX - 1 - i, i, 90, 65, 30);
        if (TEX - 2 - i >= 0) setPixel(img, TEX - 2 - i, i, 90, 65, 30);
    }

    // Center metal plate
    fillRect(img, 26, 26, 12, 12, 100, 100, 95);
    strokeRect(img, 26, 26, 12, 12, 70, 70, 65);

    return img;
}

/** ID 7: Door - metal door with handle and horizontal lines. */
function generateDoor() {
    _srand(777);
    const img = createImageData(TEX, TEX);

    // Door body (medium grey metal)
    fillAll(img, 100, 105, 110);
    addNoise(img, 5);

    // Horizontal panel lines
    for (let ly = 8; ly < TEX; ly += 12) {
        hLine(img, 2, TEX - 3, ly, 70, 75, 80);
        hLine(img, 2, TEX - 3, ly + 1, 130, 135, 140);
    }

    // Door frame (darker edges)
    vLine(img, 0, 0, TEX - 1, 50, 50, 55);
    vLine(img, 1, 0, TEX - 1, 60, 60, 65);
    vLine(img, TEX - 1, 0, TEX - 1, 50, 50, 55);
    vLine(img, TEX - 2, 0, TEX - 1, 60, 60, 65);

    // Door handle (right side)
    fillRect(img, 48, 28, 4, 10, 170, 170, 160);
    strokeRect(img, 48, 28, 4, 10, 80, 80, 75);

    // Keyhole
    setPixel(img, 49, 40, 30, 30, 30);
    setPixel(img, 50, 40, 30, 30, 30);

    return img;
}

/** ID 8: Door Locked - same as door but with colored stripe at top. */
function generateDoorLocked() {
    _srand(777); // Same seed as door for identical base
    const img = generateDoor();

    // Bright red/yellow warning stripe at top
    fillRect(img, 2, 2, TEX - 4, 5, 200, 40, 40);
    // Diagonal warning stripes
    for (let x = 2; x < TEX - 2; x++) {
        if ((x % 8) < 4) {
            for (let y = 2; y < 7; y++) {
                setPixel(img, x, y, 200, 180, 30);
            }
        }
    }

    return img;
}

// =============================================================================
// Sprite Helpers
// =============================================================================

/**
 * Draw a simple humanoid figure at an offset within an image.
 * Used as the base for all enemy sprite frames.
 *
 * @param {ImageData} img
 * @param {number} ox - X offset (frame start)
 * @param {number} fw - Frame width
 * @param {number} bodyR,bodyG,bodyB - Body/uniform color
 * @param {object} opts - Additional options
 */
function drawHumanoid(img, ox, fw, bodyR, bodyG, bodyB, opts = {}) {
    const fh = 64;
    const cx = ox + (fw >> 1); // center x of frame
    const headR = opts.headR || 200;
    const headG = opts.headG || 170;
    const headB = opts.headB || 140;
    const scale = opts.scale || 1.0;
    const headY = opts.headY || 12;
    const headSize = Math.round((opts.headSize || 5) * scale);
    const bodyW = Math.round((opts.bodyW || 12) * scale);
    const bodyH = Math.round((opts.bodyH || 18) * scale);
    const bodyTop = headY + headSize + 1;
    const legH = Math.round((opts.legH || 14) * scale);
    const legW = Math.round((opts.legW || 4) * scale);
    const armW = Math.round(3 * scale);
    const armH = Math.round((opts.armH || 14) * scale);
    const darkR = (bodyR * 0.6) | 0;
    const darkG = (bodyG * 0.6) | 0;
    const darkB = (bodyB * 0.6) | 0;

    // Head
    fillCircle(img, cx, headY + headSize, headSize, headR, headG, headB);
    // Eyes
    setPixel(img, cx - 2, headY + headSize - 1, 20, 20, 20);
    setPixel(img, cx + 2, headY + headSize - 1, 20, 20, 20);

    // Body
    fillRect(img, cx - (bodyW >> 1), bodyTop, bodyW, bodyH, bodyR, bodyG, bodyB);

    // Arms
    const armLeftX = cx - (bodyW >> 1) - armW;
    const armRightX = cx + (bodyW >> 1);
    fillRect(img, armLeftX, bodyTop + 1, armW, armH, darkR, darkG, darkB);
    fillRect(img, armRightX, bodyTop + 1, armW, armH, darkR, darkG, darkB);

    // Legs
    const legTop = bodyTop + bodyH;
    const legGap = Math.max(1, Math.round(2 * scale));
    fillRect(img, cx - legGap - legW, legTop, legW, legH, darkR, darkG, darkB);
    fillRect(img, cx + legGap, legTop, legW, legH, darkR, darkG, darkB);

    // Belt
    fillRect(img, cx - (bodyW >> 1), bodyTop + bodyH - 2, bodyW, 2, 40, 35, 30);

    return { cx, bodyTop, bodyW, bodyH, armRightX, armW, armH, legTop, legH };
}

/**
 * Create a walking pose variant: shift legs.
 */
function drawHumanoidWalk(img, ox, fw, bodyR, bodyG, bodyB, opts = {}, frame = 0) {
    const parts = drawHumanoid(img, ox, fw, bodyR, bodyG, bodyB, opts);
    const scale = opts.scale || 1.0;
    const legW = Math.round((opts.legW || 4) * scale);
    const legH = Math.round((opts.legH || 14) * scale);
    const legGap = Math.max(1, Math.round(2 * scale));
    const darkR = (bodyR * 0.6) | 0;
    const darkG = (bodyG * 0.6) | 0;
    const darkB = (bodyB * 0.6) | 0;

    // Clear existing legs and redraw shifted
    const shift = frame === 0 ? 2 : -2;
    fillRect(img, parts.cx - legGap - legW, parts.legTop, legW, legH, 0, 0, 0, 0);
    fillRect(img, parts.cx + legGap, parts.legTop, legW, legH, 0, 0, 0, 0);
    fillRect(img, parts.cx - legGap - legW + shift, parts.legTop, legW, legH, darkR, darkG, darkB);
    fillRect(img, parts.cx + legGap - shift, parts.legTop, legW, legH, darkR, darkG, darkB);
    return parts;
}

/**
 * Draw an attack pose variant: arm raised with weapon flash.
 */
function drawHumanoidAttack(img, ox, fw, bodyR, bodyG, bodyB, opts = {}, frame = 0) {
    const parts = drawHumanoid(img, ox, fw, bodyR, bodyG, bodyB, opts);
    // Extend right arm upward (weapon firing)
    const scale = opts.scale || 1.0;
    const armW = Math.round(3 * scale);
    const darkR = (bodyR * 0.6) | 0;
    const darkG = (bodyG * 0.6) | 0;
    const darkB = (bodyB * 0.6) | 0;
    fillRect(img, parts.armRightX, parts.bodyTop - 6, armW, 8, darkR, darkG, darkB);
    // Muzzle flash on frame 1
    if (frame === 1) {
        setPixel(img, parts.armRightX + 1, parts.bodyTop - 8, 255, 255, 100);
        setPixel(img, parts.armRightX, parts.bodyTop - 9, 255, 200, 50);
        setPixel(img, parts.armRightX + 2, parts.bodyTop - 9, 255, 200, 50);
    }
    return parts;
}

/**
 * Draw a pain frame: recoil pose.
 */
function drawHumanoidPain(img, ox, fw, bodyR, bodyG, bodyB, opts = {}) {
    // Draw base but shifted slightly and tinted red
    const painOpts = { ...opts, headR: 240, headG: 140, headB: 120 };
    drawHumanoid(img, ox + 1, fw, bodyR, bodyG, bodyB, painOpts);
}

/**
 * Draw death frames: progressively falling over.
 */
function drawHumanoidDeath(img, ox, fw, bodyR, bodyG, bodyB, opts = {}, frame = 0) {
    const scale = opts.scale || 1.0;
    const bodyW = Math.round((opts.bodyW || 12) * scale);
    const cx = ox + (fw >> 1);

    if (frame === 0) {
        // Staggering
        drawHumanoid(img, ox + 2, fw, bodyR, bodyG, bodyB, { ...opts, headY: 14 });
    } else if (frame === 1) {
        // Falling - draw horizontally-ish
        const y = 40;
        fillCircle(img, cx - 8, y + 4, Math.round(4 * scale), 180, 150, 120);
        fillRect(img, cx - 4, y, Math.round(16 * scale), Math.round(8 * scale), bodyR, bodyG, bodyB);
    } else {
        // Dead on ground - flat pool
        const y = 50;
        fillRect(img, cx - Math.round(12 * scale), y, Math.round(24 * scale), Math.round(5 * scale), (bodyR * 0.5) | 0, (bodyG * 0.4) | 0, (bodyB * 0.4) | 0);
        // Blood
        fillRect(img, cx - 4, y + 2, 8, 3, 120, 10, 10);
    }
}

// =============================================================================
// Enemy Sprite Sheet Generators (IDs 100-104)
// =============================================================================
// Layout: 9 frames horizontally: idle, walk1, walk2, attack1, attack2, pain, death1, death2, death3

function generateEnemySpriteSheet(id, bodyR, bodyG, bodyB, opts = {}) {
    const fw = opts.frameWidth || TEX; // frame width
    const fh = TEX; // frame height always 64
    const numFrames = 9;
    const img = createImageData(fw * numFrames, fh);

    // Seed per enemy type
    _srand(1000 + id);

    // Frame 0: Idle
    drawHumanoid(img, 0 * fw, fw, bodyR, bodyG, bodyB, opts);

    // Frame 1-2: Walk
    drawHumanoidWalk(img, 1 * fw, fw, bodyR, bodyG, bodyB, opts, 0);
    drawHumanoidWalk(img, 2 * fw, fw, bodyR, bodyG, bodyB, opts, 1);

    // Frame 3-4: Attack
    drawHumanoidAttack(img, 3 * fw, fw, bodyR, bodyG, bodyB, opts, 0);
    drawHumanoidAttack(img, 4 * fw, fw, bodyR, bodyG, bodyB, opts, 1);

    // Frame 5: Pain
    drawHumanoidPain(img, 5 * fw, fw, bodyR, bodyG, bodyB, opts);

    // Frame 6-8: Death
    drawHumanoidDeath(img, 6 * fw, fw, bodyR, bodyG, bodyB, opts, 0);
    drawHumanoidDeath(img, 7 * fw, fw, bodyR, bodyG, bodyB, opts, 1);
    drawHumanoidDeath(img, 8 * fw, fw, bodyR, bodyG, bodyB, opts, 2);

    return img;
}

function generateGrunt() {
    return generateEnemySpriteSheet(100, 60, 120, 50); // Green uniform
}

function generateSoldier() {
    return generateEnemySpriteSheet(101, 50, 70, 140, { // Blue uniform
        bodyW: 14,
        armH: 15,
    });
}

function generateScout() {
    return generateEnemySpriteSheet(102, 160, 160, 170, { // Light grey
        bodyW: 10,
        bodyH: 16,
        legH: 16,
    });
}

function generateBrute() {
    return generateEnemySpriteSheet(103, 80, 80, 90, { // Heavy armor
        frameWidth: 128,
        scale: 1.8,
        headSize: 5,
        bodyW: 16,
        bodyH: 20,
        legW: 6,
        legH: 12,
        armH: 16,
        headY: 6,
    });
}

function generateCommander() {
    return generateEnemySpriteSheet(104, 160, 30, 30, { // Red/black armor
        frameWidth: 128,
        scale: 2.0,
        headSize: 6,
        bodyW: 18,
        bodyH: 22,
        legW: 7,
        legH: 10,
        armH: 18,
        headY: 4,
        headR: 180,
        headG: 160,
        headB: 140,
    });
}

// =============================================================================
// Player Sprite Sheet Generator (ID 110)
// =============================================================================
// Same 9-frame layout as enemies: idle, walk1, walk2, attack1, attack2, pain,
// death1, death2, death3.  Bright orange/yellow uniform so the player character
// is clearly distinguishable from all enemy types during PvP.

/** 110: Player character - bright orange/yellow uniform. */
function generatePlayerSprite() {
    return generateEnemySpriteSheet(110, 220, 160, 40); // Orange/yellow uniform
}

// =============================================================================
// Item Sprite Generators (IDs 200-202, 210-213, 220-222, 230-233, 240)
// =============================================================================

/** 200: Small health kit (white box, red cross). */
function generateHealthSmall() {
    const img = createImageData(TEX, TEX);
    // White box
    fillRect(img, 20, 30, 24, 24, 220, 220, 220);
    strokeRect(img, 20, 30, 24, 24, 180, 180, 180);
    // Red cross
    fillRect(img, 29, 34, 6, 16, 200, 30, 30);
    fillRect(img, 24, 39, 16, 6, 200, 30, 30);
    return img;
}

/** 201: Large health kit. */
function generateHealthLarge() {
    const img = createImageData(TEX, TEX);
    // Bigger white box
    fillRect(img, 14, 24, 36, 32, 240, 240, 240);
    strokeRect(img, 14, 24, 36, 32, 200, 200, 200);
    // Larger red cross
    fillRect(img, 28, 27, 8, 26, 220, 20, 20);
    fillRect(img, 20, 35, 24, 8, 220, 20, 20);
    return img;
}

/** 202: Armor (blue vest shape). */
function generateArmor() {
    const img = createImageData(TEX, TEX);
    // Vest shape
    fillRect(img, 18, 20, 28, 30, 40, 80, 180);
    // Arm holes
    fillRect(img, 14, 20, 6, 14, 30, 60, 150);
    fillRect(img, 44, 20, 6, 14, 30, 60, 150);
    // Neck opening
    fillRect(img, 26, 18, 12, 6, 0, 0, 0, 0);
    // Highlights
    hLine(img, 20, 44, 22, 70, 120, 220);
    // Bottom edge
    hLine(img, 18, 46, 50, 20, 50, 120);
    return img;
}

/** Generate an ammo box with given color. */
function generateAmmoBox(r, g, b, label) {
    const img = createImageData(TEX, TEX);
    fillRect(img, 20, 32, 24, 20, r, g, b);
    strokeRect(img, 20, 32, 24, 20, (r * 0.6) | 0, (g * 0.6) | 0, (b * 0.6) | 0);
    // Highlight on top
    hLine(img, 21, 42, 33, Math.min(r + 50, 255), Math.min(g + 50, 255), Math.min(b + 50, 255));
    return img;
}

/** 203: Ammo bullets (yellow box). */
function generateAmmoBullets() {
    return generateAmmoBox(200, 180, 40, 'B');
}

/** 204: Ammo shells (red box). */
function generateAmmoShells() {
    return generateAmmoBox(180, 50, 40, 'S');
}

/** 205: Ammo rockets (green box). */
function generateAmmoRockets() {
    return generateAmmoBox(50, 160, 50, 'R');
}

/** 206: Ammo cells (cyan box). */
function generateAmmoCells() {
    return generateAmmoBox(40, 180, 200, 'C');
}

/** Generate a keycard sprite with given color. */
function generateKeycard(r, g, b) {
    const img = createImageData(TEX, TEX);
    // Card body
    fillRect(img, 20, 28, 24, 16, r, g, b);
    strokeRect(img, 20, 28, 24, 16, (r * 0.5) | 0, (g * 0.5) | 0, (b * 0.5) | 0);
    // Magnetic stripe
    fillRect(img, 22, 38, 20, 3, 30, 30, 30);
    // Sparkle / chip
    setPixel(img, 25, 32, 255, 255, 255);
    setPixel(img, 26, 31, 255, 255, 255);
    setPixel(img, 24, 31, 200, 200, 255);
    setPixel(img, 26, 33, 200, 200, 255);
    // Glow effect
    fillRect(img, 38, 29, 4, 4, Math.min(r + 80, 255), Math.min(g + 80, 255), Math.min(b + 80, 255));
    return img;
}

/** 207: Blue keycard. */
function generateBlueKeycard() {
    return generateKeycard(40, 80, 220);
}

/** 208: Red keycard. */
function generateRedKeycard() {
    return generateKeycard(220, 40, 40);
}

/** 209: Yellow keycard. */
function generateYellowKeycard() {
    return generateKeycard(220, 200, 40);
}

/** Draw a simplified weapon pickup sprite. */
function generateWeaponPickup(bodyColor, barrelLen, details) {
    const img = createImageData(TEX, TEX);
    const [r, g, b] = bodyColor;

    // Gun body on ground
    const y = 38;
    // Stock / grip
    fillRect(img, 16, y, 10, 8, 80, 60, 40);
    // Barrel
    fillRect(img, 26, y + 1, barrelLen, 4, r, g, b);
    // Highlight
    hLine(img, 26, 26 + barrelLen - 1, y + 1, Math.min(r + 40, 255), Math.min(g + 40, 255), Math.min(b + 40, 255));
    // Trigger guard
    setPixel(img, 22, y + 8, 60, 60, 60);
    setPixel(img, 23, y + 9, 60, 60, 60);
    setPixel(img, 24, y + 8, 60, 60, 60);

    if (details === 'shotgun') {
        // Pump
        fillRect(img, 30, y + 5, 8, 2, r - 20, g - 20, b - 20);
    } else if (details === 'machinegun') {
        // Magazine
        fillRect(img, 28, y + 5, 4, 6, 50, 50, 50);
    } else if (details === 'rocket') {
        // Wide barrel
        fillRect(img, 26, y - 1, barrelLen, 7, r, g, b);
    } else if (details === 'plasma') {
        // Glowing tip
        fillRect(img, 26 + barrelLen - 3, y, 3, 6, 0, 220, 255);
    }

    return img;
}

/** 210: Shotgun pickup. */
function generateShotgunPickup() {
    return generateWeaponPickup([120, 120, 110], 24, 'shotgun');
}

/** 211: Machinegun pickup. */
function generateMachinegunPickup() {
    return generateWeaponPickup([100, 100, 100], 22, 'machinegun');
}

/** 212: Rocket launcher pickup. */
function generateRocketLauncherPickup() {
    return generateWeaponPickup([80, 100, 60], 20, 'rocket');
}

/** 213: Plasma rifle pickup. */
function generatePlasmaRiflePickup() {
    return generateWeaponPickup([100, 110, 130], 22, 'plasma');
}

/** 240: Objective item - glowing golden orb. */
function generateObjectiveItem() {
    const img = createImageData(TEX, TEX);
    const cx = 32, cy = 32;

    // Outer glow.
    fillCircle(img, cx, cy, 14, 120, 100, 20, 80);
    // Mid glow.
    fillCircle(img, cx, cy, 10, 200, 180, 40, 150);
    // Core orb.
    fillCircle(img, cx, cy, 7, 255, 220, 60, 255);
    // Hot center highlight.
    fillCircle(img, cx - 2, cy - 2, 3, 255, 255, 180, 255);
    // Sparkle dots.
    setPixel(img, cx + 5, cy - 5, 255, 255, 200, 200);
    setPixel(img, cx - 4, cy + 6, 255, 255, 200, 200);
    setPixel(img, cx + 7, cy + 2, 255, 255, 200, 180);

    return img;
}

// =============================================================================
// Weapon HUD Sprite Generators (IDs 300-306)
// =============================================================================
// Each weapon HUD is a 3-frame sprite sheet at 128x128 per frame (384x128).
// Frames: idle, fire1, fire2.

const HUD_FW = 128;
const HUD_FH = 128;
const HUD_FRAMES = 3;

/**
 * Draw a hand at the bottom of a HUD frame.
 * Returns the grip top position for weapon attachment.
 */
function drawHUDHand(img, ox, oy) {
    // Skin-colored hand/fist
    const skinR = 200, skinG = 160, skinB = 130;
    // Wrist
    fillRect(img, ox + 52, oy + 95, 24, 18, skinR, skinG, skinB);
    // Fingers wrapped
    fillRect(img, ox + 50, oy + 85, 28, 12, skinR - 10, skinG - 10, skinB - 10);
    // Thumb
    fillRect(img, ox + 48, oy + 88, 6, 8, skinR + 10, skinG, skinB);
    // Knuckle highlights
    for (let i = 0; i < 4; i++) {
        setPixel(img, ox + 53 + i * 6, oy + 85, skinR + 20, skinG + 10, skinB);
    }
    return { gripX: ox + 52, gripY: oy + 80 };
}

/** 300: Pistol HUD sprite (3 frames). */
function generatePistolHUD() {
    _srand(3000);
    const img = createImageData(HUD_FW * HUD_FRAMES, HUD_FH);

    for (let f = 0; f < HUD_FRAMES; f++) {
        const ox = f * HUD_FW;
        const recoil = (f === 1) ? -8 : (f === 2) ? -4 : 0;

        drawHUDHand(img, ox, recoil);

        // Pistol body
        fillRect(img, ox + 54, 60 + recoil, 20, 26, 80, 80, 85);
        // Slide
        fillRect(img, ox + 54, 50 + recoil, 20, 12, 100, 100, 105);
        // Barrel
        fillRect(img, ox + 60, 42 + recoil, 8, 10, 70, 70, 75);
        // Sight
        fillRect(img, ox + 63, 40 + recoil, 3, 3, 110, 110, 110);

        // Muzzle flash on fire frames
        if (f === 1) {
            fillCircle(img, ox + 64, 32, 8, 255, 255, 150);
            fillCircle(img, ox + 64, 32, 5, 255, 255, 220);
        } else if (f === 2) {
            fillCircle(img, ox + 64, 35, 5, 255, 220, 100);
        }
    }

    return img;
}

/** 301: Shotgun HUD sprite (3 frames). */
function generateShotgunHUD() {
    _srand(3010);
    const img = createImageData(HUD_FW * HUD_FRAMES, HUD_FH);

    for (let f = 0; f < HUD_FRAMES; f++) {
        const ox = f * HUD_FW;
        const recoil = (f === 1) ? -12 : (f === 2) ? -6 : 0;

        drawHUDHand(img, ox, recoil);

        // Shotgun body (wider)
        fillRect(img, ox + 48, 55 + recoil, 32, 30, 90, 80, 70);
        // Barrel (double barrel)
        fillRect(img, ox + 56, 30 + recoil, 6, 28, 70, 70, 75);
        fillRect(img, ox + 64, 30 + recoil, 6, 28, 70, 70, 75);
        // Barrel ends
        fillRect(img, ox + 56, 28 + recoil, 6, 3, 40, 40, 45);
        fillRect(img, ox + 64, 28 + recoil, 6, 3, 40, 40, 45);
        // Pump
        fillRect(img, ox + 50, 65 + recoil, 28, 6, 110, 90, 60);
        // Wood stock
        fillRect(img, ox + 52, 80 + recoil, 24, 10, 120, 80, 40);

        if (f === 1) {
            fillCircle(img, ox + 59, 22, 10, 255, 255, 150);
            fillCircle(img, ox + 67, 22, 10, 255, 255, 150);
            fillCircle(img, ox + 63, 20, 6, 255, 255, 240);
        } else if (f === 2) {
            fillCircle(img, ox + 63, 25, 6, 255, 200, 80);
        }
    }

    return img;
}

/** 302: Machine gun HUD sprite (3 frames). */
function generateMachinegunHUD() {
    _srand(3020);
    const img = createImageData(HUD_FW * HUD_FRAMES, HUD_FH);

    for (let f = 0; f < HUD_FRAMES; f++) {
        const ox = f * HUD_FW;
        const recoil = (f === 1) ? -5 : (f === 2) ? -3 : 0;
        // Slight horizontal shake on fire
        const shakeX = (f === 1) ? 2 : (f === 2) ? -1 : 0;

        drawHUDHand(img, ox + shakeX, recoil);

        // Gun body
        fillRect(img, ox + 50 + shakeX, 55 + recoil, 28, 28, 85, 85, 90);
        // Barrel
        fillRect(img, ox + 60 + shakeX, 28 + recoil, 8, 30, 70, 70, 75);
        // Barrel shroud (perforated)
        for (let vy = 30; vy < 55; vy += 4) {
            setPixel(img, ox + 62 + shakeX, vy + recoil, 50, 50, 55);
            setPixel(img, ox + 66 + shakeX, vy + recoil, 50, 50, 55);
        }
        // Magazine
        fillRect(img, ox + 54 + shakeX, 75 + recoil, 8, 14, 60, 60, 50);
        // Stock
        fillRect(img, ox + 52 + shakeX, 82 + recoil, 24, 8, 100, 80, 50);

        if (f === 1) {
            fillCircle(img, ox + 64 + shakeX, 22, 7, 255, 255, 160);
            fillCircle(img, ox + 64 + shakeX, 22, 4, 255, 255, 230);
        } else if (f === 2) {
            fillCircle(img, ox + 64 + shakeX, 24, 5, 255, 230, 100);
        }
    }

    return img;
}

/** 303: Rocket launcher HUD sprite (3 frames). */
function generateRocketLauncherHUD() {
    _srand(3030);
    const img = createImageData(HUD_FW * HUD_FRAMES, HUD_FH);

    for (let f = 0; f < HUD_FRAMES; f++) {
        const ox = f * HUD_FW;
        const recoil = (f === 1) ? -15 : (f === 2) ? -8 : 0;

        drawHUDHand(img, ox, recoil);

        // Large tube body
        fillRect(img, ox + 42, 50 + recoil, 44, 20, 70, 90, 60);
        // Barrel (wide tube)
        fillRect(img, ox + 50, 30 + recoil, 28, 22, 60, 80, 50);
        // Barrel opening
        fillRect(img, ox + 52, 28 + recoil, 24, 4, 30, 30, 30);
        // Scope on top
        fillRect(img, ox + 58, 44 + recoil, 12, 6, 50, 50, 55);
        // Grip
        fillRect(img, ox + 56, 70 + recoil, 16, 14, 80, 70, 50);
        // Warning stripe
        fillRect(img, ox + 42, 67 + recoil, 44, 3, 180, 160, 30);

        if (f === 1) {
            // Rocket launch exhaust
            fillCircle(img, ox + 64, 22, 12, 255, 200, 80);
            fillCircle(img, ox + 64, 22, 8, 255, 240, 160);
            fillCircle(img, ox + 64, 22, 4, 255, 255, 240);
            // Smoke trail
            for (let s = 0; s < 5; s++) {
                const sx = ox + 60 + _randInt(-4, 8);
                const sy = 35 + _randInt(-2, 8);
                fillCircle(img, sx, sy + recoil, 3, 180, 180, 180, 150);
            }
        } else if (f === 2) {
            fillCircle(img, ox + 64, 26, 6, 200, 150, 60);
        }
    }

    return img;
}

/** 304: Plasma rifle HUD sprite (3 frames). */
function generatePlasmaRifleHUD() {
    _srand(3040);
    const img = createImageData(HUD_FW * HUD_FRAMES, HUD_FH);

    for (let f = 0; f < HUD_FRAMES; f++) {
        const ox = f * HUD_FW;
        const recoil = (f === 1) ? -6 : (f === 2) ? -3 : 0;

        drawHUDHand(img, ox, recoil);

        // Sleek body
        fillRect(img, ox + 46, 52 + recoil, 36, 22, 80, 90, 120);
        // Barrel (energy emitter)
        fillRect(img, ox + 56, 34 + recoil, 16, 20, 70, 80, 110);
        // Energy coils around barrel
        for (let cy = 36; cy < 52; cy += 3) {
            hLine(img, ox + 54, ox + 74, cy + recoil, 50, 150, 200);
        }
        // Emitter tip
        fillRect(img, ox + 58, 30 + recoil, 12, 5, 0, 200, 255);
        // Power cell (glowing)
        fillRect(img, ox + 48, 60 + recoil, 10, 8, 0, 180, 220);
        // Stock
        fillRect(img, ox + 50, 74 + recoil, 28, 8, 60, 65, 80);

        if (f === 1) {
            // Plasma bolt at muzzle
            fillCircle(img, ox + 64, 24, 10, 0, 200, 255);
            fillCircle(img, ox + 64, 24, 6, 100, 240, 255);
            fillCircle(img, ox + 64, 24, 3, 200, 255, 255);
        } else if (f === 2) {
            fillCircle(img, ox + 64, 28, 6, 0, 160, 220);
            fillCircle(img, ox + 64, 28, 3, 80, 220, 255);
        }
    }

    return img;
}

/** 305: Sniper rifle HUD sprite (3 frames). */
function generateSniperRifleHUD() {
    _srand(3050);
    const img = createImageData(HUD_FW * HUD_FRAMES, HUD_FH);

    for (let f = 0; f < HUD_FRAMES; f++) {
        const ox = f * HUD_FW;
        const recoil = (f === 1) ? -14 : (f === 2) ? -6 : 0;

        drawHUDHand(img, ox, recoil);

        // Wooden stock at bottom
        fillRect(img, ox + 50, 78 + recoil, 28, 14, 120, 80, 40);
        // Stock darker underside
        fillRect(img, ox + 50, 88 + recoil, 28, 4, 90, 60, 30);

        // Slim barrel extending up through frame
        fillRect(img, ox + 61, 20 + recoil, 6, 62, 75, 75, 80);
        // Barrel highlight (left edge)
        vLine(img, ox + 61, 20 + recoil, 80 + recoil, 95, 95, 100);

        // Receiver body (connects barrel to stock)
        fillRect(img, ox + 52, 58 + recoil, 24, 22, 85, 85, 90);
        // Trigger guard
        fillRect(img, ox + 58, 76 + recoil, 8, 4, 70, 70, 75);
        // Trigger
        setPixel(img, ox + 62, 78 + recoil, 50, 50, 55);
        setPixel(img, ox + 62, 79 + recoil, 50, 50, 55);

        // Rectangular scope mounted on barrel
        fillRect(img, ox + 56, 34 + recoil, 16, 10, 40, 40, 45);
        // Scope lens front
        fillRect(img, ox + 56, 34 + recoil, 16, 2, 30, 30, 35);
        // Scope lens rear
        fillRect(img, ox + 56, 42 + recoil, 16, 2, 30, 30, 35);
        // Scope highlight
        hLine(img, ox + 57, ox + 71, 36 + recoil, 60, 60, 70);
        // Scope mount rings
        fillRect(img, ox + 59, 44 + recoil, 3, 4, 65, 65, 70);
        fillRect(img, ox + 66, 44 + recoil, 3, 4, 65, 65, 70);

        // Barrel tip
        fillRect(img, ox + 60, 18 + recoil, 8, 3, 50, 50, 55);

        // Muzzle flash on fire frames
        if (f === 1) {
            // Bright sharp flash
            fillCircle(img, ox + 64, 10, 10, 255, 255, 180);
            fillCircle(img, ox + 64, 10, 6, 255, 255, 240);
            // Vertical flash spike
            for (let y = 0; y < 12; y++) {
                const alpha = 255 - y * 20;
                if (alpha > 0) {
                    setPixel(img, ox + 64, y, 255, 255, 200, alpha);
                    setPixel(img, ox + 63, y, 255, 240, 160, alpha >> 1);
                    setPixel(img, ox + 65, y, 255, 240, 160, alpha >> 1);
                }
            }
        } else if (f === 2) {
            fillCircle(img, ox + 64, 14, 5, 255, 200, 80);
        }
    }

    return img;
}

/** 306: Knife HUD sprite (3 frames). */
function generateKnifeHUD() {
    _srand(3060);
    const img = createImageData(HUD_FW * HUD_FRAMES, HUD_FH);

    for (let f = 0; f < HUD_FRAMES; f++) {
        const ox = f * HUD_FW;

        if (f === 0) {
            // Frame 0: Knife ready position (blade pointing up)
            drawHUDHand(img, ox, 0);

            // Handle / grip (dark brown)
            fillRect(img, ox + 58, 72, 12, 18, 70, 45, 25);
            // Grip wrap detail
            for (let gy = 74; gy < 88; gy += 3) {
                hLine(img, ox + 58, ox + 69, gy, 55, 35, 18);
            }
            // Guard (cross-piece)
            fillRect(img, ox + 54, 68, 20, 4, 140, 140, 145);
            // Blade (silver/grey, pointing upward)
            fillRect(img, ox + 60, 28, 8, 40, 180, 185, 190);
            // Blade edge highlight (left side lighter)
            vLine(img, ox + 60, 28, 67, 210, 215, 220);
            // Blade spine (right side darker)
            vLine(img, ox + 67, 28, 67, 140, 140, 145);
            // Blade tip (pointed)
            for (let t = 0; t < 6; t++) {
                const w = Math.floor((6 - t) * 8 / 6);
                const startX = ox + 64 - (w >> 1);
                for (let px = startX; px < startX + w; px++) {
                    setPixel(img, px, 22 + t, 190, 195, 200);
                }
            }
            setPixel(img, ox + 64, 21, 200, 205, 210);

        } else if (f === 1) {
            // Frame 1: Mid-slash (blade rotated right, motion arc)
            drawHUDHand(img, ox + 6, 4);

            // Handle rotated/shifted right
            fillRect(img, ox + 66, 76, 16, 12, 70, 45, 25);
            // Grip wrap
            for (let gy = 77; gy < 87; gy += 3) {
                hLine(img, ox + 66, ox + 81, gy, 55, 35, 18);
            }
            // Guard
            fillRect(img, ox + 64, 72, 20, 4, 140, 140, 145);
            // Blade slashing diagonally to the right
            for (let i = 0; i < 36; i++) {
                const bx = ox + 68 + Math.floor(i * 0.6);
                const by = 68 - i;
                fillRect(img, bx, by, 6, 2, 180, 185, 190);
                // Edge highlight
                setPixel(img, bx, by, 210, 215, 220);
            }
            // Slash tip
            setPixel(img, ox + 89, 32, 200, 205, 210);
            setPixel(img, ox + 90, 31, 200, 205, 210);

            // Motion arc lines (swoosh effect)
            for (let a = 0; a < 3; a++) {
                const arcOffset = a * 6;
                for (let i = 0; i < 20; i++) {
                    const angle = (i / 20) * Math.PI * 0.5 + 0.3;
                    const dist = 30 + arcOffset;
                    const ax = ox + 64 + Math.floor(Math.cos(angle) * dist);
                    const ay = 70 - Math.floor(Math.sin(angle) * dist);
                    const alpha = 160 - a * 50 - i * 4;
                    if (alpha > 0) {
                        setPixel(img, ax, ay, 220, 220, 230, alpha);
                    }
                }
            }

        } else {
            // Frame 2: Follow-through (blade past slash, settling)
            drawHUDHand(img, ox + 3, 2);

            // Handle slightly shifted
            fillRect(img, ox + 70, 80, 14, 10, 70, 45, 25);
            // Grip wrap
            for (let gy = 81; gy < 89; gy += 3) {
                hLine(img, ox + 70, ox + 83, gy, 55, 35, 18);
            }
            // Guard
            fillRect(img, ox + 68, 76, 18, 4, 140, 140, 145);
            // Blade extended far right/down (follow-through)
            for (let i = 0; i < 30; i++) {
                const bx = ox + 72 + Math.floor(i * 0.4);
                const by = 72 - i;
                fillRect(img, bx, by, 6, 2, 170, 175, 180);
            }
            // Fading motion trail
            for (let i = 0; i < 15; i++) {
                const angle = (i / 15) * Math.PI * 0.4 + 0.5;
                const dist = 35;
                const ax = ox + 64 + Math.floor(Math.cos(angle) * dist);
                const ay = 72 - Math.floor(Math.sin(angle) * dist);
                setPixel(img, ax, ay, 200, 200, 210, 80);
            }
        }
    }

    return img;
}

// =============================================================================
// Effect Sprite Generators (IDs 400-404)
// =============================================================================

/** 400: Muzzle flash (32x32). */
function generateMuzzleFlash() {
    const img = createImageData(32, 32);
    const cx = 16, cy = 16;
    // Outer glow
    fillCircle(img, cx, cy, 14, 255, 200, 50, 120);
    // Mid glow
    fillCircle(img, cx, cy, 10, 255, 240, 100, 200);
    // Core
    fillCircle(img, cx, cy, 5, 255, 255, 220, 255);
    // Spikes
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        for (let d = 6; d < 14; d++) {
            const px = cx + Math.round(Math.cos(angle) * d);
            const py = cy + Math.round(Math.sin(angle) * d);
            setPixel(img, px, py, 255, 255, 180, 200 - d * 10);
        }
    }
    return img;
}

/** 401: Rocket projectile (16x16). */
function generateRocketProjectile() {
    const img = createImageData(16, 16);
    // Rocket body
    fillRect(img, 4, 6, 8, 4, 120, 120, 110);
    // Nose cone
    setPixel(img, 12, 7, 160, 160, 150);
    setPixel(img, 12, 8, 160, 160, 150);
    setPixel(img, 13, 7, 180, 180, 170);
    setPixel(img, 13, 8, 180, 180, 170);
    // Fins
    setPixel(img, 4, 5, 100, 100, 90);
    setPixel(img, 4, 10, 100, 100, 90);
    // Flame trail
    fillRect(img, 1, 7, 3, 2, 255, 160, 30);
    setPixel(img, 0, 7, 255, 100, 20);
    setPixel(img, 0, 8, 255, 100, 20);
    return img;
}

/** 402: Plasma bolt (16x16). */
function generatePlasmaBolt() {
    const img = createImageData(16, 16);
    const cx = 8, cy = 8;
    fillCircle(img, cx, cy, 6, 0, 100, 180, 100);
    fillCircle(img, cx, cy, 4, 0, 180, 255, 180);
    fillCircle(img, cx, cy, 2, 150, 240, 255, 255);
    return img;
}

/** 403: Explosion (64x64, 3 frames = 192x64). */
function generateExplosion() {
    _srand(4030);
    const img = createImageData(TEX * 3, TEX);

    for (let f = 0; f < 3; f++) {
        const ox = f * TEX;
        const cx = ox + 32;
        const cy = 32;
        const maxR = 10 + f * 8;

        // Outer orange
        fillCircle(img, cx, cy, maxR, 200, 80 + f * 20, 0, 200 - f * 40);
        // Mid yellow
        fillCircle(img, cx, cy, maxR - 4, 255, 160 + f * 20, 20, 220 - f * 30);
        // Core white-hot (shrinks each frame)
        const coreR = Math.max(2, 8 - f * 3);
        fillCircle(img, cx, cy, coreR, 255, 255, 200, 255);

        // Debris / sparks
        for (let s = 0; s < 8 + f * 4; s++) {
            const angle = _rand() * Math.PI * 2;
            const dist = _rand() * maxR;
            const sx = cx + Math.round(Math.cos(angle) * dist);
            const sy = cy + Math.round(Math.sin(angle) * dist);
            setPixel(img, sx, sy, 255, 200 + _randInt(0, 55), _randInt(0, 100));
        }
    }

    return img;
}

/** 404: Barrel (grey/red explosive barrel, 64x64). */
function generateBarrel() {
    _srand(4040);
    const img = createImageData(TEX, TEX);
    const cx = 32;

    // Barrel body (cylinder approximation)
    for (let y = 16; y < 56; y++) {
        // Width varies for barrel shape
        const t = (y - 16) / 40;
        const w = Math.round(12 + Math.sin(t * Math.PI) * 4);
        for (let x = cx - w; x <= cx + w; x++) {
            const shade = 1.0 - Math.abs(x - cx) / (w + 1) * 0.3;
            setPixel(img, x, y,
                clampByte(90 * shade),
                clampByte(90 * shade),
                clampByte(95 * shade));
        }
    }

    // Metal bands at top and bottom
    for (let x = cx - 12; x <= cx + 12; x++) {
        setPixel(img, x, 18, 110, 110, 105);
        setPixel(img, x, 19, 120, 120, 115);
        setPixel(img, x, 53, 110, 110, 105);
        setPixel(img, x, 54, 120, 120, 115);
    }

    // Red hazard stripe in middle
    for (let y = 32; y < 40; y++) {
        const t = (y - 16) / 40;
        const w = Math.round(12 + Math.sin(t * Math.PI) * 4);
        for (let x = cx - w; x <= cx + w; x++) {
            const shade = 1.0 - Math.abs(x - cx) / (w + 1) * 0.3;
            setPixel(img, x, y,
                clampByte(180 * shade),
                clampByte(30 * shade),
                clampByte(30 * shade));
        }
    }

    // Warning symbol (triangle with !)
    // Simple triangle
    for (let dy = 0; dy < 6; dy++) {
        const w = dy;
        for (let dx = -w; dx <= w; dx++) {
            setPixel(img, cx + dx, 24 + dy, 200, 180, 30);
        }
    }
    // Exclamation
    setPixel(img, cx, 26, 30, 30, 30);
    setPixel(img, cx, 27, 30, 30, 30);
    setPixel(img, cx, 29, 30, 30, 30);

    // Lid / top
    for (let x = cx - 8; x <= cx + 8; x++) {
        setPixel(img, x, 16, 100, 100, 95);
        setPixel(img, x, 17, 80, 80, 75);
    }

    return img;
}

// =============================================================================
// TextureManager Class
// =============================================================================

export class TextureManager {
    /**
     * Construct the TextureManager and procedurally generate all textures.
     * Every texture is an ImageData object stored in an internal map keyed
     * by numeric ID.
     */
    constructor() {
        /**
         * Internal storage: id -> ImageData.
         * @type {Map<number, ImageData>}
         */
        this._textures = new Map();

        this._generateAll();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Retrieve a texture by its numeric ID.
     * @param {number} id
     * @returns {ImageData|undefined}
     */
    getTexture(id) {
        return this._textures.get(id);
    }

    /**
     * Retrieve a wall texture (IDs 1-8).
     * Convenience wrapper that falls back to ID 1 (brick) when the requested
     * wall texture does not exist.
     * @param {number} id
     * @returns {ImageData}
     */
    getWallTexture(id) {
        return this._textures.get(id) || this._textures.get(1);
    }

    /**
     * Return the entire texture map as a plain object for the renderer.
     * The renderer indexes textures by numeric ID via bracket notation,
     * so a plain object is the most compatible interface.
     * @returns {Object.<number, ImageData>}
     */
    getAllAsObject() {
        const obj = {};
        for (const [id, tex] of this._textures) {
            obj[id] = tex;
        }
        return obj;
    }

    // -------------------------------------------------------------------------
    // Internal Generation
    // -------------------------------------------------------------------------

    /** @private */
    _generateAll() {
        // --- Wall Textures (1-8) ---
        this._textures.set(1, generateBrick());
        this._textures.set(2, generateConcrete());
        this._textures.set(3, generateLabTile());
        this._textures.set(4, generatePrisonMetal());
        this._textures.set(5, generateTechPanel());
        this._textures.set(6, generateCrate());
        this._textures.set(7, generateDoor());
        this._textures.set(8, generateDoorLocked());

        // --- Enemy Sprite Sheets (100-104) ---
        this._textures.set(100, generateGrunt());
        this._textures.set(101, generateSoldier());
        this._textures.set(102, generateScout());
        this._textures.set(103, generateBrute());
        this._textures.set(104, generateCommander());

        // --- Player Sprite Sheet (110) ---
        this._textures.set(110, generatePlayerSprite());

        // --- Item Sprites (200+) ---
        // Health & Armor (200-202) - referenced directly by ITEM_DEFS.
        this._textures.set(200, generateHealthSmall());
        this._textures.set(201, generateHealthLarge());
        this._textures.set(202, generateArmor());

        // Ammo sprites - generate once, register at both original and ITEM_DEFS IDs.
        // ITEM_DEFS references ammo as 210-213; original generation was at 203-206.
        const ammoBullets = generateAmmoBullets();
        const ammoShells  = generateAmmoShells();
        const ammoRockets = generateAmmoRockets();
        const ammoCells   = generateAmmoCells();
        this._textures.set(203, ammoBullets);
        this._textures.set(204, ammoShells);
        this._textures.set(205, ammoRockets);
        this._textures.set(206, ammoCells);
        this._textures.set(210, ammoBullets);   // ITEM_DEFS alias
        this._textures.set(211, ammoShells);     // ITEM_DEFS alias
        this._textures.set(212, ammoRockets);    // ITEM_DEFS alias
        this._textures.set(213, ammoCells);       // ITEM_DEFS alias

        // Keycard sprites - generate once, register at both original and ITEM_DEFS IDs.
        // ITEM_DEFS references keycards as 220-222; original generation was at 207-209.
        const blueKeycard   = generateBlueKeycard();
        const redKeycard    = generateRedKeycard();
        const yellowKeycard = generateYellowKeycard();
        this._textures.set(207, blueKeycard);
        this._textures.set(208, redKeycard);
        this._textures.set(209, yellowKeycard);
        this._textures.set(220, blueKeycard);    // ITEM_DEFS alias
        this._textures.set(221, redKeycard);      // ITEM_DEFS alias
        this._textures.set(222, yellowKeycard);   // ITEM_DEFS alias

        // Weapon pickup sprites - generate once, register at both original and ITEM_DEFS IDs.
        // ITEM_DEFS references weapons as 230-233; original generation was at 210-213.
        // Note: 210-213 are now used by ammo aliases above, so weapon pickups need
        // their own dedicated slots. Original IDs are superseded by ammo aliases.
        const shotgunPickup       = generateShotgunPickup();
        const machinegunPickup    = generateMachinegunPickup();
        const rocketLauncherPickup = generateRocketLauncherPickup();
        const plasmaRiflePickup   = generatePlasmaRiflePickup();
        this._textures.set(230, shotgunPickup);          // ITEM_DEFS ID
        this._textures.set(231, machinegunPickup);        // ITEM_DEFS ID
        this._textures.set(232, rocketLauncherPickup);    // ITEM_DEFS ID
        this._textures.set(233, plasmaRiflePickup);       // ITEM_DEFS ID

        // Objective item sprite (240) - glowing golden orb.
        this._textures.set(240, generateObjectiveItem());

        // --- Weapon HUD Sprites (300-306) ---

        this._textures.set(300, generatePistolHUD());
        this._textures.set(301, generateShotgunHUD());
        this._textures.set(302, generateMachinegunHUD());
        this._textures.set(303, generateRocketLauncherHUD());
        this._textures.set(304, generatePlasmaRifleHUD());
        this._textures.set(305, generateSniperRifleHUD());
        this._textures.set(306, generateKnifeHUD());

        // --- Effect Sprites (400-404) ---
        this._textures.set(400, generateMuzzleFlash());
        this._textures.set(401, generateRocketProjectile());
        this._textures.set(402, generatePlasmaBolt());
        this._textures.set(403, generateExplosion());
        this._textures.set(404, generateBarrel());
    }
}
