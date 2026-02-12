var wastelandRenderer = {
    canvas: null,
    engine: null,
    scene: null,
    camera: null,
    vehicle: null,
    inputMap: {},
    dotNetRef: null,
    fuel: 100,
    scrap: 0,
    speedRatio: 0.5,
    isDriving: true,
    lastSpawnTime: 0,
    stats: { str: 10, dex: 10, int: 10, wis: 10, weaponDamage: 0, stamina: 100, maxStamina: 100, mana: 100, maxMana: 100 },

    updateStats: function (s) {
        this.stats = s;
        if (typeof WastelandHero !== 'undefined' && WastelandHero) {
            if (s.hp !== undefined) WastelandHero.hp = s.hp;
            if (s.stamina !== undefined) WastelandHero.stamina = s.stamina;
            if (s.mana !== undefined) WastelandHero.mana = s.mana;
        }
    },

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

    enemySpeedRatio: 0.35, // Default 35%
    setEnemySpeedRatio: function (val) {
        // Linear 1-100%
        this.enemySpeedRatio = val / 100.0;
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

            // Toggle Hero Mode (P)
            if (key === "p") {
                WastelandHero.toggleMode(this);
            }

            // Paperdoll (ESC)
            if (key === "escape") {
                if (this.dotNetRef) {
                    this.dotNetRef.invokeMethodAsync("TogglePaperdollFromJS");
                }
            }

            // Debug Spawning (Shift + 1/2)
            if (evt.sourceEvent.shiftKey) {
                var now = Date.now();
                if (this.lastSpawnTime && (now - this.lastSpawnTime < 500)) return;
                this.lastSpawnTime = now;

                var p = this.vehicle ? this.vehicle : { position: new BABYLON.Vector3(0, 0, 0), rotationQuaternion: new BABYLON.Quaternion() };

                if (key === "!" || key === "1") WastelandNPCs.spawnSpider(this.scene, p.position.x, p.position.z, this);
                if (key === "@" || key === "2") WastelandNPCs.spawnHelicopter(this.scene, p.position.x, p.position.z, this);
                if (key === "#" || key === "3") WastelandNPCs.spawnNuclearHydra(this.scene, p.position.x, p.position.z, this);
            }

            // Boss Tanker (Z)
            if (key === "z") {
                var p = this.vehicle ? this.vehicle : { position: new BABYLON.Vector3(0, 0, 0), rotationQuaternion: new BABYLON.Quaternion() };
                WastelandNPCs.createBossTanker(this.scene, p.position.x, p.position.z, this);
            }
        }));
        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
            var key = evt.sourceEvent.key.toLowerCase();
            this.inputMap[key] = false;
        }));

        this.engine.runRenderLoop(() => {
            this.update();
            this.scene.render();
        });

        // Double-Click Combat Engagement
        this.scene.onPointerObservable.add(async (pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOUBLETAP) {
                var pickResult = pointerInfo.pickInfo;
                if (pickResult.hit && WastelandHero.isActive) {
                    var mesh = pickResult.pickedMesh;
                    console.log("Double Click on: " + mesh.name);

                    // Identify if it's wildlife
                    var targetNPC = null;

                    // Check Coyotes
                    for (var c of WastelandNPCs.coyotes) {
                        // Check if picked mesh is part of coyote root/descendants
                        if (mesh === c.root || mesh.isDescendantOf(c.root)) {
                            targetNPC = c;
                            break;
                        }
                    }

                    // Check Snakes
                    if (!targetNPC) {
                        for (var s of WastelandNPCs.snakes) {
                            if (s.segments.includes(mesh)) {
                                targetNPC = s;
                                break;
                            }
                        }
                    }

                    // Check Bandits/Survivors (Dungeon or Wasteland)
                    if (!targetNPC) {
                        for (var s of WastelandNPCs.survivors) {
                            if (mesh === s || mesh.isDescendantOf(s)) {
                                targetNPC = s;
                                break;
                            }
                        }
                    }

                    if (targetNPC && targetNPC.data && targetNPC.data.isMedic) {
                        // Open Medic UI
                        if (this.dotNetRef) {
                            this.dotNetRef.invokeMethodAsync("OpenMedicUI");
                        }
                        return;
                    }

                    if (!targetNPC) {
                        for (var s of WastelandNPCs.shopkeepers) {
                            if (mesh === s || mesh.isDescendantOf(s)) {
                                var type = (s.data && s.data.type) || "SHOP";
                                console.log("INTERACTING WITH: " + type);
                                if (this.dotNetRef) {
                                    if (type === "GARAGE") this.dotNetRef.invokeMethodAsync("OpenGarage");
                                    else this.dotNetRef.invokeMethodAsync("OpenShop");
                                }
                                return;
                            }
                        }
                    }

                    // Check Dungeon Entrance
                    if (!targetNPC) {
                        for (var r of WastelandWorld.ruins) {
                            if (mesh === r || mesh.isDescendantOf(r)) {
                                if (r.data && r.data.type === "DUNGEON_ENTRANCE") {
                                    console.log("ENTERING DUNGEON!");
                                    await WastelandDungeon.generate(r.data.dungeonId);
                                    await WastelandDungeon.enter(this);
                                    return;
                                }
                            }
                        }
                    }

                    // Check Dungeon Exit
                    if (WastelandDungeon.isActive && mesh === WastelandDungeon.exitPoint) {
                        WastelandDungeon.exit(this);
                        return;
                    }

                    if (targetNPC) {
                        // Prevent engaging friendly NPCs
                        if (targetNPC.data && (targetNPC.data.isMedic || targetNPC.data.isShopkeeper || targetNPC.data.isFriendly)) {
                            return;
                        }
                        console.log("COMBAT ENGAGED!");
                        WastelandHero.combatTarget = targetNPC;
                        if (targetNPC.data) targetNPC.data.isFeral = true;
                        else targetNPC.isFeral = true;
                        WastelandHero.combatTurn = 0; // Reset turn to Hero
                        WastelandHero.combatTimer = 0.5; // Quick first strike
                    }
                }
            }
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

        // Systems
        this.initRadar(scene);
        WastelandCombat.init(scene);
        WastelandCombatUI.init(scene);
        WastelandDungeon.init(scene);

        // Terrain & Props
        WastelandWorld.init(scene);
        this.ground = WastelandWorld.ground;

        // Fauna
        WastelandNPCs.createSnakes(scene, 10, this);
        WastelandNPCs.createCoyotes(scene, 5, this);

        // Friendly NPCs (Trader, Mechanic)
        WastelandNPCs.spawnFriendlyNPC(scene, this);

        // Vehicle
        this.createBuggy(scene);

        // Camera
        // Camera
        this.camera = new BABYLON.ArcRotateCamera("MainCam", -Math.PI / 2, Math.PI / 3, 30, new BABYLON.Vector3(0, 0, 0), scene);
        this.camera.lockedTarget = this.vehicle; // Lock to car initially
        this.camera.attachControl(this.canvas, true);

        // Limits
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 60;
        this.camera.checkCollisions = true; // Don't clip underground
        this.camera.collisionRadius = new BABYLON.Vector3(0.5, 0.5, 0.5);

        return scene;
    },

    // createWasteland moved to WastelandWorld.js

    calculateHeight: function (x, z) {
        return WastelandWorld.calculateHeight(x, z);
    },

    getHeightAt: function (x, z) {
        if (WastelandDungeon.isActive) {
            var ray = new BABYLON.Ray(new BABYLON.Vector3(x, 20, z), new BABYLON.Vector3(0, -1, 0), 40);
            var hit = this.scene.pickWithRay(ray, (mesh) => {
                return mesh.name === "room_floor" || mesh.name === "dungeon_exit" || mesh.name === "corridor_floor";
            });
            if (hit && hit.hit) return hit.pickedPoint.y;
            return 0.1;
        }
        return WastelandWorld.getHeightAt(x, z);
    },

    // O(1) Math-based height for NPCs (No Raycast)
    getHeightFast: function (x, z) {
        if (WastelandDungeon.isActive) return 0.1;
        return WastelandWorld.calculateHeight(x, z);
    },

    // createVegetation moved to WastelandWorld.js

    createBuggy: function (scene) {
        // 1. Physics Root (Invisible Driver)
        this.vehicle = BABYLON.MeshBuilder.CreateBox("carRoot", { width: 1, height: 1, depth: 1 }, scene);
        this.vehicle.isVisible = false;
        this.vehicle.position.y = 10;

        // 2. Synchronous Dummies (Predictive Logic so Update loop doesn't crash)
        this.chassis = new BABYLON.TransformNode("chassis", scene);
        this.chassis.parent = this.vehicle;

        // Dummies for weapons (Invisible cylinders)
        this.leftGun = BABYLON.MeshBuilder.CreateCylinder("lGun", { height: 1, diameter: 0.1 }, scene);
        this.leftGun.isVisible = false;
        this.leftGun.parent = this.chassis;

        this.rightGun = BABYLON.MeshBuilder.CreateCylinder("rGun", { height: 1, diameter: 0.1 }, scene);
        this.rightGun.isVisible = false;
        this.rightGun.parent = this.chassis;

        // 3. Load Visuals
        BABYLON.SceneLoader.ImportMeshAsync("", "WastelandRaiderMax.glb", "", scene).then((result) => {
            var root = result.meshes[0];
            root.parent = this.vehicle;
            var allNodes = result.transformNodes.concat(result.meshes);
            allNodes.forEach(n => {
                if (n.name.includes("Chassis")) this.chassis = n;
                if (n.name.includes("GunL")) { this.leftGun.dispose(); this.leftGun = n; }
                if (n.name.includes("GunR")) { this.rightGun.dispose(); this.rightGun = n; }
            });
            console.log("Buggy Loaded.");
        });

        // 4. Particle & Stats (Re-adding them here)
        this.speed = 0;
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.facingAngle = 0;

        this.dustSystem = new BABYLON.ParticleSystem("dust", 2000, scene);
        this.dustSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
        this.dustSystem.emitter = this.vehicle;
        this.dustSystem.minEmitBox = new BABYLON.Vector3(-1, 0, -2);
        this.dustSystem.maxEmitBox = new BABYLON.Vector3(1, 0, -2.5);
        this.dustSystem.color1 = new BABYLON.Color4(0.8, 0.6, 0.4, 0.5);
        this.dustSystem.color2 = new BABYLON.Color4(0.8, 0.6, 0.4, 0.0);
        this.dustSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
        this.dustSystem.minSize = 0.5; this.dustSystem.maxSize = 1.5;
        this.dustSystem.minLifeTime = 0.5; this.dustSystem.maxLifeTime = 1.5;
        this.dustSystem.emitRate = 0;
        this.dustSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
        this.dustSystem.gravity = new BABYLON.Vector3(0, 0, 0);
        this.dustSystem.direction1 = new BABYLON.Vector3(-1, 2, -1);
        this.dustSystem.direction2 = new BABYLON.Vector3(1, 2, -1);
        this.dustSystem.minAngularSpeed = 0; this.dustSystem.maxAngularSpeed = Math.PI;
        this.dustSystem.start();
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

        // Update Subsystems
        this.updateRadar();
        WastelandNPCs.update(dt, this);
        WastelandCombat.update(dt, this);
        WastelandHero.update(dt, this);

        var accelRate = isTurbo ? baseAccel : (baseAccel * 0.5);
        var turnRate = isTurbo ? 2.5 : 3.5;

        var throttle = 0;
        var steer = 0;

        // Only drive if in car
        if (this.isDriving) {
            if (this.inputMap["w"]) throttle = 1;
            if (this.inputMap["s"]) throttle = -0.5;
            if (this.inputMap["a"]) steer = -1;
            if (this.inputMap["d"]) steer = 1;
        }

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
        if (WastelandWorld.scrapFields && !WastelandDungeon.isActive) {
            for (let i = 0; i < WastelandWorld.scrapFields.length; i++) {
                let s = WastelandWorld.scrapFields[i];
                if (s.isEnabled() && BABYLON.Vector3.Distance(this.vehicle.position, s.position) < 5) {
                    s.setEnabled(false);
                    this.scrap += 10;
                    if (this.dotNetRef) this.dotNetRef.invokeMethodAsync("AddScrap", 10);
                }
            }
        }

        // Dungeon Scrap Collection
        if (WastelandDungeon.isActive && WastelandHero.mesh) {
            for (let m of WastelandDungeon.meshes) {
                if (m.data && m.data.type === "SCRAP" && m.isEnabled()) {
                    if (BABYLON.Vector3.Distance(WastelandHero.mesh.position, m.position) < 3) {
                        m.setEnabled(false);
                        this.scrap += (m.data.amount || 25);
                        if (this.dotNetRef) this.dotNetRef.invokeMethodAsync("AddScrap", m.data.amount || 25);
                    }
                }
            }
        }

        // 11. Refuel logic (Gas Stations)
        if (WastelandWorld.gasStations && this.speed < 5) {
            for (let g of WastelandWorld.gasStations) {
                if (BABYLON.Vector3.Distance(this.vehicle.position, g.position) < 8) {
                    this.fuel += 50 * dt;
                    if (this.fuel > this.stats.vArmor == 2 ? 150 : (this.stats.vArmor == 3 ? 200 : 100)) {
                        // Max Fuel is handled by GameState but we should clamp here too
                    }
                }
            }
        }

        // 12. Siphon Logic (Abandoned Cars)
        if (WastelandWorld.abandonedCars && this.speed < 2) {
            for (let c of WastelandWorld.abandonedCars) {
                if (c.isEnabled() && BABYLON.Vector3.Distance(this.vehicle.position, c.position) < 6) {
                    this.fuel += 10 * dt; // Siphon slowly
                    if (this.fuel > 100) this.fuel = 100;
                    // Optional: Dim/Remove car after siphoning? For now infinite source.
                }
            }
        }

        if (WastelandWorld.ruins && WastelandWorld.ruins.length > 0) {
            // ... (Compass logic logic essentially rendered redundant by radar, but fine to keep HUD text)
        }

        // 13. Update Radar
        // (Moved to top of update loop)

        // --- COMBAT UPDATE ---
        if (this.inputMap[" "]) {
            WastelandCombat.fireMachineGun(this);
        }

        // NPC Proximity Check (Shop/Garage)
        for (var s of WastelandNPCs.shopkeepers) {
            if (BABYLON.Vector3.Distance(this.vehicle.position, s.position) < 15) {
                if (this.inputMap["e"]) {
                    this.inputMap["e"] = false;
                    var type = (s.data && s.data.type) || "SHOP";
                    if (this.dotNetRef) {
                        if (type === "GARAGE") this.dotNetRef.invokeMethodAsync("OpenGarage");
                        else this.dotNetRef.invokeMethodAsync("OpenShop");
                    }
                }
            }
        }

        // Dungeon Proximity Check (Entry)
        if (!WastelandDungeon.isActive) {
            for (var r of WastelandWorld.ruins) {
                if (r.data && r.data.type === "DUNGEON_ENTRANCE") {
                    if (BABYLON.Vector3.Distance(this.vehicle.position, r.position) < 15) {
                        if (this.inputMap["e"]) {
                            this.inputMap["e"] = false;
                            (async () => {
                                await WastelandDungeon.generate(r.data.dungeonId);
                                await WastelandDungeon.enter(this);
                            })();
                        }
                    }
                }
            }
        } else {
            // Dungeon Proximity Check (Exit)
            if (WastelandHero.mesh && WastelandDungeon.exitPoint) {
                if (BABYLON.Vector3.Distance(WastelandHero.mesh.position, WastelandDungeon.exitPoint.position) < 3) {
                    if (this.inputMap["e"]) {
                        this.inputMap["e"] = false;
                        WastelandDungeon.exit(this);
                    }
                }
            }
        }

        // Engine Scaling
        var engineScale = 1.0;
        if (this.stats && this.stats.vEngine) {
            engineScale = 1.0 + (this.stats.vEngine - 1) * 0.25;
        }
        this.velocity.scaleInPlace(engineScale);

        // 14. HUD Update (Always run if defined)
        if (window.updateHud) {
            // Find nearest ruin for distance signal
            var minDist = 99999;
            if (WastelandWorld.ruins) {
                for (var r of WastelandWorld.ruins) {
                    var d = BABYLON.Vector3.Distance(this.vehicle.position, r.position);
                    if (d < minDist) minDist = d;
                }
            }
            var maxFuel = 100;
            if (this.stats && this.stats.vArmor) {
                maxFuel = this.stats.vArmor == 2 ? 150 : (this.stats.vArmor == 3 ? 200 : 100);
            }
            window.updateHud(Math.round(this.speed), Math.round(minDist), this.facingAngle, this.fuel, this.scrap, maxFuel);
        }

        this.frame = (this.frame || 0) + 1;
    },

    // createRuins moved to WastelandWorld.js
    // createScrapFields moved to WastelandWorld.js
    // createGasStations moved to WastelandWorld.js
    // createAbandonedCars moved to WastelandWorld.js

    // Fauna moved to WastelandNPCs.js

    // createSurvivorCamps moved to WastelandWorld.js
    // createBanditCamps moved to WastelandWorld.js

    initRadar: function (scene) {
        WastelandUI.init(scene);
    },

    createBlip: function (targetMesh, color, type) {
        WastelandUI.registerBlip(targetMesh, color, type);
    },

    updateRadar: function () {
        WastelandUI.update(this.vehicle, this.facingAngle);
    },

    // --- COMBAT SYSTEM ---
    // Combat handled by WastelandCombat.js

    // --- ENEMY AI SYSTEM ---
    // Enemy AI handled by WastelandCombat.js

    // Spiders, Helis, Bosses, Survivors moved to WastelandNPCs.js,

    // --- Hero Mode Logic ---

    // toggleVehicle moved to WastelandHero.js
    // updateHero moved to WastelandHero.js
    respawnPlayer: function () {
        // 1. Move Vehicle to Random Point
        var rx = (Math.random() * 800) - 400;
        var rz = (Math.random() * 800) - 400;
        var ry = this.getHeightAt(rx, rz) + 2;

        if (this.vehicle) {
            this.vehicle.position = new BABYLON.Vector3(rx, ry, rz);
            this.velocity = new BABYLON.Vector3(0, 0, 0);
            this.speed = 0;
        }

        // 2. Revive Hero
        WastelandHero.revive(this);

        // 3. Force Drive Mode
        this.isDriving = false; // Set to false so toggleMode switches TO driving
        WastelandHero.toggleMode(this);

        // 4. Reset Camera
        if (this.camera && this.vehicle) {
            this.camera.lockedTarget = this.vehicle;
            this.camera.alpha = -Math.PI / 2;
            this.camera.beta = Math.PI / 3;
            this.camera.radius = 30;
        }

        console.log("Player Respawned at: " + rx + ", " + rz);
    },
    updateHeroHP: function (hp, mana, stamina) {
        if (typeof WastelandHero !== 'undefined' && WastelandHero) {
            WastelandHero.hp = hp;
            WastelandHero.mana = mana;
            if (stamina !== undefined) WastelandHero.stamina = stamina;

            // Force UI update if in combat
            if (WastelandHero.combatTarget) {
                WastelandCombatUI.updateHealthBar(WastelandHero.mesh, hp);
                // Mana and Stamina bars are handled in the main WastelandHero cycle to avoid duplicate GUI updates
            }
        }
    },

    dotNetRef: null,
    setDotNetRef: function (ref) {
        this.dotNetRef = ref;
    }
};
