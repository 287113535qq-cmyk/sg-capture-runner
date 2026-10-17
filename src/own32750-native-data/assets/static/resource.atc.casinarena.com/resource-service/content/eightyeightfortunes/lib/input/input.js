define(["require", "exports", "TweenLite"], function (require, exports, TweenLite) {
    var TouchEvent;
    /********************************************************************
     * @file InputResolver.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Handles the actual processing of input and logic to figure out what was touched.
     */
    var InputResolver = (function () {
        /**
         * Create a new InputResolver.
         *
         * @param  x  x coordinate top left corner of bounds checking will start
         * @param  y  y coordinate top left corner of bounds checking will start
         * @param  width  width in pixels the resovler will bounds check
         * @param  height  height in pixels the resovler will bounds check
         */
        function InputResolver(x, y, width, height) {
            this.active = true;
            this.boundsX = x;
            this.boundsY = y;
            this.boundsWidth = width;
            this.boundsHeight = height;
            this.resolverBoundsValid = true;
            this.inputRegions = new Array();
            if (x == undefined || x == null || y == undefined || y == null || width == undefined || width == null || height == undefined || height == null) {
                this.resolverBoundsValid = false;
            }
        }
        /**
         * Set if the resolver is actively handling input
         *
         * @param  active  true if resovler should be active
         */
        InputResolver.prototype.setActive = function (active) {
            this.active = active;
        };
        /**
         * Set the global region for the resolver. This region will send all input no matter if it
         * resolves into the region or not.
         *
         * @param  region  the global region
         */
        InputResolver.prototype.setGlobalRegion = function (region) {
            this.globalRegion = region;
        };
        /**
         * Adds a new input regions to resolver bounds checking
         *
         * @param  region  the new region to add
         */
        InputResolver.prototype.addRegion = function (region) {
            var _this = this;
            region.touchPosX = -1;
            region.touchPosY = -1;
            this.inputRegions.push(region);
            this.inputRegions.sort(function (a, b) { return _this.compareRegionLayer(a, b); });
        };
        /**
         * Handles processing mouse down events
         *
         * @param  x  x position
         * @param  y  y position
         */
        InputResolver.prototype.resolveMouseDown = function (x, y) {
            if (!this.active)
                return;
            if (this.globalRegion != undefined) {
                this.globalRegion.touchPosX = x;
                this.globalRegion.touchPosY = y;
                this.globalRegion.onStart(0, x, y);
            }
            if (this.checkResolverBounds(x, y)) {
                var irCount = this.inputRegions.length;
                for (var i = 0; i < irCount; ++i) {
                    var inputRegion = this.inputRegions[i];
                    if (inputRegion.isActive() && this.checkRegionBounds(x, y, inputRegion)) {
                        inputRegion.touchPosX = x;
                        inputRegion.touchPosY = y;
                        inputRegion.onStart(0, x, y);
                        if (inputRegion.isBlocking())
                            break;
                    }
                }
            }
        };
        /**
         * Handles processing mouse move events
         *
         * @param  x  x position
         * @param  y  y position
         */
        InputResolver.prototype.resolveMouseMove = function (x, y) {
            if (!this.active)
                return;
            if (this.globalRegion != undefined) {
                this.globalRegion.touchPosX = x;
                this.globalRegion.touchPosY = y;
                this.globalRegion.onMove(0, x, y);
            }
            if (this.checkResolverBounds(x, y)) {
                var irCount = this.inputRegions.length;
                for (var i = 0; i < irCount; ++i) {
                    var inputRegion = this.inputRegions[i];
                    if (inputRegion.isActive() && this.checkRegionBounds(x, y, inputRegion)) {
                        inputRegion.touchPosX = x;
                        inputRegion.touchPosY = y;
                        inputRegion.onMove(0, x, y);
                        if (inputRegion.isBlocking())
                            break;
                    }
                }
            }
        };
        /**
         * Handles processing mouse up events
         *
         * @param  x  x position
         * @param  y  y position
         */
        InputResolver.prototype.resolveMouseUp = function (x, y) {
            if (!this.active)
                return;
            if (this.globalRegion != undefined) {
                this.globalRegion.touchPosX = x;
                this.globalRegion.touchPosY = y;
                this.globalRegion.onEnd(0, x, y);
            }
            if (this.checkResolverBounds(x, y)) {
                var irCount = this.inputRegions.length;
                for (var i = 0; i < irCount; ++i) {
                    var inputRegion = this.inputRegions[i];
                    if (inputRegion.isActive() && this.checkRegionBounds(x, y, inputRegion)) {
                        inputRegion.touchPosX = x;
                        inputRegion.touchPosY = y;
                        inputRegion.onEnd(0, x, y);
                        if (inputRegion.isBlocking())
                            break;
                    }
                }
            }
        };
        /**
         * Handles processing touch start events
         *
         * @param  id  touch id
         * @param  x  x position
         * @param  y  y position
         */
        InputResolver.prototype.resolveTouchStart = function (id, x, y) {
            if (!this.active)
                return;
            if (this.globalRegion != undefined) {
                this.globalRegion.touchPosX = x;
                this.globalRegion.touchPosY = y;
                this.globalRegion.onStart(id, x, y);
            }
            if (this.checkResolverBounds(x, y)) {
                var irCount = this.inputRegions.length;
                for (var i = 0; i < irCount; ++i) {
                    var inputRegion = this.inputRegions[i];
                    if (inputRegion.isActive() && this.checkRegionBounds(x, y, inputRegion)) {
                        inputRegion.touchPosX = x;
                        inputRegion.touchPosY = y;
                        inputRegion.onStart(id, x, y);
                        if (inputRegion.isBlocking())
                            break;
                    }
                }
            }
        };
        /**
         * Handles processing touch move events
         *
         * @param  id  touch id
         * @param  x  x position
         * @param  y  y position
         */
        InputResolver.prototype.resolveTouchMove = function (id, x, y) {
            if (!this.active)
                return;
            if (this.globalRegion != undefined) {
                this.globalRegion.touchPosX = x;
                this.globalRegion.touchPosY = y;
                this.globalRegion.onMove(id, x, y);
            }
            if (this.checkResolverBounds(x, y)) {
                var irCount = this.inputRegions.length;
                for (var i = 0; i < irCount; ++i) {
                    var inputRegion = this.inputRegions[i];
                    if (inputRegion.isActive() && this.checkRegionBounds(x, y, inputRegion)) {
                        inputRegion.touchPosX = x;
                        inputRegion.touchPosY = y;
                        inputRegion.onMove(id, x, y);
                        if (inputRegion.isBlocking())
                            break;
                    }
                }
            }
        };
        /**
         * Handles processing touch end events
         *
         * @param  id  touch id
         */
        InputResolver.prototype.resolveTouchEnd = function (id) {
            if (!this.active)
                return;
            if (this.globalRegion != undefined) {
                this.globalRegion.onEnd(id, this.globalRegion.touchPosX, this.globalRegion.touchPosY);
                this.globalRegion.touchPosX = -1;
                this.globalRegion.touchPosY = -1;
            }
            var irCount = this.inputRegions.length;
            for (var i = 0; i < irCount; ++i) {
                var inputRegion = this.inputRegions[i];
                if (inputRegion.isActive() && this.checkRegionBounds(inputRegion.touchPosX, inputRegion.touchPosY, inputRegion)) {
                    inputRegion.onEnd(id, inputRegion.touchPosX, inputRegion.touchPosY);
                    inputRegion.touchPosX = -1;
                    inputRegion.touchPosY = -1;
                    if (inputRegion.isBlocking())
                        break;
                }
                inputRegion.touchPosX = -1;
                inputRegion.touchPosY = -1;
            }
        };
        /**
         * Handles processing keyboard down events
         *
         * @param  char  keyboard character
         */
        InputResolver.prototype.resolveKeyDown = function (inputChar) {
            if (!this.active)
                return;
        };
        /**
         * Handles processing keyboard up events
         *
         * @param  char  keyboard character
         */
        InputResolver.prototype.resolveKeyUp = function (inputChar) {
            if (!this.active)
                return;
        };
        /**
         * Checks the bounds of the resolver. Returns true if coords are inside resolver bounds.
         *
         * @param  x  x coordinate
         * @param  y  y coordinate
         */
        InputResolver.prototype.checkResolverBounds = function (x, y) {
            if (!this.resolverBoundsValid) {
                return true;
            }
            return this.checkBounds(x, y, this.boundsX, this.boundsY, this.boundsWidth, this.boundsHeight);
        };
        /**
         * Checks the bounds of a region. Returns true if coords are inside regoin bounds.
         *
         * @param  x  x coordinate
         * @param  y  y coordinate
         * @param  region  region to check bounds on
         */
        InputResolver.prototype.checkRegionBounds = function (x, y, region) {
            return this.checkBounds(x, y, region.getX(), region.getY(), region.getWidth(), region.getHeight());
        };
        /**
         * Checks the bounds of coordinates. Returns true if coords are inside bounds.
         *
         * @param  x  x coordinate
         * @param  y  y coordinate
         * @param  boundsX  x coord of bounds
         * @param  boundsY  y coord of bounds
         * @param  boundsWidth  width of bounds
         * @param  boundsHeight  height of bounds
         */
        InputResolver.prototype.checkBounds = function (x, y, boundsX, boundsY, boundsWidth, boundsHeight) {
            if (x < boundsX || x > (boundsX + boundsWidth)) {
                return false;
            }
            if (y < boundsY || y > (boundsY + boundsHeight)) {
                return false;
            }
            return true;
        };
        /**
         * Checks the z ordering of regions
         *
         * @param  r1  first region
         * @param  r2  second region
         */
        InputResolver.prototype.compareRegionLayer = function (r1, r2) {
            var z1 = r1.getLayer();
            var z2 = r2.getLayer();
            return (z1 != z2) ? (z1 < z2 ? 1 : -1) : (r1 < r2 ? 1 : -1);
        };
        return InputResolver;
    })();
    exports.InputResolver = InputResolver;
    /********************************************************************
     * @file InputHandler.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Sets up input handlers in the browser and forwards input to the resolver
     */
    var InputHandler = (function () {
        /**
         * Create a new InputHandler
         *
         * @param  canvas  the canvas the handler should be listening for input on
         * @param  hasTouch  true if device has touch
         */
        function InputHandler(canvas, hasTouch, useResize) {
            var _this = this;
            this.multiTouchEnabled = false;
            this.canvas = canvas;
            this.currentWidth = canvas.width;
            this.currentHeight = canvas.height;
            this.resolvers = new Array();
            this.coordinateScalarX = 1.0;
            this.coordinateScalarY = 1.0;
            this.checkResponsiveTime = 0;
            this.checkResponsiveTimeout = 0.5;
            if (hasTouch) {
                canvas.addEventListener('touchstart', function (evt) { return _this.handleTouchEvent(evt); }, false);
                canvas.addEventListener('touchmove', function (evt) { return _this.handleTouchEvent(evt); }, false);
                canvas.addEventListener('touchend', function (evt) { return _this.handleTouchEvent(evt); }, false);
                canvas.addEventListener('touchcancel', function (evt) { return _this.handleTouchEvent(evt); }, false);
            }
            else {
                canvas.addEventListener('mousedown', function (evt) { return _this.handleMouseDown(evt); }, false);
                canvas.addEventListener('mousemove', function (evt) { return _this.handleMouseMove(evt); }, false);
                canvas.addEventListener('mouseup', function (evt) { return _this.handleMouseUp(evt); }, false);
                window.addEventListener('keydown', function (evt) { return _this.handleKeyPress(evt); }, false);
                window.addEventListener('keyup', function (evt) { return _this.handleKeyRelease(evt); }, false);
            }
            if (useResize) {
                TweenLite.ticker.addEventListener('tick', function (e) { return _this.handleTick(e); }, this, true, 1);
            }
        }
        /**
         * Set the scaling factor used for input coordinates
         *
         * @param  coordinateScalar  the scaling factor used for input coordinates
         */
        InputHandler.prototype.setCoordinateScalar = function (coordinateScalarX, coordinateScalarY) {
            this.coordinateScalarX = coordinateScalarX;
            this.coordinateScalarY = coordinateScalarY;
        };
        /**
         * Add a resolver to input handling
         *
         * @param  resolver  resolver to add
         */
        InputHandler.prototype.addResolver = function (resolver) {
            this.resolvers.push(resolver);
        };
        /**
         * Handles the tick event from GSAP
         *
         * @param  tickerEvent  contains time info
         */
        InputHandler.prototype.handleTick = function (tickerEvent) {
            this.checkResponsiveTime += tickerEvent.target.time;
            if (this.checkResponsiveTime >= this.checkResponsiveTimeout) {
                this.checkResponsiveTime = 0;
                this.coordinateScalarX = parseFloat(this.canvas.getAttribute('responsiveScaleX'));
                this.coordinateScalarY = parseFloat(this.canvas.getAttribute('responsiveScaleY'));
            }
        };
        /**
         * Handler for mouse down events
         *
         * @param  evt  the event
         */
        InputHandler.prototype.handleMouseDown = function (evt) {
            var rect = this.canvas.getBoundingClientRect();
            var rCount = this.resolvers.length;
            for (var i = 0; i < rCount; ++i) {
                this.resolvers[i].resolveMouseDown((evt.clientX - rect.left) * this.coordinateScalarX, (evt.clientY - rect.top) * this.coordinateScalarY);
            }
        };
        /**
         * Handler for mouse up events
         *
         * @param  evt  the event
         */
        InputHandler.prototype.handleMouseMove = function (evt) {
            var rect = this.canvas.getBoundingClientRect();
            var rCount = this.resolvers.length;
            for (var i = 0; i < rCount; ++i) {
                this.resolvers[i].resolveMouseMove((evt.clientX - rect.left) * this.coordinateScalarX, (evt.clientY - rect.top) * this.coordinateScalarY);
            }
        };
        /**
         * Handler for mouse up events
         *
         * @param    evt    the event
         */
        InputHandler.prototype.handleMouseUp = function (evt) {
            var rect = this.canvas.getBoundingClientRect();
            var rCount = this.resolvers.length;
            for (var i = 0; i < rCount; ++i) {
                this.resolvers[i].resolveMouseUp((evt.clientX - rect.left) * this.coordinateScalarX, (evt.clientY - rect.top) * this.coordinateScalarY);
            }
        };
        /**
         * Process a touch event
         *
         * @param  evt  event to process
         */
        InputHandler.prototype.handleTouchEvent = function (evt) {
            evt.preventDefault();
            var touches = evt.changedTouches;
            var type = evt.type;
            var rect = this.canvas.getBoundingClientRect();
            var touchCnt = this.multiTouchEnabled ? touches.length : 1;
            for (var i = 0; i < touchCnt; ++i) {
                var touch = touches.item(i);
                var id = touch.identifier;
                if (touch.target != this.canvas) {
                    continue;
                }
                if (type == "touchstart") {
                    var rCount = this.resolvers.length;
                    for (var i = 0; i < rCount; ++i) {
                        this.resolvers[i].resolveTouchStart(id, (touch.clientX - rect.left) * this.coordinateScalarX, (touch.clientY - rect.top) * this.coordinateScalarY);
                    }
                }
                else if (type == "touchmove") {
                    var rCount = this.resolvers.length;
                    for (var i = 0; i < rCount; ++i) {
                        this.resolvers[i].resolveTouchMove(id, (touch.clientX - rect.left) * this.coordinateScalarX, (touch.clientY - rect.top) * this.coordinateScalarY);
                    }
                }
                else if ((type == "touchend") || (type == "touchcancel")) {
                    var rCount = this.resolvers.length;
                    for (var i = 0; i < rCount; ++i) {
                        this.resolvers[i].resolveTouchEnd(id);
                    }
                }
            }
        };
        /**
         * Handler for key press events
         *
         * @param  evt  the event
         */
        InputHandler.prototype.handleKeyPress = function (evt) {
            var rCount = this.resolvers.length;
            for (var i = 0; i < rCount; ++i) {
                this.resolvers[i].resolveKeyDown(evt["char"]);
            }
        };
        /**
         * Handler for key release events
         *
         * @param  evt  the event
         */
        InputHandler.prototype.handleKeyRelease = function (evt) {
            var rCount = this.resolvers.length;
            for (var i = 0; i < rCount; ++i) {
                this.resolvers[i].resolveKeyUp(evt["char"]);
            }
        };
        return InputHandler;
    })();
    exports.InputHandler = InputHandler;
});
