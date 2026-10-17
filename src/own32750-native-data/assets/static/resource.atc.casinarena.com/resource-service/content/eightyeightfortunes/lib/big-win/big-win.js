define(["require", "exports"], function (require, exports) {
    /**
    * @file BigWinCoinEffect.ts
    *
    * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
    */
    /**
     * The particle effect for big win coins and gems
     */
    var BigWinCoinEffect = (function () {
        /**
         * Create a BigWinCoinEffect object
         *
         */
        function BigWinCoinEffect(system, center, left, right) {
            this.system = system;
            this.center = center;
            this.left = left;
            this.right = right;
            center.setParticleSystem(system);
            left.setParticleSystem(system);
            right.setParticleSystem(system);
            left.setRandomSheets([0, 3]);
            right.setRandomSheets([0, 3]);
        }
        /**
         * Play the particle effect
         *
         * @param  level  effect selection
         */
        BigWinCoinEffect.prototype.play = function (level) {
            switch (level) {
                case 0:
                    this.center.setRandomSheets([0]);
                    this.center.play();
                    break;
                case 1:
                    this.center.setRandomSheets([1]);
                    this.center.play();
                    break;
                case 2:
                    this.center.stop();
                    this.left.play();
                    this.right.play();
                    break;
            }
        };
        /**
         * Stop the particle effect
         */
        BigWinCoinEffect.prototype.stop = function () {
            this.center.stop();
            this.left.stop();
            this.right.stop();
        };
        /**
         * Kill any living particles
         */
        BigWinCoinEffect.prototype.reset = function () {
            this.system.clear();
        };
        return BigWinCoinEffect;
    })();
    exports.BigWinCoinEffect = BigWinCoinEffect;
});
