/**
 * Irregular Map Generator Test
 *
 * Tests various irregular dungeon shapes before integrating into the game.
 * Run: node test/map-generator-test.js
 */

class IrregularMapGenerator {
    constructor(maxSize = 36) {
        this.maxSize = maxSize;
    }

    /**
     * Generate an irregular-shaped dungeon
     * @param {number} floor - Current floor/depth level
     * @returns {Object} { map, bounds, shape }
     */
    generate(floor = 1) {
        // Scale size with floor
        const baseSize = Math.min(18 + Math.floor(floor / 2) * 3, this.maxSize);

        // Choose random shape type
        const shapes = ['blob', 'L', 'cross', 'donut', 'caves'];
        const shapeType = shapes[Math.floor(Math.random() * shapes.length)];

        // Create base map filled with "void" (-1)
        const map = [];
        for (let z = 0; z < this.maxSize; z++) {
            map[z] = [];
            for (let x = 0; x < this.maxSize; x++) {
                map[z][x] = -1; // -1 = void (outside dungeon)
            }
        }

        // Generate shape mask
        const mask = this.generateShape(shapeType, baseSize);

        // Apply mask to map (1 = wall initially)
        const offsetX = Math.floor((this.maxSize - baseSize) / 2);
        const offsetZ = Math.floor((this.maxSize - baseSize) / 2);

        for (let z = 0; z < baseSize; z++) {
            for (let x = 0; x < baseSize; x++) {
                if (mask[z][x]) {
                    map[z + offsetZ][x + offsetX] = 1; // wall
                }
            }
        }

        // Carve out the dungeon using maze algorithm
        this.carveMaze(map, offsetX, offsetZ, baseSize);

        // Add rooms
        this.addRooms(map, offsetX, offsetZ, baseSize, mask, floor);

        // Calculate actual bounds
        const bounds = this.calculateBounds(map);

        return { map, bounds, shape: shapeType, size: baseSize };
    }

    /**
     * Generate a shape mask
     */
    generateShape(type, size) {
        const mask = [];
        for (let z = 0; z < size; z++) {
            mask[z] = [];
            for (let x = 0; x < size; x++) {
                mask[z][x] = false;
            }
        }

        const cx = Math.floor(size / 2);
        const cz = Math.floor(size / 2);
        const radius = Math.floor(size / 2) - 1;

        switch (type) {
            case 'blob':
                // Organic blob shape using noise-like pattern
                for (let z = 0; z < size; z++) {
                    for (let x = 0; x < size; x++) {
                        const dx = x - cx;
                        const dz = z - cz;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        const angle = Math.atan2(dz, dx);
                        // Wavy radius
                        const wavyRadius = radius * (0.7 + 0.3 * Math.sin(angle * 3 + Math.random() * 0.5));
                        if (dist < wavyRadius) {
                            mask[z][x] = true;
                        }
                    }
                }
                break;

            case 'L':
                // L-shaped dungeon
                const armWidth = Math.floor(size * 0.4);
                for (let z = 0; z < size; z++) {
                    for (let x = 0; x < size; x++) {
                        // Vertical arm (left side)
                        if (x < armWidth) {
                            mask[z][x] = true;
                        }
                        // Horizontal arm (bottom)
                        if (z >= size - armWidth) {
                            mask[z][x] = true;
                        }
                    }
                }
                break;

            case 'cross':
                // Cross/plus shaped dungeon
                const armW = Math.floor(size * 0.35);
                for (let z = 0; z < size; z++) {
                    for (let x = 0; x < size; x++) {
                        const inVertical = x >= cx - armW/2 && x < cx + armW/2;
                        const inHorizontal = z >= cz - armW/2 && z < cz + armW/2;
                        if (inVertical || inHorizontal) {
                            mask[z][x] = true;
                        }
                    }
                }
                break;

            case 'donut':
                // Ring/donut shape
                const outerR = radius;
                const innerR = radius * 0.4;
                for (let z = 0; z < size; z++) {
                    for (let x = 0; x < size; x++) {
                        const dx = x - cx;
                        const dz = z - cz;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist < outerR && dist > innerR) {
                            mask[z][x] = true;
                        }
                    }
                }
                break;

            case 'caves':
                // Cellular automata caves
                // Start with random noise
                for (let z = 1; z < size - 1; z++) {
                    for (let x = 1; x < size - 1; x++) {
                        mask[z][x] = Math.random() < 0.55;
                    }
                }
                // Apply cellular automata rules
                for (let iter = 0; iter < 4; iter++) {
                    const newMask = mask.map(row => [...row]);
                    for (let z = 1; z < size - 1; z++) {
                        for (let x = 1; x < size - 1; x++) {
                            let neighbors = 0;
                            for (let dz = -1; dz <= 1; dz++) {
                                for (let dx = -1; dx <= 1; dx++) {
                                    if (mask[z + dz][x + dx]) neighbors++;
                                }
                            }
                            newMask[z][x] = neighbors >= 5;
                        }
                    }
                    for (let z = 0; z < size; z++) {
                        for (let x = 0; x < size; x++) {
                            mask[z][x] = newMask[z][x];
                        }
                    }
                }
                break;
        }

        // Ensure border is part of mask for wall generation
        this.ensureBorder(mask, size);

