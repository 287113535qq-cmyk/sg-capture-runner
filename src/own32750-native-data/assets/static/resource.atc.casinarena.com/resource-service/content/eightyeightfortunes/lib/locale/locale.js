define(["require", "exports"], function (require, exports) {
    /**
     * Translator
     * @class locale.Translator
     * @classdesc Handles storing and translating text from keys based on a locale
     */
    var Translator = (function () {
        /**
         * @constructor
         */
        function Translator(data) {
            this.data = data;
        }
        /**
         * Finds a translation using a key
         * @method locale.Translator#findByKey
         * @public
         * @param {string} key The key to find
         * @returns {string} The value
         */
        Translator.prototype.findByKey = function (key) {
            return this.data[key];
        };
        return Translator;
    })();
    exports.Translator = Translator;
    /**
     * Create a new CurrencyFormatter
     * @class locale.CurrencyFormatter
     * @classdesc Class that formats currencies
     */
    var CurrencyFormatter = (function () {
        /**
         * @constructor
         */
        function CurrencyFormatter() {
        }
        /**
         * Sets the JSON data
         * @method locale.CurrencyFormatter#setData
         * @public
         * @param {any} data The data from the server
         */
        CurrencyFormatter.prototype.setData = function (data) {
            this.data = data;
        };
        /**
         * Formats a value in the locales currency
         * @method locale.CurrencyFormatter#formatValue
         * @public
         * @param {any} value The value to format in either string or number format
         * @returns {string} The formatted value
         */
        CurrencyFormatter.prototype.format = function (value) {
            if (typeof value != "string" && typeof value != "number") {
                return null;
            }
            if (value == "") {
                return "";
            }
            value = this.clean(value);
            value = this.attachDecimal(value);
            value = this.attachThousands(value);
            value = this.attachSymbol(value);
            return value;
        };
        /**
         * Cleans the passed in value of all decimals, symbols, and Separators
         * @method locale.CurrencyFormatter#clean
         * @param {any} value The value to clean
         * @private
         */
        CurrencyFormatter.prototype.clean = function (value) {
            if (typeof value == "string") {
                var decimalRegEx = null;
                if (this.data.fractionalSeparator == ".") {
                    decimalRegEx = new RegExp("\\" + this.data.fractionalSeparator, "g");
                }
                else {
                    decimalRegEx = new RegExp(this.data.fractionalSeparator, "g");
                }
                var thousandRegEx = null;
                if (this.data.groupingSeparator == ".") {
                    thousandRegEx = new RegExp("\\" + this.data.groupingSeparator, "g");
                }
                else {
                    thousandRegEx = new RegExp(this.data.groupingSeparator, "g");
                }
                value = value.replace(this.data.symbol, "");
                value = value.replace(decimalRegEx, "");
                value = value.replace(thousandRegEx, "");
                if (this.data.fractionalDigits == 0) {
                    value += "00";
                }
            }
            else {
                value = value.toString();
            }
            value = (value.length < 3) ? (Number(value) / 100).toFixed(2) : value;
            return value;
        };
        /**
         * Attaches the currency symbol to the value
         * @method locale.CurrencyFormatter#attachSymbol
         * @private
         */
        CurrencyFormatter.prototype.attachSymbol = function (value) {
            if (this.data.symbol != undefined && this.data.symbol != null && this.data.symbol.length > 0) {
                if (this.data.currencySymbolBeforeAmount) {
                    value = this.data.symbol + this.attachSpacing(this.data.currencySymbolSpacing) + value;
                }
                else {
                    value += this.attachSpacing(this.data.currencySymbolSpacing) + this.data.symbol;
                }
            }
            else {
                if (this.data.currencyCodeBeforeAmount) {
                    value = this.data.name + this.attachSpacing(this.data.currencySymbolSpacing) + value;
                }
                else {
                    value += this.attachSpacing(this.data.currencySymbolSpacing) + this.data.name;
                }
            }
            return value;
        };
        CurrencyFormatter.prototype.attachSpacing = function (amount) {
            var spacing = "";
            for (var i = 0; i < amount; i++) {
                spacing += " ";
            }
            return spacing;
        };
        /**
         * Attaches a decimal
         * @method locale.CurrencyFormatter#attachDecimal
         * @private
         */
        CurrencyFormatter.prototype.attachDecimal = function (value) {
            var newValue;
            if (value.indexOf(".") >= 0) {
                newValue = value.replace(".", this.data.fractionalSeparator);
            }
            else {
                var index = value.length - 2;
                newValue = value.slice(0, index);
                if (this.data.fractionalDigits > 0) {
                    newValue = newValue + this.data.fractionalSeparator + value.slice(index, value.length);
                }
            }
            return newValue;
        };
        /**
         * Attach thousands Separator
         * @method locale.CurrencyFormatter#attachThousands
         * @private
         */
        CurrencyFormatter.prototype.attachThousands = function (value) {
            var values = value.split(this.data.fractionalSeparator);
            var dollars = "";
            if (values[0].length > 0) {
                dollars = values[0].split("").reverse().join("").match(/.{1,3}/g).join(this.data.groupingSeparator);
            }
            value = dollars.split("").reverse().join("");
            if (this.data.fractionalDigits > 0) {
                value = value + this.data.fractionalSeparator + values[1];
            }
            return value;
        };
        return CurrencyFormatter;
    })();
    exports.CurrencyFormatter = CurrencyFormatter;
});
