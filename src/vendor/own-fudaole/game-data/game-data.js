define(["require", "exports"], function (require, exports) {
    /**
     * Container for single payline pay
     * @class gls-comms.PaylineSlotResult
     * @classdesc Information concerning a payline pay
     */
    var PaylineSlotResult = (function () {
        /**
         * @constructor
         */
        function PaylineSlotResult(id, value, offsets) {
            this.awardId = id;
            this.awardValue = value;
            this.reelOffsets = offsets;
            this.isBonusWinPay = false;
            this.isBonusTriggerPay = false;
        }
        /**
         * Retrieve win type
         * @method gls-comms.PaylineSlotResult#getWinType
         * @public
         * @returns {number} Enumerated win type LINE
         */
        PaylineSlotResult.prototype.getWinType = function () {
            return 1 /* LINE */;
        };
        /**
         * Retrieve slot pay id
         * @method gls-comms.PaylineSlotResult#getId
         * @public
         * @returns {number} Slot pay identifier
         */
        PaylineSlotResult.prototype.getId = function () {
            return this.awardId;
        };
        /**
         * Retrieve slot pay award value
         * @method gls-comms.PaylineSlotResult#getValue
         * @public
         * @returns {number} Slot pay value
         */
        PaylineSlotResult.prototype.getValue = function () {
            return this.awardValue;
        };
        /**
         * Retrieve slot pay reel offsets
         * @method gls-comms.PaylineSlotResult#getOffsets
         * @public
         * @returns {number[]} Slot pay symbol positions
         */
        PaylineSlotResult.prototype.getOffsets = function () {
            return this.reelOffsets;
        };
        /**
         * Retrieve flag indicating if this pay holds the bonus win
         * @method gls-comms.AnwyaySlotResult#isBonusPay
         * @public
         * @returns {boolean} True if bonus win, false otherwise
         */
        PaylineSlotResult.prototype.isBonusPay = function () {
            return this.isBonusWinPay;
        };
        /**
         * Retrieve flag indicating if this pay holds a bonus trigger pay
         * @method gls-comms.AnwyaySlotResult#isBonusTrigger
         * @public
         * @returns {boolean} True if bonus trigger, false otherwise
         */
        PaylineSlotResult.prototype.isBonusTrigger = function () {
            return this.isBonusTriggerPay;
        };
        return PaylineSlotResult;
    })();
    exports.PaylineSlotResult = PaylineSlotResult;
    /**
     * @class GamePlayData
     * @classdesc Container of game play results
     */
    var GamePlayData = (function () {
        /**
         * @constructor
         */
        function GamePlayData() {
            this.results = [];
            this.bonusTriggered = false;
        }
        /**
         * Set stop positions
         * @method GamePlayData#setStopPositions
         * @public
         * @param {number[]} stops Stop positions
         */
        GamePlayData.prototype.setStopPositions = function (stops) {
            this.stopPositions = stops;
        };
        /**
         * Retrieve stop positions
         * @method GamePlayData#getStopPositions
         * @public
         * @returns {number[]} Stop positions
         */
        GamePlayData.prototype.getStopPositions = function () {
            return this.stopPositions;
        };
        /**
         * Set total win
         * @method GamePlayData#setTotalWin
         * @public
         * @param {number} win Total win
         */
        GamePlayData.prototype.setTotalWin = function (win) {
            this.totalWin = win;
        };
        /**
         * Retrieve total win
         * @method GamePlayData#getTotalWin
         * @public
         * @returns {number} Total win
         */
        GamePlayData.prototype.getTotalWin = function () {
            return this.totalWin;
        };
        /**
         * Add slot result
         * @method GamePlayData#addSlotResult
         * @public
         * @param {ISlotResult} result An individual slot pay
         */
        GamePlayData.prototype.addSlotResult = function (result) {
            this.results.push(result);
        };
        /**
         * Retrieve slot results
         * @method GamePlayData#getAllSlotResults
         * @public
         * @returns {ISlotResult[]} Collection of slot pays
         */
        GamePlayData.prototype.getAllSlotResults = function () {
            return this.results;
        };
        /**
         * Set whether or not a bonus was triggered
         * @method GamePlayData#setIsBonusTriggered
         * @public
         * @param {boolean} isTriggered True if bonus was triggered, false otherwise
         */
        GamePlayData.prototype.setIsBonusTriggered = function (isTriggered) {
            this.bonusTriggered = isTriggered;
        };
        /**
          * Retrieve flag indicating if bonus was triggered
          * @method GamePlayData#isBonusTriggered
          * @public
          * @returns {boolean} True if bonus was triggered, false otherwise
          */
        GamePlayData.prototype.isBonusTriggered = function () {
            return this.bonusTriggered;
        };
        /**
         * Set initial wager returned from server
         * @method GamePlayData#setWager
         * @public
         * @param {number} wager Initial wager
         */
        GamePlayData.prototype.setWager = function (wager) {
            this.wager = wager;
        };
        /**
         * Retrieve initial wager
         * @method GamePlayData#getWager
         * @public
         * @returns {number} Initial wager
         */
        GamePlayData.prototype.getWager = function () {
            return this.wager;
        };
        /**
          * Set custom game play data
          * @method GamePlayData#setCustomData
          * @public
          * @param {any} customData Custom data, provided by game
          */
        GamePlayData.prototype.setCustomData = function (customData) {
            this.customData = customData;
        };
        /**
          * Retrieve custom game play data
          * @method GamePlayData#getCustomData
          * @public
          * @returns {any} Custom data, provided by game
          */
        GamePlayData.prototype.getCustomData = function () {
            return this.customData;
        };
        return GamePlayData;
    })();
    exports.GamePlayData = GamePlayData;
    /**
     * @class ReelStripData
     * @classdesc Reel strip symbol layout
     */
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
    /**
     * @class game-data.BetConfiguration
     * @classdesc Data for configuring available bets
     */
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
    /**
     * Container for single anyway pay
     * @class gls-comms.AnywaySlotResult
     * @classdesc Information concerning an anyway pay
     */
    var AnywaySlotResult = (function () {
        /**
         * @constructor
         */
        function AnywaySlotResult(id, value, offsets, numWays) {
            this.awardId = id;
            this.awardValue = value;
            this.reelOffsets = offsets;
            this.numWays = numWays;
            this.isBonusWinPay = false;
            this.isBonusTriggerPay = false;
        }
        /**
         * Retrieve win type
         * @method SlotResult#getWinType
         * @public
         * @returns {number} Enumerated win type ANYWAY
         */
        AnywaySlotResult.prototype.getWinType = function () {
            return 2 /* ANYWAY */;
        };
        /**
         * Retrieve slot pay id
         * @method SlotResult#getId
         * @public
         * @returns {number} Slot pay identifier
         */
        AnywaySlotResult.prototype.getId = function () {
            return this.awardId;
        };
        /**
         * Retrieve slot pay award value
         * @method SlotResult#getValue
         * @public
         * @returns {number} Slot pay value
         */
        AnywaySlotResult.prototype.getValue = function () {
            return this.awardValue;
        };
        /**
         * Retrieve slot pay reel offsets
         * @method SlotResult#getOffsets
         * @public
         * @returns {number} Slot pay symbol positions
         */
        AnywaySlotResult.prototype.getOffsets = function () {
            return this.reelOffsets;
        };
        /**
         * Retrieve number of ways involved in this pay
         * @method gls-comms.AnwyaySlotResult#getNumberOfWays
         * @public
         * @returns {number} Number of ways
         */
        AnywaySlotResult.prototype.getNumberOfWays = function () {
            return this.numWays;
        };
        /**
         * Retrieve flag indicating if this pay holds the bonus win
         * @method gls-comms.AnwyaySlotResult#isBonusPay
         * @public
         * @returns {boolean} True if bonus win, false otherwise
         */
        AnywaySlotResult.prototype.isBonusPay = function () {
            return this.isBonusWinPay;
        };
        /**
         * Retrieve flag indicating if this pay holds a bonus trigger pay
         * @method gls-comms.AnwyaySlotResult#isBonusTrigger
         * @public
         * @returns {boolean} True if bonus trigger, false otherwise
         */
        AnywaySlotResult.prototype.isBonusTrigger = function () {
            return this.isBonusTriggerPay;
        };
        return AnywaySlotResult;
    })();
    exports.AnywaySlotResult = AnywaySlotResult;
    /**
     * @class PaylineData
     * @classdesc Display configuration for a single payline
     */
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
    /**
     * @class SlotAwardData
     * @classdesc Slot award (paytable data)
     */
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
    /**
     * @class GameInitData
     * @classdesc Initialization data for slot game
     */
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
    /**
     * Enumeration of types of slot wins supported by game libs
     */
    (function (WinType) {
        WinType[WinType["SCATTER"] = 0] = "SCATTER";
        WinType[WinType["LINE"] = 1] = "LINE";
        WinType[WinType["ANYWAY"] = 2] = "ANYWAY";
    })(exports.WinType || (exports.WinType = {}));
    var WinType = exports.WinType;
    /**
     * Container for single scatter pay
     * @class gls-comms.ScatterSlotResult
     * @classdesc Information concerning a scatter pay
     */
    var ScatterSlotResult = (function () {
        /**
         * @constructor
         */
        function ScatterSlotResult(id, value, offsets, isBonusWinPay, isTriggerPay) {
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
         * @method gls-comms.ScatterSlotResult#getWinType
         * @public
         * @returns {number} Enumerated win type SCATTER
         */
        ScatterSlotResult.prototype.getWinType = function () {
            return 0 /* SCATTER */;
        };
        /**
         * Retrieve slot pay id
         * @method gls-comms.ScatterSlotResult#getId
         * @public
         * @returns {number} Slot pay identifier
         */
        ScatterSlotResult.prototype.getId = function () {
            return this.awardId;
        };
        /**
         * Retrieve slot pay award value
         * @method gls-comms.ScatterSlotResult#getValue
         * @public
         * @returns {number} Slot pay value
         */
        ScatterSlotResult.prototype.getValue = function () {
            return this.awardValue;
        };
        /**
         * Retrieve slot pay reel offsets
         * @method gls-comms.ScatterSlotResult#getOffsets
         * @public
         * @returns {number[]} Slot pay symbol positions
         */
        ScatterSlotResult.prototype.getOffsets = function () {
            return this.reelOffsets;
        };
        /**
         * Retrieve flag indicating if this pay holds the bonus win
         * @method gls-comms.ScatterSlotResult#isBonusPay
         * @public
         * @returns {boolean} True if bonus win, false otherwise
         */
        ScatterSlotResult.prototype.isBonusPay = function () {
            return this.isBonusWinPay;
        };
        /**
         * Retrieve flag indicating if this pay holds a bonus trigger pay
         * @method gls-comms.ScatterSlotResult#isBonusTrigger
         * @public
         * @returns {boolean} True if bonus trigger, false otherwise
         */
        ScatterSlotResult.prototype.isBonusTrigger = function () {
            return this.isBonusTriggerPay;
        };
        return ScatterSlotResult;
    })();
    exports.ScatterSlotResult = ScatterSlotResult;
    /**
     * @class ReelGroupData
     * @classdesc Collection of reel strips to make up a group of reels
     */
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
});
