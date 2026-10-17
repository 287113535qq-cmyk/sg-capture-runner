const own32769InitSource = Object.freeze({"gameId": "32769", "nativeGameId": "20135", "runtimeGameId": 32991, "root": "E:\\platform-sync\\api_new_docker\\api_new\\client\\game\\sg\\static\\resource.atc.casinarena.com\\resource-service\\content\\fudaole", "sourceSizes": {"app/fudaole.js": 1903298, "bundles/metadata/fudaole.MetaDataBundle.js": 1531, "lib/gls-comms/gls-comms.js": 69775, "lib/game-data/game-data.js": 25864}, "retainedOwnAppSHA256": "76934234b9f8e362cf65db52f5733e533b72ff72d2099d23f62da75392125c1d", "hashesRecomputed": false, "nativePieces": [{"source": "lib/game-data/game-data.js", "byteStart": 14936, "byteEndExclusive": 20615}, {"source": "lib/game-data/game-data.js", "byteStart": 12685, "byteEndExclusive": 13586}, {"source": "lib/game-data/game-data.js", "byteStart": 7784, "byteEndExclusive": 9810}, {"source": "lib/game-data/game-data.js", "byteStart": 23752, "byteEndExclusive": 25859}, {"source": "lib/game-data/game-data.js", "byteStart": 13680, "byteEndExclusive": 14836}, {"source": "lib/game-data/game-data.js", "byteStart": 6577, "byteEndExclusive": 7668}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 18155, "byteEndExclusive": 18426}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 51501, "byteEndExclusive": 55063}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 10753, "byteEndExclusive": 15508}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 15616, "byteEndExclusive": 17012}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 18615, "byteEndExclusive": 20563}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 36402, "byteEndExclusive": 40824}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 31961, "byteEndExclusive": 36241}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 68351, "byteEndExclusive": 69770}, {"source": "lib/gls-comms/gls-comms.js", "byteStart": 65764, "byteEndExclusive": 65939}, {"source": "bundles/metadata/fudaole.MetaDataBundle.js", "byteStart": 34, "byteEndExclusive": 1499}, {"source": "app/fudaole.js", "byteStart": 1835707, "byteEndExclusive": 1847096}, {"source": "app/fudaole.js", "byteStart": 261896, "byteEndExclusive": 261990}], "sourceOnlyReferences": {"app/fudaole.js": {"MainRequestorAndParserFactory": [26146, 30106], "MainFirstNormalInit": [46266, 46805], "MainHistoryPredicate": [59067, 59343]}, "lib/gls-comms/gls-comms.js": {"RequestorConstructorAndFirstInitWindow": [55320, 59604], "ProcessInitWindow": [62840, 63980]}, "lib/http-connection/http-connection.js": {"knownBytes": 23116, "FactoryWindow": [0, 2153], "EmptyRequestHeadersClass": [3819, 5075], "SendDefaultsWindow": [7889, 10624]}}});

