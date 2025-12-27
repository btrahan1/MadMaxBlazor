var WastelandWorld = {
    ground: null,
    ruins: [],
    scrapFields: [],
    gasStations: [],
    abandonedCars: [],
    survivorCamps: [],
    banditCamps: [],
    scene: null, // Keep ref

    init: function (scene) {
        this.scene = scene;
        this.createTerrain(scene);
        this.createVegetation(scene, 100);
        this.createRuins(scene, 8);
        this.createScrapFields(scene, 15);
        this.createGasStations(scene, 3);
        this.createAbandonedCars(scene, 10);
        this.createSurvivorCamps(scene, 3);
        this.createBanditCamps(scene, 3);
    },

    createTerrain: function (scene) {
        // Large Ground
        var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 2000, height: 2000, subdivisions: 300, updatable: true }, scene);

        // Simple Material with Texture
        var mat = new BABYLON.StandardMaterial("sand", scene);
        mat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/sand.jpg", scene);
        mat.diffuseTexture.uScale = 50;
        mat.diffuseTexture.vScale = 50;
        mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        ground.material = mat;

        // Deform vertices for "Dunes"
        var positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        for (var i = 0; i < positions.length; i += 3) {
            var x = positions[i];
            var z = positions[i + 2];
            var y = this.calculateHeight(x, z);
            positions[i + 1] = y;
        }
        ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

        // Recompute Normals
        var indices = ground.getIndices();
        var normals = ground.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);

        ground.computeWorldMatrix(true);
        ground.refreshBoundingInfo();

        this.ground = ground;
    },

    calculateHeight: function (x, z) {
        // Sine waves for dunes
        var y = Math.sin(x * 0.02) * 5 + Math.cos(z * 0.02) * 5;
        y += Math.sin(x * 0.1) * 1 + Math.cos(z * 0.1) * 1;
        return y;
    },

    getHeightAt: function (x, z) {
        if (!this.ground) return this.calculateHeight(x, z); // Fallback

        // Raycast
        var ray = new BABYLON.Ray(new BABYLON.Vector3(x, 50, z), new BABYLON.Vector3(0, -1, 0), 100);
        var hit = this.scene.pickWithRay(ray, (mesh) => mesh === this.ground);

        if (hit && hit.hit) {
            return hit.pickedPoint.y;
        }
        return this.calculateHeight(x, z);
    },

    createVegetation: function (scene, count) {
        var mat = new BABYLON.StandardMaterial("cactusMat", scene);
        mat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/grass.png", scene);
        mat.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.2);
        mat.diffuseTexture.uScale = 1;
        mat.diffuseTexture.vScale = 5;

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1000) - 500;
            var z = (Math.random() * 1000) - 500;
            var y = this.getHeightAt(x, z);

            var h = 4 + Math.random() * 4;
            var cactus = BABYLON.MeshBuilder.CreateCylinder("cactus" + i, { diameter: 0.8, height: h }, scene);
            cactus.position = new BABYLON.Vector3(x, y + (h / 2), z);
            cactus.material = mat;

            var cap = BABYLON.MeshBuilder.CreateSphere("cap" + i, { diameter: 0.8 }, scene);
            cap.position.y = h / 2;
            cap.parent = cactus;
            cap.material = mat;

            var armCount = Math.floor(Math.random() * 4);
            for (var j = 0; j < armCount; j++) {
                var armLen = 1.0 + Math.random() * 1.5;
                var pivot = new BABYLON.TransformNode("piv" + i + "_" + j, scene);
                pivot.parent = cactus;
                pivot.position.y = (Math.random() * (h * 0.4));
                pivot.rotation.y = Math.random() * Math.PI * 2;

                var conn = BABYLON.MeshBuilder.CreateCylinder("conn", { diameter: 0.6, height: 1.2 }, scene);
                conn.parent = pivot;
                conn.rotation.z = Math.PI / 2;
                conn.position.x = 0.6;
                conn.material = mat;

                var riser = BABYLON.MeshBuilder.CreateCylinder("riser", { diameter: 0.6, height: armLen }, scene);
                riser.parent = pivot;
                riser.position.x = 1.2;
                riser.position.y = armLen / 2;
                riser.material = mat;

                var rCap = BABYLON.MeshBuilder.CreateSphere("rcap", { diameter: 0.6 }, scene);
                rCap.parent = riser;
                rCap.position.y = armLen / 2;
                rCap.material = mat;
            }
        }
    },

    createRuins: function (scene, count) {
        this.ruins = [];
        var concreteMat = new BABYLON.StandardMaterial("concMat", scene);
        concreteMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45);
        var windowMat = new BABYLON.StandardMaterial("winMat", scene);
        windowMat.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.5);
        windowMat.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.2);
        var scrapMat = new BABYLON.StandardMaterial("scrapRuinMat", scene);
        scrapMat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/metal.png", scene);
        scrapMat.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1);
        var vaultMat = new BABYLON.StandardMaterial("vaultMat", scene);
        vaultMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.2);

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1800) - 900;
            var z = (Math.random() * 1800) - 900;
            var y = this.getHeightAt(x, z);
            var choice = Math.floor(Math.random() * 3);
            var ruin;

            if (choice === 0) {
                var building = BABYLON.MeshBuilder.CreateBox("sky" + i, { width: 15, height: 40, depth: 15 }, scene);
                var windows = BABYLON.MeshBuilder.CreateBox("win" + i, { width: 15.2, height: 20, depth: 15.2 }, scene);
                windows.material = windowMat;
                windows.position.y = 5;
                windows.parent = building;
                ruin = BABYLON.Mesh.MergeMeshes([building, windows], true, true, undefined, false, true);
                ruin.material = concreteMat;
                ruin.rotation.z = Math.PI / 6;
                ruin.rotation.y = Math.random() * Math.PI;
                ruin.position = new BABYLON.Vector3(x, y + 10, z);
            } else if (choice === 1) {
                var base = BABYLON.MeshBuilder.CreateCylinder("base" + i, { diameter: 8, height: 10 }, scene);
                var top = BABYLON.MeshBuilder.CreateBox("top" + i, { width: 10, height: 4, depth: 10 }, scene);
                top.position.y = 6;
                top.parent = base;
                var s1 = BABYLON.MeshBuilder.CreateCylinder("s1" + i, { diameterTop: 0, diameterBottom: 0.5, height: 3 }, scene);
                s1.position = new BABYLON.Vector3(4, 8, 4); s1.parent = base;
                var s2 = s1.clone(); s2.position = new BABYLON.Vector3(-4, 8, -4); s2.parent = base;
                var s3 = s1.clone(); s3.position = new BABYLON.Vector3(4, 8, -4); s3.parent = base;
                var s4 = s1.clone(); s4.position = new BABYLON.Vector3(-4, 8, 4); s4.parent = base;
                ruin = BABYLON.Mesh.MergeMeshes([base, top, s1, s2, s3, s4], true, true, undefined, false, true);
                ruin.material = scrapMat;
                ruin.position = new BABYLON.Vector3(x, y + 5, z);
            } else {
                var rock = BABYLON.MeshBuilder.CreateSphere("rock" + i, { diameter: 25, slice: 0.5 }, scene);
                rock.scaling.y = 0.6;
                var door = BABYLON.MeshBuilder.CreateCylinder("door" + i, { diameter: 12, height: 2, tessellation: 12 }, scene);
                door.rotation.x = Math.PI / 2;
                door.position.z = -8;
                door.position.y = 0;
                door.parent = rock;
                door.material = vaultMat;
                ruin = BABYLON.Mesh.MergeMeshes([rock, door], true, true, undefined, false, true);
                ruin.material = concreteMat;
                ruin.position = new BABYLON.Vector3(x, y, z);
            }

            WastelandUI.registerBlip(ruin, null, "ruin"); // Register UI
            this.ruins.push(ruin);
        }
    },

    createScrapFields: function (scene, count) {
        this.scrapFields = [];
        var mat = new BABYLON.StandardMaterial("scrapMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.2);

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1000) - 500;
            var z = (Math.random() * 1000) - 500;
            var y = this.getHeightAt(x, z);

            var scrap = BABYLON.MeshBuilder.CreateBox("scrap" + i, { size: 2 }, scene);
            scrap.position = new BABYLON.Vector3(x, y + 1.0, z);
            scrap.material = mat;
            scrap.rotation.y = Math.random() * Math.PI;

            WastelandUI.registerBlip(scrap, "Yellow", "scrap");
            this.scrapFields.push(scrap);
        }
    },

    createGasStations: function (scene, count) {
        this.gasStations = [];
        var mat = new BABYLON.StandardMaterial("gasMat", scene);
        mat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/metal.png", scene);
        mat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.4);
        mat.diffuseTexture.uScale = 2;
        mat.diffuseTexture.vScale = 2;
        var pumpMat = new BABYLON.StandardMaterial("pumpMat", scene);
        pumpMat.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2);

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 800) - 400;
            var z = (Math.random() * 800) - 400;
            var y = this.getHeightAt(x, z);

            var canopy = BABYLON.MeshBuilder.CreateBox("canopy" + i, { width: 14, height: 0.5, depth: 10 }, scene);
            canopy.position.y = 6.0;

            var p1 = BABYLON.MeshBuilder.CreateCylinder("p1", { diameter: 0.4, height: 6 }, scene); p1.position = new BABYLON.Vector3(6, 3, 4);
            var p2 = BABYLON.MeshBuilder.CreateCylinder("p2", { diameter: 0.4, height: 6 }, scene); p2.position = new BABYLON.Vector3(-6, 3, 4);
            var p3 = BABYLON.MeshBuilder.CreateCylinder("p3", { diameter: 0.4, height: 6 }, scene); p3.position = new BABYLON.Vector3(6, 3, -4);
            var p4 = BABYLON.MeshBuilder.CreateCylinder("p4", { diameter: 0.4, height: 6 }, scene); p4.position = new BABYLON.Vector3(-6, 3, -4);

            var island = BABYLON.MeshBuilder.CreateBox("island", { width: 6, height: 0.4, depth: 2 }, scene);
            island.position.y = 0.2;

            var post = BABYLON.MeshBuilder.CreateCylinder("post", { diameter: 0.3, height: 12 }, scene);
            post.position = new BABYLON.Vector3(-8, 6, 0);
            var signBox = BABYLON.MeshBuilder.CreateBox("signBox", { width: 4, height: 2, depth: 0.2 }, scene);
            signBox.parent = post;
            signBox.position.y = 5.5;
            signBox.rotation.y = 0.5;
            signBox.rotation.z = 0.1;

            var structure = BABYLON.Mesh.MergeMeshes([canopy, p1, p2, p3, p4, island, post], true, true, undefined, false, true);
            structure.material = mat;

            var pump1 = BABYLON.MeshBuilder.CreateBox("pump1", { width: 0.8, height: 1.5, depth: 0.8 }, scene);
            pump1.position = new BABYLON.Vector3(1.5, 0.75, 0);
            pump1.parent = structure;
            pump1.material = pumpMat;
            var pump2 = pump1.clone();
            pump2.position.x = -1.5;
            pump2.parent = structure;

            structure.position = new BABYLON.Vector3(x, y, z);
            WastelandUI.registerBlip(structure, "Cyan", "gas");
            this.gasStations.push(structure);
        }
    },

    createAbandonedCars: function (scene, count) {
        this.abandonedCars = [];
        var rustMat = new BABYLON.StandardMaterial("rustMat", scene);
        rustMat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/metal.png", scene);
        rustMat.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.1);
        rustMat.diffuseTexture.uScale = 2;
        rustMat.diffuseTexture.vScale = 2;
        rustMat.roughness = 1.0;

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1600) - 800;
            var z = (Math.random() * 1600) - 800;
            var y = this.getHeightAt(x, z);

            var body = BABYLON.MeshBuilder.CreateBox("body" + i, { width: 2.2, height: 0.8, depth: 4.5 }, scene);
            var roof = BABYLON.MeshBuilder.CreateBox("roof" + i, { width: 2.0, height: 0.7, depth: 2.2 }, scene);
            roof.position.y = 0.75;
            roof.position.z = -0.5;

            var createWheel = (wx, wz) => {
                var w = BABYLON.MeshBuilder.CreateCylinder("w", { diameter: 0.9, height: 0.4 }, scene);
                w.rotation.z = Math.PI / 2;
                w.position = new BABYLON.Vector3(wx, -0.3, wz);
                w.rotation.x = Math.random() * 0.2;
                w.rotation.y = Math.random() * 0.2;
                return w;
            };

            var w1 = createWheel(-1.1, 1.5);
            var w2 = createWheel(1.1, 1.5);
            var w3 = createWheel(-1.1, -1.5);
            var w4 = createWheel(1.1, -1.5);

            var meshes = [body, roof, w1, w2, w3, w4];
            var hulk = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, true);
            hulk.position = new BABYLON.Vector3(x, y + 0.8, z);
            hulk.rotation = new BABYLON.Vector3((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
            hulk.material = rustMat;

            this.abandonedCars.push(hulk);
        }
    },

    createSurvivorCamps: function (scene, count) {
        this.survivorCamps = [];
        var tentMat = new BABYLON.StandardMaterial("tentMat", scene);
        tentMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.85);
        var waterMat = new BABYLON.StandardMaterial("waterMat", scene);
        waterMat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.8);

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1200) - 600;
            var z = (Math.random() * 1200) - 600;
            var y = this.getHeightAt(x, z);

            var campRoot = new BABYLON.TransformNode("camp" + i, scene);
            campRoot.position = new BABYLON.Vector3(x, y, z);

            var createDome = (tx, tz, size) => {
                var dome = BABYLON.MeshBuilder.CreateSphere("dome", { diameter: size, slice: 0.5 }, scene);
                dome.parent = campRoot;
                dome.position = new BABYLON.Vector3(tx, 0, tz);
                dome.scaling.y = 0.8;
                dome.material = tentMat;
            };
            createDome(3, 3, 5);
            createDome(-4, 2, 4);
            createDome(0, -5, 6);

            var tank = BABYLON.MeshBuilder.CreateCylinder("tank", { diameter: 2.5, height: 3 }, scene);
            tank.parent = campRoot;
            tank.position = new BABYLON.Vector3(-5, 1.5, -2);
            tank.material = waterMat;

            var crate = BABYLON.MeshBuilder.CreateBox("crate", { size: 1 }, scene);
            crate.parent = campRoot; crate.position = new BABYLON.Vector3(2, 0.5, 1);
            var c2 = crate.clone(); c2.parent = campRoot; c2.position = new BABYLON.Vector3(2.2, 0.5, 2.1); c2.rotation.y = 0.5;

            var fireBox = BABYLON.MeshBuilder.CreateBox("fire", { size: 0.5 }, scene);
            fireBox.parent = campRoot;
            fireBox.position = new BABYLON.Vector3(2, 0.25, 2);
            var fireMat = new BABYLON.StandardMaterial("fireMat", scene);
            fireMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
            fireBox.material = fireMat;

            WastelandUI.registerBlip(fireBox, "Green", "camp");
            this.survivorCamps.push(campRoot);

            // Spawn Survivors
            for (let j = 0; j < 3; j++) {
                let nx = x + (Math.random() - 0.5) * 10;
                let nz = z + (Math.random() - 0.5) * 10;
                WastelandNPCs.createSurvivor(scene, nx, nz, false);
            }
        }
    },

    createBanditCamps: function (scene, count) {
        this.banditCamps = [];
        var spikeMat = new BABYLON.StandardMaterial("spikeMat", scene);
        spikeMat.diffuseColor = new BABYLON.Color3(0.3, 0.1, 0.1);
        var metalMat = new BABYLON.StandardMaterial("metalMat", scene);
        metalMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1200) - 600;
            var z = (Math.random() * 1200) - 600;
            var y = this.getHeightAt(x, z);

            var campRoot = new BABYLON.TransformNode("bandit" + i, scene);
            campRoot.position = new BABYLON.Vector3(x, y, z);

            for (var j = 0; j < 12; j++) {
                var angle = (j / 12) * Math.PI * 2;
                var sx = Math.sin(angle) * 8;
                var sz = Math.cos(angle) * 8;
                var h = 3 + Math.random() * 3;
                var spike = BABYLON.MeshBuilder.CreateCylinder("spike", { diameterTop: 0, diameterBottom: 0.6, height: h }, scene);
                spike.parent = campRoot;
                spike.position = new BABYLON.Vector3(sx, h / 2, sz);
                spike.rotation.x = (Math.random() - 0.5) * 0.5;
                spike.rotation.z = (Math.random() - 0.5) * 0.5;
                spike.material = spikeMat;
            }

            var towerHeight = 12;
            var tower = BABYLON.MeshBuilder.CreateCylinder("towerBase", { diameter: 3, height: towerHeight, tessellation: 6 }, scene);
            tower.parent = campRoot;
            tower.position = new BABYLON.Vector3(-5, towerHeight / 2, 5);
            tower.material = metalMat;
            var platform = BABYLON.MeshBuilder.CreateCylinder("platform", { diameter: 5, height: 1 }, scene);
            platform.parent = campRoot;
            platform.position = new BABYLON.Vector3(-5, towerHeight, 5);
            platform.material = metalMat;

            var pole = BABYLON.MeshBuilder.CreateCylinder("pole", { diameter: 0.2, height: 6 }, scene);
            pole.parent = campRoot;
            pole.position = new BABYLON.Vector3(4, 3, 4);
            pole.material = metalMat;
            var skull = BABYLON.MeshBuilder.CreateSphere("skull", { diameter: 1.0 }, scene);
            skull.parent = campRoot;
            skull.position = new BABYLON.Vector3(4, 5.8, 4);
            skull.material = new BABYLON.StandardMaterial("skullCol", scene);

            WastelandUI.registerBlip(tower, "Red", "bandit");
            this.banditCamps.push(campRoot);

            // Spawn Bandits
            for (let j = 0; j < 3; j++) {
                let nx = x + (Math.random() - 0.5) * 12;
                let nz = z + (Math.random() - 0.5) * 12;
                WastelandNPCs.createSurvivor(scene, nx, nz, true);
            }
        }
    }
};
