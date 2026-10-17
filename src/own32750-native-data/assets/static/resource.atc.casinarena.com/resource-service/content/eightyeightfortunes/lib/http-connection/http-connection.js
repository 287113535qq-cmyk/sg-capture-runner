define(["require", "exports", "events/events"], function (require, exports, events) {
    /**
     * @class HttpMethod
     * @classdesc Enumeration of HTTP methods
     */
    (function (HttpMethod) {
        HttpMethod[HttpMethod["GET"] = 0] = "GET";
        HttpMethod[HttpMethod["POST"] = 1] = "POST";
    })(exports.HttpMethod || (exports.HttpMethod = {}));
    var HttpMethod = exports.HttpMethod;
    /**
     * @class QueryStringBuilder
     * @classdesc Utility class to build HTTP query strings
     */
    var QueryStringBuilder = (function () {
        function QueryStringBuilder() {
            this.nameValues = [];
            this.nameValues = [];
        }
        QueryStringBuilder.prototype.add = function (name, value) {
            this.nameValues.push({ name: name, value: value });
        };
        QueryStringBuilder.prototype.toQueryString = function () {
            var segments = [], nameValue;
            for (var i = 0, len = this.nameValues.length; i < len; i++) {
                nameValue = this.nameValues[i];
                segments[i] = encodeURIComponent(nameValue.name) + "=" + encodeURIComponent(nameValue.value);
            }
            var queryString = segments.join("&");
            return (queryString == "" ? queryString : "?" + queryString);
        };
        return QueryStringBuilder;
    })();
    exports.QueryStringBuilder = QueryStringBuilder;
    /**
     * @class QueryStringBuilderFactory
     * @classdesc Factory for constructing QueryStringBuilders
     */
    var QueryStringBuilderFactory = (function () {
        function QueryStringBuilderFactory() {
        }
        QueryStringBuilderFactory.prototype.createQueryStringBuilder = function () {
            return new QueryStringBuilder();
        };
        return QueryStringBuilderFactory;
    })();
    exports.QueryStringBuilderFactory = QueryStringBuilderFactory;
    var HttpSpecificErrorConnection = (function () {
        function HttpSpecificErrorConnection(xhrObject, url, xmlData, requestHeaders, httpMethod, async, win) {
            var _this = this;
            this.xhrObject = xhrObject;
            this.requestHeaders = requestHeaders;
            this.httpMethod = httpMethod;
            this.xmlHttpTimeoutId = -1;
            this.xmlHttpTimeoutMs = -1;
            this.url = url;
            this.async = async;
            this.xmlData = xmlData;
            this.timedOut = false;
            this.retryCallback = function () {
            };
            this.recoveredConnectionDelegator = function () {
            };
            this.win = win;
            this.win.addEventListener("online", function () { return _this.handleRestoredConnection(); });
        }
        HttpSpecificErrorConnection.prototype.setUrl = function (url) {
            this.url = url;
        };
        HttpSpecificErrorConnection.prototype.send = function (doneCallback, failCallback, metadataCallback) {
            var _this = this;
            this.doneCallback = doneCallback;
            this.failCallback = failCallback;
            this.metadataCallback = metadataCallback;
            var httpMethodString = HttpMethod[this.httpMethod]; // convert to string value
            this.xhrObject.onreadystatechange = function (event) { return _this.handleStateChange(event); };
            this.xhrObject.onerror = function (event) { return _this.handleError(event); };
            this.xhrObject.open(httpMethodString, this.url, this.async);
            this.requestHeaders.setHeadersOnXHRRequest(this.xhrObject);
            this.xhrObject.send(this.xmlData);
        };
        HttpSpecificErrorConnection.prototype.sendWithTimeout = function (doneCallback, failCallback, timeoutCallback, timeoutInMs, retryCallback, metadataCallback, lostConnectionCallback, recoveredFromLostConectionCallback) {
            var _this = this;
            this.recoveredFromLostConnectionCallback = recoveredFromLostConectionCallback;
            this.lostConnectionCallback = lostConnectionCallback;
            if (!this.win.navigator.onLine) {
                this.recoveredConnectionDelegator = this.recoveredFromLostConnectionCallback;
                this.lostConnectionCallback();
                return;
            }
            var httpMethodString = HttpMethod[this.httpMethod]; // convert to string value
            this.doneCallback = doneCallback;
            this.failCallback = failCallback;
            this.timeoutCallback = timeoutCallback;
            this.retryCallback = retryCallback;
            this.metadataCallback = metadataCallback;
            this.xhrObject.onreadystatechange = function (event) { return _this.handleStateChange(event); };
            this.xhrObject.onerror = function (event) { return _this.handleError(event); };
            this.xhrObject.onprogress = function (event) { return _this.handleProgress(event); };
            this.xhrObject.open(httpMethodString, this.url, this.async);
            this.requestHeaders.setHeadersOnXHRRequest(this.xhrObject);
            // timeout property is (yet) only supported in some browsers, see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Browser_Compatibility
            //this.xhrObject.timeout = timeoutInMs;
            //this.xhrObject.ontimeout = (event: Event) => this.timeoutCallback();
            this.xhrObject.send(this.xmlData);
            this.xmlHttpTimeoutMs = timeoutInMs;
            this.xmlHttpTimeoutId = setTimeout(function () { return _this.handleTimeout(); }, this.xmlHttpTimeoutMs);
        };
        HttpSpecificErrorConnection.prototype.handleProgress = function (event) {
            var _this = this;
            //break timeout and set it up again
            if (this.xmlHttpTimeoutId < 0) {
                return;
            }
            // remove old timeout
            clearTimeout(this.xmlHttpTimeoutId);
            //add new timeout
            this.xmlHttpTimeoutId = setTimeout(function () { return _this.handleTimeout(); }, this.xmlHttpTimeoutMs);
        };
        HttpSpecificErrorConnection.prototype.handleStateChange = function (event) {
            if (this.timedOut) {
                this.timedOut = false;
                return;
            }
            this.xhrObject.onerror = null;
            if (this.xhrObject.readyState == 4) {
                clearTimeout(this.xmlHttpTimeoutId);
                this.timedOut = false;
                switch (this.xhrObject.status) {
                    case 200:
                        this.metadataCallback(this.compileMetaData());
                        this.doneCallback(this.url, this.xhrObject.responseText);
                        break;
                    case 202:
                        this.metadataCallback(this.compileMetaData());
                        this.retryCallback(this.xhrObject.responseText);
                        break;
                    default:
                        this.failCallback(this.url, this.xhrObject.responseText);
                        break;
                }
            }
        };
        // TODO: This need to be re-done with a header response translator of some kind!
        HttpSpecificErrorConnection.prototype.compileMetaData = function () {
            var _this = this;
            return { getProxySessionId: function () { return _this.xhrObject.getResponseHeader("x-wms-proxysessionid"); } };
        };
        HttpSpecificErrorConnection.prototype.handleError = function (event) {
            this.xhrObject.onreadystatechange = null;
            this.failCallback(this.url, this.xhrObject.responseText);
        };
        HttpSpecificErrorConnection.prototype.handleTimeout = function () {
            this.timedOut = true;
            this.xhrObject.abort();
            this.timeoutCallback();
        };
        /**
         Handle restoration of connection by calling the recover connection
         delegate which referens a recover callback if no connection exist
         when trying to send. This callback needs to be reset after called to
         avoid alerting restored connection events when no sending has occured.
        */
        HttpSpecificErrorConnection.prototype.handleRestoredConnection = function () {
            this.recoveredConnectionDelegator();
            this.recoveredConnectionDelegator = function () {
            };
        };
        /**
         Removes the online event listener on window object. Should always be called before this object is destroyed
         */
        HttpSpecificErrorConnection.prototype.clean = function () {
            var _this = this;
            this.win.removeEventListener("online", function () { return _this.handleRestoredConnection(); });
        };
        return HttpSpecificErrorConnection;
    })();
    exports.HttpSpecificErrorConnection = HttpSpecificErrorConnection;
    var HttpConnectionFactory = (function () {
        function HttpConnectionFactory() {
        }
        HttpConnectionFactory.prototype.createRequestHeaders = function () {
            var requestHeaders = new RequestHeaders();
            return requestHeaders;
        };
        HttpConnectionFactory.prototype.createResponseHeaders = function () {
            var responseHeaders = new ResponseHeaders();
            return responseHeaders;
        };
        /**
        * @param url the url to request
        * @param data the body of the request
        */
        HttpConnectionFactory.prototype.createHttpConnection = function (url, data) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            var httpMethod = 0 /* GET */;
            return new HttpConnection(xhrObject, url, data, requestHeaders, httpMethod, true);
        };
        HttpConnectionFactory.prototype.createConnection = function (url, data, method) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            var httpMethod = method;
            return new HttpConnection(xhrObject, url, data, requestHeaders, httpMethod, true);
        };
        /**
        * @param url the url to request
        * @param data the body of the request
        * @param requestHeaders
        */
        HttpConnectionFactory.prototype.createHttpConnectionWithHeaders = function (url, data, requestHeaders) {
            var xhrObject = new XMLHttpRequest();
            var httpMethod = 0 /* GET */;
            return new HttpConnection(xhrObject, url, data, requestHeaders, httpMethod, true);
        };
        /**
        *
        * @deprecated Use regular HttpConnectionFactory.createHttpConnection
        *
        * @param url the url to request
        * @param data the body of the request
        */
        HttpConnectionFactory.prototype.createHttpSpecificErrorConnection = function (url, data) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            var httpMethod = 0 /* GET */;
            return new HttpSpecificErrorConnection(xhrObject, url, data, requestHeaders, httpMethod, true, window);
        };
        /**
        *
        * @deprecated Use regular HttpConnectionFactory.createHttpConnection
        *
        * @param url the url to request
        * @param data the body of the request
        */
        HttpConnectionFactory.prototype.createSynchronousHttpSpecificErrorConnection = function (url, data) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            var httpMethod = 0 /* GET */;
            return new HttpSpecificErrorConnection(xhrObject, url, data, requestHeaders, httpMethod, false, window);
        };
        return HttpConnectionFactory;
    })();
    exports.HttpConnectionFactory = HttpConnectionFactory;
    /**
     * HTTP requests
     * @class http-connection.HttpConnection
     * @classdesc XMLHttpRequest wrapper for making HTTP requests
     */
    var HttpConnection = (function () {
        /**
         * @constructor
         */
        function HttpConnection(xhrObject, url, xmlData, requestHeaders, httpMethod, async) {
            this.signal = {
                onComplete: null,
                onFail: null,
                onProgress: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
            this.xhrObject = xhrObject;
            this.requestHeaders = requestHeaders;
            this.httpMethod = httpMethod;
            this.url = url;
            this.async = async;
            this.xmlData = xmlData;
            this.retry = 5;
        }
        /**
         * Retrieve event dispatcher to add listeners
         * @method http-connection.HttpConnection#getEvents
         * @public
         * @returns {events.EventDispatcher<IHTTPResponseListener>} HttpConnection event dispatcher
         */
        HttpConnection.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Send the HTTP request
         * @method http-connection.HttpConnection#send
         * @public
         * @param {ResponseType} responseType Expected data type for response payload
         * @param {boolean} sendWithCredentials True if send with credentials, false otherwise
         */
        HttpConnection.prototype.send = function (responseType, sendWithCredentials) {
            var _this = this;
            if (responseType === void 0) { responseType = 0 /* DEFAULT */; }
            if (sendWithCredentials === void 0) { sendWithCredentials = false; }
            this.rt = responseType;
            this.swc = sendWithCredentials;
            var httpMethodString = HttpMethod[this.httpMethod]; // convert to string value
            var httpResponseTypeString;
            if (responseType === 0 /* DEFAULT */) {
                httpResponseTypeString = ""; // that is the default
            }
            else {
                httpResponseTypeString = ResponseType[responseType].toLowerCase(); // converts to string value and lowercase
            }
            this.xhrObject.onreadystatechange = function (event) { return _this.handleStateChange(event); };
            this.xhrObject.onerror = function (event) { return _this.handleError(event); };
            this.xhrObject.onprogress = function (event) { return _this.handleProgress(event); };
            this.xhrObject.open(httpMethodString, this.url, this.async);
            if (sendWithCredentials) {
                this.xhrObject.withCredentials = true;
            }
            this.xhrObject.responseType = httpResponseTypeString;
            this.requestHeaders.setHeadersOnXHRRequest(this.xhrObject);
            try {
                this.xhrObject.send(this.xmlData);
            }
            catch (error) {
                this.signal.onFail(this.url, "failed sending request", 0);
            }
        };
        /**
         * Abort the HTTP reuqest
         * @method http-connection.HttpConnection#abort
         * @public
         */
        HttpConnection.prototype.abort = function () {
            this.xhrObject.onerror = null;
            this.xhrObject.onreadystatechange = null;
            this.xhrObject.abort();
        };
        /**
         * Handle connection state change
         * @method http-connection.HttpConnection#handleStateChange
         * @private
         * @param {Event} event HTTP request event
         */
        HttpConnection.prototype.handleStateChange = function (event) {
            var _this = this;
            this.xhrObject.onerror = null;
            var message;
            if (this.xhrObject.readyState == 4) {
                console.log("XHR: handleStateChange[status: " + this.xhrObject.status + "]");
                if (this.xhrObject.status == 200) {
                    var responseHeaders = this.getResponseHeaders();
                    this.signal.onComplete(this.url, this.xhrObject, responseHeaders);
                }
                else if (this.xhrObject.status) {
                    console.log("XHR: handleStateChange[failed]");
                    try {
                        message = this.xhrObject.responseText;
                    }
                    catch (error) {
                        message = "unable to read response text";
                    }
                    this.signal.onFail(this.url, message, this.xhrObject.status);
                }
                else {
                    // Ok, a completed XHR with a status code of 0 means that the request probably didn't
                    // get out of the front door. It could be for any reason, including the server
                    // is not reachable. Since the request has not reached the server, we aren't worried
                    // about idempotent behavior. So, let's wait a second and then retry the request.
                    // If the server is down, the retry (max == 5) will prevent this from reoccuring
                    // indefinitely. If there's a networking hiccup on the host device (ahem, iOS 8!!)
                    // this will hopefully find a timeslice where it will work. -RF
                    console.log("XHR: handleStateChange[unknown status code: " + this.xhrObject.status + "]");
                    if (this.retry-- > 0) {
                        setTimeout(function () {
                            //this.xhrObject = new XMLHttpRequest();
                            //this.send(this.rt, this.swc);
                            message = "unable to read response text";
                            _this.signal.onFail(_this.url, message, _this.xhrObject.status);
                        }, 1000);
                    }
                }
            }
        };
        /**
         * Handle connection progress change
         * @method http-connection.HttpConnection#handleProgress
         * @private
         * @param {Event} event HTTP request event
         */
        HttpConnection.prototype.handleProgress = function (event) {
            var target = event.target;
            if (target.responseType != "arraybuffer") {
                this.signal.onProgress(this.url, target.responseText.length, event.loaded);
            }
        };
        /**
         * Handle connection error
         * @method http-connection.HttpConnection#handleError
         * @private
         * @param {Event} event HTTP request event
         */
        HttpConnection.prototype.handleError = function (event) {
            this.xhrObject.onreadystatechange = null;
            this.signal.onFail(this.url, event.message, this.xhrObject.status);
        };
        /**
         * Extract response headers
         * @method http-connection.HttpConnection#getResponseHeaders
         * @private
         * @returns {string} XMLHttpRequest response header
         */
        HttpConnection.prototype.getResponseHeaders = function () {
            return this.xhrObject.getAllResponseHeaders();
        };
        return HttpConnection;
    })();
    exports.HttpConnection = HttpConnection;
    /**
     * @class RequestHeaders
     * @classdesc Utility class for constructing HTTP request headers
     */
    var RequestHeaders = (function () {
        function RequestHeaders() {
            this.headers = new Array();
        }
        RequestHeaders.prototype.setContentTypeJSON = function () {
            this.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        };
        RequestHeaders.prototype.setCacheControlMaxAge = function (maxAge) {
            this.setRequestHeader("Cache-Control", "max-age=" + maxAge);
        };
        RequestHeaders.prototype.setHeadersOnXHRRequest = function (xhrObject) {
            // copy all headers to the xhrObject
            if (this.headers != null) {
                this.headers.forEach(function (header) {
                    xhrObject.setRequestHeader(header.key, header.value);
                });
            }
        };
        RequestHeaders.prototype.setRequestHeaders = function (headers) {
            this.headers = headers;
        };
        RequestHeaders.prototype.setRequestHeader = function (key, value) {
            var requestHeader = new Header();
            requestHeader.key = key;
            requestHeader.value = value;
            this.headers.push(requestHeader);
        };
        return RequestHeaders;
    })();
    exports.RequestHeaders = RequestHeaders;
    /**
     * @class Header
     * @classdesc Simple key-value data structure for headers
     */
    var Header = (function () {
        function Header() {
        }
        return Header;
    })();
    exports.Header = Header;
    /**
     * @class ResponseHeaders
     * @classdesc Utility class to construct HTTP response headers
     */
    var ResponseHeaders = (function () {
        function ResponseHeaders() {
            this.headers = new Array();
        }
        ResponseHeaders.prototype.addFromResponseHeadersString = function (str) {
            var responseObj = this.parseHeaders(str);
            for (var key in responseObj) {
                var header = new Header();
                header.key = key;
                header.value = responseObj[key];
                this.headers.push(header);
            }
        };
        ResponseHeaders.prototype.parseHeaders = function (headers) {
            var obj = new Object();
            // split on linefeed
            var headersArray = headers.split("\n");
            for (var i = 0; i < headersArray.length; i++) {
                var headerString = headersArray[i];
                // get the first colon. That splits the key and value
                var splitIndex = headerString.indexOf(":");
                var key = headerString.substring(0, splitIndex);
                var value = headerString.substring(splitIndex + 2);
                // Headers are terminated by \n\r. Just drop the \r if its present.
                value = value.replace("\r", "");
                obj[key] = value;
            }
            return obj;
        };
        ResponseHeaders.prototype.getHeader = function (name) {
            for (var i = 0; i < this.headers.length; i++) {
                if (this.headers[i].key == name) {
                    return this.headers[i];
                }
            }
            return null;
        };
        return ResponseHeaders;
    })();
    exports.ResponseHeaders = ResponseHeaders;
    /**
     * @class ResponseType
     * @classdesc Enumeration of HTTP response payload types
     */
    (function (ResponseType) {
        ResponseType[ResponseType["DEFAULT"] = 0] = "DEFAULT";
        ResponseType[ResponseType["ARRAYBUFFER"] = 1] = "ARRAYBUFFER";
        ResponseType[ResponseType["BLOB"] = 2] = "BLOB";
        ResponseType[ResponseType["DOCUMENT"] = 3] = "DOCUMENT";
        ResponseType[ResponseType["JSON"] = 4] = "JSON";
        ResponseType[ResponseType["TEXT"] = 5] = "TEXT";
    })(exports.ResponseType || (exports.ResponseType = {}));
    var ResponseType = exports.ResponseType;
});
