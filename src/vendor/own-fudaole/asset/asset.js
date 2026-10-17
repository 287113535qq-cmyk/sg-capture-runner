define(["require", "exports", "http-connection/http-connection", "events/events"], function (require, exports, httpconnection, events) {
    /**
     * @class FontWatcher
     * @classdesc Monitors document to verify if a font has been loaded
     */
    var FontWatcher = (function () {
        function FontWatcher(fontName, timeout) {
            this.serif = "serif";
            this.sansSerif = "sans-serif";
            /**
             * Default test string. Characters are chosen so that their widths vary a lot
             * between the fonts in the default stacks. We want each fallback stack
             * to always start out at a different width than the other.
             */
            this.defaultFontTestString = 'BESbswy';
            this.signal = {
                onLoadComplete: null,
                onLoadTimeout: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
            this.fontName = fontName;
            this.fontTestString = this.defaultFontTestString;
            this.timeout = timeout;
            this.fontRulerSerif = new FontRuler(this.fontTestString, this.serif);
            this.fontRulerSansSerif = new FontRuler(this.fontTestString, this.sansSerif);
        }
        FontWatcher.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /*
         * Starts watching the font loading
         */
        FontWatcher.prototype.start = function () {
            this.fontRulerFallbackSerif = new FontRuler(this.fontTestString, this.fontName + ',' + this.serif);
            this.fontRulerFallbackSansSerif = new FontRuler(this.fontTestString, this.fontName + ',' + this.sansSerif);
            this.started = Date.now();
            this.check();
        };
        /**
         * Returns true if the loading has timed out.
         */
        FontWatcher.prototype.hasTimedOut = function () {
            return Date.now() - this.started >= this.timeout;
        };
        /**
         * Returns true if both fonts match the normal fallback fonts.
         *
         */
        FontWatcher.prototype.isFallbackFont = function () {
            var widthFallbackSerif = this.fontRulerFallbackSerif.getWidth();
            var widthFallbackSansSerif = this.fontRulerFallbackSansSerif.getWidth();
            var widthSerif = this.fontRulerSerif.getWidth();
            var widthSansSerif = this.fontRulerSansSerif.getWidth();
            return widthFallbackSerif === widthSerif && widthFallbackSansSerif === widthSansSerif;
        };
        /**
         * Checks the width of the two spans against their original widths during each
         * async loop. If the width of one of the spans is different than the original
         * width, then we know that the font is rendering and finish with the active
         * callback. If we wait more than 5 seconds and nothing has changed, we finish
         * with the inactive callback.
         *
         */
        FontWatcher.prototype.check = function () {
            if (this.isFallbackFont()) {
                if (this.hasTimedOut()) {
                    this.signal.onLoadTimeout();
                }
                else {
                    this.asyncCheck();
                }
            }
            else {
                this.signal.onLoadComplete();
            }
        };
        FontWatcher.prototype.asyncCheck = function () {
            var _this = this;
            window.setTimeout(function () {
                _this.check();
            }, 25);
        };
        return FontWatcher;
    })();
    exports.FontWatcher = FontWatcher;
    (function (ImageType) {
        ImageType[ImageType["Image"] = 0] = "Image";
        ImageType[ImageType["Atlas"] = 1] = "Atlas";
        ImageType[ImageType["JSON"] = 2] = "JSON";
    })(exports.ImageType || (exports.ImageType = {}));
    var ImageType = exports.ImageType;
    /**
     * Create a new ImageAsset
     * @class asset.ImageAsset
     * @classdesc Loads an image as an HTMLImageElement
     */
    var ImageAsset = (function () {
        /**
         * @constructor
         * @param {string} path The source path of the asset
         */
        function ImageAsset(path, secondaryPath) {
            /**
             * The loaded data
             */
            this.payload = { image: null, anim: null };
            /**
             * The flag to indicate if an asset is fully loaded
             */
            this.isLoaded = false;
            this.path = path;
            if ((path.indexOf(".atlas") >= 0)) {
                this.imageType = 1 /* Atlas */;
            }
            else if ((path.indexOf(".json") >= 0)) {
                this.imageType = 2 /* JSON */;
                this.secondaryPath = secondaryPath;
            }
            else {
                this.imageType = 0 /* Image */;
            }
            this.signal = {
                onProgress: null,
                onComplete: null,
                onError: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
         * Get the source path of the asset
         * @returns {string} The source path of the asset
         */
        ImageAsset.prototype.getPath = function () {
            return this.path;
        };
        /**
         * Get the image path specified by animation JSON
         * @returns {string} The image path
         */
        ImageAsset.prototype.getImagePath = function () {
            return this.imagePath;
        };
        /**
         * Check if this is an animation
         */
        ImageAsset.prototype.getIsAnim = function () {
            return !(this.imageType == 0 /* Image */);
        };
        /**
         * Check if this is fully loaded
         */
        ImageAsset.prototype.getIsLoaded = function () {
            return this.isLoaded;
        };
        /**
         * Get the loaded data
         * @returns {IImageAssetData} The loaded image
         */
        ImageAsset.prototype.getPayload = function () {
            return this.payload;
        };
        /**
         * Get the event dispatcher
         * @returns {EventDispathcer} The event dispatcher
         */
        ImageAsset.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * Load the asset
         */
        ImageAsset.prototype.load = function () {
            if (this.imageType == 1 /* Atlas */) {
                this.loadAtlas();
            }
            else if (this.imageType == 2 /* JSON */) {
                this.loadJSON();
            }
            else {
                this.loadImage();
            }
        };
        /**
         * Load an animation asset
         */
        ImageAsset.prototype.loadAtlas = function () {
            var _this = this;
            var connection = new httpconnection.HttpConnectionFactory().createConnection(this.path, "", 0 /* GET */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.processJSON(response.responseText);
                },
                onFail: function (url, error, status) {
                    _this.signal.onError(url, error, status, _this);
                },
                onProgress: function (url, totalBytes, loadedBytes) {
                    _this.signal.onProgress(loadedBytes / totalBytes, _this);
                }
            });
            connection.send();
        };
        /**
         * Process JSON data for an animation
         * @param {response} response JSON data
         */
        ImageAsset.prototype.processJSON = function (response) {
            var _this = this;
            var json = JSON.parse(response);
            this.animData = {
                image: json.imageurl,
                width: null,
                height: null,
                scale: null,
                frames: null
            };
            var connection = new httpconnection.HttpConnectionFactory().createConnection(json.jsonurl, "", 0 /* GET */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.processAmin(response.responseText);
                },
                onFail: function (url, error, status) {
                    _this.signal.onError(url, error, status, _this);
                },
                onProgress: function (url, totalBytes, loadedBytes) {
                    _this.signal.onProgress(loadedBytes / totalBytes, _this);
                }
            });
            connection.send();
        };
        /**
         * Process animation asset
         * @param {response} resposne Animation data
         */
        ImageAsset.prototype.processAmin = function (response) {
            this.animData.frames = JSON.parse(response).frames;
            this.handleAnimLoadComplete(this.animData);
        };
        ImageAsset.prototype.loadJSON = function () {
            var _this = this;
            this.animData = {
                image: this.secondaryPath,
                width: null,
                height: null,
                scale: null,
                frames: null
            };
            var connection = new httpconnection.HttpConnectionFactory().createConnection(this.path, "", 0 /* GET */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.processAmin(response.responseText);
                },
                onFail: function (url, error, status) {
                    _this.signal.onError(url, error, status, _this);
                },
                onProgress: function (url, totalBytes, loadedBytes) {
                    _this.signal.onProgress(loadedBytes / totalBytes, _this);
                }
            });
            connection.send();
        };
        /**
         * Load an image asset.
         */
        ImageAsset.prototype.loadImage = function () {
            var _this = this;
            this.imagePath = (this.imageType == 0 /* Image */) ? this.path : this.payload.anim.image;
            var connection = new httpconnection.HttpConnectionFactory().createConnection(this.imagePath, "", 0 /* GET */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.handleImageLoadComplete(url, response.responseText, responseHeaders);
                },
                onFail: function (url, error, status) {
                    _this.signal.onError(url, error, status, _this);
                },
                onProgress: function (url, totalBytes, loadedBytes) {
                    _this.signal.onProgress(loadedBytes / totalBytes, _this);
                }
            });
            connection.send();
        };
        /**
         * Handler when image asset is fully loaded
         */
        ImageAsset.prototype.handleImageLoadComplete = function (url, response, responseHeaders) {
            var _this = this;
            var image = document.createElement("img");
            image.onload = function () {
                _this.payload.image = image;
                _this.isLoaded = true;
                _this.signal.onComplete(_this);
            };
            image.crossOrigin = "Anonymous";
            image.src = url;
        };
        /**
         * Handler when animation asset is fully loaded
         */
        ImageAsset.prototype.handleAnimLoadComplete = function (data) {
            this.payload.anim = data;
            this.loadImage();
        };
        return ImageAsset;
    })();
    exports.ImageAsset = ImageAsset;
    /**
     * Create a new AssetLoader
     * @class asset.AssetLoader
     * @classdesc A asynchronous asset loader that tracks progress and supports stages
     */
    var AssetLoader = (function () {
        /**
         * @constructor
         */
        function AssetLoader() {
            /**
             * The total number of stages to load
             */
            this.totalCount = 0;
            /**
             * The total number of stages completed
             */
            this.totalCompleted = 0;
            /**
             * The queue of stages to load
             */
            this.queue = [];
            this.signal = {
                onStarted: null,
                onProgress: null,
                onComplete: null,
                onError: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
         * Get the event dispatcher
         * @method asset.AssetLoader#getEvents
         * @public
         * @returns {events.EventDispatcher<IAssetLoaderListener>} The event dispatcher
         */
        AssetLoader.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * Add a group of assets to download together
         * @param <any> assets Map of name-IAsset pairs describing the bundle created upon completion
         * @returns {number} The stage id
         */
        AssetLoader.prototype.addStage = function (assets) {
            var stage = {
                assets: assets,
                progress: {},
                assetCount: 0,
                completed: 0,
                id: this.queue.length
            };
            for (var name in assets) {
                var asset = assets[name];
                if (asset) {
                    asset.getEvents().add(this);
                    stage.assetCount++;
                    stage.progress[name] = 0;
                }
            }
            this.queue.push(stage);
            this.totalCount++;
            return stage.id;
        };
        /**
         * Begin the download
         */
        AssetLoader.prototype.run = function () {
            this.loadNextStage();
        };
        /**
         * IAssetLoaderListener implementation
         */
        AssetLoader.prototype.onProgress = function (progress, source) {
            for (var name in this.current.assets) {
                if (source === this.current.assets[name]) {
                    this.current.progress[name] = progress;
                    break;
                }
            }
            var stageProgress = this.getStageProgress();
            var totalProgress = this.getTotalProgress();
            this.signal.onProgress(this.current.id, stageProgress, totalProgress);
        };
        /**
         * IAssetLoaderListener implementation
         */
        AssetLoader.prototype.onComplete = function (source) {
            this.current.completed++;
            if (this.isStageComplete()) {
                this.totalCompleted++;
                var allComplete = (this.totalCompleted == this.totalCount);
                this.signal.onComplete(this.current.id, allComplete);
                this.loadNextStage();
            }
        };
        /**
         * IAssetLoaderListener implementation
         */
        AssetLoader.prototype.onError = function (url, message, status, source) {
            this.signal.onError(this.current.id, message, status, url);
        };
        /**
         * Attempt to load the next stage in the queue
         */
        AssetLoader.prototype.loadNextStage = function () {
            this.current = this.queue.shift();
            if (this.current != null) {
                for (var name in this.current.assets) {
                    var asset = this.current.assets[name];
                    if (asset) {
                        asset.load();
                    }
                }
                this.signal.onStarted(this.current.id);
            }
        };
        /**
         * Check if the current stage is done loading
         * @returns {boolean} True if current stage is done loading
         */
        AssetLoader.prototype.isStageComplete = function () {
            return (this.current.completed == this.current.assetCount);
        };
        /**
         * Calculate what percent of the current stage is done loading
         * @returns {number} The percent of current stage loaded
         */
        AssetLoader.prototype.getStageProgress = function () {
            var totalProgress = 0;
            for (var name in this.current.progress) {
                totalProgress += this.current.progress[name];
            }
            return totalProgress / this.current.assetCount;
        };
        /**
         * Calculate what percent of all stages is done loading
         * @returns {number} The percent of all stages loaded
         */
        AssetLoader.prototype.getTotalProgress = function () {
            var completedProgress = this.totalCompleted * 100;
            completedProgress += this.getStageProgress();
            return completedProgress / this.totalCount;
        };
        return AssetLoader;
    })();
    exports.AssetLoader = AssetLoader;
    /**
     * Audio Asset
     * @class asset.AudioAsset
     * @classdesc Loads an audio asset
     */
    var AudioAsset = (function () {
        /**
         * @constructor
         */
        function AudioAsset(path) {
            /**
             * The loaded data
             * @member asset.AudioAsset#payload
             * @private
             * @type {IAudioAssetData}
             */
            this.payload = { arrayBuffer: null };
            /**
             * Flag to indicate if the asset has been loaded
             * @member asset.AudioAsset#isLoaded
             * @private
             * @type {boolean}
             * @default false
             */
            this.isLoaded = false;
            this.path = path;
            this.signal = {
                onProgress: null,
                onComplete: null,
                onError: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
         * Get the path to the asset
         * @method asset.AudioAsset#getPath
         * @public
         * @returns {string} The path to the asset
         */
        AudioAsset.prototype.getPath = function () {
            return this.path;
        };
        /**
         * Check if the asset is loaded
         * @method asset.AudioAsset#getIsLoaded
         * @public
         * @returns {boolean} True if the asset is loaded
         */
        AudioAsset.prototype.getIsLoaded = function () {
            return this.isLoaded;
        };
        /**
         * Get the loaded data
         * @method asset.AudioAsset#getPayload
         * @public
         * @returns {IAudioAssetData} The loaded data for the audio asset
         */
        AudioAsset.prototype.getPayload = function () {
            return this.payload;
        };
        /**
         * Get the event dispatcher
         * @method asset.AudioAsset#getEvents
         * @public
         * @returns {events.EventDispatcher<IAssetListener<IAudioAssetData>>} The event dispatcher
         */
        AudioAsset.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * Load the asset
         * @method asset.AudioAsset#load
         * @public
         */
        AudioAsset.prototype.load = function () {
            var _this = this;
            var connection = new httpconnection.HttpConnectionFactory().createConnection(this.path, "", 0 /* GET */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.onLoadComplete(response.response);
                },
                onFail: null,
                onProgress: null
            });
            connection.send(1 /* ARRAYBUFFER */);
        };
        AudioAsset.prototype.onLoadComplete = function (data) {
            this.payload.arrayBuffer = data;
            this.isLoaded = true;
            this.signal.onComplete(this);
        };
        return AudioAsset;
    })();
    exports.AudioAsset = AudioAsset;
    /**
     * @class FontRuler
     * @classdesc Utility for calculating text width
     */
    var FontRuler = (function () {
        function FontRuler(fontTestString, fontName) {
            this.fontTestString = fontTestString;
            var canvas = document.createElement("canvas");
            this.ctx = canvas.getContext("2d");
            this.ctx.font = "300px " + fontName;
        }
        FontRuler.prototype.getWidth = function () {
            return this.ctx.measureText(this.fontTestString).width;
        };
        return FontRuler;
    })();
    exports.FontRuler = FontRuler;
    var FontAsset = (function () {
        /**
         * @constructor
         */
        function FontAsset(path) {
            /**
             * The loaded data
             * @member asset.FontAsset#payload
             * @private
             * @type {Object}
             */
            this.payload = { fontName: null };
            /**
             * Flag to indicate if the asset has been loaded
             * @member asset.FontAsset#isLoaded
             * @private
             * @type {boolean}
             * @default false
             */
            this.isLoaded = false;
            this.path = path;
            this.signal = {
                onProgress: null,
                onComplete: null,
                onError: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
         * Get the event dispatcher
         * @method asset.FontAsset#getEvents
         * @returns {events.EventDispatcher<IAssetListener<IFontAssetData>>} Font asset event dispatcher
         */
        FontAsset.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * The source path of the asset
         * @method asset.FontAsset#getPath
         * @returns {string} The source path of the asset
         */
        FontAsset.prototype.getPath = function () {
            return this.path;
        };
        /**
         * Get the loaded payload or null if not loaded yet
         * @method asset.FontAsset#getPayload
         * @returns {IFontAssetData} The loaded data
         */
        FontAsset.prototype.getPayload = function () {
            return this.payload;
        };
        /**
         * Get the internal hashed name of the font
         * @method asset.FontAsset#getFontName
         * @public
         * @returns {string} Name of font
         */
        FontAsset.prototype.getFontName = function () {
            return this.fontName;
        };
        /**
         * Load the asset
         * @method asset.FontAsset#load
         */
        FontAsset.prototype.load = function () {
            var _this = this;
            // Construct hashed name for game use
            this.fontName = "font" + this.getSimpleHash(this.path);
            // Add font to document and wait for browser to load the font
            var styleElement = document.createElement('style');
            var fontDesc = "@font-face {" + "font-family: \"" + this.fontName + "\";" + "src: url(\"" + this.path + "\") format(\"opentype\");" + "}";
            styleElement.appendChild(document.createTextNode(fontDesc));
            document.head.appendChild(styleElement);
            var fontWatcher = new FontWatcher(this.fontName, 5000);
            fontWatcher.getEvents().add({
                onLoadComplete: function () { return _this.onLoadComplete(); },
                onLoadTimeout: function () { return _this.onLoadTimeout(); }
            });
            fontWatcher.start();
        };
        /**
         * Handler when font loads successfully
         * @method asset.FontAsset#onLoadComplete
         * @private
         */
        FontAsset.prototype.onLoadComplete = function () {
            this.signal.onComplete(this);
        };
        /**
         * Handler when timeout occurs during font load
         * @method asset.FontAsset#onLoadTimeout
         * @private
         */
        FontAsset.prototype.onLoadTimeout = function () {
            // Log error
            //this.signal.onError(this.path, "Loading font timeout", 0, this);
            console.warn('Load error for ' + this.path);
            this.signal.onComplete(this);
        };
        /**
         * Simple hash for constructing internal font names from url
         * @method asset.FontAsset#getSimpleHash
         * @private
         * @param {string} input Url to hash
         * @returns {string} Generated font name
         */
        FontAsset.prototype.getSimpleHash = function (input) {
            var hash = 0;
            if (input.length == 0)
                return hash.toString();
            for (var i = 0; i < input.length; i++) {
                var character = input.charCodeAt(i);
                hash = ((hash << 5) - hash) + character;
                hash = hash & hash; // Convert to 32bit integer
            }
            return hash.toString();
        };
        return FontAsset;
    })();
    exports.FontAsset = FontAsset;
    /**
     * Helper class for handling touch and mouse events.
     * Listen to events from a given object with dispatcher.watch(element) or dispatcher.watch("elementId").
     * Register for events only from one object with dispatcher.watch(element, listener).
     * Register for events from all watched objects with dispatcher.getEvents().add(listener).
     * @class asset.TouchEventDispatcher
     * @classdesc Helper class for handling touch and mouse events
     */
    var InputEventDispatcher = (function () {
        /**
         * constructor
         */
        function InputEventDispatcher() {
            this.signal = {
                onClicked: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
         * Get the event object that listeners can register with
         * @method asset.InputEventDispatcher#getEvents
         * @public
         * @returns {events.EventDispatcher} The event object
         */
        InputEventDispatcher.prototype.getEvents = function () {
            return this.events;
        };
        InputEventDispatcher.prototype.watch = function (node, listener) {
            var _this = this;
            var target = null;
            if (typeof node == "string") {
                target = document.getElementById(node);
            }
            else if (typeof node == "object") {
                target = node;
            }
            if (target != null) {
                target.addEventListener("click", function (e) { return _this.handleClick(e, listener); });
                target.addEventListener("touchend", function (e) { return _this.handleTouch(e, listener); });
            }
            else {
                throw "Invalid watch target: " + node;
            }
        };
        /**
         * Touch event handler
         * @method asset.InputEventDispatcher#handleTouch
         * @private
         * @param {TouchEvent} e Event data
         * @param {IInputEventListener} The custom listener to be called
         */
        InputEventDispatcher.prototype.handleTouch = function (e, listener) {
            e.preventDefault();
            this.handleInput({
                original: e,
                type: e.type,
                source: e.srcElement,
                x: e.pageX,
                y: e.pageY
            }, listener);
        };
        /**
         * Click event handler
         * @method asset.InputEventDispatcher#handleClick
         * @private
         * @param {MouseEvent} e Event data
         * @param {IInputEventListener} The custom listener to be called
         */
        InputEventDispatcher.prototype.handleClick = function (e, listener) {
            e.preventDefault();
            this.handleInput({
                original: e,
                type: e.type,
                source: e.srcElement,
                x: e.x,
                y: e.y,
            }, listener);
        };
        /**
         * Generic event handler
         * @method asset.InputEventDispatcher#handleInput
         * @private
         * @param {InputEventData} e Event data
         * @param {IInputEventListener} The custom listener to be called.
         */
        InputEventDispatcher.prototype.handleInput = function (e, listener) {
            //Send out the event to source-specific listener if there is one
            if (listener != null) {
                listener.onClicked(e);
            }
            //Send out the event to generic listeners
            this.signal.onClicked(e);
        };
        return InputEventDispatcher;
    })();
    exports.InputEventDispatcher = InputEventDispatcher;
    /**
     * JSON Asset
     * @class asset.JSONAsset
     * @classdesc Loads a JSON asset
     */
    var JSONAsset = (function () {
        /**
         * @constructor
         */
        function JSONAsset(path) {
            /**
             * Flag to indicate if the asset has been loaded
             * @member asset.JSONAsset#isLoaded
             * @private
             * @type {boolean}
             * @default false
             */
            this.isLoaded = false;
            this.path = path;
            this.signal = {
                onProgress: null,
                onComplete: null,
                onError: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
          * Get the path to the asset
          * @method asset.JSONAsset#getPath
          * @public
          * @returns {string} The path to the asset
          */
        JSONAsset.prototype.getPath = function () {
            return this.path;
        };
        /**
         * Check if the asset is loaded
         * @method asset.JSONAsset#getIsLoaded
         * @public
         * @returns {boolean} True if the asset is loaded
         */
        JSONAsset.prototype.getIsLoaded = function () {
            return this.isLoaded;
        };
        /**
         * Get the loaded data
         * @method asset.JSONAsset#getPayload
         * @public
         * @returns {Object} The loaded data for the audio asset
         */
        JSONAsset.prototype.getPayload = function () {
            return this.payload;
        };
        /**
          * Get the event dispatcher
          * @method asset.JSONAsset#getEvents
          * @public
          * @returns {events.EventDispatcher<IAssetListener<Object>>} The event dispatcher
          */
        JSONAsset.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * Load the asset
         * @method asset.JSONAsset#load
         * @public
         */
        JSONAsset.prototype.load = function () {
            var _this = this;
            var connection = new httpconnection.HttpConnectionFactory().createConnection(this.path, "", 0 /* GET */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.handleJSONLoadComplete(response.responseText);
                },
                onFail: null,
                onProgress: function (url, totalBytes, loadedBytes) {
                    _this.signal.onProgress(loadedBytes / totalBytes, _this);
                }
            });
            connection.send();
        };
        JSONAsset.prototype.handleJSONLoadComplete = function (data) {
            this.payload = JSON.parse(data);
            this.isLoaded = true;
            this.signal.onComplete(this);
        };
        return JSONAsset;
    })();
    exports.JSONAsset = JSONAsset;
});
