/**
 * Irregular Map Generator v2
 *
 * Features:
 * - Multiple shape types (blob, L, cross, donut, caves)
 * - Rooms with wall perimeters and doors
 * - Boundary walls between floor and void
 * - Door validation (walls on perpendicular sides)
 * - Proper enclosure of all walkable areas
 *
 * Map cell values: -1=void, 0=floor, 1=wall, 2=door
 */

class IrregularMapGeneratorV2 {
    constructor(maxSize = 36) {
        this.maxSize = maxSize;
    }

    generate(depth = 1, forceShape = null) {
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const result = this.tryGenerate(depth, forceShape);
            if (result) return result;
        }
        // Fallback: return last attempt anyway
        return this.tryGenerate(depth, forceShape, true);
    }

    tryGenerate(depth, forceShape, force = false) {
        const baseSize = Math.min(22 + depth * 2, this.maxSize);
        const shapes = ['blob', 'L', 'cross', 'donut', 'caves'];
        const shapeType = forceShape || shapes[Math.floor(Math.random() * shapes.length)];

        // Initialize with void
        const map = Array.from({ length: this.maxSize }, () =>
            Array(this.maxSize).fill(-1)
        );

        // Generate shape mask
        const mask = this.generateShape(shapeType, baseSize);
        const offset = Math.floor((this.maxSize - baseSize) / 2);

        // Fill mask area with FLOOR
        for (let z = 0; z < baseSize; z++) {
            for (let x = 0; x < baseSize; x++) {
                if (mask[z][x]) {
                    map[z + offset][x + offset] = 0; // floor
                }
            }
        }

        // Add boundary walls between floor and void
        this.addBoundaryWalls(map);

        // Generate rooms (build walls on floor)
        const rooms = this.generateRooms(map, offset, baseSize, mask, depth);

        // Connect rooms (various patterns)
        this.connectRooms(map, rooms);

        // Add some pillars/obstacles in open spaces
        this.addObstacles(map, rooms);

        // Final pass: ensure all floor/door cells are enclosed
        this.ensureEnclosure(map);

        // Validate and fix doors
        this.validateDoors(map);

        // Check connectivity - reject if isolated areas exist
        if (!force && !this.isFullyConnected(map)) {
            return null; // Retry
        }

        const bounds = this.calculateBounds(map);
        const walkable = this.countWalkable(map);

        return { map, bounds, shape: shapeType, size: baseSize, walkable, rooms };
    }

    generateShape(type, size) {
        const mask = Array.from({ length: size }, () => Array(size).fill(false));
        const cx = size / 2, cz = size / 2;
        const r = size / 2 - 2;

        switch (type) {
            case 'blob': {
                const seed = Math.random() * 100;
                for (let z = 0; z < size; z++) {
                    for (let x = 0; x < size; x++) {
                        const dx = x - cx, dz = z - cz;
                        const dist = Math.sqrt(dx*dx + dz*dz);
                        const angle = Math.atan2(dz, dx);
                        const wavy = r * (0.7 + 0.3 * Math.sin(angle*3 + seed) * Math.cos(angle*2 + seed*0.7));
                        if (dist < wavy) mask[z][x] = true;
                    }
                }
                break;
            }
            case 'L': {
                const arm = Math.floor(size * 0.5);
                const rot = Math.floor(Math.random() * 4);
                for (let z = 0; z < size; z++) {
                    for (let x = 0; x < size; x++) {
                        let inShape = false;
                        if (rot === 0) inShape = x < arm || z >= size - arm;
                        else if (rot === 1) inShape = x >= size - arm || z >= size - arm;
                        else if (rot === 2) inShape = x >= size - arm || z < arm;
                        else inShape = x < arm || z < arm;
                        if (inShape) mask[z][x] = true;
                    }
                }
                break;
            }
            case 'cross': {
                const arm = Math.floor(size * 0.35);
                for (let z = 0; z < size; z++) {
                    for (let x = 0; x < size; x++) {
                        const inV = x >= cx - arm/2 && x < cx + arm/2;
                        const inH = z >= cz - arm/2 && z < cz + arm/2;
                        if (inV || inH) mask[z][x] = true;
                    }
                }
                break;
            }
            case 'donut': {
                const outer = r + 2, inner = r * 0.3;
                for (let z = 0; z < size; z++) {
                    for (let x = 0; x < size; x++) {
                        const d = Math.sqrt((x-cx)**2 + (z-cz)**2);
                        if (d < outer && d > inner) mask[z][x] = true;
                    }
                }
                break;
            }
            case 'caves': {
                for (let z = 1; z < size-1; z++) {
                    for (let x = 1; x < size-1; x++) {
                        const d = Math.sqrt((x-cx)**2 + (z-cz)**2);
                        if (d < r + 2) mask[z][x] = Math.random() < 0.55;
                    }
                }
                for (let i = 0; i < 5; i++) {
                    const next = mask.map(row => [...row]);
                    for (let z = 1; z < size-1; z++) {
                        for (let x = 1; x < size-1; x++) {
                            let n = 0;
                            for (let dz = -1; dz <= 1; dz++)
                                for (let dx = -1; dx <= 1; dx++)
                                    if (mask[z+dz]?.[x+dx]) n++;
                            next[z][x] = n >= 5;
                        }
                    }
                    for (let z = 0; z < size; z++)
                        for (let x = 0; x < size; x++)
                            mask[z][x] = next[z][x];
                }
                break;
            }
        }
        return mask;
    }

    // Add walls at the boundary between floor and void
    addBoundaryWalls(map) {
        const changes = [];

        for (let z = 0; z < this.maxSize; z++) {
            for (let x = 0; x < this.maxSize; x++) {
                if (map[z][x] === 0) {
                    // Check 4 cardinal directions for void
                    const dirs = [[0,-1], [0,1], [-1,0], [1,0]];
                    for (const [dz, dx] of dirs) {
                        const nz = z + dz, nx = x + dx;
                        if (map[nz]?.[nx] === -1) {
                            changes.push({ z, x });
                            break;
                        }
                    }
                }
            }
        }

        // Convert boundary floor cells to walls
        for (const c of changes) {
            map[c.z][c.x] = 1;
        }
    }

    generateRooms(map, offset, baseSize, mask, depth) {
        const rooms = [];
        const roomCount = 3 + Math.floor(depth / 2);

        for (let attempt = 0; attempt < roomCount * 50 && rooms.length < roomCount; attempt++) {
            const room = this.tryPlaceRoom(map, offset, baseSize, mask, rooms);
            if (room) rooms.push(room);
        }

        return rooms;
    }

    tryPlaceRoom(map, offset, baseSize, mask, existingRooms) {
        const outerW = 5 + Math.floor(Math.random() * 4);
        const outerH = 5 + Math.floor(Math.random() * 4);

        const rx = offset + 1 + Math.floor(Math.random() * (baseSize - outerW - 2));
        const rz = offset + 1 + Math.floor(Math.random() * (baseSize - outerH - 2));

        // Check if fits (all cells must be floor, not wall or void)
        for (let z = rz; z < rz + outerH; z++) {
            for (let x = rx; x < rx + outerW; x++) {
                if (map[z]?.[x] !== 0) return null;
            }
        }

        // Check overlap with existing rooms
        for (const room of existingRooms) {
            const r1 = { x: rx + 1, z: rz + 1, w: outerW - 2, h: outerH - 2 };
            const r2 = room.interior;

            if (r1.x < r2.x + r2.w + 2 && r1.x + r1.w + 2 > r2.x &&
                r1.z < r2.z + r2.h + 2 && r1.z + r1.h + 2 > r2.z) {
                return null;
            }
        }

        const room = {
            outer: { x: rx, z: rz, w: outerW, h: outerH },
            interior: { x: rx + 1, z: rz + 1, w: outerW - 2, h: outerH - 2 },
            doors: []
        };

        // Place walls around perimeter
        for (let x = rx; x < rx + outerW; x++) {
            map[rz][x] = 1;
            map[rz + outerH - 1][x] = 1;
        }
        for (let z = rz; z < rz + outerH; z++) {
            map[z][rx] = 1;
            map[z][rx + outerW - 1] = 1;
        }

        // Add 1-2 doors
        const doorCount = 1 + Math.floor(Math.random() * 2);
        const edges = ['top', 'bottom', 'left', 'right'].sort(() => Math.random() - 0.5);

        for (let i = 0; i < doorCount && i < edges.length; i++) {
            const door = this.placeDoor(map, room, edges[i]);
            if (door) room.doors.push(door);
        }

        return room;
    }

    placeDoor(map, room, edge) {
        const { outer } = room;
        let x, z;
        let wallCheck1, wallCheck2;

        switch (edge) {
            case 'top':
                x = outer.x + 2 + Math.floor(Math.random() * Math.max(1, outer.w - 4));
                z = outer.z;
                wallCheck1 = { x: x - 1, z };
                wallCheck2 = { x: x + 1, z };
                break;
            case 'bottom':
                x = outer.x + 2 + Math.floor(Math.random() * Math.max(1, outer.w - 4));
                z = outer.z + outer.h - 1;
                wallCheck1 = { x: x - 1, z };
                wallCheck2 = { x: x + 1, z };
                break;
            case 'left':
                x = outer.x;
                z = outer.z + 2 + Math.floor(Math.random() * Math.max(1, outer.h - 4));
                wallCheck1 = { x, z: z - 1 };
                wallCheck2 = { x, z: z + 1 };
                break;
            case 'right':
                x = outer.x + outer.w - 1;
                z = outer.z + 2 + Math.floor(Math.random() * Math.max(1, outer.h - 4));
                wallCheck1 = { x, z: z - 1 };
                wallCheck2 = { x, z: z + 1 };
                break;
        }

        // Check that walls exist on both sides
        if (map[wallCheck1.z]?.[wallCheck1.x] !== 1 ||
            map[wallCheck2.z]?.[wallCheck2.x] !== 1) {
            return null;
        }

        // Check outside is accessible (floor)
        const outside = this.getOutsideCell(edge, x, z);
        if (map[outside.z]?.[outside.x] !== 0) {
            return null;
        }

        map[z][x] = 2;
        return { x, z, edge };
    }

    getOutsideCell(edge, x, z) {
        switch (edge) {
            case 'top': return { x, z: z - 1 };
            case 'bottom': return { x, z: z + 1 };
            case 'left': return { x: x - 1, z };
            case 'right': return { x: x + 1, z };
        }
    }

    connectRooms(map, rooms) {
        if (rooms.length < 2) return;

        const style = Math.random();

        if (style < 0.5) {
            this.connectWithCorridors(map, rooms);
        }
        // else: open space style - rooms connected by open floor
    }

    connectWithCorridors(map, rooms) {
        for (let i = 0; i < rooms.length - 1; i++) {
            const roomA = rooms[i];
            const roomB = rooms[i + 1];

            const doorA = roomA.doors[0];
            const doorB = roomB.doors[0];

            if (!doorA || !doorB) continue;

            this.carveCorridor(map, doorA, doorB);
        }
    }

    carveCorridor(map, doorA, doorB) {
        // Corridor carving is optional since rooms may already be
        // connected through open floor space
    }

    addObstacles(map, rooms) {
        const pillarCount = Math.floor(Math.random() * 3);

        for (let attempt = 0; attempt < pillarCount * 20; attempt++) {
            const x = 2 + Math.floor(Math.random() * (this.maxSize - 4));
            const z = 2 + Math.floor(Math.random() * (this.maxSize - 4));

            if (map[z][x] !== 0) continue;

            let inRoom = false;
            for (const room of rooms) {
                const { interior } = room;
                if (x >= interior.x && x < interior.x + interior.w &&
                    z >= interior.z && z < interior.z + interior.h) {
                    inRoom = true;
                    break;
                }
            }
            if (inRoom) continue;

            // Not near door
            let nearDoor = false;
            for (let dz = -1; dz <= 1 && !nearDoor; dz++) {
                for (let dx = -1; dx <= 1 && !nearDoor; dx++) {
                    if (map[z + dz]?.[x + dx] === 2) nearDoor = true;
                }
            }
            if (nearDoor) continue;

            map[z][x] = 1;
        }
    }

    ensureEnclosure(map) {
        // Ensure no floor/door is adjacent to void - add wall if needed
        let changed = true;
        while (changed) {
            changed = false;
            for (let z = 0; z < this.maxSize; z++) {
                for (let x = 0; x < this.maxSize; x++) {
                    if (map[z][x] === 0 || map[z][x] === 2) {
                        // Edge cells become walls
                        if (z === 0 || z === this.maxSize - 1 || x === 0 || x === this.maxSize - 1) {
                            map[z][x] = 1;
                            changed = true;
                            continue;
                        }
                        for (let dz = -1; dz <= 1; dz++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dz === 0 && dx === 0) continue;
                                const nz = z + dz, nx = x + dx;
                                if (nz < 0 || nz >= this.maxSize || nx < 0 || nx >= this.maxSize) {
                                    map[z][x] = 1;
                                    changed = true;
                                } else if (map[nz][nx] === -1) {
                                    map[nz][nx] = 1;
                                    changed = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    validateDoors(map) {
        // Check all doors have walls on perpendicular sides
        for (let z = 1; z < this.maxSize - 1; z++) {
            for (let x = 1; x < this.maxSize - 1; x++) {
                if (map[z][x] === 2) {
                    const up = map[z-1]?.[x];
                    const down = map[z+1]?.[x];
                    const left = map[z]?.[x-1];
                    const right = map[z]?.[x+1];

                    // Valid: walls on opposite sides
                    const verticalWalls = (left === 1 && right === 1);
                    const horizontalWalls = (up === 1 && down === 1);

                    if (!verticalWalls && !horizontalWalls) {
                        // Invalid door, convert to wall
                        map[z][x] = 1;
                    }
                }
            }
        }
    }

    isFullyConnected(map) {
        // Find all walkable cells
        const walkable = [];
        for (let z = 0; z < this.maxSize; z++) {
            for (let x = 0; x < this.maxSize; x++) {
                if (map[z][x] === 0 || map[z][x] === 2) {
                    walkable.push({ x, z });
                }
            }
        }
        if (walkable.length === 0) return false;

        // Flood fill from first walkable cell
        const visited = new Set();
        const queue = [walkable[0]];
        visited.add(`${walkable[0].x},${walkable[0].z}`);

        while (queue.length > 0) {
            const { x, z } = queue.shift();
            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (const [dx, dz] of dirs) {
                const nx = x + dx, nz = z + dz;
                const key = `${nx},${nz}`;
                if (!visited.has(key) && map[nz]?.[nx] !== undefined) {
                    const cell = map[nz][nx];
                    if (cell === 0 || cell === 2) {
                        visited.add(key);
                        queue.push({ x: nx, z: nz });
                    }
                }
            }
        }

        // Check if all walkable cells were visited
        return visited.size === walkable.length;
    }

    calculateBounds(map) {
        let minX = this.maxSize, maxX = 0;
        let minZ = this.maxSize, maxZ = 0;

        for (let z = 0; z < this.maxSize; z++) {
            for (let x = 0; x < this.maxSize; x++) {
                if (map[z][x] !== -1) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minZ = Math.min(minZ, z);
                    maxZ = Math.max(maxZ, z);
                }
            }
        }

        return { minX, maxX, minZ, maxZ, width: maxX - minX + 1, height: maxZ - minZ + 1 };
    }

    countWalkable(map) {
        let count = 0;
        for (let z = 0; z < this.maxSize; z++) {
            for (let x = 0; x < this.maxSize; x++) {
                if (map[z][x] === 0 || map[z][x] === 2) count++;
            }
        }
        return count;
    }
}

// Export for Node.js
if (typeof module !== 'undefined') {
    module.exports = IrregularMapGeneratorV2;
}
