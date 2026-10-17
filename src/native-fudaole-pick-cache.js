var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var events = __nativeModules['events/events'];
var gamedata = __nativeModules['game-data/game-data'];
var glscomms = __nativeModules['gls-comms/gls-comms'];
var fudaole = {};
var Config = (function () {
            function Config() {
            }
            /**
            * Reference of the CDN_ROOT path
            * @member fudaole.Config#CDN_ROOT
            * @public
            * @type {string}
            */
            Config.CDN_ROOT = "";
            /**
            * Reference of the stage
            * @member fudaole.Config#STAGE
            * @public
            * @type {createjs.Stage}
            */
            Config.STAGE = null;
            /**
             * Canvas default width
             * @member fudaole.Config#SCREEN_WIDTH
             * @public
             * @type {number}
             */
            Config.SCREEN_WIDTH = 1920;
            /**
             * Canvas default height
             * @member fudaole.Config#SCREEN_HEIGHT
             * @public
             * @type {number}
             */
            Config.SCREEN_HEIGHT = 1080;
            /**
             * game orientation
             * @member fudaole.Config#CURRENT_ORIENTATION_MODE
             * @public
             * @type {number}
             * @values 0 - portrait, 1 - landscape
             */
            Config.CURRENT_ORIENTATION_MODE = 1;
            /**
             * asset scalar
             * @member fudaole.Config#SCALAR
             * @public
             * @type {number}
             * @values 1
             */
            Config.SCALAR = 1;
            /**
             * Number of displayed reels
             * @member fudaole.Config#NUMBER_OF_REELS
             * @public
             * @type {number}
             */
            Config.NUMBER_OF_REELS = 5;
            /**
             * Number of visible symbols in the reel
             * @member fudaole.Config#SYMBOLS_IN_REEL
             * @public static
             * @type {number}
             * @default 5
             */
            Config.SYMBOLS_IN_REEL = 5;
            /**
             * Space between reels
             * @member fudaole.Config#REEL_SPACE
             * @public static
             * @type {number}
             * @default 0
             */
            Config.REEL_SPACE = 12;
            /**
             * Constant representing Symbol Size for Base Game
             * @member fi.SlotFactory#SYMBOL_SIZE
             * @public static
             * @type {Array<number>}
             * @default
             */
            Config.SYMBOL_SIZE = [256, 254];
            /**
             * Symbol id for the free spin bonus symbol
             * @member fudaole.Config#FS_BONUS_SYMBOL_ID
             * @public static
             * @type {number}
             * @default 11
             */
            Config.FS_MULTIPLIER_2X_ID = 17;
            Config.FS_MULTIPLIER_3X_ID = 18;
            Config.FS_WILD_ID = 10;
            Config.FS_BONUS_SYMBOL_ID = 11;
            Config.FREEGAME_SCATTER_SYMBOL_ID = 15;
            Config.EXPAND_WILD_TOP_SYMBOL_ID = 19;
            Config.EXPAND_WILD_MIDDLE_SYMBOL_ID = 20;
            Config.EXPAND_WILD_BOTTOM_SYMBOL_ID = 21;
            Config.MYSTERY_SYMBOL_ID = 16;
            Config.RED_ENVELOPE_NINE_FIRST = 11;
            Config.RED_ENVELOPE_NINE = 12;
            Config.RED_ENVELOPE_TEN = 14;
            Config.RED_ENVELOPE_JACK = 13;
            Config.TOTAL_ALL_POSITION = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
            /**
             * GLM properties
             * @member fudaole.Config#GLM_INFO
             * @public
             * @type {IGLMDescription}
             */
            Config.GLM_INFO = {
                id: "20135",
                version: "1_0"
            };
            Config.GAME_VERSION = "1.0.91";
            // public static LANGUAGE_CODES: string[] = ['en_GB'];
            Config.LANGUAGE_CODES = ['en_GB', 'en_US', 'bg_BG', 'ca_ES', 'cs_CZ', 'da_DK', 'de_DE', 'el_GR', 'es_ES', 'et_EE', 'fi_FI', 'fr_FR', 'hr_HR', 'hu_HU', 'it_IT', 'lt_LT', 'lv_LV', 'nl_NL', 'no_NO', 'pl_PL', 'pt_PT', 'ro_RO', 'ru_RU', 'sk_SK', 'sl_SI', 'sv_SE', 'tr_TR', 'fr_CA'];
            Config.DEFAULT_LANGUAGE = Config.LANGUAGE_CODES[0];
            Config.CURRENT_LANGUAGE = Config.LANGUAGE_CODES[0];
            Config.INIT = "init";
            Config.WAGER = "wager";
            Config.OUTCOME = "outcome";
            return Config;
        })();
        fudaole.Config = Config;
var OrientationController = (function () {
            function OrientationController(screenWidth, screenHeight) {
                this.screenWidth = screenWidth;
                this.screenHeight = screenHeight;
                this.signal = {
                    onChange: null
                };
                this.eventDispatcher = new events.EventDispatcher(this.signal);
            }
            /**
             * Gets the event dispatcher
             * @method fudaole.OrientationController#getEvents
             * @public
             * @returns {events.EventDispatcher<IOrientationListener>} OrientationController event dispatcher
             */
            OrientationController.prototype.getEvents = function () {
                return this.eventDispatcher;
            };
            /**
             * set the stage reference
             * @method fudaole.OrientationController#setStage
             * @public
             * @param {createjs.Stage} stg The stage instance
             */
            OrientationController.prototype.setStage = function (stg) {
                this.stage = stg;
            };
            /**
            * Update the canvas size and assets alignment based on the orientation
            * @method fudaole.OrientationController#updateCanvasAndAssets
            * @public
            */
            OrientationController.prototype.updateCanvasAndAssets = function () {
                if (this.stage === undefined)
                    return;
                if (fudaole.Config.CURRENT_ORIENTATION_MODE === 0) {
                    this.stage.canvas.width = this.screenHeight;
                    this.stage.canvas.height = this.screenWidth;
                }
                else {
                    this.stage.canvas.width = this.screenWidth;
                    this.stage.canvas.height = this.screenHeight;
                }
                this.signal.onChange();
            };
            return OrientationController;
        })();
        fudaole.OrientationController = OrientationController;
var LTPaylineSlotResult = (function () {
            /**
             * @constructor
             */
            function LTPaylineSlotResult(id, value, offsets, index) {
                this.awardId = id;
                this.awardValue = value;
                this.reelOffsets = offsets;
                this.isBonusWinPay = false;
                this.isBonusTriggerPay = false;
                this.lineIndex = index;
            }
            /**
             * Retrieve win type
             * @method fudaole.LTPaylineSlotResult#getWinType
             * @public
             * @returns {number} Enumerated win type LINE
             */
            LTPaylineSlotResult.prototype.getWinType = function () {
                return 1 /* LINE */;
            };
            /**
             * Retrieve slot pay id
             * @method fudaole.LTPaylineSlotResult#getId
             * @public
             * @returns {number} Slot pay identifier
             */
            LTPaylineSlotResult.prototype.getId = function () {
                return this.awardId;
            };
            /**
             * Retrieve slot pay award value
             * @method fudaole.LTPaylineSlotResult#getValue
             * @public
             * @returns {number} Slot pay value
             */
            LTPaylineSlotResult.prototype.getValue = function () {
                return this.awardValue;
            };
            /**
             * Retrieve slot pay reel offsets
             * @method fudaole.LTPaylineSlotResult#getOffsets
             * @public
             * @returns {number[]} Slot pay symbol positions
             */
            LTPaylineSlotResult.prototype.getOffsets = function () {
                return this.reelOffsets;
            };
            /**
             * Retrieve flag indicating if this pay holds the bonus win
             * @method fudaole.LTPaylineSlotResult#isBonusPay
             * @public
             * @returns {boolean} True if bonus win, false otherwise
             */
            LTPaylineSlotResult.prototype.isBonusPay = function () {
                return this.isBonusWinPay;
            };
            /**
             * Retrieve flag indicating if this pay holds a bonus trigger pay
             * @method fudaole.LTPaylineSlotResult#isBonusTrigger
             * @public
             * @returns {boolean} True if bonus trigger, false otherwise
             */
            LTPaylineSlotResult.prototype.isBonusTrigger = function () {
                return this.isBonusTriggerPay;
            };
            /**
             * Retrieve the line index.
             * @method fudaole.LTPaylineSlotResult#getLineIndex
             * @public
             * @returns {number} line index.
             */
            LTPaylineSlotResult.prototype.getLineIndex = function () {
                return this.lineIndex;
            };
            return LTPaylineSlotResult;
        })();
        fudaole.LTPaylineSlotResult = LTPaylineSlotResult;
var LTBaseGameSpinData = (function () {
            function LTBaseGameSpinData(reelIndex, totalScatterWin, customfeatureinfo, featureInfo, stakePerLine, stake, gameWinInfo) {
                this.reelIndex = reelIndex;
                this.customfeatureinfo = customfeatureinfo;
                this.featureInfo = featureInfo;
                this.stakePerLine = stakePerLine;
                this.stake = stake;
                this.baseGameData = new gamedata.GamePlayData();
                this.totalScatterWin = totalScatterWin;
                this.gameWinInfo = gameWinInfo;
            }
            LTBaseGameSpinData.prototype.getBaseGameData = function () {
                return this.baseGameData;
            };
            LTBaseGameSpinData.prototype.getTotalScatterWin = function () {
                return this.totalScatterWin;
            };
            LTBaseGameSpinData.prototype.getgameWinInfo = function () {
                return this.gameWinInfo;
            };
            /**
             * storing the Open Bet information
             * @method fudaole.LTBaseGameSpinData#setOpenBetPayLoadInfo
             * @public
             * @param {Object} open bet Payload
             */
            LTBaseGameSpinData.prototype.setOpenBetPayLoadInfo = function (data) {
                this.openBetPayLoad = data;
            };
            /**
             * The Open Bet information
             * @method fudaole.LTBaseGameSpinData#getOpenBetPayLoadInfo
             * @public
             * @returns {glscomms.PlatformPlayData} returning the Open bet data.
             */
            LTBaseGameSpinData.prototype.getOpenBetPayLoadInfo = function () {
                return this.openBetPayLoad;
            };
            return LTBaseGameSpinData;
        })();
        fudaole.LTBaseGameSpinData = LTBaseGameSpinData;
var FUScatterSlotResult = (function () {
            /**
             * @constructor
             */
            function FUScatterSlotResult(id, value, offsets, isBonusWinPay, isTriggerPay) {
                if (isBonusWinPay === void 0) { isBonusWinPay = false; }
                if (isTriggerPay === void 0) { isTriggerPay = false; }
                this.awardId = id;
                this.awardValue = value;
                this.reelOffsets = offsets;
                this.isBonusWinPay = isBonusWinPay;
                this.isBonusTriggerPay = isTriggerPay;
            }
            /**
             * Retrieve win type
             * @method gls-comms.FUScatterSlotResult#getWinType
             * @public
             * @returns {number} Enumerated win type SCATTER
             */
            FUScatterSlotResult.prototype.getWinType = function () {
                return 0 /* SCATTER */;
            };
            /**
             * Retrieve slot pay id
             * @method gls-comms.FUScatterSlotResult#getId
             * @public
             * @returns {number} Slot pay identifier
             */
            FUScatterSlotResult.prototype.getId = function () {
                return this.awardId;
            };
            /**
             * Retrieve slot pay award value
             * @method gls-comms.FUScatterSlotResult#getValue
             * @public
             * @returns {number} Slot pay value
             */
            FUScatterSlotResult.prototype.getValue = function () {
                return this.awardValue;
            };
            /**
             * Retrieve slot pay reel offsets
             * @method gls-comms.FUScatterSlotResult#getOffsets
             * @public
             * @returns {number[]} Slot pay symbol positions
             */
            FUScatterSlotResult.prototype.getOffsets = function () {
                return this.reelOffsets;
            };
            /**
             * Retrieve flag indicating if this pay holds the bonus win
             * @method gls-comms.FUScatterSlotResult#isBonusPay
             * @public
             * @returns {boolean} True if bonus win, false otherwise
             */
            FUScatterSlotResult.prototype.isBonusPay = function () {
                return this.isBonusWinPay;
            };
            /**
             * Retrieve flag indicating if this pay holds a bonus trigger pay
             * @method gls-comms.FUScatterSlotResult#isBonusTrigger
             * @public
             * @returns {boolean} True if bonus trigger, false otherwise
             */
            FUScatterSlotResult.prototype.isBonusTrigger = function () {
                return this.isBonusTriggerPay;
            };
            return FUScatterSlotResult;
        })();
        fudaole.FUScatterSlotResult = FUScatterSlotResult;
var LTOpenBetXMLParser = (function () {
            function LTOpenBetXMLParser() {
            }
            /**
             * Open Bet PayLoads
             * Helper method for parsing Open Bet configuration
             * @method gls-comms.InitResponseXMLParser#populateOpenBetPayLoad
             * @public
             * @param {Node} node XML node containing open bet configuration data
             */
            LTOpenBetXMLParser.populateOpenBetPayLoad = function (node) {
                var openBetPayLoad = [];
                var data = { type: "", CASH: "0", FREEBET: "0", BONUS: "0" };
                for (var i = 0; i < node.childNodes.length; i++) {
                    var payloadItem = node.childNodes[i], requestType = payloadItem.attributes.getNamedItem("request").value, payloadNode = payloadItem.childNodes[0];
                    if (payloadNode != null) {
                        for (var j = 0; j < payloadNode.childNodes.length; j++) {
                            data = this.getOpenBetValueByName(payloadNode.childNodes[j], requestType);
                            if (data) {
                                openBetPayLoad[requestType] = data;
                            }
                        }
                    }
                }
                return openBetPayLoad;
            };
            /**
             * Open Bet PayLoads
             * to get the key values by NAME
             * @method gls-comms.InitResponseXMLParser#getOpenBetValueByName
             * @private
             * @param {mapItem} mapItem the node containing open bet configuration data
             * @param {Node} node XML node containing open bet configuration data
             */
            LTOpenBetXMLParser.getOpenBetValueByName = function (mapItem, requestType) {
                var data = null;
                var isBalancePayload = false;
                for (var i = 0; i < mapItem.childNodes.length; i++) {
                    if (mapItem.childNodes[i].textContent == "OPENBET_CONTAINER_PAYLOAD") {
                        isBalancePayload = true;
                        break;
                    }
                }
                if (isBalancePayload) {
                    for (var i = 0; i < mapItem.childNodes.length; i++) {
                        if (mapItem.childNodes[i].nodeName == "key") {
                        }
                        else if (mapItem.childNodes[i].nodeName == "value") {
                            data = { type: "", CASH: "0", FREEBET: "0", BONUS: "0" };
                            var valuesText = mapItem.childNodes[i].textContent;
                            var values = valuesText.split(";");
                            for (var j = 0; j < values.length; j++) {
                                data.type = requestType;
                                var mapsText = values[j].split("=");
                                switch (mapsText[0]) {
                                    case "CASH":
                                        data.CASH = parseInt(mapsText[1]);
                                        break;
                                    case "FREEBET":
                                        data.FREEBET = parseInt(mapsText[1]);
                                        break;
                                    case "BONUS":
                                        data.BONUS = parseFloat(mapsText[1]);
                                        break;
                                }
                            }
                            break;
                        }
                    }
                }
                return data;
            };
            return LTOpenBetXMLParser;
        })();
        fudaole.LTOpenBetXMLParser = LTOpenBetXMLParser;
var LTGamePlayDataXMLParser = (function () {
            function LTGamePlayDataXMLParser() {
            }
            /**
             * Helper method for parsing game play data
             * @method gls-comms.GamePlayDataXMLParser#populateGameData
             * @public
             * @param {gamedata.GamePlayData} gameData Data structure to populate
             * @param {Node} node XML node containing game play data
             */
            LTGamePlayDataXMLParser.populateGameData = function (gameData, node, isBaseRecovery, isBonusTrigger, isBonusPay, totalFreeSpinsWin) {
                if (isBaseRecovery === void 0) { isBaseRecovery = false; }
                if (isBonusTrigger === void 0) { isBonusTrigger = false; }
                if (isBonusPay === void 0) { isBonusPay = false; }
                if (totalFreeSpinsWin === void 0) { totalFreeSpinsWin = -1; }
                gameData.setTotalWin(parseInt(node.attributes.getNamedItem("totalWin").value, 10));
                gameData.setWager(parseInt(node.attributes.getNamedItem("totalStake").value, 10));
                var reelsNode = node.childNodes;
                for (var i = 0; i < reelsNode.length; ++i) {
                    if (reelsNode[i].nodeName == "ReelResults") {
                        this.populateResults(gameData, reelsNode[i], isBonusTrigger, isBonusPay, totalFreeSpinsWin);
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
            LTGamePlayDataXMLParser.populateResults = function (gameData, node, isBonusTrigger, isBonusPay, totalBonusWin) {
                if (isBonusTrigger === void 0) { isBonusTrigger = false; }
                if (isBonusPay === void 0) { isBonusPay = false; }
                if (totalBonusWin === void 0) { totalBonusWin = -1; }
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
                            this.populateScatterWin(gameData, spinDataSubType, isBonusTrigger, isBonusPay, totalBonusWin);
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
            LTGamePlayDataXMLParser.populatePaylineWin = function (gameData, node) {
                var awardId = parseInt(node.attributes.getNamedItem("awardIndex").value, 10);
                var awardValue = parseInt(node.attributes.getNamedItem("winVal").value, 10);
                var reelOffsets = node.textContent.split("|").map(Number);
                var lineIndex = parseInt(node.attributes.getNamedItem("index").value, 10);
                gameData.addSlotResult(new fudaole.LTPaylineSlotResult(awardId, awardValue, reelOffsets, lineIndex));
            };
            /**
             * Helper method for parsing an anyway win
             * @method gls-comms.GamePlayDataXMLParser#populateAnywayWin
             * @private
             * @param {gamedata.GamePlayData} gameData Data structure to populate
             * @param {Node} node XML node containing an anyway win
             */
            LTGamePlayDataXMLParser.populateAnywayWin = function (gameData, node) {
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
            LTGamePlayDataXMLParser.populateScatterWin = function (gameData, node, isBonusTrigger, isBonusPay, totalBonusWin) {
                if (isBonusTrigger === void 0) { isBonusTrigger = false; }
                if (isBonusPay === void 0) { isBonusPay = false; }
                if (totalBonusWin === void 0) { totalBonusWin = -1; }
                var awardId = parseInt(node.attributes.getNamedItem("awardIndex").value);
                var awardValue = parseInt(node.attributes.getNamedItem("winVal").value);
                var reelOffsets = node.textContent.split("|").map(Number);
                if (isBonusPay)
                    awardValue = totalBonusWin;
                /*    gameData.addSlotResult(
                        new gamedata.ScatterSlotResult(awardId,
                            awardValue,
                            reelOffsets,
                            isBonusPay,
                            isBonusTrigger));*/
                gameData.addSlotResult(new fudaole.FUScatterSlotResult(awardId, awardValue, reelOffsets, isBonusPay, isBonusTrigger));
            };
            /**
             * Helper method to parse Y/N out of an attribute
             * @method gls-comms.GamePlayDataXMLParser#extractBoolAttribute
             * @public
             * @param {string} attributeName Name of attribute to check
             * @param {NamedNodeMap} payAttributes Full list of attributes
             * @returns {boolean} True if attribute found and value is "Y", false if not found or value is not "Y"
             */
            LTGamePlayDataXMLParser.extractBoolAttribute = function (attributeName, payAttributes) {
                var value = false;
                var valueAttr = payAttributes.getNamedItem(attributeName);
                if (valueAttr != null) {
                    value = (valueAttr.value == "Y");
                }
                return value;
            };
            return LTGamePlayDataXMLParser;
        })();
        fudaole.LTGamePlayDataXMLParser = LTGamePlayDataXMLParser;
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
var LTPlayResponseXMLParser = (function () {
            function LTPlayResponseXMLParser() {
            }
            /**
             * Parse XML response for Play request
             * @method fudaole.LTPlayResponseXMLParser#parse
             * @public
             * @param {Document} xml XML Payload
             * @returns {glscomms.PlayResponse} Response data for Play request
             */
            LTPlayResponseXMLParser.prototype.parse = function (xml) {
                var platformData = this.parsePlatformData(xml);
                var balanceData = glscomms.BalanceData.parseXML(xml.getElementsByTagName("Balances")[0]);
                var response = new glscomms.PlayResponse(platformData, balanceData);
                // Parse custom game data
                var resultTag = xml.getElementsByTagName("GameResult")[0];
                var gameData = response.getGameData();
                fudaole.LTGamePlayDataXMLParser.populateGameData(gameData, resultTag);
                var baseGameInfo = xml.getElementsByTagName("GameWinInfo")[0];
                //Maxwin data
                var isMaxWin = fudaole.LTGamePlayDataXMLParser.extractBoolAttribute("isMaxWin", baseGameInfo.attributes);
                var maxWinValue = Number(baseGameInfo.attributes.getNamedItem("maxWinValue").value);
                var currentSpinWin = gameData.getTotalWin();
                var gameWinInfo = this.getGameWinInfo(xml.getElementsByTagName("GameWinInfo")[0]);
                var BGReelData;
                var reelList = xml.getElementsByTagName("ReelSpin")[0];
                var reelDataSource = reelList.attributes;
                var reelData = reelDataSource.getNamedItem("reelsetIndex").value;
                var totalScatterWin = Number(reelDataSource.getNamedItem("totalScatterWin").value);
                var customFeatureInfo;
                var featureInfo;
                //Base game features Triggered
                var mysteryRepSymbol = xml.getElementsByTagName("MysteryRepSymbol");
                if (mysteryRepSymbol.length > 0)
                    customFeatureInfo = this.parseBaseGameFeatureInfo(mysteryRepSymbol[0]);
                //Feature Tag Info
                var featureTag = xml.getElementsByTagName("Feature");
                var isFeatureTriggered = false;
                var totalBonusWin = -1;
                var isBonusPay = false;
                if (featureTag.length > 0) {
                    var featureTagDataSource = featureTag[0].attributes;
                    var featureIndex = featureTagDataSource.getNamedItem("index").value;
                    switch (featureIndex) {
                        case "1":
                            isFeatureTriggered = true;
                            var fgInfo = {
                                featureindex: featureIndex,
                                featurename: featureTagDataSource.getNamedItem("name").value,
                                remainingFreeSpins: '',
                                extraFreeSpinsAwarded: '',
                                totalFreeSpinsPlayed: '',
                                freeSpinTriggerWin: '',
                                lastFreeSpin: '',
                                baseGameReelIndex: ''
                            };
                            var dataNode = featureTag[0].childNodes[0];
                            if (dataNode != undefined) {
                                var dataAttr = dataNode.attributes;
                                fgInfo.remainingFreeSpins = dataAttr.getNamedItem("remainingFreeSpins").value;
                                fgInfo.totalFreeSpinsPlayed = dataAttr.getNamedItem("totalFreeSpinsPlayed").value;
                                fgInfo.freeSpinTriggerWin = dataAttr.getNamedItem("freeSpinTriggerWin").value;
                                if (dataAttr.getNamedItem("lastFreeSpin") != null && dataAttr.getNamedItem("extraFreeSpinsAwarded") != null) {
                                    fgInfo.lastFreeSpin = dataAttr.getNamedItem("lastFreeSpin").value;
                                    fgInfo.extraFreeSpinsAwarded = dataAttr.getNamedItem("extraFreeSpinsAwarded").value;
                                }
                                var baseGameRecovery = xml.getElementsByTagName("BaseGameRecoveryInfo")[0];
                                if (isFeatureTriggered && baseGameRecovery != undefined) {
                                    var reelSpin = xml.getElementsByTagName("ReelSpin")[1];
                                    fgInfo.baseGameReelIndex = reelSpin.attributes.getNamedItem("reelsetIndex").value;
                                }
                            }
                            featureInfo = fgInfo;
                            if (mysteryRepSymbol.length > 1)
                                featureInfo.baseGameFeatureInfo = this.parseBaseGameFeatureInfo(mysteryRepSymbol[1]);
                            break;
                        case "2":
                            {
                                isFeatureTriggered = true;
                                var pickInfo = {
                                    featureindex: featureIndex,
                                    featurename: featureTagDataSource.getNamedItem("name").value,
                                    pickBonusStarted: false,
                                    pickConceaded: [],
                                    currectPick: null,
                                    pickWin: 0,
                                    JkptId: null,
                                    pickEnd: false,
                                    isMaxWin: false,
                                    maxWinValue: 0
                                };
                                var dataNode = featureTag[0].childNodes[0];
                                if (dataNode != undefined) {
                                    var dataAttr = dataNode.attributes;
                                    pickInfo.pickBonusStarted = true;
                                    pickInfo.pickEnd = fudaole.LTGamePlayDataXMLParser.extractBoolAttribute("lastPick", dataAttr);
                                    pickInfo.pickConceaded = dataAttr.getNamedItem("pickConceaded").value.split(",");
                                    pickInfo.currectPick = (pickInfo.pickConceaded[pickInfo.pickConceaded.length - 1].split("|").map(Number));
                                    if (fudaole.LTGamePlayDataXMLParser.extractBoolAttribute("jkptAwarded", dataAttr)) {
                                        pickInfo.pickWin = parseInt(dataAttr.getNamedItem("jkptValue").value);
                                        pickInfo.JkptId = parseInt(dataAttr.getNamedItem("jkptType").value);
                                    }
                                }
                                featureInfo = pickInfo;
                                featureInfo.baseGameFeatureInfo = this.parseBaseGameFeatureInfo(mysteryRepSymbol[0]);
                            }
                            break;
                    }
                }
                BGReelData = new fudaole.LTBaseGameSpinData(reelData, totalScatterWin, customFeatureInfo, featureInfo, 0, gameData.getWager(), gameWinInfo);
                var baseGameRecovery = xml.getElementsByTagName("BaseGameRecoveryInfo")[0];
                if (isFeatureTriggered && baseGameRecovery != undefined) {
                    fudaole.LTGamePlayDataXMLParser.populateGameData(BGReelData.getBaseGameData(), baseGameRecovery.childNodes[0], true, isFeatureTriggered, isBonusPay, totalBonusWin);
                }
                // Open bet data, if available
                var payloadNode = xml.getElementsByTagName("Payload")[0];
                if (payloadNode != null) {
                    var openBetPayLoad = {};
                    openBetPayLoad = fudaole.LTOpenBetXMLParser.populateOpenBetPayLoad(payloadNode);
                    BGReelData.setOpenBetPayLoadInfo(openBetPayLoad);
                }
                response.getGameData().setCustomData(BGReelData);
                return response;
            };
            LTPlayResponseXMLParser.prototype.parseBaseGameFeatureInfo = function (mysteryRepSymbol) {
                var mysteryFeature = {
                    isSymPresent: mysteryRepSymbol.attributes.getNamedItem("isSymPresent").value,
                    replacementSymbolIndex: mysteryRepSymbol.attributes.getNamedItem("replacementSymbolIndex").value,
                    isNudgingWild: mysteryRepSymbol.attributes.getNamedItem("isNudgingWild").value,
                    isRedEnvlpJkpt: mysteryRepSymbol.attributes.getNamedItem("isRedEnvlpJkpt").value,
                    nudgingWildPositions: ''
                };
                if (mysteryRepSymbol.attributes.getNamedItem("nudgingWildPositions") != null)
                    mysteryFeature.nudgingWildPositions = mysteryRepSymbol.attributes.getNamedItem("nudgingWildPositions").value;
                return mysteryFeature;
            };
            /**
             * Parse XML response for Play request
             * @method fudaole.LTPlayResponseXMLParser#parsePlatformData
             * @private
             * @param {Document} xml XML Payload
             * @returns {glscomms.PlatformPlayData} returning the platform data.
             */
            LTPlayResponseXMLParser.prototype.parsePlatformData = function (xml) {
                var data = new glscomms.PlatformPlayData();
                var glsHeader = glscomms.GLSResponseHeader.parseXML(xml.getElementsByTagName("Header")[0]);
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
            /**
             * Check for the attribute and returns value
             * By default it returns blank string, in case return value
             * requested is number and is not available then it returns -1
             * @author Ankit
             */
            LTPlayResponseXMLParser.prototype.getAttributeFromNode = function (dataNode, attribute, returnType) {
                if (returnType === void 0) { returnType = "string"; }
                var attributeValue = "";
                if (returnType == "number")
                    attributeValue = "-1";
                if (dataNode.attributes.getNamedItem(attribute)) {
                    attributeValue = dataNode.attributes.getNamedItem(attribute).value;
                }
                return attributeValue;
            };
            LTPlayResponseXMLParser.prototype.getGameWinInfo = function (dataNode) {
                var gameWinInfo = {
                    totalWagerWin: parseFloat(this.getAttributeFromNode(dataNode, "totalWagerWin", "number")),
                    totalBaseGameWin: parseFloat(this.getAttributeFromNode(dataNode, "totalBaseGameWin", "number")),
                    totalFreeSpinsWin: parseFloat(this.getAttributeFromNode(dataNode, "totalFreeSpinsWin", "number")),
                    totalPickJkptWin: parseFloat(this.getAttributeFromNode(dataNode, "totalPickJkptWin", "number")),
                    maxWinValue: parseFloat(this.getAttributeFromNode(dataNode, "maxWinValue", "number")),
                    isMaxWin: (this.getAttributeFromNode(dataNode, "isMaxWin") == "Y")
                };
                return gameWinInfo;
            };
            return LTPlayResponseXMLParser;
        })();
        fudaole.LTPlayResponseXMLParser = LTPlayResponseXMLParser;
var LTResponseXMLParserFactory = (function (_super) {
            __extends(LTResponseXMLParserFactory, _super);
            function LTResponseXMLParserFactory() {
                _super.apply(this, arguments);
            }
            /**
             * Construct fudaole-specific play response parser
             * @method fudaole.LTResponseXMLParserFactory#createPlayParser
             * @public
             * @returns {glscomms.IResponseXMLParser<glscomms.PlayResponse} Response XML parser
             */
            LTResponseXMLParserFactory.prototype.createInitParser = function () {
                return new fudaole.LTInitResponseXMLParser;
            };
            LTResponseXMLParserFactory.prototype.createPlayParser = function () {
                return new fudaole.LTPlayResponseXMLParser;
            };
            return LTResponseXMLParserFactory;
        })(glscomms.ResponseXMLParserFactory);
        fudaole.LTResponseXMLParserFactory = LTResponseXMLParserFactory;
var LTWagerPayload = (function () {
            /**
             * @constructor
             */
            function LTWagerPayload(totalStake) {
                this.totalStake = totalStake;
            }
            /**
             * Convert custom payload data into XML
             * @method gls-comms.WagerPayload#toXML
             * @returns {Document} XML formatted data
             */
            LTWagerPayload.prototype.toXML = function () {
                var xmlDoc = document.implementation.createDocument("", "WagerInfo", null);
                var totalBetAttr = xmlDoc.createAttribute("totalStake");
                totalBetAttr.value = (this.totalStake).toString();
                xmlDoc.documentElement.attributes.setNamedItem(totalBetAttr);
                return xmlDoc;
            };
            return LTWagerPayload;
        })();
        fudaole.LTWagerPayload = LTWagerPayload;
var LTPickBonusPayload = (function () {
            /**
             * @constructor
             */
            function LTPickBonusPayload(pickIndex) {
                this.pickIndex = pickIndex;
            }
            /**
             * Convert custom payload data into XML
             * @method gls-comms.WagerPayload#toXML
             * @returns {Document} XML formatted data
             */
            LTPickBonusPayload.prototype.toXML = function () {
                var xmlDoc = document.implementation.createDocument("", "PickBonus", null);
                var pickIndexAttr = xmlDoc.createAttribute("pickIndex");
                pickIndexAttr.value = (this.pickIndex).toString();
                xmlDoc.documentElement.attributes.setNamedItem(pickIndexAttr);
                return xmlDoc;
            };
            return LTPickBonusPayload;
        })();
        fudaole.LTPickBonusPayload = LTPickBonusPayload;
var MysteryAnimController = (function () {
            function MysteryAnimController(gameFeature) {
                this.gameFeature = gameFeature;
                this.avoidToRepeat = [];
                this.animLable = ["start", "startCycle", "end"];
                this.replaceSymId = null;
                this.isAnimIn = false;
                this.scalar = this.gameFeature.scalar;
            }
            MysteryAnimController.prototype.triggerMysteryAnim = function () {
                this.createComponent();
                this.ShowAnim();
            };
            MysteryAnimController.prototype.createComponent = function () {
                this.anim = new fudaole.cjsAnim.MysteryStackReveal(); //knife instance create    
                this.anim.visible = false;
                this.anim.stop();
                var posX = 0 * this.scalar;
                var posY = 0 * this.scalar;
                this.anim.setTransform(posX, posY, this.scalar, this.scalar);
                this.hideAnimSymView();
                this.gameFeature.getAnimContainer().addChild(this.anim);
            };
            MysteryAnimController.prototype.hideAnimSymView = function () {
                this.animSymPos = [this.anim.MysterySym_0, this.anim.MysterySym_1, this.anim.MysterySym_2, this.anim.MysterySym_3, this.anim.MysterySym_4, this.anim.MysterySym_5, this.anim.MysterySym_6, this.anim.MysterySym_7, this.anim.MysterySym_8, this.anim.MysterySym_9, this.anim.MysterySym_10, this.anim.MysterySym_11, this.anim.MysterySym_12, this.anim.MysterySym_13, this.anim.MysterySym_14];
                for (var a = 0; a < fudaole.Config.TOTAL_ALL_POSITION.length; a++)
                    this.animSymPos[a].visible = false;
            };
            MysteryAnimController.prototype.ShowAnim = function () {
                this.ticker = createjs.Ticker.addEventListener("tick", this.animTicker.bind(this)); //adding ticker        
                this.anim.visible = true;
                this.symbolReplaceForMystery();
                this.gameFeature.getAudioController().playMysteryRevSnd();
                this.anim.gotoAndPlay("start");
            };
            MysteryAnimController.prototype.symbolReplaceForMystery = function () {
                //  this.replaceSymId = this.gameFeature.getGameData().getCustomData().customfeatureinfo.replacementSymbolIndex;
                this.replaceSymId = this.gameFeature.getLogic().getMysterySymId();
                var allPositions = fudaole.Config.TOTAL_ALL_POSITION;
                for (var i = 0; i < allPositions.length; i++) {
                    var position = allPositions[i];
                    var reelId = position % 5;
                    var floorId = Math.floor(position / 5) + 1;
                    var layout = this.gameFeature.getSlot().getReelGroup().getController(reelId).getLayout();
                    var symbolID = layout.getSymbolId(floorId);
                    if (symbolID === fudaole.Config.MYSTERY_SYMBOL_ID) {
                        if (!this.gameFeature.getLogic().getIsFg() && this.gameFeature.getLogic().getFreeGame() && this.gameFeature.getLogic().getMaxWin()) {
                            layout.setSymbol(floorId, this.replaceSymId, [0, 1, 2, 3, 4]); //to replace symbol    
                        }
                        else {
                            this.animSymPos[position].visible = true; //mystery animate symbol visible   
                            layout.setSymbol(floorId, this.replaceSymId, [0, 1, 2, 3, 4]); //to replace symbol      
                        }
                    }
                }
            };
            MysteryAnimController.prototype.animTicker = function () {
                switch (this.anim.currentLabel) {
                    case this.animLable[1]:
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.animOnComplete();
                        }
                        break;
                    case this.animLable[2]:
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.reset();
                        }
                        break;
                }
            };
            MysteryAnimController.prototype.reset = function () {
                this.avoidToRepeat = [];
                createjs.Ticker.removeEventListener("tick", this.ticker); // removing ticker           
                this.hideAnimSymView();
                this.gameFeature.getAnimContainer().removeChild(this.anim);
                this.anim = null;
                //this.animOnComplete();
            };
            MysteryAnimController.prototype.animOnComplete = function () {
                this.gameFeature.setFeatureState(1 /* MysteryEnd */);
                this.gameFeature.handleFeatureStart();
            };
            return MysteryAnimController;
        })();
        fudaole.MysteryAnimController = MysteryAnimController;
var ExpanWildAnimController = (function () {
            function ExpanWildAnimController(gameFeature) {
                this.gameFeature = gameFeature;
                this.scalar = this.gameFeature.scalar;
                this.avoidToRepeat = [];
                this.animLable = ["start", "end"];
                this.animStartFrom = ["2", "2|7", "12", "7|12"];
                this.startAnimLable = ["singleup", "doubleup", "singledown", "doubledown"];
                this.endAnimLable = ["singleupend", "doubleupend", "singledownend", "doubledownend"];
                this.replaceSymId = null;
                this.selectAnimInx = null;
            }
            ExpanWildAnimController.prototype.triggerExpanWildAnim = function () {
                var wildPos = this.gameFeature.getGameData().getCustomData().customfeatureinfo.nudgingWildPositions;
                switch (wildPos) {
                    case this.animStartFrom[0]:
                        this.selectAnimInx = 0;
                        break;
                    case this.animStartFrom[1]:
                        this.selectAnimInx = 1;
                        break;
                    case this.animStartFrom[2]:
                        this.selectAnimInx = 2;
                        break;
                    case this.animStartFrom[3]:
                        this.selectAnimInx = 3;
                        break;
                }
                this.createComponent();
                this.showAnim();
            };
            ExpanWildAnimController.prototype.createComponent = function () {
                if (this.gameFeature.getGameData().isBonusTriggered())
                    this.anim = new fudaole.cjsAnim.expandingwild; //knife instance create
                else
                    this.anim = new fudaole.cjsAnim.expandingwild2; //knife instance create   
                this.anim.visible = false;
                this.anim.stop();
                var posX = 0 * this.scalar;
                var posY = 0 * this.scalar;
                this.anim.setTransform(posX, posY, this.scalar, this.scalar);
                this.gameFeature.getAnimContainer().addChild(this.anim);
            };
            ExpanWildAnimController.prototype.showAnim = function () {
                this.ticker = createjs.Ticker.addEventListener("tick", this.animTicker.bind(this)); //adding ticker        
                this.anim.visible = true;
                // this.symbolReplaceForMystery();    
                this.gameFeature.getAudioController().playExpandWildSnd();
                this.anim.gotoAndPlay(this.startAnimLable[this.selectAnimInx]);
            };
            ExpanWildAnimController.prototype.animTicker = function () {
                switch (this.anim.currentLabel) {
                    case this.endAnimLable[this.selectAnimInx]:
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.gameFeature.getAudioController().playExpandWildFadeOutSnd();
                            this.symbolReplaceForMystery();
                            this.reset();
                        }
                        break;
                }
            };
            ExpanWildAnimController.prototype.symbolReplaceForMystery = function () {
                this.replaceSymId = this.gameFeature.getGameData().getCustomData().customfeatureinfo.replacementSymbolIndex;
                var allPositions = fudaole.Config.TOTAL_ALL_POSITION;
                for (var i = 0; i < allPositions.length; i++) {
                    var position = allPositions[i];
                    var reelId = position % 5;
                    var floorId = Math.floor(position / 5) + 1;
                    var layout = this.gameFeature.getSlot().getReelGroup().getController(reelId).getLayout();
                    var symbolID = layout.getSymbolId(floorId);
                    if (reelId === 2) {
                        switch (floorId) {
                            case 1:
                                layout.setSymbol(floorId, fudaole.Config.EXPAND_WILD_TOP_SYMBOL_ID, [0, 1, 2, 3, 4]); //to replace symbol    
                                break;
                            case 2:
                                layout.setSymbol(floorId, fudaole.Config.EXPAND_WILD_MIDDLE_SYMBOL_ID, [0, 1, 2, 3, 4]); //to replace symbol    
                                break;
                            case 3:
                                layout.setSymbol(floorId, fudaole.Config.EXPAND_WILD_BOTTOM_SYMBOL_ID, [0, 1, 2, 3, 4]); //to replace symbol    
                                break;
                        }
                    }
                }
            };
            ExpanWildAnimController.prototype.reset = function () {
                this.avoidToRepeat = [];
                createjs.Ticker.removeEventListener("tick", this.ticker); // removing ticker   
                this.gameFeature.getAnimContainer().removeChild(this.anim);
                this.anim = null;
                this.animOnComplete();
            };
            ExpanWildAnimController.prototype.animOnComplete = function () {
                if (this.gameFeature.getLogic().getMysteryTrigger())
                    var featureState = 0 /* MysteryStart */;
                else
                    var featureState = 3 /* ExpandWildEnd */;
                this.gameFeature.setFeatureState(featureState);
                this.gameFeature.handleFeatureStart();
            };
            return ExpanWildAnimController;
        })();
        fudaole.ExpanWildAnimController = ExpanWildAnimController;
var RedEnvAnimController = (function () {
            function RedEnvAnimController(gameFeature) {
                this.gameFeature = gameFeature;
                this.currencyFormatter = gameFeature.currencyFormatter;
                this.audioController = gameFeature.audioController;
                this.avoidToRepeat = [];
                this.animLable = ["start", "End"];
                this.isAnimIn = false;
                this.scalar = this.gameFeature.scalar;
            }
            RedEnvAnimController.prototype.triggerRedEnvAnim = function () {
                this.createComponent();
                this.showAnim();
            };
            RedEnvAnimController.prototype.createComponent = function () {
                this.anim = new fudaole.cjsAnim.RedEnvelopeAnim(); //knife instance create   
                this.anim.visible = false;
                this.anim.stop();
                var posX = 0 * this.scalar;
                var posY = 0 * this.scalar;
                this.anim.setTransform(posX, posY, this.scalar, this.scalar);
                this.hideAnimSymbols();
                this.gameFeature.getAnimContainer().addChild(this.anim);
            };
            RedEnvAnimController.prototype.hideAnimSymbols = function () {
                this.leftNine = [[this.anim.REanim_L_0_nine, this.anim.REanim_L_0_nine_1, this.anim.REanim_L_0_nine_2], [this.anim.REanim_L_1_nine, this.anim.REanim_L_1_nine_1, this.anim.REanim_L_1_nine_2], [this.anim.REanim_L_2_nine, this.anim.REanim_L_2_nine_1, this.anim.REanim_L_2_nine_2]];
                this.rightNine = [[this.anim.REanim_R_0_nine, this.anim.REanim_R_0_nine_1, this.anim.REanim_R_0_nine_2], [this.anim.REanim_R_1_nine, this.anim.REanim_R_1_nine_1, this.anim.REanim_R_1_nine_2], [this.anim.REanim_R_2_nine, this.anim.REanim_R_2_nine_1, this.anim.REanim_R_2_nine_2]];
                this.rightJack = [[this.anim.REanim_R_0_jack, this.anim.REanim_R_0_jack_1, this.anim.REanim_R_0_jack_2], [this.anim.REanim_R_1_jack, this.anim.REanim_R_1_jack_1, this.anim.REanim_R_1_jack_2], [this.anim.REanim_R_2_jack, this.anim.REanim_R_2_jack_1, this.anim.REanim_R_2_jack_2]];
                this.rightTen = [[this.anim.REanim_R_0_ten, this.anim.REanim_R_0_ten_1, this.anim.REanim_R_0_ten_2], [this.anim.REanim_R_1_ten, this.anim.REanim_R_1_ten_1, this.anim.REanim_R_1_ten_2], [this.anim.REanim_R_2_ten, this.anim.REanim_R_2_ten_1, this.anim.REanim_R_2_ten_2]];
                for (var a = 0; a < 3; a++) {
                    for (var b = 0; b < 3; b++) {
                        this.leftNine[a][b].visible = false;
                        this.rightNine[a][b].visible = false;
                        this.rightTen[a][b].visible = false;
                        this.rightJack[a][b].visible = false;
                    }
                }
            };
            RedEnvAnimController.prototype.enableSymbolsAnim = function () {
                var allPositions = fudaole.Config.TOTAL_ALL_POSITION;
                for (var i = 0; i < allPositions.length; i++) {
                    var position = allPositions[i];
                    var reelId = position % 5;
                    var floorId = Math.floor(position / 5) + 1;
                    var layout = this.gameFeature.getSlot().getReelGroup().getController(reelId).getLayout();
                    var symbolID = layout.getSymbolId(floorId);
                    switch (reelId) {
                        case 0:
                            if (symbolID === fudaole.Config.RED_ENVELOPE_NINE_FIRST) {
                                for (var a = 0; a < this.leftNine[floorId - 1].length; a++)
                                    this.leftNine[floorId - 1][a].visible = true;
                            }
                            break;
                        case 4:
                            switch (symbolID) {
                                case fudaole.Config.RED_ENVELOPE_NINE:
                                    for (var a = 0; a < this.rightNine[floorId - 1].length; a++)
                                        this.rightNine[floorId - 1][a].visible = true;
                                    break;
                                case fudaole.Config.RED_ENVELOPE_TEN:
                                    for (var a = 0; a < this.rightTen[floorId - 1].length; a++)
                                        this.rightTen[floorId - 1][a].visible = true;
                                    break;
                                case fudaole.Config.RED_ENVELOPE_JACK:
                                    for (var a = 0; a < this.rightJack[floorId - 1].length; a++)
                                        this.rightJack[floorId - 1][a].visible = true;
                                    break;
                            }
                            break;
                    }
                }
            };
            RedEnvAnimController.prototype.showAnim = function () {
                this.ticker = createjs.Ticker.addEventListener("tick", this.animTicker.bind(this)); //adding ticker 
                this.valueToBanner();
                this.enableSymbolsAnim();
                this.anim.visible = true;
                this.audioController.playRedEnvAnimSnd();
                this.anim.gotoAndPlay("start");
            };
            RedEnvAnimController.prototype.valueToBanner = function () {
                var txt = [this.gameFeature.getTranslator().findByKey("com.fudaole.congratulations"), this.gameFeature.getTranslator().findByKey("com.fudaole.youWon"), this.currencyFormatter.format(this.gameFeature.getLogic().getRedEnvValues()[this.gameFeature.getLogic().uiController.betController.getCurrentBetIndex()])];
                fudaole.cjsAnim.updateRedEnvVal(txt, this.gameFeature.baseBundle.myriadProBold.getFontName());
                this.gameFeature.getLogic().uiController.redEnvUpdate(true); //winnet text show in top meter 
            };
            RedEnvAnimController.prototype.animTicker = function () {
                switch (this.anim.currentLabel) {
                    case this.animLable[1]:
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.audioController.playRedEnvAnimFadeOutSnd();
                            this.reset();
                            this.gameFeature.getLogic().uiController.redEnvUpdate(false); //winnet text hide and value show in top meter 
                        }
                        break;
                }
            };
            RedEnvAnimController.prototype.reset = function () {
                this.avoidToRepeat = [];
                createjs.Ticker.removeEventListener("tick", this.ticker); // removing ticker   
                this.gameFeature.getAnimContainer().removeChild(this.anim);
                this.anim = null;
                this.animOnComplete();
            };
            RedEnvAnimController.prototype.animOnComplete = function () {
                var featureState = null;
                if (this.gameFeature.getLogic().getExpandWildTrigger() && this.gameFeature.getLogic().getMysteryTrigger() && featureState === null)
                    featureState = 2 /* ExpandWildStart */;
                if (this.gameFeature.getLogic().getExpandWildTrigger() && featureState === null)
                    featureState = 2 /* ExpandWildStart */;
                if (this.gameFeature.getLogic().getMysteryTrigger() && featureState === null)
                    featureState = 0 /* MysteryStart */;
                if (featureState === null)
                    featureState = 5 /* RedEnvEnd */;
                this.gameFeature.setFeatureState(featureState);
                this.gameFeature.handleFeatureStart();
            };
            return RedEnvAnimController;
        })();
        fudaole.RedEnvAnimController = RedEnvAnimController;
var ReTriggerAnimController = (function () {
            function ReTriggerAnimController(gameFeature) {
                this.gameFeature = gameFeature;
                this.currencyFormatter = gameFeature.currencyFormatter;
                this.translator = gameFeature.translator;
                this.audioController = gameFeature.audioController;
                this.baseBundle = gameFeature.baseBundle;
                this.findPos = [];
                this.avoidToRepeat = [];
                this.animLable = ["start", "end"];
                this.animStartFrom = ["0", "0,1", "2", "1,2", "0,1,2"];
                this.startAnimLable = ["singleup", "doubleup", "singledown", "doubledown", "all3"];
                this.endAnimLable = ["singleupend", "doubleupend", "singledownend", "doubledownend", "all3end"];
                this.replaceSymId = null;
                this.selectAnimInx = null;
                this.scalar = this.gameFeature.scalar;
            }
            ReTriggerAnimController.prototype.reTriggerAnimCall = function () {
                this.findAnimPosition();
                this.createComponent();
                this.ShowAnim();
            };
            ReTriggerAnimController.prototype.findAnimPosition = function () {
                var allPositions = fudaole.Config.TOTAL_ALL_POSITION;
                for (var i = 0; i < allPositions.length; i++) {
                    var position = allPositions[i];
                    var reelId = position % 5;
                    var floorId = Math.floor(position / 5) + 1;
                    var layout = this.gameFeature.getSlot().getReelGroup().getController(reelId).getLayout();
                    var symbolID = layout.getSymbolId(floorId);
                    if (reelId === 4) {
                        if (symbolID === fudaole.Config.FREEGAME_SCATTER_SYMBOL_ID) {
                            switch (floorId) {
                                case 1:
                                    this.findPos.push(0);
                                    break;
                                case 2:
                                    this.findPos.push(1);
                                    break;
                                case 3:
                                    this.findPos.push(2);
                                    break;
                            }
                        }
                    }
                }
                switch (this.findPos.toString()) {
                    case this.animStartFrom[0]:
                        this.selectAnimInx = 0;
                        break;
                    case this.animStartFrom[1]:
                        this.selectAnimInx = 1;
                        break;
                    case this.animStartFrom[2]:
                        this.selectAnimInx = 2;
                        break;
                    case this.animStartFrom[3]:
                        this.selectAnimInx = 3;
                        break;
                    case this.animStartFrom[4]:
                        this.selectAnimInx = 4;
                        break;
                }
            };
            ReTriggerAnimController.prototype.createComponent = function () {
                this.anim = new fudaole.cjsAnim.retrigger(); //knife instance create    
                this.anim.visible = false;
                this.anim.stop();
                var posX = 0 * this.scalar;
                var posY = 0 * this.scalar;
                this.anim.setTransform(posX, posY, this.scalar, this.scalar);
                this.gameFeature.getAnimContainer().addChild(this.anim);
            };
            ReTriggerAnimController.prototype.ShowAnim = function () {
                this.ticker = createjs.Ticker.addEventListener("tick", this.animTicker.bind(this)); //adding ticker
                this.updateRetriggerTxt();
                this.anim.visible = true;
                //this.gameFeature.getAudioController().playFgRetriggerSnd();
                this.anim.gotoAndPlay(this.startAnimLable[this.selectAnimInx]);
                //    this.gameFeature.getLogic().uiController.freeSpin.reTriggerEndFsRem();//free game remaining text update                    
            };
            ReTriggerAnimController.prototype.updateRetriggerTxt = function () {
                var fgAwardTxt = [(this.translator.findByKey("com.fudaole.additonalfreegames")).replace("{0}", "+1"), (this.translator.findByKey("com.fudaole.additonalfreegames")).replace("{0}", "+1"), (this.translator.findByKey("com.fudaole.additonalfreegames")).replace("{0}", "+2"), (this.translator.findByKey("com.fudaole.additonalfreegames")).replace("{0}", "+2"), (this.translator.findByKey("com.fudaole.additonalfreegames")).replace("{0}", "+3")];
                fudaole.cjsAnim.updatefgAwardTxt(fgAwardTxt, this.baseBundle.myriadProBold.getFontName());
            };
            ReTriggerAnimController.prototype.animTicker = function () {
                switch (this.anim.currentLabel) {
                    case "singleup_gong_1":
                    case "doubleup_gong_1":
                    case "singledown_gong_1":
                    case "doubledown_gong_1":
                    case "all3_gong_1":
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.audioController.playfgRetriggerGongSnd();
                        }
                        break;
                    case "doubleup_gong_2":
                    case "doubledown_gong_2":
                    case "all3_gong_2":
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.audioController.playfgRetriggerGongSnd1();
                        }
                        break;
                    case "all3_gong_3":
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.audioController.playfgRetriggerGongSnd2();
                        }
                        break;
                    case "singleup_rack":
                    case "doubleup_rack":
                    case "singledown_rack":
                    case "doubledown_rack":
                    case "all3_rack":
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.audioController.playfgRetriggerRackSnd();
                        }
                        break;
                    case this.endAnimLable[this.selectAnimInx]:
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.gameFeature.getAudioController().playFgRetriggerContSnd();
                            this.gameFeature.getLogic().uiController.freeSpin.reTriggerEndFsRem(); //free game remaining text update                    
                            this.reset();
                        }
                }
            };
            ReTriggerAnimController.prototype.reset = function () {
                this.avoidToRepeat = [];
                createjs.Ticker.removeEventListener("tick", this.ticker); // removing ticker   
                this.gameFeature.getAnimContainer().removeChild(this.anim);
                this.anim = null;
                this.animOnComplete();
            };
            ReTriggerAnimController.prototype.animOnComplete = function () {
                this.findPos = [];
                this.gameFeature.getLogic().setGameState(10 /* ReTriggerEnd */);
                this.gameFeature.getLogic().handleSpinComplete();
                //  this.gameFeature.setFeatureState(FeatureState.MysteryEnd);    
                //  this.gameFeature.handleFeatureStart(); 
            };
            return ReTriggerAnimController;
        })();
        fudaole.ReTriggerAnimController = ReTriggerAnimController;
