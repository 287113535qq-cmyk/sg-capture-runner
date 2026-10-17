define(["require", "exports", "TimelineMax", "TweenLite"], function (require, exports, TimelineMax, TweenLite) {
    /**
     * @file Controller.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    (function (SpinState) {
        SpinState[SpinState["Stopped"] = 0] = "Stopped";
        SpinState[SpinState["Spinning"] = 1] = "Spinning";
        SpinState[SpinState["Stepping"] = 2] = "Stepping";
        SpinState[SpinState["Splicing"] = 3] = "Splicing";
        SpinState[SpinState["Stopping"] = 4] = "Stopping"; // Bouncing and stopping
    })(exports.SpinState || (exports.SpinState = {}));
    var SpinState = exports.SpinState;
    /**
     * Manages a reel and controls the reel spin animations
     */
    var Controller = (function () {
        /**
         * Create a new Controller object
         *
         * @param  layout   the reel layout
         * @param  profile  the settings that affect spin behavior
         * @param  actorUtil  actor utility
         * @param  tweenUtil  tween utility
         * @param  mathUtil  math utility
         */
        function Controller(layout, profile, tweenUtil, mathUtil) {
            this.onSpinComplete = function () {
            };
            this.onHitAction = function () {
            };
            this.onAdvance = function () {
            };
            this.onSpinStepComplete = function () {
                return false;
            };
            this.layout = layout;
            this.profile = profile;
            this.state = 0 /* Stopped */;
            this.spliceCount = 0;
            this.tweenUtil = tweenUtil;
            this.mathUtil = mathUtil;
            //Set initial symbol order
            this.symbolOrder = new Array(layout.getWindowSize());
            this.resetSymbolOrder();
            this.createSpins();
            this.createBounces();
            this.createSpinSteps();
        }
        /**
         * Set the spin complete callback
         *
         * @param  func  the callback function
         */
        Controller.prototype.setOnSpinComplete = function (func) {
            this.onSpinComplete = func;
        };
        /**
         * Set the hit action callback
         *
         * @param  func  the callback function
         */
        Controller.prototype.setOnHitAction = function (func) {
            this.onHitAction = func;
        };
        /**
         * Set the advance callback
         *
         * @param  func  the callback function
         */
        Controller.prototype.setOnAdvance = function (func) {
            this.onAdvance = func;
        };
        /**
         * Set the spin step complete callback
         *
         * @param  func  the callback function
         */
        Controller.prototype.setOnSpinStepComplete = function (func) {
            this.onSpinStepComplete = func;
        };
        /**
         * Get the spin step complete callback
         */
        Controller.prototype.getOnSpinStepComplete = function () {
            return this.onSpinStepComplete;
        };
        /**
         * Set a multiplier on the spin step so it goes faster
         */
        Controller.prototype.setSpinStepMultiplier = function (value) {
            this.forwardSpinSteps.timeScale(value);
            this.reverseSpinSteps.timeScale(value);
        };
        /**
         * Report if the reel is spinning
         */
        Controller.prototype.isSpinning = function () {
            return (this.state != 0 /* Stopped */);
        };
        /**
         * Get the current state
         */
        Controller.prototype.getState = function () {
            return this.state;
        };
        /**
         * Get the layout
         */
        Controller.prototype.getLayout = function () {
            return this.layout;
        };
        /**
         * Get the symbol window order
         */
        Controller.prototype.getSymbolOrder = function () {
            return this.symbolOrder;
        };
        /**
         * Get the spin profile
         */
        Controller.prototype.getSpinProfile = function () {
            return this.profile;
        };
        /**
         * Start the reel spinning
         */
        Controller.prototype.spin = function () {
            if (this.state == 0 /* Stopped */) {
                this.state = 1 /* Spinning */;
                this.spins.timeScale(1.0);
                this.spins.play(0);
            }
        };
        /**
         * Make the reel spin by one symbol
         *
         * @param  animate  do an animated step
         * @param  forward  true to advance in forward direction
         * @param  overrideState true to spin step the reels regardless of state
         */
        Controller.prototype.spinStep = function (animate, forward, overrideState) {
            if (overrideState === void 0) { overrideState = false; }
            if (this.state == 0 /* Stopped */ || overrideState) {
                if (animate) {
                    this.state = 2 /* Stepping */;
                    this.spinSteps = (forward ? this.forwardSpinSteps : this.reverseSpinSteps);
                    this.spinSteps.play(0);
                }
                else {
                    this.layout.advance(forward ? 1 : -1, this.symbolOrder);
                }
            }
        };
        /**
         * Begin the stop sequence ASAP. Returns the number of symbols that will be spliced.
         *
         * @param  stopIndex  index in strip space to stop at home position
         */
        Controller.prototype.stop = function (stopIndex) {
            if (this.state == 1 /* Spinning */) {
                this.state = 3 /* Splicing */;
                this.spliceCount = this.layout.startSplicing(stopIndex, true);
            }
            return this.spliceCount;
        };
        /**
         * Stop instantly and snap to the given stop
         *
         * @param  stopIndex  index in strip space to stop at home position
         */
        Controller.prototype.forceStop = function (stopIndex) {
            this.resetSpin();
            this.layout.setCurrentIndex(stopIndex, this.symbolOrder);
            this.state = 0 /* Stopped */;
        };
        /**
         * Set the time scale of the reel spin animation
         *
         * @param  scale  amount to scale the spin speed
         * @param  delay  time to wait before applying the time scale
         */
        Controller.prototype.scaleSpin = function (scale, delay) {
            var _this = this;
            TweenLite.delayedCall(delay, function () { return _this.spins.timeScale(scale); });
        };
        /**
         * Overshoot the reel stop and snap back
         */
        Controller.prototype.bounce = function () {
            this.bounces.play(0);
        };
        /**
         * Create the spin timelines
         */
        Controller.prototype.createSpins = function () {
            var _this = this;
            var symbols = new Array();
            for (var i = 0; i < this.layout.getWindowSize(); i++) {
                symbols.push(this.layout.getSymbolActor(i, this.symbolOrder));
            }
            this.spins = SpinFactory.createReelSpin(symbols, this.tweenUtil, this.mathUtil, this.layout.getStartPosition(), this.layout.getEndPosition(), this.profile.spinSpeed, function () { return _this.handleAdvance(); });
        };
        /**
         * Create the bounce timelines
         */
        Controller.prototype.createBounces = function () {
            var _this = this;
            var symbols = new Array();
            for (var i = 0; i < this.layout.getWindowSize(); i++) {
                symbols.push(this.layout.getSymbolActor(i, this.symbolOrder));
            }
            this.bounces = SpinFactory.createReelBounce(symbols, this.tweenUtil, this.mathUtil, this.profile.bounceDistance, this.profile.bounceSpeed, this.profile.bounceEaseOut, this.profile.bounceEaseBack, function () { return _this.handleBounceComplete(); });
        };
        /**
         * Create the spin step timelines
         */
        Controller.prototype.createSpinSteps = function () {
            var _this = this;
            var symbols = new Array();
            for (var i = 0; i < this.layout.getWindowSize(); i++) {
                symbols.push(this.layout.getSymbolActor(i, this.symbolOrder));
            }
            this.forwardSpinSteps = SpinFactory.createReelSpinStep(symbols, this.tweenUtil, this.mathUtil, this.layout.getSymbolSpacing(), this.profile.stepSpeed, function () { return _this.handleSpinStepComplete(true); });
            this.reverseSpinSteps = SpinFactory.createReelSpinStep(symbols, this.tweenUtil, this.mathUtil, -this.layout.getSymbolSpacing(), this.profile.stepSpeed, function () { return _this.handleSpinStepComplete(false); });
        };
        /**
         * Reset symbol order back to the default
         */
        Controller.prototype.resetSymbolOrder = function () {
            for (var i = 0; i < this.symbolOrder.length; i++) {
                this.symbolOrder[i] = i;
            }
        };
        /**
         * A symbol has reached the end of its current spin animation and is wrapping
         * back around to the begin a new cycle.
         */
        Controller.prototype.handleAdvance = function () {
            switch (this.state) {
                case 1 /* Spinning */:
                    {
                        this.advance(false);
                    }
                    break;
                case 3 /* Splicing */:
                    {
                        this.spliceCount--;
                        if (this.spliceCount > 0) {
                            this.advance(false);
                        }
                        else {
                            this.state = 4 /* Stopping */;
                            this.advance(true);
                            this.bounce();
                            this.onHitAction(this);
                        }
                    }
                    break;
            }
            this.onAdvance(this);
        };
        /**
         * The bounce animation is over and the reel is now stopped
         */
        Controller.prototype.handleBounceComplete = function () {
            this.state = 0 /* Stopped */;
            this.onSpinComplete(this);
        };
        /**
         * The spin step animation is over
         *
         * @param  forward  true to advance in forward direction
         */
        Controller.prototype.handleSpinStepComplete = function (forward) {
            this.state = 0 /* Stopped */;
            this.layout.advance(forward ? 1 : -1, this.symbolOrder);
            if (this.onSpinStepComplete(this)) {
                this.spinStep(true, forward);
            }
        };
        /**
         * Advance the reels one step
         *
         * @param  true to reset symbol order
         */
        Controller.prototype.advance = function (reset) {
            if (reset) {
                this.resetSpin();
            }
            else {
                this.symbolOrder.unshift(this.symbolOrder.pop());
            }
            this.layout.advance(1, this.symbolOrder);
        };
        /**
         * Pause and reset the spin animations
         */
        Controller.prototype.resetSpin = function () {
            this.spins.pause(0);
            this.resetSymbolOrder();
        };
        return Controller;
    })();
    exports.Controller = Controller;
    /**
     * @file SpinProfile.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Describes the behavior of a reel spin
     */
    var SpinProfile = (function () {
        function SpinProfile() {
            /** The speed the reel should move during the normal spin */
            this.spinSpeed = 1800;
            /** The speed the reel should move during the bounce */
            this.bounceSpeed = 500;
            /** The speed the reel should move during a spin step */
            this.stepSpeed = 1800;
            /** The distance to overshoot during the bounce */
            this.bounceDistance = 85;
            /** The ease mode to use during the bounce overshoot */
            this.bounceEaseOut = Power1.easeOut;
            /** The ease mode to use during the bounce snap */
            this.bounceEaseBack = Linear.easeNone;
        }
        return SpinProfile;
    })();
    exports.SpinProfile = SpinProfile;
    /**
     * @file Group.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Describes a set of reel spins
     */
    var Group = (function () {
        /**
         * Create a new Group object
         *
         * @param  controllers  the controllers for each reel
         * @param  spinStagger  the time to wait between each reel spin
         * @param  stopStagger  the time to wait between each reel stop
         */
        function Group(controllers, spinStagger, stopStagger) {
            this.controllers = controllers;
            this.stops = new Array();
            this.onSpinComplete = function () {
            };
            this.onReelSpinComplete = function () {
            };
            this.onHitAction = function () {
            };
            this.onConfirmAnticipation = function () {
                return false;
            };
            this.onAdvance = function () {
            };
            this.anticipationDelay = 0;
            this.spinsStarted = false;
            this.stopRequested = false;
            this.delayedStop = null;
            this.stopStagger = new Array();
            this.lockedReels = new Array();
            this.stopOrder = new Array();
            for (var reelId = 0; reelId < this.controllers.length; ++reelId) {
                this.lockedReels.push(false);
                this.stopStagger.push(stopStagger);
                this.stopOrder.push(reelId);
            }
            this.createStopWindows();
            this.connectEvents();
            this.createSpin(spinStagger);
        }
        /**
         * Set the time to spin when in anticipation mode
         *
         * @param  anticipationDelay  time in seconds for anticipation delay
         */
        Group.prototype.setAnticipationDelay = function (anticipationDelay) {
            this.anticipationDelay = anticipationDelay;
        };
        /**
         * Set the function to call when all reels in the group are done spinning
         *
         * @param  func  function to call when spin is complete
         */
        Group.prototype.setOnSpinComplete = function (func) {
            this.onSpinComplete = func;
        };
        /**
         * Set the function to call for spinComplete event from an individual reel
         *
         * @param  func  function to call when an individual reel is complete
         */
        Group.prototype.setOnReelSpinComplete = function (func) {
            this.onReelSpinComplete = func;
        };
        /**
         * Set the function to call when hit action should be performed
         *
         * @param  func  function to call when a hit action should be performed
         */
        Group.prototype.setOnHitAction = function (func) {
            this.onHitAction = func;
        };
        /**
         * Set function that allows game to force more time to pass before stopping a reel.
         * Return true to enter anticipation mode and delay stop.
         *
         * @param  func  function to call when asking about anticipation
         */
        Group.prototype.setOnConfirmAnticipation = function (func) {
            this.onConfirmAnticipation = func;
        };
        /**
         * Set the function to call when the symbols are swapped on a reel
         *
         * @param  func  function to call
         */
        Group.prototype.setOnAdvance = function (func) {
            this.onAdvance = func;
        };
        /**
         * Set the visability of the reels
         *
         * @param  visible  the visibility
         */
        Group.prototype.setVisible = function (visible) {
            for (var i = 0; i < this.controllers.length; i++) {
                this.controllers[i].getLayout().setVisible(visible);
            }
        };
        /**
         * Set a custom stop stagger value
         *
         * @param  reelId  the reelId that the stop stagger applies to
         * @param  delay  the delay in seconds before the given reel stops
         */
        Group.prototype.setStopStagger = function (reelId, delay) {
            this.stopStagger[reelId] = delay;
        };
        /**
         * Set the order the reels will stop
         *
         * @param  order  an array containing reel IDs in the order they should be stopped
         */
        Group.prototype.setStopOrder = function (order) {
            this.stopOrder = order.slice(0);
        };
        /**
         * Lock a reel so it doesn't spin
         *
         * @param  id  the reel id
         */
        Group.prototype.lockReel = function (id) {
            this.lockedReels[id] = true;
        };
        /**
         * Reset the locks on all reels
         */
        Group.prototype.resetLocks = function () {
            for (var id = 0; id < this.lockedReels.length; ++id) {
                this.lockedReels[id] = false;
            }
        };
        /**
         * Start the reel spins
         */
        Group.prototype.spin = function () {
            if (!this.isSpinning()) {
                this.spinsStarted = false;
                this.stopRequested = false;
                this.reelSpin.play(0);
            }
        };
        /**
         * Stop the reel spins ASAP
         *
         * @param  stops  stop positions for reels
         * @param  immediate  should stop all reels at once
         */
        Group.prototype.stop = function (stops, immediate) {
            this.stops = stops.slice(0);
            for (var i = 0; i < stops.length; i++) {
                this.controllers[i].getLayout().getStopWindow(stops[i], this.stopWindows[i]);
            }
            if (this.isSpinning()) {
                if (immediate) {
                    //If there is already a delayed stop scheduled, kill it and stop immediately
                    if (this.delayedStop != null) {
                        this.delayedStop.kill();
                        this.delayedStop = null;
                    }
                    var controllerCnt = this.controllers.length;
                    for (var i = 0; i < controllerCnt; ++i) {
                        this.controllers[i].stop(this.stops[i]);
                    }
                }
                else {
                    this.handleStop(0);
                }
            }
            else if (!immediate) {
                this.stopRequested = true;
            }
        };
        /**
         * Stop instantly and snap to the given stops
         *
         * @param  stops  stop positions for reels
         */
        Group.prototype.forceStop = function (stops) {
            this.stops = stops.slice(0);
            for (var i = 0; i < stops.length; i++) {
                this.controllers[i].getLayout().getStopWindow(stops[i], this.stopWindows[i]);
            }
            var controllerCnt = this.controllers.length;
            for (var i = 0; i < controllerCnt; ++i) {
                this.controllers[i].forceStop(this.stops[i]);
            }
        };
        /**
         * Check if any of the reels are spinning
         */
        Group.prototype.isSpinning = function () {
            if (!this.spinsStarted)
                return false;
            var spinning = false;
            for (var i = 0; i < this.controllers.length; i++) {
                if (this.controllers[i].isSpinning()) {
                    spinning = true;
                    break;
                }
            }
            return spinning;
        };
        /**
         * Get the number of reels in the group
         */
        Group.prototype.getReelCount = function () {
            return this.controllers.length;
        };
        /**
         * Get the reel id of the controller
         *
         * @param  controller  get the reel id of this controller
         */
        Group.prototype.getReelId = function (controller) {
            return this.controllers.indexOf(controller);
        };
        /**
         * The the controller associated with a reel id
         *
         * @param  reelId  the reel id
         */
        Group.prototype.getController = function (reelId) {
            return this.controllers[reelId];
        };
        /**
         * Get the symbol id that will be at the given location when the reels stop
         *
         * @param  reelId  the reel id
         * @param  windowIndex  the window index
         */
        Group.prototype.getStopId = function (reelId, windowIndex) {
            return this.stopWindows[reelId][windowIndex];
        };
        /**
         * Create the timeline that spins the reels
         *
         * @param  stagger  the reel spin stagger time
         */
        Group.prototype.createSpin = function (stagger) {
            var _this = this;
            this.reelSpin = new TimelineMax({ paused: true, onComplete: function () {
                _this.spinsStarted = true;
                if (_this.stopRequested) {
                    _this.stop(_this.stops, false);
                }
            } });
            var spinList = new Array();
            var that = this;
            this.controllers.forEach(function (currentValue, index) {
                spinList.push(function (id) {
                    return function () { return that.spinReel(id); };
                }(index));
            });
            //Start time non-zero as a workaround for a TimelineMax bug - Robby
            this.reelSpin.add(spinList, 0.001, "normal", stagger);
        };
        /**
         * Spin a reel if it's not locked
         *
         * @param  id  the reel id
         */
        Group.prototype.spinReel = function (id) {
            if (!this.lockedReels[id]) {
                this.controllers[id].spin();
            }
        };
        /**
         * Connect controller callbacks
         */
        Group.prototype.connectEvents = function () {
            var _this = this;
            for (var i = 0; i < this.controllers.length; i++) {
                this.controllers[i].setOnSpinComplete(function (controller) {
                    _this.handleSpinComplete(controller);
                });
                this.controllers[i].setOnHitAction(function (controller) {
                    _this.onHitAction(_this.getReelId(controller));
                });
                this.controllers[i].setOnAdvance(function (controller) {
                    _this.onAdvance(_this.getReelId(controller));
                });
            }
        };
        /**
         * Event handler for spinComplete callback
         *
         * @param  controller  event source
         */
        Group.prototype.handleSpinComplete = function (controller) {
            this.onReelSpinComplete(this.getReelId(controller));
            if (!this.isSpinning()) {
                this.onSpinComplete();
            }
        };
        /**
         * Event handler for stop
         *
         * @param  stopIndex  the index into stopOrder selecting the reel to stop
         */
        Group.prototype.handleStop = function (stopIndex) {
            var _this = this;
            var reelId = this.stopOrder[stopIndex];
            if (this.anticipationDelay > 0 && this.onConfirmAnticipation(reelId)) {
                this.delayedStop = TweenLite.delayedCall(this.anticipationDelay, function () {
                    _this.stopReel(stopIndex);
                });
            }
            else {
                this.stopReel(stopIndex);
            }
        };
        /**
         * Stop a reel
         *
         * @param  stopIndex  the index into stopOrder selecting the reel to stop
         */
        Group.prototype.stopReel = function (stopIndex) {
            var _this = this;
            var reelId = this.stopOrder[stopIndex];
            this.delayedStop = null;
            var controller = this.controllers[reelId];
            var layout = controller.getLayout();
            var profile = controller.getSpinProfile();
            var spliceCount = controller.stop(this.stops[reelId]);
            var stopCount = spliceCount - layout.getWindowSize();
            var stopTime = (stopCount * layout.getSymbolSpacing()) / profile.spinSpeed;
            var staggerTime = stopTime + this.stopStagger[reelId];
            if (++stopIndex < this.stopOrder.length) {
                TweenLite.delayedCall(staggerTime, function () { return _this.handleStop(stopIndex); });
            }
        };
        /**
         * Create the stop windows
         */
        Group.prototype.createStopWindows = function () {
            this.stopWindows = new Array();
            for (var i = 0; i < this.controllers.length; i++) {
                var stopWindow = new Array();
                var windowSize = this.controllers[i].getLayout().getWindowSize();
                for (var j = 0; j < windowSize; j++) {
                    stopWindow.push(-1);
                }
                this.stopWindows.push(stopWindow);
            }
        };
        return Group;
    })();
    exports.Group = Group;
    /**
     * @file SpinFactory.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Factory class used to create reels spin animations
     */
    var SpinFactory = (function () {
        function SpinFactory() {
        }
        /**
         * Create a timeline with a symbol spin for each symbol
         *
         * @param  symbols  the symbols to spin
         * @param  tweenUtil  tween utility
         * @param  mathUtil  math utility
         * @param  start  the starting point of the spin
         * @param  end  the ending point of the spin
         * @param  speed  the speed of the spin
         * @param  onAdvance  the function to call when a symbol has reached the end
         *                          of its current cycle
         */
        SpinFactory.createReelSpin = function (symbols, tweenUtil, mathUtil, start, end, speed, onAdvance) {
            var spin = new TimelineMax({ paused: true });
            var spinList = new Array();
            for (var i = 0; i < symbols.length; i++) {
                spinList.push(SpinFactory.createSymbolSpin(symbols[i], tweenUtil, mathUtil, start, end, speed, onAdvance));
            }
            spin.add(spinList);
            return spin;
        };
        /**
         * Create a timeline that spins a symbol forever
         *
         * @param  symbol   the target symbol
         * @param  tweenUtil  tween utility
         * @param  mathUtil  math utility
         * @param  start  the starting point of the spin
         * @param  end  the ending point of the spin
         * @param  speed  the speed of the spin
         * @param  onAdvance  the function to call when a symbol has reached the end
         *                          of its current cycle
         */
        SpinFactory.createSymbolSpin = function (symbol, tweenUtil, mathUtil, start, end, speed, onAdvance) {
            var spin = new TimelineMax();
            var xfm = symbol.getTransform();
            //First exit
            var duration = mathUtil.speedToDurationFromValues1D(xfm.getPositionY(), end, speed);
            spin.add(tweenUtil.moveToAxis(xfm, end, false, duration, Linear.easeNone, onAdvance));
            //Normal spin cycle
            duration = mathUtil.speedToDurationFromValues1D(start, end, speed);
            spin.add(tweenUtil.moveFromToAxis(xfm, start, end, false, duration, Linear.easeNone, null, null, onAdvance).repeat(-1));
            return spin;
        };
        /**
         * Create a timeline with a symbol bounce for each symbol
         *
         * @param  symbols  the symbols to bounce
         * @param  tweenUtil  tween utility
         * @param  mathUtil  math utility
         * @param  distance  the distance the symbol should move before snapping back
         * @param  speed  the average speed of the move
         * @param  easeOut  the ease mode applied to the overshoot motion
         * @param  easeBack  the ease mode applied to the snap back motion
         * @param  onComplete  function to call when bounce is finished
         */
        SpinFactory.createReelBounce = function (symbols, tweenUtil, mathUtil, distance, speed, easeOut, easeBack, onComplete) {
            var bounce = new TimelineMax({ paused: true });
            var bounceList = new Array();
            for (var i = 0; i < symbols.length; i++) {
                bounceList.push(SpinFactory.createSymbolBounce(symbols[i], tweenUtil, mathUtil, distance, speed, easeOut, easeBack));
            }
            bounce.add(bounceList);
            bounce.add(function () { return onComplete(); });
            return bounce;
        };
        /**
         * Create a timeline that makes a symbol overshoot its current position and snap back
         * as if it's attached to a spring
         *
         * @param  symbol  the symbol to bounce
         * @param  tweenUtil  tween utility
         * @param  mathUtil  math utility
         * @param  distance  the distance the symbol should move before snapping back
         * @param  speed  the average speed of the move
         * @param  easeOut  the ease mode applied to the overshoot motion
         * @param  easeBack  the ease mode applied to the snap back motion
         */
        SpinFactory.createSymbolBounce = function (symbol, tweenUtil, mathUtil, distance, speed, easeOut, easeBack) {
            var bounce = new TimelineMax();
            var xfm = symbol.getTransform();
            //Overshoot
            var duration = mathUtil.speedToDuration1D(distance, speed);
            bounce.add(tweenUtil.moveByAxis(xfm, distance, false, duration, easeOut));
            //Snap
            duration = mathUtil.speedToDuration1D(distance, speed);
            bounce.add(tweenUtil.moveByAxis(xfm, -distance, false, duration, easeBack));
            return bounce;
        };
        /**
         * Create a timeline with a symbol spin step for each symbol
         *
         * @param  symbols  the symbols to spin
         * @param  tweenUtil  tween utility
         * @param  mathUtil  math utility
         * @param  distance  the distance to move
         * @param  speed  the speed of the spin
         * @param  onComplete  the function to call when the step is complete
         */
        SpinFactory.createReelSpinStep = function (symbols, tweenUtil, mathUtil, distance, speed, onComplete) {
            var spin = new TimelineMax({ paused: true, onComplete: onComplete });
            var spinList = new Array();
            for (var i = 0; i < symbols.length; i++) {
                spinList.push(SpinFactory.createSymbolSpinStep(symbols[i], tweenUtil, mathUtil, distance, speed));
            }
            spin.add(spinList);
            return spin;
        };
        /**
         * Create a timeline that spins a symbol one step
         *
         * @param  symbol   the target symbol
         * @param  tweenUtil  tween utility
         * @param  mathUtil  math utility
         * @param  distance  the distance to move
         * @param  speed  the speed of the spin
         */
        SpinFactory.createSymbolSpinStep = function (symbol, tweenUtil, mathUtil, distance, speed) {
            var spin = new TimelineMax();
            var xfm = symbol.getTransform();
            var duration = mathUtil.speedToDuration1D(distance, speed);
            spin.add(tweenUtil.moveByAxis(xfm, distance, false, duration, Linear.easeNone, function () {
                xfm.setPositionY(xfm.getPositionY() - distance);
            }));
            return spin;
        };
        return SpinFactory;
    })();
    exports.SpinFactory = SpinFactory;
    /**
     * ReelStopper
     * @class standardreels.IReelStopper
     * @classdesc Manages the stopping of a reel(group).
     */
    var ReelStopper = (function () {
        function ReelStopper(reels) {
            this.reels = reels;
            this.reset();
        }
        /**
         * Called to reset the state when a spin has completed.
         * @method standardreels.ReelStopper#reset
         */
        ReelStopper.prototype.reset = function () {
            this.skillStopRequested = false;
            this.cachedStopPositions = null;
        };
        /**
         * Called when the player requests a skillstop/quickstop.
         * @method standardreels.ReelStopper#requestSkillStop
         */
        ReelStopper.prototype.requestSkillStop = function () {
            this.skillStopRequested = true;
            this.stopReels();
        };
        /**
         * Called when the stop positions are received from the server.
         * @method standardreels.ReelStopper#setStopPositions
         * @param stops The array of stop positions.
         */
        ReelStopper.prototype.setStopPositions = function (stops) {
            this.cachedStopPositions = stops;
            this.stopReels();
        };
        ReelStopper.prototype.stopReels = function () {
            if (this.cachedStopPositions != null) {
                this.reels.stop(this.cachedStopPositions, this.skillStopRequested);
            }
        };
        return ReelStopper;
    })();
    exports.ReelStopper = ReelStopper;
});
