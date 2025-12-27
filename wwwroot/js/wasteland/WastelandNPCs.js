var WastelandNPCs = {
    survivors: [],
    snakes: [],
    coyotes: [],
    spiders: [],
    helis: [],
    bosses: [],
    hydras: [],

    init: function (scene) {
        // Any global init for NPCs
    },

    // --- FAUNA (Snakes/Coyotes) ---
    createSnakes: function (scene, count, core) {
        var snakeMat = new BABYLON.StandardMaterial("snakeMat", scene);
        snakeMat.diffuseColor = new BABYLON.Color3(0.5, 0.4, 0.2); // Sandy
        var patternMat = new BABYLON.StandardMaterial("patternMat", scene);
        patternMat.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1); // Darker pattern
        var eyeMat = new BABYLON.StandardMaterial("eyeMat", scene);
        eyeMat.diffuseColor = BABYLON.Color3.Black();

        for (var i = 0; i < count; i++) {
            var segments = [];
            var range = (i < 2) ? 40 : 1000;
            var headX = (Math.random() * range) - (range / 2);
            var headZ = (Math.random() * range) - (range / 2);

            for (var j = 0; j < 12; j++) {
                var diameter = 1.0;
                if (j === 0) diameter = 1.0; // Head
                else if (j === 1) diameter = 0.65; // Neck
                else if (j > 8) diameter = 1.0 - ((j - 8) * 0.2); // Tapering tail
                else diameter = 1.0 - (j * 0.02); // Body slimming

                var s = BABYLON.MeshBuilder.CreateSphere("s" + i + "_" + j, { diameter: diameter, segments: 8 }, scene);
                s.material = (j % 2 === 0) ? snakeMat : patternMat;

                if (j === 0) {
                    s.scaling.z = 1.4; // Elongate head
                    var eyeL = BABYLON.MeshBuilder.CreateSphere("eyeL", { diameter: 0.15 }, scene);
                    eyeL.material = eyeMat;
                    eyeL.position = new BABYLON.Vector3(-0.25 * diameter, 0.2 * diameter, 0.3 * diameter);
                    eyeL.parent = s;
                    var eyeR = eyeL.clone();
                    eyeR.position.x = 0.25 * diameter;
                    eyeR.parent = s;
                }

                s.position = new BABYLON.Vector3(headX, 0, headZ + (j * 0.4));
                segments.push(s);
            }

            this.snakes.push({
                segments: segments,
                dir: new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
                speed: 3.0 + Math.random(),
                turnTimer: 0
            });
        }
    },

    createCoyotes: function (scene, count, core) {
        var furMat = new BABYLON.StandardMaterial("furMat", scene);
        furMat.diffuseColor = new BABYLON.Color3(0.5, 0.4, 0.3);

        for (var i = 0; i < count; i++) {
            var range = (i < 2) ? 50 : 1000;
            var x = (Math.random() * range) - (range / 2);
            var z = (Math.random() * range) - (range / 2);

            var root = new BABYLON.TransformNode("coyote" + i, scene);
            root.position = new BABYLON.Vector3(x, 0, z);

            var body = BABYLON.MeshBuilder.CreateBox("body", { width: 0.5, height: 0.6, depth: 1.2 }, scene);
            body.parent = root;
            body.position.y = 0.6;
            body.material = furMat;

            var head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.4, height: 0.4, depth: 0.5 }, scene);
            head.parent = body; head.position = new BABYLON.Vector3(0, 0.4, 0.6); head.material = furMat;

            var snout = BABYLON.MeshBuilder.CreateBox("snout", { width: 0.2, height: 0.2, depth: 0.3 }, scene);
            snout.parent = head; snout.position.z = 0.3; snout.material = furMat;

            var earL = BABYLON.MeshBuilder.CreatePolyhedron("earL", { type: 1, size: 0.1 }, scene);
            earL.parent = head; earL.position = new BABYLON.Vector3(-0.15, 0.25, -0.1); earL.material = furMat;
            var earR = earL.clone(); earR.parent = head; earR.position.x = 0.15;

            var tail = BABYLON.MeshBuilder.CreateCylinder("tail", { diameterTop: 0.1, diameterBottom: 0.2, height: 0.8 }, scene);
            tail.parent = body; tail.rotation.x = Math.PI / 4; tail.position = new BABYLON.Vector3(0, 0.1, -0.6); tail.material = furMat;

            var createLeg = (name, dx, dz) => {
                var leg = BABYLON.MeshBuilder.CreateBox(name, { width: 0.15, height: 0.6, depth: 0.15 }, scene);
                leg.parent = body;
                leg.position = new BABYLON.Vector3(dx, -0.3, dz);
                leg.material = furMat;
                leg.setPivotPoint(new BABYLON.Vector3(0, 0.3, 0));
                return leg;
            };

            var f_l = createLeg("LegFL", -0.2, 0.5);
            var f_r = createLeg("LegFR", 0.2, 0.5);
            var b_l = createLeg("LegBL", -0.2, -0.5);
            var b_r = createLeg("LegBR", 0.2, -0.5);

            this.coyotes.push({
                root: root,
                legs: [f_l, f_r, b_l, b_r],
                dir: new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
                speed: 2.0,
                animTime: Math.random() * 100,
                stateTimer: 0
            });
        }
    },

    // --- SURVIVORS ---
    createSurvivor: function (scene, x, z, isBandit) {
        var name = isBandit ? "bandit" : "npc";
        var npc = new BABYLON.TransformNode(name, scene);
        npc.position = new BABYLON.Vector3(x, 10, z);

        npc.data = {
            state: "walk",
            timer: 0.1,
            origin: new BABYLON.Vector3(x, 0, z),
            target: new BABYLON.Vector3(x + 5, 0, z + 5),
            animTime: Math.random() * 100
        };

        var skinMat = new BABYLON.StandardMaterial("skin", scene);
        skinMat.diffuseColor = new BABYLON.Color3(0.8, 0.6, 0.5);
        var clothMat = new BABYLON.StandardMaterial("cloth", scene);
        clothMat.diffuseColor = isBandit ? new BABYLON.Color3(0.6, 0.1, 0.1) : new BABYLON.Color3(0.3, 0.5, 0.8);

        var torso = BABYLON.MeshBuilder.CreateBox("torso", { width: 0.5, height: 0.7, depth: 0.3 }, scene);
        torso.parent = npc; torso.position.y = 1.1; torso.material = clothMat;
        var head = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.35 }, scene);
        head.parent = torso; head.position.y = 0.5; head.material = skinMat;

        var createLimb = (w, h, px, py, pz) => {
            var limb = BABYLON.MeshBuilder.CreateBox("limb", { width: w, height: h, depth: w }, scene);
            var pivot = new BABYLON.TransformNode("piv", scene);
            pivot.parent = npc; pivot.position = new BABYLON.Vector3(px, py, pz);
            limb.parent = pivot; limb.position.y = -h / 2; limb.material = clothMat;
            return pivot;
        };

        npc.limbs = {
            la: createLimb(0.15, 0.6, -0.35, 1.4, 0),
            ra: createLimb(0.15, 0.6, 0.35, 1.4, 0),
            ll: createLimb(0.2, 0.75, -0.15, 0.75, 0),
            rl: createLimb(0.2, 0.75, 0.15, 0.75, 0)
        };

        var bag = BABYLON.MeshBuilder.CreateBox("bag", { width: 0.4, height: 0.5, depth: 0.2 }, scene);
        bag.parent = torso; bag.position.z = -0.25;
        var bagMat = new BABYLON.StandardMaterial("bagMat", scene);
        bagMat.diffuseColor = new BABYLON.Color3(0.3, 0.4, 0.2); bag.material = bagMat;

        this.survivors.push(npc);
    },

    // --- BOSSES & MECS ---
    spawnSpider: function (scene, x, z, core) {
        BABYLON.SceneLoader.ImportMeshAsync("", "./", "Wasteland_Widow.glb", scene).then((result) => {
            var root = result.meshes[0];
            var y = core.getHeightAt(x, z);
            root.position = new BABYLON.Vector3(x, y + 2.5, z);

            var legs = [];
            var allNodes = result.transformNodes.concat(result.meshes);
            allNodes.forEach(n => {
                if (n.name.includes("Leg")) {
                    if (n.rotationQuaternion) {
                        n.rotation = n.rotationQuaternion.toEulerAngles();
                        n.rotationQuaternion = null;
                    }
                    n.metadata = { baseRot: n.rotation.clone(), phase: Math.random() * Math.PI * 2 };
                    legs.push(n);
                }
            });

            this.spiders.push({
                root: root, legs: legs, t: Math.random() * 100,
                speed: 4.0, dir: new BABYLON.Vector3(0, 0, 1),
                targetIndex: Math.floor(Math.random() * 5) // Simplified
            });
        });
    },

    spawnHelicopter: function (scene, x, z, core) {
        BABYLON.SceneLoader.ImportMeshAsync("", "./", "WastelandHellCopter.glb", scene).then((result) => {
            var root = result.meshes[0];
            root.scaling = new BABYLON.Vector3(3.3, 3.3, 3.3);
            var y = core.getHeightAt(x, z);
            root.position = new BABYLON.Vector3(x, y + 6.0, z);

            var mainRotor = null, tailRotor = null;
            result.transformNodes.concat(result.meshes).forEach(n => {
                if (n.rotationQuaternion) { n.rotation = n.rotationQuaternion.toEulerAngles(); n.rotationQuaternion = null; }
                if (n.name.includes("RotorHub")) mainRotor = n;
                if (n.name.includes("TailRotorShaft")) tailRotor = n;
            });

            this.helis.push({ root: root, mainRotor: mainRotor, tailRotor: tailRotor, speed: 15.0, dir: new BABYLON.Vector3(0, 0, 1), targetIndex: 0 });
        });
    },

    spawnNuclearHydra: function (scene, x, z, core) {
        BABYLON.SceneLoader.ImportMeshAsync("", "./", "NuclearHydra.glb", scene).then((result) => {
            var root = result.meshes[0];
            var groundY = core.getHeightAt(x, z);
            root.position = new BABYLON.Vector3(x, groundY + 10, z); // Starts in air
            root.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);

            var parts = {};
            result.transformNodes.concat(result.meshes).forEach(n => {
                if (n.rotationQuaternion) { n.rotation = n.rotationQuaternion.toEulerAngles(); n.rotationQuaternion = null; }
                if (n.name.includes("wing_l_1")) parts.wingL1 = n;
                if (n.name.includes("wing_l_2")) parts.wingL2 = n;
                if (n.name.includes("wing_r_1")) parts.wingR1 = n;
                if (n.name.includes("wing_r_2")) parts.wingR2 = n;
                if (n.name.includes("neck_c")) parts.neckC = n;
                if (n.name.includes("neck_l")) parts.neckL = n;
                if (n.name.includes("neck_r")) parts.neckR = n;
                if (n.name.includes("head_c")) parts.headC = n;
                if (n.name.includes("head_l")) parts.headL = n;
                if (n.name.includes("head_r")) parts.headR = n;
            });

            this.hydras.push({
                root: root,
                parts: parts,
                t: 0,
                hp: 500,
                speed: 8.0,
                dir: new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
            });

            core.createBlip(root, "Magenta", "boss");
            console.log("THE NUCLEAR HYDRA HAS AWAKENED!");
        });
    },

    createBossTanker: function (scene, x, z, core) {
        var cab = new BABYLON.MeshBuilder.CreateBox("bossCab", { width: 3.5, height: 4, depth: 5 }, scene);
        cab.position = new BABYLON.Vector3(x, 10, z);
        var cabMat = new BABYLON.StandardMaterial("cabMat", scene);
        cabMat.diffuseColor = new BABYLON.Color3(0.4, 0.1, 0.1); cab.material = cabMat;

        var wheelMat = new BABYLON.StandardMaterial("bossWheel", scene);
        wheelMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);

        var addWheel = (parent, wx, wz) => {
            var w = BABYLON.MeshBuilder.CreateCylinder("bw", { diameter: 2.5, height: 1.2 }, scene);
            w.rotation.z = Math.PI / 2; w.parent = parent; w.position = new BABYLON.Vector3(wx, -1, wz); w.material = wheelMat;
        };
        addWheel(cab, 2, 1.5); addWheel(cab, -2, 1.5);
        addWheel(cab, 2, -1.5); addWheel(cab, -2, -1.5);

        var trailer = BABYLON.MeshBuilder.CreateCylinder("trailer", { diameter: 3.5, height: 12 }, scene);
        trailer.rotation.x = Math.PI / 2;
        trailer.material = new BABYLON.StandardMaterial("tankMat", scene);
        trailer.material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.75);

        var tChassis = new BABYLON.TransformNode("tChassis", scene);
        tChassis.parent = trailer; tChassis.rotation.x = -Math.PI / 2;
        addWheel(tChassis, 2, -4); addWheel(tChassis, -2, -4);

        trailer.position = new BABYLON.Vector3(x, 10, z - 8);

        this.bosses.push({ cab: cab, trailer: trailer, dir: new BABYLON.Vector3(0, 0, 1), speed: 5.0, hp: 50, targetIndex: 0 });
        core.createBlip(cab, "Orange", "enemy");
    },

    // --- GLOBAL UPDATE ---
    update: function (dt, core) {
        this.updateFauna(dt, core);
        this.updateSurvivors(dt, core);
        this.updateSpiders(dt, core);
        this.updateHelis(dt, core);
        this.updateBosses(dt, core);
        this.updateHydras(dt, core);
    },

    updateFauna: function (dt, core) {
        // Snakes
        this.snakes.forEach(s => {
            s.turnTimer -= dt;
            if (s.turnTimer <= 0) {
                s.dir = new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                s.turnTimer = 2.0 + Math.random() * 3.0;
            }
            var head = s.segments[0];
            var move = s.dir.scale(s.speed * dt);
            head.position.addInPlace(move);
            head.position.y = core.getHeightFast(head.position.x, head.position.z) + 0.2;
            head.rotation.y = Math.atan2(s.dir.x, s.dir.z);

            for (var i = 1; i < s.segments.length; i++) {
                var curr = s.segments[i], prev = s.segments[i - 1];
                var diff = prev.position.subtract(curr.position);
                var minDist = 0.45;
                if (diff.length() > minDist) {
                    var target = prev.position.subtract(diff.normalize().scale(minDist));
                    curr.position = BABYLON.Vector3.Lerp(curr.position, target, 15 * dt);
                    curr.position.y = core.getHeightFast(curr.position.x, curr.position.z) + 0.2;
                }
                // Face the segment in front
                if (diff.length() > 0.01) {
                    curr.rotation.y = Math.atan2(diff.x, diff.z);
                }
            }
        });

        // Coyotes
        this.coyotes.forEach(c => {
            c.stateTimer -= dt;
            if (c.stateTimer <= 0) {
                c.dir = new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                c.stateTimer = 4.0 + Math.random() * 4.0;
            }
            c.root.position.addInPlace(c.dir.scale(4.0 * dt));
            c.root.position.y = core.getHeightFast(c.root.position.x, c.root.position.z) + 0.5;
            var angle = Math.atan2(c.dir.x, c.dir.z);
            c.root.rotation.y = BABYLON.Scalar.Lerp(c.root.rotation.y, angle, 5.0 * dt);

            c.animTime += dt * 10.0;
            var amp = 0.5;
            c.legs[0].rotation.x = Math.sin(c.animTime) * amp;
            c.legs[3].rotation.x = Math.sin(c.animTime) * amp;
            c.legs[1].rotation.x = Math.cos(c.animTime) * amp;
            c.legs[2].rotation.x = Math.cos(c.animTime) * amp;
        });
    },

    updateSurvivors: function (dt, core) {
        var gravity = 9.8;
        this.survivors.forEach(s => {
            var gH = core.getHeightFast(s.position.x, s.position.z);
            var floor = gH + 1.0;

            if (s.position.y > floor + 0.05) s.position.y -= gravity * dt;
            else s.position.y = floor;

            s.data.timer -= dt;
            if (s.data.timer <= 0) {
                if (s.data.state === "idle") {
                    s.data.state = "walk"; s.data.timer = 5 + Math.random() * 5;
                    var angle = Math.random() * Math.PI * 2;
                    s.data.target.x = s.data.origin.x + Math.sin(angle) * 8;
                    s.data.target.z = s.data.origin.z + Math.cos(angle) * 8;
                } else {
                    s.data.state = "idle"; s.data.timer = 2 + Math.random() * 2;
                }
            }

            if (s.data.state === "walk") {
                var dx = s.data.target.x - s.position.x, dz = s.data.target.z - s.position.z;
                var dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 0.5) s.data.state = "idle";
                else {
                    s.position.x += (dx / dist) * 3 * dt;
                    s.position.z += (dz / dist) * 3 * dt;
                    var desiredAngle = Math.atan2(dx, dz);
                    var diff = desiredAngle - s.rotation.y;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    s.rotation.y += diff * 5 * dt;

                    s.data.animTime += dt * 10;
                    var sin = Math.sin(s.data.animTime);
                    s.limbs.la.rotation.x = sin * 0.5; s.limbs.ra.rotation.x = -sin * 0.5;
                    s.limbs.ll.rotation.x = -sin * 0.5; s.limbs.rl.rotation.x = sin * 0.5;
                }
            } else {
                Object.values(s.limbs).forEach(l => l.rotation.x *= 0.9);
            }
        });
    },

    updateSpiders: function (dt, core) {
        this.spiders.forEach(s => {
            s.t += dt * 15.0;
            s.root.position.addInPlace(s.dir.scale(s.speed * dt));
            s.root.rotation.y = Math.atan2(s.dir.x, s.dir.z);
            var gH = core.getHeightFast(s.root.position.x, s.root.position.z);
            s.root.position.y = BABYLON.Scalar.Lerp(s.root.position.y, gH + 2.5, 10 * dt);

            s.legs.forEach(l => {
                var offset = Math.sin(s.t + l.metadata.phase) * 0.8;
                l.rotation.x = l.metadata.baseRot.x + offset * 0.5;
            });
        });
    },

    updateHelis: function (dt, core) {
        this.helis.forEach(h => {
            var move = h.dir.scale(h.speed * dt);
            h.root.position.addInPlace(move);
            var gH = core.getHeightFast(h.root.position.x, h.root.position.z);
            h.root.position.y = BABYLON.Scalar.Lerp(h.root.position.y, gH + 6.0, 2.0 * dt);
            h.root.rotation.y = Math.atan2(h.dir.x, h.dir.z);
            h.root.rotation.x = 0.2;
            if (h.mainRotor) h.mainRotor.rotation.y += 300 * dt;
            if (h.tailRotor) h.tailRotor.rotation.x += 300 * dt;
        });
    },

    updateBosses: function (dt, core) {
        this.bosses.forEach(b => {
            var move = b.dir.scale(b.speed * dt);
            b.cab.position.addInPlace(move);
            b.cab.position.y = core.getHeightFast(b.cab.position.x, b.cab.position.z) + 2.0;

            var targetAngle = Math.atan2(b.dir.x, b.dir.z);
            var diff = targetAngle - b.cab.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            b.cab.rotation.y += diff * 1.0 * dt;

            // Simple Trailer articulation
            var hitch = b.cab.position.add(new BABYLON.Vector3(Math.sin(b.cab.rotation.y), 0, Math.cos(b.cab.rotation.y)).scale(-5));
            var diffT = hitch.subtract(b.trailer.position);
            if (diffT.length() > 0.5) {
                b.trailer.position = BABYLON.Vector3.Lerp(b.trailer.position, hitch.subtract(diffT.normalize().scale(0.5)), 5 * dt);
                b.trailer.position.y = core.getHeightFast(b.trailer.position.x, b.trailer.position.z) + 2.0;
                b.trailer.rotation.y = Math.atan2(diffT.x, diffT.z);
            }
        });
    },

    updateHydras: function (dt, core) {
        this.hydras.forEach(h => {
            h.t += dt;

            // Movement: Slowly circle/follow player at height
            var dist = BABYLON.Vector3.Distance(h.root.position, core.vehicle.position);
            var targetDir = core.vehicle.position.subtract(h.root.position).normalize();
            targetDir.y = 0;

            if (dist > 50) {
                h.dir = BABYLON.Vector3.Lerp(h.dir, targetDir, 0.5 * dt).normalize();
            } else {
                // Circle behavior
                var right = BABYLON.Vector3.Cross(targetDir, BABYLON.Vector3.Up());
                h.dir = BABYLON.Vector3.Lerp(h.dir, right, 0.5 * dt).normalize();
            }

            h.root.position.addInPlace(h.dir.scale(h.speed * dt));
            var gH = core.getHeightFast(h.root.position.x, h.root.position.z);
            var targetH = gH + 15 + Math.sin(h.t * 0.5) * 5;
            h.root.position.y = BABYLON.Scalar.Lerp(h.root.position.y, targetH, dt);
            h.root.rotation.y = Math.atan2(h.dir.x, h.dir.z);

            // Wing Animation
            var flap = Math.sin(h.t * 3.0);
            if (h.parts.wingL1) h.parts.wingL1.rotation.z = 0.3 + flap * 0.4;
            if (h.parts.wingL2) h.parts.wingL2.rotation.z = flap * 0.5;
            if (h.parts.wingR1) h.parts.wingR1.rotation.z = -0.3 - flap * 0.4;
            if (h.parts.wingR2) h.parts.wingR2.rotation.z = -flap * 0.5;

            // Neck Weaving
            var weave = Math.sin(h.t * 1.5);
            if (h.parts.neckC) { h.parts.neckC.rotation.y = weave * 0.2; h.parts.neckC.rotation.x = 0.4 + weave * 0.1; }
            if (h.parts.neckL) { h.parts.neckL.rotation.y = -0.5 + weave * 0.3; h.parts.neckL.rotation.x = weave * 0.2; }
            if (h.parts.neckR) { h.parts.neckR.rotation.y = 0.5 + weave * 0.3; h.parts.neckR.rotation.x = -weave * 0.2; }

            // Heads look at player
            var lookAtPlayer = (head) => {
                if (!head) return;
                var currentRot = head.rotation.clone();
                head.lookAt(core.vehicle.position);
                // Constrain lookAt if needed, or just let it be creepy
                // head.rotation.x = currentRot.x; // Keep pitch if preferred
            };
            lookAtPlayer(h.parts.headC);
            lookAtPlayer(h.parts.headL);
            lookAtPlayer(h.parts.headR);
        });
    }
};
