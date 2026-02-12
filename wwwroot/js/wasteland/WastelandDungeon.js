var WastelandDungeon = {
    isActive: false,
    rooms: [],
    meshes: [],
    exitPoint: null,

    init: function (scene) {
        this.scene = scene;
    },

    generate: async function (seed) {
        this.clear();
        console.log("Generating Dungeon with seed: " + seed);

        // Internal Light
        var light = new BABYLON.PointLight("dungeonLight", new BABYLON.Vector3(0, 15, 0), this.scene);
        light.intensity = 0.5;
        this.meshes.push(light);

        // Create a 3x3 grid of rooms connected by corridors
        for (var x = 0; x < 3; x++) {
            for (var z = 0; z < 3; z++) {
                var rx = x * 40;
                var rz = z * 40;

                // Determine exits for this room
                var exits = {
                    n: z < 2,
                    s: z > 0,
                    e: x < 2,
                    w: x > 0
                };
                this.createRoom(rx, rz, 25, 25, exits);

                // Create corridors to the right and down
                if (x < 2) this.createCorridor(rx + 12.5, rz, rx + 27.5, rz);
                if (z < 2) this.createCorridor(rx, rz + 12.5, rx, rz + 27.5);

                // Spawn 1-2 bandits per room (except start)
                if (x !== 0 || z !== 0) {
                    var count = 1 + Math.floor(Math.random() * 2);
                    for (var i = 0; i < count; i++) {
                        var ex = rx + (Math.random() - 0.5) * 15;
                        var ez = rz + (Math.random() - 0.5) * 15;
                        WastelandNPCs.createSurvivor(this.scene, ex, ez, true); // true = bandit
                    }

                    // Spawn 1-2 scrap piles
                    var scrapCount = 1 + Math.floor(Math.random() * 2);
                    for (var i = 0; i < scrapCount; i++) {
                        var sx = rx + (Math.random() - 0.5) * 10;
                        var sz = rz + (Math.random() - 0.5) * 10;
                        var scrap = BABYLON.MeshBuilder.CreateBox("dungeon_scrap", { size: 1.5 }, this.scene);
                        scrap.position.set(sx, 0.75, sz);
                        var scrapMat = new BABYLON.StandardMaterial("dScrapMat", this.scene);
                        scrapMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.2);
                        scrap.material = scrapMat;
                        scrap.setEnabled(false);
                        scrap.data = { type: "SCRAP", amount: 25 };
                        this.meshes.push(scrap);
                    }
                }
            }
        }

        // Add an exit in the first room
        this.createExit(0, 0);
    },

    createRoom: function (x, z, w, d, exits) {
        // exits: { n: bool, s: bool, e: bool, w: bool }
        var floorMat = new BABYLON.StandardMaterial("floorMat", this.scene);
        floorMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);

        var floor = BABYLON.MeshBuilder.CreateGround("room_floor", { width: w, height: d }, this.scene);
        floor.position = new BABYLON.Vector3(x, 0.1, z);
        floor.material = floorMat;
        floor.setEnabled(false);
        this.meshes.push(floor);

        // Walls
        var wallMat = new BABYLON.StandardMaterial("wallMat", this.scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);

        var createWall = (wx, wz, ww, wd, isHorizontal, hasExit) => {
            if (hasExit) {
                // Split wall into two pieces with a gap in the middle
                var segmentSize = (isHorizontal ? ww : wd) / 2 - 2; // 4 unit gap
                if (isHorizontal) {
                    var w1 = BABYLON.MeshBuilder.CreateBox("wall", { width: segmentSize, height: 10, depth: wd }, this.scene);
                    w1.position.set(wx - ww / 2 + segmentSize / 2, 5, wz);
                    var w2 = BABYLON.MeshBuilder.CreateBox("wall", { width: segmentSize, height: 10, depth: wd }, this.scene);
                    w2.position.set(wx + ww / 2 - segmentSize / 2, 5, wz);
                    [w1, w2].forEach(m => { m.material = wallMat; m.setEnabled(false); m.checkCollisions = true; this.meshes.push(m); });
                } else {
                    var d1 = BABYLON.MeshBuilder.CreateBox("wall", { width: ww, height: 10, depth: segmentSize }, this.scene);
                    d1.position.set(wx, 5, wz - wd / 2 + segmentSize / 2);
                    var d2 = BABYLON.MeshBuilder.CreateBox("wall", { width: ww, height: 10, depth: segmentSize }, this.scene);
                    d2.position.set(wx, 5, wz + wd / 2 - segmentSize / 2);
                    [d1, d2].forEach(m => { m.material = wallMat; m.setEnabled(false); m.checkCollisions = true; this.meshes.push(m); });
                }
            } else {
                var wall = BABYLON.MeshBuilder.CreateBox("wall", { width: ww, height: 10, depth: wd }, this.scene);
                wall.position = new BABYLON.Vector3(wx, 5, wz);
                wall.material = wallMat;
                wall.setEnabled(false);
                wall.checkCollisions = true;
                this.meshes.push(wall);
            }
        };

        exits = exits || {};
        createWall(x, z + d / 2, w, 1, true, exits.n); // North
        createWall(x, z - d / 2, w, 1, true, exits.s); // South
        createWall(x + w / 2, z, 1, d, false, exits.e); // East
        createWall(x - w / 2, z, 1, d, false, exits.w); // West
    },

    createCorridor: function (x1, z1, x2, z2) {
        var dist = BABYLON.Vector3.Distance(new BABYLON.Vector3(x1, 0, z1), new BABYLON.Vector3(x2, 0, z2));
        var cx = (x1 + x2) / 2;
        var cz = (z1 + z2) / 2;
        var horizontal = Math.abs(x1 - x2) > Math.abs(z1 - z2);

        var floor = BABYLON.MeshBuilder.CreateBox("corridor_floor", { width: horizontal ? dist : 4, height: 0.1, depth: horizontal ? 4 : dist }, this.scene);
        floor.position.set(cx, 0.1, cz);
        var floorMat = new BABYLON.StandardMaterial("cFloorMat", this.scene);
        floorMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        floor.material = floorMat;
        floor.setEnabled(false);
        this.meshes.push(floor);

        // Side Walls
        var wallMat = new BABYLON.StandardMaterial("cWallMat", this.scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);

        var w1, w2;
        if (horizontal) {
            w1 = BABYLON.MeshBuilder.CreateBox("wall", { width: dist, height: 10, depth: 1 }, this.scene);
            w1.position.set(cx, 5, cz + 2);
            w2 = BABYLON.MeshBuilder.CreateBox("wall", { width: dist, height: 10, depth: 1 }, this.scene);
            w2.position.set(cx, 5, cz - 2);
        } else {
            w1 = BABYLON.MeshBuilder.CreateBox("wall", { width: 1, height: 10, depth: dist }, this.scene);
            w1.position.set(cx + 2, 5, cz);
            w2 = BABYLON.MeshBuilder.CreateBox("wall", { width: 1, height: 10, depth: dist }, this.scene);
            w2.position.set(cx - 2, 5, cz);
        }
        [w1, w2].forEach(m => { m.material = wallMat; m.setEnabled(false); m.checkCollisions = true; this.meshes.push(m); });
    },

    createExit: function (x, z) {
        var exit = BABYLON.MeshBuilder.CreateCylinder("dungeon_exit", { diameter: 6, height: 0.1 }, this.scene);
        exit.position = new BABYLON.Vector3(x, 0.2, z);
        var mat = new BABYLON.StandardMaterial("exitMat", this.scene);
        mat.emissiveColor = new BABYLON.Color3(0.2, 0.8, 1.0);
        mat.alpha = 0.5;
        exit.material = mat;
        exit.data = { type: "DUNGEON_EXIT" };
        exit.setEnabled(false);
        this.meshes.push(exit);
        this.exitPoint = exit;
    },

    enter: async function (core) {
        this.isActive = true;
        this.meshes.forEach(m => {
            if (m.setEnabled) m.setEnabled(true);
        });

        // Hide wasteland elements
        if (WastelandWorld.ground) WastelandWorld.ground.setEnabled(false);
        WastelandWorld.ruins.forEach(r => r.setEnabled(false));
        WastelandNPCs.snakes.forEach(s => s.segments.forEach(seg => seg.setEnabled(false)));
        WastelandNPCs.coyotes.forEach(c => c.root.setEnabled(false));
        WastelandNPCs.shopkeepers.forEach(s => s.setEnabled(false));

        // Disable car
        core.vehicle.setEnabled(false);

        // Spawn/Place Hero
        await WastelandHero.spawn(this.scene, 0, 0);
        WastelandHero.isActive = true;
        WastelandHero.mesh.setEnabled(true);
        WastelandHero.mesh.position.set(0, 2, 0);

        core.isDriving = false;
        core.camera.lockedTarget = WastelandHero.mesh;
        core.camera.radius = 15;

        console.log("ENTERED DUNGEON");
    },

    exit: function (core) {
        this.isActive = true; // Still active for a moment during switch
        this.meshes.forEach(m => {
            if (m.setEnabled) m.setEnabled(false);
        });

        // Restore wasteland
        if (WastelandWorld.ground) WastelandWorld.ground.setEnabled(true);
        WastelandWorld.ruins.forEach(r => r.setEnabled(true));
        WastelandNPCs.snakes.forEach(s => s.segments.forEach(seg => seg.setEnabled(true)));
        WastelandNPCs.coyotes.forEach(c => c.root.setEnabled(true));
        WastelandNPCs.shopkeepers.forEach(s => s.setEnabled(true));

        // Restore vehicle state
        core.vehicle.setEnabled(true);
        core.camera.lockedTarget = core.vehicle;
        core.camera.radius = 30;
        core.isDriving = true;

        // Hide hero
        if (WastelandHero.mesh) WastelandHero.mesh.setEnabled(false);
        WastelandHero.isActive = false;

        this.isActive = false;
        console.log("EXITED DUNGEON");
    },

    clear: function () {
        this.meshes.forEach(m => m.dispose());
        this.meshes = [];
    }
};
