var WastelandCombat = {
    enemies: [],
    projectiles: [],
    masterBullet: null,
    lastFireTime: 0,
    spawnTimer: 0,
    lastRamTime: 0,

    init: function (scene) {
        // Master Bullet (Hidden)
        var master = BABYLON.MeshBuilder.CreateBox("masterBullet", { width: 0.1, height: 0.1, depth: 2 }, scene);
        master.isVisible = false;
        var mat = new BABYLON.StandardMaterial("tracer", scene);
        mat.emissiveColor = new BABYLON.Color3(1, 1, 0);
        mat.disableLighting = true;
        master.material = mat;
        this.masterBullet = master;
        this.projectiles = [];
    },

    fireMachineGun: function (scene, core) {
        if (!this.masterBullet) this.init(scene);

        var now = Date.now();
        if (now - this.lastFireTime < 100) return;
        this.lastFireTime = now;

        var createBullet = (gunNode) => {
            var bullet = this.masterBullet.createInstance("b_" + now);
            var pos = gunNode.getAbsolutePosition();
            bullet.position.copyFrom(pos);
            bullet.rotation.y = -core.facingAngle;

            var speed = 200;
            var dir = new BABYLON.Vector3(Math.sin(core.facingAngle), 0, Math.cos(core.facingAngle));

            this.projectiles.push({
                mesh: bullet,
                direction: dir,
                speed: speed,
                life: 2.0
            });
        };

        createBullet(core.leftGun);
        createBullet(core.rightGun);
    },

    createEnemyBuggy: function (scene, x, z, core) {
        // Root
        var enemy = new BABYLON.MeshBuilder.CreateBox("enemy", { width: 1, height: 1, depth: 1 }, scene);
        enemy.isVisible = false;
        enemy.position = new BABYLON.Vector3(x, 10, z);

        var chassis = new BABYLON.TransformNode("e_chassis", scene);
        chassis.parent = enemy;

        var body = BABYLON.MeshBuilder.CreateBox("e_body", { width: 2.2, height: 0.8, depth: 4.5 }, scene);
        body.parent = chassis; body.position.y = 0.5;
        var mat = new BABYLON.StandardMaterial("e_carMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.5, 0.1, 0.1);
        body.material = mat;

        var cage = BABYLON.MeshBuilder.CreateTorus("e_cage", { diameter: 2.0, thickness: 0.15, tessellation: 10 }, scene);
        cage.parent = chassis; cage.rotation.z = Math.PI / 2; cage.position.z = -0.5; cage.position.y = 1.2; cage.scaling.y = 1.6;

        var wheelMat = new BABYLON.StandardMaterial("e_wheelMat", scene);
        wheelMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        var createWheel = (wx, wz) => {
            var w = BABYLON.MeshBuilder.CreateCylinder("w", { diameter: 1.7, height: 0.8 }, scene);
            w.rotation.z = Math.PI / 2; w.parent = chassis; w.position = new BABYLON.Vector3(wx, 0.4, wz); w.material = wheelMat;
        };
        createWheel(-1.4, 1.8); createWheel(1.4, 1.8);
        createWheel(-1.4, -1.8); createWheel(1.4, -1.8);

        enemy.data = {
            speed: 0,
            velocity: new BABYLON.Vector3(0, 0, 0),
            facingAngle: Math.random() * Math.PI * 2,
            hp: 3
        };

        this.enemies.push(enemy);
        core.createBlip(enemy, "Red", "enemy");
    },

    update: function (dt, core) {
        // 1. Spawning AI
        this.updateSpawning(dt, core);

        // 2. Enemy AI
        this.updateEnemies(dt, core);

        // 3. Projectiles
        this.updateProjectiles(dt, core);
    },

    updateSpawning: function (dt, core) {
        // Debug Spawn
        if (core.inputMap["b"]) {
            core.inputMap["b"] = false;
            var fwd = new BABYLON.Vector3(Math.sin(core.facingAngle), 0, Math.cos(core.facingAngle));
            var spawnPos = core.vehicle.position.add(fwd.scale(20));
            this.createEnemyBuggy(core.scene, spawnPos.x, spawnPos.z, core);
        }

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && WastelandWorld.banditCamps) {
            this.spawnTimer = 3.0;
            for (var camp of WastelandWorld.banditCamps) {
                if (camp.hasSpawned) continue;
                if (BABYLON.Vector3.Distance(core.vehicle.position, camp.position) < 200) {
                    camp.hasSpawned = true;
                    console.log("BANDIT AMBUSH!");
                    for (var i = 0; i < 3; i++) {
                        var angle = i * (Math.PI * 2 / 3);
                        var ex = camp.position.x + Math.sin(angle) * 20;
                        var ez = camp.position.z + Math.cos(angle) * 20;
                        this.createEnemyBuggy(core.scene, ex, ez, core);
                    }
                }
            }
        }
    },

    updateEnemies: function (dt, core) {
        for (var i = this.enemies.length - 1; i >= 0; i--) {
            var e = this.enemies[i];
            var groundH = core.getHeightFast(e.position.x, e.position.z);

            var dx = core.vehicle.position.x - e.position.x;
            var dz = core.vehicle.position.z - e.position.z;
            var desiredAngle = Math.atan2(dx, dz);

            var diff = desiredAngle - e.data.facingAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            var turnRate = 2.0;
            if (diff > 0.1) e.data.facingAngle += turnRate * dt;
            else if (diff < -0.1) e.data.facingAngle -= turnRate * dt;

            if (e.position.y > groundH + 0.5) e.position.y -= 2.0 * dt;
            else e.position.y = groundH + 0.5;

            var forward = new BABYLON.Vector3(Math.sin(e.data.facingAngle), 0, Math.cos(e.data.facingAngle));
            var speed = 100 * core.enemySpeedRatio;

            e.position.x += forward.x * speed * dt;
            e.position.z += forward.z * speed * dt;
            e.rotation.y = e.data.facingAngle;

            // Ramming
            if (BABYLON.Vector3.Distance(core.vehicle.position, e.position) < 3.0) {
                var now = Date.now();
                if (now - this.lastRamTime > 1000) {
                    core.fuel -= 10;
                    this.lastRamTime = now;
                    var pushDir = core.vehicle.position.subtract(e.position).normalize();
                    core.velocity.addInPlace(pushDir.scale(10));
                }
            }
        }
    },

    updateProjectiles: function (dt, core) {
        for (var i = this.projectiles.length - 1; i >= 0; i--) {
            var p = this.projectiles[i];
            p.life -= dt;
            if (p.life <= 0) { p.mesh.dispose(); this.projectiles.splice(i, 1); continue; }

            p.mesh.position.addInPlace(p.direction.scale(p.speed * dt));
            var gy = core.getHeightFast(p.mesh.position.x, p.mesh.position.z);
            if (p.mesh.position.y < gy) { p.mesh.dispose(); this.projectiles.splice(i, 1); continue; }

            // Hit Enemies
            for (var j = this.enemies.length - 1; j >= 0; j--) {
                var e = this.enemies[j];
                if (BABYLON.Vector3.Distance(p.mesh.position, e.position) < 5.0) {
                    p.mesh.dispose(); this.projectiles.splice(i, 1);
                    e.data.hp--;
                    if (e.data.hp <= 0) this.destroyEnemy(e, j, core.scene);
                    break;
                }
            }
        }
    },

    destroyEnemy: function (enemy, index, scene) {
        var explosion = new BABYLON.ParticleSystem("expl", 200, scene);
        explosion.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
        explosion.emitter = enemy.position.clone();
        explosion.emitRate = 2000; explosion.targetStopDuration = 0.1;
        explosion.start();

        enemy.dispose();
        this.enemies.splice(index, 1);
    }
};