var MaxWinAnimController = (function () {
            function MaxWinAnimController(gameFeature) {
                this.gameFeature = gameFeature;
                this.currencyFormatter = gameFeature.currencyFormatter;
                this.audioController = gameFeature.audioController;
                this.avoidToRepeat = [];
                this.animLable = ["start", "end"];
                this.scalar = this.gameFeature.scalar;
                this.maxWinValue = 0;
            }
            MaxWinAnimController.prototype.triggerMaxWinAnim = function () {
                this.createComponent();
                this.showAnim();
            };
            MaxWinAnimController.prototype.setMaxWinValue = function (val) {
                this.maxWinValue = val;
            };
            MaxWinAnimController.prototype.createComponent = function () {
                this.anim = new fudaole.cjsAnim.maxwin(); //knife instance create    
                this.anim.visible = false;
                this.anim.stop();
                var posX = 0 * this.scalar;
                var posY = 0 * this.scalar;
                this.anim.setTransform(posX, posY, this.scalar, this.scalar);
                this.gameFeature.getAnimContainer().addChild(this.anim);
            };
            MaxWinAnimController.prototype.showAnim = function () {
                this.ticker = createjs.Ticker.addEventListener("tick", this.animTicker.bind(this)); //adding ticker 
                this.valueToBanner();
                this.anim.visible = true;
                this.anim.gotoAndPlay("start");
            };
            MaxWinAnimController.prototype.valueToBanner = function () {
                var txt = [this.gameFeature.getTranslator().findByKey("com.fudaole.maxWin"), this.currencyFormatter.format(this.maxWinValue), this.gameFeature.getTranslator().findByKey("com.fudaole.achieved")];
                fudaole.cjsAnim.updateMaxWinTxt(txt, this.gameFeature.baseBundle.myriadProBold.getFontName());
            };
            MaxWinAnimController.prototype.animTicker = function () {
                switch (this.anim.currentLabel) {
                    case this.animLable[1]:
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.reset();
                        }
                        break;
                }
            };
            MaxWinAnimController.prototype.reset = function () {
                this.avoidToRepeat = [];
                createjs.Ticker.removeEventListener("tick", this.ticker); // removing ticker   
                this.gameFeature.getAnimContainer().removeChild(this.anim);
                this.anim = null;
                this.animOnComplete();
            };
            MaxWinAnimController.prototype.animOnComplete = function () {
                if (this.gameFeature.getLogic().getFreeGame()) {
                    this.gameFeature.getLogic().uiController.freeSpin.outroStart();
                }
                // this.gameFeature.getLogic().setGameState(GamePlayState.MaxWin);
                // this.gameFeature.getLogic().handleSpinComplete();   
            };
            return MaxWinAnimController;
        })();
        fudaole.MaxWinAnimController = MaxWinAnimController;
var AntiAnimController = (function () {
            function AntiAnimController(gameFeature) {
                this.gameFeature = gameFeature;
                this.avoidToRepeat = [];
                this.animLable = ["antStart", "antStop", "antEnd"];
                this.replaceSymId = null;
                this.isAnimIn = false;
                this.scalar = this.gameFeature.scalar;
            }
            AntiAnimController.prototype.triggerAnticipateAnim = function (featureAnimContainer) {
                this.animContainer = featureAnimContainer;
                this.createComponent();
                this.ShowAnim();
            };
            AntiAnimController.prototype.createComponent = function () {
                this.anim = new fudaole.cjsAnim.fgantic();
                this.anim.visible = false;
                this.anim.stop();
                var posX = 0 * this.scalar;
                var posY = 0 * this.scalar;
                this.anim.setTransform(posX, posY, this.scalar, this.scalar);
                this.animContainer.addChild(this.anim);
            };
            AntiAnimController.prototype.ShowAnim = function () {
                this.ticker = createjs.Ticker.addEventListener("tick", this.animTicker.bind(this)); //adding ticker        
                this.anim.visible = true;
                // this.gameFeature.getAudioController().playMysteryRevSnd();
                this.anim.gotoAndPlay("antStart");
            };
            AntiAnimController.prototype.animTicker = function () {
                switch (this.anim.currentLabel) {
                    case this.animLable[2]:
                        if (this.avoidToRepeat.indexOf(this.anim.currentLabel) == -1) {
                            this.avoidToRepeat.push(this.anim.currentLabel);
                            this.reset();
                        }
                        break;
                }
            };
            AntiAnimController.prototype.reset = function () {
                this.avoidToRepeat = [];
                createjs.Ticker.removeEventListener("tick", this.ticker); // removing ticker        
                this.animContainer.removeChild(this.anim);
                this.anim = null;
            };
            return AntiAnimController;
        })();
        fudaole.AntiAnimController = AntiAnimController;
var GameFeature = (function () {
            function GameFeature(translator, currencyFormatter, audioController, baseBundle, orientationController, scalar, createjs_stage) {
                this.scalar = scalar;
                this.translator = translator;
                this.currencyFormatter = currencyFormatter;
                this.audioController = audioController;
                this.orientationController = orientationController;
                this.baseBundle = baseBundle;
                this.gameData = null;
                this.slot = null;
                this.isMystery = false;
                this.triggerFeature = false;
                this.createjs_stage = createjs_stage;
                this.featureState = null;
                this.mysteryController = new fudaole.MysteryAnimController(this);
                this.expandWildController = new fudaole.ExpanWildAnimController(this);
                this.redEnvController = new fudaole.RedEnvAnimController(this);
                this.reTriggerController = new fudaole.ReTriggerAnimController(this);
                this.maxWinController = new fudaole.MaxWinAnimController(this);
                this.anticipateController = new fudaole.AntiAnimController(this);
            }
            GameFeature.prototype.handleTriggeredFeature = function () {
                var currentState = null;
                if (this.logic.getRedEnvTrigger() && this.logic.getExpandWildTrigger() && this.logic.getMysteryTrigger() && currentState === null)
                    currentState = 8 /* RedAndMysteryAndExpandStart */;
                if (this.logic.getRedEnvTrigger() && this.logic.getExpandWildTrigger() && currentState === null)
                    currentState = 9 /* RedAndExpandStart */;
                if (this.logic.getRedEnvTrigger() && this.logic.getMysteryTrigger() && currentState === null)
                    currentState = 7 /* RedAndMysteryStart */;
                if (this.logic.getMysteryTrigger() && this.logic.getExpandWildTrigger() && currentState === null)
                    currentState = 6 /* MysteryAndExpandWildStart */;
                if (this.logic.getMysteryTrigger() && currentState === null)
                    currentState = 0 /* MysteryStart */;
                if (this.logic.getExpandWildTrigger() && currentState === null)
                    currentState = 2 /* ExpandWildStart */;
                if (this.logic.getRedEnvTrigger() && currentState === null)
                    currentState = 4 /* RedEnvStart */;
                this.setFeatureState(currentState);
                this.handleFeatureStart();
            };
            GameFeature.prototype.handleFeatureStart = function () {
                switch (this.featureState) {
                    case 0 /* MysteryStart */:
                        this.mysteryController.triggerMysteryAnim();
                        break;
                    case 2 /* ExpandWildStart */:
                    case 6 /* MysteryAndExpandWildStart */:
                        this.expandWildController.triggerExpanWildAnim();
                        break;
                    case 4 /* RedEnvStart */:
                        this.getLogic().uiController.stopAutoPlay();
                        this.redEnvController.triggerRedEnvAnim();
                        break;
                    case 7 /* RedAndMysteryStart */:
                    case 9 /* RedAndExpandStart */:
                    case 8 /* RedAndMysteryAndExpandStart */:
                        this.getLogic().uiController.stopAutoPlay();
                        this.redEnvController.triggerRedEnvAnim();
                        break;
                    case 1 /* MysteryEnd */:
                    case 3 /* ExpandWildEnd */:
                    case 5 /* RedEnvEnd */:
                        this.triggerFeature = false;
                        if (this.logic.getIsFg())
                            this.getLogic().setGameState(8 /* FreeGameMysteryEnd */);
                        else
                            this.getLogic().setGameState(0 /* BaseGameSpin */);
                        this.getLogic().handleSpinComplete();
                        break;
                    default:
                        break;
                }
            };
            GameFeature.prototype.setFeatureState = function (set) {
                this.featureState = set;
            };
            GameFeature.prototype.getAllRef = function (gameData, slot, logic) {
                this.gameData = gameData;
                this.slot = slot;
                this.logic = logic;
            };
            GameFeature.prototype.getSlot = function () {
                return this.slot;
            };
            GameFeature.prototype.getGameData = function () {
                return this.gameData;
            };
            GameFeature.prototype.getLogic = function () {
                return this.logic;
            };
            GameFeature.prototype.getAnimContainer = function () {
                return this.slot.getFeatureAnimContainer();
            };
            GameFeature.prototype.getStage = function () {
                return this.createjs_stage;
            };
            GameFeature.prototype.getTranslator = function () {
                return this.translator;
            };
            GameFeature.prototype.getReTriggerController = function () {
                return this.reTriggerController;
            };
            GameFeature.prototype.getExpandWildController = function () {
                return this.expandWildController;
            };
            GameFeature.prototype.getMaxWinController = function () {
                return this.maxWinController;
            };
            GameFeature.prototype.getMysteryController = function () {
                return this.mysteryController;
            };
            GameFeature.prototype.getAudioController = function () {
                return this.audioController;
            };
            GameFeature.prototype.getAntiController = function () {
                return this.anticipateController;
            };
            return GameFeature;
        })();
        fudaole.GameFeature = GameFeature;
var Utils = {};
Utils.createContainer = function (parent, name, positions) {
                if (positions === void 0) { positions = [0, 0]; }
                var cont = new createjs.Container();
                cont.name = name;
                cont.setTransform(positions[0], positions[1]);
                if (positions[2] != undefined) {
                    cont.scaleX = cont.scaleY = positions[2];
                }
                if (parent != null) {
                    parent.addChild(cont);
                }
                return cont;
            };
fudaole.Utils = Utils;
fudaole.selectExpandingPresentationFromOwnSource = function () {
                var wildPos = this.gameFeature.getGameData().getCustomData().customfeatureinfo.nudgingWildPositions;
                switch (wildPos) {
                    case this.animStartFrom[0]:
                        this.selectAnimInx = 0;
                        break;
                    case this.animStartFrom[1]:
                        this.selectAnimInx = 1;
                        break;
                    case this.animStartFrom[2]:
                        this.selectAnimInx = 2;
                        break;
                    case this.animStartFrom[3]:
                        this.selectAnimInx = 3;
                        break;
                }
                
};
var fudaole;
(function (fudaole){
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
})(fudaole || (fudaole = {}));

