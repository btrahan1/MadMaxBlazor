var wastelandRenderer = {
    canvas: null,
    engine: null,
    scene: null,
    camera: null,
    vehicle: null,
    ground: null,
    ground: null,
    inputMap: {},
    dotNetRef: null,
    fuel: 100,
    scrap: 0,

    init: function (canvasId, dotNetRef) {
        this.dotNetRef = dotNetRef;
        this.canvas = document.getElementById(canvasId);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = this.createScene();

        // Resize
        window.addEventListener("resize", () => {
            this.engine.resize();
        });

        // Input Handling
        this.scene.actionManager = new BABYLON.ActionManager(this.scene);
        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type == "keydown";
        }));
        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type == "keydown";
        }));

        this.engine.runRenderLoop(() => {
            this.update();
            this.scene.render();
        });
    },

    createScene: function () {
        var scene = new BABYLON.Scene(this.engine);
        this.scene = scene; // [FIX] Store immediately so helper functions (getHeightAt) can accessing it during creation

        // Atmosphere: Mad Max Orange
        scene.clearColor = new BABYLON.Color3(0.8, 0.5, 0.2);
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        scene.fogDensity = 0.005;
        scene.fogColor = new BABYLON.Color3(0.7, 0.5, 0.3);

        // Lights
        var sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, -0.5), scene);
        sun.diffuse = new BABYLON.Color3(1, 0.9, 0.7);
        sun.intensity = 1.5;

        var hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
        hemi.diffuse = new BABYLON.Color3(0.4, 0.2, 0.1);
        hemi.intensity = 0.6;

        // Terrain
        this.createWasteland(scene);

        // Props
        this.createVegetation(scene, 100);
        this.createRuins(scene, 5); // 5 Major Ruins
        this.createScrapFields(scene, 20); // 20 Scrap piles
        this.createGasStations(scene, 10); // 10 Refuel Points
        this.createAbandonedCars(scene, 15); // 15 Rusted Hulks

        // Vehicle
        this.createBuggy(scene);

        // Camera
        this.camera = new BABYLON.FollowCamera("FollowCam", new BABYLON.Vector3(0, 10, -20), scene);
        this.camera.lockedTarget = this.vehicle;
        this.camera.radius = 25; // Further back for speed sensation
        this.camera.heightOffset = 10;
        this.camera.rotationOffset = 180;
        this.camera.cameraAcceleration = 0.05;
        this.camera.maxCameraSpeed = 400; // [FIX] Needs to be much faster than car (150)

        this.camera.lowerRadiusLimit = 10;
        this.camera.lowerHeightOffsetLimit = 5; // Don't dig into ground

        return scene;
    },

    createWasteland: function (scene) {
        // Large Ground
        // [FIX] Added updatable: true so vertex manipulation actually works on GPU
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

        // [FIX] Recompute Normals so the hills accept light correctly (otherwise they look like a flat texture)
        // We need indices for normal computation
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

        // [FIX] Raycast for exact visual height (Solves buried cacti & floating car)
        var ray = new BABYLON.Ray(new BABYLON.Vector3(x, 50, z), new BABYLON.Vector3(0, -1, 0), 100);
        var hit = this.scene.pickWithRay(ray, (mesh) => mesh === this.ground);

        if (hit && hit.hit) {
            return hit.pickedPoint.y;
        }
        return this.calculateHeight(x, z);
    },

    createVegetation: function (scene, count) {
        var mat = new BABYLON.StandardMaterial("cactusMat", scene);
        mat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/grass.png", scene); // Green noise
        mat.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.2); // Cactus Green
        mat.diffuseTexture.uScale = 1;
        mat.diffuseTexture.vScale = 5;

        for (var i = 0; i < count; i++) {
            // Random Pos
            var x = (Math.random() * 1000) - 500;
            var z = (Math.random() * 1000) - 500;
            var y = this.getHeightAt(x, z);

            var h = 4 + Math.random() * 4; // Main Trunk
            var cactus = BABYLON.MeshBuilder.CreateCylinder("cactus" + i, { diameter: 0.8, height: h }, scene);
            cactus.position = new BABYLON.Vector3(x, y + (h / 2), z);
            cactus.material = mat;

            // Rounded Top (Trunk)
            var cap = BABYLON.MeshBuilder.CreateSphere("cap" + i, { diameter: 0.8 }, scene);
            cap.position.y = h / 2;
            cap.parent = cactus;
            cap.material = mat;

            // Arms (0 to 3)
            var armCount = Math.floor(Math.random() * 4);
            for (var j = 0; j < armCount; j++) {
                var armLen = 1.0 + Math.random() * 1.5; // Upward length

                // 1. Pivot Node (Rotates around trunk)
                var pivot = new BABYLON.TransformNode("piv" + i + "_" + j, scene);
                pivot.parent = cactus;
                pivot.position.y = (Math.random() * (h * 0.4)); // Height on trunk
                pivot.rotation.y = Math.random() * Math.PI * 2;

                // 2. Connector (Horizontal)
                var conn = BABYLON.MeshBuilder.CreateCylinder("conn", { diameter: 0.6, height: 1.2 }, scene);
                conn.parent = pivot;
                conn.rotation.z = Math.PI / 2;
                conn.position.x = 0.6; // Push out
                conn.material = mat;

                // 3. Riser (Vertical)
                var riser = BABYLON.MeshBuilder.CreateCylinder("riser", { diameter: 0.6, height: armLen }, scene);
                riser.parent = pivot;
                riser.position.x = 1.2; // End of conn
                riser.position.y = armLen / 2; // Stand on top of conn
                riser.material = mat;

                // 4. Cap (Riser)
                var rCap = BABYLON.MeshBuilder.CreateSphere("rcap", { diameter: 0.6 }, scene);
                rCap.parent = riser;
                rCap.position.y = armLen / 2;
                rCap.material = mat;
            }
        }
    },

    createBuggy: function (scene) {
        // Root
        this.vehicle = new BABYLON.MeshBuilder.CreateBox("carRoot", { width: 1, height: 1, depth: 1 }, scene);
        this.vehicle.isVisible = false;
        this.vehicle.position.y = 10;

        // Visual Root (For tilting/suspension visual only)
        this.chassis = new BABYLON.TransformNode("chassis", scene);
        this.chassis.parent = this.vehicle;

        // Body Main
        var body = BABYLON.MeshBuilder.CreateBox("body", { width: 2.2, height: 0.8, depth: 4.5 }, scene);
        body.parent = this.chassis;
        body.position.y = 0.5;
        var mat = new BABYLON.StandardMaterial("carMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35); // Dark Steel
        mat.roughness = 1;
        body.material = mat;

        // Roll Cage (Torus)
        var cage = BABYLON.MeshBuilder.CreateTorus("cage", { diameter: 2.0, thickness: 0.15, tessellation: 10 }, scene);
        cage.parent = this.chassis;
        cage.rotation.z = Math.PI / 2;
        cage.position.z = -0.5;
        cage.position.y = 1.2;
        cage.scaling.y = 1.6;

        // Roll Bar Cross (Visual)
        var crossBar = BABYLON.MeshBuilder.CreateCylinder("crossBar", { diameter: 0.12, height: 1.8 }, scene);
        crossBar.parent = cage;
        crossBar.rotation.z = Math.PI / 2;
        crossBar.position.y = 0.8;

        // Front Bars
        var frontBar = BABYLON.MeshBuilder.CreateCylinder("frontBar", { diameter: 0.12, height: 2.2 }, scene);
        frontBar.parent = this.chassis;
        frontBar.position = new BABYLON.Vector3(0, 1.2, 1.5);
        frontBar.rotation.z = Math.PI / 2;

        // Engine Block (Rear)
        var engine = BABYLON.MeshBuilder.CreateBox("engine", { width: 1.8, height: 1.2, depth: 1.2 }, scene);
        engine.parent = this.chassis;
        engine.position.z = -1.8;
        engine.position.y = 1.0;
        var engineMat = new BABYLON.StandardMaterial("engMat", scene);
        engineMat.diffuseColor = new BABYLON.Color3(0.2, 0.1, 0.1);
        engine.material = engineMat;

        // Spikes (Front)
        var spike = BABYLON.MeshBuilder.CreateCylinder("spike", { diameterTop: 0, diameterBottom: 0.2, height: 1 }, scene);
        spike.rotation.x = Math.PI / 2;
        spike.parent = this.chassis;
        spike.position = new BABYLON.Vector3(0.8, 0.5, 2.5);
        spike.material = mat;

        var spike2 = spike.clone(); spike2.parent = this.chassis; spike2.position.x = -0.8;

        // Wheels
        var wheelMat = new BABYLON.StandardMaterial("wheelMat", scene);
        wheelMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15); // Blacker
        wheelMat.specularColor = new BABYLON.Color3(0, 0, 0);

        var createWheel = (x, z) => {
            // Main tire
            var w = BABYLON.MeshBuilder.CreateCylinder("w", { diameter: 1.7, height: 0.8, tessellation: 12 }, scene);
            w.rotation.z = Math.PI / 2;
            w.parent = this.chassis;
            w.position = new BABYLON.Vector3(x, 0.4, z);
            w.material = wheelMat;

            // Knobs (Rugged look via low poly and scale)
            // Or just a hubcap spike
            var hub = BABYLON.MeshBuilder.CreateCylinder("hub", { diameterTop: 0.2, diameterBottom: 0.5, height: 0.6 }, scene);
            hub.parent = w;
            hub.position.y = (x > 0 ? 0.3 : -0.3);
            return w;
        };

        createWheel(-1.4, 1.8);
        createWheel(1.4, 1.8);
        this.leftRear = createWheel(-1.4, -1.8);
        this.rightRear = createWheel(1.4, -1.8);

        // Dust Particle System
        this.dustSystem = new BABYLON.ParticleSystem("dust", 2000, scene);
        this.dustSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
        this.dustSystem.emitter = this.vehicle; // Emits from center for now, offset in update
        this.dustSystem.minEmitBox = new BABYLON.Vector3(-1, 0, -2);
        this.dustSystem.maxEmitBox = new BABYLON.Vector3(1, 0, -2.5);
        this.dustSystem.color1 = new BABYLON.Color4(0.8, 0.6, 0.4, 0.5);
        this.dustSystem.color2 = new BABYLON.Color4(0.8, 0.6, 0.4, 0.0);
        this.dustSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
        this.dustSystem.minSize = 0.5;
        this.dustSystem.maxSize = 1.5;
        this.dustSystem.minLifeTime = 0.5;
        this.dustSystem.maxLifeTime = 1.5;
        this.dustSystem.emitRate = 0; // Controlled by speed
        this.dustSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
        this.dustSystem.gravity = new BABYLON.Vector3(0, 0, 0);
        this.dustSystem.direction1 = new BABYLON.Vector3(-1, 2, -1);
        this.dustSystem.direction2 = new BABYLON.Vector3(1, 2, -1);
        this.dustSystem.minAngularSpeed = 0;
        this.dustSystem.maxAngularSpeed = Math.PI;
        this.dustSystem.start();

        // Stats
        this.speed = 0;
        this.velocity = new BABYLON.Vector3(0, 0, 0); // Real world velocity
        this.facingAngle = 0;
    },

    update: function () {
        if (!this.vehicle) return;

        var dt = this.engine.getDeltaTime() / 1000;
        if (dt > 0.1) dt = 0.1; // Cap lag

        // 1. Input
        var isTurbo = this.inputMap["shift"] || false;
        var topSpeed = isTurbo ? 300 : 150; // [FIX] Sonic Speeds
        var accelRate = isTurbo ? 150 : 80; // [FIX] Higher Torque
        var turnRate = isTurbo ? 2.5 : 3.5; // Steer slower at turbo

        var throttle = 0;
        var steer = 0;
        if (this.inputMap["w"]) throttle = 1;
        if (this.inputMap["s"]) throttle = -0.5;
        if (this.inputMap["a"]) steer = -1;
        if (this.inputMap["d"]) steer = 1;

        // 2. Physics Model (Simple Arcade Drifter)

        // Acceleration
        if (throttle !== 0) {
            this.speed += throttle * accelRate * dt;
        } else {
            // Friction
            this.speed = BABYLON.Scalar.Lerp(this.speed, 0, 2.0 * dt);
            // [FIX] Parking Brake: Snap to 0 if very slow (prevents creeping)
            if (Math.abs(this.speed) < 0.5) {
                this.speed = 0;
                this.velocity = new BABYLON.Vector3(0, 0, 0); // Kill momentum completely
            }
        }

        // Cap Speed
        if (this.speed > topSpeed) this.speed = topSpeed;
        if (this.speed < -20) this.speed = -20;

        // Turning (Only when moving)
        if (Math.abs(this.speed) > 1) {
            var turnFactor = (Math.abs(this.speed) / topSpeed); // Turn better at speed? No, usually worse
            this.facingAngle += steer * turnRate * dt;
        }

        // Apply Rotation to Visual
        this.vehicle.rotation.y = this.facingAngle;

        // 3. Drift Logic: Velocity Vector vs Facing Vector
        // Calculate "Forward" vector based on rotation
        var forwardDir = new BABYLON.Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));

        // Calculate "Target Velocity" (Where we WANT to go)
        var targetVel = forwardDir.scale(this.speed);

        // Lerp current real velocity to target velocity
        // High Traction = Fast Lerp
        // Low Traction (Drift) = Slow Lerp
        // Turbo = Less Traction
        var traction = 8.0;
        // Decrease traction only if turning (Drift)
        if (isTurbo && Math.abs(steer) > 0.1) traction = 1.0;

        this.velocity = BABYLON.Vector3.Lerp(this.velocity, targetVel, traction * dt);

        // 4. Move
        this.vehicle.position.addInPlace(this.velocity.scale(dt));

        // 5. Ground Clamp & Suspension
        var groundH = this.getHeightAt(this.vehicle.position.x, this.vehicle.position.z);

        var targetY = groundH + 0.5;
        if (this.vehicle.position.y > targetY) {
            // In Air: Fall slowly (Gravity equivalent)
            // [FIX] Drastically reduced gravity for "Action Movie" jumps
            var gravity = isTurbo ? 0.5 : 2.0;
            this.vehicle.position.y = BABYLON.Scalar.Lerp(this.vehicle.position.y, targetY, gravity * dt);
        } else {
            // On Ground: Snap tight (Suspension pushes up)
            this.vehicle.position.y = BABYLON.Scalar.Lerp(this.vehicle.position.y, targetY, 20.0 * dt);
        }

        // 6. Dust System logic
        if (this.dustSystem) {
            // Emit based on speed
            var speedRatio = Math.abs(this.speed) / topSpeed;
            var emitBase = speedRatio * 50; // 0-50 particles

            // Add drift dust
            var driftAngle = BABYLON.Vector3.GetAngleBetweenVectors(this.velocity.normalize(), forwardDir, BABYLON.Vector3.Up());
            if (this.speed > 5 && driftAngle > 0.2) {
                emitBase += 100; // Big puff on drift
            }

            this.dustSystem.emitRate = emitBase;
        }

        // 6. Visual Tilt (Chassis Only)
        // Pitch = Terrain Slope
        var nextPos = this.vehicle.position.add(forwardDir.scale(2.0));
        var nextH = this.getHeightAt(nextPos.x, nextPos.z);
        var pitch = -Math.atan2(nextH - groundH, 2.0);

        // Roll = Centrifugal Force (Steer * Speed)
        var roll = -(steer * (this.speed / topSpeed)) * 0.4;

        // Apply to chassis
        if (this.chassis) {
            this.chassis.rotation.x = BABYLON.Scalar.Lerp(this.chassis.rotation.x, pitch, 0.1);
            this.chassis.rotation.z = BABYLON.Scalar.Lerp(this.chassis.rotation.z, roll, 0.1);
        }

        // 8. Hard Floor (Anti-Sink)
        // Allow 0.2 units of suspension compression before hard snap
        if (this.vehicle.position.y < groundH + 0.3) {
            this.vehicle.position.y = groundH + 0.5;
        }

        // 9. Fuel Consumption
        var speedBurn = Math.abs(this.speed) * 0.0002; // Very slow burn based on speed
        if (isTurbo) speedBurn *= 2.0;
        this.fuel -= speedBurn * dt; // Burn per second
        if (this.fuel < 0) this.fuel = 0;

        // 10. Scrap Collection (Simple Distance Check)
        if (this.scrapFields) {
            for (let i = 0; i < this.scrapFields.length; i++) {
                let s = this.scrapFields[i];
                if (s.isEnabled() && BABYLON.Vector3.Distance(this.vehicle.position, s.position) < 5) {
                    // Pick up!
                    s.setEnabled(false); // Hide
                    this.scrap += 10;
                    if (this.dotNetRef) this.dotNetRef.invokeMethodAsync("AddScrap", 10);
                }
            }
        }

        // 11. Refuel Logic
        if (this.gasStations && this.speed < 5) {
            for (let g of this.gasStations) {
                if (BABYLON.Vector3.Distance(this.vehicle.position, g.position) < 8) {
                    this.fuel += 50 * dt; // Refuel fast
                    if (this.fuel > 100) this.fuel = 100;
                }
            }
        }

        // 12. Siphon Logic (Abandoned Cars)
        if (this.abandonedCars && this.speed < 2) {
            for (let c of this.abandonedCars) {
                if (c.isEnabled() && BABYLON.Vector3.Distance(this.vehicle.position, c.position) < 6) {
                    this.fuel += 10 * dt; // Siphon slowly
                    if (this.fuel > 100) this.fuel = 100;
                    // Optional: Dim/Remove car after siphoning? For now infinite source.
                }
            }
        }

        // 9. POI Logic (Find Nearest)
        if (this.ruins && this.ruins.length > 0) {
            var minDist = 99999;
            for (var r of this.ruins) {
                var d = BABYLON.Vector3.Distance(this.vehicle.position, r.position);
                if (d < minDist) minDist = d;
            }
            // Calculate Compass
            var deg = (this.facingAngle * 180 / Math.PI) % 360;
            if (deg < 0) deg += 360;
            deg = Math.round(deg);

            var card = "N";
            if (deg >= 22.5 && deg < 67.5) card = "NE";
            if (deg >= 67.5 && deg < 112.5) card = "E";
            if (deg >= 112.5 && deg < 157.5) card = "SE";
            if (deg >= 157.5 && deg < 202.5) card = "S";
            if (deg >= 202.5 && deg < 247.5) card = "SW";
            if (deg >= 247.5 && deg < 292.5) card = "W";
            if (deg >= 292.5 && deg < 337.5) card = "NW";

            // Update HUD
            if (window.updateHud) {
                // Signature: speed, dist, hdgRad, fuel, scrap
                window.updateHud(Math.round(this.speed), Math.round(minDist), this.facingAngle, this.fuel, this.scrap);
            }
        } else {
            if (window.updateHud) window.updateHud(Math.round(this.speed), 0, this.facingAngle, this.fuel, this.scrap);
        }

        this.frame = (this.frame || 0) + 1;
    },

    createRuins: function (scene, count) {
        this.ruins = [];

        // Materials
        var concreteMat = new BABYLON.StandardMaterial("concMat", scene);
        concreteMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45); // Blue-Grey Concrete

        var windowMat = new BABYLON.StandardMaterial("winMat", scene);
        windowMat.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.5); // Dark Blue Glass
        windowMat.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.2); // Faint reflection

        var scrapMat = new BABYLON.StandardMaterial("scrapRuinMat", scene);
        scrapMat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/metal.png", scene);
        scrapMat.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1);

        var vaultMat = new BABYLON.StandardMaterial("vaultMat", scene);
        vaultMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.2); // Yellow/Metal "Gear"

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1800) - 900;
            var z = (Math.random() * 1800) - 900;
            var y = this.getHeightAt(x, z);
            var choice = Math.floor(Math.random() * 3);
            var ruin;

            if (choice === 0) {
                // 1. Buried Skyscraper
                var building = BABYLON.MeshBuilder.CreateBox("sky" + i, { width: 15, height: 40, depth: 15 }, scene);
                var windows = BABYLON.MeshBuilder.CreateBox("win" + i, { width: 15.2, height: 20, depth: 15.2 }, scene);
                windows.material = windowMat;
                windows.position.y = 5; // Band of windows
                windows.parent = building;

                ruin = BABYLON.Mesh.MergeMeshes([building, windows], true, true, undefined, false, true);
                ruin.material = concreteMat;
                ruin.rotation.z = Math.PI / 6; // Tilt 30 deg
                ruin.rotation.y = Math.random() * Math.PI;
                ruin.position = new BABYLON.Vector3(x, y + 10, z); // Half buried

            } else if (choice === 1) {
                // 2. Watchtower (Spiky Scrap)
                var base = BABYLON.MeshBuilder.CreateCylinder("base" + i, { diameter: 8, height: 10 }, scene);
                var top = BABYLON.MeshBuilder.CreateBox("top" + i, { width: 10, height: 4, depth: 10 }, scene);
                top.position.y = 6;
                top.parent = base;

                // Spikes
                var s1 = BABYLON.MeshBuilder.CreateCylinder("s1" + i, { diameterTop: 0, diameterBottom: 0.5, height: 3 }, scene);
                s1.position = new BABYLON.Vector3(4, 8, 4); s1.parent = base;
                var s2 = s1.clone(); s2.position = new BABYLON.Vector3(-4, 8, -4); s2.parent = base;
                var s3 = s1.clone(); s3.position = new BABYLON.Vector3(4, 8, -4); s3.parent = base;
                var s4 = s1.clone(); s4.position = new BABYLON.Vector3(-4, 8, 4); s4.parent = base;

                ruin = BABYLON.Mesh.MergeMeshes([base, top, s1, s2, s3, s4], true, true, undefined, false, true);
                ruin.material = scrapMat;
                ruin.position = new BABYLON.Vector3(x, y + 5, z);

            } else {
                // 3. Vault Entrance (Gear Door in Rock)
                var rock = BABYLON.MeshBuilder.CreateSphere("rock" + i, { diameter: 25, slice: 0.5 }, scene);
                rock.scaling.y = 0.6; // Flattened Dome

                var door = BABYLON.MeshBuilder.CreateCylinder("door" + i, { diameter: 12, height: 2, tessellation: 12 }, scene);
                door.rotation.x = Math.PI / 2; // Vertical Door
                door.position.z = -8;
                door.position.y = 0;
                door.parent = rock;
                door.material = vaultMat;

                ruin = BABYLON.Mesh.MergeMeshes([rock, door], true, true, undefined, false, true);
                ruin.material = concreteMat; // Rock color
                ruin.position = new BABYLON.Vector3(x, y, z);
            }

            // Beacon Light (Red Signal)
            var light = new BABYLON.PointLight("ruinLight" + i, new BABYLON.Vector3(0, 20, 0), scene);
            light.parent = ruin;
            light.diffuse = new BABYLON.Color3(1, 0, 0); // Red Signal
            light.range = 80;
            light.intensity = 2.0;

            this.ruins.push(ruin);
        }
    },

    createScrapFields: function (scene, count) {
        this.scrapFields = [];
        var mat = new BABYLON.StandardMaterial("scrapMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.2); // Gold

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1000) - 500;
            var z = (Math.random() * 1000) - 500;
            var y = this.getHeightAt(x, z);

            var scrap = BABYLON.MeshBuilder.CreateBox("scrap" + i, { size: 2 }, scene);
            scrap.position = new BABYLON.Vector3(x, y + 1.0, z);
            scrap.material = mat;
            scrap.rotation.y = Math.random() * Math.PI;

            this.scrapFields.push(scrap);
        }
    },

    createGasStations: function (scene, count) {
        this.gasStations = [];
        var mat = new BABYLON.StandardMaterial("gasMat", scene);
        mat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/metal.png", scene);
        mat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.4); // Bluish Metal
        mat.diffuseTexture.uScale = 2;
        mat.diffuseTexture.vScale = 2;

        var pumpMat = new BABYLON.StandardMaterial("pumpMat", scene);
        pumpMat.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Red Pumps

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 800) - 400; // Closer to center
            var z = (Math.random() * 800) - 400;
            var y = this.getHeightAt(x, z);

            // 1. Canopy
            var canopy = BABYLON.MeshBuilder.CreateBox("canopy" + i, { width: 14, height: 0.5, depth: 10 }, scene);
            canopy.position.y = 6.0;

            // 2. Poles
            var p1 = BABYLON.MeshBuilder.CreateCylinder("p1", { diameter: 0.4, height: 6 }, scene);
            p1.position = new BABYLON.Vector3(6, 3, 4);
            var p2 = BABYLON.MeshBuilder.CreateCylinder("p2", { diameter: 0.4, height: 6 }, scene);
            p2.position = new BABYLON.Vector3(-6, 3, 4);
            var p3 = BABYLON.MeshBuilder.CreateCylinder("p3", { diameter: 0.4, height: 6 }, scene);
            p3.position = new BABYLON.Vector3(6, 3, -4);
            var p4 = BABYLON.MeshBuilder.CreateCylinder("p4", { diameter: 0.4, height: 6 }, scene);
            p4.position = new BABYLON.Vector3(-6, 3, -4);

            // 3. Pump Island
            var island = BABYLON.MeshBuilder.CreateBox("island", { width: 6, height: 0.4, depth: 2 }, scene);
            island.position.y = 0.2;

            // 4. Sign Post (Tall)
            var post = BABYLON.MeshBuilder.CreateCylinder("post", { diameter: 0.3, height: 12 }, scene);
            post.position = new BABYLON.Vector3(-8, 6, 0);
            var signBox = BABYLON.MeshBuilder.CreateBox("signBox", { width: 4, height: 2, depth: 0.2 }, scene);
            signBox.parent = post;
            signBox.position.y = 5.5;
            signBox.rotation.y = 0.5; // Tilted angle
            signBox.rotation.z = 0.1; // Tilted broken

            // Merge Structure
            var structure = BABYLON.Mesh.MergeMeshes([canopy, p1, p2, p3, p4, island, post], true, true, undefined, false, true);
            structure.material = mat;

            // Pumps (Separate material)
            var pump1 = BABYLON.MeshBuilder.CreateBox("pump1", { width: 0.8, height: 1.5, depth: 0.8 }, scene);
            pump1.position = new BABYLON.Vector3(1.5, 0.75, 0);
            pump1.parent = structure;
            pump1.material = pumpMat;

            var pump2 = pump1.clone();
            pump2.position.x = -1.5;
            pump2.parent = structure;

            // Final Placement
            structure.position = new BABYLON.Vector3(x, y, z);

            // Beacon Light (Under Canopy)
            var light = new BABYLON.PointLight("gasLight" + i, new BABYLON.Vector3(0, 5, 0), scene);
            light.parent = structure;
            light.diffuse = new BABYLON.Color3(0.2, 0.5, 1.0); // Cyan/Blue Glow
            light.range = 60;
            light.intensity = 1.5;

            this.gasStations.push(structure);
        }
    },

    createAbandonedCars: function (scene, count) {
        this.abandonedCars = [];
        var rustMat = new BABYLON.StandardMaterial("rustMat", scene);
        rustMat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/metal.png", scene);
        rustMat.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.1); // Tint it Rust Brown
        rustMat.diffuseTexture.uScale = 2; // Repeat texture
        rustMat.diffuseTexture.vScale = 2;
        rustMat.roughness = 1.0;

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1600) - 800;
            var z = (Math.random() * 1600) - 800;
            var y = this.getHeightAt(x, z);

            // Create a Compound Body (Sedan Shape)
            var body = BABYLON.MeshBuilder.CreateBox("body" + i, { width: 2.2, height: 0.8, depth: 4.5 }, scene);
            var roof = BABYLON.MeshBuilder.CreateBox("roof" + i, { width: 2.0, height: 0.7, depth: 2.2 }, scene);
            roof.position.y = 0.75;
            roof.position.z = -0.5;

            // Wheels (Rims)
            var createWheel = (wx, wz) => {
                var w = BABYLON.MeshBuilder.CreateCylinder("w", { diameter: 0.9, height: 0.4 }, scene);
                w.rotation.z = Math.PI / 2;
                w.position = new BABYLON.Vector3(wx, -0.3, wz);
                // Randomize "Flat Tire" look
                w.rotation.x = Math.random() * 0.2;
                w.rotation.y = Math.random() * 0.2;
                return w;
            };

            var w1 = createWheel(-1.1, 1.5);
            var w2 = createWheel(1.1, 1.5);
            var w3 = createWheel(-1.1, -1.5);
            var w4 = createWheel(1.1, -1.5);

            // Merge meshes to create one "Hulk"
            var meshes = [body, roof, w1, w2, w3, w4];
            var hulk = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, true);

            hulk.position = new BABYLON.Vector3(x, y + 0.8, z); // Lift slightly for wheels
            hulk.rotation = new BABYLON.Vector3((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
            hulk.material = rustMat;

            this.abandonedCars.push(hulk);
        }
    }
};