        return mask;
    }

    ensureBorder(mask, size) {
        // Add 1-cell border around the shape
        const expanded = mask.map(row => [...row]);
        for (let z = 1; z < size - 1; z++) {
            for (let x = 1; x < size - 1; x++) {
                if (mask[z][x]) {
                    for (let dz = -1; dz <= 1; dz++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            expanded[z + dz][x + dx] = true;
                        }
                    }
                }
            }
        }
        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                mask[z][x] = expanded[z][x];
            }
        }
    }

    /**
     * Carve maze passages within the shape
     */
    carveMaze(map, offsetX, offsetZ, size) {
        // Find a starting point inside the shape
        let startX = -1, startZ = -1;
        for (let z = offsetZ + 2; z < offsetZ + size - 2; z++) {
            for (let x = offsetX + 2; x < offsetX + size - 2; x++) {
                if (map[z][x] === 1) {
                    startX = x;
                    startZ = z;
                    break;
                }
            }
            if (startX !== -1) break;
        }

        if (startX === -1) return;

        // Iterative maze carving with stack
        const stack = [{ x: startX, z: startZ }];
        map[startZ][startX] = 0;

        const directions = [
            { dx: 0, dz: -2 },
            { dx: 0, dz: 2 },
            { dx: -2, dz: 0 },
            { dx: 2, dz: 0 }
        ];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];

            // Shuffle directions
            const shuffled = [...directions].sort(() => Math.random() - 0.5);

            let carved = false;
            for (const dir of shuffled) {
                const nx = current.x + dir.dx;
                const nz = current.z + dir.dz;
                const mx = current.x + dir.dx / 2;
                const mz = current.z + dir.dz / 2;

                if (nx > 0 && nx < this.maxSize - 1 &&
                    nz > 0 && nz < this.maxSize - 1 &&
                    map[nz][nx] === 1 && map[mz][mx] === 1) {

                    map[mz][mx] = 0;
                    map[nz][nx] = 0;
                    stack.push({ x: nx, z: nz });
                    carved = true;
                    break;
                }
            }

            if (!carved) {
                stack.pop();
            }
        }
    }

    /**
     * Add rooms to the dungeon
     */
    addRooms(map, offsetX, offsetZ, size, mask, floor) {
        const roomCount = 3 + Math.floor(floor / 2);
        const minRoomSize = 3;
        const maxRoomSize = 6;

        for (let r = 0; r < roomCount * 3; r++) { // Try more times than needed
            const roomW = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
            const roomH = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));

            const rx = offsetX + 2 + Math.floor(Math.random() * (size - roomW - 4));
            const rz = offsetZ + 2 + Math.floor(Math.random() * (size - roomH - 4));

            // Check if room fits within shape
            let fits = true;
            for (let z = rz - 1; z <= rz + roomH && fits; z++) {
                for (let x = rx - 1; x <= rx + roomW && fits; x++) {
                    if (map[z] === undefined || map[z][x] === -1) {
                        fits = false;
                    }
                }
            }

            if (fits) {
                // Carve room
                for (let z = rz; z < rz + roomH; z++) {
                    for (let x = rx; x < rx + roomW; x++) {
                        map[z][x] = 0;
                    }
                }
            }
        }
    }

    /**
     * Calculate actual bounds of the dungeon
     */
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

    /**
     * Count walkable cells
     */
    countWalkable(map) {
        let count = 0;
        for (let z = 0; z < this.maxSize; z++) {
            for (let x = 0; x < this.maxSize; x++) {
                if (map[z][x] === 0) count++;
            }
        }
        return count;
    }

    /**
     * Print map to console for debugging
     */
    printMap(map) {
        const chars = { '-1': ' ', '0': '.', '1': '#', '2': 'D' };
        for (let z = 0; z < this.maxSize; z++) {
            let row = '';
            for (let x = 0; x < this.maxSize; x++) {
                row += chars[map[z][x].toString()] || '?';
            }
            // Only print rows that have content
            if (row.trim()) {
                console.log(row);
            }
        }
    }
}

// Run tests
console.log('='.repeat(60));
console.log('  Irregular Map Generator Test');
console.log('='.repeat(60));

const generator = new IrregularMapGenerator(36);

const shapes = ['blob', 'L', 'cross', 'donut', 'caves'];

for (const shape of shapes) {
    console.log(`\n--- Testing shape: ${shape.toUpperCase()} ---\n`);

    // Override random shape selection for testing
    const originalGenerate = generator.generate.bind(generator);
    generator.generate = function(floor) {
        const baseSize = Math.min(18 + Math.floor(floor / 2) * 3, this.maxSize);
        const map = [];
        for (let z = 0; z < this.maxSize; z++) {
            map[z] = [];
            for (let x = 0; x < this.maxSize; x++) {
                map[z][x] = -1;
            }
        }
        const mask = this.generateShape(shape, baseSize);
        const offsetX = Math.floor((this.maxSize - baseSize) / 2);
        const offsetZ = Math.floor((this.maxSize - baseSize) / 2);
        for (let z = 0; z < baseSize; z++) {
            for (let x = 0; x < baseSize; x++) {
                if (mask[z][x]) {
                    map[z + offsetZ][x + offsetX] = 1;
                }
            }
        }
        this.carveMaze(map, offsetX, offsetZ, baseSize);
        this.addRooms(map, offsetX, offsetZ, baseSize, mask, floor);
        const bounds = this.calculateBounds(map);
        return { map, bounds, shape, size: baseSize };
    };

    const result = generator.generate(5);
    generator.printMap(result.map);

    console.log(`\nBounds: ${result.bounds.width}x${result.bounds.height}`);
    console.log(`Walkable cells: ${generator.countWalkable(result.map)}`);
}

console.log('\n' + '='.repeat(60));
console.log('  Test Complete');
console.log('='.repeat(60));

module.exports = IrregularMapGenerator;
