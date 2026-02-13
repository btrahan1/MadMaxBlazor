var WastelandHero = {
    isActive: false,
    mesh: null,
    limbs: {},
    hp: 100,
    stamina: 100,
    mana: 100,
    skills: {
        "CRUSH": { cooldown: 0, nextUse: 0, active: false, staminaCost: 25, manaCost: 0 },
        "SHOCK": { cooldown: 0, nextUse: 0, active: false, staminaCost: 0, manaCost: 30 },
        "HEAL": { cooldown: 0, nextUse: 0, active: false, staminaCost: 0, manaCost: 0 } // Cost is dynamic (wisdom)
    },
    lastStaminaRegen: 0,
    lastManaRegen: 0,
    combatTarget: null,
    combatTurn: 0, // 0: Hero, 1: NPC
    combatTimer: 0,
    animTimer: 0,
    swingTimer: 0,

    // Core references passed on demand or stored?
    // Passing 'core' to update/toggle is cleaner for context.

    initMesh: async function (scene) {
        if (this.mesh) return;
        try {
            console.log("Loading WastelandHero.glb...");
            let result = await BABYLON.SceneLoader.ImportMeshAsync("", "./", "WastelandHero.glb", scene);
            this.mesh = result.meshes[0];
            this.mesh.scaling = new BABYLON.Vector3(1.0, 1.0, 1.0);
            this.mesh.rotationQuaternion = null;
            this.mesh.rotation = BABYLON.Vector3.Zero();

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
            this.mesh = BABYLON.MeshBuilder.CreateBox("GenericHero", { height: 1.8, width: 0.5, depth: 0.25 }, scene);
        }
    },

    spawn: async function (scene, x, z) {
        await this.initMesh(scene);
        this.mesh.position.set(x, 1, z);
        this.mesh.rotation = BABYLON.Vector3.Zero();
        this.mesh.setEnabled(true);
        this.isActive = true;
    },

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

            await this.initMesh(core.scene);

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
            var targetMesh = this.combatTarget.root || (this.combatTarget.segments ? this.combatTarget.segments[0] : this.combatTarget);
            if (!targetMesh) {
                this.combatTarget = null;
                return;
            }
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
                        var stats = core.stats || { dex: 10, str: 10, int: 10, weaponDamage: 0 };
                        var hitChance = 75 + stats.dex;

                        if (Math.random() * 100 < hitChance) {
                            var bonusDmg = Math.floor(stats.str / 2 + Math.random() * (stats.str / 2));
                            var baseDmg = stats.weaponDamage + bonusDmg;
                            var finalDmg = baseDmg;

                            // Skill Multiplier (Crush)
                            if (this.skills["CRUSH"].active) {
                                finalDmg *= 2;
                                this.skills["CRUSH"].active = false;
                                console.log("CRUSHING BLOW!");
                                WastelandCombatUI.showDamage(targetMesh, "CRUSH!");
                            }

                            // Spell Logic (Shock)
                            if (this.skills["SHOCK"].active) {
                                this.skills["SHOCK"].active = false;
                                var intel = stats.int || 10;
                                var shockDmg = intel + Math.floor(Math.random() * (intel / 2));
                                finalDmg += shockDmg;
                                console.log("SHOCKING STRIKE! " + shockDmg);
                                WastelandCombatUI.showDamage(targetMesh, "SHOCK!");
                            }

                            this.combatTarget.hp -= finalDmg;
                            console.log("Hero hits for " + finalDmg);
                            WastelandCombatUI.showDamage(targetMesh, finalDmg);
                            WastelandCombatUI.updateHealthBar(targetMesh, (this.combatTarget.hp / 25) * 100);
                        } else {
                            WastelandCombatUI.showDamage(targetMesh, "MISS");
                            // Skill is consumed even on miss? User didn't specify, but usually yes for stamina based skills.
                            this.skills["CRUSH"].active = false;
                            this.skills["SHOCK"].active = false;
                        }
                        this.combatTurn = 1;
                    } else {
                        // NPC Turn
                        var hitChance = 75; // NPCs have base 75%
                        if (Math.random() * 100 < hitChance) {
                            var npcDmg = 3 + Math.floor(Math.random() * 4); // 3-6
                            this.hp -= npcDmg;
                            WastelandCombatUI.showDamage(this.mesh, npcDmg);
                            if (core.dotNetRef) {
                                core.dotNetRef.invokeMethodAsync("UpdateHealth", this.hp);
                            }
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

                    if (this.combatTarget.hp <= 0) {
                        console.log("TARGET DESTROYED!");

                        // Award XP (50 for Bandits) and Scrap (25)
                        if (core.dotNetRef) {
                            core.dotNetRef.invokeMethodAsync("AddExperience", 50);
                        }

                        WastelandCombatUI.removeHealthBar(targetMesh);

                        // Removal logic
                        if (this.combatTarget.root) {
                            this.combatTarget.root.dispose();

                            if (WastelandNPCs.coyotes.includes(this.combatTarget)) {
                                WastelandNPCs.coyotes = WastelandNPCs.coyotes.filter(c => c !== this.combatTarget);

                                // Respawn logic (maintain population in wasteland)
                                var spawnRange = 1000;
                                var minSpawnDist = 100;
                                var rx = 0, rz = 0;
                                do {
                                    rx = (Math.random() * spawnRange) - (spawnRange / 2);
                                    rz = (Math.random() * spawnRange) - (spawnRange / 2);
                                } while (BABYLON.Vector3.Distance(this.mesh.position, new BABYLON.Vector3(rx, 0, rz)) < minSpawnDist);
                                WastelandNPCs.spawnCoyote(core.scene, core, rx, rz);
                            } else if (WastelandNPCs.survivors.includes(this.combatTarget)) {
                                WastelandNPCs.survivors = WastelandNPCs.survivors.filter(s => s !== this.combatTarget);
                                // No automatic respawn for survivors/dungeon bandits
                            }
                        } else if (this.combatTarget.segments) {
                            this.combatTarget.segments.forEach(s => s.dispose());
                            WastelandNPCs.snakes = WastelandNPCs.snakes.filter(s => s !== this.combatTarget);

                            // Respawn logic for snakes
                            var spawnRange = 1000;
                            var minSpawnDist = 100;
                            var rx = 0, rz = 0;
                            do {
                                rx = (Math.random() * spawnRange) - (spawnRange / 2);
                                rz = (Math.random() * spawnRange) - (spawnRange / 2);
                            } while (BABYLON.Vector3.Distance(this.mesh.position, new BABYLON.Vector3(rx, 0, rz)) < minSpawnDist);
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

        // Show/Hide Skill UI
        WastelandCombatUI.showSkillUI(this.combatTarget !== null);

        if (this.combatTarget) {
            var maxHP = (core.stats && core.stats.maxHealth) || 100;
            var maxStam = (core.stats && core.stats.maxStamina) || 100;
            var maxMana = (core.stats && core.stats.maxMana) || 100;
            WastelandCombatUI.updateHealthBar(this.mesh, (this.hp / maxHP) * 100);
            WastelandCombatUI.updateStaminaBar(this.mesh, (this.stamina / maxStam) * 100);
            WastelandCombatUI.updateManaBar(this.mesh, (this.mana / maxMana) * 100);
        } else {
            WastelandCombatUI.removeStaminaBar(this.mesh);
            WastelandCombatUI.removeManaBar(this.mesh);
        }

        // --- STAMINA & MANA & SKILL UPDATES ---
        var now = Date.now();
        if (now - this.lastStaminaRegen > 1000) {
            this.lastStaminaRegen = now;
            var maxStam = (core.stats && core.stats.maxStamina) || 100;
            var maxMana = (core.stats && core.stats.maxMana) || 100;

            // CHALLENGE MODE: No automatic regeneration.
            // Players must visit the Medic Tent or use spells.

            // Sync to C# if anything changed (though nothing changes automatically now)
            if (core.dotNetRef) {
                // We keep this call just in case other JS logic modifies vitals
                // core.dotNetRef.invokeMethodAsync("UpdateHealth", this.hp);
                // core.dotNetRef.invokeMethodAsync("UpdateStamina", this.stamina);
                // core.dotNetRef.invokeMethodAsync("UpdateMana", this.mana);
            }
        }

        // update cooldowns
        for (var key in this.skills) {
            var s = this.skills[key];
            if (s.nextUse > now) {
                var remaining = (s.nextUse - now) / 1000;
                var pct = (remaining / 10) * 100; // 10s base
                WastelandCombatUI.updateCooldown(key, pct);
            } else {
                WastelandCombatUI.updateCooldown(key, 0);
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

            if (core.isDriving) {
                this.mesh.position.addInPlace(moveVector);
            } else {
                // Foot collisions in dungeon or wasteland
                this.mesh.moveWithCollisions(moveVector);
            }

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
        this.hp = (core.stats && core.stats.maxHealth) || 100;
        this.stamina = (core.stats && core.stats.maxStamina) || 100;
        this.mana = (core.stats && core.stats.maxMana) || 100;
        this.sentDeathSignal = false;
        if (this.mesh) {
            this.mesh.rotation.z = 0;
            this.mesh.setEnabled(true);
        }
        this.combatTarget = null;
    },

    invokeSkill: function (id, core) {
        var skill = this.skills[id];
        if (!skill) return;

        var now = Date.now();
        if (now < skill.nextUse) {
            console.log(id + " on cooldown!");
            return;
        }

        if (this.stamina < skill.staminaCost) {
            console.log("Not enough stamina for " + id);
            return;
        }
        if (this.mana < (skill.manaCost || 0)) {
            console.log("Not enough mana for " + id);
            return;
        }

        // Special Case: HEAL
        if (id === "HEAL") {
            var wis = core.stats.wis || 10;
            if (this.mana < wis) {
                console.log("Not enough mana for HEAL");
                return;
            }
            if (this.hp >= 100) return;

            console.log("CASTING HEAL");
            this.mana -= wis;
            this.hp += wis;
            var maxHP = (core.stats && core.stats.maxHealth) || 100;
            if (this.hp > maxHP) this.hp = maxHP;

            WastelandCombatUI.showDamage(this.mesh, "HEALED!");

            // Sync to C#
            if (core.dotNetRef) {
                core.dotNetRef.invokeMethodAsync("UpdateHealth", this.hp);
                core.dotNetRef.invokeMethodAsync("UpdateMana", this.mana);
            }

            skill.nextUse = now + 10000;
            return;
        }

        console.log("INVOKING " + id);
        this.stamina -= skill.staminaCost;
        this.mana -= (skill.manaCost || 0);

        // Sync to C# immediately so UI shows resource drop
        if (core.dotNetRef) {
            core.dotNetRef.invokeMethodAsync("UpdateStamina", this.stamina);
            core.dotNetRef.invokeMethodAsync("UpdateMana", this.mana);
        }

        skill.nextUse = now + 10000; // 10s Cooldown
        skill.active = true;
    }
};
