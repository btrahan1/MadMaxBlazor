var WastelandCombatUI = {
    advancedTexture: null,
    activeBars: new Map(), // Mesh -> { bg, bar }
    activeStaminaBars: new Map(), // Mesh -> { bg, bar }
    activeManaBars: new Map(), // Mesh -> { bg, bar }

    init: function (scene) {
        if (this.advancedTexture) return;
        // Dedicated foreground UI for combat
        this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("CombatUI", true, scene);
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
            container.background = "rgba(100,0,0,0.5)";
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
        this.removeStaminaBar(mesh);
    },

    updateStaminaBar: function (mesh, percent) {
        if (!this.advancedTexture) return;

        var barData = this.activeStaminaBars.get(mesh);

        if (!barData) {
            // Create New Stamina Bar (Blue)
            var container = new BABYLON.GUI.Rectangle();
            container.width = "60px";
            container.height = "6px";
            container.cornerRadius = 1;
            container.color = "black";
            container.thickness = 1;
            container.background = "rgba(0,0,50,0.5)";
            this.advancedTexture.addControl(container);
            container.linkWithMesh(mesh);
            container.linkOffsetY = -90; // Slightly below health (-100)

            var innerBar = new BABYLON.GUI.Rectangle();
            innerBar.width = "100%";
            innerBar.height = "100%";
            innerBar.cornerRadius = 1;
            innerBar.thickness = 0;
            innerBar.background = "yellow"; // Yellow for Stamina
            innerBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            container.addControl(innerBar);

            barData = { bg: container, bar: innerBar };
            this.activeStaminaBars.set(mesh, barData);
        }

        var p = Math.max(0, Math.min(100, percent));
        barData.bar.width = p + "%";
    },

    updateManaBar: function (mesh, percent) {
        if (!this.advancedTexture) return;

        var barData = this.activeManaBars.get(mesh);

        if (!barData) {
            // Create New Mana Bar (Blue)
            var container = new BABYLON.GUI.Rectangle();
            container.width = "60px";
            container.height = "6px";
            container.cornerRadius = 1;
            container.color = "black";
            container.thickness = 1;
            container.background = "rgba(0,0,100,0.5)";
            this.advancedTexture.addControl(container);
            container.linkWithMesh(mesh);
            container.linkOffsetY = -80; // Below stamina (-90)

            var innerBar = new BABYLON.GUI.Rectangle();
            innerBar.width = "100%";
            innerBar.height = "100%";
            innerBar.cornerRadius = 1;
            innerBar.thickness = 0;
            innerBar.background = "cyan"; // Blue for Mana
            innerBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            container.addControl(innerBar);

            barData = { bg: container, bar: innerBar };
            this.activeManaBars.set(mesh, barData);
        }

        var p = Math.max(0, Math.min(100, percent));
        barData.bar.width = p + "%";
    },

    removeStaminaBar: function (mesh) {
        var barData = this.activeStaminaBars.get(mesh);
        if (barData) {
            barData.bg.dispose();
            this.activeStaminaBars.delete(mesh);
        }
        this.removeManaBar(mesh);
    },

    removeManaBar: function (mesh) {
        var barData = this.activeManaBars.get(mesh);
        if (barData) {
            barData.bg.dispose();
            this.activeManaBars.delete(mesh);
        }
    },

    showDamage: function (mesh, amount) {
        if (!this.advancedTexture) return;

        var text = new BABYLON.GUI.TextBlock();
        if (amount === "MISS") {
            text.text = "MISS";
            text.color = "gray";
        } else if (amount === "CRUSH!") {
            text.text = "CRUSH!";
            text.color = "orange";
            text.fontSize = 40;
        } else {
            text.text = "-" + amount;
            text.color = "red";
        }
        text.fontSize = text.fontSize || 28;
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
    },

    skillUI: null, // Container for all buttons
    skillButtons: {}, // id -> { btn, overlay }

    showSkillUI: function (enabled) {
        if (!this.advancedTexture) return;

        if (enabled) {
            if (this.skillUI) {
                this.skillUI.isVisible = true;
                return;
            }

            // Main Container
            var container = new BABYLON.GUI.StackPanel();
            container.width = "330px";
            container.height = "120px";
            container.isVertical = false; // Horizontal layout
            container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            container.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
            container.top = "-230px";
            container.left = "-20px";
            this.advancedTexture.addControl(container);
            this.skillUI = container;

            this.createSkillBtn("CRUSH", "⚒️", container);
            this.createSkillBtn("SHOCK", "⚡", container);
            this.createSkillBtn("HEAL", "🩹", container);

        } else {
            if (this.skillUI) this.skillUI.isVisible = false;
        }
    },

    createSkillBtn: function (id, iconText, parent) {
        var btn = new BABYLON.GUI.Rectangle();
        btn.width = "100px";
        btn.height = "100px";
        btn.cornerRadius = 10;
        btn.color = id === "CRUSH" ? "orange" : "cyan";
        btn.thickness = 4;
        btn.background = "rgba(0,0,0,0.6)";
        btn.paddingLeft = "5px";
        btn.paddingRight = "5px";
        parent.addControl(btn);

        var txt = new BABYLON.GUI.TextBlock();
        txt.text = iconText + "\n" + id;
        txt.color = "white";
        txt.fontSize = 18;
        txt.fontWeight = "bold";
        btn.addControl(txt);

        var overlay = new BABYLON.GUI.Rectangle();
        overlay.width = "100%";
        overlay.height = "0%";
        overlay.background = "rgba(0,0,0,0.7)";
        overlay.thickness = 0;
        overlay.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        btn.addControl(overlay);

        overlay.isHitTestVisible = false; // Never block parent clicks

        // Visual feedback
        btn.pointerEnterAnimation = () => { btn.color = "gold"; btn.thickness = 3; };
        btn.pointerOutAnimation = () => { btn.color = "white"; btn.thickness = 2; };
        btn.pointerDownAnimation = () => { btn.background = "rgba(255,255,255,0.4)"; };
        btn.pointerUpAnimation = () => { btn.background = "rgba(0,0,0,0.8)"; };

        this.skillButtons[id] = { btn: btn, overlay: overlay };

        btn.isPointerBlocker = true;
        btn.onPointerDownObservable.add(() => {
            console.log("CLICKED SKILL (DOWN): " + id);
            if (window.wastelandRenderer) {
                WastelandHero.invokeSkill(id, window.wastelandRenderer);
            }
        });
    },

    updateCooldown: function (id, percent) {
        var data = this.skillButtons[id];
        if (data) {
            data.overlay.height = percent + "%";
        }
    }
};
