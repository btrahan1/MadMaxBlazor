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
    speedRatio: 0.5, // Default to 50 (Half speed)

    setSpeedRatio: function (val) {
        // Map 1-100 to 0.25 - 1.0
        // User wants 1 = 25% speed, 100 = 100% speed.
        // val is 1-100.
        var pct = val / 100;
        // Simple linear for now: 100 is max, 0 is stop.
        // But user asked for 1 = 25%.
        // Let's do: 0.25 + (0.75 * (val / 100))
        this.speedRatio = 0.25 + (0.75 * (val / 100));
        if (this.speedRatio > 1.0) this.speedRatio = 1.0;
    },

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
            var key = evt.sourceEvent.key.toLowerCase();
            this.inputMap[key] = true;
            if (key === " ") evt.sourceEvent.preventDefault(); // Stop Scrolling
        }));
        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
            var key = evt.sourceEvent.key.toLowerCase();
            this.inputMap[key] = false;
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
        this.createSnakes(scene, 10);
        this.createCoyotes(scene, 5);
        this.createSurvivorCamps(scene, 3);
        this.createBanditCamps(scene, 3);

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

        // --- WEAPONS: Twin Mounted Machine Guns ---
        var gunMat = new BABYLON.StandardMaterial("gunMat", scene);
        gunMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Black Metal

        var createGun = (side) => {
            var gun = BABYLON.MeshBuilder.CreateCylinder("gun" + side, { diameter: 0.15, height: 1.5 }, scene);
            gun.parent = this.chassis;
            gun.rotation.x = Math.PI / 2; // Point Forward
            gun.position = new BABYLON.Vector3(side * 0.8, 1.2, 1.5); // Hood position
            gun.material = gunMat;
            return gun;
        };
        this.leftGun = createGun(-1);
        this.rightGun = createGun(1);

        this.projectiles = []; // Store active bullets
        this.lastFireTime = 0;
        // ------------------------------------------
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

        var baseSpeed = 100 * this.speedRatio;
        var baseAccel = 60 * this.speedRatio;

        var topSpeed = isTurbo ? baseSpeed : (baseSpeed * 0.7);
        var accelRate = isTurbo ? baseAccel : (baseAccel * 0.5);
        var turnRate = isTurbo ? 2.5 : 3.5;

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
            // [FIX] Use normalizeToNew() to avoid destroying original velocity vector
            var driftAngle = BABYLON.Vector3.GetAngleBetweenVectors(this.velocity.normalizeToNew(), forwardDir, BABYLON.Vector3.Up());
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

        if (this.ruins && this.ruins.length > 0) {
            // ... (Compass logic logic essentially rendered redundant by radar, but fine to keep HUD text)
        }

        // 13. Update Radar
        if (!this.radarUI) {
            // [FIX] First Frame Init
            this.initRadar(this.scene);

            // Add Blips
            if (this.ruins) this.ruins.forEach(r => this.createBlip(r, "Purple", "ruin"));
            if (this.survivorCamps) this.survivorCamps.forEach(c => this.createBlip(c, "Green", "camp"));
            if (this.banditCamps) this.banditCamps.forEach(c => this.createBlip(c, "Red", "camp"));
            if (this.gasStations) this.gasStations.forEach(g => this.createBlip(g, "Cyan", "resource"));
            if (this.scrapFields) this.scrapFields.forEach(s => this.createBlip(s, "Yellow", "resource"));
        }
        this.updateRadar();

        // --- COMBAT UPDATE ---
        var dt = this.scene.getAnimationRatio() * 0.016; // Delta Time approx

        // Spacebar Fire
        if (this.inputMap[" "]) {
            this.fireMachineGun(this.scene);
        }

        this.updateProjectiles(dt);
        this.updateEnemies(dt);
        // ---------------------

        // 14. HUD Update (Always run if defined)
        if (window.updateHud) {
            // Find nearest ruin for distance signal
            var minDist = 99999;
            if (this.ruins) {
                for (var r of this.ruins) {
                    var d = BABYLON.Vector3.Distance(this.vehicle.position, r.position);
                    if (d < minDist) minDist = d;
                }
            }
            window.updateHud(Math.round(this.speed), Math.round(minDist), this.facingAngle, this.fuel, this.scrap);
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
    },

    createSnakes: function (scene, count) {
        this.snakes = [];
        var snakeMat = new BABYLON.StandardMaterial("snakeMat", scene);
        snakeMat.diffuseColor = new BABYLON.Color3(0.6, 0.5, 0.3); // Desert Camo
        snakeMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

        for (var i = 0; i < count; i++) {
            var segments = [];

            // Force first 2 near player
            var range = (i < 2) ? 40 : 1000;
            var headX = (Math.random() * range) - (range / 2);
            var headZ = (Math.random() * range) - (range / 2); // 0,0 is start

            // Create segments (Head -> Tail)
            for (var j = 0; j < 8; j++) {
                var s = BABYLON.MeshBuilder.CreateSphere("s" + i + "_" + j, { diameter: 1.0 - (j * 0.08) }, scene);
                s.material = snakeMat;
                s.position = new BABYLON.Vector3(headX, 0, headZ + (j * 0.5));
                segments.push(s);
            }

            this.snakes.push({
                segments: segments,
                dir: new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
                speed: 1.0 + Math.random(),
                turnTimer: 0
            });
        }
    },

    createCoyotes: function (scene, count) {
        console.log("Creating Coyotes...");
        this.coyotes = [];
        var furMat = new BABYLON.StandardMaterial("furMat", scene);
        furMat.diffuseColor = new BABYLON.Color3(0.5, 0.4, 0.3); // Tan/Grey

        for (var i = 0; i < count; i++) {
            // Force first 2 near player
            var range = (i < 2) ? 50 : 1000;
            var x = (Math.random() * range) - (range / 2);
            var z = (Math.random() * range) - (range / 2);

            // Root Node
            var root = new BABYLON.TransformNode("coyote" + i, scene);
            root.position = new BABYLON.Vector3(x, 0, z);

            // Body
            var body = BABYLON.MeshBuilder.CreateBox("body", { width: 0.5, height: 0.6, depth: 1.2 }, scene);
            body.parent = root;
            body.position.y = 0.6; // Legs are ~0.6 tall
            body.material = furMat;

            // Head
            var head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.4, height: 0.4, depth: 0.5 }, scene);
            head.parent = body;
            head.position = new BABYLON.Vector3(0, 0.4, 0.6); // Up and Forward
            head.material = furMat;

            // Snout
            var snout = BABYLON.MeshBuilder.CreateBox("snout", { width: 0.2, height: 0.2, depth: 0.3 }, scene);
            snout.parent = head;
            snout.position.z = 0.3;
            snout.material = furMat;

            // Ears
            var earL = BABYLON.MeshBuilder.CreatePolyhedron("earL", { type: 1, size: 0.1 }, scene);
            earL.parent = head; earL.position = new BABYLON.Vector3(-0.15, 0.25, -0.1); earL.material = furMat;
            var earR = earL.clone(); earR.parent = head; earR.position.x = 0.15;

            // Tail
            var tail = BABYLON.MeshBuilder.CreateCylinder("tail", { diameterTop: 0.1, diameterBottom: 0.2, height: 0.8 }, scene);
            tail.parent = body;
            tail.rotation.x = Math.PI / 4; // Stick out/down
            tail.position = new BABYLON.Vector3(0, 0.1, -0.6);
            tail.material = furMat;

            // Legs
            var createLeg = (name, dx, dz) => {
                var leg = BABYLON.MeshBuilder.CreateBox(name, { width: 0.15, height: 0.6, depth: 0.15 }, scene);
                leg.parent = body;
                leg.position = new BABYLON.Vector3(dx, -0.3, dz);
                leg.material = furMat;
                // Pivot at top for animation
                leg.setPivotPoint(new BABYLON.Vector3(0, 0.3, 0));
                return leg;
            };

            var fl = createLeg("LegFL", -0.2, 0.5);
            var fr = createLeg("LegFR", 0.2, 0.5);
            var bl = createLeg("LegBL", -0.2, -0.5);
            var br = createLeg("LegBR", 0.2, -0.5);

            this.coyotes.push({
                root: root,
                legs: [fl, fr, bl, br],
                dir: new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
                speed: 2.0,
                animTime: Math.random() * 100,
                stateTimer: 0
            });
        }
    },

    updateFauna: function (dt) {
        // Update Snakes
        if (this.snakes) {
            for (var s of this.snakes) {
                // Move Head
                s.turnTimer -= dt;
                if (s.turnTimer <= 0) {
                    // New Random Direction
                    s.dir = new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    s.turnTimer = 2.0 + Math.random() * 3.0;
                }

                var head = s.segments[0];
                var move = s.dir.scale(s.speed * dt);

                // Proposed Pos
                var nextX = head.position.x + move.x;
                var nextZ = head.position.z + move.z;
                var nextY = this.getHeightAt(nextX, nextZ);

                head.position = new BABYLON.Vector3(nextX, nextY + 0.4, nextZ);

                // Body Follow (Slither)
                for (var i = 1; i < s.segments.length; i++) {
                    var curr = s.segments[i];
                    var prev = s.segments[i - 1];

                    // Simple "Spring" / Distance constraint
                    var dist = 0.6; // Desired spacing
                    var diff = prev.position.subtract(curr.position);
                    var len = diff.length();

                    if (len > dist) {
                        var lerpFactor = 5.0 * dt;
                        // Move towards prev, but maintain distance? 
                        // Simplified: Just lerp towards intended spot
                        var target = prev.position.subtract(diff.normalize().scale(dist));
                        // Snap or Lerp? Lerp gives smoothness
                        curr.position = BABYLON.Vector3.Lerp(curr.position, target, 10 * dt);

                        // Stick to ground
                        curr.position.y = this.getHeightAt(curr.position.x, curr.position.z) + 0.4;
                    }
                }
            }
        }

        // Update Coyotes
        if (this.coyotes) {
            for (var c of this.coyotes) {
                c.animTime += dt * c.speed * 5.0; // Walk cycle speed

                // Move
                c.stateTimer -= dt;
                if (c.stateTimer <= 0) {
                    c.dir = new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    c.stateTimer = 4.0 + Math.random() * 4.0;
                }

                var nextX = c.root.position.x + c.dir.x * c.speed * dt;
                var nextZ = c.root.position.z + c.dir.z * c.speed * dt;
                var nextY = this.getHeightAt(nextX, nextZ);

                // Raise root slightly to prevent clipping
                c.root.position = new BABYLON.Vector3(nextX, nextY + 0.5, nextZ);

                // Rotation (Face direction)
                var angle = Math.atan2(c.dir.x, c.dir.z);
                c.root.rotation.y = angle;

                // Leg Animation (Walk Cycle)
                // Left Front & Right Back match. Right Front & Left Back match.
                var legAmp = 0.4;
                c.legs[0].rotation.x = Math.sin(c.animTime) * legAmp; // FL
                c.legs[3].rotation.x = Math.sin(c.animTime) * legAmp; // BR

                c.legs[1].rotation.x = Math.cos(c.animTime) * legAmp; // FR
                c.legs[2].rotation.x = Math.cos(c.animTime) * legAmp; // BL
            }
        }
    },

    createSurvivorCamps: function (scene, count) {
        this.survivorCamps = [];
        var tentMat = new BABYLON.StandardMaterial("tentMat", scene);
        tentMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.85); // White Canvas

        var waterMat = new BABYLON.StandardMaterial("waterMat", scene);
        waterMat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.8);

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1200) - 600;
            var z = (Math.random() * 1200) - 600;
            var y = this.getHeightAt(x, z);

            var campRoot = new BABYLON.TransformNode("camp" + i, scene);
            campRoot.position = new BABYLON.Vector3(x, y, z);

            // Tents
            // 1. Dome Tents (Hemispheres)
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

            // 2. Water Tank
            var tank = BABYLON.MeshBuilder.CreateCylinder("tank", { diameter: 2.5, height: 3 }, scene);
            tank.parent = campRoot;
            tank.position = new BABYLON.Vector3(-5, 1.5, -2);
            tank.material = waterMat;

            // 3. Crates
            var crate = BABYLON.MeshBuilder.CreateBox("crate", { size: 1 }, scene);
            crate.parent = campRoot; crate.position = new BABYLON.Vector3(2, 0.5, 1);
            var c2 = crate.clone(); c2.parent = campRoot; c2.position = new BABYLON.Vector3(2.2, 0.5, 2.1); c2.rotation.y = 0.5;

            // Fire
            var fire = BABYLON.MeshBuilder.CreateBox("fire", { size: 0.5 }, scene);
            fire.parent = campRoot;
            fire.position.y = 0.25;
            var fireMat = new BABYLON.StandardMaterial("fireMat", scene);
            fireMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
            fire.material = fireMat;

            // Light
            var light = new BABYLON.PointLight("campLight" + i, new BABYLON.Vector3(0, 2, 0), scene);
            light.parent = campRoot;
            light.diffuse = new BABYLON.Color3(1, 0.6, 0.3);
            light.range = 30;

            this.survivorCamps.push(campRoot);
        }
    },

    createBanditCamps: function (scene, count) {
        this.banditCamps = [];
        var spikeMat = new BABYLON.StandardMaterial("spikeMat", scene);
        spikeMat.diffuseColor = new BABYLON.Color3(0.3, 0.1, 0.1); // Rusty Red

        var metalMat = new BABYLON.StandardMaterial("metalMat", scene);
        metalMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 1200) - 600;
            var z = (Math.random() * 1200) - 600;
            var y = this.getHeightAt(x, z);

            var campRoot = new BABYLON.TransformNode("bandit" + i, scene);
            campRoot.position = new BABYLON.Vector3(x, y, z);

            // Spikes (Fence)
            // 1. Spikes (Disordered Ring)
            for (var j = 0; j < 12; j++) {
                var angle = (j / 12) * Math.PI * 2;
                var dist = 8 + (Math.random() * 3); // uneven
                var sx = Math.sin(angle) * 8;
                var sz = Math.cos(angle) * 8;

                var h = 3 + Math.random() * 3;
                var spike = BABYLON.MeshBuilder.CreateCylinder("spike", { diameterTop: 0, diameterBottom: 0.6, height: h }, scene);
                spike.parent = campRoot;
                spike.position = new BABYLON.Vector3(sx, h / 2, sz);
                spike.rotation.x = (Math.random() - 0.5) * 0.5; // Tilted
                spike.rotation.z = (Math.random() - 0.5) * 0.5;
                spike.material = spikeMat;
            }

            // 2. Watchtower
            var towerHeight = 12;
            var tower = BABYLON.MeshBuilder.CreateCylinder("towerBase", { diameter: 3, height: towerHeight, tessellation: 6 }, scene);
            tower.parent = campRoot;
            tower.position = new BABYLON.Vector3(-5, towerHeight / 2, 5);
            tower.material = metalMat;

            var platform = BABYLON.MeshBuilder.CreateCylinder("platform", { diameter: 5, height: 1 }, scene);
            platform.parent = campRoot;
            platform.position = new BABYLON.Vector3(-5, towerHeight, 5);
            platform.material = metalMat;

            // 3. Skull Pole (Iconic)
            var pole = BABYLON.MeshBuilder.CreateCylinder("pole", { diameter: 0.2, height: 6 }, scene);
            pole.parent = campRoot;
            pole.position = new BABYLON.Vector3(4, 3, 4);
            pole.material = metalMat;

            var skull = BABYLON.MeshBuilder.CreateSphere("skull", { diameter: 1.0 }, scene);
            skull.parent = campRoot;
            skull.position = new BABYLON.Vector3(4, 5.8, 4);
            skull.material = new BABYLON.StandardMaterial("skullCol", scene); // White

            this.banditCamps.push(campRoot);
        }
    },

    initRadar: function (scene) {
        // GUI
        var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this.radarUI = advancedTexture;

        // Container (Bottom Left)
        var radarContainer = new BABYLON.GUI.Ellipse();
        radarContainer.width = "200px";
        radarContainer.height = "200px";
        radarContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        radarContainer.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        radarContainer.left = "20px";
        radarContainer.top = "-20px";
        radarContainer.color = "Green";
        radarContainer.thickness = 4;
        radarContainer.background = "Black";
        radarContainer.alpha = 0.8;
        advancedTexture.addControl(radarContainer);

        // Center Player Marker (Blue Circle + White Arrow)
        var carIcon = new BABYLON.GUI.Ellipse();
        carIcon.width = "20px";
        carIcon.height = "20px";
        carIcon.color = "White"; // Border
        carIcon.thickness = 1;
        carIcon.background = "Blue";

        // Arrow
        var arrow = new BABYLON.GUI.TextBlock();
        arrow.text = "↑"; // Points UP
        arrow.color = "White";
        arrow.fontSize = "16px";
        arrow.fontWeight = "bold";
        carIcon.addControl(arrow);

        radarContainer.addControl(carIcon);
        this.radarCar = carIcon; // Store for rotation

        this.radarBlips = [];
        this.radarContainer = radarContainer;
        this.radarRange = 300; // Meters visible on radar
    },

    createBlip: function (targetMesh, color, type) {
        var blip = new BABYLON.GUI.Ellipse();
        blip.width = "6px";
        blip.height = "6px";
        blip.color = color;
        blip.background = color;

        if (type === "ruin") {
            blip.width = "10px";
            blip.height = "10px";
            blip.color = "Purple"; // Border
            blip.background = "Purple";
        }

        this.radarContainer.addControl(blip);

        this.radarBlips.push({
            ui: blip,
            mesh: targetMesh
        });
    },

    updateRadar: function () {
        if (!this.radarContainer || !this.vehicle) return;

        var pPos = this.vehicle.position;

        // North-Up Radar: Map is fixed. Car rotates.
        if (this.radarCar) {
            this.radarCar.rotation = this.facingAngle; // Positive rotation
        }

        var radius = 100; // UI pixels radius

        for (var b of this.radarBlips) {
            if (!b.mesh || !b.mesh.isEnabled()) {
                b.ui.isVisible = false;
                continue;
            }

            var tPos = b.mesh.position;
            var dx = tPos.x - pPos.x;
            var dz = tPos.z - pPos.z;

            // Dist check first
            var dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > this.radarRange) {
                b.ui.isVisible = false;
                continue;
            }

            b.ui.isVisible = true;

            // North-Up Logic: No Grid Rotation
            // World +X (East) -> Radar +X (Right)
            // World +Z (North) -> Radar -Y (Up)
            var scale = radius / this.radarRange;
            var uiX = dx * scale;
            var uiY = -dz * scale;

            b.ui.left = uiX + "px";
            b.ui.top = uiY + "px";
        }
    },

    // --- COMBAT SYSTEM ---
    initCombat: function (scene) {
        // Master Bullet (Hidden)
        var master = BABYLON.MeshBuilder.CreateBox("masterBullet", { width: 0.1, height: 0.1, depth: 2 }, scene);
        master.isVisible = false;
        master.material = new BABYLON.StandardMaterial("tracer", scene);
        master.material.emissiveColor = new BABYLON.Color3(1, 1, 0);
        master.material.disableLighting = true;
        this.masterBullet = master;
        this.projectiles = [];
    },

    fireMachineGun: function (scene) {
        if (!this.masterBullet) this.initCombat(scene);

        var now = Date.now();
        if (now - this.lastFireTime < 100) return; // Fire Rate Limit
        this.lastFireTime = now;

        var createBullet = (gunNode) => {
            // Use Instance (Fast!)
            var bullet = this.masterBullet.createInstance("b_" + now);
            var pos = gunNode.getAbsolutePosition();
            bullet.position.copyFrom(pos);

            // Align with car rotation
            bullet.rotation.y = -this.facingAngle;

            var speed = 200;
            var dir = new BABYLON.Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));

            this.projectiles.push({
                mesh: bullet,
                direction: dir,
                speed: speed,
                life: 2.0
            });
        };

        createBullet(this.leftGun);
        createBullet(this.rightGun);
    },

    // --- ENEMY AI SYSTEM ---
    createEnemyBuggy: function (scene, x, z) {
        if (!this.enemies) this.enemies = [];

        // Root
        var enemy = new BABYLON.MeshBuilder.CreateBox("enemy", { width: 1, height: 1, depth: 1 }, scene);
        enemy.isVisible = false;
        enemy.position = new BABYLON.Vector3(x, 10, z); // Start high

        var chassis = new BABYLON.TransformNode("e_chassis", scene);
        chassis.parent = enemy;

        // Body (Red)
        var body = BABYLON.MeshBuilder.CreateBox("e_body", { width: 2.2, height: 0.8, depth: 4.5 }, scene);
        body.parent = chassis;
        body.position.y = 0.5;
        var mat = new BABYLON.StandardMaterial("e_carMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.5, 0.1, 0.1); // Bandit Red
        body.material = mat;

        // Roll Cage
        var cage = BABYLON.MeshBuilder.CreateTorus("e_cage", { diameter: 2.0, thickness: 0.15, tessellation: 10 }, scene);
        cage.parent = chassis;
        cage.rotation.z = Math.PI / 2;
        cage.position.z = -0.5; cage.position.y = 1.2; cage.scaling.y = 1.6;

        // Wheels
        var wheelMat = new BABYLON.StandardMaterial("e_wheelMat", scene);
        wheelMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        var createWheel = (wx, wz) => {
            var w = BABYLON.MeshBuilder.CreateCylinder("w", { diameter: 1.7, height: 0.8 }, scene);
            w.rotation.z = Math.PI / 2; w.parent = chassis;
            w.position = new BABYLON.Vector3(wx, 0.4, wz); w.material = wheelMat;
        };
        createWheel(-1.4, 1.8); createWheel(1.4, 1.8);
        createWheel(-1.4, -1.8); createWheel(1.4, -1.8);

        // Stats
        enemy.data = {
            speed: 0,
            velocity: new BABYLON.Vector3(0, 0, 0),
            facingAngle: Math.random() * Math.PI * 2,
            hp: 3 // Hits to kill
        };

        this.enemies.push(enemy);
        // Add to Radar
        this.createBlip(enemy, "Red", "enemy");
    },

    updateEnemies: function (dt) {
        // Debug Spawn
        if (this.inputMap["b"]) {
            this.inputMap["b"] = false; // Trigger once
            var fwd = new BABYLON.Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
            var spawnPos = this.vehicle.position.add(fwd.scale(20));
            this.createEnemyBuggy(this.scene, spawnPos.x, spawnPos.z);
            console.log("Forced Spawn at: " + spawnPos);
        }

        if (!this.enemies) return;

        // Bandit Camp Proximity Check
        if (this.banditCamps) {
            for (var camp of this.banditCamps) {
                if (camp.hasSpawned) continue;
                var dist = BABYLON.Vector3.Distance(this.vehicle.position, camp.position);
                if (dist < 300) { // Trigger Range Increased to 300
                    camp.hasSpawned = true;
                    console.log("BANDIT AMBUSH!");
                    // Spawn 3
                    for (var i = 0; i < 3; i++) {
                        var angle = i * (Math.PI * 2 / 3);
                        var ex = camp.position.x + Math.sin(angle) * 20;
                        var ez = camp.position.z + Math.cos(angle) * 20;
                        this.createEnemyBuggy(this.scene, ex, ez);
                    }
                }
            }
        }

        // AI Logic
        for (var i = this.enemies.length - 1; i >= 0; i--) {
            var e = this.enemies[i];

            // Physics Movement
            var gravity = 2.0; // Gravity
            var groundH = this.getHeightAt(e.position.x, e.position.z);

            // Turn towards Player
            var targetPos = this.vehicle.position;
            var dx = targetPos.x - e.position.x;
            var dz = targetPos.z - e.position.z;
            var desiredAngle = Math.atan2(dx, dz);

            // Smooth Turn
            // Lerp angle? For now, snap turn factor
            var diff = desiredAngle - e.data.facingAngle;
            // Normalize angle diff
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            var turnRate = 2.0;
            if (diff > 0.1) e.data.facingAngle += turnRate * dt;
            else if (diff < -0.1) e.data.facingAngle -= turnRate * dt;

            // Initial Velocity
            // e.data.velocity ...
            // Apply Gravity
            if (e.position.y > groundH + 0.5) {
                e.position.y -= gravity * dt;
            } else {
                e.position.y = groundH + 0.5; // Floor clamp for now, suspension later
            }

            var forward = new BABYLON.Vector3(Math.sin(e.data.facingAngle), 0, Math.cos(e.data.facingAngle));
            var speed = 40; // Constant drive

            // Move
            e.position.x += forward.x * speed * dt;
            e.position.z += forward.z * speed * dt;

            // Update Mesh Rotation
            e.rotation.y = e.data.facingAngle;
        }
    },



    updateProjectiles: function (dt) {
        if (!this.projectiles) return;

        for (var i = this.projectiles.length - 1; i >= 0; i--) {
            var p = this.projectiles[i];
            p.life -= dt;

            if (p.life <= 0) {
                p.mesh.dispose();
                this.projectiles.splice(i, 1);
                continue;
            }

            // Move
            p.mesh.position.x += p.direction.x * p.speed * dt;
            p.mesh.position.z += p.direction.z * p.speed * dt;

            // Ground Collision (Simple: If below ground, puff and die)
            var gy = this.getHeightAt(p.mesh.position.x, p.mesh.position.z);
            if (p.mesh.position.y < gy) {
                // Hit Ground
                p.mesh.dispose();
                this.projectiles.splice(i, 1);
                // TODO: Spawn Particle Puff?
            }
        }
    }
};
