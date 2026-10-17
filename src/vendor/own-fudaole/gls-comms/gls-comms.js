define(["require", "exports", "events/events", "game-data/game-data", "http-connection/http-connection"], function (require, exports, events, gamedata, httpconnection) {
    /**
     * Custom payload for gaffing the reels (force)
     * @class gls-comms.GaffPayload
     * @classdesc Payload for gaff positions
     */
    var GaffPayload = (function () {
        /**
         * @constructor
         */
        function GaffPayload(stopPositions, reelSetIndex) {
            this.stopPositions = stopPositions;
            this.reelSetIndex = reelSetIndex;
        }
        /**
         * Convert custom payload data into XML
         * @method gls-comms.GaffPayload#toXML
         * @returns {Document} XML formatted data
         */
        GaffPayload.prototype.toXML = function () {
            var xmlDoc = document.implementation.createDocument("", "FORCE", null);
            var spinElement = xmlDoc.createElement("ReelSpin");
            var reelsetAttr = document.createAttribute("reelsetIndex");
            reelsetAttr.value = this.reelSetIndex.toString();
            spinElement.attributes.setNamedItem(reelsetAttr);
            var stopsAttr = document.createAttribute("stopIndices");
            stopsAttr.value = this.stopPositions.join('|');
            spinElement.attributes.setNamedItem(stopsAttr);
            xmlDoc.documentElement.appendChild(spinElement);
            return xmlDoc;
        };
        return GaffPayload;
    })();
    exports.GaffPayload = GaffPayload;
    /**
     * @class EndResponse
     * @classdesc Data received in response to End request
     */
    var EndResponse = (function () {
        /**
         * @constructor
         */
        function EndResponse(platformData, balanceData) {
            this.platformData = platformData;
            this.balances = balanceData;
        }
        /**
         * Accessor for platform data
         * @method gls-comms.EndResponse#getPlatformData
         * @public
         * @returns {PlatformEndData} Platform data
         */
        EndResponse.prototype.getPlatformData = function () {
            return this.platformData;
        };
        /**
         * Retrieve specific type of balance amount
         * @method gls-comms.EndResponse#getBalance
         * @public
         * @param {string} type Balance type
         * @returns {number} Value of specific balance
         */
        EndResponse.prototype.getBalance = function (type) {
            if (type === void 0) { type = 0 /* CASH_BALANCE */; }
            return this.balances.getBalance(type);
        };
        return EndResponse;
    })();
    exports.EndResponse = EndResponse;
    /**
     * @class gls-comms.PlatformPlayData
     * @classdesc Platform data from Play request
     */
    var PlatformPlayData = (function () {
        /**
         * @constructor
         */
        function PlatformPlayData() {
            this.currencyMultiplier = 1;
        }
        /**
         * Set session id
         * @method gls-comms.PlatformEndData#setSessionId
         * @public
         * @param {string} sessionId Session id
         */
        PlatformPlayData.prototype.setSessionId = function (sessionId) {
            this.sessionId = sessionId;
        };
        /**
         * Accessor for session id
         * @method gls-comms.PlatformInitData#getSessionId
         * @returns {string} Session id
         */
        PlatformPlayData.prototype.getSessionId = function () {
            return this.sessionId;
        };
        /**
         * Set game id
         * @method gls-comms.PlatformEndData#setGameId
         * @public
         * @param {string} gameId Game id
         */
        PlatformPlayData.prototype.setGameId = function (gameId) {
            this.gameId = gameId;
        };
        /**
         * Accessor for game id
         * @method gls-comms.PlatformEndData#getGameId
         * @returns {string} Game id
         */
        PlatformPlayData.prototype.getGameId = function () {
            return this.gameId;
        };
        /**
         * Set language code
         * @method gls-comms.PlatformEndData#setLanguageCode
         * @public
         * @param {string} languageCode Session id
         */
        PlatformPlayData.prototype.setLanguageCode = function (languageCode) {
            this.languageCode = languageCode;
        };
        /**
         * Accessor for language code
         * @method gls-comms.PlatformEndData#getLanguageCode
         * @returns {string} Language code
         */
        PlatformPlayData.prototype.getLanguageCode = function () {
            return this.languageCode;
        };
        /**
         * Set game version
         * @method gls-comms.PlatformEndData#setVersion
         * @public
         * @param {string} version Game version
         */
        PlatformPlayData.prototype.setVersion = function (version) {
            this.version = version;
        };
        /**
         * Accessor for game version
         * @method gls-comms.PlatformEndData#getVersion
         * @returns {string} Game version
         */
        PlatformPlayData.prototype.getVersion = function () {
            return this.version;
        };
        /**
         * Set currency multiplier. Passing in an invalid multiplier will not modify the existing value.
         * @method gls-comms.PlatformEndData#setCurrencyMultiplier
         * @public
         * @param {number} multiplier Currency multiplier
         */
        PlatformPlayData.prototype.setCurrencyMultiplier = function (multiplier) {
            if (multiplier != null) {
                this.currencyMultiplier = multiplier;
            }
        };
        /**
         * Accessor for currency multiplier
         * @method gls-comms.PlatformEndData#getCurrencyMultiplier
         * @returns {number} Currency multiplier
         */
        PlatformPlayData.prototype.getCurrencyMultiplier = function () {
            return this.currencyMultiplier;
        };
        return PlatformPlayData;
    })();
    exports.PlatformPlayData = PlatformPlayData;
    /**
     * @class gls-comms.PlatformEndData
     * @classdesc Platform data from End request
     */
    var PlatformEndData = (function () {
        function PlatformEndData() {
        }
        /**
         * Set session id
         * @method gls-comms.PlatformEndData#setSessionId
         * @public
         * @param {string} sessionId Session id
         */
        PlatformEndData.prototype.setSessionId = function (sessionId) {
            this.sessionId = sessionId;
        };
        /**
         * Accessor for session id
         * @method gls-comms.PlatformInitData#getSessionId
         * @returns {string} Session id
         */
        PlatformEndData.prototype.getSessionId = function () {
            return this.sessionId;
        };
        /**
         * Set game id
         * @method gls-comms.PlatformEndData#setGameId
         * @public
         * @param {string} gameId Game id
         */
        PlatformEndData.prototype.setGameId = function (gameId) {
            this.gameId = gameId;
        };
        /**
         * Accessor for game id
         * @method gls-comms.PlatformEndData#getGameId
         * @returns {string} Game id
         */
        PlatformEndData.prototype.getGameId = function () {
            return this.gameId;
        };
        /**
         * Set language code
         * @method gls-comms.PlatformEndData#setLanguageCode
         * @public
         * @param {string} languageCode Session id
         */
        PlatformEndData.prototype.setLanguageCode = function (languageCode) {
            this.languageCode = languageCode;
        };
        /**
         * Accessor for language code
         * @method gls-comms.PlatformEndData#getLanguageCode
         * @returns {string} Language code
         */
        PlatformEndData.prototype.getLanguageCode = function () {
            return this.languageCode;
        };
        /**
         * Set game version
         * @method gls-comms.PlatformEndData#setVersion
         * @public
         * @param {string} version Game version
         */
        PlatformEndData.prototype.setVersion = function (version) {
            this.version = version;
        };
        /**
         * Accessor for game version
         * @method gls-comms.PlatformEndData#getVersion
         * @returns {string} Game version
         */
        PlatformEndData.prototype.getVersion = function () {
            return this.version;
        };
        return PlatformEndData;
    })();
    exports.PlatformEndData = PlatformEndData;
    /**
     * @class PlayResponseXMLParser
     * @classdesc XML parser for GLS PlayResponse payload
     */
    var PlayResponseXMLParser = (function () {
        function PlayResponseXMLParser() {
        }
        /**
         * Parse GLS PlayResponse XML payload
         * @method PlayResponseXMLParser#parse
         * @public
         * @param {Document} xml XML Document containing GLS PlayResponse payload
         * @returns {PlayResponse} PlayResponse data structure
         */
        PlayResponseXMLParser.prototype.parse = function (xml) {
            var platformData = this.parsePlatformData(xml);
            var balanceData = BalanceData.parseXML(xml.getElementsByTagName("Balances")[0]);
            var response = new PlayResponse(platformData, balanceData);
            GamePlayDataXMLParser.populateGameData(response.getGameData(), xml.getElementsByTagName("GameResult")[0]);
            return response;
        };
        /**
         * Parse GLS platform data
         * @method PlayResponseXMLParser#parsePlatformData
         * @public
         * @param {Document} xml XML Document containing GLS PlayResponse payload
         * @returns {PlatformPlayData} Platform data
         */
        PlayResponseXMLParser.prototype.parsePlatformData = function (xml) {
            var data = new PlatformPlayData();
            var glsHeader = GLSResponseHeader.parseXML(xml.getElementsByTagName("Header")[0]);
            data.setSessionId(glsHeader.getSessionId());
            data.setGameId(glsHeader.getGameId());
            data.setLanguageCode(glsHeader.getLanguageCode());
            data.setVersion(glsHeader.getVersion());
            var currencyMultiplierNode = xml.getElementsByTagName("CurrencyMultiplier")[0];
            if (currencyMultiplierNode != null) {
                data.setCurrencyMultiplier(parseInt(currencyMultiplierNode.textContent, 10));
            }
            return data;
        };
        return PlayResponseXMLParser;
    })();
    exports.PlayResponseXMLParser = PlayResponseXMLParser;
    /**
     * @class gls-comms.PlatformInitData
     * @classdesc Platform data from Init request
     */
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
    /**
     * @class InitResponse
     * @classdesc Data received in response to Init request
     */
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
    /**
     * Anyway pay wager payload
     * @class gls-comms.AnywayWwagerPayload
     * @classdesc Wager payload for anyway pay game
     */
    var AnywayWagerPayload = (function () {
        /**
         * @constructor
         */
        function AnywayWagerPayload(totalStake) {
            this.totalStake = totalStake;
        }
        /**
         * Convert custom payload data into XML
         * @method gls-comms.WagerPayload#toXML
         * @returns {Document} XML formatted data
         */
        AnywayWagerPayload.prototype.toXML = function () {
            var xmlDoc = document.implementation.createDocument("", "SpinInfo", null);
            var stakeAttr = xmlDoc.createAttribute("stake");
            stakeAttr.value = this.totalStake.toString();
            xmlDoc.documentElement.attributes.setNamedItem(stakeAttr);
            return xmlDoc;
        };
        return AnywayWagerPayload;
    })();
    exports.AnywayWagerPayload = AnywayWagerPayload;
    /**
     * Enumeration of balance types.
     * The enumerated names match the balance names in the response message, and can be used as strings.
     */
    (function (BalanceType) {
        BalanceType[BalanceType["CASH_BALANCE"] = 0] = "CASH_BALANCE";
        BalanceType[BalanceType["BONUS_BALANCE"] = 1] = "BONUS_BALANCE";
    })(exports.BalanceType || (exports.BalanceType = {}));
    var BalanceType = exports.BalanceType;
    /**
     * Container for various types of player balance
     * @class gls-comms.BalanceData
     * @classdesc Dictinoary of different types of balance, identified by type
     */
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
    /**
     * @class InitResponseXMLParser
     * @classdesc XML parser for GLS InitResponse payload
     */
    var InitResponseXMLParser = (function () {
        function InitResponseXMLParser() {
        }
        /**
         * Parse GLS InitResponse XML payload
         * @method gls-comms.InitResponseXMLParser#parse
         * @public
         * @param {Document} xml XML Document containing GLS InitResponse payload
         * @returns {InitResponse} InitResponse data structure
         */
        InitResponseXMLParser.prototype.parse = function (xml) {
            var platformData = this.parsePlatformData(xml);
            var balanceData = BalanceData.parseXML(xml.getElementsByTagName("Balances")[0]);
            var response = new InitResponse(platformData, balanceData);
            // Populate standard initialization data
            var gameData = response.getGameData();
            this.populatePaylineData(gameData, xml.getElementsByTagName("PaylineInfo")[0]);
            this.populateAwardsData(gameData, xml.getElementsByTagName("AwardsInfo")[0]);
            this.populateReelGroupData(gameData, xml.getElementsByTagName("ReelInfo")[0]);
            this.populateBetConfiguration(gameData, xml.getElementsByTagName("Stakes")[0]);
            // Retrieve RTP, if available
            var gameConstsNode = xml.getElementsByTagName("GameConsts");
            if (gameConstsNode != null) {
                var attr = gameConstsNode[0].attributes;
                gameData.setReturnToPlayer(parseFloat(attr.getNamedItem("rtp").value));
            }
            return response;
        };
        /**
         * Parse GLS platform data
         * @method gls-comms.InitResponseXMLParser#parsePlatformData
         * @public
         * @param {Document} xml XML Document containing GLS InitResponse payload
         * @returns {PlatformInitData} Platform data
         */
        InitResponseXMLParser.prototype.parsePlatformData = function (xml) {
            var data = new PlatformInitData();
            var glsHeader = GLSResponseHeader.parseXML(xml.getElementsByTagName("Header")[0]);
            data.setSessionId(glsHeader.getSessionId());
            data.setGameId(glsHeader.getGameId());
            data.setLanguageCode(glsHeader.getLanguageCode());
            data.setVersion(glsHeader.getVersion());
            data.setIsRecovering(glsHeader.isRecovering());
            data.setCurrencyFormat(CurrencyFormatXMLParser.parse(xml.getElementsByTagName("CurrencyInformation")[0]));
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
        InitResponseXMLParser.prototype.populateBetConfiguration = function (gameData, node) {
            var config = new gamedata.BetConfiguration();
            if (node != null) {
                var attributes = node.attributes;
                config.setDefaultIndex(parseInt(attributes.getNamedItem("defaultIndex").value, 10));
                config.setAvailableBets(node.textContent.split("|").map(Number));
            }
            gameData.setBetConfiguration(config);
        };
        /**
         * Helper method for parsing pay (awards) table
         * @method gls-comms.InitResponseXMLParser#populateAwardsData
         * @private
         * @param {gamedata.GameInitData} gameData Data structure to populate
         * @param {Node} node XML node containing pay table
         */
        InitResponseXMLParser.prototype.populateAwardsData = function (gameData, node) {
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
        InitResponseXMLParser.prototype.populatePaylineData = function (gameData, node) {
            if (node != null) {
                var attributes = node.attributes;
                var nodeChildren = node.childNodes;
                var numPaylines = parseInt(attributes.getNamedItem("paylineCount").value, 10);
                for (var paylineIndex = 0; paylineIndex < numPaylines; ++paylineIndex) {
                    var paylineDataSource = nodeChildren[paylineIndex];
                    var offsets = paylineDataSource.textContent.split("|").map(Number);
                    var selectable = (attributes.getNamedItem("paylineCount").value == "y");
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
        InitResponseXMLParser.prototype.populateReelGroupData = function (gameData, node) {
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
        return InitResponseXMLParser;
    })();
    exports.InitResponseXMLParser = InitResponseXMLParser;
    /**
     * @class PlayResponse
     * @classdesc Data received in response to Play request
     */
    var PlayResponse = (function () {
        /**
         * @constructor
         */
        function PlayResponse(platformData, balanceData) {
            this.gameData = new gamedata.GamePlayData();
            this.platformData = platformData;
            this.balances = balanceData;
        }
        /**
         * Accessor for game data
         * @method gls-comms.PlayResponse#getGameData
         * @public
         * @returns {GamePlayData} Game data
         */
        PlayResponse.prototype.getGameData = function () {
            return this.gameData;
        };
        /**
         * Accessor for platform data
         * @method gls-comms.PlayResponse#getPlatformData
         * @public
         * @returns {PlatformPlayData} Platform data
         */
        PlayResponse.prototype.getPlatformData = function () {
            return this.platformData;
        };
        /**
         * Retrieve specific type of balance amount
         * @method gls-comms.PlayResponse#getBalance
         * @public
         * @param {string} type Balance type
         * @returns {number} Value of specific balance
         */
        PlayResponse.prototype.getBalance = function (type) {
            if (type === void 0) { type = 0 /* CASH_BALANCE */; }
            return this.balances.getBalance(type);
        };
        PlayResponse.prototype.hasBalance = function (type) {
            if (type === void 0) { type = 0 /* CASH_BALANCE */; }
            return this.balances.hasBalance(type);
        };
        return PlayResponse;
    })();
    exports.PlayResponse = PlayResponse;
    /**
     * Wager payload for Play requests
     * @class gls-comms.WagerPayload
     * @classdesc Standard wager payload
     */
    var WagerPayload = (function () {
        /**
         * @constructor
         */
        function WagerPayload(unitsBet, betPerUnit) {
            this.unitsBet = unitsBet;
            this.betPerUnit = betPerUnit;
        }
        /**
         * Convert custom payload data into XML
         * @method gls-comms.WagerPayload#toXML
         * @returns {Document} XML formatted data
         */
        WagerPayload.prototype.toXML = function () {
            var xmlDoc = document.implementation.createDocument("", "SpinInfo", null);
            var stakePerLineNode = xmlDoc.createAttribute("stakePerLine");
            stakePerLineNode.value = this.betPerUnit.toString();
            xmlDoc.documentElement.attributes.setNamedItem(stakePerLineNode);
            var paylineCount = xmlDoc.createAttribute("paylineCount");
            paylineCount.value = this.unitsBet.toString();
            xmlDoc.documentElement.attributes.setNamedItem(paylineCount);
            var hiRoller = xmlDoc.createAttribute("isHiRoller");
            hiRoller.value = "0";
            xmlDoc.documentElement.attributes.setNamedItem(hiRoller);
            return xmlDoc;
        };
        return WagerPayload;
    })();
    exports.WagerPayload = WagerPayload;
    /**
     * GLS-specific request data and functionality
     * @class GLSHeader
     * @classdesc Encapsulation of all GLS-specific XML request header functionalitiy.
     */
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
    /**
     * GLS-specific response header data
     * @class GLSHeader
     * @classdesc Encapsulation of GLS-specific XML headers for responses.
     */
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
    /**
     * @class gls-comms.ResponseXMLParserFactory
     * @classdesc Factory to create default gls-comms response XML parser
     * @implements IResponseXMLParserFactory
     */
    var ResponseXMLParserFactory = (function () {
        function ResponseXMLParserFactory() {
        }
        /**
         * Construct Init response XML parser
         * @method gls-comms.IResponseXMLParserFactory#createInitParser
         * @returns {IResponseXMLParser<InitResponse>} Init response parser
         */
        ResponseXMLParserFactory.prototype.createInitParser = function () {
            return new InitResponseXMLParser;
        };
        /**
         * Construct Play response XML parser
         * @method gls-comms.IResponseXMLParserFactory#createPlayParser
         * @returns {IResponseXMLParser<PlayResponse>} Play response parser
         */
        ResponseXMLParserFactory.prototype.createPlayParser = function () {
            return new PlayResponseXMLParser;
        };
        /**
         * Construct End response XML parser
         * @method gls-comms.IResponseXMLParserFactory#createEndParser
         * @returns {IResponseXMLParser<EndResponse>} End response parser
         */
        ResponseXMLParserFactory.prototype.createEndParser = function () {
            return new EndResponseXMLParser;
        };
        return ResponseXMLParserFactory;
    })();
    exports.ResponseXMLParserFactory = ResponseXMLParserFactory;
    /**
     * @class EndResponseXMLParser
     * @classdesc XML parser for GLS EndResponse payload
     */
    var EndResponseXMLParser = (function () {
        function EndResponseXMLParser() {
        }
        /**
         * Parse XML payload
         * @method gls-comms.EndResponseXMLParser#parse
         * @public
         * @param {Document} xml XML Document containing GLS EndResponse payload
         * @returns {EndResponse} EndResponse data structure
         */
        EndResponseXMLParser.prototype.parse = function (xml) {
            var platformData = this.parsePlatformData(xml);
            var balanceData = BalanceData.parseXML(xml.getElementsByTagName("Balances")[0]);
            var response = new EndResponse(platformData, balanceData);
            return response;
        };
        /**
         * Parse GLS platform data
         * @method gls-comms.EndResponseXMLParser#parsePlatformData
         * @public
         * @param {Document} xml XML Document containing GLS EndResponse payload
         * @returns {PlatformEndData} Platform data
         */
        EndResponseXMLParser.prototype.parsePlatformData = function (xml) {
            var data = new PlatformEndData();
            var glsHeader = GLSResponseHeader.parseXML(xml.getElementsByTagName("Header")[0]);
            data.setSessionId(glsHeader.getSessionId());
            data.setGameId(glsHeader.getGameId());
            data.setLanguageCode(glsHeader.getLanguageCode());
            data.setVersion(glsHeader.getVersion());
            return data;
        };
        return EndResponseXMLParser;
    })();
    exports.EndResponseXMLParser = EndResponseXMLParser;
    /**
     * Currency Multiplier payload
     * @class gls-comms.CurrencyMultiplierPayload
     * @classdesc Currency multiplier payload for play requests
     */
    var CurrencyMultiplierPayload = (function () {
        /**
         * @constructor
         */
        function CurrencyMultiplierPayload(multiplier) {
            this.multiplier = multiplier;
        }
        /**
         * Convert custom payload data into XML
         * @method gls-comms.CurrencyMultiplierPayload#toXML
         * @returns {Document} XML formatted data
         */
        CurrencyMultiplierPayload.prototype.toXML = function () {
            var xmlDoc = document.implementation.createDocument("", "AccountData", null);
            var multiplierElement = xmlDoc.createElement("CurrencyMultiplier");
            multiplierElement.textContent = this.multiplier.toString();
            xmlDoc.documentElement.appendChild(multiplierElement);
            return xmlDoc;
        };
        return CurrencyMultiplierPayload;
    })();
    exports.CurrencyMultiplierPayload = CurrencyMultiplierPayload;
    /**
     * @class glscomms.GamePlayDataXMLParser
     * @classdesc XML parser for slot result data
     */
    var GamePlayDataXMLParser = (function () {
        function GamePlayDataXMLParser() {
        }
        /**
         * Helper method for parsing game play data
         * @method gls-comms.GamePlayDataXMLParser#populateGameData
         * @public
         * @param {gamedata.GamePlayData} gameData Data structure to populate
         * @param {Node} node XML node containing game play data
         */
        GamePlayDataXMLParser.populateGameData = function (gameData, node) {
            gameData.setTotalWin(parseInt(node.attributes.getNamedItem("totalWin").value, 10));
            gameData.setWager(parseInt(node.attributes.getNamedItem("stake").value, 10));
            var reelsNode = node.childNodes;
            for (var i = 0; i < reelsNode.length; ++i) {
                if (reelsNode[i].nodeName == "ReelResults") {
                    this.populateResults(gameData, reelsNode[i]);
                }
            }
        };
        /**
         * Helper method for parsing slot game results, including stop positions and individual pays
         * @method gls-comms.GamePlayDataXMLParser#populateResults
         * @private
         * @param {gamedata.GamePlayData} gameData Data structure to populate
         * @param {Node} node XML node containing game play data
         */
        GamePlayDataXMLParser.populateResults = function (gameData, node) {
            var spinNode = node.childNodes;
            for (var spinNodeIndex = 0; spinNodeIndex < spinNode.length; ++spinNodeIndex) {
                // Parse spin data child nodes
                var spinDataSource = spinNode[spinNodeIndex].childNodes;
                for (var spinDataIndex = 0; spinDataIndex < spinDataSource.length; ++spinDataIndex) {
                    var spinDataSubType = spinDataSource[spinDataIndex];
                    var nodeType = spinDataSubType.nodeName;
                    if (nodeType == "ReelStops") {
                        gameData.setStopPositions(spinDataSubType.textContent.split("|").map(Number));
                    }
                    else if (nodeType == "PaylineWin") {
                        this.populatePaylineWin(gameData, spinDataSubType);
                    }
                    else if (nodeType == "AnywayWin") {
                        this.populateAnywayWin(gameData, spinDataSubType);
                    }
                    else if (nodeType == "ScatterWin") {
                        this.populateScatterWin(gameData, spinDataSubType);
                    }
                }
                // Parse spin data attributes (at root level of this node only)
                var spinDataAttr = spinNode[spinNodeIndex].attributes;
                var isBonusNode = spinDataAttr.getNamedItem("bonusAwarded");
                if (isBonusNode != null) {
                    gameData.setIsBonusTriggered((isBonusNode.value == "Y"));
                }
            }
        };
        /**
         * Helper method for parsing a payline win
         * @method gls-comms.GamePlayDataXMLParser#populatePaylineWin
         * @private
         * @param {gamedata.GamePlayData} gameData Data structure to populate
         * @param {Node} node XML node containing a payline win
         */
        GamePlayDataXMLParser.populatePaylineWin = function (gameData, node) {
            var awardId = parseInt(node.attributes.getNamedItem("awardIndex").value, 10);
            var awardValue = parseInt(node.attributes.getNamedItem("winVal").value, 10);
            var reelOffsets = node.textContent.split("|").map(Number);
            gameData.addSlotResult(new gamedata.PaylineSlotResult(awardId, awardValue, reelOffsets));
        };
        /**
         * Helper method for parsing an anyway win
         * @method gls-comms.GamePlayDataXMLParser#populateAnywayWin
         * @private
         * @param {gamedata.GamePlayData} gameData Data structure to populate
         * @param {Node} node XML node containing an anyway win
         */
        GamePlayDataXMLParser.populateAnywayWin = function (gameData, node) {
            var awardId = parseInt(node.attributes.getNamedItem("awardIndex").value, 10);
            var awardValue = parseInt(node.attributes.getNamedItem("winVal").value, 10);
            var reelOffsets = node.textContent.split("|").map(Number);
            var numWays = parseInt(node.attributes.getNamedItem("ways").value, 10);
            gameData.addSlotResult(new gamedata.AnywaySlotResult(awardId, awardValue, reelOffsets, numWays));
        };
        /**
         * Helper method for parsing a scatter win
         * @method gls-comms.GamePlayDataXMLParser#populateScatterWin
         * @private
         * @param {gamedata.GamePlayData} gameData Data structure to populate
         * @param {Node} node XML node containing a scatter win
         */
        GamePlayDataXMLParser.populateScatterWin = function (gameData, node) {
            var awardId = parseInt(node.attributes.getNamedItem("awardIndex").value);
            var awardValue = parseInt(node.attributes.getNamedItem("winVal").value);
            var reelOffsets = node.textContent.split("|").map(Number);
            gameData.addSlotResult(new gamedata.ScatterSlotResult(awardId, awardValue, reelOffsets, this.extractBoolAttribute("isBonusPay", node.attributes), this.extractBoolAttribute("isBonusTrigger", node.attributes)));
        };
        /**
         * Helper method to parse Y/N out of an attribute
         * @method gls-comms.GamePlayDataXMLParser#extractBoolAttribute
         * @private
         * @param {string} attributeName Name of attribute to check
         * @param {NamedNodeMap} payAttributes Full list of attributes
         * @returns {boolean} True if attribute found and value is "Y", false if not found or value is not "Y"
         */
        GamePlayDataXMLParser.extractBoolAttribute = function (attributeName, payAttributes) {
            var value = false;
            var valueAttr = payAttributes.getNamedItem(attributeName);
            if (valueAttr != null) {
                value = (valueAttr.value == "Y");
            }
            return value;
        };
        return GamePlayDataXMLParser;
    })();
    exports.GamePlayDataXMLParser = GamePlayDataXMLParser;
    /**
     * @class gls-comms.CurrencyFormatXMLParser
     * @classdesc Parse currency format information out of XML
     */
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
    /**
     * Entry point for making HTTP requests to GLS endpoint
     * @class GLSRequestor
     * @classdesc Encapsulating functionality to make GLS requests
     */
    var GLSRequestor = (function () {
        /**
         * @constructor
         */
        function GLSRequestor(metadata, sessionData, glmDescription) {
            /**
             * Message type for Init request/response
             * @member gls-comms.GLSRequestor#MSG_INIT
             * @private
             * @type {string}
             */
            this.MSG_INIT = "Init";
            /**
             * Message type for Play request/response
             * @member gls-comms.GLSRequestor#MSG_PLAY
             * @private
             * @type {string}
             */
            this.MSG_PLAY = "Logic";
            /**
             * Message type for End request/response
             * @member gls-comms.GLSRequestor#MSG_END
             * @private
             * @type {string}
             */
            this.MSG_END = "EndGame";
            this.metadata = metadata;
            this.sessionData = sessionData;
            this.glmDescription = glmDescription;
            this.endPoint = this.metadata.getLogicUrl();
            this.signal = {
                onInitResponse: null,
                onPlayResponse: null,
                onEndResponse: null,
                onError: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
            this.glsServerSessionId = sessionData.getSessionID();
            this.parserFactory = new ResponseXMLParserFactory;
        }
        /**
         * Configure GLSRequestor with platform data
         * @method gls-comms.GLSRequestor#configure
         * @public
         * @param {PlatformInitData} platformInitData Platform data received after initializtaion request
         */
        GLSRequestor.prototype.configure = function (platformInitData) {
            this.platformInitData = platformInitData;
        };
        /**
         * Set a custom response XML parser
         * @method gls-comms.GLSRequestor#setXMLParserFactory
         * @public
         * @param {IResponseXMLParserFactory} factory Custom response XML parser
         */
        GLSRequestor.prototype.setXMLParserFactory = function (factory) {
            this.parserFactory = factory;
        };
        /**
         * Retrieve event dispatcher to add listeners
         * @method gls-comms.GLSRequestor#getEvents
         * @public
         * @returns {events.EventDispatcher<IGLSRequestListener>} GLSRequestor event dispatcher
         */
        GLSRequestor.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Make Init request to GLS endpoint
         * @method gls-comms.GLSRequestor#makeInitRequest
         * @public
         * @param {ICustomGLSPayload[]} requestData Request payload
         */
        GLSRequestor.prototype.makeInitRequest = function (requestData) {
            var _this = this;
            if (requestData === void 0) { requestData = []; }
            var glsHeader = new GLSRequestHeader(this.metadata, this.sessionData, this.glmDescription, this.glsServerSessionId, this.platformInitData);
            var glsPayload = new GLSRequestData(this.MSG_INIT, glsHeader);
            requestData.forEach(function (r) {
                glsPayload.addCustomPayload(r);
            });
            var factory = new httpconnection.HttpConnectionFactory();
            var connection = factory.createConnection(this.endPoint, glsPayload.toXMLString(), 1 /* POST */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.requestObject = response;
                    _this.processInitResponse(url, response.responseText, responseHeaders);
                },
                onFail: function (url, error, status) {
                    _this.processError(url, error, status);
                },
                onProgress: null
            });
            connection.send();
        };
        /**
         * Make Play request to GLS endpoint
         * @method gls-comms.GLSRequestor#makePlayRequest
         * @public
         * @param {ICustomGLSPayload[]} requestData Request payload
         * @param {object} customHeaders contains custom key/value to be send in gls request
         */
        GLSRequestor.prototype.makePlayRequest = function (requestData, customHeaders) {
            var _this = this;
            if (requestData === void 0) { requestData = []; }
            var glsHeader = new GLSRequestHeader(this.metadata, this.sessionData, this.glmDescription, this.glsServerSessionId, this.platformInitData);
            glsHeader.addCustomHeaders(customHeaders);
            var glsPayload = new GLSRequestData(this.MSG_PLAY, glsHeader);
            glsPayload.addCustomPayload(new CurrencyMultiplierPayload(this.platformInitData.getCurrencyMultiplier()));
            requestData.forEach(function (r) {
                glsPayload.addCustomPayload(r);
            });
            var factory = new httpconnection.HttpConnectionFactory();
            var connection = factory.createConnection(this.endPoint, glsPayload.toXMLString(), 1 /* POST */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.requestObject = response;
                    _this.processPlayResponse(url, response.responseText, responseHeaders);
                },
                onFail: function (url, error, status) {
                    _this.processError(url, error, status);
                },
                onProgress: null
            });
            connection.send();
        };
        /**
         * Make Play request to GLS endpoint
         * @method gls-comms.GLSRequestor#makePlayRequest
         * @public
         * @param {ICustomGLSPayload[]} requestData Request payload
         * @param {object} customHeaders contains custom key/value to be send in gls request
         */
        GLSRequestor.prototype.makeEndRequest = function (requestData, customHeaders) {
            var _this = this;
            if (requestData === void 0) { requestData = []; }
            var glsHeader = new GLSRequestHeader(this.metadata, this.sessionData, this.glmDescription, this.glsServerSessionId, this.platformInitData);
            glsHeader.addCustomHeaders(customHeaders);
            var glsPayload = new GLSRequestData(this.MSG_END, glsHeader);
            requestData.forEach(function (r) {
                glsPayload.addCustomPayload(r);
            });
            var factory = new httpconnection.HttpConnectionFactory();
            var connection = factory.createConnection(this.endPoint, glsPayload.toXMLString(), 1 /* POST */);
            connection.getEvents().add({
                onComplete: function (url, response, responseHeaders) {
                    _this.requestObject = response;
                    _this.processEndResponse(url, response.responseText, responseHeaders);
                },
                onFail: function (url, error, status) {
                    _this.processError(url, error, status);
                },
                onProgress: null
            });
            connection.send();
        };
        GLSRequestor.prototype.getRequestObject = function () {
            return this.requestObject;
        };
        /**
         * Process response from Init request
         * @method GLSRequestor#processInitRequest
         * @private
         * @param {string} payload Request payload
         * @param {string} response Response contents
         * @param {string} responseHeaders Response headers
         */
        GLSRequestor.prototype.processInitResponse = function (url, response, responseHeaders) {
            var xmlParser = new DOMParser();
            var xmlDoc = xmlParser.parseFromString(response, "text/xml");
            var msgType = this.extractMessageType(xmlDoc);
            if (msgType == this.MSG_INIT) {
                var parser = this.parserFactory.createInitParser();
                var output = parser.parse(xmlDoc);
                this.glsServerSessionId = output.getPlatformData().getSessionId();
                this.signal.onInitResponse(output);
            }
            else {
                this.processGLSError(url, xmlDoc);
            }
        };
        /**
         * Process response from Play request
         * @method gls-comms.GLSRequestor#processPlayRequest
         * @private
         * @param {string} payload Request payload
         * @param {string} response Response contents
         * @param {string} responseHeaders Response headers
         */
        GLSRequestor.prototype.processPlayResponse = function (url, response, responseHeaders) {
            var xmlParser = new DOMParser();
            var xmlDoc = xmlParser.parseFromString(response, "text/xml");
            var msgType = this.extractMessageType(xmlDoc);
            if (msgType == this.MSG_PLAY) {
                var parser = this.parserFactory.createPlayParser();
                var output = parser.parse(xmlDoc);
                this.glsServerSessionId = output.getPlatformData().getSessionId();
                this.signal.onPlayResponse(output);
            }
            else {
                this.processGLSError(url, xmlDoc);
            }
        };
        /**
         * Process response from Play request
         * @method gls-comms.GLSRequestor#processPlayRequest
         * @private
         * @param {string} payload Request payload
         * @param {string} response Response contents
         * @param {string} responseHeaders Response headers
         */
        GLSRequestor.prototype.processEndResponse = function (url, response, responseHeaders) {
            var xmlParser = new DOMParser();
            var xmlDoc = xmlParser.parseFromString(response, "text/xml");
            var msgType = this.extractMessageType(xmlDoc);
            if (msgType == this.MSG_END) {
                var parser = this.parserFactory.createEndParser();
                var output = parser.parse(xmlDoc);
                this.glsServerSessionId = output.getPlatformData().getSessionId();
                this.signal.onEndResponse(output);
            }
            else {
                this.processGLSError(url, xmlDoc);
            }
        };
        /**
         * Extract message type from reponse XML
         * @method gls-comms.GLSRequestor#extractMessageType
         * @private
         * @param {Document} xml Response XML
         * @returns {string} Message type
         */
        GLSRequestor.prototype.extractMessageType = function (xml) {
            return (xml.getElementsByTagName("GameResponse")[0]).attributes.getNamedItem("type").value;
        };
        /**
         * Process error message in GLS response
         * @method gls-comms.GLSRequestor#processGLSError
         * @private
         * @param {string} url Request URL
         * @param {Document} xml Response XML
         */
        GLSRequestor.prototype.processGLSError = function (url, xml) {
            var parentNode = xml.getElementsByTagName("GameResponse")[0];
            var errorNode = parentNode.firstChild;
            var message = errorNode.attributes.getNamedItem("msg").value;
            var code = parseInt(errorNode.attributes.getNamedItem("instruction").value, 10);
            this.signal.onError(url, message, code);
        };
        /**
         * Process request error
         * @method gls-comms.GLSRequestor#processError
         * @private
         * @param {string} url Request url
         * @param {string} error Error description
         * @param {number} status Error status
         */
        GLSRequestor.prototype.processError = function (url, error, status) {
            this.signal.onError(url, error, status);
        };
        return GLSRequestor;
    })();
    exports.GLSRequestor = GLSRequestor;
    /**
     * @class gls-comms.ReplayRequestPayload
     * @classdesc Payload containing game replay data
     */
    var ReplayRequestPayload = (function () {
        /**
         * @constructor
         */
        function ReplayRequestPayload(state) {
            this.gameState = state;
        }
        /**
         * Convert custom payload data into XML
         * @method gls-comms.ReplayRequestPayload#toXML
         * @returns {Document} XML formatted data
         */
        ReplayRequestPayload.prototype.toXML = function () {
            var xmlDoc = document.implementation.createDocument("", "REPLAY", null);
            var playbackElement = xmlDoc.createElement("Playback");
            var stateAttr = document.createAttribute("state");
            stateAttr.value = this.gameState;
            playbackElement.attributes.setNamedItem(stateAttr);
            xmlDoc.documentElement.appendChild(playbackElement);
            return xmlDoc;
        };
        return ReplayRequestPayload;
    })();
    exports.ReplayRequestPayload = ReplayRequestPayload;
    /**
     * Basic GLS request data structure, with support for adding custom payloads
     * @class gls-comms.GLSRequestData
     * @classdesc GLS request data
     */
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
});
