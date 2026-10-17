define(["require", "exports", "util/util"], function (require, exports, util) {
    /**
     * An event dispatcher
     * @class wfxutil.EventDispatcher
     * @classdesc An event dispatcher that modifies a provided signal object to dispatch multicast
     * events. Enforces a compile-time type match between the signal object and listeners.
     */
    var EventDispatcher = (function () {
        /**
         * @constructor
         * @param {T} signal The signal object. A call on the signal object will
         * invoke a call to the matching function on all listeners
         */
        function EventDispatcher(signal) {
            /**
             * Event listener list
             * @member events.EventDispatcher#listeners
             * @private
             * @type {Array<T>}
             */
            this.listeners = new Array();
            this.applySignals(signal);
        }
        /**
         * Add a listener
         * @method events.EventDispatcher#add
         * @public
         * @param {T} listener The listener to add
         */
        EventDispatcher.prototype.add = function (listener) {
            this.listeners.push(listener);
        };
        /**
         * Replace all properties on signal object with signal dispatchers
         * @method events.EventDispatcher#applySignals
         * @private
         * @param {any} signal The signal object
         */
        EventDispatcher.prototype.applySignals = function (signal) {
            var _this = this;
            Object.getOwnPropertyNames(signal).forEach(function (name) {
                try {
                    signal[name] = function () {
                        var params = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            params[_i - 0] = arguments[_i];
                        }
                        return _this.dispatch(name, params);
                    };
                }
                catch (e) {
                    util.ErrorReporter.showError('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_BODY', 'Error registering signal object: ' + e.message);
                }
            });
        };
        /**
         * Call the specificied function on all listeners
         * @method events.EventDispatcher#dispatch
         * @private
         * @param {string} name The function name to call
         * @param {Array<any>} params An array of parameters to pass
         */
        EventDispatcher.prototype.dispatch = function (name, params) {
            this.listeners.forEach(function (listener) {
                try {
                    var callback = listener[name];
                    if (callback != null) {
                        callback.apply(listener, params);
                    }
                }
                catch (e) {
                    util.ErrorReporter.showError('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_BODY', 'Dispatch failed: ' + e.message);
                }
            });
        };
        return EventDispatcher;
    })();
    exports.EventDispatcher = EventDispatcher;
});
