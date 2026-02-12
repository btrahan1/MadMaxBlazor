var WastelandCombatUI = {
    advancedTexture: null,
    activeBars: new Map(), // Mesh -> { bg, bar }

    init: function (scene) {
        // Reuse radar texture or create new
        this.advancedTexture = WastelandUI.radarUI || BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("CombatUI");
    },

    updateHealthBar: function (mesh, percent) {
        if (!this.advancedTexture) return;

        var barData = this.activeBars.get(mesh);

        if (!barData) {
            // Create New Bar
            var container = new BABYLON.GUI.Rectangle();
            container.width = "60px";
            container.height = "10px";
            container.cornerRadius = 2;
            container.color = "black";
            container.thickness = 1;
            container.background = "red";
            this.advancedTexture.addControl(container);
            container.linkWithMesh(mesh);
            container.linkOffsetY = -100;

            var innerBar = new BABYLON.GUI.Rectangle();
            innerBar.width = "100%";
            innerBar.height = "100%";
            innerBar.cornerRadius = 2;
            innerBar.thickness = 0;
            innerBar.background = "green";
            innerBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            container.addControl(innerBar);

            barData = { bg: container, bar: innerBar, lastUpdate: Date.now() };
            this.activeBars.set(mesh, barData);
        }

        // Update Width
        var p = Math.max(0, Math.min(100, percent));
        barData.bar.width = p + "%";
        barData.lastUpdate = Date.now();

        // Cleanup check (separate function ideally, but let's do simple ici)
        if (p <= 0) {
            this.removeHealthBar(mesh);
        }
    },

    removeHealthBar: function (mesh) {
        var barData = this.activeBars.get(mesh);
        if (barData) {
            barData.bg.dispose();
            this.activeBars.delete(mesh);
        }
    },

    showDamage: function (mesh, amount) {
        if (!this.advancedTexture) return;

        var text = new BABYLON.GUI.TextBlock();
        if (amount === "MISS") {
            text.text = "MISS";
            text.color = "gray";
        } else {
            text.text = "-" + amount;
            text.color = "red";
        }
        text.fontSize = 28;
        text.fontWeight = "bold";
        text.outlineColor = "white";
        text.outlineWidth = 2;

        this.advancedTexture.addControl(text);
        text.linkWithMesh(mesh);

        // Random offsets so they don't stack perfectly
        var startY = -120;
        text.linkOffsetY = startY;
        text.linkOffsetX = (Math.random() - 0.5) * 60;

        var life = 0;
        var duration = 3.0; // Last 3 seconds

        var scene = mesh.getScene();
        var obs = scene.onBeforeRenderObservable.add(() => {
            var dt = scene.getEngine().getDeltaTime() / 1000.0;
            life += dt;

            // Float up
            text.linkOffsetY = startY - (life * 80);

            // Fade out in last second
            if (life > duration - 1.0) {
                text.alpha = duration - life;
            }

            if (life >= duration) {
                text.dispose();
                scene.onBeforeRenderObservable.remove(obs);
            }
        });
    }
};