function hold(reason) {
  const error = new Error("Own 32769 first Init DATA hold: " + reason);
  error.code = "OWN32769_FIRST_INIT_DATA_HOLD";
  error.reason = reason;
  return error;
}
function ref(value, name) {
  if (value === null ||
      (typeof value !== "object" && typeof value !== "function")) {
    throw hold(name + "_REFERENCE_REQUIRED");
  }
  return value;
}
function keys(value, names) {
  ref(value, "INPUT");
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(value, name)) {
      throw hold("ACTUAL_INPUT_MISSING_" + name);
    }
  }
}
function identifier(value, name) {
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "string" && value.trim() !== "" &&
      value.trim() !== "undefined" && value.trim() !== "null") return;
  throw hold(name + "_ACTUAL_VALUE_REQUIRED");
}
function attr(node, name) {
  ref(node, "ACTUAL_XML_NODE");
  const item = node.attributes && node.attributes.getNamedItem(name);
  if (!item || typeof item.value !== "string") {
    throw hold("ACTUAL_XML_ATTRIBUTE_MISSING_" + name);
  }
  return item.value;
}
function createOwn32769FirstNormalInitData({
  originalSessionScope, DOMParser, XMLSerializer,
  originalFactoryInitSource
}) {
  ref(originalSessionScope, "ORIGINAL_SESSION_SCOPE");
  if (typeof DOMParser !== "function" ||
      typeof XMLSerializer !== "function") {
    throw hold("ACTUAL_DOM_IMPLEMENTATION_REQUIRED");
  }
  const gamedata = {};
  const glscomms = {};
  const fudaole = {};

{ const exports = gamedata;
var GameInitData = (function () {
        /**
         * @constructor
         */
        function GameInitData() {
            this.reelGroups = [];
            this.awards = [];
            this.paylines = [];
        }
        /**
         * Add reel group data
         * @method game-data.GameInitData#addReelGroup
         * @public
         * @param {ReelGroupData} reelGroup Reel group data
         */
        GameInitData.prototype.addReelGroup = function (reelGroup) {
            this.reelGroups.push(reelGroup);
        };
        /**
         * Retrieve all reel groups
         * @method game-data.GameInitData#getAllReelGroups
         * @public
         * @returns {ReelGroupData[]} Collection of reel groups
         */
        GameInitData.prototype.getAllReelGroups = function () {
            return this.reelGroups;
        };
        /**
         * Retrieve reel group at given index
         * @method game-data.GameInitData#getReelGroup
         * @public
         * @param {number} index Index
         * @returns {ReelGroupData} Reel group
         */
        GameInitData.prototype.getReelGroup = function (index) {
            return this.reelGroups[index];
        };
        /**
         * Add bet configuration data
         * @method game-data.GameInitData#setBetConfiguration
         * @public
         * @param {BetConfiguration} config Bet configuration
         */
        GameInitData.prototype.setBetConfiguration = function (config) {
            this.betConfiguration = config;
        };
        /**
         * Retrieve bet configuration
         * @method game-data.GameInitData#getBetConfiguration
         * @public
         * @returns {BetConfiguration} Bet configuration
         */
        GameInitData.prototype.getBetConfiguration = function () {
            return this.betConfiguration;
        };
        /**
         * Add paytable data for a single pay
         * @method game-data.GameInitData#addAward
         * @public
         * @param {SlotAwardData} award Award information
         */
        GameInitData.prototype.addAward = function (award) {
            this.awards.push(award);
        };
        /**
         * Retrieve all awards
         * @method game-data.GameInitData#getAllAwards
         * @public
         * @returns {SlotAwardData[]} Collection of slot pays
         */
        GameInitData.prototype.getAllAwards = function () {
            return this.awards;
        };
        /**
         * Retrieve slot pay at given index
         * @method game-data.GameInitData#getAward
         * @public
         * @param {number} index Index
         * @returns {SlotAwardData} Bet configuration
         */
        GameInitData.prototype.getAward = function (index) {
            return this.awards[index];
        };
        /**
         * Add payline description
         * @method game-data.GameInitData#addPayline
         * @public
         * @param {PaylineData} payline Payline data describing offsets
         */
        GameInitData.prototype.addPayline = function (payline) {
            this.paylines.push(payline);
        };
        /**
         * Retrieve all payline configurations
         * @method game-data.GameInitData#getAllPaylines
         * @public
         * @returns {PaylineData[]} Collection of payline offset data
         */
        GameInitData.prototype.getAllPaylines = function () {
            return this.paylines;
        };
        /**
         * Retrieve payline at given index
         * @method game-data.GameInitData#getPayline
         * @public
         * @param {number} index Index
         * @returns {PaylineData} Payline offset data
         */
        GameInitData.prototype.getPayline = function (index) {
            return this.paylines[index];
        };
        /**
         * Set win cap amount
         * @method game-data.GameInitData#setWinCapAmount
         * @public
         * @param {number} winCap Win cap amount
         */
        GameInitData.prototype.setWinCapAmount = function (winCap) {
            this.winCap = winCap;
        };
        /**
         * Retrieve win cap amount
         * @method game-data.GameInitData#getWinCapAmount
         * @public
         * @returns {number} Win cap amount
         */
        GameInitData.prototype.getWinCapAmount = function () {
            return this.winCap;
        };
        /**
         * Set return to player percentage
         * @method game-data.GameInitData#setReturnToPlayer
         * @public
         * @param {number} rtp Return to player percentage
         */
        GameInitData.prototype.setReturnToPlayer = function (rtp) {
            this.rtp = rtp;
        };
        /**
         * Retrieve return to player percentage
         * @method game-data.GameInitData#getReturnToPlayer
         * @public
         * @returns {number} Return to player percentage
         */
        GameInitData.prototype.getReturnToPlayer = function () {
            return this.rtp;
        };
        /**
         * Set custom game play data
         * @method GamePlayData#setCustomData
         * @public
         * @param {any} customData Custom data, provided by game
         */
        GameInitData.prototype.setCustomData = function (customData) {
            this.customData = customData;
        };
        /**
         * Retrieve custom game play data
         * @method GamePlayData#getCustomData
         * @public
         * @returns {any} Custom data, provided by game
         */
        GameInitData.prototype.getCustomData = function () {
            return this.customData;
        };
        return GameInitData;
    })();
    exports.GameInitData = GameInitData;
var PaylineData = (function () {
        /**
         * @constructor
         */
        function PaylineData(offsets, selectable) {
            this.offsets = offsets;
            this.selectable = selectable;
        }
        /**
         * Retrieve payline offsets
         * @method PaylineData#getOffsets
         * @public
         * @returns {Array<number>} Collection of reel offests
         */
        PaylineData.prototype.getOffsets = function () {
            return this.offsets;
        };
        /**
         * Determine if this payline is selectable
         * @method PaylineData#getOffsets
         * @public
         * @returns {boolean} True if payline is selectable, false otherwise
         */
        PaylineData.prototype.isSelectable = function () {
            return this.selectable;
        };
        return PaylineData;
    })();
    exports.PaylineData = PaylineData;
var BetConfiguration = (function () {
        function BetConfiguration() {
            /**
             * Collection of available bets
             * @member game-data.BetConfiguration#availableBets
             * @private
             * @type {number[]}
             * @default [1]
             */
            this.availableBets = [1];
            /**
             * Default index into availableBets collection
             * @member game-data.BetConfiguration#defaultBetIndex
             * @private
             * @type {number}
             * @default 0
             */
            this.defaultBetIndex = 0;
        }
        /**
         * Set default bet index
         * @method game-data.BetConfiguration#setDefaultIndex
         * @public
         * @param {number} index Index into collection of availableBets
         */
        BetConfiguration.prototype.setDefaultIndex = function (index) {
            this.defaultBetIndex = index;
        };
        /**
         * Get default bet index
         * @method game-data.BetConfiguration#getDefaultIndex
         * @public
         * @returns {number} Index of default bet in availableBets
         */
        BetConfiguration.prototype.getDefaultIndex = function () {
            return this.defaultBetIndex;
        };
        /**
         * Set collection of available bets
         * @method game-data.BetConfiguration#setAvailableBets
         * @public
         * @param {number[]} bets Collection of available bets
         */
        BetConfiguration.prototype.setAvailableBets = function (bets) {
            this.availableBets = bets;
        };
        /**
         * Get all available bets
         * @method game-data.BetConfiguration#getAvailableBets
         * @public
         * @returns {number[]} Collection of available bets
         */
        BetConfiguration.prototype.getAvailableBets = function () {
            return this.availableBets;
        };
        return BetConfiguration;
    })();
    exports.BetConfiguration = BetConfiguration;
var ReelGroupData = (function () {
        /**
         * @constructor
         */
        function ReelGroupData(id) {
            this.strips = [];
            this.featureId = 0;
        }
        /**
         * Retrieve reel group identifier
         * @method ReelGroupDatae#getId
         * @public
         * @returns {number} Reel strip identifier
         */
        ReelGroupData.prototype.getId = function () {
            return this.id;
        };
        /**
         * Retrieve reel group identifier
         * @method ReelGroupDatae#getId
         * @public
         * @param {number} id Bonus id
         */
        ReelGroupData.prototype.setFeatureId = function (id) {
            this.featureId = id;
        };
        /**
         * Retrieve bonus id
         * @method ReelGroupDatae#getFeatureId
         * @public
         * @returns {number} Bonus id associated with this reel group
         */
        ReelGroupData.prototype.getFeatureId = function () {
            return this.featureId;
        };
        /**
         * Set reel strip at given index
         * @method ReelGroupDatae#addStrip
         * @public
         * @param {number} index Reel strip index
         * @param {ReelStripData} strip Symbol layout
         */
        ReelGroupData.prototype.addStrip = function (index, strip) {
            this.strips[index] = strip;
        };
        /**
         * Retrieve reel strip at given index
         * @method ReelGroupDatae#getStrip
         * @public
         * @param {number} index Reel strip index
         * @returns {ReelStripData} Symbol layout
         */
        ReelGroupData.prototype.getStrip = function (index) {
            return this.strips[index];
        };
        /**
         * Retrieve all reel strips
         * @method ReelGroupDatae#getAllStrips
         * @public
         * @returns {ReelStripData[]} Collection of reel symbol layouts
         */
        ReelGroupData.prototype.getAllStrips = function () {
            return this.strips;
        };
        return ReelGroupData;
    })();
    exports.ReelGroupData = ReelGroupData;
var SlotAwardData = (function () {
        /**
         * @constructor
         */
        function SlotAwardData(id, numSymbols, value) {
            this.id = id;
            this.numSymbols = numSymbols;
            this.value = value;
        }
        /**
         * Retrieve award identifier
         * @method SlotAwardData#getId
         * @public
         * @returns {number} Award identifer
         */
        SlotAwardData.prototype.getId = function () {
            return this.id;
        };
        /**
         * Retrieve number of symbols for this award
         * @method SlotAwardData#getNumSymbols
         * @public
         * @returns {number} Number of symbols
         */
        SlotAwardData.prototype.getNumSymbols = function () {
            return this.numSymbols;
        };
        /**
         * Retrieve how much this award pays
         * @method SlotAwardData#getValue
         * @public
         * @returns {number} Pay amount
         */
        SlotAwardData.prototype.getValue = function () {
            return this.value;
        };
        return SlotAwardData;
    })();
    exports.SlotAwardData = SlotAwardData;
var ReelStripData = (function () {
        /**
         * @constructor
         */
        function ReelStripData(id) {
            this.symbols = [];
        }
        /**
         * Retrieve reel strip identifier
         * @method ReelStripData#getId
         * @public
         * @returns {number} Reel strip identifier
         */
        ReelStripData.prototype.getId = function () {
            return this.id;
        };
        /**
         * Set reel strip symbol layout
         * @method ReelStripData#setSymbols
         * @public
         * @param {Array<number>} symbols Symbol layout
         */
        ReelStripData.prototype.setSymbols = function (symbols) {
            this.symbols = symbols;
        };
        /**
         * Retrieve reel strip symbol layout
         * @method ReelStripData#getSymbols
         * @public
         * @returns {Array<nuber>} Symbol layout
         */
        ReelStripData.prototype.getSymbols = function () {
            return this.symbols;
        };
        return ReelStripData;
    })();
    exports.ReelStripData = ReelStripData;
}

{ const exports = glscomms;
(function (BalanceType) {
        BalanceType[BalanceType["CASH_BALANCE"] = 0] = "CASH_BALANCE";
        BalanceType[BalanceType["BONUS_BALANCE"] = 1] = "BONUS_BALANCE";
    })(exports.BalanceType || (exports.BalanceType = {}));
    var BalanceType = exports.BalanceType;
var CurrencyFormatXMLParser = (function () {
        function CurrencyFormatXMLParser() {
        }
        /**
         * Parse currency formatting data out of XML
         * @method gls-comms.CurrencyFormatXMLParser#parse
         * @public
         * @param {Node} currencyInformation XML node containing currency formatting information
         * @returns {locale.ICurrencyData} Currency formatting data
         */
        CurrencyFormatXMLParser.parse = function (currencyInformation) {
            var format = this.DEFAULT_FORMAT;
            if (currencyInformation != null) {
                var formatNodes = currencyInformation.childNodes;
                var formatNodesLength = formatNodes.length;
                for (var i = 0; i < formatNodesLength; ++i) {
                    switch (formatNodes[i].nodeName) {
                        case 'Currency':
                            format.name = formatNodes[i].textContent;
                            break;
                        case 'ExchangeRate':
                            format.exchangeRate = parseInt(formatNodes[i].textContent, 10);
                            break;
                        case 'CurrencySymbol':
                            format.symbol = formatNodes[i].textContent;
                            break;
                        case 'Grouping':
                            format.grouping = parseInt(formatNodes[i].textContent, 10);
                            break;
                        case 'GroupingSeparator':
                            format.groupingSeparator = formatNodes[i].textContent;
                            break;
                        case 'FracDigits':
                            format.fractionalDigits = parseInt(formatNodes[i].textContent, 10);
                            break;
                        case 'DecimalSeparator':
                            format.fractionalSeparator = formatNodes[i].textContent;
                            break;
                        case 'CurrencyCodeSpacing':
                            format.currencyCodeSpacing = parseInt(formatNodes[i].textContent, 10);
                            break;
                        case 'CodeBeforeAmount':
                            format.currencyCodeBeforeAmount = (formatNodes[i].textContent == 'true');
                            break;
                        case 'CurrencySymbolSpacing':
                            format.currencySymbolSpacing = parseInt(formatNodes[i].textContent, 10);
                            break;
                        case 'SymbolBeforeAmount':
                            format.currencySymbolBeforeAmount = (formatNodes[i].textContent == 'true');
                            break;
                    }
                }
            }
            return format;
        };
        /**
         * Default currency formatting data
         * @member gls-comms.CurrencyFormatXMLParser#DEFAULT_FORMAT
         * @private
         * @type {locale.ICurrencyData}
         */
        CurrencyFormatXMLParser.DEFAULT_FORMAT = {
            name: "",
            symbol: "",
            exchangeRate: 1,
            grouping: 3,
            groupingSeparator: ",",
            fractionalDigits: 2,
            fractionalSeparator: ".",
            currencyCodeSpacing: 1,
            currencyCodeBeforeAmount: false,
            currencySymbolSpacing: 1,
            currencySymbolBeforeAmount: false
        };
        return CurrencyFormatXMLParser;
    })();
    exports.CurrencyFormatXMLParser = CurrencyFormatXMLParser;
var PlatformInitData = (function () {
        /**
         * @constructor
         */
        function PlatformInitData() {
            this.currencyMultiplier = 1;
            this.isRecovering = false;
        }
        /**
         * Set session id
         * @method gls-comms.PlatformInitData#setSessionId
         * @public
         * @param {string} sessionId Session id
         */
        PlatformInitData.prototype.setSessionId = function (sessionId) {
            this.sessionId = sessionId;
        };
        /**
         * Accessor for session id
         * @method gls-comms.PlatformInitData#getSessionId
         * @returns {string} Session id
         */
        PlatformInitData.prototype.getSessionId = function () {
            return this.sessionId;
        };
        /**
         * Set game id
         * @method gls-comms.PlatformInitData#setGameId
         * @public
         * @param {string} gameId Game id
         */
        PlatformInitData.prototype.setGameId = function (gameId) {
            this.gameId = gameId;
        };
        /**
         * Accessor for game id
         * @method gls-comms.PlatformInitData#getGameId
         * @returns {string} Game id
         */
        PlatformInitData.prototype.getGameId = function () {
            return this.gameId;
        };
        /**
         * Set language code
         * @method gls-comms.PlatformInitData#setLanguageCode
         * @public
         * @param {string} languageCode Session id
         */
        PlatformInitData.prototype.setLanguageCode = function (languageCode) {
            this.languageCode = languageCode;
        };
        /**
         * Accessor for language code
         * @method gls-comms.PlatformInitData#getLanguageCode
         * @returns {string} Language code
         */
        PlatformInitData.prototype.getLanguageCode = function () {
            return this.languageCode;
        };
        /**
         * Set game version
         * @method gls-comms.PlatformInitData#setVersion
         * @public
         * @param {string} version Game version
         */
        PlatformInitData.prototype.setVersion = function (version) {
            this.version = version;
        };
        /**
         * Accessor for game version
         * @method gls-comms.PlatformInitData#getVersion
         * @returns {string} Game version
         */
        PlatformInitData.prototype.getVersion = function () {
            return this.version;
        };
        /**
         * Set currency multiplier. Passing in an invalid multiplier will not modify the existing value.
         * @method gls-comms.PlatformInitData#setCurrencyMultiplier
         * @public
         * @param {number} multiplier Currency multiplier
         */
        PlatformInitData.prototype.setCurrencyMultiplier = function (multiplier) {
            if (multiplier != null) {
                this.currencyMultiplier = multiplier;
            }
        };
        /**
         * Accessor for currency multiplier
         * @method gls-comms.PlatformInitData#getCurrencyMultiplier
         * @returns {number} Currency multiplier
         */
        PlatformInitData.prototype.getCurrencyMultiplier = function () {
            return this.currencyMultiplier;
        };
        /**
         * Set currency formatting data
         * @method gls-comms.PlatformInitData#setCurrencyFormat
         * @public
         * @param {locale.ICurrencyData} currencyFormat Current formatting data
         */
        PlatformInitData.prototype.setCurrencyFormat = function (currencyFormat) {
            this.currencyFormat = currencyFormat;
        };
        /**
         * Accessor for currency formatting data
         * @method gls-comms.PlatformInitData#getCurrencyFormat
         * @returns {string} Currency formatting data
         */
        PlatformInitData.prototype.getCurrencyFormat = function () {
            return this.currencyFormat;
        };
        /**
         * Set recovery flag
         * @method gls-comms.PlatformInitData#setIsRecovering
         * @public
         * @param {boolean} isRecovering True if recovering from historical data, false if playing with new data
         */
        PlatformInitData.prototype.setIsRecovering = function (isRecovering) {
            this.isRecovering = isRecovering;
        };
        /**
         * Accessor for recovery flag
         * @method gls-comms.PlatformInitData#isRecovering
         * @returns {booleam} True if recovering from historical data, false if playing with new data
         */
        PlatformInitData.prototype.getIsRecovering = function () {
            return this.isRecovering;
        };
        return PlatformInitData;
    })();
    exports.PlatformInitData = PlatformInitData;
var InitResponse = (function () {
        /**
         * @constructor
         */
        function InitResponse(platformData, balanceData) {
            this.gameData = new gamedata.GameInitData();
            this.platformData = platformData;
            this.balances = balanceData;
        }
        /**
         * Accessor for game data
         * @method gls-comms.InitResponse#getGameData
         * @public
         * @returns {GameInitData} Game data
         */
        InitResponse.prototype.getGameData = function () {
            return this.gameData;
        };
        /**
         * Accessor for platform data
         * @method gls-comms.InitResponse#getPlatformData
         * @public
         * @returns {PlatformInitData} Platform data
         */
        InitResponse.prototype.getPlatformData = function () {
            return this.platformData;
        };
        /**
         * Retrieve specific type of balance amount
         * @method gls-comms.InitResponse#getBalance
         * @public
         * @param {string} type Balance type
         * @returns {number} Value of specific balance
         */
        InitResponse.prototype.getBalance = function (type) {
            if (type === void 0) { type = 0 /* CASH_BALANCE */; }
            return this.balances.getBalance(type);
        };
        return InitResponse;
    })();
    exports.InitResponse = InitResponse;
var BalanceData = (function () {
        /**
         * @constructor
         */
        function BalanceData(balanceData) {
            this.balances = balanceData;
        }
        /**
         * Parse balance XML
         * @method gls-comms.BalanceData#parseXML
         * @public
         * @param {node} Node XML Node containing balance information
         * @returns {BalanceData} Balance data
         */
        BalanceData.parseXML = function (node) {
            var data = {};
            var nodeChildren = node.childNodes;
            var numChildren = nodeChildren.length;
            for (var childIndex = 0; childIndex < numChildren; ++childIndex) {
                var balanceSource = nodeChildren[childIndex];
                if (balanceSource.nodeName == "Balance") {
                    var attributes = balanceSource.attributes;
                    data[attributes.getNamedItem("name").value] = parseInt(attributes.getNamedItem("value").value, 10);
                }
            }
            return new BalanceData(data);
        };
        /**
         * Retrieve specific type of balance amount
         * @method gls-comms.EndResponse#getBalance
         * @public
         * @param {string} type Balance type
         * @returns {number} Value of specific balance
         */
        BalanceData.prototype.getBalance = function (type) {
            var value = 0;
            var name = BalanceType[type];
            if (name != null && this.balances[name] != null) {
                value = this.balances[name];
            }
            return value;
        };
        BalanceData.prototype.hasBalance = function (type) {
            var value = false;
            var name = BalanceType[type];
            if (name != null && this.balances[name] != null) {
                value = true;
            }
            return value;
        };
        return BalanceData;
    })();
    exports.BalanceData = BalanceData;
var GLSResponseHeader = (function () {
        function GLSResponseHeader() {
        }
        /**
         * Parse GLS XML header
         * @method gls-comms.GLSResponseHeader#parseXML
         * @public
         * @param {Node} headerNode XML node corresponding to Header field in GLS XML response
         * @returns {GLSResponseHeader} Platform response data
         */
        GLSResponseHeader.parseXML = function (headerNode) {
            var header = new GLSResponseHeader();
            if (headerNode != null) {
                var attr = headerNode.attributes;
                var attrLength = attr.length;
                for (var i = 0; i < attrLength; ++i) {
                    switch (attr[i].nodeName) {
                        case 'sessionID':
                            header.sessionId = attr[i].nodeValue;
                            break;
                        case 'gameID':
                            header.gameId = attr[i].nodeValue;
                            break;
                        case 'lang':
                            header.langCode = attr[i].nodeValue;
                            break;
                        case 'ccyCode':
                            header.currencyCode = attr[i].nodeValue;
                            break;
                        case 'deciSep':
                            header.decimalSeparator = attr[i].nodeValue;
                            break;
                        case 'thousandSep':
                            header.thousandsSeparator = attr[i].nodeValue;
                            break;
                        case 'versionID':
                            header.version = attr[i].nodeValue;
                            break;
                        case 'isRecovering':
                            header.recovering = (attr[i].nodeValue == 'Y');
                            break;
                    }
                }
            }
            return header;
        };
        /**
         * Accessor for session id
         * @method gls-comms.GLSResponseHeader#getSessionId
         * @returns {string} Session id
         */
        GLSResponseHeader.prototype.getSessionId = function () {
            return this.sessionId;
        };
        /**
         * Accessor for game id
         * @method gls-comms.GLSResponseHeader#getGameId
         * @returns {string} Game id
         */
        GLSResponseHeader.prototype.getGameId = function () {
            return this.gameId;
        };
        /**
         * Accessor for language code
         * @method gls-comms.GLSResponseHeader#getLanguageCode
         * @returns {string} Language code
         */
        GLSResponseHeader.prototype.getLanguageCode = function () {
            return this.langCode;
        };
        /**
         * Accessor for currency code
         * @method gls-comms.GLSResponseHeader#getCurrencyCode
         * @returns {string} Currency code
         */
        GLSResponseHeader.prototype.getCurrencyCode = function () {
            return this.currencyCode;
        };
        /**
         * Accessor for currency decimal separator
         * @method gls-comms.GLSResponseHeader#getDecimalSeparator
         * @returns {string} Currency decimal separator
         */
        GLSResponseHeader.prototype.getDecimalSeparator = function () {
            return this.decimalSeparator;
        };
        /**
         * Accessor for currency thousands separator
         * @method gls-comms.GLSResponseHeader#getThousandsSeparator
         * @returns {string} Currency thousands separator
         */
        GLSResponseHeader.prototype.getThousandsSeparator = function () {
            return this.thousandsSeparator;
        };
        /**
         * Accessor for game version
         * @method gls-comms.GLSResponseHeader#getVersion
         * @returns {string} Game version
         */
        GLSResponseHeader.prototype.getVersion = function () {
            return this.version;
        };
        /**
         * Accessor for recovery flag
         * @method gls-comms.GLSResponseHeader#isRecovering
         * @returns {booleam} True if recovering from historical data, false if playing with new data
         */
        GLSResponseHeader.prototype.isRecovering = function () {
            return this.recovering;
        };
        return GLSResponseHeader;
    })();
    exports.GLSResponseHeader = GLSResponseHeader;
var GLSRequestHeader = (function () {
        /**
         * @constructor
         */
        function GLSRequestHeader(metadata, sessionData, gameDescription, glsServerSessionId, platformInitData) {
            /** Any custom header value*/
            this.customRequestHeaders = {};
            // GLS identifiers for different partner backends
            this.GLSID_CASINARENA = "4";
            this.GLSID_FREEPLAY = "65535";
            this.affiliate = sessionData.getContextID();
            this.freePlay = !metadata.isRealMoney();
            this.gameCodeRGI = metadata.getGameCode();
            this.gameId = gameDescription.id;
            this.glsId = (this.freePlay ? this.GLSID_FREEPLAY : this.GLSID_CASINARENA);
            this.langCode = metadata.getLocale();
            this.sessionId = glsServerSessionId;
            this.userId = sessionData.getPlayerID();
            this.version = gameDescription.version;
            // Setting promotions to false. Value isn't currently passed in by any adaptors
            this.promotions = false;
            // channel and userType are set to predefined GLS values -- purpose and meaning unknown
            this.channel = "I";
            this.userType = "C";
            // currencyCode is required to be present in the header but the value appears irrelevant
            this.currencyCode = "";
            if (platformInitData != null) {
                this.currencyCode = platformInitData.getCurrencyFormat().name;
            }
        }
        /**
        * Add custom header values to the request XML
        * @public
        * @param key {string}
        * @param value {any}
        **/
        GLSRequestHeader.prototype.setCustomHeader = function (key, value) {
            this.customRequestHeaders[key] = value;
        };
        /**
        * Custom Header
        * @public
        * @param customHeaders {object}
        * Object contains key/value pair to be custom header
        */
        GLSRequestHeader.prototype.addCustomHeaders = function (customHeaders) {
            if (customHeaders) {
                for (var key in customHeaders) {
                    if (customHeaders.hasOwnProperty(key)) {
                        this.setCustomHeader(key, customHeaders[key]);
                    }
                }
            }
        };
        /**
         * Serialize GLSRequestHeader data to XML string
         * @method gls-comms.GLSRequestHeader#toXMLString
         * @public
         * @param {}
         * @returns {string} XML string representation of header data
         */
        GLSRequestHeader.prototype.toXMLString = function () {
            var xmlString = "<Header";
            xmlString += " affiliate=\"" + this.affiliate + "\"";
            xmlString += " ccyCode=\"" + this.currencyCode + "\"";
            xmlString += " channel=\"" + this.channel + "\"";
            xmlString += " freePlay=\"" + (this.freePlay ? "Y" : "N") + "\"";
            xmlString += " gameCodeRGI=\"" + this.gameCodeRGI + "\"";
            xmlString += " gameID=\"" + this.gameId + "\"";
            xmlString += " glsID=\"" + this.glsId + "\"";
            xmlString += " lang=\"" + this.langCode + "\"";
            xmlString += " promotions=\"" + (this.promotions ? "Y" : "N") + "\"";
            xmlString += " sessionID=\"" + this.sessionId + "\"";
            xmlString += " userID=\"" + this.userId + "\"";
            xmlString += " userType=\"" + this.userType + "\"";
            xmlString += " versionID=\"" + this.version + "\"";
            xmlString += this.customHeadersToXml();
            xmlString += "/>";
            return xmlString;
        };
        /**
        * Generates XML string for custom headers
        * @private
        * @return {string} xml string
        */
        GLSRequestHeader.prototype.customHeadersToXml = function () {
            var xmlString = "";
            for (var key in this.customRequestHeaders) {
                if (this.customRequestHeaders.hasOwnProperty(key)) {
                    xmlString += " " + key + "=\"" + this.customRequestHeaders[key] + "\"";
                }
            }
            return xmlString;
        };
        return GLSRequestHeader;
    })();
    exports.GLSRequestHeader = GLSRequestHeader;
var GLSRequestData = (function () {
        /**
         * @constructor
         */
        function GLSRequestData(requestType, header) {
            this.requestType = requestType;
            this.header = header;
            this.customData = [];
        }
        /**
         * Add custom payload data to the request
         * @method gls-comms.GLSRequestData#addCustomPayload
         * @public
         * @param {ICustomGLSPayload} payload Custom payload data
         */
        GLSRequestData.prototype.addCustomPayload = function (payload) {
            this.customData.push(payload);
        };
        /**
         * Serialize request data into XML string
         * @method gls-comms.GLSRequestData#toXMLString
         * @public
         * @returns {string} XML string
         */
        GLSRequestData.prototype.toXMLString = function () {
            var xmlString = "<GameRequest type=\"" + this.requestType + "\">";
            xmlString += this.header.toXMLString();
            var numCustomData = this.customData.length;
            var serializer = new XMLSerializer();
            for (var i = 0; i < numCustomData; ++i) {
                xmlString += serializer.serializeToString(this.customData[i].toXML());
            }
            xmlString += "</GameRequest>";
            return xmlString;
        };
        return GLSRequestData;
    })();
    exports.GLSRequestData = GLSRequestData;
}
var MetaDataBundle = (function() {
function MetaDataBundle() {
}
MetaDataBundle.prototype.isDebugEnabled = function(){
return "false".toLowerCase() === "true" ;
};
MetaDataBundle.prototype.isGaffingEnabled = function(){
return "false".toLowerCase() === "true" ;
};
MetaDataBundle.prototype.getResourceVersion = function(){
return "5.0.4.1-1787670669";
};
MetaDataBundle.prototype.getLocale = function(){
return "en_US";
};
MetaDataBundle.prototype.isDemoEnabled = function(){
return "false".toLowerCase() === "true" ;
};
MetaDataBundle.prototype.getWebaudio = function(){
return "true".toLowerCase() === "true" ;
};
MetaDataBundle.prototype.isRealMoney = function() {
return "false".toLowerCase() === "true" ;
};
MetaDataBundle.prototype.getGameCode = function() {
return "fudaole";
};
MetaDataBundle.prototype.getCountryCode = function(){
return "US";
};
MetaDataBundle.prototype.getCdnRoot = function() {
return "https://d10ml311dd14ci.cloudfront.net/5.0.4.1-1787670669/resource-service";
};
MetaDataBundle.prototype.getLogicUrl = function() {
return "https://gls.atc.casinarena.com/gls.rgsx";
};
MetaDataBundle.prototype.getAutoplayStatus = function() {
return "ON".toLowerCase() !== "off";
};
MetaDataBundle.prototype.getMaxWinStatus = function() {
return "ON".toLowerCase() !== "off";
};
MetaDataBundle.prototype.getPartnerCode = function() {
    return "nyx_draftkings_nj".toLowerCase();
}
return MetaDataBundle;
})();
fudaole.MetaDataBundle = MetaDataBundle;
var LTInitResponseXMLParser = (function () {
            function LTInitResponseXMLParser() {
            }
            /**
             * Parse GLS InitResponse XML payload
             * @method gls-comms.InitResponseXMLParser#parse
             * @public
             * @param {Document} xml XML Document containing GLS InitResponse payload
             * @returns {InitResponse} InitResponse data structure
             */
            LTInitResponseXMLParser.prototype.parse = function (xml) {
                var platformData = this.parsePlatformData(xml);
                var balanceData = glscomms.BalanceData.parseXML(xml.getElementsByTagName("Balances")[0]);
                var response = new glscomms.InitResponse(platformData, balanceData);
                var customData = {};
                var gameData = response.getGameData();
                this.populatePaylineData(gameData, xml.getElementsByTagName("PaylineInfo")[0]);
                this.populateAwardsData(gameData, xml.getElementsByTagName("AwardsInfo")[0]);
                this.populateReelGroupData(gameData, xml.getElementsByTagName("ReelInfo")[0]);
                this.populateBetConfiguration(gameData, xml.getElementsByTagName("Stakes")[0]);
                this.populateJackpotData(customData, xml.getElementsByTagName("JackpotAwards")[0]);
                this.populateRedEnvData(customData, xml.getElementsByTagName("RedEnvlopJackpotAwards")[0]);
                this.populateAwardMultiplierData(customData, xml.getElementsByTagName("AwardMultiplier")[0]);
                //  var customData:any = {};
                //parse Pick Bonus Awards
                /*   var pickBonusAwards:IPickBonusAward[][] = this.populatePickBonusAwardsData(gameData, xml.getElementsByTagName("PickBonus")[0]);
                   customData.pickBonusAwards = pickBonusAwards;*/
                // Retrieve RTP, if available
                var gameConstsNode = xml.getElementsByTagName("GameRtpInfo");
                if (gameConstsNode != null) {
                    var attr = gameConstsNode[0].attributes;
                    customData.rtp = attr.getNamedItem("targetedRtpValue").value;
                }
                // Open bet data, if available
                var payloadNode = xml.getElementsByTagName("Payload")[0];
                if (payloadNode != null) {
                    var openBetPayLoad = {};
                    openBetPayLoad = fudaole.LTOpenBetXMLParser.populateOpenBetPayLoad(payloadNode);
                    customData.openBetPayLoad = openBetPayLoad;
                }
                gameData.setCustomData(customData);
                //  gameData.setCustomData(customData);
                return response;
            };
            /**
             * Parse GLS platform data
             * @method gls-comms.InitResponseXMLParser#parsePlatformData
             * @public
             * @param {Document} xml XML Document containing GLS InitResponse payload
             * @returns {PlatformInitData} Platform data
             */
            LTInitResponseXMLParser.prototype.parsePlatformData = function (xml) {
                var data = new glscomms.PlatformInitData();
                var glsHeader = glscomms.GLSResponseHeader.parseXML(xml.getElementsByTagName("Header")[0]);
                data.setSessionId(glsHeader.getSessionId());
                data.setGameId(glsHeader.getGameId());
                data.setLanguageCode(glsHeader.getLanguageCode());
                data.setVersion(glsHeader.getVersion());
                data.setIsRecovering(glsHeader.isRecovering());
                data.setCurrencyFormat(glscomms.CurrencyFormatXMLParser.parse(xml.getElementsByTagName("CurrencyInformation")[0]));
                var currencyMultiplierNode = xml.getElementsByTagName("CurrencyMultiplier")[0];
                if (currencyMultiplierNode != null) {
                    data.setCurrencyMultiplier(parseInt(currencyMultiplierNode.textContent, 10));
                }
                return data;
            };
            /**
             * Helper method for parsing bet configuration
             * @method gls-comms.InitResponseXMLParser#populateBetConfiguration
             * @private
             * @param {gamedata.GameInitData} gameData Data structure to populate
             * @param {Node} node XML node containing bet configuration data
             */
            LTInitResponseXMLParser.prototype.populateBetConfiguration = function (gameData, node) {
                var config = new gamedata.BetConfiguration();
                if (node != null) {
                    var attributes = node.attributes;
                    config.setDefaultIndex(parseInt(attributes.getNamedItem("defaultIndex").value, 10));
                    config.setAvailableBets(node.textContent.split("|").map(Number));
                }
                gameData.setBetConfiguration(config);
            };
            /**
             * Helper method for parsing jackpot data
             * @private
             * @param {gamedata.GameInitData} gameData Data structure to populate
             * @param {Node} node XML node containing jackpot info
             */
            LTInitResponseXMLParser.prototype.populateJackpotData = function (customData, node) {
                var config = {};
                if (node != null) {
                    config.jackpotAwards = node.textContent.split("|").map(Number);
                }
                customData.jackpotData = config;
                //gameData.setCustomData(config);
            };
            /**
            * Helper method for parsing jackpot data
            * @private
            * @param {gamedata.GameInitData} gameData Data structure to populate
            * @param {Node} node XML node containing jackpot info
            */
            LTInitResponseXMLParser.prototype.populateRedEnvData = function (customData, node) {
                var config = {};
                if (node != null) {
                    config.redEnvAwards = node.textContent.split("|").map(Number);
                }
                customData.redEnvData = config;
                //gameData.setCustomData(config);
            };
            LTInitResponseXMLParser.prototype.populateAwardMultiplierData = function (customData, node) {
                var config = {};
                if (node != null) {
                    config.multiplier = node.textContent.split("|").map(Number);
                }
                customData.awardMultiplier = config;
            };
            /**
             * Helper method for parsing pay (awards) table
             * @method gls-comms.InitResponseXMLParser#populateAwardsData
             * @private
             * @param {gamedata.GameInitData} gameData Data structure to populate
             * @param {Node} node XML node containing pay table
             */
            LTInitResponseXMLParser.prototype.populateAwardsData = function (gameData, node) {
                var attributes = node.attributes;
                // Extract win cap value
                var capAmount = parseInt(attributes.getNamedItem("maxWin").value, 10);
                gameData.setWinCapAmount(capAmount);
                // Extract slot award data
                var numAwards = parseInt(attributes.getNamedItem("awardCount").value, 10);
                var nodeChildren = node.childNodes;
                for (var awardIndex = 0; awardIndex < numAwards; ++awardIndex) {
                    var awardDataSource = nodeChildren[awardIndex];
                    var paySummary = awardDataSource.textContent.split("|");
                    var pay = new gamedata.SlotAwardData(parseInt(paySummary[0], 10), parseInt(paySummary[1], 10), parseInt(paySummary[2], 10));
                    gameData.addAward(pay);
                }
            };
            /**
             * Helper method for parsing payline configuration
             * @method gls-comms.InitResponseXMLParser#populatePaylineData
             * @private
             * @param {gamedata.GameInitData} gameData Data structure to populate
             * @param {Node} node XML node containing payline configuration
             */
            LTInitResponseXMLParser.prototype.populatePaylineData = function (gameData, node) {
                if (node != null) {
                    var attributes = node.attributes;
                    var nodeChildren = node.childNodes;
                    var numPaylines = parseInt(attributes.getNamedItem("paylineCount").value, 10);
                    for (var paylineIndex = 0; paylineIndex < numPaylines; ++paylineIndex) {
                        var paylineDataSource = nodeChildren[paylineIndex];
                        var offsets = paylineDataSource.textContent.split("|").map(Number);
                        var selectable = (paylineDataSource.attributes.getNamedItem("selectable").value == "Y");
                        gameData.addPayline(new gamedata.PaylineData(offsets, selectable));
                    }
                }
            };
            /**
             * Helper method for parsing reel strips
             * @method gls-comms.InitResponseXMLParser#populateReelGroupData
             * @private
             * @param {gamedata.GameInitData} gameData Data structure to populate
             * @param {Node} node XML node containing reel strips
             */
            LTInitResponseXMLParser.prototype.populateReelGroupData = function (gameData, node) {
                var attributes = node.attributes;
                var nodeChildren = node.childNodes;
                // Retrieve all node children and look for ReelSet identifier to parse reel group
                var numChildren = nodeChildren.length;
                for (var childIndex = 0; childIndex < numChildren; ++childIndex) {
                    var groupDataSource = nodeChildren[childIndex];
                    if (groupDataSource.nodeName == "ReelSet") {
                        var groupAttributes = groupDataSource.attributes;
                        var group = new gamedata.ReelGroupData(parseInt(groupAttributes.getNamedItem("reelSetIndex").value, 10));
                        group.setFeatureId(parseInt(groupAttributes.getNamedItem("featIndex").value, 10));
                        // Retrieve all node children and look for Reel identifier to parse reel strip
                        var stripSourceLength = groupDataSource.childNodes.length;
                        for (var stripSourceIndex = 0; stripSourceIndex < stripSourceLength; ++stripSourceIndex) {
                            var stripDataSource = groupDataSource.childNodes[stripSourceIndex];
                            if (stripDataSource.nodeName == "Reel") {
                                var stripIndex = parseInt(stripDataSource.attributes.getNamedItem("reelIndex").value, 10);
                                var reel = new gamedata.ReelStripData(stripIndex);
                                reel.setSymbols(stripDataSource.textContent.split("|").map(Number));
                                group.addStrip(stripIndex, reel);
                            }
                        }
                        gameData.addReelGroup(group);
                    }
                }
            };
            return LTInitResponseXMLParser;
        })();
        fudaole.LTInitResponseXMLParser = LTInitResponseXMLParser;
const OWN_GLM_INFO = {
                id: "20135",
                version: "1_0"
            };
const extractMessageType = function (xml) {
            return (xml.getElementsByTagName("GameResponse")[0]).attributes.getNamedItem("type").value;
        };

  const metadataFrames = new WeakSet();
  const built = new WeakSet();
  const parsedBindings = new WeakMap();
  const adoptedOriginalFrames = new WeakMap();

  // Read from unchanged own native declarations in this factory closure,
  // before parsing. No copied currency or numeric default.
  const nativeCurrencyInitial = Object.freeze({
    format: Object.freeze({
      ...glscomms.CurrencyFormatXMLParser.DEFAULT_FORMAT
    }),
    multiplier: new glscomms.PlatformInitData().getCurrencyMultiplier()
  });

  function nativeCurrencyOrigins(raw, parsed) {
    const platform = parsed.getPlatformData();
    const format = ref(
      platform.getCurrencyFormat(), "NATIVE_PARSED_CURRENCY_FORMAT"
    );
    const multiplier = platform.getCurrencyMultiplier();
    if (!Number.isFinite(multiplier) || multiplier <= 0)
      throw hold("INVALID_NATIVE_PARSED_CURRENCY_MULTIPLIER");

    if (raw.currencyInformation == null) {
      const initial = nativeCurrencyInitial.format;
      if (Object.keys(format).length !== Object.keys(initial).length ||
          Object.keys(initial).some(key => format[key] !== initial[key]))
        throw hold("NATIVE_INITIAL_CURRENCY_FORMAT_CHANGED");
    }
    if (raw.currencyNode == null &&
        format.name !== nativeCurrencyInitial.format.name)
      throw hold("UNDECLARED_NATIVE_CURRENCY_NAME_CHANGED");

    if (raw.multiplierNode == null) {
      if (multiplier !== nativeCurrencyInitial.multiplier)
        throw hold("NATIVE_INITIAL_CURRENCY_MULTIPLIER_CHANGED");
    } else if (multiplier !== raw.nativeMultiplier) {
      throw hold("ACTUAL_CURRENCY_MULTIPLIER_PARSE_CHANGED");
    }

    return Object.freeze({
      kind: "own-native-optional-currency-origin-DATA-only",
      formatOrigin: raw.currencyInformation == null
        ? "own-native-CurrencyFormatXMLParser.DEFAULT_FORMAT"
        : "actual-response-CurrencyInformation-node",
      nameOrigin: raw.currencyNode == null
        ? "own-native-CurrencyFormatXMLParser.DEFAULT_FORMAT"
        : "actual-response-Currency-node",
      multiplierOrigin: raw.multiplierNode == null
        ? "own-native-PlatformInitData-constructor"
        : "actual-response-CurrencyMultiplier-node",
      rawCurrencyInformation: raw.currencyInformation,
      rawCurrencyNode: raw.currencyNode,
      rawMultiplierNode: raw.multiplierNode,
      formatReference: format,
      formatValues: Object.freeze({...format}),
      multiplier,
      initialFormatValues: nativeCurrencyInitial.format,
      initialMultiplier: nativeCurrencyInitial.multiplier,
      currencyXMLAdded: false,
      partnerCurrencyProjected: false,
      externalMoneyConversionCertified: false
    });
  }


  function checkScope(value) {
    if (value !== originalSessionScope) throw hold("SESSION_SCOPE_CHANGED");
  }
  function firstNormalRawInputs(xml) {
    const headers = xml.getElementsByTagName("Header");
    const header = headers[0];
    if (attr(header, "gameID") !== OWN_GLM_INFO.id) {
      throw hold("ACTUAL_NATIVE_GAME_ID_CHANGED");
    }
    const returnedSession = attr(header, "sessionID");
    identifier(returnedSession, "RETURNED_SESSION_ID");
    if (attr(header, "isRecovering") !== "N") {
      throw hold("ACTUAL_RECOVERY_MAPPING_REQUIRED");
    }
    // Open-bet/recovery payload is outside this first-normal subset.
    // It must not contribute the SDK open-bet parser's default zero money.
    if (xml.getElementsByTagName("Payload").length) {
      throw hold("ACTUAL_OPEN_BET_PAYLOAD_MAPPING_REQUIRED");
    }

    // Both nodes are optional in this game's original native Init parser.
    // Keep absence in raw DATA. Only the unchanged parser/constructor supplies
    // its own initial values; no partner field or replacement XML is injected.
    const currencyInformationNodes =
      xml.getElementsByTagName("CurrencyInformation");
    if (currencyInformationNodes.length > 1)
      throw hold("AMBIGUOUS_ACTUAL_CURRENCY_INFORMATION");
    const currencyInformation = currencyInformationNodes[0];
    let currencyNode, currencyName;
    if (currencyInformation != null) {
      for (const node of Array.from(currencyInformation.childNodes)) {
        if (node.nodeName !== "Currency") continue;
        if (currencyNode != null)
          throw hold("AMBIGUOUS_ACTUAL_CURRENCY_NAME");
        currencyNode = node;
        currencyName = node.textContent;
        if (typeof currencyName !== "string")
          throw hold("ACTUAL_CURRENCY_NAME_TEXT_REQUIRED");
      }
    }

    const multiplierNodes =
      xml.getElementsByTagName("CurrencyMultiplier");
    if (multiplierNodes.length > 1)
      throw hold("AMBIGUOUS_ACTUAL_CURRENCY_MULTIPLIER");
    const multiplierNode = multiplierNodes[0];
    let rawMultiplier, nativeMultiplier;
    if (multiplierNode != null) {
      rawMultiplier = multiplierNode.textContent;
      identifier(rawMultiplier, "ACTUAL_CURRENCY_MULTIPLIER");
      nativeMultiplier = parseInt(rawMultiplier, 10);
      if (!Number.isFinite(nativeMultiplier) || nativeMultiplier <= 0)
        throw hold("INVALID_ACTUAL_CURRENCY_MULTIPLIER");
    }

    const stakesNode = xml.getElementsByTagName("Stakes")[0];
    ref(stakesNode, "ACTUAL_STAKES");
    const rawStakes = stakesNode.textContent;
    if (typeof rawStakes !== "string" || rawStakes.trim() === "") {
      throw hold("ACTUAL_STAKES_EMPTY");
    }
    const stakes = rawStakes.split("|").map(Number);
    const rawDefaultIndex = attr(stakesNode, "defaultIndex");
    const defaultIndex = parseInt(rawDefaultIndex, 10);
    if (
      stakes.some(value => !Number.isFinite(value) || value <= 0) ||
      !Number.isInteger(defaultIndex) ||
      defaultIndex < 0 || defaultIndex >= stakes.length
    ) throw hold("INVALID_ACTUAL_STAKES_CONFIGURATION");

    const balancesNode = xml.getElementsByTagName("Balances")[0];
    ref(balancesNode, "ACTUAL_BALANCES");
    let rawCash;
    for (const node of Array.from(balancesNode.childNodes)) {
      if (node.nodeName === "Balance" &&
          attr(node, "name") === glscomms.BalanceType[0]) {
        rawCash = attr(node, "value");
      }
    }
    identifier(rawCash, "ACTUAL_CASH_BALANCE");
    if (!Number.isFinite(parseInt(rawCash, 10))) {
      throw hold("INVALID_ACTUAL_CASH_BALANCE");
    }
    return Object.freeze({
      header, returnedSession, currencyInformation, currencyNode, currencyName,
      multiplierNode, rawMultiplier, nativeMultiplier,
      stakesNode, rawStakes, rawDefaultIndex,
      balancesNode, rawCash
    });
  }

  const api = Object.freeze({
    parseOriginalFactoryInit() {
      ref(originalFactoryInitSource, "ORIGINAL_FACTORY_INIT_SOURCE");
      if (typeof originalFactoryInitSource.read !== "function" ||
          typeof originalFactoryInitSource.has !== "function") {
        throw hold("ORIGINAL_FACTORY_INIT_CAPABILITY_REQUIRED");
      }
      // No caller-supplied success flag, status DTO or replacement request.
      const frame = originalFactoryInitSource.read(originalSessionScope);
      if (!originalFactoryInitSource.has(frame) ||
          frame.sessionScope !== originalSessionScope) {
        throw hold("ORIGINAL_FACTORY_INIT_FRAME_NOT_CURRENT");
      }
      if (frame.game.gameId !== "32769" ||
          frame.nativeGameID !== OWN_GLM_INFO.id ||
          frame.gameCodeRGI !== "fudaole" ||
          frame.nativeVersionID !== OWN_GLM_INFO.version ||
          frame.msgId !== "Init") {
        throw hold("ORIGINAL_FACTORY_OWN_NATIVE_BINDING_CHANGED");
      }
      identifier(frame.initialSessionID, "ORIGINAL_INITIAL_SESSION_ID");
      let request = adoptedOriginalFrames.get(frame);
      if (!request) {
        request = Object.freeze({
          kind: "original-factory-Init-request-reference-DATA-only",
          sessionScope: originalSessionScope,
          nativeGameId: frame.nativeGameID,
          runtimeGameId: frame.runtimeGameId,
          initialSessionId: frame.initialSessionID,
          requestText: frame.requestPayload,
          transport: Object.freeze({url: frame.endpoint}),
          sourceRefs: Object.freeze({
            originalFactoryFrame: frame,
            originalWireStep: frame.step,
            originalGameConfig: frame.game
          })
        });
        adoptedOriginalFrames.set(frame, request);
        built.add(request);
      }
      return api.parseAfterOriginalSuccess({
        sessionScope: originalSessionScope,
        request,
        actualRequestText: frame.requestPayload,
        url: frame.endpoint,
        responseText: frame.responsePayload,
        responseHeaders: frame.responseHeaders,
        originalExchangeRecord: frame
      });
    },

    createOwnMetadataData(input) {
      keys(input, [
        "sessionScope", "launchRecord", "metadataSourceRecord"
      ]);
      checkScope(input.sessionScope);
      const frame = Object.freeze({
        kind: "own-native-metadata-DATA-only",
        sessionScope: originalSessionScope,
        metadata: new fudaole.MetaDataBundle(),
        launchRecord: ref(input.launchRecord, "ACTUAL_LAUNCH_RECORD"),
        metadataSourceRecord: ref(
          input.metadataSourceRecord, "ACTUAL_METADATA_SOURCE_RECORD"
        )
      });
      metadataFrames.add(frame);
      return frame;
    },

    build(input) {
      keys(input, [
        "sessionScope", "metadataFrame", "sessionFieldFrame",
        "launchQueryData", "platformInitData", "requestData",
        "requestSourceRecord"
      ]);
      checkScope(input.sessionScope);
      const metaFrame = input.metadataFrame;
      if (!metadataFrames.has(metaFrame)) {
        throw hold("OWN_METADATA_FRAME_REQUIRED");
      }
      const sessionFrame = input.sessionFieldFrame;
      keys(sessionFrame, ["kind", "sessionScope", "sessionData", "sourceRefs"]);
      checkScope(sessionFrame.sessionScope);
      if (sessionFrame.kind !== "session-fields-data-only") {
        throw hold("OWN_CURRENT_SESSION_FIELD_FRAME_REQUIRED");
      }
      keys(sessionFrame.sourceRefs, ["launchRecord", "launchQueryData"]);
      if (
        sessionFrame.sourceRefs.launchRecord !== metaFrame.launchRecord ||
        sessionFrame.sourceRefs.launchQueryData !== input.launchQueryData
      ) throw hold("ACTUAL_LAUNCH_BINDING_CHANGED");

      ref(input.launchQueryData, "ACTUAL_MAIN_LAUNCH_QUERY");
      if (input.launchQueryData["HistoryServerURL"] != null) {
        throw hold("HISTORY_INIT_OUTSIDE_FIRST_NORMAL");
      }
      if (input.platformInitData !== undefined) {
        throw hold("NOT_FIRST_INIT_CONTEXT");
      }
      // Own Main.onSoundsLoaded calls makeInitRequest with no argument.
      if (input.requestData !== undefined) {
        throw hold("NOT_OWN_FIRST_NORMAL_INIT_CALL");
      }
      ref(input.requestSourceRecord, "ACTUAL_REQUEST_SOURCE_RECORD");

      const metadata = metaFrame.metadata;
      const sessionData = ref(sessionFrame.sessionData, "ACTUAL_SESSION_DATA");
      for (const name of ["getContextID", "getPlayerID", "getSessionID"]) {
        if (typeof sessionData[name] !== "function") {
          throw hold("NATIVE_SESSION_GETTER_MISSING_" + name);
        }
      }
      const initialSessionId = sessionData.getSessionID();
      identifier(initialSessionId, "INITIAL_SESSION_ID");
      const endpoint = metadata.getLogicUrl();
      identifier(endpoint, "ACTUAL_METADATA_ENDPOINT");

      const header = new glscomms.GLSRequestHeader(
        metadata, sessionData, OWN_GLM_INFO,
        initialSessionId, input.platformInitData
      );
      identifier(header.affiliate, "ACTUAL_CONTEXT_ID");
      identifier(header.userId, "ACTUAL_PLAYER_ID");
      if (header.gameCodeRGI !== "fudaole") {
        throw hold("OWN_METADATA_GAME_CODE_CHANGED");
      }
      const requestData = new glscomms.GLSRequestData("Init", header);
      const requestText = requestData.toXMLString();

      const request = Object.freeze({
        kind: "first-normal-Init-request-DATA-only",
        sessionScope: originalSessionScope,
        nativeGameId: OWN_GLM_INFO.id,
        runtimeGameId: 32991,
        initialSessionId,
        requestText,
        nativeRequestData: requestData,
        transport: Object.freeze({
          url: endpoint,
          method: "POST",
          nativeMethodCode: 1,
          async: true,
          responseType: 0,
          sendWithCredentials: false,
          requestHeaders: Object.freeze([])
        }),
        sourceRefs: Object.freeze({
          metadataFrame: metaFrame,
          sessionFieldFrame: sessionFrame,
          launchQueryData: input.launchQueryData,
          requestSourceRecord: input.requestSourceRecord
        })
      });
      built.add(request);
      return request;
    },

    // Call only after the original factory's real success path.
    // Reference identity and protocol parsing do not authenticate transport.
    parseAfterOriginalSuccess(input) {
      keys(input, [
        "sessionScope", "request", "actualRequestText", "url",
        "responseText", "responseHeaders", "originalExchangeRecord"
      ]);
      checkScope(input.sessionScope);
      const request = input.request;
      if (!built.has(request) ||
          request.sessionScope !== originalSessionScope) {
        throw hold("ORIGINAL_REQUEST_BINDING_CHANGED");
      }
      if (input.actualRequestText !== request.requestText ||
          input.url !== request.transport.url) {
        throw hold("ACTUAL_WIRE_REQUEST_BINDING_CHANGED");
      }
      if (typeof input.responseText !== "string") {
        throw hold("ACTUAL_RESPONSE_TEXT_REQUIRED");
      }
      ref(input.originalExchangeRecord, "ORIGINAL_EXCHANGE_RECORD");

      const old = parsedBindings.get(request);
      if (old) {
        if (
          old.exchange !== input.originalExchangeRecord ||
          old.text !== input.responseText ||
          old.headers !== input.responseHeaders
        ) throw hold("REQUEST_ALREADY_BOUND_TO_OTHER_RESPONSE");
        if (old.phase === "failed") throw old.error;
        if (old.phase !== "parsed") throw hold("REENTRANT_INIT_PARSE");
        return old.result;
      }
      const binding = {
        phase: "parsing",
        exchange: input.originalExchangeRecord,
        text: input.responseText,
        headers: input.responseHeaders
      };
      parsedBindings.set(request, binding);

      try {
        const xml = new DOMParser().parseFromString(
          input.responseText, "text/xml"
        );
        if (extractMessageType(xml) !== "Init") {
          throw hold("ACTUAL_NON_INIT_RESPONSE");
        }
        const raw = firstNormalRawInputs(xml);
        const parser = new fudaole.LTInitResponseXMLParser();
        const parsed = parser.parse(xml);
        const currencySemantics = nativeCurrencyOrigins(raw, parsed);
        const returnedSessionId =
          parsed.getPlatformData().getSessionId();
        identifier(returnedSessionId, "NATIVE_RETURNED_SESSION_ID");

        const result = Object.freeze({
          kind: "actual-normal-Init-protocol-DATA-only",
          sessionScope: originalSessionScope,
          request,
          actualRequestText: input.actualRequestText,
          url: input.url,
          responseText: input.responseText,
          responseHeaders: input.responseHeaders,
          originalExchangeRecord: input.originalExchangeRecord,
          xml, raw, parsed, currencySemantics,
          sessionChange: Object.freeze({
            field: "glsServerSessionId",
            previous: request.initialSessionId,
            returned: returnedSessionId
          })
        });
        binding.result = result;
        binding.phase = "parsed";
        return result;
      } catch (error) {
        binding.error = error;
        binding.phase = "failed";
        throw error;
      }
    }
  });
  return api;
}

module.exports = Object.freeze({own32769InitSource,createOwn32769FirstNormalInitData});