(function(fudaole) {
fudaole.PickBonusLS = {};
        var p; // shortcut to reference prototypes
        fudaole.PickBonusLS.img = {};
        var btn0 = 0;
        var btn1 = 1;
        var btn2 = 2;
        var btn3 = 3;
        var pickBtns = [];
        var miniRev = [];
        var minorRev = [];
        var majorRev = [];
        var maxiRev = [];
        var miniSmallRev = [];
        var minorSmallRev = [];
        var majorSmallRev = [];
        var maxiSmallRev = [];
        var winnerTxt;
        var winnerValue;
        var introTxt;
        var introValue;
        var miniValue;
        var minorValue;
        var majorValue;
        var maxiValue;
        var countMini = 0;
        var countMinor = 0;
        var countMajor = 0;
        var countMaxi = 0;
        var listener;
        var winnerMCs = [];
        var winlistener;
        var winnerMC;
        var glowAnim = [];
        var winnerTableTxt;
        var endOutro;
        var winValue;
        var winTxt;
        var antiAnim = [];
        var index = 0;
        // PickBonusLSrary properties:
        fudaole.PickBonusLS.init = function () {
            var manifest = [
                { src: "pickbonus/images/anticipationglow2.png", id: "anticipationglow2" },
                { src: "pickbonus/images/bottomknot.png", id: "bottomknot" },
                { src: "pickbonus/images/box.png", id: "box" },
                { src: "pickbonus/images/boxglow.png", id: "boxglow" },
                { src: "pickbonus/images/coinglow.png", id: "coinglow" },
                { src: "pickbonus/images/coinpick.png", id: "coinpick" },
                { src: "pickbonus/images/gamelogo.png", id: "gamelogo" },
                { src: "pickbonus/images/hangingboard.png", id: "hangingboard" },
                { src: "pickbonus/images/majormeter.png", id: "majormeter" },
                { src: "pickbonus/images/maximeter.png", id: "maximeter" },
                { src: "pickbonus/images/minimeter.png", id: "minimeter" },
                { src: "pickbonus/images/minormeter.png", id: "minormeter" },
                { src: "pickbonus/images/pick_00000.png", id: "pick_00000" },
                { src: "pickbonus/images/pick_00001.png", id: "pick_00001" },
                { src: "pickbonus/images/pick_00002.png", id: "pick_00002" },
                { src: "pickbonus/images/pick_00003.png", id: "pick_00003" },
                { src: "pickbonus/images/pick_00004.png", id: "pick_00004" },
                { src: "pickbonus/images/pick_00005.png", id: "pick_00005" },
                { src: "pickbonus/images/pick_00006.png", id: "pick_00006" },
                { src: "pickbonus/images/pick_00007.png", id: "pick_00007" },
                { src: "pickbonus/images/pick_00008.png", id: "pick_00008" },
                { src: "pickbonus/images/pick_00009.png", id: "pick_00009" },
                { src: "pickbonus/images/pick_00010.png", id: "pick_00010" },
                { src: "pickbonus/images/pick_00011.png", id: "pick_00011" },
                { src: "pickbonus/images/pick_00012.png", id: "pick_00012" },
                { src: "pickbonus/images/pick_00013.png", id: "pick_00013" },
                { src: "pickbonus/images/pick_00014.png", id: "pick_00014" },
                { src: "pickbonus/images/pick_00015.png", id: "pick_00015" },
                { src: "pickbonus/images/pick_00016.png", id: "pick_00016" },
                { src: "pickbonus/images/pick_00017.png", id: "pick_00017" },
                { src: "pickbonus/images/pick_00018.png", id: "pick_00018" },
                { src: "pickbonus/images/pick_00019.png", id: "pick_00019" },
                { src: "pickbonus/images/pick_00020.png", id: "pick_00020" },
                { src: "pickbonus/images/pick_00021.png", id: "pick_00021" },
                { src: "pickbonus/images/pick_00022.png", id: "pick_00022" },
                { src: "pickbonus/images/pick_00023.png", id: "pick_00023" },
                { src: "pickbonus/images/pickcircle.png", id: "pickcircle" },
                { src: "pickbonus/images/pickindicator00.png", id: "pickindicator00" },
                { src: "pickbonus/images/pickindicator01.png", id: "pickindicator01" },
                { src: "pickbonus/images/pickindicator02.png", id: "pickindicator02" },
                { src: "pickbonus/images/pickindicator03.png", id: "pickindicator03" },
                { src: "pickbonus/images/pickinfo.png", id: "pickinfo" },
                { src: "pickbonus/images/pickstate01.png", id: "pickstate01" },
                { src: "pickbonus/images/pickstate02.png", id: "pickstate02" },
                { src: "pickbonus/images/pickstate03.png", id: "pickstate03" },
                { src: "pickbonus/images/pickstate04.png", id: "pickstate04" },
                { src: "pickbonus/images/shadow.png", id: "shadow" },
                { src: "pickbonus/images/tassle.png", id: "tassle" },
                { src: "pickbonus/images/threadbounce1.png", id: "threadbounce1" },
                { src: "pickbonus/images/threadbounce2.png", id: "threadbounce2" },
                { src: "pickbonus/images/threadbounce3.png", id: "threadbounce3" },
                { src: "pickbonus/images/upperknot.png", id: "upperknot" },
                { src: "pickbonus/images/winnerbanner.png", id: "winnerbanner" },
                { src: "redEnv/redefx_00001.png", id: "redefx_00001" },
                { src: "redEnv/redefx_00003.png", id: "redefx_00003" },
                { src: "redEnv/redefx_00005.png", id: "redefx_00005" },
                { src: "redEnv/redefx_00007.png", id: "redefx_00007" },
                { src: "redEnv/redefx_00009.png", id: "redefx_00009" },
                { src: "redEnv/redefx_00011.png", id: "redefx_00011" },
                { src: "redEnv/redefx_00013.png", id: "redefx_00013" },
                { src: "redEnv/redefx_00015.png", id: "redefx_00015" },
                { src: "redEnv/redefx_00017.png", id: "redefx_00017" },
                { src: "redEnv/redefx_00019.png", id: "redefx_00019" },
                { src: "redEnv/redefx_00021.png", id: "redefx_00021" },
                { src: "redEnv/redefx_00023.png", id: "redefx_00023" },
                { src: "redEnv/redefx_00025.png", id: "redefx_00025" },
                { src: "redEnv/redefx_00027.png", id: "redefx_00027" },
                { src: "redEnv/redefx_00029.png", id: "redefx_00029" },
                { src: "redEnv/redefx_00031.png", id: "redefx_00031" },
                { src: "redEnv/redefx_00033.png", id: "redefx_00033" },
                { src: "redEnv/redefx_00035.png", id: "redefx_00035" },
                { src: "redEnv/redefx_00037.png", id: "redefx_00037" },
                { src: "redEnv/redefx_00039.png", id: "redefx_00039" },
                { src: "redEnv/redefx_00041.png", id: "redefx_00041" },
                { src: "redEnv/redefx_00043.png", id: "redefx_00043" },
                { src: "redEnv/redefx_00045.png", id: "redefx_00045" },
                { src: "redEnv/redefx_00047.png", id: "redefx_00047" },
                { src: "redEnv/redefx_00049.png", id: "redefx_00049" },
                { src: "redEnv/redefx_00051.png", id: "redefx_00051" },
                { src: "redEnv/redefx_00053.png", id: "redefx_00053" },
                { src: "redEnv/redefx_00055.png", id: "redefx_00055" },
                { src: "redEnv/redefx_00057.png", id: "redefx_00057" },
                { src: "redEnv/redefx_00059.png", id: "redefx_00059" },
            ];
            manifest = this.updateManifest(manifest);
            this.loader = new createjs.LoadQueue(true, fudaole.Config.CDN_ROOT + "content/fudaole/resources/images/");
            this.loader.setMaxConnections(10);
            this.loader.stopOnError = true;
            this.loader.addEventListener("fileload", this.handleFileLoad);
            this.loader.addEventListener("error", this.handleFileError);
            this.loader.loadManifest(manifest);
        };
        fudaole.PickBonusLS.updateManifest = function (manifest) {
            var tempManifest = [];
            for (var i = 0; i < manifest.length; i++) {
                var obj = { src: manifest[i].src, id: manifest[i].id, crossOrigin: true };
                tempManifest.push(obj);
            }
            return tempManifest;
        };
        fudaole.PickBonusLS.handleFileLoad = function (evt) {
            console.log("PickBonusLS:: " + evt.item.id);
            if (evt.item.type == "image") {
                fudaole.PickBonusLS.img[evt.item.id] = evt.result;
            }
        };
        fudaole.PickBonusLS.handleFileError = function (evt) {
            console.log("PickBonusLS failed");
            //evt.target.reset(); to reset the load queue -  to do
        };
        fudaole.PickBonusLS.getQueueLoader = function () {
            return this.loader;
        };
        fudaole.PickBonusLS.getPickBtns = function () {
            return pickBtns;
        };
        fudaole.PickBonusLS.setJackPotValues = function (values, font) {
            miniValue.text = values[3];
            miniValue.font = "40px" + " " + font; //bold 40px Myriad Pro
            minorValue.text = values[2];
            minorValue.font = "45px" + " " + font;
            majorValue.text = values[1];
            majorValue.font = "50px" + " " + font;
            maxiValue.text = values[0];
            maxiValue.font = "55px" + " " + font;
        };
        fudaole.PickBonusLS.reset = function () {
            endOutro = false;
            index = 0;
            fudaole.PickBonusLS.setGlowVisibility(false);
            for (var i = 0; i < 3; i++) {
                miniRev[i].visible = false;
                minorRev[i].visible = false;
                majorRev[i].visible = false;
                maxiRev[i].visible = false;
                miniRev[i].gotoAndStop(0);
                minorRev[i].gotoAndStop(0);
                majorRev[i].gotoAndStop(0);
                maxiRev[i].gotoAndStop(0);
                miniSmallRev[i].visible = false;
                minorSmallRev[i].visible = false;
                majorSmallRev[i].visible = false;
                maxiSmallRev[i].visible = false;
            }
            for (var j = 0; j < pickBtns.length; j++) {
                pickBtns[j].visible = true;
            }
            for (var k = 0; k < winnerMCs.length; k++) {
                winnerMCs[k].visible = false;
                winnerMCs[k].gotoAndStop(0);
                antiAnim[k].visible = false;
            }
            countMini = 0;
            countMinor = 0;
            countMajor = 0;
            countMaxi = 0;
        };
        fudaole.PickBonusLS.setGlowVisibility = function (value) {
            for (var j = 0; j < glowAnim.length; j++) {
                glowAnim[j].visible = value;
            }
        };
        fudaole.PickBonusLS.revealPick = function (pickedNo, pickIndex, pickEnd) {
            if (pickEnd === void 0) { pickEnd = false; }
            var revealMC;
            switch (pickedNo) {
                case 0:
                    revealMC = maxiRev[countMaxi];
                    maxiSmallRev[countMaxi].visible = true;
                    countMaxi++;
                    if (countMaxi == 2)
                        antiAnim[3].visible = true;
                    break;
                case 1:
                    revealMC = majorRev[countMajor];
                    majorSmallRev[countMajor].visible = true;
                    countMajor++;
                    if (countMajor == 2)
                        antiAnim[2].visible = true;
                    break;
                case 2:
                    revealMC = minorRev[countMinor];
                    minorSmallRev[countMinor].visible = true;
                    countMinor++;
                    if (countMinor == 2)
                        antiAnim[1].visible = true;
                    break;
                case 3:
                    revealMC = miniRev[countMini];
                    miniSmallRev[countMini].visible = true;
                    countMini++;
                    if (countMini == 2)
                        antiAnim[0].visible = true;
                    break;
                default:
                    break;
            }
            if (pickEnd) {
                for (var k = 0; k < winnerMCs.length; k++) {
                    antiAnim[k].visible = false;
                }
            }
            revealMC.setTransform(pickBtns[pickIndex].x, pickBtns[pickIndex].y);
            glowAnim[pickIndex].visible = false;
            revealMC.visible = true;
            return revealMC;
        };
        fudaole.PickBonusLS.setIntroTxt = function (txt, font) {
            introTxt.text = txt;
            introTxt.font = "65px" + " " + font; //bold 65px Myriad Pro
            introValue.font = "150px" + " " + font; //bold 150px Myriad Pro
        };
        fudaole.PickBonusLS.setWinnerTxt = function (win, id, txt, font) {
            endOutro = true;
            winnerTxt.text = txt;
            winnerTxt.font = "130px" + " " + font; //bold 130px Myriad Pro
            winnerValue.text = win;
            winnerValue.font = "100px" + " " + font; //100px Myriad Pro Light
            winnerMCs[3 - id].gotoAndPlay(0);
            winnerMCs[3 - id].visible = true;
            winnerMC = winnerMCs[3 - id];
            winValue = win;
            winTxt = txt;
            winlistener = createjs.Ticker.addEventListener("tick", fudaole.PickBonusLS.winTicker.bind(this));
            switch (id) {
                case 0:
                    maxiValue.text = txt;
                    winnerTableTxt = maxiValue;
                    break;
                case 1:
                    majorValue.text = txt;
                    winnerTableTxt = majorValue;
                    break;
                case 2:
                    minorValue.text = txt;
                    winnerTableTxt = minorValue;
                    break;
                case 3:
                    miniValue.text = txt;
                    winnerTableTxt = miniValue;
                    break;
                default:
                    miniValue.text = txt;
                    winnerTableTxt = miniValue;
                    break;
            }
            miniValue.font = "40px" + " " + font; //bold 40px Myriad Pro
            minorValue.font = "45px" + " " + font;
            majorValue.font = "50px" + " " + font;
            maxiValue.font = "55px" + " " + font;
            fudaole.PickBonusLS.playWinner((index++) % 2);
        };
        fudaole.PickBonusLS.winnerTimer = function () {
            if (endOutro) {
                fudaole.PickBonusLS.playWinner((index++) % 2);
            }
        };
        fudaole.PickBonusLS.playWinner = function (i) {
            if (i == 0) {
                winnerTableTxt.text = winTxt;
            }
            else {
                winnerTableTxt.text = winValue;
            }
            TweenLite.delayedCall(1, function () {
                fudaole.PickBonusLS.winnerTimer();
            });
        };
        fudaole.PickBonusLS.winTicker = function () {
            switch (winnerMC.currentLabel) {
                case "End":
                    createjs.Ticker.removeEventListener('tick', winlistener);
                    winnerMC.gotoAndStop("End");
                    winnerMC.visible = false;
                    break;
            }
        };
        // stage content:
        (fudaole.PickBonusLS.PickfeatureLM = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { PickFeatureStart: 0, bgsoundstart: 55, PickFeatureStop: 112, Reveal: 117, StartBanner: 134, StartOutro: 305, EndFeature: 405 });
            // WinnerText
            this.WinnerBannerTxt = new createjs.Text("WINNER!", "bold 130px Myriad Pro", "#FFFFFF");
            this.WinnerBannerTxt.textAlign = "center";
            this.WinnerBannerTxt.lineHeight = 132;
            this.WinnerBannerTxt.maxWidth = 815;
            this.WinnerBannerTxt.setTransform(1262.5, 388.1);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.WinnerBannerTxt }] }, 182).to({ state: [] }, 123).wait(110));
            // Win Value
            this.WinnerBannerTxtVal = new createjs.Text("0", "100px Myriad Pro Light", "#FFFF00");
            this.WinnerBannerTxtVal.textAlign = "center";
            this.WinnerBannerTxtVal.lineHeight = 102;
            this.WinnerBannerTxtVal.maxWidth = 815;
            this.WinnerBannerTxtVal.setTransform(1262.5, 576.7);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.WinnerBannerTxtVal }] }, 182).to({ state: [] }, 123).wait(110));
            // Layer 2
            this.instance = new fudaole.PickBonusLS.reeffects_l("synched", 0, false);
            this.instance.setTransform(1218.9, 733.1, 2.124, 2.124, 0, 0, 0, 281.5, 499.9);
            this.instance._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance).wait(149).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 65).wait(201));
            // Winner Banner
            this.instance_1 = new fudaole.PickBonusLS.bannerwinner_L("synched", 0);
            this.instance_1.setTransform(1265.9, 494.5, 0.8, 0.8);
            this.instance_1.alpha = 0;
            this.instance_1._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_1).wait(170).to({ startPosition: 0, _off: false }, 0).to({ scaleX: 1.05, scaleY: 1.05, alpha: 1 }, 5).to({ scaleX: 1, scaleY: 1 }, 7).to({ startPosition: 0 }, 117).to({ scaleX: 1.16, scaleY: 1.16 }, 6).to({ scaleX: 0.86, scaleY: 0.86, alpha: 0 }, 9).to({ _off: true }, 1).wait(100));
            // pickinfo Text box
            this.pickinfoTxt2 = new createjs.Text("3", "bold 150px Myriad Pro", "#990000");
            this.pickinfoTxt2.textAlign = "center";
            this.pickinfoTxt2.lineHeight = 152;
            this.pickinfoTxt2.maxWidth = 204;
            this.pickinfoTxt2.setTransform(1254, 545.3);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.pickinfoTxt2 }] }, 106).to({ state: [] }, 10).wait(299));
            // pickinfo Text box
            this.pickinfoTxt1 = new createjs.Text("PICK UNTIL YOU MATCH", "bold 65px Myriad Pro", "#FFFFFF");
            this.pickinfoTxt1.textAlign = "center";
            this.pickinfoTxt1.lineHeight = 67;
            this.pickinfoTxt1.maxWidth = 844;
            this.pickinfoTxt1.setTransform(1236.6, 433.8);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.pickinfoTxt1 }] }, 106).to({ state: [] }, 10).wait(299));
            // Pick text back
            this.textboxBgMC = new fudaole.PickBonusLS.textback_L();
            this.textboxBgMC.setTransform(1255.1, 460.7);
            this.textboxBgMC._off = true;
            this.timeline.addTween(createjs.Tween.get(this.textboxBgMC).wait(106).to({ _off: false }, 0).to({ _off: true }, 10).wait(299));
            // PickInfo Message
            this.pickinfoBannerMC = new fudaole.PickBonusLS.pickinfomsg_L();
            this.pickinfoBannerMC.setTransform(1245.7, 534.5);
            this.pickinfoBannerMC._off = true;
            this.timeline.addTween(createjs.Tween.get(this.pickinfoBannerMC).wait(112).to({ _off: false }, 0).to({ _off: true }, 4).wait(299));
            // PickInfo Message
            this.instance_2 = new fudaole.PickBonusLS.pickinfomsg_L("synched", 0);
            this.instance_2.setTransform(1245.7, 534.5, 1.25, 1.25);
            this.instance_2.alpha = 0;
            this.instance_2._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_2).wait(93).to({ startPosition: 0, _off: false }, 0).to({ scaleX: 0.95, scaleY: 0.95, alpha: 1 }, 13, createjs.Ease.get(-0.99)).to({ scaleX: 1, scaleY: 1 }, 3, createjs.Ease.get(1)).to({ _off: true }, 3).wait(303));
            // Mini Text Field
            this.MiniTxtVal = new createjs.Text("0", "bold 40px Myriad Pro", "#FFFF00");
            this.MiniTxtVal.textAlign = "center";
            this.MiniTxtVal.lineHeight = 42;
            this.MiniTxtVal.maxWidth = 198;
            this.MiniTxtVal.setTransform(391, 704);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.MiniTxtVal }] }, 27).to({ state: [] }, 299).wait(89));
            // Minor Text Field
            this.MinorTxtVal = new createjs.Text("0", "bold 45px Myriad Pro", "#FFFF00");
            this.MinorTxtVal.textAlign = "center";
            this.MinorTxtVal.lineHeight = 47;
            this.MinorTxtVal.maxWidth = 206;
            this.MinorTxtVal.setTransform(395.2, 546.5);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.MinorTxtVal }] }, 27).to({ state: [] }, 299).wait(89));
            // Major Text Field
            this.MajorTxtVal = new createjs.Text("0", "bold 50px Myriad Pro", "#FFFF00");
            this.MajorTxtVal.textAlign = "center";
            this.MajorTxtVal.lineHeight = 52;
            this.MajorTxtVal.maxWidth = 268;
            this.MajorTxtVal.setTransform(392.5, 370.1);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.MajorTxtVal }] }, 27).to({ state: [] }, 299).wait(89));
            // Maxi Text Field
            this.MaxiTxtVal = new createjs.Text("0", "bold 55px Myriad Pro", "#FFFF00");
            this.MaxiTxtVal.textAlign = "center";
            this.MaxiTxtVal.lineHeight = 57;
            this.MaxiTxtVal.maxWidth = 344;
            this.MaxiTxtVal.setTransform(393.3, 187.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.MaxiTxtVal }] }, 27).to({ state: [] }, 299).wait(89));
            // Logo
            this.instance_3 = new fudaole.PickBonusLS.GameLogo_L("synched", 0);
            this.instance_3.setTransform(1269.9, -233.8);
            this.instance_3.alpha = 0;
            this.instance_3._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_3).wait(25).to({ startPosition: 0, _off: false }, 0).to({ y: 141.1, alpha: 1 }, 11).to({ y: 116.1 }, 4).to({ startPosition: 0 }, 4).wait(294).to({ startPosition: 0 }, 0).to({ startPosition: 0 }, 4).to({ y: 141.1 }, 4).to({ y: -233.7, alpha: 0 }, 11).to({ _off: true }, 1).wait(57));
            // shadow
            this.instance_4 = new fudaole.PickBonusLS.shadow_L("synched", 0);
            this.instance_4.setTransform(1288, -217.2, 1.84, 0.945);
            this.instance_4.alpha = 0;
            this.instance_4._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_4).wait(25).to({ startPosition: 0, _off: false }, 0).to({ y: 157.8, alpha: 1 }, 11).to({ y: 117.8 }, 4).to({ y: 132.8 }, 4).wait(294).to({ startPosition: 0 }, 0).to({ y: 117.8 }, 4).to({ y: 157.8 }, 4).to({ y: -217.1, alpha: 0 }, 11).to({ _off: true }, 1).wait(57));
            // WinnerGlowMC
            this.MiniWinnerMC = new fudaole.PickBonusLS.WinnerGlowMCL();
            this.MiniWinnerMC.setTransform(392.6, 716.2, 0.478, 0.478);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniWinnerMC }] }).wait(415));
            // WinnerGlowMC
            this.MinorWinnerMC = new fudaole.PickBonusLS.WinnerGlowMCL();
            this.MinorWinnerMC.setTransform(393.1, 562.8, 0.531, 0.531);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorWinnerMC }] }).wait(415));
            // WinnerGlowMC
            this.MajorWinnerMC = new fudaole.PickBonusLS.WinnerGlowMCL();
            this.MajorWinnerMC.setTransform(393.1, 387.3, 0.656, 0.656);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorWinnerMC }] }).wait(415));
            // WinnerGlowMC
            this.MaxiWinnerMC = new fudaole.PickBonusLS.WinnerGlowMCL();
            this.MaxiWinnerMC.setTransform(393.1, 204.7, 0.81, 0.81);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiWinnerMC }] }).wait(415));
            // PickIndicator03
            this.MiniRev03 = new fudaole.PickBonusLS.PickIndicator03_L();
            this.MiniRev03.setTransform(469.6, 779.7);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniRev03 }] }).wait(415));
            // PickIndicator03
            this.MiniRev02 = new fudaole.PickBonusLS.PickIndicator03_L();
            this.MiniRev02.setTransform(397.4, 779.7);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniRev02 }] }).wait(415));
            // PickIndicator03
            this.MiniRev01 = new fudaole.PickBonusLS.PickIndicator03_L();
            this.MiniRev01.setTransform(324.7, 779.7);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniRev01 }] }).wait(415));
            // PickIndicator02
            this.MinorRev03 = new fudaole.PickBonusLS.PickIndicator02_L();
            this.MinorRev03.setTransform(473.7, 627.8);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorRev03 }] }).wait(415));
            // PickIndicator02
            this.MinorRev02 = new fudaole.PickBonusLS.PickIndicator02_L();
            this.MinorRev02.setTransform(397.4, 627.8);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorRev02 }] }).wait(415));
            // PickIndicator02
            this.MinorRev01 = new fudaole.PickBonusLS.PickIndicator02_L();
            this.MinorRev01.setTransform(321.1, 627.8);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorRev01 }] }).wait(415));
            // PickIndicator01
            this.MajorRev03 = new fudaole.PickBonusLS.PickIndicator01_L();
            this.MajorRev03.setTransform(478.2, 457.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorRev03 }] }).wait(415));
            // PickIndicator01
            this.MajorRev02 = new fudaole.PickBonusLS.PickIndicator01_L();
            this.MajorRev02.setTransform(398.2, 457.5);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorRev02 }] }).wait(415));
            // PickIndicator01
            this.MajorRev01 = new fudaole.PickBonusLS.PickIndicator01_L();
            this.MajorRev01.setTransform(318, 457.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorRev01 }] }).wait(415));
            // PickIndicator00
            this.MaxiRev03 = new fudaole.PickBonusLS.PickIndicator00_L();
            this.MaxiRev03.setTransform(481.8, 278.8);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiRev03 }] }).wait(415));
            // PickIndicator00
            this.MaxiRev02 = new fudaole.PickBonusLS.PickIndicator00_L();
            this.MaxiRev02.setTransform(397.4, 278.8);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiRev02 }] }).wait(415));
            // PickIndicator00
            this.MaxiRev01 = new fudaole.PickBonusLS.PickIndicator00_L();
            this.MaxiRev01.setTransform(312.7, 278.3);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiRev01 }] }).wait(415));
            // pick mini
            this.MiniReveal01 = new fudaole.PickBonusLS.PickState03_L();
            this.MiniReveal01.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniReveal01 }] }).wait(415));
            // pick minor
            this.MinorReveal01 = new fudaole.PickBonusLS.PickState02_L();
            this.MinorReveal01.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorReveal01 }] }).wait(415));
            // pick major
            this.MajorReveal01 = new fudaole.PickBonusLS.PickState01_L();
            this.MajorReveal01.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorReveal01 }] }).wait(415));
            // pick maxi
            this.MaxiReveal01 = new fudaole.PickBonusLS.PickState00_L();
            this.MaxiReveal01.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiReveal01 }] }).wait(415));
            // pick mini
            this.MiniReveal02 = new fudaole.PickBonusLS.PickState03_L();
            this.MiniReveal02.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniReveal02 }] }).wait(415));
            // pick minor
            this.MinorReveal02 = new fudaole.PickBonusLS.PickState02_L();
            this.MinorReveal02.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorReveal02 }] }).wait(415));
            // pick major
            this.MajorReveal02 = new fudaole.PickBonusLS.PickState01_L();
            this.MajorReveal02.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorReveal02 }] }).wait(415));
            // pick maxi
            this.MaxiReveal02 = new fudaole.PickBonusLS.PickState00_L();
            this.MaxiReveal02.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiReveal02 }] }).wait(415));
            // pick mini
            this.MiniReveal03 = new fudaole.PickBonusLS.PickState03_L();
            this.MiniReveal03.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniReveal03 }] }).wait(415));
            // pick minor
            this.MinorReveal03 = new fudaole.PickBonusLS.PickState02_L();
            this.MinorReveal03.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorReveal03 }] }).wait(415));
            // pick major
            this.MajorReveal03 = new fudaole.PickBonusLS.PickState01_L();
            this.MajorReveal03.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorReveal03 }] }).wait(415));
            // pick maxi
            this.MaxiReveal03 = new fudaole.PickBonusLS.PickState00_L();
            this.MaxiReveal03.setTransform(131.2, 121.8, 1.102, 1.102);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiReveal03 }] }).wait(415));
            // Pick14
            this.Pick14 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick14.setTransform(1717.4, 719, 0.997, 0.997);
            this.Pick14._off = true;
            new createjs.ButtonHelper(this.Pick14, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick14).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick09
            this.Pick09 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick09.setTransform(1717.4, 554.4, 0.997, 0.997);
            this.Pick09._off = true;
            new createjs.ButtonHelper(this.Pick09, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick09).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick04
            this.Pick04 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick04.setTransform(1717.4, 389.6, 0.997, 0.997);
            this.Pick04._off = true;
            new createjs.ButtonHelper(this.Pick04, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick04).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick13
            this.Pick13 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick13.setTransform(1476.7, 753, 0.997, 0.997);
            this.Pick13._off = true;
            new createjs.ButtonHelper(this.Pick13, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick13).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick08
            this.Pick08 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick08.setTransform(1476.7, 588.4, 0.997, 0.997);
            this.Pick08._off = true;
            new createjs.ButtonHelper(this.Pick08, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick08).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick03
            this.Pick03 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick03.setTransform(1476.8, 423.6, 0.997, 0.997);
            this.Pick03._off = true;
            new createjs.ButtonHelper(this.Pick03, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick03).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick12
            this.Pick12 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick12.setTransform(1256, 714, 0.997, 0.997);
            this.Pick12._off = true;
            new createjs.ButtonHelper(this.Pick12, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick12).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick07
            this.Pick07 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick07.setTransform(1256, 549.4, 0.997, 0.997);
            this.Pick07._off = true;
            new createjs.ButtonHelper(this.Pick07, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick07).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick02
            this.Pick02 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick02.setTransform(1256, 384.6, 0.997, 0.997);
            this.Pick02._off = true;
            new createjs.ButtonHelper(this.Pick02, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick02).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick11
            this.Pick11 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick11.setTransform(1018.2, 750.5, 0.997, 0.997);
            this.Pick11._off = true;
            new createjs.ButtonHelper(this.Pick11, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick11).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick06
            this.Pick06 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick06.setTransform(1018.2, 585.9, 0.997, 0.997);
            this.Pick06._off = true;
            new createjs.ButtonHelper(this.Pick06, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick06).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick01
            this.Pick01 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick01.setTransform(1018.2, 421.1, 0.997, 0.997);
            this.Pick01._off = true;
            new createjs.ButtonHelper(this.Pick01, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick01).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick10
            this.Pick10 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick10.setTransform(801.1, 711.5, 0.997, 0.997);
            this.Pick10._off = true;
            new createjs.ButtonHelper(this.Pick10, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick10).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick05
            this.Pick05 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick05.setTransform(801.1, 546.9, 0.997, 0.997);
            this.Pick05._off = true;
            new createjs.ButtonHelper(this.Pick05, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick05).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick00
            this.Pick00 = new fudaole.PickBonusLS.PickBtn_L();
            this.Pick00.setTransform(801.1, 382.1, 0.997, 0.997);
            this.Pick00._off = true;
            new createjs.ButtonHelper(this.Pick00, btn0, btn1, btn2, false, new fudaole.PickBonusLS.PickBtn_L(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick00).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // PickBtn
            this.instance_5 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_5.setTransform(1727.3, -453, 0.997, 0.997);
            this.instance_5._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_5).wait(14).to({ startPosition: 0, _off: false }, 0).to({ x: 1722.5, y: 254.9, startPosition: 3 }, 7).to({ x: 1722, y: 684.4, startPosition: 2 }, 7).to({ x: 1721.5, y: 770.1 }, 8).to({ x: 1724.5, y: 663.8, startPosition: 0 }, 14).to({ x: 1727.7, y: 644.1, startPosition: 1 }, 5).to({ x: 1721.6, y: 705.4 }, 8).to({ x: 1734.5, y: 722.9 }, 8).to({ x: 1726, y: 685.9, startPosition: 3 }, 6).to({ x: 1719, y: 701.6, startPosition: 1 }, 6).to({ x: 1712.3, y: 723.5, startPosition: 2 }, 5).to({ x: 1717.4, y: 719, mode: "independent" }, 6).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 759.5, startPosition: 2 }, 7).to({ y: -378.4, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_6 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_6.setTransform(1726.5, -579.2, 0.997, 0.997);
            this.instance_6._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_6).wait(14).to({ startPosition: 0, _off: false }, 0).to({ x: 1721.8, y: 105.7, startPosition: 3 }, 7).to({ x: 1721.3, y: 531.5, startPosition: 2 }, 7).to({ x: 1720.9, y: 601.9 }, 8).to({ x: 1724.1, y: 496.4, startPosition: 0 }, 14).to({ x: 1723.3, y: 485, startPosition: 1 }, 5).to({ x: 1722.1, y: 541.3 }, 8).to({ x: 1728.9, y: 564.6 }, 8).to({ x: 1725.9, y: 526, startPosition: 3 }, 6).to({ x: 1719, y: 540, startPosition: 1 }, 6).to({ x: 1712.2, y: 560.5, startPosition: 2 }, 5).to({ x: 1717.4, y: 554.4, mode: "independent" }, 6).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 594.9, startPosition: 2 }, 7).to({ y: -543, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_7 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_7.setTransform(1725.8, -698.8, 0.997, 0.997);
            this.instance_7._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_7).wait(14).to({ startPosition: 0, _off: false }, 0).to({ x: 1721.1, y: -51.1, startPosition: 3 }, 7).to({ x: 1720.7, y: 385.7, startPosition: 2 }, 7).to({ x: 1720.4, y: 434.1 }, 8).to({ x: 1719.7, y: 329.4, startPosition: 0 }, 14).to({ x: 1719.4, y: 328.2, startPosition: 1 }, 5).to({ x: 1719, y: 380.8 }, 8).to({ x: 1728.6, y: 403.1 }, 8).to({ x: 1725.7, y: 363.6, startPosition: 3 }, 6).to({ x: 1718.8, y: 376.8, startPosition: 1 }, 6).to({ x: 1712.2, y: 396.6, startPosition: 2 }, 5).to({ x: 1717.4, y: 389.6, mode: "independent" }, 6).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 430.1, startPosition: 2 }, 7).to({ y: -707.8, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_8 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_8.setTransform(1486.6, -475, 0.997, 0.997);
            this.instance_8._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_8).wait(13).to({ startPosition: 0, _off: false }, 0).to({ x: 1479.7, y: 295.1, startPosition: 3 }, 7).to({ x: 1484.9, y: 737.2, startPosition: 2 }, 7).to({ x: 1483.9, y: 827.1 }, 8).to({ x: 1482.2, y: 699.5, startPosition: 0 }, 14).to({ x: 1483.6, y: 683.5, startPosition: 1 }, 5).to({ x: 1483.2, y: 741.4 }, 8).to({ x: 1494.8, y: 771.3 }, 8).to({ x: 1488.3, y: 748.7, startPosition: 3 }, 6).to({ x: 1478.6, y: 751.6, startPosition: 1 }, 6).to({ x: 1472.6, y: 757.6, startPosition: 3 }, 6).to({ x: 1476.7, y: 753, mode: "independent" }, 6).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 793.5, startPosition: 2 }, 7).to({ y: -344.4, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_9 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_9.setTransform(1485.8, -601.2, 0.997, 0.997);
            this.instance_9._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_9).wait(13).to({ startPosition: 0, _off: false }, 0).to({ x: 1479, y: 142.5, startPosition: 3 }, 7).to({ x: 1484.2, y: 602.3, startPosition: 2 }, 7).to({ x: 1481.3, y: 656.7 }, 8).to({ x: 1482.3, y: 536.5, startPosition: 0 }, 14).to({ x: 1483.7, y: 526.3, startPosition: 1 }, 5).to({ x: 1483.2, y: 580.7 }, 8).to({ x: 1490.8, y: 607.1 }, 8).to({ x: 1485.3, y: 584.5, startPosition: 3 }, 6).to({ x: 1477.6, y: 593.1, startPosition: 1 }, 6).to({ x: 1471.6, y: 599.1, startPosition: 3 }, 6).to({ x: 1476.7, y: 588.4, mode: "independent" }, 6).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 628.9, startPosition: 2 }, 7).to({ y: -509, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_10 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_10.setTransform(1485.1, -720.8, 0.997, 0.997);
            this.instance_10._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_10).wait(13).to({ startPosition: 0, _off: false }, 0).to({ x: 1480.4, y: -8.8, startPosition: 3 }, 7).to({ x: 1483.7, y: 435, startPosition: 2 }, 7).to({ x: 1482.9, y: 493.6 }, 8).to({ x: 1481.4, y: 373, startPosition: 0 }, 14).to({ x: 1481, y: 370.6, startPosition: 1 }, 5).to({ x: 1484.1, y: 423.2 }, 8).to({ x: 1487.3, y: 447.8 }, 8).to({ x: 1482.7, y: 423.8, startPosition: 3 }, 6).to({ x: 1478.8, y: 429.7, startPosition: 1 }, 6).to({ x: 1472.8, y: 435.7, startPosition: 3 }, 6).to({ x: 1476.8, y: 423.6, mode: "independent" }, 6).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 464.1, startPosition: 2 }, 7).to({ y: -673.8, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_11 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_11.setTransform(1265.9, -446, 0.997, 0.997);
            this.instance_11._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_11).wait(11).to({ startPosition: 0, _off: false }, 0).to({ x: 1259.3, y: 83.9, startPosition: 1 }, 5, createjs.Ease.get(-0.04)).to({ x: 1259.1, y: 396.6 }, 4).to({ x: 1258.9, y: 688.6, startPosition: 2 }, 5).to({ x: 1258.5, y: 781.5 }, 8).to({ x: 1264, y: 666.2 }, 12).to({ x: 1262.9, y: 633.1, startPosition: 1 }, 7).to({ x: 1262.3, y: 681.6, startPosition: 3 }, 6).to({ x: 1278.8, y: 738.1, startPosition: 2 }, 7).to({ x: 1274.4, y: 728.3, startPosition: 1 }, 3).to({ x: 1265.7, y: 690.6, startPosition: 3 }, 6).to({ x: 1251.4, y: 715.8, startPosition: 0 }, 13).to({ x: 1256, y: 714, mode: "independent" }, 7).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 754.5, startPosition: 2 }, 7).to({ y: -383.4, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_12 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_12.setTransform(1265.1, -572.2, 0.997, 0.997);
            this.instance_12._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_12).wait(11).to({ startPosition: 0, _off: false }, 0).to({ x: 1260.6, y: -74.6, startPosition: 1 }, 5, createjs.Ease.get(-0.04)).to({ x: 1260.4, y: 240.4 }, 4).to({ x: 1260.1, y: 535.3, startPosition: 2 }, 5).to({ x: 1259.6, y: 610.9 }, 8).to({ x: 1260.9, y: 496.8 }, 12).to({ x: 1260.2, y: 464.3, startPosition: 1 }, 7).to({ x: 1261.2, y: 513.4, startPosition: 3 }, 6).to({ x: 1270.9, y: 570.7, startPosition: 2 }, 7).to({ x: 1269.5, y: 561.1, startPosition: 1 }, 3).to({ x: 1266.4, y: 524.1, startPosition: 3 }, 6).to({ x: 1251.6, y: 558.5, startPosition: 0 }, 13).to({ x: 1256, y: 549.4, mode: "independent" }, 7).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 589.9, startPosition: 2 }, 7).to({ y: -548, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_13 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_13.setTransform(1264.4, -691.8, 0.997, 0.997);
            this.instance_13._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_13).wait(11).to({ startPosition: 0, _off: false }, 0).to({ x: 1261.9, y: -232.9, startPosition: 1 }, 5, createjs.Ease.get(-0.04)).to({ x: 1261.6, y: 84.4 }, 4).to({ x: 1261.2, y: 382.2, startPosition: 2 }, 5).to({ x: 1260.6, y: 440.6 }, 8).to({ x: 1259.7, y: 327.6 }, 12).to({ x: 1259.2, y: 295.8, startPosition: 1 }, 7).to({ x: 1260.3, y: 345.4, startPosition: 3 }, 6).to({ x: 1270.2, y: 403.3, startPosition: 2 }, 7).to({ x: 1268.8, y: 394, startPosition: 1 }, 3).to({ x: 1265.9, y: 357.5, startPosition: 3 }, 6).to({ x: 1253.5, y: 397.1, startPosition: 0 }, 13).to({ x: 1256, y: 384.6, mode: "independent" }, 7).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 425.1, startPosition: 2 }, 7).to({ y: -712.8, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_14 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_14.setTransform(1028.1, -417.5, 0.997, 0.997);
            this.instance_14._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_14).wait(7).to({ startPosition: 0, _off: false }, 0).to({ x: 1027, y: 518.7, startPosition: 2 }, 10).to({ x: 1020.4, y: 743.7, startPosition: 3 }, 5, createjs.Ease.get(0.5)).to({ x: 1020.2, y: 819.6, startPosition: 2 }, 7).to({ x: 1020.1, y: 800.7, startPosition: 1 }, 3).to({ x: 1019.8, y: 703.8, startPosition: 0 }, 11).to({ x: 1025.6, y: 692.4, startPosition: 1 }, 5).to({ x: 1024.2, y: 751.8, startPosition: 2 }, 9).to({ x: 1033, y: 771.5, startPosition: 1 }, 7).to({ x: 1024.1, y: 727.3, startPosition: 3 }, 6).to({ x: 1010.9, y: 767.9, startPosition: 0 }, 13).to({ x: 1018.2, y: 750.5, mode: "independent" }, 11).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 791, startPosition: 2 }, 7).to({ y: -346.9, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_15 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_15.setTransform(1027.3, -543.7, 0.997, 0.997);
            this.instance_15._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_15).wait(7).to({ startPosition: 0, _off: false }, 0).to({ x: 1026.2, y: 348.1, startPosition: 2 }, 10).to({ x: 1019.7, y: 589.5, startPosition: 3 }, 5, createjs.Ease.get(0.5)).to({ x: 1019.6, y: 651.8, startPosition: 2 }, 7).to({ x: 1019.5, y: 627, startPosition: 1 }, 3).to({ x: 1019.3, y: 535.7, startPosition: 0 }, 11).to({ x: 1023.2, y: 530.6, startPosition: 1 }, 5).to({ x: 1022.2, y: 589.4, startPosition: 2 }, 9).to({ x: 1031.4, y: 608.8, startPosition: 1 }, 7).to({ x: 1024.8, y: 564.2, startPosition: 3 }, 6).to({ x: 1011.2, y: 604, startPosition: 0 }, 13).to({ x: 1018.2, y: 585.9, mode: "independent" }, 11).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 626.4, startPosition: 2 }, 7).to({ y: -511.5, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_16 = new fudaole.PickBonusLS.PickBtn_L("synched", 0);
            this.instance_16.setTransform(1026.6, -663.3, 0.997, 0.997);
            this.instance_16._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_16).wait(7).to({ startPosition: 0, _off: false }, 0).to({ x: 1025.6, y: 183.3, startPosition: 2 }, 10).to({ x: 1025.1, y: 434.8, startPosition: 3 }, 5, createjs.Ease.get(0.5)).to({ x: 1021.7, y: 486.2, startPosition: 2 }, 7).to({ x: 1020.2, y: 456.9, startPosition: 1 }, 3).to({ x: 1019.8, y: 370.5, startPosition: 0 }, 11).to({ x: 1021.7, y: 371.5, startPosition: 1 }, 5).to({ x: 1021, y: 429.2, startPosition: 2 }, 9).to({ x: 1030.5, y: 447.7, startPosition: 1 }, 7).to({ x: 1026, y: 402.4, startPosition: 3 }, 6).to({ x: 1011.8, y: 440.5, startPosition: 0 }, 13).to({ x: 1018.2, y: 421.1, mode: "independent" }, 11).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 461.6, startPosition: 2 }, 7).to({ y: -676.3, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_17 = new fudaole.PickBonusLS.PickBtn_L("synched", 1);
            this.instance_17.setTransform(811, -456.5, 0.997, 0.997);
            this.instance_17._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_17).wait(3).to({ startPosition: 1, _off: false }, 0).to({ x: 807.8, y: 521.7, startPosition: 0 }, 11).to({ x: 806.3, y: 716.7, startPosition: 1 }, 5, createjs.Ease.get(0.96)).to({ x: 804.6, y: 787.9, startPosition: 3 }, 6).to({ x: 803.9, y: 683.5, startPosition: 0 }, 13).to({ x: 809.6, y: 640.5, startPosition: 2 }, 6).to({ x: 809.3, y: 645.3, startPosition: 0 }, 2).to({ x: 811.1, y: 705, startPosition: 3 }, 7).to({ x: 816.9, y: 732.6, startPosition: 2 }, 7).to({ x: 807.1, y: 706.1, startPosition: 3 }, 5, createjs.Ease.get(1)).to({ x: 805.3, y: 698.8, startPosition: 1 }, 2).to({ x: 793.7, y: 718.6, startPosition: 0 }, 11).to({ x: 801.1, y: 711.5, mode: "independent" }, 11).wait(5).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 752, startPosition: 2 }, 7).to({ y: -385.9, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_18 = new fudaole.PickBonusLS.PickBtn_L("synched", 1);
            this.instance_18.setTransform(810.2, -582.7, 0.997, 0.997);
            this.instance_18._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_18).wait(3).to({ startPosition: 1, _off: false }, 0).to({ x: 807.1, y: 360.8, startPosition: 0 }, 11).to({ x: 805.7, y: 558.9, startPosition: 1 }, 5, createjs.Ease.get(0.96)).to({ x: 804, y: 616.3, startPosition: 3 }, 6).to({ x: 803.4, y: 513.2, startPosition: 0 }, 13).to({ x: 809.2, y: 482.8, startPosition: 2 }, 6).to({ x: 808.9, y: 489.4, startPosition: 0 }, 2).to({ x: 810.7, y: 546.8, startPosition: 3 }, 7).to({ x: 816.6, y: 572.1, startPosition: 2 }, 7).to({ x: 808.5, y: 544.7, startPosition: 3 }, 5, createjs.Ease.get(1)).to({ x: 807, y: 535.2, startPosition: 1 }, 2).to({ x: 794.7, y: 557.9, startPosition: 0 }, 11).to({ x: 801.1, y: 546.9, mode: "independent" }, 11).wait(5).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 587.4, startPosition: 2 }, 7).to({ y: -550.5, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // PickBtn
            this.instance_19 = new fudaole.PickBonusLS.PickBtn_L("synched", 1);
            this.instance_19.setTransform(809.5, -702.3, 0.997, 0.997);
            this.instance_19._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_19).wait(3).to({ startPosition: 1, _off: false }, 0).to({ x: 806.5, y: 199.7, startPosition: 0 }, 11).to({ x: 805.1, y: 403.8, startPosition: 1 }, 5, createjs.Ease.get(0.96)).to({ x: 803.5, y: 441.8, startPosition: 3 }, 6).to({ x: 803, y: 340.6, startPosition: 0 }, 13).to({ x: 804.8, y: 325, startPosition: 2 }, 6).to({ x: 804.7, y: 331.3, startPosition: 0 }, 2).to({ x: 806.2, y: 385.7, startPosition: 3 }, 7).to({ x: 811.6, y: 408.1, startPosition: 2 }, 7).to({ x: 809.4, y: 380.5, startPosition: 3 }, 5, createjs.Ease.get(1)).to({ x: 809, y: 369.1, startPosition: 1 }, 2).to({ x: 796, y: 399.5, startPosition: 0 }, 11).to({ x: 801.1, y: 382.1, mode: "independent" }, 11).wait(5).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 3, _off: false }, 0).to({ y: 422.6, startPosition: 2 }, 7).to({ y: -715.3, startPosition: 3 }, 17).to({ _off: true }, 1).wait(69));
            // coinglowAnim
            this.glow14 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow14.setTransform(1716, 719.3, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow14 }] }).wait(415));
            // coinglowAnim
            this.glow09 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow09.setTransform(1716, 555.6, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow09 }] }).wait(415));
            // coinglowAnim
            this.glow04 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow04.setTransform(1716.1, 391.8, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow04 }] }).wait(415));
            // coinglowAnim
            this.glow13 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow13.setTransform(1476.6, 754.3, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow13 }] }).wait(415));
            // coinglowAnim
            this.glow08 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow08.setTransform(1476.6, 590.6, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow08 }] }).wait(415));
            // coinglowAnim
            this.glow03 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow03.setTransform(1476.7, 424.8, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow03 }] }).wait(415));
            // coinglowAnim
            this.glow12 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow12.setTransform(1254.3, 714.3, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow12 }] }).wait(415));
            // coinglowAnim
            this.glow07 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow07.setTransform(1254.3, 548.6, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow07 }] }).wait(415));
            // coinglowAnim
            this.glow02 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow02.setTransform(1254.3, 386.8, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow02 }] }).wait(415));
            // coinglowAnim
            this.glow11 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow11.setTransform(1016.7, 751.8, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow11 }] }).wait(415));
            // coinglowAnim
            this.glow06 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow06.setTransform(1016.7, 586.1, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow06 }] }).wait(415));
            // coinglowAnim
            this.glow01 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow01.setTransform(1016.8, 422.3, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow01 }] }).wait(415));
            // coinglowAnim
            this.glow10 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow10.setTransform(799.9, 710.9, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow10 }] }).wait(415));
            // coinglowAnim
            this.glow05 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow05.setTransform(799.9, 547.2, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow05 }] }).wait(415));
            // coinglowAnim
            this.glow00 = new fudaole.PickBonusLS.coinglowAnim_L();
            this.glow00.setTransform(800, 383.4, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow00 }] }).wait(415));
            // LHangingAnimMC
            this.instance_20 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 99, false);
            this.instance_20.setTransform(1728.1, -820.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_20._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_20).wait(321).to({ startPosition: 99, _off: false }, 0).to({ y: -780, startPosition: 106 }, 7).to({ y: -1914, startPosition: 123 }, 17).to({ _off: true }, 1).wait(69));
            // LHangingAnimMC
            this.instance_21 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 99, false);
            this.instance_21.setTransform(1487.3, -777.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_21._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_21).wait(321).to({ startPosition: 99, _off: false }, 0).to({ y: -737, startPosition: 106 }, 7).to({ y: -1871, startPosition: 123 }, 17).to({ _off: true }, 1).wait(69));
            // LHangingAnimMC
            this.instance_22 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 99, false);
            this.instance_22.setTransform(1268, -820.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_22._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_22).wait(321).to({ startPosition: 99, _off: false }, 0).to({ y: -780, startPosition: 106 }, 7).to({ y: -1914, startPosition: 123 }, 17).to({ _off: true }, 1).wait(69));
            // LHangingAnimMC
            this.instance_23 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 99, false);
            this.instance_23.setTransform(1027.2, -777.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_23._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_23).wait(321).to({ startPosition: 99, _off: false }, 0).to({ y: -737, startPosition: 106 }, 7).to({ y: -1871, startPosition: 123 }, 17).to({ _off: true }, 1).wait(69));
            // LHangingAnimMC
            this.instance_24 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 99, false);
            this.instance_24.setTransform(810.2, -820.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_24._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_24).wait(321).to({ startPosition: 99, _off: false }, 0).to({ x: 812.2, y: -780, startPosition: 106 }, 7).to({ y: -1914, startPosition: 123 }, 17).to({ _off: true }, 1).wait(69));
            // HangingAnim
            this.instance_25 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 0, false);
            this.instance_25.setTransform(1728.1, -820.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_25._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_25).wait(14).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 307).wait(94));
            // HangingAnim
            this.instance_26 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 0, false);
            this.instance_26.setTransform(1487.3, -777.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_26._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_26).wait(13).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 308).wait(94));
            // HangingAnim
            this.instance_27 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 0, false);
            this.instance_27.setTransform(1268, -820.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_27._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_27).wait(11).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 310).wait(94));
            // HangingAnim
            this.instance_28 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 0, false);
            this.instance_28.setTransform(1027.2, -777.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_28._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_28).wait(7).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 314).wait(94));
            // HangingAnim
            this.instance_29 = new fudaole.PickBonusLS.LHangingAnimMC_L("synched", 0, false);
            this.instance_29.setTransform(810.2, -820.6, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_29._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_29).wait(3).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 318).wait(94));
            // CircleSym
            this.instance_30 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_30.setTransform(469.7, 720.7, 0.857, 0.857);
            this.instance_30.alpha = 0;
            this.instance_30._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_30).wait(28).to({ startPosition: 0, _off: false }, 0).to({ y: 786.8, alpha: 1 }, 6).to({ y: 779.5 }, 3).wait(307).to({ startPosition: 0 }, 0).to({ y: 786.8 }, 3).to({ y: 720.7, alpha: 0 }, 6).to({ _off: true }, 16).wait(46));
            // CircleSym
            this.instance_31 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_31.setTransform(397.4, 720.7, 0.857, 0.857);
            this.instance_31.alpha = 0;
            this.instance_31._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_31).wait(28).to({ startPosition: 0, _off: false }, 0).to({ y: 786.8, alpha: 1 }, 6).to({ y: 779.5 }, 3).wait(307).to({ startPosition: 0 }, 0).to({ y: 786.8 }, 3).to({ y: 720.7, alpha: 0 }, 6).to({ _off: true }, 16).wait(46));
            // CircleSym
            this.instance_32 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_32.setTransform(325, 720.7, 0.857, 0.857);
            this.instance_32.alpha = 0;
            this.instance_32._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_32).wait(28).to({ startPosition: 0, _off: false }, 0).to({ y: 786.8, alpha: 1 }, 6).to({ y: 779.5 }, 3).wait(307).to({ startPosition: 0 }, 0).to({ y: 786.8 }, 3).to({ y: 720.7, alpha: 0 }, 6).to({ _off: true }, 16).wait(46));
            // CircleSym
            this.instance_33 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_33.setTransform(473.5, 568.8, 0.902, 0.902);
            this.instance_33.alpha = 0;
            this.instance_33._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_33).wait(26).to({ startPosition: 0, _off: false }, 0).to({ y: 634.9, alpha: 1 }, 6).to({ y: 627.6 }, 3).wait(309).to({ startPosition: 0 }, 0).to({ y: 634.9 }, 3).to({ y: 568.8, alpha: 0 }, 6).to({ _off: true }, 14).wait(48));
            // CircleSym
            this.instance_34 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_34.setTransform(397.4, 568.8, 0.902, 0.902);
            this.instance_34.alpha = 0;
            this.instance_34._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_34).wait(26).to({ startPosition: 0, _off: false }, 0).to({ y: 634.9, alpha: 1 }, 6).to({ y: 627.6 }, 3).wait(309).to({ startPosition: 0 }, 0).to({ y: 634.9 }, 3).to({ y: 568.8, alpha: 0 }, 6).to({ _off: true }, 14).wait(48));
            // CircleSym
            this.instance_35 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_35.setTransform(321.2, 568.8, 0.902, 0.902);
            this.instance_35.alpha = 0;
            this.instance_35._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_35).wait(26).to({ startPosition: 0, _off: false }, 0).to({ y: 634.9, alpha: 1 }, 6).to({ y: 627.6 }, 3).wait(309).to({ startPosition: 0 }, 0).to({ y: 634.9 }, 3).to({ y: 568.8, alpha: 0 }, 6).to({ _off: true }, 14).wait(48));
            // CircleSym
            this.instance_36 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_36.setTransform(477.6, 398.6, 0.95, 0.95);
            this.instance_36.alpha = 0;
            this.instance_36._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_36).wait(24).to({ startPosition: 0, _off: false }, 0).to({ y: 464.7, alpha: 1 }, 6).to({ y: 457.4 }, 3).wait(311).to({ startPosition: 0 }, 0).to({ y: 464.7 }, 3).to({ y: 398.6, alpha: 0 }, 6).to({ _off: true }, 12).wait(50));
            // CircleSym
            this.instance_37 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_37.setTransform(397.4, 398.6, 0.95, 0.95);
            this.instance_37.alpha = 0;
            this.instance_37._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_37).wait(24).to({ startPosition: 0, _off: false }, 0).to({ y: 464.7, alpha: 1 }, 6).to({ y: 457.4 }, 3).wait(311).to({ startPosition: 0 }, 0).to({ y: 464.7 }, 3).to({ y: 398.6, alpha: 0 }, 6).to({ _off: true }, 12).wait(50));
            // CircleSym
            this.instance_38 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_38.setTransform(317.2, 398.6, 0.95, 0.95);
            this.instance_38.alpha = 0;
            this.instance_38._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_38).wait(24).to({ startPosition: 0, _off: false }, 0).to({ y: 464.7, alpha: 1 }, 6).to({ y: 457.4 }, 3).wait(311).to({ startPosition: 0 }, 0).to({ y: 464.7 }, 3).to({ y: 398.6, alpha: 0 }, 6).to({ _off: true }, 12).wait(50));
            // CircleSym
            this.instance_39 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_39.setTransform(481.8, 220);
            this.instance_39.alpha = 0;
            this.instance_39._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_39).wait(22).to({ startPosition: 0, _off: false }, 0).to({ y: 286.1, alpha: 1 }, 6).to({ y: 278.8 }, 3).wait(313).to({ startPosition: 0 }, 0).to({ y: 286.1 }, 3).to({ y: 220, alpha: 0 }, 6).to({ _off: true }, 9).wait(53));
            // CircleSym
            this.instance_40 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_40.setTransform(397.4, 220);
            this.instance_40.alpha = 0;
            this.instance_40._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_40).wait(22).to({ startPosition: 0, _off: false }, 0).to({ y: 286.1, alpha: 1 }, 6).to({ y: 278.8 }, 3).wait(313).to({ startPosition: 0 }, 0).to({ y: 286.1 }, 3).to({ y: 220, alpha: 0 }, 6).to({ _off: true }, 9).wait(53));
            // CircleSym
            this.instance_41 = new fudaole.PickBonusLS.CircleSym_L("synched", 0);
            this.instance_41.setTransform(313, 220);
            this.instance_41.alpha = 0;
            this.instance_41._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_41).wait(22).to({ startPosition: 0, _off: false }, 0).to({ y: 286.1, alpha: 1 }, 6).to({ y: 278.8 }, 3).wait(313).to({ startPosition: 0 }, 0).to({ y: 286.1 }, 3).to({ y: 220, alpha: 0 }, 6).to({ _off: true }, 9).wait(53));
            // antiglow_MC
            this.AntiMini = new fudaole.PickBonusLS.antiglow_MC_L();
            this.AntiMini.setTransform(470.7, 779.6, 0.849, 0.849);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.AntiMini }] }).wait(415));
            // antiglow_MC
            this.AntiMinor = new fudaole.PickBonusLS.antiglow_MC_L();
            this.AntiMinor.setTransform(475.4, 627.6, 0.896, 0.896);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.AntiMinor }] }).wait(415));
            // antiglow_MC
            this.AntiMajor = new fudaole.PickBonusLS.antiglow_MC_L();
            this.AntiMajor.setTransform(478.5, 457.4, 0.945, 0.945);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.AntiMajor }] }).wait(415));
            // antiglow_MC
            this.AntiMaxi = new fudaole.PickBonusLS.antiglow_MC_L();
            this.AntiMaxi.setTransform(483.5, 279.1, 0.997, 0.997);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.AntiMaxi }] }).wait(415));
            // PMiniMeterSym
            this.instance_42 = new fudaole.PickBonusLS.PMiniMeterSym_L("synched", 0);
            this.instance_42.setTransform(543.7, 713.7);
            this.instance_42.alpha = 0;
            this.instance_42._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_42).wait(15).to({ startPosition: 0, _off: false }, 0).to({ x: 372.2, alpha: 1 }, 5).to({ x: 411.4 }, 3).to({ x: 396.7 }, 2).wait(319).to({ startPosition: 0 }, 0).to({ x: 411.4 }, 2).to({ x: 372.2 }, 7).to({ x: 543.7, alpha: 0 }, 6).to({ _off: true }, 1).wait(55));
            // PMinorMeterSym
            this.instance_43 = new fudaole.PickBonusLS.PMinorMeterSym_L("synched", 0);
            this.instance_43.setTransform(274.2, 559.3);
            this.instance_43.alpha = 0;
            this.instance_43._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_43).wait(15).to({ startPosition: 0, _off: false }, 0).to({ x: 421.2, alpha: 1 }, 5).to({ x: 379.6 }, 3).to({ x: 396.7 }, 2).wait(319).to({ startPosition: 0 }, 0).to({ x: 379.6 }, 2).to({ x: 421.2 }, 7).to({ x: 274.2, alpha: 0 }, 6).to({ _off: true }, 1).wait(55));
            // PMajorMeterSym
            this.instance_44 = new fudaole.PickBonusLS.PMajorMeterSym_L("synched", 0);
            this.instance_44.setTransform(543.7, 378.8);
            this.instance_44.alpha = 0;
            this.instance_44._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_44).wait(15).to({ startPosition: 0, _off: false }, 0).to({ x: 372.2, alpha: 1 }, 5).to({ x: 413.9 }, 3).to({ x: 396.7 }, 2).wait(319).to({ startPosition: 0 }, 0).to({ x: 413.9 }, 2).to({ x: 372.2 }, 7).to({ x: 543.7, alpha: 0 }, 6).to({ _off: true }, 1).wait(55));
            // PMaxiMeterSym
            this.instance_45 = new fudaole.PickBonusLS.PMaxiMeterSym_L("synched", 0);
            this.instance_45.setTransform(249.7, 210.7);
            this.instance_45.alpha = 0;
            this.instance_45._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_45).wait(15).to({ startPosition: 0, _off: false }, 0).to({ x: 421.2, alpha: 1 }, 5).to({ x: 379.6 }, 3).to({ x: 396.7 }, 2).wait(319).to({ startPosition: 0 }, 0).to({ x: 379.6 }, 2).to({ x: 421.2 }, 7).to({ x: 249.7, alpha: 0 }, 6).to({ _off: true }, 1).wait(55));
            // box
            this.instance_46 = new fudaole.PickBonusLS.box_L("synched", 0);
            this.instance_46.setTransform(396.7, 483.3, 0.9, 0.9);
            this.instance_46._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_46).wait(9).to({ startPosition: 0, _off: false }, 0).to({ scaleX: 1.04, scaleY: 1.04 }, 6).to({ scaleX: 1, scaleY: 1 }, 4).wait(327).to({ startPosition: 0 }, 0).to({ scaleX: 1.04, scaleY: 1.04 }, 4).to({ scaleX: 0.9, scaleY: 0.9, alpha: 0 }, 9).to({ _off: true }, 1).wait(55));
            // box glow
            this.instance_47 = new fudaole.PickBonusLS.GlowAnimMC_L();
            this.instance_47.setTransform(400.8, 511.1);
            this.instance_47._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_47).wait(15).to({ _off: false }, 0).to({ _off: true }, 342).wait(58));
            // box glow
            this.instance_48 = new fudaole.PickBonusLS.glowbg_L("synched", 0);
            this.instance_48.setTransform(400.8, 511.1, 0.9, 0.9);
            this.instance_48.alpha = 0;
            this.instance_48._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_48).wait(6).to({ startPosition: 0, _off: false }, 0).to({ scaleX: 1, scaleY: 1, alpha: 1 }, 6).to({ _off: true }, 3).wait(335).to({ startPosition: 0, _off: false }, 0).to({ scaleX: 0.9, scaleY: 0.9, alpha: 0 }, 9).to({ _off: true }, 1).wait(55));
            pickBtns.push(this.Pick00);
            pickBtns.push(this.Pick01);
            pickBtns.push(this.Pick02);
            pickBtns.push(this.Pick03);
            pickBtns.push(this.Pick04);
            pickBtns.push(this.Pick05);
            pickBtns.push(this.Pick06);
            pickBtns.push(this.Pick07);
            pickBtns.push(this.Pick08);
            pickBtns.push(this.Pick09);
            pickBtns.push(this.Pick10);
            pickBtns.push(this.Pick11);
            pickBtns.push(this.Pick12);
            pickBtns.push(this.Pick13);
            pickBtns.push(this.Pick14);
            this.Pick00.name = "Pick00";
            this.Pick01.name = "Pick01";
            this.Pick02.name = "Pick02";
            this.Pick03.name = "Pick03";
            this.Pick04.name = "Pick04";
            this.Pick05.name = "Pick05";
            this.Pick06.name = "Pick06";
            this.Pick07.name = "Pick07";
            this.Pick08.name = "Pick08";
            this.Pick09.name = "Pick09";
            this.Pick10.name = "Pick10";
            this.Pick11.name = "Pick11";
            this.Pick12.name = "Pick12";
            this.Pick13.name = "Pick13";
            this.Pick14.name = "Pick14";
            glowAnim.push(this.glow00);
            glowAnim.push(this.glow01);
            glowAnim.push(this.glow02);
            glowAnim.push(this.glow03);
            glowAnim.push(this.glow04);
            glowAnim.push(this.glow05);
            glowAnim.push(this.glow06);
            glowAnim.push(this.glow07);
            glowAnim.push(this.glow08);
            glowAnim.push(this.glow09);
            glowAnim.push(this.glow10);
            glowAnim.push(this.glow11);
            glowAnim.push(this.glow12);
            glowAnim.push(this.glow13);
            glowAnim.push(this.glow14);
            miniSmallRev.push(this.MiniRev01);
            miniSmallRev.push(this.MiniRev02);
            miniSmallRev.push(this.MiniRev03);
            minorSmallRev.push(this.MinorRev01);
            minorSmallRev.push(this.MinorRev02);
            minorSmallRev.push(this.MinorRev03);
            majorSmallRev.push(this.MajorRev01);
            majorSmallRev.push(this.MajorRev02);
            majorSmallRev.push(this.MajorRev03);
            maxiSmallRev.push(this.MaxiRev01);
            maxiSmallRev.push(this.MaxiRev02);
            maxiSmallRev.push(this.MaxiRev03);
            miniRev.push(this.MiniReveal01);
            miniRev.push(this.MiniReveal02);
            miniRev.push(this.MiniReveal03);
            minorRev.push(this.MinorReveal01);
            minorRev.push(this.MinorReveal02);
            minorRev.push(this.MinorReveal03);
            majorRev.push(this.MajorReveal01);
            majorRev.push(this.MajorReveal02);
            majorRev.push(this.MajorReveal03);
            maxiRev.push(this.MaxiReveal01);
            maxiRev.push(this.MaxiReveal02);
            maxiRev.push(this.MaxiReveal03);
            winnerTxt = this.WinnerBannerTxt;
            winnerValue = this.WinnerBannerTxtVal;
            introTxt = this.pickinfoTxt1;
            introValue = this.pickinfoTxt2;
            miniValue = this.MiniTxtVal;
            minorValue = this.MinorTxtVal;
            majorValue = this.MajorTxtVal;
            maxiValue = this.MaxiTxtVal;
            winnerMCs.push(this.MiniWinnerMC);
            winnerMCs.push(this.MinorWinnerMC);
            winnerMCs.push(this.MajorWinnerMC);
            winnerMCs.push(this.MaxiWinnerMC);
            antiAnim.push(this.AntiMini);
            antiAnim.push(this.AntiMinor);
            antiAnim.push(this.AntiMajor);
            antiAnim.push(this.AntiMaxi);
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-57.9, -57.1, 1866.8, 904.3);
        // symbols:
        (fudaole.PickBonusLS.anticipationglow2 = function () {
            this.initialize(fudaole.PickBonusLS.img.anticipationglow2);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 147, 144);
        (fudaole.PickBonusLS.bottomknot = function () {
            this.initialize(fudaole.PickBonusLS.img.bottomknot);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 117, 56);
        (fudaole.PickBonusLS.box = function () {
            this.initialize(fudaole.PickBonusLS.img.box);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 599, 810);
        (fudaole.PickBonusLS.boxglow = function () {
            this.initialize(fudaole.PickBonusLS.img.boxglow);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 833, 1137);
        (fudaole.PickBonusLS.coinglow = function () {
            this.initialize(fudaole.PickBonusLS.img.coinglow);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 186, 186);
        (fudaole.PickBonusLS.coinpick = function () {
            this.initialize(fudaole.PickBonusLS.img.coinpick);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 170, 169);
        (fudaole.PickBonusLS.gamelogo = function () {
            this.initialize(fudaole.PickBonusLS.img.gamelogo);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 630, 470);
        (fudaole.PickBonusLS.hangingboard = function () {
            this.initialize(fudaole.PickBonusLS.img.hangingboard);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 342, 178);
        (fudaole.PickBonusLS.majormeter = function () {
            this.initialize(fudaole.PickBonusLS.img.majormeter);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 395, 129);
        (fudaole.PickBonusLS.maximeter = function () {
            this.initialize(fudaole.PickBonusLS.img.maximeter);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 437, 145);
        (fudaole.PickBonusLS.minimeter = function () {
            this.initialize(fudaole.PickBonusLS.img.minimeter);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 277, 112);
        (fudaole.PickBonusLS.minormeter = function () {
            this.initialize(fudaole.PickBonusLS.img.minormeter);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 297, 119);
        (fudaole.PickBonusLS.pick_00000 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00000);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00001 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00001);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00002 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00002);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00003 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00003);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00004 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00004);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00005 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00005);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00006 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00006);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00007 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00007);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00008 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00008);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00009 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00009);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00010 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00010);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00011 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00011);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00012 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00012);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00013 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00013);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00014 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00014);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00015 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00015);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00016 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00016);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00017 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00017);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00018 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00018);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00019 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00019);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00020 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00020);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00021 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00021);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00022 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00022);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pick_00023 = function () {
            this.initialize(fudaole.PickBonusLS.img.pick_00023);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusLS.pickcircle = function () {
            this.initialize(fudaole.PickBonusLS.img.pickcircle);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusLS.pickindicator00 = function () {
            this.initialize(fudaole.PickBonusLS.img.pickindicator00);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusLS.pickindicator01 = function () {
            this.initialize(fudaole.PickBonusLS.img.pickindicator01);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusLS.pickindicator02 = function () {
            this.initialize(fudaole.PickBonusLS.img.pickindicator02);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusLS.pickindicator03 = function () {
            this.initialize(fudaole.PickBonusLS.img.pickindicator03);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusLS.pickinfo = function () {
            this.initialize(fudaole.PickBonusLS.img.pickinfo);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 1389, 1080);
        (fudaole.PickBonusLS.pickstate01 = function () {
            this.initialize(fudaole.PickBonusLS.img.pickstate01);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 238, 221);
        (fudaole.PickBonusLS.pickstate02 = function () {
            this.initialize(fudaole.PickBonusLS.img.pickstate02);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 238, 221);
        (fudaole.PickBonusLS.pickstate03 = function () {
            this.initialize(fudaole.PickBonusLS.img.pickstate03);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 238, 221);
        (fudaole.PickBonusLS.pickstate04 = function () {
            this.initialize(fudaole.PickBonusLS.img.pickstate04);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 238, 221);
        (fudaole.PickBonusLS.redefx_00001 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00001);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00003 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00003);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00005 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00005);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00007 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00007);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00009 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00009);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00011 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00011);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00013 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00013);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00015 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00015);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00017 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00017);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00019 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00019);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00021 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00021);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00023 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00023);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00025 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00025);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00027 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00027);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00029 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00029);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00031 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00031);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00033 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00033);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00035 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00035);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00037 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00037);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00039 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00039);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00041 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00041);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00043 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00043);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00045 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00045);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00047 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00047);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00049 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00049);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00051 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00051);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00053 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00053);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00055 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00055);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00057 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00057);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.redefx_00059 = function () {
            this.initialize(fudaole.PickBonusLS.img.redefx_00059);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusLS.shadow = function () {
            this.initialize(fudaole.PickBonusLS.img.shadow);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 667, 426);
        (fudaole.PickBonusLS.tassle = function () {
            this.initialize(fudaole.PickBonusLS.img.tassle);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 62, 189);
        (fudaole.PickBonusLS.threadbounce1 = function () {
            this.initialize(fudaole.PickBonusLS.img.threadbounce1);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 55, 381);
        (fudaole.PickBonusLS.threadbounce2 = function () {
            this.initialize(fudaole.PickBonusLS.img.threadbounce2);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 55, 381);
        (fudaole.PickBonusLS.threadbounce3 = function () {
            this.initialize(fudaole.PickBonusLS.img.threadbounce3);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 55, 381);
        (fudaole.PickBonusLS.upperknot = function () {
            this.initialize(fudaole.PickBonusLS.img.upperknot);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 102, 115);
        (fudaole.PickBonusLS.winnerbanner = function () {
            this.initialize(fudaole.PickBonusLS.img.winnerbanner);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 1080, 997);
        (fudaole.PickBonusLS.upperknot_PL = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.upperknot();
            this.instance.setTransform(-50.9, -57.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-50.9, -57.4, 102, 115);
        (fudaole.PickBonusLS.tussleGrap_PL = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.bottomknot();
            this.instance.setTransform(-58.4, -27.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-58.4, -27.9, 117, 56);
        (fudaole.PickBonusLS.thread3_PL = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.threadbounce3();
            this.instance.setTransform(-27.4, -190.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-27.4, -190.4, 55, 381);
        (fudaole.PickBonusLS.thread2_PL = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.threadbounce2();
            this.instance.setTransform(-27.4, -190.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-27.4, -190.4, 55, 381);
        (fudaole.PickBonusLS.thread1_PL = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.threadbounce1();
            this.instance.setTransform(-27.4, -205, 1, 1.038);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-27.4, -205, 55, 395.6);
        (fudaole.PickBonusLS.textback_L = function () {
            this.initialize();
            // Layer 2
            this.shape = new createjs.Shape();
            this.shape.graphics.lf(["rgba(255,255,255,0)", "rgba(255,255,255,0.667)", "rgba(205,215,247,0.867)", "rgba(255,255,255,0.867)", "rgba(207,213,248,0.867)", "rgba(255,255,255,0.686)", "rgba(255,255,255,0)"], [0.02, 0.118, 0.243, 0.471, 0.745, 0.878, 1], -397.9, 0.4, 402.9, 0.4).s().p("EhAcAANIAAgZMCA5AAAIAAAZg");
            this.shape.setTransform(0, 71.6);
            this.shape_1 = new createjs.Shape();
            this.shape_1.graphics.lf(["rgba(255,255,255,0)", "rgba(255,255,255,0.667)", "rgba(205,215,247,0.867)", "rgba(255,255,255,0.867)", "rgba(207,213,248,0.867)", "rgba(255,255,255,0.686)", "rgba(255,255,255,0)"], [0.02, 0.118, 0.243, 0.471, 0.745, 0.878, 1], -397.9, 0.4, 402.9, 0.4).s().p("EhAcAANIAAgZMCA5AAAIAAAZg");
            this.shape_1.setTransform(0, -71.3);
            // Layer 1
            this.shape_2 = new createjs.Shape();
            this.shape_2.graphics.lf(["rgba(51,0,102,0)", "rgba(51,0,102,0)", "rgba(51,0,204,0.671)", "rgba(51,0,109,0.867)", "rgba(51,0,112,0.859)", "rgba(51,0,193,0.69)", "rgba(51,0,102,0)"], [0, 0, 0.118, 0.243, 0.753, 0.878, 1], -397.9, 21.1, 402.9, 21.1).s().p("EhAcAK+IAA17MCA5AAAIAAV7g");
            this.addChild(this.shape_2, this.shape_1, this.shape);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-412.4, -72.6, 825.1, 145.6);
        (fudaole.PickBonusLS.tassleGrap_PL = function () {
            this.initialize();
            // Layer 2
            this.instance = new fudaole.PickBonusLS.tassle();
            this.instance.setTransform(-31.9, -109.1);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-31.9, -109.1, 62, 189);
        (fudaole.PickBonusLS.shadow_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.shadow();
            this.instance.setTransform(-333.4, -212.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-333.4, -212.9, 667, 426);
        (fudaole.PickBonusLS.RevealAnimGrap_PL = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 1
            this.instance = new fudaole.PickBonusLS.pick_00000();
            this.instance.setTransform(-74.9, -74.9);
            this.instance_1 = new fudaole.PickBonusLS.pick_00001();
            this.instance_1.setTransform(-74.9, -74.9);
            this.instance_2 = new fudaole.PickBonusLS.pick_00002();
            this.instance_2.setTransform(-74.9, -74.9);
            this.instance_3 = new fudaole.PickBonusLS.pick_00003();
            this.instance_3.setTransform(-74.9, -74.9);
            this.instance_4 = new fudaole.PickBonusLS.pick_00004();
            this.instance_4.setTransform(-74.9, -74.9);
            this.instance_5 = new fudaole.PickBonusLS.pick_00005();
            this.instance_5.setTransform(-74.9, -74.9);
            this.instance_6 = new fudaole.PickBonusLS.pick_00006();
            this.instance_6.setTransform(-74.9, -74.9);
            this.instance_7 = new fudaole.PickBonusLS.pick_00007();
            this.instance_7.setTransform(-74.9, -74.9);
            this.instance_8 = new fudaole.PickBonusLS.pick_00008();
            this.instance_8.setTransform(-74.9, -74.9);
            this.instance_9 = new fudaole.PickBonusLS.pick_00009();
            this.instance_9.setTransform(-74.9, -74.9);
            this.instance_10 = new fudaole.PickBonusLS.pick_00010();
            this.instance_10.setTransform(-74.9, -74.9);
            this.instance_11 = new fudaole.PickBonusLS.pick_00011();
            this.instance_11.setTransform(-74.9, -74.9);
            this.instance_12 = new fudaole.PickBonusLS.pick_00012();
            this.instance_12.setTransform(-74.9, -74.9);
            this.instance_13 = new fudaole.PickBonusLS.pick_00013();
            this.instance_13.setTransform(-74.9, -74.9);
            this.instance_14 = new fudaole.PickBonusLS.pick_00014();
            this.instance_14.setTransform(-74.9, -74.9);
            this.instance_15 = new fudaole.PickBonusLS.pick_00015();
            this.instance_15.setTransform(-74.9, -74.9);
            this.instance_16 = new fudaole.PickBonusLS.pick_00016();
            this.instance_16.setTransform(-74.9, -74.9);
            this.instance_17 = new fudaole.PickBonusLS.pick_00017();
            this.instance_17.setTransform(-74.9, -74.9);
            this.instance_18 = new fudaole.PickBonusLS.pick_00018();
            this.instance_18.setTransform(-74.9, -74.9);
            this.instance_19 = new fudaole.PickBonusLS.pick_00019();
            this.instance_19.setTransform(-74.9, -74.9);
            this.instance_20 = new fudaole.PickBonusLS.pick_00020();
            this.instance_20.setTransform(-74.9, -74.9);
            this.instance_21 = new fudaole.PickBonusLS.pick_00021();
            this.instance_21.setTransform(-74.9, -74.9);
            this.instance_22 = new fudaole.PickBonusLS.pick_00022();
            this.instance_22.setTransform(-74.9, -74.9);
            this.instance_23 = new fudaole.PickBonusLS.pick_00023();
            this.instance_23.setTransform(-74.9, -74.9);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).to({ state: [{ t: this.instance_1 }] }, 1).to({ state: [{ t: this.instance_2 }] }, 1).to({ state: [{ t: this.instance_3 }] }, 1).to({ state: [{ t: this.instance_4 }] }, 1).to({ state: [{ t: this.instance_5 }] }, 1).to({ state: [{ t: this.instance_6 }] }, 1).to({ state: [{ t: this.instance_7 }] }, 1).to({ state: [{ t: this.instance_8 }] }, 1).to({ state: [{ t: this.instance_9 }] }, 1).to({ state: [{ t: this.instance_10 }] }, 1).to({ state: [{ t: this.instance_11 }] }, 1).to({ state: [{ t: this.instance_12 }] }, 1).to({ state: [{ t: this.instance_13 }] }, 1).to({ state: [{ t: this.instance_14 }] }, 1).to({ state: [{ t: this.instance_15 }] }, 1).to({ state: [{ t: this.instance_16 }] }, 1).to({ state: [{ t: this.instance_17 }] }, 1).to({ state: [{ t: this.instance_18 }] }, 1).to({ state: [{ t: this.instance_19 }] }, 1).to({ state: [{ t: this.instance_20 }] }, 1).to({ state: [{ t: this.instance_21 }] }, 1).to({ state: [{ t: this.instance_22 }] }, 1).to({ state: [{ t: this.instance_23 }] }, 1).wait(1));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-74.9, -74.9, 150, 150);
        (fudaole.PickBonusLS.RevealAnimGrap_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 1
            this.instance = new fudaole.PickBonusLS.pick_00000();
            this.instance.setTransform(-74.9, -74.9);
            this.instance_1 = new fudaole.PickBonusLS.pick_00001();
            this.instance_1.setTransform(-74.9, -74.9);
            this.instance_2 = new fudaole.PickBonusLS.pick_00002();
            this.instance_2.setTransform(-74.9, -74.9);
            this.instance_3 = new fudaole.PickBonusLS.pick_00003();
            this.instance_3.setTransform(-74.9, -74.9);
            this.instance_4 = new fudaole.PickBonusLS.pick_00004();
            this.instance_4.setTransform(-74.9, -74.9);
            this.instance_5 = new fudaole.PickBonusLS.pick_00005();
            this.instance_5.setTransform(-74.9, -74.9);
            this.instance_6 = new fudaole.PickBonusLS.pick_00006();
            this.instance_6.setTransform(-74.9, -74.9);
            this.instance_7 = new fudaole.PickBonusLS.pick_00007();
            this.instance_7.setTransform(-74.9, -74.9);
            this.instance_8 = new fudaole.PickBonusLS.pick_00008();
            this.instance_8.setTransform(-74.9, -74.9);
            this.instance_9 = new fudaole.PickBonusLS.pick_00009();
            this.instance_9.setTransform(-74.9, -74.9);
            this.instance_10 = new fudaole.PickBonusLS.pick_00010();
            this.instance_10.setTransform(-74.9, -74.9);
            this.instance_11 = new fudaole.PickBonusLS.pick_00011();
            this.instance_11.setTransform(-74.9, -74.9);
            this.instance_12 = new fudaole.PickBonusLS.pick_00012();
            this.instance_12.setTransform(-74.9, -74.9);
            this.instance_13 = new fudaole.PickBonusLS.pick_00013();
            this.instance_13.setTransform(-74.9, -74.9);
            this.instance_14 = new fudaole.PickBonusLS.pick_00014();
            this.instance_14.setTransform(-74.9, -74.9);
            this.instance_15 = new fudaole.PickBonusLS.pick_00015();
            this.instance_15.setTransform(-74.9, -74.9);
            this.instance_16 = new fudaole.PickBonusLS.pick_00016();
            this.instance_16.setTransform(-74.9, -74.9);
            this.instance_17 = new fudaole.PickBonusLS.pick_00017();
            this.instance_17.setTransform(-74.9, -74.9);
            this.instance_18 = new fudaole.PickBonusLS.pick_00018();
            this.instance_18.setTransform(-74.9, -74.9);
            this.instance_19 = new fudaole.PickBonusLS.pick_00019();
            this.instance_19.setTransform(-74.9, -74.9);
            this.instance_20 = new fudaole.PickBonusLS.pick_00020();
            this.instance_20.setTransform(-74.9, -74.9);
            this.instance_21 = new fudaole.PickBonusLS.pick_00021();
            this.instance_21.setTransform(-74.9, -74.9);
            this.instance_22 = new fudaole.PickBonusLS.pick_00022();
            this.instance_22.setTransform(-74.9, -74.9);
            this.instance_23 = new fudaole.PickBonusLS.pick_00023();
            this.instance_23.setTransform(-74.9, -74.9);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).to({ state: [{ t: this.instance_1 }] }, 1).to({ state: [{ t: this.instance_2 }] }, 1).to({ state: [{ t: this.instance_3 }] }, 1).to({ state: [{ t: this.instance_4 }] }, 1).to({ state: [{ t: this.instance_5 }] }, 1).to({ state: [{ t: this.instance_6 }] }, 1).to({ state: [{ t: this.instance_7 }] }, 1).to({ state: [{ t: this.instance_8 }] }, 1).to({ state: [{ t: this.instance_9 }] }, 1).to({ state: [{ t: this.instance_10 }] }, 1).to({ state: [{ t: this.instance_11 }] }, 1).to({ state: [{ t: this.instance_12 }] }, 1).to({ state: [{ t: this.instance_13 }] }, 1).to({ state: [{ t: this.instance_14 }] }, 1).to({ state: [{ t: this.instance_15 }] }, 1).to({ state: [{ t: this.instance_16 }] }, 1).to({ state: [{ t: this.instance_17 }] }, 1).to({ state: [{ t: this.instance_18 }] }, 1).to({ state: [{ t: this.instance_19 }] }, 1).to({ state: [{ t: this.instance_20 }] }, 1).to({ state: [{ t: this.instance_21 }] }, 1).to({ state: [{ t: this.instance_22 }] }, 1).to({ state: [{ t: this.instance_23 }] }, 1).wait(1));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-74.9, -74.9, 150, 150);
        (fudaole.PickBonusLS.reeffects_l = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 2
            this.instance = new fudaole.PickBonusLS.redefx_00001();
            this.instance.setTransform(26.6, 122.4);
            this.instance_1 = new fudaole.PickBonusLS.redefx_00003();
            this.instance_1.setTransform(26.6, 122.4);
            this.instance_2 = new fudaole.PickBonusLS.redefx_00005();
            this.instance_2.setTransform(26.6, 122.4);
            this.instance_3 = new fudaole.PickBonusLS.redefx_00007();
            this.instance_3.setTransform(26.6, 122.4);
            this.instance_4 = new fudaole.PickBonusLS.redefx_00009();
            this.instance_4.setTransform(26.6, 122.4);
            this.instance_5 = new fudaole.PickBonusLS.redefx_00011();
            this.instance_5.setTransform(26.6, 122.4);
            this.instance_6 = new fudaole.PickBonusLS.redefx_00013();
            this.instance_6.setTransform(26.6, 122.4);
            this.instance_7 = new fudaole.PickBonusLS.redefx_00015();
            this.instance_7.setTransform(26.6, 122.4);
            this.instance_8 = new fudaole.PickBonusLS.redefx_00017();
            this.instance_8.setTransform(26.6, 122.4);
            this.instance_9 = new fudaole.PickBonusLS.redefx_00019();
            this.instance_9.setTransform(26.6, 122.4);
            this.instance_10 = new fudaole.PickBonusLS.redefx_00021();
            this.instance_10.setTransform(26.6, 122.4);
            this.instance_11 = new fudaole.PickBonusLS.redefx_00023();
            this.instance_11.setTransform(26.6, 122.4);
            this.instance_12 = new fudaole.PickBonusLS.redefx_00025();
            this.instance_12.setTransform(26.6, 122.4);
            this.instance_13 = new fudaole.PickBonusLS.redefx_00027();
            this.instance_13.setTransform(26.6, 122.4);
            this.instance_14 = new fudaole.PickBonusLS.redefx_00029();
            this.instance_14.setTransform(26.6, 122.4);
            this.instance_15 = new fudaole.PickBonusLS.redefx_00031();
            this.instance_15.setTransform(26.6, 122.4);
            this.instance_16 = new fudaole.PickBonusLS.redefx_00033();
            this.instance_16.setTransform(26.6, 122.4);
            this.instance_17 = new fudaole.PickBonusLS.redefx_00035();
            this.instance_17.setTransform(26.6, 122.4);
            this.instance_18 = new fudaole.PickBonusLS.redefx_00037();
            this.instance_18.setTransform(26.6, 122.4);
            this.instance_19 = new fudaole.PickBonusLS.redefx_00039();
            this.instance_19.setTransform(26.6, 122.4);
            this.instance_20 = new fudaole.PickBonusLS.redefx_00041();
            this.instance_20.setTransform(26.6, 122.4);
            this.instance_21 = new fudaole.PickBonusLS.redefx_00043();
            this.instance_21.setTransform(26.6, 122.4);
            this.instance_22 = new fudaole.PickBonusLS.redefx_00045();
            this.instance_22.setTransform(26.6, 122.4);
            this.instance_23 = new fudaole.PickBonusLS.redefx_00047();
            this.instance_23.setTransform(26.6, 122.4);
            this.instance_24 = new fudaole.PickBonusLS.redefx_00049();
            this.instance_24.setTransform(26.6, 122.4);
            this.instance_25 = new fudaole.PickBonusLS.redefx_00051();
            this.instance_25.setTransform(26.6, 122.4);
            this.instance_26 = new fudaole.PickBonusLS.redefx_00053();
            this.instance_26.setTransform(26.6, 122.4);
            this.instance_27 = new fudaole.PickBonusLS.redefx_00055();
            this.instance_27.setTransform(26.6, 122.4);
            this.instance_28 = new fudaole.PickBonusLS.redefx_00057();
            this.instance_28.setTransform(26.6, 122.4);
            this.instance_29 = new fudaole.PickBonusLS.redefx_00059();
            this.instance_29.setTransform(26.6, 122.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).to({ state: [{ t: this.instance_1 }] }, 2).to({ state: [{ t: this.instance_2 }] }, 2).to({ state: [{ t: this.instance_3 }] }, 2).to({ state: [{ t: this.instance_4 }] }, 2).to({ state: [{ t: this.instance_5 }] }, 2).to({ state: [{ t: this.instance_6 }] }, 2).to({ state: [{ t: this.instance_7 }] }, 2).to({ state: [{ t: this.instance_8 }] }, 2).to({ state: [{ t: this.instance_9 }] }, 2).to({ state: [{ t: this.instance_10 }] }, 2).to({ state: [{ t: this.instance_11 }] }, 2).to({ state: [{ t: this.instance_12 }] }, 2).to({ state: [{ t: this.instance_13 }] }, 2).to({ state: [{ t: this.instance_14 }] }, 2).to({ state: [{ t: this.instance_15 }] }, 2).to({ state: [{ t: this.instance_16 }] }, 2).to({ state: [{ t: this.instance_17 }] }, 2).to({ state: [{ t: this.instance_18 }] }, 2).to({ state: [{ t: this.instance_19 }] }, 2).to({ state: [{ t: this.instance_20 }] }, 2).to({ state: [{ t: this.instance_21 }] }, 2).to({ state: [{ t: this.instance_22 }] }, 2).to({ state: [{ t: this.instance_23 }] }, 2).to({ state: [{ t: this.instance_24 }] }, 2).to({ state: [{ t: this.instance_25 }] }, 2).to({ state: [{ t: this.instance_26 }] }, 2).to({ state: [{ t: this.instance_27 }] }, 2).to({ state: [{ t: this.instance_28 }] }, 2).to({ state: [{ t: this.instance_29 }] }, 2).wait(17));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(26.6, 122.4, 550, 600);
        (fudaole.PickBonusLS.PMinorMeterSym_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.minormeter();
            this.instance.setTransform(-148.4, -59.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-148.4, -59.4, 297, 119);
        (fudaole.PickBonusLS.PMiniMeterSym_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.minimeter();
            this.instance.setTransform(-138.4, -55.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-138.4, -55.9, 277, 112);
        (fudaole.PickBonusLS.PMaxiMeterSym_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.maximeter();
            this.instance.setTransform(-218.4, -72.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-218.4, -72.4, 437, 145);
        (fudaole.PickBonusLS.PMajorMeterSym_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.majormeter();
            this.instance.setTransform(-197.4, -64.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-197.4, -64.4, 395, 129);
        (fudaole.PickBonusLS.pickinfomsg_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.pickinfo();
            this.instance.setTransform(-747.8, -539.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-747.8, -539.9, 1389, 1080);
        (fudaole.PickBonusLS.PickIndicator03_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.pickindicator03();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusLS.PickIndicator02_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.pickindicator02();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusLS.PickIndicator01_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.pickindicator01();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusLS.PickIndicator00_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.pickindicator00();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusLS.hangboard_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.hangingboard();
            this.instance.setTransform(-170.9, -88.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-170.9, -88.9, 342, 178);
        (fudaole.PickBonusLS.glowbg_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.boxglow();
            this.instance.setTransform(-416.4, -568.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-416.4, -568.4, 833, 1137);
        (fudaole.PickBonusLS.GameLogo_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.gamelogo();
            this.instance.setTransform(-314.9, -234.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-314.9, -234.9, 630, 470);
        (fudaole.PickBonusLS.CoinGrapSym_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.coinpick();
            this.instance.setTransform(-84.9, -84.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-84.9, -84.4, 170, 169);
        (fudaole.PickBonusLS.CoinGlowGrap_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.coinglow();
            this.instance.setTransform(-92.9, -92.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-92.9, -92.9, 186, 186);
        (fudaole.PickBonusLS.CircleSym_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.pickcircle();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusLS.box_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.box();
            this.instance.setTransform(-299.4, -404.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-299.4, -404.9, 599, 810);
        (fudaole.PickBonusLS.bannerwinner_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.winnerbanner();
            this.instance.setTransform(-539.9, -498.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-539.9, -498.4, 1080, 997);
        (fudaole.PickBonusLS.anticipglowgrap_L = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusLS.anticipationglow2();
            this.instance.setTransform(-73.4, -71.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-73.4, -71.9, 147, 144);
        (fudaole.PickBonusLS.WinnerGlowMCL = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { Start: 0, End: 23 });
            // RevealAnimGrap_P
            this.instance = new fudaole.PickBonusLS.RevealAnimGrap_PL("synched", 0, false);
            this.instance.setTransform(1.6, 0.1, 3.427, 3.427);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // RevealAnimGrap_P
            this.instance_1 = new fudaole.PickBonusLS.RevealAnimGrap_PL("synched", 0, false);
            this.instance_1.setTransform(-181.9, 3.5, 3.206, 3.206);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance_1 }] }).wait(30));
            // RevealAnimGrap_P
            this.instance_2 = new fudaole.PickBonusLS.RevealAnimGrap_PL("synched", 0, false);
            this.instance_2.setTransform(178.5, 0.1, 3.206, 3.206);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance_2 }] }).wait(30));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-422.3, -256.9, 841.4, 514);
        (fudaole.PickBonusLS.PickState03_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { "Start": 0, hide: 3, "End": 24 });
            // Layer 3
            this.instance = new fudaole.PickBonusLS.RevealAnimGrap_L("synched", 0, false);
            this.instance.setTransform(-2.7, 6.4, 2.25, 2.25);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusLS.pickstate04();
            this.instance_1.setTransform(-118.9, -110.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.instance_1 }] }, 10).wait(20));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-171.5, -162.3, 337.5, 337.5);
        (fudaole.PickBonusLS.PickState02_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { "Start": 0, "hide": 3, "End": 24 });
            // Layer 3
            this.instance = new fudaole.PickBonusLS.RevealAnimGrap_L("synched", 0, false);
            this.instance.setTransform(-2.7, 6.4, 2.25, 2.25);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusLS.pickstate03();
            this.instance_1.setTransform(-118.9, -110.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.instance_1 }] }, 10).wait(20));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-171.5, -162.3, 337.5, 337.5);
        (fudaole.PickBonusLS.PickState01_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { "Start": 0, "hide": 3, "End": 24 });
            // Layer 3
            this.instance = new fudaole.PickBonusLS.RevealAnimGrap_L("synched", 0, false);
            this.instance.setTransform(-2.7, 6.4, 2.25, 2.25);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusLS.pickstate02();
            this.instance_1.setTransform(-118.9, -110.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.instance_1 }] }, 10).wait(20));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-171.5, -162.3, 337.5, 337.5);
        (fudaole.PickBonusLS.PickState00_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { "Start": 0, "hide": 3, "End": 24 });
            // Layer 3
            this.instance = new fudaole.PickBonusLS.RevealAnimGrap_L("synched", 0, false);
            this.instance.setTransform(-2.7, 6.4, 2.25, 2.25);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusLS.pickstate01();
            this.instance_1.setTransform(-118.9, -110.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.instance_1 }] }, 10).wait(20));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-171.5, -162.3, 337.5, 337.5);
        (fudaole.PickBonusLS.PickBtn_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 1
            this.instance = new fudaole.PickBonusLS.CoinGrapSym_L("synched", 0);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(4));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-84.9, -84.4, 170, 169);
        (fudaole.PickBonusLS.LHangingAnimMC_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 8
            this.instance = new fudaole.PickBonusLS.upperknot_PL("synched", 0);
            this.instance.setTransform(-185.5, -1373.2);
            this.timeline.addTween(createjs.Tween.get(this.instance).to({ y: -780.6 }, 7).to({ y: -306.6 }, 5).wait(411));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusLS.hangboard_L("synched", 0);
            this.instance_1.setTransform(-187.7, -1156.9, 1, 1, 0, 0, 0, -7.3, -79.9);
            this.timeline.addTween(createjs.Tween.get(this.instance_1).to({ y: -536.4 }, 7).to({ x: -183.2, y: -101.9 }, 7).to({ x: -184.3, y: -53.5 }, 8).to({ rotation: -2.5, x: -196.4, y: -161.3 }, 14).to({ startPosition: 0 }, 6).to({ rotation: -0.5, x: -183.2, y: -101.8 }, 8).to({ regY: -79.9, rotation: 0, x: -175.5, y: -84.3 }, 7).to({ regY: -79.8, rotation: -0.6, x: -181, y: -121.6 }, 6).to({ rotation: 1.7, x: -192, y: -88.6 }, 12).to({ rotation: 0, x: -186.5, y: -100.7 }, 10).wait(338));
            // Layer 3
            this.instance_2 = new fudaole.PickBonusLS.thread3_PL("synched", 0);
            this.instance_2.setTransform(-183.3, -343.8, 1.053, 1, 0, -3.2, 176.7, -7.4, -160.1);
            this.instance_2._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_2).wait(33).to({ startPosition: 0, _off: false }, 0).wait(4).to({ skewX: -2.6, skewY: 177.2 }, 0).to({ skewX: -2.3, skewY: 177.5 }, 5).to({ skewX: -5, skewY: 174.8 }, 6).to({ _off: true }, 2).wait(8).to({ skewX: -4.9, skewY: 174.9, y: -343.6, _off: false }, 0).to({ regX: -7.2, regY: -160.1, skewX: -4.4, skewY: 175.4, x: -183.3, y: -343.7 }, 4).to({ _off: true }, 4).wait(357));
            // Layer 4
            this.instance_3 = new fudaole.PickBonusLS.thread2_PL("synched", 0);
            this.instance_3.setTransform(-180.3, -183.8);
            this.instance_3._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_3).wait(30).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 3).wait(17).to({ regX: -4.5, regY: -167.7, rotation: -2.3, x: -184.8, y: -351.4, _off: false }, 0).to({ _off: true }, 4).wait(12).to({ regX: -7.7, regY: -155.2, rotation: -1.6, x: -188, y: -338.9, _off: false }, 0).to({ rotation: -0.6 }, 5).to({ rotation: 0 }, 6).to({ regX: -7.6, rotation: -1.1, x: -187.9 }, 4).to({ regY: -155.1, rotation: -1.8 }, 4).wait(338));
            // Layer 5
            this.instance_4 = new fudaole.PickBonusLS.thread1_PL("synched", 0);
            this.instance_4.setTransform(-183.4, -1412.4, 1, 1.636);
            this.timeline.addTween(createjs.Tween.get(this.instance_4).to({ scaleY: 1, y: -171.3 }, 12).to({ startPosition: 0 }, 10).to({ _off: true }, 8).wait(24).to({ regX: -6.1, regY: -174, rotation: -1.5, x: -189.5, y: -345.3, _off: false }, 0).to({ _off: true }, 4).wait(365));
            // Layer 6
            this.instance_5 = new fudaole.PickBonusLS.tussleGrap_PL("synched", 0);
            this.instance_5.setTransform(-180.5, -612.1, 1, 1, 10.2, 0, 0, 0.1, -24.8);
            this.timeline.addTween(createjs.Tween.get(this.instance_5).to({ regX: 0, regY: -24.6, scaleX: 1, scaleY: 1, rotation: 10.1, x: -181.2, y: 69.2 }, 6).to({ rotation: 10, x: -180.4, y: 161.9 }, 2).to({ regX: 0.1, regY: -24.7, scaleX: 1, scaleY: 1, rotation: 10.2, x: -181.8, y: 538.5 }, 5).to({ regX: 0, rotation: 8.6, x: -182.6, y: 588.2 }, 4).to({ regX: 0.1, rotation: 7.3, x: -183.3, y: 668.6 }, 5).to({ rotation: -12.5, x: -188.7, y: 540 }, 14).to({ regX: 0.2, rotation: -7.6, x: -181.8, y: 502.3 }, 6).to({ rotation: -0.4, x: -181.9, y: 572 }, 6).to({ regX: 0.3, rotation: 9.4, x: -159.4, y: 619.6 }, 6).to({ regX: 0.2, rotation: 3.7, x: -183.3, y: 560.7 }, 12).to({ x: -193.1, y: 588.7 }, 9).to({ rotation: 0, x: -186.1, y: 577.5 }, 11).wait(337));
            // Layer 2
            this.instance_6 = new fudaole.PickBonusLS.tassleGrap_PL("synched", 0);
            this.instance_6.setTransform(-184.5, -564.4, 1, 1, 9, 0, 0, 2.6, -91.1);
            this.timeline.addTween(createjs.Tween.get(this.instance_6).to({ regY: -91.1, rotation: 8.3, x: -185.6, y: 109.1 }, 6).to({ y: 203.1 }, 2).to({ scaleX: 1, scaleY: 1, rotation: 7.8, x: -186.5, y: 578.6 }, 5).to({ regY: -91, rotation: 7.3, x: -186.9, y: 635.2 }, 4).to({ regY: -91.2, scaleX: 1, scaleY: 1, rotation: 7.2, x: -187.6, y: 705.7 }, 5).to({ regY: -91.1, rotation: -7.8, x: -179, y: 573.9 }, 14).to({ rotation: -7.9, x: -172, y: 540.1 }, 6).to({ rotation: -1.2, x: -185, y: 601.3 }, 6).to({ regY: -91, rotation: 7.9, x: -164.2, y: 657.2 }, 6).to({ rotation: 2.6, x: -184.9, y: 601.9 }, 12).to({ regY: -91.1, rotation: 3.9, x: -196.7, y: 628.6 }, 9).to({ regX: 2.7, rotation: 1.9, x: -186.2, y: 615.6 }, 11).wait(337));
            // Layer 7
            this.instance_7 = new fudaole.PickBonusLS.thread1_PL("synched", 0);
            this.instance_7.setTransform(-187.1, -1146.1, 1, 1.731, 0, 0, 0, -3.7, -163.9);
            this.timeline.addTween(createjs.Tween.get(this.instance_7).to({ y: -517.1 }, 6).to({ y: -295.7 }, 2).to({ y: -1 }, 5).to({ y: 77.6 }, 4).to({ y: 133.4 }, 5).to({ rotation: -0.3, x: -186.9, y: 16.4 }, 14).to({ rotation: -0.7, y: -1 }, 6).to({ regY: -163.9, rotation: 0, y: 25 }, 6).to({ rotation: -1.3, x: -180, y: 84.5 }, 6).to({ rotation: 0.4, x: -183.4, y: 40.8 }, 12).to({ rotation: 0.1, x: -195.7, y: 61.8 }, 9).to({ rotation: 0.1, x: -187, y: 56.6 }, 11).wait(337));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-351.5, -1747.9, 342, 1356.6);
        (fudaole.PickBonusLS.GlowAnimMC_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 1
            this.instance = new fudaole.PickBonusLS.glowbg_L("synched", 0);
            this.instance.alpha = 0.441;
            this.timeline.addTween(createjs.Tween.get(this.instance).to({ scaleX: 0.92, scaleY: 0.92, alpha: 0.609 }, 20).to({ scaleX: 1, scaleY: 1, alpha: 0.441 }, 20).wait(1));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-416.4, -568.4, 833, 1137);
        (fudaole.PickBonusLS.coinglowAnim_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 2
            this.instance = new fudaole.PickBonusLS.CoinGlowGrap_L("synched", 0);
            this.instance.alpha = 0;
            this.timeline.addTween(createjs.Tween.get(this.instance).to({ alpha: 0.25 }, 11, createjs.Ease.get(-0.99)).to({ alpha: 0.711 }, 8).to({ alpha: 0.25 }, 8).to({ alpha: 0 }, 12, createjs.Ease.get(1)).wait(1));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-92.9, -92.9, 186, 186);
        (fudaole.PickBonusLS.antiglow_MC_L = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 1
            this.instance = new fudaole.PickBonusLS.anticipglowgrap_L("synched", 0);
            this.instance.setTransform(0, 0, 0.95, 0.95);
            this.timeline.addTween(createjs.Tween.get(this.instance).to({ scaleX: 1, scaleY: 1, alpha: 0 }, 4).to({ scaleX: 0.95, scaleY: 0.95, alpha: 1 }, 4).wait(1));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-69.7, -68.3, 139.6, 136.8);
})(fudaole);
(function(fudaole) {
fudaole.PickBonusPT = {};
        var p; // shortcut to reference prototypes
        fudaole.PickBonusPT.img = {};
        var btn0 = 0;
        var btn1 = 1;
        var btn2 = 2;
        var btn3 = 3;
        var pickBtns = [];
        var miniRev = [];
        var minorRev = [];
        var majorRev = [];
        var maxiRev = [];
        var miniSmallRev = [];
        var minorSmallRev = [];
        var majorSmallRev = [];
        var maxiSmallRev = [];
        var winnerTxt;
        var winnerValue;
        var introTxt;
        var introValue;
        var miniValue;
        var minorValue;
        var majorValue;
        var maxiValue;
        var countMini = 0;
        var countMinor = 0;
        var countMajor = 0;
        var countMaxi = 0;
        var winnerMCs = [];
        var winlistener;
        var winnerMC;
        var listener;
        var glowAnim = [];
        var antiAnim = [];
        var winnerTableTxt;
        var endOutro;
        var winValue;
        var winTxt;
        var index = 0;
        // PickBonusPT properties:
        fudaole.PickBonusPT.init = function () {
            var manifest = [
                { src: "pickbonus/images/anticipationglow2.png", id: "anticipationglow2" },
                { src: "pickbonus/images/behindlogo.png", id: "behindlogo" },
                { src: "pickbonus/images/bottomknot.png", id: "bottomknot" },
                { src: "pickbonus/images/coinglow.png", id: "coinglow" },
                { src: "pickbonus/images/coinpick.png", id: "coinpick" },
                { src: "pickbonus/images/gamelogo.png", id: "gamelogo" },
                { src: "pickbonus/images/hangingboard.png", id: "hangingboard" },
                { src: "pickbonus/images/pick_00000.png", id: "pick_00000" },
                { src: "pickbonus/images/pick_00001.png", id: "pick_00001" },
                { src: "pickbonus/images/pick_00002.png", id: "pick_00002" },
                { src: "pickbonus/images/pick_00003.png", id: "pick_00003" },
                { src: "pickbonus/images/pick_00004.png", id: "pick_00004" },
                { src: "pickbonus/images/pick_00005.png", id: "pick_00005" },
                { src: "pickbonus/images/pick_00006.png", id: "pick_00006" },
                { src: "pickbonus/images/pick_00007.png", id: "pick_00007" },
                { src: "pickbonus/images/pick_00008.png", id: "pick_00008" },
                { src: "pickbonus/images/pick_00009.png", id: "pick_00009" },
                { src: "pickbonus/images/pick_00010.png", id: "pick_00010" },
                { src: "pickbonus/images/pick_00011.png", id: "pick_00011" },
                { src: "pickbonus/images/pick_00012.png", id: "pick_00012" },
                { src: "pickbonus/images/pick_00013.png", id: "pick_00013" },
                { src: "pickbonus/images/pick_00014.png", id: "pick_00014" },
                { src: "pickbonus/images/pick_00015.png", id: "pick_00015" },
                { src: "pickbonus/images/pick_00016.png", id: "pick_00016" },
                { src: "pickbonus/images/pick_00017.png", id: "pick_00017" },
                { src: "pickbonus/images/pick_00018.png", id: "pick_00018" },
                { src: "pickbonus/images/pick_00019.png", id: "pick_00019" },
                { src: "pickbonus/images/pick_00020.png", id: "pick_00020" },
                { src: "pickbonus/images/pick_00021.png", id: "pick_00021" },
                { src: "pickbonus/images/pick_00022.png", id: "pick_00022" },
                { src: "pickbonus/images/pick_00023.png", id: "pick_00023" },
                { src: "pickbonus/images/pickcircle.png", id: "pickcircle" },
                { src: "pickbonus/images/pickindicator00.png", id: "pickindicator00" },
                { src: "pickbonus/images/pickindicator01.png", id: "pickindicator01" },
                { src: "pickbonus/images/pickindicator02.png", id: "pickindicator02" },
                { src: "pickbonus/images/pickindicator03.png", id: "pickindicator03" },
                { src: "pickbonus/images/pickinfo.png", id: "pickinfo" },
                { src: "pickbonus/images/pickstate01.png", id: "pickstate01" },
                { src: "pickbonus/images/pickstate02.png", id: "pickstate02" },
                { src: "pickbonus/images/pickstate03.png", id: "pickstate03" },
                { src: "pickbonus/images/pickstate04.png", id: "pickstate04" },
                { src: "pickbonus/images/pmajorglow.png", id: "pmajorglow" },
                { src: "pickbonus/images/pmaxiglow.png", id: "pmaxiglow" },
                { src: "pickbonus/images/pminiglow.png", id: "pminiglow" },
                { src: "pickbonus/images/ppickmajormeter.png", id: "ppickmajormeter" },
                { src: "pickbonus/images/ppickmaximeter.png", id: "ppickmaximeter" },
                { src: "pickbonus/images/ppickminimeter.png", id: "ppickminimeter" },
                { src: "pickbonus/images/ppickminormeter.png", id: "ppickminormeter" },
                { src: "pickbonus/images/tassle.png", id: "tassle" },
                { src: "pickbonus/images/threadbounce1.png", id: "threadbounce1" },
                { src: "pickbonus/images/threadbounce2.png", id: "threadbounce2" },
                { src: "pickbonus/images/threadbounce3.png", id: "threadbounce3" },
                { src: "pickbonus/images/upperknot.png", id: "upperknot" },
                { src: "pickbonus/images/winnerbanner.png", id: "winnerbanner" },
                { src: "redEnv/redefx_00001.png", id: "redefx_00001" },
                { src: "redEnv/redefx_00003.png", id: "redefx_00003" },
                { src: "redEnv/redefx_00005.png", id: "redefx_00005" },
                { src: "redEnv/redefx_00007.png", id: "redefx_00007" },
                { src: "redEnv/redefx_00009.png", id: "redefx_00009" },
                { src: "redEnv/redefx_00011.png", id: "redefx_00011" },
                { src: "redEnv/redefx_00013.png", id: "redefx_00013" },
                { src: "redEnv/redefx_00015.png", id: "redefx_00015" },
                { src: "redEnv/redefx_00017.png", id: "redefx_00017" },
                { src: "redEnv/redefx_00019.png", id: "redefx_00019" },
                { src: "redEnv/redefx_00021.png", id: "redefx_00021" },
                { src: "redEnv/redefx_00023.png", id: "redefx_00023" },
                { src: "redEnv/redefx_00025.png", id: "redefx_00025" },
                { src: "redEnv/redefx_00027.png", id: "redefx_00027" },
                { src: "redEnv/redefx_00029.png", id: "redefx_00029" },
                { src: "redEnv/redefx_00031.png", id: "redefx_00031" },
                { src: "redEnv/redefx_00033.png", id: "redefx_00033" },
                { src: "redEnv/redefx_00035.png", id: "redefx_00035" },
                { src: "redEnv/redefx_00037.png", id: "redefx_00037" },
                { src: "redEnv/redefx_00039.png", id: "redefx_00039" },
                { src: "redEnv/redefx_00041.png", id: "redefx_00041" },
                { src: "redEnv/redefx_00043.png", id: "redefx_00043" },
                { src: "redEnv/redefx_00045.png", id: "redefx_00045" },
                { src: "redEnv/redefx_00047.png", id: "redefx_00047" },
                { src: "redEnv/redefx_00049.png", id: "redefx_00049" },
                { src: "redEnv/redefx_00051.png", id: "redefx_00051" },
                { src: "redEnv/redefx_00053.png", id: "redefx_00053" },
                { src: "redEnv/redefx_00055.png", id: "redefx_00055" },
                { src: "redEnv/redefx_00057.png", id: "redefx_00057" },
                { src: "redEnv/redefx_00059.png", id: "redefx_00059" },
            ];
            manifest = this.updateManifest(manifest);
            this.loader = new createjs.LoadQueue(true, fudaole.Config.CDN_ROOT + "content/fudaole/resources/images/");
            this.loader.stopOnError = true;
            this.loader.addEventListener("fileload", this.handleFileLoad);
            this.loader.addEventListener("error", this.handleFileError);
            this.loader.loadManifest(manifest);
        };
        fudaole.PickBonusPT.updateManifest = function (manifest) {
            var tempManifest = [];
            for (var i = 0; i < manifest.length; i++) {
                var obj = { src: manifest[i].src, id: manifest[i].id, crossOrigin: true };
                tempManifest.push(obj);
            }
            return tempManifest;
        };
        fudaole.PickBonusPT.handleFileLoad = function (evt) {
            console.log("PickBonusPT:: " + evt.item.id);
            if (evt.item.type == "image") {
                fudaole.PickBonusPT.img[evt.item.id] = evt.result;
            }
        };
        fudaole.PickBonusPT.handleFileError = function (evt) {
            console.log("PickBonusPT failed");
            //evt.target.reset(); to reset the load queue -  to do
        };
        fudaole.PickBonusPT.getQueueLoader = function () {
            return this.loader;
        };
        fudaole.PickBonusPT.getPickBtns = function () {
            return pickBtns;
        };
        fudaole.PickBonusPT.setJackPotValues = function (values, font) {
            miniValue.text = values[3];
            miniValue.font = "65px" + " " + font; //bold 65px Myriad Pro
            minorValue.text = values[2];
            minorValue.font = "70px" + " " + font;
            majorValue.text = values[1];
            majorValue.font = "75px" + " " + font;
            maxiValue.text = values[0];
            maxiValue.font = "85px" + " " + font;
        };
        fudaole.PickBonusPT.reset = function () {
            index = 0;
            endOutro = false;
            fudaole.PickBonusPT.setGlowVisibility(false);
            for (var i = 0; i < 3; i++) {
                miniRev[i].visible = false;
                minorRev[i].visible = false;
                majorRev[i].visible = false;
                maxiRev[i].visible = false;
                miniRev[i].gotoAndStop(0);
                minorRev[i].gotoAndStop(0);
                majorRev[i].gotoAndStop(0);
                maxiRev[i].gotoAndStop(0);
                miniSmallRev[i].visible = false;
                minorSmallRev[i].visible = false;
                majorSmallRev[i].visible = false;
                maxiSmallRev[i].visible = false;
            }
            for (var j = 0; j < pickBtns.length; j++) {
                pickBtns[j].visible = true;
            }
            for (var k = 0; k < winnerMCs.length; k++) {
                winnerMCs[k].visible = false;
                winnerMCs[k].gotoAndStop(0);
                antiAnim[k].visible = false;
            }
            countMini = 0;
            countMinor = 0;
            countMajor = 0;
            countMaxi = 0;
        };
        fudaole.PickBonusPT.setGlowVisibility = function (value) {
            for (var j = 0; j < glowAnim.length; j++) {
                glowAnim[j].visible = value;
            }
        };
        fudaole.PickBonusPT.revealPick = function (pickedNo, pickIndex, pickEnd) {
            if (pickEnd === void 0) { pickEnd = false; }
            var revealMC;
            switch (pickedNo) {
                case 0:
                    revealMC = maxiRev[countMaxi];
                    maxiSmallRev[countMaxi].visible = true;
                    countMaxi++;
                    if (countMaxi == 2)
                        antiAnim[3].visible = true;
                    break;
                case 1:
                    revealMC = majorRev[countMajor];
                    majorSmallRev[countMajor].visible = true;
                    countMajor++;
                    if (countMajor == 2)
                        antiAnim[2].visible = true;
                    break;
                case 2:
                    revealMC = minorRev[countMinor];
                    minorSmallRev[countMinor].visible = true;
                    countMinor++;
                    if (countMinor == 2)
                        antiAnim[1].visible = true;
                    break;
                case 3:
                    revealMC = miniRev[countMini];
                    miniSmallRev[countMini].visible = true;
                    countMini++;
                    if (countMini == 2)
                        antiAnim[0].visible = true;
                    break;
                default:
                    break;
            }
            revealMC.setTransform(pickBtns[pickIndex].x, pickBtns[pickIndex].y);
            glowAnim[pickIndex].visible = false;
            revealMC.visible = true;
            if (pickEnd) {
                for (var k = 0; k < winnerMCs.length; k++) {
                    antiAnim[k].visible = false;
                }
            }
            return revealMC;
        };
        fudaole.PickBonusPT.setIntroTxt = function (txt, font) {
            introTxt.text = txt;
            introTxt.font = "65px" + " " + font; //bold 65px Myriad Pro
            introValue.font = "150px" + " " + font; //bold 150px Myriad Pro
        };
        fudaole.PickBonusPT.setWinnerTxt = function (win, id, txt, font) {
            endOutro = true;
            winnerTxt.text = txt;
            winnerTxt.font = "130px" + " " + font; //bold 130px Myriad Pro
            winnerValue.text = win;
            winnerValue.font = "100px" + " " + font; //100px Myriad Pro Light
            winnerMCs[3 - id].gotoAndPlay(0);
            winnerMCs[3 - id].visible = true;
            winnerMC = winnerMCs[3 - id];
            winValue = win;
            winTxt = txt;
            winlistener = createjs.Ticker.addEventListener("tick", fudaole.PickBonusPT.winTicker.bind(this));
            switch (id) {
                case 0:
                    maxiValue.text = txt;
                    winnerTableTxt = maxiValue;
                    break;
                case 1:
                    majorValue.text = txt;
                    winnerTableTxt = majorValue;
                    break;
                case 2:
                    minorValue.text = txt;
                    winnerTableTxt = minorValue;
                    break;
                case 3:
                    miniValue.text = txt;
                    winnerTableTxt = miniValue;
                    break;
                default:
                    miniValue.text = txt;
                    winnerTableTxt = miniValue;
                    break;
            }
            miniValue.font = "65px" + " " + font; //bold 40px Myriad Pro
            minorValue.font = "70px" + " " + font;
            majorValue.font = "75px" + " " + font;
            maxiValue.font = "85px" + " " + font;
            fudaole.PickBonusPT.playWinner((index++) % 2);
        };
        fudaole.PickBonusPT.winnerTimer = function () {
            if (endOutro) {
                fudaole.PickBonusPT.playWinner((index++) % 2);
            }
        };
        fudaole.PickBonusPT.playWinner = function (i) {
            if (i == 0) {
                winnerTableTxt.text = winTxt;
            }
            else {
                winnerTableTxt.text = winValue;
            }
            TweenLite.delayedCall(1, function () {
                fudaole.PickBonusPT.winnerTimer();
            });
        };
        fudaole.PickBonusPT.winTicker = function () {
            switch (winnerMC.currentLabel) {
                case "End":
                    createjs.Ticker.removeEventListener('tick', winlistener);
                    winnerMC.gotoAndStop("End");
                    winnerMC.visible = false;
                    break;
            }
        };
        // stage content:
        (fudaole.PickBonusPT.PickfeaturePortrait = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { PickFeatureStart: 0, bgsoundstart: 55, PickFeatureStop: 112, Reveal: 117, StartBanner: 134, StartOutro: 305, EndFeature: 405 });
            // WinnerText
            this.WinnerBannerTxt = new createjs.Text("WINNER!", "bold 130px Myriad Pro", "#FFFFFF");
            this.WinnerBannerTxt.textAlign = "center";
            this.WinnerBannerTxt.lineHeight = 132;
            this.WinnerBannerTxt.maxWidth = 815;
            this.WinnerBannerTxt.setTransform(532, 1079.1);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.WinnerBannerTxt }] }, 182).to({ state: [] }, 123).wait(110));
            // Win Value
            this.WinnerBannerTxtVal = new createjs.Text("0", "100px Myriad Pro Light", "#FFFF00");
            this.WinnerBannerTxtVal.textAlign = "center";
            this.WinnerBannerTxtVal.lineHeight = 102;
            this.WinnerBannerTxtVal.maxWidth = 815;
            this.WinnerBannerTxtVal.setTransform(532, 1267.8);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.WinnerBannerTxtVal }] }, 182).to({ state: [] }, 123).wait(110));
            // Layer 2
            this.instance = new fudaole.PickBonusPT.reeffectsp("synched", 0, false);
            this.instance.setTransform(498.9, 1413.1, 1.912, 1.912, 0, 0, 0, 281.5, 499.9);
            this.instance._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance).wait(149).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 65).wait(201));
            // Winner Banner
            this.instance_1 = new fudaole.PickBonusPT.bannerwinner_P("synched", 0);
            this.instance_1.setTransform(535.9, 1184.3, 0.8, 0.8);
            this.instance_1.alpha = 0;
            this.instance_1._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_1).wait(170).to({ startPosition: 0, _off: false }, 0).to({ scaleX: 1.05, scaleY: 1.05, alpha: 1 }, 5).to({ scaleX: 1, scaleY: 1 }, 7).to({ startPosition: 0 }, 118).to({ scaleX: 1.11, scaleY: 1.11 }, 5).to({ scaleX: 0.86, scaleY: 0.86, alpha: 0 }, 9).to({ _off: true }, 1).wait(100));
            // pickinfo Text box
            this.pickinfoTxt2 = new createjs.Text("3", "bold 150px Myriad Pro", "#990000");
            this.pickinfoTxt2.textAlign = "center";
            this.pickinfoTxt2.lineHeight = 152;
            this.pickinfoTxt2.maxWidth = 204;
            this.pickinfoTxt2.setTransform(539.6, 1250.5);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.pickinfoTxt2 }] }, 106).to({ state: [] }, 10).wait(299));
            // pickinfo Text box
            this.pickinfoTxt1 = new createjs.Text("PICK UNTIL YOU MATCH", "bold 65px Myriad Pro", "#FFFFFF");
            this.pickinfoTxt1.textAlign = "center";
            this.pickinfoTxt1.lineHeight = 67;
            this.pickinfoTxt1.maxWidth = 844;
            this.pickinfoTxt1.setTransform(533.1, 1142);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.pickinfoTxt1 }] }, 106).to({ state: [] }, 10).wait(299));
            // Pick text back
            this.textboxBgMC = new fudaole.PickBonusPT.textback_P();
            this.textboxBgMC.setTransform(540.7, 1165.9);
            this.textboxBgMC._off = true;
            this.timeline.addTween(createjs.Tween.get(this.textboxBgMC).wait(106).to({ _off: false }, 0).to({ _off: true }, 10).wait(299));
            // PickInfo Message
            this.pickinfoBannerMC = new fudaole.PickBonusPT.pickinfomsg_P();
            this.pickinfoBannerMC.setTransform(523.3, 1248.5, 0.95, 0.95);
            this.pickinfoBannerMC._off = true;
            this.timeline.addTween(createjs.Tween.get(this.pickinfoBannerMC).wait(112).to({ _off: false }, 0).to({ _off: true }, 4).wait(299));
            // PickInfo Message
            this.instance_2 = new fudaole.PickBonusPT.pickinfomsg_P("synched", 0);
            this.instance_2.setTransform(523.3, 1248.5, 1.188, 1.188);
            this.instance_2.alpha = 0;
            this.instance_2._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_2).wait(93).to({ startPosition: 0, _off: false }, 0).to({ scaleX: 0.9, scaleY: 0.9, alpha: 1 }, 13, createjs.Ease.get(-0.99)).to({ scaleX: 0.95, scaleY: 0.95 }, 3, createjs.Ease.get(1)).to({ _off: true }, 3).wait(303));
            // Mini Text Field
            this.MiniTxtVal = new createjs.Text("0", "bold 65px Myriad Pro", "#FFFF00");
            this.MiniTxtVal.textAlign = "center";
            this.MiniTxtVal.lineHeight = 67;
            this.MiniTxtVal.maxWidth = 357;
            this.MiniTxtVal.setTransform(813.8, 656.3);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.MiniTxtVal }] }, 27).to({ state: [] }, 252).wait(136));
            // Minor Text Field
            this.MinorTxtVal = new createjs.Text("0", "bold 70px Myriad Pro", "#FFFF00");
            this.MinorTxtVal.textAlign = "center";
            this.MinorTxtVal.lineHeight = 72;
            this.MinorTxtVal.maxWidth = 383;
            this.MinorTxtVal.setTransform(292.7, 652.2);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.MinorTxtVal }] }, 27).to({ state: [] }, 252).wait(136));
            // Major Text Field
            this.MajorTxtVal = new createjs.Text("0", "bold 75px Myriad Pro", "#FFFF00");
            this.MajorTxtVal.textAlign = "center";
            this.MajorTxtVal.lineHeight = 77;
            this.MajorTxtVal.maxWidth = 614;
            this.MajorTxtVal.setTransform(533.3, 393.7);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.MajorTxtVal }] }, 27).to({ state: [] }, 252).wait(136));
            // Maxi Text Field
            this.MaxiTxtVal = new createjs.Text("0", "bold 85px Myriad Pro", "#FFFF00");
            this.MaxiTxtVal.textAlign = "center";
            this.MaxiTxtVal.lineHeight = 87;
            this.MaxiTxtVal.maxWidth = 751;
            this.MaxiTxtVal.setTransform(545.1, 96.2);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.MaxiTxtVal }] }, 27).to({ state: [] }, 252).wait(136));
            // WinnerGlowMC
            this.MiniWinnerMC = new fudaole.PickBonusPT.WinnerGlowMC();
            this.MiniWinnerMC.setTransform(815.4, 678.1, 0.857, 0.857);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniWinnerMC }] }).wait(415));
            // WinnerGlowMC
            this.MinorWinnerMC = new fudaole.PickBonusPT.WinnerGlowMC();
            this.MinorWinnerMC.setTransform(293.3, 678.1, 0.857, 0.857);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorWinnerMC }] }).wait(415));
            // WinnerGlowMC
            this.MajorWinnerMC = new fudaole.PickBonusPT.WinnerGlowMC();
            this.MajorWinnerMC.setTransform(549.5, 421.5, 0.95, 0.95);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorWinnerMC }] }).wait(415));
            // WinnerGlowMC
            this.MaxiWinnerMC = new fudaole.PickBonusPT.WinnerGlowMC();
            this.MaxiWinnerMC.setTransform(549.5, 133.6);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiWinnerMC }] }).wait(415));
            // PickIndicator03
            this.MiniRev03 = new fudaole.PickBonusPT.PickIndicator03_P();
            this.MiniRev03.setTransform(913.2, 778.8, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniRev03 }] }).wait(415));
            // PickIndicator03
            this.MiniRev02 = new fudaole.PickBonusPT.PickIndicator03_P();
            this.MiniRev02.setTransform(817.5, 778.8, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniRev02 }] }).wait(415));
            // PickIndicator03
            this.MiniRev01 = new fudaole.PickBonusPT.PickIndicator03_P();
            this.MiniRev01.setTransform(721.7, 778.9, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniRev01 }] }).wait(415));
            // PickIndicator02
            this.MinorRev03 = new fudaole.PickBonusPT.PickIndicator02_P();
            this.MinorRev03.setTransform(399.7, 778.6, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorRev03 }] }).wait(415));
            // PickIndicator02
            this.MinorRev02 = new fudaole.PickBonusPT.PickIndicator02_P();
            this.MinorRev02.setTransform(298.8, 778.6, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorRev02 }] }).wait(415));
            // PickIndicator02
            this.MinorRev01 = new fudaole.PickBonusPT.PickIndicator02_P();
            this.MinorRev01.setTransform(198.3, 778.3, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorRev01 }] }).wait(415));
            // PickIndicator01
            this.MajorRev03 = new fudaole.PickBonusPT.PickIndicator01_P();
            this.MajorRev03.setTransform(658, 524.1, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorRev03 }] }).wait(415));
            // PickIndicator01
            this.MajorRev02 = new fudaole.PickBonusPT.PickIndicator01_P();
            this.MajorRev02.setTransform(551.9, 524.1, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorRev02 }] }).wait(415));
            // PickIndicator01
            this.MajorRev01 = new fudaole.PickBonusPT.PickIndicator01_P();
            this.MajorRev01.setTransform(445.9, 524.1, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorRev01 }] }).wait(415));
            // PickIndicator00
            this.MaxiRev03 = new fudaole.PickBonusPT.PickIndicator00_P();
            this.MaxiRev03.setTransform(662.7, 244.2, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiRev03 }] }).wait(415));
            // PickIndicator00
            this.MaxiRev02 = new fudaole.PickBonusPT.PickIndicator00_P();
            this.MaxiRev02.setTransform(551.9, 244.2, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiRev02 }] }).wait(415));
            // PickIndicator00
            this.MaxiRev01 = new fudaole.PickBonusPT.PickIndicator00_P();
            this.MaxiRev01.setTransform(439, 244.2, 1.215, 1.215);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiRev01 }] }).wait(415));
            // pick mini
            this.MiniReveal01 = new fudaole.PickBonusPT.PickState03_P();
            this.MiniReveal01.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniReveal01 }] }).wait(415));
            // pick minor
            this.MinorReveal01 = new fudaole.PickBonusPT.PickState02_P();
            this.MinorReveal01.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorReveal01 }] }).wait(415));
            // pick major
            this.MajorReveal01 = new fudaole.PickBonusPT.PickState01_P();
            this.MajorReveal01.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorReveal01 }] }).wait(415));
            // pick maxi
            this.MaxiReveal01 = new fudaole.PickBonusPT.PickState00_P();
            this.MaxiReveal01.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiReveal01 }] }).wait(415));
            // pick mini
            this.MiniReveal02 = new fudaole.PickBonusPT.PickState03_P();
            this.MiniReveal02.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniReveal02 }] }).wait(415));
            // pick minor
            this.MinorReveal02 = new fudaole.PickBonusPT.PickState02_P();
            this.MinorReveal02.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorReveal02 }] }).wait(415));
            // pick major
            this.MajorReveal02 = new fudaole.PickBonusPT.PickState01_P();
            this.MajorReveal02.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorReveal02 }] }).wait(415));
            // pick maxi
            this.MaxiReveal02 = new fudaole.PickBonusPT.PickState00_P();
            this.MaxiReveal02.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiReveal02 }] }).wait(415));
            // pick mini
            this.MiniReveal03 = new fudaole.PickBonusPT.PickState03_P();
            this.MiniReveal03.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MiniReveal03 }] }).wait(415));
            // pick minor
            this.MinorReveal03 = new fudaole.PickBonusPT.PickState02_P();
            this.MinorReveal03.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MinorReveal03 }] }).wait(415));
            // pick major
            this.MajorReveal03 = new fudaole.PickBonusPT.PickState01_P();
            this.MajorReveal03.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MajorReveal03 }] }).wait(415));
            // pick maxi
            this.MaxiReveal03 = new fudaole.PickBonusPT.PickState00_P();
            this.MaxiReveal03.setTransform(124.7, 115.8, 1.047, 1.047);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.MaxiReveal03 }] }).wait(415));
            // Pick14
            this.Pick14 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick14.setTransform(941.3, 1442.2, 0.95, 0.95);
            this.Pick14._off = true;
            new createjs.ButtonHelper(this.Pick14, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick14).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick09
            this.Pick09 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick09.setTransform(941.3, 1278.5, 0.95, 0.95);
            this.Pick09._off = true;
            new createjs.ButtonHelper(this.Pick09, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick09).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick04
            this.Pick04 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick04.setTransform(941.3, 1114.8, 0.95, 0.95);
            this.Pick04._off = true;
            new createjs.ButtonHelper(this.Pick04, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick04).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick13
            this.Pick13 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick13.setTransform(739.7, 1506.2, 0.95, 0.95);
            this.Pick13._off = true;
            new createjs.ButtonHelper(this.Pick13, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick13).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick08
            this.Pick08 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick08.setTransform(739.7, 1342.5, 0.95, 0.95);
            this.Pick08._off = true;
            new createjs.ButtonHelper(this.Pick08, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick08).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick03
            this.Pick03 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick03.setTransform(739.7, 1178.8, 0.95, 0.95);
            this.Pick03._off = true;
            new createjs.ButtonHelper(this.Pick03, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick03).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick12
            this.Pick12 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick12.setTransform(550.9, 1442.2, 0.95, 0.95);
            this.Pick12._off = true;
            new createjs.ButtonHelper(this.Pick12, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick12).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick07
            this.Pick07 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick07.setTransform(550.9, 1278.5, 0.95, 0.95);
            this.Pick07._off = true;
            new createjs.ButtonHelper(this.Pick07, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick07).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick02
            this.Pick02 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick02.setTransform(550.9, 1114.8, 0.95, 0.95);
            this.Pick02._off = true;
            new createjs.ButtonHelper(this.Pick02, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick02).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick11
            this.Pick11 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick11.setTransform(355.7, 1506.2, 0.95, 0.95);
            this.Pick11._off = true;
            new createjs.ButtonHelper(this.Pick11, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick11).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick06
            this.Pick06 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick06.setTransform(355.7, 1342.5, 0.95, 0.95);
            this.Pick06._off = true;
            new createjs.ButtonHelper(this.Pick06, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick06).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick01
            this.Pick01 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick01.setTransform(355.7, 1178.8, 0.95, 0.95);
            this.Pick01._off = true;
            new createjs.ButtonHelper(this.Pick01, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick01).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick10
            this.Pick10 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick10.setTransform(159.9, 1442.2, 0.95, 0.95);
            this.Pick10._off = true;
            new createjs.ButtonHelper(this.Pick10, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick10).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick05
            this.Pick05 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick05.setTransform(159.9, 1278.5, 0.95, 0.95);
            this.Pick05._off = true;
            new createjs.ButtonHelper(this.Pick05, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick05).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // Pick00
            this.Pick00 = new fudaole.PickBonusPT.PickBtn_P();
            this.Pick00.setTransform(159.9, 1114.8, 0.95, 0.95);
            this.Pick00._off = true;
            new createjs.ButtonHelper(this.Pick00, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.Pick00).wait(117).to({ _off: false }, 0).to({ _off: true }, 204).wait(94));
            // PickBtn
            this.instance_3 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_3.setTransform(950.7, 272.6, 0.95, 0.95);
            this.instance_3._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_3).wait(14).to({ startPosition: 0, _off: false }, 0).to({ x: 944.4, y: 801.8, startPosition: 1 }, 5).to({ x: 944.2, y: 1191, startPosition: 2 }, 5).to({ x: 944, y: 1426.7, startPosition: 0 }, 6, createjs.Ease.get(0.54)).to({ x: 943.7, y: 1503.8, startPosition: 2 }, 6).to({ x: 943.4, y: 1441.2, startPosition: 1 }, 7).to({ x: 943.1, y: 1385, startPosition: 0 }, 7).to({ x: 943, y: 1373.1, startPosition: 3 }, 3).to({ x: 949, y: 1406.9, startPosition: 2 }, 7).to({ x: 960, y: 1445.7, startPosition: 1 }, 7).to({ x: 952.7, y: 1435.4, startPosition: 3 }, 6).to({ x: 946.3, y: 1421.6, startPosition: 1 }, 6).to({ x: 934.5, y: 1431.2, startPosition: 0 }, 7).to({ x: 941.3, y: 1442.2, mode: "independent" }, 8).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 1, _off: false }, 0).to({ y: 1476.7, startPosition: 2 }, 9).to({ y: 579.7, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_4 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_4.setTransform(950, 145.4, 0.95, 0.95);
            this.instance_4._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_4).wait(14).to({ startPosition: 0, _off: false }, 0).to({ y: 643.1, startPosition: 1 }, 5).to({ x: 949.4, y: 1032, startPosition: 2 }, 5).to({ x: 948.7, y: 1267.3, startPosition: 0 }, 6, createjs.Ease.get(0.54)).to({ x: 948, y: 1331.4, startPosition: 2 }, 6).to({ x: 947.2, y: 1274.5, startPosition: 1 }, 7).to({ x: 946.4, y: 1217.8, startPosition: 0 }, 7).to({ x: 946, y: 1206.2, startPosition: 3 }, 3).to({ x: 945.2, y: 1243.7, startPosition: 2 }, 7).to({ x: 953.9, y: 1282.4, startPosition: 1 }, 7).to({ x: 957.4, y: 1272.1, startPosition: 3 }, 6).to({ x: 949.6, y: 1258.2, startPosition: 1 }, 6).to({ x: 936.3, y: 1267.6, startPosition: 0 }, 7).to({ x: 941.3, y: 1278.5, mode: "independent" }, 8).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 1, _off: false }, 0).to({ y: 1313, startPosition: 2 }, 9).to({ y: 416, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_5 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_5.setTransform(949.3, 24.8, 0.95, 0.95);
            this.instance_5._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_5).wait(14).to({ startPosition: 0, _off: false }, 0).to({ y: 497.3, startPosition: 1 }, 5).to({ x: 948.7, y: 884.9, startPosition: 2 }, 5).to({ x: 948.1, y: 1118.8, startPosition: 0 }, 6, createjs.Ease.get(0.54)).to({ x: 947.4, y: 1159.4, startPosition: 2 }, 6).to({ x: 946.7, y: 1109.9, startPosition: 1 }, 7).to({ x: 946, y: 1054.1, startPosition: 0 }, 7).to({ x: 945.6, y: 1042.5, startPosition: 3 }, 3).to({ x: 944.9, y: 1083.2, startPosition: 2 }, 7).to({ x: 953.6, y: 1121.2, startPosition: 1 }, 7).to({ x: 950.8, y: 1113.5, startPosition: 3 }, 6).to({ x: 948.1, y: 1098.1, startPosition: 1 }, 6).to({ x: 938.6, y: 1105.9, startPosition: 0 }, 7).to({ x: 941.3, y: 1114.8, mode: "independent" }, 8).to({ _off: true }, 23).wait(204).to({ mode: "synched", startPosition: 1, _off: false }, 0).to({ y: 1149.3, startPosition: 2 }, 9).to({ y: 252.3, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_6 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_6.setTransform(749.1, 336.6, 0.95, 0.95);
            this.instance_6._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_6).wait(13).to({ startPosition: 0, _off: false }, 0).to({ x: 742.2, y: 849.8, startPosition: 1 }, 5).to({ x: 738.9, y: 1248.9, startPosition: 2 }, 5).to({ x: 739, y: 1497.5, startPosition: 0 }, 6).to({ y: 1561.2, startPosition: 2 }, 6).to({ x: 739.1, y: 1492.2 }, 8).to({ x: 739.2, y: 1443.2, startPosition: 1 }, 7).to({ y: 1434.9, startPosition: 0 }, 3).to({ x: 742.5, y: 1475.5, startPosition: 3 }, 7).to({ x: 758.3, y: 1516, startPosition: 2 }, 7).to({ x: 745.7, y: 1481.2, startPosition: 3 }, 9).to({ x: 737.1, y: 1494, startPosition: 2 }, 7).to({ x: 732.2, y: 1500.7, startPosition: 0 }, 6).to({ x: 739.7, y: 1506.2 }, 5).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1540.7, startPosition: 2 }, 9).to({ y: 643.7, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_7 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_7.setTransform(748.4, 209.4, 0.95, 0.95);
            this.instance_7._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_7).wait(13).to({ startPosition: 0, _off: false }, 0).to({ x: 747.8, y: 685.7, startPosition: 1 }, 5).to({ x: 741, y: 1081.7, startPosition: 2 }, 5).to({ x: 740.9, y: 1333.7, startPosition: 0 }, 6).to({ x: 740.8, y: 1397.5, startPosition: 2 }, 6).to({ x: 740.6, y: 1325.3 }, 8).to({ x: 740.5, y: 1279.5, startPosition: 1 }, 7).to({ y: 1271.2, startPosition: 0 }, 3).to({ x: 740.3, y: 1311.7, startPosition: 3 }, 7).to({ x: 752.8, y: 1352.2, startPosition: 2 }, 7).to({ x: 745.3, y: 1317.5, startPosition: 3 }, 9).to({ x: 736.8, y: 1333.5, startPosition: 2 }, 7).to({ x: 732.1, y: 1338.4, startPosition: 0 }, 6).to({ x: 739.7, y: 1342.5 }, 5).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1377, startPosition: 2 }, 9).to({ y: 480, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_8 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_8.setTransform(747.7, 88.8, 0.95, 0.95);
            this.instance_8._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_8).wait(13).to({ startPosition: 0, _off: false }, 0).to({ x: 747.2, y: 530.9, startPosition: 1 }, 5).to({ x: 740.4, y: 920, startPosition: 2 }, 5).to({ x: 740.3, y: 1175, startPosition: 0 }, 6).to({ y: 1238.3, startPosition: 2 }, 6).to({ x: 740.2, y: 1159.2 }, 8).to({ x: 740.1, y: 1119.2, startPosition: 1 }, 7).to({ y: 1110.6, startPosition: 0 }, 3).to({ x: 738.5, y: 1150.6, startPosition: 3 }, 7).to({ x: 749.4, y: 1190.6, startPosition: 2 }, 7).to({ x: 746.2, y: 1152, startPosition: 3 }, 9).to({ x: 737.4, y: 1168.7, startPosition: 2 }, 7).to({ x: 732.3, y: 1174.1, startPosition: 0 }, 6).to({ x: 739.7, y: 1178.8 }, 5).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1213.3, startPosition: 2 }, 9).to({ y: 316.3, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_9 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_9.setTransform(560.3, 272.6, 0.95, 0.95);
            this.instance_9._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_9).wait(11).to({ startPosition: 0, _off: false }, 0).to({ x: 559.5, y: 793.3, startPosition: 1 }, 5).to({ x: 552.1, y: 1325.3, startPosition: 0 }, 7).to({ x: 551.9, y: 1434.4 }, 4).to({ x: 551.8, y: 1460.6, startPosition: 2 }, 2).to({ x: 551.6, y: 1512.7 }, 4).to({ x: 551.1, y: 1435.8, startPosition: 3 }, 9).to({ x: 550.7, y: 1365, startPosition: 1 }, 10).to({ x: 551.9, y: 1417.8 }, 8).to({ x: 565.7, y: 1457.9 }, 8).to({ x: 558.3, y: 1419.2, startPosition: 2 }, 5).to({ x: 549.4, y: 1432.6, startPosition: 0 }, 6).to({ x: 543.9, y: 1437.7 }, 8).to({ x: 550.9, y: 1442.2 }, 7).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1476.7, startPosition: 2 }, 9).to({ y: 579.7, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_10 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_10.setTransform(559.6, 145.4, 0.95, 0.95);
            this.instance_10._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_10).wait(11).to({ startPosition: 0, _off: false }, 0).to({ x: 558.8, y: 663.4, startPosition: 1 }, 5).to({ x: 551.3, y: 1147.6, startPosition: 0 }, 7).to({ x: 551.1, y: 1274.5 }, 4).to({ x: 551, y: 1290.7, startPosition: 2 }, 2).to({ x: 550.8, y: 1337 }, 4).to({ x: 550.4, y: 1268.8, startPosition: 3 }, 9).to({ x: 549.9, y: 1208.3, startPosition: 1 }, 10).to({ x: 552.7, y: 1254.3 }, 8).to({ x: 561.8, y: 1287.6 }, 8).to({ x: 555.8, y: 1251.9, startPosition: 2 }, 5).to({ x: 548.6, y: 1268.9, startPosition: 0 }, 6).to({ x: 543.6, y: 1277.1 }, 8).to({ x: 550.9, y: 1278.5 }, 7).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1313, startPosition: 2 }, 9).to({ y: 416, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_11 = new fudaole.PickBonusPT.PickBtn_P("synched", 0);
            this.instance_11.setTransform(558.9, 24.8, 0.95, 0.95);
            this.instance_11._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_11).wait(11).to({ startPosition: 0, _off: false }, 0).to({ x: 558.1, y: 539.6, startPosition: 1 }, 5).to({ x: 550.6, y: 975.2, startPosition: 0 }, 7).to({ x: 550.4, y: 1114.3 }, 4).to({ x: 550.3, y: 1122.5, startPosition: 2 }, 2).to({ x: 550.1, y: 1162.8 }, 4).to({ x: 549.6, y: 1099.9, startPosition: 3 }, 9).to({ x: 549.2, y: 1047.2, startPosition: 1 }, 10).to({ x: 548.7, y: 1092.4 }, 8).to({ x: 561, y: 1125 }, 8).to({ x: 555, y: 1088.8, startPosition: 2 }, 5).to({ x: 547.9, y: 1105.2, startPosition: 0 }, 6).to({ x: 543.2, y: 1116.6 }, 8).to({ x: 550.9, y: 1114.8 }, 7).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1149.3, startPosition: 2 }, 9).to({ y: 252.3, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_12 = new fudaole.PickBonusPT.PickBtn_P();
            this.instance_12.setTransform(365.1, 336.6, 0.95, 0.95);
            this.instance_12._off = true;
            new createjs.ButtonHelper(this.instance_12, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.instance_12).wait(7).to({ _off: false }, 0).to({ y: 935.1, mode: "synched", startPosition: 0 }, 6).to({ x: 361.6, y: 1435.5, startPosition: 3 }, 7).to({ x: 357, y: 1567.6, startPosition: 0 }, 9).to({ x: 356.7, y: 1437.8, startPosition: 2 }, 14).to({ x: 356.6, y: 1427, startPosition: 0 }, 6).to({ x: 375.3, y: 1523.7 }, 12).to({ x: 355.6, y: 1485.8 }, 12).to({ x: 349.3, y: 1497.9, startPosition: 2 }, 6).to({ x: 352.7, y: 1505.4 }, 8).to({ x: 355.7, y: 1506.2, startPosition: 3 }, 7).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1540.7, startPosition: 2 }, 9).to({ y: 643.7, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_13 = new fudaole.PickBonusPT.PickBtn_P();
            this.instance_13.setTransform(364.4, 209.4, 0.95, 0.95);
            this.instance_13._off = true;
            new createjs.ButtonHelper(this.instance_13, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.instance_13).wait(7).to({ _off: false }, 0).to({ y: 785, mode: "synched", startPosition: 0 }, 6).to({ x: 360.9, y: 1277.3, startPosition: 3 }, 7).to({ x: 356.4, y: 1399.1, startPosition: 0 }, 9).to({ x: 356.2, y: 1270.3, startPosition: 2 }, 14).to({ y: 1266.2, startPosition: 0 }, 6).to({ x: 368.7, y: 1352.7 }, 12).to({ x: 357.7, y: 1323.7 }, 12).to({ x: 350.8, y: 1330.9, startPosition: 2 }, 6).to({ x: 350.3, y: 1337 }, 8).to({ x: 355.7, y: 1342.5, startPosition: 3 }, 7).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1377, startPosition: 2 }, 9).to({ y: 480, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_14 = new fudaole.PickBonusPT.PickBtn_P();
            this.instance_14.setTransform(363.7, 88.8, 0.95, 0.95);
            this.instance_14._off = true;
            new createjs.ButtonHelper(this.instance_14, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.instance_14).wait(7).to({ _off: false }, 0).to({ y: 643.7, mode: "synched", startPosition: 0 }, 6).to({ x: 360.2, y: 1120.3, startPosition: 3 }, 7).to({ x: 355.8, y: 1221.9, startPosition: 0 }, 9).to({ y: 1096.1, startPosition: 2 }, 14).to({ y: 1102.7, startPosition: 0 }, 6).to({ x: 365.2, y: 1182.8 }, 12).to({ x: 361.8, y: 1156.1 }, 12).to({ x: 353.7, y: 1167.5, startPosition: 2 }, 6).to({ x: 351.6, y: 1169.1 }, 8).to({ x: 355.7, y: 1178.8, startPosition: 3 }, 7).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1213.3, startPosition: 2 }, 9).to({ y: 316.3, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_15 = new fudaole.PickBonusPT.PickBtn_P();
            this.instance_15.setTransform(169.3, 272.6, 0.95, 0.95);
            this.instance_15._off = true;
            new createjs.ButtonHelper(this.instance_15, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.instance_15).wait(3).to({ _off: false }, 0).to({ x: 167.4, y: 871.7 }, 6).to({ x: 166.2, y: 1307.9, mode: "synched", startPosition: 0 }, 6, createjs.Ease.get(0.39)).to({ x: 166, y: 1380, startPosition: 1 }, 1, createjs.Ease.get(1)).to({ x: 165.3, y: 1509, startPosition: 2 }, 9, createjs.Ease.get(0.74)).to({ x: 164.8, y: 1451, startPosition: 0 }, 6).to({ x: 164, y: 1383.4, startPosition: 1 }, 9).to({ x: 163.7, y: 1363.4 }, 4).to({ x: 160.8, y: 1415.6, startPosition: 0 }, 7, createjs.Ease.get(0.32)).to({ x: 175, y: 1453.3, startPosition: 3 }, 7).to({ x: 170.5, y: 1409 }, 8).to({ x: 148.1, y: 1442.5 }, 12).to({ x: 159.9, y: 1435.9, startPosition: 2 }, 7).to({ y: 1442.2, startPosition: 3 }, 9, createjs.Ease.get(1)).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1476.7, startPosition: 2 }, 9).to({ y: 579.7, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_16 = new fudaole.PickBonusPT.PickBtn_P();
            this.instance_16.setTransform(168.6, 145.4, 0.95, 0.95);
            this.instance_16._off = true;
            new createjs.ButtonHelper(this.instance_16, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.instance_16).wait(3).to({ _off: false }, 0).to({ x: 166.7, y: 727 }, 6).to({ x: 165.4, y: 1151.5, mode: "synched", startPosition: 0 }, 6, createjs.Ease.get(0.39)).to({ x: 165.3, y: 1216.1, startPosition: 1 }, 1, createjs.Ease.get(1)).to({ x: 164.7, y: 1329.5, startPosition: 2 }, 9, createjs.Ease.get(0.74)).to({ x: 164.2, y: 1273.1, startPosition: 0 }, 6).to({ x: 163.5, y: 1207.8, startPosition: 1 }, 9).to({ x: 163.2, y: 1198.4 }, 4).to({ x: 160.4, y: 1250.8, startPosition: 0 }, 7, createjs.Ease.get(0.32)).to({ x: 174.7, y: 1288.7, startPosition: 3 }, 7).to({ x: 170.3, y: 1244.7 }, 8).to({ x: 148, y: 1278.6 }, 12).to({ x: 159.9, y: 1272.2, startPosition: 2 }, 7).to({ y: 1278.5, startPosition: 3 }, 9, createjs.Ease.get(1)).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1313, startPosition: 2 }, 9).to({ y: 416, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // PickBtn
            this.instance_17 = new fudaole.PickBonusPT.PickBtn_P();
            this.instance_17.setTransform(167.9, 24.8, 0.95, 0.95);
            this.instance_17._off = true;
            new createjs.ButtonHelper(this.instance_17, btn0, btn1, btn2, false, new fudaole.PickBonusPT.PickBtn_P(), btn3);
            this.timeline.addTween(createjs.Tween.get(this.instance_17).wait(3).to({ _off: false }, 0).to({ x: 166, y: 582.8 }, 6).to({ x: 164.7, y: 991.5, mode: "synched", startPosition: 0 }, 6, createjs.Ease.get(0.39)).to({ x: 164.6, y: 1047.9, startPosition: 1 }, 1, createjs.Ease.get(1)).to({ x: 164.1, y: 1159.6, startPosition: 2 }, 9, createjs.Ease.get(0.74)).to({ x: 163.7, y: 1103.7, startPosition: 0 }, 6).to({ x: 163, y: 1039.4, startPosition: 1 }, 9).to({ x: 162.8, y: 1036.7 }, 4).to({ x: 166.4, y: 1088.7, startPosition: 0 }, 7, createjs.Ease.get(0.32)).to({ x: 174.4, y: 1126.3, startPosition: 3 }, 7).to({ x: 170.1, y: 1082 }, 8).to({ x: 147.9, y: 1115.3 }, 12).to({ x: 159.9, y: 1108.5, startPosition: 2 }, 7).to({ y: 1114.8, startPosition: 3 }, 9, createjs.Ease.get(1)).to({ _off: true }, 23).wait(204).to({ startPosition: 1, _off: false }, 0).to({ y: 1149.3, startPosition: 2 }, 9).to({ y: 252.3, alpha: 0, startPosition: 1 }, 19).to({ _off: true }, 1).wait(65));
            // coinglowAnim
            this.glow13 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow13.setTransform(740, 1505.5, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow13 }] }).wait(415));
            // coinglowAnim
            this.glow08 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow08.setTransform(740, 1343.2, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow08 }] }).wait(415));
            // coinglowAnim
            this.glow03 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow03.setTransform(740, 1179.2, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow03 }] }).wait(415));
            // coinglowAnim
            this.glow14 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow14.setTransform(940.4, 1443.2, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow14 }] }).wait(415));
            // coinglowAnim
            this.glow09 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow09.setTransform(940.4, 1279.2, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow09 }] }).wait(415));
            // coinglowAnim
            this.glow04 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow04.setTransform(940.4, 1116.9, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow04 }] }).wait(415));
            // coinglowAnim
            this.glow12 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow12.setTransform(551.8, 1441.7, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow12 }] }).wait(415));
            // coinglowAnim
            this.glow07 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow07.setTransform(551.8, 1279.4, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow07 }] }).wait(415));
            // coinglowAnim
            this.glow02 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow02.setTransform(551.8, 1113.8, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow02 }] }).wait(415));
            // coinglowAnim
            this.glow10 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow10.setTransform(160.8, 1443.1, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow10 }] }).wait(415));
            // coinglowAnim
            this.glow05 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow05.setTransform(160.8, 1279.1, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow05 }] }).wait(415));
            // coinglowAnim
            this.glow00 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow00.setTransform(160.8, 1115.2, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow00 }] }).wait(415));
            // coinglowAnim
            this.glow11 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow11.setTransform(354.6, 1505.5, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow11 }] }).wait(415));
            // coinglowAnim
            this.glow06 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow06.setTransform(356.3, 1343.2, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow06 }] }).wait(415));
            // coinglowAnim
            this.glow01 = new fudaole.PickBonusPT.coinglowAnim_P();
            this.glow01.setTransform(356.3, 1179.2, 0.948, 0.948);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.glow01 }] }).wait(415));
            // CircleSym
            this.instance_18 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_18.setTransform(912.7, 700.4, 1.134, 1.134);
            this.instance_18.alpha = 0;
            this.instance_18._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_18).wait(28).to({ startPosition: 0, _off: false }, 0).to({ y: 787.8, alpha: 1 }, 6).to({ y: 778.1 }, 3).wait(290).to({ startPosition: 0 }, 0).to({ y: 787.8 }, 3).to({ y: 700.4, alpha: 0 }, 6).to({ _off: true }, 13).wait(66));
            // CircleSym
            this.instance_19 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_19.setTransform(817.2, 700.4, 1.134, 1.134);
            this.instance_19.alpha = 0;
            this.instance_19._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_19).wait(28).to({ startPosition: 0, _off: false }, 0).to({ y: 787.8, alpha: 1 }, 6).to({ y: 778.1 }, 3).wait(290).to({ startPosition: 0 }, 0).to({ y: 787.8 }, 3).to({ y: 700.4, alpha: 0 }, 6).to({ _off: true }, 13).wait(66));
            // CircleSym
            this.instance_20 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_20.setTransform(721.4, 700.4, 1.134, 1.134);
            this.instance_20.alpha = 0;
            this.instance_20._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_20).wait(28).to({ startPosition: 0, _off: false }, 0).to({ y: 787.8, alpha: 1 }, 6).to({ y: 778.1 }, 3).wait(290).to({ startPosition: 0 }, 0).to({ y: 787.8 }, 3).to({ y: 700.4, alpha: 0 }, 6).to({ _off: true }, 13).wait(66));
            // CircleSym
            this.instance_21 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_21.setTransform(399.5, 700.2, 1.194, 1.194);
            this.instance_21.alpha = 0;
            this.instance_21._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_21).wait(26).to({ startPosition: 0, _off: false }, 0).to({ y: 787.7, alpha: 1 }, 6).to({ y: 778 }, 3).wait(292).to({ startPosition: 0 }, 0).to({ y: 787.7 }, 3).to({ y: 700.2, alpha: 0 }, 6).to({ _off: true }, 11).wait(68));
            // CircleSym
            this.instance_22 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_22.setTransform(298.9, 700.2, 1.194, 1.194);
            this.instance_22.alpha = 0;
            this.instance_22._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_22).wait(26).to({ startPosition: 0, _off: false }, 0).to({ y: 787.7, alpha: 1 }, 6).to({ y: 778 }, 3).wait(292).to({ startPosition: 0 }, 0).to({ y: 787.7 }, 3).to({ y: 700.2, alpha: 0 }, 6).to({ _off: true }, 11).wait(68));
            // CircleSym
            this.instance_23 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_23.setTransform(198.1, 700.2, 1.194, 1.194);
            this.instance_23.alpha = 0;
            this.instance_23._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_23).wait(26).to({ startPosition: 0, _off: false }, 0).to({ y: 787.7, alpha: 1 }, 6).to({ y: 778 }, 3).wait(292).to({ startPosition: 0 }, 0).to({ y: 787.7 }, 3).to({ y: 700.2, alpha: 0 }, 6).to({ _off: true }, 11).wait(68));
            // CircleSym
            this.instance_24 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_24.setTransform(656.8, 446, 1.256, 1.256);
            this.instance_24.alpha = 0;
            this.instance_24._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_24).wait(24).to({ startPosition: 0, _off: false }, 0).to({ y: 533.4, alpha: 1 }, 6).to({ y: 523.7 }, 3).wait(294).to({ startPosition: 0 }, 0).to({ y: 533.4 }, 3).to({ y: 446, alpha: 0 }, 6).to({ _off: true }, 2).wait(77));
            // CircleSym
            this.instance_25 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_25.setTransform(550.7, 446, 1.256, 1.256);
            this.instance_25.alpha = 0;
            this.instance_25._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_25).wait(24).to({ startPosition: 0, _off: false }, 0).to({ y: 533.4, alpha: 1 }, 6).to({ y: 523.7 }, 3).wait(294).to({ startPosition: 0 }, 0).to({ y: 533.4 }, 3).to({ y: 446, alpha: 0 }, 6).to({ _off: true }, 2).wait(77));
            // CircleSym
            this.instance_26 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_26.setTransform(444.7, 446, 1.256, 1.256);
            this.instance_26.alpha = 0;
            this.instance_26._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_26).wait(24).to({ startPosition: 0, _off: false }, 0).to({ y: 533.4, alpha: 1 }, 6).to({ y: 523.7 }, 3).wait(294).to({ startPosition: 0 }, 0).to({ y: 533.4 }, 3).to({ y: 446, alpha: 0 }, 6).to({ _off: true }, 2).wait(77));
            // CircleSym
            this.instance_27 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_27.setTransform(662.3, 166, 1.322, 1.322);
            this.instance_27.alpha = 0;
            this.instance_27._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_27).wait(22).to({ startPosition: 0, _off: false }, 0).to({ y: 253.4, alpha: 1 }, 6).to({ y: 243.7 }, 3).wait(296).to({ startPosition: 0 }, 0).to({ y: 253.4 }, 3).to({ y: 166, alpha: 0 }, 6).to({ _off: true }, 1).wait(78));
            // CircleSym
            this.instance_28 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_28.setTransform(550.7, 166, 1.322, 1.322);
            this.instance_28.alpha = 0;
            this.instance_28._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_28).wait(22).to({ startPosition: 0, _off: false }, 0).to({ y: 253.4, alpha: 1 }, 6).to({ y: 243.7 }, 3).wait(296).to({ startPosition: 0 }, 0).to({ y: 253.4 }, 3).to({ y: 166, alpha: 0 }, 6).to({ _off: true }, 1).wait(78));
            // CircleSym
            this.instance_29 = new fudaole.PickBonusPT.CircleSym_P("synched", 0);
            this.instance_29.setTransform(439.1, 166, 1.322, 1.322);
            this.instance_29.alpha = 0;
            this.instance_29._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_29).wait(22).to({ startPosition: 0, _off: false }, 0).to({ y: 253.4, alpha: 1 }, 6).to({ y: 243.7 }, 3).wait(296).to({ startPosition: 0 }, 0).to({ y: 253.4 }, 3).to({ y: 166, alpha: 0 }, 6).to({ _off: true }, 1).wait(78));
            // antiglow_MC
            this.AntiMini = new fudaole.PickBonusPT.antiglow_MC_P();
            this.AntiMini.setTransform(915.4, 777.6, 1.083, 1.083);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.AntiMini }] }).wait(415));
            // antiglow_MC
            this.AntiMinor = new fudaole.PickBonusPT.antiglow_MC_P();
            this.AntiMinor.setTransform(402.7, 779.1, 1.143, 1.143);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.AntiMinor }] }).wait(415));
            // antiglow_MC
            this.AntiMajor = new fudaole.PickBonusPT.antiglow_MC_P();
            this.AntiMajor.setTransform(658.9, 523.7, 1.206, 1.206);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.AntiMajor }] }).wait(415));
            // antiglow_MC
            this.AntiMaxi = new fudaole.PickBonusPT.antiglow_MC_P();
            this.AntiMaxi.setTransform(663.1, 244.6, 1.273, 1.273);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.AntiMaxi }] }).wait(415));
            // PMiniMeterSym
            this.instance_30 = new fudaole.PickBonusPT.PMiniMeterSym_P("synched", 0);
            this.instance_30.setTransform(973.6, 667.7, 1.069, 1.069);
            this.instance_30.alpha = 0;
            this.instance_30._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_30).wait(8).to({ startPosition: 0, _off: false }, 0).to({ x: 790.3, alpha: 1 }, 5).to({ x: 832.2 }, 3).to({ x: 816.5 }, 2).wait(329).to({ startPosition: 0 }, 0).to({ x: 790.3 }, 6).to({ x: 973.6, alpha: 0 }, 11).to({ _off: true }, 5).wait(46));
            // PMinorMeterSym
            this.instance_31 = new fudaole.PickBonusPT.PMinorMeterSym_P("synched", 0);
            this.instance_31.setTransform(162.9, 666.7, 1.069, 1.069);
            this.instance_31.alpha = 0;
            this.instance_31._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_31).wait(8).to({ startPosition: 0, _off: false }, 0).to({ x: 320, alpha: 1 }, 5).to({ x: 275.5 }, 3).to({ x: 293.8 }, 2).wait(329).to({ startPosition: 0 }, 0).to({ x: 320 }, 6).to({ x: 162.9, alpha: 0 }, 11).to({ _off: true }, 5).wait(46));
            // PMajorMeterSym
            this.instance_32 = new fudaole.PickBonusPT.PMajorMeterSym_P("synched", 0);
            this.instance_32.setTransform(536.6, 259.4, 1, 0.918);
            this.instance_32.alpha = 0;
            this.instance_32._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_32).wait(7).to({ startPosition: 0, _off: false }, 0).to({ y: 429.5, alpha: 1 }, 5).to({ y: 395.9 }, 3).to({ y: 409 }, 2).wait(330).to({ startPosition: 0 }, 0).to({ y: 429.5 }, 6).to({ y: 259.4, alpha: 0 }, 11).to({ _off: true }, 4).wait(47));
            // PMaxiMeterSym
            this.instance_33 = new fudaole.PickBonusPT.PMaxiMeterSym_P("synched", 0);
            this.instance_33.setTransform(547.6, -30.5, 1, 0.918);
            this.instance_33.alpha = 0;
            this.instance_33._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_33).wait(3).to({ startPosition: 0, _off: false }, 0).to({ y: 141.4, alpha: 1 }, 5).to({ y: 105.9 }, 3).to({ y: 119 }, 2).wait(334).to({ startPosition: 0 }, 0).to({ y: 141.4 }, 6).to({ y: -30.4, alpha: 0 }, 11).to({ _off: true }, 3).wait(48));
            // miniparglow
            this.instance_34 = new fudaole.PickBonusPT.miniparglow_P("synched", 0);
            this.instance_34.setTransform(807.7, 691.6);
            this.instance_34.alpha = 0;
            this.instance_34._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_34).wait(13).to({ startPosition: 0, _off: false }, 0).to({ alpha: 1 }, 10).wait(320).to({ startPosition: 0 }, 0).to({ alpha: 0 }, 17).to({ _off: true }, 4).wait(51));
            // miniparglow
            this.instance_35 = new fudaole.PickBonusPT.miniparglow_P("synched", 0);
            this.instance_35.setTransform(296.1, 691.6);
            this.instance_35.alpha = 0;
            this.instance_35._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_35).wait(13).to({ startPosition: 0, _off: false }, 0).to({ alpha: 1 }, 10).wait(320).to({ startPosition: 0 }, 0).to({ alpha: 0 }, 17).to({ _off: true }, 4).wait(51));
            // majorparglow
            this.instance_36 = new fudaole.PickBonusPT.majorparglow_P("synched", 0);
            this.instance_36.setTransform(537.6, 423.2);
            this.instance_36.alpha = 0;
            this.instance_36._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_36).wait(11).to({ startPosition: 0, _off: false }, 0).to({ alpha: 1 }, 10).wait(322).to({ startPosition: 0 }, 0).to({ alpha: 0 }, 17).to({ _off: true }, 2).wait(53));
            // maxiparglow
            this.instance_37 = new fudaole.PickBonusPT.maxiparglow_P("synched", 0);
            this.instance_37.setTransform(546.6, 141.4);
            this.instance_37.alpha = 0;
            this.instance_37._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_37).wait(9).to({ startPosition: 0, _off: false }, 0).to({ alpha: 1 }, 10).wait(324).to({ startPosition: 0 }, 0).to({ alpha: 0 }, 17).to({ _off: true }, 2).wait(53));
            // Logo
            this.instance_38 = new fudaole.PickBonusPT.GameLogo_P("synched", 0);
            this.instance_38.setTransform(573.3, 438.5, 1.197, 1.197);
            this.instance_38.alpha = 0;
            this.instance_38._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_38).wait(25).to({ startPosition: 0, _off: false }, 0).to({ y: 887.4, alpha: 1 }, 11).to({ y: 857.4 }, 4).to({ startPosition: 0 }, 4).wait(300).to({ startPosition: 0 }, 0).to({ startPosition: 0 }, 6).to({ y: 887.4 }, 4).to({ y: 438.5, alpha: 0 }, 18).to({ _off: true }, 1).wait(42));
            // HangingAnimMC
            this.instance_39 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 97, false);
            this.instance_39.setTransform(951.7, -99.7, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_39._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_39).wait(321).to({ startPosition: 97, _off: false }, 0).to({ y: -65.1 }, 9).to({ y: -962.1, alpha: 0 }, 19).to({ _off: true }, 1).wait(65));
            // HangingAnimMC
            this.instance_40 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 97, false);
            this.instance_40.setTransform(748.2, -34.8, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_40._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_40).wait(321).to({ startPosition: 97, _off: false }, 0).to({ y: -0.2 }, 9).to({ y: -897.2, alpha: 0 }, 19).to({ _off: true }, 1).wait(65));
            // HangingAnimMC
            this.instance_41 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 97, false);
            this.instance_41.setTransform(559.4, -99.7, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_41._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_41).wait(321).to({ startPosition: 97, _off: false }, 0).to({ y: -65.1 }, 9).to({ y: -962.1, alpha: 0 }, 19).to({ _off: true }, 1).wait(65));
            // HangingAnimMC
            this.instance_42 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 97, false);
            this.instance_42.setTransform(364.7, -34.8, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_42._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_42).wait(321).to({ startPosition: 97, _off: false }, 0).to({ y: -0.2 }, 9).to({ y: -897.2, alpha: 0 }, 19).to({ _off: true }, 1).wait(65));
            // HangingAnimMC
            this.instance_43 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 97, false);
            this.instance_43.setTransform(170, -99.7, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_43._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_43).wait(321).to({ startPosition: 97, _off: false }, 0).to({ y: -65.1 }, 9).to({ y: -962.1, alpha: 0 }, 19).to({ _off: true }, 1).wait(65));
            // HangingAnim
            this.instance_44 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 0, false);
            this.instance_44.setTransform(951.7, -99.7, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_44._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_44).wait(14).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 307).wait(94));
            // HangingAnim
            this.instance_45 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 0, false);
            this.instance_45.setTransform(748.2, -34.8, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_45._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_45).wait(13).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 308).wait(94));
            // HangingAnim
            this.instance_46 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 0, false);
            this.instance_46.setTransform(559.4, -99.7, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_46._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_46).wait(11).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 310).wait(94));
            // HangingAnim
            this.instance_47 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 0, false);
            this.instance_47.setTransform(364.7, -34.8, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_47._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_47).wait(7).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 314).wait(94));
            // HangingAnim
            this.instance_48 = new fudaole.PickBonusPT.HangingAnimMC_P("synched", 0, false);
            this.instance_48.setTransform(170, -99.7, 1, 1, 0, 0, 0, -180.5, -1045.9);
            this.instance_48._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_48).wait(3).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 318).wait(94));
            // Glow Behind Logo
            this.instance_49 = new fudaole.PickBonusPT.behindLogoGrp_P("synched", 0);
            this.instance_49.setTransform(539, 880.4);
            this.instance_49.alpha = 0;
            this.instance_49._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_49).wait(29).to({ startPosition: 0, _off: false }, 0).to({ alpha: 1 }, 7).to({ startPosition: 0 }, 8).wait(300).to({ startPosition: 0 }, 0).to({ startPosition: 0 }, 10).to({ alpha: 0 }, 14).to({ _off: true }, 1).wait(46));
            pickBtns.push(this.Pick00);
            pickBtns.push(this.Pick01);
            pickBtns.push(this.Pick02);
            pickBtns.push(this.Pick03);
            pickBtns.push(this.Pick04);
            pickBtns.push(this.Pick05);
            pickBtns.push(this.Pick06);
            pickBtns.push(this.Pick07);
            pickBtns.push(this.Pick08);
            pickBtns.push(this.Pick09);
            pickBtns.push(this.Pick10);
            pickBtns.push(this.Pick11);
            pickBtns.push(this.Pick12);
            pickBtns.push(this.Pick13);
            pickBtns.push(this.Pick14);
            this.Pick00.name = "Pick00";
            this.Pick01.name = "Pick01";
            this.Pick02.name = "Pick02";
            this.Pick03.name = "Pick03";
            this.Pick04.name = "Pick04";
            this.Pick05.name = "Pick05";
            this.Pick06.name = "Pick06";
            this.Pick07.name = "Pick07";
            this.Pick08.name = "Pick08";
            this.Pick09.name = "Pick09";
            this.Pick10.name = "Pick10";
            this.Pick11.name = "Pick11";
            this.Pick12.name = "Pick12";
            this.Pick13.name = "Pick13";
            this.Pick14.name = "Pick14";
            glowAnim.push(this.glow00);
            glowAnim.push(this.glow01);
            glowAnim.push(this.glow02);
            glowAnim.push(this.glow03);
            glowAnim.push(this.glow04);
            glowAnim.push(this.glow05);
            glowAnim.push(this.glow06);
            glowAnim.push(this.glow07);
            glowAnim.push(this.glow08);
            glowAnim.push(this.glow09);
            glowAnim.push(this.glow10);
            glowAnim.push(this.glow11);
            glowAnim.push(this.glow12);
            glowAnim.push(this.glow13);
            glowAnim.push(this.glow14);
            miniSmallRev.push(this.MiniRev01);
            miniSmallRev.push(this.MiniRev02);
            miniSmallRev.push(this.MiniRev03);
            minorSmallRev.push(this.MinorRev01);
            minorSmallRev.push(this.MinorRev02);
            minorSmallRev.push(this.MinorRev03);
            majorSmallRev.push(this.MajorRev01);
            majorSmallRev.push(this.MajorRev02);
            majorSmallRev.push(this.MajorRev03);
            maxiSmallRev.push(this.MaxiRev01);
            maxiSmallRev.push(this.MaxiRev02);
            maxiSmallRev.push(this.MaxiRev03);
            miniRev.push(this.MiniReveal01);
            miniRev.push(this.MiniReveal02);
            miniRev.push(this.MiniReveal03);
            minorRev.push(this.MinorReveal01);
            minorRev.push(this.MinorReveal02);
            minorRev.push(this.MinorReveal03);
            majorRev.push(this.MajorReveal01);
            majorRev.push(this.MajorReveal02);
            majorRev.push(this.MajorReveal03);
            maxiRev.push(this.MaxiReveal01);
            maxiRev.push(this.MaxiReveal02);
            maxiRev.push(this.MaxiReveal03);
            winnerTxt = this.WinnerBannerTxt;
            winnerValue = this.WinnerBannerTxtVal;
            introTxt = this.pickinfoTxt1;
            introValue = this.pickinfoTxt2;
            miniValue = this.MiniTxtVal;
            minorValue = this.MinorTxtVal;
            majorValue = this.MajorTxtVal;
            maxiValue = this.MaxiTxtVal;
            winnerMCs.push(this.MiniWinnerMC);
            winnerMCs.push(this.MinorWinnerMC);
            winnerMCs.push(this.MajorWinnerMC);
            winnerMCs.push(this.MaxiWinnerMC);
            antiAnim.push(this.AntiMini);
            antiAnim.push(this.AntiMinor);
            antiAnim.push(this.AntiMajor);
            antiAnim.push(this.AntiMaxi);
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-68.8, -123.3, 1243.4, 1717.1);
        // symbols:
        (fudaole.PickBonusPT.anticipationglow2 = function () {
            this.initialize(fudaole.PickBonusPT.img.anticipationglow2);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 147, 144);
        (fudaole.PickBonusPT.behindlogo = function () {
            this.initialize(fudaole.PickBonusPT.img.behindlogo);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 1167, 643);
        (fudaole.PickBonusPT.bottomknot = function () {
            this.initialize(fudaole.PickBonusPT.img.bottomknot);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 117, 56);
        (fudaole.PickBonusPT.coinglow = function () {
            this.initialize(fudaole.PickBonusPT.img.coinglow);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 186, 186);
        (fudaole.PickBonusPT.coinpick = function () {
            this.initialize(fudaole.PickBonusPT.img.coinpick);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 170, 169);
        (fudaole.PickBonusPT.gamelogo = function () {
            this.initialize(fudaole.PickBonusPT.img.gamelogo);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 630, 470);
        (fudaole.PickBonusPT.hangingboard = function () {
            this.initialize(fudaole.PickBonusPT.img.hangingboard);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 342, 178);
        (fudaole.PickBonusPT.pick_00000 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00000);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00001 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00001);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00002 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00002);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00003 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00003);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00004 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00004);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00005 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00005);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00006 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00006);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00007 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00007);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00008 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00008);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00009 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00009);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00010 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00010);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00011 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00011);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00012 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00012);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00013 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00013);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00014 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00014);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00015 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00015);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00016 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00016);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00017 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00017);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00018 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00018);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00019 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00019);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00020 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00020);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00021 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00021);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00022 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00022);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pick_00023 = function () {
            this.initialize(fudaole.PickBonusPT.img.pick_00023);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 150, 150);
        (fudaole.PickBonusPT.pickcircle = function () {
            this.initialize(fudaole.PickBonusPT.img.pickcircle);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusPT.pickindicator00 = function () {
            this.initialize(fudaole.PickBonusPT.img.pickindicator00);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusPT.pickindicator01 = function () {
            this.initialize(fudaole.PickBonusPT.img.pickindicator01);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusPT.pickindicator02 = function () {
            this.initialize(fudaole.PickBonusPT.img.pickindicator02);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusPT.pickindicator03 = function () {
            this.initialize(fudaole.PickBonusPT.img.pickindicator03);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 72, 71);
        (fudaole.PickBonusPT.pickinfo = function () {
            this.initialize(fudaole.PickBonusPT.img.pickinfo);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 1389, 1080);
        (fudaole.PickBonusPT.pickstate01 = function () {
            this.initialize(fudaole.PickBonusPT.img.pickstate01);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 238, 221);
        (fudaole.PickBonusPT.pickstate02 = function () {
            this.initialize(fudaole.PickBonusPT.img.pickstate02);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 238, 221);
        (fudaole.PickBonusPT.pickstate03 = function () {
            this.initialize(fudaole.PickBonusPT.img.pickstate03);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 238, 221);
        (fudaole.PickBonusPT.pickstate04 = function () {
            this.initialize(fudaole.PickBonusPT.img.pickstate04);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 238, 221);
        (fudaole.PickBonusPT.pmajorglow = function () {
            this.initialize(fudaole.PickBonusPT.img.pmajorglow);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 954, 330);
        (fudaole.PickBonusPT.pmaxiglow = function () {
            this.initialize(fudaole.PickBonusPT.img.pmaxiglow);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 1080, 363);
        (fudaole.PickBonusPT.pminiglow = function () {
            this.initialize(fudaole.PickBonusPT.img.pminiglow);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 606, 343);
        (fudaole.PickBonusPT.ppickmajormeter = function () {
            this.initialize(fudaole.PickBonusPT.img.ppickmajormeter);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 797, 207);
        (fudaole.PickBonusPT.ppickmaximeter = function () {
            this.initialize(fudaole.PickBonusPT.img.ppickmaximeter);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 932, 236);
        (fudaole.PickBonusPT.ppickminimeter = function () {
            this.initialize(fudaole.PickBonusPT.img.ppickminimeter);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 460, 185);
        (fudaole.PickBonusPT.ppickminormeter = function () {
            this.initialize(fudaole.PickBonusPT.img.ppickminormeter);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 468, 186);
        (fudaole.PickBonusPT.redefx_00001 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00001);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00003 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00003);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00005 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00005);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00007 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00007);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00009 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00009);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00011 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00011);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00013 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00013);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00015 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00015);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00017 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00017);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00019 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00019);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00021 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00021);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00023 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00023);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00025 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00025);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00027 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00027);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00029 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00029);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00031 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00031);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00033 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00033);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00035 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00035);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00037 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00037);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00039 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00039);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00041 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00041);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00043 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00043);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00045 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00045);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00047 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00047);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00049 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00049);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00051 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00051);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00053 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00053);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00055 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00055);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00057 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00057);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.redefx_00059 = function () {
            this.initialize(fudaole.PickBonusPT.img.redefx_00059);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 550, 600);
        (fudaole.PickBonusPT.tassle = function () {
            this.initialize(fudaole.PickBonusPT.img.tassle);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 62, 189);
        (fudaole.PickBonusPT.threadbounce1 = function () {
            this.initialize(fudaole.PickBonusPT.img.threadbounce1);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 55, 381);
        (fudaole.PickBonusPT.threadbounce2 = function () {
            this.initialize(fudaole.PickBonusPT.img.threadbounce2);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 55, 381);
        (fudaole.PickBonusPT.threadbounce3 = function () {
            this.initialize(fudaole.PickBonusPT.img.threadbounce3);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 55, 381);
        (fudaole.PickBonusPT.upperknot = function () {
            this.initialize(fudaole.PickBonusPT.img.upperknot);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 102, 115);
        (fudaole.PickBonusPT.winnerbanner = function () {
            this.initialize(fudaole.PickBonusPT.img.winnerbanner);
        }).prototype = p = new createjs.Bitmap(null);
        p.nominalBounds = new createjs.Rectangle(0, 0, 1080, 997);
        (fudaole.PickBonusPT.upperknot_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.upperknot();
            this.instance.setTransform(-50.9, -57.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-50.9, -57.4, 102, 115);
        (fudaole.PickBonusPT.tussleGrap_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.bottomknot();
            this.instance.setTransform(-58.4, -27.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-58.4, -27.9, 117, 56);
        (fudaole.PickBonusPT.thread3_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.threadbounce3();
            this.instance.setTransform(-27.4, -190.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-27.4, -190.4, 55, 381);
        (fudaole.PickBonusPT.thread2_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.threadbounce2();
            this.instance.setTransform(-27.4, -190.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-27.4, -190.4, 55, 381);
        (fudaole.PickBonusPT.thread1_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.threadbounce1();
            this.instance.setTransform(-27.4, -205, 1, 1.038);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-27.4, -205, 55, 395.6);
        (fudaole.PickBonusPT.textback_P = function () {
            this.initialize();
            // Layer 2
            this.shape = new createjs.Shape();
            this.shape.graphics.lf(["rgba(255,255,255,0)", "rgba(255,255,255,0.667)", "rgba(205,215,247,0.867)", "rgba(255,255,255,0.867)", "rgba(207,213,248,0.867)", "rgba(255,255,255,0.686)", "rgba(255,255,255,0)"], [0.02, 0.118, 0.243, 0.471, 0.745, 0.878, 1], -397.9, 0.4, 402.9, 0.4).s().p("EhAcAANIAAgZMCA5AAAIAAAZg");
            this.shape.setTransform(0, 71.6);
            this.shape_1 = new createjs.Shape();
            this.shape_1.graphics.lf(["rgba(255,255,255,0)", "rgba(255,255,255,0.667)", "rgba(205,215,247,0.867)", "rgba(255,255,255,0.867)", "rgba(207,213,248,0.867)", "rgba(255,255,255,0.686)", "rgba(255,255,255,0)"], [0.02, 0.118, 0.243, 0.471, 0.745, 0.878, 1], -397.9, 0.4, 402.9, 0.4).s().p("EhAcAANIAAgZMCA5AAAIAAAZg");
            this.shape_1.setTransform(0, -71.3);
            // Layer 1
            this.shape_2 = new createjs.Shape();
            this.shape_2.graphics.lf(["rgba(51,0,102,0)", "rgba(51,0,102,0)", "rgba(51,0,204,0.671)", "rgba(51,0,109,0.867)", "rgba(51,0,112,0.859)", "rgba(51,0,193,0.69)", "rgba(51,0,102,0)"], [0, 0, 0.118, 0.243, 0.753, 0.878, 1], -397.9, 21.1, 402.9, 21.1).s().p("EhAcAK+IAA17MCA5AAAIAAV7g");
            this.addChild(this.shape_2, this.shape_1, this.shape);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-412.4, -72.6, 825.1, 145.6);
        (fudaole.PickBonusPT.tassleGrap_P = function () {
            this.initialize();
            // Layer 2
            this.instance = new fudaole.PickBonusPT.tassle();
            this.instance.setTransform(-31.9, -109.1);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-31.9, -109.1, 62, 189);
        (fudaole.PickBonusPT.RevealAnimGrap_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pick_00000();
            this.instance.setTransform(-74.9, -74.9);
            this.instance_1 = new fudaole.PickBonusPT.pick_00001();
            this.instance_1.setTransform(-74.9, -74.9);
            this.instance_2 = new fudaole.PickBonusPT.pick_00002();
            this.instance_2.setTransform(-74.9, -74.9);
            this.instance_3 = new fudaole.PickBonusPT.pick_00003();
            this.instance_3.setTransform(-74.9, -74.9);
            this.instance_4 = new fudaole.PickBonusPT.pick_00004();
            this.instance_4.setTransform(-74.9, -74.9);
            this.instance_5 = new fudaole.PickBonusPT.pick_00005();
            this.instance_5.setTransform(-74.9, -74.9);
            this.instance_6 = new fudaole.PickBonusPT.pick_00006();
            this.instance_6.setTransform(-74.9, -74.9);
            this.instance_7 = new fudaole.PickBonusPT.pick_00007();
            this.instance_7.setTransform(-74.9, -74.9);
            this.instance_8 = new fudaole.PickBonusPT.pick_00008();
            this.instance_8.setTransform(-74.9, -74.9);
            this.instance_9 = new fudaole.PickBonusPT.pick_00009();
            this.instance_9.setTransform(-74.9, -74.9);
            this.instance_10 = new fudaole.PickBonusPT.pick_00010();
            this.instance_10.setTransform(-74.9, -74.9);
            this.instance_11 = new fudaole.PickBonusPT.pick_00011();
            this.instance_11.setTransform(-74.9, -74.9);
            this.instance_12 = new fudaole.PickBonusPT.pick_00012();
            this.instance_12.setTransform(-74.9, -74.9);
            this.instance_13 = new fudaole.PickBonusPT.pick_00013();
            this.instance_13.setTransform(-74.9, -74.9);
            this.instance_14 = new fudaole.PickBonusPT.pick_00014();
            this.instance_14.setTransform(-74.9, -74.9);
            this.instance_15 = new fudaole.PickBonusPT.pick_00015();
            this.instance_15.setTransform(-74.9, -74.9);
            this.instance_16 = new fudaole.PickBonusPT.pick_00016();
            this.instance_16.setTransform(-74.9, -74.9);
            this.instance_17 = new fudaole.PickBonusPT.pick_00017();
            this.instance_17.setTransform(-74.9, -74.9);
            this.instance_18 = new fudaole.PickBonusPT.pick_00018();
            this.instance_18.setTransform(-74.9, -74.9);
            this.instance_19 = new fudaole.PickBonusPT.pick_00019();
            this.instance_19.setTransform(-74.9, -74.9);
            this.instance_20 = new fudaole.PickBonusPT.pick_00020();
            this.instance_20.setTransform(-74.9, -74.9);
            this.instance_21 = new fudaole.PickBonusPT.pick_00021();
            this.instance_21.setTransform(-74.9, -74.9);
            this.instance_22 = new fudaole.PickBonusPT.pick_00022();
            this.instance_22.setTransform(-74.9, -74.9);
            this.instance_23 = new fudaole.PickBonusPT.pick_00023();
            this.instance_23.setTransform(-74.9, -74.9);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).to({ state: [{ t: this.instance_1 }] }, 1).to({ state: [{ t: this.instance_2 }] }, 1).to({ state: [{ t: this.instance_3 }] }, 1).to({ state: [{ t: this.instance_4 }] }, 1).to({ state: [{ t: this.instance_5 }] }, 1).to({ state: [{ t: this.instance_6 }] }, 1).to({ state: [{ t: this.instance_7 }] }, 1).to({ state: [{ t: this.instance_8 }] }, 1).to({ state: [{ t: this.instance_9 }] }, 1).to({ state: [{ t: this.instance_10 }] }, 1).to({ state: [{ t: this.instance_11 }] }, 1).to({ state: [{ t: this.instance_12 }] }, 1).to({ state: [{ t: this.instance_13 }] }, 1).to({ state: [{ t: this.instance_14 }] }, 1).to({ state: [{ t: this.instance_15 }] }, 1).to({ state: [{ t: this.instance_16 }] }, 1).to({ state: [{ t: this.instance_17 }] }, 1).to({ state: [{ t: this.instance_18 }] }, 1).to({ state: [{ t: this.instance_19 }] }, 1).to({ state: [{ t: this.instance_20 }] }, 1).to({ state: [{ t: this.instance_21 }] }, 1).to({ state: [{ t: this.instance_22 }] }, 1).to({ state: [{ t: this.instance_23 }] }, 1).wait(1));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-74.9, -74.9, 150, 150);
        (fudaole.PickBonusPT.reeffectsp = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 2
            this.instance = new fudaole.PickBonusPT.redefx_00001();
            this.instance.setTransform(26.6, 122.4);
            this.instance_1 = new fudaole.PickBonusPT.redefx_00003();
            this.instance_1.setTransform(26.6, 122.4);
            this.instance_2 = new fudaole.PickBonusPT.redefx_00005();
            this.instance_2.setTransform(26.6, 122.4);
            this.instance_3 = new fudaole.PickBonusPT.redefx_00007();
            this.instance_3.setTransform(26.6, 122.4);
            this.instance_4 = new fudaole.PickBonusPT.redefx_00009();
            this.instance_4.setTransform(26.6, 122.4);
            this.instance_5 = new fudaole.PickBonusPT.redefx_00011();
            this.instance_5.setTransform(26.6, 122.4);
            this.instance_6 = new fudaole.PickBonusPT.redefx_00013();
            this.instance_6.setTransform(26.6, 122.4);
            this.instance_7 = new fudaole.PickBonusPT.redefx_00015();
            this.instance_7.setTransform(26.6, 122.4);
            this.instance_8 = new fudaole.PickBonusPT.redefx_00017();
            this.instance_8.setTransform(26.6, 122.4);
            this.instance_9 = new fudaole.PickBonusPT.redefx_00019();
            this.instance_9.setTransform(26.6, 122.4);
            this.instance_10 = new fudaole.PickBonusPT.redefx_00021();
            this.instance_10.setTransform(26.6, 122.4);
            this.instance_11 = new fudaole.PickBonusPT.redefx_00023();
            this.instance_11.setTransform(26.6, 122.4);
            this.instance_12 = new fudaole.PickBonusPT.redefx_00025();
            this.instance_12.setTransform(26.6, 122.4);
            this.instance_13 = new fudaole.PickBonusPT.redefx_00027();
            this.instance_13.setTransform(26.6, 122.4);
            this.instance_14 = new fudaole.PickBonusPT.redefx_00029();
            this.instance_14.setTransform(26.6, 122.4);
            this.instance_15 = new fudaole.PickBonusPT.redefx_00031();
            this.instance_15.setTransform(26.6, 122.4);
            this.instance_16 = new fudaole.PickBonusPT.redefx_00033();
            this.instance_16.setTransform(26.6, 122.4);
            this.instance_17 = new fudaole.PickBonusPT.redefx_00035();
            this.instance_17.setTransform(26.6, 122.4);
            this.instance_18 = new fudaole.PickBonusPT.redefx_00037();
            this.instance_18.setTransform(26.6, 122.4);
            this.instance_19 = new fudaole.PickBonusPT.redefx_00039();
            this.instance_19.setTransform(26.6, 122.4);
            this.instance_20 = new fudaole.PickBonusPT.redefx_00041();
            this.instance_20.setTransform(26.6, 122.4);
            this.instance_21 = new fudaole.PickBonusPT.redefx_00043();
            this.instance_21.setTransform(26.6, 122.4);
            this.instance_22 = new fudaole.PickBonusPT.redefx_00045();
            this.instance_22.setTransform(26.6, 122.4);
            this.instance_23 = new fudaole.PickBonusPT.redefx_00047();
            this.instance_23.setTransform(26.6, 122.4);
            this.instance_24 = new fudaole.PickBonusPT.redefx_00049();
            this.instance_24.setTransform(26.6, 122.4);
            this.instance_25 = new fudaole.PickBonusPT.redefx_00051();
            this.instance_25.setTransform(26.6, 122.4);
            this.instance_26 = new fudaole.PickBonusPT.redefx_00053();
            this.instance_26.setTransform(26.6, 122.4);
            this.instance_27 = new fudaole.PickBonusPT.redefx_00055();
            this.instance_27.setTransform(26.6, 122.4);
            this.instance_28 = new fudaole.PickBonusPT.redefx_00057();
            this.instance_28.setTransform(26.6, 122.4);
            this.instance_29 = new fudaole.PickBonusPT.redefx_00059();
            this.instance_29.setTransform(26.6, 122.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).to({ state: [{ t: this.instance_1 }] }, 2).to({ state: [{ t: this.instance_2 }] }, 2).to({ state: [{ t: this.instance_3 }] }, 2).to({ state: [{ t: this.instance_4 }] }, 2).to({ state: [{ t: this.instance_5 }] }, 2).to({ state: [{ t: this.instance_6 }] }, 2).to({ state: [{ t: this.instance_7 }] }, 2).to({ state: [{ t: this.instance_8 }] }, 2).to({ state: [{ t: this.instance_9 }] }, 2).to({ state: [{ t: this.instance_10 }] }, 2).to({ state: [{ t: this.instance_11 }] }, 2).to({ state: [{ t: this.instance_12 }] }, 2).to({ state: [{ t: this.instance_13 }] }, 2).to({ state: [{ t: this.instance_14 }] }, 2).to({ state: [{ t: this.instance_15 }] }, 2).to({ state: [{ t: this.instance_16 }] }, 2).to({ state: [{ t: this.instance_17 }] }, 2).to({ state: [{ t: this.instance_18 }] }, 2).to({ state: [{ t: this.instance_19 }] }, 2).to({ state: [{ t: this.instance_20 }] }, 2).to({ state: [{ t: this.instance_21 }] }, 2).to({ state: [{ t: this.instance_22 }] }, 2).to({ state: [{ t: this.instance_23 }] }, 2).to({ state: [{ t: this.instance_24 }] }, 2).to({ state: [{ t: this.instance_25 }] }, 2).to({ state: [{ t: this.instance_26 }] }, 2).to({ state: [{ t: this.instance_27 }] }, 2).to({ state: [{ t: this.instance_28 }] }, 2).to({ state: [{ t: this.instance_29 }] }, 2).wait(17));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(26.6, 122.4, 550, 600);
        (fudaole.PickBonusPT.PMinorMeterSym_P = function () {
            this.initialize();
            // Layer 2
            this.instance = new fudaole.PickBonusPT.ppickminormeter();
            this.instance.setTransform(-233.9, -92.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-233.9, -92.9, 468, 186);
        (fudaole.PickBonusPT.PMiniMeterSym_P = function () {
            this.initialize();
            // Layer 2
            this.instance = new fudaole.PickBonusPT.ppickminimeter();
            this.instance.setTransform(-229.9, -92.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-229.9, -92.4, 460, 185);
        (fudaole.PickBonusPT.PMaxiMeterSym_P = function () {
            this.initialize();
            // Layer 2
            this.instance = new fudaole.PickBonusPT.ppickmaximeter();
            this.instance.setTransform(-465.9, -117.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-465.9, -117.9, 932, 236);
        (fudaole.PickBonusPT.PMajorMeterSym_P = function () {
            this.initialize();
            // Layer 2
            this.instance = new fudaole.PickBonusPT.ppickmajormeter();
            this.instance.setTransform(-398.4, -103.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-398.4, -103.4, 797, 207);
        (fudaole.PickBonusPT.pickinfomsg_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pickinfo();
            this.instance.setTransform(-747.8, -539.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-747.8, -539.9, 1389, 1080);
        (fudaole.PickBonusPT.PickIndicator03_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pickindicator03();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusPT.PickIndicator02_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pickindicator02();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusPT.PickIndicator01_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pickindicator01();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusPT.PickIndicator00_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pickindicator00();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusPT.miniparglow_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pminiglow();
            this.instance.setTransform(-302.9, -171.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-302.9, -171.4, 606, 343);
        (fudaole.PickBonusPT.maxiparglow_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pmaxiglow();
            this.instance.setTransform(-539.9, -181.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-539.9, -181.4, 1080, 363);
        (fudaole.PickBonusPT.majorparglow_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pmajorglow();
            this.instance.setTransform(-476.9, -164.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-476.9, -164.9, 954, 330);
        (fudaole.PickBonusPT.hangboard_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.hangingboard();
            this.instance.setTransform(-170.9, -88.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-170.9, -88.9, 342, 178);
        (fudaole.PickBonusPT.GameLogo_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.gamelogo();
            this.instance.setTransform(-314.9, -234.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-314.9, -234.9, 630, 470);
        (fudaole.PickBonusPT.CoinGrapSym_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.coinpick();
            this.instance.setTransform(-84.9, -84.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-84.9, -84.4, 170, 169);
        (fudaole.PickBonusPT.CoinGlowGrap_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.coinglow();
            this.instance.setTransform(-92.9, -92.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-92.9, -92.9, 186, 186);
        (fudaole.PickBonusPT.CircleSym_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.pickcircle();
            this.instance.setTransform(-35.9, -35.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-35.9, -35.4, 72, 71);
        (fudaole.PickBonusPT.behindLogoGrp_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.behindlogo();
            this.instance.setTransform(-583.4, -321.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-583.4, -321.4, 1167, 643);
        (fudaole.PickBonusPT.bannerwinner_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.winnerbanner();
            this.instance.setTransform(-539.9, -498.4);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-539.9, -498.4, 1080, 997);
        (fudaole.PickBonusPT.anticipglowgrap_P = function () {
            this.initialize();
            // Layer 1
            this.instance = new fudaole.PickBonusPT.anticipationglow2();
            this.instance.setTransform(-73.4, -71.9);
            this.addChild(this.instance);
        }).prototype = p = new createjs.Container();
        p.nominalBounds = new createjs.Rectangle(-73.4, -71.9, 147, 144);
        (fudaole.PickBonusPT.WinnerGlowMC = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { Start: 0, End: 23 });
            // RevealAnimGrap_P
            this.instance = new fudaole.PickBonusPT.RevealAnimGrap_P("synched", 0, false);
            this.instance.setTransform(1.6, 0.1, 3.427, 3.427);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // RevealAnimGrap_P
            this.instance_1 = new fudaole.PickBonusPT.RevealAnimGrap_P("synched", 0, false);
            this.instance_1.setTransform(-181.9, 3.5, 3.206, 3.206);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance_1 }] }).wait(30));
            // RevealAnimGrap_P
            this.instance_2 = new fudaole.PickBonusPT.RevealAnimGrap_P("synched", 0, false);
            this.instance_2.setTransform(178.5, 0.1, 3.206, 3.206);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance_2 }] }).wait(30));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-422.3, -256.9, 841.4, 514);
        (fudaole.PickBonusPT.PickState03_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { "Start": 0, hide: 3, "End": 24 });
            // Layer 3
            this.instance = new fudaole.PickBonusPT.RevealAnimGrap_P("synched", 0, false);
            this.instance.setTransform(-2.7, 6.4, 2.25, 2.25);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusPT.pickstate04();
            this.instance_1.setTransform(-118.9, -110.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.instance_1 }] }, 10).wait(20));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-171.5, -162.3, 337.5, 337.5);
        (fudaole.PickBonusPT.PickState02_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { "Start": 0, "hide": 3, "End": 24 });
            // Layer 3
            this.instance = new fudaole.PickBonusPT.RevealAnimGrap_P("synched", 0, false);
            this.instance.setTransform(-2.7, 6.4, 2.25, 2.25);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusPT.pickstate03();
            this.instance_1.setTransform(-118.9, -110.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.instance_1 }] }, 10).wait(20));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-171.5, -162.3, 337.5, 337.5);
        (fudaole.PickBonusPT.PickState01_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { "Start": 0, "hide": 3, "End": 24 });
            // Layer 3
            this.instance = new fudaole.PickBonusPT.RevealAnimGrap_P("synched", 0, false);
            this.instance.setTransform(-2.7, 6.4, 2.25, 2.25);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusPT.pickstate02();
            this.instance_1.setTransform(-118.9, -110.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.instance_1 }] }, 10).wait(20));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-171.5, -162.3, 337.5, 337.5);
        (fudaole.PickBonusPT.PickState00_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, { "Start": 0, "hide": 3, "End": 24 });
            // Layer 3
            this.instance = new fudaole.PickBonusPT.RevealAnimGrap_P("synched", 0, false);
            this.instance.setTransform(-2.7, 6.4, 2.25, 2.25);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(30));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusPT.pickstate01();
            this.instance_1.setTransform(-118.9, -110.4);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [] }).to({ state: [{ t: this.instance_1 }] }, 10).wait(20));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-171.5, -162.3, 337.5, 337.5);
        (fudaole.PickBonusPT.PickBtn_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 1
            this.instance = new fudaole.PickBonusPT.CoinGrapSym_P("synched", 0);
            this.timeline.addTween(createjs.Tween.get({}).to({ state: [{ t: this.instance }] }).wait(4));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-84.9, -84.4, 170, 169);
        (fudaole.PickBonusPT.HangingAnimMC_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 8
            this.instance = new fudaole.PickBonusPT.upperknot_P("synched", 0);
            this.instance.setTransform(-185.5, -1373.2);
            this.timeline.addTween(createjs.Tween.get(this.instance).to({ y: -780.6 }, 7).to({ y: -306.6 }, 5).wait(86));
            // Layer 1
            this.instance_1 = new fudaole.PickBonusPT.hangboard_P("synched", 0);
            this.instance_1.setTransform(-187.7, -1156.9, 1, 1, 0, 0, 0, -7.3, -79.9);
            this.timeline.addTween(createjs.Tween.get(this.instance_1).to({ y: -536.4 }, 7).to({ x: -183.2, y: -101.9 }, 7).to({ x: -184.3, y: -53.5 }, 8).to({ rotation: -2.5, x: -196.4, y: -161.3 }, 14).to({ startPosition: 0 }, 6).to({ rotation: -0.5, x: -183.2, y: -101.8 }, 8).to({ regY: -79.9, rotation: 0, x: -175.5, y: -84.3 }, 7).to({ regY: -79.8, rotation: -0.6, x: -181, y: -121.6 }, 6).to({ rotation: 1.7, x: -192, y: -88.6 }, 12).to({ rotation: 0, x: -186.5, y: -100.7 }, 10).wait(13));
            // Layer 3
            this.instance_2 = new fudaole.PickBonusPT.thread3_P("synched", 0);
            this.instance_2.setTransform(-183.3, -343.8, 1.053, 1, 0, -3.2, 176.7, -7.4, -160.1);
            this.instance_2._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_2).wait(33).to({ startPosition: 0, _off: false }, 0).wait(4).to({ skewX: -2.6, skewY: 177.2 }, 0).to({ skewX: -2.3, skewY: 177.5 }, 5).to({ skewX: -5, skewY: 174.8 }, 6).to({ _off: true }, 2).wait(8).to({ skewX: -4.9, skewY: 174.9, y: -343.6, _off: false }, 0).to({ regX: -7.2, regY: -160.1, skewX: -4.4, skewY: 175.4, x: -183.3, y: -343.7 }, 4).to({ _off: true }, 4).wait(32));
            // Layer 4
            this.instance_3 = new fudaole.PickBonusPT.thread2_P("synched", 0);
            this.instance_3.setTransform(-180.3, -183.8);
            this.instance_3._off = true;
            this.timeline.addTween(createjs.Tween.get(this.instance_3).wait(30).to({ startPosition: 0, _off: false }, 0).to({ _off: true }, 3).wait(17).to({ regX: -4.5, regY: -167.7, rotation: -2.3, x: -184.8, y: -351.4, _off: false }, 0).to({ _off: true }, 4).wait(12).to({ regX: -7.7, regY: -155.2, rotation: -1.6, x: -188, y: -338.9, _off: false }, 0).to({ rotation: -0.6 }, 5).to({ rotation: 0 }, 6).to({ regX: -7.6, rotation: -1.1, x: -187.9 }, 4).to({ regY: -155.1, rotation: -1.8 }, 4).wait(13));
            // Layer 5
            this.instance_4 = new fudaole.PickBonusPT.thread1_P("synched", 0);
            this.instance_4.setTransform(-183.4, -1412.4, 1, 1.636);
            this.timeline.addTween(createjs.Tween.get(this.instance_4).to({ scaleY: 1, y: -171.3 }, 12).to({ startPosition: 0 }, 10).to({ _off: true }, 8).wait(24).to({ regX: -6.1, regY: -174, rotation: -1.5, x: -189.5, y: -345.3, _off: false }, 0).to({ _off: true }, 4).wait(40));
            // Layer 2
            this.instance_5 = new fudaole.PickBonusPT.tassleGrap_P("synched", 0);
            this.instance_5.setTransform(-184.5, -564.4, 1, 1, 9, 0, 0, 2.6, -91.1);
            this.timeline.addTween(createjs.Tween.get(this.instance_5).to({ regY: -91.1, rotation: 8.3, x: -185.6, y: 181.1 }, 7).to({ scaleX: 1, scaleY: 1, rotation: 7.8, x: -186.5, y: 578.6 }, 6).to({ regY: -91.2, scaleX: 1, scaleY: 1, rotation: 7.2, x: -187.6, y: 705.7 }, 9).to({ regY: -91.1, rotation: -7.9, x: -178.5, y: 614.5 }, 8).to({ rotation: -7.9, x: -172, y: 540.1 }, 11).to({ rotation: -1.2, x: -185, y: 601.3 }, 7).to({ regY: -91, rotation: 6.1, x: -168.1, y: 650.8 }, 3).to({ rotation: 7.9, x: -164.2, y: 661.2 }, 6).to({ rotation: 0.4, x: -185, y: 597.5 }, 6).to({ rotation: 2.6, x: -188.9, y: 607.9 }, 4).to({ regY: -91.1, rotation: 3.9, x: -196.7, y: 632.6 }, 9).to({ regX: 2.7, rotation: 1.9, x: -186.2, y: 619.6 }, 9).wait(13));
            // Layer 6
            this.instance_6 = new fudaole.PickBonusPT.tussleGrap_P("synched", 0);
            this.instance_6.setTransform(-180.5, -612.1, 1, 1, 10.2, 0, 0, 0.1, -24.8);
            this.timeline.addTween(createjs.Tween.get(this.instance_6).to({ regX: 0, regY: -24.6, scaleX: 1, scaleY: 1, rotation: 10.1, x: -181.2, y: 29.2 }, 6).to({ rotation: 10, x: -180.4, y: 199.9 }, 2).to({ regX: 0.1, regY: -24.7, scaleX: 1, scaleY: 1, rotation: 10.2, x: -181.8, y: 538.5 }, 5).to({ regX: 0, rotation: 8.6, x: -182.6, y: 588.2 }, 4).to({ regX: 0.1, rotation: 7.3, x: -183.3, y: 668.6 }, 5).to({ rotation: -12.5, x: -184.7, y: 530 }, 14).to({ regX: 0.2, rotation: -7.6, x: -181.8, y: 502.3 }, 6).to({ rotation: -0.4, x: -181.9, y: 572 }, 6).to({ regX: 0.3, rotation: 9.4, x: -159.4, y: 619.6 }, 6).to({ regX: 0.2, rotation: 3.7, x: -183.3, y: 560.7 }, 12).to({ x: -193.1, y: 588.7 }, 9).to({ rotation: 0, x: -186.1, y: 577.5 }, 11).wait(12));
            // Layer 7
            this.instance_7 = new fudaole.PickBonusPT.thread1_P("synched", 0);
            this.instance_7.setTransform(-187.1, -1146.1, 1, 1.731, 0, 0, 0, -3.7, -163.9);
            this.timeline.addTween(createjs.Tween.get(this.instance_7).to({ y: -517.1 }, 6).to({ y: -295.7 }, 2).to({ y: -1 }, 5).to({ y: 77.6 }, 4).to({ y: 133.4 }, 5).to({ rotation: -0.3, x: -186.9, y: 16.4 }, 14).to({ rotation: -0.7, y: -1 }, 6).to({ regY: -163.9, rotation: 0, y: 25 }, 6).to({ rotation: -1.3, x: -180, y: 84.5 }, 6).to({ rotation: 0.4, x: -183.4, y: 40.8 }, 12).to({ rotation: 0.1, x: -195.7, y: 61.8 }, 9).to({ rotation: 0.1, x: -187, y: 56.6 }, 11).wait(12));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-351.5, -1747.9, 342, 1356.6);
        (fudaole.PickBonusPT.coinglowAnim_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 2
            this.instance = new fudaole.PickBonusPT.CoinGlowGrap_P("synched", 0);
            this.instance.alpha = 0;
            this.timeline.addTween(createjs.Tween.get(this.instance).to({ alpha: 0.25 }, 11, createjs.Ease.get(-0.99)).to({ alpha: 0.711 }, 8).to({ alpha: 0.25 }, 8).to({ alpha: 0 }, 12, createjs.Ease.get(1)).wait(1));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-92.9, -92.9, 186, 186);
        (fudaole.PickBonusPT.antiglow_MC_P = function (mode, startPosition, loop) {
            this.initialize(mode, startPosition, loop, {});
            // Layer 1
            this.instance = new fudaole.PickBonusPT.anticipglowgrap_P("synched", 0);
            this.instance.setTransform(0, 0, 0.95, 0.95);
            this.timeline.addTween(createjs.Tween.get(this.instance).to({ scaleX: 1, scaleY: 1, alpha: 0 }, 4).to({ scaleX: 0.95, scaleY: 0.95, alpha: 1 }, 4).wait(1));
        }).prototype = p = new createjs.MovieClip();
        p.nominalBounds = new createjs.Rectangle(-69.7, -68.3, 139.6, 136.8);
})(fudaole);
// Additional exact own native free/feature declarations.
var FreeSpin = (function () {
            function FreeSpin(translator, currencyFormatter, audioController, baseBundle, orientationController, scalar, topMeterContainer, dashBoardContainer, backGroundContainer, handleAnim, gameFeature) {
                this._isFGOutroStart = false;
                this._isFGOutroDone = false;
                this.scalar = scalar;
                this.translator = translator;
                this.currencyFormatter = currencyFormatter;
                this.audioController = audioController;
                this.orientationController = orientationController;
                this.topMeterContainer = topMeterContainer;
                this.dashBoardContainer = dashBoardContainer;
                this.backGroundContainer = backGroundContainer;
                this.baseBundle = baseBundle;
                this.handleAnim = handleAnim;
                this.gameFeature = gameFeature;
                this._isFGOutroStart = false;
                this._isFGOutroDone = false;
            }
            FreeSpin.prototype.introStart = function () {
                this._isFGOutroStart = false;
                this._isFGOutroDone = false;
                this.updateIntroBanner();
                this.handleAnim.getSpinBtn().spinDbBtn().visible = false;
                this.handleAnim.getTopMeter().setGameData(this.gameData);
                this.audioController.playFGTransInSnd();
                this.handleAnim.getTopMeter().fgIntroAnimStart();
                this.handleAnim.getfgBg().fgIntroAnimStart();
            };
            FreeSpin.prototype.outroStart = function () {
                var _this = this;
                if (this._isFGOutroStart)
                    return;
                this._isFGOutroStart = true;
                TweenLite.delayedCall(1.5, function () {
                    _this.updateOutroBanner();
                    _this.handleAnim.getTopMeter().fgOutroAnimStart();
                    _this.handleAnim.getfgBg().fgOutroAnimStart();
                    _this.logic.setIsFGSound(false);
                });
            };
            FreeSpin.prototype.spinStart = function () {
                this.logic.setpayLineComplete(true);
                this.logic.setBangUpComplete(true);
                this.logic.freeGameSpinStart();
                this.audioController.playFgLoopSnd();
            };
            FreeSpin.prototype.updateIntroBanner = function () {
                this.updateTotFreeSpins();
                this.updateIntroTxt();
                this.updateFreeSpinsRem();
                this.updateBonusReelsInPlay();
            };
            FreeSpin.prototype.updateOutroBanner = function () {
                if (this.logic.getMaxWin())
                    var totalFreeSpinsWin = this.currencyFormatter.format(this.getGameData().getCustomData().getgameWinInfo().maxWinValue);
                else
                    var totalFreeSpinsWin = this.currencyFormatter.format(this.getGameData().getCustomData().getgameWinInfo().totalFreeSpinsWin);
                var txt = [this.translator.findByKey("com.fudaole.congratulations"), this.translator.findByKey("com.fudaole.youWon"), totalFreeSpinsWin];
                fudaole.cjsAnim.updateOutroBanner(txt, this.baseBundle.myriadProBold.getFontName());
            };
            FreeSpin.prototype.updateBonusReelsInPlay = function () {
                var txt = [this.translator.findByKey("com.fudaole.bonusReelsInPlay")];
                fudaole.cjsAnim.updateBonusReelsInPlay(txt, this.baseBundle.myriadProBold.getFontName());
            };
            FreeSpin.prototype.reTriggerEndFsRem = function () {
                var totFreeSpins = this.gameData.getCustomData().featureInfo.remainingFreeSpins;
                var totFreeSpinPlayed = this.gameData.getCustomData().featureInfo.totalFreeSpinsPlayed;
                var txt = [totFreeSpinPlayed, totFreeSpins, this.translator.findByKey("com.fudaole.freeGamesPlayed"), this.translator.findByKey("com.fudaole.freeGamesRemaining"), this.translator.findByKey("com.fudaole.freeGamePlayed"), this.translator.findByKey("com.fudaole.freeGameRemaining")];
                fudaole.cjsAnim.updatetFreeSpinsRem(txt, this.baseBundle.myriadProBold.getFontName());
            };
            FreeSpin.prototype.updateFreeSpinsRem = function () {
                if (this.logic.getReTrigger()) {
                    var remainingFreeSpins = Number(this.gameData.getCustomData().featureInfo.remainingFreeSpins);
                    var extraFreeSpinsAwarded = Number(this.gameData.getCustomData().featureInfo.extraFreeSpinsAwarded);
                    var totFreeSpins = (remainingFreeSpins - extraFreeSpinsAwarded).toString();
                }
                else
                    var totFreeSpins = this.gameData.getCustomData().featureInfo.remainingFreeSpins;
                var totFreeSpinPlayed = this.gameData.getCustomData().featureInfo.totalFreeSpinsPlayed;
                var txt = [totFreeSpinPlayed, totFreeSpins, this.translator.findByKey("com.fudaole.freeGamesPlayed"), this.translator.findByKey("com.fudaole.freeGamesRemaining"), this.translator.findByKey("com.fudaole.freeGamePlayed"), this.translator.findByKey("com.fudaole.freeGameRemaining")];
                fudaole.cjsAnim.updatetFreeSpinsRem(txt, this.baseBundle.myriadProBold.getFontName());
            };
            FreeSpin.prototype.updateTotFreeSpins = function () {
                var totFreeSpins = this.gameData.getCustomData().featureInfo.remainingFreeSpins;
                var txt = [totFreeSpins];
                fudaole.cjsAnim.updateTotFreeSpins(totFreeSpins, this.baseBundle.myriadProBold.getFontName());
            };
            FreeSpin.prototype.updateIntroTxt = function () {
                var txt = [this.translator.findByKey("com.fudaole.youWon"), this.translator.findByKey("com.fudaole.freeGames")];
                fudaole.cjsAnim.updateIntroTxt(txt, this.baseBundle.myriadProBold.getFontName());
            };
            FreeSpin.prototype.changeBgReelsOutro = function () {
                this.slot.changeReelSet(Number(this.gameData.getCustomData().featureInfo.baseGameReelIndex));
                this.slot.getWinDisplayController().configure(this.gameData.getCustomData().getBaseGameData());
                var fromAmount = this.gameData.getCustomData().getgameWinInfo().totalFreeSpinsWin;
                var toAmount = this.gameData.getCustomData().getgameWinInfo().totalWagerWin;
                this.slot.getWinDisplayController().updateGameResultTotalWin(fromAmount, toAmount);
                this.slot.getSymbolAnimationController().setHitData(this.gameData.getCustomData().getBaseGameData().getAllSlotResults());
                this.slot.setStopPositions(this.gameData.getCustomData().getBaseGameData().getStopPositions(), true);
                this.slot.getWinDisplayController().playScatterAnim(this.gameData.getCustomData().getgameWinInfo()); //scatter play line animation   
            };
            FreeSpin.prototype.changeFgReelsIntro = function () {
                this.slot.changeReelSet(0);
                this.slot.setStopPositions([0, 0, 0, 0, 0], true);
                this.logic.uiController.setInFG(true);
                this.logic.uiController.setCanUpdateBalance(false);
            };
            FreeSpin.prototype.backToBaseGame = function () {
                if (this._isFGOutroDone)
                    return;
                this._isFGOutroDone = true;
                this.logic.setIsFg(false);
                this.logic.uiController.isReelSpining = true; //to enable slide menu
                if (this.logic.getMaxWin())
                    this.logic.setGameState(11 /* MaxWin */);
                else
                    this.logic.setGameState(6 /* FreeGameEnd */);
                this.logic.uiController.setCanUpdateBalance(true);
                this.logic.uiController.setInFG(false);
                this.logic.handleSpinComplete();
            };
            FreeSpin.prototype.getAllRef = function (gameData, slot, logic) {
                this.gameData = gameData;
                this.slot = slot;
                this.logic = logic;
            };
            FreeSpin.prototype.setGameData = function (gameData) {
                this.gameData = gameData;
            };
            FreeSpin.prototype.getGameData = function () {
                return this.gameData;
            };
            return FreeSpin;
        })();
        fudaole.FreeSpin = FreeSpin;
