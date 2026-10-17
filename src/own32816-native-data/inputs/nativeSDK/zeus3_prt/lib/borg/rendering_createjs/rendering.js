var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var rendering;
(function (rendering) {
    /**
     * The DisplayObject class implements the IDisplayObject<T> interface.
     *
     * A DisplayObject is a container with no renderable graphics. The DisplayObject class is the base class for most display object classes.
     *
     * Using the DisplayObject directly is not reccomended, instead a class that extends it should be used.
     */
    var DisplayObject = (function (_super) {
        __extends(DisplayObject, _super);
        function DisplayObject(classType) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            _super.call(this);
            /////////////////////////////////////
            ///Properties for interface
            /////////////////////////////////////
            /**
             * @inheritdoc
             */
            this.parent = null;
            this._native = this.createClass(classType, args);
            this.children = [];
            this._interactive = true;
        }
        Object.defineProperty(DisplayObject.prototype, "x", {
            /////////////////////////////////////
            ///Getters tied to native type
            /////////////////////////////////////
            /**
             * @inheritdoc
             */
            get: function () { return this.getNativeDisplayObject().x / rendering.ScaleManager.getPositionScale(); },
            /**
             * @inheritdoc
             */
            set: function (value) { this.getNativeDisplayObject().x = value * rendering.ScaleManager.getPositionScale(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "y", {
            /**
             * @inheritdoc
             */
            get: function () { return this.getNativeDisplayObject().y / rendering.ScaleManager.getPositionScale(); },
            /**
             * @inheritdoc
             */
            set: function (value) { this.getNativeDisplayObject().y = value * rendering.ScaleManager.getPositionScale(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "scaleX", {
            /**
             * @inheritdoc
             */
            get: function () { return this.getNativeDisplayObject().scaleX; },
            /**
             * @inheritdoc
             */
            set: function (value) { this.getNativeDisplayObject().scaleX = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "scaleY", {
            /**
             * @inheritdoc
             */
            get: function () { return this.getNativeDisplayObject().scaleY; },
            /**
             * @inheritdoc
             */
            set: function (value) { this.getNativeDisplayObject().scaleY = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "alpha", {
            /**
             * @inheritdoc
             */
            get: function () { return this.getNativeDisplayObject().alpha; },
            /**
             * @inheritdoc
             */
            set: function (value) { this.getNativeDisplayObject().alpha = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "rotation", {
            /**
             * @inheritdoc
             */
            get: function () { return this.getNativeDisplayObject().rotation; },
            /**
             * @inheritdoc
             */
            set: function (value) { this.getNativeDisplayObject().rotation = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "pivot", {
            /**
             * @inheritdoc
             */
            get: function () { return new rendering.Point(this.getNativeDisplayObject().regX, this.getNativeDisplayObject().regY); },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this.getNativeDisplayObject().regX = value.x;
                this.getNativeDisplayObject().regY = value.y;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "visible", {
            /**
             * @inheritdoc
             */
            get: function () { return this.getNativeDisplayObject().visible; },
            /**
             * @inheritdoc
             */
            set: function (value) { this.getNativeDisplayObject().visible = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "width", {
            /**
             * @inheritdoc
             */
            get: function () {
                if (this.getNativeDisplayObject().getBounds()) {
                    return this.getNativeDisplayObject().getBounds().width / rendering.ScaleManager.getPositionScale();
                }
                return 0;
            },
            /**
             * @inheritdoc
             */
            set: function (value) { console.log("Setting width directly not supported on DisplayObject"); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "height", {
            /**
             * @inheritdoc
             */
            get: function () {
                if (this.getNativeDisplayObject().getBounds()) {
                    return this.getNativeDisplayObject().getBounds().height / rendering.ScaleManager.getPositionScale();
                }
                return 0;
            },
            /**
             * @inheritdoc
             */
            set: function (value) { console.log("Setting height directly not supported on DisplayObject"); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "mask", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._mask;
            },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._native.mask = value.getGraphics();
                if (value) {
                    value.visible = false;
                }
            },
            enumerable: true,
            configurable: true
        });
        /**
         * @inheritdoc
         */
        DisplayObject.prototype.enablePrePostRendering = function () {
            var _this = this;
            if (!this._prePostEnabled) {
                var old = this._native.draw;
                this._native.draw = function (ctx, ignoreCache) {
                    _this.dispatchEvent(new rendering.DisplayEvent(rendering.DisplayEvent.PRE_RENDER, _this, _this.stage.canvas));
                    var sucess = old.apply(_this._native, [ctx, ignoreCache]);
                    _this.dispatchEvent(new rendering.DisplayEvent(rendering.DisplayEvent.POST_RENDER, _this, _this.stage.canvas));
                    return sucess;
                };
                this._prePostEnabled = true;
            }
        };
        /**
         * @inheritdoc
         */
        DisplayObject.prototype.onAdded = function () {
            var _this = this;
            if (!this._listenersAdded) {
                if (this._interactive) {
                    this._native.addEventListener("click", function (event) { _this.onClick(event); });
                    this._native.addEventListener("mousedown", function (event) { _this.onDown(event); });
                    this._native.addEventListener("pressup", function (event) { _this.onUp(event); });
                    this._native.addEventListener("pressmove", function (event) { _this.onMove(event); });
                    this._native.addEventListener("mouseover", function (event) { _this.onOver(event); });
                    this._native.addEventListener("mouseout", function (event) { _this.onOut(event); });
                }
                this._native.addEventListener("tick", function (event) { _this.onUpdate(event); });
                this._listenersAdded = true;
            }
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].stage = this.stage;
                this.children[i].onAdded();
            }
        };
        /**
         * @inheritdoc
         */
        DisplayObject.prototype.onRemoved = function () {
            if (this._listenersAdded) {
                this._native.removeAllEventListeners("click");
                this._native.removeAllEventListeners("mousedown");
                this._native.removeAllEventListeners("pressup");
                this._native.removeAllEventListeners("pressmove");
                this._native.removeAllEventListeners("mouseover");
                this._native.removeAllEventListeners("mouseout");
                this._native.removeAllEventListeners("tick");
                this._listenersAdded = false;
            }
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].stage = null;
                this.children[i].onRemoved();
            }
        };
        Object.defineProperty(DisplayObject.prototype, "interactive", {
            /**
             * @inheritdoc
             */
            set: function (value) {
                var _this = this;
                if (!value) {
                    this._native.removeAllEventListeners("click");
                    this._native.removeAllEventListeners("mousedown");
                    this._native.removeAllEventListeners("pressup");
                    this._native.removeAllEventListeners("pressmove");
                    this._native.removeAllEventListeners("mouseover");
                    this._native.removeAllEventListeners("mouseout");
                }
                else if (this._listenersAdded && !this._interactive) {
                    this._native.addEventListener("click", function (event) { _this.onClick(event); });
                    this._native.addEventListener("mousedown", function (event) { _this.onDown(event); });
                    this._native.addEventListener("pressup", function (event) { _this.onUp(event); });
                    this._native.addEventListener("pressmove", function (event) { _this.onMove(event); });
                    this._native.addEventListener("mouseover", function (event) { _this.onOver(event); });
                    this._native.addEventListener("mouseout", function (event) { _this.onOut(event); });
                }
                this._interactive = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayObject.prototype, "hitArea", {
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._native.hitArea = value;
                for (var i = 0; i < this.children.length; i++) {
                    this.children[i].hitArea = value;
                }
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatches DisplayEvent.ENTER_FRAME each frame.
         */
        DisplayObject.prototype.onUpdate = function (event) {
            if (event === void 0) { event = null; }
            this.dispatchEvent(new rendering.DisplayEvent(rendering.DisplayEvent.ENTER_FRAME, this));
        };
        /**
         * Dispatches InputEvent.CLICK when clicked/touched.
         */
        DisplayObject.prototype.onClick = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.CLICK, this));
        };
        /**
        * Dispatches InputEvent.MOVE when pressed.
        */
        DisplayObject.prototype.onMove = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.MOVE, this, event.stageX, event.stageY));
        };
        /**
         * Dispatches InputEvent.DOWN when pressed.
         */
        DisplayObject.prototype.onDown = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.DOWN, this, event.stageX, event.stageY));
        };
        /**
         * Dispatches InputEvent.UP when released.
         */
        DisplayObject.prototype.onUp = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.UP, this, event.stageX, event.stageY));
        };
        /**
         * Dispatches InputEvent.OVER when hovered over.
         */
        DisplayObject.prototype.onOver = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.OVER, this));
        };
        /**
         * Dispatches InputEvent.OUT when hovered out.
         */
        DisplayObject.prototype.onOut = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.OUT, this));
        };
        /**
         * Creates the specified class with the specified arguments.
         */
        DisplayObject.prototype.createClass = function (classType, args) {
            return new classType(args);
        };
        /**
         * @inheritdoc
         * @param child @inheritdoc
         */
        DisplayObject.prototype.addChild = function (child) {
            if (this._native instanceof createjs.Container) {
                this._native.addChild(child.getNativeDisplayObject());
            }
            else {
                console.log("Error Display Objects cannot have children");
            }
            child.stage = this.stage;
            child.parent = this;
            if (this.children.indexOf(child) == -1) {
                this.children.push(child);
                child.onAdded();
            }
            return child;
        };
        /**
         * @inheritdoc
         * @param child @inheritdoc
         */
        DisplayObject.prototype.addChildAt = function (child, index) {
            if (this._native instanceof createjs.Container) {
                this._native.addChildAt(child.getNativeDisplayObject(), index);
            }
            else {
                console.log("Error Display Objects cannot have children");
            }
            child.stage = this.stage;
            child.parent = this;
            if (this.children.indexOf(child) == -1) {
                this.children.splice(index, 0, child);
                child.onAdded();
            }
            return child;
        };
        /**
         * @inheritdoc
         * @param child @inheritdoc
         */
        DisplayObject.prototype.removeChild = function (child) {
            if (this._native instanceof createjs.Container) {
                this._native.removeChild(child.getNativeDisplayObject());
            }
            else {
                console.log("Error Display Objects cannot have children");
            }
            child.stage = null;
            child.parent = null;
            var i = this.children.indexOf(child);
            if (i > -1) {
                this.children.splice(i, 1);
                child.onRemoved();
            }
            return child;
        };
        /**
         * @inheritdoc
         */
        DisplayObject.prototype.getNativeDisplayObject = function () {
            return this._native;
        };
        return DisplayObject;
    })(borgevent.EventDispatcher);
    rendering.DisplayObject = DisplayObject;
})(rendering || (rendering = {}));
/// <reference path="DisplayObject.ts" />
var rendering;
(function (rendering) {
    /**
     * The Bitmap class implements the IBitmap<T> interface.
     *
     * A Bitmap is a single image that can be manipulated on the stage. A Bitmap also inherits all functionality from DisplayObject.
     */
    var Bitmap = (function (_super) {
        __extends(Bitmap, _super);
        function Bitmap(assetOrFrame) {
            _super.call(this, createjs.Container, assetOrFrame);
        }
        /**
         * Creates the native class instance with the class type and arguments from the constructor
         */
        Bitmap.prototype.createClass = function (classType, args) {
            var container = new createjs.Container();
            var bitmap;
            var assetOrFrame = args[0];
            if (assetOrFrame instanceof assets.Frame) {
                var frame = assetOrFrame;
                bitmap = new createjs.Bitmap(frame.imageAsset.data);
                bitmap.sourceRect = new createjs.Rectangle(frame.x, frame.y, frame.width, frame.height);
            }
            else {
                var asset = assetOrFrame;
                bitmap = new createjs.Bitmap(asset.data);
            }
            container.addChild(bitmap);
            return container;
        };
        return Bitmap;
    })(rendering.DisplayObject);
    rendering.Bitmap = Bitmap;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * DisplayEventBase<T> is extended by DisplayEvent
     *
     * DisplayEvent's are dispatched by IDisplayObject<T> implementations to listeners.
     */
    var DisplayEventBase = (function (_super) {
        __extends(DisplayEventBase, _super);
        /**
         * @param eventName The type of eventName
         * @param @displayObject The IDisplayObject<T> that dispatched the event.
         */
        function DisplayEventBase(eventName, displayObject, canvas, customProperties) {
            if (canvas === void 0) { canvas = null; }
            if (customProperties === void 0) { customProperties = null; }
            _super.call(this, eventName);
            this._displayObject = displayObject;
            this._canvas = canvas;
            this._customProperties = customProperties;
        }
        Object.defineProperty(DisplayEventBase.prototype, "displayObject", {
            /**
             * The IDisplayObject<T> that dispatched the event.
             */
            get: function () {
                return this._displayObject;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayEventBase.prototype, "canvas", {
            /**
             * The canvas the display object draws to.
             */
            get: function () {
                return this._canvas;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DisplayEventBase.prototype, "customProperties", {
            /**
             * Custom set of properties that an event may have.
             */
            get: function () {
                return this._customProperties;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatched every updated frame by an IDisplayObject<T>.
         */
        DisplayEventBase.ENTER_FRAME = "DisplayEvent_ENTER_FRAME";
        /**
         * Dispatched prior to rendering if enablePrePostRendering() has been called
         */
        DisplayEventBase.PRE_RENDER = "DisplayEvent_PRE_RENDER";
        /**
         * Dispatched after rendering if enablePrePostRendering() has been called
         */
        DisplayEventBase.POST_RENDER = "DisplayEvent_POST_RENDER";
        return DisplayEventBase;
    })(borgevent.Event);
    rendering.DisplayEventBase = DisplayEventBase;
})(rendering || (rendering = {}));
/// <reference path="../interface/DisplayEventBase.ts" />
var rendering;
(function (rendering) {
    /**
     * DisplayEvent's are dispatched by IDisplayObject<T> implementations to listeners.
     */
    var DisplayEvent = (function (_super) {
        __extends(DisplayEvent, _super);
        function DisplayEvent() {
            _super.apply(this, arguments);
        }
        return DisplayEvent;
    })(rendering.DisplayEventBase);
    rendering.DisplayEvent = DisplayEvent;
})(rendering || (rendering = {}));
/// <reference path="DisplayObject.ts" />
var rendering;
(function (rendering) {
    /**
     * The DisplayObjectContainer class implements the IDisplayObjectContainer<T> interface.
     *
     * a DisplayObjectContainer is designed for grouping other display objects together rather than displaying it's own content to the user. A DisplayObjectContainer also inherits all functionality from DisplayObject.
     */
    var DisplayObjectContainer = (function (_super) {
        __extends(DisplayObjectContainer, _super);
        function DisplayObjectContainer() {
            _super.call(this, createjs.Container, null);
        }
        /**
         * Creates the native class instance with the class type and arguments from the constructor
         */
        DisplayObjectContainer.prototype.createClass = function (classType, args) {
            return new classType();
        };
        return DisplayObjectContainer;
    })(rendering.DisplayObject);
    rendering.DisplayObjectContainer = DisplayObjectContainer;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * The Ellipse object is an area defined by its position, as indicated by its center point (x, y) and by its half-width and its half-height.
     *
     * @export
     * @class Ellipse
     * @extends {createjs.Shape}
     * @implements {rendering.IEllipse}
     */
    var Ellipse = (function (_super) {
        __extends(Ellipse, _super);
        /**
         * Creates an instance of Ellipse.
         *
         * @param {number} x The X coordinate of the center of the ellipse
         * @param {number} y The Y coordinate of the center of the ellipse
         * @param {number} width The half width of this ellipse
         * @param {number} height The half height of this ellipse
         */
        function Ellipse(x, y, width, height) {
            _super.call(this);
            this.x = x;
            this.y = y;
            this._width = width;
            this._height = height;
            this.render();
        }
        Object.defineProperty(Ellipse.prototype, "width", {
            /**
             * The half width of this ellipse
             *
             * @type {number}
             */
            get: function () {
                return this._width;
            },
            /**
             * The half width of this ellipse
             */
            set: function (value) {
                this._width = value;
                this.render();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Ellipse.prototype, "height", {
            /**
             * The half height of this ellipse
             *
             * @type {number}
             */
            get: function () {
                return this._height;
            },
            /**
             * The half height of this ellipse
             */
            set: function (value) {
                this._height = value;
                this.render();
            },
            enumerable: true,
            configurable: true
        });
        /**
         * renders the DisplayObject for DisplayObject.hitArea
         *
         * @protected
         */
        Ellipse.prototype.render = function () {
            this.graphics.clear();
            this.graphics.beginFill("#ff00ff");
            this.graphics.drawEllipse(0, 0, this._width, this._height);
            this.graphics.endFill();
        };
        return Ellipse;
    })(createjs.Shape);
    rendering.Ellipse = Ellipse;
})(rendering || (rendering = {}));
/// <reference path="DisplayObject.ts" />
var rendering;
(function (rendering) {
    /**
     * The Graphics class implements the IGraphics<T> interface.
     *
     * A Graphics instance can dynamically draw multiple graphics and be added to the display list.
     */
    var Graphics = (function (_super) {
        __extends(Graphics, _super);
        function Graphics() {
            _super.call(this, createjs.Shape);
            this._graphics = this.getNativeDisplayObject();
        }
        /**
         * @inheritdoc
         */
        Graphics.prototype.getGraphics = function () {
            return this._graphics;
        };
        /**
         * @inheritdoc
         */
        Graphics.prototype.createClass = function (classType, args) {
            return new createjs.Shape();
        };
        Object.defineProperty(Graphics.prototype, "scaleX", {
            /**
             * @inheritdoc
             */
            get: function () { return this._graphics.scaleX; },
            /**
             * @inheritdoc
             */
            set: function (value) { this._graphics.scaleX = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Graphics.prototype, "scaleY", {
            /**
             * @inheritdoc
             */
            get: function () { return this._graphics.scaleY; },
            /**
             * @inheritdoc
             */
            set: function (value) { this._graphics.scaleY = value; },
            enumerable: true,
            configurable: true
        });
        /**
         * @inheritdoc
         * @param x @inheritdoc
         * @param y @inheritdoc
         */
        Graphics.prototype.moveTo = function (x, y) {
            this._graphics.graphics.moveTo(x * rendering.ScaleManager.getPositionScale(), y * rendering.ScaleManager.getPositionScale());
            return this;
        };
        /**
         * @inheritdoc
         * @param x @inheritdoc
         * @param y @inheritdoc
         */
        Graphics.prototype.lineTo = function (x, y) {
            this._graphics.graphics.lineTo(x * rendering.ScaleManager.getPositionScale(), y * rendering.ScaleManager.getPositionScale());
            return this;
        };
        /**
         * @inheritdoc
         * @param thickness @inheritdoc
         * @param color @inheritdoc
         * @param alpha @inheritdoc
         * @param caps @inheritdoc
         * @param joints @inheritdoc
         * @param miterLimit @inheritdoc
         */
        Graphics.prototype.lineStyle = function (thickness, color, alpha, caps, joints, miterLimit) {
            this._graphics.graphics.setStrokeStyle(thickness * rendering.ScaleManager.getPositionScale(), caps, joints, miterLimit);
            this._graphics.graphics.beginStroke(this.hex2rgb(color, alpha));
            if (thickness == 0) {
                this._graphics.graphics.endStroke();
            }
            return this;
        };
        /**
         * @inheritdoc
         */
        Graphics.prototype.beginFill = function (color, alpha) {
            this._graphics.graphics.beginFill(this.hex2rgb(color, alpha));
            return this;
        };
        /**
         * @inheritdoc
         */
        Graphics.prototype.endFill = function () {
            this._graphics.graphics.endFill();
            return this;
        };
        /**
         * @inheritdoc
         */
        Graphics.prototype.clear = function () {
            this._graphics.graphics.clear();
            return this;
        };
        /**
         * @inheritdoc
         * @param x @inheritdoc
         * @param y @inheritdoc
         * @param radius @inheritdoc
         */
        Graphics.prototype.drawCircle = function (x, y, radius) {
            this._graphics.graphics.drawCircle(x * rendering.ScaleManager.getPositionScale(), y * rendering.ScaleManager.getPositionScale(), radius * rendering.ScaleManager.getPositionScale());
            return this;
        };
        /**
         * @inheritdoc
         * @param x @inheritdoc
         * @param y @inheritdoc
         * @param width @inheritdoc
         * @param height @inheritdoc
         */
        Graphics.prototype.drawEllipse = function (x, y, width, height) {
            this._graphics.graphics.drawEllipse((x - width / 2) * rendering.ScaleManager.getPositionScale(), (y - height / 2) * rendering.ScaleManager.getPositionScale(), width * rendering.ScaleManager.getPositionScale(), height * rendering.ScaleManager.getPositionScale());
            return this;
        };
        /**
         * @inheritdoc
         * @param x @inheritdoc
         * @param y @inheritdoc
         * @param width @inheritdoc
         * @param height @inheritdoc
         */
        Graphics.prototype.drawRect = function (x, y, width, height) {
            this._graphics.graphics.drawRect(x * rendering.ScaleManager.getPositionScale(), y * rendering.ScaleManager.getPositionScale(), width * rendering.ScaleManager.getPositionScale(), height * rendering.ScaleManager.getPositionScale());
            return this;
        };
        /**
         * @inheritdoc
         * @param x @inheritdoc
         * @param y @inheritdoc
         * @param width @inheritdoc
         * @param height @inheritdoc
         * @param radius @inheritdoc
         */
        Graphics.prototype.drawRoundRect = function (x, y, width, height, radius) {
            this._graphics.graphics.drawRoundRect(x * rendering.ScaleManager.getPositionScale(), y * rendering.ScaleManager.getPositionScale(), width * rendering.ScaleManager.getPositionScale(), height * rendering.ScaleManager.getPositionScale(), radius * rendering.ScaleManager.getPositionScale());
            return this;
        };
        /**
         * @inheritdoc
         *
         * @param {number} x @inheritdoc
         * @param {number} y @inheritdoc
         * @param {number} radius @inheritdoc
         * @param {number} startAngle @inheritdoc
         * @param {number} endAngle @inheritdoc
         * @param {boolean} anticlockwise @inheritdoc
         * @returns {IGraphics<T>} @inheritdoc
         */
        Graphics.prototype.arc = function (x, y, radius, startAngle, endAngle, anticlockwise) {
            if (anticlockwise === void 0) { anticlockwise = false; }
            this._graphics.graphics.arc(x * rendering.ScaleManager.getPositionScale(), y * rendering.ScaleManager.getPositionScale(), radius * rendering.ScaleManager.getPositionScale(), startAngle, endAngle, anticlockwise);
            return this;
        };
        /**
         * @inheritdoc
         *
         * @param {number} x @inheritdoc
         * @param {number} y @inheritdoc
         * @param {number} controlX @inheritdoc
         * @param {number} controlY @inheritdoc
         */
        Graphics.prototype.quadraticCurveTo = function (x, y, controlX, controlY) {
            this._graphics.graphics.quadraticCurveTo(controlX, controlY, x, y);
            return this;
        };
        /**
         * Converts hex and alpha to rgba format
         * @param hex Hex value in format 0x00ff00
         * @param opacity Opacity percentage 0-1
         */
        Graphics.prototype.hex2rgb = function (hex, opacity) {
            var r = (hex >> 16) & 255;
            var g = (hex >> 8) & 255;
            var b = hex & 255;
            return 'rgba(' + [r, g, b, opacity].join(',') + ')';
        };
        return Graphics;
    })(rendering.DisplayObject);
    rendering.Graphics = Graphics;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * InputEventBase<T> is extended by InputEvent
     *
     * InputEvent's are dispatched by IDisplayObject<T> implementations to listeners when an end user interacts with them.
     */
    var InputEventBase = (function (_super) {
        __extends(InputEventBase, _super);
        /**
         * @param eventName The type of event.
         * @param displayObject The IDisplayObject<T> that dispatched the event.
         */
        function InputEventBase(eventName, displayObject, stageX, stageY) {
            if (stageX === void 0) { stageX = 0; }
            if (stageY === void 0) { stageY = 0; }
            _super.call(this, eventName);
            this._displayObject = displayObject;
            this._stageX = stageX;
            this._stageY = stageY;
        }
        Object.defineProperty(InputEventBase.prototype, "displayObject", {
            /**
             * The IDisplayObject<T> that dispatched the event.
             */
            get: function () {
                return this._displayObject;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(InputEventBase.prototype, "stageX", {
            /*
            *   X co-ordinate of the mouse/pointer relative to the stage.
            */
            get: function () {
                return this._stageX;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(InputEventBase.prototype, "stageY", {
            /*
            *   Y co-ordinate of the mouse/pointer relative to the stage.
            */
            get: function () {
                return this._stageY;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatched when an IDisplayObject<T> is clicked/touched.
         */
        InputEventBase.CLICK = "InputEvent_CLICK";
        /**
         * Dispatched when an IDisplayObject<T> is pressed.
         */
        InputEventBase.DOWN = "InputEvent_DOWN";
        /**
         * Dispatched when an IDisplayObject<T> is released.
         */
        InputEventBase.UP = "InputEvent_UP";
        /**
         * Dispatched when an IDisplayObject<T> is hovered over.
         */
        InputEventBase.OVER = "InputEvent_OVER";
        /**
         * Dispatched when an IDisplayObject<T> is hovered out.
         */
        InputEventBase.OUT = "InputEvent_OUT";
        /**
         * Dispatched when the cursor is moved after pressing an IDisplayObject<T>.
         */
        InputEventBase.MOVE = "InputEvent_MOVE";
        return InputEventBase;
    })(borgevent.Event);
    rendering.InputEventBase = InputEventBase;
})(rendering || (rendering = {}));
/// <reference path="../interface/InputEventBase.ts" />
var rendering;
(function (rendering) {
    /**
     * DisplayEvent's are dispatched by IDisplayObject<T> implementations to listeners.
     */
    var InputEvent = (function (_super) {
        __extends(InputEvent, _super);
        function InputEvent() {
            _super.apply(this, arguments);
        }
        return InputEvent;
    })(rendering.InputEventBase);
    rendering.InputEvent = InputEvent;
})(rendering || (rendering = {}));
/// <reference path="DisplayObject.ts" />
var rendering;
(function (rendering) {
    /**
     * The MovieClip class implements the IMovieClip<T> interface.
     *
     * A MovieClip is an animated multi frame image, that can be played, looped or stopped on a specific frame. A MovieClip also inherits all functionality from DisplayObject.
     */
    var MovieClip = (function (_super) {
        __extends(MovieClip, _super);
        function MovieClip(assetOrFrame, useMs) {
            if (useMs === void 0) { useMs = false; }
            _super.call(this, createjs.Container, assetOrFrame);
            this._then = Date.now();
            this._assetOrFrame = assetOrFrame;
            this._fps = 60;
            this._fpsPerSixty = 1;
            this._frameCount = 0;
            this._totalFrames = assetOrFrame.length;
            this._interval = 1000 / this._fps;
            this._useMs = useMs;
        }
        /**
         * Creates the native class instance with the class type and arguments from the constructor
         */
        MovieClip.prototype.createClass = function (classType, args) {
            var container = new createjs.Container();
            var frameAssets = args[0];
            var images = [];
            var frames = [];
            for (var i = 0; i < frameAssets.length; i++) {
                if (frameAssets[i] instanceof assets.Frame) {
                    var frame = frameAssets[i];
                    images.push(frame.imageAsset.data);
                    frames.push([frame.x, frame.y, frame.width, frame.height, i, -frame.pivotX, -frame.pivotY]);
                }
                else {
                    var asset = frameAssets[i];
                    images.push(asset.data);
                    frames.push([0, 0, asset.data.width, asset.data.height, i]);
                }
            }
            var spriteSheet = new createjs.SpriteSheet({ images: images, frames: frames, animations: { main: [0, frameAssets.length - 1] } });
            this._nativeMovieClip = new createjs.Sprite(spriteSheet);
            container.addChild(this._nativeMovieClip);
            return container;
        };
        /**
         * @inheritdoc
         */
        MovieClip.prototype.clone = function () {
            return new MovieClip(this._assetOrFrame);
        };
        Object.defineProperty(MovieClip.prototype, "currentFrame", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._nativeMovieClip.currentFrame;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MovieClip.prototype, "totalFrames", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._nativeMovieClip.spriteSheet.getNumFrames(null);
            },
            enumerable: true,
            configurable: true
        });
        /**
         * @inheritdoc
         */
        MovieClip.prototype.play = function () {
            if (!this._playing) {
                this._now = Date.now();
                this._then = this._now;
                this._playing = true;
                this._frameCount = 0;
            }
        };
        /**
         * @inheritdoc
         */
        MovieClip.prototype.stop = function () {
            this._nativeMovieClip.stop();
            if (this._playing) {
                this._playing = false;
            }
        };
        /**
         * @inheritdoc
         * @param frame @inheritdoc
         */
        MovieClip.prototype.gotoAndStop = function (frame) {
            if (this._playing) {
                this._playing = false;
            }
            this._nativeMovieClip.gotoAndStop(frame);
        };
        /**
         * @inheritdoc
         * @param frame @inheritdoc
         */
        MovieClip.prototype.gotoAndPlay = function (frame) {
            this.gotoAndStop(frame);
            this.play();
        };
        Object.defineProperty(MovieClip.prototype, "fps", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._fps;
            },
            /**
            * @inheritdoc
            * @param value @inheritdoc
            */
            set: function (value) {
                this._fps = value;
                this._fpsPerSixty = this._fps / 60;
                this._interval = 1000 / this._fps;
            },
            enumerable: true,
            configurable: true
        });
        MovieClip.prototype.gotoNextFrame = function () {
            var f = this._nativeMovieClip.currentFrame + 1;
            if (f == this._totalFrames - 1) {
                this.dispatchEvent(new rendering.DisplayEvent(rendering.DisplayEvent.ANIMATION_COMPLETE, this));
            }
            if (f >= this._totalFrames) {
                f = 0;
            }
            this._nativeMovieClip.gotoAndStop(f);
        };
        MovieClip.prototype.onUpdate = function () {
            _super.prototype.onUpdate.call(this);
            if (this._playing) {
                if (this._useMs) {
                    this._now = Date.now();
                    this._delta = this._now - this._then;
                    if (this._delta > this._interval) {
                        this._then = this._now - (this._delta % this._interval);
                        while (this._delta > this._interval && this._playing) {
                            this._delta -= this._interval;
                            this.gotoNextFrame();
                        }
                    }
                }
                else {
                    this._frameCount += this._fpsPerSixty;
                    while (this._frameCount > 1) {
                        this._frameCount -= 1;
                        this.gotoNextFrame();
                    }
                }
            }
        };
        return MovieClip;
    })(rendering.DisplayObject);
    rendering.MovieClip = MovieClip;
})(rendering || (rendering = {}));
/// <reference path="DisplayObject.ts" />
var rendering;
(function (rendering) {
    /**
     * The DisplayObjectContainer class implements the IDisplayObjectContainer<T> interface.
     *
     * a DisplayObjectContainer is designed for grouping other display objects together rather than displaying it's own content to the user. A DisplayObjectContainer also inherits all functionality from DisplayObject.
     */
    var ParticleContainer = (function (_super) {
        __extends(ParticleContainer, _super);
        function ParticleContainer() {
            _super.call(this, createjs.Container, null);
        }
        /**
         * Creates the native class instance with the class type and arguments from the constructor
         */
        ParticleContainer.prototype.createClass = function (classType, args) {
            return new classType();
        };
        return ParticleContainer;
    })(rendering.DisplayObject);
    rendering.ParticleContainer = ParticleContainer;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * The Point object represents a location in a two-dimensional coordinate system, where x represents the horizontal axis and y represents the vertical axis.
     *
     * @export
     * @class Point
     * @extends {createjs.Point}
     * @implements {rendering.IPoint}
     */
    var Point = (function (_super) {
        __extends(Point, _super);
        /**
         * Creates an instance of Point.
         *
         * @param {number} x position of the point on the x axis
         * @param {number} y position of the point on the y axis
         */
        function Point(x, y) {
            if (x === void 0) { x = 0; }
            if (y === void 0) { y = 0; }
            _super.call(this, x, y);
        }
        return Point;
    })(createjs.Point);
    rendering.Point = Point;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * The polygon object is an area defined by a list of x, y pairs representing the points of the Polygon.
     *
     * @export
     * @class Polygon
     * @extends {createjs.Shape}
     * @implements {rendering.IPolygon}
     */
    var Polygon = (function (_super) {
        __extends(Polygon, _super);
        /**
         * Creates an instance of Polygon.
         *
         * @param {Array<number>} points This is a flat array of numbers that will be interpreted as [x,y, x,y, ...].
         */
        function Polygon(points) {
            _super.call(this);
            this._points = points;
            this.render();
        }
        Object.defineProperty(Polygon.prototype, "points", {
            /**
             * This is a flat array of numbers that will be interpreted as [x,y, x,y, ...].
             *
             * @type {Array<number>}
             */
            get: function () {
                return this._points;
            },
            /**
             * This is a flat array of numbers that will be interpreted as [x,y, x,y, ...].
             */
            set: function (value) {
                this._points = value;
                this.render();
            },
            enumerable: true,
            configurable: true
        });
        /**
         * renders the DisplayObject for DisplayObject.hitArea
         *
         * @protected
         */
        Polygon.prototype.render = function () {
            this.graphics.clear();
            this.graphics.beginFill("#ff00ff");
            this.graphics.moveTo(this._points[0], this._points[1]);
            for (var i = 2; i < this._points.length; i += 2) {
                this.graphics.lineTo(this._points[i], this._points[i + 1]);
            }
            this.graphics.closePath();
            this.graphics.endFill();
        };
        return Polygon;
    })(createjs.Shape);
    rendering.Polygon = Polygon;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * The Rectangle object is an area defined by its position, as indicated by its top-left corner point (x, y) and by its width and its height.
     *
     * @export
     * @class Rectangle
     * @extends {createjs.Shape}
     * @implements {rendering.IRectangle}
     */
    var Rectangle = (function (_super) {
        __extends(Rectangle, _super);
        /**
         * Creates an instance of Rectangle.
         *
         * @param {number} x The X coordinate of the upper-left corner of the rectangle
         * @param {number} y The Y coordinate of the upper-left corner of the rectangle
         * @param {number} width The overall width of this rectangle
         * @param {number} height The overall height of this rectangle
         */
        function Rectangle(x, y, width, height) {
            _super.call(this);
            this.x = x;
            this.y = y;
            this._width = width;
            this._height = height;
            this.render();
        }
        Object.defineProperty(Rectangle.prototype, "width", {
            /**
             * The overall width of this rectangle
             *
             * @type {number}
             */
            get: function () {
                return this._width;
            },
            /**
             * The overall width of this rectangle
             */
            set: function (value) {
                this._width = value;
                this.render();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Rectangle.prototype, "height", {
            /**
             * The overall height of this rectangle
             *
             * @type {number}
             */
            get: function () {
                return this._height;
            },
            /**
             * The overall height of this rectangle
             */
            set: function (value) {
                this._height = value;
                this.render();
            },
            enumerable: true,
            configurable: true
        });
        /**
         * renders the DisplayObject for DisplayObject.hitArea
         *
         * @protected
         */
        Rectangle.prototype.render = function () {
            this.graphics.clear();
            this.graphics.beginFill("#ff00ff");
            this.graphics.drawRect(-this._width / 2, -this._height / 2, this._width, this._height);
            this.graphics.endFill();
        };
        return Rectangle;
    })(createjs.Shape);
    rendering.Rectangle = Rectangle;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * @class
     * The ScaleManager stores a scale that is used by all display objects to translate their positions and dimensions on different resolutions
     * The scale value should be set before the inital Stage is created
     * Each game should be designed at a specific resolution e.g. 1920x1080 and then have a different scale set for different resolutions
     */
    var ScaleManager = (function () {
        function ScaleManager() {
        }
        /**
         * Set the scale for the selected Stage/Asset resolution
         */
        ScaleManager.setPositionScale = function (value) {
            this._positionScale = value;
        };
        /**
         * Get the scale that has been set
         */
        ScaleManager.getPositionScale = function () {
            return this._positionScale;
        };
        /**
         * Scale value
         */
        ScaleManager._positionScale = 1;
        return ScaleManager;
    })();
    rendering.ScaleManager = ScaleManager;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * The Stage class implements the IStage<T> interface.
     *
     * A Stage is the root container for all other display objects. The stage has a fixed maximum width and height that clips the objects on the display list.
     *
     * A stage can support various rendering styles such as WEBGL, Canvas and DOM depending on the exported framework and browser which is automatically selected when providing a list of preffered render styles in order.
     *
     * A Stage also inherits all functionality from DisplayObject.
     */
    var Stage = (function (_super) {
        __extends(Stage, _super);
        /**
         * @param element Root element to add the display to.
         * @param width Maximum width in pixels for the display.
         * @param height Maximum height in pixels for the display.
         * @param renderStyles Array of preferred StageRenderStyle's for the display, the first supported one will be used, unsupported ones will be ignored.
         * See StageRenderStyle for options.
         */
        function Stage(element, width, height, renderStyles) {
            var _this = this;
            if (renderStyles === void 0) { renderStyles = [rendering.StageRenderStyle.WEBGL, rendering.StageRenderStyle.CANVAS, rendering.StageRenderStyle.DOM]; }
            _super.call(this);
            this._supportedStyles = [rendering.StageRenderStyle.CANVAS];
            this._then = Date.now();
            /**
             * @inheritdoc
             */
            this.parent = null;
            /**
             * @inheritdoc
             */
            this.stage = this;
            this.fps = 60;
            var renderStyle = this.getSupportForRenderer(renderStyles);
            this._canvas = document.createElement("canvas");
            this._canvas.width = width;
            this._canvas.height = height;
            element.appendChild(this._canvas);
            this._native = new createjs.Stage(this._canvas);
            this._native.enableMouseOver();
            createjs.Touch.enable(this._native, true, false);
            this.children = [];
            /*this._native.addEventListener("click", function (event) { _this.onClick(event); });
            this._native.addEventListener("stagemousedown", function (event) { _this.onDown(event); });
            this._native.addEventListener("stagemouseup", function (event) { _this.onUp(event); });*/
        }
        /**
         * @inheritdoc
         */
        Stage.prototype.enablePrePostRendering = function () {
            console.log("pre and post rendering is not available for the stage");
        };
        /**
         * @inheritdoc
         *
         * @param width @inheritdoc
         * @param height @inheritdoc
         */
        Stage.prototype.resize = function (width, height) {
            this._canvas.style.width = width.toString() + "px";
            this._canvas.style.height = height.toString() + "px";
            var stageEvent = new rendering.StageEvent(rendering.StageEvent.STAGE_RESIZED, this);
            stageEvent.width = width;
            stageEvent.height = height;
            this.dispatchEvent(stageEvent);
        };
        Object.defineProperty(Stage.prototype, "hitArea", {
            /**
             * @inheritdoc
             */
            set: function (value) {
                console.log("hitArea not settable on rendering.Stage");
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatches InputEvent.CLICK when clicked/touched.
         */
        /*Stage.prototype.onClick = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.CLICK, this));
        };*/
        /**
         * Dispatches InputEvent.DOWN when pressed.
         */
        /*Stage.prototype.onDown = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.DOWN, this));
        };*/
        /**
         * Dispatches InputEvent.UP when released.
         */
        /*Stage.prototype.onUp = function (event) {
            this.dispatchEvent(new rendering.InputEvent(rendering.InputEvent.UP, this));
        };*/
        /**
         * @inheritdoc
         */
        Stage.prototype.onAdded = function () {
        };
        /**
         * @inheritdoc
         */
        Stage.prototype.onRemoved = function () {
        };
        /**
         * @inheritdoc
         * @param child @inheritdoc
         */
        Stage.prototype.addChild = function (child) {
            this._native.addChild(child.getNativeDisplayObject());
            child.stage = this;
            child.parent = this;
            if (this.children.indexOf(child) == -1) {
                this.children.push(child);
                child.onAdded();
            }
            return child;
        };
        /**
         * @inheritdoc
         * @param child @inheritdoc
         */
        Stage.prototype.addChildAt = function (child, index) {
            this._native.addChildAt(child.getNativeDisplayObject(), index);
            child.stage = this;
            child.parent = this;
            if (this.children.indexOf(child) == -1) {
                this.children.push(child);
                child.onAdded();
            }
            return child;
        };
        /**
         * @inheritdoc
         * @param child @inheritdoc
         */
        Stage.prototype.removeChild = function (child) {
            this._native.removeChild(child.getNativeDisplayObject());
            child.stage = null;
            child.parent = null;
            var i = this.children.indexOf(child);
            if (i > -1) {
                this.children.splice(i, 1);
                child.onRemoved();
            }
            return child;
        };
        /**
         * @inheritdoc
         */
        Stage.prototype.render = function () {
            if (this.paused) {
                return;
            }
            this._native.update();
            this.dispatchEvent(new rendering.DisplayEvent(rendering.DisplayEvent.ENTER_FRAME, this));
        };
        /**
         * Creates the specified class with the specified arguments.
         */
        Stage.prototype.getNativeDisplayObject = function () {
            return this._native;
        };
        Object.defineProperty(Stage.prototype, "fps", {
            /**
             * @inheritdoc
             * @param value @inheritdoc
             */
            set: function (value) {
                this._fps = value;
                this._interval = 1000 / this._fps;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Updates the display each frame when autoRender is enabled.
         */
        Stage.prototype.onNextFrame = function () {
            var _this = this;
            this._now = Date.now();
            this._delta = this._now - this._then;
            if (this._delta > this._interval) {
                this._then = this._now - (this._delta % this._interval);
                this.render();
            }
            if (this._autoRender) {
                requestAnimationFrame(function () { _this.onNextFrame(); });
            }
        };
        /**
         * Gets a supported renderer type.
         * @param renderTypes List of selected renderTypes in preferred order.
         */
        Stage.prototype.getSupportForRenderer = function (renderTypes) {
            for (var i = 0; i < renderTypes.length; i++) {
                if (this._supportedStyles.indexOf(renderTypes[i]) == -1) {
                    console.log("Render Style: " + renderTypes[i] + " not supported");
                }
                else {
                    console.log("Using Render Style: " + renderTypes[i]);
                    return renderTypes[i];
                }
            }
            console.log("No Supported Render Style Found, Game's gonna crash!");
            return "";
        };
        Object.defineProperty(Stage.prototype, "x", {
            /**
             * @inheritdoc
             */
            get: function () { return this._native.x; },
            /**
             * @inheritdoc
             */
            set: function (value) { this._native.x = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "y", {
            /**
             * @inheritdoc
             */
            get: function () { return this._native.y; },
            /**
             * @inheritdoc
             */
            set: function (value) { this._native.y = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "scaleX", {
            /**
             * @inheritdoc
             */
            get: function () { return this._native.scaleX; },
            /**
             * @inheritdoc
             */
            set: function (value) { this._native.scaleX = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "scaleY", {
            /**
             * @inheritdoc
             */
            get: function () { return this._native.scaleY; },
            /**
             * @inheritdoc
             */
            set: function (value) { this._native.scaleY = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "alpha", {
            /**
             * @inheritdoc
             */
            get: function () { return this._native.alpha; },
            /**
             * @inheritdoc
             */
            set: function (value) { this._native.alpha = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "rotation", {
            /**
             * @inheritdoc
             */
            get: function () { return 0; },
            /**
             * @inheritdoc
             */
            set: function (value) { console.log("Setting rotation directly not supported on Stage"); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "pivot", {
            /**
             * @inheritdoc
             */
            get: function () { return new rendering.Point(); },
            /**
             * @inheritdoc
             */
            set: function (value) { console.log("Setting pivot directly not supported on Stage"); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "visible", {
            /**
             * @inheritdoc
             */
            get: function () { return this.getNativeDisplayObject().visible; },
            /**
             * @inheritdoc
             */
            set: function (value) { this.getNativeDisplayObject().visible = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "width", {
            /**
             * @inheritdoc
             */
            get: function () {
                if (!this._native.getBounds()) {
                    return 0;
                }
                return this._native.getBounds().width;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "height", {
            /**
             * @inheritdoc
             */
            get: function () {
                if (!this._native.getBounds()) {
                    return 0;
                }
                return this._native.getBounds().height;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "stageWidth", {
            /**
             * @inheritdoc
             */
            get: function () { return this._canvas.width; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "stageHeight", {
            /**
             * @inheritdoc
             */
            get: function () { return this._canvas.height; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "autoRender", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._autoRender;
            },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._autoRender = value;
                this.onNextFrame();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "canvas", {
            /**
             * @inheritdoc
             */
            get: function () { return this._canvas; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Stage.prototype, "mask", {
            /**
             * @inheritdoc
             */
            set: function (value) {
                console.log("Stage cannot be masked");
            },
            enumerable: true,
            configurable: true
        });
        return Stage;
    })(borgevent.EventDispatcher);
    rendering.Stage = Stage;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * StageEventBase<T> is extended by StageEvent
     *
     * StageEvent's are dispatched by IStage<T> implementations to listeners.
     */
    var StageEventBase = (function (_super) {
        __extends(StageEventBase, _super);
        /**
         * @param eventName The type of eventName
         * @param @stage The IStage<T> that dispatched the event.
         */
        function StageEventBase(eventName, stage) {
            _super.call(this, eventName);
            this._stage = stage;
        }
        Object.defineProperty(StageEventBase.prototype, "stage", {
            /**
             * The IStage<T> that dispatched the event.
             */
            get: function () {
                return this._stage;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatched when resize(w,h) is called on an IStage<T>. Games can then resize their components appropriately.
         */
        StageEventBase.STAGE_RESIZED = "StageEvent_STAGE_RESIZED";
        return StageEventBase;
    })(borgevent.Event);
    rendering.StageEventBase = StageEventBase;
})(rendering || (rendering = {}));
/// <reference path="../interface/StageEventBase.ts" />
var rendering;
(function (rendering) {
    /**
     * StageEvent's are dispatched by IStage<T> implementations to listeners.
     */
    var StageEvent = (function (_super) {
        __extends(StageEvent, _super);
        function StageEvent() {
            _super.apply(this, arguments);
        }
        return StageEvent;
    })(rendering.StageEventBase);
    rendering.StageEvent = StageEvent;
})(rendering || (rendering = {}));
/// <reference path="DisplayObject.ts" />
var rendering;
(function (rendering) {
    /**
     * The Text class implements the IText<T> interface.
     *
     * A Text instance is a block of text that can be added to the stage or other display objects. Text also inherits all functionality from DisplayObject.
     */
    var Text = (function (_super) {
        __extends(Text, _super);
        function Text(text) {
            _super.call(this, rendering.internalOnly.TextOverride, text);
            this._font = "Arial";
            this._fontSize = 20;
            this._style = {};
            this._debug = false;
            this._debugBorder = new rendering.Graphics();
        }
        /**
         * @inheritdoc
         */
        Text.prototype.enablePrePostRendering = function () {
            var _this = this;
            if (!this._prePostEnabled) {
                var old = this._native._drawTextLine;
                this._native._drawTextLine = function (ctx, text, y) {
                    if (_this.stage) {
                        _this.dispatchEvent(new rendering.DisplayEvent(rendering.DisplayEvent.PRE_RENDER, _this, _this.stage.canvas, { y: y }));
                        var sucess = old.apply(_this._native, [ctx, text, y]);
                        _this.dispatchEvent(new rendering.DisplayEvent(rendering.DisplayEvent.POST_RENDER, _this, _this.stage.canvas, { y: y }));
                        return sucess;
                    }
                };
                this._prePostEnabled = true;
            }
        };
        /**
         * Creates the native class instance with the class type and arguments from the constructor
         */
        Text.prototype.createClass = function (classType, args) {
            return new rendering.internalOnly.TextOverride(args[0]);
        };
        Object.defineProperty(Text.prototype, "font", {
            /**
             * @inheritdoc
             */
            get: function () { return this._font; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._font = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "fontSize", {
            /**
             * @inheritdoc
             */
            get: function () { return this._fontSize; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._fontSize = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "colour", {
            /**
             * @inheritdoc
             */
            get: function () { return this._colour; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._colour = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "textAlign", {
            /**
             * @inheritdoc
             */
            get: function () { return this._textAlign; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._textAlign = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "maxWidth", {
            /**
             * @inheritdoc
             */
            get: function () { return this._maxWidth; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._maxWidth = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "scaleToWidth", {
            /**
             * @inheritdoc
             */
            get: function () { return this._scaleToWidth; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._scaleToWidth = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "scaleToHeight", {
            /**
             * @inheritdoc
             */
            get: function () { return this._scaleToHeight; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._scaleToHeight = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "outlineColour", {
            /**
             * @inheritdoc
             */
            get: function () { return this._outlineColour; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._outlineColour = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "outlineSize", {
            /**
             * @inheritdoc
             */
            get: function () { return this._outlineSize; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._outlineSize = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "wrapWidth", {
            /**
             * @inheritdoc
             */
            get: function () { return this._wrapWidth; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._wrapWidth = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "lineHeight", {
            /**
             * @inheritdoc
             */
            get: function () { return this._lineHeight; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._lineHeight = value;
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "text", {
            /**
             * @inheritdoc
             */
            set: function (value) {
                if (this.getNativeDisplayObject().text != value) {
                    this.getNativeDisplayObject().text = value;
                    this.refresh();
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Text.prototype, "debug", {
            /**
             * @inheritdoc
             */
            get: function () { return this._debug; },
            /**
             * @inheritdoc
             */
            set: function (value) {
                this._debug = value;
                console.log("Text.debug not currently supported in createjs");
                this.refresh();
            },
            enumerable: true,
            configurable: true
        });
        Text.prototype.createDebugBorder = function () {
            this._debugBorder.clear();
            this._debugBorder.lineStyle(3, 0x00ff00, 1);
            this._debugBorder.drawRect(0, 0, this.scaleToWidth, this.scaleToHeight);
        };
        Text.prototype.refresh = function () {
            var size = this._fontSize;
            this.applyRefresh(size);
            if (this._scaleToHeight && this.getNativeDisplayObject() && this.getNativeDisplayObject().getBounds()) {
                while (this.getNativeDisplayObject().getBounds().height > this._scaleToHeight * rendering.ScaleManager.getPositionScale() && size > 1) {
                    size--;
                    this.applyRefresh(size);
                }
            }
            if (this._scaleToWidth && this.getNativeDisplayObject() && this.getNativeDisplayObject().getBounds()) {
                while (this.getNativeDisplayObject().getBounds().width > this._scaleToWidth * rendering.ScaleManager.getPositionScale() && size > 1) {
                    size--;
                    this.applyRefresh(size);
                }
            }
        };
        Text.prototype.applyRefresh = function (fontSize) {
            //createjs.Text.H_OFFSETS = {start: 0, left: 0, center: 0, end: 0, right: 0};          
            var font = (fontSize * rendering.ScaleManager.getPositionScale()).toString() + "px " + this._font;
            var lineHeight = this._lineHeight ? (this._lineHeight > fontSize ? this._lineHeight : fontSize) : null;
            lineHeight *= rendering.ScaleManager.getPositionScale();
            this._native.font = font;
            this._native.color = this._colour;
            this._native.textAlign = this._textAlign;
            this._native.lineWidth = this._wrapWidth * rendering.ScaleManager.getPositionScale() || null;
            this._native.maxWidth = this._maxWidth;
            this._native.outline = this._outlineSize * rendering.ScaleManager.getPositionScale() || 0;
            this._native.outlineCol = this._outlineColour || "#000";
            this._native.lineHeight = lineHeight;
            this._native.textAlign = this._textAlign;
            this._native.textBaseline = "alphabetic";
        };
        return Text;
    })(rendering.DisplayObject);
    rendering.Text = Text;
})(rendering || (rendering = {}));
/**
 *@internal
 */
var rendering;
(function (rendering) {
    var internalOnly;
    (function (internalOnly) {
        /**
         *@internal
        */
        var TextOverride = (function (_super) {
            __extends(TextOverride, _super);
            function TextOverride() {
                _super.apply(this, arguments);
                this.outlineCol = "#000";
            }
            TextOverride.prototype.draw = function (ctx, ignoreCache) {
                if (this.DisplayObject_draw(ctx, ignoreCache)) {
                    return true;
                }
                var col = this.color || "#000";
                if (!ctx.fillStyle || ctx.fillStyle == "#000000") {
                    ctx.fillStyle = col;
                }
                if (this.outline) {
                    ctx.strokeStyle = this.outlineCol;
                    ctx.lineWidth = this.outline * 1;
                }
                this._drawText(this._prepContext(ctx));
                return true;
            };
            TextOverride.prototype._drawTextLine = function (ctx, text, y) {
                // Chrome 17 will fail to draw the text if the last param is included but null, so we feed it a large value instead:
                var fontProps = FontStyleCache.determineFontProperties(this.font);
                var x = this.textAlign == "center" ? this.getBounds().width / 2 : this.textAlign == "right" ? this.getBounds().width : 0;
                if (this.outline) {
                    ctx.strokeText(text, x, y + fontProps.ascent, this.maxWidth || 0xFFFF);
                }
                //ctx.save();
                //ctx.fillStyle = "#FF0000";
                //ctx.fillRect(0, 0, this.getBounds().width, this.getBounds().height);
                //ctx.restore();
                ctx.fillText(text, x, y + fontProps.ascent, this.maxWidth || 0xFFFF);
            };
            ;
            return TextOverride;
        })(createjs.Text);
        internalOnly.TextOverride = TextOverride;
        var FontStyleCache = (function () {
            function FontStyleCache() {
            }
            FontStyleCache.determineFontProperties = function (fontStyle) {
                var properties = FontStyleCache.fontPropertiesCache[fontStyle];
                if (!properties) {
                    if (!FontStyleCache.context) {
                        var c = document.createElement('canvas');
                        FontStyleCache.context = c.getContext("2d");
                    }
                    properties = {};
                    FontStyleCache.context.save();
                    FontStyleCache.context.font = fontStyle;
                    var width = Math.ceil(FontStyleCache.context.measureText('|MÉq').width);
                    var baseline = Math.ceil(FontStyleCache.context.measureText('M').width);
                    var height = 2 * baseline;
                    baseline = baseline * 1.4 | 0;
                    FontStyleCache.context.setTransform(1, 0, 0, 1, 0, 0);
                    FontStyleCache.context.fillStyle = '#f00';
                    FontStyleCache.context.fillRect(0, 0, width, height);
                    FontStyleCache.context.shadowBlur = 0;
                    FontStyleCache.context.shadowOffsetX = 0;
                    FontStyleCache.context.shadowOffsetY = 0;
                    FontStyleCache.context.strokeStyle = null;
                    FontStyleCache.context.font = fontStyle;
                    FontStyleCache.context.textBaseline = 'alphabetic';
                    FontStyleCache.context.fillStyle = '#000';
                    FontStyleCache.context.fillText('|MÉq', 0, baseline);
                    var imagedata = FontStyleCache.context.getImageData(0, 0, width, height).data;
                    var pixels = imagedata.length;
                    var line = width * 4;
                    var i, j;
                    var idx = 0;
                    var stop = false;
                    // ascent. scan from top to bottom until we find a non red pixel
                    for (i = 0; i < baseline; i++) {
                        for (j = 0; j < line; j += 4) {
                            if (imagedata[idx + j] !== 255) {
                                stop = true;
                                break;
                            }
                        }
                        if (!stop) {
                            idx += line;
                        }
                        else {
                            break;
                        }
                    }
                    properties.ascent = baseline - i;
                    idx = pixels - line;
                    stop = false;
                    // descent. scan from bottom to top until we find a non red pixel
                    for (i = height; i > baseline; i--) {
                        for (j = 0; j < line; j += 4) {
                            if (imagedata[idx + j] !== 255) {
                                stop = true;
                                break;
                            }
                        }
                        if (!stop) {
                            idx -= line;
                        }
                        else {
                            break;
                        }
                    }
                    properties.descent = i - baseline;
                    properties.fontSize = properties.ascent + properties.descent;
                    FontStyleCache.fontPropertiesCache[fontStyle] = properties;
                    FontStyleCache.context.restore();
                }
                return properties;
            };
            ;
            FontStyleCache.fontPropertiesCache = [];
            return FontStyleCache;
        })();
        internalOnly.FontStyleCache = FontStyleCache;
    })(internalOnly = rendering.internalOnly || (rendering.internalOnly = {}));
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * Static list of cap styles that can be used with the IGraphics<T> methods.
     */
    var CapStyle = (function () {
        function CapStyle() {
        }
        CapStyle.ROUND = "round";
        CapStyle.SQUARE = "square";
        CapStyle.BUTT = "butt";
        return CapStyle;
    })();
    rendering.CapStyle = CapStyle;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * The input manager is an intermediatory class that handles the routing of InputEvents each frame.
     * This allows limiting of single event/eventTypes per frame for all display objects or a specific subset of display objects.
     *
     * @export
     * @class InputManager
     */
    var InputManager = (function () {
        function InputManager() {
        }
        /**
         * Registers an event to be processed the next frame
         *
         * @static
         * @param {IDisplayObject<any>} inputObject (description)
         * @param {borgevent.IEvent} event (description)
         */
        InputManager.registerEvent = function (inputObject, event) {
            this.createData();
            this._objectQueue.push(inputObject);
            this._eventQueue.push(event);
        };
        /**
         * Register an object to be processed, filterRegisteredOnly must be true
         *
         * @static
         * @param {IDisplayObject<any>} inputObject (description)
         */
        InputManager.registerObject = function (inputObject) {
            this.createData();
            this._registered.push(inputObject);
        };
        /**
         * Processes all input since the last update, should be called every frame
         *
         * @static
         */
        InputManager.processInput = function () {
            this.createData();
            var usedTypes = [];
            if (this.filterRegisteredOnly) {
                var hasDispatched = false;
                for (var i = 0; i < this._eventQueue.length; i++) {
                    if (this._registered.indexOf(this._objectQueue[i]) == -1) {
                        this.dispatchEvent(this._objectQueue[i], this._eventQueue[i]);
                    }
                    else {
                        if (this.inputType == this.ONE_PER_FRAME) {
                            if (!hasDispatched) {
                                this.dispatchEvent(this._objectQueue[i], this._eventQueue[i]);
                                hasDispatched = true;
                            }
                        }
                        else if (this.inputType == this.ONE_TYPE_PER_FRAME) {
                            if (usedTypes.indexOf(this._eventQueue[i].eventName) == -1) {
                                this.dispatchEvent(this._objectQueue[i], this._eventQueue[i]);
                                usedTypes.push(this._eventQueue[i].eventName);
                            }
                        }
                        if (this.inputType == this.ALL_EVENTS) {
                            this.dispatchEvent(this._objectQueue[i], this._eventQueue[i]);
                        }
                    }
                }
            }
            else if (this.inputType == this.ALL_EVENTS) {
                for (var i = 0; i < this._eventQueue.length; i++) {
                    this.dispatchEvent(this._objectQueue[i], this._eventQueue[i]);
                }
            }
            else if (this.inputType == this.ONE_PER_FRAME) {
                if (this._eventQueue.length > 0) {
                    this.dispatchEvent(this._objectQueue[0], this._eventQueue[0]);
                }
            }
            else if (this.inputType == this.ONE_TYPE_PER_FRAME) {
                for (var i = 0; i < this._eventQueue.length; i++) {
                    if (usedTypes.indexOf(this._eventQueue[i].eventName) == -1) {
                        this.dispatchEvent(this._objectQueue[i], this._eventQueue[i]);
                        usedTypes.push(this._eventQueue[i].eventName);
                    }
                }
            }
            this._objectQueue = [];
            this._eventQueue = [];
        };
        /**
         * Dispatch an event via the display object
         *
         * @protected
         * @static
         * @param {IDisplayObject<any>} inputObject (description)
         * @param {borgevent.IEvent} event (description)
         */
        InputManager.dispatchEvent = function (inputObject, event) {
            inputObject.dispatchEvent(event);
        };
        /**
         * Creates static arrays if they do not exist
         *
         * @protected
         * @static
         */
        InputManager.createData = function () {
            if (!this._eventQueue) {
                this._eventQueue = [];
            }
            if (!this._objectQueue) {
                this._objectQueue = [];
            }
            if (!this._registered) {
                this._registered = [];
            }
        };
        /**
         * Alllow all events to be processed every frame
         *
         * @static
         * @type {string}
         */
        InputManager.ALL_EVENTS = "InputManager_ALL_EVENTS";
        /**
         * Limit of one InputEvent per frame
         *
         * @static
         * @type {string}
         */
        InputManager.ONE_PER_FRAME = "InputManager_ONE_PER_FRAME";
        /**
         * Limit of one of each type of InputEvent per frame
         *
         * @static
         * @type {string}
         */
        InputManager.ONE_TYPE_PER_FRAME = "InputManager_ONE_TYPE_PER_FRAME";
        /**
         * The type of processing rules that should be done it each frame
         *
         * @static
         * @type {string}
         */
        InputManager.inputType = InputManager.ALL_EVENTS;
        /**
         * Limits processing to registered display objects only
         *
         * @static
         * @type {boolean}
         */
        InputManager.filterRegisteredOnly = false;
        return InputManager;
    })();
    rendering.InputManager = InputManager;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * Static list of joint styles that can be used with the IGraphics<T> methods.
     */
    var JointStyle = (function () {
        function JointStyle() {
        }
        JointStyle.BEVEL = "bevel";
        JointStyle.ROUND = "round";
        JointStyle.MITER = "miter";
        return JointStyle;
    })();
    rendering.JointStyle = JointStyle;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * Static list of rendering styles that an IStage<T> can use.
     */
    var StageRenderStyle = (function () {
        function StageRenderStyle() {
        }
        StageRenderStyle.WEBGL = "WEBGL";
        StageRenderStyle.CANVAS = "CANVAS";
        StageRenderStyle.DOM = "DOM";
        return StageRenderStyle;
    })();
    rendering.StageRenderStyle = StageRenderStyle;
})(rendering || (rendering = {}));
var rendering;
(function (rendering) {
    /**
     * Static list of text alignment styles that can be used with the IText<T> textAlign property.
     */
    var TextAlign = (function () {
        function TextAlign() {
        }
        TextAlign.LEFT = "left";
        TextAlign.RIGHT = "right";
        TextAlign.CENTER = "center";
        return TextAlign;
    })();
    rendering.TextAlign = TextAlign;
})(rendering || (rendering = {}));
