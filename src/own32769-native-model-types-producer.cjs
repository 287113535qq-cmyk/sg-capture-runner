"use strict";
const sourceBinding = Object.freeze({"gameId": "32769", "nativeGameId": "20135", "runtimeGameId": 32991, "retainedOwnAppSHA256": "76934234b9f8e362cf65db52f5733e533b72ff72d2099d23f62da75392125c1d", "SDKHashRecomputed": false, "normalisedTextCharRanges": {"BetController": [1779769, 1785090], "Bet": [1785219, 1785778], "Logic": [1733106, 1773725], "Bonus": [1421310, 1428520], "PickBonus": [1428765, 1446165], "PickBonusFactory": [1899534, 1903212], "Main.onInitResponse": [48670, 50684], "Main.loadGame": [50964, 55274]}, "wholeSDKExecuted": false, "assetsOrButtonsCreatedByAssembler": false});
function createOwn32769EventTypes(util) {
  if (!util || !util.ErrorReporter ||
      typeof util.ErrorReporter.showError !== "function")
    throw new TypeError("Actual own util.ErrorReporter is required");

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
    
return Object.freeze({EventDispatcher});
}
function createOwn32769NativeModelTypes(bindings) {
  if (!bindings || !bindings.nativeNamespace ||
      !bindings.events ||
      typeof bindings.events.EventDispatcher !== "function")
    throw new TypeError("Own native namespace and events module are required");
  const {events, glscomms, createjs, TweenLite, TweenMax} = bindings;
  // One session-local namespace for cached controllers and native model closures.
  const fudaole = bindings.nativeNamespace;

var Bet = (function () {
            function Bet(units, betPerUnit) {
                this.units = units;
                this.betPerUnit = betPerUnit;
            }
            Bet.prototype.getUnits = function () {
                return this.units;
            };
            Bet.prototype.getBetPerUnit = function () {
                return this.betPerUnit;
            };
            Bet.prototype.getTotalBet = function () {
                return Math.floor(this.units * this.betPerUnit);
            };
            return Bet;
        })();
        
fudaole.Bet = Bet;
var BetController = (function () {
            function BetController(stakes, defaultIndex) {
                var _this = this;
                this.baseBetUnit = 30;
                this.betMultiplier = 1;
                this.availableBets = [];
                // Assume that the first (lowest) bet is 1 per unit.
                var minimumUnits = this.baseBetUnit;
                stakes.forEach(function (stake) {
                    _this.availableBets.push(new Bet(minimumUnits, stake / minimumUnits));
                });
                this.currentBetIndex = this.defaultBetIndex = defaultIndex;
                this.minBet = minimumUnits;
                this.signal = {
                    onBetChange: null
                };
                this.events = new events.EventDispatcher(this.signal);
            }
            BetController.prototype.getEvents = function () {
                return this.events;
            };
            BetController.prototype.setBetMultiplier = function (betMultiplier) {
                this.betMultiplier = betMultiplier;
            };
            BetController.prototype.getAvailableBets = function () {
                return this.availableBets;
            };
            BetController.prototype.getCurrentBetIndex = function () {
                return this.currentBetIndex;
            };
            BetController.prototype.getCurrentBet = function () {
                return this.forceBet ? this.forceBet : this.availableBets[this.currentBetIndex];
            };
            /**
             * Increases the bet, if possible. Returns the new bet value, which will be unchanged
             * if there are no higher bets available. If the bet changes, emits the onBetChange signal.
             */
            BetController.prototype.increaseBet = function () {
                this.forceBet = null;
                if (this.currentBetIndex < this.availableBets.length - 1) {
                    this.currentBetIndex++;
                    this.signal.onBetChange(this.getCurrentBet());
                }
                return this.getCurrentBet();
            };
            /**
             * Decreases the bet, if possible. Returns the new bet value, which will be unchanged
             * if there are no lower bets available. If the bet changes, emits the onBetChange signal.
             */
            BetController.prototype.decreaseBet = function () {
                this.forceBet = null;
                if (this.currentBetIndex > 0) {
                    this.currentBetIndex--;
                    this.signal.onBetChange(this.getCurrentBet());
                }
                return this.getCurrentBet();
            };
            /**
            * force a bet amount
            * @param {number} if the force bet is positive, then override the bet
            */
            BetController.prototype.setForceBet = function (forceStake) {
                if (forceStake === void 0) { forceStake = -1; }
                if (forceStake > 0) {
                    this.forceBet = new Bet(this.minBet, forceStake / this.minBet);
                    this.signal.onBetChange(this.getCurrentBet());
                    this.currentBetIndex = this.getBetIndexByAmount(forceStake);
                }
                else {
                    this.forceBet = null;
                }
                return this.getCurrentBet();
            };
            /**
             * Attempts to set the current bet to the given totalBet. If there is no available Bet
             * equal to the given totalBet, no change is made. The current bet is returned after execution
             * regardless of whether the change succeeds.
             *
             * @param  {number} totalBet The total bet desired.
             * @param  {number} override bet, default -1 doesn't override
             * @return {Bet}             The current bet after execution.
             */
            BetController.prototype.setBet = function (totalBet) {
                for (var ii = 0, length = this.availableBets.length; ii < length; ++ii) {
                    if (this.availableBets[ii].getTotalBet() === totalBet && this.currentBetIndex != ii) {
                        this.currentBetIndex = ii;
                        this.signal.onBetChange(this.getCurrentBet());
                    }
                }
                return this.getCurrentBet();
            };
            /**
            * @param {number} the total level of the bet
            * @return {number} the total bet, based on the base bet
            */
            BetController.prototype.getBetByLevel = function (betLevel) {
                return betLevel * this.baseBetUnit * this.betMultiplier;
            };
            /**
            * @param {number} total bet, which we need the bet level for
            * @return {number} the bet index or 0 if that bet level doesn't exist
            */
            BetController.prototype.getBetIndexByAmount = function (totalBet) {
                for (var i = 0; i < this.availableBets.length; i++) {
                    if (totalBet === this.availableBets[i].getTotalBet()) {
                        return i;
                    }
                }
                return 0;
            };
            return BetController;
        })();
        
fudaole.BetController = BetController;
var Logic = (function () {
            /**
             * @constructor
             */
            function Logic(partnerAdapter, assetLoader, glsRequestor, uiController, audioController) {
                var _this = this;
                this.totalWin = 0;
                this.gameIdleTime = 25000;
                this.reelIndex = 0;
                this.partnerAdapter = partnerAdapter;
                this.assetLoader = assetLoader;
                this.glsRequestor = glsRequestor;
                this.uiController = uiController;
                this.audioController = audioController;
                this.isPayLineComplete = false;
                this.isBangUPcomplete = false;
                this.checkIsFg = false;
                this.fromPick = false;
                this.isMaxWin = false;
                this.isFGSound = false;
                this.bigWinIsPlaying = false;
                this.isRecovering = false;
                var requestListener = {
                    onInitResponse: null,
                    onPlayResponse: function (playResponse) {
                        _this.handlePlayResponse(playResponse);
                        _this.partnerAdapter.receivedGameLogicResponse(glsRequestor.getRequestObject());
                    },
                    onEndResponse: function (endResponse) {
                        _this.handleEndResponse(endResponse);
                        _this.partnerAdapter.receivedGameLogicResponse(glsRequestor.getRequestObject());
                    },
                    onError: null
                };
                this.glsRequestor.getEvents().add(requestListener);
                this.gameState = 0 /* BaseGameSpin */;
            }
            Logic.prototype.getFromPick = function () {
                return this.fromPick;
            };
            /**
             * Sets the game state
             * @method fudaole.Logic#setGameState
             * @public
             * @param {GamePlayState} state The game play state
             */
            Logic.prototype.setGameState = function (state) {
                this.gameState = state;
            };
            Logic.prototype.getGameState = function () {
                return this.gameState;
            };
            /**
             * Sets the slot object
             * @method fudaole.Logic#setSlot
             * @public
             * @param {Slot} slot The slot object to use
             */
            Logic.prototype.setSlot = function (slot) {
                var _this = this;
                this.slot = slot;
                this.slot.getEvents().add({
                    onSpinComplete: function () {
                        if (!_this.isRecovering)
                            _this.handleSpinComplete();
                    },
                    onSkillStop: null,
                    onGaffReel: null
                });
                this.slot.getSymbolAnimationController().getEvents().add({
                    onScatterSymbolAnimComplete: function () {
                        _this.freeGameIntroTrigger();
                    }
                });
                this.slot.getWinDisplayController().getBangController().getEvents().add({
                    onStart: null,
                    onComplete: function () {
                        if (_this.getIsFg()) {
                            if (!_this.getLastSpin()) {
                                _this.setBangUpComplete(true);
                                if (_this.getpayLineComplete())
                                    _this.uiController.stopWinDisplay();
                                _this.freeGameSpinStart();
                            }
                            else {
                                _this.setBangUpComplete(true);
                                if (_this.getpayLineComplete())
                                    _this.uiController.stopWinDisplay();
                                if (_this.getpayLineComplete())
                                    _this.uiController.freeSpin.outroStart();
                            }
                        }
                        else {
                            _this.checkToSendEndGame();
                        }
                    }
                });
                this.slot.getWinDisplayController().getEvents().add({
                    onPulseAllSymbols: null,
                    onPulseAllSymbolsComplete: null,
                    onOnceComplete: function () {
                        if (_this.getIsFg()) {
                            if (!_this.getLastSpin()) {
                                _this.setpayLineComplete(true); //once complete pay line then make flag as true
                                if (_this.getBangUpComplete())
                                    _this.uiController.stopWinDisplay();
                                _this.freeGameSpinStart();
                            }
                            else {
                                _this.setpayLineComplete(true);
                                if (_this.getBangUpComplete())
                                    _this.uiController.stopWinDisplay();
                                if (_this.getBangUpComplete())
                                    _this.uiController.freeSpin.outroStart();
                            }
                        }
                    }
                });
            };
            Logic.prototype.getSlot = function () {
                return this.slot;
            };
            /**
             * Set the Pick bonus view
             * @method fudaole.Logic#setPickBonus
             * @public
             * @param {PickBonus} slot Free spin view
             */
            Logic.prototype.setPickBonus = function (pickBonus) {
                var _this = this;
                this.pickBonus = pickBonus;
                this.pickBonus.getEvents().add({
                    onPickSelect: function (pickIndex) {
                        _this.sendPickBonusWager(pickIndex);
                    },
                    onPickGameEnd: function () {
                        _this.slot.getWinDisplayController().configure(_this.triggerSpinData);
                        //  this.fromPick = true; 
                        _this.backToBaseGame(true);
                        _this.gameState = 0 /* BaseGameSpin */;
                        _this.slot.setVisible(true);
                        _this.slot.setGaffingEnabled(true);
                        //revert this.slot.setReelGaffEnabled(true);
                        _this.slot.skipWinDisplay(true);
                        _this.uiController.setCanUpdateBalance(true);
                        _this.uiController.updateUIForPickGame(false);
                    },
                    sendHistoryReplay: function () {
                        if (_this.historyReplayData.hasData()) {
                            _this.historyReplayData.sendPlayRequest();
                        }
                    }
                });
                if (this.historyReplayData !== undefined) {
                    this.pickBonus.setHistoryReplayData(this.historyReplayData);
                }
            };
            /**
             * Gets the pick bonus object
             * @method fudaole.Logic#getPickBonus
             * @public
             * @returns {PickBonus} The pick bonus object
             */
            Logic.prototype.getPickBonus = function () {
                return this.pickBonus;
            };
            /**
             * Set the bonus view
             * @method fudaole.Logic#setBonus
             * @public
             * @param {Bonus} slot Bonus view
             */
            Logic.prototype.setBonus = function (bonus) {
                var _this = this;
                this.bonus = bonus;
                this.bonus.getEvents().add({
                    onGaffToggled: null,
                    onPickBonusAssetsLoaded: function (pickBonus) {
                        _this.setPickBonus(pickBonus);
                    }
                });
            };
            /**
             * Gets the bonus object
             * @method fudaole.Logic#getBonus
             * @public
             * @returns {Bonus} The bonus object
             */
            Logic.prototype.getBonus = function () {
                return this.bonus;
            };
            /**
             * Sets the last wager
             * @method fudaole.Logic#setLastWager
             * @public
             * @param {Bet} wager The wager
             */
            Logic.prototype.setLastWager = function (wager) {
                this.lastWager = wager;
            };
            /**
             * Sets the gaff stops for the slot
             * @method fudaole.Logic#setGaffStops
             * @public
             * @param {number[]} gaffStops The stop positions to set.
             */
            Logic.prototype.setGaffStops = function (gaffStops) {
                this.slot.setGaffStops(gaffStops);
            };
            Logic.prototype.setGaffReelIndex = function (reelIndex) {
                this.slot.setGaffReelIndex(reelIndex);
            };
            Logic.prototype.setGaffingType = function (gaffingType) {
                this.slot.setGaffingType(gaffingType);
            };
            /**
             * Makes a play request
             * @method fudaole.Logic#sendWager
             * @public
             * @param wager {Bet}
             */
            Logic.prototype.sendWager = function (wager, requestHeaders) {
                this.partnerAdapter.startedPlay();
                this.lastWager = wager;
                this.slot.spin();
                this.glsRequestor.makePlayRequest(this.createPayloads(wager, this.slot), requestHeaders);
                this.slot.setGaffingEnabled(false);
            };
            /**
             * Creates a wager payload for the GLS server
             * @method fudaole.Logic#createPayloads
             * @private
             * @param {Bet} wager the current wager
             * @returns {glscomms.ICustomGLSPayload[]} The list of payloads to send to the GLS
             */
            Logic.prototype.createPayloads = function (wager, slot) {
                if (slot === void 0) { slot = null; }
                var sl = (slot == null) ? this.slot : slot;
                var payloads = [];
                var payload = new fudaole.LTWagerPayload(wager.getTotalBet());
                payloads.push(payload);
                if (this.historyReplayData != null) {
                    payloads.push(new glscomms.ReplayRequestPayload(this.historyReplayData.getNextState()));
                }
                if (sl.shouldGaff()) {
                    payloads.push(new fudaole.GaffPayload(sl.getGaffStops(), sl.getGaffReelIndex(), sl.getGaffingType()));
                } /*
              else {
                       if (this.getFreeGame() &&  this.gameData.getCustomData().featureInfo.remainingFreeSpins === "1") {
                           var promptView = prompt("Enter Reel stops", "2,3,4,5,10");
                           var reelStops = new Array();
                           reelStops = promptView.split(",");
                           payloads.push(new GaffPayload(reelStops, sl.getGaffReelIndex(), sl.getGaffingType()));
    
                       }
    
                   }*/
                sl.setGaffingType(0);
                return payloads;
            };
            /**
             * Makes a play request
             * @method fudaole.Logic#sendPickBonusWager
             * @public
             * @param pickLevel {number}
             * @param pickIndex {number}
             */
            Logic.prototype.sendPickBonusWager = function (pickIndex, requestHeaders) {
                if (this.featureInfo.pickEnd === undefined || !this.featureInfo.pickEnd) {
                    //this.partnerAdapter.startedPlay();
                    this.glsRequestor.makePlayRequest(this.createPickBonusPayloads(this.lastWager, pickIndex), requestHeaders);
                }
            };
            /**
             * Creates a pick bonus payload for the GLS server
             * @method fudaole.Logic#createPickBonusPayloads
             * @private
             * @param {Bet} wager the current wager
             * @returns {glscomms.ICustomGLSPayload[]} The list of payloads to send to the GLS
             */
            Logic.prototype.createPickBonusPayloads = function (wager, pickIndex) {
                var payloads = [];
                var payload = new fudaole.LTWagerPayload(wager.getTotalBet());
                payloads.push(payload);
                var pickPayload = new fudaole.LTPickBonusPayload(pickIndex);
                payloads.push(pickPayload);
                if (this.historyReplayData != null) {
                    payloads.push(new glscomms.ReplayRequestPayload(this.historyReplayData.getNextState()));
                }
                return payloads;
            };
            Logic.prototype.checkToSendEndGame = function () {
                switch (this.gameState) {
                    case 6 /* FreeGameEnd */:
                        this.sendEndGame();
                        break;
                    case 0 /* BaseGameSpin */:
                        var customData = this.gameData.getCustomData();
                        if (customData.featureInfo != null) {
                            this.featureInfo = customData.featureInfo;
                            switch (this.featureInfo.featureindex) {
                                case "1":
                                    this.sendEndGame();
                                    break;
                                case "2":
                                    if (this.fromPick) {
                                        this.fromPick = false;
                                        this.sendEndGame();
                                    }
                                    else {
                                        this.sendEndGame();
                                    }
                                    break;
                            }
                        }
                        else {
                            this.sendEndGame();
                        }
                        break;
                    case 11 /* MaxWin */:
                        this.sendEndGame();
                        break;
                    default:
                        break;
                }
            };
            Logic.prototype.sendEndGame = function () {
                if (this.historyReplayData === undefined) {
                    this.glsRequestor.makeEndRequest();
                }
            };
            Logic.prototype.backToBaseGame = function (fromPickGame) {
                if (fromPickGame) {
                    //Reset Spin Button Tracker
                    this.uiController.resetSpinButtonTracker();
                    var toAmount = this.gameData.getCustomData().getgameWinInfo().totalWagerWin;
                    this.slot.getWinDisplayController().updateGameResultTotalWin(0, toAmount);
                    this.setPickData();
                    this.setMysteryandJackpotAfterPick();
                    var customData = this.gameData.getCustomData();
                    if (this.getMysteryTrigger() || this.getRedEnvTrigger()) {
                        this.fromPick = true;
                        this.setGameState(2 /* BaseGameFeatureStart */);
                        this.handleSpinComplete();
                    }
                    else {
                        /* if (customData.getIsMaxWin()) {
                             this.uiController.handleMaxWinHit(this.gameData);
                         } else {*/
                        //  this.uiController.showSkipButton(true);
                        this.slot.getWinDisplayController().start(true);
                    }
                    this.slot.setGaffingEnabled(true);
                }
            };
            Logic.prototype.setPickData = function () {
                var reelOffsets = [2, 7, 12];
                this.slot.getWinDisplayController().getCycleResults().addDataForPick(new fudaole.FUScatterSlotResult(99, this.gameData.getCustomData().getgameWinInfo().totalPickJkptWin, reelOffsets, true, true));
            };
            Logic.prototype.freeGameIntroTrigger = function () {
                //  this.setGameState(GamePlayState.FreeGameStart);
                this.uiController.freeSpin.getAllRef(this.gameData, this.slot, this);
                this.uiController.freeSpin.introStart();
            };
            Logic.prototype.getTotalWin = function () {
                return this.totalWin;
            };
            /**
             * Handles the play response from the server
             * @method fudaole.Logic#handlePlayResponse
             * @private
             * @param {glscomms.PlayResponse} response The play response from the server
             */
            Logic.prototype.handlePlayResponse = function (response) {
                this.gameInProgress = true;
                if (this.gameState != 12 /* Recovering */) {
                    //this.partnerAdapter.startedPlay();
                    var gameData = response.getGameData();
                    this.setGameData(gameData);
                    var customData = gameData.getCustomData();
                    this.customFeatureInfo = customData.customfeatureinfo;
                    this.featureInfo = customData.featureInfo;
                    this.setFlag();
                    if (this.gameState === 0 /* BaseGameSpin */) {
                        this.baseGameData();
                        this.baseGameFeatures();
                        this.getSlot().skipWinDisplay(true);
                    }
                    else if (this.gameState === 5 /* FreeGameSpin */) {
                        this.freeGameData();
                        this.freeGameFeatures();
                        this.getSlot().skipWinDisplay(true);
                    }
                    else if (this.gameState === 1 /* PickGame */) {
                        this.setTriggerSpinData(customData.getBaseGameData());
                        this.pickBonus.setPickData(this.featureInfo);
                        this.pickBonus.revealPick();
                    }
                    else {
                        console.log('Incorrect game state on play response');
                    }
                    this.gameState = this.getNextState(this.gameState, gameData);
                }
            };
            Logic.prototype.baseGameData = function () {
                this.slot.getWinDisplayController().configure(this.gameData);
                this.slot.getSymbolAnimationController().setHitData(this.gameData.getAllSlotResults());
                this.slot.setStopPositions(this.gameData.getStopPositions());
            };
            Logic.prototype.baseGameFeatures = function () {
                var customData = this.gameData.getCustomData();
                this.customFeatureInfo = customData.customfeatureinfo;
                if (this.customFeatureInfo != undefined) {
                    if (this.gameData.getCustomData().featureInfo != undefined && this.gameData.getCustomData().featureInfo.featureindex === "2") {
                        if (this.getExpandWildTrigger()) {
                            this.isMystery = false;
                            this.isRedEnv = false;
                            this.setGameState(2 /* BaseGameFeatureStart */);
                        }
                    }
                    else {
                        if (this.getMysteryTrigger() || this.getRedEnvTrigger() || this.getExpandWildTrigger())
                            this.setGameState(2 /* BaseGameFeatureStart */); //only mystery symbol replace
                    }
                }
            };
            Logic.prototype.freeGameData = function () {
                this.slot.getWinDisplayController().configure(this.gameData);
                var fromAmount = this.gameData.getCustomData().getgameWinInfo().totalFreeSpinsWin - this.gameData.getTotalWin();
                var toAmount = this.gameData.getCustomData().getgameWinInfo().totalFreeSpinsWin;
                this.slot.getWinDisplayController().updateGameResultTotalWin(fromAmount, toAmount);
                this.uiController.freeSpin.setGameData(this.gameData); //for free game remaining count
                this.uiController.freeSpin.updateFreeSpinsRem(); //update free game remaining count for each newState
                this.uiController.freeSpin.updateBonusReelsInPlay();
                this.slot.getSymbolAnimationController().setHitData(this.gameData.getAllSlotResults());
                this.slot.setStopPositions(this.gameData.getStopPositions());
            };
            Logic.prototype.freeGameFeatures = function () {
                var customData = this.gameData.getCustomData();
                this.customFeatureInfo = customData.customfeatureinfo;
                if (this.getReTrigger()) {
                    this.setGameState(9 /* ReTriggerStart */);
                }
                else {
                    if (this.customFeatureInfo != undefined) {
                        if (this.getMysteryTrigger())
                            this.setGameState(7 /* FreeGameMysteryStart */); //only mystery symbol replace                          
                    }
                }
            };
            /**
             * Determine next game play state, based on current state and incoming server data
             * @method fudaole.Logic#getNextState
             * @public
             * @param {GamePlayState} currentState Current game state
             * @param {GamePlayState} gamedta.GamePlayData Game data from play request
             * @returns {GamePlayState} New game state
             */
            Logic.prototype.getNextState = function (currentState, data) {
                var newState = currentState;
                var customData = data.getCustomData();
                switch (currentState) {
                    case 0 /* BaseGameSpin */:
                        if (this.getFreeGame() && this.getLastSpin() === null)
                            newState = 4 /* FreeGameTrigger */;
                        break;
                }
                return newState;
            };
            /**
             * Handles the completion of a spin
             * @method fudaole.Logic#handleSpinComplete
             * @public
             */
            Logic.prototype.handleSpinComplete = function () {
                switch (this.gameState) {
                    case 4 /* FreeGameTrigger */:
                        this.uiController.stopAutoPlay();
                        //  this.slot.getPulseDisplay().freeGameScatterAnim(Config.FREEGAME_SCATTER_SYMBOL_ID); //to replace symbol animation
                        //  this.slot.getPulseDisplay().isFreeGameTrigger(true); 
                        //   this.audioController.stopBGReelSpinSnd();
                        this.slot.getSymbolAnimationController().checkForSymbolHighlight(3);
                        break;
                    case 5 /* FreeGameSpin */:
                    case 8 /* FreeGameMysteryEnd */:
                        if (this.getMaxWin()) {
                            this.uiController.gameFeature.getAllRef(this.gameData, this.slot, this);
                            this.uiController.gameFeature.getMaxWinController().setMaxWinValue(this.gameData.getCustomData().getgameWinInfo().maxWinValue);
                            this.uiController.gameFeature.getMaxWinController().triggerMaxWinAnim();
                        }
                        else
                            this.slot.getWinDisplayController().start(true);
                        break;
                    case 2 /* BaseGameFeatureStart */:
                        this.audioController.setLoopState(0 /* None */);
                        if (!this.getIsFg()) {
                            this.uiController.gameFeature.getAllRef(this.gameData, this.slot, this);
                            this.uiController.gameFeature.handleTriggeredFeature();
                        }
                        else {
                            if (this.getLastSpin() === null) {
                                this.setGameState(4 /* FreeGameTrigger */);
                                this.handleSpinComplete();
                            }
                        }
                        break;
                    case 9 /* ReTriggerStart */:
                        this.uiController.gameFeature.getAllRef(this.gameData, this.slot, this);
                        this.uiController.gameFeature.getReTriggerController().reTriggerAnimCall();
                        break;
                    case 10 /* ReTriggerEnd */:
                        if (this.getMysteryTrigger())
                            this.setGameState(7 /* FreeGameMysteryStart */);
                        else
                            this.setGameState(5 /* FreeGameSpin */); //after retrigger complet if there is no mystery feature  
                        this.handleSpinComplete();
                        break;
                    case 7 /* FreeGameMysteryStart */:
                        this.uiController.gameFeature.getAllRef(this.gameData, this.slot, this);
                        this.uiController.gameFeature.handleTriggeredFeature();
                        break;
                    case 6 /* FreeGameEnd */:
                        this.backToBgFeatures();
                        if (this.getMysteryTrigger() || this.getRedEnvTrigger()) {
                            this.setGameState(2 /* BaseGameFeatureStart */); //only mystery symbol replace
                            this.handleSpinComplete();
                        }
                        else {
                            this.slot.getWinDisplayController().start(true);
                        }
                        this.setGameState(0 /* BaseGameSpin */);
                        break;
                    case 0 /* BaseGameSpin */:
                        this.audioController.setLoopState(0 /* None */);
                        this.slot.setGaffingEnabled(true);
                        var customData = this.gameData.getCustomData();
                        if (customData.featureInfo != null) {
                            this.featureInfo = customData.featureInfo;
                            switch (this.featureInfo.featureindex) {
                                case "1":
                                    //   if (this.totalWin > 0)
                                    //       this.uiController.showSkipButton(true);
                                    this.slot.getWinDisplayController().start(true);
                                    break;
                                case "2":
                                    if (this.fromPick) {
                                        this.fromPick = false;
                                        //  this.uiController.showSkipButton(true);
                                        this.slot.getWinDisplayController().start(true);
                                    }
                                    else {
                                        this.setGameState(1 /* PickGame */);
                                        this.uiController.stopAutoPlay();
                                        this.bonus.startBonus(true);
                                    }
                                    break;
                            }
                        }
                        else {
                            this.slot.getWinDisplayController().start(true);
                        }
                        break;
                    case 11 /* MaxWin */:
                        if (this.getFreeGame()) {
                            this.backToBgFeatures();
                            if (this.getMysteryTrigger())
                                this.uiController.gameFeature.getMysteryController().symbolReplaceForMystery();
                        }
                        //this.sendEndGame();
                        this.uiController.toggleSpinButton(true);
                        this.uiController.setWin(this.gameData.getCustomData().getgameWinInfo().totalWagerWin);
                        // this.uiController.updateBalance(this.uiController.getBalance());
                        this.uiController.handleBangupComplete();
                        this.getSlot().getWinDisplayController().getCycleResults().getWinStack().reset();
                        this.setGameState(0 /* BaseGameSpin */);
                        break;
                    case 1 /* PickGame */:
                        break;
                    case 12 /* Recovering */:
                        break;
                    default:
                        break;
                }
            };
            Logic.prototype.dashBoardMaxWinVal = function () {
                this.uiController.setWin(this.gameData.getCustomData().getgameWinInfo().totalWagerWin);
            };
            Logic.prototype.backToBgFeatures = function () {
                this.setMysteryTrigger();
                this.setRedEnvTrigger();
            };
            /**
             * Handles the end response from the server
             * @method fudaole.Logic#handleEndResponse
             * @private
             * @param {glscomms.EndResponse} response The end response from the server
             */
            Logic.prototype.handleEndResponse = function (response) {
                this.gameInProgress = false;
                console.log("End Response Received");
            };
            Logic.prototype.setGameData = function (gamedata) {
                this.gameData = gamedata;
                this.totalWin = this.gameData.getTotalWin();
                var customData = this.gameData.getCustomData();
                this.customFeatureInfo = customData.customfeatureinfo;
            };
            Logic.prototype.setTriggerSpinData = function (triggerSpinData) {
                this.triggerSpinData = triggerSpinData;
            };
            Logic.prototype.startHistoryReplay = function (historyData) {
                this.historyReplayData = historyData;
                this.sendWager(this.historyReplayData.getBet());
            };
            /* It used set history replay data
             * Setting flag for history replay
             * @public
             * @param {HistoryStack} It will contain history Replay information.
             * @param {glscomms.PlayResponse} It Will contain play response.
             */
            Logic.prototype.setHistoryReplay = function (historyReplay, playResponse) {
                this.historyReplayData = historyReplay;
                this.isHistoryReplay = true;
                this.slot.spin();
                this.slot.setStopPositions(playResponse.getGameData().getStopPositions());
            };
            Logic.prototype.resetHard = function () {
                if (this.gameState == 0 /* BaseGameSpin */) {
                    TweenMax.delayedCall(0.1, this.slot.setStopPositions, [
                        [0, 0, 0, 0, 0],
                        true
                    ], this.slot);
                    this.uiController.resetHard();
                    this.gameState = 0 /* BaseGameSpin */;
                }
            };
            Logic.prototype.setIsRecovering = function (flg) {
                this.isRecovering = flg;
            };
            Logic.prototype.startPickBonusRecovery = function () {
                this.isRecovering = false;
                this.featureInfo = this.gameData.getCustomData().featureInfo;
                this.bonus.showPickBonus();
                this.pickBonus.doRecoveryRevealPickTile(this.featureInfo);
            };
            Logic.prototype.freeGameSpinStart = function () {
                var that = this;
                if (this.getpayLineComplete() && this.getBangUpComplete()) {
                    if (!this.getLastSpin()) {
                        TweenLite.delayedCall(0.6, function () {
                            that.setIsFGSound(true);
                            that.setGameState(5 /* FreeGameSpin */);
                            //that.partnerAdapter.startedPlay();
                            that.slot.spin();
                            that.glsRequestor.makePlayRequest(that.createPayloads(that.lastWager, that.slot));
                        });
                    }
                    /* else { //if last spin
                        this.uiController.freeSpin.outroStart();
                    }*/
                    this.setpayLineComplete(false);
                    this.setBangUpComplete(false);
                }
            };
            Logic.prototype.setFlag = function () {
                this.checkBWInAutoPlay();
                this.checkIsMaxWin();
                this.reelSetChange();
                this.setFreeGame();
                this.setReTrigger();
                this.setLastSpin();
                this.setMysteryTrigger();
                this.setExpandWildTrigger();
                this.setRedEnvTrigger();
            };
            Logic.prototype.checkBWInAutoPlay = function () {
                if (this.uiController.handleAnim.getBigwin().getBigWinPlaying())
                    this.uiController.handleAnim.getBigwin().animEndAutoPlay();
            };
            Logic.prototype.reelSetChange = function () {
                if (this.reelIndex != Number(this.gameData.getCustomData().reelIndex) && this.gameData.getCustomData().reelIndex != undefined) {
                    this.reelIndex = Number(this.gameData.getCustomData().reelIndex);
                    this.slot.changeReelSet(Number(this.reelIndex));
                }
            };
            Logic.prototype.setMysteryTrigger = function () {
                if (!this.getIsFg() && this.getFreeGame()) {
                    var isSymPresent = this.gameData.getCustomData().featureInfo.baseGameFeatureInfo.isSymPresent;
                    this.setMysterySymId(this.gameData.getCustomData().featureInfo.baseGameFeatureInfo.replacementSymbolIndex);
                }
                else {
                    var isSymPresent = this.gameData.getCustomData().customfeatureinfo.isSymPresent;
                    this.setMysterySymId(this.gameData.getCustomData().customfeatureinfo.replacementSymbolIndex);
                }
                if (isSymPresent === "Y")
                    this.isMystery = true;
                else
                    this.isMystery = false;
            };
            Logic.prototype.setMysterySymId = function (symId) {
                this.mysterySymId = symId;
            };
            Logic.prototype.getMysterySymId = function () {
                return this.mysterySymId;
            };
            Logic.prototype.setExpandWildTrigger = function () {
                if (this.gameData.getCustomData().customfeatureinfo.isNudgingWild === "Y")
                    this.isExpandWild = true;
                else
                    this.isExpandWild = false;
            };
            Logic.prototype.setRedEnvTrigger = function () {
                if (!this.getIsFg() && this.getFreeGame())
                    var isRedEnvlpJkpt = this.gameData.getCustomData().featureInfo.baseGameFeatureInfo.isRedEnvlpJkpt;
                else
                    var isRedEnvlpJkpt = this.gameData.getCustomData().customfeatureinfo.isRedEnvlpJkpt;
                if (isRedEnvlpJkpt === "Y")
                    this.isRedEnv = true;
                else
                    this.isRedEnv = false;
            };
            Logic.prototype.setMysteryandJackpotAfterPick = function () {
                this.isMystery = this.gameData.getCustomData().featureInfo.baseGameFeatureInfo.isSymPresent === "Y";
                this.isRedEnv = this.gameData.getCustomData().featureInfo.baseGameFeatureInfo.isRedEnvlpJkpt === "Y";
                this.isExpandWild = false;
            };
            Logic.prototype.setFreeGame = function () {
                if (this.gameData.getCustomData().featureInfo != undefined) {
                    if (this.gameData.getCustomData().featureInfo.featureindex === "1") {
                        this.setIsFg(true);
                        this.isFreeGame = true;
                    }
                    else
                        this.isFreeGame = false;
                }
                else
                    this.isFreeGame = false;
            };
            Logic.prototype.setReTrigger = function () {
                if (this.getFreeGame()) {
                    if (this.gameData.getCustomData().featureInfo.extraFreeSpinsAwarded !== "0")
                        this.isReTrigger = true;
                    else
                        this.isReTrigger = false;
                }
            };
            Logic.prototype.setLastSpin = function () {
                if (this.gameData.getCustomData().featureInfo != undefined && this.gameData.getCustomData().featureInfo.lastFreeSpin != '') {
                    if (this.gameData.getCustomData().featureInfo.lastFreeSpin === "Y")
                        this.isLastSpin = true;
                    else
                        this.isLastSpin = false;
                }
                else
                    this.isLastSpin = null;
            };
            Logic.prototype.getMysteryTrigger = function () {
                return this.isMystery;
            };
            Logic.prototype.getExpandWildTrigger = function () {
                return this.isExpandWild;
            };
            Logic.prototype.getRedEnvTrigger = function () {
                return this.isRedEnv;
            };
            Logic.prototype.getFreeGame = function () {
                return this.isFreeGame;
            };
            Logic.prototype.getReTrigger = function () {
                return this.isReTrigger;
            };
            Logic.prototype.getLastSpin = function () {
                return this.isLastSpin;
            };
            Logic.prototype.setRedEnvValues = function (val) {
                return this.redEnvValues = val;
            };
            Logic.prototype.getRedEnvValues = function () {
                return this.redEnvValues;
            };
            Logic.prototype.setJackpotValues = function (val) {
                return this.jackpotValues = val;
            };
            Logic.prototype.getJackpotValues = function () {
                return this.jackpotValues;
            };
            Logic.prototype.setpayLineComplete = function (set) {
                this.isPayLineComplete = set;
            };
            Logic.prototype.getpayLineComplete = function () {
                return this.isPayLineComplete;
            };
            Logic.prototype.setBangUpComplete = function (set) {
                this.isBangUPcomplete = set;
            };
            Logic.prototype.getBangUpComplete = function () {
                return this.isBangUPcomplete;
            };
            Logic.prototype.setIsFg = function (set) {
                this.checkIsFg = set;
                this.slot.getWinDisplayController().getCycleResults().checkisFreeGame(set);
            };
            Logic.prototype.getIsFg = function () {
                return this.checkIsFg;
            };
            Logic.prototype.checkIsMaxWin = function () {
                if (this.gameData.getCustomData().getgameWinInfo().isMaxWin)
                    this.isMaxWin = true;
                else
                    this.isMaxWin = false;
            };
            Logic.prototype.getMaxWin = function () {
                return this.isMaxWin;
            };
            Logic.prototype.setIsFGSound = function (set) {
                this.isFGSound = set;
            };
            Logic.prototype.getIsFGSound = function () {
                return this.isFGSound;
            };
            Logic.prototype.setBigWinIsPlaying = function (set) {
                this.bigWinIsPlaying = set;
            };
            Logic.prototype.getBigWinIsPlaying = function () {
                return this.bigWinIsPlaying;
            };
            Logic.prototype.getGameInProgress = function () {
                return this.gameInProgress;
            };
            return Logic;
        })();
        
const logicConstructionHooks = new Set();
fudaole.Logic = new Proxy(Logic, {
  construct(target, args, newTarget) {
    const actual = Reflect.construct(target, args, newTarget);
    for (const hook of logicConstructionHooks) hook(actual);
    return actual;
  }
});
var Bonus = (function () {
            function Bonus(slot, baseBundle, currencyFormatter, translator, partnerAdapter, metaData, uiController, audioController, orientationController, glsRequestor, betController, gameData, uiContainer, featureContainer, gaffContainer, transitionContainer) {
                this.slot = slot;
                this.baseBundle = baseBundle;
                this.currencyFormatter = currencyFormatter;
                this.translator = translator;
                this.partnerAdapter = partnerAdapter;
                this.metaData = metaData;
                this.uiController = uiController;
                this.audioController = audioController;
                this.orientationController = orientationController;
                this.glsRequestor = glsRequestor;
                this.betController = betController;
                this.gameData = gameData;
                this.uiContainer = uiContainer;
                this.featureContainer = featureContainer;
                this.gaffContainer = gaffContainer;
                this.transitionContainer = transitionContainer;
                this.isRecovering = false;
                this.isPickBonusTriggered = false;
                this.isPickBonusAssetLoaded = false;
                this.isPickBonusAssetsLoading = false;
                this.isBonusStarted = false;
                this.isBonusCompleted = false;
                this.signal = {
                    onGaffToggled: null,
                    onPickBonusAssetsLoaded: null
                };
                this.eventDispatcher = new events.EventDispatcher(this.signal);
            }
            /**
             * Gets the event dispatcher
             * @method fudaole.Bonus#getEvents
             * @public
             * @returns {events.EventDispatcher<IBonusListener>} Bonus event dispatcher
             */
            Bonus.prototype.getEvents = function () {
                return this.eventDispatcher;
            };
            /**
             * to start the bonus game, verify the bonus assets loaded or not
             * @method fudaole.Bonus#startBonus
             * @public
             * @param {boolean} isFreeSpin true if freespins hit
             * @param {boolean} isPickBonus true if pick bonus hit
             */
            Bonus.prototype.startBonus = function (isPickBonus) {
                //  this.audioController.stopBaseGameMusic();
                this.isPickBonusTriggered = isPickBonus;
                this.slot.setGaffingEnabled(false);
                this.uiController.setCanUpdateBalance(false);
                this.isBonusStarted = false;
                this.isBonusCompleted = false;
                if (isPickBonus) {
                    if (this.isPickBonusAssetLoaded) {
                        this.playTransition(true);
                    }
                    else {
                        this.loadPickBonusAsset();
                    }
                }
            };
            /**
             * to play bonus transition (intro / outro)
             * @method fudaole.Bonus#playTransition
             * @public
             * @param {boolean} intro true to play intro transition
             */
            Bonus.prototype.playTransition = function (intro) {
                if (intro === void 0) { intro = false; }
                if (intro) {
                    if (this.isPickBonusTriggered) {
                        this.showPickBonus();
                        this.audioController.playPickTransInSnd();
                        this.pickBonus.start();
                    }
                }
            };
            /**
            * PICK BONUS - START
            */
            /**
             * Shows pick bonus view and hides basegame view
             * @method fudaole.Bonus#showPickBonus
             * @public
             */
            Bonus.prototype.showPickBonus = function () {
                this.isRecovering = false;
                this.isBonusStarted = true;
                //revert this.slot.setReelGaffEnabled(false); 
                this.slot.skipWinDisplay(false);
                this.pickBonus.setVisible(true);
                this.uiController.setCanUpdateBalance(false);
                this.uiController.updateUIForPickGame(true);
            };
            /**
             * handles pick bonus assets loading
             * @method fudaole.Bonus#loadPickBonusAsset
             * @public
             * @param {boolean} isRecovering if true, stage loading preloader will not be shown
             */
            Bonus.prototype.loadPickBonusAsset = function (isRecovering) {
                if (isRecovering === void 0) { isRecovering = false; }
                this.isRecovering = isRecovering;
                if (!this.isRecovering) {
                    this.uiController.showStagePreloader(true, 1 /* PickBonus */);
                }
                this.isPickBonusAssetsLoading = true;
                this.isPickBonusAssetLoaded = false;
                fudaole.PickBonusLS.init();
                fudaole.PickBonusPT.init();
                this.pickBonusLSLoader = fudaole.PickBonusLS.getQueueLoader();
                this.pickBonusPTLoader = fudaole.PickBonusPT.getQueueLoader();
                if (this.pickBonusLSLoader.loaded) {
                    this.pickLoaded();
                }
                else {
                    this.pickBonusLSLoader.addEventListener("complete", this.pickLoaded.bind(this));
                }
                if (this.pickBonusPTLoader.loaded) {
                    this.pickLoaded();
                }
                else {
                    this.pickBonusPTLoader.addEventListener("complete", this.pickLoaded.bind(this));
                }
            };
            Bonus.prototype.pickLoaded = function () {
                if (this.pickBonusLSLoader.loaded && this.pickBonusPTLoader.loaded) {
                    this.isPickBonusAssetLoaded = true;
                    this.isPickBonusAssetsLoading = false;
                    var pickBannerLS = new fudaole.PickBonusLS.PickfeatureLM();
                    pickBannerLS.setTransform(0, 0, fudaole.Config.SCALAR, fudaole.Config.SCALAR);
                    pickBannerLS.gotoAndStop(0);
                    var pickBannerPT = new fudaole.PickBonusPT.PickfeaturePortrait();
                    pickBannerPT.setTransform(0, 0, fudaole.Config.SCALAR, fudaole.Config.SCALAR);
                    pickBannerPT.gotoAndStop(0);
                    var pickBanner = pickBannerLS;
                    this.pickBonus = fudaole.PickBonusFactory.createPickBonus(this.featureContainer, this.baseBundle, pickBanner, pickBannerLS, pickBannerPT, this.audioController, this.translator, this.currencyFormatter, this.orientationController, this.metaData.isGaffingEnabled(), this.uiController, this.betController);
                    this.pickBonus.setVisible(false);
                    this.signal.onPickBonusAssetsLoaded(this.pickBonus);
                    this.uiController.showStagePreloader(false, 0 /* BaseGame */);
                    this.playTransition(true);
                }
            };
            return Bonus;
        })();
        
fudaole.Bonus = Bonus;
var PickBonus = (function () {
            /**
             * @constructor
             */
            function PickBonus(container, baseBundle, background, pickBanner, pickBannerLS, pickBannerPT, audioController, orientationController, currencyFormatter, translator, uiController) {
                var _this = this;
                this.container = container;
                this.baseBundle = baseBundle;
                this.background = background;
                this.pickBanner = pickBanner;
                this.pickBannerLS = pickBannerLS;
                this.pickBannerPT = pickBannerPT;
                this.pickLabels = ["PickFeatureStart", "PickFeatureStop", "Reveal", "StartBanner", "StartOutro", "EndFeature"];
                this.startBGLabel = "bgsoundstart";
                this.pickBtnsLS = [];
                this.bgSoundStarted = false;
                this.outroSoundStarted = false;
                this.audioController = audioController;
                this.currencyFormatter = currencyFormatter;
                this.uiController = uiController;
                orientationController.getEvents().add({
                    onChange: function () {
                        _this.updateAssets();
                    }
                });
                this.translator = translator;
                this.signal = {
                    onPickSelect: null,
                    onPickGameEnd: null,
                    sendHistoryReplay: null
                };
                this.eventDispatcher = new events.EventDispatcher(this.signal);
                this.tweenLite = null;
                this.inProcess = false;
            }
            /**
             * Gets the event dispatcher
             * @method fudaole.PickBonus#getEvents
             * @public
             * @returns {events.EventDispatcher<IPickBonusListener>} PickBonus event dispatcher
             */
            PickBonus.prototype.getEvents = function () {
                return this.eventDispatcher;
            };
            /**
             * set history replay data
             * @method fudaole.PickBonus#setHistoryReplayData
             * @public
             * @param {HistoryStack} historyData The history replay data
             */
            PickBonus.prototype.setHistoryReplayData = function (historyData) {
                this.historyReplayData = historyData;
            };
            /**
             * set visibility of pick bonus view
             * @method fudaole.PickBonus#setVisible
             * @public
             * @param {boolean} visible
             */
            PickBonus.prototype.setVisible = function (visible) {
                this.container.visible = visible;
                if (visible) {
                    this.updateAssets();
                }
            };
            /**
             * get visibility of pick bonus view
             * @method fudaole.PickBonus#setVisible
             * @public
             * @returns {boolean} visible
             */
            PickBonus.prototype.getVisible = function () {
                return this.container.visible;
            };
            /**
             * start pick bonus feature
             * @method fudaole.PickBonus#start
             * @public
             * @returns {}
             */
            PickBonus.prototype.start = function () {
                this.initPickScreen();
                this.outroSoundStarted = false;
                this.fadeBackground(true);
                this.pickBannerLS.gotoAndPlay(this.pickLabels[0]);
                this.pickBannerPT.gotoAndPlay(this.pickLabels[0]);
                this.listener = createjs.Ticker.addEventListener("tick", this.pickTicker.bind(this));
                this.bannerListener = createjs.Ticker.addEventListener("tick", this.bannerTicker.bind(this));
            };
            /**
            * intialize  pick screen
            * @method fudaole.PickBonus#initPickScreen
            * @private
            * @returns {}
            */
            PickBonus.prototype.initPickScreen = function () {
                this.inProcess = false;
                this.setVisible(true);
                this.background.alpha = 0;
                this.pickBtnsLS = fudaole.PickBonusLS.getPickBtns();
                this.pickBtnsPT = fudaole.PickBonusPT.getPickBtns();
                this.clickListeners = [];
                var numBtns = this.pickBtnsLS.length;
                for (var i = 0; i < numBtns; i++) {
                    this.clickListeners[i] = this.pickBtnsLS[i].addEventListener("click", this.onPickSelected.bind(this));
                    this.pickBtnsLS[i].visible = true;
                    this.clickListeners[i] = this.pickBtnsPT[i].addEventListener("click", this.onPickSelected.bind(this));
                    this.pickBtnsPT[i].visible = true;
                }
                fudaole.PickBonusLS.reset();
                fudaole.PickBonusPT.reset();
                fudaole.PickBonusLS.setIntroTxt(this.translator.findByKey("com.fudaole.pick.introTxt"), this.baseBundle.myriadProBold.getFontName());
                fudaole.PickBonusPT.setIntroTxt(this.translator.findByKey("com.fudaole.pick.introTxt"), this.baseBundle.myriadProBold.getFontName());
                this.updateMeters();
            };
            PickBonus.prototype.fadeBackground = function (value) {
                if (value)
                    TweenLite.fromTo(this.background, 2, { alpha: 0 }, { alpha: 1 });
                else
                    TweenLite.fromTo(this.background, 3, { alpha: 1 }, { alpha: 0 });
            };
            /**
             * when a pick is selected
             * @method PickBonus#onPickSelected
             * @private
             */
            PickBonus.prototype.onPickSelected = function (event) {
                if (this.inProcess)
                    return;
                this.inProcess = true;
                //    this.audioController.playClickSnd();
                var pickedCard = event.currentTarget;
                var pickIndex = parseInt(pickedCard.name.slice(4));
                this.signal.onPickSelect(pickIndex);
            };
            /**
             * tick event is triggered
             * @method PickBonus#pickTicker
             * @private
             */
            PickBonus.prototype.pickTicker = function () {
                var _this = this;
                switch (this.pickBanner.currentLabel) {
                    case this.pickLabels[1]:
                        createjs.Ticker.removeEventListener('tick', this.listener);
                        this.pickBannerPT.gotoAndStop(this.pickLabels[1]);
                        this.pickBannerLS.gotoAndStop(this.pickLabels[1]);
                        fudaole.PickBonusLS.setGlowVisibility(true);
                        fudaole.PickBonusPT.setGlowVisibility(true);
                        TweenLite.delayedCall(2, function () {
                            _this.pickBannerPT.gotoAndPlay(_this.pickLabels[1]);
                            _this.pickBannerLS.gotoAndPlay(_this.pickLabels[1]);
                        });
                        break;
                    case "outroSound":
                        if (!this.outroSoundStarted) {
                            this.outroSoundStarted = true;
                        }
                        break;
                    case this.pickLabels[4]:
                        createjs.Ticker.removeEventListener('tick', this.listener);
                        // this.audioController.playPickLoopFadeOutSnd(); 
                        //  this.audioController.playPickTransOutSnd();
                        this.bannerListener = createjs.Ticker.addEventListener("tick", this.bannerTicker.bind(this));
                        TweenLite.delayedCall(2, function () {
                            _this.fadeBackground(false);
                        });
                        //this.setVisible(false);
                        //this.doGameEnd();
                        fudaole.PickBonusLS.reset();
                        fudaole.PickBonusPT.reset();
                        break;
                    default:
                        break;
                }
            };
            /**
             * tick event is triggered
             * @method PickBonus#bannerTicker
             * @private
             */
            PickBonus.prototype.bannerTicker = function () {
                switch (this.pickBanner.currentLabel) {
                    case this.startBGLabel:
                        if (!this.bgSoundStarted) {
                            this.bgSoundStarted = true;
                            this.audioController.playPickLoopSnd();
                        }
                        break;
                    case this.pickLabels[2]:
                        createjs.Ticker.removeEventListener('tick', this.bannerListener);
                        this.pickBannerLS.gotoAndStop(this.pickLabels[2]);
                        this.pickBannerPT.gotoAndStop(this.pickLabels[2]);
                        if (this.historyReplayData !== undefined) {
                            this.signal.sendHistoryReplay();
                        }
                        break;
                    case this.pickLabels[5]:
                        createjs.Ticker.removeEventListener('tick', this.bannerListener);
                        this.pickBannerPT.gotoAndStop(this.pickLabels[5]);
                        this.pickBannerLS.gotoAndStop(this.pickLabels[5]);
                        this.setVisible(false);
                        this.doGameEnd();
                        this.audioController.playPickTransOutFadeOutSnd();
                        break;
                    default:
                        break;
                }
            };
            /**
             * set pick info
             * @method PickBonus#setPickData
             * @public
             */
            PickBonus.prototype.setPickData = function (pickInfo) {
                this.pickData = pickInfo;
            };
            /**
             * reveal pick once response is recieved
             * @method PickBonus#revealPick
             * @public
             */
            PickBonus.prototype.revealPick = function () {
                switch (this.pickData.currectPick[1]) {
                    case 0:
                        this.audioController.playPickMaxiSnd();
                        break;
                    case 1:
                        this.audioController.playPickMajorSnd();
                        break;
                    case 2:
                        this.audioController.playPickMinorSnd();
                        break;
                    case 3:
                        this.audioController.playPickMiniSnd();
                        break;
                }
                this.revealMCLS = fudaole.PickBonusLS.revealPick(this.pickData.currectPick[1], this.pickData.currectPick[0], this.pickData.pickEnd);
                this.revealMCPT = fudaole.PickBonusPT.revealPick(this.pickData.currectPick[1], this.pickData.currectPick[0], this.pickData.pickEnd);
                this.revealMCLS.gotoAndPlay(0);
                this.revealMCPT.gotoAndPlay(0);
                this.reveallistener = createjs.Ticker.addEventListener("tick", this.revealTicker.bind(this));
                this.pickBtnsLS[this.pickData.currectPick[0]].visible = false;
                this.pickBtnsPT[this.pickData.currectPick[0]].visible = false;
            };
            PickBonus.prototype.revealTicker = function () {
                switch (this.revealMCLS.currentLabel) {
                    case "End":
                        createjs.Ticker.removeEventListener('tick', this.reveallistener);
                        this.revealMCLS.gotoAndStop("End");
                        this.revealMCPT.gotoAndStop("End");
                        this.inProcess = this.pickData.pickEnd;
                        if (this.historyReplayData !== undefined) {
                            this.signal.sendHistoryReplay();
                        }
                        if (this.pickData.pickEnd || this.pickData.isMaxWin) {
                            this.pickOutro();
                        }
                        break;
                }
            };
            PickBonus.prototype.pickOutro = function () {
                var _this = this;
                this.bgSoundStarted = false;
                //  this.audioController.playPickCoutSnd();
                this.audioController.playPickLoopFadeOutSnd();
                this.audioController.playPickTransOutSnd();
                fudaole.PickBonusLS.setWinnerTxt(this.currencyFormatter.format(this.pickData.pickWin), this.pickData.JkptId, this.translator.findByKey("com.fudaole.pick.winnerTxt"), this.baseBundle.myriadProBold.getFontName());
                fudaole.PickBonusPT.setWinnerTxt(this.currencyFormatter.format(this.pickData.pickWin), this.pickData.JkptId, this.translator.findByKey("com.fudaole.pick.winnerTxt"), this.baseBundle.myriadProBold.getFontName());
                TweenLite.delayedCall(1, function () {
                    _this.pickBannerPT.gotoAndPlay(_this.pickLabels[3]);
                    _this.pickBannerLS.gotoAndPlay(_this.pickLabels[3]);
                    fudaole.PickBonusLS.setGlowVisibility(false);
                    fudaole.PickBonusPT.setGlowVisibility(false);
                    _this.listener = createjs.Ticker.addEventListener("tick", _this.pickTicker.bind(_this));
                });
            };
            /**
             * handles recovery
             * @method fudaole.PickBonus#doRecoveryRevealPickTile
             * @public
             * @param {IPickBonusFeatureInfo} pickInfo The game data
             * @returns {void}
             */
            PickBonus.prototype.doRecoveryRevealPickTile = function (pickInfo) {
                this.initPickScreen();
                this.audioController.playPickLoopSnd();
                this.background.alpha = 1;
                this.pickBannerLS.gotoAndStop(this.pickLabels[2]);
                this.pickBannerPT.gotoAndStop(this.pickLabels[2]);
                this.pickData = pickInfo;
                var pickRevealed = pickInfo.pickConceaded;
                var noPicks = pickRevealed.length;
                fudaole.PickBonusLS.setGlowVisibility(true);
                fudaole.PickBonusPT.setGlowVisibility(true);
                for (var i = 0; i < noPicks; i++) {
                    var pickedButton = pickRevealed[i].split("|").map(Number)[0];
                    var pickReveal = pickRevealed[i].split("|").map(Number)[1];
                    this.pickBtnsLS[pickedButton].visible = false;
                    this.pickBtnsPT[pickedButton].visible = false;
                    this.revealMCLS = fudaole.PickBonusLS.revealPick(pickReveal, pickedButton, this.pickData.pickEnd);
                    this.revealMCPT = fudaole.PickBonusPT.revealPick(pickReveal, pickedButton, this.pickData.pickEnd);
                    this.revealMCLS.gotoAndStop("End");
                    this.revealMCPT.gotoAndStop("End");
                }
                if (pickInfo.pickEnd || pickInfo.isMaxWin) {
                    this.pickOutro();
                }
            };
            /**
             * updates jackpot values in the table
             * @method fudaole.PickBonus#updateMeters
             * @private
             * @param
             * @returns {void}
             */
            PickBonus.prototype.updateMeters = function () {
                var jkptValues = this.uiController.logic.getJackpotValues();
                var jackpotData = [];
                for (var i = 0; i < jkptValues.length; i++)
                    jackpotData.push(this.currencyFormatter.format(jkptValues[i]));
                fudaole.PickBonusLS.setJackPotValues(jackpotData, this.baseBundle.myriadProBold.getFontName());
                fudaole.PickBonusPT.setJackPotValues(jackpotData, this.baseBundle.myriadProBold.getFontName());
            };
            /**
             * end bonus game
             * @method fudaole.PickBonus#doGameEnd
             * @private
             * @returns {void}
             */
            PickBonus.prototype.doGameEnd = function () {
                this.inProcess = true;
                this.signal.onPickGameEnd();
            };
            /**
             * updates elements' position based on the current orientation
             * @method fudaole.PickBonus#updateAssets
             * @public
             * @returns {void}
             */
            PickBonus.prototype.updateAssets = function () {
                if (fudaole.Config.CURRENT_ORIENTATION_MODE === 0) {
                    this.background.image = this.baseBundle.pickbackground_pt.getPayload().image;
                    this.pickBannerLS.visible = false;
                    this.pickBannerPT.visible = true;
                    this.pickBanner = this.pickBannerPT;
                }
                else {
                    this.background.image = this.baseBundle.pickbackground_ls.getPayload().image;
                    this.pickBannerLS.visible = true;
                    this.pickBannerPT.visible = false;
                    this.pickBanner = this.pickBannerLS;
                }
            };
            return PickBonus;
        })();
        
fudaole.PickBonus = PickBonus;
var PickBonusFactory = (function () {
            function PickBonusFactory() {
            }
            //public static CASHBALANCE_POSITIONS: number[][] = [[0, 1808, 0.9],
            // [0, 956, 1]];
            /**
             * Creates a pickbonus object
             * @method fudaole.PickBonusFactory#createPickBonus
             * @public static
             * @param {createjs.Container} container The container to put actors in
             * @param {PickBonusBundle} bundle The pick bonus bundle of assets
             * @param {BaseBundle} baseBundle The base bundle of assets
             * @param {ScrollAnimationController} scrollAnimationController the pick award table animation controller
             * @param {TileRevealAnimController} tileRevealAnimController the pick tile animation controller
             * @param {IPickBonusAward[][]} pickBonusAwards the pick bonus awards data from server init response
             * @param {AudioController} audioController Audio controller
             * @param {locale.Translator} translator The translator object
             * @param {locale.CurrencyFormatter} currencyFormatter The currency formatter
             * @param {OrientationController} orientationController The orintation handler
             * @param {boolean} gaffingEnabled True if the user can gaff the reels
             * @param {UIController} uiController The UI controller
             * @param {BetController} betController The bet controller
             * @returns {PickBonus} The created pickbonus object
             */
            PickBonusFactory.createPickBonus = function (container, baseBundle, pickBanner, pickBannerLS, pickBannerPT, audioController, translator, currencyFormatter, orientationController, gaffingEnabled, uiController, betController) {
                var background = PickBonusFactory.createImage(baseBundle.pickbackground_ls, "background");
                container.addChild(background);
                /********** PICK ASSETS **********/
                var pickContainer = fudaole.Utils.createContainer(container, "pickContainer");
                /***************************************************************************************************************/
                container.addChild(pickBannerLS);
                container.addChild(pickBannerPT);
                pickBannerPT.visible = false;
                var pickBonus = new fudaole.PickBonus(container, baseBundle, background, pickBanner, pickBannerLS, pickBannerPT, audioController, orientationController, currencyFormatter, translator, uiController);
                return pickBonus;
            };
            /**
             * Creates the image for the game
             * @metod fudaole.PickBonusFactory#createImage
             * @private static
             * @param {createjs.Container} parent The parent to put images in
             * @param {asset.ImageAsset} img The image asset
             * @param {string} name The instance name of image
             * @param {number[]} positions The positions
             * @returns {createjs.Bitmap} The image
             */
            PickBonusFactory.createImage = function (img, name, positions) {
                if (positions === void 0) { positions = [0, 0]; }
                var bitmap = new createjs.Bitmap(img.getPayload().image);
                bitmap.name = name;
                bitmap.setTransform(positions[0], positions[1]);
                if (positions[2] != undefined) {
                    bitmap.scaleX = bitmap.scaleY = positions[2];
                }
                return bitmap;
            };
            return PickBonusFactory;
        })();
        
fudaole.PickBonusFactory = PickBonusFactory;
const onInitResponse = function (response) {
            var platformData = response.getPlatformData();
            var cf = platformData.getCurrencyFormat();
            var requestObject = this.glsRequestor.getRequestObject();
            this.currencyMultiplier = platformData.getCurrencyMultiplier();
            this.partnerAdapter.receivedGameLogicResponse(requestObject);
            this.partnerAdapter.logics.currencyFormatter.setFormatting(cf.name, cf.symbol, cf.grouping, cf.groupingSeparator, cf.fractionalDigits, cf.fractionalSeparator, cf.currencyCodeBeforeAmount, cf.currencyCodeSpacing, cf.currencySymbolBeforeAmount, cf.currencySymbolSpacing);
            this.currencyFormatter.setData(cf);
            this.glsRequestor.configure(platformData);
            //Open Bet new API 
            //Added null check for open bet pay load
            var balance = response.getBalance();
            if (this.partnerListener != undefined) {
                if (this.partnerListener.gamePlayEventListener) {
                    var openBetCash = balance;
                    var openBetFreeBet = 0;
                    if (response.getGameData().getCustomData().openBetPayLoad != undefined && response.getGameData().getCustomData().openBetPayLoad[fudaole.Config.INIT]) {
                        openBetCash = response.getGameData().getCustomData().openBetPayLoad[fudaole.Config.INIT].CASH;
                        openBetFreeBet = response.getGameData().getCustomData().openBetPayLoad[fudaole.Config.INIT].FREEBET;
                    }
                    this.partnerListener.gamePlayEventListener.handleGameInitializedEvent({
                        "isResumeGame": platformData.getIsRecovering(),
                        "CASH": openBetCash,
                        "FREEBET": openBetFreeBet,
                        "balanceAmount": balance
                    });
                }
            }
            //
            this.loadGame(response, platformData.getIsRecovering());
        };
const loadGame = function (response, isRecovering) {
            var gameData = response.getGameData();
            var reelGroupData = gameData.getReelGroup(0);
            var reelSet = [gameData.getReelGroup(0), gameData.getReelGroup(1)];
            var betConfig = gameData.getBetConfiguration();
            var betController = new fudaole.BetController(betConfig.getAvailableBets(), betConfig.getDefaultIndex());
            var totalPaylines = gameData.getAllPaylines().length;
            var jackpotValues = gameData.getCustomData().jackpotData.jackpotAwards;
            var redEnvValues = gameData.getCustomData().redEnvData.redEnvAwards;
            var symbolAnimationsController = new fudaole.SymbolAnimationsController();
            this.slot = fudaole.SlotFactory.createSlot(this.backgroundContainer, this.slotContainer, this.uiContainer, this.gaffContainer, this.baseBundle, symbolAnimationsController, reelGroupData, this.audioController, this.translator, this.currencyFormatter, this.background, this.orientationController, this.metaData.isGaffingEnabled(), this.uiController, betController, totalPaylines, reelSet);
            var bigWinController = new fudaole.BigWinController(this.scalar, this.audioController, this.currencyFormatter, this.baseBundle, this.orientationController, this.baseBundle.myriadProBold, this.bigWinContainer, this.translator, this.uiController);
            this.slot.getWinDisplayController().getBangController().setBigWinController(bigWinController);
            this.logic = new fudaole.Logic(this.partnerAdapter, this.loader, this.glsRequestor, this.uiController, this.audioController);
            this.logic.setSlot(this.slot);
            this.logic.setJackpotValues(jackpotValues);
            this.logic.setRedEnvValues(redEnvValues);
            var bonus = new fudaole.Bonus(this.slot, this.baseBundle, this.currencyFormatter, this.translator, this.partnerAdapter, this.metaData, this.uiController, this.audioController, this.orientationController, this.glsRequestor, betController, gameData, this.uiContainer, this.featureContainer, this.gaffContainer, this.transitionContainer);
            this.logic.setBonus(bonus);
            this.uiController.setLogic(this.logic);
            this.uiController.topMeterUpdate();
            //Autoplay initialise
            var currentBalance = response.getBalance();
            var currentTotalStake = (betController.getCurrentBet().getTotalBet() * betController.getCurrentBet().getBetPerUnit());
            this.initToPartnerAutoplay(currentBalance, currentTotalStake);
            this.uiController.setBetController(betController);
            this.uiController.onInitResponse(response);
            this.orientationController.updateCanvasAndAssets();
            this.audioController.getRef(this.uiController);
            if (isRecovering) {
                var createData = {
                    stage: this.createjs_stage,
                    glsRequestor: this.glsRequestor,
                    logic: this.logic,
                    slot: this.slot,
                    bonus: bonus,
                    uiController: this.uiController,
                    betController: betController,
                    bet: betController.getCurrentBet(),
                    partnerAdapter: this.partnerAdapter,
                    translator: this.translator,
                    audioController: this.audioController
                };
                var recovery = new fudaole.RecoveryManager(createData);
            }
            else if (this.isHistoryReplay()) {
                this.uiController.startHistoryReplay(this.historyData);
                this.sendingReplayRequest(betController);
            }
            else {
                this.createjs_stage.visible = true;
                this.partnerAdapter.hideProgressBar();
                //  this.uiController.createLaunchScreen();
                //this.audioController.playBaseGameMusic();
                //fps graph - jothy 
                if (this.addStats() && this.metaData.isDemoEnabled()) {
                    this.createStats();
                }
            }
            if (typeof this.logic.partnerAdapter.gameReady === "function") {
                this.logic.partnerAdapter.gameReady();
            }
        };
return Object.freeze({
    sourceBinding,
    observeLogicConstruction(hook) {
      if (typeof hook !== "function") throw new TypeError("Construction hook required");
      logicConstructionHooks.add(hook);
      return () => logicConstructionHooks.delete(hook);
    },
    namespace: fudaole, events, glscomms,
    createjs, TweenLite, TweenMax,
    Bet, BetController, Logic, Bonus, PickBonus, PickBonusFactory,
    onInitResponse, loadGame
  });
}
module.exports = Object.freeze({
  sourceBinding, createOwn32769EventTypes, createOwn32769NativeModelTypes
});