var SymbolAnimationController = (function () {
            /**
             * @constructor
             */
            function SymbolAnimationController(group, audioController, hitAnimContainer, symbols, pulseDisplay, scalar, uiController) {
                this.group = group;
                this.audioController = audioController;
                this.hitAnimContainer = hitAnimContainer;
                this.symbols = symbols;
                this.pulseDisplay = pulseDisplay;
                this.scalar = scalar;
                this.uiController = uiController;
                this.fgTri1SndFlag = false;
                this.fgTri2SndFlag = false;
                this.wildLabels = ["landStart", "landEnd"];
                this.hitCounter = 0;
                this.symbolsNeededForTrigger = 1;
                this.hits = [];
                for (var i = 0; i < fudaole.Config.NUMBER_OF_REELS; i++) {
                    this.hits.push(null);
                }
                this.signal = {
                    onScatterSymbolAnimComplete: null
                };
                this.events = new events.EventDispatcher(this.signal);
            }
            /**
             * Gets the event dispatcher for this object
             * @method fudaole.SymbolAnimationController#getEvents
             * @public
             * @returns {events.EventDispatcher<ISACListener>} The event dispatcher
             */
            SymbolAnimationController.prototype.getEvents = function () {
                return this.events;
            };
            /**
             * Sets the number of symbols needed for a trigger
             * @method fudaole.SymbolAnimationController#setSymbolsNeededForTrigger
             * @public
             * @param {number} value The number of symbols needed for a bonus trigger
             */
            SymbolAnimationController.prototype.setSymbolsNeededForTrigger = function (value) {
                this.symbolsNeededForTrigger = value;
            };
            /**
             * Sets the hit data
             * @method fudaole.SymbolAnimationController#setHitData
             * @public
             * @param {gamedata.SlotResult[]} data The hit data
             */
            SymbolAnimationController.prototype.setHitData = function (data) {
                this.hitData = data;
            };
            /**
             * Checks for a symbol hit
             * @method fudaole.SymbolAnimationController#checkForSymbolHit
             * @public
             * @param {number} reelId The reel to check for a symbol hit
             */
            SymbolAnimationController.prototype.checkForSymbolHit = function (reelId, stops) {
                var _this = this;
                var symbolRange = [];
                var symbolId = 0;
                var multiplierCount = 0;
                symbolRange.length = fudaole.Config.SYMBOLS_IN_REEL;
                this.group.getController(reelId).getLayout().getStopWindow(stops[reelId], symbolRange);
                for (var i = 1; i < symbolRange.length - 1; i++) {
                    symbolId = symbolRange[i];
                    if (reelId == 1 && symbolId == fudaole.Config.FREEGAME_SCATTER_SYMBOL_ID) {
                        this.audioController.playfgThumbSnd(reelId);
                        this.fgTri1SndFlag = true;
                    }
                    if (reelId == 2 && symbolId == fudaole.Config.FREEGAME_SCATTER_SYMBOL_ID) {
                        if (this.fgTri1SndFlag) {
                            this.audioController.playfgThumbSnd(reelId);
                            this.fgTri2SndFlag = true;
                        }
                    }
                    if (reelId == 3 && symbolId == fudaole.Config.FREEGAME_SCATTER_SYMBOL_ID) {
                        if (this.fgTri1SndFlag && this.fgTri2SndFlag)
                            this.audioController.playfgThumbSnd(reelId);
                    }
                    if (reelId == 4) {
                        this.fgTri1SndFlag = false;
                        this.fgTri2SndFlag = false;
                    }
                    if (this.uiController.logic.getFreeGame()) {
                        if (reelId == 2) {
                            switch (symbolId) {
                                case fudaole.Config.FS_MULTIPLIER_2X_ID:
                                    multiplierCount++;
                                    if (multiplierCount === 3)
                                        TweenLite.delayedCall(0.3, function () {
                                            _this.playFSWildGlow();
                                        });
                                    break;
                                case fudaole.Config.FS_MULTIPLIER_3X_ID:
                                    multiplierCount++;
                                    if (multiplierCount === 3)
                                        TweenLite.delayedCall(0.3, function () {
                                            _this.playFSWildGlow();
                                        });
                                    break;
                                case fudaole.Config.FS_WILD_ID:
                                    multiplierCount++;
                                    if (multiplierCount === 3)
                                        TweenLite.delayedCall(0.3, function () {
                                            _this.playFSWildGlow();
                                        });
                                    break;
                            }
                        }
                    }
                    if (this.uiController.logic.getRedEnvTrigger()) {
                        switch (symbolId) {
                            case fudaole.Config.RED_ENVELOPE_NINE_FIRST:
                                this.audioController.playRedEnvTrigSnd1();
                                break;
                            case fudaole.Config.RED_ENVELOPE_NINE:
                            case fudaole.Config.RED_ENVELOPE_JACK:
                            case fudaole.Config.RED_ENVELOPE_TEN:
                                this.audioController.playRedEnvTrigSnd2();
                                break;
                        }
                    }
                    if ((symbolId == fudaole.Config.RED_ENVELOPE_JACK || symbolId == fudaole.Config.RED_ENVELOPE_NINE || symbolId == fudaole.Config.RED_ENVELOPE_TEN || symbolId == fudaole.Config.RED_ENVELOPE_NINE_FIRST)) {
                        //this.playSymbolAnimation(reelId, i, 0, 0, this.animationBundle.bonus, false);
                        //this.playRedJackpotLandingAnim(reelId);
                        this.hits[reelId] = reelId;
                    }
                }
            };
            SymbolAnimationController.prototype.playFSWildGlow = function () {
                this.audioController.playFgMultiplierSnd();
                this.wildGlowAnim = new fudaole.cjsAnim.fgstacks();
                this.wildGlowAnim.visible = true;
                this.wildGlowAnim.gotoAndPlay(0);
                var posX = 0;
                var posY = 0;
                this.wildGlowAnim.setTransform(posX, posY, this.scalar, this.scalar);
                this.hitAnimContainer.addChild(this.wildGlowAnim);
                this.wildTicker = createjs.Ticker.addEventListener("tick", this.WildGlowTicker.bind(this)); //adding ticker 
            };
            SymbolAnimationController.prototype.WildGlowTicker = function () {
                switch (this.wildGlowAnim.currentLabel) {
                    case this.wildLabels[1]:
                        createjs.Ticker.removeEventListener('tick', this.wildTicker);
                        this.wildGlowAnim.gotoAndStop(this.wildLabels[1]);
                        this.hitAnimContainer.removeChild(this.wildGlowAnim);
                        break;
                }
            };
            /**
             * Checks to see if we need to highlight symbols in the pulse display
             * @method fudaole.SymbolAnimationController#checkForSymbolHighlight
             * @public
             * @param {number} repeatCount The number of times to repeat the symbol animation
             */
            SymbolAnimationController.prototype.checkForSymbolHighlight = function (repeatCount) {
                var _this = this;
                if (repeatCount === void 0) { repeatCount = 0; }
                var that = this;
                var funcs = [];
                var highlightData = [];
                var reelOffsets = null;
                var flag = 0;
                if (this.timeline != null) {
                    this.timeline.clear();
                }
                this.timeline = new TimelineMax({
                    paused: true,
                    repeat: repeatCount,
                    yoyo: false
                });
                for (var i = 0; i < this.hitData.length; i++) {
                    reelOffsets = this.hitData[i].getOffsets();
                    highlightData.push(reelOffsets.map(function (offset) { return fudaole.Utils.convertOffset(offset, fudaole.Config.NUMBER_OF_REELS); }));
                }
                for (var i = 0; i < highlightData.length; i++) {
                    if (that.hitData[i] instanceof fudaole.LTPaylineSlotResult) {
                        continue;
                    }
                    funcs.push(function (i) {
                        return function () {
                            if (that.hitData[i] instanceof fudaole.FUScatterSlotResult) {
                                var scatterResult = that.hitData[i];
                                if (scatterResult.getId() === 31) {
                                    var unhideIndex = i - 1;
                                    if (unhideIndex < 0)
                                        unhideIndex = highlightData.length - 1;
                                    for (var b = 0; b < highlightData[unhideIndex].length; b++) {
                                        that.group.getController(highlightData[unhideIndex][b].reelnumber).getLayout().getSymbolActor(highlightData[unhideIndex][b].reelposition + 1, [0, 1, 2, 3, 4]).visible = true;
                                    }
                                    for (var a = 0; a < highlightData[i].length; a++) {
                                        that.group.getController(highlightData[i][a].reelnumber).getLayout().getSymbolActor(highlightData[i][a].reelposition + 1, [0, 1, 2, 3, 4]).visible = false;
                                    }
                                    that.pulseDisplay.getSctterResult(scatterResult);
                                    that.pulseDisplay.start(highlightData[i], 1, true);
                                    flag++;
                                    switch (flag) {
                                        case 1:
                                            that.audioController.playFgTriggerSnd1();
                                            break;
                                        case 2:
                                            that.audioController.playFgTriggerFadeOutSnd1();
                                            that.audioController.playFgTriggerSnd2();
                                            break;
                                        case 3:
                                            that.audioController.playFgTriggerFadeOutSnd2();
                                            that.audioController.playFgTriggerSnd3();
                                            break;
                                    }
                                }
                            }
                        };
                    }(i));
                }
                this.timeline.add(funcs, 0, "normal", 0);
                var singleCycleDuration = 1;
                this.timeline.add(function () {
                    if (flag === 3) {
                        _this.signal.onScatterSymbolAnimComplete();
                        _this.onScatterAnimComplete();
                    }
                }, "+=" + singleCycleDuration.toString());
                this.timeline.play();
            };
            SymbolAnimationController.prototype.onScatterAnimComplete = function () {
                this.stop();
                for (var i = 0; i < fudaole.Config.NUMBER_OF_REELS; i++) {
                    var layout = this.group.getController(i).getLayout();
                    for (var j = 0; j < 4; j++) {
                        layout.getSymbolActor(j + 1, [0, 1, 2, 3, 4]).visible = true;
                    }
                }
            };
            /**
             * Stops the symbol animations
             * @method fudaole.SymbolAnimationController#stop
             * @public
             */
            SymbolAnimationController.prototype.stop = function () {
                var actor = null;
                for (var i = 0; i < fudaole.Config.NUMBER_OF_REELS; i++) {
                    actor = this.symbols[i];
                    if (actor != null) {
                        actor.visible = (false);
                        actor.stop();
                        this.hitAnimContainer.removeChild(actor);
                        actor.spriteSheet = null;
                    }
                    this.hits[i] = null;
                }
                this.hitCounter = 0;
                this.pulseDisplay.clearSymbols();
                if (this.timeline != null) {
                    this.timeline.clear();
                }
            };
            /**
             * Determines if a hit animation should be played
             * @method fudaole.SymbolAnimationController#canPlayHitAnimation
             * @private
             * @param {number} reelId The id of the reel
             * @returns {boolean} True if the hit animation should be played
             */
            SymbolAnimationController.prototype.canPlayHitAnimation = function (reelId) {
                var counter = 0;
                var possibleHitsLeft = this.hits.slice(reelId, this.hits.length);
                for (var i = 0; i < this.hits.length; i++) {
                    if (this.hits[i] != null) {
                        counter++;
                    }
                }
                for (var i = 0; i < possibleHitsLeft.length; i++) {
                    if (possibleHitsLeft[i] == null) {
                        counter++;
                    }
                }
                return (counter >= this.symbolsNeededForTrigger);
            };
            /**
             * Play a symbol animation
             * @method fudaole.SymbolAnimationController#playSymbolAnimation
             * @private
             * @param {number} reelId The reel to play the animation on
             */
            SymbolAnimationController.prototype.playSymbolAnimation = function (reelId, windowIndex, offsetX, offsetY, asset, repeat) {
                var controller = this.group.getController(reelId);
                var symbolActor = controller.getLayout().getSymbolActor(windowIndex, controller.getSymbolOrder());
                var animationActor = this.symbols[reelId];
                var ssheet = fudaole.Utils.generateCJSSpriteSheet(asset, fudaole.Config.SCALAR);
                animationActor.spriteSheet = ssheet;
                animationActor.framerate = 25;
                animationActor.visible = (true);
                animationActor.setTransform(offsetX, offsetY);
                this.hitAnimContainer.addChild(animationActor);
                if (!repeat) {
                    animationActor.addEventListener('animationend', this.onAnimationEnd.bind(this));
                }
                animationActor.gotoAndPlay(0);
            };
            SymbolAnimationController.prototype.onAnimationEnd = function (e) {
                var sp = e.target;
                sp.removeEventListener('animationend', this.onAnimationEnd.bind(this));
                sp.visible = false;
                sp.gotoAndStop(0);
                sp.spriteSheet = null;
            };
            return SymbolAnimationController;
        })();
        fudaole.SymbolAnimationController = SymbolAnimationController;
