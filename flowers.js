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

    // Generate smooth stem using gentle sine waves
    function generateStem(baseX, baseY, height) {
        const RESOLUTION = 40; // many points for smooth curves
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

    // Apply wind offset: anchored at base, increases with height (t^2 for natural droop)
    function windOffset(t, windPhase) {
        const strength = 12;
        return Math.sin(time * 0.008 + windPhase) * strength * t * t
             + Math.sin(time * 0.017 + windPhase * 1.7) * strength * 0.3 * t * t;
    }

    // Draw stem as a smooth path, returns the tip position
    function drawStem(points, progress, color, width, wPhase) {
        if (progress <= 0) return points[0];

        const n = Math.floor(progress * (points.length - 1));
        if (n < 1) return points[0];

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i <= n; i++) {
            const t = i / (points.length - 1);
            ctx.lineTo(points[i].x + windOffset(t, wPhase), points[i].y);
        }

        // Fractional tip
        const frac = (progress * (points.length - 1)) - n;
        let tipX, tipY;
        if (n < points.length - 1 && frac > 0) {
            const t = (n + frac) / (points.length - 1);
            tipX = points[n].x + (points[n + 1].x - points[n].x) * frac + windOffset(t, wPhase);
            tipY = points[n].y + (points[n + 1].y - points[n].y) * frac;
            ctx.lineTo(tipX, tipY);
        } else {
            const idx = Math.min(n, points.length - 1);
            const t = idx / (points.length - 1);
            tipX = points[idx].x + windOffset(t, wPhase);
            tipY = points[idx].y;
        }

        ctx.stroke();
        return { x: tipX, y: tipY };
    }

    // Get position along stem at progress t (with wind)
    function getStemPoint(points, t, wPhase) {
        const idx = t * (points.length - 1);
        const i = Math.floor(idx);
        const frac = idx - i;
        if (i >= points.length - 1) {
            return {
                x: points[points.length - 1].x + windOffset(1, wPhase),
                y: points[points.length - 1].y,
            };
        }
        return {
            x: points[i].x + (points[i + 1].x - points[i].x) * frac + windOffset(t, wPhase),
            y: points[i].y + (points[i + 1].y - points[i].y) * frac,
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

    // Draw grass tufts at the base of a plant
    function drawGrass(x, y, blades, color, wPhase) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        for (const b of blades) {
            const wind = Math.sin(time * 0.002 + wPhase + b.phase) * 3 * b.height / 20;
            ctx.beginPath();
            ctx.moveTo(x + b.ox, y);
            ctx.quadraticCurveTo(
                x + b.ox + b.lean * 0.5 + wind,
                y - b.height * 0.6,
                x + b.ox + b.lean + wind,
                y - b.height,
            );
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
    const slots = []; // { side: 'left'|'right', row: number, occupied: false }

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
        // Pick random free slot
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
            // Medium
            height = 140 + Math.random() * 120;
            stemWidth = 1.5 + Math.random() * 1;
            leafSize = 8 + Math.random() * 10;
            flowerSize = 10 + Math.random() * 10;
            leafCount = 2 + Math.floor(Math.random() * 3);
        } else {
            // Large
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
        const leaves = [];
        for (let i = 0; i < leafCount; i++) {
            leaves.push({
                t: 0.15 + Math.random() * 0.65,
                angle: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 1),
                size: leafSize * (0.7 + Math.random() * 0.6),
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

        plants.push({
            stemPoints,
            baseX: x,
            baseY,
            height,
            leaves,
            grassBlades,
            stemWidth,
            windPhase: Math.random() * Math.PI * 2,
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
        });
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

            // Draw grass at base
            drawGrass(p.baseX, p.baseY, p.grassBlades, p.leafColor, p.windPhase);

            // Draw stem - returns the current tip position
            const tip = drawStem(p.stemPoints, p.growth, p.stemColor, p.stemWidth, p.windPhase);

            // Draw leaves once stem reaches them
            for (const leaf of p.leaves) {
                if (p.growth > leaf.t) {
                    const pt = getStemPoint(p.stemPoints, leaf.t, p.windPhase);
                    const leafProgress = Math.min(1, (p.growth - leaf.t) * 3);
                    const eased = leafProgress * leafProgress * (3 - 2 * leafProgress);
                    drawLeaf(pt.x, pt.y, leaf.angle, leaf.size * eased, p.leafColor);
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
            // Re-mark occupied slots
            for (const p of plants) {
                const s = slots.find(s => s.side === p.slotSide && s.row === p.slotRow);
                if (s) s.occupied = true;
            }
        }

        requestAnimationFrame(draw);
    }

    draw();
})();
