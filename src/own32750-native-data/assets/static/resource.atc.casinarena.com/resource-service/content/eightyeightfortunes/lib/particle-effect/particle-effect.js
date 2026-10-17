define(["require", "exports", "TweenLite"], function (require, exports, TweenLite) {
    /**
     * @file BasicEmitter.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * An emitter that emits particles from a transform
     */
    var BasicEmitter = (function () {
        /**
         * Create a TestEmitter object
         *
         * @param  transform  the transform to use for positions
         */
        function BasicEmitter(transform) {
            var _this = this;
            this.transform = transform;
            this.emitting = false;
            this.rate = 1;
            this.lastTime = 0;
            this.lifetime = 1;
            this.spraySpread = 0;
            this.sprayDirection = 0;
            this.minSpraySpeed = 0;
            this.maxSpraySpeed = 0;
            TweenLite.ticker.addEventListener("tick", function (p) { return _this.update(p); }, this, true, 2);
        }
        /**
         * Set the rate to emit
         *
         * @param  rate  the rate to emit
         */
        BasicEmitter.prototype.setRate = function (rate) {
            this.rate = rate;
        };
        /**
         * Set the lifetime of new particles
         *
         * @param  time  the lifetime
         */
        BasicEmitter.prototype.setLifetime = function (time) {
            this.lifetime = time;
        };
        /**
         * Set the spray speed
         *
         * @param  min  the minimum spray speed
         * @param  max  the maximum spray speed
         */
        BasicEmitter.prototype.setSpraySpeed = function (min, max) {
            this.minSpraySpeed = min;
            this.maxSpraySpeed = max;
        };
        /**
         * The spray spread angle in degrees
         *
         * @param  angle  the angle of the spread
         */
        BasicEmitter.prototype.setSpraySpread = function (angle) {
            this.spraySpread = (angle * 0.5) * (Math.PI / 180);
        };
        /**
         * The direction of the spray in degrees
         *
         * @param  angle  the angle of the spray
         */
        BasicEmitter.prototype.setSprayDirection = function (angle) {
            this.sprayDirection = angle * (Math.PI / 180);
        };
        /**
         * Set the sheet IDs to choose from
         *
         * @param  range  a list of sheet IDs to randomly choose
         */
        BasicEmitter.prototype.setRandomSheets = function (range) {
            this.randomSheets = range;
        };
        /**
         * Set the particle system that the emitter will emit into
         *
         * @param  system  the target particle system
         */
        BasicEmitter.prototype.setParticleSystem = function (system) {
            this.system = system;
        };
        /**
         * Get the root actor of the emitter
         */
        BasicEmitter.prototype.getRoot = function () {
            return this.transform.getActor();
        };
        /**
         * Activate the emitter
         */
        BasicEmitter.prototype.play = function () {
            this.emitting = true;
            this.emitAccum = 0;
            this.lastX = this.transform.getPositionX();
            this.lastY = this.transform.getPositionY();
            this.distX = 0;
            this.distY = 0;
        };
        /**
         * Deactivate the emitter
         */
        BasicEmitter.prototype.stop = function () {
            this.emitting = false;
        };
        /**
         * Update the emitter
         *
         * @param  e  the event object
         */
        BasicEmitter.prototype.update = function (e) {
            var _this = this;
            //Limit update time to a reasonable value to avoid emitting large clumps
            var t = Math.min(e.target.time - this.lastTime, .066);
            this.lastTime = e.target.time;
            //Early out
            if (!this.emitting)
                return;
            //Calculate sweep
            this.distX = this.transform.getPositionX() - this.lastX;
            this.distY = this.transform.getPositionY() - this.lastY;
            this.lastX = this.transform.getPositionX();
            this.lastY = this.transform.getPositionY();
            //Emit some particles
            this.emitAccum += this.rate * t;
            if (this.emitAccum > 1) {
                var emit = Math.floor(this.emitAccum);
                this.emitAccum -= emit;
                if (emit > 0) {
                    this.system.emit(emit, function (p) { return _this.handleBirth(p); });
                }
            }
        };
        /**
         * Initialize particle starting values
         *
         * @param  particle  the particle to initialize
         */
        BasicEmitter.prototype.handleBirth = function (particle) {
            var genRand = function (min, max) {
                return min + Math.random() * (max - min);
            };
            var genRandRound = function (min, max) {
                return Math.round(genRand(min, max));
            };
            //Choose a spritesheet and start frame
            particle.sheetId = 0;
            if (this.randomSheets != undefined) {
                particle.sheetId = this.randomSheets[genRandRound(0, this.randomSheets.length - 1)];
            }
            particle.frame = 0;
            var sheet = this.system.getSpriteSheet(particle.sheetId);
            if (sheet != undefined && sheet.getFrameCount() > 1) {
                particle.frame = genRandRound(0, sheet.getFrameCount() - 1);
            }
            //Choose lifetime
            particle.time = this.lifetime;
            //Choose spray speed and angle
            if (speed != 0) {
                var speed = genRand(this.minSpraySpeed, this.maxSpraySpeed);
                var theta = genRand(-this.spraySpread, this.spraySpread) + this.sprayDirection;
                particle.velocityX = speed * Math.cos(theta);
                particle.velocityY = speed * Math.sin(theta);
            }
            //Sweep between last and current positions
            var sweep = genRand(0, 1);
            particle.positionX = this.transform.getPositionX() - (this.distX * sweep);
            particle.positionY = this.transform.getPositionY() - (this.distY * sweep);
        };
        return BasicEmitter;
    })();
    exports.BasicEmitter = BasicEmitter;
});
