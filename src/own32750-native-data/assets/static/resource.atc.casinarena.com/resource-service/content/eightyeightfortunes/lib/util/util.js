define(["require", "exports"], function (require, exports) {
    /**
     * Wraps the PartnerAdapter to make a few functions available statically.
     */
    var ErrorReporter = (function () {
        function ErrorReporter() {
        }
        /**
         * Set the static instance of the partner adapter.
         */
        ErrorReporter.setPartnerAdapter = function (partnerAdapter) {
            ErrorReporter.partnerAdapter = partnerAdapter;
        };
        /**
         * Set the static instance of the translator, required for translating error dialog text.
         */
        ErrorReporter.setTranslator = function (translator) {
            ErrorReporter.translator = translator;
        };
        /**
         * Display an error to the user and optionally log some diagnostic information.
         *
         * @param displayError The message to display. Translation will be attempted.
         * @param diagnosticError An optional technical message to log. Not translated.
         * @param callback An optional function to call after the message has been displayed.
         */
        ErrorReporter.showError = function (displayError, diagnosticError, callback) {
            if (callback == null) {
                callback = function () {
                }; // Don't pass an undefined callback to the partnerAdapter.
            }
            if (diagnosticError != null) {
                console.log(diagnosticError);
            }
            if (ErrorReporter.partnerAdapter != null) {
                var heading = ErrorReporter.tryToTranslate('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_HEADER');
                var message = ErrorReporter.tryToTranslate(displayError);
                var button = ErrorReporter.tryToTranslate('com.williamsinteractive.mobile.mobile.OK');
                ErrorReporter.partnerAdapter.showError(heading, message, button, callback);
            }
            else {
                // If the partner adapter wasn't available, log the message and call back back right away.
                console.log('ErrorReporter called without PartnerAdapter: ' + ErrorReporter.tryToTranslate(displayError));
                callback();
            }
        };
        /**
         * Attempt to translate the given string.
         * If translation fails, the text will be returned unmodified.
         */
        ErrorReporter.tryToTranslate = function (text) {
            if (ErrorReporter.translator != null) {
                var output = ErrorReporter.translator.findByKey(text);
                if (output != null) {
                    return output;
                }
            }
            return text;
        };
        return ErrorReporter;
    })();
    exports.ErrorReporter = ErrorReporter;
    /**
     * Indexers for url match data
     */
    var URLParts;
    (function (URLParts) {
        URLParts[URLParts["URL"] = 0] = "URL";
        URLParts[URLParts["PROTOCOL"] = 1] = "PROTOCOL";
        URLParts[URLParts["USERINFO"] = 2] = "USERINFO";
        URLParts[URLParts["DOMAIN"] = 3] = "DOMAIN";
        URLParts[URLParts["PORT"] = 4] = "PORT";
        URLParts[URLParts["PATH"] = 5] = "PATH";
        URLParts[URLParts["PAGE"] = 6] = "PAGE";
        URLParts[URLParts["EXT"] = 7] = "EXT";
        URLParts[URLParts["QUERY"] = 8] = "QUERY";
        URLParts[URLParts["ANCHOR"] = 9] = "ANCHOR";
    })(URLParts || (URLParts = {}));
    /**
     * Create a new URL object.
     * @class wfxutil.URL
     * @classdesc Provides data about and manipulates URLs
     */
    var URL = (function () {
        /**
         * @constructor
         * @param {string} url The full URL path
         */
        function URL(url) {
            /**
             * Entire URL – url being parsed
             */
            this.url = "";
            /**
             * Protocol – http, https, ftp
             */
            this.protocol = "";
            /**
             * Userinfo – username:password
             */
            this.userinfo = "";
            /**
             * Domain – www.mydomain.com, mydomain.com, 127.0.0.1, localhost…
             */
            this.domain = "";
            /**
             * Port – 80
             */
            this.port = 0;
            /**
             * Path / Folders – /folder/dir/
             */
            this.pathname = "";
            /**
             * Page / Filename – eg. index
             */
            this.basename = "";
            /**
             * File extension – .html, .php…
             */
            this.extension = "";
            /**
             * filename + extension - index.html, image.png
             */
            this.fullname = "";
            /**
             * Query string – item=value&item2=value2
             */
            this.querystring = "";
            /**
             * Query object - {item: value, item2: value2}
             */
            this.querydata = {};
            /**
             * Anchor – #home
             */
            this.anchor = "";
            this.url = url;
            var result = url.match(URL.regex);
            if (result) {
                this.url = result[0 /* URL */] || "";
                this.protocol = result[1 /* PROTOCOL */] || "";
                this.userinfo = result[2 /* USERINFO */] || "";
                this.domain = result[3 /* DOMAIN */] || "";
                this.port = parseInt(result[4 /* PORT */] || "0");
                this.pathname = result[5 /* PATH */] || "";
                this.basename = result[6 /* PAGE */] || "";
                this.extension = result[7 /* EXT */] || "";
                this.fullname = this.basename + this.extension;
                this.querystring = result[8 /* QUERY */] || "";
                this.anchor = result[9 /* ANCHOR */] || "";
                this.parseQuery();
            }
        }
        /**
         * Parse the query string into an object
         */
        URL.prototype.parseQuery = function () {
            var _this = this;
            this.querystring.replace(URL.query, function ($0, $1, $2, $3) {
                _this.querydata[$1] = $3;
                return $0;
            });
        };
        /**
         * URL regex 1.2
         * http://someweblog.com/url-regular-expression-javascript-link-shortener/
         */
        URL.regex = /\(?(?:(http|https|ftp):\/\/)?(?:((?:[^\W\s]|\.|-|[:]{1})+)@{1})?((?:www.)?(?:[^\W\s]|\.|-)+[\.][^\W\s]{2,4}|localhost(?=\/|:)|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|(?=\/|[^\W\s])+)(?::(\d*))?([\/]?[^\s\?]*[\/]{1})*(?:\/?([^\s\n\?\[\]\{\}\#]*(?:(?=\.)){1}|[^\s\n\?\[\]\{\}\.\#]*)?([\.]{1}[^\s\?\#]*)?)?(?:\?{1}([^\s\n\#\[\]]*))?([\#][^\s\n]*)?\)?/;
        /**
         * Query string regex
         */
        URL.query = /([^?=&]+)(=([^&]*))?/g;
        return URL;
    })();
    exports.URL = URL;
    /**
     * Device Context
     * @class Game.DeviceContext
     * @classdesc Holds information for a game to figure out scale and device type
     */
    var DeviceContext = (function () {
        /**
         * @constructor
         */
        function DeviceContext(baselineWidth, baselineHeight) {
            if (baselineHeight == null) {
                baselineHeight = 1200;
            }
            if (baselineWidth == null) {
                baselineWidth = 1920;
            }
            this.baselineHeight = baselineHeight;
            this.baselineWidth = baselineWidth;
        }
        /**
         * Getst the baseline width
         * @method Game.DeviceContext#getBaselineWidth
         * @public
         * @returns {number} The baseline width
         */
        DeviceContext.prototype.getBaselineWidth = function () {
            return this.baselineWidth;
        };
        /**
         * Gets the baseline height
         * @method Game.DeviceContext#getBaselineHeight
         * @public
         * @returns {number} The baseline height
         */
        DeviceContext.prototype.getBaselineHeight = function () {
            return this.baselineHeight;
        };
        /**
         * Gets the scaled user screen width
         * @method Game.DeviceContext#getScaledScreenWidth
         * @public
         * @returns {number} The scaled screen width
         */
        DeviceContext.prototype.getScaledScreenWidth = function () {
            return this.baselineWidth * this.getScalar();
        };
        /**
         * Gets the scaled user screen height
         * @method Game.DeviceContext#getScaledScreenHeight
         * @public
         * @returns {number} The scaled screen height
         */
        DeviceContext.prototype.getScaledScreenHeight = function () {
            return this.baselineHeight * this.getScalar();
        };
        /**
          * Computes and returns the scale factor
          * @method Game.DeviceContext#getScalar
          * @public
          * @returns {number} The scale factor to be us`ed by the game
          */
        DeviceContext.prototype.getScalar = function () {
            /** TEMP **/
            var ratioX = window.innerWidth / this.baselineWidth;
            var ratioY = window.innerHeight / this.baselineHeight;
            return Math.min(1.0, Math.min(ratioX, ratioY));
            if (DeviceContext.isMobile()) {
                var ratioX = window.innerWidth / this.baselineWidth;
                var ratioY = window.innerHeight / this.baselineHeight;
                return Math.min(1.0, Math.min(ratioX, ratioY));
            }
            else {
                return 1.0;
            }
        };
        /**
         * Determines if the device is mobile or desktop
         * @method Game.DeviceContext#isMobile
         * @private
         * @returns {boolean} True if the device is a mobile device
         */
        DeviceContext.isMobile = function () {
            return (navigator.userAgent.match(/Android/i) != null || navigator.userAgent.match(/iPhone|iPad|iPod/i) != null);
        };
        return DeviceContext;
    })();
    exports.DeviceContext = DeviceContext;
});
