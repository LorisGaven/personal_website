(() => {
    const canvas = document.createElement('canvas');
    canvas.id = 'flowers-bg';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = document.body.scrollHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const plants = [];
    const MAX_PLANTS = 10;
    let time = 0;
    let mouseX = -1000, mouseY = -1000;
    const MOUSE_RADIUS = 100;
    const MOUSE_STRENGTH = 60;
    const RESOLUTION = 40;

    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY + window.scrollY;
    });
    window.addEventListener('mouseleave', () => {
        mouseX = -1000;
        mouseY = -1000;
    });

    // Generate smooth stem using gentle sine waves
    function generateStem(baseX, baseY, height) {
        const points = [];

        // Random smooth wave parameters
        const sway1 = (15 + Math.random() * 25) * (Math.random() < 0.5 ? 1 : -1);
        const freq1 = 0.8 + Math.random() * 0.6;
        const sway2 = (5 + Math.random() * 10) * (Math.random() < 0.5 ? 1 : -1);
        const freq2 = 1.5 + Math.random() * 1;
        const lean = (Math.random() - 0.5) * 30;

        for (let i = 0; i <= RESOLUTION; i++) {
            const t = i / RESOLUTION;
            const x = baseX
                + Math.sin(t * Math.PI * freq1) * sway1 * t
                + Math.sin(t * Math.PI * freq2) * sway2 * t
                + lean * t;
            const y = baseY - t * height;
            points.push({ x, y });
        }
        return points;
    }

    // Precompute stem geometry: segment lengths, rest angles, scratch buffers
    function precomputeStemGeometry(plant) {
        const pts = plant.stemPoints;
        const n = pts.length - 1; // 40 segments
        plant.segLengths = new Float64Array(n);
        plant.restAngles = new Float64Array(n);
        plant.frameX = new Float64Array(pts.length);
        plant.frameY = new Float64Array(pts.length);
        plant.frameAngles = new Float64Array(pts.length);

        for (let i = 0; i < n; i++) {
            const dx = pts[i + 1].x - pts[i].x;
            const dy = pts[i + 1].y - pts[i].y;
            plant.segLengths[i] = Math.sqrt(dx * dx + dy * dy);
            plant.restAngles[i] = Math.atan2(dy, dx);
        }

        // Initialize frame positions to rest
        for (let i = 0; i < pts.length; i++) {
            plant.frameX[i] = pts[i].x;
            plant.frameY[i] = pts[i].y;
        }
    }

    // Core physics: compute frame positions via angular perturbation
    function computeFramePositions(plant) {
        const n = RESOLUTION;
        const wp = plant.windPhase;
        const mp = plant.mousePush;
        const mc = plant.mouseContactT;

        // Base point is always anchored
        plant.frameX[0] = plant.stemPoints[0].x;
        plant.frameY[0] = plant.stemPoints[0].y;
        plant.frameAngles[0] = 0;

        let accumAngle = 0;

        for (let i = 0; i < n; i++) {
            const t = (i + 1) / n; // 0..1, how far up the stem

            // Wind: angle perturbation with propagating spatial phase
            const windAngle = Math.sin(time * 0.008 + wp + i * 0.15) * 0.12 * t * t
                            + Math.sin(time * 0.017 + wp * 1.7 + i * 0.10) * 0.05 * t * t;

            // Mouse: concentrated curvature near contact point (Lorentzian)
            const dt = t - mc;
            const lorentzian = 1 / (1 + 80 * dt * dt);
            const mouseAngle = mp * 0.006 * t * lorentzian;

            const totalAngle = plant.restAngles[i] + windAngle + mouseAngle;
            accumAngle = windAngle + mouseAngle; // track cumulative deflection for leaf tangent

            plant.frameX[i + 1] = plant.frameX[i] + plant.segLengths[i] * Math.cos(totalAngle);
            plant.frameY[i + 1] = plant.frameY[i] + plant.segLengths[i] * Math.sin(totalAngle);
            plant.frameAngles[i + 1] = accumAngle;
        }
    }

    // Update mouse push using current bent positions
    function updateMousePush(plant) {
        let minDist = Infinity;
        let contactT = 0.5;
        const n = RESOLUTION + 1;
        for (let i = 0; i < n; i++) {
            const dx = plant.frameX[i] - mouseX;
            const dy = plant.frameY[i] - mouseY;
            const d = dx * dx + dy * dy;
            if (d < minDist) {
                minDist = d;
                contactT = i / (n - 1);
            }
        }
        minDist = Math.sqrt(minDist);

        let targetPush = 0;
        let targetContact = plant.mouseContactT;
        if (minDist < MOUSE_RADIUS) {
            const force = (1 - minDist / MOUSE_RADIUS);
            const dir = plant.baseX < mouseX ? -1 : 1;
            targetPush = dir * force * MOUSE_STRENGTH;
            targetContact = Math.max(0.05, contactT);
        }

        plant.mousePush += (targetPush - plant.mousePush) * 0.06;
        plant.mouseContactT += (targetContact - plant.mouseContactT) * 0.06;
        if (Math.abs(plant.mousePush) < 0.01) plant.mousePush = 0;
    }

    // Draw stem from precomputed frame positions
    function drawStem(plant, progress) {
        if (progress <= 0) return { x: plant.frameX[0], y: plant.frameY[0] };

        const n = Math.floor(progress * RESOLUTION);
        if (n < 1) return { x: plant.frameX[0], y: plant.frameY[0] };

        ctx.strokeStyle = plant.stemColor;
        ctx.lineWidth = plant.stemWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(plant.frameX[0], plant.frameY[0]);

        for (let i = 1; i <= n; i++) {
            ctx.lineTo(plant.frameX[i], plant.frameY[i]);
        }

        // Fractional tip
        const frac = (progress * RESOLUTION) - n;
        let tipX, tipY;
        if (n < RESOLUTION && frac > 0) {
            tipX = plant.frameX[n] + (plant.frameX[n + 1] - plant.frameX[n]) * frac;
            tipY = plant.frameY[n] + (plant.frameY[n + 1] - plant.frameY[n]) * frac;
            ctx.lineTo(tipX, tipY);
        } else {
            const idx = Math.min(n, RESOLUTION);
            tipX = plant.frameX[idx];
            tipY = plant.frameY[idx];
        }

        ctx.stroke();
        return { x: tipX, y: tipY };
    }

    // Get position and angle along stem at parameter t (0..1)
    function getStemPoint(plant, t) {
        const idx = t * RESOLUTION;
        const i = Math.floor(idx);
        const frac = idx - i;
        if (i >= RESOLUTION) {
            return {
                x: plant.frameX[RESOLUTION],
                y: plant.frameY[RESOLUTION],
                angle: plant.frameAngles[RESOLUTION],
            };
        }
        return {
            x: plant.frameX[i] + (plant.frameX[i + 1] - plant.frameX[i]) * frac,
            y: plant.frameY[i] + (plant.frameY[i + 1] - plant.frameY[i]) * frac,
            angle: plant.frameAngles[i] + (plant.frameAngles[i + 1] - plant.frameAngles[i]) * frac,
        };
    }

    // Draw a leaf
    function drawLeaf(x, y, angle, size, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(size * 0.4, -size * 0.5, size * 0.8, -size * 0.3, size, 0);
        ctx.bezierCurveTo(size * 0.8, size * 0.3, size * 0.4, size * 0.5, 0, 0);
        ctx.fill();
        ctx.restore();
    }

    // Draw grass tufts at the base of a plant (with mouse reaction)
    function drawGrass(x, y, blades, color, wPhase, mousePushAngle) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        for (const b of blades) {
            const windAngle = Math.sin(time * 0.002 + wPhase + b.phase) * 0.3;
            const totalAngle = windAngle + mousePushAngle * 0.5;

            // Two-segment angle-based blade
            const baseAngle = -Math.PI / 2 + b.lean * 0.02;
            const seg1Len = b.height * 0.6;
            const seg2Len = b.height * 0.4;

            const a1 = baseAngle + totalAngle * 0.4;
            const midX = x + b.ox + Math.cos(a1) * seg1Len;
            const midY = y + Math.sin(a1) * seg1Len;

            const a2 = baseAngle + totalAngle;
            const tipX = midX + Math.cos(a2) * seg2Len;
            const tipY = midY + Math.sin(a2) * seg2Len;

            ctx.beginPath();
            ctx.moveTo(x + b.ox, y);
            ctx.quadraticCurveTo(midX, midY, tipX, tipY);
            ctx.stroke();
        }
    }

    // Different flower head types
    function drawFlowerHead(x, y, size, type, color, color2, flowerData) {
        if (type === 0) {
            // Simple petals
            ctx.fillStyle = color;
            for (let i = 0; i < flowerData.petals; i++) {
                const angle = (i / flowerData.petals) * Math.PI * 2;
                ctx.beginPath();
                const px = x + Math.cos(angle) * size * 0.4;
                const py = y + Math.sin(angle) * size * 0.4;
                ctx.ellipse(px, py, size * 0.5, size * 0.25, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = color2;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 1) {
            // Tulip shape
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x, y + size * 0.3);
            ctx.bezierCurveTo(x - size * 0.5, y, x - size * 0.4, y - size * 0.8, x, y - size * 0.6);
            ctx.bezierCurveTo(x + size * 0.4, y - size * 0.8, x + size * 0.5, y, x, y + size * 0.3);
            ctx.fill();
        } else if (type === 2) {
            // Dandelion puff
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.fillStyle = color;
            for (const s of flowerData.spokes) {
                const ex = x + Math.cos(s.angle) * size * s.len;
                const ey = y + Math.sin(s.angle) * size * s.len;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(ex, ey);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(ex, ey, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Rose spiral
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = color2;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 4; a += 0.1) {
                const r = a * size * 0.05;
                if (a === 0) ctx.moveTo(x + r, y);
                else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            }
            ctx.stroke();
        }
    }

    // Slot system for even distribution
    const SLOT_HEIGHT = 250;
    const slots = [];

    function buildSlots() {
        slots.length = 0;
        const rows = Math.max(1, Math.floor(canvas.height / SLOT_HEIGHT));
        for (let r = 0; r < rows; r++) {
            slots.push({ side: 'left', row: r, occupied: false });
            slots.push({ side: 'right', row: r, occupied: false });
        }
    }
    buildSlots();

    function getSlot() {
        const free = slots.filter(s => !s.occupied);
        if (free.length === 0) return null;
        const slot = free[Math.floor(Math.random() * free.length)];
        slot.occupied = true;
        return slot;
    }

    function releaseSlot(side, row) {
        const s = slots.find(s => s.side === side && s.row === row);
        if (s) s.occupied = false;
    }

    function spawnPlant() {
        const slot = getSlot();
        if (!slot) return;

        const contentW = Math.min(720, window.innerWidth);
        const contentLeft = (window.innerWidth - contentW) / 2;
        const contentRight = contentLeft + contentW;
        const leftSpace = contentLeft;
        const rightSpace = window.innerWidth - contentRight;

        let x;
        if (slot.side === 'left' && leftSpace >= 80) {
            x = 40 + Math.random() * (leftSpace - 60);
        } else if (slot.side === 'right' && rightSpace >= 80) {
            x = contentRight + 20 + Math.random() * (rightSpace - 60);
        } else {
            releaseSlot(slot.side, slot.row);
            return;
        }

        // Vary size: medium or large
        const sizeRoll = Math.random();
        let height, stemWidth, leafSize, flowerSize, leafCount;
        if (sizeRoll < 0.5) {
            height = 140 + Math.random() * 120;
            stemWidth = 1.5 + Math.random() * 1;
            leafSize = 8 + Math.random() * 10;
            flowerSize = 10 + Math.random() * 10;
            leafCount = 2 + Math.floor(Math.random() * 3);
        } else {
            height = 260 + Math.random() * 140;
            stemWidth = 2.5 + Math.random() * 1.5;
            leafSize = 14 + Math.random() * 16;
            flowerSize = 16 + Math.random() * 14;
            leafCount = 3 + Math.floor(Math.random() * 4);
        }

        const slotTop = slot.row * SLOT_HEIGHT + 80;
        const jitter = Math.random() * (SLOT_HEIGHT - 80);
        const baseY = slotTop + jitter + height;
        const stemPoints = generateStem(x, baseY, height);

        // Build leaves with rest angle from stem geometry
        const leaves = [];
        for (let i = 0; i < leafCount; i++) {
            const t = 0.15 + Math.random() * 0.65;
            leaves.push({
                t,
                angle: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 1),
                size: leafSize * (0.7 + Math.random() * 0.6),
                restAngle: 0, // filled in after precompute
            });
        }

        // Generate grass blades at base
        const grassBlades = [];
        for (let i = 0, n = 3 + Math.floor(Math.random() * 5); i < n; i++) {
            grassBlades.push({
                ox: (Math.random() - 0.5) * 20,
                height: 6 + Math.random() * 14,
                lean: (Math.random() - 0.5) * 12,
                phase: Math.random() * Math.PI * 2,
            });
        }

        // Pre-compute flower head geometry
        const flowerType = Math.floor(Math.random() * 4);
        const flowerData = {};
        if (flowerType === 0) {
            flowerData.petals = 5 + Math.floor(Math.random() * 3);
        } else if (flowerType === 2) {
            flowerData.spokes = [];
            for (let i = 0; i < 12; i++) {
                flowerData.spokes.push({
                    angle: (i / 12) * Math.PI * 2 + Math.random() * 0.2,
                    len: 0.6 + Math.random() * 0.4,
                });
            }
        }

        const plant = {
            stemPoints,
            baseX: x,
            baseY,
            height,
            leaves,
            grassBlades,
            stemWidth,
            windPhase: Math.random() * Math.PI * 2,
            mousePush: 0,
            mouseContactT: 0.5,
            slotSide: slot.side,
            slotRow: slot.row,
            flowerType,
            flowerData,
            flowerSize,
            growth: 0,
            speed: 0.001 + Math.random() * 0.002,
            opacity: 0,
            maxOpacity: 0.2 + Math.random() * 0.15,
            stemColor: Math.random() < 0.5 ? '#8a6a5a' : '#7a6050',
            leafColor: Math.random() < 0.5 ? '#8a7a5a' : '#7a6a50',
            flowerColor: Math.random() < 0.5 ? '#c4817b' : '#d4956a',
            flowerColor2: Math.random() < 0.5 ? '#e8b990' : '#e8c4a8',
            age: 0,
            lifetime: 1000 + Math.random() * 800,
        };

        // Precompute geometry and leaf rest angles
        precomputeStemGeometry(plant);
        for (const leaf of plant.leaves) {
            const idx = leaf.t * RESOLUTION;
            const i = Math.floor(idx);
            const frac = idx - i;
            if (i >= RESOLUTION) {
                leaf.restAngle = plant.frameAngles[RESOLUTION];
            } else {
                leaf.restAngle = plant.frameAngles[i] + (plant.frameAngles[i + 1] - plant.frameAngles[i]) * frac;
            }
        }

        plants.push(plant);
    }

    for (let i = 0; i < 4; i++) spawnPlant();

    function draw() {
        time++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = plants.length - 1; i >= 0; i--) {
            const p = plants[i];
            p.age++;

            if (p.growth < 1) {
                p.growth = Math.min(1, p.growth + p.speed);
                p.opacity = Math.min(p.maxOpacity, p.opacity + 0.002);
            }

            if (p.age > p.lifetime) {
                p.opacity -= 0.001;
                if (p.opacity <= 0) {
                    releaseSlot(p.slotSide, p.slotRow);
                    plants.splice(i, 1);
                    continue;
                }
            }

            ctx.globalAlpha = p.opacity;

            // Update mouse interaction (reads previous frame's frameX/Y)
            updateMousePush(p);

            // Compute new frame positions (angular deflection model)
            computeFramePositions(p);

            // Draw grass at base (with mouse reaction)
            const mousePushAngle = p.mousePush * 0.006;
            drawGrass(p.baseX, p.baseY, p.grassBlades, p.leafColor, p.windPhase, mousePushAngle);

            // Draw stem from precomputed positions
            const tip = drawStem(p, p.growth);

            // Draw leaves with tangent-following rotation
            for (const leaf of p.leaves) {
                if (p.growth > leaf.t) {
                    const pt = getStemPoint(p, leaf.t);
                    const leafProgress = Math.min(1, (p.growth - leaf.t) * 3);
                    const eased = leafProgress * leafProgress * (3 - 2 * leafProgress);
                    const adjustedAngle = leaf.angle + (pt.angle - leaf.restAngle);
                    drawLeaf(pt.x, pt.y, adjustedAngle, leaf.size * eased, p.leafColor);
                }
            }

            // Draw flower head when stem is nearly done
            if (p.growth > 0.85) {
                const flowerProgress = (p.growth - 0.85) / 0.15;
                const eased = flowerProgress * flowerProgress * (3 - 2 * flowerProgress);
                ctx.globalAlpha = p.opacity * eased;
                drawFlowerHead(
                    tip.x, tip.y,
                    p.flowerSize * eased,
                    p.flowerType,
                    p.flowerColor,
                    p.flowerColor2,
                    p.flowerData,
                );
            }
        }

        ctx.globalAlpha = 1;

        if (plants.length < MAX_PLANTS && Math.random() < 0.005) {
            spawnPlant();
        }

        const h = document.body.scrollHeight;
        if (canvas.height !== h) {
            canvas.height = h;
            buildSlots();
            for (const p of plants) {
                const s = slots.find(s => s.side === p.slotSide && s.row === p.slotRow);
                if (s) s.occupied = true;
            }
        }

        requestAnimationFrame(draw);
    }

    draw();
})();
