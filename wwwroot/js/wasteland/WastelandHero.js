var WastelandHero = {
    isActive: false, // Replaces isDriving logic (isActive = NOT driving)
    mesh: null,
    limbs: {},
    animTimer: 0,

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
        if (!this.isActive || !this.mesh || !this.mesh.isEnabled()) return;

        var speed = 15.0 * dt; // Match previous speed tweak (15 * dt)
        var moveVector = BABYLON.Vector3.Zero();

        // Cam Relative Input
        var forward = core.camera.getForwardRay().direction;
        var right = core.camera.getDirection(BABYLON.Vector3.Right());

        forward.y = 0; forward.normalize();
        right.y = 0; right.normalize();

        if (core.inputMap["w"]) moveVector.addInPlace(forward);
        if (core.inputMap["s"]) moveVector.subtractInPlace(forward);
        if (core.inputMap["d"]) moveVector.addInPlace(right);
        if (core.inputMap["a"]) moveVector.subtractInPlace(right);

        if (moveVector.length() > 0) {
            moveVector.normalize().scaleInPlace(speed);
            this.mesh.position.addInPlace(moveVector);

            // Rotation
            var targetAngle = Math.atan2(moveVector.x, moveVector.z);
            var currentAngle = this.mesh.rotation.y;

            // Lerp Angle
            var diff = targetAngle - currentAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.mesh.rotation.y += diff * 10.0 * dt;

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
    }
};