var TopMeterAnimController = (function () {
            function TopMeterAnimController(handleAnim) {
                var _this = this;
                this.handleAnim = handleAnim;
                this.fgLogoStopL = false;
                this.fgLogoStopP = false;
                this.fgOutroEndL = false;
                this.fgOutroEndP = false;
                this.fgoutrobannerL = false;
                this.fgoutrobannerP = false;
                this.fgintrobannerL = false;
                this.fgintrobannerP = false;
                this.avoidToRepeat_L = [];
                this.avoidToRepeat_P = [];
                this.handleAnim.getOrientation().getEvents().add({
                    onChange: function () {
                        _this.changeOrientation();
                    }
                });
                this.pos = [
                    [0, 0],
                    [0, 0]
                ];
                this.createComponent();
            }

TopMeterAnimController.prototype.setGameData = function (gameData) {
                this.gameData = gameData;
            };
TopMeterAnimController.prototype.introBannerStart = function () {
                if (this.fgintrobannerL && this.fgintrobannerP) {
                    this.handleAnim.getFreeSpin().changeFgReelsIntro();
                    this.handleAnim.getDashBoard().dashboardFgMeterView(true);
                    this.updateTotalWinTxt();
                    this.fgintrobannerL = false;
                    this.fgintrobannerP = false;
                }
            };
TopMeterAnimController.prototype.outroBannerEnd = function () {
                if (this.fgoutrobannerL && this.fgoutrobannerP) {
                    this.handleAnim.getAudioController().playFgOutroFadeOutSnd();
                    this.handleAnim.getAudioController().playfgTransOutSnd();
                    this.handleAnim.getFreeSpin().changeBgReelsOutro();
                    this.handleAnim.getDashBoard().dashboardFgMeterView(false);
                    if (this.handleAnim.getFreeSpin().logic.getMaxWin())
                        this.handleAnim.getFreeSpin().logic.dashBoardMaxWinVal();
                    var txt = [this.handleAnim.gettranslator().findByKey("com.fudaole.totalWin")];
                    fudaole.cjsAnim.updateWinTxt(txt, this.handleAnim.getBaseBundle().myriadProBold.getFontName());
                    this.fgoutrobannerL = false;
                    this.fgoutrobannerP = false;
                }
            };
TopMeterAnimController.prototype.onCompleteFgAnim = function () {
                var that = this;
                if (this.fgOutroEndL && this.fgOutroEndP) {
                    this.handleAnim.getAudioController().playfgTransOutFadeOutSnd();
                    this.fgOutroEndL = false;
                    this.fgOutroEndP = false;
                    TweenLite.delayedCall(1, function () {
                        that.handleAnim.getFreeSpin().backToBaseGame();
                    });
                }
            };
TopMeterAnimController.prototype.onFgLogoStopAnim = function () {
                if (this.fgLogoStopL && this.fgLogoStopP) {
                    this.handleAnim.getAudioController().playFGTransInFadeOutSnd();
                    this.handleAnim.getFreeSpin().spinStart();
                    this.fgLogoStopL = false;
                    this.fgLogoStopP = false;
                }
            };
 return TopMeterAnimController;
})();
fudaole.TopMeterAnimController=TopMeterAnimController;
fudaole.Utils.convertOffset = function (glsOffset, numReels) {
                return {
                    reelnumber: (glsOffset % numReels),
                    reelposition: Math.floor(glsOffset / numReels)
                };
            };
{ const exports=fudaole.ownNativeReels={};
var Strip = (function () {
        /**
         * Create a new Strip object
         *
         * @param  table  base symbol table filled with ids
         */
        function Strip(table) {
            this.baseSymbolTable = table;
            this.switchSymbolTable = [];
            this.reset();
            this.switchReels = false;
            this.clumpId = -1;
        }
        /**
         * Set the live symbol table of the strip.
         *
         * @param  table  symbol table filled with symbol ids
         */
        Strip.prototype.setLiveSymbolTable = function (table) {
            //Clone table to keep the reference safe from external changes
            this.liveSymbolTable = table.slice(0);
        };
        /**
         * Replace symbols in live symbol table with given range
         *
         * @param  index  starting index to add range
         * @param  range  the range of symbols ids
         */
        Strip.prototype.setLiveSymbolRange = function (index, range) {
            for (var i = 0; i < range.length; ++i) {
                this.liveSymbolTable[index + i] = range[i];
            }
        };
        /**
         * Replace one symbol at the given index
         *
         * @param  index  location of symbol to replace
         * @param  id  the new symbol id
         */
        Strip.prototype.setLiveSymbolId = function (index, id) {
            this.liveSymbolTable[index] = id;
        };
        /**
         * Get the symbol id that represents the clump symbol
         */
        Strip.prototype.getClumpSymbol = function () {
            return this.clumpId;
        };
        /**
         * Resets the live symbol table to be equal to the base table
         */
        Strip.prototype.reset = function () {
            this.liveSymbolTable = new Array();
            this.liveSymbolTable = this.baseSymbolTable.concat(this.liveSymbolTable);
        };
        /**
         * Called to get a range of symbol ids from an index. The range expects the index to
         * be the start index inclusive. The number of symbols is based on the length of the
         * array. So the array must be initialized to the amount of symbols needed.
         *
         * @param  index  starting table index
         * @param  range  array to place symbol ids
         */
        Strip.prototype.getSymbolRange = function (index, range) {
            for (var i = 0; i < range.length; ++i) {
                range[i] = this.liveSymbolTable[this.wrapIndex(index + i)];
            }
        };
        /**
         * Called to get a range of symbol ids from an index. The range expects the index to
         * be the start index inclusive. The number of symbols is based on the length of the
         * array. So the array must be initialized to the amount of symbols needed.
         *
         * @param  index  starting table index
         * @param  range  array to place symbol ids
         */
        Strip.prototype.getSymbolRangeReelSwitch = function (index, range) {
            for (var i = 0; i < range.length; ++i) {
                range[i] = this.switchSymbolTable[this.wrapSwitchIndex(index + i)];
            }
        };
        /**
         * Called to get a partial range of symbol ids from an index.
         * So the array must be initialized to the amount of symbols needed.
         *
         * @param  index  starting table index
         * @param  rangeIndex  starting index in range
         * @param  rangeCount  number of values to fill in range
         * @param  range  array to place symbol ids
         */
        Strip.prototype.getPartialRange = function (index, rangeIndex, rangeCount, range, stoping) {
            if (stoping) {
                if (this.switchReels) {
                    for (var i = 0; i < rangeCount; ++i) {
                        range[rangeIndex + i] = this.switchSymbolTable[this.wrapSwitchIndex(index + i)];
                    }
                }
                else {
                    for (var i = 0; i < rangeCount; ++i) {
                        range[rangeIndex + i] = this.liveSymbolTable[this.wrapIndex(index + i)];
                    }
                }
            }
            else {
                for (var i = 0; i < rangeCount; ++i) {
                    range[rangeIndex + i] = this.liveSymbolTable[this.wrapIndex(index + i)];
                }
            }
        };
        /**
         * Get a single symbol id from an index
         *
         * @param  index  table index
         */
        Strip.prototype.getSymbolId = function (index) {
            return this.liveSymbolTable[this.wrapIndex(index)];
        };
        /**
         * Check to see if a symbol clump exists and if it exists return the amount of symbols
         * before clump is over.
         *
         * @param  index  starting table index
         * @param  forward  true if the clump count search should go forward
         */
        Strip.prototype.getClumpCount = function (index, forward) {
            var clumpCount = 0;
            if (this.liveSymbolTable[index] == this.clumpId) {
                if ((this.liveSymbolTable[this.wrapIndex(index - 1)] == this.clumpId) || (this.liveSymbolTable[this.wrapIndex(index + 1)] == this.clumpId)) {
                    var searchIndex = index;
                    while (this.liveSymbolTable[this.wrapIndex((searchIndex += (forward ? 1 : -1)))] == this.clumpId) {
                        clumpCount++;
                    }
                }
            }
            return clumpCount;
        };
        /**
         * Check to see if an extended symbol group exists and if it exists return the amount
         * of symbols until the group is over. Extended symbol groups are always in groups of
         * three and are identified by the center symbol.
         *
         * @param  index  starting table index
         * @param  forward  true if the search should go forward
         */
        Strip.prototype.getExtendedGroupCount = function (index, forward) {
            var groupCount = 0;
            if (this.groupIds != undefined) {
                for (var i = 0; i < this.groupIds.length; ++i) {
                    var groupId = this.groupIds[i];
                    //Check current symbol
                    if (this.liveSymbolTable[index] == groupId) {
                        //check current symbol
                        groupCount = 1;
                    }
                    else if (this.liveSymbolTable[this.wrapIndex(index + (forward ? 1 : -1))] == groupId) {
                        //check next symbol
                        groupCount = 2;
                    }
                }
            }
            return groupCount;
        };
        /**
         * Get the current length of the live table
         */
        Strip.prototype.getTableLength = function () {
            return this.liveSymbolTable.length;
        };
        /**
         * Tests whether the base and live table are the same
         */
        Strip.prototype.isAtBase = function () {
            return !(this.baseSymbolTable < this.liveSymbolTable || this.liveSymbolTable < this.baseSymbolTable);
        };
        /**
         * Add an array that represents a group of symbols that should never be broken up
         * Fill array with symbol IDs and values from ExtendedGroupConfig
         *
         * - to specify clumps of one symbol (Ex: Clump of Zeus symbols in Zeus)
         *    [Extend, <id>, Extend]
         * - to specify groups of different contiguous symbols (Ex: Tall Spartacus in Spartacus)
         *    [<id>, <id>, <id>, <id>]
         * - to specify a symbol surrounded by any neighboring symbol (Ex: Oversized bonus symbol in Zeus3)
         *    [Neighbor, <id>, Neighbor]
         * - to specify clump of one symbol plus neighbors (Ex: Zeus in Zeus 3)
         *    [Neighbor, Extend, <id>, Extend, Neighbor]
         * - to specify group of different symbols plus neigbors
         *    [Neighbor, <id>, <id>, <id>, <id>, Neighbor]
         *
         * @param  group  group of symbols that should never be broken up
         */
        Strip.prototype.addUnbreakableGroup = function (group) {
            if (this.unbreakableGroups == undefined) {
                this.unbreakableGroups = new Array();
            }
            this.unbreakableGroups.push(group);
        };
        /**
         * Return true if unbreakable group feature is active
         */
        Strip.prototype.hasUnbreakableGroup = function () {
            return (this.unbreakableGroups != undefined);
        };
        /**
         * Get number of steps to shift to avoid splicing into an unbreakable group
         */
        Strip.prototype.getUnbreakableGroupCount = function (index, forward) {
            var result = 0;
            var groupData = this.findUnbreakableGroup(index, forward);
            if (groupData != null) {
                var group = this.unbreakableGroups[groupData.groupId];
                var step = (forward ? 1 : -1);
                for (var groupIndex = groupData.startIndex; groupIndex >= 0 && groupIndex < group.length; groupIndex += step) {
                    var groupId = group[groupIndex];
                    var stripIndex = index + groupData.stripOffset;
                    switch (groupId) {
                        case -1 /* Extend */:
                            //Search for end of clump and offset by that amount
                            var prevId = this.getSymbolId(stripIndex - step);
                            var extendOffset = this.findExtendOffset(stripIndex, prevId, step);
                            groupData.stripOffset += extendOffset;
                            break;
                        case -2 /* Neighbor */:
                            //Jump to the next strip index no matter what symbol is there
                            groupData.stripOffset += step;
                            break;
                        default:
                            //Assuming that direct ID references are correct
                            //This should be safe as long as the same symbol id doesn't appear
                            //in multiple group definitions.
                            groupData.stripOffset += step;
                            break;
                    }
                }
                //stripOffset includes starting index. Compensate by subtracting one step.
                result = groupData.stripOffset - step;
            }
            return Math.abs(result);
        };
        /**
         * Search for a matching unbreakable group
         *
         * @param  index  the strip index to begin the search
         * @param  forward  direction to scan the strip
         */
        Strip.prototype.findUnbreakableGroup = function (index, forward) {
            var result = null;
            var currentId = this.getSymbolId(index);
            for (var groupId = 0; groupId < this.unbreakableGroups.length; ++groupId) {
                var group = this.unbreakableGroups[groupId];
                for (var i = 0; i < 2; ++i) {
                    var direction = (i == 0 ? forward : !forward);
                    var stripOffset = 0;
                    var step = (direction ? 1 : -1);
                    for (var groupIndex = (direction ? 0 : group.length - 1); groupIndex >= 0 && groupIndex < group.length; groupIndex += step) {
                        var fail = false;
                        switch (group[groupIndex]) {
                            case -1 /* Extend */:
                                break;
                            case -2 /* Neighbor */:
                                //If neighbor go to next index of group and strip
                                if (i == 0) {
                                    stripOffset += step;
                                }
                                break;
                            default:
                                if (group[groupIndex] == this.getSymbolId(index + stripOffset)) {
                                    //A matching ID means we found a matching group
                                    return {
                                        groupId: groupId,
                                        stripOffset: stripOffset,
                                        startIndex: groupIndex
                                    };
                                }
                                else if (group[groupIndex] != -1 /* Extend */ && group[groupIndex] != -2 /* Neighbor */) {
                                }
                                else {
                                    //This group doesn't match so allow the search to continue
                                    fail = true;
                                }
                                break;
                        }
                        if (fail) {
                            break;
                        }
                    }
                }
            }
            return result;
        };
        /**
         * Calculate the offset from the given strip index where the given symbol id no longer
         * matches the strip id.
         */
        Strip.prototype.findExtendOffset = function (index, searchId, step) {
            var offset = 0;
            do {
                offset += step;
            } while (this.getSymbolId(index + offset) == searchId);
            return offset;
        };
        /**
         * Wrap an index into from the strip
         *
         * @param  index  index to wrap
         */
        Strip.prototype.wrapIndex = function (index) {
            var realIndex = index;
            if (index < 0) {
                realIndex = this.liveSymbolTable.length - Math.abs(realIndex);
            }
            else if (index >= this.liveSymbolTable.length) {
                realIndex = realIndex - this.liveSymbolTable.length;
            }
            return realIndex;
        };
        Strip.prototype.switchReelData = function (table) {
            this.switchReels = true;
            this.switchSymbolTable = table;
        };
        /**
         * Wrap an index into from the strip
         *
         * @param  index  index to wrap
         */
        Strip.prototype.wrapSwitchIndex = function (index) {
            var realIndex = index;
            if (index < 0) {
                realIndex = this.switchSymbolTable.length - Math.abs(realIndex);
            }
            else if (index >= this.switchSymbolTable.length) {
                realIndex = realIndex - this.switchSymbolTable.length;
            }
            return realIndex;
        };
        Strip.prototype.resetReelStripTable = function () {
            if (this.switchReels) {
                this.baseSymbolTable = new Array();
                this.baseSymbolTable = this.switchSymbolTable.concat(this.baseSymbolTable);
                this.switchSymbolTable = [];
                this.reset();
                this.switchReels = false;
            }
        };
        Strip.prototype.isReelSwitch = function () {
            return this.switchReels;
        };
        return Strip;
    })();
    exports.Strip = Strip;
var Reel = (function () {
        /**
         * Create a new Reel object
         *
         * @param  initialIndex  index in strip space to start reel at
         * @param  homeIndex  center position on reel
         * @param  windowSize  size of the reel window
         * @param  strip  backing strip
         */
        function Reel(initialIndex, homeIndex, windowSize, strip) {
            this.currentIndex = initialIndex;
            this.homeIndex = homeIndex;
            this.initialIndex = initialIndex;
            this.spliceIndex = 0;
            this.spliceCount = 0;
            this.startSpliceCount = 0;
            this.windowSize = windowSize;
            this.strip = strip;
        }
        /**
         * Set the index used to describe the center position on the reel in reel space.
         *
         * @param  homeIndex  center position on reel
         */
        Reel.prototype.setHomeIndex = function (homeIndex) {
            this.homeIndex = homeIndex;
        };
        /**
         * Set the size of the symbol window. This includes the visible and border symbols.
         *
         * @param  windowSize  size of the reel window
         */
        Reel.prototype.setWindowSize = function (windowSize) {
            this.windowSize = windowSize;
        };
        /**
         * Set the current index
         *
         * @param  index  the current index
         */
        Reel.prototype.setCurrentIndex = function (index) {
            this.startSpliceCount = 0;
            this.spliceCount = 0;
            this.currentIndex = index;
        };
        /**
         * Advances the current index into the strip centered around the home index.
         *
         * @param  advanceAmount  amount of indices to advance
         */
        Reel.prototype.advance = function (advanceAmount) {
            if (this.startSpliceCount == 0 && this.spliceCount > 0) {
                this.spliceCount = Math.max(0, this.spliceCount - Math.abs(advanceAmount));
                if (this.spliceCount == 0) {
                    this.strip.resetReelStripTable();
                    this.currentIndex = this.spliceIndex;
                }
            }
            else {
                if (this.startSpliceCount > 0)
                    this.startSpliceCount--;
                this.currentIndex -= advanceAmount;
                var tableLength = this.strip.getTableLength();
                if (this.currentIndex < 0) {
                    this.currentIndex = tableLength - Math.abs(this.currentIndex);
                }
                else if (this.currentIndex >= tableLength) {
                    this.currentIndex = this.currentIndex - tableLength;
                }
            }
        };
        /**
         * Called to put the reel into splicing mode. Once in splicing mode the reel will determine
         * the symbol window using the internal splicing paramter.
         * It will continue to be in splicing mode until all splice stops have been inserted.
         * Once it is complete the reel will automatically go back into normal operation.
         * The total splice count will be returned.
         *
         * @param  stopIndex  index in strip space to base splicing on
         * @param  forward  true if splicing should happen forward on the strip
         */
        Reel.prototype.startSplicing = function (stopIndex, forward) {
            this.spliceIndex = stopIndex;
            this.spliceCount = this.windowSize;
            var extraStops = 0;
            //Find unbreakable group cutoff at top of current window
            //Get stops required before splicing
            this.startSpliceCount = this.strip.getUnbreakableGroupCount(this.currentIndex - this.homeIndex, false);
            //Find unbreakable group cutoff at bottom of stop window
            //Shift splice index and add extra stops to compensate
            extraStops = this.strip.getUnbreakableGroupCount(stopIndex - this.homeIndex + this.windowSize - 1, true);
            this.spliceIndex += extraStops;
            return this.spliceCount + this.startSpliceCount + extraStops;
        };
        /**
         * Get a range of symbol ids that are the current symbols on the logical reel. The amount
         * of symbols are based on the size of the already defined array. The array will be filled
         * with symbol ids.
         *
         * @param  range  array to fill with symbol ids
         */
        Reel.prototype.getSymbolWindow = function (range) {
            var startIndex = this.currentIndex - this.homeIndex;
            if (this.spliceCount > 0) {
                var startSpliceIndex = this.spliceIndex - this.homeIndex + this.spliceCount;
                var spliceRangeCount = this.windowSize - this.spliceCount;
                var nonSpliceRangeCount = this.windowSize - spliceRangeCount;
                this.strip.getPartialRange(startSpliceIndex, 0, spliceRangeCount, range, true);
                this.strip.getPartialRange(startIndex, spliceRangeCount, nonSpliceRangeCount, range, false);
            }
            else {
                this.strip.getSymbolRange(startIndex, range);
            }
        };
        /**
         * Get the symbol at a given index into the symbol window.
         * Window index can be a negative number.
         * NOTE: This respects splicing but doesn't predict the future. Result will include
         * where the current spliced symbols are but will not predict what will happen
         * outside of symbol window when splicing is complete.
         *
         * @param  windowIndex  the index into the symbol window
         */
        Reel.prototype.getSymbolId = function (windowIndex) {
            return this.strip.getSymbolId(this.getStripIndex(windowIndex));
        };
        /**
         * Get the current index into the strip while respecting splicing
         */
        Reel.prototype.getStripIndex = function (windowIndex) {
            var offset = this.spliceCount + windowIndex;
            var index;
            if (this.spliceCount > 0) {
                if (offset >= 0 && offset < this.windowSize) {
                    //We are in splicing range
                    var startSpliceIndex = this.spliceIndex - this.homeIndex + this.spliceCount;
                    index = startSpliceIndex + windowIndex;
                }
                else {
                    //We are not in splicing range
                    var startIndex = this.currentIndex - this.homeIndex;
                    var spliceRangeCount = this.windowSize - this.spliceCount;
                    index = startIndex - spliceRangeCount + windowIndex;
                }
            }
            else {
                //Normal operation. Not splicing.
                var startIndex = this.currentIndex - this.homeIndex;
                index = startIndex + windowIndex;
            }
            return index;
        };
        /**
         * Get the symbol range based around a given stop index
         *
         * @param  stopIndex  index in strip space to stop
         * @param  range  array to fill with symbol ids
         */
        Reel.prototype.getStopWindow = function (stopIndex, range) {
            var startIndex = stopIndex - this.homeIndex;
            return this.strip.getSymbolRange(startIndex, range);
        };
        /**
         * Get the symbol range based around a given stop index
         *
         * @param  stopIndex  index in strip space to stop
         * @param  range  array to fill with symbol ids
         */
        Reel.prototype.getStopWindowReelSwitch = function (stopIndex, range) {
            var startIndex = stopIndex - this.homeIndex;
            return this.strip.getSymbolRangeReelSwitch(startIndex, range);
        };
        /**
         * Get the current index into the strip centered around the home index
         */
        Reel.prototype.getCurrentIndex = function () {
            return this.currentIndex;
        };
        /**
         * Get the home index
         */
        Reel.prototype.getHomeIndex = function () {
            return this.homeIndex;
        };
        /**
         * Get the reel window size
         */
        Reel.prototype.getWindowSize = function () {
            return this.windowSize;
        };
        /**
         * Get the reel strip
         */
        Reel.prototype.getStrip = function () {
            return this.strip;
        };
        /**
         * Set to updated reel strip
         *
         * @param  strip  updated new reel strip
         */
        Reel.prototype.setStrip = function (strip) {
            this.strip = strip;
        };
        Reel.prototype.switchReelData = function (symbolsTable) {
            this.strip.switchReelData(symbolsTable);
        };
        return Reel;
    })();
    exports.Reel = Reel;
}
fudaole.ownNativeReelHomeIndex=2;
fudaole.ownNativeCycleFreeFlag = function (set) {
                this.isFreeGame = set;
            };
fudaole.ownNativePlayScatterAnim = function (winInfo) {
                var results = this.gameResults.getAllSlotResults();
                for (var a = 0; a < results.length; a++) {
                    if (results[a] instanceof fudaole.FUScatterSlotResult) {
                        switch (results[a].awardId) {
                            case 31:
                                results[a].awardValue = winInfo.totalFreeSpinsWin;
                                break;
                        }
                    }
                }
                this.cycleResults.setResults(this.gameResults);
            };
fudaole.ownNativeLayoutGetSymbolId = function (windowIndex) {
                var result;
                if (windowIndex < 0 || windowIndex >= this.symbolWindow.length) {
                    result = this.reel.getSymbolId(windowIndex);
                }
                else {
                    result = this.symbolWindow[windowIndex];
                }
                return result;
            };
fudaole.ownNativeLayoutGetSymbolActor = function (windowIndex, symbolOrder) {
                return this.symbols[symbolOrder[windowIndex]];
            };

