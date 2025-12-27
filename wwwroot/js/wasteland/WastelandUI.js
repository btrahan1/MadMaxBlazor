var WastelandUI = {
    radarUI: null,
    radarContainer: null,
    radarCar: null,
    radarBlips: [],
    radarRange: 300,

    init: function (scene) {
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

    registerBlip: function (targetMesh, color, type) {
        if (!this.radarContainer) return;

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

    update: function (vehicle, facingAngle) {
        if (!this.radarContainer || !vehicle) return;

        var pPos = vehicle.position;

        // North-Up Radar: Map is fixed. Car rotates.
        if (this.radarCar) {
            this.radarCar.rotation = facingAngle; // Positive rotation
        }

        var radius = 100; // UI pixels radius

        for (var i = this.radarBlips.length - 1; i >= 0; i--) {
            var b = this.radarBlips[i];
            if (!b.mesh || b.mesh.isDisposed()) {
                b.ui.dispose();
                this.radarBlips.splice(i, 1);
                continue;
            }
            if (!b.mesh.isEnabled()) {
                b.ui.isVisible = false;
                continue;
            }

            var tPos = b.mesh.getAbsolutePosition ? b.mesh.getAbsolutePosition() : b.mesh.position;
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
    }
};
