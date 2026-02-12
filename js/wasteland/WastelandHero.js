var WastelandHero = {
    isActive: false,
    mesh: null,
    limbs: {},
    hp: 100,
    combatTarget: null,
    combatTurn: 0, // 0: Hero, 1: NPC
    combatTimer: 0,
    animTimer: 0,
    swingTimer: 0,

    // Core references passed on demand or stored?
    // Passing 'core' to update/toggle is cleaner for context.

    toggleMode: async function (core) {
        if (!this.isActive) {
            // EXIT CAR -> ENTER HERO MODE
            if (Math.abs(core.speed) > 5) {
                console.log("Too fast to exit!");
                return;
            }

            var carPos = core.vehicle.position.clone();
            carPos.x += 3; // Eject to side

            // Raycast ground
            var groundY = core.getHeightAt(carPos.x, carPos.z);
            carPos.y = groundY + 0.9;

            // Load Mesh if needed
            if (!this.mesh) {
                try {
                    console.log("Loading WastelandHero.glb...");
                    let result = await BABYLON.SceneLoader.ImportMeshAsync("", "./", "WastelandHero.glb", core.scene);
                    this.mesh = result.meshes[0];

                    // Fix Scale/Rot
                    this.mesh.scaling = new BABYLON.Vector3(1.0, 1.0, 1.0);
                    this.mesh.rotationQuaternion = null;
                    this.mesh.rotation = BABYLON.Vector3.Zero();

                    // Cache Limbs & Fix Quaternions
                    this.limbs = {};
                    let allNodes = result.transformNodes.concat(result.meshes);
                    allNodes.forEach(m => {
                        m.checkCollisions = false;
                        m.isPickable = false;
                        if (m.rotationQuaternion) {
                            m.rotation = m.rotationQuaternion.toEulerAngles();
                            m.rotationQuaternion = null;
                        }
                        if (m.name.includes("leg_l_upper")) this.limbs.legL = m;
                        if (m.name.includes("leg_r_upper")) this.limbs.legR = m;
                        if (m.name.includes("arm_l_shoulder")) this.limbs.armL = m;
                        if (m.name.includes("arm_r_shoulder")) this.limbs.armR = m;
                    });
                } catch (e) {
                    console.warn("Hero GLB not found, using generic box.", e);
                    this.mesh = BABYLON.MeshBuilder.CreateBox("GenericHero", { height: 1.8, width: 0.5, depth: 0.25 }, core.scene);
                }
            }

            this.mesh.position = carPos;
            this.mesh.rotation = BABYLON.Vector3.Zero();
            this.mesh.setEnabled(true);

            // Switch Camera
            core.camera.lockedTarget = this.mesh;
            core.camera.radius = 10;
            core.camera.beta = Math.PI / 3;

            this.isActive = true;
            core.isDriving = false; // Update Core State

        } else {
            // ENTER CAR -> EXIT HERO MODE
            if (!this.mesh) return;

            // Check distance
            var dist = BABYLON.Vector3.Distance(this.mesh.position, core.vehicle.position);
            if (dist < 8.0) {
                console.log("Entering Vehicle...");
                this.isActive = false;
                core.isDriving = true;

                this.mesh.setEnabled(false);

                // Switch Camera
                core.camera.lockedTarget = core.vehicle;
                core.camera.radius = 30;
                core.camera.beta = Math.PI / 3;
            } else {
                console.log("Too far to enter! Dist: " + dist.toFixed(1));
            }
        }
    },

    update: function (dt, core) {
        if (!this.isActive || !this.mesh) return;
        if (!this.mesh.isEnabled()) return;

        // Death Check
        if (this.hp <= 0) {
            if (!this.sentDeathSignal) {
                this.sentDeathSignal = true;
                if (core.dotNetRef) core.dotNetRef.invokeMethodAsync("NotifyDeath");
            }
            WastelandCombatUI.removeHealthBar(this.mesh);
            this.mesh.rotation.z = Math.PI / 2; // Lie down
            this.combatTarget = null;
            return;
        }

        // --- COMBAT LOOP ---
        if (this.combatTarget) {
            var targetMesh = this.combatTarget.root || this.combatTarget.segments[0];
            var dist = BABYLON.Vector3.Distance(this.mesh.position, targetMesh.position);

            // Face Target
            var diff = targetMesh.position.subtract(this.mesh.position);
            this.mesh.rotation.y = Math.atan2(diff.x, diff.z);

            if (dist < 4.0) {
                this.combatTimer -= dt;

                // Combat Visuals (Swing)
                if (this.swingTimer > 0) {
                    this.swingTimer -= dt * 5;
                    var swingScale = Math.sin(this.swingTimer * Math.PI);
                    if (this.limbs.armR) this.limbs.armR.rotation.x = -1.5 * swingScale;
                    if (this.limbs.armL) this.limbs.armL.rotation.x = -0.5 * swingScale;
                }

                if (this.combatTimer <= 0) {
                    this.combatTimer = 2.0; // Wait 2s for next turn

                    if (this.combatTurn === 0) {
                        // Hero Turn
                        this.swingTimer = 1.0;

                        var stats = core.stats || { dex: 10, str: 10, weaponDamage: 0 };
                        var hitChance = 75 + stats.dex;

                        if (Math.random() * 100 < hitChance) {
                            var bonusDmg = Math.floor(stats.str / 2 + Math.random() * (stats.str / 2));
                            var heroDmg = stats.weaponDamage + bonusDmg;
                            this.combatTarget.hp -= heroDmg;
                            console.log("Hero hits for " + heroDmg);
                            WastelandCombatUI.showDamage(targetMesh, heroDmg);
                            WastelandCombatUI.updateHealthBar(targetMesh, (this.combatTarget.hp / 25) * 100);
                        } else {
                            WastelandCombatUI.showDamage(targetMesh, "MISS");
                        }
                        this.combatTurn = 1;
                    } else {
                        // NPC Turn
                        var hitChance = 75; // NPCs have base 75%
                        if (Math.random() * 100 < hitChance) {
                            var npcDmg = 3 + Math.floor(Math.random() * 4); // 3-6
                            this.hp -= npcDmg;
                            WastelandCombatUI.showDamage(this.mesh, npcDmg);
                            WastelandCombatUI.updateHealthBar(this.mesh, this.hp);
                        } else {
                            WastelandCombatUI.showDamage(this.mesh, "MISS");
                        }

                        // Signal NPC to lunge
                        this.combatTarget.visualTimer = 1.0;
                        this.combatTurn = 0;
                    }

                    // HUD Update
                    if (window.updateHud) {
                        window.updateHud(0, Math.round(dist * 10), this.mesh.rotation.y, this.hp, core.scrap);
                    }

                    // Check NPC Death
                    if (this.combatTarget.hp <= 0) {
                        console.log("TARGET DESTROYED!");

                        // Award XP (JS to C#)
                        if (core.dotNetRef) {
                            core.dotNetRef.invokeMethodAsync("AddExperience", 50);
                        }

                        WastelandCombatUI.removeHealthBar(targetMesh);

                        // Respawn logic (maintain population)
                        var spawnRange = 1000;
                        var minSpawnDist = 100;
                        var rx = 0, rz = 0;
                        do {
                            rx = (Math.random() * spawnRange) - (spawnRange / 2);
                            rz = (Math.random() * spawnRange) - (spawnRange / 2);
                        } while (BABYLON.Vector3.Distance(this.mesh.position, new BABYLON.Vector3(rx, 0, rz)) < minSpawnDist);

                        if (this.combatTarget.root) {
                            this.combatTarget.root.dispose();
                            WastelandNPCs.coyotes = WastelandNPCs.coyotes.filter(c => c !== this.combatTarget);
                            WastelandNPCs.spawnCoyote(core.scene, core, rx, rz);
                        } else {
                            this.combatTarget.segments.forEach(s => s.dispose());
                            WastelandNPCs.snakes = WastelandNPCs.snakes.filter(s => s !== this.combatTarget);
                            WastelandNPCs.spawnSnake(core.scene, core, rx, rz);
                        }
                        this.combatTarget = null;
                    }
                }
            } else if (dist > 15.0) {
                // Break Combat if too far
                WastelandCombatUI.removeHealthBar(targetMesh);
                WastelandCombatUI.removeHealthBar(this.mesh);
                this.combatTarget.isFeral = false;
                this.combatTarget = null;
            }
        }

        // Tank Style Controls
        var moveVector = BABYLON.Vector3.Zero();
        var turnSpeed = 3.0 * dt;
        var moveSpeed = 15.0 * dt;

        // Rotation (A/D) - Only if not auto-facing for combat
        if (!this.combatTarget) {
            if (core.inputMap["a"]) this.mesh.rotation.y -= turnSpeed;
            if (core.inputMap["d"]) this.mesh.rotation.y += turnSpeed;
        }

        // Movement (W/S) - Relative to orientation
        var forwardDir = new BABYLON.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));

        if (core.inputMap["w"]) moveVector.addInPlace(forwardDir);
        if (core.inputMap["s"]) moveVector.subtractInPlace(forwardDir);

        if (moveVector.length() > 0) {
            moveVector.normalize().scaleInPlace(moveSpeed);
            this.mesh.position.addInPlace(moveVector);

            // Animation
            this.animTimer += dt * 15;
            var sin = Math.sin(this.animTimer);

            if (this.limbs.legL) this.limbs.legL.rotation.x = sin * 0.8;
            if (this.limbs.legR) this.limbs.legR.rotation.x = -sin * 0.8;
            if (this.limbs.armL) this.limbs.armL.rotation.x = -sin * 0.6;
            if (this.limbs.armR) this.limbs.armR.rotation.x = sin * 0.6;

            // Bobbing & Ground Snap
            var bob = Math.sin(this.animTimer * 2) * 0.05;
            var gY = core.getHeightAt(this.mesh.position.x, this.mesh.position.z);
            this.mesh.position.y = gY + 0.9 + bob;

        } else {
            // Idle
            var gY = core.getHeightAt(this.mesh.position.x, this.mesh.position.z);
            this.mesh.position.y = gY + 0.9;

            // Reset Pose
            if (this.limbs.legL) this.limbs.legL.rotation.x = BABYLON.Scalar.Lerp(this.limbs.legL.rotation.x, 0, 10 * dt);
            if (this.limbs.legR) this.limbs.legR.rotation.x = BABYLON.Scalar.Lerp(this.limbs.legR.rotation.x, 0, 10 * dt);
            if (this.limbs.armL) this.limbs.armL.rotation.x = BABYLON.Scalar.Lerp(this.limbs.armL.rotation.x, 0, 10 * dt);
            if (this.limbs.armR) this.limbs.armR.rotation.x = BABYLON.Scalar.Lerp(this.limbs.armR.rotation.x, 0, 10 * dt);
        }
    },

    revive: function (core) {
        this.hp = 100;
        this.sentDeathSignal = false;
        if (this.mesh) {
            this.mesh.rotation.z = 0;
            this.mesh.setEnabled(true);
        }
        this.combatTarget = null;
    }
};
