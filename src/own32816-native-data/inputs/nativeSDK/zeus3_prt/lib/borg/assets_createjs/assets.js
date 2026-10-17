var assets;
(function (assets) {
    /**
     * The Asset class implements the IAsset interface.
     *
     * Assets can be any type of file including audio, graphic and document files. Asset files are not used on there own but instead are used by classes such as the AudioSound or Bitmap to deliver content to the end user.
     *
     * All externally loaded assets should be IAsset implementations that have been created by an IAssetLoader.
     */
    var Asset = (function () {
        /**
         * @param id ID used to retrieve the IAsset from the AssetCache.
         * @param path The path of the asset to be loaded.
         * @param data Raw data that has been loaded.
         */
        function Asset(id, path, data) {
            this.id = id;
            this.path = path;
            this.data = data;
        }
        return Asset;
    })();
    assets.Asset = Asset;
})(assets || (assets = {}));
var assets;
(function (assets) {
    /**
     * The AssetCache class implements the IAssetCache interface.
     *
     * All assets loaded via an AssetLoader instance are added to the AssetCache. These can be accessed statically by any object via the assets id or file path.
     */
    var AssetCache = (function () {
        function AssetCache() {
        }
        /**
         * Adds an IAsset that can be accessed by any object.
         *
         * Unless absolutely necessary the only class that should use this method is AssetLoader.
         */
        AssetCache.addAsset = function (asset) {
            this._indexedCache.push(asset);
            this._namedCache[asset.id] = asset;
        };
        /**
         * @inheritdoc
         * @param id @inheritdoc
         */
        AssetCache.prototype.getAssetById = function (id) {
            return AssetCache._namedCache[id];
        };
        /**
         * @inheritdoc
         * @param path @inheritdoc
         */
        AssetCache.prototype.getAssetByPath = function (path) {
            for (var i = 0; i < AssetCache._indexedCache.length; i++) {
                if (AssetCache._indexedCache[i].path == path) {
                    return AssetCache._indexedCache[i];
                }
            }
            return null;
        };
        AssetCache._indexedCache = [];
        AssetCache._namedCache = {};
        return AssetCache;
    })();
    assets.AssetCache = AssetCache;
})(assets || (assets = {}));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var assets;
(function (assets_1) {
    /**
     * The AssetLoader class implements the IAssetLoader interface.
     *
     * The AssetLoader class is responsible for loading external resources, creating new Asset class instances and making them available via the AssetCache.
     *
     * All externally loaded assets should be IAsset implementations that have been created by an IAssetLoader.
     */
    var AssetLoader = (function (_super) {
        __extends(AssetLoader, _super);
        function AssetLoader() {
            _super.call(this);
            this._fileList = [];
            this._aliasList = [];
            this._preload = new createjs.LoadQueue(false, "", true);
            this._preload.setMaxConnections(10);
        }
        /**
         * @inheritdoc
         * @param path @inheritdoc
         * @param alias @inheritdoc
         */
        AssetLoader.prototype.addFile = function (path, alias) {
            this._fileList.push(path);
            this._aliasList.push(alias);
            return this;
        };
        /**
         * @inheritdoc
         */
        AssetLoader.prototype.load = function () {
            var manifest = [];
            for (var i = 0; i < this._fileList.length; i++) {
                manifest.push({ src: this._fileList[i], id: this._aliasList[i] });
            }
            this._preload.on("progress", this.onProgress, this);
            this._preload.on("complete", this.onAllLoaded, this);
            this._preload.loadManifest(manifest, true);
            return this;
        };
        /**
         * Dispatches AssetLoaderEvent.PROGRESS as items are loaded.
         */
        AssetLoader.prototype.onProgress = function (e) {
            this.dispatchEvent(new assets_1.AssetLoaderEvent(assets_1.AssetLoaderEvent.PROGRESS, this, this._preload.progress * 100));
        };
        /**
         * Dispatches AssetLoaderEvent.COMPLETE when all specified files have been loaded.
         */
        AssetLoader.prototype.onAllLoaded = function (e) {
            var assets = [];
            for (var i = 0; i < this._fileList.length; i++) {
                var asset = new assets_1.Asset(this._aliasList[i], this._fileList[i], this._preload.getResult(this._aliasList[i]));
                assets.push(asset);
                assets_1.AssetCache.addAsset(asset);
            }
            var fontLoader = new assets_1.FontLoader();
            fontLoader.addEventListener(assets_1.FontEvent.COMPLETE, this.onFontsComplete, this);
            fontLoader.start(assets);
        };
        /**
         * Callback when fonts have finished loading
         *
         * @protected
         * @param {FontEvent} e The fontevent dispatched
         */
        AssetLoader.prototype.onFontsComplete = function (e) {
            this.dispatchEvent(new assets_1.AssetLoaderEvent(assets_1.AssetLoaderEvent.COMPLETE, this));
        };
        return AssetLoader;
    })(borgevent.EventDispatcher);
    assets_1.AssetLoader = AssetLoader;
})(assets || (assets = {}));
var assets;
(function (assets) {
    var Frame = (function () {
        function Frame(imageAsset, x, y, width, height, pivotX, pivotY) {
            if (pivotX === void 0) { pivotX = 0; }
            if (pivotY === void 0) { pivotY = 0; }
            this.imageAsset = imageAsset;
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.pivotX = pivotX;
            this.pivotY = pivotY;
        }
        return Frame;
    })();
    assets.Frame = Frame;
})(assets || (assets = {}));
var assets;
(function (assets) {
    /**
     * AssetLoaderEvent's are dispatched by IAssetLoader implementations to listeners when it has loaded all assets.
     */
    var AssetLoaderEvent = (function (_super) {
        __extends(AssetLoaderEvent, _super);
        /**
         * @param eventName Type of Event.
         * @param loader IAssetLoader that dispatched the event.
         */
        function AssetLoaderEvent(eventName, loader, progress) {
            if (progress === void 0) { progress = -1; }
            _super.call(this, eventName);
            this._progress = progress;
            this._loader = loader;
        }
        Object.defineProperty(AssetLoaderEvent.prototype, "loader", {
            /**
             * IAssetLoader that dispatched the event.
             */
            get: function () {
                return this._loader;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(AssetLoaderEvent.prototype, "progress", {
            /**
             * Loading progress from 0-100.
             */
            get: function () {
                return this._progress;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatched when an IAssetLoader has loaded all specified files.
         */
        AssetLoaderEvent.COMPLETE = "AssetLoaderEvent_COMPLETE";
        /**
         * Dispatched preiodically as the game loads.
         */
        AssetLoaderEvent.PROGRESS = "AssetLoaderEvent_PROGRESS";
        return AssetLoaderEvent;
    })(borgevent.Event);
    assets.AssetLoaderEvent = AssetLoaderEvent;
})(assets || (assets = {}));
var assets;
(function (assets) {
    /**
     * FontEvents's are dispatched by a FontLoader or FontWatcher to listeners when they suceed or fail.
     */
    var FontEvent = (function (_super) {
        __extends(FontEvent, _super);
        /**
         * @param eventName Type of Event.
         */
        function FontEvent(eventName) {
            _super.call(this, eventName);
        }
        /**
         * Dispatched when loading was sucessful.
         */
        FontEvent.COMPLETE = "AssetLoaderEvent_COMPLETE";
        /**
         * Dispatched when loading fails.
         */
        FontEvent.TIME_OUT = "AssetLoaderEvent_TIME_OUT";
        return FontEvent;
    })(borgevent.Event);
    assets.FontEvent = FontEvent;
})(assets || (assets = {}));
var assets;
(function (assets_2) {
    /**
     * The FontLoader manages loading of font files from the provided assets.
     *
     * @export
     * @class FontLoader
     * @extends {borgevent.EventDispatcher}
     */
    var FontLoader = (function (_super) {
        __extends(FontLoader, _super);
        /**
         * Creates an instance of FontLoader.
         */
        function FontLoader() {
            _super.call(this);
        }
        /**
         * Start the loading prcoess. Any non font files from the asset list are ignored.
         *
         * @param {IAsset[]} assets List of assets to attempt to load.
         */
        FontLoader.prototype.start = function (assets) {
            this._assets = [];
            for (var i = 0; i < assets.length; i++) {
                var fileParts = assets[i].path.split(".");
                var fileType = fileParts[fileParts.length - 1].toLowerCase();
                //console.log(fileType);
                if (fileType == "otf") {
                    this._assets.push(assets[i]);
                }
            }
            if (this._assets.length > 0) {
                this.loadFontAssets();
            }
            else {
                this.dispatchEvent(new assets_2.FontEvent(assets_2.FontEvent.COMPLETE));
            }
        };
        /**
         * Attempts to load the font for all the assets identified as fonts.
         *
         * @protected
         */
        FontLoader.prototype.loadFontAssets = function () {
            this._loaded = 0;
            this._failed = 0;
            for (var i = 0; i < this._assets.length; i++) {
                var fontName = this._assets[i].id;
                var styleElement = document.createElement('style');
                var fontDesc = "@font-face {" +
                    "font-family: \"" + fontName + "\";" +
                    "src: url(\"" + this._assets[i].path + "\") format(\"opentype\");" +
                    "}";
                styleElement.appendChild(document.createTextNode(fontDesc));
                document.head.appendChild(styleElement);
                var fontWatcher = new assets_2.FontWatcher(fontName, 5000);
                fontWatcher.addEventListener(assets_2.FontEvent.COMPLETE, this.onFontComplete, this);
                fontWatcher.addEventListener(assets_2.FontEvent.TIME_OUT, this.onFontTimeOut, this);
                fontWatcher.start();
            }
        };
        /**
         * Callback when a FontWatcher sucessfully loads a font.
         *
         * @protected
         * @param {FontEvent} e FontEvent dispatched.
         */
        FontLoader.prototype.onFontComplete = function (e) {
            this._loaded++;
            this.checkComplete();
        };
        /**
         * Callback when a FontWatcher fails to load a font.
         *
         * @protected
         * @param {FontEvent} e FontEvent dispatched.
         */
        FontLoader.prototype.onFontTimeOut = function (e) {
            this._failed++;
            this.checkComplete();
        };
        /**
         * Checks whether loading all files has completed and dispatches FontEvent.COMPLETE.
         *
         * @protected
         */
        FontLoader.prototype.checkComplete = function () {
            if (this._failed + this._loaded == this._assets.length) {
                this.dispatchEvent(new assets_2.FontEvent(assets_2.FontEvent.COMPLETE));
            }
        };
        return FontLoader;
    })(borgevent.EventDispatcher);
    assets_2.FontLoader = FontLoader;
})(assets || (assets = {}));
/**
 * @class FontRuler
 * @classdesc Utility for calculating text width
 */
var assets;
(function (assets) {
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
    assets.FontRuler = FontRuler;
})(assets || (assets = {}));
var assets;
(function (assets) {
    /**
     * @class FontWatcher
     * @classdesc Monitors document to verify if a font has been loaded
     */
    var FontWatcher = (function (_super) {
        __extends(FontWatcher, _super);
        function FontWatcher(fontName, timeout) {
            _super.call(this);
            this.serif = "serif";
            this.sansSerif = "sans-serif";
            /**
             * Default test string. Characters are chosen so that their widths vary a lot
             * between the fonts in the default stacks. We want each fallback stack
             * to always start out at a different width than the other.
             */
            this.defaultFontTestString = 'BESbswy';
            this.fontName = fontName;
            this.fontTestString = this.defaultFontTestString;
            this.timeout = timeout;
            this.fontRulerSerif = new assets.FontRuler(this.fontTestString, this.serif);
            this.fontRulerSansSerif = new assets.FontRuler(this.fontTestString, this.sansSerif);
        }
        /*
        * Starts watching the font loading
        */
        FontWatcher.prototype.start = function () {
            this.fontRulerFallbackSerif = new assets.FontRuler(this.fontTestString, this.fontName + ',' + this.serif);
            this.fontRulerFallbackSansSerif = new assets.FontRuler(this.fontTestString, this.fontName + ',' + this.sansSerif);
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
                    this.dispatchEvent(new assets.FontEvent(assets.FontEvent.TIME_OUT));
                }
                else {
                    this.asyncCheck();
                }
            }
            else {
                this.dispatchEvent(new assets.FontEvent(assets.FontEvent.COMPLETE));
            }
        };
        FontWatcher.prototype.asyncCheck = function () {
            var _this = this;
            window.setTimeout(function () {
                _this.check();
            }, 25);
        };
        return FontWatcher;
    })(borgevent.EventDispatcher);
    assets.FontWatcher = FontWatcher;
})(assets || (assets = {}));
