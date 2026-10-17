var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", "abg2d/abg2d", "asset/asset", "howler/howler", "big-win/big-win", "events/events", "game/game", "game-data/game-data", "gls-comms/gls-comms", "http-connection/http-connection", "input/input", "locale/locale", "particle-effect/particle-effect", "reels/reels", "standard-reels/standard-reels", "TimelineLite", "TimelineMax", "TweenLite", "TweenMax", "util/util"], function (require, exports, abg2d, asset, howler, bigwin, events, game, gamedata, glscomms, httpconnection, input, locale, particleeffect, reels, standardreels, TimelineLite, TimelineMax, TweenLite, TweenMax, util) {
    /**
     * Slot Class
     * @class eef.Slot
     * @classdesc Class definition of a slot
     */
    var Slot = (function () {
        /**
         * @constructor
         */
        function Slot(group, reelStrips, reelFrame, audioController, winDisplay, symbolAnimationController, gaffingEnabled, metaData) {
            var _this = this;
            this.gaffingReelIndex = 0;
            this.RestoreFreeGameSound = false;
            this.group = group;
            this.group.setOnSpinComplete(function () { return _this.handleSpinComplete(); });
            this.group.setOnHitAction(function (reelId) {
                _this.handleHitAction(reelId);
            });
            this.reelStopper = new standardreels.ReelStopper(this.group);
            this.audioController = audioController;
            this.symbolAnimationController = symbolAnimationController;
            this.reelFrame = reelFrame;
            this.winDisplay = winDisplay;
            this.reelStrips = reelStrips;
            this._metaData = metaData;
            this.signal = {
                onSpinComplete: null,
                onSkillStop: null,
                onGaffReel: null,
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
            this.metaDataGaffingEnabled = gaffingEnabled;
            this.gaffingEnabled = gaffingEnabled;
            this.gaffed = false;
            this.stops = [];
        }
        /**
         * Gets the event dispatcher
         * @method eef.Slot#getEvents
         * @public
         * @returns {events.EventDispatcher<ISlotListener>} Slot event dispatcher
         */
        Slot.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Gets the reel frame actor
         * @method eef.Slot#getReelFrame
         * @public
         * @returns {abg2d.Actor} The reel frame actor
         */
        Slot.prototype.getReelFrame = function () {
            return this.reelFrame;
        };
        /**
         * Gets the reel group
         * @method eef.Slot#getReelGroup
         * @public
         * @returns {standardreels.Group} The reel group
         */
        Slot.prototype.getReelGroup = function () {
            return this.group;
        };
        /**
         * Gets the win display controller
         * @method eef.Slot#getWinDisplayController
         * @public
         * @returns {WinDisplayController} The win display controller
         */
        Slot.prototype.getWinDisplayController = function () {
            return this.winDisplay;
        };
        /**
         * Gets the symbol animation controller
         * @method eef.Slot#getSymbolAnimationController
         * @public
         * @returns {SymbolAnimationController} The symbol animation controller
         */
        Slot.prototype.getSymbolAnimationController = function () {
            return this.symbolAnimationController;
        };
        /**
         * Spins the reels
         * @method eef.Slot#spin
         * @public
         */
        Slot.prototype.spin = function () {
            //scale canvas
            this.winDisplay.stop();
            this.group.spin();
            if (!this.RestoreFreeGameSound) {
                this.audioController.playBackgroundMusic();
            }
            else {
                this.audioController.handleFreeSpinMusicLoop(true);
                this.RestoreFreeGameSound = false;
            }
        };
        /**
         * Sets the stop positions, which will result in the reels stopping
         * eventually (according to the spin profile, skill stop, etc).
         * @method eef.Slot#setStopPositions
         * @public
         * @param {number[]} stops The array of stops
         * @param {boolean} updateDisplayImmediately True to show new stop positions immediately, false to let spin finish
         */
        Slot.prototype.setStopPositions = function (stops, updateDisplayImmediately) {
            if (updateDisplayImmediately === void 0) { updateDisplayImmediately = false; }
            this.stops = stops;
            if (updateDisplayImmediately == false) {
                this.reelStopper.setStopPositions(stops);
            }
            else {
                this.group.forceStop(stops);
            }
        };
        /**
         * Handle touches made to the reels
         * @method eef.Slot#handleReelTouches
         * @public
         * @param {number} x X-coord of touch
         * @param {number} y Y-coord of touch
         */
        Slot.prototype.handleReelTouches = function (x, y) {
            if (this.winDisplay.getIsPlaying()) {
                var partnerCode = this._metaData.getPartnerCode();
                var isALC = false;
                if (partnerCode.indexOf("nyx_alc") > -1 || partnerCode.indexOf("nyx_atlantic") > -1) {
                    isALC = true;
                }
                var skillStopStatus = this._metaData.getSkillStopStatus();
                if (typeof (this._metaData.getSkillStopStatus()) == "string") {
                    skillStopStatus = this._metaData.getSkillStopStatus() == "on";
                }
                if (isALC == false && skillStopStatus) {
                    this.winDisplay.stop(true);
                }
            }
            else if (this.gaffingEnabled) {
                var bounds = new abg2d.Rect();
                for (var i = 0; i < this.group.getReelCount(); i++) {
                    var controller = this.group.getController(i);
                    controller.getLayout().getBounds(bounds);
                    if (bounds.containsPoint(x, y)) {
                        this.gaffed = true;
                        this.winDisplay.stop();
                        controller.spinStep(true, y > bounds.getCenterY());
                    }
                }
            }
        };
        /**
         * Retrieves the stop positions that the reels are currently at.
         * @method eef.Slot#getCurrentReelStops
         * @public
         * @returns {number[]} Array with the current stops
         */
        Slot.prototype.getCurrentReelStops = function () {
            var currentReelStops = [];
            for (var reelId = 0; reelId < this.group.getReelCount(); ++reelId) {
                var layout = this.group.getController(reelId).getLayout();
                currentReelStops[reelId] = layout.getCurrentStripIndex();
            }
            return currentReelStops;
        };
        /**
         * Set the an array of stops to be used for gaffing
         * @method eef.Slot#setGaffStops
         * @public
         * @param {number[]} Array with the stops to set
         */
        Slot.prototype.setGaffStops = function (stops) {
            this.gaffingStops = stops;
            this.gaffed = true;
        };
        /**
         * Retrieves the gaff positions that have been set or the current stops
         * @method eef.Slot#getGaffStops
         * @public
         * @returns {number[]} Array with the gaff stops
         */
        Slot.prototype.getGaffStops = function () {
            return (this.gaffingStops == null) ? this.getCurrentReelStops() : this.gaffingStops;
        };
        /**
         * Is gaffing enabled and have the reels been gaffed.
         * @method eef.Slot#shouldGaff
         * @public
         * @returns {boolean} Whether a gaff should proceed
         */
        Slot.prototype.shouldGaff = function () {
            return this.gaffingEnabled && this.gaffed;
        };
        Slot.prototype.setGaffReelIndex = function (reelIndex) {
            this.gaffingReelIndex = reelIndex;
        };
        Slot.prototype.getGaffReelIndex = function () {
            return this.gaffingReelIndex;
        };
        Slot.prototype.setSymbolID = function (symID) {
            this.revealSymbolID = symID;
        };
        Slot.prototype.getSymbolID = function () {
            return this.revealSymbolID;
        };
        Slot.prototype.setGaffingType = function (gaffingType) {
            this.gaffingType = gaffingType;
        };
        Slot.prototype.getGaffingType = function () {
            return this.gaffingType;
        };
        Slot.prototype.setGaffingEnabled = function (value) {
            if (this.metaDataGaffingEnabled) {
                this.gaffingEnabled = value;
            }
        };
        Slot.prototype.setRestoreFreegameSound = function (value) {
            this.RestoreFreeGameSound = value;
        };
        /**
         * Handles the completion of a spin
         * @method eef.Slot#handleSpinComplete
         * @private
         */
        Slot.prototype.handleSpinComplete = function () {
            this.gaffingStops = null;
            this.gaffed = false;
            this.reelStopper.reset();
            this.signal.onSpinComplete();
        };
        /**
         * Called when the player requests a skillstop.
         * Propagates the request to any listeners.
         * @method eef.Slot#skillStop
         * @private
         */
        Slot.prototype.skillStop = function () {
            this.reelStopper.requestSkillStop();
            this.signal.onSkillStop();
        };
        /**
         * Handles a hit action on the reels
         * @method eef.Slot#handleHitAction
         * @private
         * @param {number} reelId The reel to check for the hit
         */
        Slot.prototype.handleHitAction = function (reelId) {
            this.symbolAnimationController.checkForSymbolHit(reelId, this.stops);
            this.audioController.playReelSpinClick(reelId);
        };
        Slot.prototype.changeReelSet = function (reelIndex) {
            for (var i = 0; i < this.group.getReelCount(); i++) {
                var controller = this.group.getController(i);
                var layout = controller.getLayout();
                var reel = layout.getReel();
                reel.setStrip(this.reelStrips[reelIndex][i]);
            }
        };
        return Slot;
    })();
    exports.Slot = Slot;
    var Main = (function () {
        /**
         * @constructor
         */
        function Main(metaData, partnerAdapter, partnerListener, balanceService) {
            var _this = this;
            this.stage_pause = false;
            this.metaData = metaData;
            this.partnerAdapter = partnerAdapter;
            this.partnerListener = partnerListener;
            this.partnerBalanceService = balanceService;
            this.partnerAdapter.setMenuHandler("MUTE", function (checked) {
                if (_this.audioController) {
                    _this.audioController.partnerAdapterMute(checked);
                }
            });
            util.ErrorReporter.setPartnerAdapter(partnerAdapter);
            this.currencyFormatter = new locale.CurrencyFormatter();
            this.url = new util.URL(window.location.href);
            var requestListener = {
                onInitResponse: function (initResponse) {
                    _this.onInitResponse(initResponse);
                },
                onPlayResponse: null,
                onEndResponse: null,
                onError: function (url, error, status) {
                    _this.partnerAdapter.finishedPlay();
                    _this.partnerAdapter.finishedPostGameAnimations();
                    if (error == "unable to connect") {
                        var message = _this.translator.findByKey("com.williamsinteractive.mobile.mobile.ERROR_CONNECTION_BODY");
                        util.ErrorReporter.showError(message, null, function () {
                            _this.partnerAdapter.reload();
                        });
                    }
                    else if (error == "unable to read response text") {
                        var message = _this.translator.findByKey("com.williamsinteractive.mobile.mga.IDS_SERVER_UNCONFIRMED");
                        util.ErrorReporter.showError(message, null, function () {
                            _this.partnerAdapter.reload();
                        });
                    }
                    else if (error == "failed sending request") {
                        var message = _this.translator.findByKey("com.williamsinteractive.mobile.mga.IDS_SERVER_UNCONFIRMED");
                        util.ErrorReporter.showError(message, null, function () {
                            _this.partnerAdapter.reload();
                        });
                    }
                    else {
                        try {
                            _this.partnerAdapter.receivedGameLogicResponse(_this.glsRequestor.getRequestObject());
                        }
                        catch (e) {
                        }
                    }
                }
            };
            this.glsRequestor = new GLSRequestor(metaData, partnerAdapter.getSessionData(), EEFConfig.GLM_INFO);
            this.glsRequestor.setXMLParserFactory(new EEFResponseXMLParserFactory);
            this.glsRequestor.getEvents().add(requestListener);
            if (partnerAdapter.logics.platform.promoInfo != undefined) {
                this.glsRequestor.setPromoInfo(partnerAdapter.logics.platform.promoInfo);
            }
            this.deviceContext = new util.DeviceContext();
            this.scalar = this.deviceContext.getScalar();
            var screenWidth = this.deviceContext.getScaledScreenWidth();
            var screenHeight = this.deviceContext.getScaledScreenHeight();
            var screenRatio = screenWidth / screenHeight;
            if (window.innerHeight > window.innerWidth) {
                this.scalar *= screenRatio;
                screenWidth *= screenRatio;
                screenHeight *= screenRatio;
            }
            if (this.scalar <= 0.49) {
                this.scalar = 0.49;
                screenWidth = 941;
                screenHeight = 588;
                UIFactory.scalar = 0.49;
            }
            else {
                this.scalar = 1.0;
                screenWidth = 1920;
                screenHeight = 1200;
                UIFactory.scalar = 1;
            }
            this.scene = abg2d.Factory.createScene(partnerAdapter.getGameDomElement(), screenWidth, screenHeight, this.scalar, true, true, 100, 2000);
            /**
             * Language codes to be of en_GB format,
             * all others are not considered and then the default language (en_GB) is loaded
             */
            var language = metaData.getLocale();
            if (language != undefined) {
                switch (language.length) {
                    case 0:
                    case 1:
                    case 3:
                    case 4:
                        language = EEFConfig.DEFAULT_LANGUAGE; //Load Default
                        console.log("Language not found! Loading Default :: " + EEFConfig.DEFAULT_LANGUAGE);
                        break;
                    case 5:
                        if (EEFConfig.LANGUAGE_CODES.indexOf(language) == -1) {
                            language = EEFConfig.DEFAULT_LANGUAGE; //Load Default
                            console.log("Language not found! Loading Default :: " + EEFConfig.DEFAULT_LANGUAGE);
                        }
                        else {
                            console.log("Loading Language :: " + language);
                        }
                        break;
                    case 2:
                        var found = this.checkLang(language);
                        if (found == EEFConfig.LANGUAGE_CODES.length) {
                            language = EEFConfig.DEFAULT_LANGUAGE; //Load Default
                            console.log("Language not found! Loading Default :: " + EEFConfig.DEFAULT_LANGUAGE);
                        }
                        else {
                            language = EEFConfig.LANGUAGE_CODES[found];
                            console.log("Loading Language :: " + EEFConfig.DEFAULT_LANGUAGE[found]);
                        }
                        break;
                }
            }
            else {
                language = EEFConfig.DEFAULT_LANGUAGE;
                console.log("Language not found! Loading Default :: " + EEFConfig.DEFAULT_LANGUAGE);
            }
            EEFConfig.CURRENT_LANGUAGE = language;
            EEFConfig.CDN_ROOT = this.getCDNRoot();
            var resourcePath = EEFConfig.CDN_ROOT + "content/eightyeightfortunes/resources/";
            var isNt = (EEFConfig.CURRENT_LANGUAGE === "no_NO") ? "translation/noimages/" : "";
            var assetResolution = "/x1.0/";
            if (this.scalar == 0.49) {
                assetResolution = "/x0.49/";
            }
            if (this.scalar == 1) {
                this.baseBundle = {
                    background: new asset.ImageAsset(resourcePath + "images/1.0/" + isNt + "background.png"),
                    symbols: new asset.ImageAsset(resourcePath + "atlas/symbols" + assetResolution + "symbols.json", resourcePath + "atlas/symbols" + assetResolution + "symbols-packed.png"),
                    dropShadow: new asset.ImageAsset(resourcePath + "images/1.0/dropshadow.png"),
                    reelFrame: new asset.ImageAsset(resourcePath + "images/1.0/reelframe.png"),
                    winstack: new asset.ImageAsset(resourcePath + "images/1.0/winstack.png"),
                    logo: new asset.ImageAsset(resourcePath + "images/1.0/logo.png"),
                    translations: new asset.JSONAsset(resourcePath + "translations/translations_" + language + ".json"),
                    spinButton: new asset.ImageAsset(resourcePath + "images/1.0/spinbutton.png"),
                    spinButtonDisable: new asset.ImageAsset(resourcePath + "images/1.0/spinbuttondisable.png"),
                    settingsButton: new asset.ImageAsset(resourcePath + "images/1.0/settingsbutton.png"),
                    setButtonDisable: new asset.ImageAsset(resourcePath + "images/1.0/setbuttondisable.png"),
                    helpButtonDisable: new asset.ImageAsset(resourcePath + "images/1.0/helpbuttondisable.png"),
                    autoPlayIcon: new asset.ImageAsset(resourcePath + "images/1.0/autoplay.png"),
                    autoPlayIconDisable: new asset.ImageAsset(resourcePath + "images/1.0/autoplaydisable.png"),
                    autoPlayMenu: new asset.ImageAsset(resourcePath + "images/1.0/autoplaymenu.png"),
                    betMenu: new asset.ImageAsset(resourcePath + "images/1.0/betmenu.png"),
                    autoPlayIconBox: new asset.ImageAsset(resourcePath + "images/1.0/autoplayiconbox.png"),
                    autoPlaySpinButton: new asset.ImageAsset(resourcePath + "images/1.0/autoplayspinbutton.png"),
                    autoPlayStopButton: new asset.ImageAsset(resourcePath + "images/1.0/autoplaystopbutton.png"),
                    helpAnywaysHeader: new asset.ImageAsset(resourcePath + "images/1.0/anywayTM.png"),
                    helpAnywaysWaysGrid: new asset.ImageAsset(resourcePath + "images/1.0/ways.png"),
                    helpComboSample: new asset.ImageAsset(resourcePath + "images/1.0/ComboSample.png"),
                    settingsMenuBar: new asset.ImageAsset(resourcePath + "images/1.0/settingsmenubar.png"),
                    myriadProSemiBold: new asset.FontAsset(resourcePath + "fonts/MyriadPro-Semibold.otf"),
                    myriadProBold: new asset.FontAsset(resourcePath + "fonts/MyriadPro-Bold.otf"),
                    winMeterBackground: new asset.ImageAsset(resourcePath + "images/1.0/winmeterbackground.png"),
                    helpbutton: new asset.ImageAsset(resourcePath + "images/1.0/helpbutton.png"),
                    shelpbutton: new asset.ImageAsset(resourcePath + "images/1.0/shelpbutton.png"),
                    stakemtr: new asset.ImageAsset(resourcePath + "images/1.0/stakemtr.png"),
                    stakemtrDisable: new asset.ImageAsset(resourcePath + "images/1.0/stakemtrdisable.png"),
                    multipliermeter: new asset.ImageAsset(resourcePath + "images/1.0/multipliermeter.png"),
                    bowl: new asset.ImageAsset(resourcePath + "images/1.0/bowl.png"),
                    bowl1: new asset.ImageAsset(resourcePath + "images/1.0/bowl1.png"),
                    bowl2: new asset.ImageAsset(resourcePath + "images/1.0/bowl2.png"),
                    bowl3: new asset.ImageAsset(resourcePath + "images/1.0/bowl3.png"),
                    ext_help: new asset.ImageAsset(resourcePath + "images/1.0/ext_help.png"),
                    mini: new asset.ImageAsset(resourcePath + "images/1.0/minilock.png"),
                    minor: new asset.ImageAsset(resourcePath + "images/1.0/minorlock.png"),
                    major: new asset.ImageAsset(resourcePath + "images/1.0/majorlock.png"),
                    grand: new asset.ImageAsset(resourcePath + "images/1.0/grandlock.png"),
                    balance: new asset.ImageAsset(resourcePath + "images/1.0/balance.png"),
                    stake: new asset.ImageAsset(resourcePath + "images/1.0/stake.png"),
                    win: new asset.ImageAsset(resourcePath + "images/1.0/win.png"),
                    setbutton: new asset.ImageAsset(resourcePath + "images/1.0/setbutton.png"),
                    ssetbutton: new asset.ImageAsset(resourcePath + "images/1.0/ssetbutton.png"),
                    coin: new asset.ImageAsset(resourcePath + "images/1.0/coin.png"),
                    autoplay: new asset.ImageAsset(resourcePath + "images/1.0/autoplay.png"),
                    betminus: new asset.ImageAsset(resourcePath + "images/1.0/betminus.png"),
                    betplus: new asset.ImageAsset(resourcePath + "images/1.0/betplus.png"),
                    betminusDisable: new asset.ImageAsset(resourcePath + "images/1.0/betminusdisable.png"),
                    betplusDisable: new asset.ImageAsset(resourcePath + "images/1.0/betplusdisable.png"),
                    creditswindow: new asset.ImageAsset(resourcePath + "images/1.0/creditswindow.png"),
                    creditsselected: new asset.ImageAsset(resourcePath + "images/1.0/creditsselected.png"),
                    creditsSelectedDisable: new asset.ImageAsset(resourcePath + "images/1.0/creditsselecteddisable.png"),
                    coingold: new asset.ImageAsset(resourcePath + "images/1.0/coingold.png"),
                    turtle: new asset.ImageAsset(resourcePath + "images/1.0/turtle.png"),
                    turtlegold: new asset.ImageAsset(resourcePath + "images/1.0/turtlegold.png"),
                    junk: new asset.ImageAsset(resourcePath + "images/1.0/junk.png"),
                    junkgold: new asset.ImageAsset(resourcePath + "images/1.0/junkgold.png"),
                    phoenix: new asset.ImageAsset(resourcePath + "images/1.0/phoenix.png"),
                    phoenixgold: new asset.ImageAsset(resourcePath + "images/1.0/phoenixgold.png"),
                    ingot: new asset.ImageAsset(resourcePath + "images/1.0/ingot.png"),
                    ingotgold: new asset.ImageAsset(resourcePath + "images/1.0/ingotgold.png"),
                    allup: new asset.ImageAsset(resourcePath + "images/1.0/allup.png"),
                    helpcoingold: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helpcoingold.png"),
                    helpingotgold: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helpingotgold.png"),
                    helppheonixgold: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helppheonixgold.png"),
                    helpjunkgold: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helpjunkgold.png"),
                    helpturtlegold: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helpturtlegold.png"),
                    helpturtle: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helpturtle.png"),
                    helpingot: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helpingot.png"),
                    helpjunk: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helpjunk.png"),
                    helppheonix: new asset.ImageAsset(resourcePath + "images/1.0/helpfu/helppheonix.png"),
                    anyway: new asset.ImageAsset(resourcePath + "images/1.0/help/anyway.jpg"),
                    wildimage: new asset.ImageAsset(resourcePath + "images/1.0/help/wild.png"),
                    helpbtn: new asset.ImageAsset(resourcePath + "images/1.0/help/btn.png"),
                    helpexit: new asset.ImageAsset(resourcePath + "images/1.0/help/exit_btn.png"),
                    tally: new asset.ImageAsset(resourcePath + "images/1.0/tally.png"),
                    flybats: new asset.ImageAsset(resourcePath + "atlas/flybats" + assetResolution + "flybats.json", resourcePath + "atlas/flybats" + assetResolution + "flybats-packed.png"),
                    LandingScreen: new asset.ImageAsset(resourcePath + "images/1.0/" + isNt + "LandingScreen.jpg"),
                    gameLogo: new asset.ImageAsset(resourcePath + "images/1.0/fglogo.png"),
                    activeframehighlight: new asset.ImageAsset(resourcePath + "images/1.0/activeframehighlight.png"),
                    symbolhighlight: new asset.ImageAsset(resourcePath + "images/1.0/activehighlight.png"),
                    ssetbuttondisable: new asset.ImageAsset(resourcePath + "images/1.0/ssetbuttondisable.png"),
                    shelpbuttondisable: new asset.ImageAsset(resourcePath + "images/1.0/shelpbuttondisable.png"),
                    helpAllUp: new asset.ImageAsset(resourcePath + "images/1.0/help/allup_symbols.jpg"),
                    continuehighlight: new asset.ImageAsset(resourcePath + "images/1.0/continuehighlight.png"),
                    goldcoinFeatureBg: new asset.ImageAsset(resourcePath + "images/1.0/goldcoinFeatureBg.png"),
                    miniicon: new asset.ImageAsset(resourcePath + "images/1.0/miniicon.png"),
                    majoricon: new asset.ImageAsset(resourcePath + "images/1.0/majoricon.png"),
                    minoricon: new asset.ImageAsset(resourcePath + "images/1.0/minoricon.png"),
                    grandicon: new asset.ImageAsset(resourcePath + "images/1.0/grandicon.png"),
                    miniglow: new asset.ImageAsset(resourcePath + "images/1.0/miniglow.png"),
                    majorglow: new asset.ImageAsset(resourcePath + "images/1.0/majorglow.png"),
                    minorglow: new asset.ImageAsset(resourcePath + "images/1.0/minorglow.png"),
                    grandglow: new asset.ImageAsset(resourcePath + "images/1.0/grandglow.png"),
                    minijackpotbanner: new asset.ImageAsset(resourcePath + "images/1.0/" + isNt + "minijackpotbanner.png"),
                    minorjackpotbanner: new asset.ImageAsset(resourcePath + "images/1.0/" + isNt + "minorjackpotbanner.png"),
                    majorjackpotbanner: new asset.ImageAsset(resourcePath + "images/1.0/" + isNt + "majorjackpotbanner.png"),
                    grandjackpotbanner: new asset.ImageAsset(resourcePath + "images/1.0/" + isNt + "grandjackpotbanner.png"),
                    coingoldanim: new asset.ImageAsset(resourcePath + "atlas/coingold" + assetResolution + "coingold.json", resourcePath + "atlas/coingold" + assetResolution + "coingold-packed.png"),
                    bowlcloseanim: new asset.ImageAsset(resourcePath + "atlas/bowlclose" + assetResolution + "bowlclose.json", resourcePath + "atlas/bowlclose" + assetResolution + "bowlclose-packed.png"),
                    bowlshakeanim: new asset.ImageAsset(resourcePath + "atlas/bowlshake" + assetResolution + "bowlshake.json", resourcePath + "atlas/bowlshake" + assetResolution + "bowlshake-packed.png"),
                    bowlexplodeanim: new asset.ImageAsset(resourcePath + "atlas/bowlexplode" + assetResolution + "bowlexplode.json", resourcePath + "atlas/bowlexplode" + assetResolution + "bowlexplode-packed.png"),
                    h1: new asset.ImageAsset(resourcePath + "atlas/h1" + assetResolution + "h1.json", resourcePath + "atlas/h1" + assetResolution + "h1-packed.png"),
                    h2: new asset.ImageAsset(resourcePath + "atlas/h2" + assetResolution + "h2.json", resourcePath + "atlas/h2" + assetResolution + "h2-packed.png"),
                    h3: new asset.ImageAsset(resourcePath + "atlas/h3" + assetResolution + "h3.json", resourcePath + "atlas/h3" + assetResolution + "h3-packed.png"),
                    h4: new asset.ImageAsset(resourcePath + "atlas/h4" + assetResolution + "h4.json", resourcePath + "atlas/h4" + assetResolution + "h4-packed.png"),
                    h5: new asset.ImageAsset(resourcePath + "atlas/h5" + assetResolution + "h5.json", resourcePath + "atlas/h5" + assetResolution + "h5-packed.png"),
                    m1: new asset.ImageAsset(resourcePath + "atlas/m1" + assetResolution + "m1.json", resourcePath + "atlas/m1" + assetResolution + "m1-packed.png"),
                    m2: new asset.ImageAsset(resourcePath + "atlas/m2" + assetResolution + "m2.json", resourcePath + "atlas/m2" + assetResolution + "m2-packed.png"),
                    m3: new asset.ImageAsset(resourcePath + "atlas/m3" + assetResolution + "m3.json", resourcePath + "atlas/m3" + assetResolution + "m3-packed.png"),
                    m4: new asset.ImageAsset(resourcePath + "atlas/m4" + assetResolution + "m4.json", resourcePath + "atlas/m4" + assetResolution + "m4-packed.png"),
                    m5: new asset.ImageAsset(resourcePath + "atlas/m5" + assetResolution + "m5.json", resourcePath + "atlas/m5" + assetResolution + "m5-packed.png"),
                    l1: new asset.ImageAsset(resourcePath + "atlas/l1" + assetResolution + "l1.json", resourcePath + "atlas/l1" + assetResolution + "l1-packed.png"),
                    l2: new asset.ImageAsset(resourcePath + "atlas/l2" + assetResolution + "l2.json", resourcePath + "atlas/l2" + assetResolution + "l2-packed.png"),
                    l3: new asset.ImageAsset(resourcePath + "atlas/l3" + assetResolution + "l3.json", resourcePath + "atlas/l3" + assetResolution + "l3-packed.png"),
                    l4: new asset.ImageAsset(resourcePath + "atlas/l4" + assetResolution + "l4.json", resourcePath + "atlas/l4" + assetResolution + "l4-packed.png"),
                    l5: new asset.ImageAsset(resourcePath + "atlas/l5" + assetResolution + "l5.json", resourcePath + "atlas/l5" + assetResolution + "l5-packed.png"),
                    wild: new asset.ImageAsset(resourcePath + "atlas/wild" + assetResolution + "wild.json", resourcePath + "atlas/wild" + assetResolution + "wild-packed.png"),
                    z_bonus: new asset.ImageAsset(resourcePath + "atlas/z_bonus" + assetResolution + "z_bonus.json", resourcePath + "atlas/z_bonus" + assetResolution + "z_bonus-packed.png")
                };
            }
            else {
                this.baseBundle = {
                    background: new asset.ImageAsset(resourcePath + "images/0.49/" + isNt + "background.png"),
                    symbols: new asset.ImageAsset(resourcePath + "atlas/symbols" + assetResolution + "symbols.json", resourcePath + "atlas/symbols" + assetResolution + "symbols-packed.png"),
                    dropShadow: new asset.ImageAsset(resourcePath + "images/0.49/dropshadow.png"),
                    reelFrame: new asset.ImageAsset(resourcePath + "images/0.49/reelframe.png"),
                    winstack: new asset.ImageAsset(resourcePath + "images/0.49/winstack.png"),
                    logo: new asset.ImageAsset(resourcePath + "images/0.49/logo.png"),
                    translations: new asset.JSONAsset(resourcePath + "translations/translations_" + language + ".json"),
                    spinButton: new asset.ImageAsset(resourcePath + "images/0.49/spinbutton.png"),
                    spinButtonDisable: new asset.ImageAsset(resourcePath + "images/0.49/spinbuttondisable.png"),
                    settingsButton: new asset.ImageAsset(resourcePath + "images/0.49/settingsbutton.png"),
                    setButtonDisable: new asset.ImageAsset(resourcePath + "images/0.49/setbuttondisable.png"),
                    helpButtonDisable: new asset.ImageAsset(resourcePath + "images/0.49/helpbuttondisable.png"),
                    autoPlayIcon: new asset.ImageAsset(resourcePath + "images/0.49/autoplay.png"),
                    autoPlayIconDisable: new asset.ImageAsset(resourcePath + "images/0.49/autoplaydisable.png"),
                    autoPlayMenu: new asset.ImageAsset(resourcePath + "images/0.49/autoplaymenu.png"),
                    betMenu: new asset.ImageAsset(resourcePath + "images/0.49/betmenu.png"),
                    autoPlayIconBox: new asset.ImageAsset(resourcePath + "images/0.49/autoplayiconbox.png"),
                    autoPlaySpinButton: new asset.ImageAsset(resourcePath + "images/0.49/autoplayspinbutton.png"),
                    autoPlayStopButton: new asset.ImageAsset(resourcePath + "images/0.49/autoplaystopbutton.png"),
                    helpAnywaysHeader: new asset.ImageAsset(resourcePath + "images/0.49/anywayTM.png"),
                    helpAnywaysWaysGrid: new asset.ImageAsset(resourcePath + "images/0.49/ways.png"),
                    helpComboSample: new asset.ImageAsset(resourcePath + "images/0.49/ComboSample.png"),
                    settingsMenuBar: new asset.ImageAsset(resourcePath + "images/0.49/settingsmenubar.png"),
                    myriadProSemiBold: new asset.FontAsset(resourcePath + "fonts/MyriadPro-Semibold.otf"),
                    myriadProBold: new asset.FontAsset(resourcePath + "fonts/MyriadPro-Bold.otf"),
                    winMeterBackground: new asset.ImageAsset(resourcePath + "images/0.49/winmeterbackground.png"),
                    helpbutton: new asset.ImageAsset(resourcePath + "images/0.49/helpbutton.png"),
                    shelpbutton: new asset.ImageAsset(resourcePath + "images/0.49/shelpbutton.png"),
                    stakemtr: new asset.ImageAsset(resourcePath + "images/0.49/stakemtr.png"),
                    stakemtrDisable: new asset.ImageAsset(resourcePath + "images/0.49/stakemtrdisable.png"),
                    multipliermeter: new asset.ImageAsset(resourcePath + "images/0.49/multipliermeter.png"),
                    bowl: new asset.ImageAsset(resourcePath + "images/0.49/bowl.png"),
                    bowl1: new asset.ImageAsset(resourcePath + "images/0.49/bowl1.png"),
                    bowl2: new asset.ImageAsset(resourcePath + "images/0.49/bowl2.png"),
                    bowl3: new asset.ImageAsset(resourcePath + "images/0.49/bowl3.png"),
                    ext_help: new asset.ImageAsset(resourcePath + "images/0.49/ext_help.png"),
                    mini: new asset.ImageAsset(resourcePath + "images/0.49/minilock.png"),
                    minor: new asset.ImageAsset(resourcePath + "images/0.49/minorlock.png"),
                    major: new asset.ImageAsset(resourcePath + "images/0.49/majorlock.png"),
                    grand: new asset.ImageAsset(resourcePath + "images/0.49/grandlock.png"),
                    balance: new asset.ImageAsset(resourcePath + "images/0.49/balance.png"),
                    stake: new asset.ImageAsset(resourcePath + "images/0.49/stake.png"),
                    win: new asset.ImageAsset(resourcePath + "images/0.49/win.png"),
                    setbutton: new asset.ImageAsset(resourcePath + "images/0.49/setbutton.png"),
                    ssetbutton: new asset.ImageAsset(resourcePath + "images/0.49/ssetbutton.png"),
                    coin: new asset.ImageAsset(resourcePath + "images/0.49/coin.png"),
                    autoplay: new asset.ImageAsset(resourcePath + "images/0.49/autoplay.png"),
                    betminus: new asset.ImageAsset(resourcePath + "images/0.49/betminus.png"),
                    betplus: new asset.ImageAsset(resourcePath + "images/0.49/betplus.png"),
                    betminusDisable: new asset.ImageAsset(resourcePath + "images/0.49/betminusdisable.png"),
                    betplusDisable: new asset.ImageAsset(resourcePath + "images/0.49/betplusdisable.png"),
                    creditswindow: new asset.ImageAsset(resourcePath + "images/0.49/creditswindow.png"),
                    creditsselected: new asset.ImageAsset(resourcePath + "images/0.49/creditsselected.png"),
                    creditsSelectedDisable: new asset.ImageAsset(resourcePath + "images/0.49/creditsselecteddisable.png"),
                    coingold: new asset.ImageAsset(resourcePath + "images/0.49/coingold.png"),
                    turtle: new asset.ImageAsset(resourcePath + "images/0.49/turtle.png"),
                    turtlegold: new asset.ImageAsset(resourcePath + "images/0.49/turtlegold.png"),
                    junk: new asset.ImageAsset(resourcePath + "images/0.49/junk.png"),
                    junkgold: new asset.ImageAsset(resourcePath + "images/0.49/junkgold.png"),
                    phoenix: new asset.ImageAsset(resourcePath + "images/0.49/phoenix.png"),
                    phoenixgold: new asset.ImageAsset(resourcePath + "images/0.49/phoenixgold.png"),
                    ingot: new asset.ImageAsset(resourcePath + "images/0.49/ingot.png"),
                    ingotgold: new asset.ImageAsset(resourcePath + "images/0.49/ingotgold.png"),
                    allup: new asset.ImageAsset(resourcePath + "images/0.49/allup.png"),
                    helpcoingold: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helpcoingold.png"),
                    helpingotgold: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helpingotgold.png"),
                    helppheonixgold: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helppheonixgold.png"),
                    helpjunkgold: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helpjunkgold.png"),
                    helpturtlegold: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helpturtlegold.png"),
                    helpturtle: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helpturtle.png"),
                    helpingot: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helpingot.png"),
                    helpjunk: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helpjunk.png"),
                    helppheonix: new asset.ImageAsset(resourcePath + "images/0.49/helpfu/helppheonix.png"),
                    anyway: new asset.ImageAsset(resourcePath + "images/0.49/help/anyway.jpg"),
                    wildimage: new asset.ImageAsset(resourcePath + "images/0.49/help/wild.png"),
                    helpbtn: new asset.ImageAsset(resourcePath + "images/0.49/help/btn.png"),
                    helpexit: new asset.ImageAsset(resourcePath + "images/0.49/help/exit_btn.png"),
                    tally: new asset.ImageAsset(resourcePath + "images/0.49/tally.png"),
                    flybats: new asset.ImageAsset(resourcePath + "atlas/flybats" + assetResolution + "flybats.json", resourcePath + "atlas/flybats" + assetResolution + "flybats-packed.png"),
                    LandingScreen: new asset.ImageAsset(resourcePath + "images/0.49/" + isNt + "LandingScreen.jpg"),
                    gameLogo: new asset.ImageAsset(resourcePath + "images/0.49/fglogo.png"),
                    activeframehighlight: new asset.ImageAsset(resourcePath + "images/0.49/activeframehighlight.png"),
                    symbolhighlight: new asset.ImageAsset(resourcePath + "images/0.49/activehighlight.png"),
                    ssetbuttondisable: new asset.ImageAsset(resourcePath + "images/0.49/ssetbuttondisable.png"),
                    shelpbuttondisable: new asset.ImageAsset(resourcePath + "images/0.49/shelpbuttondisable.png"),
                    helpAllUp: new asset.ImageAsset(resourcePath + "images/0.49/help/allup_symbols.jpg"),
                    continuehighlight: new asset.ImageAsset(resourcePath + "images/0.49/continuehighlight.png"),
                    goldcoinFeatureBg: new asset.ImageAsset(resourcePath + "images/0.49/goldcoinFeatureBg.png"),
                    miniicon: new asset.ImageAsset(resourcePath + "images/0.49/miniicon.png"),
                    majoricon: new asset.ImageAsset(resourcePath + "images/0.49/majoricon.png"),
                    minoricon: new asset.ImageAsset(resourcePath + "images/0.49/minoricon.png"),
                    grandicon: new asset.ImageAsset(resourcePath + "images/0.49/grandicon.png"),
                    miniglow: new asset.ImageAsset(resourcePath + "images/0.49/miniglow.png"),
                    majorglow: new asset.ImageAsset(resourcePath + "images/0.49/majorglow.png"),
                    minorglow: new asset.ImageAsset(resourcePath + "images/0.49/minorglow.png"),
                    grandglow: new asset.ImageAsset(resourcePath + "images/0.49/grandglow.png"),
                    minijackpotbanner: new asset.ImageAsset(resourcePath + "images/0.49/" + isNt + "minijackpotbanner.png"),
                    minorjackpotbanner: new asset.ImageAsset(resourcePath + "images/0.49/" + isNt + "minorjackpotbanner.png"),
                    majorjackpotbanner: new asset.ImageAsset(resourcePath + "images/0.49/" + isNt + "majorjackpotbanner.png"),
                    grandjackpotbanner: new asset.ImageAsset(resourcePath + "images/0.49/" + isNt + "grandjackpotbanner.png"),
                    coingoldanim: new asset.ImageAsset(resourcePath + "atlas/coingold" + assetResolution + "coingold.json", resourcePath + "atlas/coingold" + assetResolution + "coingold-packed.png"),
                    bowlcloseanim: new asset.ImageAsset(resourcePath + "atlas/bowlclose" + assetResolution + "bowlclose.json", resourcePath + "atlas/bowlclose" + assetResolution + "bowlclose-packed.png"),
                    bowlshakeanim: new asset.ImageAsset(resourcePath + "atlas/bowlshake" + assetResolution + "bowlshake.json", resourcePath + "atlas/bowlshake" + assetResolution + "bowlshake-packed.png"),
                    bowlexplodeanim: new asset.ImageAsset(resourcePath + "atlas/bowlexplode" + assetResolution + "bowlexplode.json", resourcePath + "atlas/bowlexplode" + assetResolution + "bowlexplode-packed.png"),
                    h1: new asset.ImageAsset(resourcePath + "atlas/h1" + assetResolution + "h1.json", resourcePath + "atlas/h1" + assetResolution + "h1-packed.png"),
                    h2: new asset.ImageAsset(resourcePath + "atlas/h2" + assetResolution + "h2.json", resourcePath + "atlas/h2" + assetResolution + "h2-packed.png"),
                    h3: new asset.ImageAsset(resourcePath + "atlas/h3" + assetResolution + "h3.json", resourcePath + "atlas/h3" + assetResolution + "h3-packed.png"),
                    h4: new asset.ImageAsset(resourcePath + "atlas/h4" + assetResolution + "h4.json", resourcePath + "atlas/h4" + assetResolution + "h4-packed.png"),
                    h5: new asset.ImageAsset(resourcePath + "atlas/h5" + assetResolution + "h5.json", resourcePath + "atlas/h5" + assetResolution + "h5-packed.png"),
                    m1: new asset.ImageAsset(resourcePath + "atlas/m1" + assetResolution + "m1.json", resourcePath + "atlas/m1" + assetResolution + "m1-packed.png"),
                    m2: new asset.ImageAsset(resourcePath + "atlas/m2" + assetResolution + "m2.json", resourcePath + "atlas/m2" + assetResolution + "m2-packed.png"),
                    m3: new asset.ImageAsset(resourcePath + "atlas/m3" + assetResolution + "m3.json", resourcePath + "atlas/m3" + assetResolution + "m3-packed.png"),
                    m4: new asset.ImageAsset(resourcePath + "atlas/m4" + assetResolution + "m4.json", resourcePath + "atlas/m4" + assetResolution + "m4-packed.png"),
                    m5: new asset.ImageAsset(resourcePath + "atlas/m5" + assetResolution + "m5.json", resourcePath + "atlas/m5" + assetResolution + "m5-packed.png"),
                    l1: new asset.ImageAsset(resourcePath + "atlas/l1" + assetResolution + "l1.json", resourcePath + "atlas/l1" + assetResolution + "l1-packed.png"),
                    l2: new asset.ImageAsset(resourcePath + "atlas/l2" + assetResolution + "l2.json", resourcePath + "atlas/l2" + assetResolution + "l2-packed.png"),
                    l3: new asset.ImageAsset(resourcePath + "atlas/l3" + assetResolution + "l3.json", resourcePath + "atlas/l3" + assetResolution + "l3-packed.png"),
                    l4: new asset.ImageAsset(resourcePath + "atlas/l4" + assetResolution + "l4.json", resourcePath + "atlas/l4" + assetResolution + "l4-packed.png"),
                    l5: new asset.ImageAsset(resourcePath + "atlas/l5" + assetResolution + "l5.json", resourcePath + "atlas/l5" + assetResolution + "l5-packed.png"),
                    wild: new asset.ImageAsset(resourcePath + "atlas/wild" + assetResolution + "wild.json", resourcePath + "atlas/wild" + assetResolution + "wild-packed.png"),
                    z_bonus: new asset.ImageAsset(resourcePath + "atlas/z_bonus" + assetResolution + "z_bonus.json", resourcePath + "atlas/z_bonus" + assetResolution + "z_bonus-packed.png")
                };
            }
            this.audioBundle = {
                winLessThanBet: new asset.AudioAsset(resourcePath + "audio/winLessThanBet.m4a"),
                reelStop: new asset.AudioAsset(resourcePath + "audio/RC_REEL_STOP.m4a"),
                backgroundMusic: new asset.AudioAsset(resourcePath + "audio/EEFBasegameRe_96_48085.m4a"),
                bonusEnd: new asset.AudioAsset(resourcePath + "audio/EEF-BonusEnd.m4a"),
                bonusIntro: new asset.AudioAsset(resourcePath + "audio/EEF-BonusIntroLoop_96_5422.m4a"),
                bonusDoor: new asset.AudioAsset(resourcePath + "audio/EEF_Doors.m4a"),
                baseGameBangup: new asset.AudioAsset(resourcePath + "audio/EEF_Basegame_Bangup_Loop_96_2093.m4a"),
                baseGameBangupEnd: new asset.AudioAsset(resourcePath + "audio/EEF_Basegame_Bangup_End.m4a"),
                trigger1: new asset.AudioAsset(resourcePath + "audio/Gong_Trig_1.m4a"),
                trigger2: new asset.AudioAsset(resourcePath + "audio/Gong_Trig_2.m4a"),
                trigger3: new asset.AudioAsset(resourcePath + "audio/Gong_Trig_3.m4a"),
                trigger4: new asset.AudioAsset(resourcePath + "audio/Gong_Trig_4.m4a"),
                trigger5: new asset.AudioAsset(resourcePath + "audio/Gong_Trig_5.m4a"),
                bigWinShort: new asset.AudioAsset(resourcePath + "audio/Big_win1.m4a"),
                bigWinShortEnd: new asset.AudioAsset(resourcePath + "audio/EEF_Basegame_Bangup_End.m4a"),
                bigWinLong: new asset.AudioAsset(resourcePath + "audio/Big_win2.m4a"),
                bigWinLongEnd: new asset.AudioAsset(resourcePath + "audio/EEF_Basegame_Bangup_End.m4a"),
                bonusGameMusicLoop: new asset.AudioAsset(resourcePath + "audio/EEF_Bonus_loop_96_42761.m4a"),
                bonusTriggered: new asset.AudioAsset(resourcePath + "audio/EEF_BonusTriggered.m4a"),
                miniJackpot: new asset.AudioAsset(resourcePath + "audio/Mini_Jackpot.m4a"),
                minorJackpot: new asset.AudioAsset(resourcePath + "audio/Minor_Jackpot.m4a"),
                majorJackpot: new asset.AudioAsset(resourcePath + "audio/Major_Jackpot.m4a"),
                grandJackpot: new asset.AudioAsset(resourcePath + "audio/Grand_Jackpot.m4a"),
                coinPick: new asset.AudioAsset(resourcePath + "audio/Coin_Pick.m4a"),
                buttonClick: new asset.AudioAsset(resourcePath + "audio/bet.m4a"),
                batFlying: new asset.AudioAsset(resourcePath + "audio/bat_flying.m4a"),
                fubatLoop: new asset.AudioAsset(resourcePath + "audio/coins_feature_sound_96_29536.m4a"),
                lidClosing: new asset.AudioAsset(resourcePath + "audio/lid_closing.m4a"),
                coinBurst: new asset.AudioAsset(resourcePath + "audio/coin_burst.m4a"),
                jackpotHit: new asset.AudioAsset(resourcePath + "audio/jackpot_hit.m4a"),
            };
            if (this.scalar == 1) {
                this.freeSpinBundle = {
                    rightDoor: new asset.ImageAsset(resourcePath + "images/1.0/fsdoor_right.jpg"),
                    leftDoor: new asset.ImageAsset(resourcePath + "images/1.0/fsdoor_left.jpg"),
                    background: new asset.ImageAsset(resourcePath + "images/1.0/fs_background.png"),
                    tally: new asset.ImageAsset(resourcePath + "images/1.0/tally.png")
                };
                this.bigWinBundle = {
                    marquee: new asset.ImageAsset(resourcePath + "images/1.0/bigwinmarquee.png"),
                    coins: new asset.ImageAsset(resourcePath + "atlas/coins" + assetResolution + "coins.json", resourcePath + "atlas/coins" + assetResolution + "coins-packed.png"),
                    glow: new asset.ImageAsset(resourcePath + "atlas/glow" + assetResolution + "glow.json", resourcePath + "atlas/glow" + assetResolution + "glow-packed.png")
                };
            }
            else {
                this.freeSpinBundle = {
                    rightDoor: new asset.ImageAsset(resourcePath + "images/0.49/fsdoor_right.jpg"),
                    leftDoor: new asset.ImageAsset(resourcePath + "images/0.49/fsdoor_left.jpg"),
                    background: new asset.ImageAsset(resourcePath + "images/0.49/fs_background.png"),
                    tally: new asset.ImageAsset(resourcePath + "images/0.49/tally.png")
                };
                this.bigWinBundle = {
                    marquee: new asset.ImageAsset(resourcePath + "images/0.49/bigwinmarquee.png"),
                    coins: new asset.ImageAsset(resourcePath + "atlas/coins" + assetResolution + "coins.json", resourcePath + "atlas/coins" + assetResolution + "coins-packed.png"),
                    glow: new asset.ImageAsset(resourcePath + "atlas/glow" + assetResolution + "glow.json", resourcePath + "atlas/glow" + assetResolution + "glow-packed.png")
                };
            }
            this.loader = new asset.AssetLoader();
            this.loader.getEvents().add({
                onStarted: null,
                onProgress: function (id, stageProgress, totalProgress) {
                    _this.partnerAdapter.updatedLoadingProgress(Math.min(1, stageProgress));
                },
                onComplete: function (id, allComplete) {
                    switch (id) {
                        case 0:
                            _this.loadSounds();
                            break;
                    }
                },
                onError: null
            });
            this.loader.addStage(this.baseBundle);
            this.loader.run();
            var canvas = this.scene.getCanvas();
            this.inputHandler = new input.InputHandler(canvas.getCanvas(), false, true);
            this.inputHandler.setCoordinateScalar(canvas.getResponsiveScaleX(), canvas.getResponsiveScaleY());
            this.metaData = metaData;
            this.audioController = new AudioController(metaData.getWebaudio(), this.audioBundle);
        }
        /**
         * load all base game sounds
         * @method Main#loadSounds
         * @private
         */
        Main.prototype.loadSounds = function () {
            var _this = this;
            this.audioController.getEvents().add({
                onBaseGameSoundsLoaded: function () {
                    _this.onSoundsLoaded();
                }
            });
            this.audioController.loadBaseGameSounds();
        };
        Main.prototype.onSoundsLoaded = function () {
            this.createUI();
            if (this.isHistoryReplay()) {
                this.startHistoryReplay();
            }
            else {
                this.glsRequestor.makeInitRequest();
            }
        };
        Main.prototype.createUI = function () {
            this.translator = new locale.Translator(this.baseBundle.translations.getPayload());
            util.ErrorReporter.setTranslator(this.translator);
            this.background = UIFactory.createBackground(this.scene, this.scalar, this.baseBundle.background);
            this.uiController = UIFactory.create(this.scene, this.background, this.scalar, this.baseBundle, this.translator, this.glsRequestor, this.currencyFormatter, this.inputHandler, this.audioController, this.partnerAdapter.getGameDomElement(), this.metaData, this.partnerListener);
            if (this.metaData.isDemoEnabled()) {
                this.uiController.createDemoMenu(this.scene, this.inputHandler, this.scalar, this.deviceContext);
            }
        };
        /**
         * Construct display elements
         * @method eef.Main#loadGame
         * @private
         * @param {glscomms.InitResponse} response Game initialization data
         * @param {boolean} isRecovering True if the game is recovering
         */
        Main.prototype.loadGame = function (response, isRecovering) {
            var _this = this;
            var gameData = response.getGameData();
            //var reelGroupData: gamedata.ReelGroupData = gameData.getReelGroup(0);
            var betConfig = response.getGameData().getBetConfiguration();
            var platformData = response.getPlatformData();
            var betController = new BetController(betConfig.getAvailableBets(), betConfig.getDefaultIndex(), betConfig.getMultiplierBets(), betConfig.getDefaultMultiplierIndex(), this.audioController, platformData.getMinBet(), platformData.getMaxBet());
            var multiReelSet = [gameData.getReelGroup(0), gameData.getReelGroup(1), gameData.getReelGroup(2), gameData.getReelGroup(3), gameData.getReelGroup(4), gameData.getReelGroup(5), gameData.getReelGroup(6), gameData.getReelGroup(7), gameData.getReelGroup(8), gameData.getReelGroup(9)];
            var slot = SlotFactory.createSlot(this.scene, this.scalar, this.baseBundle, multiReelSet, this.audioController, this.translator, this.currencyFormatter, this.background, this.inputHandler, this.metaData.isGaffingEnabled(), this.uiController, betController, this.metaData);
            var bigWinController = new BigWinController(this.scene, this.scalar, this.audioController, this.currencyFormatter, this.bigWinBundle, this.baseBundle.myriadProSemiBold);
            slot.getWinDisplayController().getBangController().setBigWinController(bigWinController);
            this.logic = new Logic(this.partnerAdapter, this.loader, this.glsRequestor, this.uiController, betConfig);
            this.logic.setSlot(slot);
            var freeSpin = new FreeSpin(slot, this.freeSpinBundle, this.baseBundle, this.scene, this.scalar, this.background, this.currencyFormatter, this.inputHandler, this.translator, this.partnerAdapter, this.uiController, this.deviceContext, this.audioController);
            this.logic.setFreeSpin(freeSpin);
            this.uiController.setLogic(this.logic);
            slot.getWinDisplayController().getBangController().getEvents().add({
                onStart: null,
                onComplete: function () {
                    _this.uiController.handleBangupComplete();
                }
            });
            this.uiController.setBetController(betController);
            //OLG Balance update 
            /*var _partnerAdapterREf: any;
            if(this.partnerAdapter.delegate!=undefined){
                _partnerAdapterREf = this.partnerAdapter.delegate;
            }else{
                _partnerAdapterREf = this.partnerAdapter;
            }*/
            var _balanceListener = new BalanceListener(this.partnerBalanceService, this.uiController, this.metaData);
            if (this.partnerAdapter.addBalanceUpdateListener) {
                this.partnerAdapter.addBalanceUpdateListener(_balanceListener);
            }
            EEFConfig.IDLE_STATE = true;
            //End OLG Balance update 
            // Autoplay 
            var currentBalance = response.getBalance();
            var currentTotalStake = (betController.getCurrentBet().getTotalBet() * betController.getCurrentMultiplier().getMultiplier());
            this.initToPartnerAutoplay(currentBalance, currentTotalStake);
            //
            if (isRecovering) {
                var createData = {
                    glsRequestor: this.glsRequestor,
                    logic: this.logic,
                    slot: slot,
                    uiController: this.uiController,
                    betController: betController,
                    partnerAdapter: this.partnerAdapter,
                    translator: this.translator,
                    background: this.background,
                    freeSpinBackground: new abg2d.SpriteSheet(this.freeSpinBundle.background, this.scalar)
                };
                var recovery = new RecoveryManager(createData);
                EEFConfig.IDLE_STATE = false;
            }
            else if (this.isHistoryReplay()) {
                //this.startHistoryReplay();            
                this.uiController.startHistoryReplay(this.historyData);
                this.sendingRePlayRequest(betController);
            }
            else {
                this.partnerAdapter.hideProgressBar();
            }
        };
        Main.prototype.startHistoryReplay = function () {
            var _this = this;
            var url = this.url.querydata['HistoryServerURL'];
            var betID = this.url.querydata['betID'];
            this.historyData = new HistoryStack(url, betID);
            this.historyData.getEventDispatcher().add({
                onHistoryDataLoaded: function () {
                    _this.sendHistoryInitRequest();
                },
                onHistoryPlayLoaded: function (playResponse) {
                    _this.onHistoryDataLoaded(playResponse);
                }
            });
            this.historyData.loadHistoryData();
        };
        Main.prototype.sendHistoryInitRequest = function () {
            var payloads = [];
            payloads.push(new glscomms.ReplayRequestPayload(this.historyData.getHistoryData()));
            this.glsRequestor.makeInitRequest(payloads);
        };
        Main.prototype.onInitResponse = function (response) {
            var platformData = response.getPlatformData();
            var cf = platformData.getCurrencyFormat();
            // PartnerAdapter Call  
            var requestObject = this.glsRequestor.getRequestObject();
            this.partnerAdapter.receivedGameLogicResponse(requestObject);
            //
            this.partnerAdapter.logics.currencyFormatter.setFormatting(cf.name, cf.symbol, cf.grouping, cf.groupingSeparator, cf.fractionalDigits, cf.fractionalSeparator, cf.currencyCodeBeforeAmount, cf.currencyCodeSpacing, cf.currencySymbolBeforeAmount, cf.currencySymbolSpacing);
            this.currencyFormatter.setData(cf);
            this.glsRequestor.configure(platformData);
            this.loadGame(response, platformData.getIsRecovering());
            this.uiController.setBetMultiplier(platformData.getCurrencyMultiplier());
            //Open Bet new API 
            var balance = response.getBalance();
            if (this.partnerListener != undefined) {
                if (this.partnerListener.gamePlayEventListener) {
                    var openBetCash = balance;
                    var openBetFreeBet = 0;
                    if (response.getGameData().getCustomData() != undefined) {
                        if (response.getGameData().getCustomData().getOpenBetPayLoadInfo() != undefined && response.getGameData().getCustomData().getOpenBetPayLoadInfo()[EEFConfig.INIT]) {
                            openBetCash = response.getGameData().getCustomData().getOpenBetPayLoadInfo()[EEFConfig.INIT].CASH;
                            openBetFreeBet = response.getGameData().getCustomData().getOpenBetPayLoadInfo()[EEFConfig.INIT].FREEBET;
                        }
                    }
                    if (platformData.getIsRecovering() == true) {
                        openBetCash = openBetFreeBet = balance = 0;
                    }
                    this.partnerListener.gamePlayEventListener.handleGameInitializedEvent({
                        "isResumeGame": platformData.getIsRecovering(),
                        "CASH": openBetCash,
                        "FREEBET": openBetFreeBet,
                        "balanceAmount": balance
                    });
                }
            }
        };
        /**
        * While loading the Game checking the history replay or not
        * @method eightyeightfortunes.Main#isHistoryReplay
        * @private
        * param {boolean} return value true/false.
        */
        Main.prototype.isHistoryReplay = function () {
            return (this.url.querydata['HistoryServerURL'] != null) ? true : false;
        };
        Main.prototype.onHistoryDataLoaded = function (playResponse) {
            //this.uiController.setHistoryReplay();
            this.logic.setHistoryReplay(this.historyData, playResponse);
            this.partnerAdapter.hideProgressBar();
        };
        Main.prototype.sendingRePlayRequest = function (betController) {
            this.historyData.configure(this.logic, betController, this.glsRequestor);
            this.historyData.setBetData();
            this.logic.setLastWager(betController.getCurrentBet());
            this.historyData.sendPlayRequest();
        };
        /*
        * Reset the game to replayable state.
        * Implementations should stop all game animations, ie. Stop spinning reels and reset the game to
        * a state where a new game can be started.
        * This is called if there is some condition where the current game is aborted, but a new one
        * can be started. For example, if the current wager fails due to insufficient funds, then
        * the player may make a deposit and try again.
        */
        Main.prototype.resetHard = function () {
            if (this.logic != null) {
                this.logic.resetHard();
            }
        };
        /**
        * The partner adapter will call this method to inform the game that it should set the ingame wager amount, including UI elements..
        * @param betPerUnit number This is the bet per line in a slot game.
        * @param units number This is the number of lines in a slot game.
        * @param boolean lockUI When true
        */
        Main.prototype.setBet = function (betPerUnit, units, lockUI) {
            if (!this.logic.getFreeSpin().isActive) {
                this.uiController.setCanUpdateBalance(true);
            }
            this.stopAutoPlay();
            this.uiController.lockUI(lockUI);
            this.uiController.toggleSpinButton(!lockUI);
            this.uiController.setBet(betPerUnit, units, lockUI);
            this.partnerAdapter.updateBet(this.uiController.getBet().getTotalBet());
        };
        /**
        * Init callBack to partner adapter to check the Autoplay
        * @method eightyeightfortunes.Main#initToPartnerAutoplay
        * @private
        * param {boolean} (Balance, totalstake, return value true/false)
        */
        Main.prototype.initToPartnerAutoplay = function (currentBalance, currentTotalStake) {
            var _this = this;
            try {
                this.partnerAdapter.partnerAutoplayManager.initPartnerAutoplay(currentTotalStake, currentBalance, function (checked) {
                    _this.uiController.setAutoPlay(checked);
                });
            }
            catch (error) {
                this.uiController.setAutoPlay(false);
                console.log("Autoplay is not Avaliable");
            }
        };
        /**
        * Stop Autoplay call from the partneradapter
        * @method eightyeightfortunes.Main#stopAutoPlay
        * @Public
        * param {}
        */
        Main.prototype.startAutoPlay = function (autoPlayCount) {
            this.uiController.startAutoPlay(autoPlayCount);
        };
        /**
        * Stop Autoplay call from the partneradapter
        * @method eightyeightfortunes.Main#stopAutoPlay
        * @Public
        * param {}
        */
        Main.prototype.stopAutoPlay = function () {
            this.uiController.stopAutoPlay();
        };
        Main.prototype.play = function (requestHeaders) {
            this.uiController.play(requestHeaders);
        };
        Main.prototype.checkLang = function (str) {
            for (var index = 0; index < EEFConfig.LANGUAGE_CODES.length; index++) {
                if (str == EEFConfig.LANGUAGE_CODES[index].substr(0, 2))
                    break;
            }
            return index;
        };
        /**
        * Returns CDN root url
        */
        Main.prototype.getCDNRoot = function () {
            var cdnRoot = "";
            if (!this.ignoreCDN()) {
                cdnRoot = this.metaData.getCdnRoot();
                cdnRoot += "/";
            }
            return cdnRoot;
        };
        Main.prototype.ignoreCDN = function () {
            var ignoreCDN = false;
            if (this.url.querydata['CDN'] != null) {
                ignoreCDN = !(this.url.querydata['CDN'] == "true");
            }
            return ignoreCDN;
        };
        Main.prototype.resumeGame = function () {
            if (this.stage_pause) {
                for (var i = 0; i < this.runningAnimation.length; i++) {
                    if (this.runningAnimation[i].paused()) {
                        this.runningAnimation[i].resume();
                    }
                }
                this.stage_pause = false;
                this.audioController.toggleSounds(false);
            }
        };
        Main.prototype.pauseGame = function () {
            if (this.stage_pause)
                return;
            var stageAnimations = TweenMax.getAllTweens(true);
            this.runningAnimation = [];
            for (var i = 0; i < stageAnimations.length; i++) {
                if (!stageAnimations[i].paused()) {
                    this.runningAnimation.push(stageAnimations[i]);
                    stageAnimations[i].pause();
                }
            }
            this.stage_pause = true;
            this.audioController.toggleSounds(true);
        };
        Main.prototype.handleFreeRoundsUpdate = function (freeRoundInfo) {
            this.glsRequestor.resetFreeRoundInfo();
            if (freeRoundInfo != undefined) {
                this.glsRequestor.setFreeRoundInfo(freeRoundInfo);
            }
            this.uiController.handleFreeRoundsUpdate(freeRoundInfo);
        };
        Main.prototype.unLockUI = function () {
            this.uiController.unLockUI();
        };
        return Main;
    })();
    exports.Main = Main;
    /**
     * AutoPlay
     * @class eef.AutoPlayMenu
     * @classdesc Encapsulates the funcationality of the auto play submenu
     */
    var AutoPlayMenu = (function () {
        /**
         * @constructor
         */
        function AutoPlayMenu(menu, icons, autoPlayManager, spinButton, inputHandler, autoplaybtn) {
            this.VALUE_BUTTON_START_X = [1700, 1700, 1700, 1700, 1700];
            this.VALUE_BUTTON_END_X = [1250, 1350, 1450, 1550, 1650];
            this.menu = menu;
            this.icons = icons;
            this.autoPlayManager = autoPlayManager;
            this.spinButton = spinButton;
            this.inputHandler = inputHandler;
            this.autoplaybtn = autoplaybtn;
            this.isAutoPlayAllowed = false;
            this.handlersSet = false;
            this.spinsSelected = 0;
            this.menuShowed = false;
            this.autoallowed = true;
        }
        /**
         * Toggles the auto play spin text that sits above the auto play spin button
         * @method eef.AutoPlayMenu#toggleAutoSpinText
         * @public
         * @param {boolean} isVisible True if the text should be shown
         */
        AutoPlayMenu.prototype.toggleAutoSpinText = function (isVisible) {
            this.autoPlayManager.toggleSpinsRemaining(isVisible);
            this.autoPlayManager.stop();
        };
        /**
         * Resets the menu to its default state
         * @method eef.AutoPlayMenu#reset
         * @public
         */
        AutoPlayMenu.prototype.reset = function () {
            this.menuShowed = false;
            this.isAutoPlayAllowed = false;
            this.menu.getTransform().setVisible(false);
            this.spinsSelected = 0;
            this.resetText(false);
        };
        /**
         * Moves the auto play sub menu into positoin
         * @method eef.AutoPlayMenu#move
         * @public
         * @param {number} xPos The position to move to
         * @returns {TweenMax} The create tween
         */
        AutoPlayMenu.prototype.move = function (xPos, duration) {
            var tweens = [];
            var menuTransform = this.menu.getTransform();
            var params = {
                setPositionX: xPos + this.menu.getImage().getWidth() / 2 + 10,
                ease: Power2.easeInOut,
                immediateRender: false
            };
            tweens.push(TweenMax.to(menuTransform, duration, params));
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var image = actor.getImage();
                actor.getTransform().setPositionY(menuTransform.getPositionY() - (image.getHeight() / 2) - 11);
                tweens.push(this.moveIcon(actor, duration, xPos + 35 + ((image.getWidth() + 25) * i)));
            }
            var timeline = new TimelineLite();
            timeline.add(tweens);
            return timeline;
        };
        AutoPlayMenu.prototype.show = function () {
            this.menuTimeline.play(0);
        };
        AutoPlayMenu.prototype.openComplete = function () {
            var that = this;
            //this.menu.getTransform().setVisible(true);
            this.isAutoPlayAllowed = true;
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var transform = actor.getTransform();
                transform.setVisible(true);
                if (!this.handlersSet) {
                    this.setInputHandler(actor, transform.getTranslatedPositionX(), transform.getTranslatedPositionY(), function (index) {
                        return function () {
                            that.toggleAutoPlayIcons(index);
                        };
                    }(i));
                }
            }
            this.handlersSet = true;
        };
        /**
         * Toggles the auto play icons
         * @method eef.AutoPlayMenu#toggleAutoPlayIcons
         * @private
         * @param {number} index The index of the icon to toggle
         */
        AutoPlayMenu.prototype.toggleAutoPlayIcons = function (index) {
            if (this.isAutoPlayAllowed) {
                var actor = this.icons[index];
                var text = actor.getTransform().getChild().getActor().getText();
                var effect = text.getEffect(0);
                var selectedValue = Number(actor.getName());
                if (this.spinsSelected != selectedValue) {
                    this.spinsSelected = selectedValue;
                    this.resetText(true);
                    effect.color = AutoPlayMenu.SELECTED_TEXT_COLOR;
                    this.autoPlayManager.setSpinsRemaining(this.spinsSelected);
                    this.spinButton.showAutoPlay();
                    this.spinButton.setVisible(true);
                }
                else {
                    effect.color = AutoPlayMenu.DEFAULT_TEXT_COLOR;
                    this.autoPlayManager.stop();
                    this.spinsSelected = 0;
                    this.spinButton.setVisible(false);
                    this.spinButton.showDefault();
                }
                text.setDirty();
            }
        };
        AutoPlayMenu.prototype.toggleAutoPlayIcons1 = function () {
            if (this.autoallowed) {
                this.autoallowed = false;
                this.spinsSelected = 10;
                this.autoPlayManager.setSpinsRemaining(this.spinsSelected);
                this.spinButton.showAutoPlay();
                this.spinButton.setVisible(true);
            }
            else {
                this.autoallowed = true;
                this.autoPlayManager.stop();
                this.spinsSelected = 0;
                this.spinButton.showDefault();
            }
        };
        /**
         * Moves an icon into position
         * @method eef.AutoPlayMenu#moveIcon
         * @private
         * @param {abg2d.Actor} actor The actor to move
         * @param {number} duration The duration of the tween
         * @param {number} xPos The x position
         * @returns {TweenMax} The created tween
         */
        AutoPlayMenu.prototype.moveIcon = function (actor, duration, xPos) {
            var transform = actor.getTransform();
            var params = {
                setPositionX: xPos,
                ease: Power2.easeInOut,
                immediateRender: false
            };
            return TweenMax.to(transform, duration, params);
        };
        /**
        * Wires up an input handler for an actor
        * @method eef.BetMenu#setInputHandler
        * @private
        * @param {abg2d.Actor} actor The actor to add input handling to
        * @param {number} xPos The x position of the region
        * @param {number} yPos The y position of the region
        * @param {Function} handler The event to fire when the element is clicked
        */
        AutoPlayMenu.prototype.setInputHandler = function (actor, xPos, yPos, handler) {
            var rect = new abg2d.Rect();
            var image = actor.getImage();
            image.getDrawBounds(rect);
            var transform = actor.getTransform();
            var inputResolver = new input.InputResolver(xPos, yPos, image.getDrawWidth(), image.getDrawHeight());
            abg2d.Factory.composeInputRegion(actor, inputResolver, rect, handler);
            this.inputHandler.addResolver(inputResolver);
        };
        AutoPlayMenu.prototype.addListener = function () {
            var _this = this;
            var autoTransform = this.autoplaybtn.getTransform();
            this.setInputHandler(this.autoplaybtn, autoTransform.getTranslatedPositionX(), autoTransform.getTranslatedPositionY(), function () {
                _this.toggelSubmenu();
            });
        };
        AutoPlayMenu.prototype.toggelSubmenu = function () {
            this.toggleAutoPlayIcons1();
        };
        AutoPlayMenu.prototype.showAutoPlayMenu = function (autoPlayCount) {
            this.autoallowed = false;
            this.spinsSelected = autoPlayCount;
            this.autoPlayManager.setSpinsRemaining(this.spinsSelected);
            this.spinButton.showAutoPlay();
            this.spinButton.setVisible(true);
        };
        AutoPlayMenu.prototype.hideAutoPlayMenu = function () {
            this.menuTimeline.reverse(0);
            this.menuShowed = false;
            this.spinButton.showDefault();
            this.autoPlayManager.stop();
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var transform = actor.getTransform();
                transform.setVisible(false);
            }
        };
        /**
         * Resets the text
         * @method eef.AutoPlayMenu#resetText
         * @private
         * @param {boolean} isVisible True if the text should continue to display
         */
        AutoPlayMenu.prototype.resetText = function (isVisible) {
            var child = null;
            var childText = null;
            var effect = null;
            for (var i = 0; i < this.icons.length; i++) {
                child = this.icons[i].getTransform().getChild().getActor();
                childText = child.getText();
                this.icons[i].getTransform().setVisible(isVisible);
                effect = childText.getEffect(0);
                if (Number(this.icons[i].getName()) != this.spinsSelected) {
                    effect.color = AutoPlayMenu.DEFAULT_TEXT_COLOR;
                }
                childText.setDirty();
            }
        };
        /**
         * Constant value for the default color of the text
         * @member eef.AutoPlayMenu#DEFAULT_TEXT_COLOR
         * @private static
         * @type {string}
         * @default #FFFFFF
         */
        AutoPlayMenu.DEFAULT_TEXT_COLOR = "#FFFFFF";
        /**
         * Constant value for the selected color of the text
         * @member eef.AutoPlayMenu#SELECTED_TEXT_COLOR
         * @private static
         * @type {string}
         * @default #00CBFF
         */
        AutoPlayMenu.SELECTED_TEXT_COLOR = "#00CBFF";
        return AutoPlayMenu;
    })();
    exports.AutoPlayMenu = AutoPlayMenu;
    /**
     * BetMenu
     * @class eef.BetMenu
     * @classdesc Encapsulates the funcationality of the auto play submenu
     */
    var BetMenu = (function () {
        /**
         * @constructor
         */
        function BetMenu(menu, betText, currencyFormatter, inputHandler, MultiplierMenuText, menuPanel, icons, selector, scene, baseBundle, scalar, betText1, creditsMenu, audioController, translator) {
            var _this = this;
            this.isHistoryReplay = false;
            this.VALUE_BUTTON_START_X = [10, 10, 10, 10, 10];
            this.VALUE_BUTTON_END_X = [10 + 237, 10 + 237 * 2, 10 + 237 * 3, 10 + 237 * 4, 10 + 237 * 5];
            this.GOLD_SYMBOLS = [1, 2, 3, 4, 5];
            this.CREDIT_TEXT_POSITIONS = [40, 65];
            this.NUMBER_TEXT_POSITIONS = [30, 15];
            this.GOLD_TEXT_POSITIONS = [65, 15];
            this.SYMBOL_TEXT_POSITIONS = [70, 45];
            this.betYpos = [782, 669, 556, 443, 330];
            this.betXpos = 21;
            this.menu = menu;
            this.betText = betText;
            this.currencyFormatter = currencyFormatter;
            this.inputHandler = inputHandler;
            this.MultiplierText = MultiplierMenuText;
            this.menuPanel = menuPanel;
            this.icons = icons;
            this.selector = selector;
            this.scene = scene;
            this.baseBundle = baseBundle;
            this.creditsMenuPanel = creditsMenu;
            this.font = baseBundle.myriadProSemiBold;
            this.canChangeBet = false;
            this.handlersSet = false;
            this.menuShowed = false;
            this.isBetAllowed = false;
            this.handlersSetIcons = false;
            this.scalar = scalar;
            this.betText1 = betText1;
            this.audioController = audioController;
            this.translator = translator;
            this.menuTimeline = new TimelineMax({ paused: true, onComplete: function () {
                _this.openComplete();
            }, onReverseComplete: function () {
            } });
            this.signal = {
                onClicked: function (val) {
                }
            };
            this.events = new events.EventDispatcher(this.signal);
            this.showBetMenu();
        }
        BetMenu.prototype.setBetController = function (bc) {
            this.betController = bc;
            this.updateBetLabel();
            this.setBetText(this.icons);
            this.defaultbetHighlight(this.betController.defaultBetIndex);
        };
        BetMenu.prototype.defaultbetHighlight = function (defaultindex) {
            var i = defaultindex;
            this.betSelected = defaultindex;
            this.icons[i].getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.creditsselected, this.scalar));
            this.icons[i].getTransform().setPositionY(this.betYpos[i] - 32);
            this.icons[i].getTransform().setPositionX(this.betXpos - 21);
            var textlabelactor = this.textlabelactor(i);
            textlabelactor[0].getTransform().setPosition(70, 91);
            textlabelactor[1].getTransform().setPosition(50, 43);
            textlabelactor[2].getTransform().setPosition(90, 35);
            textlabelactor[3].getTransform().setPosition(95, 66);
            for (var j = 0; j < 5; j++) {
                if (i != j) {
                    this.icons[j].getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.stakemtr, this.scalar));
                    this.icons[j].getTransform().setPositionY(this.betYpos[j]);
                    this.icons[j].getTransform().setPositionX(this.betXpos);
                    var textlabelactor = this.textlabelactor(j);
                    textlabelactor[0].getTransform().setPosition(50, 55);
                    textlabelactor[1].getTransform().setPosition(30, 15);
                    textlabelactor[2].getTransform().setPosition(65, 10);
                    textlabelactor[3].getTransform().setPosition(74, 36);
                }
            }
        };
        BetMenu.prototype.setBetText = function (icons) {
            this.icons = icons;
            for (var i = 0; i < this.icons.length; i++) {
                var textValue = "( " + this.betController.availableBets[i].units.toString() + " " + this.translator.findByKey("Credits_txt") + " )";
                var textValue1 = this.GOLD_SYMBOLS[i].toString();
                var creditFont = "20px";
                if (textValue.length > 17) {
                    creditFont = "15px";
                }
                this.icons[i].setName(textValue);
                var creditLabel = this.createCreditText(this.icons[i], this.scene, this.scalar, this.baseBundle.myriadProSemiBold, creditFont, this.CREDIT_TEXT_POSITIONS, textValue, 150, "#660000", 0);
                var numberLabel = this.createCreditText(this.icons[i], this.scene, this.scalar, this.baseBundle.myriadProBold, "50px", this.NUMBER_TEXT_POSITIONS, textValue1, 130, "#FFFFFF", 4);
                var goldFontSize = "40px";
                if (this.translator.findByKey("Gold_txt").length > 8)
                    goldFontSize = "24px";
                var goldLabel = this.createCreditText(this.icons[i], this.scene, this.scalar, this.baseBundle.myriadProBold, goldFontSize, this.GOLD_TEXT_POSITIONS, this.translator.findByKey("Gold_txt"), 130, "#660000", 0);
                if (textValue1 == "1") {
                    this.SYMBOLS_NAME = this.translator.findByKey("Symbol_txt");
                }
                else {
                    this.SYMBOLS_NAME = this.translator.findByKey("Symbols_txt");
                }
                var symbolLabel = this.createCreditText(this.icons[i], this.scene, this.scalar, this.baseBundle.myriadProBold, "18px", this.SYMBOL_TEXT_POSITIONS, this.SYMBOLS_NAME, 130, "#660000", 0);
                if (i == 0) {
                    this.textactor0 = [creditLabel, numberLabel, goldLabel, symbolLabel];
                }
                else if (i == 1) {
                    this.textactor1 = [creditLabel, numberLabel, goldLabel, symbolLabel];
                }
                else if (i == 2) {
                    this.textactor2 = [creditLabel, numberLabel, goldLabel, symbolLabel];
                }
                else if (i == 3) {
                    this.textactor3 = [creditLabel, numberLabel, goldLabel, symbolLabel];
                }
                else {
                    this.textactor4 = [creditLabel, numberLabel, goldLabel, symbolLabel];
                }
            }
        };
        BetMenu.prototype.textlabelactor = function (i) {
            var textactor;
            switch (i) {
                case 0:
                    textactor = this.textactor0;
                    break;
                case 1:
                    textactor = this.textactor1;
                    break;
                case 2:
                    textactor = this.textactor2;
                    break;
                case 3:
                    textactor = this.textactor3;
                    break;
                case 4:
                    textactor = this.textactor4;
                    break;
                default:
                    break;
            }
            return textactor;
        };
        BetMenu.prototype.createCreditText = function (parent, scene, scalar, font, fontSize, positions, textValue, lineWidth, fontcolor, stroke, visible) {
            if (visible === void 0) { visible = true; }
            var textActor = abg2d.Factory.composeText(this.scene, parent);
            var text = textActor.getText();
            text.setFont(fontSize + " " + font.getFontName());
            text.setText(textValue);
            text.setMaxLineWidth(lineWidth);
            if (fontSize == "20px" || fontSize == "18px" || fontSize == "15px") {
                text.setLineHeight(1.2);
            }
            text.setScalar(scalar);
            var positions = [positions[0], positions[1]];
            if (!this.isMobile()) {
                if (stroke > 0) {
                    var strokeEffect = new abg2d.SolidStrokeEffect("#660000", stroke);
                    text.addEffect(strokeEffect);
                }
            }
            abg2d.TextFactory.createFillText(text, fontcolor);
            var textTransform = textActor.getTransform();
            textTransform.setPosition(positions[0], positions[1]);
            return textActor;
        };
        BetMenu.prototype.isMobile = function () {
            return (navigator.userAgent.match(/Android/i) != null || navigator.userAgent.match(/iPhone|iPad|iPod/i) != null);
        };
        /* hides credit button during free game trigger */
        BetMenu.prototype.hideCredits = function () {
            this.creditsMenuPanel.getTransform().setVisible(false);
            for (var i = 0; i < this.icons.length; i++) {
                this.icons[i].getImage().setOpacity(0.5);
            }
        };
        /* show credit button after free game  */
        BetMenu.prototype.showCredits = function () {
            this.creditsMenuPanel.getTransform().setVisible(true);
            for (var i = 0; i < this.icons.length; i++) {
                this.icons[i].getImage().setOpacity(1);
            }
        };
        /**
         * Moves the menu and all other elements into position
         * @method eef.BetMenu#move
         * @public
         * @param {number} xPos The x position
         * @param {number} duration The time it takes for the animation to complete
         * @returns {TweenMax} The created tween
         */
        BetMenu.prototype.move = function (xPos, duration) {
            var tweens = [];
            var timeline = new TimelineLite();
            var menuImage = this.menu.getImage();
            var menuTransform = this.menu.getTransform();
            var params = {
                setPositionX: xPos + menuImage.getWidth() / 2 + 10,
                ease: Power2.easeInOut,
                immediateRender: false
            };
            tweens.push(TweenMax.to(this.menu.getTransform(), duration, params));
            timeline.add(TweenMax.to(this.menu.getTransform(), duration, params));
            return timeline;
        };
        BetMenu.prototype.toggelSubmenu = function () {
            if (!this.menuShowed) {
                this.showBetMenu();
            }
            else {
                this.reset();
                this.hideBetMenu();
            }
        };
        BetMenu.prototype.showBetMenu = function () {
            this.menuShowed = true;
            this.selector.getTransform().setVisible(false);
            this.show();
        };
        BetMenu.prototype.hideBetMenu = function () {
            this.menuTimeline.reverse(0);
            this.menuShowed = false;
            this.isBetAllowed = false;
            this.menuPanel.getTransform().setVisible(false);
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var transform = actor.getTransform();
                transform.setVisible(false);
            }
        };
        BetMenu.prototype.show = function () {
            var that = this;
            this.menuPanel.getTransform().setVisible(true);
            this.isBetAllowed = true;
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var transform = actor.getTransform();
                transform.setVisible(true);
            }
            //this.menuTimeline.play(0);
            this.openComplete();
        };
        BetMenu.prototype.reset = function () {
            //this.isBetAllowed = false;
            this.menuShowed = false;
            this.menuPanel.getTransform().setVisible(false);
        };
        BetMenu.prototype.openComplete = function () {
            var that = this;
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var transform = actor.getTransform();
                transform.setVisible(true);
                if (!this.handlersSetIcons) {
                    this.setInputHandler(actor, transform.getTranslatedPositionX(), transform.getTranslatedPositionY(), function (index) {
                        return function () {
                            if (that.canChangeBet) {
                                that.toggleBetIcons(index);
                                that.audioController.playButtonClick();
                            }
                        };
                    }(i));
                }
            }
            this.handlersSetIcons = true;
        };
        BetMenu.prototype.betChange = function (enable) {
            this.canChangeBet = enable;
        };
        BetMenu.prototype.betMenuDisable = function (disable) {
            if (!disable) {
                for (var i = 0; i < this.icons.length; ++i) {
                    if (i == this.betSelected) {
                        //this.icons[i].getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.creditsSelectedDisable, this.scalar));
                        var textlabelactor = this.textlabelactor(i);
                        if (textlabelactor != null) {
                            textlabelactor[0].getText().setOpacity(1);
                            textlabelactor[1].getText().setOpacity(1);
                            textlabelactor[2].getText().setOpacity(1);
                            textlabelactor[3].getText().setOpacity(1);
                        }
                    }
                    else {
                        this.icons[i].getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.stakemtrDisable, this.scalar));
                        var textlabelactor = this.textlabelactor(i);
                        if (textlabelactor != null) {
                            textlabelactor[0].getText().setOpacity(0.5);
                            textlabelactor[1].getText().setOpacity(0.5);
                            textlabelactor[2].getText().setOpacity(0.5);
                            textlabelactor[3].getText().setOpacity(0.5);
                        }
                    }
                }
            }
            else {
                for (var i = 0; i < this.icons.length; ++i) {
                    if (i == this.betSelected) {
                    }
                    else {
                        this.icons[i].getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.stakemtr, this.scalar));
                        var textlabelactor = this.textlabelactor(i);
                        if (textlabelactor != null) {
                            textlabelactor[0].getText().setOpacity(1);
                            textlabelactor[1].getText().setOpacity(1);
                            textlabelactor[2].getText().setOpacity(1);
                            textlabelactor[3].getText().setOpacity(1);
                        }
                    }
                }
            }
        };
        BetMenu.prototype.toggleBetIcons = function (index) {
            if (this.isHistoryReplay)
                return;
            this.betSelected = index;
            for (var i = 0; i < this.icons.length; i++) {
                if (i == index) {
                    this.icons[i].getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.creditsselected, this.scalar));
                    this.icons[i].getTransform().setPositionY(this.betYpos[i] - 32);
                    this.icons[i].getTransform().setPositionX(this.betXpos - 21);
                    //this.icons[i].getImage().setAlign(abg2d.Alignment.Center);
                    var textlabelactor = this.textlabelactor(i);
                    textlabelactor[0].getTransform().setPosition(70, 91);
                    textlabelactor[1].getTransform().setPosition(50, 43);
                    textlabelactor[2].getTransform().setPosition(90, 35);
                    textlabelactor[3].getTransform().setPosition(95, 66);
                }
                else {
                    this.icons[i].getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.stakemtr, this.scalar));
                    this.icons[i].getTransform().setPositionY(this.betYpos[i]);
                    this.icons[i].getTransform().setPositionX(this.betXpos);
                    var textlabelactor = this.textlabelactor(i);
                    textlabelactor[0].getTransform().setPosition(50, 55);
                    textlabelactor[1].getTransform().setPosition(30, 15);
                    textlabelactor[2].getTransform().setPosition(65, 10);
                    textlabelactor[3].getTransform().setPosition(74, 36);
                }
            }
            var clickedval = this.betController.availableBets[index].units.toString();
            var goldval = this.GOLD_SYMBOLS[index].toString();
            if (this.isBetAllowed) {
                var actor = this.icons[index];
                this.updateBetCreditLabel(clickedval, goldval);
                this.signal.onClicked(clickedval);
            }
        };
        BetMenu.prototype.updateBetCreditLabel = function (value, gold) {
            var textValue = value;
            this.betText.getTransform().setVisible(true);
            this.betText.getText().setText(textValue);
            this.betText1.getText().setText(gold);
        };
        /**
         * Moves an icon
         * @method eef.BetMenu#moveIcon
         * @private
         * @param {abg2d.Actor} actor The actor to peform the tween on
         * @param {number} duration The length of the tween
         * @param {number} xPos The x position to move to
         * @returns {TweenMax} The created tween
         */
        BetMenu.prototype.moveIcon = function (actor, duration, xPos) {
            var transform = actor.getTransform();
            var params = {
                setPositionX: xPos,
                ease: Power2.easeInOut,
                immediateRender: false
            };
            return TweenMax.to(transform, duration, params);
        };
        /**
         * Wires up an input handler for an actor
         * @method eef.BetMenu#setInputHandler
         * @private
         * @param {abg2d.Actor} actor The actor to add input handling to
         * @param {number} xPos The x position of the region
         * @param {number} yPos The y position of the region
         * @param {Function} handler The event to fire when the element is clicked
         */
        BetMenu.prototype.setInputHandler = function (actor, xPos, yPos, handler) {
            var rect = new abg2d.Rect();
            var image = actor.getImage();
            image.getDrawBounds(rect);
            var transform = actor.getTransform();
            var inputResolver = new input.InputResolver(xPos, yPos, image.getDrawWidth(), image.getDrawHeight());
            abg2d.Factory.composeInputRegion(actor, inputResolver, rect, handler);
            this.inputHandler.addResolver(inputResolver);
        };
        /**
         * Increases the current bet
         * @method eef.BetMenu#increaseBet
         * @private
         */
        BetMenu.prototype.increaseBet = function () {
            this.betController.increaseBet();
            this.updateBetLabel();
        };
        /**
         * Decreases the current bet
         * @method eef.BetMenu#decreaseBet
         * @private
         */
        BetMenu.prototype.decreaseBet = function () {
            this.betController.decreaseBet();
            this.updateBetLabel();
        };
        /**
         * Updates the bet label
         * @method eef.BetMenu#updateBetLabel
         * @private
         */
        BetMenu.prototype.updateBetLabel = function () {
            var defaultBet = this.betController.defaultBetIndex;
            var betStr = this.betController.availableBets[defaultBet].units.toString();
            var betStr1 = this.GOLD_SYMBOLS[0].toString();
            this.betText.getTransform().setVisible(true);
            this.betText.getText().setText(betStr);
            this.betText.getTransform().setPosition(20, 60);
            this.betText1.getTransform().setVisible(true);
            this.betText1.getText().setText(betStr1);
            this.betText1.getTransform().setPosition(20, 0);
            if (this.betController.availableMultipliers.length == 1) {
                this.betController.defaultMultiplierIndex = 0;
                this.betController.currentMultiplierIndex = 0;
            }
            var defaultMultiplier = this.betController.defaultMultiplierIndex;
            var multiplierstr = this.currencyFormatter.format(this.betController.availableMultipliers[defaultMultiplier].multiplier.toString());
            multiplierstr = "X" + multiplierstr;
            if (multiplierstr.length > 6 && multiplierstr.length < 8) {
                this.MultiplierText.getText().setFont("33px " + this.font.getFontName());
            }
            else if (multiplierstr.length >= 8 && multiplierstr.length < 9) {
                this.MultiplierText.getText().setFont("30px " + this.font.getFontName());
            }
            else if (multiplierstr.length >= 9) {
                this.MultiplierText.getText().setFont("29px " + this.font.getFontName());
            }
            if (multiplierstr.length > 10) {
                this.MultiplierText.getTransform().setPositionY(52);
            }
            this.MultiplierText.getText().setText(multiplierstr);
        };
        /**
        * updates label during restore
        */
        BetMenu.prototype.updateRestoreBetLabel = function (creditbet, betMultiplier) {
            this.betText.getText().setText(creditbet);
            var multiplierstr = this.currencyFormatter.format(betMultiplier);
            multiplierstr = "X" + multiplierstr;
            if (multiplierstr.length > 6 && multiplierstr.length < 8) {
                this.MultiplierText.getText().setFont("33px " + this.font.getFontName());
            }
            else if (multiplierstr.length >= 8 && multiplierstr.length < 9) {
                this.MultiplierText.getText().setFont("30px " + this.font.getFontName());
            }
            else if (multiplierstr.length >= 9) {
                this.MultiplierText.getText().setFont("29px " + this.font.getFontName());
            }
            if (multiplierstr.length > 10) {
                this.MultiplierText.getTransform().setPositionY(52);
            }
            this.MultiplierText.getText().setText(multiplierstr);
            var goldhighlight = this.getGoldHighlight(creditbet);
            this.defaultbetHighlight(goldhighlight);
            //this.betText1.getText().setText(goldtext);
            this.betSelected = this.getGoldHighlight(creditbet);
            this.betMenuDisable(false);
        };
        BetMenu.prototype.getGoldHighlight = function (creditbet) {
            var bet1text;
            switch (creditbet) {
                case "8":
                    bet1text = 0;
                    break;
                case "18":
                    bet1text = 1;
                    break;
                case "38":
                    bet1text = 2;
                    break;
                case "68":
                    bet1text = 3;
                    break;
                case "88":
                    bet1text = 4;
                    break;
                default:
                    break;
            }
            return bet1text;
        };
        BetMenu.prototype.getEvents = function () {
            return this.events;
        };
        BetMenu.prototype.historyReplay = function (flag) {
            this.isHistoryReplay = flag;
            //this.toggleBetIcons(index);
        };
        return BetMenu;
    })();
    exports.BetMenu = BetMenu;
    var Button = (function () {
        function Button(imageActor, textActor, scalar, inputHandler) {
            var _this = this;
            this.name = imageActor.getName();
            this.scalar = scalar;
            this.imageActor = imageActor;
            this.textActor = textActor;
            var rect = new abg2d.Rect();
            var image = this.imageActor.getImage();
            image.getDrawBounds(rect);
            var transform = this.imageActor.getTransform();
            this.inputResolver = new input.InputResolver(transform.getTranslatedPositionX(), transform.getTranslatedPositionY(), image.getDrawWidth(), image.getDrawHeight());
            var that = this;
            abg2d.Factory.composeInputRegion(this.imageActor, this.inputResolver, rect, function (id, x, y) {
                _this.onClick(x, y);
            }, null, function (id, x, y) {
                _this.onClickEnd(x, y);
            });
            inputHandler.addResolver(this.inputResolver);
            this.signal = {
                onClick: null,
                onClickEnd: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        Button.prototype.getEvents = function () {
            return this.events;
        };
        Button.prototype.getActor = function () {
            return this.imageActor;
        };
        Button.prototype.setVisible = function (visible) {
            this.imageActor.getTransform().setVisible(visible);
            this.setActive(visible);
        };
        Button.prototype.setActive = function (active) {
            this.inputResolver.setActive(active);
        };
        Button.prototype.setPositionX = function (value) {
            this.imageActor.getTransform().setPositionX(value);
        };
        Button.prototype.getPositionX = function () {
            return this.imageActor.getTransform().getPositionX();
        };
        Button.prototype.setPositionY = function (value) {
            this.imageActor.getTransform().setPositionY(value);
        };
        Button.prototype.getPositionY = function () {
            return this.imageActor.getTransform().getPositionY();
        };
        Button.prototype.setText = function (text) {
            this.textActor.getText().setText(text);
        };
        Button.prototype.getBounds = function () {
            var rect = new abg2d.Rect();
            var xfm = this.imageActor.getTransform();
            rect.set(xfm.getTranslatedPositionX(), xfm.getTranslatedPositionY(), this.imageActor.getImage().getWidth(), this.imageActor.getImage().getHeight());
            return rect;
        };
        Button.prototype.setSheet = function (asset) {
            this.imageActor.getImage().setSpriteSheet(new abg2d.SpriteSheet(asset, this.scalar));
        };
        Button.prototype.onClick = function (x, y) {
            this.signal.onClick(x, y);
        };
        Button.prototype.onClickEnd = function (x, y) {
            this.signal.onClickEnd(x, y);
        };
        return Button;
    })();
    exports.Button = Button;
    /**
     * UIController
     * @class eef.UIController
     * @classdesc Handles all logic that needs to be performed by the User Interface
     */
    var UIController = (function () {
        /**
         * @constructor
         */
        function UIController(winMeterLabel, winMeterText, balanceMeterText, replayText, betMeterText, betMenu, settingsMenu, spinButton, autoPlayManager, translator, glsRequestor, currencyFormatter, realMoney, multiplierMenu, scene, baseBundle, MultiplierMenuText, fubatjackpotview, jackpotDisplay, HelpAndPays, activeSymAnim, maxWinBg, maxWinText, maxWinAmtText, flyBats, bowl, bowlLogo, autoPlayIcon, gameLaunch, helpButtonActor, setButtonActor, extHelpButtonActor, scalar, inputHandler, autoPlayButton, autoPlayMenu, partnerListener, metaData) {
            var _this = this;
            this.isAutoPlay = false;
            this.lockSpinButton = false;
            this.FR_FSC_FLAG = false;
            this.isFreeRoundInProgress = false;
            this.isGameRevealed = false;
            this.isIntroScreenAcknowledged = false;
            this.winMeterLabel = winMeterLabel;
            this.winMeterText = winMeterText;
            this.balanceMeterText = balanceMeterText;
            this.replayText = replayText;
            this.betMeterText = betMeterText;
            this.translator = translator;
            this.currencyFormatter = currencyFormatter;
            this.betMenu = betMenu;
            this.spinButton = spinButton;
            this.autoPlayManager = autoPlayManager;
            this.settingsMenu = settingsMenu;
            this.isRealMoney = realMoney;
            this.isRecovering = false;
            this.multiplierMenu = multiplierMenu;
            this.gameLaunchView = gameLaunch;
            this.partnerListener = partnerListener;
            this.multiplierno = "1";
            this.betno = "8";
            this.scene = scene;
            this.baseBundle = baseBundle;
            this.MultiplierText = MultiplierMenuText;
            this.fubatjackpotview = fubatjackpotview;
            this.jackpotDisplay = jackpotDisplay;
            this.HelpAndPays = HelpAndPays;
            this.activeSymAnim = activeSymAnim;
            this.maxWinBg = maxWinBg;
            this.maxWinText = maxWinText;
            this.maxWinAmtText = maxWinAmtText;
            this.flyBats = flyBats;
            this.autoPlayIcon = autoPlayIcon;
            this.autoPlayButton = autoPlayButton;
            this.autoPlayMenu = autoPlayMenu;
            this.bowl = bowl;
            this.bowlLogo = bowlLogo;
            this.isautoenable = false;
            this.helpButtonActor = helpButtonActor;
            this.setButtonActor = setButtonActor;
            this.extHelpButtonActor = extHelpButtonActor;
            this.scalar = scalar;
            this.inputHandler = inputHandler;
            this.gaffingEnabled = false;
            this.lastAutospin = false;
            this.metaData = metaData;
            this.chkExtHelpPartner = null;
            this.isExernalHelpEnabled = false;
            this.glsRequestor = glsRequestor;
            this.bowl.setOnComplete(function (r) {
                _this.handleAllBowlAnimComplete();
            });
            this.winMeterYOrigin = winMeterLabel.getTransform().getPositionY();
            this.balance = 0;
            this.balanceBeforeSendWager = 0;
            this.canUpdateBalance = true;
            this.font = baseBundle.myriadProSemiBold;
            this.batNumber = 0;
            if (typeof (Storage) !== "undefined") {
                var batNum = parseInt(localStorage.getItem("batNumber"));
            }
            else {
                var batNum = 0;
            }
            if (batNum >= 0) {
                this.batNumber = batNum;
                this.changeBowlImg();
            }
            this.spinButton.getEvents().add({
                onClick: function () {
                    _this.onSpinButtonClick();
                }
            });
            this.multiplierMenu.getEvents().add({
                onClicked: function (clickedval) {
                    _this.setmultiplierno(clickedval);
                }
            });
            this.betMenu.getEvents().add({
                onClicked: function (clickedval) {
                    _this.setBetno(clickedval);
                }
            });
            this.gameLaunchView.getEvents().add({
                onPlay: function () {
                    console.log("Play UI clicked");
                    _this.isIntroScreenAcknowledged = true;
                    _this.enableUIButtons(true);
                }
            });
            this.flyBats.getEvents().add({
                onComplete: function () {
                    _this.flybatAnimCompleted();
                }
            });
            this.fubatjackpotview.setBowl(this.bowl);
            // Set up a tracker for re-enabling the spin button only after the bangup has completed
            // and the end response has been received.
            this.spinButtonEnableTracker = new EventTracker();
            this.spinButtonEnableTracker.trackDependency(UIController.EventBangupComplete);
            this.spinButtonEnableTracker.trackDependency(UIController.EventEndResonseReceived);
            this.spinButtonEnableTracker.getEventDispatcher().add({
                onAllDependenciesMet: function () {
                    if (!_this.autoPlayManager.isAutoPlaying()) {
                        _this.toggleSpinButton(true);
                    }
                    _this.spinButtonEnableTracker.resetAllDependencies();
                }
            });
            glsRequestor.getEvents().add({
                onInitResponse: function (initResponse) {
                    _this.initResponseGameData = _this.gameData = initResponse.getGameData();
                    _this.balance = initResponse.getBalance();
                    _this.balanceBeforeSendWager = _this.balance;
                    if (!initResponse.getPlatformData().getIsRecovering()) {
                        _this.updateBalance(_this.balance, EEFConfig.INIT);
                    }
                    _this.setWin(0, false);
                    if (!_this.lockSpinButton) {
                        var defaultBetIndex = _this.betController.defaultBetIndex;
                        _this.betno = _this.betController.availableBets[defaultBetIndex].units.toString();
                        ;
                        //var betConfig : BetConfiguration=<BetConfiguration>initResponse.getGameData().getBetConfiguration();
                        var defaultMultiplierIndex = _this.betController.defaultMultiplierIndex;
                        if (_this.betController.availableMultipliers.length == 1) {
                            defaultMultiplierIndex = 0;
                        }
                        _this.multiplierno = _this.betController.availableMultipliers[defaultMultiplierIndex].multiplier.toString();
                    }
                    //this.betController.setmultiplierIndex(defaultMultiplierIndex);
                    _this.logic.setmultiplier(_this.multiplierno);
                    _this.logic.setbetno(_this.betno);
                    if (!initResponse.getPlatformData().getIsRecovering()) {
                        _this.updateBet(_this.betController.getCurrentBet());
                    }
                    _this.jackpotDisplay.setjackpotText(_this.multiplierno, _this.betno);
                    //this.EnableAutoIcon();
                    _this.betController.getEvents().add({
                        onBetChange: function (bet) {
                            _this.updateBet(bet);
                        },
                        onMultiplierChange: function (multiplier) {
                            _this.updateMultiplier(multiplier);
                            _this.jackpotDisplay.changeJackpotText(multiplier.getMultiplier().toString());
                        },
                    });
                    if (_this.isRecovering == false) {
                        // let partner know we are ready - OLG
                        if (typeof _this.logic.partnerAdapter.gameReady === "function") {
                            _this.logic.partnerAdapter.gameReady();
                        }
                    }
                    _this.settingsMenu.getHelpAndPays().setupBetListener(_this.betController);
                },
                onPlayResponse: function (playResponse) {
                    _this.gameData = playResponse.getGameData();
                    var win = _this.gameData.getTotalWin();
                    _this.multiplierno = _this.gameData.getCustomData().betMultiplier;
                    _this.betno = _this.gameData.getCustomData().creditbet;
                    if (_this.isRealMoney) {
                        if (!_this.isRecovering) {
                            if (!_this.isFreeRoundInProgress) {
                                _this.balance = playResponse.getBalance();
                                var flg = false;
                                if (_this.gameData.getCustomData().totalFSWin == undefined) {
                                    _this.updateBalance((_this.balance - win), EEFConfig.WAGER);
                                    flg = true;
                                }
                                else if (_this.gameData.getCustomData().getSpinsRemaining() == 0) {
                                    flg = true;
                                    _this.updateBalance(_this.balance - _this.gameData.getCustomData().getBaseGameResult().getTotalWin(), EEFConfig.WAGER);
                                }
                                if (!flg) {
                                    _this.updateBalance((_this.balance), EEFConfig.WAGER);
                                }
                            }
                            else {
                                if (_this.isFreeRoundInProgress && _this.freeRoundInfo != undefined && _this.freeRoundInfo.getRemainingRounds() == 1) {
                                    _this.balance = playResponse.getBalance();
                                    if (_this.gameData.getCustomData().getSpinsRemaining() == 0) {
                                        _this.updateBalance(_this.balance - _this.freeRoundInfo.getTotalWin() - _this.gameData.getCustomData().getBaseGameResult().getTotalWin(), EEFConfig.WAGER);
                                    }
                                }
                                else {
                                    _this.updateBalance(_this.balance, EEFConfig.WAGER);
                                }
                            }
                        }
                        else {
                            // In game recovery, balance has already taken the player's win amount into
                            // account. Modify the displayed balance, but don't modify the data from the
                            // server.
                            if (!_this.isFreeRoundInProgress) {
                                if (_this.gameData.getCustomData().totalFSWin == undefined) {
                                    _this.updateBalance((_this.balance - win), EEFConfig.INIT);
                                }
                                else if (_this.gameData.getCustomData().getSpinsRemaining() == 0) {
                                    _this.updateBalance(_this.balance - _this.gameData.getCustomData().getBaseGameResult().getTotalWin(), EEFConfig.INIT);
                                }
                                else {
                                    _this.updateBalance((_this.balance), EEFConfig.WAGER);
                                }
                            }
                            else {
                                if (_this.isFreeRoundInProgress && _this.freeRoundInfo != undefined && _this.freeRoundInfo.getRemainingRounds() == 1) {
                                    if (_this.gameData.getCustomData().getSpinsRemaining() == 0) {
                                        _this.updateBalance(_this.balance - _this.freeRoundInfo.getTotalWin() - _this.gameData.getCustomData().getBaseGameResult().getTotalWin(), EEFConfig.WAGER);
                                    }
                                }
                                else {
                                    _this.updateBalance(_this.balance, EEFConfig.WAGER);
                                }
                            }
                            _this.betMenu.updateRestoreBetLabel(_this.betno, _this.multiplierno);
                            _this.activeSymAnim.showSelectedIcons(_this.betno);
                            _this.reelIndex = _this.getReelindex(_this.betno);
                            _this.updateBet(_this.betController.getCurrentBet());
                            _this.logic.setmultiplier(_this.multiplierno);
                            _this.logic.setbetno(_this.betno);
                            _this.logic.setReelindex(_this.reelIndex);
                            _this.spinButton.setVisible(false);
                            _this.isIntroScreenAcknowledged = true;
                            _this.gameLaunchView.setVisible(false);
                            _this.jackpotDisplay.changeJackpotText(_this.multiplierno);
                            _this.jackpotDisplay.jackpotLock(_this.betno);
                            _this.settingsMenu.getHelpAndPays().updateBets(_this.betno, _this.multiplierno);
                            for (var i = 0; i < _this.betController.availableMultipliers.length; i++) {
                                if (_this.betController.availableMultipliers[i].multiplier.toString() == _this.multiplierno) {
                                    _this.betController.setmultiplierIndex(i.toString());
                                }
                            }
                        }
                        if (_this.autoPlayManager.isAutoPlaying()) {
                            var totalStake = (Number(_this.betno) * Number(_this.multiplierno));
                            try {
                                _this.logic.partnerAdapter.partnerAutoplayManager.updateWinAndStake(win, totalStake);
                            }
                            catch (error) {
                                console.log("Autoplay is not Avaliable");
                            }
                        }
                    }
                    else if (_this.historyData != null) {
                        _this.isIntroScreenAcknowledged = true;
                        _this.gameLaunchView.setVisible(false);
                        _this.betMenu.updateRestoreBetLabel(_this.betno, _this.multiplierno);
                        _this.updateBet(_this.betController.getCurrentBet());
                        _this.activeSymAnim.showSelectedIcons(_this.betno);
                        _this.jackpotDisplay.changeJackpotText(_this.multiplierno);
                        _this.jackpotDisplay.jackpotLock(_this.betno);
                    }
                    else {
                        _this.balance = _this.balanceBeforeSendWager - playResponse.getGameData().getWager();
                        _this.updateBalance(_this.balance, EEFConfig.WAGER);
                    }
                },
                onEndResponse: function (endResponse) {
                    if (!_this.isRealMoney) {
                        _this.balance = endResponse.getBalance();
                        _this.updateBalance(_this.balance, EEFConfig.OUTCOME);
                    }
                    TweenLite.delayedCall(1.5, function () {
                        if (_this.autoPlayManager.isAutoPlaying()) {
                            _this.autoPlayManager.decrementAutoSpins();
                        }
                    });
                    if (_this.autoPlayManager.getSpinsRemaining() >= 1) {
                        TweenLite.delayedCall(1.3, function () {
                            if (_this.autoPlayManager.getSpinsRemaining() != 0) {
                                _this.spinButton.showStopAutoPlay();
                                _this.sendWager();
                                try {
                                    _this.logic.partnerAdapter.partnerAutoplayManager.updateAutoPlayStatus("progress", _this.autoPlayManager.getSpinsRemaining());
                                }
                                catch (error) {
                                    console.log("Autoplay is not Avaliable");
                                }
                                if (_this.getWin() > 0) {
                                    TweenLite.delayedCall(0.5, function () {
                                        _this.animateWin(false);
                                    });
                                }
                                if (_this.autoPlayManager.getSpinsRemaining() == 1) {
                                    _this.lastAutospin = true;
                                }
                            }
                            else {
                                _this.spinButton.showDefault();
                                _this.spinButton.setVisible(false);
                                _this.autoPlayManager.stop();
                                var winDisplay = _this.logic.getSlot().getWinDisplayController();
                                winDisplay.stop();
                                _this.enableUIButtons(true);
                            }
                        });
                    }
                    else {
                        //Idle state
                        EEFConfig.IDLE_STATE = true;
                        _this.spinButton.showDefault();
                        if (_this.lastAutospin) {
                            _this.lastAutospin = false;
                            var totalStake = (Number(_this.betno) * Number(_this.multiplierno));
                            try {
                                _this.logic.partnerAdapter.partnerAutoplayManager.updateAutoPlayStatus("finished", _this.autoPlayManager.getSpinsRemaining());
                                _this.logic.partnerAdapter.partnerAutoplayManager.updateWinAndStake(_this.getWin(), totalStake);
                            }
                            catch (error) {
                                console.log("Autoplay is not Avaliable");
                            }
                        }
                        _this.autoPlayManager.stop();
                    }
                    _this.spinButtonEnableTracker.dependencyMet(UIController.EventEndResonseReceived);
                },
                onError: null
            });
            this.initialize();
            //this.enableUIButtons(false);
        }
        /**
         * Set flag indicating if game is recovering after a disconnect
         * @method eef.UIController#setIsRecovering
         * @public
         * @param {boolean} isRecovering True if recovering, false otherwise
         */
        UIController.prototype.setIsRecovering = function (isRecovering) {
            this.isRecovering = isRecovering;
        };
        UIController.prototype.enablaAutoPlay = function (enable) {
            var _this = this;
            var that = this;
            this.isautoenable = enable;
            if (this.isautoenable) {
                this.helpButtonActor.getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.shelpbutton, this.scalar));
                this.helpButtonActor.getTransform().setPosition(1635, 937);
                this.setButtonActor.getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.ssetbutton, this.scalar));
                this.setButtonActor.getTransform().setPosition(1780, 937);
            }
            this.helpButton = new Button(this.helpButtonActor, null, this.scalar, this.inputHandler);
            this.setButton = new Button(this.setButtonActor, null, this.scalar, this.inputHandler);
            this.exthelpButton = new Button(this.extHelpButtonActor, null, this.scalar, this.inputHandler);
            if (this.isMobile() == true) {
                this.exthelpButton.setVisible(false);
            }
            this.helpButton.getEvents().add({
                onClick: function (x, y) {
                    if (_this.settingsMenu.getIsAllowed() && _this.historyData == null) {
                        _this.settingsMenu.getHelpAndPays().showHelp(true);
                    }
                },
                onClickEnd: function () {
                }
            });
            this.setButton.getEvents().add({
                onClick: function (x, y) {
                    if (_this.settingsMenu.getIsAllowed()) {
                        _this.logic.partnerAdapter.logics.view.menuView.showMenu();
                    }
                },
                onClickEnd: function () {
                }
            });
            this.exthelpButton.getEvents().add({
                onClick: function (x, y) {
                    var maxwin = _this.currencyFormatter.format(_this.initResponseGameData.getWinCapAmount());
                    maxwin = maxwin.replace(/\s+/g, "_");
                    var bets = _this.initResponseGameData.getBetConfiguration().getAvailableBets();
                    var maxBetMultiplier = _this.initResponseGameData.getBetConfiguration().getMultiplierBets();
                    var maxBet = bets[bets.length - 1] * maxBetMultiplier[maxBetMultiplier.length - 1];
                    maxBet = _this.currencyFormatter.format(maxBet);
                    maxBet = maxBet.replace(/\s+/g, "_");
                    var isNT = _this.metaData.getPartnerCode() === "mocknorsktipping" || _this.metaData.getPartnerCode() === "em_norsktipping" || _this.metaData.getPartnerCode() === "em_norsktipping_fun";
                    var basePath = EEFConfig.CDN_ROOT + "content/eightyeightfortunes/resources";
                    window.open(basePath + "/external/" + _this.metaData.getGameCode() + "_" + EEFConfig.CURRENT_LANGUAGE.toLowerCase() + ".html?maxwin=" + maxwin + "&maxbet=" + maxBet + "&isNT=" + isNT, "Help", "width=600, height=400, resizable = yes, scrollbars = yes, touch= yes");
                },
                onClickEnd: function () {
                }
            });
            this.enableUIButtons(false);
        };
        UIController.prototype.getReelindex = function (creditbet) {
            var reelIndex;
            switch (creditbet) {
                case "8":
                    reelIndex = "0";
                    break;
                case "18":
                    reelIndex = "1";
                    break;
                case "38":
                    reelIndex = "2";
                    break;
                case "68":
                    reelIndex = "3";
                    break;
                case "88":
                    reelIndex = "4";
                    break;
                default:
                    break;
            }
            return reelIndex;
        };
        UIController.prototype.flybatAnimCompleted = function () {
            var _this = this;
            if (this.logic.getIsFubat()) {
                TweenLite.delayedCall(2, function () {
                    _this.bowlLogo.getTransform().setVisible(false);
                    _this.bowl.startBowlAnim();
                });
            }
            else {
            }
        };
        UIController.prototype.handleAllBowlAnimComplete = function () {
            this.batNumber = 0;
            this.setBatNumber();
            this.changeBowlImg();
            this.fubatJackPotInit(this.logic.getFubalFeatureData());
            this.bowlLogo.getTransform().setVisible(true);
        };
        UIController.prototype.fubatJackPotInit = function (fubatjackpotinfo) {
            this.fubatjackpotview.fubatJackpotShow(fubatjackpotinfo, this.logic);
        };
        UIController.prototype.setmultiplierno = function (value) {
            this.multiplierno = value;
            this.logic.setmultiplier(this.multiplierno);
            this.updateBet(this.betController.getCurrentBet());
        };
        UIController.prototype.setBetno = function (value) {
            this.betno = value;
            this.logic.setbetno(this.betno);
            this.updateBet(this.betController.getCurrentBet());
        };
        UIController.prototype.updateMultiplierLabel = function (value) {
            var textValue = value;
            var multiplierstr = this.currencyFormatter.format(textValue);
            multiplierstr = "X" + multiplierstr;
            if (multiplierstr.length > 6 && multiplierstr.length < 8) {
                this.MultiplierText.getText().setFont("33px " + this.font.getFontName());
            }
            else if (multiplierstr.length >= 8 && multiplierstr.length < 9) {
                this.MultiplierText.getText().setFont("30px " + this.font.getFontName());
            }
            else if (multiplierstr.length >= 9) {
                this.MultiplierText.getText().setFont("29px " + this.font.getFontName());
            }
            if (multiplierstr.length > 10) {
                this.MultiplierText.getTransform().setPositionY(52);
            }
            this.MultiplierText.getText().setText(multiplierstr);
        };
        /**
         * Sets the bet controller
         * @method eef.UIController#setBetController
         * @public
         * @param {BetController} betController The bet controller
         */
        UIController.prototype.setBetController = function (betController) {
            this.betController = betController;
            this.betMenu.setBetController(this.betController);
            this.multiplierMenu.setMultiplierController(this.betController);
            //this.updateBet(this.betController.getCurrentBet());
        };
        /*hides creit button and bet button during free spin */
        UIController.prototype.hideCreditsAndBet = function () {
            this.helpButton.setActive(false);
            this.setButton.setActive(false);
            this.betMenu.betChange(false);
            this.multiplierMenu.multiplierChange(false);
            this.setBonusWinTxt();
        };
        /*show creit button and bet button after free spin */
        UIController.prototype.showCreditsAndBet = function () {
            this.helpButton.setActive(true);
            this.setButton.setActive(true);
            this.betMenu.betChange(true);
            this.multiplierMenu.multiplierChange(true);
            this.winMeterLabel.getText().setText(this.translator.findByKey("Win_Meter_Text"));
        };
        UIController.prototype.setBonusWinTxt = function () {
            this.winMeterLabel.getText().setText(this.translator.findByKey("Bonus_Win_Meter_Text"));
        };
        UIController.prototype.flybats = function (scatterpos) {
            var _this = this;
            this.flyBats.flybatsfly(scatterpos);
            this.batNumber = this.batNumber + scatterpos.length;
            TweenLite.delayedCall(2, function () {
                _this.changeBowlImg();
                _this.setBatNumber();
            });
        };
        UIController.prototype.changeBowlImg = function () {
            if (this.historyData == null) {
                var image = this.bowlLogo.getImage();
                if (this.batNumber >= 24) {
                    image.setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.bowl3, this.scalar));
                }
                else if (this.batNumber >= 16) {
                    image.setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.bowl2, this.scalar));
                }
                else if (this.batNumber >= 8) {
                    image.setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.bowl1, this.scalar));
                }
                else {
                    image.setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.bowl, this.scalar));
                }
            }
        };
        UIController.prototype.setBatNumber = function () {
            if (this.historyData == null) {
                if (typeof (Storage) !== "undefined") {
                    try {
                        localStorage.setItem("batNumber", this.batNumber.toString());
                        //localStorage.removeItem('batNumber');
                        console.log('localStorage is supported');
                    }
                    catch (ex) {
                        console.log('localStorage is unsupported');
                    }
                }
            }
        };
        /**
         * Set the logic object.
         */
        UIController.prototype.setLogic = function (logic) {
            var _this = this;
            this.logic = logic;
            var winDisplay = logic.getSlot().getWinDisplayController();
            winDisplay.getEvents().add({
                onPulseAllSymbols: null,
                onPulseAllSymbolsComplete: function () {
                    if (_this.autoPlayManager.isAutoPlaying()) {
                        winDisplay.stop();
                    }
                }
            });
        };
        /**
         * Gets the balance
         * @method eef.UIController#getBalance
         * @public
         * @returns {number} The balance
         */
        UIController.prototype.getBalance = function () {
            return this.balance;
        };
        /**
         * Updates the balance text
         * @method eef.UIController#updateBalance
         * @public
         * @param {number} balance The value of the users balance
         */
        UIController.prototype.updateBalance = function (balance, type) {
            if (this.canUpdateBalance) {
                //var balanceText: string = this.balanceLabel + ": " + this.currencyFormatter.format(balance);
                var balanceText = this.currencyFormatter.format(balance);
                this.balanceMeterText.getText().setText(balanceText);
                //Open Bet new API - passing the cash, balance and freebet  
                if (this.partnerListener != undefined) {
                    if (this.partnerListener.platformBalanceDisplayEventListener) {
                        var openBetCash = balance;
                        var openBetFreeBet = 0;
                        if (this.isRealMoney) {
                            if (this.gameData.getCustomData().getOpenBetPayLoadInfo() != undefined && this.gameData.getCustomData().getOpenBetPayLoadInfo()[type]) {
                                openBetCash = this.gameData.getCustomData().getOpenBetPayLoadInfo()[type].CASH;
                                openBetFreeBet = this.gameData.getCustomData().getOpenBetPayLoadInfo()[type].FREEBET;
                            }
                            else if (this.initResponseGameData !== undefined && this.initResponseGameData.getCustomData().getOpenBetPayLoadInfo()[EEFConfig.INIT] != undefined && this.initResponseGameData.getCustomData().getOpenBetPayLoadInfo()[EEFConfig.INIT]) {
                                openBetFreeBet = this.initResponseGameData.getCustomData().getOpenBetPayLoadInfo()[EEFConfig.INIT].FREEBET;
                                openBetCash = balance - openBetFreeBet;
                            }
                        }
                        this.partnerListener.platformBalanceDisplayEventListener.handlePlatformDisplayEvent({
                            "CASH": openBetCash,
                            "FREEBET": openBetFreeBet,
                            "balanceAmount": balance
                        });
                    }
                }
            }
        };
        /**
         * Gets the current bet
         * @method eef.UIController#getBet
         * @public
         * @returns {Bet} The selected bet
         */
        UIController.prototype.getBet = function () {
            return this.betController.getCurrentBet();
        };
        /**
         * Sets the flag that determines if the balance can be updated
         * @method eef.UIController#canUpdateBalance
         * @public
         * @param {boolean} canUpdateBalance True if the balance field can be updated
         */
        UIController.prototype.setCanUpdateBalance = function (canUpdateBalance) {
            this.canUpdateBalance = canUpdateBalance;
        };
        /**
         * Updates the bet text
         * @method eef.UIController#updateBet
         * @private
         * @param {Bet} bet The bet value
         */
        UIController.prototype.updateBet = function (bet) {
            var totalStake = {
                betPerUnit: this.multiplierno,
                units: this.betno
            };
            //        
            var updatedBet = (Number(this.multiplierno) * Number(this.betno)).toString();
            updatedBet = this.currencyFormatter.format(updatedBet);
            this.betMeterText.getText().setText(updatedBet);
            //this.HelpAndPays.updatePays(Number(this.multiplierno));
            if (this.partnerListener != undefined) {
                this.logic.partnerAdapter.updateBet(Number(this.multiplierno) * Number(this.betno));
            }
        };
        UIController.prototype.updateMultiplier = function (multiplier) {
            this.multiplierno = multiplier.getMultiplier().toString();
            this.updateBet(this.betController.getCurrentBet());
            //var multlipliervalue=this.multiplierno.toString();
            this.updateMultiplierLabel(this.multiplierno);
            this.logic.setmultiplier(this.multiplierno);
        };
        /**
         * Updates the win text
         * @method eef.UIController#updateWin
         * @public
         * @param {number} win The win value
         */
        UIController.prototype.setWin = function (win, isBangup) {
            if (isBangup === void 0) { isBangup = true; }
            this.winMeterText.getText().setText(this.currencyFormatter.format(Math.round(win)));
            if (!isBangup) {
                if (this.partnerListener.winDisplayEventListener) {
                    this.partnerListener.winDisplayEventListener.handleWinDisplayEvent({
                        "winAmount": win
                    });
                }
            }
        };
        /**
         * Gets the win
         * @method eef.UIController#getWin
         * @public
         * @returns {number} The win value
         */
        UIController.prototype.getWin = function () {
            var win = parseInt(this.currencyFormatter.clean(this.winMeterText.getText().getText()), 10);
            return (isNaN(win)) ? 0 : win;
        };
        /**
         * Gets the demo menu
         * @method eef.UIController#getDemoMenu
         * @public
         * @returns {game.DemoMenu} The demo menu instance
         */
        UIController.prototype.getDemoMenu = function () {
            return this.demoMenu;
        };
        /**
         * Toggles the spin button visibility
         * @method eef.UIController#toggleSpinButton
         * @public
         * @param {boolean} show True to show the spin button
         */
        UIController.prototype.toggleSpinButton = function (flag) {
            var show = this.lockSpinButton ? false : flag;
            if (this.canUpdateBalance && (!show || this.historyData == null)) {
                if (this.freeRoundInfo == undefined && this.isFreeRoundInProgress == false) {
                    if (!show || (show && this.isGameRevealed)) {
                        this.spinButton.setVisible(show);
                    }
                    this.enableUIButtons(show);
                }
            }
        };
        /**
         * Animates the win meter
         * @method eef.UIController#animateWin
         * @public
         * @param {boolean} moveUp True to move the win meter up
         * @returns {TimelineLite} The created timeline
         */
        UIController.prototype.animateWin = function (moveUp) {
            var _this = this;
            var duration = 0.25;
            var tweens = [];
            var textParams = {
                immediateRender: false,
                ease: Power1.easeIn
            };
            tweens.push(TweenLite.to(this.winMeterText.getTransform(), duration, textParams));
            var timeline = new TimelineLite({
                onComplete: function () {
                    if (!moveUp) {
                        _this.setWin(0, false);
                    }
                }
            });
            timeline.add(tweens);
            return timeline;
        };
        /**
         * Update UI after bangup is complete
         * @method eef.UIController#handleBangupComplete
         * @public
         */
        UIController.prototype.handleBangupComplete = function () {
            //Open Bet new API - passing every spin win value
            if (this.partnerListener != undefined) {
                if (this.partnerListener.winDisplayEventListener) {
                    this.partnerListener.winDisplayEventListener.handleWinDisplayEvent({
                        "winAmount": this.getWin()
                    });
                }
            }
            if (this.historyData == null && !this.logic.getFreeSpin().isActive) {
                this.glsRequestor.makeEndRequest();
                this.updateBalance(this.balance, EEFConfig.OUTCOME);
            }
            this.spinButtonEnableTracker.dependencyMet(UIController.EventBangupComplete);
        };
        /**
         * Creates the demo menu
         * @method eef.UIController#createDemoMenu
         * @public
         * @param {abg2d.Scene} scene Scene to add the menu elements to.
         * @param {input.InputHandler} inputHandler Handler for demo input
         * @param  {number} scalar Game scale factor.
         */
        UIController.prototype.createDemoMenu = function (scene, inputHandler, scalar, deviceContext) {
            var _this = this;
            var width = deviceContext.getBaselineWidth();
            var height = deviceContext.getBaselineHeight();
            //create new input resolver
            var inputResolver = new input.InputResolver(0, 0, width, height);
            //create gaffing
            this.gaffingEnabled = true;
            var gaffing = new game.Gaffing();
            /*gaffing.addGaff("Bangup Test", [0,5,6,57,24]);
            gaffing.addGaff("8 Free Spins", [29,16,26,0,0]);
            gaffing.addGaff("15 Free Spins", [29,16,26,21,0]);
            gaffing.addGaff("20 Free Spins", [29,16,26,21,38]);
            gaffing.addGaff("8 Free Spins + Base Win", [64,66,25,21,38]);
            gaffing.addGaff("Big Win", [5, 0, 0, 0, 0]);
            gaffing.addGaff("Super Big Win", [19, 36, 3, 0, 3]);
            gaffing.addGaff("Mega Big Win", [19, 36, 3, 2, 0]);*/
            //TODO - add other gaffs here
            this.gaffing = new Gaffing();
            /*this.gaffing.addGaffWithReelIndex("FUBAT-MINI-88,68", { reelStop: [0,0,14,1,0], reelIndex: 4, gafftype:2, symID: '0' });
            this.gaffing.addGaffWithReelIndex("FUBAT-MINOR-88,68", { reelStop: [0,0,14,1,0], reelIndex: 4, gafftype:2, symID: '1' });
            this.gaffing.addGaffWithReelIndex("FUBAT-MAJOR-88,68", { reelStop: [0,0,14,1,0], reelIndex: 4, gafftype:2, symID: '2' });
            this.gaffing.addGaffWithReelIndex("FUBAT-GRAND-88", { reelStop: [0,0,14,1,0], reelIndex: 4, gafftype:2, symID: '3' });
            this.gaffing.addGaffWithReelIndex("FUBAT-MINI-38,18", { reelStop: [0,0,44,1,0], reelIndex: 4, gafftype:2, symID: '0' });
            this.gaffing.addGaffWithReelIndex("FUBAT-MINOR-38", { reelStop: [0,0,44,1,0], reelIndex: 4, gafftype:2, symID: '1' });*/
            this.gaffing.addGaffWithReelIndex("FUBAT-JACKPOT", { reelStop: [0, 0, 14, 1, 0], reelIndex: 4, gafftype: 2, symID: '0' });
            /*this.gaffing.addGaffWithReelIndex("FUBAT-MINOR", { reelStop: [0,0,14,1,0], reelIndex: 4, gafftype:2, symID: '1' });
            this.gaffing.addGaffWithReelIndex("FUBAT-MAJOR", { reelStop: [0,0,14,1,0], reelIndex: 4, gafftype:2, symID: '2' });
            this.gaffing.addGaffWithReelIndex("FUBAT-GRAND", { reelStop: [0,0,14,1,0], reelIndex: 4, gafftype:2, symID: '3' });*/
            this.gaffing.addGaffWithReelIndex("FREE-GAME", { reelStop: [21, 2, 14, 0, 0], reelIndex: 4, gafftype: 2, symID: '1' });
            this.demoMenu = new game.DemoMenu(inputResolver, scene, width, height, this.gaffing, scalar);
            this.demoMenu.getEvents().add({
                onItemClicked: function (itemName) {
                    _this.demoButtonClicked(itemName);
                },
                onMenuOpened: null,
                onMenuClosed: null,
                onGaffToggled: null
            });
            inputHandler.addResolver(inputResolver);
        };
        /**
         * Stops auto play
         * @method eef.UIController#stopAutoPlay
         * @public
         */
        UIController.prototype.stopAutoPlay = function () {
            if (this.autoPlayManager.isAutoPlaying()) {
                EEFConfig.IDLE_STATE = true;
                if (this.gameData.getCustomData() != undefined) {
                    if (this.gameData.getCustomData().fuBatInfo != undefined) {
                        EEFConfig.IDLE_STATE = false;
                    }
                }
                this.toggleSpinButton(false);
                this.autoPlayManager.stop();
                var totalStake = (Number(this.betno) * Number(this.multiplierno));
                try {
                    this.logic.partnerAdapter.partnerAutoplayManager.updateAutoPlayStatus("finished", this.autoPlayManager.getSpinsRemaining());
                    this.logic.partnerAdapter.partnerAutoplayManager.updateWinAndStake(this.getWin(), totalStake);
                }
                catch (error) {
                    console.log("Autoplay is not Avaliable");
                }
            }
        };
        /**
         * Listener for demo menu button click
         * @method eef.UIController#demoButtonClicked
         * @public
         * @param {string} itemName Name of the button that was clicked.
         */
        UIController.prototype.demoButtonClicked = function (itemName) {
            this.logic.setGaffStops(this.demoMenu.getGaffPositions(itemName));
            this.logic.setGaffReelIndex(this.gaffing.getGaffReelIndex(itemName));
            this.logic.setSymbolID(this.gaffing.getsymID(itemName));
            this.logic.setGaffingType(this.gaffing.getgaffType(itemName));
            //this.onSpinButtonClick();
        };
        /**
         * Initializes the UI to it's default state
         * @method eef.UIController#initialize
         * @private
         */
        UIController.prototype.initialize = function () {
            this.betLabel = this.translator.findByKey("com.wms.framework.Dash.TotalBet").toUpperCase();
            this.balanceLabel = this.translator.findByKey("com.williamsinteractive.mobile.casinarena.matrix.LBL_BALANCE").toUpperCase();
            this.winLabel = this.translator.findByKey("com.wms.framework.Dash.Win").toUpperCase();
            //this.winMeterLabel.getText().setText(this.winLabel);
        };
        /**
         * Handler for the spin button click event.
         */
        UIController.prototype.onSpinButtonClick = function () {
            //this.settingsMenu.setIsAllowed(false);
            this.resetWin();
            //Idle state
            EEFConfig.IDLE_STATE = false;
            switch (this.spinButton.getState()) {
                case 1 /* PendingAutoPlay */:
                    this.spinButton.showStopAutoPlay();
                    if (this.autoPlayManager.isAutoPlaying()) {
                        this.autoPlayManager.decrementAutoSpins();
                    }
                    this.sendWager();
                    break;
                case 2 /* StopAutoPlay */:
                    this.stopAutoPlay();
                    break;
                default:
                    this.spinButton.setVisible(false);
                    this.sendWager();
                    this.enableUIButtons(false);
                    break;
            }
        };
        /* show maxwin banner */
        UIController.prototype.showMaxWin = function (win) {
            var _this = this;
            this.maxWinBg.getTransform().setVisible(true);
            this.maxWinText.getText().setText(this.translator.findByKey('maxwin_txt'));
            var MaxWin = win.toString();
            this.maxWinAmtText.getText().setText(this.currencyFormatter.format(MaxWin));
            TweenLite.delayedCall(2, function () {
                _this.maxWinBg.getTransform().setVisible(false);
            });
        };
        UIController.prototype.enableUIButtons = function (visible) {
            if (visible && this.freeRoundInfo != undefined && this.isFreeRoundInProgress == true && this.isGameRevealed) {
                this.spinButton.setVisible(visible);
                this.helpButton.setSheet(this.baseBundle.shelpbuttondisable);
                this.setButton.setSheet(this.baseBundle.ssetbuttondisable);
                this.autoPlayButton.setSheet(this.baseBundle.autoPlayIconDisable);
                this.betMenu.betMenuDisable(visible);
                return;
            }
            else {
                if (visible == false || (visible == true && this.isGameRevealed == true)) {
                    this.spinButton.setVisible(visible);
                    this.helpButton.setActive(visible);
                    this.setButton.setActive(visible);
                    this.autoPlayButton.setActive(visible);
                    this.betMenu.betChange(visible);
                    this.multiplierMenu.multiplierChange(visible);
                }
            }
            if (!visible) {
                if (!this.isautoenable) {
                    this.helpButton.setSheet(this.baseBundle.helpButtonDisable);
                    this.setButton.setSheet(this.baseBundle.setButtonDisable);
                }
                else {
                    this.helpButton.setSheet(this.baseBundle.shelpbuttondisable);
                    this.setButton.setSheet(this.baseBundle.ssetbuttondisable);
                    this.autoPlayButton.setSheet(this.baseBundle.autoPlayIconDisable);
                }
            }
            else {
                if (this.isGameRevealed == true) {
                    if (!this.isautoenable) {
                        this.helpButton.setSheet(this.baseBundle.helpbutton);
                        this.setButton.setSheet(this.baseBundle.setbutton);
                    }
                    else {
                        this.helpButton.setSheet(this.baseBundle.shelpbutton);
                        this.setButton.setSheet(this.baseBundle.ssetbutton);
                        this.autoPlayButton.setSheet(this.baseBundle.autoPlayIcon);
                    }
                }
            }
            this.betMenu.betMenuDisable(visible);
        };
        /**
         * Sends a wager to the server and deducts the wager amount from the displayed balance.
         * @method eef.UIController#sendWager
         * @private
         */
        UIController.prototype.sendWager = function () {
            var currentBalance = this.getBalance();
            this.logic.sendWager(this.betController.getCurrentBet());
            this.logic.partnerAdapter.startedPlay();
            this.isGameRevealed = false;
            /*var currentBalance: number = parseInt(this.currencyFormatter.clean(this.balanceMeterText.getText().getText().replace(this.balanceLabel + ": ", "")), 10);
            var newBalance: number = Math.max(0, currentBalance - (Number(this.betno) * Number(this.multiplierno)));
            if(currentBalance < (Number(this.betno) * Number(this.multiplierno))){
                this.balanceBeforeSendWager = newBalance;
            }*/
            //this.updateBalance(newBalance);        
            this.balanceBeforeSendWager = currentBalance;
        };
        /* From the partner will trigger this method to stop the reel with non win combmination
        * While getting error partner will trigger this method
        ** @resetHard
        */
        UIController.prototype.resetHard = function () {
            EEFConfig.IDLE_STATE = true;
            if (this.autoPlayManager.isAutoPlaying()) {
                this.autoPlayManager.stop();
            }
            //this.setGameState(GameState.GameIdle);
            this.enableUIButtons(true);
            //this.reelSpining = false;
            this.spinButton.showDefault();
            this.toggleSpinButton(true);
        };
        UIController.prototype.freeGameEndTrigger = function () {
            this.logic.freeGameEndTrigger();
        };
        UIController.prototype.startHistoryReplay = function (historyData) {
            this.historyData = historyData;
            this.spinButton.setVisible(false);
            this.balanceMeterText.getTransform().setVisible(false);
            this.updateBet(historyData.getBet());
            this.replayText.getTransform().setVisible(true);
            this.betMenu.historyReplay(true);
            this.multiplierMenu.historyReplay(false);
            this.fubatjackpotview.historyReplay(true);
            this.bowlLogo.getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.bowl1, this.scalar));
        };
        /**
         * AutoPlay button
         * @method eef.setAutoPlay
         * @public
         * @param {boolean} Autoplay button toggle
         */
        UIController.prototype.setAutoPlay = function (isAutoPlay) {
            var _this = this;
            if (isAutoPlay) {
                this.autoPlayButton.getEvents().add({
                    onClick: function (x, y) {
                        _this.autoPlayCallBack();
                    },
                    onClickEnd: function () {
                    }
                });
            }
            this.autoPlayButton.setVisible(isAutoPlay);
            this.autoPlayButton.setActive(isAutoPlay);
            this.enablaAutoPlay(isAutoPlay);
            this.isAutoPlay = isAutoPlay;
        };
        /**
        * Sets the spins remaining
        * @method eef.UIcontroller#startAutoPlay
        * @public
        * @param {number} value The number of auto spins
        */
        UIController.prototype.startAutoPlay = function (autoPlayCount) {
            this.enableUIButtons(false);
            this.autoPlayMenu.showAutoPlayMenu(autoPlayCount);
            if (this.isAutoPlay) {
                this.logic.partnerAdapter.partnerAutoplayManager.updateAutoPlayStatus("started", autoPlayCount);
            }
            this.onSpinButtonClick();
        };
        /**
        * @param {number} sets the currency bet multiplier
        */
        UIController.prototype.setBetMultiplier = function (betMultiplier) {
            this.betController.setBetMultiplier(betMultiplier);
        };
        /**
         * AutoPlay CallBack
         * @method eef.autoPlayCallBack
         * @Private
         * To Show the Autoplay popup from partner adpter
         * @param {}
         */
        UIController.prototype.autoPlayCallBack = function () {
            var totalStake = (Number(this.betno) * Number(this.multiplierno));
            try {
                this.logic.partnerAdapter.partnerAutoplayManager.launchPartnerAutoplay(totalStake, this.balance, function (checked) {
                    console.log("Autoplay is " + checked);
                });
            }
            catch (error) {
                console.log("Autoplay is not Avaliable");
            }
        };
        /**
       * Set the total bet amount based on the level
       * if units is -1, use the level and base bet amount
       * otherwise, use the betPerUnit * units
       * @public
       * @betPerUnit {number} This value is the "betLeveL" from the gls
       * @units {number} units for this bet
       */
        UIController.prototype.setBet = function (betPerUnit, units, forceBet) {
            if (forceBet === void 0) { forceBet = false; }
            this.isIntroScreenAcknowledged = true;
            this.gameLaunchView.setVisible(false);
            var totalStake = this.betController.setBetMultiPler(betPerUnit);
            var totalBet = units <= 0 ? this.betController.getBetByLevel(betPerUnit) : betPerUnit * units;
            if (forceBet) {
                this.betController.setForceBet(totalBet);
            }
            else {
                this.betController.setBet(totalBet);
            }
            this.setBetno(totalStake.betno);
            this.setmultiplierno(totalStake.multipler);
            for (var i = 0; i < this.betController.availableMultipliers.length; i++) {
                if (this.betController.availableMultipliers[i].multiplier.toString() == totalStake.multipler) {
                    this.betController.setmultiplierIndex(i.toString());
                }
            }
            if (forceBet) {
                this.betMenu.updateRestoreBetLabel(this.betno.toString(), this.multiplierno.toString());
                this.jackpotDisplay.changeJackpotText(this.multiplierno.toString());
                this.jackpotDisplay.jackpotLock(this.betno.toString());
                this.activeSymAnim.showSelectedIcons(this.betno.toString());
            }
        };
        /**
        * Lock the UI
        * @method dbs.UIController#lockUI
        * @public
        * @param lock {boolean}
        **/
        UIController.prototype.lockUI = function (lock) {
            this.lockSpinButton = lock;
        };
        //Returning gaffing is enabled or not
        UIController.prototype.isGaffingEnabled = function () {
            return this.gaffingEnabled;
        };
        UIController.prototype.play = function (requestHeaders) {
            //Don't attempt to trigger a play if the game is recovering from a disconnect
            if (!this.isRecovering && !this.getFreeGameFSC()) {
                this.resetWin();
                this.logic.sendWager(this.betController.getCurrentBet(), requestHeaders);
            }
        };
        UIController.prototype.resetWin = function (delay) {
            var _this = this;
            if (delay === void 0) { delay = 0.5; }
            if (this.getWin() > 0) {
                TweenLite.delayedCall(delay, function () {
                    _this.animateWin(false);
                });
            }
            else {
                this.setWin(0, false);
            }
        };
        UIController.prototype.setFreeGameFSC = function (flag) {
            this.FR_FSC_FLAG = flag;
        };
        UIController.prototype.getFreeGameFSC = function () {
            return this.FR_FSC_FLAG;
        };
        UIController.prototype.onDisplayExternalBalance = function (balance) {
            if (EEFConfig.IDLE_STATE) {
                if (this.balance != balance) {
                    this.balance = balance;
                    this.updateBalance(this.balance, '');
                    console.log('Game updated balance in meter   : ' + balance);
                    console.log('Game received and updated balance in meter    : ' + balance);
                }
            }
        };
        UIController.prototype.isMobile = function () {
            return (navigator.userAgent.match(/Android/i) != null || navigator.userAgent.match(/iPhone|iPad|iPod/i) != null);
        };
        UIController.prototype.handleFreeRoundsUpdate = function (freeRoundInfo) {
            var _this = this;
            this.freeRoundInfo = new FreeRoundInfo();
            this.freeRoundInfo.setFreeRoundInfo(freeRoundInfo);
            if (this.freeRoundInfo != undefined) {
                var betNo = this.betController.availableBets[this.betController.availableBets.length - 1].units;
                if (this.betController.getIsValidStake(Math.round(this.freeRoundInfo.getBetLevel()))) {
                    this.setBetno(betNo.toString());
                    this.setmultiplierno((Math.round(this.freeRoundInfo.getBetLevel()) / betNo).toString());
                    this.updateBet(this.betController.getCurrentBet());
                    this.updateMultiplierLabel(this.multiplierno);
                    for (var i = 0; i < this.betController.availableMultipliers.length; i++) {
                        if (this.betController.availableMultipliers[i].multiplier.toString() == this.multiplierno) {
                            this.betController.setmultiplierIndex(i.toString());
                        }
                    }
                    this.spinButton.setVisible(false);
                }
                else {
                    util.ErrorReporter.showError("Invalid Bet Level for Free Round. code: 4", null, function () {
                        _this.logic.partnerAdapter.reload();
                    });
                }
            }
            if (this.freeRoundInfo.getstatus() == "completed" && this.freeRoundInfo.getRemainingRounds() == 0) {
                this.enableUIButtons(true);
                this.isFreeRoundInProgress = false;
                this.updateBalance(this.balance, EEFConfig.OUTCOME);
                this.glsRequestor.resetFreeRoundInfo();
                this.HelpAndPays.updatePaysOnFRComplete(Number(this.multiplierno), Number(this.betno));
            }
            else {
                this.isFreeRoundInProgress = true;
            }
        };
        UIController.prototype.unLockUI = function () {
            this.isGameRevealed = true;
            if (this.freeRoundInfo != undefined && this.freeRoundInfo.getstatus() != "completed" && this.freeRoundInfo.getRemainingRounds() != 0) {
                this.enableUIButtons(false);
                if (EEFConfig.IDLE_STATE) {
                    this.spinButton.setVisible(true);
                }
            }
            else {
                if (EEFConfig.IDLE_STATE && this.isIntroScreenAcknowledged) {
                    this.enableUIButtons(true);
                }
            }
        };
        UIController.EventEndResonseReceived = 'EventEndResonseReceived';
        UIController.EventBangupComplete = 'EventBangupComplete';
        return UIController;
    })();
    exports.UIController = UIController;
    (function (SpinButtonState) {
        SpinButtonState[SpinButtonState["Default"] = 0] = "Default";
        SpinButtonState[SpinButtonState["PendingAutoPlay"] = 1] = "PendingAutoPlay";
        SpinButtonState[SpinButtonState["StopAutoPlay"] = 2] = "StopAutoPlay";
    })(exports.SpinButtonState || (exports.SpinButtonState = {}));
    var SpinButtonState = exports.SpinButtonState;
    var SpinButton = (function () {
        function SpinButton(actor, scalar, defaultSpinButton, autoPlaySpinButton, stopAutoPlaySpinButton, inputHandler) {
            var _this = this;
            this.scalar = scalar;
            this.actor = actor;
            this.defaultSpinButton = defaultSpinButton;
            this.stopAutoPlaySpinButton = stopAutoPlaySpinButton;
            this.autoPlaySpinButton = autoPlaySpinButton;
            this.state = 0 /* Default */;
            var rect = new abg2d.Rect();
            var image = this.actor.getImage();
            image.getDrawBounds(rect);
            var transform = this.actor.getTransform();
            var inputResolver = new input.InputResolver(transform.getTranslatedPositionX(), transform.getTranslatedPositionY(), image.getDrawWidth(), image.getDrawHeight());
            abg2d.Factory.composeInputRegion(this.actor, inputResolver, rect, function (id, x, y) {
                _this.onClick();
            });
            inputHandler.addResolver(inputResolver);
            this.signal = {
                onClick: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
         * Getst the current state of the spin button
         * @method eef.SpinButton#getState
         * @public
         * @returns {SpinButtonState} The current state of the spin button
         */
        SpinButton.prototype.getState = function () {
            return this.state;
        };
        /**
         * Shows the default spin button
         * @method eef.SpinButton#showDefault
         * @public
         */
        SpinButton.prototype.showDefault = function () {
            this.state = 0 /* Default */;
            this.setSheet(this.defaultSpinButton);
            this.actor.setName("spinButton");
        };
        /**
         * Shows the auto play spin button
         * @method eef.SpinButton#showAutoPlay
         * @public
         */
        SpinButton.prototype.showAutoPlay = function () {
            this.state = 1 /* PendingAutoPlay */;
            this.setSheet(this.autoPlaySpinButton);
            this.actor.setName("autoPlaySpinButton");
        };
        /**
         * Shows the stop auto play spin button
         * @method eef.SpinButton#showStopAutoPlay
         * @public
         */
        SpinButton.prototype.showStopAutoPlay = function () {
            this.state = 2 /* StopAutoPlay */;
            this.setSheet(this.stopAutoPlaySpinButton);
            this.actor.setName("autoPlayStopButton");
        };
        /**
         * Gets the event dispatcher for this object
         * @method eef.SpinButton#getEvents
         * @public
         * @returns {events.EventDispatcher<IButtonListener>} The event dispatcher
         */
        SpinButton.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * Toggles the visibility of the spin button
         * @method eef.SpinButton#setVisible
         * @public
         * @param {boolean} visible True if the button should be displayed on screen
         */
        SpinButton.prototype.setVisible = function (visible) {
            this.actor.getTransform().setVisible(visible);
        };
        /**
         * Sets the spritesheet of the spin button
         * @method eef.SpinButton#setSheet
         * @private
         * @param {asset.ImageAsset} asset The asset to use in the new spritesheet
         */
        SpinButton.prototype.setSheet = function (asset) {
            this.actor.getImage().setSpriteSheet(new abg2d.SpriteSheet(asset, this.scalar));
        };
        /**
         * The event to signal when the button is clicked
         * @method eef.SpinButton#onClick
         * @private
         */
        SpinButton.prototype.onClick = function () {
            if (this.actor.getTransform().getVisible()) {
                this.signal.onClick();
            }
        };
        return SpinButton;
    })();
    exports.SpinButton = SpinButton;
    /**
     * AutoPlay
     * @class sym.AutoPlayMenu
     * @classdesc Encapsulates the funcationality of the auto play submenu
     */
    var multiplier = (function () {
        /**
         * @constructor
         */
        function multiplier(multiplierBg, menu, icons, spinButton, inputHandler, scene, baseBundle, MultiplierMenuText, currencyFormatter, scalar, betminus, betplus, betPlusButton, betMinusButton) {
            var _this = this;
            this.VALUE_BUTTON_START_X = [200, 200, 200, 200, 200, 200, 200, 200];
            this.VALUE_BUTTON_END_X = [10 + 237, 10 + 237 * 2, 10 + 237 * 3, 10 + 237 * 4, 10 + 237 * 5, 10 + 237, 10 + 237 * 2, 10 + 237 * 3];
            this.multiplierBg = multiplierBg;
            this.menu = menu;
            this.icons = icons;
            this.spinButton = spinButton;
            this.inputHandler = inputHandler;
            this.menuShowed = false;
            this.canChangeBet = false;
            //this.uicontroller= uicontroller;
            this.scene = scene;
            this.baseBundle = baseBundle;
            this.MultiplierText = MultiplierMenuText;
            this.currencyFormatter = currencyFormatter;
            this.scalar = scalar;
            this.betminus = betminus;
            this.betplus = betplus;
            this.betPlusButton = betPlusButton;
            this.betMinusButton = betMinusButton;
            this.menuTimeline = new TimelineMax({ paused: true, onComplete: function () {
                _this.openComplete();
            }, onReverseComplete: function () {
            } });
            for (var i = 0; i < this.icons.length; i++) {
                this.menuTimeline.add(TweenMax.fromTo(this.icons[i].getTransform(), 0.2, { setPositionX: this.VALUE_BUTTON_START_X[i] }, { setPositionX: this.VALUE_BUTTON_END_X[i] }), 0);
            }
            this.isMultiplierAllowed = false;
            this.handlersSet = false;
            this.handlersSetIcons = false;
            //this.spinsSelected = 0;
            this.signal = {
                onClicked: function (val) {
                }
            };
            this.events = new events.EventDispatcher(this.signal);
            this.addListener();
        }
        multiplier.prototype.closeComplete = function () {
        };
        /**
         * Wires up an input handler for an actor
         * @method eef.BetMenu#setInputHandler
         * @private
         * @param {abg2d.Actor} actor The actor to add input handling to
         * @param {number} xPos The x position of the region
         * @param {number} yPos The y position of the region
         * @param {Function} handler The event to fire when the element is clicked
         */
        multiplier.prototype.setInputHandler = function (actor, xPos, yPos, handler) {
            var rect = new abg2d.Rect();
            var image = actor.getImage();
            image.getDrawBounds(rect);
            var transform = actor.getTransform();
            var inputResolver = new input.InputResolver(xPos, yPos, image.getDrawWidth(), image.getDrawHeight());
            abg2d.Factory.composeInputRegion(actor, inputResolver, rect, handler);
            this.inputHandler.addResolver(inputResolver);
        };
        /**
         * Shows the menu
         * @method eef.AutoPlayMenu#scale
         * @public
         * @param {number} duration The time it takes for the animation to complete
         * @returns {TweenMax} The created tween
         */
        multiplier.prototype.show = function () {
            var that = this;
            this.menu.getTransform().setVisible(true);
            this.isMultiplierAllowed = true;
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var transform = actor.getTransform();
                transform.setVisible(true);
            }
            this.menuTimeline.play(0);
        };
        /**
        * Shwoing the multiplier menu
        * @method eef.multiplier#showMultiplierMenu
        * @private
        */
        multiplier.prototype.showMultiplierMenu = function () {
            this.menuShowed = true;
            this.show();
            //this.spinsSelected = 3;
            //this.toggelAutoPlayButtons(false);
        };
        multiplier.prototype.hideMultiplierMenu = function () {
            this.menuTimeline.reverse(0);
            this.menuShowed = false;
            this.isMultiplierAllowed = false;
            this.menu.getTransform().setVisible(false);
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var transform = actor.getTransform();
                transform.setVisible(false);
            }
        };
        multiplier.prototype.toggelSubmenu = function () {
            if (!this.menuShowed) {
                //this.uicontroller.setMultiplierText(this.icons);
                this.showMultiplierMenu();
            }
            else {
                this.reset();
                this.hideMultiplierMenu();
            }
        };
        /**
         * Resets the menu to its default state
         * @method 88f.multiplier#reset
         * @public
         */
        multiplier.prototype.reset = function () {
            this.isMultiplierAllowed = false;
            this.menuShowed = false;
            this.menu.getTransform().setVisible(false);
        };
        multiplier.prototype.openComplete = function () {
            var that = this;
            for (var i = 0; i < this.icons.length; i++) {
                var actor = this.icons[i];
                var transform = actor.getTransform();
                transform.setVisible(true);
                if (!this.handlersSetIcons) {
                    this.setInputHandler(actor, transform.getTranslatedPositionX(), transform.getTranslatedPositionY(), function (index) {
                        return function () {
                            that.toggleMultiplierIcons(index);
                        };
                    }(i));
                }
            }
            this.handlersSetIcons = true;
        };
        multiplier.prototype.setMultiplierController = function (bc) {
            this.betController = bc;
            //this.setMultiplierText(this.icons)
        };
        /* hides bet during free game trigger */
        multiplier.prototype.hideBet = function () {
            this.betplus.getImage().setOpacity(0.5);
            this.betminus.getImage().setOpacity(0.5);
            this.multiplierBg.getImage().setOpacity(0.5);
        };
        /* show bet after free game */
        multiplier.prototype.showBet = function () {
            this.betplus.getImage().setOpacity(1);
            this.betminus.getImage().setOpacity(1);
            this.multiplierBg.getImage().setOpacity(1);
        };
        multiplier.prototype.showButton = function (visible) {
            this.betPlusButton.setVisible(visible);
            this.betMinusButton.setVisible(visible);
        };
        multiplier.prototype.setMultiplierText = function (icons) {
            this.icons = icons;
            for (var i = 0; i < this.icons.length; i++) {
                var textValue = this.betController.availableMultipliers[i].multiplier.toString();
                this.icons[i].setName(textValue);
                var textActor = abg2d.Factory.composeText(this.scene, this.icons[i]);
                var text = textActor.getText();
                text.setFont("45px " + this.baseBundle.myriadProSemiBold.getFontName());
                textValue = this.currencyFormatter.format(textValue);
                text.setText(textValue);
                text.setMaxLineWidth(130);
                text.setLineHeight(1.2);
                text.setScalar(this.scalar);
                text.setAlign(6 /* Center */);
                var strokeEffect = new abg2d.SolidStrokeEffect("#000000", 4);
                var shadowEffect = new abg2d.ShadowTextEffect("#FFFFFF", 0, 0, "#000000", 6);
                text.addEffect(strokeEffect);
                text.addEffect(shadowEffect);
                abg2d.TextFactory.createFillText(text, "#ffffff");
                var textTransform = textActor.getTransform();
                textTransform.setPosition(135, 80);
            }
        };
        multiplier.prototype.toggleMultiplierIcons = function (index) {
            var clickedval = this.betController.availableMultipliers[index].multiplier.toString();
            if (this.isMultiplierAllowed) {
                var actor = this.icons[index];
                //var text: abg2d.Text = actor.getTransform().getChild().getActor().getText();
                //var effect: abg2d.SolidFillEffect = <abg2d.SolidFillEffect>text.getEffect(0);
                var selectedValue = actor.getName();
                //console.log(selectedValue);
                //this.uicontroller.setmultiplierno(selectedValue);
                this.hideMultiplierMenu();
                this.updateMultiplierLabel(selectedValue);
                this.signal.onClicked(clickedval);
            }
        };
        multiplier.prototype.updateMultiplierLabel = function (value) {
            var textValue = value;
            var multiplierstr = this.currencyFormatter.format(textValue);
            this.MultiplierText.getText().setText(multiplierstr);
        };
        multiplier.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * Increases the current bet
         * @method sym.BetMenu#increaseBet
         * @private
         */
        multiplier.prototype.increaseBet = function () {
            this.betController.increaseMultiplier();
            //this.updateBetLabel();
            if (this.isBetReachedMax()) {
                this.changeImage(this.betplus, this.baseBundle.betplusDisable);
            }
            else {
                this.changeImage(this.betminus, this.baseBundle.betminus);
            }
        };
        /**
        * Decreases the current bet
        * @method sym.BetMenu#decreaseBet
        * @private
        */
        multiplier.prototype.decreaseBet = function () {
            this.betController.decreaseMultiplier();
            //this.updateBetLabel();
            if (this.isBetReachedMinimum()) {
                this.changeImage(this.betminus, this.baseBundle.betminusDisable);
            }
            else {
                this.changeImage(this.betplus, this.baseBundle.betplus);
            }
        };
        multiplier.prototype.addListener = function () {
            var _this = this;
            var plusIconTransform = this.betplus.getTransform();
            var minusIconTransform = this.betminus.getTransform();
            plusIconTransform.setVisible(true);
            minusIconTransform.setVisible(true);
            this.canChangeBet = true;
            if (!this.handlersSet) {
                this.handlersSet = true;
                this.betPlusButton.getEvents().add({
                    onClick: function (x, y) {
                        if (_this.canChangeBet) {
                            _this.increaseBet();
                        }
                    },
                    onClickEnd: function () {
                    }
                });
                this.betMinusButton.getEvents().add({
                    onClick: function (x, y) {
                        if (_this.canChangeBet) {
                            _this.decreaseBet();
                        }
                    },
                    onClickEnd: function () {
                    }
                });
            }
        };
        multiplier.prototype.multiplierChange = function (enable) {
            this.canChangeBet = enable;
            if (!enable) {
                this.betPlusButton.setSheet(this.baseBundle.betplusDisable);
                this.betMinusButton.setSheet(this.baseBundle.betminusDisable);
            }
            else {
                if (!this.isBetReachedMax()) {
                    this.betPlusButton.setSheet(this.baseBundle.betplus);
                }
                if (!this.isBetReachedMinimum()) {
                    this.betMinusButton.setSheet(this.baseBundle.betminus);
                }
            }
        };
        multiplier.prototype.isBetReachedMinimum = function () {
            if (this.betController.getCurrentMultiplierIndex() <= 0)
                return true;
            else
                return false;
        };
        multiplier.prototype.isBetReachedMax = function () {
            if (this.betController.getCurrentMultiplierIndex() >= (this.betController.getMultiplierLenth() - 1))
                return true;
            else
                return false;
        };
        /* Change the image for actor
        * method sym.BetMenu#changeImage
        * @param {abg2d.Actor}Actor reference
        * @param {asset.ImageAsset}imageRef
        * @public
        */
        multiplier.prototype.changeImage = function (actorRef, imageRef) {
            var refImage = actorRef.getImage();
            refImage.setSpriteSheet(new abg2d.SpriteSheet(imageRef, this.scalar));
        };
        multiplier.prototype.historyReplay = function (flag) {
            this.betplus.getTransform().setVisible(flag);
            this.betminus.getTransform().setVisible(flag);
        };
        /**
         * Constant value for the default color of the text
         * @member sym.AutoPlayMenu#DEFAULT_TEXT_COLOR
         * @private static
         * @type {string}
         * @default #FFFFFF
         */
        multiplier.DEFAULT_TEXT_COLOR = "#FFFFFF";
        /**
         * Constant value for the selected color of the text
         * @member sym.AutoPlayMenu#SELECTED_TEXT_COLOR
         * @private static
         * @type {string}
         * @default #00CBFF
         */
        multiplier.SELECTED_TEXT_COLOR = "#00CBFF";
        return multiplier;
    })();
    exports.multiplier = multiplier;
    /**
     * @file PaysController.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Used to update the pays pages based on the current bet
     */
    var PaysController = (function () {
        /**
         * Create a PaysController object
         *
         * @param  element  the DOM element the pays pages live in
         * @param  maxSymbolsToWin  maximum amount of symbols that a win can contain
         */
        function PaysController(element, maxSymbolsToWin) {
            this.paysElement = element;
            this.maxSymbolsToWin = maxSymbolsToWin;
        }
        /**
         * Update the pays pages with new values based on the current bet
         *
         * @param  betPerLine  bet per line to update pays
         * @param  formatter  currency formatter to use for pays values
         */
        PaysController.prototype.updatePays = function (betPerLine, creditsno, formatter) {
            var pages = this.paysElement.getElementsByClassName('paytablePage');
            var numberOfPages = pages.length;
            for (var i = 0; i < numberOfPages; ++i) {
                var pageElements = pages[i].getElementsByClassName('pays-element-wrapper');
                var symbolsPerPage = pageElements.length;
                for (var j = 0; j < symbolsPerPage; ++j) {
                    var listItems = pageElements[j].getElementsByTagName('ul');
                    var listItemsCount = listItems.length;
                    for (var k = 0; k < listItemsCount; ++k) {
                        var list = listItems[k];
                        if (list.children) {
                            var listChildCount = list.children.length;
                            for (var l = 0; l < listChildCount; ++l) {
                                var element = list.children[l];
                                var data = parseInt(element.getAttribute('data-multiplier'));
                                var symbols = parseInt(element.getAttribute('data-symbols'));
                                if (j == 15) {
                                    var totalPayout = formatter.format(data * betPerLine * creditsno);
                                }
                                else {
                                    var totalPayout = formatter.format(data * betPerLine);
                                }
                                if (symbols > 0) {
                                    element.innerHTML = symbols + ' = ' + totalPayout;
                                }
                                else {
                                    element.innerHTML = (this.maxSymbolsToWin - l) + ' = ' + totalPayout;
                                }
                            }
                        }
                    }
                }
            }
        };
        return PaysController;
    })();
    exports.PaysController = PaysController;
    var Bowl = (function () {
        function Bowl(scene, scalar, baseBundle, name, audioController, pos) {
            this.frameRate = 15;
            this.scene = scene;
            this.scalar = scalar;
            this.baseBundle = baseBundle;
            this.baseBundle = baseBundle;
            this.pos = pos;
            this.name = name;
            this.animateCoins = [];
            this.audioController = audioController;
            this.offsetX = 50;
            this.offsetY = 60;
            this.createBowlCloseAnim();
            this.createBowlShakeAnim();
            this.createBowlExplodeAnim();
            this.createAnimCoins();
        }
        Bowl.prototype.setOnComplete = function (onComplete) {
            this.onComplete = onComplete;
        };
        Bowl.prototype.createBowlCloseAnim = function () {
            var _this = this;
            this.bowlActor = abg2d.Factory.composeFramedAnimation(this.scene, null);
            this.bowlActor.setName(name);
            this.bowlActor.getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.bowlcloseanim, this.scalar));
            this.bowlActor.getFrameAnimator().setFramerate(this.frameRate);
            this.bowlActor.getTransform().setPosition(this.pos[0] - this.offsetX, this.pos[1] - this.offsetY);
            this.bowlActor.getTransform().setZOrder(EEFConfig.SPIN_BUTTON_Z);
            this.bowlActor.getFrameAnimator().setOnComplete(function (frameAnimator) {
                _this.bowlCloseDone();
            });
            this.bowlActor.getTransform().setVisible(false);
        };
        Bowl.prototype.createBowlShakeAnim = function () {
            var _this = this;
            this.bowlShakeActor = abg2d.Factory.composeFramedAnimation(this.scene, null);
            this.bowlShakeActor.setName(name);
            this.bowlShakeActor.getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.bowlshakeanim, this.scalar));
            this.bowlShakeActor.getFrameAnimator().setFramerate(25);
            this.bowlShakeActor.getTransform().setPosition(this.pos[0] - this.offsetX, this.pos[1] - this.offsetY);
            this.bowlShakeActor.getTransform().setZOrder(EEFConfig.SPIN_BUTTON_Z);
            this.bowlShakeActor.getFrameAnimator().setOnComplete(function (frameAnimator) {
                _this.bowlShakeDone();
            });
            this.bowlShakeActor.getTransform().setVisible(false);
        };
        Bowl.prototype.createBowlExplodeAnim = function () {
            var _this = this;
            this.bowlExplodeActor = abg2d.Factory.composeFramedAnimation(this.scene, null);
            this.bowlExplodeActor.setName(name);
            this.bowlExplodeActor.getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.bowlexplodeanim, this.scalar));
            this.bowlExplodeActor.getFrameAnimator().setFramerate(this.frameRate);
            this.bowlExplodeActor.getTransform().setPosition(this.pos[0] - this.offsetX, this.pos[1] - this.offsetY);
            this.bowlExplodeActor.getTransform().setZOrder(EEFConfig.SPIN_BUTTON_Z);
            this.bowlExplodeActor.getFrameAnimator().setOnComplete(function (frameAnimator) {
                _this.bowlExplodeDone();
            });
            this.bowlExplodeActor.getTransform().setVisible(false);
        };
        Bowl.prototype.startBowlAnim = function () {
            var _this = this;
            this.bowlActor.getTransform().setVisible(true);
            this.bowlActor.getFrameAnimator().play();
            TweenLite.delayedCall(0.75, function () {
                _this.audioController.playLidClosing();
            });
        };
        Bowl.prototype.bowlCloseDone = function () {
            this.bowlActor.getTransform().setVisible(false);
            this.bowlShakeActor.getTransform().setVisible(true);
            this.bowlShakeActor.getFrameAnimator().play(2);
        };
        Bowl.prototype.bowlShakeDone = function () {
            this.bowlShakeActor.getTransform().setVisible(false);
            this.bowlExplodeActor.getTransform().setVisible(true);
            this.bowlExplodeActor.getFrameAnimator().play();
            this.audioController.playCoinBurst();
        };
        Bowl.prototype.bowlExplodeDone = function () {
            this.bowlActor.getTransform().setVisible(false);
            this.bowlShakeActor.getTransform().setVisible(false);
            this.bowlExplodeActor.getTransform().setVisible(false);
            this.onComplete(this);
        };
        Bowl.prototype.createAnimCoins = function () {
            var coins;
            for (var i = 0; i < 12; ++i) {
                coins = this.createCoins();
                this.animateCoins.push(coins);
            }
        };
        Bowl.prototype.createCoins = function () {
            var actor;
            actor = abg2d.Factory.composeFramedAnimation(this.scene, null);
            actor.getImage().setSpriteSheet(new abg2d.SpriteSheet(this.baseBundle.coingoldanim, this.scalar));
            //actor = abg2d.Factory.composeImage(this.scene, null, new abg2d.SpriteSheet(this.baseBundle.coin, this.scalar));
            actor.getTransform().setPosition(EEFConfig.BOWL_POS[0], EEFConfig.BOWL_POS[1]);
            actor.getTransform().setZOrder(EEFConfig.SPIN_BUTTON_Z);
            actor.getTransform().setVisible(false);
            return actor;
        };
        Bowl.prototype.getAnimCoins = function () {
            return this.animateCoins;
        };
        return Bowl;
    })();
    exports.Bowl = Bowl;
    /**
     * AutoPlay
     * @class sym.AutoPlayMenu
     * @classdesc Encapsulates the funcationality of the auto play submenu
     */
    var JackpotBgAnim = (function () {
        /**
         * @constructor
         */
        function JackpotBgAnim(miniBG, minorBG, majorBG, grandBG, activeHighlight, inputHandler, scene, baseBundle, currencyFormatter, scalar, betMenu) {
            var _this = this;
            this.JackpotValues = [2000, 3750, 75000, 200000];
            //private MINI_TEXT_POSITIONS: number[] = [250, 95];
            this.MINI_TEXT_POSITIONS = [1790, 475];
            this.MINOR_TEXT_POSITIONS = [1780, 360];
            this.MAJOR_TEXT_POSITIONS = [1750, 225];
            this.GRAND_TEXT_POSITIONS = [1730, 95];
            this.miniBG = miniBG;
            this.minorBG = minorBG;
            this.majorBG = majorBG;
            this.grandBG = grandBG;
            this.activeHighlight = activeHighlight;
            this.font = baseBundle.myriadProSemiBold;
            this.inputHandler = inputHandler;
            this.scene = scene;
            this.baseBundle = baseBundle;
            this.currencyFormatter = currencyFormatter;
            this.scalar = scalar;
            this.anim1 = [miniBG, minorBG, majorBG, grandBG];
            this.betMenu = betMenu;
            this.miniBG.getTransform().setZOrder(25);
            this.minorBG.getTransform().setZOrder(25);
            this.majorBG.getTransform().setZOrder(25);
            this.grandBG.getTransform().setZOrder(25);
            this.betMenu.getEvents().add({
                onClicked: function (clickedval) {
                    _this.jackpotLock(clickedval);
                }
            });
            this.menuTimeline = new TimelineMax({ paused: true, onComplete: function () {
                _this.startagain();
            }, onReverseComplete: function () {
            } });
            this.minitext = this.createCreditText(this.scene, this.scalar, this.baseBundle.myriadProSemiBold, "40px", this.MINI_TEXT_POSITIONS, this.JackpotValues[0], 200, "#ffffff", 1);
            this.minitext.getText().addEffect(new abg2d.SolidStrokeEffect("#200001", 3));
            this.minitext.getText().addEffect(new abg2d.GradientFillEffect(["#ffffff", "#fdff41"], [0, 1], 1, 1, 1, 1));
            this.minortext = this.createCreditText(this.scene, this.scalar, this.baseBundle.myriadProSemiBold, "40px", this.MINOR_TEXT_POSITIONS, this.JackpotValues[1], 200, "#ffffff", 1);
            this.minortext.getText().addEffect(new abg2d.SolidStrokeEffect("#200001", 3));
            this.minortext.getText().addEffect(new abg2d.GradientFillEffect(["#ffffff", "#fdff41"], [0, 1], 1, 1, 1, 1));
            this.majortext = this.createCreditText(this.scene, this.scalar, this.baseBundle.myriadProSemiBold, "40px", this.MAJOR_TEXT_POSITIONS, this.JackpotValues[2], 250, "#ffffff", 1);
            this.majortext.getText().addEffect(new abg2d.SolidStrokeEffect("#200001", 3));
            this.majortext.getText().addEffect(new abg2d.GradientFillEffect(["#ffffff", "#fdff41"], [0, 1], 1, 1, 1, 1));
            this.grandtext = this.createCreditText(this.scene, this.scalar, this.baseBundle.myriadProSemiBold, "40px", this.GRAND_TEXT_POSITIONS, this.JackpotValues[3], 280, "#ffffff", 1);
            this.grandtext.getText().addEffect(new abg2d.SolidStrokeEffect("#200001", 3));
            this.grandtext.getText().addEffect(new abg2d.GradientFillEffect(["#ffffff", "#fdff41"], [0, 1], 1, 1, 1, 1));
        }
        JackpotBgAnim.prototype.startanim = function () {
            this.anim2 = this.anim1[0];
            this.menuTimeline.play(0);
        };
        JackpotBgAnim.prototype.startagain = function () {
            this.menuTimeline.restart(true);
        };
        JackpotBgAnim.prototype.createCreditText = function (scene, scalar, font, fontSize, positions, textValue, lineWidth, fontcolor, stroke, visible) {
            if (visible === void 0) { visible = true; }
            var textActor = abg2d.Factory.composeText(this.scene, null);
            var text = textActor.getText();
            text.setFont(fontSize + " " + font.getFontName());
            //var currencyText=this.currencyFormatter.format(textValue.toString());           
            text.setText(textValue.toString());
            text.setMaxLineWidth(lineWidth);
            text.setAlign(6 /* Center */);
            text.setScalar(scalar);
            var positions = [positions[0], positions[1]];
            /*if(stroke>0){
            var strokeEffect:abg2d.SolidStrokeEffect = new abg2d.SolidStrokeEffect("#FFFFFF", stroke);
            text.addEffect(strokeEffect);
            }
            var shadowEffect:abg2d.ShadowTextEffect = new abg2d.ShadowTextEffect("#FFFFFF", 0, 0,"#000000",2);
            text.addEffect(shadowEffect);*/
            abg2d.TextFactory.createFillText(text, fontcolor);
            var textTransform = textActor.getTransform();
            textTransform.setZOrder(EEFConfig.JACKPOT_TXT);
            textTransform.setPosition(positions[0], positions[1]);
            return textActor;
        };
        JackpotBgAnim.prototype.setjackpotText = function (multiplier, credits) {
            this.jackpotLock(credits);
            this.changeFont(multiplier);
        };
        JackpotBgAnim.prototype.changeJackpotText = function (multiplier) {
            this.changeFont(multiplier);
        };
        JackpotBgAnim.prototype.changeFont = function (multiplier) {
            var minival = this.currencyFormatter.format((this.JackpotValues[0] * Number(multiplier)).toString());
            if (minival.length > 11) {
                this.minitext.getText().setFont("25px " + this.font.getFontName());
            }
            else if (minival.length > 9) {
                this.minitext.getText().setFont("30px " + this.font.getFontName());
            }
            else {
                this.minitext.getText().setFont("40px " + this.font.getFontName());
            }
            this.minitext.getText().setText(minival);
            var minorval = this.currencyFormatter.format((this.JackpotValues[1] * Number(multiplier)).toString());
            if (minorval.length > 11) {
                this.minortext.getText().setFont("25px " + this.font.getFontName());
            }
            else if (minorval.length > 9) {
                this.minortext.getText().setFont("30px " + this.font.getFontName());
            }
            else {
                this.minortext.getText().setFont("40px " + this.font.getFontName());
            }
            this.minortext.getText().setText(minorval);
            var majorrval = this.currencyFormatter.format((this.JackpotValues[2] * Number(multiplier)).toString());
            if (majorrval.length > 15) {
                this.majortext.getText().setFont("30px " + this.font.getFontName());
            }
            else if (majorrval.length > 12) {
                this.majortext.getText().setFont("35px " + this.font.getFontName());
            }
            else if (majorrval.length > 7) {
                this.majortext.getText().setFont("40px " + this.font.getFontName());
            }
            else {
                this.majortext.getText().setFont("50px " + this.font.getFontName());
            }
            this.majortext.getText().setText(majorrval);
            var grandval = this.currencyFormatter.format((this.JackpotValues[3] * Number(multiplier)).toString());
            if (grandval.length > 15) {
                this.grandtext.getText().setFont("30px " + this.font.getFontName());
            }
            else if (grandval.length > 12) {
                this.grandtext.getText().setFont("35px " + this.font.getFontName());
            }
            else if (grandval.length > 7) {
                this.grandtext.getText().setFont("40px " + this.font.getFontName());
            }
            else {
                this.grandtext.getText().setFont("50px " + this.font.getFontName());
            }
            this.grandtext.getText().setText(grandval);
        };
        JackpotBgAnim.prototype.jackpotLock = function (credits) {
            if (credits == "8") {
                this.miniBG.getImage().setVisible(true);
                this.minorBG.getImage().setVisible(true);
                this.majorBG.getImage().setVisible(true);
                this.grandBG.getImage().setVisible(true);
            }
            else if (credits == "18") {
                this.miniBG.getImage().setVisible(false);
                this.minorBG.getImage().setVisible(true);
                this.majorBG.getImage().setVisible(true);
                this.grandBG.getImage().setVisible(true);
            }
            else if (credits == "38") {
                this.miniBG.getImage().setVisible(false);
                this.minorBG.getImage().setVisible(false);
                this.majorBG.getImage().setVisible(true);
                this.grandBG.getImage().setVisible(true);
            }
            else if (credits == "68") {
                this.miniBG.getImage().setVisible(false);
                this.minorBG.getImage().setVisible(false);
                this.majorBG.getImage().setVisible(false);
                this.grandBG.getImage().setVisible(true);
            }
            else {
                this.miniBG.getImage().setVisible(false);
                this.minorBG.getImage().setVisible(false);
                this.majorBG.getImage().setVisible(false);
                this.grandBG.getImage().setVisible(false);
            }
        };
        return JackpotBgAnim;
    })();
    exports.JackpotBgAnim = JackpotBgAnim;
    /**
     * AutoPlay
     * @class sym.AutoPlayMenu
     * @classdesc Encapsulates the funcationality of the auto play submenu
     */
    var ActiveSymbolAnim = (function () {
        /**
         * @constructor
         */
        function ActiveSymbolAnim(coinGoldAS, ingotGoldAS, turtleGoldAS, junkGoldAS, phoenixGoldAS, ingotAS, turtleAS, junkAS, phoenixAS, allup, inputHandler, scene, baseBundle, scalar, betMenu, symbolHighlight, activeHighlight) {
            var _this = this;
            this.coinGoldAS = coinGoldAS;
            this.ingotGoldAS = ingotGoldAS;
            this.turtleGoldAS = turtleGoldAS;
            this.junkGoldAS = junkGoldAS;
            this.phoenixGoldAS = phoenixGoldAS;
            this.ingotAS = ingotAS;
            this.turtleAS = turtleAS;
            this.junkAS = junkAS;
            this.phoenixAS = phoenixAS;
            this.allup = allup;
            this.inputHandler = inputHandler;
            this.scene = scene;
            this.baseBundle = baseBundle;
            this.scalar = scalar;
            this.betMenu = betMenu;
            this.symbolHighlight = symbolHighlight;
            this.activeHighlight = activeHighlight;
            this.betMenu.getEvents().add({
                onClicked: function (clickedval) {
                    _this.showSelectedIcons(clickedval);
                    _this.activeHighlightAnim(clickedval);
                }
            });
            this.showDefaultIcons();
        }
        ActiveSymbolAnim.prototype.showDefaultIcons = function () {
            this.coinGoldAS.getImage().setVisible(true);
            this.ingotGoldAS.getImage().setVisible(true);
            this.turtleGoldAS.getImage().setVisible(true);
            this.junkGoldAS.getImage().setVisible(true);
            this.phoenixGoldAS.getImage().setVisible(true);
            this.allup.getImage().setVisible(true);
        };
        ActiveSymbolAnim.prototype.activeHighlightAnim = function (value) {
            var activeimg = this.activeHighlight.getImage();
            activeimg.setVisible(true);
            TweenMax.fromTo(activeimg, 0.5, { setOpacity: 0.2 }, { setOpacity: 1, ease: Sine.easeInOut, yoyo: true, repeat: 1 });
            var tweens = [];
        };
        ActiveSymbolAnim.prototype.showSelectedIcons = function (value) {
            if (value == "8") {
                this.showSelected(false, false, false, false, true, true, true, true, false);
            }
            else if (value == "18") {
                this.showSelected(true, false, false, false, false, true, true, true, false);
            }
            else if (value == "38") {
                this.showSelected(true, true, false, false, false, false, true, true, false);
            }
            else if (value == "68") {
                this.showSelected(true, true, true, false, false, false, false, true, false);
            }
            else if (value == "88") {
                this.showSelected(true, true, true, true, false, false, false, false, true);
            }
        };
        ActiveSymbolAnim.prototype.showSelected = function (ingotGVisible, turtleGVisible, junkGVisible, phoenixGVisible, ingotVisible, turtleVisible, junkVisible, phoenixVisible, allupVisible) {
            this.ingotGoldAS.getImage().setVisible(ingotGVisible);
            this.turtleGoldAS.getImage().setVisible(turtleGVisible);
            this.junkGoldAS.getImage().setVisible(junkGVisible);
            this.phoenixGoldAS.getImage().setVisible(phoenixGVisible);
            this.ingotAS.getImage().setVisible(ingotVisible);
            this.turtleAS.getImage().setVisible(turtleVisible);
            this.junkAS.getImage().setVisible(junkVisible);
            this.phoenixAS.getImage().setVisible(phoenixVisible);
            this.allup.getImage().setVisible(allupVisible);
        };
        return ActiveSymbolAnim;
    })();
    exports.ActiveSymbolAnim = ActiveSymbolAnim;
    /**
     * @file HelpAndPaysBuilder.ts
     * @author Rachit.Shrivastava@scientificgames.com
     */
    /**
     * Utility class to parse through help data and inject help pages into the DOM
     */
    var HelpAndPaysBuilder = (function () {
        function HelpAndPaysBuilder() {
        }
        /**
         * Call to have game help built into a DOM element
         *
         * @param  element  element to build help into
         * @param  data  help configuration
         * @param  closeButtonHandler The function to call when the close button is activated.
         */
        HelpAndPaysBuilder.build = function (element, data, translator, closeButtonHandler, closeText, css) {
            var bgDiv = document.createElement("div");
            var containerDiv = document.createElement("div");
            var headerDiv = document.createElement("div");
            var tabsDiv = document.createElement("div");
            var footerDiv = document.createElement("div");
            //containerDiv.id = "help-content-container";
            /**
            * To make the help UI as responsive
            * Scaling factors depends on the size of the help-container
            * as compared to the background
            * @author Rachit.Shrivastava
            */
            var help = new HelpAndPaysResponsive(element);
            containerDiv = help.getContainer();
            bgDiv = help.getBGContainer();
            help.setResponsiveFactorX(0.83);
            help.setResponsiveFactorY(0.85);
            help.setResponsiveFactorMarginTop(2.25);
            help.setResponsiveFactorMarginLeft(2);
            help.enableResponsiveScaling();
            /******** END ********/
            headerDiv.id = "header";
            tabsDiv.id = "tabs";
            footerDiv.id = "footer";
            containerDiv.appendChild(headerDiv);
            containerDiv.appendChild(tabsDiv);
            containerDiv.appendChild(footerDiv);
            HelpAndPaysBuilder.buildSectionHeaders(data, headerDiv);
            HelpAndPaysBuilder.buildSections(data, tabsDiv, translator);
            HelpAndPaysBuilder.createFooter(data, footerDiv, closeButtonHandler, closeText);
            var style = document.createElement("style");
            style.type = "text/css";
            style.appendChild(document.createTextNode(css));
            containerDiv.appendChild(style);
            bgDiv.appendChild(containerDiv);
            element.appendChild(bgDiv);
            return bgDiv;
        };
        HelpAndPaysBuilder.getPaytable = function () {
            return HelpAndPaysBuilder.paytableDiv;
        };
        /**
         * Create a footer buttons
         *
         * @param   data help configuration
         * @param   footer HTMLDivElement
         */
        HelpAndPaysBuilder.createFooter = function (data, footer, closeButtonHandler, closeText) {
            var event;
            var container = document.createElement("div");
            var prev = document.createElement("div");
            var exit = document.createElement("div");
            var next = document.createElement("div");
            container.id = "container";
            prev.id = "prev-tab";
            prev.className = "btn";
            next.id = "next-tab";
            next.className = "btn";
            exit.id = "exit";
            exit.className = "btn";
            var exitSpan = document.createElement("span");
            exitSpan.id = "exit-span-text";
            exitSpan.innerHTML = closeText;
            exit.appendChild(exitSpan);
            container.appendChild(prev);
            container.appendChild(exit);
            container.appendChild(next);
            if (HelpAndPaysBuilder.isMobile()) {
                event = 'touchend';
            }
            else {
                event = 'click';
            }
            prev.addEventListener(event, function () {
                HelpAndPaysBuilder.prevButtonHandler();
            });
            next.addEventListener(event, function () {
                HelpAndPaysBuilder.nextButtonHandler();
            });
            exit.addEventListener(event, closeButtonHandler);
            footer.appendChild(container);
        };
        /**
         * Build out all the customizable section of help
         *
         * @param  element  element to put help in
         * @param  data  help configuration
         */
        HelpAndPaysBuilder.buildSections = function (data, element, translator) {
            var index = 0;
            var hasPaytable = false;
            data.sections.forEach(function (sectionData) {
                index++;
                var sectionDiv = document.createElement('div');
                sectionDiv.id = "tabs-" + index;
                if (index == 1)
                    sectionDiv.className = "tabs-show";
                else
                    sectionDiv.className = "tabs-hide";
                if (sectionData.pays != null) {
                    HelpAndPaysBuilder.buildPaytable(sectionData, sectionDiv);
                    hasPaytable = true;
                }
                if (sectionData.details != null) {
                    HelpAndPaysBuilder.createParagraphs(sectionData.details, sectionDiv, hasPaytable);
                }
                if (sectionData.image != null) {
                    var imageDiv = HelpAndPaysBuilder.buildSectionImages(sectionData, sectionDiv);
                    sectionDiv.appendChild(imageDiv);
                }
                if (sectionData.spays != null) {
                    var fubattable = HelpAndPaysBuilder.createfutable(sectionData, sectionDiv);
                    sectionDiv.appendChild(fubattable);
                }
                if (sectionData.futab != null) {
                    var fubatinfo = HelpAndPaysBuilder.createfuinfo(sectionData, sectionDiv);
                    sectionDiv.appendChild(fubatinfo);
                }
                if (sectionData.fusym != null) {
                    var fubatsym = HelpAndPaysBuilder.createfuSym(sectionData, sectionDiv);
                    sectionDiv.appendChild(fubatsym);
                }
                if (sectionData.wildimg != null) {
                    var WildDiv = HelpAndPaysBuilder.buildWildImage(sectionData, sectionDiv);
                    sectionDiv.appendChild(WildDiv);
                }
                element.appendChild(sectionDiv);
                if (index == 1) {
                    //Considering tab 1 for Paytables page
                    HelpAndPaysBuilder.paytableDiv = sectionDiv;
                }
            });
        };
        /**
         * Parses a paytable page
         *
        * @param  data paytable data for a game
        * @param container the element that we append items to
        */
        HelpAndPaysBuilder.buildPaytable = function (data, element) {
            var paytableDiv = document.createElement('div');
            paytableDiv.className = "paytablePage";
            HelpAndPaysBuilder.populatePageWithSymbols(data.pays, paytableDiv);
            element.appendChild(paytableDiv);
        };
        /**
       * Returns an unordered list of payout information
       *
       * @param payouts  array of payout multipliers
       */
        HelpAndPaysBuilder.buildPayouts = function (payouts) {
            var payList = document.createElement("ul"), length = payouts.length;
            //add special css class name for payouts that have 4 possible payouts
            payList.className = (length == 4) ? "FourPayValue" : "";
            for (var i = 0; i < length; i++) {
                var payListItem = document.createElement("li");
                payListItem.innerHTML = payouts[i].toString();
                payListItem.setAttribute("data-multiplier", payouts[i].toString());
                payList.appendChild(payListItem);
            }
            return payList;
        };
        /**
         * Populates a page with reel symbols
         *
        * @param  symbols array of reel symbols
        * @param container the element that we append items to
        */
        HelpAndPaysBuilder.populatePageWithSymbols = function (symbols, pagingDiv) {
            var i = 0;
            while (symbols.length > 0) {
                i++;
                var paytableImage = symbols.shift(), paytableElementContainer = document.createElement("div"), symbolWrapper = document.createElement("div"), payList = document.createElement("ul"), symbolName = document.createElement("span");
                if (paytableImage) {
                    if (paytableImage.image) {
                        symbolWrapper.appendChild(paytableImage.image);
                    }
                    symbolName.innerHTML = paytableImage.name;
                    symbolWrapper.appendChild(symbolName);
                    payList = HelpAndPaysBuilder.buildPayouts(paytableImage.payMultipliers);
                }
                paytableElementContainer.id = "pays-" + i;
                paytableElementContainer.className = "pays-element-wrapper";
                paytableElementContainer.appendChild(symbolWrapper);
                paytableElementContainer.appendChild(payList);
                pagingDiv.appendChild(paytableElementContainer);
            }
        };
        /**
         * Creates Images inside a scetion
         */
        HelpAndPaysBuilder.buildSectionImages = function (data, element) {
            var imageDiv = document.createElement('div');
            imageDiv.className = 'img-container';
            var i = 0;
            data.image.forEach(function (imageData) {
                i++;
                var imgDiv = document.createElement('div');
                imgDiv.id = "img-" + i;
                imgDiv.className = "img";
                var imgSrcDiv = document.createElement("div");
                imgSrcDiv.className = "img-img";
                imgSrcDiv.style.backgroundImage = "url('" + imageData.path + "')";
                imgDiv.appendChild(imgSrcDiv);
                if (imageData.name != undefined) {
                    var imgNameDiv = document.createElement("span");
                    imgNameDiv.className = "img-txt";
                    imgNameDiv.innerHTML = imageData.name;
                    imgDiv.appendChild(imgNameDiv);
                }
                imageDiv.appendChild(imgDiv);
            });
            return imageDiv;
        };
        HelpAndPaysBuilder.buildWildImage = function (data, element) {
            var imageDiv = document.createElement('div');
            imageDiv.className = 'wild-container';
            var clearDiv = document.createElement("div");
            clearDiv.className = "clear";
            imageDiv.appendChild(clearDiv);
            data.wildimg.forEach(function (imageData) {
                var imgNameDiv = document.createElement("span");
                imgNameDiv.className = "wild-txt";
                imgNameDiv.innerHTML = imageData.name;
                imageDiv.appendChild(imgNameDiv);
                var clearDiv = document.createElement("div");
                clearDiv.className = "clear";
                imageDiv.appendChild(clearDiv);
                var imgDiv = document.createElement('div');
                imgDiv.className = "wildimgholder";
                var imgSrcDiv = document.createElement("img");
                imgSrcDiv.className = "img-img";
                imgSrcDiv.src = imageData.path;
                imgDiv.appendChild(imgSrcDiv);
                var imgTextDiv = document.createElement("div");
                imgTextDiv.className = "wild-txt1";
                imgTextDiv.innerHTML = imageData.text;
                imgDiv.appendChild(imgTextDiv);
                imageDiv.appendChild(imgDiv);
            });
            return imageDiv;
        };
        /* creates helpscreen fubat pays */
        HelpAndPaysBuilder.createfutable = function (data, element) {
            var tableEle = document.createElement("TABLE");
            tableEle.className = 'futable';
            data.spays.forEach(function (imageData) {
                var tableRow = document.createElement("TR");
                tableEle.appendChild(tableRow);
                if (imageData.name != undefined) {
                    var txt = imageData.name.split(" ");
                    var tdtxtEle = document.createElement("TD");
                    for (var x = 0; x < txt.length; x++) {
                        var txtspan = document.createElement("span");
                        txtspan.className = "highlight";
                        txtspan.innerHTML = txt[x] + " ";
                        tdtxtEle.appendChild(txtspan);
                    }
                    tableRow.appendChild(tdtxtEle);
                }
                for (var jj = 0; jj < imageData.image.length; jj++) {
                    var tdEle = document.createElement("TD");
                    var imgSrcDiv = document.createElement("div");
                    imgSrcDiv.className = "futableimg";
                    imgSrcDiv.style.backgroundImage = "url('" + imageData.image[jj] + "')";
                    tdEle.appendChild(imgSrcDiv);
                    tableRow.appendChild(tdEle);
                }
            });
            return tableEle;
        };
        HelpAndPaysBuilder.createfuinfo = function (data, element) {
            var tableEle = document.createElement("TABLE");
            tableEle.className = 'futable';
            data.futab.forEach(function (imageData) {
                var tableRow = document.createElement("TR");
                tableEle.appendChild(tableRow);
                var tdEle = document.createElement("TD");
                var imgSrcDiv = document.createElement("div");
                imgSrcDiv.className = "futableimg";
                imgSrcDiv.style.backgroundImage = "url('" + imageData.image + "')";
                tdEle.appendChild(imgSrcDiv);
                tableRow.appendChild(tdEle);
                var tdtxtEle = document.createElement("TD");
                var txtspan = document.createElement("span");
                txtspan.innerHTML = imageData.name;
                tdtxtEle.appendChild(txtspan);
                tableRow.appendChild(tdtxtEle);
            });
            return tableEle;
        };
        HelpAndPaysBuilder.createfuSym = function (data, element) {
            var tableEle = document.createElement("TABLE");
            tableEle.setAttribute('border', '1');
            tableEle.className = 'fuinfo';
            var tableHeaderRow = document.createElement("TR");
            tableEle.appendChild(tableHeaderRow);
            var thtxtEle1 = document.createElement("TD");
            var txtspan = document.createElement("span");
            txtspan.innerHTML = data.translator.findByKey('Gold_symbols_played_txt');
            thtxtEle1.appendChild(txtspan);
            tableHeaderRow.appendChild(thtxtEle1);
            var thtxtEle6 = document.createElement("TD");
            thtxtEle6.className = 'fuTDinfo';
            var txtspan2 = document.createElement("span");
            txtspan2.innerHTML = data.translator.findByKey('Five_txt');
            thtxtEle6.appendChild(txtspan2);
            var txtspan4 = document.createElement("span");
            txtspan4.innerHTML = "<br>(" + data.translator.findByKey('Eightyeight_txt');
            thtxtEle6.appendChild(txtspan4);
            var txtspan5 = document.createElement("span");
            txtspan5.innerHTML = " " + data.translator.findByKey('Credits_txt') + ")";
            thtxtEle6.appendChild(txtspan5);
            tableHeaderRow.appendChild(thtxtEle6);
            var thtxtEle5 = document.createElement("TD");
            thtxtEle5.className = 'fuTDinfo';
            var txtspan2 = document.createElement("span");
            txtspan2.innerHTML = data.translator.findByKey('Four_txt');
            thtxtEle5.appendChild(txtspan2);
            var txtspan4 = document.createElement("span");
            txtspan4.innerHTML = "<br>(" + data.translator.findByKey('Sixtyeight_txt');
            thtxtEle5.appendChild(txtspan4);
            var txtspan5 = document.createElement("span");
            txtspan5.innerHTML = " " + data.translator.findByKey('Credits_txt') + ")";
            thtxtEle5.appendChild(txtspan5);
            tableHeaderRow.appendChild(thtxtEle5);
            var thtxtEle4 = document.createElement("TD");
            thtxtEle4.className = 'fuTDinfo';
            var txtspan2 = document.createElement("span");
            txtspan2.innerHTML = data.translator.findByKey('Three_txt');
            thtxtEle4.appendChild(txtspan2);
            var txtspan4 = document.createElement("span");
            txtspan4.innerHTML = "<br>(" + data.translator.findByKey('Thirtyeight_txt');
            thtxtEle4.appendChild(txtspan4);
            var txtspan5 = document.createElement("span");
            txtspan5.innerHTML = " " + data.translator.findByKey('Credits_txt') + ")";
            thtxtEle4.appendChild(txtspan5);
            tableHeaderRow.appendChild(thtxtEle4);
            var thtxtEle3 = document.createElement("TD");
            thtxtEle3.className = 'fuTDinfo';
            var txtspan2 = document.createElement("span");
            txtspan2.innerHTML = data.translator.findByKey('Two_txt');
            thtxtEle3.appendChild(txtspan2);
            var txtspan4 = document.createElement("span");
            txtspan4.innerHTML = "<br>(" + data.translator.findByKey('Eighteen_txt');
            thtxtEle3.appendChild(txtspan4);
            var txtspan5 = document.createElement("span");
            txtspan5.innerHTML = " " + data.translator.findByKey('Credits_txt') + ")";
            thtxtEle3.appendChild(txtspan5);
            tableHeaderRow.appendChild(thtxtEle3);
            var thtxtEle2 = document.createElement("TD");
            thtxtEle2.className = 'fuTDinfo';
            var txtspan2 = document.createElement("span");
            txtspan2.innerHTML = data.translator.findByKey('One_txt');
            thtxtEle2.appendChild(txtspan2);
            var txtspan4 = document.createElement("span");
            txtspan4.innerHTML = "<br>(" + data.translator.findByKey('Eight_txt');
            thtxtEle2.appendChild(txtspan4);
            var txtspan5 = document.createElement("span");
            txtspan5.innerHTML = " " + data.translator.findByKey('Credits_txt') + ")";
            thtxtEle2.appendChild(txtspan5);
            tableHeaderRow.appendChild(thtxtEle2);
            data.fusym.forEach(function (faData) {
                var tableRow = document.createElement("TR");
                tableEle.appendChild(tableRow);
                if (faData.tcontent.name != "") {
                    var tdtxtEle = document.createElement("TD");
                    tdtxtEle.setAttribute('rowspan', '4');
                    var txtspan = document.createElement("span");
                    txtspan.innerHTML = faData.tcontent.name;
                    tdtxtEle.appendChild(txtspan);
                    tableRow.appendChild(tdtxtEle);
                }
                for (var jj = 0; jj < faData.tcontent.type.length; jj++) {
                    var tdtxtEle = document.createElement("TD");
                    var txtspan = document.createElement("span");
                    txtspan.innerHTML = faData.tcontent.type[jj];
                    tdtxtEle.appendChild(txtspan);
                    tableRow.appendChild(tdtxtEle);
                }
                /*var tdtxtEle = document.createElement("TD");
                var txtspan = document.createElement("span");
                txtspan.innerHTML = imageData.name;
                tdtxtEle.appendChild(txtspan);
                tableRow.appendChild(tdtxtEle);*/
            });
            return tableEle;
        };
        /**
         * Creates Sectional Headers
         */
        HelpAndPaysBuilder.buildSectionHeaders = function (data, element) {
            var index = 0;
            data.sections.forEach(function (sectionData) {
                if (sectionData.header != null) {
                    HelpAndPaysBuilder.headerContent[index] = sectionData.header;
                }
                else {
                    HelpAndPaysBuilder.headerContent[index] = "";
                }
                index++;
            });
            element.innerHTML = HelpAndPaysBuilder.headerContent[0];
        };
        /**
        * Creates a <p> DOM element and appends to an element
        *
        * @param  items  paragraph items
        * @param  element  element to append to
        */
        HelpAndPaysBuilder.createParagraphs = function (items, element, hasPaytable) {
            var detailsCnt = items.length;
            if (hasPaytable) {
                var paytableText = document.createElement("div");
                paytableText.className = "paytableText";
                for (var i = 0; i < detailsCnt; ++i) {
                    var para = document.createElement("p");
                    para.innerHTML = items[i];
                    paytableText.appendChild(para);
                }
                element.appendChild(paytableText);
            }
            else {
                for (var i = 0; i < detailsCnt; ++i) {
                    var para = document.createElement("p");
                    para.innerHTML = items[i];
                    element.appendChild(para);
                }
            }
        };
        HelpAndPaysBuilder.prevButtonHandler = function () {
            console.log("prev");
            var tabsDiv = document.getElementById("tabs");
            var header = document.getElementById("header");
            var nodes = tabsDiv.childNodes;
            var hide = document.createAttribute("class");
            hide.value = "tabs-hide";
            var show = document.createAttribute("class");
            show.value = "tabs-show";
            for (var i = 0; i < nodes.length; i++) {
                var className = nodes[i].attributes.getNamedItem("class");
                if (className.value == "tabs-show" && i != 0) {
                    nodes[i].attributes.setNamedItem(hide);
                    nodes[i - 1].attributes.setNamedItem(show);
                    tabsDiv.scrollTop = 0;
                    HelpAndPaysBuilder.checkTabNumber(i - 1);
                    header.innerHTML = HelpAndPaysBuilder.headerContent[i - 1];
                    break;
                }
            }
        };
        HelpAndPaysBuilder.nextButtonHandler = function () {
            console.log("next");
            var tabsDiv = document.getElementById("tabs");
            var header = document.getElementById("header");
            var nodes = tabsDiv.childNodes;
            var hide = document.createAttribute("class");
            hide.value = "tabs-hide";
            var show = document.createAttribute("class");
            show.value = "tabs-show";
            for (var i = 0; i < nodes.length; i++) {
                var className = nodes[i].attributes.getNamedItem("class");
                if (className.value == "tabs-show" && i != nodes.length - 1) {
                    nodes[i].attributes.setNamedItem(hide);
                    nodes[i + 1].attributes.setNamedItem(show);
                    tabsDiv.scrollTop = 0;
                    HelpAndPaysBuilder.checkTabNumber(i + 1);
                    header.innerHTML = HelpAndPaysBuilder.headerContent[i + 1];
                    break;
                }
            }
        };
        HelpAndPaysBuilder.reset = function () {
            var tabsDiv = document.getElementById("tabs");
            var header = document.getElementById("header");
            var nodes = tabsDiv.childNodes;
            for (var i = 0; i < nodes.length; i++) {
                var hide = document.createAttribute("class");
                hide.value = "tabs-hide";
                nodes[i].attributes.setNamedItem(hide);
            }
            var show = document.createAttribute("class");
            show.value = "tabs-show";
            nodes[0].attributes.setNamedItem(show);
            tabsDiv.scrollTop = 0;
            HelpAndPaysBuilder.checkTabNumber(0);
            header.innerHTML = HelpAndPaysBuilder.headerContent[0];
        };
        HelpAndPaysBuilder.isMobile = function () {
            return (navigator.userAgent.match(/Android/i) != null || navigator.userAgent.match(/iPhone|iPad|iPod/i) != null);
        };
        HelpAndPaysBuilder.checkTabNumber = function (index) {
            var tabsDiv = document.getElementById("tabs");
            var totalTabs = tabsDiv.childNodes.length;
            var btnDullPath = "data:image/png;base64,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";
            var btnPath = "data:image/png;base64,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";
            if (index == 0) {
                //Left Arrow to be dull
                var arrow = document.getElementById("prev-tab");
                arrow.style.backgroundImage = "url('" + btnDullPath + "')";
                var arrow = document.getElementById("next-tab");
                arrow.style.backgroundImage = "url('" + btnPath + "')";
            }
            else if (index == (totalTabs - 1)) {
                //Right Arrow to be dull
                var arrow = document.getElementById("next-tab");
                arrow.style.backgroundImage = "url('" + btnDullPath + "')";
            }
            else {
                var arrow = document.getElementById("prev-tab");
                arrow.style.backgroundImage = "url('" + btnPath + "')";
                var arrow = document.getElementById("next-tab");
                arrow.style.backgroundImage = "url('" + btnPath + "')";
            }
        };
        HelpAndPaysBuilder.headerContent = [];
        return HelpAndPaysBuilder;
    })();
    exports.HelpAndPaysBuilder = HelpAndPaysBuilder;
    /**
     * @file HelpAndPaysResponsive.ts
     * @author Rachit.Shrivastava@scientificgames.com
     *
     * @class
     * Represents a HelpAndPaysResponsive element in the DOM
     */
    var HelpAndPaysResponsive = (function () {
        /**
         * Create HelpAndPays object
         *
         * @param  parentDiv  the parent div object the HelpAndPays is on
         * @param  width  width in pixels of the HelpAndPays
         * @param  height  height in pixels of the HelpAndPays
         */
        function HelpAndPaysResponsive(parentDiv, width, height) {
            this.responsive = false;
            this.fitWindow = false;
            this.parentDiv = parentDiv;
            this.canvas = document.getElementsByTagName("canvas")[0];
            if (parentDiv != undefined && parentDiv != null) {
                this.helpOuterDiv = document.createElement('div');
                this.helpOuterDiv.className = 'help-outer';
                this.helpOuterDiv.style.position = 'absolute';
                this.helpOuterDiv.style.overflow = 'hidden';
                this.helpOuterDiv.style.width = '100%';
                this.helpOuterDiv.style.height = '100%';
                this.helpDiv = document.createElement('div');
                this.helpDiv.className = 'help-content-container';
                this.helpDiv.style.position = 'absolute';
                this.helpDiv.style.overflow = 'hidden';
                this.helpDiv.style.width = '100%';
                this.helpDiv.style.height = '100%';
            }
            this.responsiveFactorX = 1;
            this.responsiveFactorY = 1;
            this.responsiveMarginLeft = 2;
            this.responsiveMarginTop = 2;
            this.checkResponsiveTime = 0;
            this.checkResponsiveTimeout = 0.5;
            this.currentWindowWidth = 0;
            this.currentWindowHeight = 0;
            this.currentWindowArea = 0;
        }
        HelpAndPaysResponsive.prototype.getContainer = function () {
            return this.helpDiv;
        };
        HelpAndPaysResponsive.prototype.getBGContainer = function () {
            return this.helpOuterDiv;
        };
        /**
         * Set the scaling factor used for respsonsive
         */
        HelpAndPaysResponsive.prototype.setResponsiveFactorX = function (x) {
            this.responsiveFactorX = x;
        };
        /**
         * Set the scaling factor used for respsonsive
         */
        HelpAndPaysResponsive.prototype.setResponsiveFactorY = function (y) {
            this.responsiveFactorY = y;
        };
        /**
         * Set the Margin factor used for respsonsive
         */
        HelpAndPaysResponsive.prototype.setResponsiveFactorMarginLeft = function (x) {
            this.responsiveMarginLeft = x;
        };
        /**
         * Set the Margin factor used for respsonsive
         */
        HelpAndPaysResponsive.prototype.setResponsiveFactorMarginTop = function (y) {
            this.responsiveMarginTop = y;
        };
        /**
         * Setup the HelpAndPays to be responsize
         */
        HelpAndPaysResponsive.prototype.enableResponsiveScaling = function () {
            var _this = this;
            this.handleResponsive();
            TweenLite.ticker.addEventListener('tick', function (e) { return _this.handleTick(e); }, this, true, 1);
            this.currentWindowWidth = this.parentDiv.clientWidth;
            ;
            this.currentWindowHeight = this.parentDiv.clientHeight;
            this.currentWindowArea = this.parentDiv.clientWidth * this.parentDiv.clientHeight;
        };
        /**
         * Set the flag to override the responsive scaling of the HelpAndPays and have the HelpAndPays will the
         * window that it is in.
         */
        HelpAndPaysResponsive.prototype.fitToWindow = function () {
            var _this = this;
            this.fitWindow = true;
            TweenLite.ticker.addEventListener('tick', function (e) { return _this.handleTick(e); }, this, true, 1);
            this.handleResponsive();
        };
        /**
         * Handles the tick event from GSAP
         *
         * @param  tickerEvent  contains time info
         */
        HelpAndPaysResponsive.prototype.handleTick = function (tickerEvent) {
            this.checkResponsiveTime += tickerEvent.target.time;
            if (this.checkResponsiveTime >= this.checkResponsiveTimeout) {
                this.checkResponsiveTime = 0;
                this.checkWindowSize();
            }
        };
        /**
         * Check to see window size has changed so we can respond
         */
        HelpAndPaysResponsive.prototype.checkWindowSize = function () {
            var windowWidth = this.parentDiv.clientWidth;
            var windowHeight = this.parentDiv.clientHeight;
            var windowArea = this.parentDiv.clientWidth * this.parentDiv.clientHeight;
            if (windowWidth != this.currentWindowWidth || windowHeight != this.currentWindowHeight || windowArea != this.currentWindowArea) {
                this.handleResponsive();
            }
            this.currentWindowWidth = this.parentDiv.clientWidth;
            ;
            this.currentWindowHeight = this.parentDiv.clientHeight;
            this.currentWindowArea = this.parentDiv.clientWidth * this.parentDiv.clientHeight;
        };
        /**
         * Handles responsive resizing
         */
        HelpAndPaysResponsive.prototype.handleResponsive = function () {
            var widthToHeight = (this.canvas.width / this.canvas.height);
            var newWidth = this.parentDiv.offsetWidth;
            var newHeight = this.parentDiv.offsetHeight;
            var newWidthToHeight = newWidth / newHeight;
            if (newWidthToHeight > widthToHeight)
                newWidth = newHeight * widthToHeight;
            else
                newHeight = newWidth / widthToHeight;
            if (this.fitWindow) {
                newWidth = this.parentDiv.offsetWidth;
                newHeight = this.parentDiv.offsetHeight;
            }
            if (this.helpOuterDiv != undefined) {
                this.helpOuterDiv.style.width = newWidth + 'px';
                this.helpOuterDiv.style.height = newHeight + 'px';
                // Make the HelpAndPays element be in the required position of the parent element
                this.helpOuterDiv.style.top = '50%';
                this.helpOuterDiv.style.marginTop = '-' + (newHeight / 2) + 'px';
                this.helpOuterDiv.style.left = '50%';
                this.helpOuterDiv.style.marginLeft = '-' + (newWidth / 2) + 'px';
            }
            newWidth = newWidth * this.responsiveFactorX;
            newHeight = newHeight * this.responsiveFactorY;
            if (this.helpDiv != undefined) {
                this.helpDiv.style.width = newWidth + 'px';
                this.helpDiv.style.height = newHeight + 'px';
                // Make the HelpAndPays element be in the required position of the parent element
                this.helpDiv.style.top = '50%';
                this.helpDiv.style.marginTop = '-' + (newHeight / this.responsiveMarginTop) + 'px';
                this.helpDiv.style.left = '50%';
                this.helpDiv.style.marginLeft = '-' + (newWidth / this.responsiveMarginLeft) + 'px';
            }
        };
        return HelpAndPaysResponsive;
    })();
    exports.HelpAndPaysResponsive = HelpAndPaysResponsive;
    /**
     * Settings
     * @class eef.Settings
     * @classdesc Handles the behavior for user settings
     */
    var Settings = (function () {
        /**
         * @constructor
         */
        function Settings(helpAndPays, baseBundle, scalar, inputHandler, spinButton, helpButton) {
            var _this = this;
            this.baseBundle = baseBundle;
            this.inputHandler = inputHandler;
            this.scalar = scalar;
            this.iconHandlersSet = false;
            this.menuSelectionAllowed = false;
            this.duration = 0.25;
            this.isAllowed = true;
            this.helpButton = helpButton;
            this.spinButton = spinButton;
            this.helpAndPays = helpAndPays;
            this.helpAndPays.getEvents().add({
                onClose: function () {
                    _this.resetSettingsIcons();
                }
            });
        }
        /**
         * Gets the help and pays object
         * @method eef.Settings#getHelpAndPays
         * @public
         * @returns {HelpAndPays} The help and pays object
         */
        Settings.prototype.getHelpAndPays = function () {
            return this.helpAndPays;
        };
        Settings.prototype.getIsAllowed = function () {
            return this.isAllowed;
        };
        /**
         * Resets all menu to their default state
         * @method eef.Settings#resetMenus
         * @private
         */
        Settings.prototype.resetMenus = function () {
            this.resetSettingsIcons();
        };
        /**
         * Resets all icons to the default state
         * @method eef.Settings#resetSettingsIcons
         * @private
         */
        Settings.prototype.resetSettingsIcons = function () {
        };
        /**
         * Toggles the help
         * @method eef.Settings#toggleHelp
         * @param {abg2d.Actor} actor The actor to toggle
         * @private
         */
        Settings.prototype.toggleHelp = function (actor) {
        };
        /**
         * Wires up an input handler for an actor
         * @method eef.UIController#setInputHandler
         * @private
         * @param {abg2d.Actor} actor The actor to add input handling to
         * @param {number} xPos The x position of the region
         * @param {number} yPos The y position of the region
         * @param {Function} handler The event to fire when the element is clicked
         */
        Settings.prototype.setInputHandler = function (actor, xPos, yPos, handler) {
            var rect = new abg2d.Rect();
            var image = actor.getImage();
            image.getDrawBounds(rect);
            var transform = actor.getTransform();
            var inputResolver = new input.InputResolver(xPos, yPos, image.getWidth(), image.getHeight());
            abg2d.Factory.composeInputRegion(actor, inputResolver, rect, handler);
            this.inputHandler.addResolver(inputResolver);
        };
        return Settings;
    })();
    exports.Settings = Settings;
    /// <reference path="../EEFConfig.ts" />
    /**
     * Manager for the help and paytable display.
     */
    var HelpAndPays = (function () {
        /**
         * @constructor
         */
        function HelpAndPays(translator, currencyFormatter, baseBundle, glsRequestor, element, betMenu, metaData) {
            var _this = this;
            this.translator = translator;
            this.betMenu = betMenu;
            this.metaData = metaData;
            this.currencyFormatter = currencyFormatter;
            this.baseBundle = baseBundle;
            this.maxWinFlag = metaData.getMaxWinStatus();
            this.isNT = metaData.getPartnerCode() === "mocknorsktipping" || metaData.getPartnerCode() === "em_norsktipping" || metaData.getPartnerCode() === "em_norsktipping_fun";
            this.signal = {
                onClose: null
            };
            this.betMenu.getEvents().add({
                onClicked: function (clickedval) {
                    _this.betno = Number(clickedval);
                    _this.updatePays();
                }
            });
            this.eventDispatcher = new events.EventDispatcher(this.signal);
            glsRequestor.getEvents().add({
                onInitResponse: function (initResponse) {
                    _this.gameData = initResponse.getGameData();
                    var wincap = initResponse.getGameData().getWinCapAmount();
                    //var rtp = initResponse.getGameData().getReturnToPlayer();
                    //var bets: number[] = initResponse.getGameData().getBetConfiguration().getAvailableBets();
                    //  var maxBetMultiplier: any = initResponse.getGameData().getBetConfiguration().getMultiplierBets();
                    //var maxBet:number = bets[bets.length-1] * maxBetMultiplier[maxBetMultiplier.length-1];
                    //   var maxBet = 0;
                    var currencyMultiplier = initResponse.getPlatformData().getCurrencyMultiplier();
                    var exitBtnText = _this.translator.findByKey("Exit_Button_txt");
                    var helpData = _this.createHelpData(baseBundle, currencyMultiplier, wincap, _this.maxWinFlag);
                    _this.helpElement = HelpAndPaysBuilder.build(element, helpData, _this.translator, function () {
                        _this.showHelp(false);
                        HelpAndPaysBuilder.reset();
                        _this.signal.onClose();
                    }, exitBtnText);
                    // Add an explicit touchmove event handler to the help and pays elements, to work around the
                    // partner adapter's global touchmove event blocking.
                    _this.helpElement.addEventListener('touchmove', function (ee) {
                        ee.stopPropagation();
                        return true;
                    }, false);
                    _this.paytableElement = HelpAndPaysBuilder.getPaytable();
                    _this.showHelp(false);
                    if (_this.maxWinFlag == "OFF") {
                        document.getElementById("tabs-5").getElementsByTagName("p")[4].style.display = "none";
                    }
                },
                onPlayResponse: null,
                onEndResponse: null,
                onError: null
            });
        }
        /**
         * Gets the event dispatcher
         * @method tit.HelpAndPays#getEvents
         * @public
         * @returns {events.EventDispatcher<IHelpAndPaysListener>} The event dispatcher
         */
        HelpAndPays.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Shows the help page
         * @method tit.HelpAndPays#showHelp
         * @public
         * @param {boolean} show True to show the help page
         */
        HelpAndPays.prototype.showHelp = function (show) {
            if (this.helpElement != null) {
                this.helpElement.style.display = (show) ? "block" : "none";
                var tabsDiv = document.getElementById("tabs");
                tabsDiv.scrollTop = 0;
            }
        };
        /**
         * Attaches a listener to the bet controller
         * @method tit.HelpAndPays#setupBetListener
         * @public
         * @param {BetController} bc The bet controller
         */
        HelpAndPays.prototype.setupBetListener = function (bc) {
            var _this = this;
            this.paysController = new PaysController(this.paytableElement, 5);
            //this.updatePaytable(bc.getCurrentBet());
            this.betno = bc.getCurrentBet().getBetPerUnit();
            this.multiplierno = bc.getCurrentMultiplier().getMultiplier();
            this.updatePays();
            bc.getEvents().add({
                onBetChange: function (bet) {
                },
                onMultiplierChange: function (multiplier) {
                    _this.multiplierno = multiplier.getMultiplier();
                    _this.updatePays();
                }
            });
        };
        HelpAndPays.prototype.updateBets = function (betno, multiplier) {
            this.betno = Number(betno);
            this.multiplierno = Number(multiplier);
            this.updatePays();
        };
        /**
         * Creates the help data
         * @method tit.HelpAndPays#createHelpData
         * @public
         * @param {BaseBundle} baseBundle The base bundle of assets
         * @returns {IHelpAndPaysData} The created data
         */
        HelpAndPays.prototype.createHelpData = function (baseBundle, currencyMultiplier, winCap, maxWin) {
            var bets = this.gameData.getBetConfiguration().getAvailableBets();
            var maxBetMultiplier = this.gameData.getBetConfiguration().getMultiplierBets();
            var maxBet = bets[bets.length - 1] * maxBetMultiplier[maxBetMultiplier.length - 1];
            if (this.metaData.getLocale() == "de_DE" || this.metaData.getLocale() == "de_de") {
                var data = {
                    sections: [
                        {
                            header: this.translator.findByKey('paytable_txt'),
                            pays: [
                                this.createPaytableSymbol('H1', baseBundle.symbols, [1000, 200, 100], currencyMultiplier, 1, false),
                                this.createPaytableSymbol('H2', baseBundle.symbols, [500, 100, 50], currencyMultiplier, 2, false),
                                this.createPaytableSymbol('H3', baseBundle.symbols, [400, 80, 40], currencyMultiplier, 2, false),
                                this.createPaytableSymbol('H4', baseBundle.symbols, [250, 50, 25], currencyMultiplier, 2, false),
                                this.createPaytableSymbol('H5', baseBundle.symbols, [100, 20, 10], currencyMultiplier, 2, false),
                                this.createPaytableSymbol('M1', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 3, false),
                                this.createPaytableSymbol('M2', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 4, false),
                                this.createPaytableSymbol('M3', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 5, false),
                                this.createPaytableSymbol('M4', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 6, false),
                                this.createPaytableSymbol('M5', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 6, false),
                                this.createPaytableSymbol('L1', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 8, false),
                                this.createPaytableSymbol('L2', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 9, false),
                                this.createPaytableSymbol('L3', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 10, false),
                                this.createPaytableSymbol('L4', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 11, false),
                                this.createPaytableSymbol('L5', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 11, false),
                                this.createPaytableSymbol('GONG', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 11, true)
                            ],
                            wildimg: [
                                { path: baseBundle.wildimage.getPath(), name: this.translator.findByKey('Wild_txt'), text: this.translator.findByKey('Wild_txt1') }
                            ]
                        },
                        {
                            header: this.translator.findByKey('SpecialPays_Header'),
                            image: [
                                { path: baseBundle.helpAllUp.getPath() }
                            ],
                            details: [
                                this.translator.findByKey('SpecialPays_text1') + " " + this.translator.findByKey('SpecialPays_text2') + " " + this.translator.findByKey('SpecialPays_text3'),
                                this.translator.findByKey('SpecialPays_text4'),
                                this.translator.findByKey('SpecialPays_text5') + " " + this.translator.findByKey('SpecialPays_text6')
                            ],
                            spays: [
                                this.createfudata(this.translator.findByKey('P1GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingot.getPath(), baseBundle.helpturtle.getPath(), baseBundle.helpjunk.getPath(), baseBundle.helppheonix.getPath()),
                                this.createfudata(this.translator.findByKey('P2GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingotgold.getPath(), baseBundle.helpturtle.getPath(), baseBundle.helpjunk.getPath(), baseBundle.helppheonix.getPath()),
                                this.createfudata(this.translator.findByKey('P3GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingotgold.getPath(), baseBundle.helpturtlegold.getPath(), baseBundle.helpjunk.getPath(), baseBundle.helppheonix.getPath()),
                                this.createfudata(this.translator.findByKey('P4GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingotgold.getPath(), baseBundle.helpturtlegold.getPath(), baseBundle.helpjunkgold.getPath(), baseBundle.helppheonix.getPath()),
                                this.createfudata(this.translator.findByKey('P5GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingotgold.getPath(), baseBundle.helpturtlegold.getPath(), baseBundle.helpjunkgold.getPath(), baseBundle.helppheonixgold.getPath())
                            ]
                        },
                        {
                            header: this.translator.findByKey('Fubat_Header'),
                            details: [
                                this.translator.findByKey('Fubat_text1') + " " + this.translator.findByKey('Fubat_text2') + " " + this.translator.findByKey('Fubat_text3') + " " + this.translator.findByKey('Fubat_text4') + " " + this.translator.findByKey('Fubat_text5') + " " + this.translator.findByKey('Fubat_text6')
                            ],
                            image: [
                                { path: this.baseBundle.grandicon.getPath(), name: this.translator.findByKey('Grand_jackpot') },
                                { path: this.baseBundle.majoricon.getPath(), name: this.translator.findByKey('Major_jackpot') },
                                { path: this.baseBundle.minoricon.getPath(), name: this.translator.findByKey('Minor_jackpot') },
                                { path: this.baseBundle.miniicon.getPath(), name: this.translator.findByKey('Mini_jackpot') }
                            ],
                            fusym: [
                                this.createfusym(this.translator.findByKey('Jackpots_available'), this.translator.findByKey('Mini_txt'), this.translator.findByKey('Mini_txt'), this.translator.findByKey('Mini_txt'), this.translator.findByKey('Mini_txt'), this.translator.findByKey('None_txt')),
                                this.createfusym('', this.translator.findByKey('Minor_txt'), this.translator.findByKey('Minor_txt'), this.translator.findByKey('Minor_txt'), '', ''),
                                this.createfusym('', this.translator.findByKey('Major_txt'), this.translator.findByKey('Major_txt'), '', '', ''),
                                this.createfusym('', this.translator.findByKey('Grand_txt'), '', '', '', '')
                            ],
                            translator: this.translator
                        },
                        {
                            header: this.translator.findByKey('FreeGames_Header'),
                            details: [
                                this.translator.findByKey('FreeGames_text1') + " " + this.translator.findByKey('FreeGames_text2') + " " + this.translator.findByKey('FreeGames_text3') + " " + this.translator.findByKey('FreeGames_text4') + " " + this.translator.findByKey('FreeGames_text5') + " " + this.translator.findByKey('FreeGames_text6') + " " + this.translator.findByKey('FreeGames_text7')
                            ]
                        },
                        {
                            header: this.translator.findByKey('AnyWay_Header'),
                            details: [
                                this.translator.findByKey('AnyWay_text1') + " " + this.translator.findByKey('AnyWay_text2') + " " + this.translator.findByKey('AnyWay_text3') + " " + this.translator.findByKey('AnyWay_text4') + " " + this.translator.findByKey('AnyWay_text5') + " " + this.translator.findByKey('AnyWay_text6'),
                                this.translator.findByKey('AnyWay_text7'),
                                this.translator.findByKey('maxAward_SingleLine'),
                                this.translator.findByKey('probability_maxAward'),
                                this.translator.findByKey('AnyWay_text8'),
                                this.formatTranslation('AnyWay_text9', [this.currencyFormatter.format(winCap)], maxWin),
                                this.translator.findByKey('AnyWay_text10'),
                                this.translator.findByKey('AnyWay_text11'),
                                this.translator.findByKey('Gameversion_txt') + EEFConfig.CLIENT_VERSION,
                                this.translator.findByKey('serverVersion') + EEFConfig.SERVER_VERSION
                            ]
                        }
                    ]
                };
            }
            else {
                var data = {
                    sections: [
                        {
                            header: this.translator.findByKey('paytable_txt'),
                            pays: [
                                this.createPaytableSymbol('H1', baseBundle.symbols, [1000, 200, 100], currencyMultiplier, 1, false),
                                this.createPaytableSymbol('H2', baseBundle.symbols, [500, 100, 50], currencyMultiplier, 2, false),
                                this.createPaytableSymbol('H3', baseBundle.symbols, [400, 80, 40], currencyMultiplier, 2, false),
                                this.createPaytableSymbol('H4', baseBundle.symbols, [250, 50, 25], currencyMultiplier, 2, false),
                                this.createPaytableSymbol('H5', baseBundle.symbols, [100, 20, 10], currencyMultiplier, 2, false),
                                this.createPaytableSymbol('M1', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 3, false),
                                this.createPaytableSymbol('M2', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 4, false),
                                this.createPaytableSymbol('M3', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 5, false),
                                this.createPaytableSymbol('M4', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 6, false),
                                this.createPaytableSymbol('M5', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 6, false),
                                this.createPaytableSymbol('L1', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 8, false),
                                this.createPaytableSymbol('L2', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 9, false),
                                this.createPaytableSymbol('L3', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 10, false),
                                this.createPaytableSymbol('L4', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 11, false),
                                this.createPaytableSymbol('L5', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 11, false),
                                this.createPaytableSymbol('GONG', baseBundle.symbols, [50, 10, 5], currencyMultiplier, 11, true)
                            ],
                            wildimg: [
                                { path: baseBundle.wildimage.getPath(), name: this.translator.findByKey('Wild_txt'), text: this.translator.findByKey('Wild_txt1') }
                            ]
                        },
                        {
                            header: this.translator.findByKey('SpecialPays_Header'),
                            image: [
                                { path: baseBundle.helpAllUp.getPath() }
                            ],
                            details: [
                                this.translator.findByKey('SpecialPays_text1') + " " + this.translator.findByKey('SpecialPays_text2') + " " + this.translator.findByKey('SpecialPays_text3'),
                                this.translator.findByKey('SpecialPays_text4'),
                                this.translator.findByKey('SpecialPays_text5') + " " + this.translator.findByKey('SpecialPays_text6')
                            ],
                            spays: [
                                this.createfudata(this.translator.findByKey('P1GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingot.getPath(), baseBundle.helpturtle.getPath(), baseBundle.helpjunk.getPath(), baseBundle.helppheonix.getPath()),
                                this.createfudata(this.translator.findByKey('P2GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingotgold.getPath(), baseBundle.helpturtle.getPath(), baseBundle.helpjunk.getPath(), baseBundle.helppheonix.getPath()),
                                this.createfudata(this.translator.findByKey('P3GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingotgold.getPath(), baseBundle.helpturtlegold.getPath(), baseBundle.helpjunk.getPath(), baseBundle.helppheonix.getPath()),
                                this.createfudata(this.translator.findByKey('P4GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingotgold.getPath(), baseBundle.helpturtlegold.getPath(), baseBundle.helpjunkgold.getPath(), baseBundle.helppheonix.getPath()),
                                this.createfudata(this.translator.findByKey('P5GOLD'), baseBundle.helpcoingold.getPath(), baseBundle.helpingotgold.getPath(), baseBundle.helpturtlegold.getPath(), baseBundle.helpjunkgold.getPath(), baseBundle.helppheonixgold.getPath())
                            ]
                        },
                        {
                            header: this.translator.findByKey('Fubat_Header'),
                            details: [
                                this.translator.findByKey('Fubat_text1') + " " + this.translator.findByKey('Fubat_text2') + " " + this.translator.findByKey('Fubat_text3') + " " + this.translator.findByKey('Fubat_text4') + " " + this.translator.findByKey('Fubat_text5') + " " + this.translator.findByKey('Fubat_text6')
                            ],
                            image: [
                                { path: this.baseBundle.grandicon.getPath(), name: this.translator.findByKey('Grand_jackpot') },
                                { path: this.baseBundle.majoricon.getPath(), name: this.translator.findByKey('Major_jackpot') },
                                { path: this.baseBundle.minoricon.getPath(), name: this.translator.findByKey('Minor_jackpot') },
                                { path: this.baseBundle.miniicon.getPath(), name: this.translator.findByKey('Mini_jackpot') }
                            ],
                            fusym: [
                                this.createfusym(this.translator.findByKey('Jackpots_available'), this.translator.findByKey('Mini_txt'), this.translator.findByKey('Mini_txt'), this.translator.findByKey('Mini_txt'), this.translator.findByKey('Mini_txt'), this.translator.findByKey('None_txt')),
                                this.createfusym('', this.translator.findByKey('Minor_txt'), this.translator.findByKey('Minor_txt'), this.translator.findByKey('Minor_txt'), '', ''),
                                this.createfusym('', this.translator.findByKey('Major_txt'), this.translator.findByKey('Major_txt'), '', '', ''),
                                this.createfusym('', this.translator.findByKey('Grand_txt'), '', '', '', '')
                            ],
                            translator: this.translator
                        },
                        {
                            header: this.translator.findByKey('FreeGames_Header'),
                            details: [
                                this.translator.findByKey('FreeGames_text1') + " " + this.translator.findByKey('FreeGames_text2') + " " + this.translator.findByKey('FreeGames_text3') + " " + this.translator.findByKey('FreeGames_text4') + " " + this.translator.findByKey('FreeGames_text5') + " " + this.translator.findByKey('FreeGames_text6') + " " + this.translator.findByKey('FreeGames_text7')
                            ]
                        },
                        {
                            header: this.translator.findByKey('AnyWay_Header'),
                            details: [
                                this.translator.findByKey('AnyWay_text1') + " " + this.translator.findByKey('AnyWay_text2') + " " + this.translator.findByKey('AnyWay_text3') + " " + this.translator.findByKey('AnyWay_text4') + " " + this.translator.findByKey('AnyWay_text5') + " " + this.translator.findByKey('AnyWay_text6'),
                                this.translator.findByKey('AnyWay_text7'),
                                this.translator.findByKey('AnyWay_text8'),
                                this.formatTranslation('AnyWay_text9', [this.currencyFormatter.format(winCap)], maxWin),
                                this.translator.findByKey('AnyWay_text10'),
                                this.translator.findByKey('AnyWay_text11'),
                                this.translator.findByKey('Gameversion_txt') + EEFConfig.CLIENT_VERSION,
                                this.translator.findByKey('serverVersion') + EEFConfig.SERVER_VERSION
                            ]
                        }
                    ]
                };
            }
            //Additional text to be added for Norway Partner
            if (this.isNT) {
                data.sections.push({
                    details: [
                        this.translator.findByKey('com.eightyeightfortunes.Help.NoNo.Desc1'),
                        this.translator.findByKey('com.eightyeightfortunes.Help.NoNo.Desc2'),
                        this.translator.findByKey('com.eightyeightfortunes.Help.NoNo.Desc3'),
                        this.translator.findByKey('com.eightyeightfortunes.Help.NoNo.Desc4'),
                        this.formatTranslation('com.eightyeightfortunes.Help.NoNo.Desc5', [this.currencyFormatter.format(maxBet)], "")
                    ]
                });
            }
            return data;
        };
        /**
         * Updates the paytable dynamically
         * @method tit.HelpAndPays#updatePaytable
         * @private
         * @param {Bet} bet The bet object
         */
        /*private updatePaytable(bet: Bet): void {
            if (this.paysController != null) {
                this.paysController.updatePays(bet.getBetPerUnit(), this.currencyFormatter);
            }
        }*/
        HelpAndPays.prototype.updatePays = function () {
            //document.getElementById("pays-1").style.display="none";
            if (this.paysController != null) {
                this.paysController.updatePays(this.multiplierno, this.betno, this.currencyFormatter);
            }
            this.showHideSymbols();
            if (!this.isNT) {
                this.updateRTP();
            }
        };
        /**
         * Update paytable on FR complete
         */
        HelpAndPays.prototype.updatePaysOnFRComplete = function (multiplierno, betno) {
            this.multiplierno = multiplierno;
            this.betno = betno;
            this.updatePays();
        };
        HelpAndPays.prototype.updateRTP = function () {
            var maindiv = document.getElementById("tabs-5");
            var rtptxt = maindiv.getElementsByTagName("p")[1].innerHTML;
            var lastIndex = rtptxt.lastIndexOf(" ");
            rtptxt = rtptxt.substring(0, lastIndex);
            if (this.betno == 8) {
                maindiv.getElementsByTagName("p")[1].innerHTML = rtptxt + " 95.93%.";
            }
            else {
                maindiv.getElementsByTagName("p")[1].innerHTML = rtptxt + " 96%.";
            }
        };
        HelpAndPays.prototype.showHideSymbols = function () {
            var phoneixGold = document.getElementById("pays-1");
            var junkGold = document.getElementById("pays-2");
            var turtleGold = document.getElementById("pays-3");
            var ingotGold = document.getElementById("pays-4");
            var phoneix = document.getElementById("pays-6");
            var junk = document.getElementById("pays-7");
            var turtle = document.getElementById("pays-8");
            var ingot = document.getElementById("pays-9");
            phoneixGold.style.display = "none";
            junkGold.style.display = "none";
            turtleGold.style.display = "none";
            ingotGold.style.display = "none";
            phoneix.style.display = "none";
            junk.style.display = "none";
            turtle.style.display = "none";
            ingot.style.display = "none";
            if (this.betno == 88) {
                phoneixGold.style.display = "block";
                junkGold.style.display = "block";
                turtleGold.style.display = "block";
                ingotGold.style.display = "block";
            }
            else if (this.betno == 68) {
                phoneix.style.display = "block";
                junkGold.style.display = "block";
                turtleGold.style.display = "block";
                ingotGold.style.display = "block";
            }
            else if (this.betno == 38) {
                phoneix.style.display = "block";
                junk.style.display = "block";
                turtleGold.style.display = "block";
                ingotGold.style.display = "block";
            }
            else if (this.betno == 18) {
                phoneix.style.display = "block";
                junk.style.display = "block";
                turtle.style.display = "block";
                ingotGold.style.display = "block";
            }
            else {
                phoneix.style.display = "block";
                junk.style.display = "block";
                turtle.style.display = "block";
                ingot.style.display = "block";
            }
        };
        /**
         * Creates a symbol for the paytable
         * @method tit.HelpAndPays#createPaytableSymbol
         * @private
         * @param {string} symbolName The name of the symbol
         * @param {asset.ImageAsset} symbolAsset The asset for the symbol
         * @param {number[]} multipliers The array of multipliers for the symbol
         * @param {boolean} showName True to show the name of the symbol
         * @returns {IPaytable} The created image
         */
        HelpAndPays.prototype.createPaytableSymbol = function (symbolName, symbolAsset, multipliers, currencyMultiplier, index, showName) {
            if (showName === void 0) { showName = true; }
            var symbolSpriteSheet = new abg2d.SpriteSheet(symbolAsset, 1.0);
            var imageElem = this.composeCanvasElementFromFromImage(HelpAndPays.symbolMapping.indexOf(symbolName), symbolSpriteSheet, index);
            var displayMultipliers = [];
            for (var ii = 0, len = multipliers.length; ii < len; ++ii) {
                displayMultipliers.push(multipliers[ii]);
            }
            var imageData = {
                payMultipliers: displayMultipliers,
                image: imageElem,
                name: (showName) ? symbolName : ""
            };
            return imageData;
        };
        /**
         * Formats a translation
         * @method tit.HelpAndPays#formatTranslation
         * @private
         * @param {string} key The key to look up
         * @param {any[]} values The list of values to look up by key
         * @returns {string} The translated string
         */
        HelpAndPays.prototype.formatTranslation = function (key, values, maxWin, currencyMultiplier) {
            if (currencyMultiplier === void 0) { currencyMultiplier = -1; }
            var translated = this.translator.findByKey(key);
            if (maxWin != "OFF") {
                for (var i = 0; i < values.length; ++i) {
                    var substitution = '{' + i + '}';
                    if (currencyMultiplier != -1) {
                        var temp = parseInt(values[i], 10) * currencyMultiplier;
                        translated = translated.replace(substitution, this.currencyFormatter.format(temp));
                    }
                    else
                        translated = translated.replace(substitution, String(values[i]));
                }
            }
            else {
                translated = "";
            }
            return translated;
        };
        /**
         * Compose an HTMLCanvasElement based on a sprite sheet frame
         *
         * @param  frame  the frame to use in the sheet
         * @param  spriteSheet  sprite sheet to create from
         */
        HelpAndPays.prototype.composeCanvasElementFromFromImage = function (frame, spriteSheet, index) {
            var sheetFrame = spriteSheet.getFrame(frame);
            var canvas = document.createElement('canvas');
            canvas.width = sheetFrame.drawW;
            canvas.height = sheetFrame.drawH;
            canvas.id = 'sym-' + index;
            var canvasContext = canvas.getContext('2d');
            canvasContext.clearRect(0, 0, canvas.width, canvas.height);
            canvasContext.setTransform(1, 0, 0, 1, 0, 0);
            var image = spriteSheet.getResource();
            canvasContext.drawImage(image, sheetFrame.x, sheetFrame.y, sheetFrame.drawW, sheetFrame.drawH, 0, 0, sheetFrame.drawW, sheetFrame.drawH);
            return canvas;
        };
        HelpAndPays.prototype.createfudata = function (symName, path1, path2, path3, path4, path5) {
            var images = [];
            images.push(path1);
            images.push(path2);
            images.push(path3);
            images.push(path4);
            images.push(path5);
            var tabledata = {
                name: symName,
                image: images
            };
            return tabledata;
        };
        HelpAndPays.prototype.createfusym = function (symName, name1, name2, name3, name4, name5) {
            var fujack = [];
            fujack.push(name1);
            fujack.push(name2);
            fujack.push(name3);
            fujack.push(name4);
            fujack.push(name5);
            var fatable = {
                name: symName,
                type: fujack
            };
            var fuJackinfo = {
                tcontent: fatable
            };
            return fuJackinfo;
        };
        /**
         * Internal symbol map
         * @member tit.HelpAndPays#symbolMapping
         * @private static
         * @type {string[]}
         */
        HelpAndPays.symbolMapping = ['H1', 'H2', 'H3', 'H4', 'H5', 'L1', 'L2', 'L3', 'L4', 'L5', 'M1', 'M2', 'M3', 'M4', 'M5', 'Wild', 'GONG'];
        return HelpAndPays;
    })();
    exports.HelpAndPays = HelpAndPays;
    /**
     * RecoveryManager
     * @class eef.RecoveryManager
     * @classdesc Handles recovering the game back to it's original state
     */
    var RecoveryManager = (function () {
        /**
         * @constructor
         */
        function RecoveryManager(data) {
            var _this = this;
            this.reelIndex = 4;
            this.data = data;
            this.isRecovering = true;
            this.readyToRecoverEventTracker = new EventTracker();
            this.readyToRecoverEventTracker.getEventDispatcher().add({
                onAllDependenciesMet: function () {
                    _this.startRecovery();
                }
            });
            this.readyToRecoverEventTracker.trackDependency(RecoveryManager.EventPlayResonseReceived);
            this.readyToRecoverEventTracker.trackDependency(RecoveryManager.EventAssetsLoaded);
            this.data.logic.setGameState(5 /* Recovering */);
            this.data.uiController.setIsRecovering(true);
            data.glsRequestor.getEvents().add({
                onInitResponse: null,
                onPlayResponse: function (playResponse) {
                    if (_this.isRecovering) {
                        _this.handlePlayResponse(playResponse);
                    }
                },
                onEndResponse: null,
                onError: null
            });
            data.slot.getEvents().add({
                onSpinComplete: function () {
                    if (_this.isRecovering) {
                        _this.handleSpinComplete();
                    }
                },
                onSkillStop: null,
                onGaffReel: null,
                onDemoClicked: null
            });
            TweenLite.delayedCall(0.5, function () {
                var message = _this.data.translator.findByKey("com.williamsinteractive.mobile.mobile.INCOMPLETE_GAME");
                util.ErrorReporter.showError(message, null, function () {
                    _this.data.slot.spin();
                    _this.sendPlayRequest();
                });
            });
        }
        /**
         * Sends a play request
         * @method eef.RecoveryManager#sendPlayRequest
         * @public
         */
        RecoveryManager.prototype.sendPlayRequest = function () {
            var payloads = [];
            //var payload: glscomms.AnywayWagerPayload = new glscomms.AnywayWagerPayload(this.data.betController.getCurrentBet().getTotalBet());
            var betMultiplier = this.data.betController.getCurrentMultiplier().multiplier.toString();
            var totalStake = Number(88);
            var betunit = Number(8);
            var payload = new EEFWagerPayload(betunit, totalStake, betMultiplier);
            this.data.logic.partnerAdapter.startedPlay();
            this.data.uiController.isGameRevealed = false;
            payloads.push(payload);
            this.data.glsRequestor.makePlayRequest(payloads);
        };
        /**
         * Hanldes the play response from the server
         * @method eef.RecoveryManager#handlePlayResponse
         * @private
         * @param {glscomms.PlayResponse} playResponse The response from the server
         */
        RecoveryManager.prototype.handlePlayResponse = function (playResponse) {
            var _this = this;
            this.data.logic.setIsFubat(false);
            this.gameData = playResponse.getGameData();
            this.readyToRecoverEventTracker.dependencyMet(RecoveryManager.EventPlayResonseReceived);
            var customData = this.gameData.getCustomData();
            if (this.reelIndex !== Number(customData.reelIndex)) {
                this.reelIndex = Number(customData.reelIndex);
                //this.setGaffReelIndex(Number(this.reelIndex));
                this.data.slot.changeReelSet(Number(this.reelIndex));
            }
            // If we're recovering a free spin game, we need to make sure the free spin assets are loaded.
            if (this.gameData.getCustomData().getBaseGameResult().isBonusTriggered() && (!this.data.freeSpinBackground.getAsset().getIsLoaded())) {
                this.data.freeSpinBackground.getAsset().getEvents().add({
                    onProgress: null,
                    onError: null,
                    onComplete: function () {
                        _this.readyToRecoverEventTracker.dependencyMet(RecoveryManager.EventAssetsLoaded);
                    },
                });
            }
            else {
                this.readyToRecoverEventTracker.dependencyMet(RecoveryManager.EventAssetsLoaded);
            }
            //this.readyToRecoverEventTracker.dependencyMet(RecoveryManager.EventAssetsLoaded);
        };
        /**
         * Sets up some base state for handling recovery, displays the recovery message to the player,
         * and starts the reels.
         */
        RecoveryManager.prototype.startRecovery = function () {
            if (this.gameData.getCustomData().getBaseGameResult().isBonusTriggered()) {
                this.data.background.getImage().setSpriteSheet(this.data.freeSpinBackground);
                this.data.logic.getFreeSpin().setTriggerData(this.gameData.getCustomData().getBaseGameResult());
                this.data.logic.getFreeSpin().setGameData(this.gameData);
                this.data.logic.getFreeSpin().setForRecovery();
                this.data.slot.setRestoreFreegameSound(true);
                this.data.uiController.setBonusWinTxt();
            }
            this.data.betController.setBet(this.gameData.getWager());
            this.data.partnerAdapter.hideProgressBar();
            this.data.slot.setStopPositions(this.gameData.getStopPositions());
        };
        /**
         * Handles the spin complete event from slot
         * @method eef.RecoveryManager#handleSpinComplete
         * @private
         */
        RecoveryManager.prototype.handleSpinComplete = function () {
            var customData = this.gameData.getCustomData();
            var freeSpin = this.data.logic.getFreeSpin();
            if ((this.gameData.isBonusTriggered()) && (customData.fuBatInfo == undefined) && (customData.spinsAwarded == 0)) {
                this.data.logic.setGameState(1 /* BaseGameSpinTriggerFreeSpin */);
                this.data.logic.getFreeSpin().setGameData(this.gameData);
                this.data.logic.getFreeSpin().configureResultsDisplay();
            }
            else if (customData.getBaseGameResult().isBonusTriggered()) {
                // need to chk for free game      
                if (customData.spinsAwarded > 0) {
                    freeSpin.getRetrigger().setSpinsAwarded(customData.getSpinsAwarded());
                }
                if ((customData.spinsAwarded > 0) && (customData.fuBatInfo == undefined)) {
                    this.data.logic.setGameState(3 /* BonusGameSpinTrigger */);
                }
                if ((customData != undefined) && (customData.fuBatInfo != undefined)) {
                    if (customData.fuBatInfo.featureindex === "3" && customData.fuBatInfo.featurename === "FG_FuBat_Jackpot") {
                        this.data.logic.fubatJackpotFeatureInfo = customData;
                        this.data.logic.setGameState(7 /* fgfubatJackpot */);
                        //this.data.logic.fgfubatJackpotCall();
                        this.data.slot.getWinDisplayController().configure(this.gameData, false);
                        this.data.slot.getSymbolAnimationController().setHitData(this.gameData.getAllSlotResults());
                        freeSpin.configureResultsDisplay();
                        if (customData.spinsRemaining == 0) {
                            this.data.logic.setRestoreLastspinFlag();
                        }
                    }
                }
                else {
                    //bonus game has started but not yet finished
                    if (customData.spinsRemaining == 0 || customData.getIsWinCap()) {
                        this.data.logic.setGameState(4 /* BonusGameEnd */);
                        this.data.logic.setRestoreLastspinFlag();
                    }
                    else {
                        if (customData.spinsAwarded == 0) {
                            this.data.logic.setGameState(2 /* BonusGameSpin */);
                        }
                    }
                    freeSpin.configureResultsDisplay();
                }
            }
            else if ((customData != undefined) && (customData.fuBatInfo != undefined)) {
                if (customData.fuBatInfo.featureindex === "2" && customData.fuBatInfo.featurename === "BG_FuBat_Jackpot") {
                    if ((this.gameData.isBonusTriggered()) && customData.spinsRemaining > 0) {
                        this.data.logic.getFreeSpin().setGameData(this.gameData);
                    }
                    this.data.logic.fubatJackpotFeatureInfo = customData;
                    this.data.logic.setGameState(6 /* fubatJackpot */);
                    this.data.slot.getWinDisplayController().configure(this.gameData, false);
                    this.data.slot.getSymbolAnimationController().setHitData(this.gameData.getAllSlotResults());
                }
            }
            else {
                //base game
                this.data.logic.setGameState(0 /* BaseGameSpin */);
                this.data.slot.getWinDisplayController().configure(this.gameData, false);
                this.data.slot.getSymbolAnimationController().setHitData(this.gameData.getAllSlotResults());
            }
            this.data.logic.setLastWager(this.data.betController.getCurrentBet());
            this.data.logic.handleSpinComplete();
            this.isRecovering = false;
            this.data.uiController.setIsRecovering(false);
            this.readyToRecoverEventTracker.resetAllDependencies();
        };
        RecoveryManager.EventPlayResonseReceived = 'EventPlayResonseReceived';
        RecoveryManager.EventAssetsLoaded = 'EventAssetsLoaded';
        return RecoveryManager;
    })();
    exports.RecoveryManager = RecoveryManager;
    /**
    * @file Gaffing.ts
    * To get set the reel Index for gaffing
    * @author Sakthivel S
    */
    var Gaffing = (function (_super) {
        __extends(Gaffing, _super);
        function Gaffing() {
            _super.call(this);
            this.userGaffReelIndex = 0;
            this.gaffReelIndexs = { "User": this.userGaffReelIndex };
            this.gaffType = { "User": this.userGaffReelIndex };
            this.symID = { "User": this.userGaffReelIndex };
        }
        /**
        * Add a new gaff to the Gaffing object
        * @method game.DemoMenu#addGaffWithReelIndex
        * @public
        * @param  {string} name The name of the new gaff.
        * @param  {object} postions The stop positions and reel Index of the new gaff.
        */
        Gaffing.prototype.addGaffWithReelIndex = function (name, positions) {
            _super.prototype.addGaff.call(this, name, positions['reelStop']);
            this.gaffReelIndexs[name] = positions['reelIndex'];
            this.gaffType[name] = positions['gafftype'];
            this.symID[name] = positions['symID'];
        };
        /**
        * Get the ReelIndex for a certain gaff
        * @method game.DemoMenu#getGaffReelIndex
        * @public
        * @param  {string} gaffType  Name of the gaff we are trying to retrive.
        */
        Gaffing.prototype.getGaffReelIndex = function (gaffType) {
            return this.gaffReelIndexs[gaffType];
        };
        Gaffing.prototype.getsymID = function (gaffType) {
            return this.symID[gaffType];
        };
        Gaffing.prototype.getgaffType = function (gaffType) {
            return this.gaffType[gaffType];
        };
        return Gaffing;
    })(game.Gaffing);
    exports.Gaffing = Gaffing;
    /**
     * Controller for running pulse animation for a win
     * @class reels.PulseDisplay
     * @classdesc Controller for running pulse animation for a win
     */
    var PulseDisplay = (function () {
        /**
         * @constructor
         */
        function PulseDisplay(animComponents, layouts, symbolMap, symbolAnimations, symbolSheet, scalar) {
            this.animComponents = animComponents;
            this.layouts = layouts;
            this.symbolMap = symbolMap;
            this.symbolSheet = symbolSheet;
            this.symbolAnimations = symbolAnimations;
            this.scalar = scalar;
            this.shadowAnimProps = {
                moveDistance: -20,
                scaleFactorStart: 0.8,
                scaleFactorEnd: 1.05
            };
            this.customAnimations = [];
        }
        /**
         * Start the pulse
         * @method reels.PulseDisplay#start
         * @public
         * @param {IReelPosition[]} highlights Symbol offsets to pulse
         * @param {number} duration Length of time to pulse in one direction (outwards or inwards)
         */
        PulseDisplay.prototype.start = function (highlights, duration) {
            var timelines = [];
            this.clearSymbols();
            for (var highlightId = 0; highlightId < highlights.length; highlightId++) {
                var timeline = new TimelineLite({ repeat: 1, yoyo: true });
                var highlight = highlights[highlightId];
                var reelNumber = highlight.reelnumber;
                var reelPosition = highlight.reelposition;
                var layout = this.layouts[reelNumber];
                var anchorXfm = layout.getAnchor().getTransform();
                var reel = layout.getReel();
                var symbolId = reel.getSymbolId(reelPosition + 1);
                var yPos = layout.getSymbolPosition(reelPosition + 1) + anchorXfm.getPositionY();
                this.pulseSymbol(highlight, symbolId, anchorXfm.getPositionX(), yPos, duration);
            }
        };
        /**
         * Clean up display elements
         * @method reels.PulseDisplay#clearSymbols
         * @public
         */
        PulseDisplay.prototype.clearSymbols = function () {
            for (var i = 0; i < this.animComponents.length; i++) {
                for (var j = 0; j < this.animComponents[i].length; j++) {
                    var xfm = this.animComponents[i][j].symbol.getTransform();
                    xfm.setVisible(false);
                    this.animComponents[i][j].symbol.getFrameAnimator().stop(true);
                }
            }
        };
        /**
         * Customize drop shadow animation properties
         * @method reels.PulseDisplay#setDropShadowProperties
         * @public
         * @param {IShadowAnimProperties} props Drop shadow properties
         */
        PulseDisplay.prototype.setDropShadowProperties = function (props) {
        };
        /**
         * Add a custom animation
         * @method reels.PulseDisplay#addCustomAnimation
         * @public
         * @param {reels.ICustomPulseSymbolAnimation} newAnimation Custom animation properties
         */
        PulseDisplay.prototype.addCustomAnimation = function (newAnimation) {
            this.customAnimations.push(newAnimation);
        };
        /**
         * Clear custom animations
         * @method reels.PulseDisplay#clearCustomAnimations
         * @public
         */
        PulseDisplay.prototype.clearCustomAnimations = function () {
            this.customAnimations = [];
        };
        /**
         * Pulse a single symbol
         * @method reels.PulseDisplay#pulseSymbol
         * @private
         * @param {IReelPosition} symbolOffset Symbol position
         * @param {number} symbolId Symbol identifier
         * @param {number} xPos Symbol x position
         * @param {number} yPos Symbol y position
         * @param {number} duration Length of time to pulse
         * @returns {TweenLite} Tween object responsible this symbol's pulse animation
         */
        PulseDisplay.prototype.pulseSymbol = function (symbolOffset, symbolId, xPos, yPos, duration) {
            var actor = this.animComponents[symbolOffset.reelnumber][symbolOffset.reelposition].symbol;
            var image = actor.getImage();
            var xfm = actor.getTransform();
            if (this.scalar == 1) {
                if (symbolId == 0 || symbolId == 1) {
                    xPos = xPos - 70;
                    yPos = yPos - 70;
                }
            }
            else if (this.scalar == 0.49) {
                if (symbolId == 0 || symbolId == 1) {
                    xPos = xPos - 70;
                    yPos = yPos - 70;
                }
            }
            else {
                if (symbolId == 0 || symbolId == 1) {
                    xPos = xPos - 70;
                    yPos = yPos - 70;
                }
            }
            var symbolPos = yPos;
            var animationFound = false;
            xfm.setScale(1, 1);
            for (var defaultAnim = 0; defaultAnim < this.symbolAnimations.length && !animationFound; ++defaultAnim) {
                var symbolAnimation = this.symbolAnimations[defaultAnim];
                if (symbolAnimation.symbolId == symbolId) {
                    animationFound = true;
                    symbolPos += symbolAnimation.xOffset;
                    if (symbolAnimation.spriteSheet.getFrameCount() > 0) {
                        image.setSpriteSheet(symbolAnimation.spriteSheet);
                        actor.getFrameAnimator().play();
                    }
                    else {
                        image.setSpriteSheet(this.symbolSheet);
                        image.setFrame(this.symbolMap[symbolId]);
                    }
                    break;
                }
            }
            if (!animationFound) {
                image.setSpriteSheet(this.symbolSheet);
                image.setFrame(this.symbolMap[symbolId]);
            }
            xfm.setPositionX(xPos);
            xfm.setPositionY(symbolPos);
            xfm.setVisible(true);
        };
        return PulseDisplay;
    })();
    exports.PulseDisplay = PulseDisplay;
    /**
     * Win display choreography
     * @class eef.WinDisplayController
     * @classdesc Handles choreography when displaying game results, big win animations and sounds
     */
    var WinDisplayController = (function () {
        /**
         * @constructor
         */
        function WinDisplayController(pulseDisplay, cycleResultsController, bangController, symbolAnimationController, reelGroup, audioController, betController) {
            this.pulseDisplay = pulseDisplay;
            this.cycleResults = cycleResultsController;
            this.bangController = bangController;
            this.symbolAnimationController = symbolAnimationController;
            this.reelGroup = reelGroup;
            this.audioController = audioController;
            this.betController = betController;
            this.timelineAllPays = new TimelineMax();
            this.isPlaying = false;
            this.signal = {
                onPulseAllSymbols: null,
                onPulseAllSymbolsComplete: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
         * Gets the event dispatcher
         * @method eef.WinDisplayController#getEvents
         * @public
         * @returns {event.EventDispatcher<IWinDisplayListener>} The event dispatcher
         */
        WinDisplayController.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * Gets the isPlaying flag
         * @method eef.WinDisplayController#getIsPlaying
         * @public
         * @returns {boolean} True if the win display is playing
         */
        WinDisplayController.prototype.getIsPlaying = function () {
            return this.isPlaying;
        };
        /**
         * Start the win display
         * @method eef.WinDisplayController#start
         * @param {boolean} showAllPaysFirst True if pulsing all pays first, false if pulsing individual pays
         * @public
         */
        WinDisplayController.prototype.start = function (showAllPaysFirst) {
            if ((this.gameResults.getCustomData() != undefined) && (this.gameResults.getCustomData().getIsWinCap()) && (this.gameResults.getCustomData().getSpinsRemaining() == undefined)) {
                this.onShowAllPaysComplete();
                this.bangController.setMaxWin(this.cycleResults.totalWin);
            }
            else {
                this.isPlaying = true;
                if (showAllPaysFirst) {
                    this.showAllPays();
                }
                else {
                    this.onShowAllPaysComplete();
                    this.bangController.start();
                }
            }
        };
        /**
         * Stop the win display
         * @method eef.WinDisplayController#stop
         * @public
         */
        WinDisplayController.prototype.stop = function (forceStop) {
            if (forceStop === void 0) { forceStop = false; }
            this.isPlaying = false;
            this.timelineAllPays.clear();
            this.pulseDisplay.clearSymbols();
            this.cycleResults.stop(forceStop);
            this.symbolAnimationController.stop();
            this.bangController.stop();
        };
        /**
         * Configure results to display
         * @method eef.WinDisplayController#configure
         * @public
         * @param {gamedata.GamePlayData} results Results to display
         * @param {boolean} showBonusGuarantee True if bonus guarantee should be shown when available
         */
        WinDisplayController.prototype.configure = function (results, showBonusGuarantee) {
            this.gameResults = results;
            this.cycleResults.setResults(this.gameResults, showBonusGuarantee);
            this.bangController.setup(0, this.gameResults.getTotalWin());
        };
        /**
         * Get the cycle results
         * @method eef.WinDisplayController#getCycleResults
         * @public
         * @returns {CycleResultsController} The cycle results controller
         */
        WinDisplayController.prototype.getCycleResults = function () {
            return this.cycleResults;
        };
        /**
         * Get pulse display
         * @method eef.WinDisplayController#getPulseDisplay
         * @public
         * @returns {reels.PulseDisplay} Pulse display
         */
        WinDisplayController.prototype.getPulseDisplay = function () {
            return this.pulseDisplay;
        };
        /**
         * Gets the bang controller
         * @method eef.WinDisplayController#getBangController
         * @public
         * @returns {BangController} The bang controller
         */
        WinDisplayController.prototype.getBangController = function () {
            return this.bangController;
        };
        /**
         * Pulse all winning symbols
         * @method eef.WinDisplayController#showAllPays
         * @private
         */
        WinDisplayController.prototype.showAllPays = function () {
            var _this = this;
            // Collect all highlight symbols
            var allResults = this.gameResults.getAllSlotResults();
            var allHighlights = [];
            for (var i = 0; i < allResults.length; ++i) {
                allHighlights = allHighlights.concat(allResults[i].getOffsets());
            }
            // Filter for unique positions only and convert to IReelPositions
            var uniqueHighlights = allHighlights.filter(function (value, index, self) {
                return self.indexOf(value) === index;
            }).map(function (offset) { return Utils.convertOffset(offset, EEFConfig.NUMBER_OF_REELS); });
            // Run tween to pulse all symbols and call back when pulse is complete
            this.timelineAllPays = new TimelineMax();
            var funcs = [];
            funcs.push(function () {
                _this.pulseDisplay.start(uniqueHighlights, 0.6);
            });
            this.timelineAllPays.add(funcs, 0, "normal", 1.2);
            this.timelineAllPays.add(function () {
                _this.signal.onPulseAllSymbols(_this.gameResults.getTotalWin());
                _this.bangController.start();
            }, 0, "normal", 1.2);
            this.timelineAllPays.add(function () {
                _this.onShowAllPaysComplete();
            }, 1.2);
        };
        /**
         * Checks to see if the user has won at least 2x their bet
         * @method eef.WinDisplayController#checkBetThreshold
         * @private
         * @returns {boolean} True if the user has won 2x their bet
         */
        WinDisplayController.prototype.checkBetThreshold = function () {
            var winMultiple = this.gameResults.getTotalWin() / this.betController.getCurrentBet().getTotalBet();
            return (winMultiple >= 2);
        };
        /**
         * Checks to see if we should play a sound for the buffalo symbols
         * @method eef.WinDisplayController#searchForHighSymbols
         * @private
         * @param {reels.IReelPosition[]} highlights The list of symbols to highlight
         * @returns {boolean} True if we should play a sound
         */
        WinDisplayController.prototype.searchForHighSymbols = function (highlights) {
            var highlight = null;
            var reelNumber = null;
            var reelPosition = null;
            var layout = null;
            var symbolId = null;
            var shouldPlaySound = false;
            for (var i = 0; i < highlights.length; i++) {
                highlight = highlights[i];
                reelNumber = highlight.reelnumber;
                reelPosition = highlight.reelposition;
                layout = this.reelGroup.getController(reelNumber).getLayout();
                symbolId = layout.getReel().getSymbolId(reelPosition + 1);
                if (symbolId == EEFConfig.H1_SYMBOL_ID || symbolId == EEFConfig.H2_SYMBOL_ID) {
                    shouldPlaySound = true;
                    break;
                }
            }
            return shouldPlaySound;
        };
        /**
         * When initial pulse display is complete, start next phase of win display
         * @method eef.WinDisplayController#onShowAllPaysComplete
         * @private
         */
        WinDisplayController.prototype.onShowAllPaysComplete = function () {
            this.signal.onPulseAllSymbolsComplete();
            // Cycle through individual pay groups
            if (this.isPlaying) {
                this.cycleResults.start();
            }
        };
        return WinDisplayController;
    })();
    exports.WinDisplayController = WinDisplayController;
    /**
     * BangController
     * @class eef.BangController
     * @classdesc Handles banging up a win
     */
    var BangController = (function () {
        /**
         * @constructor
         */
        function BangController(uiController, audioPlayer) {
            /**
             * Constant value representing the bang durations
             * @member eef.BangControler#BANG_DURATIONS
             * @private
             * @type {number[]}
             * @default [.1, .305, 2, 4.944, 7.890]
             */
            this.BANG_DURATIONS = [.1, .305, 2, 4.944, 7.890];
            /**
             * Constant value representing the bang thresholds
             * @member eef.BangController#BANG_THRESHOLDS
             * @private
             * @type {number[]}
             * @default [.1, .5, 2, 5, 8]
             */
            this.BANG_THRESHOLDS = [.1, .5, 2, 5, 8];
            this.audioPlayer = audioPlayer;
            this.uiController = uiController;
            this.isBanging = false;
            this.isBigWin = false;
            this.signal = {
                onStart: null,
                onComplete: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
        }
        /**
         * Sets the big win controller
         * @method eef.BangController#setBigWinController
         * @public
         * @param {BigWinController} bigWinController The big win controller
         */
        BangController.prototype.setBigWinController = function (bigWinController) {
            var _this = this;
            this.bigWinController = bigWinController;
            this.bigWinController.getEvents().add({
                onComplete: function () {
                    _this.bigWinComplete();
                }
            });
        };
        /**
         * Get the win value
         * @method eef.BangController#setWin
         * @public
         * @return {number} win The bangup amount
         */
        BangController.prototype.getWin = function () {
            return this.toValue - this.fromValue;
        };
        /**
         * Setup the bang controller with a from and to value
         * @method eef.BangController#setup
         * @public
         * @param {number} fromValue The value to bang from
         * @param {number} toValue The value to bang to
         */
        BangController.prototype.setup = function (fromValue, toValue) {
            this.fromValue = fromValue;
            this.toValue = toValue;
        };
        /**
         * Bangs up the win
         * @method eef.BangController#start
         * @public
         */
        BangController.prototype.start = function () {
            var _this = this;
            if (this.getWin() == 0 || (this.getWin() <= (this.uiController.betController.getCurrentBet().getBetPerUnit() * this.uiController.betController.getCurrentMultiplier().multiplier))) {
                if (this.getWin() > 0) {
                    this.audioPlayer.playWinSound();
                    this.uiController.setWin(this.toValue, false);
                }
                this.signal.onComplete();
                return;
            }
            this.isBanging = true;
            //check for big win times
            if (this.bigWinController.getIsLoaded() && this.bigWinController.checkBigWinLevel(this.uiController.getBet().getTotalBet(), this.getWin())) {
                this.bigWinController.play(0, this.getWin());
                this.isBigWin = true;
            }
            else {
                this.timeline = new TimelineMax({ paused: true });
                var level = this.calculateBangLevel(this.BANG_THRESHOLDS);
                var duration = this.BANG_DURATIONS[level];
                var fromParams = {
                    setWin: this.fromValue
                };
                var toParams = {
                    setWin: this.toValue,
                    ease: Linear.easeNone,
                    onComplete: function () {
                        _this.signal.onComplete();
                        _this.isBanging = false;
                        _this.audioPlayer.playBangupEnd();
                    },
                    onStart: function () {
                        _this.signal.onStart();
                        if (level > 0) {
                            _this.audioPlayer.playBangup();
                        }
                    }
                };
                var winTimeline = this.uiController.animateWin(true);
                this.timeline.add(winTimeline);
                this.timeline.add(TweenMax.fromTo(this.uiController, duration, fromParams, toParams), "+=" + winTimeline.duration());
                this.timeline.play();
            }
        };
        /**
         * Stops the bang up
         * @method eef.BangController#stop
         * @public
         */
        BangController.prototype.stop = function () {
            if (this.isBigWin) {
                this.bigWinController.stop();
            }
            else if (this.isBanging && this.timeline != null) {
                this.timeline.seek(this.timeline.duration(), false);
                this.audioPlayer.playBangupEnd();
            }
        };
        BangController.prototype.setMaxWin = function (win) {
            var _this = this;
            this.uiController.showMaxWin(win);
            this.toValue = win;
            this.isBigWin = true;
            TweenLite.delayedCall(2, function () {
                _this.bigWinComplete();
            });
        };
        /**
         * Gets the event dispatcher
         * @method eef.BangController#getEvents
         * @public
         * @returns {events.EventDispatcher<IBangControllerListener>} DESCRIPTION
         */
        BangController.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Calculates the bang level
         * @method eef.BangController#calculateBangLevel
         * @private
         * @returns {number} The bang level of this bang
         */
        BangController.prototype.calculateBangLevel = function (threshold) {
            var level = 0;
            var totalBet = this.uiController.getBet().getTotalBet();
            var winMultiple = this.getWin() / totalBet;
            level = this.BANG_THRESHOLDS.length - 1;
            var winMultipleFromTable = this.BANG_THRESHOLDS[level];
            while (winMultiple <= winMultipleFromTable) {
                level--;
                winMultipleFromTable = this.BANG_THRESHOLDS[level];
            }
            return level;
        };
        /**
         * Listener for Big Win completion
         * @method eef.BangController#bigWinComplete
         * @private
         */
        BangController.prototype.bigWinComplete = function () {
            if (this.isBigWin) {
                this.uiController.setWin(this.toValue, true);
                this.uiController.animateWin(true);
                this.isBigWin = false;
                this.isBanging = false;
                this.signal.onComplete();
                this.audioPlayer.fadeBackgroundMusic();
            }
        };
        return BangController;
    })();
    exports.BangController = BangController;
    /**
     * SymbolAnimationController
     * @class eef.SymbolAnimationController
     * @classdesc Handles displaying symbols animations
     */
    var SymbolAnimationController = (function () {
        /**
         * @constructor
         */
        function SymbolAnimationController(group, audioController, symbols, pulseDisplay, scalar) {
            this.group = group;
            this.audioController = audioController;
            this.symbols = symbols;
            this.pulseDisplay = pulseDisplay;
            this.scalar = scalar;
            this.hitCounter = 0;
            this.symbolsNeededForTrigger = 3;
            this.hits = [];
            for (var i = 0; i < EEFConfig.NUMBER_OF_REELS; i++) {
                this.hits.push(null);
            }
        }
        /**
         * Sets the number of symbols needed for a trigger
         * @method eef.SymbolAnimationController#setSymbolsNeededForTrigger
         * @public
         * @param {number} value The number of symbols needed for a bonus trigger
         */
        SymbolAnimationController.prototype.setSymbolsNeededForTrigger = function (value) {
            this.symbolsNeededForTrigger = value;
        };
        /**
         * Sets the hit data
         * @method eef.SymbolAnimationController#setHitData
         * @public
         * @param {gamedata.SlotResult[]} data The hit data
         */
        SymbolAnimationController.prototype.setHitData = function (data) {
            this.hitData = data;
        };
        /**
         * Checks for a symbol hit
         * @method eef.SymbolAnimationController#checkForSymbolHit
         * @public
         * @param {number} reelId The reel to check for a symbol hit
         */
        SymbolAnimationController.prototype.checkForSymbolHit = function (reelId, stops) {
            var symbolRange = [];
            var symbolId = 0;
            symbolRange.length = EEFConfig.SYMBOLS_IN_REEL;
            this.group.getController(reelId).getLayout().getStopWindow(stops[reelId], symbolRange);
            for (var i = 1; i < symbolRange.length - 1; i++) {
                symbolId = symbolRange[i];
                if (symbolId == EEFConfig.BONUS_SYMBOL_ID && this.canPlayHitAnimation(reelId)) {
                    this.hits[reelId] = reelId;
                    this.audioController.playTriggerHit(++this.hitCounter);
                }
            }
        };
        /**
         * Checks to see if we need to highlight symbols in the pulse display
         * @method eef.SymbolAnimationController#checkForSymbolHighlight
         * @public
         * @param {number} repeateCount The number of times to repeat the symbol animation
         */
        SymbolAnimationController.prototype.checkForSymbolHighlight = function (repeateCount) {
            var that = this;
            var funcs = [];
            var highlights = null;
            if (this.timeline != null) {
                this.timeline.clear();
            }
            this.timeline = new TimelineMax({
                paused: true,
                repeat: repeateCount,
                yoyo: true
            });
            for (var i = 0; i < highlights.length; i++) {
                funcs.push(function (id) {
                    return function () {
                        that.pulseDisplay.start(highlights, 1);
                    };
                }(i));
            }
            this.timeline.add(funcs, 0, "normal", 2);
            this.timeline.play();
        };
        /**
         * Stops the symbol animations
         * @method eef.SymbolAnimationController#stop
         * @public
         */
        SymbolAnimationController.prototype.stop = function () {
            var actor = null;
            for (var i = 0; i < EEFConfig.NUMBER_OF_REELS; i++) {
                actor = this.symbols[i];
                if (actor != null) {
                    actor.getTransform().setVisible(false);
                    actor.getFrameAnimator().stop();
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
         * @method eef.SymbolAnimationController#canPlayHitAnimation
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
         * @method eef.SymbolAnimationController#playSymbolAnimation
         * @private
         * @param {number} reelId The reel to play the animation on
         */
        SymbolAnimationController.prototype.playSymbolAnimation = function (reelId, windowIndex, offsetX, offsetY, asset, repeat) {
            var controller = this.group.getController(reelId);
            var symbolActor = controller.getLayout().getSymbolActor(windowIndex, controller.getSymbolOrder());
            var transform = symbolActor.getTransform();
            var clipRect = symbolActor.getImage().getClipRect();
            var animationActor = this.symbols[reelId];
            var animationTransform = animationActor.getTransform();
            animationTransform.setAttachment(transform);
            animationTransform.setVisible(true);
            animationTransform.setZOrder(EEFConfig.SYMBOL_Z);
            animationTransform.setPosition(offsetX, offsetY);
            var animationImage = animationActor.getImage();
            animationImage.setSpriteSheet(new abg2d.SpriteSheet(asset, this.scalar));
            animationImage.setClipRect(clipRect[0], clipRect[1], clipRect[2], clipRect[3]);
            var animator = animationActor.getFrameAnimator();
            animator.setFramerate(16);
            if (!repeat) {
                animator.setEndMode(2 /* Hide */);
                animator.play();
            }
            else {
                animator.play(-1);
            }
        };
        return SymbolAnimationController;
    })();
    exports.SymbolAnimationController = SymbolAnimationController;
    /**
     * Big Win Controller
     * @class eef.BigWinController
     * @classdesc Handles the big win show
     */
    var BigWinController = (function () {
        /**
         * @constructor
         */
        function BigWinController(scene, scalar, audioController, currencyFormatter, bundle, font) {
            var _this = this;
            /**
             * Constant value for the big win durations
             * @member eef.BangController#BIG_WIN_DURATIONS
             * @private
             * @type {number[]}
             * @default [13.865, 13.865, 21.741]
             */
            this.DURATIONS = [13.865, 13.865, 15.741];
            /**
             * Constant value representing the big win thresholds
             * @member eef.BangController#BIG_WIN_THRESHOLDS
             * @private
             * @type {number[]}
             * @default [25, 75, 150]
             */
            this.THRESHOLDS = [25, 75, 150];
            this.audioController = audioController;
            this.currencyFormatter = currencyFormatter;
            this.isLoaded = false;
            this.level = 0;
            this.bangTarget = 0;
            this.timeline = new TimelineMax({ paused: true });
            this.loader = new asset.AssetLoader();
            this.loader.getEvents().add({
                onStarted: null,
                onProgress: null,
                onComplete: function (id, allComplete) {
                    _this.marquee = BigWinFactory.createMarquee(scene, scalar, bundle.marquee);
                    _this.glow = BigWinFactory.createGlow(scene, scalar, bundle.glow);
                    _this.text = BigWinFactory.createText(scene, _this.marquee, scalar, font.getFontName());
                    _this.coins = BigWinFactory.createCoins(scene, scalar, bundle);
                    _this.isLoaded = true;
                },
                onError: null
            });
            this.loader.addStage(bundle);
            this.loader.run();
            this.signal = {
                onComplete: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
        }
        /**
         * Gets the event dispatcher
         * @method eef.BigWinController#getEvents
         * @public
         * @returns {events.EventDispatcher<IBigWinControllerListener>}
         */
        BigWinController.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Determines if the big win controller has fully loaded
         * @method eef.BigWinController#isLoaded
         * @public
         * @returns {boolean} true if the object has loaded
         */
        BigWinController.prototype.getIsLoaded = function () {
            return this.isLoaded;
        };
        /**
         * Gets the big win level
         * @method eef.BigWinController#getLevel
         * @public
         * @returns {number} The big win level
         */
        BigWinController.prototype.getLevel = function () {
            return this.level;
        };
        /**
         * Sets the win value
         * @method eef.BigWinController#setWinValue
         * @public
         * @param {number} value Thew in value
         */
        BigWinController.prototype.setWinValue = function (value) {
            this.text.getText().setText(this.currencyFormatter.format(Math.round(value)));
        };
        /**
         * Gets the win value
         * @method eef.BigWinController#getWinValue
         * @public
         * @returns {number} The win value
         */
        BigWinController.prototype.getWinValue = function () {
            var win = parseInt(this.currencyFormatter.clean(this.text.getText().getText()), 10);
            return (isNaN(win)) ? 0 : win;
        };
        /**
         * Determines if the user has hit a big win
         * @method eef.BigWinController#checkBigWinLevel
         * @public
         * @param {number} bet The users current bet
         * @param {number} win The win value
         * @returns {boolean} True if the user has hit a big win
         */
        BigWinController.prototype.checkBigWinLevel = function (bet, win) {
            this.level = this.calulateLevel(bet, win);
            return (this.level >= 0);
        };
        /**
         * Plays the big win show
         * @method eef.BigWinController#play
         * @public
         * @param {number} level The big win level to play
         * @param {number} bangValue The current bang value
         * @param {number} win The win value
         */
        BigWinController.prototype.play = function (bangValue, win) {
            this.timeline.clear();
            this.bangTarget = bangValue + win;
            this.createReveal(bangValue);
            if (this.level > 0) {
                this.addCoins();
            }
            this.createEnding(this.timeline, false);
            this.timeline.play();
        };
        /**
         * Stops the big win show
         * @method eef.BigWinController#stop
         * @public
         */
        BigWinController.prototype.stop = function () {
            //handle the sounds
            this.timeline.clear();
            this.setWinValue(this.bangTarget);
            this.createEnding(new TimelineMax(), true);
        };
        /**
         * Creates the coin shower
         * @method eef.BigWinController#addCoins
         * @private
         */
        BigWinController.prototype.addCoins = function () {
            var nextLevel = 0;
            var maxLevels = 3;
            var durations = [8, 12, 15];
            var that = this;
            while (nextLevel < maxLevels && nextLevel < this.level) {
                this.timeline.add(function (level) {
                    return function () {
                        that.coins.stop();
                        that.coins.play(level);
                    };
                }(nextLevel), durations[nextLevel]);
                nextLevel++;
            }
        };
        /**
         * Creates the big win ending
         * @method eef.BigWinController#createEnding
         * @private
         */
        BigWinController.prototype.createEnding = function (timeline, playEnding) {
            var _this = this;
            timeline.add(function () {
                _this.coins.stop();
                var marqueeTransform = _this.marquee.getTransform();
                marqueeTransform.setVisible(false);
                marqueeTransform.setScale(0, 0);
                var glowTransfrom = _this.glow.getTransform();
                glowTransfrom.setVisible(false);
                glowTransfrom.setScale(0, 0);
                _this.glow.getFrameAnimator().stop(true);
                _this.text.getTransform().setVisible(false);
                _this.signal.onComplete();
                if (playEnding) {
                    _this.audioController.playBigWinEnd(_this.level);
                }
            }, "+=0.5");
        };
        /**
         * Creates the big win reveal timeline
         * @method eef.BigWinController#createBigWinReveal
         * @private
         * @param {number} bangValue The value to bang from
         */
        BigWinController.prototype.createReveal = function (bangValue) {
            var _this = this;
            var zoomDuration = 0.5;
            var duration = this.DURATIONS[this.level];
            this.timeline.add(function () {
                _this.audioController.playBigWinMusic(_this.level);
            });
            var reveal = new TimelineMax();
            reveal.add(function () {
                _this.marquee.getTransform().setVisible(true);
                _this.glow.getTransform().setVisible(true);
                _this.text.getTransform().setVisible(true);
            });
            var tweens = [];
            tweens.push(TweenMax.fromTo(this, duration, { setWinValue: bangValue }, { setWinValue: this.bangTarget, ease: Linear.easeNone }));
            tweens.push(function () {
                _this.glow.getFrameAnimator().play(-1);
            });
            tweens.push(TweenMax.to(this.marquee.getTransform(), zoomDuration, { setScaleX: 1, setScaleY: 1, ease: Power1.easeInOut }));
            tweens.push(TweenMax.to(this.glow.getTransform(), zoomDuration, { setScaleX: 3.5, setScaleY: 3, ease: Power1.easeInOut }));
            reveal.add(tweens);
            this.timeline.add(reveal);
        };
        /**
         * Calculates the bang level
         * @method eef.BangController#calculateBangLevel
         * @private
         * @param {number} bet The total bet
         * @param {number} win The total win
         * @returns {number} The bang level of this bang
         */
        BigWinController.prototype.calulateLevel = function (bet, win) {
            var level = 0;
            var winMultiple = win / bet;
            level = this.THRESHOLDS.length - 1;
            var winMultipleFromTable = this.THRESHOLDS[level];
            while (winMultiple <= winMultipleFromTable) {
                level--;
                winMultipleFromTable = this.THRESHOLDS[level];
            }
            return level;
        };
        return BigWinController;
    })();
    exports.BigWinController = BigWinController;
    /**
     * Win Stack text layout for anyway pay
     * @class winstack.WinStackAnywayTextLayout
     * @classdesc Anyway pay specific text layout
     */
    var WinStackAnywayTextLayout = (function () {
        /**
         * @constructor
         */
        function WinStackAnywayTextLayout(lineText, paysText, multiplierText, gradientText, gradientText1, numWaysText, translator, currencyFormatter) {
            this.lineText = lineText;
            this.paysText = paysText;
            this.multiplierText = multiplierText;
            this.gradientText = gradientText;
            this.gradientText1 = gradientText1;
            this.numWaysText = numWaysText;
            this.translator = translator;
            this.currencyFormatter = currencyFormatter;
        }
        /**
         * Start displaying Win Stack data
         * @method winstack.WinStackAnywayTextLayout#startWinStack
         * @param {IWinStackData} data Award data to display
         */
        WinStackAnywayTextLayout.prototype.startWinStack = function (data) {
            this.gradientText.getTransform().setVisible(false);
            this.gradientText1.getTransform().setVisible(false);
            if (!data.isBonusGuarantee) {
                this.displayLineAndPayText(data);
            }
        };
        /**
         * Set whether Win Stack is in free spin
         * @method winstack.WinStackAnywayTextLayout#setIsFreeSpin
         * @param {boolean} isFreeSpin True if in free spin, false otherwise
         */
        WinStackAnywayTextLayout.prototype.setIsFreeSpin = function (isFreeSpin) {
            this.isFreeSpin = isFreeSpin;
        };
        /**
         * Display headline text
         * @method winstack.WinStackAnywayTextLayout#showHeadline
         * @param {string} text Text for headline
         */
        WinStackAnywayTextLayout.prototype.showHeadline = function (text, text1) {
            this.gradientText.getTransform().setVisible(true);
            this.gradientText1.getTransform().setVisible(true);
            if (text != "") {
                var currentFont = this.gradientText.getText().getFont();
                var newFont = currentFont.replace("45px", "35px");
                this.gradientText.getText().setText(text);
                if (text.length > 22)
                    newFont = currentFont.replace("45px", "32px");
                else if (text.length > 16)
                    newFont = currentFont.replace("45px", "36px");
                this.gradientText.getText().setFont(newFont);
                this.gradientText1.getText().setText(text1);
            }
        };
        /**
         * Hide headline text
         * @method winstack.WinStackAnywayTextLayout#hideHeadline
         */
        WinStackAnywayTextLayout.prototype.hideHeadline = function () {
            this.gradientText.getTransform().setVisible(false);
            this.gradientText1.getTransform().setVisible(false);
        };
        /**
         * Show Bonus Guarantee display
         * @method winstack.WinStackAnywayTextLayout#showBonusGuarantee
         * @param {IWinStackData} data Award data to display
         */
        WinStackAnywayTextLayout.prototype.showBonusGuarantee = function (data) {
            this.numWaysText.getTransform().setVisible(false);
            this.lineText.getTransform().setVisible(false);
            var paysOutput = this.translator.findByKey("Pays_txt");
            this.paysText.getText().setText(paysOutput + " " + this.currencyFormatter.format(data.win));
            this.paysText.getText().setLineHeight(1.2);
            this.showHeadline(" BONUS GUARANTEE ", ""); //not translated on purpose
        };
        /**
         * Display line and pay text during pay cycling
         * @method winstack.WinStackAnywayTextLayout#displayLineAndPayText
         * @param {IWinStackData} data Award data to display
         */
        WinStackAnywayTextLayout.prototype.displayLineAndPayText = function (data) {
            this.lineText.getTransform().setVisible(true);
            this.paysText.getTransform().setVisible(true);
            this.numWaysText.getTransform().setVisible(true);
            var lineOutput = "";
            if ((data.id == 0) || (data.id == 12) || (data.id == 28)) {
                lineOutput = " " + this.translator.findByKey("FeaturePays_txt") + " ";
            }
            else if ((data.id == 48) || (data.id == 49) || (data.id == 50) || (data.id == 51) || (data.id == 52)) {
                lineOutput = " " + this.translator.findByKey("FeaturePays_txt") + " ";
            }
            else {
                lineOutput = " ";
            }
            this.lineText.getText().setText(lineOutput);
            this.lineText.getText().setLineHeight(1.2);
            var paysOutput = this.translator.findByKey("Pays_txt");
            this.paysText.getText().setText(paysOutput + " " + this.currencyFormatter.format(data.win));
            this.paysText.getText().setLineHeight(1.2);
            if (this.isFreeSpin) {
                this.multiplierText.getTransform().setVisible(true);
                this.multiplierText.getText().setText(" (" + this.currencyFormatter.format(data.win / data.multiplier) + " x " + data.multiplier + "X) ");
            }
            var numWays = data.numWays;
            var waysKey = "way_txt";
            if (numWays > 1) {
                waysKey = "ways_txt";
            }
            var waysText = numWays.toString() + " " + this.translator.findByKey(waysKey);
            if ((data.id == 0) || (data.id == 12) || (data.id == 28) || (data.id == 48) || (data.id == 49) || (data.id == 50) || (data.id == 51) || (data.id == 52)) {
                this.numWaysText.getText().setText("");
            }
            else {
                this.numWaysText.getText().setText(waysText);
            }
            this.numWaysText.getText().setLineHeight(1.2);
        };
        /**
         * Reset text elements
         * @method winstack.WinStackAnywayTextLayout#resetPayInformation
         */
        WinStackAnywayTextLayout.prototype.resetPayInformation = function () {
            this.lineText.getTransform().setVisible(false);
            this.paysText.getTransform().setVisible(false);
            this.numWaysText.getTransform().setVisible(false);
            this.multiplierText.getTransform().setVisible(false);
        };
        return WinStackAnywayTextLayout;
    })();
    exports.WinStackAnywayTextLayout = WinStackAnywayTextLayout;
    /**
     * CycleResultsController
     * @class eef.CycleResultsController
     * @classdesc Controls the cycle results show
     */
    var CycleResultsController = (function () {
        /**
         * @constructor
         */
        function CycleResultsController(pulseDisplay, winStack, group) {
            this.pulseDisplay = pulseDisplay;
            this.winStack = winStack;
            this.group = group;
            this.duration = 0.6;
            this.timeline = new TimelineMax();
            this.signal = {
                onComplete: null,
                onNextResult: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
        }
        /**
         * Gets the event dispatcher
         * @method eef.CycleResultsController#getEvents
         * @public
         * @returns {event.EventDispatcher<ICycleResultsListener>} The event dispatcher
         */
        CycleResultsController.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Sets the duration for the pulse display
         * @method eef.CycleResultsController#setDuration
         * @public
         * @param {number} duration The duration to pulse
         */
        CycleResultsController.prototype.setDuration = function (duration) {
            this.duration = duration;
        };
        /**
         * Set the cycle result data
         * @method eef.CycleResultsController#setResults
         * @public
         * @param {gamedata.GamePlayData} results The results to cycle through
         * @param {boolean} showBonusGuarantee True if bonus guarantee should be shown when available
         */
        CycleResultsController.prototype.setResults = function (data, showBonusGuarantee) {
            this.totalWin = data.getTotalWin();
            this.totalStake = data.getWager();
            this.results = data.getAllSlotResults();
            this.filterResults(function (result) {
                return result.getValue() > 0 || result.isBonusTrigger();
            });
            this.showBonusGuarantee = showBonusGuarantee;
        };
        /**
         * Filters the cycle results based on the function passed in. The filter function must
         * take an ISlotResult object as a parameter and return a boolean value.
         * @method eef.CycleResultsController#filterResults
         * @public
         * @param {(result: gamedata.ISlotResult) => boolean} filterFunction The eval function determining which results to filter
         */
        CycleResultsController.prototype.filterResults = function (filterFunction) {
            this.results = this.results.filter(filterFunction);
        };
        /**
         * Start the cycle results
         * @method eef.CycleResultsController#start
         * @public
         */
        CycleResultsController.prototype.start = function () {
            if (this.results.length > 0) {
                if (this.timeline) {
                    this.timeline.clear();
                }
                if (this.totalWin <= this.totalStake) {
                    this.timeline = new TimelineMax({
                        repeat: 0,
                        repeatDelay: 0.5
                    });
                }
                else {
                    this.timeline = new TimelineMax({
                        repeat: -1,
                        repeatDelay: 0.5
                    });
                }
                this.timeline.add(this.cycle());
            }
            else {
                this.signal.onComplete();
            }
        };
        /**
         * Stops the cycle results
         * @method eef.CycleResultsController#stop
         * @public
         */
        CycleResultsController.prototype.stop = function (forceStop) {
            this.timeline.clear();
            this.winStack.reset();
            this.pulseDisplay.clearSymbols();
            if (forceStop) {
                this.signal.onComplete();
            }
        };
        /**
         * Accessor for the winstack.
         * @method eef.CycleResultsController#getWinStack
         * @public
         */
        CycleResultsController.prototype.getWinStack = function () {
            return this.winStack;
        };
        /**
         * Cycles the results
         * @method eef.CycleResultsController#cycle
         * @private
         * @returns {TimelineMax} The created timeline with cycle results animations
         */
        CycleResultsController.prototype.cycle = function () {
            var _this = this;
            var timeline = new TimelineMax();
            var funcs = [];
            var highlightData = [];
            var reelOffsets = null;
            var that = this;
            for (var i = 0; i < this.results.length; i++) {
                reelOffsets = this.results[i].getOffsets();
                highlightData.push(reelOffsets.map(function (offset) { return Utils.convertOffset(offset, EEFConfig.NUMBER_OF_REELS); }));
            }
            for (var i = 0; i < highlightData.length; i++) {
                funcs.push(function (i) {
                    return function () {
                        that.pulseDisplay.start(highlightData[i], that.duration);
                        that.winStack.play({
                            id: that.results[i].getId(),
                            win: that.results[i].getValue(),
                            numWays: (that.results[i].getWinType() == 2 /* ANYWAY */ ? that.results[i].getNumberOfWays() : 1),
                            isFreeSpinData: false,
                            isBonusGuarantee: that.showBonusGuarantee && that.results[i].isBonusPay(),
                            multiplier: 1,
                            highlights: highlightData[i]
                        }, that.group, "#FF00FF", "#FAEBD7");
                        that.signal.onNextResult();
                    };
                }(i));
            }
            timeline.add(funcs, 0, "normal", this.duration * 2);
            var singleCycleDuration = highlightData.length * this.duration * 2;
            timeline.add(function () {
                _this.signal.onComplete();
            }, "+=" + singleCycleDuration.toString());
            return timeline;
        };
        return CycleResultsController;
    })();
    exports.CycleResultsController = CycleResultsController;
    /**
     * @class winstack.WinStack
     * @classdesc Win stack display
     */
    var WinStack = (function () {
        /**
         * @constructor
         */
        function WinStack(creationData) {
            this.logo = creationData.logo;
            this.symbols = creationData.symbols;
            this.payBoxes = creationData.payBoxes;
            this.clickToStartText = creationData.clickToStartText;
            this.infoPanel = creationData.panel;
            this.symbolMap = creationData.symbolMap;
            this.textLayout = creationData.textLayout;
            this.fgLogo = creationData.fglogo;
            this.customSymbols = [];
            this.allowShowLogo = true;
            this.allowHeadlineToggle = true;
            this.isFg = false;
        }
        /**
         * Displays a headline in the win stack
         *
         * @param   text    the string to render
         */
        WinStack.prototype.displayHeadline = function (text, text1) {
            this.setVisible(true);
            this.logo.getTransform().setVisible(false);
            this.textLayout.showHeadline(text, text1);
        };
        /**
         * Toggle visibility of the win stack
         *
         * @param   isVisible   true to show the win stack
         */
        WinStack.prototype.setVisible = function (isVisible) {
            this.infoPanel.getTransform().setVisible(isVisible);
        };
        /**
         * Flag to set free spin mode
         *
         * @param   isFreeSpin  true to identify free spin mode
         */
        WinStack.prototype.setIsFreeSpin = function (isFreeSpin) {
            this.isFg = isFreeSpin;
            // this.textLayout.setIsFreeSpin(isFreeSpin);
        };
        /**
         * Allow the logo to be shown
         *
         * @param   allow   true to allow the logo to be displayed
         */
        WinStack.prototype.setAllowShowLogo = function (allow) {
            this.allowShowLogo = allow;
        };
        /**
         * Allow the headline to be toggled
         *
         * @param   allow   true to allow the headline to be toggled on/off
         */
        WinStack.prototype.setAllowHeadlineToggle = function (allow) {
            this.allowHeadlineToggle = allow;
        };
        /**
         * Show a payline
         *
         * @param   data            the payline data
         * @param   group           the reel group
         * @param   symbolConfig    the list of symbols
         */
        WinStack.prototype.play = function (data, group, boxColor, boxHalfColor) {
            if (data.win > 0) {
                this.setVisible(true);
                this.showLogo(false);
                this.textLayout.startWinStack(data);
                this.toggleSymbols(this.symbolMap, group, data);
                this.displayPayBoxes(data, group, boxColor, boxHalfColor);
            }
        };
        /**
         * Bang up the free spins awarded text
         *
         * @param   spins   the number of spins awarded
         * @param   action  the function to call when each number is displayed
         */
        WinStack.prototype.displaySpinsAwarded = function (spins, action) {
            var _this = this;
            var timeline = new TimelineLite();
            var funcs = [];
            var fromObj = { setOpacity: 0 };
            var toObj = {
                setOpacity: 1,
                onStart: function () { return _this.clickToStartText.getTransform().setVisible(true); }
            };
            TweenMax.fromTo(this.clickToStartText.getText(), 0.75, fromObj, toObj).repeat(-1).yoyo(true);
            var that = this;
            for (var i = 0; i < spins; i++) {
                funcs.push(function (spin) {
                    var _this = this;
                    return function () {
                        action();
                        //var output: string = " " + this.translation.getFreeSpinsAwarded() + " " + (spin + 1) + " ";
                        _this.displayHeadline("");
                    };
                }(i));
            }
            timeline.add(funcs, 0, "normal", .25);
        };
        /**
         * Slide the win stack in or out of view
         *
         * @param   slideOut    true to slide the win stack out of view
         */
        WinStack.prototype.slide = function (yPos) {
            TweenLite.to(this.infoPanel.getTransform(), 0.5, { setPositionY: yPos });
        };
        /**
         * Stop all cycling and display the logo
         */
        WinStack.prototype.reset = function () {
            this.showLogo(true);
            this.resetPayInformation();
            this.clickToStartText.getTransform().setVisible(false);
            if (this.allowHeadlineToggle) {
                this.textLayout.hideHeadline();
            }
        };
        /**
         * Add custom symbol image to display in win stack
         * @method winstack.WinStack#addCustomSymbolImage
         * @public
         * @param {IWinStackCustomSymbol} symbolData Custom symbol image properties
         */
        WinStack.prototype.addCustomSymbolImage = function (symbolData) {
            this.customSymbols.push(symbolData);
        };
        /**
         * Restore default symbol images
         * @method winstack.WinStack#restoreSymbolImages
         * @public
         * @param {abg2d.SpriteSheet} spriteSheet Default symbol images
         */
        WinStack.prototype.restoreSymbolImages = function (spriteSheet) {
            // Note: This method takes advantage of the assumption that all symbol images
            // are stored in a single sprite sheet by default.
            this.customSymbols = [];
            this.symbols.forEach(function (symbolActor) {
                symbolActor.getImage().setSpriteSheet(spriteSheet);
            });
        };
        /**
         * Reset the elements that make up the payline cycling
         */
        WinStack.prototype.resetPayInformation = function () {
            this.resetSymbols();
            this.togglePayBoxes(false);
            this.textLayout.resetPayInformation();
        };
        /**
         * Show or hide the text
         *
         * @param   data    the payline data
         */
        WinStack.prototype.displayLineAndPayText = function (data) {
            this.textLayout.displayLineAndPayText(data);
        };
        /**
         * Show or hide the payboxes
         *
         * @param   data    the payline data
         * @param   group   the reel group
         */
        WinStack.prototype.displayPayBoxes = function (data, group, boxColor, boxHalfColor) {
            //create manual targets for when payline id is null
            var targets = [];
            var color = "";
            var halfColor = "";
            var reelCount = group.getReelCount();
            var symbolsInReel = 0;
            //turn the pay boxes on
            this.togglePayBoxes(true);
            for (var i = 0; i < reelCount; i++) {
                symbolsInReel = group.getController(i).getLayout().getWindowSize() - 2;
                for (var j = 0; j < symbolsInReel; j++) {
                    var nonHighlightedBox = this.payBoxes[i][j];
                    nonHighlightedBox.getBox().setColor("#FAEBD7");
                }
            }
            for (var highlightId = 0; highlightId < data.highlights.length; highlightId++) {
                var highlight = data.highlights[highlightId];
                var reelPosition = highlight.reelposition;
                var reelId = highlight.reelnumber;
                var highlightedBox = this.payBoxes[reelId][reelPosition];
                highlightedBox.getBox().setColor("#FF00FF");
            }
        };
        /**
         * Show or hide the symbols
         *
         * @param   symbolConfig    the symbols
         * @param   group           the reel group
         * @param   data            the data
         */
        WinStack.prototype.toggleSymbols = function (symbolMap, group, data) {
            this.resetSymbols();
            var highlight = null;
            var reelNumber = 0;
            var reelPosition = 0;
            var layout = null;
            var reel = null;
            var symbolId = 0;
            var actor = null;
            var image = null;
            var WildReplaceSymbol = 0;
            for (var highlightId = 0; highlightId < data.highlights.length; highlightId++) {
                highlight = data.highlights[highlightId];
                reelNumber = highlight.reelnumber;
                if (reelNumber == 0) {
                    reelPosition = highlight.reelposition;
                    layout = group.getController(reelNumber).getLayout();
                    reel = layout.getReel();
                    WildReplaceSymbol = reel.getSymbolId(reelPosition + 1);
                    break;
                }
            }
            for (var highlightId = 0; highlightId < data.highlights.length; highlightId++) {
                highlight = data.highlights[highlightId];
                reelNumber = highlight.reelnumber;
                reelPosition = highlight.reelposition;
                layout = group.getController(reelNumber).getLayout();
                reel = layout.getReel();
                symbolId = reel.getSymbolId(reelPosition + 1);
                if (symbolId == 0) {
                    symbolId = WildReplaceSymbol;
                }
                this.showSymbol(symbolMap, symbolId, reelNumber);
            }
        };
        /**
         * Show symbol in win stack display
         * @method winstack.WinStack#showSymbol
         * @private
         * @param {number[]} symbolMap Map of symbol ids to frame indices
         * @param {number} symbolId Id of symbol to display
         * @param {number} reelNumber Reel that symbol is on
         */
        WinStack.prototype.showSymbol = function (symbolMap, symbolId, reelNumber) {
            // Scan for custom images for this symbol and on this reel
            var customImage = null;
            for (var i = 0; i < this.customSymbols.length && customImage == null; ++i) {
                var symbol = this.customSymbols[i];
                if (symbol.symbolId == symbolId && symbol.reelId == reelNumber) {
                    customImage = symbol;
                }
            }
            // Configure actor to display symbol
            var actor = this.symbols[reelNumber];
            var image = actor.getImage();
            if (customImage == null) {
                image.setFrame(symbolMap[symbolId]);
            }
            else {
                image.setSpriteSheet(customImage.spriteSheet);
                image.setFrame(customImage.frameNumber);
            }
            actor.getTransform().setVisible(true);
        };
        /**
         * Reset the symbols
         */
        WinStack.prototype.resetSymbols = function () {
            var symbol = null;
            for (var i = 0; i < this.symbols.length; i++) {
                symbol = this.symbols[i];
                symbol.getImage().setFrame(-1);
                symbol.getTransform().setVisible(false);
            }
        };
        /**
         * Toggle the pay boxes
         *
         * @param   show    true to show the pay boxes
         */
        WinStack.prototype.togglePayBoxes = function (show) {
            var actor = null;
            for (var i = 0; i < this.payBoxes.length; i++) {
                for (var j = 0; j < this.payBoxes[i].length; j++) {
                    actor = this.payBoxes[i][j];
                    actor.getTransform().setVisible(show);
                    actor.getBox().setColor("#FFFFFF");
                }
            }
        };
        /**
         * Fade the logo
         *
         * @param   show    true to show the logo
         */
        WinStack.prototype.showLogo = function (show) {
            if (this.allowShowLogo) {
                this.logo.getTransform().setVisible(show);
                this.infoPanel.getTransform().setVisible(!show);
                this.textLayout.hideHeadline();
                if (UIFactory.scalar == 1) {
                    this.fgLogo.getTransform().setVisible(show);
                }
                else {
                    this.fgLogo.getTransform().setVisible(true);
                }
            }
        };
        return WinStack;
    })();
    exports.WinStack = WinStack;
    var XHRObject = (function () {
        function XHRObject(responseText, finalPlayResponse) {
            this.responseText = responseText;
            this.response = responseText;
            this.responseURL = finalPlayResponse.responseURL;
            this.statusText = finalPlayResponse.statusText;
        }
        return XHRObject;
    })();
    exports.XHRObject = XHRObject;
    /**
     * FSIntro
     * @class eef.freespin.FSIntro
     * @classdesc Handles animations for Free Spin bonus intro.
     */
    var FSIntro = (function () {
        /**
         * Constructor
         * @method eef.freespins.FSIntro#constructor
         * @public
         */
        function FSIntro(fsBundle, background, scalar, scene, translator, infoMarquee, audioController) {
            var _this = this;
            this.infoMarquee = infoMarquee;
            this.translator = translator;
            this.audioController = audioController;
            //create to-bonus transition
            this.transition = new FSTransition(fsBundle, new abg2d.SpriteSheet(fsBundle.background, scalar), background, scalar, scene, audioController);
            this.transition.getEvents().add({
                onSwap: function () {
                    _this.displayInfoMarquee();
                    _this.signal.onReadyToSwap();
                },
                onComplete: null
            });
            //setup event dispatcher
            this.signal = {
                onTouchToStart: null,
                onReadyToSwap: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
        }
        /**
         * Get the event dispatcher
         * @method eef.freespin.FSIntro#getEvents
         * @public
         * @return  {events.EventDispatcher<IFSIntroListener>} The event dispatcher.
         */
        FSIntro.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        FSIntro.prototype.setAutoTouchToStart = function (auto) {
            this.infoMarquee.setAutoTouchToStart(auto);
        };
        /**
         * Begins the intro transition
         * @method eef.freespin.FSIntro#play
         * @public
         * @param {number} spinsAwarded The number of spins awarded for this freespin
         */
        FSIntro.prototype.play = function (spinsAwarded) {
            this.spinsAwarded = spinsAwarded;
            this.transition.playDoors();
        };
        /**
         * Display the info marquee
         * @method eef.freespin.FSIntro#displayTouchToStart
         * @private
         */
        FSIntro.prototype.displayInfoMarquee = function () {
            var _this = this;
            this.audioController.handleFreeSpinIntroLoop(true);
            this.infoMarquee.setHeading(this.translator.findByKey("Fs_awarded"), 0.48);
            this.infoMarquee.setBodyText(this.spinsAwarded.toString(), 0.20);
            this.infoMarquee.setTouchableText(this.translator.findByKey("Click_start"), function () {
                _this.signal.onTouchToStart();
                _this.audioController.handleFreeSpinIntroLoop(false);
                _this.audioController.handleFreeSpinMusicLoop(true);
            });
            this.infoMarquee.transition(function () {
            });
        };
        return FSIntro;
    })();
    exports.FSIntro = FSIntro;
    /**
     * FSOutro
     * @class eef.FSOutro
     * @classdesc Handles animations for Free Spin bonus intro transitions.
     */
    var FSOutro = (function () {
        /**
         * Constructor
         * @method eef.FSOutro#constructor
         * @public
         */
        function FSOutro(fsBundle, baseBundle, background, scalar, scene, currencyFormatter, translator, infoMarquee, audioController) {
            var _this = this;
            /** Win threshold for displaying tally animation */
            this.TALLY_THRESHOLD_RATIO = 0.2;
            this.signal = {
                onReadyToSwap: null,
                onTransitionComplete: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
            this.currencyFormatter = currencyFormatter;
            this.infoMarquee = infoMarquee;
            this.translator = translator;
            this.audioController = audioController;
            //create to-basegame transition
            this.transition = new FSTransition(fsBundle, new abg2d.SpriteSheet(baseBundle.background, scalar), background, scalar, scene, audioController);
            this.transition.getEvents().add({
                onSwap: function () {
                    _this.signal.onReadyToSwap();
                },
                onComplete: function () {
                    _this.signal.onTransitionComplete();
                }
            });
        }
        /**
         * Get dispatcher to listen for events
         * @method eef.FSOutro#getEvents
         * @public
         * @returns {events.EventDispatcher<IFSOutroEvents>} Event dispatcher
         */
        FSOutro.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Play the outro
         * @method eef.FSOutro#play
         * @public
         * @param {number} totalWin The total win from the FS bonus
         * @param {number} bet The player bet during the FS Bonus
         * @param {boolean} isWinCap True if win cap reached, false otherwise
         */
        FSOutro.prototype.play = function (totalWin, bet, isWinCap) {
            var _this = this;
            var winRatio = totalWin / bet;
            //if we have a high enough win ratio, play the tally
            if (winRatio > this.TALLY_THRESHOLD_RATIO) {
                var win = this.currencyFormatter.format(totalWin);
                this.infoMarquee.setBodyText(win, 0.47);
                var heading;
                if (isWinCap) {
                    heading = this.translator.findByKey("maxwin_txt");
                }
                else {
                    heading = this.translator.findByKey("Total_Bonus_Win_Text");
                }
                this.infoMarquee.setHeading(heading, 0.35);
                this.infoMarquee.setTouchableText("", function () {
                });
                this.infoMarquee.transition(function () {
                    _this.transition.playDoors();
                });
                this.audioController.handleFreeSpinEnd(true);
            }
            else {
                this.transition.playFlash();
            }
        };
        return FSOutro;
    })();
    exports.FSOutro = FSOutro;
    /**
     * Retrigger
     * @class eef.Retrigger
     * @classdesc Class definition for regtriggering during the free spin game
     */
    var Retrigger = (function () {
        /**
         * @constructor
         */
        function Retrigger(infoMarquee, translator) {
            this.infoMarquee = infoMarquee;
            this.translator = translator;
        }
        /**
         * Sets the spins awarded
         * @method eef.Retrigger#setSpinsAwarded
         * @public
         * @param {number} spins The number of spins awarded
         */
        Retrigger.prototype.setSpinsAwarded = function (spins) {
            this.spins = spins;
        };
        /**
         * Plays the retrigger animation
         * @method eef.Retrigger#play
         * @public
         * @param {Function} completeCallback The function to call when the animation is complete
         */
        Retrigger.prototype.play = function (completeCallback) {
            this.infoMarquee.setRetriggerHeading(this.translator.findByKey('Fs_retrigger').toUpperCase());
            var bodyText = this.translator.findByKey('Additional_FreeSpins_Awarded_txt').toUpperCase();
            bodyText = bodyText.replace('{0}', this.spins.toString());
            this.infoMarquee.setRetriggerBodyText(bodyText);
            this.infoMarquee.setTouchableText("", function () {
            });
            this.infoMarquee.transition(function () {
                completeCallback();
            });
        };
        return Retrigger;
    })();
    exports.Retrigger = Retrigger;
    /**
     * FSInfoMarquee
     * @class eef.FSInfoMarquee
     * @classdesc Class for handling information display during free spin
     */
    var FSInfoMarquee = (function () {
        /**
         * @constructor
         */
        function FSInfoMarquee(bundle, scene, scalar, deviceContext, inputHandler, fontName) {
            this.scene = scene;
            this.scalar = scalar;
            this.bundle = bundle;
            this.deviceContext = deviceContext;
            this.inputHandler = inputHandler;
            this.readyForTouch = false;
            this.duration = 0.5;
            this.pauseDuration = 3 + this.duration;
            this.marquee = this.createMarquee();
            this.body = this.createText(200, 0.27, 1, scalar, fontName);
            this.heading = this.createText(60, 0.48, 1, scalar, fontName);
            this.touchableText = this.createTouchText(80, 0.62, 1, scalar, fontName);
            this.touchableText.setName("freeSpin-touchableText");
            this.retriggerHeading = this.createText(70, 0.40, 1, scalar, fontName);
            this.retriggerDesc = this.createText(60, 0.50, 1, scalar, fontName);
            this.setInputHandler();
            this.dimmer = this.createDimmer();
            this.autoTouchToStart = false;
        }
        /**
         * Transitions the marquee into view
         * @method eef.FSInforMarquee#transition
         * @public
         * @param {Function} completeCallback The function to call when the transition has completed
         */
        FSInfoMarquee.prototype.transition = function (completeCallback) {
            var marqueeTransform = this.marquee.getTransform();
            var dimmerBox = this.dimmer.getBox();
            this.timeline = new TimelineMax();
            //change to use timeline.to instead of creating the tweens...
            this.timeline.to(marqueeTransform, 0, { setScaleX: 1, setScaleY: 1, ease: Power1.easeOut }, 0);
            this.timeline.to(dimmerBox, 0, { setOpacity: 0.75 }, 0);
            if (this.touchableText.getText().getText().length > 0) {
                this.readyForTouch = true;
                this.timeline.add(this.createTouchableTextAnimation());
            }
            else {
                this.createEnding(completeCallback);
            }
        };
        /**
         * Sets the win text field
         * @method eef.FSInfoMarquee#setWinText
         * @public
         * @param {string} text The text to use
         */
        FSInfoMarquee.prototype.setBodyText = function (text, yOffset) {
            var parentImage = this.marquee.getImage();
            var xPos = parentImage.getWidth() / 2;
            var yPos = parentImage.getHeight() * yOffset;
            this.body.getTransform().setPosition(xPos, yPos);
            this.body.getTransform().setVisible(true);
            this.heading.getTransform().setVisible(true);
            this.retriggerHeading.getTransform().setVisible(false);
            this.retriggerDesc.getTransform().setVisible(false);
            this.body.getText().setText(text);
        };
        FSInfoMarquee.prototype.setRetriggerBodyText = function (text) {
            this.body.getTransform().setVisible(false);
            this.heading.getTransform().setVisible(false);
            this.retriggerHeading.getTransform().setVisible(true);
            this.retriggerDesc.getTransform().setVisible(true);
            this.retriggerDesc.getText().setText(text);
        };
        /**
         * Set the heading
         * @method eef.FSInfoMarquee#setHeading
         * @public
         * @param {string} text The text to display
         */
        FSInfoMarquee.prototype.setHeading = function (text, yOffset) {
            var parentImage = this.marquee.getImage();
            var xPos = parentImage.getWidth() / 2;
            var yPos = parentImage.getHeight() * yOffset;
            this.heading.getTransform().setPosition(xPos, yPos);
            this.heading.getText().setText(text);
        };
        FSInfoMarquee.prototype.setRetriggerHeading = function (text) {
            this.retriggerHeading.getText().setText(text);
        };
        /**
         * Set the touchable text
         * @method eef.FSInfoMarquee#setTouchableText
         * @public
         * @param {string} text The text to display
         * @param {Function} touchCallback The function to call when the user touches the screen
         */
        FSInfoMarquee.prototype.setTouchableText = function (text, touchCallback) {
            this.touchCallback = touchCallback;
            this.touchableText.getText().setText(text);
        };
        FSInfoMarquee.prototype.setAutoTouchToStart = function (auto) {
            this.autoTouchToStart = auto;
        };
        /**
         * Creates the end of the animation
         * @method eef.FSInfoMarquee#createEnding
         * @private
         * @param {Function} completeCallback The function to call when the animation is complete
         */
        FSInfoMarquee.prototype.createEnding = function (completeCallback) {
            var marqueeTransform = this.marquee.getTransform();
            var dimmerBox = this.dimmer.getBox();
            this.timeline.to(marqueeTransform, 0, { setScaleX: 0, setScaleY: 0, ease: Power1.easeOut }, this.pauseDuration);
            this.timeline.to(dimmerBox, 0, { setOpacity: 0, onComplete: function () {
                completeCallback();
            } }, this.pauseDuration);
        };
        /**
         * Creates the marquee
         * @method eef.FSInfoMarquee#createMarquee
         * @private
         * @returns {abg2d.Actor} The created actor
         */
        FSInfoMarquee.prototype.createMarquee = function () {
            var actor = abg2d.Factory.composeImage(this.scene, null, new abg2d.SpriteSheet(this.bundle.tally, this.scalar));
            actor.getImage().setAlign(6 /* Center */);
            var transform = actor.getTransform();
            var width = this.deviceContext.getBaselineWidth();
            var height = this.deviceContext.getBaselineHeight();
            transform.setZOrder(EEFConfig.MARQUEE_Z);
            transform.setPosition(width / 2, height / 2);
            transform.setScale(0, 0);
            return actor;
        };
        /**
         * Creates the text for the marquee
         * @method eef.FSInfoMarquee#createText
         * @private
         * @param {number} fontSize The size of the font to use
         * @param {number} yOffset The offset to place the actor on the y axis
         * @param {number} lineHeight The height of a line of text
         * @param {number} scalar The scale factor
         * @param {string} fontName The name of the font
         * @returns {abg2d.Actor} The created actor
         */
        FSInfoMarquee.prototype.createText = function (fontSize, yOffset, lineHeight, scalar, fontName) {
            var actor = abg2d.Factory.composeText(this.scene, this.marquee);
            var parentImage = this.marquee.getImage();
            var xPos = parentImage.getWidth() / 2;
            var yPos = parentImage.getHeight() * yOffset;
            var textActor = actor.getText();
            textActor.setFont(fontSize + "px " + fontName);
            textActor.setMaxLineWidth(parentImage.getWidth() - (parentImage.getWidth() * 0.3));
            textActor.setLineHeight(lineHeight);
            textActor.setAlign(1 /* TopCenter */);
            textActor.setScalar(scalar);
            actor.getTransform().setPosition(xPos, yPos);
            abg2d.TextFactory.createFillText(textActor, "black");
            abg2d.TextFactory.createFillText(textActor, "black");
            textActor.addEffect(new abg2d.SolidStrokeEffect("#000000", 8));
            textActor.addEffect(new abg2d.SolidStrokeEffect("#ff0000", 4));
            textActor.addEffect(new abg2d.ShadowTextEffect("#ff6e02", 8, 8, "#000000", 15));
            textActor.addEffect(new abg2d.GradientFillEffect(["#f66d24", "#ffff00", "#f66d24"], [0, 0.5, 1], 1.0, 0.0, 0, 0)); //these last two params do nothing                                            
            return actor;
        };
        FSInfoMarquee.prototype.createTouchText = function (fontSize, yOffset, lineHeight, scalar, fontName) {
            var actor = abg2d.Factory.composeText(this.scene, this.marquee);
            var parentImage = this.marquee.getImage();
            var xPos = parentImage.getWidth() / 2;
            var yPos = parentImage.getHeight() * yOffset;
            var textActor = actor.getText();
            textActor.setFont(fontSize + "px " + fontName);
            textActor.setMaxLineWidth(parentImage.getWidth() - (parentImage.getWidth() * 0.1));
            textActor.setLineHeight(lineHeight);
            textActor.setAlign(1 /* TopCenter */);
            textActor.setScalar(scalar);
            actor.getTransform().setPosition(xPos, yPos);
            abg2d.TextFactory.createFillText(textActor, "black");
            textActor.addEffect(new abg2d.SolidStrokeEffect("#000000", 4));
            textActor.addEffect(new abg2d.ShadowTextEffect("#ff6e02", 8, 8, "#000000", 15));
            abg2d.TextFactory.createFillText(textActor, "white");
            return actor;
        };
        /**
         * Creates the dim background
         * @method eef.FSInforMarquee#createDimmer
         * @private
         * @returns {abg2d.Actor} The created actor
         */
        FSInfoMarquee.prototype.createDimmer = function () {
            var actor = abg2d.Factory.composeBox(this.scene, null);
            actor.getTransform().setZOrder(EEFConfig.MARQUEE_Z - 1);
            var box = actor.getBox();
            box.setSize(0, 0);
            box.setOpacity(0);
            box.setColor("black");
            return actor;
        };
        /**
         * Create the touchable text animation
         * @method eef.FSInfoMarquee#createTouchableTextAnimation
         * @private
         */
        FSInfoMarquee.prototype.createTouchableTextAnimation = function () {
            var _this = this;
            var timeline = new TimelineMax({
                onStart: function () {
                    _this.readyForTouch = true;
                    _this.touchableText.getText().setOpacity(1);
                    if (_this.autoTouchToStart) {
                        _this.handleTouch();
                    }
                },
                yoyo: true,
                repeat: -1
            });
            return timeline.to(this.touchableText.getText(), this.duration, { setOpacity: 0.1 }, 0);
        };
        /**
         * Sets up the touch region for the touchable text
         * @method eef.FSInfoMarquee#setInputHandler
         * @private
         */
        FSInfoMarquee.prototype.setInputHandler = function () {
            var _this = this;
            var bounds = new abg2d.Rect();
            this.marquee.getImage().getDrawBounds(bounds);
            var inputResolver = new input.InputResolver(bounds.x, bounds.y, bounds.width, bounds.height);
            var region = {
                touchPosX: 0,
                touchPosY: 0,
                onStart: function (id, x, y) {
                    _this.handleTouch();
                },
                onMove: function (id, x, y) {
                },
                onEnd: function (id, x, y) {
                },
                getX: function () {
                    return bounds.x;
                },
                getY: function () {
                    return bounds.y;
                },
                getWidth: function () {
                    return bounds.width;
                },
                getHeight: function () {
                    return bounds.height;
                },
                getLayer: function () {
                    return 0;
                },
                isActive: function () {
                    return _this.readyForTouch;
                },
                isBlocking: function () {
                    return false;
                }
            };
            inputResolver.addRegion(region);
            this.inputHandler.addResolver(inputResolver);
        };
        /**
         * Handles the touch event
         * @method eef.FSInfoMarquee#handleTouch
         * @private
         */
        FSInfoMarquee.prototype.handleTouch = function () {
            var _this = this;
            this.readyForTouch = false;
            this.createEnding(function () {
                _this.touchCallback();
                var text = _this.touchableText.getText();
                text.setText("");
                text.setOpacity(1);
            });
        };
        return FSInfoMarquee;
    })();
    exports.FSInfoMarquee = FSInfoMarquee;
    /**
     * @class eef.FreeSpin
     * @classdesc View control for free spin bonus
     */
    var FreeSpin = (function () {
        /**
         * @constructor
         */
        function FreeSpin(slot, fsBundle, baseBundle, scene, scalar, background, currencyFormatter, inputHandler, translator, partnerAdapter, uiController, deviceContext, audioController) {
            var _this = this;
            this.isHistoryReplay = false;
            this.translator = translator;
            this.slotDisplay = slot;
            this.partnerAdapter = partnerAdapter;
            this.uiController = uiController;
            this.audioController = audioController;
            this.demoMenu = this.uiController.getDemoMenu();
            this.bonusText = this.createBonusText(scene, scalar, baseBundle.myriadProSemiBold, "35px", false);
            this.winDisplayController = slot.getWinDisplayController();
            this.cycleResults = this.winDisplayController.getCycleResults();
            this.cycleResults.getEvents().add({
                onComplete: function () {
                    _this.onCycleComplete();
                },
                onNextResult: null
            });
            this.winStack = this.cycleResults.getWinStack();
            if (this.demoMenu != null) {
                this.demoMenu.getEvents().add({
                    onItemClicked: null,
                    onMenuOpened: null,
                    onMenuClosed: null,
                    onGaffToggled: function (gaffOn) {
                        _this.paused = gaffOn;
                        _this.signal.onGaffToggled(gaffOn);
                        _this.slotDisplay.setGaffingEnabled(gaffOn);
                    }
                });
            }
            this.isLoaded = false;
            this.hasTriggered = false;
            this.paused = false;
            this.isActive = false;
            var loader = new asset.AssetLoader();
            loader.getEvents().add({
                onStarted: null,
                onProgress: function (id, stageProgress, totalProgress) {
                    _this.partnerAdapter.updatedLoadingProgress(Math.min(1, stageProgress));
                },
                onComplete: function (id, allComplete) {
                    _this.isLoaded = true;
                    _this.setupTransitions(scene, scalar, fsBundle, baseBundle, background, currencyFormatter, inputHandler, translator, deviceContext, baseBundle.myriadProSemiBold.getFontName());
                    if (_this.hasTriggered) {
                        _this.startFreeSpin();
                    }
                    if (_this.isHistoryReplay) {
                        _this.setAutoTouchToStart(true);
                    }
                },
                onError: null
            });
            loader.addStage(fsBundle);
            loader.run();
            //setup event dispatcher
            this.signal = {
                onGaffToggled: null,
                onSpin: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
            this.bangController = this.winDisplayController.getBangController();
            this.bangController.getEvents().add({
                onStart: null,
                onComplete: function () {
                    _this.onBangComplete();
                }
            });
            this.totalWin = 0;
            this.previousTotalWin = 0;
            this.totalwinFlag = true;
        }
        /**
         * Get dispatcher for free spin events
         * @method eef.FreeSpin#getEvents
         * @public
         * @returns {events.EventDispatcher<IFreeSpinListener>} Event dispatcher
         */
        FreeSpin.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Gets the retrigger object
         * @method eef.FreeSpin#getRetrigger
         * @public
         * @returns {Retrigger} The retrigger instance
         */
        FreeSpin.prototype.getRetrigger = function () {
            return this.retrigger;
        };
        /**
         * Set game results
         * @method eef.FreeSpin#setGameData
         * @public
         * @param {gamedata.GamePlayData} data Results for a spin
         */
        FreeSpin.prototype.setGameData = function (data) {
            if (this.isActive || data.isBonusTriggered() || data.getCustomData().getBaseGameResult().isBonusTriggered()) {
                this.gameData = data;
                var fsData = data.getCustomData();
                this.fsRemaining = fsData.getSpinsRemaining();
                this.isWinCap = fsData.getIsWinCap();
                if (this.isWinCap) {
                    this.fsRemaining = 0;
                }
                if (!this.totalwinFlag) {
                    this.previousTotalWin = this.totalWin;
                }
                else {
                    this.totalWin = 0;
                    this.totalwinFlag = false;
                }
                this.totalWin = (this.isWinCap ? fsData.getBaseGameResult().getTotalWin() : this.previousTotalWin + this.gameData.getTotalWin());
                this.multiplierValues = [1, 2, 3];
            }
        };
        /**
         * Set total bet from base game spin, used for subsequent Play requests
         * @method eef.FreeSpin#setTotalBet
         * @public
         * @param {totalBet} number Total bet
         */
        FreeSpin.prototype.setTotalBet = function (totalBet) {
            this.totalBet = totalBet;
        };
        /**
         * Begin the pre-bonus display (when finished will start freespin)
         * @method eef.FreeSpin#startPreBonusDisplay
         * @public
         */
        FreeSpin.prototype.startPreBonusDisplay = function () {
            this.isPreBonus = true;
            //filter out all but trigger pay
            this.cycleResults.filterResults(function (result) {
                return (result.getId() == 0 || result.getId() == 12 || result.getId() == 28);
            });
            this.cycleResults.start();
            this.audioController.playBonusTrigger();
        };
        /**
         * Sets up free spin for recovery
         * @method eef.FreeSpin#setForRecovery
         * @public
         */
        FreeSpin.prototype.setForRecovery = function () {
            this.isActive = true;
            this.partnerAdapter.hideProgressBar();
            this.uiController.toggleSpinButton(false);
            this.uiController.stopAutoPlay();
            this.uiController.setCanUpdateBalance(false);
            this.setGaffToggle(true);
            this.slotDisplay.setGaffingEnabled(false);
            this.cycleComplete = false;
            this.bangComplete = false;
            if (this.gameData.getCustomData().getIsWinCap()) {
                this.totalWin = this.gameData.getCustomData().getBaseGameResult().getTotalWin();
            }
            else {
                this.totalWin = this.gameData.getCustomData().totalFSWin;
            }
            this.previousTotalWin = this.totalWin - this.gameData.getTotalWin();
            this.totalBet = this.gameData.getCustomData().getBaseGameResult().getWager();
            this.uiController.setWin(this.previousTotalWin, false);
            this.uiController.animateWin(true);
            this.showBonusTxt(true);
        };
        FreeSpin.prototype.setAutoTouchToStart = function (auto) {
            if (this.fsIntro != null) {
                this.fsIntro.setAutoTouchToStart(auto);
            }
        };
        /**
         * Starts the free spin game
         * @method eef.FreeSpin#startFreeSpin
         * @public
         */
        FreeSpin.prototype.startFreeSpin = function () {
            if (this.isLoaded) {
                this.slotDisplay.getSymbolAnimationController().setSymbolsNeededForTrigger(2);
                this.isActive = true;
                this.partnerAdapter.hideProgressBar();
                this.transitionIn();
                this.fsPlayed = 0;
                this.uiController.toggleSpinButton(false);
                this.uiController.stopAutoPlay();
                EEFConfig.IDLE_STATE = false;
                this.uiController.setCanUpdateBalance(false);
                this.setGaffToggle(true);
                this.slotDisplay.setGaffingEnabled(false);
                this.cycleComplete = false;
                this.bangComplete = false;
                this.showBonusTxt(true);
                this.uiController.setFreeGameFSC(true);
            }
            else {
                this.partnerAdapter.updatedLoadingProgress(0);
                this.partnerAdapter.showProgressBar();
                this.hasTriggered = true;
            }
        };
        /**
         * Set the local bonus trigger data
         * @method eef.FreeSpin#setTriggerData
         * @public
         */
        FreeSpin.prototype.setTriggerData = function (triggerData) {
            this.triggerData = triggerData;
        };
        /**
         * Show retrigger animations
         * @method eef.FreeSpin#showRetrigger
         * @public
         */
        FreeSpin.prototype.showRetrigger = function () {
            var _this = this;
            this.audioController.playBonusTrigger();
            this.retrigger.play(function () {
                _this.onRetriggerComplete();
            });
        };
        /**
         * Show spin results
         * @method eef.FreeSpin#configureResultsDisplay
         * @public
         */
        FreeSpin.prototype.configureResultsDisplay = function () {
            this.winDisplayController.configure(this.gameData, false);
            this.bangController.setup(this.previousTotalWin, this.totalWin);
            this.slotDisplay.getSymbolAnimationController().setHitData(this.gameData.getAllSlotResults());
            this.slotDisplay.setStopPositions(this.gameData.getStopPositions());
        };
        /**
         * Begin the cycle results and bangup
         * @method eef.FreeSpin#startWinDisplay
         * @public
         */
        FreeSpin.prototype.startWinDisplay = function () {
            this.startCyclingResults();
        };
        FreeSpin.prototype.startCyclingResults = function () {
            this.winDisplayController.start(true);
        };
        /**
         * Start next free spin
         * @method eef.FreeSpin#startNextSpin
         * @public
         */
        FreeSpin.prototype.startNextSpin = function () {
            if (!this.paused) {
                this.slotDisplay.spin();
                this.fsPlayed++;
                this.fsRemaining--;
                this.cycleComplete = false;
                this.bangComplete = false;
                this.signal.onSpin();
                this.displayFSRemaining();
            }
        };
        /**
         * Configure text display
         * @method eef.FreeSpin#setupText
         * @private
         * @param {abg2d.Actor} actor Text actor to update
         * @param {abg2d.Alignment} align Text alignment
         * @param {string} font Font for display
         * @param {number} scalar Display scalar
         * @param {number} lineWidth Maximum line width
         * @param {string} content Text to display
         */
        FreeSpin.prototype.setupText = function (actor, align, font, scalar, lineWidth, content) {
            var text = actor.getText();
            text.setAlign(align);
            text.setFont(font);
            text.setScalar(scalar);
            text.setMaxLineWidth(lineWidth);
            text.setText(content);
            abg2d.TextFactory.createFillText(text, "#000000");
        };
        /**
         * Listener for when single cycle of cycle results is complete
         * @method eef.FreeSpin#onCycleComplete
         * @private
         */
        FreeSpin.prototype.onCycleComplete = function () {
            var _this = this;
            if (this.isActive) {
                this.winDisplayController.stop();
                if (!this.gameData.getCustomData().isWinCap) {
                    this.displayFSRemaining();
                }
                this.cycleComplete = true;
                this.checkWinDisplayComplete();
            }
            else if (this.isPreBonus) {
                this.isPreBonus = false;
                this.cycleResults.stop(false);
                //display feature triggered text in winstack
                var featureTriggeredText = this.translator.findByKey("bonustriggered_txt");
                this.winStack.displayHeadline(featureTriggeredText, "");
                TweenLite.delayedCall(1.0, function () {
                    _this.startFreeSpin();
                });
            }
        };
        /**
         * Listener for when bangup is complete
         * @method eef.FreeSpin#onBangComplete
         * @private
         */
        FreeSpin.prototype.onBangComplete = function () {
            if (this.isActive) {
                this.bangComplete = true;
            }
        };
        /**
         * Listener for completion of retrigger animation
         * @method eef.FreeSpin#onRetriggerComplete
         * @private
         */
        FreeSpin.prototype.onRetriggerComplete = function () {
            this.startWinDisplay();
        };
        /**
         * Checks to see if bangup, cycle, and retrigger have completed,
         * then calls function to continue freespin logic.
         * @method eef.FreeSpin#checkWinDisplayComplete
         * @private
         */
        FreeSpin.prototype.checkWinDisplayComplete = function () {
            var _this = this;
            // Check if win display is complete. This is satisfied when the first set of pays have
            // been displayed and bang up is complete.
            if (this.cycleComplete || !this.winDisplayController.getIsPlaying()) {
                TweenLite.delayedCall(1, function () {
                    _this.onWinDisplayComplete();
                });
            }
        };
        /**
         * Advances the freespin logic after spin win display (if any win) is complete
         * @method eef.FreeSpin#onWinDisplayComplete
         * @private
         */
        FreeSpin.prototype.onWinDisplayComplete = function () {
            if (!this.gameData.getCustomData().isWinCap) {
                this.displayFSRemaining();
            }
            if (this.fsRemaining > 0) {
                this.startNextSpin();
            }
            else {
                this.endFreeSpin();
            }
        };
        /**
         * Run animations to transition into free spin
         * @method eef.FreeSpin#transitionIn
         * @private
         */
        FreeSpin.prototype.transitionIn = function () {
            //this.fsIntro.play(this.gameData.getCustomData().spinsRemaining);
            this.fsIntro.play(10);
            this.uiController.hideCreditsAndBet();
            if (this.gameData != undefined) {
                this.totalWin = this.gameData.getCustomData().totalFSWin;
            }
            this.uiController.setWin(this.totalWin, false);
            this.uiController.animateWin(true);
        };
        /**
         * Run animations to transition out of free spin
         * @method eef.FreeSpin#transitionOut
         * @private
         */
        FreeSpin.prototype.transitionOut = function () {
            this.fsOutro.play(this.totalWin, this.totalBet, this.isWinCap);
        };
        /**
         * Handler when player touches button to start free spin
         * @method eef.FreeSpin#onTouchToStart
         * @private
         */
        FreeSpin.prototype.onTouchToStart = function () {
            this.startNextSpin();
            this.uiController.setFreeGameFSC(false);
        };
        /**
         * Handler when outro reports that it is safe to swap to base game reels
         * @method eef.FreeSpin#swapToBaseReels
         * @private
         */
        FreeSpin.prototype.swapToBaseReels = function () {
            // Restore base game results        
            var winlen = this.triggerData.results.length;
            var totalWaywin = 0;
            this.showBonusTxt(false);
            for (var i = 0; i < winlen; i++) {
                totalWaywin = totalWaywin + this.triggerData.results[i].awardValue;
                if ((this.triggerData.results[i].awardValue == 0) && (this.triggerData.results[i].numWays != undefined)) {
                    this.triggerData.results[i].awardValue = this.gameData.getCustomData().totalFSWin;
                }
                if ((this.triggerData.results[i].awardValue == 0) && (this.triggerData.results[i].numWays == undefined)) {
                    this.triggerData.results[i].awardValue = this.triggerData.getTotalWin() - totalWaywin - this.gameData.getCustomData().totalFSWin;
                }
            }
            totalWaywin = 0;
            this.uiController.showCreditsAndBet();
            this.uiController.setWin(this.triggerData.getTotalWin(), false);
            this.winDisplayController.configure(this.triggerData, false);
            this.bangController.setup(this.totalWin, this.totalWin);
            var freegameReelset = Number(this.gameData.getCustomData().reelIndex);
            var reelsetno = this.getReelsetNo(freegameReelset);
            this.slotDisplay.changeReelSet(Number(reelsetno));
            this.slotDisplay.getSymbolAnimationController().setHitData(this.triggerData.getAllSlotResults());
            this.slotDisplay.setStopPositions(this.triggerData.getStopPositions(), true);
            this.winStack.reset();
            this.audioController.fadeBackgroundMusic();
        };
        FreeSpin.prototype.showBonusTxt = function (visible) {
            this.bonusText.getTransform().setVisible(visible);
        };
        FreeSpin.prototype.getReelsetNo = function (freeGamereelset) {
            var baseReelset;
            switch (freeGamereelset) {
                case 5:
                    baseReelset = 0;
                    break;
                case 6:
                    baseReelset = 1;
                    break;
                case 7:
                    baseReelset = 2;
                    break;
                case 8:
                    baseReelset = 3;
                    break;
                case 9:
                    baseReelset = 4;
                    break;
                default:
                    break;
            }
            return baseReelset;
        };
        /**
         * Handler when outro is complete so we can play bonus guarantee or display basegame
         * @method eef.FreeSpin#onTransitionOutComplete
         * @private
         */
        FreeSpin.prototype.onTransitionOutComplete = function () {
            this.audioController.handleFreeSpinEnd(false);
            var fsData = this.gameData.getCustomData();
            this.uiController.freeGameEndTrigger();
            this.showBaseGameResults();
        };
        /**
         * Handler when outro reports that it is safe to start cycling base game results
         * @method eef.FreeSpin#showBaseGameResults
         * @private
         */
        FreeSpin.prototype.showBaseGameResults = function () {
            if (!this.gameData.getCustomData().isWinCap) {
                this.winDisplayController.start(true);
            }
            this.uiController.toggleSpinButton(true);
            this.uiController.updateBalance(this.uiController.getBalance(), EEFConfig.OUTCOME);
        };
        /**
         * Sets the state of the demo menu
         * @method eef.FreeSpin#setDemoMenu
         * @private
         * @param {boolean} showGaffToggle True to show the gaff toggle
         */
        FreeSpin.prototype.setGaffToggle = function (showGaffToggle) {
            if (this.demoMenu != null) {
                this.demoMenu.setDemoEnabled(!showGaffToggle);
                this.demoMenu.setGaffingEnabled(showGaffToggle);
            }
        };
        /**
         * End free spins
         * @method eef.FreeSpin#endFreeSpin
         * @private
         */
        FreeSpin.prototype.endFreeSpin = function () {
            this.slotDisplay.getSymbolAnimationController().setSymbolsNeededForTrigger(3);
            this.audioController.handleFreeSpinMusicLoop(false);
            this.isActive = false;
            this.slotDisplay.setGaffingEnabled(true);
            this.setGaffToggle(false);
            this.uiController.setCanUpdateBalance(true);
            this.transitionOut();
            this.totalWin = 0;
            this.previousTotalWin = 0;
            this.totalwinFlag = true;
        };
        /*
         * Construct transition animations
         * @method eef.FreeSpin#setupTransitions
         * @private
         * @param {abg2d.Scene} scene Parent scene
         * @param {number} scalar Display scalar
         * @param {FreeSpinBundle} fsBundle Free spin assets
         * @param {abg2d.Actor} background Background actor
         * @param {locale.CurrencyFormatter} currencyFormatter Currency formatter
         * @param {input.InputHandler} inputHandler Input handler
         * @param {string} fontName The name of the font
         * @param {locale.Translator} translator Translator
         */
        FreeSpin.prototype.setupTransitions = function (scene, scalar, fsBundle, baseBundle, background, currencyFormatter, inputHandler, translator, deviceContext, fontName) {
            var _this = this;
            var infoMarquee = new FSInfoMarquee(fsBundle, scene, scalar, deviceContext, inputHandler, fontName);
            this.fsIntro = new FSIntro(fsBundle, background, scalar, scene, translator, infoMarquee, this.audioController);
            this.fsOutro = new FSOutro(fsBundle, baseBundle, background, scalar, scene, currencyFormatter, translator, infoMarquee, this.audioController);
            this.retrigger = new Retrigger(infoMarquee, translator);
            this.fsIntro.getEvents().add({
                onTouchToStart: function () {
                    _this.onTouchToStart();
                },
                onReadyToSwap: function () {
                    _this.slotDisplay.setStopPositions([0, 0, 0, 0, 0], true);
                }
            });
            this.fsOutro.getEvents().add({
                onReadyToSwap: function () {
                    _this.swapToBaseReels();
                },
                onTransitionComplete: function () {
                    _this.onTransitionOutComplete();
                }
            });
        };
        FreeSpin.prototype.createBonusText = function (scene, scalar, font, fontSize, visible) {
            if (visible === void 0) { visible = true; }
            var alignment = 0 /* TopLeft */;
            var textActor = abg2d.Factory.composeText(scene, null);
            var text = textActor.getText();
            text.setAlign(alignment);
            text.setMaxLineWidth(500);
            text.setText(this.translator.findByKey("Bonus_Reels_Text"));
            if (UIFactory.scalar == 1) {
                textActor.getTransform().setPosition(10, 200);
            }
            else {
                textActor.getTransform().setPosition(10, 230);
            }
            text.setScalar(scalar);
            text.setFont(fontSize + " " + font.getFontName());
            var strokeEffect = new abg2d.SolidStrokeEffect("#200001", 3);
            text.addEffect(strokeEffect);
            text.addEffect(new abg2d.GradientFillEffect(["#ffffff", "#fdff41"], [0, 1], 1, 1, 1, 1));
            textActor.getTransform().setVisible(false);
            textActor.getTransform().setZOrder(10);
            return textActor;
        };
        /**
         * Update the text in the winstack with the number of free spins remaining
         * @method eef.FreeSpin#displayFSRemaining
         * @private
         */
        FreeSpin.prototype.displayFSRemaining = function () {
            //var fsRemainingText: string = this.translator.findByKey("com.wms.freespin.RemainingText") + ": " + this.fsRemaining;
            var fsRemainingText = this.translator.findByKey("Fs_remaining");
            var fsRemainingText1 = this.fsRemaining.toString();
            this.winStack.displayHeadline(fsRemainingText, fsRemainingText1);
        };
        FreeSpin.prototype.historyReplay = function (flag) {
            this.isHistoryReplay = flag;
        };
        FreeSpin.prototype.setFreeSpin = function (set) {
            this.winStack.setIsFreeSpin(set);
        };
        return FreeSpin;
    })();
    exports.FreeSpin = FreeSpin;
    /**
     * FSTransition
     * @class eef.freespin.FSTransition
     * @classdesc Handles animations for FreeSpin transitions.
     */
    var FSTransition = (function () {
        /**
         * Constructor
         * @method eef.freespin.FSTransition#constructor
         * @public
         */
        function FSTransition(fsBundle, swapBkgSpriteSheet, background, scalar, scene, audioController) {
            this.DOOR_TWEEN_DURATION = 0.75;
            this.LEFT_DOOR_OPEN_POS = -977;
            this.LEFT_DOOR_CLOSED_POS = 0;
            this.RIGHT_DOOR_OPEN_POS = 1920;
            this.RIGHT_DOOR_CLOSED_POS = 959;
            //create assets
            this.leftDoor = this.createDoor(fsBundle.leftDoor, scalar, scene, -960, EEFConfig.UI_Z);
            this.rightDoor = this.createDoor(fsBundle.rightDoor, scalar, scene, 1920, EEFConfig.UI_Z + 1);
            this.flash = this.createFlash(scalar, scene);
            //background
            this.background = background;
            this.swapBkgSS = swapBkgSpriteSheet;
            //setup animations
            this.setupDoors();
            this.setupFlash();
            //setup event dispatcher
            this.signal = {
                onSwap: null,
                onComplete: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
            this.audioController = audioController;
        }
        /**
         * Get the event dispatcher
         * @method eef.freespin.FSTransition#getEvents
         * @public
         * @return  {events.EventDispatcher<IFSTransitionListener>} The event dispatcher.
         */
        FSTransition.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Plays the animations for the door transition
         * @method eef.freespin.FSTransition#playDoors
         * @public
         */
        FSTransition.prototype.playDoors = function () {
            this.audioController.playDoorCreak();
            this.doorTimeline.restart();
        };
        /**
         * Plays basic white flash transition
         * @method eef.freespin.FSTransition#toBasegame
         * @public
         */
        FSTransition.prototype.playFlash = function () {
            this.flashTimeline.restart();
        };
        /**
         * Helper method to create the transition animation doors
         * @method eef.freespin.FSTransition#createDoor
         * @private
         * @param {asset.ImageAsset} asset The image asset for this door
         * @param {number} scalar The game scale factor
         * @param {abg2d.Scene} scene The scene to which to add this door
         * @param {number} xPos The x position for this door.
         */
        FSTransition.prototype.createDoor = function (asset, scalar, scene, xPos, zOrder) {
            var doorActor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            var doorXfm = doorActor.getTransform();
            doorXfm.setZOrder(zOrder);
            doorXfm.setPosition(xPos, 0);
            return doorActor;
        };
        /**
         * Setup method to create door transition animation
         * @method eef.freespin.FSTransition#setupDoors
         * @private
         * @param {Function} callback The function to call when the doors close
         */
        FSTransition.prototype.setupDoors = function () {
            var _this = this;
            this.doorTimeline = new TimelineLite({ paused: true });
            var rightDoorXfm = this.rightDoor.getTransform();
            var leftDoorXfm = this.leftDoor.getTransform();
            var bkgImage = this.background.getImage();
            this.doorTimeline.to(leftDoorXfm, this.DOOR_TWEEN_DURATION, { setPositionX: this.LEFT_DOOR_CLOSED_POS, ease: Power1.easeOut, onComplete: function () {
                _this.swapBackground();
            } }, 0);
            this.doorTimeline.to(rightDoorXfm, this.DOOR_TWEEN_DURATION, { setPositionX: this.RIGHT_DOOR_CLOSED_POS, ease: Power1.easeOut }, 0);
            this.doorTimeline.to(bkgImage, this.DOOR_TWEEN_DURATION, { setOpacity: 0, ease: Linear.easeNone }, 0);
            this.doorTimeline.to(bkgImage, this.DOOR_TWEEN_DURATION, { setOpacity: 1, ease: Linear.easeNone }, this.DOOR_TWEEN_DURATION);
            this.doorTimeline.to(leftDoorXfm, this.DOOR_TWEEN_DURATION, { setPositionX: this.LEFT_DOOR_OPEN_POS, ease: Power1.easeIn, onComplete: function () {
                _this.signal.onComplete();
            } }, 1.5);
            this.doorTimeline.to(rightDoorXfm, this.DOOR_TWEEN_DURATION, { setPositionX: this.RIGHT_DOOR_OPEN_POS, ease: Power1.easeIn }, 1.5);
        };
        /**
         * Helper method to create flash transition asset
         * @method eef.freespin.FSTransition#createFlash
         * @private
         * @param {number} scalar The game scale factor
         * @param {abg2d.Scene} scene The scene to which to add this door
         */
        FSTransition.prototype.createFlash = function (scalar, scene) {
            var flashActor = abg2d.Factory.composeBox(scene, null);
            var flashBox = flashActor.getBox();
            flashActor.getTransform().setZOrder(21);
            flashBox.setSize(1920, 1200);
            flashBox.setOpacity(0);
            flashBox.setColor("#ffffff"); //set to white
            return flashActor;
        };
        /**
         * Setup method to create flash transition animation
         * @method eef.freespin.FSTransition#setupFlash
         * @private
         */
        FSTransition.prototype.setupFlash = function () {
            var _this = this;
            var box = this.flash.getBox();
            this.flashTimeline = new TimelineLite({ paused: true });
            //flash on
            this.flashTimeline.to(box, 0.5, { setOpacity: 1.0, ease: Linear.easeNone, onComplete: function () {
                _this.swapBackground();
            } });
            //flash off
            this.flashTimeline.to(box, 0.5, { setOpacity: 0, ease: Linear.easeNone, onComplete: function () {
                _this.signal.onComplete();
            } });
        };
        /**
         * Method called to swap the background
         * @method eef.freespin.FSTransition#swapBackground
         * @private
         */
        FSTransition.prototype.swapBackground = function () {
            this.background.getImage().setSpriteSheet(this.swapBkgSS);
            this.signal.onSwap();
        };
        return FSTransition;
    })();
    exports.FSTransition = FSTransition;
    var sounds;
    (function (sounds) {
        var AudioGlobal = (function () {
            //protected howler: HowlerGlobal;
            function AudioGlobal() {
                //this.howler = new HowlerGlobal();
            }
            AudioGlobal.prototype.mute = function () {
                //this.howler.mute();
                howler.Howler.mute(true);
            };
            AudioGlobal.prototype.unmute = function () {
                //this.howler.unmute();
                howler.Howler.mute(false);
            };
            return AudioGlobal;
        })();
        sounds.AudioGlobal = AudioGlobal;
    })(sounds || (sounds = {}));
    var sounds;
    (function (sounds) {
        /**
             * The AudioSound class loads, plays and manipulates external sounds.
             *
             * The AudioSound class also dispatches AudioEvent's to listeners when it has loaded, failed to load, played, paused or ended.
             */
        var AudioSound = (function () {
            /**
             * Creates an instance of AudioSound.
             *
             * @param {assets.IAsset} asset The asset to use for playback, this should have already been processed by an AssetLoader.
             * @param {IAudioSpriteDefinition} [spriteDef] Optional, used to set the start and end times for playback.
             */
            function AudioSound(asset, spriteDef, streaming) {
                var _this = this;
                this._asset = asset;
                var howlProperties = {
                    src: [asset.path],
                    onload: function () {
                        _this.onLoad();
                    },
                    onloaderror: function () {
                        _this.onLoadError();
                    },
                    onend: function () {
                        _this.onEnd();
                    },
                    onpause: function () {
                        _this.onPause();
                    },
                    onstop: function () {
                        _this.onStop();
                    },
                    onplay: function () {
                        _this.onPlay();
                    },
                    html5: streaming
                };
                if (spriteDef) {
                    this._spriteName = asset.id;
                    var sprite = {};
                    sprite[asset.id] = [spriteDef.startTime, spriteDef.duration];
                    howlProperties.sprite = sprite;
                }
                this._howlerSound = new howler.Howl(howlProperties);
                this._playing = false;
                this.signal = {
                    onComplete: null,
                    onError: null
                };
                this.events = new events.EventDispatcher(this.signal);
            }
            /**
             * Get the event dispatcher
             * @method asset.AudioSound#getEvents
             * @public
             * @returns {events.EventDispatcher<IAudioSoundListener>} The event dispatcher
             */
            AudioSound.prototype.getEvents = function () {
                return this.events;
            };
            /**
             * @inheritdoc
             */
            AudioSound.prototype.play = function () {
                if (this._spriteName) {
                    this._howlerSound.play(this._spriteName);
                }
                else {
                    this._howlerSound.play();
                }
                this._playing = true;
                return this;
            };
            /**
             * @inheritdoc
             */
            AudioSound.prototype.stop = function () {
                this._howlerSound.stop();
                this._playing = false;
                return this;
            };
            /**
             * @inheritdoc
             */
            AudioSound.prototype.pause = function () {
                this._howlerSound.pause();
                return this;
            };
            /**
             * @inheritdoc
             */
            AudioSound.prototype.loop = function (value) {
                this._howlerSound.loop(value);
                return this;
            };
            /**
             * @inheritdoc
             * @param value @inheritdoc
             */
            AudioSound.prototype.setVolume = function (value) {
                this._howlerSound.volume(value);
                return this;
            };
            /**
             * @inheritdoc
             */
            AudioSound.prototype.getVolume = function () {
                return this._howlerSound.volume();
            };
            /**
             * @inheritdoc
             */
            AudioSound.prototype.isPlaying = function () {
                return this._playing;
            };
            /**
             * @inheritdoc
             * @param value @inheritdoc
             * @param duration @inheritdoc
             */
            AudioSound.prototype.fadeTo = function (value, duration) {
                if (!this._playing) {
                    this.play();
                }
                this._howlerSound.fade(this._howlerSound.volume(), value, duration);
                return this;
            };
            /**
             * @inheritdoc
             * @param duration @inheritdoc
             */
            AudioSound.prototype.fadeIn = function (duration) {
                var vol = this.getVolume();
                this.setVolume(0);
                if (!this._playing) {
                    this.play();
                }
                this._howlerSound.fade(this.getVolume(), vol, duration);
                return this;
            };
            /**
             * @inheritdoc
             * @param duration @inheritdoc
             */
            AudioSound.prototype.fadeOut = function (duration) {
                if (!this._playing) {
                    this.play();
                }
                this._howlerSound.fade(this._howlerSound.volume(), 0, duration);
                return this;
            };
            /**
             * @inheritdoc
             */
            /*getPan(): number
            {
                return this._howlerSound.stereo();
            }*/
            /**
             * @inheritdoc
             */
            /*setPan(value: number): IAudioSound
            {
                this._howlerSound.stereo(value);
                return this;
            }*/
            /**
             * @inheritdoc
             */
            /*getPlayhead(): number
            {
                return this._howlerSound.seek();
            }*/
            /**
             * @inheritdoc
             */
            /*setPlayhead(value: number): IAudioSound
            {
                this._howlerSound.seek(value);
                return this;
            }*/
            /**
             * @inheritdoc
             */
            /*getRate(): number
            {
                return this._howlerSound.rate();
            }*/
            /**
             * @inheritdoc
             */
            /* setRate(value: number): IAudioSound
             {
                 this._howlerSound.rate(value);
                 return this;
             }*/
            /**
             * Check if the asset is loaded
             * @method asset.AudioAsset#getIsLoaded
             * @public
             * @returns {boolean} True if the asset is loaded
             */
            AudioSound.prototype.isLoaded = function () {
                return this._loaded;
            };
            /**
             * @inheritdoc
             */
            AudioSound.prototype.loadFailed = function () {
                return this._loadFailed;
            };
            /**
             * Dispatches AudioEvent.LOADED when the asset is sucessfully loaded.
             */
            AudioSound.prototype.onLoad = function () {
                if (!this._loaded) {
                    this.signal.onComplete(this);
                }
                this._loaded = true;
                //this.dispatchEvent(new AudioEvent(AudioEvent.LOADED, this));
            };
            /**
             * Dispatches AudioEvent.LOAD_ERROR if the asset fails to load.
             */
            AudioSound.prototype.onLoadError = function () {
                var _this = this;
                setTimeout(function () {
                    _this._loadFailed = true;
                    _this.signal.onError(_this._asset.path, _this);
                    //this.dispatchEvent(new AudioEvent(AudioEvent.LOAD_ERROR, this));
                });
            };
            /**
             * Dispatches AudioEvent.ENDED when the sound completes a single playback.
             */
            AudioSound.prototype.onEnd = function () {
                if (!this._howlerSound.loop()) {
                    this._playing = false;
                }
            };
            /**
             * Dispatches AudioEvent.STOPPED when the sound has been stopped.
             */
            AudioSound.prototype.onStop = function () {
                this._playing = false;
                //this.dispatchEvent(new AudioEvent(AudioEvent.STOPPED, this));
            };
            /**
             * Dispatches AudioEvent.PAUSED when the sound has been paused.
             */
            AudioSound.prototype.onPause = function () {
                this._playing = false;
                // this.dispatchEvent(new AudioEvent(AudioEvent.PAUSED, this));
            };
            /**
             * Dispatches AudioEvent.PLAYED when the sound begins playback.
             */
            AudioSound.prototype.onPlay = function () {
                this._playing = true;
                //this.dispatchEvent(new AudioEvent(AudioEvent.PLAYED, this));
            };
            return AudioSound;
        })();
        sounds.AudioSound = AudioSound;
    })(sounds || (sounds = {}));
    /**
     * Audio Asset controller
     * @class eef.AudioAssetPlayer
     * @classdesc Single entry point to manage and play audio assets
     */
    (function (LoopState) {
        LoopState[LoopState["None"] = 0] = "None";
        LoopState[LoopState["BaseGame"] = 1] = "BaseGame";
        LoopState[LoopState["FreeSpin"] = 2] = "FreeSpin";
        LoopState[LoopState["FubatLoop"] = 3] = "FubatLoop";
        LoopState[LoopState["FreeSpinIntro"] = 4] = "FreeSpinIntro";
    })(exports.LoopState || (exports.LoopState = {}));
    var LoopState = exports.LoopState;
    var AudioController = (function () {
        /**
         * @constructor
         */
        function AudioController(hasWebAudio, bundle) {
            this.bundle = bundle;
            this.bacisAudioModel = new sounds.BasicAudioModel();
            this.triggers = [];
            this.bigWinSounds = [];
            this.bigWinEndSounds = [];
            this.isFreeSpin = false;
            this.isMuted = false;
            this.loopState = 0 /* None */;
            this.signal = {
                onBaseGameSoundsLoaded: null
            };
            this.events = new events.EventDispatcher(this.signal);
            //this.loadBaseGameSounds();
        }
        /**
         * Gets the event dispatcher
         * @method eef.AudioController#getEvents
         * @public
         * @returns {events.EventDispatcher<IAudioControllerListener>} AudioController event dispatcher
         */
        AudioController.prototype.getEvents = function () {
            return this.events;
        };
        /**
         * Toggles sound playback
         * @method eef.AudioController#toggleSounds
         * @public
         * @param {boolean} mute True to mute the sounds from playing
         */
        AudioController.prototype.toggleSounds = function (value) {
            if (this.bacisAudioModel != null) {
                this.bacisAudioModel.mute(value);
            }
        };
        /**
         * Toggles sound playback
         * @method eef.AudioController#partnerAdapterMute
         * @public
         * @param {boolean} value True to mute the sounds from playing
         */
        AudioController.prototype.partnerAdapterMute = function (value) {
            this.bacisAudioModel.partnerAdapterMute(value);
        };
        AudioController.prototype.preloadSounds = function (bundle) {
            var _this = this;
            var loader = new asset.AssetLoader();
            loader.getEvents().add({
                onStarted: null,
                onProgress: null,
                onComplete: function (id, allComplete) {
                    _this.createSounds();
                    _this.signal.onBaseGameSoundsLoaded();
                },
                onError: null
            });
            loader.addStage(bundle);
            loader.run();
        };
        AudioController.prototype.loadBaseGameSounds = function () {
            this.totalSounds = this.loadedSounds = 0;
            for (var name in this.bundle) {
                this.totalSounds++;
            }
            this.preloadSounds(this.bundle);
        };
        /**
         * Creates the sounds to play
         * @method eef.AudioController#createSounds
         * @private
         */
        AudioController.prototype.createSounds = function () {
            this.winLessThanBet = this.createSound(this.bundle.winLessThanBet, "winLessThanBet", 0.8, false, { startTime: 0, duration: 300 });
            this.bgm = this.createSound(this.bundle.backgroundMusic, "bgm", 0.12, true, { startTime: 96, duration: 47989 });
            this.reelStopClicks = this.createSound(this.bundle.reelStop, "reelStopClicks", 0.4, false, { startTime: 0, duration: 464 });
            var trigger1 = this.createSound(this.bundle.trigger1, "trigger1", 0.5, false, { startTime: 0, duration: 2182 });
            var trigger2 = this.createSound(this.bundle.trigger2, "trigger2", 0.5, false, { startTime: 0, duration: 2275 });
            var trigger3 = this.createSound(this.bundle.trigger3, "trigger3", 0.5, false, { startTime: 0, duration: 2275 });
            var trigger4 = this.createSound(this.bundle.trigger4, "trigger4", 0.8, false, { startTime: 0, duration: 2275 });
            var trigger5 = this.createSound(this.bundle.trigger5, "trigger5", 0.8, false, { startTime: 0, duration: 2136 });
            this.triggers.push(trigger1);
            this.triggers.push(trigger2);
            this.triggers.push(trigger3);
            this.triggers.push(trigger4);
            this.triggers.push(trigger5);
            this.baseGameBangupLoop = this.createSound(this.bundle.baseGameBangup, "baseGameBangupLoop", 0.4, true, { startTime: 96, duration: 1997 });
            this.baseGameBangupEnd = this.createSound(this.bundle.baseGameBangupEnd, "baseGameBangupEnd", 0.24, false, { startTime: 0, duration: 2275 });
            var bigWinShort = this.createSound(this.bundle.bigWinShort, "bigWinShort", 0.6, false, { startTime: 0, duration: 13281 });
            var bigWinMedium = this.createSound(this.bundle.bigWinShort, "bigWinMedium", 0.6, false, { startTime: 0, duration: 13281 });
            var bigWinLong = this.createSound(this.bundle.bigWinLong, "bigWinLong", 0.35, false, { startTime: 0, duration: 16161 });
            this.bigWinSounds.push(bigWinShort);
            this.bigWinSounds.push(bigWinMedium);
            this.bigWinSounds.push(bigWinLong);
            var bigWinShortEnd = this.createSound(this.bundle.bigWinShortEnd, "bigWinShortEnd", 0.5, false, { startTime: 0, duration: 2275 });
            var bigWinMediumEnd = this.createSound(this.bundle.bigWinShortEnd, "bigWinMediumEnd", 0.5, false, { startTime: 0, duration: 2275 });
            var bigWinLongEnd = this.createSound(this.bundle.bigWinLongEnd, "bigWinLongEnd", 0.5, false, { startTime: 0, duration: 2275 });
            this.bigWinEndSounds.push(bigWinShortEnd);
            this.bigWinEndSounds.push(bigWinShortEnd);
            this.bigWinEndSounds.push(bigWinLongEnd);
            this.freeSpinIntroLoop = this.createSound(this.bundle.bonusIntro, "freeSpinIntroLoop", 0.6, true, { startTime: 92, duration: 3998 });
            this.freeSpinMusicLoop = this.createSound(this.bundle.bonusGameMusicLoop, "freeSpinMusicLoop", 0.30, true, { startTime: 96, duration: 42665 });
            this.freeSpinEnd = this.createSound(this.bundle.bonusEnd, "freeSpinEnd", 0.45, false, { startTime: 0, duration: 5247 });
            this.bonusTrigger = this.createSound(this.bundle.bonusTriggered, "bonusTrigger", 0.7, false, { startTime: 0, duration: 2972 });
            this.bonusDoor = this.createSound(this.bundle.bonusDoor, "bonusDoor", 0.30, false, { startTime: 0, duration: 3390 });
            this.miniJackpot = this.createSound(this.bundle.miniJackpot, "miniJackpot", 1, false, { startTime: 0, duration: 5000 });
            this.minorJackpot = this.createSound(this.bundle.minorJackpot, "minorJackpot", 1, false, { startTime: 0, duration: 6873 });
            this.majorJackpot = this.createSound(this.bundle.majorJackpot, "majorJackpot", 1, false, { startTime: 0, duration: 7198 });
            this.grandJackpot = this.createSound(this.bundle.grandJackpot, "grandJackpot", 1, false, { startTime: 0, duration: 8173 });
            this.coinPick = this.createSound(this.bundle.coinPick, "coinPick", 1, false, { startTime: 0, duration: 1393 });
            this.buttonClick = this.createSound(this.bundle.buttonClick, "buttonClick", 1, false, { startTime: 0, duration: 371 });
            this.batFlying = this.createSound(this.bundle.batFlying, "batFlying", 1, false, { startTime: 0, duration: 2275 });
            this.fubatLoop = this.createSound(this.bundle.fubatLoop, "fubatLoop", 0.6, true, { startTime: 96, duration: 29440 });
            this.lidClosing = this.createSound(this.bundle.lidClosing, "lidClosing", 1, false, { startTime: 0, duration: 696 });
            this.coinBurst = this.createSound(this.bundle.coinBurst, "coinBurst", 1, false, { startTime: 0, duration: 2647 });
            this.jackpotHit = this.createSound(this.bundle.jackpotHit, "jackpotHit", 1, false, { startTime: 0, duration: 1904 });
        };
        /**
             * Creates a sound object
             * @method luckytree.AudioController#createSound
             * @private
             * @param {asset.AudioAsset} asset The asset to use to create the sound
             * @param {string} id The id of the sound
             * @param {number} volume The volume of the sound
             * @param {boolean} loop True if the sound should loop
             * @param {sounds.IAudioSpriteDefinition} spriteDef The startTime and duration in ms that the loop should start
             * @returns {sounds.IAudioSound} The created sound
             */
        AudioController.prototype.createSound = function (asset, id, volume, loop, spriteDef) {
            var _this = this;
            if (volume === void 0) { volume = 1; }
            if (loop === void 0) { loop = false; }
            var sndAsset = new sounds.AudioSoundAsset(asset.getPath(), id, volume, loop, spriteDef);
            var _sound = new sounds.AudioSound(sndAsset, sndAsset.spriteDef);
            _sound.setVolume(volume);
            _sound.loop(loop);
            _sound.getEvents().add({
                onComplete: function (asset) {
                    _this.loadedSounds++;
                    if (_this.loadedSounds >= _this.totalSounds) {
                    }
                },
                onError: function (path, asset) {
                    console.warn("Sound not loaded:: " + path);
                }
            });
            return _sound;
        };
        /**
         * Helper method to play a sound
         * @method eef.AudioController#play
         * @private
         * @param {sounds.IAudioSound} sound Properties of sound to play
         */
        AudioController.prototype.play = function (sound) {
            if (sound != null) {
                sound.play();
            }
        };
        /**
         * Helper method to stop a sound
         * @method eef.AudioController#stop
         * @private
         * @param {sounds.IAudioSound} sound The sound to stop playing
         */
        AudioController.prototype.stop = function (sound) {
            if (sound != null) {
                sound.stop();
            }
        };
        /**
         * Helper method to play fade in a sound
         * @method eef.AudioController#playFadeIn
         * @private
         * @param {sounds.IAudioSound} sound Properties of sound to play
         */
        AudioController.prototype.playFadeIn = function (sound, volume, duration) {
            if (volume === void 0) { volume = 1; }
            if (duration === void 0) { duration = 0.1; }
            if (sound != null) {
                sound.setVolume(volume);
                sound.fadeIn(duration * 1000);
            }
        };
        /**
         * Helper method to fade out a sound
         * @method eef.AudioController#fadeOut
         * @private
         * @param {sounds.IAudioSound} sound Properties of sound to play
         */
        AudioController.prototype.fadeOut = function (sound, volume, duration) {
            if (volume === void 0) { volume = 1; }
            if (duration === void 0) { duration = 0.1; }
            if (sound != null) {
                sound.fadeOut(duration * 1000);
                TweenMax.delayedCall(duration, function () {
                    sound.stop();
                    sound.setVolume(volume);
                });
            }
        };
        /**
         * Plays the bang up loop
         * @method eef.AudioController#playBangup
         * @param {number} volume The volume to play the sound at
         * @public
         */
        AudioController.prototype.playBangup = function () {
            if (this.baseGameBangupLoop != null && !this.baseGameBangupLoop.isPlaying()) {
                this.baseGameBangupLoop.setVolume(0.4);
                this.play(this.baseGameBangupLoop);
            }
            else {
                this.playFadeIn(this.baseGameBangupLoop, 0.4);
            }
        };
        /**
         * Plays the bang up end sound
         * @method eef.AudioController#playBangupEnd
         * @public
         */
        AudioController.prototype.playBangupEnd = function () {
            if (this.baseGameBangupEnd != null) {
                this.fadeOut(this.baseGameBangupLoop, 0.4);
                this.play(this.baseGameBangupEnd);
            }
        };
        /**
         * Plays the trigger hit sound
         * @method eef.AudioController#playTriggerHit
         * @public
         * @param {number} index The index of the trigger hit to play
         */
        AudioController.prototype.playTriggerHit = function (index) {
            this.play(this.triggers[index - 1]);
        };
        /**
         * Plays the bonus trigger sound
         * @method eef.AudioController#playBonusTrigger
         * @public
         */
        AudioController.prototype.playBonusTrigger = function () {
            this.play(this.bonusTrigger);
            this.stop(this.bgm);
        };
        /**
         * Play the looping background music. Will not restart music if called multiple times
         * @method eef.AudioController#playBackgroundMusic
         * @public
         */
        AudioController.prototype.playBackgroundMusic = function () {
            if (this.bgm != null && !this.bgm.isPlaying() && !this.freeSpinMusicLoop.isPlaying() && !this.freeSpinIntroLoop.isPlaying()) {
                this.play(this.bgm);
                this.loopState = 1 /* BaseGame */;
            }
        };
        /**
         * Play win sound if the win is less than the bet
         * @method eef.AudioController#playWinSound
         * @public
         */
        AudioController.prototype.playWinSound = function () {
            this.play(this.winLessThanBet);
        };
        /**
         * Play reel stop click sound for a reel
         * @method eef.AudioController#playBackgroundMusic
         * @param {number} reelId Index of reel that stopped
         * @public
         */
        AudioController.prototype.playReelSpinClick = function (reelId) {
            this.play(this.reelStopClicks);
        };
        /**
         * Fades the background music in
         * @method eef.AudioController#fadeBackgroundMusic
         * @public
         */
        AudioController.prototype.fadeBackgroundMusic = function () {
            if (!this.freeSpinMusicLoop.isPlaying() && this.bgm.isPlaying()) {
                this.playFadeIn(this.bgm, .12);
            }
            else {
                this.playBackgroundMusic();
            }
        };
        /**
         * Plays the big win music
         * @method eef.AudioController#playBigWinMusic
         * @public
         * @param {number} index The index of the sound to play
         */
        AudioController.prototype.playBigWinMusic = function (index) {
            this.fadeOut(this.bgm, .12);
            this.play(this.bigWinSounds[index]);
        };
        /**
         * Plays the big win end sound
         * @method eef.AudioController#playBigWinEnd
         * @public
         * @param {number} index The index of the sound to play
         */
        AudioController.prototype.playBigWinEnd = function (index) {
            this.stop(this.bigWinSounds[index]);
            this.play(this.bigWinEndSounds[index]);
        };
        /**
         * Plays the free spin intro music
         * @method eef.AudioController#playFreeSpinIntro
         * @public
         * @param {boolean} play True if the sound should play
         */
        AudioController.prototype.handleFreeSpinIntroLoop = function (play) {
            if (play) {
                this.play(this.freeSpinIntroLoop);
                //this.stop(this.bgm);
                this.loopState = 4 /* FreeSpinIntro */;
                this.stop(this.baseGameBangupLoop);
                this.isFreeSpin = true;
            }
            else {
                this.stop(this.freeSpinIntroLoop);
                this.loopState = 0 /* None */;
            }
        };
        /**
         * Handles the free spin end music
         * @method eef.AudioController#handleFreeSpinEnd
         * @public
         */
        AudioController.prototype.handleFreeSpinEnd = function (play) {
            if (play) {
                this.play(this.freeSpinEnd);
                this.loopState = 4 /* FreeSpinIntro */;
            }
            else {
                this.stop(this.freeSpinEnd);
                this.loopState = 0 /* None */;
            }
            this.isFreeSpin = false;
        };
        /**
         * Handles the stopping and playing of the bonus game music loop
         * @method eef.AudioController#handleFreeSpinMusicLoop
         * @public
         * @param {boolean} play True to play the music
         */
        AudioController.prototype.handleFreeSpinMusicLoop = function (play) {
            if (this.freeSpinMusicLoop != null) {
                if (play) {
                    this.play(this.freeSpinMusicLoop);
                    this.loopState = 2 /* FreeSpin */;
                    this.baseGameBangupLoop.setVolume(0);
                    this.play(this.baseGameBangupLoop);
                }
                else {
                    this.stop(this.freeSpinMusicLoop);
                    this.loopState = 0 /* None */;
                }
            }
        };
        AudioController.prototype.playBatFlying = function () {
            this.play(this.batFlying);
        };
        AudioController.prototype.playFubatLoop = function () {
            this.stop(this.freeSpinMusicLoop);
            this.stop(this.bgm);
            this.loopState = 0 /* None */;
            this.play(this.fubatLoop);
            this.loopState = 3 /* FubatLoop */;
        };
        AudioController.prototype.stopFubatLoop = function () {
            this.stop(this.fubatLoop);
            this.loopState = 0 /* None */;
            this.play(this.bgm);
            this.loopState = 1 /* BaseGame */;
        };
        AudioController.prototype.playLidClosing = function () {
            this.play(this.lidClosing);
        };
        AudioController.prototype.playCoinBurst = function () {
            this.play(this.coinBurst);
        };
        AudioController.prototype.playJackpotHit = function () {
            this.play(this.jackpotHit);
        };
        /**
         * Play creaking door sound
         * @method eef.AudioController#playDoorCreak
         * @public
         */
        AudioController.prototype.playDoorCreak = function () {
            this.play(this.bonusDoor);
        };
        AudioController.prototype.playMiniJackpot = function () {
            this.play(this.miniJackpot);
        };
        AudioController.prototype.playMinorJackpot = function () {
            this.play(this.minorJackpot);
        };
        AudioController.prototype.playMajorJackpot = function () {
            this.play(this.majorJackpot);
        };
        AudioController.prototype.playGrandJackpot = function () {
            this.play(this.grandJackpot);
        };
        AudioController.prototype.playCoinPick = function () {
            this.play(this.coinPick);
        };
        AudioController.prototype.playButtonClick = function () {
            this.play(this.buttonClick);
        };
        AudioController.prototype.playBaseGameMusic = function () {
            this.playFadeIn(this.bgm, 0.12);
            this.loopState = 1 /* BaseGame */;
        };
        AudioController.prototype.playFubBatLoop = function () {
            this.playFadeIn(this.fubatLoop, 0.6);
            this.loopState = 3 /* FubatLoop */;
        };
        AudioController.prototype.playFreeSpinLoop = function () {
            this.playFadeIn(this.freeSpinMusicLoop, 0.3);
            this.loopState = 2 /* FreeSpin */;
        };
        AudioController.prototype.resumeLoop = function () {
            switch (this.loopState) {
                case 1 /* BaseGame */:
                    this.playBaseGameMusic();
                    break;
                case 3 /* FubatLoop */:
                    this.playFubBatLoop();
                case 2 /* FreeSpin */:
                    this.playFreeSpinLoop();
                default:
                    break;
            }
        };
        AudioController.prototype.setIsMuted = function (value) {
            this.isMuted = value;
        };
        AudioController.prototype.getIsMuted = function () {
            return this.isMuted;
        };
        return AudioController;
    })();
    exports.AudioController = AudioController;
    var sounds;
    (function (sounds) {
        var BasicAudioModel = (function () {
            function BasicAudioModel() {
                this._audioGlobal = new sounds.AudioGlobal();
                this._partnerAdapterMuted = false;
                this.setVisibilityAPI();
            }
            BasicAudioModel.prototype.partnerAdapterMute = function (value) {
                this._partnerAdapterMuted = value;
                this.mute(value);
            };
            BasicAudioModel.prototype.mute = function (value) {
                console.log("Audio is muted", value);
                if (value) {
                    this._audioGlobal.mute();
                }
                else {
                    if (!this._partnerAdapterMuted) {
                        this._audioGlobal.unmute();
                    }
                }
            };
            /**
             * (description)
             *
             * @private
             */
            BasicAudioModel.prototype.setVisibilityAPI = function () {
                var _this = this;
                if (typeof document.hidden !== "undefined") {
                    this._myHidden = "hidden";
                    this._myVisibilityChange = "visibilitychange";
                }
                else if (typeof document.mozHidden !== "undefined") {
                    this._myHidden = "mozHidden";
                    this._myVisibilityChange = "mozvisibilitychange";
                }
                else if (typeof document.msHidden !== "undefined") {
                    this._myHidden = "msHidden";
                    this._myVisibilityChange = "msvisibilitychange";
                }
                else if (typeof document.webkitHidden !== "undefined") {
                    this._myHidden = "webkitHidden";
                    this._myVisibilityChange = "webkitvisibilitychange";
                }
                // Warn if the browser doesn't support addEventListener or the Page Visibility API
                if (typeof document.addEventListener === "undefined" || typeof document[this._myHidden] === "undefined") {
                    console.log("Page Visibility API not suppported, unable to stop audio on minimise");
                }
                else {
                    // Handle page visibility change   
                    document.addEventListener(this._myVisibilityChange, function () {
                        _this.handleVisibilityChange();
                    }, false);
                }
            };
            /**
             * (description)
             *
             * @private
             */
            BasicAudioModel.prototype.handleVisibilityChange = function () {
                if (document[this._myHidden]) {
                    this.mute(true);
                }
                else {
                    this.mute(false);
                }
            };
            return BasicAudioModel;
        })();
        sounds.BasicAudioModel = BasicAudioModel;
    })(sounds || (sounds = {}));
    var sounds;
    (function (sounds) {
        var AudioSoundAsset = (function () {
            /**
             * @param id ID used to retrieve the IAsset from the AssetCache.
             * @param path The path of the asset to be loaded.
             * @param data Raw data that has been loaded.
             */
            function AudioSoundAsset(path, id, volume, loop, spriteDef) {
                if (volume === void 0) { volume = 1; }
                if (loop === void 0) { loop = false; }
                this.id = id;
                this.path = path;
                this.volume = volume;
                this.loop = loop;
                this.spriteDef = spriteDef;
            }
            return AudioSoundAsset;
        })();
        sounds.AudioSoundAsset = AudioSoundAsset;
    })(sounds || (sounds = {}));
    var Utils = (function () {
        function Utils() {
        }
        /**
         * Converts the gls offset values to meaningful data for the game
         * @method eef.Utils#convertOffset
         * @public
         * @param {number} glsOffset The offset value
         * @returns {reels.IReelPosition} The offset object with offset values
         */
        Utils.convertOffset = function (glsOffset, numReels) {
            return {
                reelnumber: (glsOffset % numReels),
                reelposition: Math.floor(glsOffset / numReels)
            };
        };
        return Utils;
    })();
    exports.Utils = Utils;
    /**
     * AutoPlayManager
     * @class eef.AutoPlayManager
     * @classdesc Manages auto play
     */
    var AutoPlayManager = (function () {
        /**
         * @constructor
         */
        function AutoPlayManager(spinsText) {
            this.spinsText = spinsText;
            this.spinsRemaining = 0;
        }
        /**
         * Decrement the number of spins remaining
         * @method eef.AutoPlayManager#decrementAutoSpins
         * @public
         */
        AutoPlayManager.prototype.decrementAutoSpins = function () {
            this.spinsRemaining--;
            this.positionText();
        };
        /**
         * Gets the spins remaining
         * @method eef.AutoPlayManager#getSpinsRemaining
         * @public
         * @returns {number} The number of spins remaining
         */
        AutoPlayManager.prototype.getSpinsRemaining = function () {
            return this.spinsRemaining;
        };
        /**
         * Indicates wheter the user is in auto play mode
         * @method eef.AutoPlayManager#isAutoPlaying
         * @public
         * @returns {boolean} True if the user has initiated auto play
         */
        AutoPlayManager.prototype.isAutoPlaying = function () {
            return (this.getSpinsRemaining() > 0);
        };
        /**
         * Stops auto play
         * @method eef.AutoPlayManager#stop
         * @public
         */
        AutoPlayManager.prototype.stop = function () {
            this.spinsRemaining = 0;
            this.spinsText.getTransform().setVisible(false);
            this.spinsText.getText().setText("");
        };
        /**
         * Sets the spins remaining
         * @method eef.AutoPlayManager#setSpinsRemaining
         * @public
         * @param {number} value The number of auto spins
         */
        AutoPlayManager.prototype.setSpinsRemaining = function (value) {
            this.spinsRemaining = value;
            this.positionText();
        };
        /**
         * Hides the spins remaining text
         * @method eef.AutoPlayManager#toggleSpinsRemaining
         * @public
         */
        AutoPlayManager.prototype.toggleSpinsRemaining = function (isVisible) {
            this.spinsText.getTransform().setVisible(isVisible);
        };
        /**
         * Positions the text properly
         * @method eef.AutoPlayManager#positionText
         * @private
         */
        AutoPlayManager.prototype.positionText = function () {
            var text = this.spinsText.getText();
            var transform = this.spinsText.getTransform();
            var parentImage = transform.getParent().getActor().getImage();
            if (this.spinsRemaining != 0) {
                text.setText(this.spinsRemaining.toString());
            }
            else {
                text.setText("");
            }
            transform.setVisible(true);
            var xPos = 115;
            if (text.getText().length == 3) {
                xPos = 95;
            }
            else if (text.getText().length == 1) {
                xPos = 135;
            }
            transform.setPosition(xPos, 30);
        };
        return AutoPlayManager;
    })();
    exports.AutoPlayManager = AutoPlayManager;
    var HttpConnectionFactory = (function (_super) {
        __extends(HttpConnectionFactory, _super);
        function HttpConnectionFactory() {
            _super.apply(this, arguments);
        }
        HttpConnectionFactory.prototype.setPromoInfo = function (promoInfo) {
            this._promoInfo = promoInfo;
        };
        HttpConnectionFactory.prototype.setFreeRoundInfo = function (freeRoundInfo) {
            if (freeRoundInfo != undefined) {
                this.freeRoundInfo = freeRoundInfo;
            }
        };
        HttpConnectionFactory.prototype.resetFreeRoundInfo = function () {
            this.freeRoundInfo = undefined;
        };
        HttpConnectionFactory.prototype.createConnectionForInitRequest = function (url, data, method) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            ;
            if (this._promoInfo != undefined) {
                var promoXmlStr = "<CAMPAIGNID>";
                promoXmlStr += this._promoInfo.getCampaignId() + "</CAMPAIGNID>";
                promoXmlStr += "<ACTIVATIONID>";
                promoXmlStr += this._promoInfo.getActivationId() + "</ACTIVATIONID>";
                promoXmlStr += "<STATUS>";
                promoXmlStr += this._promoInfo.getstatus() + "</STATUS>";
                promoXmlStr += "<TYPE>";
                promoXmlStr += "FREEROUND" + "</TYPE>";
                requestHeaders.setRequestHeader("FR-Info", promoXmlStr);
            }
            var httpMethod = method;
            return new httpconnection.HttpConnection(xhrObject, url, data, requestHeaders, httpMethod, true);
        };
        HttpConnectionFactory.prototype.createConnectionForLogicRequest = function (url, data, method) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            ;
            if (this.freeRoundInfo != undefined) {
                var promoXmlStr = "<CAMPAIGNID>";
                promoXmlStr += this.freeRoundInfo.getCampaignId() + "</CAMPAIGNID>";
                promoXmlStr += "<ACTIVATIONID>";
                promoXmlStr += this.freeRoundInfo.getActivationId() + "</ACTIVATIONID>";
                promoXmlStr += "<STATUS>";
                promoXmlStr += this.freeRoundInfo.getstatus() + "</STATUS>";
                promoXmlStr += "<TYPE>";
                promoXmlStr += "FREEROUND" + "</TYPE>";
                requestHeaders.setRequestHeader("FR-Info", promoXmlStr);
            }
            var httpMethod = method;
            return new httpconnection.HttpConnection(xhrObject, url, data, requestHeaders, httpMethod, true);
        };
        return HttpConnectionFactory;
    })(httpconnection.HttpConnectionFactory);
    exports.HttpConnectionFactory = HttpConnectionFactory;
    var FreeRoundInfo = (function () {
        function FreeRoundInfo() {
            this.campaignId = "";
            this.activationId = "";
            this.status = "";
            this.betLevel = 0;
            this.remainingRounds = 0;
            this.totalWin = 0;
        }
        FreeRoundInfo.prototype.setFreeRoundInfo = function (freeGameInfo) {
            this.campaignId = freeGameInfo.CAMPAIGNID;
            this.activationId = freeGameInfo.ACTIVATIONID;
            this.status = freeGameInfo.STATUS;
            this.betLevel = freeGameInfo.OPTIONS[0].BETLEVEL;
            this.remainingRounds = freeGameInfo.OPTIONS[0].REMAININGROUNDS;
            this.totalWin = freeGameInfo.TOTALWIN * 100;
        };
        FreeRoundInfo.prototype.getCampaignId = function () {
            return this.campaignId;
        };
        FreeRoundInfo.prototype.getActivationId = function () {
            return this.activationId;
        };
        FreeRoundInfo.prototype.getstatus = function () {
            return this.status;
        };
        FreeRoundInfo.prototype.getBetLevel = function () {
            return this.betLevel * 100;
        };
        FreeRoundInfo.prototype.getRemainingRounds = function () {
            return this.remainingRounds;
        };
        FreeRoundInfo.prototype.getTotalWin = function () {
            return this.totalWin;
        };
        return FreeRoundInfo;
    })();
    exports.FreeRoundInfo = FreeRoundInfo;
    var PromoInfo = (function () {
        function PromoInfo() {
            this.campaignId = "";
            this.activationId = "";
            this.status = "";
        }
        PromoInfo.prototype.setPromoInfo = function (promoInfo) {
            this.campaignId = promoInfo.PROMOTIONS.FREEROUNDS[0].CAMPAIGNID;
            this.activationId = promoInfo.PROMOTIONS.FREEROUNDS[0].ACTIVATIONID;
            this.status = promoInfo.PROMOTIONS.GAMEPLAY;
        };
        PromoInfo.prototype.getCampaignId = function () {
            return this.campaignId;
        };
        PromoInfo.prototype.getActivationId = function () {
            return this.activationId;
        };
        PromoInfo.prototype.getstatus = function () {
            return this.status;
        };
        return PromoInfo;
    })();
    exports.PromoInfo = PromoInfo;
    var GLSRequestor = (function (_super) {
        __extends(GLSRequestor, _super);
        function GLSRequestor() {
            _super.apply(this, arguments);
        }
        GLSRequestor.prototype.setPromoInfo = function (promoInfo) {
            this._promoInfo = new PromoInfo();
            this._promoInfo.setPromoInfo(promoInfo);
        };
        GLSRequestor.prototype.setFreeRoundInfo = function (freeRoundInfo) {
            this.freeRoundInfo = new FreeRoundInfo();
            this.freeRoundInfo.setFreeRoundInfo(freeRoundInfo);
        };
        GLSRequestor.prototype.resetFreeRoundInfo = function () {
            this.freeRoundInfo = undefined;
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
            var glsHeader = new glscomms.GLSRequestHeader(this.metadata, this.sessionData, this.glmDescription, this.glsServerSessionId, this.platformInitData);
            var glsPayload = new glscomms.GLSRequestData(this.MSG_INIT, glsHeader);
            requestData.forEach(function (r) {
                glsPayload.addCustomPayload(r);
            });
            var factory = new HttpConnectionFactory();
            if (this._promoInfo != undefined) {
                factory.setPromoInfo(this._promoInfo);
            }
            var connection = factory.createConnectionForInitRequest(this.endPoint, glsPayload.toXMLString(), 1 /* POST */);
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
            var glsHeader = new glscomms.GLSRequestHeader(this.metadata, this.sessionData, this.glmDescription, this.glsServerSessionId, this.platformInitData);
            glsHeader.addCustomHeaders(customHeaders);
            var glsPayload = new glscomms.GLSRequestData(this.MSG_PLAY, glsHeader);
            glsPayload.addCustomPayload(new glscomms.CurrencyMultiplierPayload(this.platformInitData.getCurrencyMultiplier()));
            requestData.forEach(function (r) {
                glsPayload.addCustomPayload(r);
            });
            var factory = new HttpConnectionFactory();
            factory.resetFreeRoundInfo();
            if (this.freeRoundInfo != undefined) {
                factory.setFreeRoundInfo(this.freeRoundInfo);
            }
            var connection = factory.createConnectionForLogicRequest(this.endPoint, glsPayload.toXMLString(), 1 /* POST */);
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
        return GLSRequestor;
    })(glscomms.GLSRequestor);
    exports.GLSRequestor = GLSRequestor;
    /**
     * EventTracker
     * @class eef.EventTracker
     * @classdesc Tracker that fires a single event when all dependencies are met.
     */
    var EventTracker = (function () {
        function EventTracker() {
            this.events = {
                onAllDependenciesMet: null,
            };
            this.eventDispatcher = new events.EventDispatcher(this.events);
            this.dependencies = {};
        }
        EventTracker.prototype.getEventDispatcher = function () {
            return this.eventDispatcher;
        };
        EventTracker.prototype.trackDependency = function (identifier) {
            this.dependencies[identifier] = false;
        };
        EventTracker.prototype.dependencyMet = function (identifier) {
            this.dependencies[identifier] = true;
            this.checkAllDependencies();
        };
        EventTracker.prototype.resetAllDependencies = function () {
            for (var identifier in this.dependencies) {
                this.dependencies[identifier] = false;
            }
        };
        EventTracker.prototype.checkAllDependencies = function () {
            var allDependenciesMet = true;
            for (var identifier in this.dependencies) {
                allDependenciesMet = allDependenciesMet && this.dependencies[identifier];
            }
            if (allDependenciesMet) {
                this.events.onAllDependenciesMet();
            }
        };
        return EventTracker;
    })();
    exports.EventTracker = EventTracker;
    var BalanceListener = (function () {
        function BalanceListener(partnerBalanceService, uiController, metaData) {
            this._partnerBalanceService = partnerBalanceService;
            this._uiController = uiController;
            this._metaData = metaData;
        }
        // partner wants us to get the balance from the wallet
        BalanceListener.prototype.balanceNotificationFromPartnerAdapter = function () {
            var _this = this;
            if (this._metaData.isRealMoney()) {
                console.log('PA called this method : [To verify the Game Idle state]');
                console.log('Game verifing the IDLE STATE......');
                if (EEFConfig.IDLE_STATE) {
                    this._partnerBalanceService.fetchBalance(function (message) {
                        _this.onSuccess(message);
                    }, function (message) {
                        _this.onFailure(message);
                    });
                    console.log('Game in Idle State and triggering PA to fetch the new Balance');
                }
                else {
                    console.log('Game is not in IDLE STATE,  will not fetch balance......');
                }
            }
            else {
                console.log('PA called Balance Listener for fun play. Ignoring.');
            }
        };
        BalanceListener.prototype.onSuccess = function (message) {
            console.log('Game received balance from PA : ' + message.realBalance + ' : ' + message.statusCode + ' : ' + message.Message);
            this._uiController.onDisplayExternalBalance(message.realBalance);
        };
        BalanceListener.prototype.onFailure = function (message) {
            console.log('ERROR fetching balance: ' + message);
        };
        // partner wants to set out balance directly
        BalanceListener.prototype.handleSetBalance = function (setBalance) {
            console.log('Game verifing the IDLE STATE......');
            if (EEFConfig.IDLE_STATE) {
                console.log('Game setting balance from partner : ' + setBalance.getBalanceAmount());
                this._uiController.onDisplayExternalBalance(setBalance.getBalanceAmount());
            }
            else {
                console.log('Game is not in IDLE STATE......will not set balance');
            }
        };
        return BalanceListener;
    })();
    exports.BalanceListener = BalanceListener;
    var HistoryStack = (function () {
        function HistoryStack(historyServiceUrl, historyBetId) {
            this.historyServiceUrl = historyServiceUrl;
            this.historyBetId = historyBetId;
            this.initCompelte = false;
            this.events = {
                onHistoryDataLoaded: null,
                onHistoryPlayLoaded: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.events);
        }
        HistoryStack.prototype.getEventDispatcher = function () {
            return this.eventDispatcher;
        };
        HistoryStack.prototype.configure = function (logic, betController, glsRequestor) {
            var _this = this;
            this.logic = logic;
            //this.logic.setGameState(GamePlayState.HistoryReplay);
            this.betController = betController;
            this.bet = this.betController.getCurrentBet();
            this.glsRequestor = glsRequestor;
            this.glsRequestor.getEvents().add({
                onInitResponse: null,
                onPlayResponse: function (playResponse) {
                    if (!_this.initCompelte) {
                        _this.handlePlayResponse(playResponse);
                    }
                },
                onEndResponse: null,
                onError: null
            });
        };
        HistoryStack.prototype.handlePlayResponse = function (playResponse) {
            //this.events.onHistoryDataLoaded();
            this.initCompelte = true;
            this.events.onHistoryPlayLoaded(playResponse);
        };
        HistoryStack.prototype.setBetData = function () {
            //this.betController.setCurrentBet(this.currentBet);
        };
        HistoryStack.prototype.loadHistoryData = function () {
            var _this = this;
            if (this.historyServiceUrl == null || this.historyBetId == null) {
                util.ErrorReporter.showError('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_BODY', 'Malformed history data.');
            }
            else {
                var endpoint = this.historyServiceUrl + this.historyBetId;
                var factory = new httpconnection.HttpConnectionFactory();
                var connection = factory.createConnection(endpoint, null, 0 /* GET */);
                connection.getEvents().add({
                    onComplete: function (url, response, responseHeaders) {
                        _this.onHistoryDataResponse(url, response.responseText, responseHeaders);
                    },
                    onFail: function (url, error, status) {
                        util.ErrorReporter.showError('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_BODY', 'Error retrieving history data from service.');
                    },
                    onProgress: null
                });
                connection.send();
            }
        };
        HistoryStack.prototype.onHistoryDataResponse = function (url, responseText, responseHeaders) {
            console.log('onHistoryDataResponse' + '\n\turl: ' + url + '\n\tresponseText: ' + responseText + '\n\tresponseHeaders: ' + responseHeaders);
            var data = JSON.parse(responseText);
            var totalBet = data[0].Stake;
            this.bet = new Bet(40);
            var states = data[0].Data;
            this.historyStates = [];
            for (var ii = 0; ii < states.length; ++ii) {
                this.historyStates.push(states[ii].Comment);
            }
            this.restart();
            this.events.onHistoryDataLoaded();
        };
        HistoryStack.prototype.sendPlayRequest = function () {
            var payloads = [];
            var wager = this.betController.getCurrentBet();
            var payload = new EEFWagerPayload(wager.getUnits(), wager.getTotalBet(), "0");
            payloads.push(new glscomms.ReplayRequestPayload(this.getNextState()));
            payloads.push(payload);
            this.glsRequestor.makePlayRequest(payloads);
        };
        HistoryStack.prototype.restart = function () {
            this.historyStatesStack = this.historyStates.concat();
        };
        HistoryStack.prototype.getNextState = function () {
            if (this.historyStatesStack.length > 0) {
                return this.historyStatesStack.shift();
            }
            return null;
        };
        HistoryStack.prototype.hasData = function () {
            return this.historyStatesStack.length > 0;
        };
        HistoryStack.prototype.getBet = function () {
            return this.bet;
        };
        HistoryStack.prototype.getHistoryData = function () {
            if (this.historyStatesStack.length > 0) {
                return this.historyStatesStack[0];
            }
            return null;
        };
        return HistoryStack;
    })();
    exports.HistoryStack = HistoryStack;
    /** Enumeration of game states for controlling view */
    (function (GamePlayState) {
        GamePlayState[GamePlayState["BaseGameSpin"] = 0] = "BaseGameSpin";
        GamePlayState[GamePlayState["BaseGameSpinTriggerFreeSpin"] = 1] = "BaseGameSpinTriggerFreeSpin";
        GamePlayState[GamePlayState["BonusGameSpin"] = 2] = "BonusGameSpin";
        GamePlayState[GamePlayState["BonusGameSpinTrigger"] = 3] = "BonusGameSpinTrigger";
        GamePlayState[GamePlayState["BonusGameEnd"] = 4] = "BonusGameEnd";
        GamePlayState[GamePlayState["Recovering"] = 5] = "Recovering";
        GamePlayState[GamePlayState["fubatJackpot"] = 6] = "fubatJackpot";
        GamePlayState[GamePlayState["fgfubatJackpot"] = 7] = "fgfubatJackpot";
    })(exports.GamePlayState || (exports.GamePlayState = {}));
    var GamePlayState = exports.GamePlayState;
    /**
     * Logic
     * @class eef.Logic
     * @classdesc Class that handles all logic for a game
     */
    var Logic = (function () {
        /**
         * @constructor
         */
        function Logic(partnerAdapter, assetLoader, glsRequestor, uiController, betconfig) {
            var _this = this;
            this.reelIndex = 4;
            this.spinDuration = 0;
            this.timeOnWager = 0;
            this.partnerAdapter = partnerAdapter;
            this.assetLoader = assetLoader;
            this.glsRequestor = glsRequestor;
            this.uiController = uiController;
            var newGlsRequestor;
            this.betConfig = betconfig;
            var requestListener = {
                onInitResponse: null,
                onPlayResponse: function (playResponse) {
                    newGlsRequestor = _this.modifyResponse(glsRequestor);
                    _this.partnerAdapter.receivedGameLogicResponse(newGlsRequestor);
                    _this.handlePlayResponse(playResponse);
                },
                onEndResponse: function (endResponse) {
                    _this.partnerAdapter.receivedGameLogicResponse(glsRequestor.getRequestObject());
                    _this.handleEndResponse(endResponse);
                },
                onError: null
            };
            this.glsRequestor.getEvents().add(requestListener);
            this.gameState = 0 /* BaseGameSpin */;
            this.isHistoryReplay = false;
            this.isFuBatTrigerred = false;
            //this.multipliernumber="1";
            //this.betno="8";
        }
        Logic.prototype.modifyResponse = function (glsReq) {
            //--
            //inject total win to final play response and send it to partner adapters
            var finalPlayResponse = glsReq.getRequestObject();
            var parser = new DOMParser();
            var xml = parser.parseFromString(finalPlayResponse.response, "text/xml");
            var gameResult = xml.getElementsByTagName("GameResult")[0];
            var gameWinInfo = xml.getElementsByTagName("GameWinInfo")[0];
            var gameWin = document.createAttribute("gameWin");
            gameWin.value = gameWinInfo.attributes.getNamedItem("totalWagerWin").value;
            gameResult.attributes.setNamedItem(gameWin);
            var serializer = new XMLSerializer();
            var gameResultString = serializer.serializeToString(xml);
            var xhrObject = new XHRObject(gameResultString, finalPlayResponse);
            return xhrObject;
        };
        /**
         * Sets the game state
         * @method eef.Logic#setGameState
         * @public
         * @param {GamePlayState} state The game play state
         */
        Logic.prototype.setGameState = function (state) {
            this.gameState = state;
        };
        /**
         * Sets the spins remaining
         * @method eef.Logic#setSpinsRemaining
         * @public
         * @param {number} value The number of auto spins
         */
        Logic.prototype.setmultiplier = function (value) {
            this.multipliernumber = value;
        };
        Logic.prototype.setbetno = function (value) {
            this.betno = value;
        };
        Logic.prototype.setReelindex = function (value) {
            this.reelIndex = Number(value);
        };
        /**
         * Sets the slot object
         * @method eef.Logic#setSlot
         * @public
         * @param {Slot} slot The slot object to use
         */
        Logic.prototype.setSlot = function (slot) {
            var _this = this;
            this.slot = slot;
            this.slot.getEvents().add({
                onSpinComplete: function () {
                    _this.handleSpinComplete();
                },
                onSkillStop: null,
                onGaffReel: null,
                onDemoClicked: null
            });
        };
        /**
         * Set the free spin bonus view
         * @method eef.Logic#setFreeSpin
         * @public
         * @param {Slot} slot Free spin view
         */
        Logic.prototype.setFreeSpin = function (freeSpin) {
            var _this = this;
            this.freeSpin = freeSpin;
            this.freeSpin.getEvents().add({
                onSpin: function () {
                    _this.glsRequestor.makePlayRequest(_this.createPayloads(_this.lastWager));
                    _this.timeOnWager = new Date().getTime();
                },
                onGaffToggled: function (gaffOn) {
                    if (!gaffOn) {
                        _this.freeSpin.startNextSpin();
                    }
                }
            });
        };
        /**
         * Gets the free spin object
         * @method eef.Logic#getFreeSpin
         * @public
         * @returns {FreeSpin} The free spin object
         */
        Logic.prototype.getFreeSpin = function () {
            return this.freeSpin;
        };
        /**
         * Sets the last wager
         * @method eef.Logic#setLastWager
         * @public
         * @param {Bet} wager The wager
         */
        Logic.prototype.setLastWager = function (wager) {
            this.lastWager = wager;
        };
        /**
         * Sets the gaff stops for the slot
         * @method eef.Logic#setGaffStops
         * @public
         * @param {number[]} gaffStops The stop positions to set.
         */
        Logic.prototype.setGaffStops = function (gaffStops) {
            this.slot.setGaffStops(gaffStops);
        };
        /**
         * Makes a play request
         * @method eef.Logic#sendWager
         * @public
         * param wager {Bet}
         */
        Logic.prototype.sendWager = function (wager, requestHeaders) {
            this.lastWager = wager;
            this.slot.spin();
            this.timeOnWager = new Date().getTime();
            this.glsRequestor.makePlayRequest(this.createPayloads(wager), requestHeaders);
            //this.glsRequestor.makePlayRequest(this.createPayloads(wager));
        };
        Logic.prototype.getSlot = function () {
            return this.slot;
        };
        /**
         * Handles the completion of a spin
         * @method eef.Logic#handleSpinComplete
         * @public
         */
        Logic.prototype.setRestoreLastspinFlag = function () {
            this.setLastspinFlag = true;
        };
        Logic.prototype.handleSpinComplete = function () {
            var _this = this;
            switch (this.gameState) {
                case 4 /* BonusGameEnd */:
                    // Final bonus game spin complete
                    var resultsLen = this.slot.getWinDisplayController().gameResults.getAllSlotResults().length;
                    for (var i = 0; i < resultsLen; i++) {
                        if (this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getWinType() == 0) {
                            var scatterpos = this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getOffsets();
                            //alert(scatterpos);
                            this.uiController.flybats(scatterpos);
                        }
                    }
                    this.freeSpin.startWinDisplay();
                    if (!this.setLastspinFlag) {
                        this.freeSpin.setTriggerData(this.triggerSpinData);
                        this.setLastspinFlag = false;
                    }
                    // transition back to base game
                    this.gameState = 0 /* BaseGameSpin */;
                    // final spin is complete
                    // TODO - figure out the appropriate place to send on freespin complete
                    //        (perhaps after basegame results have cycled once?)
                    this.freeSpin.setFreeSpin(false);
                    break;
                case 0 /* BaseGameSpin */:
                    // Base game spin complete
                    var resultsLen = this.slot.getWinDisplayController().gameResults.getAllSlotResults().length;
                    for (var i = 0; i < resultsLen; i++) {
                        if (this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getWinType() == 0) {
                            var scatterpos = this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getOffsets();
                            //alert(scatterpos);
                            this.uiController.flybats(scatterpos);
                        }
                    }
                    this.slot.getWinDisplayController().start(true);
                    break;
                case 1 /* BaseGameSpinTriggerFreeSpin */:
                    // Bonus game triggered from base game
                    var delay = 0.1;
                    var resultsLen = this.slot.getWinDisplayController().gameResults.getAllSlotResults().length;
                    for (var i = 0; i < resultsLen; i++) {
                        if (this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getWinType() == 0) {
                            var scatterpos = this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getOffsets();
                            //alert(scatterpos);
                            this.uiController.flybats(scatterpos);
                        }
                    }
                    if (scatterpos) {
                        delay = 2;
                    }
                    TweenLite.delayedCall(delay, function () {
                        // this.slot cycle bonus trigger
                        _this.freeSpin.setTotalBet(_this.lastWager.getTotalBet());
                        _this.freeSpin.startPreBonusDisplay();
                        if (_this.historyData != null) {
                            _this.freeSpin.historyReplay(true);
                            _this.freeSpin.setAutoTouchToStart(true);
                        }
                        _this.freeSpin.setFreeSpin(true);
                        _this.gameState = 2 /* BonusGameSpin */;
                    });
                    break;
                case 3 /* BonusGameSpinTrigger */:
                    // Bonus game (re)triggered from bonus game
                    this.freeSpin.showRetrigger();
                    break;
                case 2 /* BonusGameSpin */:
                    // Bonus game spin complete
                    var resultsLen = this.slot.getWinDisplayController().gameResults.getAllSlotResults().length;
                    for (var i = 0; i < resultsLen; i++) {
                        if (this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getWinType() == 0) {
                            var scatterpos = this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getOffsets();
                            this.uiController.flybats(scatterpos);
                        }
                    }
                    this.freeSpin.startWinDisplay();
                    this.freeSpin.setFreeSpin(true);
                    break;
                case 5 /* Recovering */:
                    break;
                case 6 /* fubatJackpot */:
                    var resultsLen = this.slot.getWinDisplayController().gameResults.getAllSlotResults().length;
                    this.isFuBatTrigerred = true;
                    for (var i = 0; i < resultsLen; i++) {
                        if (this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getWinType() == 0) {
                            var scatterpos = this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getOffsets();
                            this.uiController.flybats(scatterpos);
                        }
                    }
                    this.fubatJackpotCall();
                    break;
                case 7 /* fgfubatJackpot */:
                    var resultsLen = this.slot.getWinDisplayController().gameResults.getAllSlotResults().length;
                    this.isFuBatTrigerred = true;
                    for (var i = 0; i < resultsLen; i++) {
                        if (this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getWinType() == 0) {
                            var scatterpos = this.slot.getWinDisplayController().gameResults.getAllSlotResults()[i].getOffsets();
                            this.uiController.flybats(scatterpos);
                        }
                    }
                    this.fgfubatJackpotCall();
                    break;
                default:
                    break;
            }
        };
        Logic.prototype.startWin = function () {
        };
        Logic.prototype.fubatJackpotCall = function () {
            this.toggleGaff(false);
            this.gameState = 0 /* BaseGameSpin */;
        };
        Logic.prototype.getFubalFeatureData = function () {
            return this.fubatJackpotFeatureInfo;
        };
        Logic.prototype.getIsFubat = function () {
            return this.isFuBatTrigerred;
        };
        Logic.prototype.setIsFubat = function (value) {
            this.isFuBatTrigerred = value;
        };
        Logic.prototype.fgfubatJackpotCall = function () {
            this.toggleGaff(false);
            this.gameState = 2 /* BonusGameSpin */;
        };
        Logic.prototype.fubatJackpotEnd = function () {
            this.slot.getWinDisplayController().start(true);
            this.gameState = 0 /* BaseGameSpin */;
            this.toggleGaff(true);
        };
        Logic.prototype.freeGameEndTrigger = function () {
            if (this.historyData == null) {
            }
            else {
                this.slot.gaffed = false;
            }
        };
        Logic.prototype.fgfubatJackpotEnd = function () {
            if (this.fubatJackpotFeatureInfo.isWinCap) {
                this.freeSpin.startWinDisplay();
                if (!this.setLastspinFlag) {
                    if (this.triggerSpinData != undefined)
                        this.freeSpin.setTriggerData(this.triggerSpinData);
                    this.setLastspinFlag = false;
                }
                // transition back to base game
                this.gameState = 0 /* BaseGameSpin */;
            }
            else {
                this.slot.getWinDisplayController().start(true);
                this.gameState = 2 /* BonusGameSpin */;
                this.toggleGaff(true);
            }
        };
        Logic.prototype.fgRtfubatJackpotEnd = function () {
            if (this.fubatJackpotFeatureInfo.isWinCap) {
                this.freeSpin.startWinDisplay();
                if (!this.setLastspinFlag) {
                    if (this.triggerSpinData != undefined)
                        this.freeSpin.setTriggerData(this.triggerSpinData);
                    this.setLastspinFlag = false;
                }
                // transition back to base game
                this.gameState = 0 /* BaseGameSpin */;
            }
            else {
                this.gameState = 2 /* BonusGameSpin */;
                this.toggleGaff(true);
                this.freeSpin.showRetrigger();
            }
        };
        Logic.prototype.fgbgfubatJackpotEnd = function () {
            this.freeSpin.startWinDisplay();
            if (!this.setLastspinFlag) {
                this.freeSpin.setTriggerData(this.triggerSpinData);
                this.setLastspinFlag = false;
            }
            // transition back to base game
            this.gameState = 0 /* BaseGameSpin */;
        };
        Logic.prototype.fgtrigger = function () {
            this.freeSpin.setTotalBet(this.lastWager.getTotalBet());
            this.freeSpin.startPreBonusDisplay();
            if (this.historyData != null) {
                this.freeSpin.setAutoTouchToStart(true);
            }
            else {
                this.toggleGaff(true);
            }
            this.gameState = 2 /* BonusGameSpin */;
        };
        Logic.prototype.fuBatHistoryReplay = function () {
            this.slot.getWinDisplayController().start(true);
        };
        Logic.prototype.toggleGaff = function (enable) {
            if (this.uiController.isGaffingEnabled()) {
                if (enable === true) {
                    this.slot.setGaffingType(0);
                    this.slot.setGaffStops(null);
                    this.slot.gaffed = false;
                }
                this.slot.gaffingEnabled = enable;
            }
        };
        /**
         * Handles the play response from the server
         * @method eef.Logic#handlePlayResponse
         * @private
         * @param {glscomms.PlayResponse} response The play response from the server
         */
        Logic.prototype.handlePlayResponse = function (response) {
            var _this = this;
            this.isFuBatTrigerred = false;
            if (this.gameState != 5 /* Recovering */) {
                var gameData = response.getGameData();
                var customData = gameData.getCustomData();
                this.customData = customData.spinsAwarded;
                if (this.reelIndex !== Number(customData.reelIndex)) {
                    this.reelIndex = Number(customData.reelIndex);
                    //this.setGaffReelIndex(Number(this.reelIndex));
                    this.slot.changeReelSet(Number(this.reelIndex));
                }
                if ((customData != undefined) && (customData.fuBatInfo != undefined)) {
                    if (customData.fuBatInfo.featureindex === "2" && customData.fuBatInfo.featurename === "BG_FuBat_Jackpot") {
                        this.uiController.stopAutoPlay();
                        this.uiController.toggleSpinButton(false);
                        this.fubatJackpotFeatureInfo = gameData.getCustomData();
                    }
                }
                if ((customData != undefined) && (customData.spinsAwarded != undefined)) {
                    this.freeSpin.setGameData(gameData);
                }
                var currentTime = new Date().getTime();
                var timeLapsed = (currentTime - this.timeOnWager) / 1000;
                var delay = 0;
                this.spinDuration = this.betConfig.getSpinT();
                if (this.spinDuration < 0) {
                    this.spinDuration = 0;
                }
                if (this.spinDuration > 3) {
                    delay = this.spinDuration - 1.5;
                }
                if (this.gameState == 0 /* BaseGameSpin */) {
                    if (timeLapsed < delay) {
                        delay = delay - timeLapsed;
                        TweenMax.delayedCall(delay, function () {
                            _this.slot.getWinDisplayController().configure(gameData, false);
                            _this.slot.getSymbolAnimationController().setHitData(gameData.getAllSlotResults());
                            _this.slot.setStopPositions(response.getGameData().getStopPositions());
                        });
                    }
                    else {
                        this.slot.getWinDisplayController().configure(gameData, false);
                        this.slot.getSymbolAnimationController().setHitData(gameData.getAllSlotResults());
                        this.slot.setStopPositions(response.getGameData().getStopPositions());
                    }
                }
                else if (this.gameState == 2 /* BonusGameSpin */ || this.gameState == 3 /* BonusGameSpinTrigger */) {
                    var customData = gameData.getCustomData();
                    this.triggerSpinData = customData.getBaseGameResult();
                    this.freeSpin.configureResultsDisplay();
                    if (customData.fuBatInfo != undefined) {
                        if (customData.fuBatInfo.featureindex === "3" && customData.fuBatInfo.featurename === "FG_FuBat_Jackpot") {
                            this.fubatJackpotFeatureInfo = gameData.getCustomData();
                            if (customData.spinsAwarded > 0) {
                                this.freeSpin.getRetrigger().setSpinsAwarded(customData.getSpinsAwarded());
                            }
                        }
                    }
                    else {
                        //check for a retrigger
                        if (gameData.isBonusTriggered()) {
                            this.freeSpin.getRetrigger().setSpinsAwarded(customData.getSpinsAwarded());
                        }
                    }
                }
                else {
                    console.log('Incorrect game state on play response');
                }
                this.gameState = this.getNextState(this.gameState, gameData);
            }
        };
        /**
         * Handles the end response from the server
         * @method eef.Logic#handleEndResponse
         * @private
         * @param {glscomms.EndResponse} response The end response from the server
         */
        Logic.prototype.handleEndResponse = function (response) {
            this.partnerAdapter.finishedPlay();
            this.partnerAdapter.finishedPostGameAnimations();
            console.log("End Response Received");
        };
        /**
         * Determine next game play state, based on current state and incoming server data
         * @method eef.Logic#getNextState
         * @private
         * @param {GamePlayState} currentState Current game state
         * @param {GamePlayState} gamedta.GamePlayData Game data from play request
         * @returns {GamePlayState} New game state
         */
        Logic.prototype.getNextState = function (currentState, data) {
            var newState = currentState;
            var fsData = data.getCustomData();
            var customData = data.getCustomData();
            switch (currentState) {
                case 0 /* BaseGameSpin */:
                    if ((customData != undefined) && (customData.fuBatInfo != undefined)) {
                        if (customData.fuBatInfo.featureindex === "2" && customData.fuBatInfo.featurename === "BG_FuBat_Jackpot") {
                            this.isFuBatTrigerred = true;
                            newState = 6 /* fubatJackpot */;
                        }
                    }
                    else if (data.isBonusTriggered()) {
                        newState = 1 /* BaseGameSpinTriggerFreeSpin */;
                    }
                    break;
                case 2 /* BonusGameSpin */:
                    if (customData.fuBatInfo != undefined) {
                        newState = 7 /* fgfubatJackpot */;
                        this.isFuBatTrigerred = true;
                        if (customData.spinsAwarded > 0) {
                            this.fubatBonusRetrigger = true;
                        }
                        else {
                            this.fubatBonusRetrigger = false;
                        }
                    }
                    else {
                        if (data.getCustomData().isWinCap) {
                            newState = 4 /* BonusGameEnd */;
                        }
                        else {
                            if (data.isBonusTriggered()) {
                                newState = 3 /* BonusGameSpinTrigger */;
                            }
                            else if (fsData.getSpinsRemaining() == 0) {
                                newState = 4 /* BonusGameEnd */;
                            }
                        }
                    }
                    break;
                case 3 /* BonusGameSpinTrigger */:
                    if (customData.fuBatInfo != undefined) {
                        newState = 7 /* fgfubatJackpot */;
                        this.isFuBatTrigerred = true;
                    }
                    else {
                        newState = (data.isBonusTriggered()) ? 3 /* BonusGameSpinTrigger */ : 2 /* BonusGameSpin */;
                    }
                    break;
                case 1 /* BaseGameSpinTriggerFreeSpin */:
                    newState = 2 /* BonusGameSpin */;
                    break;
                case 4 /* BonusGameEnd */:
                    newState = 0 /* BaseGameSpin */;
                    break;
            }
            return newState;
        };
        Logic.prototype.setGaffReelIndex = function (reelIndex) {
            this.slot.setGaffReelIndex(reelIndex);
        };
        Logic.prototype.setSymbolID = function (symbolID) {
            this.slot.setSymbolID(symbolID);
        };
        Logic.prototype.setGaffingType = function (gaffingType) {
            this.slot.setGaffingType(gaffingType);
        };
        /**
         * Creates a wager payload for the GLS server
         * @method eef.Logic#createPayloads
         * @private
         * @param {Bet} wager the current wager
         * @returns {glscomms.ICustomGLSPayload[]} The list of payloads to send to the GLS
         */
        Logic.prototype.createPayloads = function (wager) {
            var payloads = [];
            var betMultiplier = this.multipliernumber;
            var totalStake = Number(this.betno);
            var payload = new EEFWagerPayload(wager.getUnits(), totalStake, betMultiplier);
            payloads.push(payload);
            if (this.isHistoryReplay) {
                payloads.push(new glscomms.ReplayRequestPayload(this.historyReplayData.getNextState()));
            }
            if (this.slot.shouldGaff()) {
                payloads.push(new GaffPayload(this.slot.getGaffStops(), this.slot.getGaffReelIndex(), this.slot.getGaffingType(), this.slot.getSymbolID()));
            }
            return payloads;
        };
        Logic.prototype.startHistoryReplay = function (historyData) {
            this.historyData = historyData;
            this.sendWager(this.historyData.getBet());
        };
        /* From the partner will trigger this method to stop the reel with non win combmination
        * While getting error partner will trigger this method
        ** @resetHard
        */
        Logic.prototype.resetHard = function () {
            TweenMax.delayedCall(0.5, this.slot.setStopPositions, [EEFConfig.INITIAL_BG_REEL_INDICES, true], this.slot);
            if (this.customData == undefined && this.uiController != null) {
                this.uiController.resetHard();
            }
            this.gameState = 0 /* BaseGameSpin */;
        };
        /* It used set history replay data
        * Setting flag for history replay
        * @public
        * @param {HistoryStack} It will contain history Replay information.
        * @param {glscomms.PlayResponse} It Will contain play response.
        */
        Logic.prototype.setHistoryReplay = function (historyReplay, playResponse) {
            this.historyData = historyReplay;
            this.isHistoryReplay = true;
            this.historyReplayData = historyReplay;
            this.slot.spin();
            this.timeOnWager = new Date().getTime();
            this.slot.setStopPositions(playResponse.getGameData().getStopPositions());
        };
        return Logic;
    })();
    exports.Logic = Logic;
    /**
     * Manages the current bet and the list of availale bets.
     */
    var BetController = (function () {
        function BetController(stakes, defaultIndex, multiplier, defaultMultiplierIndex, audioController, minBet, maxBet) {
            var _this = this;
            this.baseBetUnit = 8;
            this.betMultiplier = 1;
            this.availableBets = [];
            this.availableMultipliers = [];
            // Assume that the first (lowest) bet is 1 per unit.
            var minimumUnits = stakes[0];
            this.minBet = minimumUnits;
            stakes.forEach(function (stake) {
                _this.availableBets.push(new Bet(stake));
            });
            this.currentBetIndex = this.defaultBetIndex = defaultIndex;
            this.defaultMultiplierIndex = defaultMultiplierIndex;
            multiplier.forEach(function (multiplier) {
                if (minBet == undefined && maxBet == undefined) {
                    _this.availableMultipliers.push(new MultiplierBetsValue(multiplier));
                }
                else if (minBet > 0 && maxBet == undefined) {
                    if (multiplier >= minBet / 88) {
                        _this.availableMultipliers.push(new MultiplierBetsValue(multiplier));
                    }
                }
                else if (minBet == undefined && maxBet > 0) {
                    if (multiplier <= maxBet / 88) {
                        _this.availableMultipliers.push(new MultiplierBetsValue(multiplier));
                    }
                }
                else if (minBet > 0 && maxBet > 0 && multiplier >= minBet / 88 && multiplier <= maxBet / 88) {
                    _this.availableMultipliers.push(new MultiplierBetsValue(multiplier));
                }
            });
            this.currentMultiplierIndex = defaultMultiplierIndex;
            this.signal = {
                onBetChange: null,
                onMultiplierChange: null
            };
            this.events = new events.EventDispatcher(this.signal);
            this.audioController = audioController;
        }
        BetController.prototype.getEvents = function () {
            return this.events;
        };
        BetController.prototype.setBetMultiplier = function (betMultiplier) {
            this.betMultiplier = betMultiplier;
        };
        BetController.prototype.getCurrentBet = function () {
            return this.forceBet ? this.forceBet : this.availableBets[this.currentBetIndex];
        };
        BetController.prototype.getCurrentMultiplierIndex = function () {
            return this.currentMultiplierIndex;
        };
        BetController.prototype.getMultiplierLenth = function () {
            return this.availableMultipliers.length;
        };
        BetController.prototype.setmultiplierIndex = function (index) {
            this.currentMultiplierIndex = Number(index);
        };
        BetController.prototype.getCurrentMultiplier = function () {
            return this.availableMultipliers[this.currentMultiplierIndex];
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
        BetController.prototype.increaseMultiplier = function () {
            this.forceBet = null;
            if (this.currentMultiplierIndex < this.availableMultipliers.length - 1) {
                this.currentMultiplierIndex++;
                this.signal.onMultiplierChange(this.getCurrentMultiplier());
                this.audioController.playButtonClick();
            }
            return this.getCurrentMultiplier();
        };
        /**
         * Decreases the bet, if possible. Returns the new bet value, which will be unchanged
         * if there are no lower bets available. If the bet changes, emits the onBetChange signal.
         */
        BetController.prototype.decreaseBet = function () {
            if (this.currentBetIndex > 0) {
                this.currentBetIndex--;
                this.signal.onBetChange(this.getCurrentBet());
            }
            return this.getCurrentBet();
        };
        BetController.prototype.decreaseMultiplier = function () {
            if (this.currentMultiplierIndex > 0) {
                this.currentMultiplierIndex--;
                this.signal.onMultiplierChange(this.getCurrentMultiplier());
                this.audioController.playButtonClick();
            }
            return this.getCurrentMultiplier();
        };
        /**
        * force a bet amount
        * @param {number} if the force bet is positive, then override the bet
        */
        BetController.prototype.setForceBet = function (forceStake) {
            if (forceStake === void 0) { forceStake = -1; }
            if (forceStake > 0) {
                //this.forceBet = new Bet(this.minBet, forceStake / this.minBet);
                this.forceBet = new Bet(forceStake / this.minBet);
                this.signal.onBetChange(this.getCurrentBet());
                //this.currentBetIndex = this.setBetMultiPler(forceStake/8);    
                this.setBet(forceStake / this.minBet);
            }
            else {
                this.forceBet = null;
            }
            return this.getCurrentBet();
        };
        /**
        * Set the Multiplier Index
        * @param {number}
        */
        BetController.prototype.setBetMultiPler = function (betLevel) {
            var betValue = [88, 68, 38, 18, 8];
            var totalStake = {
                betno: 8,
                multipler: 1
            };
            for (var i = 0; i < betValue.length; i++) {
                if (betLevel % betValue[i] == 0) {
                    console.log(i, betValue[i], (betLevel / betValue[i]));
                    totalStake.betno = betValue[i];
                    totalStake.multipler = ((betLevel / betValue[i]) * this.betMultiplier);
                    return totalStake;
                    break;
                }
            }
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
        /**
        * @param {number} the total level of the bet
        * @return {number} the total bet, based on the base bet
        */
        BetController.prototype.getBetByLevel = function (betLevel) {
            //this.baseBetUnit = this.availableBets[this.getBetIndexByAmount(betLevel)].getTotalBet();
            return betLevel * this.baseBetUnit * this.betMultiplier;
        };
        /**
         * Attempts to set the current bet to the given totalBet. If there is no available Bet
         * equal to the given totalBet, no change is made. The current bet is returned after execution
         * regardless of whether the change succeeds.
         *
         * @param  {number} totalBet The total bet desired.
         * @return {Bet}             The current bet after execution.
         */
        BetController.prototype.setBet = function (totalBet) {
            for (var ii = 0, length = this.availableBets.length; ii < length; ++ii) {
                if (this.availableBets[ii].getTotalBet() == totalBet && this.currentBetIndex != ii) {
                    this.currentBetIndex = ii;
                    this.signal.onBetChange(this.getCurrentBet());
                }
            }
            return this.getCurrentBet();
        };
        BetController.prototype.getIsValidStake = function (value) {
            for (var i = 0; i < this.availableBets.length; i++) {
                for (var j = 0; j < this.availableMultipliers.length; j++) {
                    if (value == this.availableBets[i].getTotalBet() * this.availableMultipliers[j].getMultiplier()) {
                        return true;
                    }
                }
            }
            return false;
        };
        return BetController;
    })();
    exports.BetController = BetController;
    /**
     * A possible bet, stored as separate components.
     */
    var Bet = (function () {
        function Bet(units) {
            this.units = units;
        }
        Bet.prototype.getUnits = function () {
            return this.units;
        };
        Bet.prototype.getBetPerUnit = function () {
            return this.units;
        };
        Bet.prototype.getTotalBet = function () {
            return this.units;
        };
        return Bet;
    })();
    exports.Bet = Bet;
    /**
     * A possible bet, stored as separate components.
     */
    var MultiplierBetsValue = (function () {
        function MultiplierBetsValue(multiplier) {
            this.multiplier = multiplier;
        }
        MultiplierBetsValue.prototype.getMultiplier = function () {
            return this.multiplier;
        };
        return MultiplierBetsValue;
    })();
    exports.MultiplierBetsValue = MultiplierBetsValue;
    var FubatJackpotView = (function () {
        function FubatJackpotView(scene, scalar, baseBundle, fuBatBg, coinIcons, inputHandler, translator, currencyFormatter, audioController) {
            this.isHistoryReplay = false;
            this.timeline = [];
            this.count = [];
            this.fuBatBg = fuBatBg;
            this.coinIcons = coinIcons;
            this.inputHandler = inputHandler;
            this.scene = scene;
            this.baseBundle = baseBundle;
            this.baseBundle = baseBundle;
            this.currencyFormatter = currencyFormatter;
            this.scalar = scalar;
            this.handlersSetIcons = false;
            this.isfubatAllowed = false;
            this.fubatIcons = [];
            this.fubatGlow = [];
            this.audioController = audioController;
            this.coinClicked = [];
            this.coinAnimClicked = [];
            this.twoClickFlag = false;
            this.translator = translator;
            this.addListener();
            this.congs_1 = this.createImage(scene, scalar, baseBundle.minijackpotbanner, false, 215, 260, 1001);
            this.congs_2 = this.createImage(scene, scalar, baseBundle.minorjackpotbanner, false, 150, 230, 1001);
            this.congs_3 = this.createImage(scene, scalar, baseBundle.majorjackpotbanner, false, 83.5, 200, 1001);
            this.congs_4 = this.createImage(scene, scalar, baseBundle.grandjackpotbanner, false, 17.5, 170, 1001);
            this.picktext1 = this.createTxt(scene, scalar, baseBundle, 960, 60, 1001, this.translator.findByKey("picktext1"), '40px ', null, '#fff9ec', '#fff9ec');
            this.picktext2 = this.createTxt(scene, scalar, baseBundle, 960, 130, 1001, this.translator.findByKey("picktext2"), '40px ', null, '#fff9ec', '#fff9ec');
            this.coinAnimate = this.createImageAnimate(scene, scalar, baseBundle.coingoldanim, false, null, null, 1001);
        }
        FubatJackpotView.prototype.setBowl = function (bowl) {
            this.bowl = bowl;
        };
        FubatJackpotView.prototype.createImageAnimate = function (scene, scalar, asset, visible, Xpos, Ypos, Zindex) {
            var actor = abg2d.Factory.composeFramedAnimation(scene, null);
            var image = actor.getImage();
            image.setSpriteSheet(new abg2d.SpriteSheet(asset, scalar));
            var transform = actor.getTransform();
            transform.setPosition(500, 300);
            transform.setVisible(visible);
            transform.setZOrder(Zindex);
            var animator = actor.getFrameAnimator();
            return actor;
        };
        FubatJackpotView.prototype.playAnimator = function (xpos, ypos, frames) {
            this.coinAnimate.getTransform().setVisible(true);
            this.coinAnimate.getTransform().setZOrder(1002);
            this.coinAnimate.getTransform().setPosition(xpos, ypos);
            this.coinAnimate.getFrameAnimator().setFramerate(frames);
            this.coinAnimate.getFrameAnimator().play(-1);
        };
        /* shows the bg and coins */
        FubatJackpotView.prototype.show = function () {
            var _this = this;
            var tl = new TimelineMax({ paused: true, onComplete: function () {
                tl.kill();
            } });
            var tweenCoins = this.bowl.getAnimCoins();
            var duration;
            tl.add(function () {
                var tweenCoins = _this.bowl.getAnimCoins();
                for (var i = 0; i < tweenCoins.length; i++) {
                    tweenCoins[i].getFrameAnimator().setFramerate(30);
                    tweenCoins[i].getFrameAnimator().playFromTo(14, 0);
                    tweenCoins[i].getFrameAnimator().setOnComplete(function (frameAnimator) {
                        frameAnimator.stop(true);
                        frameAnimator.setFrame(0);
                    });
                }
            }, 0);
            tl.add(function () {
                _this.audioController.playFubatLoop();
            }, 0.5);
            for (var i = 0; i < tweenCoins.length; ++i) {
                tweenCoins[i].getTransform().setVisible(true);
                duration = 1.2 - ((0.1) * Math.pow(2, Math.floor(i / 4)));
                tl.to(tweenCoins[i].getTransform(), duration, { bezier: {
                    autoRotate: false,
                    values: [
                        { setPositionX: 860, setPositionY: 140 },
                        { setPositionX: 840, setPositionY: -150 },
                        { setPositionX: FubatJackpotView.COIN_START_X[i] - 100, setPositionY: 0 },
                        { setPositionX: FubatJackpotView.COIN_START_X[i] - 29, setPositionY: FubatJackpotView.COIN_START_Y[i] - 40 }
                    ],
                    ease: Power2.easeOut,
                    curviness: 1
                } }, 0);
                tl.fromTo(tweenCoins[i].getTransform(), duration, { setScaleX: 0, setScaleY: 0 }, { setScaleX: 1, setScaleY: 1, ease: Power2.easeOut }, 0);
            }
            this.fuBatBg.getTransform().setVisible(true);
            tl.fromTo(this.fuBatBg.getImage(), 0.5, { setOpacity: 0 }, { setOpacity: 1 }, 0.25);
            this.picktext1.getTransform().setVisible(true);
            this.picktext2.getTransform().setVisible(true);
            tl.fromTo(this.picktext1.getText(), 0.5, { setOpacity: 0 }, { setOpacity: 1 }, 1);
            tl.fromTo(this.picktext2.getText(), 0.5, { setOpacity: 0 }, { setOpacity: 1 }, 1);
            tl.play();
        };
        /* triggers fubatjackpotinfo from logic */
        FubatJackpotView.prototype.fubatJackpotShow = function (fubatjackpotinfo, logic) {
            var _this = this;
            this.logic = logic;
            for (var i = 0; i < FubatJackpotView.JACKPOTS; i++) {
                this.count[i] = 0;
                this.timeline[i] = new TimelineMax({ paused: true });
            }
            this.fubatjackpotinfo = fubatjackpotinfo;
            this.isfubatAllowed = true;
            var jackPotValues = this.fubatjackpotinfo.fuBatInfo.pickIndex.split('|');
            var pickLen = jackPotValues.length;
            this.jackPotValues = jackPotValues;
            this.jackPotWin = Number(this.fubatjackpotinfo.fuBatInfo.jackPotWin);
            this.pickedLen = pickLen;
            this.jackpotno = 0;
            this.show();
            this.winamount = this.currencyFormatter.format(this.fubatjackpotinfo.fuBatInfo.jackPotAmt);
            for (var i = 0; i < this.coinIcons.length; i++) {
                this.coinClicked[i] = false;
                this.coinAnimClicked[i] = false;
                this.coinIcons[i].getTransform().setVisible(false);
            }
            if (this.isHistoryReplay) {
                TweenLite.delayedCall(1, function () {
                    _this.showPickedIconByHistoryReplay();
                });
            }
        };
        /* adds touch event for coins */
        FubatJackpotView.prototype.addListener = function () {
            var that = this;
            for (var i = 0; i < this.coinIcons.length; i++) {
                var actor = this.coinIcons[i];
                var transform = actor.getTransform();
                //transform.setVisible(true);
                if (!this.handlersSetIcons) {
                    this.setInputHandler(actor, transform.getTranslatedPositionX(), transform.getTranslatedPositionY(), function (index) {
                        return function () {
                            if (!that.isHistoryReplay) {
                                if (!that.twoClickFlag) {
                                    that.anim(index);
                                }
                            }
                            //that.showPickIcons(index)                                        
                        };
                    }(i));
                }
            }
            this.handlersSetIcons = true;
        };
        FubatJackpotView.prototype.anim = function (index) {
            var _this = this;
            if (this.isfubatAllowed) {
                if (!this.coinAnimClicked[index]) {
                    this.twoClickFlag = true;
                    this.audioController.playCoinPick();
                    var xpos = FubatJackpotView.COIN_START_X[index] - 29;
                    var ypos = FubatJackpotView.COIN_START_Y[index] - 40;
                    var coins = this.bowl.getAnimCoins();
                    coins[index].getTransform().setVisible(false);
                    this.playAnimator(xpos, ypos, 15);
                    TweenLite.delayedCall(1, function () {
                        _this.stopPlayAnimator();
                        _this.showPickIcons(index);
                        _this.twoClickFlag = false;
                    });
                    TweenLite.delayedCall(.7, function () {
                        _this.showPickIcons(index);
                    });
                    this.coinAnimClicked[index] = true;
                }
            }
        };
        FubatJackpotView.prototype.stopPlayAnimator = function () {
            this.coinAnimate.getFrameAnimator().stop(true, false);
            this.coinAnimate.getFrameAnimator().setFrame(0);
            this.coinAnimate.getTransform().setVisible(false);
        };
        /* shows ths jackpoticon */
        FubatJackpotView.prototype.showPickIcons = function (index) {
            var _this = this;
            if (this.isfubatAllowed) {
                if (!this.coinClicked[index]) {
                    if (this.jackPotValues[this.jackpotno] == 0) {
                        var miniasset = this.baseBundle.miniicon;
                        var minibackgroundActor = abg2d.Factory.composeImage(this.scene, null, new abg2d.SpriteSheet(miniasset, this.scalar));
                        var minibgTransform = minibackgroundActor.getTransform();
                        minibgTransform.setPosition(FubatJackpotView.COIN_START_X[index], FubatJackpotView.COIN_START_Y[index]);
                        minibgTransform.setZOrder(100);
                        this.fubatIcons.push(minibackgroundActor);
                        this.fubatGlow.push(this.createPickGlow(index, 0));
                        this.playGlow(0);
                    }
                    else if (this.jackPotValues[this.jackpotno] == 1) {
                        var minorasset = this.baseBundle.minoricon;
                        var minorbackgroundActor = abg2d.Factory.composeImage(this.scene, null, new abg2d.SpriteSheet(minorasset, this.scalar));
                        var minorbgTransform = minorbackgroundActor.getTransform();
                        minorbgTransform.setPosition(FubatJackpotView.COIN_START_X[index], FubatJackpotView.COIN_START_Y[index]);
                        minorbgTransform.setZOrder(100);
                        this.fubatIcons.push(minorbackgroundActor);
                        this.fubatGlow.push(this.createPickGlow(index, 1));
                        this.playGlow(1);
                    }
                    else if (this.jackPotValues[this.jackpotno] == 2) {
                        var majorasset = this.baseBundle.majoricon;
                        var majorbackgroundActor = abg2d.Factory.composeImage(this.scene, null, new abg2d.SpriteSheet(majorasset, this.scalar));
                        var majorbgTransform = majorbackgroundActor.getTransform();
                        majorbgTransform.setPosition(FubatJackpotView.COIN_START_X[index], FubatJackpotView.COIN_START_Y[index]);
                        majorbgTransform.setZOrder(100);
                        this.fubatIcons.push(majorbackgroundActor);
                        this.fubatGlow.push(this.createPickGlow(index, 2));
                        this.playGlow(2);
                    }
                    else {
                        var grandrasset = this.baseBundle.grandicon;
                        var grandbackgroundActor = abg2d.Factory.composeImage(this.scene, null, new abg2d.SpriteSheet(grandrasset, this.scalar));
                        var grandbgTransform = grandbackgroundActor.getTransform();
                        grandbgTransform.setPosition(FubatJackpotView.COIN_START_X[index], FubatJackpotView.COIN_START_Y[index]);
                        grandbgTransform.setZOrder(100);
                        this.fubatIcons.push(grandbackgroundActor);
                        this.fubatGlow.push(this.createPickGlow(index, 3));
                        this.playGlow(3);
                    }
                    this.jackpotno++;
                    this.pickedLen--;
                    this.coinClicked[index] = true;
                    if (this.pickedLen == 0) {
                        TweenLite.delayedCall(1.1, function () {
                            _this.showCongrats();
                        });
                        this.reset();
                    }
                    if (this.isHistoryReplay) {
                        TweenLite.delayedCall(1, function () {
                            if (_this.pickedLen != 0) {
                                _this.showPickedIconByHistoryReplay();
                            }
                        });
                    }
                }
            }
        };
        FubatJackpotView.prototype.showCongrats = function () {
            var _this = this;
            this.showBanner(this.jackPotWin);
            this.WonAmt.getTransform().setVisible(true);
            this.picktext1.getTransform().setVisible(false);
            this.picktext2.getTransform().setVisible(false);
            this.twoClickFlag = false;
            TweenLite.delayedCall(5, function () {
                _this.hideIcons();
                _this.WonAmt.getTransform().setVisible(false);
                if (_this.fubatjackpotinfo.spinsAwarded > 0) {
                    _this.logic.fgRtfubatJackpotEnd();
                }
                else if ((_this.fubatjackpotinfo.fuBatInfo.featurename == "FG_FuBat_Jackpot") && (_this.fubatjackpotinfo.spinsRemaining == 0)) {
                    _this.logic.fgbgfubatJackpotEnd();
                }
                else if (_this.fubatjackpotinfo.fuBatInfo.featurename == "FG_FuBat_Jackpot") {
                    _this.logic.fgfubatJackpotEnd();
                }
                else if (_this.fubatjackpotinfo.spinsRemaining != undefined) {
                    _this.logic.fgtrigger();
                }
                else {
                    if (!_this.isHistoryReplay) {
                        _this.logic.fubatJackpotEnd();
                    }
                    else {
                        _this.logic.fuBatHistoryReplay();
                    }
                }
            });
        };
        /*shows the congrats banner*/
        FubatJackpotView.prototype.showBanner = function (index) {
            switch (index) {
                case 0:
                    this.congs_1.getImage().setVisible(true);
                    this.WonAmt = this.createCongratsWonAmt(this.congs_1, this.scene, this.scalar, this.baseBundle, false, 900, 520, 1003, this.winamount, '120px ', null, '#fff9ec', '#fff9ec');
                    this.audioController.playMiniJackpot();
                    break;
                case 1:
                    this.congs_2.getImage().setVisible(true);
                    this.WonAmt = this.createCongratsWonAmt(this.congs_2, this.scene, this.scalar, this.baseBundle, false, 1000, 570, 1003, this.winamount, '120px ', null, '#fff9ec', '#fff9ec');
                    this.audioController.playMinorJackpot();
                    break;
                case 2:
                    this.congs_3.getImage().setVisible(true);
                    this.WonAmt = this.createCongratsWonAmt(this.congs_3, this.scene, this.scalar, this.baseBundle, false, 1050, 600, 1003, this.winamount, '120px ', null, '#fff9ec', '#fff9ec');
                    this.audioController.playMajorJackpot();
                    break;
                case 3:
                    this.congs_4.getImage().setVisible(true);
                    this.WonAmt = this.createCongratsWonAmt(this.congs_4, this.scene, this.scalar, this.baseBundle, false, 1140, 630, 1003, this.winamount, '120px ', null, '#fff9ec', '#fff9ec');
                    this.audioController.playGrandJackpot();
                    break;
                default:
                    break;
            }
        };
        /* resets the flag */
        FubatJackpotView.prototype.reset = function () {
            this.isfubatAllowed = false;
        };
        /* hides the icon after congrats banner */
        FubatJackpotView.prototype.hideIcons = function () {
            this.fuBatBg.getTransform().setVisible(false);
            var coins = this.bowl.getAnimCoins();
            for (var i = 0; i < coins.length; i++) {
                coins[i].getTransform().setVisible(false);
            }
            for (var i = 0; i < this.fubatIcons.length; i++) {
                var actor = this.fubatIcons[i];
                var transform = actor.getTransform();
                transform.setVisible(false);
            }
            for (var i = 0; i < this.fubatIcons.length; i++) {
                this.coinClicked[i] = false;
                this.coinAnimClicked[i] = false;
            }
            for (i = 0; i < this.fubatGlow.length; i++) {
                var actor = this.fubatGlow[i];
                actor.getTransform().setVisible(false);
                this.scene.removeTransform(actor.getTransform());
                this.scene.removeRenderable(actor.getRenderable());
                this.scene.removeActor(actor);
            }
            this.fubatGlow = [];
            this.congs_1.getImage().setVisible(false);
            this.congs_2.getImage().setVisible(false);
            this.congs_3.getImage().setVisible(false);
            this.congs_4.getImage().setVisible(false);
            this.WonAmt.getTransform().setVisible(false);
            this.audioController.stopFubatLoop();
        };
        FubatJackpotView.prototype.createImage = function (scene, scalar, asset, visible, Xpos, Ypos, Zindex) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.getImage().setVisible(visible);
            var transform = actor.getTransform();
            transform.setPosition(Xpos, Ypos);
            transform.setZOrder(Zindex);
            return actor;
        };
        FubatJackpotView.prototype.createTxt = function (scene, scalar, baseBundle, Xpos, Ypos, Zindex, showtxt, fontsize, str, color, borderclr) {
            var actor = abg2d.Factory.composeText(scene, this.fuBatBg);
            var txt = actor.getText();
            txt.setFont(fontsize + baseBundle.myriadProSemiBold.getFontName());
            abg2d.TextFactory.createFillText(txt, color);
            txt.setScalar(scalar);
            txt.setOpacity(0);
            txt.setMaxLineWidth(1500);
            txt.setLineHeight(0.5);
            txt.setAlign(6 /* Center */);
            txt.setText(showtxt);
            actor.getTransform().setPosition(Xpos, Ypos);
            actor.getTransform().setVisible(false);
            return actor;
        };
        FubatJackpotView.prototype.createCongratsWonAmt = function (parent, scene, scalar, baseBundle, visible, Xpos, Ypos, Zindex, showtxt, fontsize, str, color, borderclr) {
            var image = parent.getImage();
            var Actor = abg2d.Factory.composeText(scene, parent);
            var txt = Actor.getText();
            txt.setAlign(6 /* Center */);
            Actor.getTransform().setPosition(Xpos, Ypos);
            Actor.getTransform().setVisible(visible);
            txt.setFont(fontsize + baseBundle.myriadProSemiBold.getFontName());
            abg2d.TextFactory.createFillText(txt, color);
            txt.setScalar(scalar);
            txt.setMaxLineWidth(1000);
            txt.setLineHeight(0.5);
            txt.setText(showtxt);
            return Actor;
        };
        FubatJackpotView.prototype.createPickGlow = function (index, jackpotID) {
            var img = [this.baseBundle.miniglow, this.baseBundle.minorglow, this.baseBundle.majorglow, this.baseBundle.grandglow];
            var actor = abg2d.Factory.composeImage(this.scene, null, new abg2d.SpriteSheet(img[jackpotID], this.scalar));
            actor.getImage().setAlign(6 /* Center */);
            var xfm = actor.getTransform();
            xfm.setPosition(FubatJackpotView.COIN_START_X[index] + 166, FubatJackpotView.COIN_START_Y[index] + 155);
            xfm.setZOrder(99);
            xfm.setVisible(false);
            this.count[jackpotID]++;
            this.timeline[jackpotID].fromTo(actor.getTransform(), 0.01, { setVisible: false }, { setVisible: true }, 0);
            this.timeline[jackpotID].fromTo(actor.getImage(), 0.75, { setOpacity: 1 }, { setOpacity: 0, repeat: -1, ease: Power2.easeIn }, 0);
            this.timeline[jackpotID].fromTo(actor.getTransform(), 0.75, { setScaleX: 0.8, setScaleY: 0.8 }, { setScaleX: 1.0, setScaleY: 1.0, repeat: -1 }, 0);
            return actor;
        };
        FubatJackpotView.prototype.playGlow = function (id) {
            switch (this.count[id]) {
                case 2:
                    for (var i = 0; i < FubatJackpotView.JACKPOTS; i++) {
                        if (!this.timeline[i].paused()) {
                            this.timeline[i].pause();
                            this.timeline[i].restart();
                        }
                    }
                    this.timeline[id].play();
                    break;
                case 3:
                    for (var i = 0; i < this.jackPotValues.length; i++) {
                        if (this.jackPotValues[i] != id) {
                            this.fubatGlow[i].getTransform().setVisible(false);
                        }
                    }
                    for (i = 0; i < FubatJackpotView.JACKPOTS; i++) {
                        if (!this.timeline[i].paused() && i != id)
                            this.timeline[i].kill();
                    }
                    this.audioController.playJackpotHit();
                    break;
            }
        };
        FubatJackpotView.prototype.setInputHandler = function (actor, xPos, yPos, handler) {
            var rect = new abg2d.Rect();
            var image = actor.getImage();
            image.getDrawBounds(rect);
            var transform = actor.getTransform();
            var inputResolver = new input.InputResolver(xPos, yPos, image.getDrawWidth(), image.getDrawHeight());
            abg2d.Factory.composeInputRegion(actor, inputResolver, rect, handler);
            this.inputHandler.addResolver(inputResolver);
        };
        FubatJackpotView.prototype.historyReplay = function (flag) {
            this.isHistoryReplay = flag;
            this.generateRandomNumber();
        };
        FubatJackpotView.prototype.showPickedIconByHistoryReplay = function () {
            this.anim(this.randomNum[this.jackpotno]);
        };
        FubatJackpotView.prototype.generateRandomNumber = function () {
            this.randomNum = [];
            var randomNumValue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            while (randomNumValue.length > 0) {
                this.randomNum.push(randomNumValue.splice(Math.round(Math.random() * (randomNumValue.length - 1)), 1)[0]);
            }
        };
        FubatJackpotView.JACKPOTS = 4;
        FubatJackpotView.COIN_START_X = [317, 635, 953, 1271, 317, 635, 953, 1271, 317, 635, 953, 1271];
        FubatJackpotView.COIN_START_Y = [222, 266, 266, 222, 511, 555, 555, 511, 800, 844, 844, 800];
        FubatJackpotView.CONG_SELECTIONS = ['this.congs_1', 'this.congs_2', 'this.congs_3', 'this.congs_4'];
        return FubatJackpotView;
    })();
    exports.FubatJackpotView = FubatJackpotView;
    var BezierPoints = (function () {
        function BezierPoints() {
        }
        return BezierPoints;
    })();
    exports.BezierPoints = BezierPoints;
    /**
     * AutoPlay
     * @class sym.AutoPlayMenu
     * @classdesc Encapsulates the funcationality of the auto play submenu
     */
    var FlyBats = (function () {
        /**
         * @constructor
         */
        function FlyBats(flyBats, scene, scalar, audioController, baseBundle) {
            this.batsAnimate = [];
            this.scatterSymbolLen = 0;
            this.symbolW = 260;
            this.symbolH = 260;
            this.totalBats = 8;
            this.flyBats = flyBats;
            this.scene = scene;
            this.baseBundle = baseBundle;
            this.audioController = audioController;
            this.scalar = scalar;
            this.signal = {
                onComplete: null
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        FlyBats.prototype.getEvents = function () {
            return this.events;
        };
        FlyBats.prototype.flybatsfly = function (scatterpos) {
            var _this = this;
            this.scatterSymbolLen = scatterpos.length;
            var allScatter = scatterpos;
            var leftMargin = 304;
            var topMargin = 262;
            var symbolHW = 260;
            var tempPosx = 0;
            var tempPosy = 0;
            var timedelay = 0;
            this.batsAnimate = [];
            var tl = new TimelineMax({ paused: true, onStart: function () {
                _this.audioController.playBatFlying();
            }, onComplete: function () {
                tl.kill();
            } });
            //vinay
            var angle = 360 / 10;
            for (var i = 0; i < allScatter.length; i++) {
                for (var ii = 0; ii < this.totalBats; ii++) {
                    this.batsAnimate.push(this.createImageAnimate(this.scene, this.scalar, this.baseBundle.flybats, false, null, null, 23));
                    var position = allScatter[i];
                    var reelId = position % 5;
                    var floorId = Math.floor(position / 5);
                    var xpos = leftMargin + symbolHW * reelId + 130;
                    var ypos = topMargin + symbolHW * floorId + 130;
                    var batlen = this.batsAnimate.length - 1;
                    this.playAnimator(this.batsAnimate[batlen], 10);
                    this.batsAnimate[batlen].getTransform().setPosition(xpos, ypos);
                    tempPosx = tempPosx + 100;
                    tempPosy = tempPosy + 100;
                    var batlen = this.batsAnimate.length - 1;
                    var b2point = this.getPoints(xpos, ypos, position);
                    tl.to(this.batsAnimate[batlen].getTransform(), 2, { bezier: {
                        autoRotate: false,
                        values: [
                            { setPositionX: xpos + this.randomRange(100, 150) * (Math.cos(angle * ii)), setPositionY: ypos + this.randomRange(100, 150) * (Math.sin(angle * ii)) },
                            { setPositionX: b2point.x, setPositionY: b2point.y },
                            { setPositionX: EEFConfig.BOWL_POS[0] - 350, setPositionY: EEFConfig.BOWL_POS[1] },
                            { setPositionX: EEFConfig.BOWL_POS[0] + 50, setPositionY: EEFConfig.BOWL_POS[1] + 25 }
                        ],
                        setScaleX: 0,
                        setScaleY: 0,
                        curviness: 1
                    } }, 0 + (0.2 * i));
                    tl.fromTo(this.batsAnimate[batlen].getTransform(), 1, { setScaleX: 1, setScaleY: 1 }, { setScaleX: 0.2, setScaleY: 0.2 }, 1 + (0.2 * i));
                }
            }
            tl.play();
            TweenLite.delayedCall(2, function () {
                _this.stopPlayAnimator();
            });
            this.signal.onComplete();
        };
        FlyBats.prototype.randomRange = function (minNum, maxNum) {
            return (Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum);
        };
        FlyBats.prototype.getPoints = function (xpos, ypos, pos) {
            var pt = new BezierPoints();
            switch (pos) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                    pt.x = xpos;
                    pt.y = ypos - this.symbolH / 2;
                    break;
                case 5:
                case 6:
                    pt.x = xpos - this.randomRange(50, 100);
                    pt.y = ypos - (this.symbolH / 2 + EEFConfig.BOWL_POS[1]);
                    break;
                case 7:
                    pt.x = xpos - this.randomRange(100, 150);
                    pt.y = ypos - (this.symbolH / 2 + EEFConfig.BOWL_POS[1]);
                    break;
                case 8:
                case 9:
                case 10:
                    pt.x = xpos - this.randomRange(50, 100);
                    pt.y = ypos - (this.symbolH / 4 + EEFConfig.BOWL_POS[1]);
                    break;
                case 11:
                case 12:
                case 13:
                case 14:
                    pt.x = xpos - this.randomRange(100, 150);
                    pt.y = ypos - (this.symbolH / 4 + EEFConfig.BOWL_POS[1]);
                    break;
                default:
                    break;
            }
            return pt;
        };
        FlyBats.prototype.createImageAnimate = function (scene, scalar, asset, visible, Xpos, Ypos, Zindex) {
            var actor = abg2d.Factory.composeFramedAnimation(scene, null);
            var image = actor.getImage();
            image.setSpriteSheet(new abg2d.SpriteSheet(asset, scalar));
            var transform = actor.getTransform();
            transform.setPosition(500, 300);
            transform.setVisible(visible);
            transform.setZOrder(Zindex);
            var animator = actor.getFrameAnimator();
            return actor;
        };
        FlyBats.prototype.playAnimator = function (batanim, frames) {
            batanim.getTransform().setVisible(true);
            batanim.getTransform().setZOrder(24);
            //this.batsAnimate.getTransform().setPosition(xpos, ypos);
            batanim.getFrameAnimator().setFramerate(frames);
            batanim.getFrameAnimator().play(-1);
        };
        FlyBats.prototype.stopPlayAnimator = function () {
            for (var jj = 0; jj < this.scatterSymbolLen * this.totalBats; jj++) {
                this.batsAnimate[jj].getFrameAnimator().stop(true, false);
                this.batsAnimate[jj].getFrameAnimator().setFrame(0);
                this.batsAnimate[jj].getTransform().setVisible(false);
            }
            //this.signal.onComplete();
        };
        return FlyBats;
    })();
    exports.FlyBats = FlyBats;
    /**
     * @class eef.FreeSpinData
     * @classdesc Structre to hold free spin data
     */
    var FreeSpinData = (function () {
        /**
         * @constructor
         */
        function FreeSpinData(spinsRemaining, spinsAwarded, totalFSWins, wildMultipliers, isWinCap) {
            this.spinsRemaining = spinsRemaining;
            this.spinsAwarded = spinsAwarded;
            this.totalFSWin = totalFSWins;
            this.wildMultipliers = wildMultipliers;
            this.isWinCap = isWinCap;
            //this.reelIndex = reelIndex; 
            this.bgResult = new gamedata.GamePlayData();
        }
        /**
         * Get number of free spins remaining. Includes retriggered spins.
         * @method eef.FreeSpinData#getSpinsRemaining
         * @public
         * @returns {number} Number of free spins remaining
         */
        FreeSpinData.prototype.getSpinsRemaining = function () {
            return this.spinsRemaining;
        };
        /**
         * Get number of free spins awarded on this spin (in case of retrigger)
         * @method eef.FreeSpinData#getSpinsAwarded
         * @public
         * @returns {number} Number of free spins awarded
         */
        FreeSpinData.prototype.getSpinsAwarded = function () {
            return this.spinsAwarded;
        };
        /**
         * Get total won in free spins
         * @method eef.FreeSpinData#getTotalFSWin
         * @public
         * @returns {number} Current free spin win total
         */
        FreeSpinData.prototype.getTotalFSWin = function () {
            return this.totalFSWin;
        };
        /**
         * Get wild multiplier value on each reel
         * @method eef.FreeSpinData#getWildMultipliers
         * @public
         * @returns {number[]} Wild multiplier values
         */
        FreeSpinData.prototype.getWildMultipliers = function () {
            return this.wildMultipliers;
        };
        /**
         * Get flag indicating if win cap was reached
         * @method eef.FreeSpinData#getIsWinCap
         * @public
         * @returns {boolean} True if win cap reached, false otherwise
         */
        FreeSpinData.prototype.getIsWinCap = function () {
            return this.isWinCap;
        };
        /**
         * Get results for base game spin that triggered this free spin bonus
         * @method eef.FreeSpinData#getBaseGameResult
         * @public
         * @returns {gamedata.GamePlayData} Base game results
         */
        FreeSpinData.prototype.getBaseGameResult = function () {
            return this.bgResult;
        };
        return FreeSpinData;
    })();
    exports.FreeSpinData = FreeSpinData;
    /**
     * @class glscomms.GamePlayDataXMLParser
     * @classdesc XML parser for slot result data
     */
    var EEFGamePlayDataXMLParser = (function () {
        function EEFGamePlayDataXMLParser() {
        }
        /**
         * Helper method for parsing game play data
         * @method gls-comms.GamePlayDataXMLParser#populateGameData
         * @public
         * @param {gamedata.GamePlayData} gameData Data structure to populate
         * @param {Node} node XML node containing game play data
         */
        EEFGamePlayDataXMLParser.populateGameData = function (gameData, node) {
            gameData.setTotalWin(parseInt(node.attributes.getNamedItem("totalWin").value, 10));
            gameData.setWager(parseInt(node.attributes.getNamedItem("stake").value, 10));
            var spinNode = node.childNodes;
            var spinDataSource = spinNode[0].childNodes;
            var node1 = node;
            var dataList = node1.getElementsByTagName("Feature");
            var featurelen = dataList.length;
            for (i = 0; i < featurelen; i++) {
                if (dataList[i].attributes.getNamedItem("index").value == "2") {
                    var scatterwin = dataList[i].childNodes[0].attributes.getNamedItem("jackpotWin").value;
                    var reellist = node1.getElementsByTagName("ReelSpin")[0];
                    var reellist1 = reellist;
                    reellist1.getElementsByTagName("ScatterWin")[0].attributes.getNamedItem("winVal").value = scatterwin;
                }
                else if (dataList[i].attributes.getNamedItem("index").value == "3") {
                    var scatterwin = dataList[i].childNodes[0].attributes.getNamedItem("jackpotWin").value;
                    var reellist = node1.getElementsByTagName("ReelSpin")[0];
                    var reellist1 = reellist;
                    reellist1.getElementsByTagName("ScatterWin")[0].attributes.getNamedItem("winVal").value = scatterwin;
                }
                if (dataList[i].attributes.getNamedItem("index").value == "1") {
                    var triggerWin = dataList[i].childNodes[0].attributes.getNamedItem("freeSpinTriggerWin").value;
                    var reellist = node1.getElementsByTagName("ReelSpin")[0];
                    var reellist1 = reellist;
                    var winLen = reellist1.getElementsByTagName("AnywayWin").length;
                    for (var j = 0; j < winLen; j++) {
                        if ((reellist1.getElementsByTagName("AnywayWin")[j].attributes.getNamedItem("winVal").value == "0")) {
                            reellist1.getElementsByTagName("AnywayWin")[j].attributes.getNamedItem("winVal").value = triggerWin;
                        }
                    }
                }
            }
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
        EEFGamePlayDataXMLParser.populateResults = function (gameData, node) {
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
        EEFGamePlayDataXMLParser.populatePaylineWin = function (gameData, node) {
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
        EEFGamePlayDataXMLParser.populateAnywayWin = function (gameData, node) {
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
        EEFGamePlayDataXMLParser.populateScatterWin = function (gameData, node) {
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
        EEFGamePlayDataXMLParser.extractBoolAttribute = function (attributeName, payAttributes) {
            var value = false;
            var valueAttr = payAttributes.getNamedItem(attributeName);
            if (valueAttr != null) {
                value = (valueAttr.value == "Y");
            }
            return value;
        };
        return EEFGamePlayDataXMLParser;
    })();
    exports.EEFGamePlayDataXMLParser = EEFGamePlayDataXMLParser;
    /**
     * @class eef.EEFPlayResponseXMLParser
     * @classdesc Play response XML parser for Double Buffalo Spirit
     * @extends glscomms.PlayResponseXMLParser
     */
    var EEFPlayResponseXMLParser = (function () {
        function EEFPlayResponseXMLParser() {
        }
        /**
         * Parse XML response for Play request
         * @method eef.EEFPlayResponseXMLParser#parse
         * @public
         * @param {Document} xml XML Payload
         * @returns {glscomms.PlayResponse} Response data for Play request
         */
        EEFPlayResponseXMLParser.prototype.parse = function (xml) {
            //var response: glscomms.PlayResponse = super.parse(xml);
            var platformData = this.parsePlatformData(xml);
            var balanceData = glscomms.BalanceData.parseXML(xml.getElementsByTagName("Balances")[0]);
            var response = new glscomms.PlayResponse(platformData, balanceData);
            EEFGamePlayDataXMLParser.populateGameData(response.getGameData(), xml.getElementsByTagName("GameResult")[0]);
            var gameData = response.getGameData();
            // Parse custom game data
            var fsData = new FreeSpinData(0, 0, 0, [], false);
            var fsList = xml.getElementsByTagName("FS_Info");
            // Extract free spin-specific data
            var BGReelData;
            var reelList = xml.getElementsByTagName("ReelSpin");
            var reelDataSource = reelList[0].attributes;
            var reeldata = reelDataSource.getNamedItem("reelsetIndex").value;
            var featureTag = xml.getElementsByTagName("Feature");
            var customfeatureinfo;
            var featurelen = featureTag.length;
            for (var i = 0; i < featurelen; i++) {
                // if (featureTag.length > 0) {
                var featureTagDataSource = featureTag[i].attributes;
                var featureindex = featureTagDataSource.getNamedItem("index").value; //to get index value; 
                var gameWinTag = xml.getElementsByTagName("GameWinInfo");
                var gameWinTagAttributes = gameWinTag[0].attributes;
                var isWinCap = (gameWinTagAttributes.getNamedItem("isMaxWin").value == "Y");
                if (featureindex === "2") {
                    var featurejackpotInfo = { featureindex: '', featurename: '', pickIndex: '', jackPotWin: '', jackPotAmt: '' };
                    featurejackpotInfo.featureindex = featureTagDataSource.getNamedItem("index").value; //to get index value;
                    featurejackpotInfo.featurename = featureTagDataSource.getNamedItem("name").value;
                    featurejackpotInfo.jackPotWin = featureTag[i].childNodes[0].attributes.getNamedItem("jackpotType").value;
                    featurejackpotInfo.pickIndex = featureTag[i].childNodes[0].childNodes[0].nodeValue;
                    featurejackpotInfo.jackPotAmt = featureTag[i].childNodes[0].attributes.getNamedItem("jackpotWin").value;
                    customfeatureinfo = featurejackpotInfo;
                }
                if (featureindex === "3") {
                    var featurejackpotInfo = { featureindex: '', featurename: '', pickIndex: '', jackPotWin: '', jackPotAmt: '' };
                    featurejackpotInfo.featureindex = featureTagDataSource.getNamedItem("index").value; //to get index value;
                    featurejackpotInfo.featurename = featureTagDataSource.getNamedItem("name").value;
                    featurejackpotInfo.jackPotWin = featureTag[i].childNodes[0].attributes.getNamedItem("jackpotType").value;
                    featurejackpotInfo.pickIndex = featureTag[i].childNodes[0].childNodes[0].nodeValue;
                    featurejackpotInfo.jackPotAmt = featureTag[i].childNodes[0].attributes.getNamedItem("jackpotWin").value;
                    customfeatureinfo = featurejackpotInfo;
                }
                var freeGameinfo;
                if (featureindex === "1") {
                    var customfreeGameinfo = { fSSpinsRemaining: '', isWinCap: '', currentfeaurewins: '' };
                    var fSSpinsRemaining;
                    var currentfeaurewins;
                    var extraSpinsAwarded;
                    if (featureTag[i].childNodes[i].nodeValue != null) {
                        fSSpinsRemaining = parseInt(featureTag[i].childNodes[0].nodeValue);
                    }
                    else {
                        fSSpinsRemaining = parseInt(featureTag[i].childNodes[0].attributes.getNamedItem("remainingFreeSpins").value);
                    }
                    currentfeaurewins = parseInt(featureTag[i].childNodes[0].attributes.getNamedItem("totalFreeSpinsWin").value);
                    extraSpinsAwarded = parseInt(featureTag[i].childNodes[0].attributes.getNamedItem("extraFreeSpinsAwarded").value);
                }
            }
            var resultTag = xml.getElementsByTagName("GameResult");
            var resultTagAttributes = resultTag[0].attributes;
            var creditBet = resultTagAttributes.getNamedItem("creditBet").value;
            var betMultiplier = resultTagAttributes.getNamedItem("betMultiplier").value;
            BGReelData = new EEFBaseGameSpinData(reeldata, customfeatureinfo, creditBet, betMultiplier, isWinCap, fSSpinsRemaining, currentfeaurewins, extraSpinsAwarded);
            // Open bet data, if available
            var payloadNode = xml.getElementsByTagName("Payload")[0];
            if (payloadNode != null) {
                BGReelData.setOpenBetPayLoadInfo(this.populateOpenBetPayLoad(gameData, payloadNode));
            }
            response.getGameData().setCustomData(BGReelData);
            var bgResultData = xml.getElementsByTagName("BaseGameRecoveryInfo");
            var bgInfoData = xml.getElementsByTagName("GameWinInfo");
            if (bgResultData.length > 0) {
                // There will only be one base game result for 88 fortunes
                var baseGamewin = parseInt(bgResultData[0].childNodes[0].attributes.getNamedItem("totalWin").value);
                var freeGamewin = BGReelData.totalFSWin;
                var totalWin = bgInfoData[0].attributes.getNamedItem("totalWagerWin").value.toString();
                bgResultData[0].childNodes[0].attributes.getNamedItem("totalWin").value = totalWin;
                glscomms.GamePlayDataXMLParser.populateGameData(BGReelData.getBaseGameResult(), bgResultData[0].childNodes[0]);
            }
            // Extract base game results
            return response;
        };
        EEFPlayResponseXMLParser.prototype.parsePlatformData = function (xml) {
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
                 * Open Bet PayLoads
                 * Helper method for parsing Open Bet configuration
                 * @method gls-comms.InitResponseXMLParser#populateOpenBetPayLoad
                 * @private
                 * @param {gamedata.GameInitData} gameData Data structure to populate
                 * @param {Node} node XML node containing open bet configuration data
                 */
        EEFPlayResponseXMLParser.prototype.populateOpenBetPayLoad = function (gameData, node) {
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
        EEFPlayResponseXMLParser.prototype.getOpenBetValueByName = function (mapItem, requestType) {
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
                    if (mapItem.childNodes[i].nodeName == "value") {
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
        return EEFPlayResponseXMLParser;
    })();
    exports.EEFPlayResponseXMLParser = EEFPlayResponseXMLParser;
    var EEFBaseGameSpinData = (function () {
        function EEFBaseGameSpinData(reelIndex, fuBat, creditbet, betMultiplier, isWinCap, spinsRemaining, totalFSWins, spinsAwarded) {
            this.reelIndex = reelIndex;
            this.fuBatInfo = fuBat;
            this.creditbet = creditbet;
            this.betMultiplier = betMultiplier;
            this.spinsRemaining = spinsRemaining;
            this.totalFSWin = totalFSWins;
            this.isWinCap = isWinCap;
            this.spinsAwarded = spinsAwarded;
            this.bgResult = new gamedata.GamePlayData();
        }
        EEFBaseGameSpinData.prototype.getSpinsRemaining = function () {
            return this.spinsRemaining;
        };
        EEFBaseGameSpinData.prototype.getBaseGameResult = function () {
            return this.bgResult;
        };
        EEFBaseGameSpinData.prototype.getTotalFSWin = function () {
            return this.totalFSWin;
        };
        EEFBaseGameSpinData.prototype.getIsWinCap = function () {
            return this.isWinCap;
        };
        EEFBaseGameSpinData.prototype.getSpinsAwarded = function () {
            return this.spinsAwarded;
        };
        /**
             * storing the Open Bet information
             * @method eef.LTBaseGameSpinData#setOpenBetPayLoadInfo
             * @public
             * @param {Object} open bet Payload
             */
        EEFBaseGameSpinData.prototype.setOpenBetPayLoadInfo = function (data) {
            this.openBetInfo = data;
        };
        /**
             * The Open Bet information
             * @method eef.LTBaseGameSpinData#getOpenBetPayLoadInfo
             * @public
             * @returns {glscomms.PlatformPlayData} returning the Open bet data.
             */
        EEFBaseGameSpinData.prototype.getOpenBetPayLoadInfo = function () {
            return this.openBetInfo;
        };
        return EEFBaseGameSpinData;
    })();
    exports.EEFBaseGameSpinData = EEFBaseGameSpinData;
    /* Wager payload for Play requests
    * @class gls-comms.WagerPayload
    * @classdesc Standard wager payload
    */
    var EEFWagerPayload = (function () {
        /**
         * @constructor
         */
        function EEFWagerPayload(unitsBet, betPerUnit, betMultiplier) {
            this.unitsBet = unitsBet;
            this.betPerUnit = betPerUnit;
            this.betMultiplier = betMultiplier;
        }
        /**
         * Convert custom payload data into XML
         * @method gls-comms.WagerPayload#toXML
         * @returns {Document} XML formatted data
         */
        EEFWagerPayload.prototype.toXML = function () {
            var xmlDoc = document.implementation.createDocument("", "SpinInfo", null);
            var totalStakePerLineAttr = xmlDoc.createAttribute("creditBet");
            totalStakePerLineAttr.value = (this.betPerUnit).toString();
            xmlDoc.documentElement.attributes.setNamedItem(totalStakePerLineAttr);
            var gameModeAttr = xmlDoc.createAttribute("betMultiplier");
            gameModeAttr.value = this.betMultiplier;
            xmlDoc.documentElement.attributes.setNamedItem(gameModeAttr);
            return xmlDoc;
        };
        return EEFWagerPayload;
    })();
    exports.EEFWagerPayload = EEFWagerPayload;
    (function (WinType) {
        WinType[WinType["SCATTER"] = 0] = "SCATTER";
        WinType[WinType["LINE"] = 1] = "LINE";
        WinType[WinType["ANYWAY"] = 2] = "ANYWAY";
    })(exports.WinType || (exports.WinType = {}));
    var WinType = exports.WinType;
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
     * @class eef.EEFResponseXMLParserFactory
     * @classdesc Double Buffalo Spirit XML parser factory
     */
    var EEFResponseXMLParserFactory = (function (_super) {
        __extends(EEFResponseXMLParserFactory, _super);
        function EEFResponseXMLParserFactory() {
            _super.apply(this, arguments);
        }
        /**
         * Construct DBS-specific play response parser
         * @method eef.EEFResponseXMLParserFactory#createPlayParser
         * @public
         * @returns {glscomms.IResponseXMLParser<glscomms.PlayResponse} Response XML parser
         */
        EEFResponseXMLParserFactory.prototype.createInitParser = function () {
            this.initparser = new EEFInitResponseXMLParser;
            return this.initparser;
        };
        /**
         * Construct EEF-specific play response parser
         * @method eef.EEFResponseXMLParserFactory#createPlayParser
         * @public
         * @returns {glscomms.IResponseXMLParser<glscomms.PlayResponse} Response XML parser
         */
        EEFResponseXMLParserFactory.prototype.createPlayParser = function () {
            return new EEFPlayResponseXMLParser;
        };
        EEFResponseXMLParserFactory.prototype.getInitParser = function () {
            return this.initparser;
        };
        return EEFResponseXMLParserFactory;
    })(glscomms.ResponseXMLParserFactory);
    exports.EEFResponseXMLParserFactory = EEFResponseXMLParserFactory;
    var BetConfiguration = (function (_super) {
        __extends(BetConfiguration, _super);
        function BetConfiguration() {
            _super.apply(this, arguments);
            this.multiplierBets = [1];
            this.defaultMultiplierIndex = 0;
            this.spinT = 3;
        }
        /**
         * Set collection of available bets
         * @method game-data.BetConfiguration#setAvailableBets
         * @public
         * @param {number[]} bets Collection of available bets
         */
        BetConfiguration.prototype.setMultiplierBets = function (currencyMultiplier) {
            var bets = [1, 2, 3, 6, 10, 20, 30, 60, 100];
            for (var i = 0; i < bets.length; i++) {
                bets[i] = bets[i] * currencyMultiplier;
            }
            this.multiplierBets = bets;
        };
        /**
         * Get all available bets
         * @method game-data.BetConfiguration#getAvailableBets
         * @public
         * @returns {number[]} Collection of available bets
         */
        BetConfiguration.prototype.getMultiplierBets = function () {
            return this.multiplierBets;
        };
        BetConfiguration.prototype.setDefaultMultiplierIndex = function (index) {
            this.defaultMultiplierIndex = index;
        };
        BetConfiguration.prototype.getDefaultMultiplierIndex = function () {
            return this.defaultMultiplierIndex;
        };
        BetConfiguration.prototype.setSpinT = function (value) {
            this.spinT = value;
        };
        BetConfiguration.prototype.getSpinT = function () {
            return this.spinT;
        };
        return BetConfiguration;
    })(gamedata.BetConfiguration);
    exports.BetConfiguration = BetConfiguration;
    /**
     * Custom payload for gaffing the reels (force)
     * @class gls-comms.GaffPayload
     * @classdesc Payload for gaff positions
     */
    var GaffPayload = (function () {
        /**
         * @constructor
         */
        function GaffPayload(stopPositions, reelSetIndex, gameMode, scatterpattern) {
            if (gameMode === void 0) { gameMode = 0; }
            if (scatterpattern === void 0) { scatterpattern = -1; }
            this.stopPositions = stopPositions;
            this.reelSetIndex = reelSetIndex;
            this.gameMode = gameMode.toString();
            this.scatterpattern = scatterpattern;
        }
        /**
         * Convert custom payload data into XML
         * @method gls-comms.GaffPayload#toXML
         * @returns {Document} XML formatted data
         */
        GaffPayload.prototype.toXML = function () {
            var xmlDoc;
            switch (this.gameMode) {
                case "0":
                    xmlDoc = this.normalGaff();
                    break;
                case "1":
                    xmlDoc = this.mysteryStackGaff();
                    break;
                case "2":
                    xmlDoc = this.mysteryJackpotGaff();
                    break;
            }
            return xmlDoc;
        };
        GaffPayload.prototype.normalGaff = function () {
            var xmlDoc = document.implementation.createDocument("", "FORCE", null);
            var spinElement = xmlDoc.createElement("ReelSpin");
            var reelsetAttr = xmlDoc.createAttribute("reelsetIndex");
            reelsetAttr.value = this.reelSetIndex.toString();
            spinElement.attributes.setNamedItem(reelsetAttr);
            var stopsAttr = xmlDoc.createAttribute("stopIndices");
            stopsAttr.value = this.stopPositions.join('|');
            spinElement.attributes.setNamedItem(stopsAttr);
            xmlDoc.documentElement.appendChild(spinElement);
            var jackpot = prompt("Please jackpot type", "-1");
            {
                if (jackpot != "-1") {
                    var featureInfoElement = xmlDoc.createElement("Jackpot");
                    var stackedPatternAttr = xmlDoc.createAttribute("type");
                    stackedPatternAttr.value = jackpot;
                    featureInfoElement.attributes.setNamedItem(stackedPatternAttr);
                    xmlDoc.documentElement.appendChild(featureInfoElement);
                }
            }
            return xmlDoc;
        };
        GaffPayload.prototype.mysteryStackGaff = function () {
            var xmlDoc = document.implementation.createDocument("", "FORCE", null);
            var spinElement = xmlDoc.createElement("ReelSpin");
            var stopsAttr = xmlDoc.createAttribute("stopIndices");
            stopsAttr.value = this.stopPositions.join('|');
            spinElement.attributes.setNamedItem(stopsAttr);
            var featureInfoElement = xmlDoc.createElement("FeatureInfo");
            var featureAwardAttr = xmlDoc.createAttribute("featureAward");
            featureAwardAttr.value = "3";
            featureInfoElement.attributes.setNamedItem(featureAwardAttr);
            var stackedPatternAttr = xmlDoc.createAttribute("stackedPattern");
            stackedPatternAttr.value = this.scatterpattern.toString();
            featureInfoElement.attributes.setNamedItem(stackedPatternAttr);
            xmlDoc.documentElement.appendChild(spinElement);
            xmlDoc.documentElement.appendChild(featureInfoElement);
            return xmlDoc;
        };
        GaffPayload.prototype.mysteryJackpotGaff = function () {
            var xmlDoc = document.implementation.createDocument("", "FORCE", null);
            var spinElement = xmlDoc.createElement("ReelSpin");
            var stopsAttr = xmlDoc.createAttribute("stopIndices");
            stopsAttr.value = this.stopPositions.join('|');
            spinElement.attributes.setNamedItem(stopsAttr);
            //for mystery jackpot
            var reelsetIndexAttr = xmlDoc.createAttribute("reelsetIndex");
            reelsetIndexAttr.value = "0";
            spinElement.attributes.setNamedItem(reelsetIndexAttr);
            //end
            var featureInfoElement = xmlDoc.createElement("Jackpot");
            /*var featureAwardAttr: Attr = document.createAttribute("featureAward");
            featureAwardAttr.value = "1";
            featureInfoElement.attributes.setNamedItem(featureAwardAttr);*/
            if (this.scatterpattern == 0) {
                var stackedPatternAttr = xmlDoc.createAttribute("type");
                //stackedPatternAttr.value = this.scatterpattern.toString();
                stackedPatternAttr.value = (Math.round(Math.random() * 3)).toString();
                featureInfoElement.attributes.setNamedItem(stackedPatternAttr);
            }
            xmlDoc.documentElement.appendChild(spinElement);
            xmlDoc.documentElement.appendChild(featureInfoElement);
            return xmlDoc;
        };
        return GaffPayload;
    })();
    exports.GaffPayload = GaffPayload;
    /// <reference path="../EEFConfig.ts" />
    /**
     * @class InitResponseXMLParser
     * @classdesc XML parser for GLS InitResponse payload
     */
    var EEFInitResponseXMLParser = (function () {
        function EEFInitResponseXMLParser() {
            /**
             * Parse GLS InitResponse XML payload
             * @method gls-comms.InitResponseXMLParser#parse
             * @public
             * @param {Document} xml XML Document containing GLS InitResponse payload
             * @returns {InitResponse} InitResponse data structure
             */
            this.currencyMultiplier = 1;
        }
        EEFInitResponseXMLParser.prototype.parse = function (xml) {
            var platformData = this.parsePlatformData(xml);
            var balanceData = glscomms.BalanceData.parseXML(xml.getElementsByTagName("Balances")[0]);
            var response = new glscomms.InitResponse(platformData, balanceData);
            // Populate standard initialization data
            var gameData = response.getGameData();
            this.populatePaylineData(gameData, xml.getElementsByTagName("PaylineInfo")[0]);
            this.populateAwardsData(gameData, xml.getElementsByTagName("AwardsInfo")[0]);
            this.populateReelGroupData(gameData, xml.getElementsByTagName("ReelInfo")[0]);
            this.populateBetConfiguration(gameData, xml.getElementsByTagName("CreditBets")[0], xml.getElementsByTagName("BetMultipliers")[0], xml.getElementsByTagName("BetConfiguration")[0]);
            // Retrieve RTP, if available
            var gameConstsNode = xml.getElementsByTagName("GameConsts");
            var openBetPayLoad;
            // Open bet data, if available
            var payloadNode = xml.getElementsByTagName("Payload")[0];
            if (payloadNode != null) {
                var BGReelData = new EEFBaseGameSpinData("0", "0", "0", "0", false, 0, 0, 0);
                // Open bet data, if available
                var payloadNode = xml.getElementsByTagName("Payload")[0];
                if (payloadNode != null) {
                    BGReelData.setOpenBetPayLoadInfo(this.populateOpenBetPayLoad(gameData, payloadNode));
                }
                openBetPayLoad = this.populateOpenBetPayLoad(gameData, payloadNode);
                response.getGameData().setCustomData(BGReelData);
            }
            return response;
        };
        /**
             * Open Bet PayLoads
             * Helper method for parsing Open Bet configuration
             * @method gls-comms.InitResponseXMLParser#populateOpenBetPayLoad
             * @private
             * @param {gamedata.GameInitData} gameData Data structure to populate
             * @param {Node} node XML node containing open bet configuration data
             */
        EEFInitResponseXMLParser.prototype.populateOpenBetPayLoad = function (gameData, node) {
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
        EEFInitResponseXMLParser.prototype.getOpenBetValueByName = function (mapItem, requestType) {
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
                    if (mapItem.childNodes[i].nodeName == "value") {
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
        /**
         * Parse GLS platform data
         * @method gls-comms.InitResponseXMLParser#parsePlatformData
         * @public
         * @param {Document} xml XML Document containing GLS InitResponse payload
         * @returns {PlatformInitData} Platform data
         */
        EEFInitResponseXMLParser.prototype.parsePlatformData = function (xml) {
            var data = new glscomms.PlatformInitData();
            var glsHeader = glscomms.GLSResponseHeader.parseXML(xml.getElementsByTagName("Header")[0]);
            data.setSessionId(glsHeader.getSessionId());
            data.setGameId(glsHeader.getGameId());
            data.setLanguageCode(glsHeader.getLanguageCode());
            data.setVersion(glsHeader.getVersion());
            data.setIsRecovering(glsHeader.isRecovering());
            data.setCurrencyFormat(glscomms.CurrencyFormatXMLParser.parse(xml.getElementsByTagName("CurrencyInformation")[0]));
            var headerAttributes = xml.getElementsByTagName("Header")[0].attributes;
            EEFConfig.SERVER_VERSION = headerAttributes.getNamedItem("fullVersionID").value;
            var currencyMultiplierNode = xml.getElementsByTagName("CurrencyMultiplier")[0];
            if (currencyMultiplierNode != null) {
                this.currencyMultiplier = parseInt(currencyMultiplierNode.textContent, 10);
                data.setCurrencyMultiplier(this.currencyMultiplier);
            }
            var minBetNode = xml.getElementsByTagName("MinBet")[0];
            if (minBetNode != null) {
                data.setMinBet(parseInt(minBetNode.textContent, 10) * data.getCurrencyMultiplier());
            }
            var maxBetNode = xml.getElementsByTagName("MaxBet")[0];
            if (maxBetNode != null) {
                data.setMaxBet(parseInt(maxBetNode.textContent, 10) * data.getCurrencyMultiplier());
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
        EEFInitResponseXMLParser.prototype.populateBetConfiguration = function (gameData, node, node1, node2) {
            var config = new BetConfiguration();
            if (node != null) {
                var attributes = node.attributes;
                config.setDefaultIndex(parseInt(attributes.getNamedItem("defaultIndex").value, 10));
                config.setAvailableBets(node.textContent.split("|").map(Number));
            }
            if (node1 != null) {
                var attributes1 = node1.attributes;
                //config.setDefaultIndex(parseInt(attributes.getNamedItem("defaultIndex").value, 10));
                config.setDefaultMultiplierIndex(parseInt(attributes1.getNamedItem("defaultIndex").value, 10));
                config.setMultiplierBets(this.currencyMultiplier);
            }
            if (node2) {
                var childNode = node2.childNodes;
                for (var i = 0; i < childNode.length; i++) {
                    if (childNode[i].nodeName == "blob") {
                        var clildNode1 = childNode[i].childNodes;
                        if (clildNode1) {
                            for (var j = 0; j < clildNode1.length; j++) {
                                if (clildNode1[j].nodeName == "SpinT") {
                                    var spinT = +clildNode1[j].childNodes[0].nodeValue;
                                    config.setSpinT(spinT);
                                }
                            }
                        }
                    }
                }
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
        EEFInitResponseXMLParser.prototype.populateAwardsData = function (gameData, node) {
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
        EEFInitResponseXMLParser.prototype.populatePaylineData = function (gameData, node) {
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
        EEFInitResponseXMLParser.prototype.populateReelGroupData = function (gameData, node) {
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
        return EEFInitResponseXMLParser;
    })();
    exports.EEFInitResponseXMLParser = EEFInitResponseXMLParser;
    /**
     * @class SYM.GameLaunchView
     * @classdesc View control for GameLaunch Screen
     */
    var GameLaunchView = (function () {
        function GameLaunchView(scene, scalar, baseBundle, inputHandler, translator, audioController) {
            var _this = this;
            this.audioController = audioController;
            //this.createDrakBackGround(scene, scalar, baseBundle, width, height);
            this.createGameLaunchScreen(scene, scalar, baseBundle, inputHandler, translator);
            //this.createText(scene, scalar, baseBundle, translator);
            this.createPlayButton(scene, scalar, baseBundle, inputHandler, translator, audioController);
            this.PlayButton.getEvents().add({
                onClick: function (x, y) {
                    console.log("Game Play view clicked");
                    _this.onPlayClick();
                },
                onClickEnd: function () {
                }
            });
            this.signal = {
                onPlay: function () {
                }
            };
            this.events = new events.EventDispatcher(this.signal);
        }
        /**
         * Creates the Game Launch Screen  for the game
         * @method sym.GameLaunchView#createGameLaunchScreen
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} background The background image
         */
        GameLaunchView.prototype.createGameLaunchScreen = function (scene, scalar, baseBundle, inputHandler, translator) {
            this.launchScreenActor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(baseBundle.LandingScreen, scalar));
            var image = this.launchScreenActor.getImage();
            image.setAlign(6 /* Center */);
            this.launchScreenActor.getTransform().setPosition(image.getWidth() / 2, image.getHeight() / 2);
            this.launchScreenActor.getTransform().setZOrder(1004);
            this.playTextActor = this.createText("playTextActor", scene, scalar, baseBundle.myriadProSemiBold, this.launchScreenActor, translator.findByKey("loadingpage_txt1"), [290, 435], 350, 50);
            this.fiveTextActor = this.createText("fiveTextActor", scene, scalar, baseBundle.myriadProSemiBold, this.launchScreenActor, "5", [232, 540], 200);
            this.goldTextActor = this.createText("goldTextActor", scene, scalar, baseBundle.myriadProSemiBold, this.launchScreenActor, translator.findByKey("Gold_txt"), [316, 513], 400, 30);
            this.symbolsTextActor = this.createText("symbolsTextActor", scene, scalar, baseBundle.myriadProSemiBold, this.launchScreenActor, translator.findByKey("Symbols_txt"), [316, 543], 400, 20);
            this.creditsTextActor = this.createText("creditsTextActor", scene, scalar, baseBundle.myriadProSemiBold, this.launchScreenActor, "(88 " + translator.findByKey("Credits_txt") + " )", [316, 570], 400, 20);
            this.winTextActor = this.createText("winTextActor", scene, scalar, baseBundle.myriadProSemiBold, this.launchScreenActor, translator.findByKey("loadingscreen_txt2"), [1635, 325], 400, 100);
            this.oneF4TextActor = this.createText("oneF4TextActor", scene, scalar, baseBundle.myriadProSemiBold, this.launchScreenActor, translator.findByKey("loadingscreen_txt3"), [1635, 415], 400, 50);
        };
        /**
         * Creates the GameLaunch Play Button for the game
         * @method sym.GameLaunchView#createPlayButton
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} background The background image
         */
        GameLaunchView.prototype.createPlayButton = function (scene, scalar, baseBundle, inputHandler, translator, audioController) {
            var launchPlayActorImage = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(baseBundle.helpexit, scalar));
            var image = launchPlayActorImage.getImage();
            launchPlayActorImage.getTransform().setPosition(720, 950);
            launchPlayActorImage.getTransform().setZOrder(1005);
            var alignment = 6 /* Center */;
            var textActor = abg2d.Factory.composeText(scene, launchPlayActorImage);
            var text = textActor.getText();
            text.setAlign(alignment);
            textActor.getTransform().setPosition(240, 120);
            text.setText(translator.findByKey('Continue_txt'));
            text.setScalar(scalar);
            text.setFont("40px" + " " + baseBundle.myriadProSemiBold.getFontName());
            text.setLineHeight(1.25);
            abg2d.TextFactory.createFillText(text, "#ffe63c");
            textActor.getText().setVisible(true);
            this.PlayButton = new Button(launchPlayActorImage, null, scalar, inputHandler);
            this.tweenActor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(baseBundle.continuehighlight, scalar));
            this.tweenActor.getTransform().setPosition(720, 950);
            this.tweenActor.getTransform().setVisible(true);
            this.tweenActor.getTransform().setZOrder(1005);
            this.tween = TweenMax.fromTo(this.tweenActor.getImage(), 0.5, { setOpacity: 1 }, { setOpacity: 0.2, ease: Sine.easeInOut, repeat: -1, yoyo: true });
        };
        /**
         * Creates the GameLaunch Play Button for the game
         * @method sym.GameLaunchView#createPlayButton
         * @private static
         * @param {boolean} set visiblity of the actor
         */
        GameLaunchView.prototype.setVisible = function (visible) {
            this.PlayButton.setVisible(visible);
            this.launchScreenActor.getImage().setVisible(visible);
            this.launchScreenActor.getTransform().setVisible(visible);
            this.tweenActor.getTransform().setVisible(visible);
        };
        /**
         * Event
         * @method sym.GameLaunchView#onPlayClick
         */
        GameLaunchView.prototype.onPlayClick = function () {
            this.tween.kill();
            this.tweenActor.getTransform().setVisible(false);
            this.signal.onPlay();
            //this.audioController.playBtnClickSound();
            this.setVisible(false);
        };
        /**
         * Creating get the Events
         * @method sym.BigBetView#getEvents
         * @Public static
         * @returns {Events} Events
         */
        GameLaunchView.prototype.getEvents = function () {
            return this.events;
        };
        GameLaunchView.prototype.createText = function (name, scene, scalar, font, parent, key, pos, maxWidth, size, lineht, color) {
            if (size === void 0) { size = 45; }
            if (lineht === void 0) { lineht = 1.3; }
            if (color === void 0) { color = "#FFFFFF"; }
            var actor = abg2d.Factory.composeText(scene, parent);
            var text = actor.getText();
            text.setLineHeight(lineht);
            text.setAlign(6 /* Center */);
            text.setScalar(scalar);
            text.setMaxLineWidth(maxWidth);
            text.setFont(size + "px " + font.getFontName());
            text.setText(key);
            actor.getTransform().setPosition(pos[0], pos[1]);
            actor.getTransform().setZOrder(EEFConfig.LAUNCH_Z + 10);
            switch (name) {
                case ("goldTextActor"):
                case ("symbolsTextActor"):
                case ("creditsTextActor"):
                    color = "#660000";
                    abg2d.TextFactory.createFillText(text, color);
                    break;
                case ("playTextActor"):
                    color = "#ffe63c";
                    abg2d.TextFactory.createFillText(text, color);
                    if (key.length > 55)
                        text.setFont("30px " + font.getFontName());
                    else if (key.length > 42)
                        text.setFont("38px " + font.getFontName());
                    break;
                case ("winTextActor"):
                case ("oneF4TextActor"):
                    color = "#ffe63c";
                    abg2d.TextFactory.createFillText(text, color);
                    if (key.length > 13)
                        text.setFont("38px " + font.getFontName());
                    break;
                    break;
                case ("fiveTextActor"):
                    color = "#FFFFFF";
                    abg2d.TextFactory.createFillText(text, color);
                    var strokeEffect = new abg2d.SolidStrokeEffect("#3b0c0f", 2);
                    text.addEffect(strokeEffect);
                    break;
                default:
                    abg2d.TextFactory.createFillText(text, color);
            }
            return actor;
        };
        return GameLaunchView;
    })();
    exports.GameLaunchView = GameLaunchView;
    /**
     * Win Stack Factory
     * @class eef.WinStackFactory
     * @classdesc Handles the creation of assets that make up the win stack
     */
    var WinStackFactory = (function () {
        function WinStackFactory() {
        }
        /**
         * Creates the win stack
         * @method eef.WinStackFactory#createWinStack
         * @public static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {number} baseBundle Image assets
         * @param {number} xPos x position for parent panel
         * @param {number} translator Translator
         * @param {number} currencyFormatter Currency formatter
         * @returns {winstack.WinStack} The created winstack
         */
        WinStackFactory.createWinStack = function (scene, scalar, baseBundle, xPos, translator, currencyFormatter) {
            var panel = WinStackFactory.createPanel(scene, scalar, baseBundle.winstack, xPos);
            var logo = WinStackFactory.createLogo(scene, scalar, baseBundle.logo, panel, [961, 140]);
            if (UIFactory.scalar == 1) {
                var fglogo = WinStackFactory.createLogo1(scene, scalar, baseBundle.gameLogo, [750, 0]);
            }
            else {
                var fglogo = WinStackFactory.createLogo1(scene, scalar, baseBundle.gameLogo, [5, -10]);
            }
            var symbolActors = WinStackFactory.createSymbolActors(scene, panel, new abg2d.SpriteSheet(baseBundle.symbols, scalar));
            var payBoxes = WinStackFactory.createPayBoxes(scene, panel, scalar);
            var touchToStart = WinStackFactory.createTouchToStart(scene, panel, scalar, translator, baseBundle.myriadProSemiBold.getFontName());
            var textLayout = WinStackFactory.createTextLayout(scene, panel, scalar, translator, currencyFormatter, baseBundle.myriadProSemiBold.getFontName());
            var creationData = {
                panel: panel,
                logo: logo,
                symbols: symbolActors,
                payBoxes: payBoxes,
                clickToStartText: touchToStart,
                symbolMap: SlotFactory.SYMBOL_MAP,
                textLayout: textLayout,
                fglogo: fglogo
            };
            return new WinStack(creationData);
        };
        /**
         * Creates the Win Stack text layout
         * @method eef.WinStackFactory#createTextLayout
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {number} translator Translator
         * @param {number} currencyFormatter Currency formatter
         * @param {string} fontName The name of the font
         * @returns {abg2d.Actor} The created actor
         */
        WinStackFactory.createTextLayout = function (scene, parent, scalar, translator, currencyFormatter, fontName) {
            var line = WinStackFactory.createLineText(scene, parent, scalar, translator, fontName);
            var pays = WinStackFactory.createPaysText(scene, parent, scalar, fontName);
            var multiplier = WinStackFactory.createMultiplierText(scene, parent, scalar, fontName);
            var gradient = WinStackFactory.createGradientText(scene, parent, scalar, translator, fontName);
            var gradient1 = WinStackFactory.createGradientText1(scene, parent, scalar, translator, fontName);
            var ways = WinStackFactory.createWaysText(scene, parent, scalar, fontName);
            return new WinStackAnywayTextLayout(line, pays, multiplier, gradient, gradient1, ways, translator, currencyFormatter);
        };
        /**
         * Creates the touch to start text
         * @method eef.WinStackFactory#createTouchToStart
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {string} fontName The name of the font
         * @returns {abg2d.Actor} The created actor
         */
        WinStackFactory.createTouchToStart = function (scene, parent, scalar, translator, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var image = parent.getImage();
            var text = actor.getText();
            text.setAlign(6 /* Center */);
            text.setFont("60px " + fontName);
            text.setScalar(scalar);
            text.setMaxLineWidth(image.getWidth());
            text.setText(" " + translator.findByKey("com.williamsinteractive.mobile.mobile.TOUCH_TO_START") + " ");
            abg2d.TextFactory.createFillText(text, "#254ABA");
            var xfm = actor.getTransform();
            xfm.setZOrder(EEFConfig.WINSTACK_Z - 5);
            xfm.setPosition(image.getWidth() / 2, WinStackFactory.TOUCH_TO_START_Y);
            xfm.setVisible(false);
            return actor;
        };
        /**
         * Create the gradient text
         * @method eef.WinStackFactory#createGradientText
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {locale.Translator} translator The translator
         * @param {string} fontName The name of the font
         * @returns {abg2d.Actor} The created actor
         */
        WinStackFactory.createGradientText = function (scene, parent, scalar, translator, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var image = parent.getImage();
            var text = actor.getText();
            text.setAlign(0 /* TopLeft */);
            text.setFont("45px " + fontName);
            text.setScalar(scalar);
            text.setMaxLineWidth(290);
            text.setLineHeight(1);
            var colorStops = [
                "#b2a400",
                "#fffef2",
                "#ffbf00",
                "#a65300",
                "#ffffff",
                "#ffd659",
                "#ff9500"
            ];
            text.addEffect(new abg2d.SolidStrokeEffect("#000000", 10));
            text.addEffect(new abg2d.SolidStrokeEffect("#ff0000", 4));
            abg2d.TextFactory.createFillText(text, "yellow");
            var xfm = actor.getTransform();
            xfm.setZOrder(EEFConfig.WINSTACK_Z - 5);
            //xfm.setPosition(image.getWidth() / 2, WinStackFactory.HEADLINE_Y);
            xfm.setPosition(25, 35);
            xfm.setVisible(false);
            return actor;
        };
        WinStackFactory.createGradientText1 = function (scene, parent, scalar, translator, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var image = parent.getImage();
            var text = actor.getText();
            text.setAlign(6 /* Center */);
            text.setFont("120px " + fontName);
            text.setScalar(scalar);
            text.setMaxLineWidth(image.getWidth());
            text.setLineHeight(50);
            var colorStops = [
                "#b2a400",
                "#fffef2",
                "#ffbf00",
                "#a65300",
                "#ffffff",
                "#ffd659",
                "#ff9500"
            ];
            text.addEffect(new abg2d.SolidStrokeEffect("#000000", 10));
            text.addEffect(new abg2d.SolidStrokeEffect("#ff0000", 4));
            abg2d.TextFactory.createFillText(text, "yellow");
            var xfm = actor.getTransform();
            xfm.setZOrder(EEFConfig.WINSTACK_Z - 5);
            xfm.setPosition(image.getWidth() / 2 + 330, WinStackFactory.HEADLINE_Y - 25);
            xfm.setVisible(false);
            return actor;
        };
        /**
         * Create the pay boxes
         * @method eef.WinStackFactory#createPayBoxes
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @returns {Array<Array<abg2d.Actor>>} The 2d array of payboxes
         */
        WinStackFactory.createPayBoxes = function (scene, parent, scalar) {
            var masterList = new Array();
            var parentBox = parent.getBox();
            for (var i = 0; i < 5; i++) {
                var actors = [];
                for (var actorId = 0; actorId < 3; actorId++) {
                    var actor = abg2d.Factory.composeBox(scene, parent);
                    var box = actor.getBox();
                    box.setWidth(WinStackFactory.PAY_BOX_SIZE);
                    box.setHeight(WinStackFactory.PAY_BOX_SIZE);
                    box.setColor("white");
                    var posX = WinStackFactory.PAY_BOX_START_POS[0] + ((WinStackFactory.PAY_BOX_SIZE + 3) * i);
                    var posY = WinStackFactory.PAY_BOX_START_POS[1] + ((WinStackFactory.PAY_BOX_SIZE + 3) * actorId);
                    var xfm = actor.getTransform();
                    xfm.setPosition(posX, posY);
                    xfm.setVisible(false);
                    actors.push(actor);
                }
                masterList.push(actors);
            }
            return masterList;
        };
        /**
         * Create the line text
         * @method eef.WinStackFactory#createLineText
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {locale.Translator} translator The translator
         * @param {string} fontName The name of the font
         * @returns {abg2d.Actor} The created actor
         */
        WinStackFactory.createLineText = function (scene, parent, scalar, translator, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var image = parent.getImage();
            var text = actor.getText();
            text.setAlign(6 /* Center */);
            text.setFont("18px " + fontName);
            text.setScalar(scalar);
            text.setMaxLineWidth(image.getWidth());
            text.setText(translator.findByKey("AnyWayPay_txt"));
            abg2d.TextFactory.createOutlineText(text, "white", "black", 10);
            var xfm = actor.getTransform();
            xfm.setPosition(WinStackFactory.PAY_BOX_START_POS[0] + 80, WinStackFactory.PAY_BOX_START_POS[1] - 15);
            xfm.setZOrder(EEFConfig.WINSTACK_Z - 5);
            xfm.setVisible(false);
            return actor;
        };
        /**
         * Create the multiplier text
         * @method eef.WinStackFactory#createMultiplierText
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {string} fontName The name of the font
         * @returns {abg2d.Actor} The created actor
         */
        WinStackFactory.createMultiplierText = function (scene, parent, scalar, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var parentImage = parent.getImage();
            var text = actor.getText();
            text.setAlign(6 /* Center */);
            text.setFont("40px " + fontName);
            text.setScalar(scalar);
            abg2d.TextFactory.createFillText(text, "white");
            var xfm = actor.getTransform();
            xfm.setPosition(parentImage.getWidth() - 170, parentImage.getHeight() / 2 + 55);
            xfm.setVisible(false);
            return actor;
        };
        /**
         * Create the pays text
         * @method eef.WinStackFactory#createPaysText
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {string} fontName The name of the font
         * @returns {abg2d.Actor} The created actor
         */
        WinStackFactory.createPaysText = function (scene, parent, scalar, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var parentImage = parent.getImage();
            var text = actor.getText();
            text.setAlign(6 /* Center */);
            text.setFont("26px " + fontName);
            text.setMaxLineWidth(400);
            text.setScalar(scalar);
            abg2d.TextFactory.createFillText(text, "white");
            var xfm = actor.getTransform();
            xfm.setPosition(parentImage.getWidth() / 2 + WinStackFactory.PAYS_TEXT_POS_X, parentImage.getHeight() / 2 + 40);
            xfm.setVisible(false);
            return actor;
        };
        /**
         * Create actor for displaying 'number of ways' text
         * @method eef.WinStackFactory#createWaysText
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {string} fontName The name of the font
         * @returns {abg2d.Actor} The created actor
         */
        WinStackFactory.createWaysText = function (scene, parent, scalar, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var parentImage = parent.getImage();
            var text = actor.getText();
            text.setAlign(0 /* TopLeft */);
            text.setFont("24px " + fontName);
            text.setMaxLineWidth(400);
            text.setScalar(scalar);
            abg2d.TextFactory.createFillText(text, "white");
            var xfm = actor.getTransform();
            xfm.setPosition(WinStackFactory.WAYS_TEXT_POS_X, 135);
            xfm.setVisible(false);
            return actor;
        };
        /**
         * Creates the symbol actors
         * @method eef.WinStackFactory#createSymbolActors
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @returns {Array<abg2d.Actor>} The list of symbol actors
         */
        WinStackFactory.createSymbolActors = function (scene, parent, spriteSheet) {
            var actors = [];
            var scale = 0.25;
            var symbolSpacer = 20;
            var parentImage = parent.getImage();
            for (var i = 0; i < WinStackFactory.MAX_SYMBOLS_IN_WIN; i++) {
                var actor = abg2d.Factory.composeImage(scene, parent);
                var image = actor.getImage();
                image.setSpriteSheet(spriteSheet);
                image.setFrame(5);
                var transform = actor.getTransform();
                var xPos = (((image.getWidth() + symbolSpacer) * scale) * i) + WinStackFactory.SYMBOL_START_POS_X;
                var yPos = (parentImage.getHeight() / 2 - (image.getWidth() * scale) / 2 - 50) + 30;
                transform.setPosition(xPos, yPos);
                transform.setScale(scale, scale);
                transform.setVisible(false);
                actors.push(actor);
            }
            return actors;
        };
        /**
         * Creates the logo
         * @method eef.WinStackFactory#createLogo
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} logo The logo image asset
         * @param {abg2d.Actor} parent The parent actor
         * @returns {abg2d.Actor} The newly created actor
         */
        WinStackFactory.createLogo = function (scene, scalar, logo, parent, pos) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(logo, scalar));
            var image = actor.getImage();
            var parentImage = parent.getImage();
            image.setAlign(6 /* Center */);
            var transform = actor.getTransform();
            transform.setPosition(pos[0], pos[1]);
            return actor;
        };
        WinStackFactory.createLogo1 = function (scene, scalar, logo, pos) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(logo, scalar));
            var image = actor.getImage();
            var transform = actor.getTransform();
            transform.setPosition(pos[0], pos[1]);
            transform.setZOrder(EEFConfig.PANEL_FRAME_Z + 1);
            return actor;
        };
        /**
         * Creates the background panel
         * @method eef.WinStackFactory#createPanel
         * @private
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} panel The image to use for the panel
         * @returns {abg2d.Actor} The newly created actor
         */
        WinStackFactory.createPanel = function (scene, scalar, panel, xPos) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(panel, scalar));
            var image = actor.getImage();
            image.setAlign(6 /* Center */);
            var transform = actor.getTransform();
            transform.setPosition(xPos - 8, WinStackFactory.Y_POS - 54);
            transform.setZOrder(EEFConfig.PANEL_FRAME_Z);
            transform.setVisible(false);
            return actor;
        };
        /**
         * The position on the y axis to place the win stack
         * @member eef.WinStack#Y_POS
         * @private
         * @type {number}
         * @default 100
         */
        WinStackFactory.Y_POS = 150;
        /**
         * The maximum number of symbols in a win
         * @member eef.WinStackFactory#MAX_SYMBOLS_IN_WIN
         * @private static
         * @type {number}
         * @default 5
         */
        WinStackFactory.MAX_SYMBOLS_IN_WIN = 5;
        /**
         * The size of the pay boxes
         * @member eef.WinStackFactory#PAY_BOX_SIZE
         * @private static
         * @type {number}
         * @default 40
         */
        WinStackFactory.PAY_BOX_SIZE = 30;
        /**
         * The starting positions for the pay boxes
         * @member eef.WinStackFactory#PAY_BOX_START_POS
         * @private static
         * @type {Array<number>}
         * @default [90, 54]
         */
        WinStackFactory.PAY_BOX_START_POS = [100, 40];
        /**
         * The y position of the headline
         * @member eef.WinStackFactory#HEADLINE_Y
         * @private static
         * @type {number}
         * @default 100
         */
        WinStackFactory.HEADLINE_Y = 125;
        /**
         * The y position of the touch to start text
         * @member eef.WinStackFactory#TOUCH_TO_START_Y
         * @private static
         * @type {number}
         * @default 160
         */
        WinStackFactory.TOUCH_TO_START_Y = 160;
        /**
         * The x position of the leftmost symbol in the symbol pay display
         * @member eef.WinStackFactory#SYMBOL_START_POS_X
         * @private static
         * @type {number}
         * @default 325
         */
        WinStackFactory.SYMBOL_START_POS_X = 650;
        /**
         * The x position of the Pays text
         * @member eef.WinStackFactory#PAYS_TEXT_POS_X
         * @private static
         * @type {number}
         * @default 300
         */
        WinStackFactory.PAYS_TEXT_POS_X = 310;
        WinStackFactory.WAYS_TEXT_POS_X = 100;
        return WinStackFactory;
    })();
    exports.WinStackFactory = WinStackFactory;
    var SlotFactory = (function () {
        function SlotFactory() {
        }
        /**
         * Creates a slot object
         * @method eef.SlotFactory#createSlot
         * @public static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {BaseBundle} baseBundle The base bundle of assets
         * @param {gamedata.ReelGroupData} reelGroupData the data that makes up a reel group
         * @param {AudioController} audioController Audio controller
         * @param {locale.Translator} translator The translator object
         * @param {locale.CurrencyFormatter} currencyFormatter The currency formatter
         * @param {abg2d.Actor} background The background image
         * @param {input.InputHandler} input The input handler
         * @param {boolean} gaffingEnabled True if the user can gaff the reels
         * @param {UIController} uiController The UI controller
         * @param {BetController} betController The bet controller
         * @returns {Slot} The created slot object
         */
        SlotFactory.createSlot = function (scene, scalar, baseBundle, reelGroupDatas, audioController, translator, currencyFormatter, background, inputHandler, gaffingEnabled, uiController, betController, metaData) {
            var reelFrame = SlotFactory.createReelFrame(scene, scalar, background, baseBundle.reelFrame);
            var firstSetReel = reelGroupDatas[4];
            var reelGroup = SlotFactory.buildReelGroup(scene, scalar, baseBundle.symbols, firstSetReel);
            var reelStrips = SlotFactory.createReelStrips(reelGroupDatas);
            var pulseDisplay = SlotFactory.createPulseDisplay(scene, scalar, reelGroup, baseBundle.symbols, baseBundle.dropShadow, baseBundle);
            var symbolAnimationController = SlotFactory.createSymbolAnimationController(scene, reelGroup, audioController, pulseDisplay, baseBundle, scalar);
            var winStack = WinStackFactory.createWinStack(scene, scalar, baseBundle, reelFrame.getTransform().getPositionX(), translator, currencyFormatter);
            var cycleResultsController = SlotFactory.createCycleResultsController(pulseDisplay, reelGroup, winStack);
            var winDisplayController = SlotFactory.createWinDisplayController(pulseDisplay, cycleResultsController, new BangController(uiController, audioController), symbolAnimationController, reelGroup, audioController, betController);
            var slot = new Slot(reelGroup, reelStrips, reelFrame, audioController, winDisplayController, symbolAnimationController, gaffingEnabled, metaData);
            inputHandler.addResolver(SlotFactory.createTouchHandling(slot, reelGroup, scalar));
            return slot;
        };
        /**
         * Creats the symbol animation controller
         * @method eef.SlotFactory#createSymbolAnimationController
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {standardreels.Group} group The reel group
         * @param {AudioController} audioController The audio controller
         * @param {reels.PulseDisplay} pulseDisplay The pulse display
         * @param {number} scalar The scale factor
         * @returns {SymbolAnimationController} The created symbol animation controllers
         */
        SlotFactory.createSymbolAnimationController = function (scene, group, audioController, pulseDisplay, baseBundle, scalar) {
            var actors = [];
            for (var i = 0; i < EEFConfig.NUMBER_OF_REELS; i++) {
                var actor = abg2d.Factory.composeFramedAnimation(scene, null);
                actor.getTransform().setVisible(false);
                actors.push(actor);
            }
            return new SymbolAnimationController(group, audioController, actors, pulseDisplay, scalar);
        };
        /**
         * Creates an input resolver and adds input regions for touches to the reels
         * @method eef.SlotFactory#createTouchHandling
         * @private static
         * @param {Slot} slot The slot game
         * @param {standardreels.Group} group The reel group
         * @returns {input.InputResolver} Input Resolver for the reels
         */
        SlotFactory.createTouchHandling = function (slot, reelGroup, scalar) {
            var reelFrameBounds = new abg2d.Rect;
            slot.getReelFrame().getImage().getBounds(reelFrameBounds);
            var inputResolver = new input.InputResolver(reelFrameBounds.x * scalar, reelFrameBounds.y * scalar, reelFrameBounds.width * scalar, reelFrameBounds.height * scalar);
            for (var reelId = 0; reelId < reelGroup.getReelCount(); ++reelId) {
                var layout = reelGroup.getController(reelId).getLayout();
                var bounds = new abg2d.Rect();
                layout.getBounds(bounds);
                inputResolver.addRegion(SlotFactory.createRegion(slot, bounds));
            }
            return inputResolver;
        };
        /**
         * Takes the bounds of a reel and returns an input region
         * @method eef.SlotFactory#createRegion
         * @private static
         * @param {Slot} slot The slot game
         * @param {abg2d.Rect} bounds The bounds of this reel
         * @returns {input.IInputRegion} The input region for this reel
         */
        SlotFactory.createRegion = function (slot, bounds) {
            var region = {
                touchPosX: 0,
                touchPosY: 0,
                onStart: function (id, x, y) { return slot.handleReelTouches(x, y); },
                onMove: function (id, x, y) {
                },
                onEnd: function (id, x, y) {
                },
                getX: function () {
                    return bounds.x;
                },
                getY: function () {
                    return bounds.y;
                },
                getWidth: function () {
                    return bounds.width;
                },
                getHeight: function () {
                    return bounds.height;
                },
                getLayer: function () {
                    return 0;
                },
                isActive: function () {
                    return true;
                },
                isBlocking: function () {
                    return false;
                }
            };
            return region;
        };
        /**
         * Creates the cycle results controller
         * @method eef.SlotFactory#createCycleResultsController
         * @private static
         * @param {reels.PulseDisplay} pulseDisplay The symbol pulse display
         * @param {standardreels.Group} group The reel group
         * @param {winstack.WinStack} winStack The win stack
         * @returns {CycleResultsController} The cycle results controller
         */
        SlotFactory.createCycleResultsController = function (pulseDisplay, group, winStack) {
            return new CycleResultsController(pulseDisplay, winStack, group);
        };
        /**
         * Creates the win display controller
         * @method eef.SlotFactory#createWinDisplayController
         * @private static
         * @param {reels.PulseDisplay} pulseDisplay The symbol pulse display
         * @param {CycleResultsController} cycleResultsController The cycle results controller
         * @param {BangController} bangController The bang up controller
         * @param {SymbolAnimationController} symbolAnimationController The symbol animation controller
         * @param {standardreels.Group} reelGroup The reel group
         * @param {AudioController} audioController The audio controller
         * @param {BetController} betController The bet controller
         * @returns {WinDisplayController} The win display controller
         */
        SlotFactory.createWinDisplayController = function (pulseDisplay, cycleResultsController, bangController, symbolAnimationController, reelGroup, audioController, betController) {
            return new WinDisplayController(pulseDisplay, cycleResultsController, bangController, symbolAnimationController, reelGroup, audioController, betController);
        };
        /**
         * Creates the pulse display
         * @method eef.SlotFactory#createPulseDisplay
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {standardreels.Group} group The reel group
         * @param {asset.ImageAsset} symbolImage The symbol image
         * @param {asset.ImageAsset} dropShadowImage The drop shadow image
         * @param {BaseBundle} baseBundle The base bundle
         * @returns {reels.PulseDisplay} The pulse display
         */
        SlotFactory.createPulseDisplay = function (scene, scalar, group, symbolImage, dropShadowImage, baseBundle) {
            var animComponents = [];
            var layouts = [];
            var symbolSheet = new abg2d.SpriteSheet(symbolImage, scalar);
            var shadowSheet = new abg2d.SpriteSheet(dropShadowImage, scalar);
            var numReels = group.getReelCount();
            for (var i = 0; i < numReels; i++) {
                animComponents[i] = [];
                var layout = group.getController(i).getLayout();
                var anchor = layout.getAnchor().getTransform();
                var yPos = anchor.getPositionY() + layout.getSymbolHeight();
                var xPos = anchor.getPositionX();
                var width = layout.getSymbolWidth();
                var height = layout.getSymbolHeight();
                var numDisplaySymbols = layout.getWindowSize() - 2;
                for (var j = 0; j < numDisplaySymbols; ++j) {
                    animComponents[i].push({
                        symbol: this.createPulseSymbolActors(scene, xPos, yPos, EEFConfig.SYMBOL_PULSE_Z),
                        shadow: this.createShadowActors(scene, shadowSheet, xPos, yPos, EEFConfig.SYMBOL_PULSE_Z - 1),
                        symbolCover: this.createSymbolCovers(scene, xPos, yPos, width, height, EEFConfig.SYMBOL_PULSE_Z - 2)
                    });
                }
                layouts.push(group.getController(i).getLayout());
            }
            var pulseDisplay = new PulseDisplay(animComponents, layouts, SlotFactory.SYMBOL_MAP, this.createPulseSymbolAnimations(baseBundle, scalar), symbolSheet, scalar);
            return pulseDisplay;
        };
        /**
         * Creates the symbol animation list for the pulse display
         * @method eef.SlotFactory#createPulseSymbolAnimations
         * @private static
         * @param {BaseBundle} bundle The animation bundle
         * @param {number} scalar The scale factor
         * @returns {reels.IPulseSymbolAnimation[]} The list of symbol animations to use
         */
        SlotFactory.createPulseSymbolAnimations = function (bundle, scalar) {
            var animations = [];
            var h1 = { symbolId: EEFConfig.H1_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.h1, scalar), xOffset: 0, yOffset: 0 };
            var h2 = { symbolId: EEFConfig.H2_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.h2, scalar), xOffset: 0, yOffset: 0 };
            var h3 = { symbolId: EEFConfig.H3_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.h3, scalar), xOffset: 0, yOffset: 0 };
            var h4 = { symbolId: EEFConfig.H4_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.h4, scalar), xOffset: 0, yOffset: 0 };
            var h5 = { symbolId: EEFConfig.H5_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.h5, scalar), xOffset: 0, yOffset: 0 };
            var l1 = { symbolId: EEFConfig.L1_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.l1, scalar), xOffset: 0, yOffset: 0 };
            var l2 = { symbolId: EEFConfig.L2_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.l2, scalar), xOffset: 0, yOffset: 0 };
            var l3 = { symbolId: EEFConfig.L3_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.l3, scalar), xOffset: 0, yOffset: 0 };
            var l4 = { symbolId: EEFConfig.L4_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.l4, scalar), xOffset: 0, yOffset: 0 };
            var l5 = { symbolId: EEFConfig.L5_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.l5, scalar), xOffset: 0, yOffset: 0 };
            var m1 = { symbolId: EEFConfig.M1_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.m1, scalar), xOffset: 0, yOffset: 0 };
            var m2 = { symbolId: EEFConfig.M2_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.m2, scalar), xOffset: 0, yOffset: 0 };
            var m3 = { symbolId: EEFConfig.M3_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.m3, scalar), xOffset: 0, yOffset: 0 };
            var m4 = { symbolId: EEFConfig.M4_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.m4, scalar), xOffset: 0, yOffset: 0 };
            var m5 = { symbolId: EEFConfig.M5_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.m5, scalar), xOffset: 0, yOffset: 0 };
            var wild = { symbolId: EEFConfig.WILD_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.wild, scalar), xOffset: 0, yOffset: 0 };
            var z_bonus = { symbolId: EEFConfig.Z_BONUS_SYMBOL_ID, spriteSheet: new abg2d.SpriteSheet(bundle.z_bonus, scalar), xOffset: 0, yOffset: 0 };
            animations.push(h1);
            animations.push(h2);
            animations.push(h3);
            animations.push(h4);
            animations.push(h5);
            animations.push(l1);
            animations.push(l2);
            animations.push(l3);
            animations.push(l4);
            animations.push(l5);
            animations.push(m1);
            animations.push(m2);
            animations.push(m3);
            animations.push(m4);
            animations.push(m5);
            animations.push(wild);
            animations.push(z_bonus);
            return animations;
        };
        /**
         * Creates the symbol covers for the pulse display
         * @method eef.SlotFactory#createSymbolCovers
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} xPos The x position
         * @param {number} yPos The y position
         * @param {number} width The width
         * @param {number} height The height
         * @param {number} zOrder The z-index
         * @returns {abg2d.Actor} The sybmol actor
         */
        SlotFactory.createSymbolCovers = function (scene, xPos, yPos, width, height, zOrder) {
            var actor = abg2d.Factory.composeBox(scene, null);
            var transform = actor.getTransform();
            transform.setVisible(false);
            return actor;
        };
        /**
         * Creates the pulse symbol actors
         * @method eef.SlotFactory#createPulseSymbolActors
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} xPos The x position
         * @param {number} yPos The y position
         * @param {number} zOrder The z-index
         * @returns {abg2d.Actor} The symbol actor
         */
        SlotFactory.createPulseSymbolActors = function (scene, xPos, yPos, zOrder) {
            var actor = abg2d.Factory.composeFramedAnimation(scene, null);
            var transform = actor.getTransform();
            transform.setZOrder(zOrder);
            transform.setPosition(xPos, yPos);
            transform.setVisible(false);
            return actor;
        };
        /**
         * Creates the shadow actors for the pulse display
         * @method eef.SlotFactory#createShadowActors
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.SpriteSheet} shadowImage The drop shadow image
         * @param {number} xPos The x position
         * @param {number} yPos The y position
         * @param {number} zOrder The z-index
         * @returns {abg2d.Actor} The shadow actor
         */
        SlotFactory.createShadowActors = function (scene, shadowImage, xPos, yPos, zOrder) {
            var actor = abg2d.Factory.composeImage(scene, null, shadowImage);
            var transform = actor.getTransform();
            transform.setVisible(false);
            return actor;
        };
        /**
         * Creates the reel frame
         * @method eef.SlotFactory#createReelFrame
         * @public
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent image used to calculate positioning
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} reelFrame The reel frame actor
         * @returns {abg2d.Actor} The newly created actor
         */
        SlotFactory.createReelFrame = function (scene, scalar, parent, reelFrame) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(reelFrame, scalar));
            actor.setName('reelframe');
            var image = actor.getImage();
            image.setAlign(6 /* Center */);
            var transform = actor.getTransform();
            transform.setPosition(parent.getImage().getWidth() / 2 + 10, parent.getImage().getHeight() / 2 + 25);
            transform.setZOrder(EEFConfig.REEL_FRAME_Z);
            return actor;
        };
        /**
         * Builds the reel group
         * @method eef.SlotFactory#buildReelGroup
         * @public static
         * @param {gamedata.ReelGroupData} data The data class with reel group information
         * @param {asset.ImageAsset} symbols The symbols image asset
         * @param {abg2d.Scene} scene The scene to put actors into
         * @param {number} scalar The scale factor
         * @returns {standardreels.Group} The created reel group
         */
        SlotFactory.buildReelGroup = function (scene, scalar, symbols, data) {
            var strips = data.getAllStrips();
            var symbolSheet = new abg2d.SpriteSheet(symbols, scalar);
            var symbolSet = new reels.SymbolSet(SlotFactory.SYMBOL_MAP, symbolSheet);
            var controllers = [];
            for (var i = 0; i < strips.length; i++) {
                var controller = SlotFactory.createReel(i, strips[i], symbolSet, scalar, scene);
                controllers.push(controller);
            }
            var spinStagger = 0.09;
            var stopStagger = 0.3;
            var group = new standardreels.Group(controllers, spinStagger, stopStagger);
            // Hacky use of anticipation to extend reelspins. Works because EEF doesn't use anticipation spins otherwise.
            group.setAnticipationDelay(1);
            group.setOnConfirmAnticipation(function (reelId) {
                if (reelId == 0) {
                    return true;
                }
            });
            return group;
        };
        /**
         * Creates a reel
         * @method eef.SlotFactory#createReel
         * @private
         * @param {number} reelIndex The current reel to set up
         * @param {gamedata.ReelStrip} strip The reel strip to use to construct the reel
         * @param {reels.SybmolSet} symbolSet The set of symbols to use in the reel
         * @param {number} scalar The scale factor
         * @param {abg2d.scene} scene The scene to put actors in
         * @returns {standardreels.Controller} The newly created controller
         */
        SlotFactory.createReel = function (reelIndex, strip, symbolSet, scalar, scene) {
            var reelStrip = new reels.Strip(strip.getSymbols());
            reelStrip.addUnbreakableGroup([-2 /* Neighbor */, 0, -2 /* Neighbor */]);
            var reel = new reels.Reel(0, this.HOME_INDEX, EEFConfig.SYMBOLS_IN_REEL, reelStrip);
            var symbols = [];
            var anchor = SlotFactory.createSymbolActors(symbols, scene);
            anchor.setName('reel' + reelIndex);
            var swapList = [];
            var layout = new reels.Layout(reel, symbolSet, anchor, symbols);
            layout.layout();
            layout.setOffset(this.ANCHORS[0], this.ANCHORS[1], 4, 0, reelIndex, -1);
            var reelBounds = new abg2d.Rect();
            layout.getBounds(reelBounds);
            for (var i = 0; i < EEFConfig.SYMBOLS_IN_REEL; i++) {
                symbols[i].getImage().setClipRect(reelBounds.x, reelBounds.y, reelBounds.width, reelBounds.height - 3);
                swapList.push(i);
            }
            SlotFactory.setSymbolOffset(symbolSet, layout, scalar);
            layout.swapSymbols(swapList);
            var profile = new standardreels.SpinProfile();
            profile.spinSpeed = 3000;
            profile.bounceSpeed = 600;
            profile.bounceDistance = 85;
            profile.stepSpeed = 1500;
            profile.bounceEaseOut = Power1.easeOut;
            profile.bounceEaseBack = Linear.easeNone;
            return new standardreels.Controller(layout, profile, new game.TweenUtil(), new abg2d.MathUtil());
        };
        SlotFactory.createReelStrips = function (reelGroupDatas) {
            var reelStrips = [[], [], [], [], [], [], [], [], [], [], [], []];
            var reelStrip = null;
            var strip = null;
            for (var j = 0; j < reelGroupDatas.length; j++) {
                var reelData = reelGroupDatas[j];
                var strips = reelData.getAllStrips();
                for (var i = 0; i < strips.length; i++) {
                    strip = strips[i];
                    reelStrip = new reels.Strip(strip.getSymbols());
                    reelStrip.addUnbreakableGroup([-2 /* Neighbor */, 0, -2 /* Neighbor */]);
                    reelStrips[j][i] = reelStrip;
                }
            }
            return reelStrips;
        };
        /**
         * Sets the symbol offset for oversized symbols
         * @method eef.SlotFactory#setSymbolOffset
         * @private
         * @param {reels.SymbolsSet} symbolSet The set of symbols to use to find the oversized symbol
         * @param {reels.Layout} layout The reel layout
         */
        SlotFactory.setSymbolOffset = function (symbolSet, layout, scalar) {
            // Frame index for H1 symbol
            /*var normalSymbolIndex: number = 0;
            // Frame index for Z_BONUS symbol
            var oversizedSymbolIndex: number = 14;
    
            var frame: number = symbolSet.getSymbol(normalSymbolIndex);
            var altFrame: number = symbolSet.getSymbol(oversizedSymbolIndex);
    
            var standardSize: number = symbolSet.spriteSheet.getFrame(frame).drawH;
            var altSize: number = symbolSet.spriteSheet.getFrame(altFrame).drawH;
    
            var offset: number = Math.floor(altSize - standardSize) - (16 * scalar);
    
            layout.setSymbolOffset(oversizedSymbolIndex, offset);*/
        };
        /**
         * Creates the symbol actors that are displayed in the reel
         * @method eef.SlotFactory#createSymbolActors
         * @private
         * @param {Array<abg2d.Actor>} symbolsOut The symbol array to populate
         * @param {abg2d.Scene} scene The scene to put actors in
         * @returns {abg2d.Actor} The created parent actor that holds the symbols actors
         */
        SlotFactory.createSymbolActors = function (symbolsOut, scene) {
            var root = abg2d.Factory.composeTransform(scene, null);
            root.getTransform().setZOrder(EEFConfig.SYMBOL_Z);
            for (var i = 0; i < EEFConfig.SYMBOLS_IN_REEL; i++) {
                var actor = abg2d.Factory.composeImage(scene, root);
                actor.setName('symbol' + i);
                actor.getTransform().setZOrder(EEFConfig.SYMBOL_Z);
                symbolsOut.push(actor);
            }
            return root;
        };
        /**
         * Constant defining the home index of a reel
         * @member eef.SlotFactory#HOME_INDEX
         * @private
         * @type {number}
         * @default 5
         */
        SlotFactory.HOME_INDEX = 2;
        /**
         * Constants defining the x and y anchors for a reel
         * @member eef.SlotFactory#ANCHORS
         * @private
         * @type {Array<number>}
         * @default [0, 0]
         */
        SlotFactory.ANCHORS = [310, 271];
        /**
         * Constant representing the map of symbols to symbolIDs
         * @member eef.SlotFactory#SYMBOL_MAP
         * @private static
         * @type {Array<number>}
         * @default [12, 0, 1, -1, 2, 3, 8, 9, 10, 11, 4, 5, 6, 7, 13];
         */
        SlotFactory.SYMBOL_MAP = [15, 16, 9, 8, 7, 6, 5, 14, 13, 12, 11, 10, 4, 3, 2, 1, 0];
        return SlotFactory;
    })();
    exports.SlotFactory = SlotFactory;
    var UIFactory = (function () {
        function UIFactory() {
        }
        /**
         * Creates all of the elements necessary to display and handle the UI
         * @method eef.UIFactory#create
         * @public static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} background THe background image, used for positioning elements
         * @param {number} scalar The scale factor
         * @param {BaseBundle} baseBundle The base bundle of assets
         * @param {locale.Translator} translator The translator object
         * @param {glscomms.GLSRequestor} glsRequestor The gls requestor object
         * @param {locale.CurrencyFormatter} currencyFormatter The currency formatter
         * @param {input.InputHandler} inputHandler The input handler
         * @param {HTMLDivElement} gameElement The dive to put help / pays in
         * @param {any} metaData The metaData object
         * @returns {UIController} The controller objec that handles ui events
         */
        UIFactory.create = function (scene, background, scalar, baseBundle, translator, glsRequestor, currencyFormatter, inputHandler, audioController, gameElement, metaData, partnerListener) {
            var backgroundImageWidth = background.getImage().getWidth();
            var backgroundImageHeight = background.getImage().getHeight();
            var settingsButton = UIFactory.createSettingsButton(scene, scalar, baseBundle.settingsButton, backgroundImageHeight);
            settingsButton.getTransform().setVisible(false);
            var settingsMenuPanel = UIFactory.createSettingsMenuPanel(scene, scalar, baseBundle.settingsMenuBar, backgroundImageHeight);
            var autoPlayIcon = UIFactory.createAutoPlayIcon(scene, settingsMenuPanel, scalar, baseBundle.autoPlayIcon, "autoplay", 15);
            var autoPlayButton = new Button(autoPlayIcon, null, scalar, inputHandler);
            var betMenu = UIFactory.createSubMenu(scene, settingsMenuPanel, scalar, baseBundle.betMenu);
            var stakePerlineBG = UIFactory.createMeterBG(UIFactory.STAKE_METER_NAME, UIFactory.STAKEPERLINE_METER_POSITIONS, scene, scalar, baseBundle.stakemtr);
            var multiplierBG = UIFactory.createMeterBG(UIFactory.MULTIPLIER_NAME, UIFactory.MULTIPLIERE_METER_POSITIONS, scene, scalar, baseBundle.multipliermeter);
            var multiplierMenuPanel = UIFactory.createMultiplierMenuPanel(scene, scalar, baseBundle.settingsMenuBar, backgroundImageHeight);
            var creditsMenuPanel = UIFactory.createCreditsMenuPanel(scene, scalar, baseBundle.creditswindow, backgroundImageHeight);
            var multiplierIcons = UIFactory.createMultiplierIcons(scene, scalar, multiplierMenuPanel, baseBundle.multipliermeter, baseBundle.myriadProSemiBold);
            var betMenuPanel = UIFactory.createBetMenuPanel(scene, scalar, baseBundle.settingsMenuBar, backgroundImageHeight);
            var betIcons = UIFactory.createBetIcons(scene, scalar, creditsMenuPanel, baseBundle.stakemtr, baseBundle.myriadProSemiBold);
            var bowlBG = UIFactory.createMeterBG(UIFactory.BOWL_NAME, UIFactory.BOWL_POSITIONS, scene, scalar, baseBundle.bowl);
            var miniBGLock = UIFactory.createMeterBG(UIFactory.MINI_NAME, UIFactory.MINI_METER_POSITIONS, scene, scalar, baseBundle.mini, true);
            var minorBGLock = UIFactory.createMeterBG(UIFactory.MINOR_NAME, UIFactory.MINOR_METER_POSITIONS, scene, scalar, baseBundle.minor, true);
            var majorBGLock = UIFactory.createMeterBG(UIFactory.MAJOR_NAME, UIFactory.MAJOR_METER_POSITIONS, scene, scalar, baseBundle.major, true);
            var grandBGLock = UIFactory.createMeterBG(UIFactory.GRAND_NAME, UIFactory.GRAND_METER_POSITIONS, scene, scalar, baseBundle.grand, true);
            if (UIFactory.scalar == 1) {
                var activeHighlight = UIFactory.createMeterBG(UIFactory.HIGHLIGHT_NAME, UIFactory.ACTIVE_HIGHLIGHT_POSITION, scene, scalar, baseBundle.activeframehighlight, false);
            }
            else {
                var activeHighlight = UIFactory.createMeterBG(UIFactory.HIGHLIGHT_NAME, UIFactory.ACTIVE_HIGHLIGHT_POSITION_MOB, scene, scalar, baseBundle.activeframehighlight, false);
            }
            var symbolHighlight = UIFactory.createHighlights(scene, scalar, baseBundle.symbolhighlight, baseBundle.myriadProSemiBold);
            if (UIFactory.scalar == 1) {
                var coinGoldAS = UIFactory.createMeterBG(UIFactory.COIN_GOLD_NAME, UIFactory.COIN_GOLD_POSITIONS, scene, scalar, baseBundle.coingold, false);
                var ingotGoldAS = UIFactory.createMeterBG(UIFactory.INGOT_GOLD_NAME, UIFactory.INGOT_GOLD_POSITIONS, scene, scalar, baseBundle.ingotgold, false);
                var turtleGoldAS = UIFactory.createMeterBG(UIFactory.TURTLE_GOLD_NAME, UIFactory.TURTLE_GOLD_POSITIONS, scene, scalar, baseBundle.turtlegold, false);
                var junkGoldAS = UIFactory.createMeterBG(UIFactory.JUNK_GOLD_NAME, UIFactory.JUNK_GOLD_POSITIONS, scene, scalar, baseBundle.junkgold, false);
                var phoenixGoldAS = UIFactory.createMeterBG(UIFactory.PHOENIX_GOLD_NAME, UIFactory.PHOENIX_GOLD_POSITIONS, scene, scalar, baseBundle.phoenixgold, false);
                var allup = UIFactory.createMeterBG(UIFactory.ALLUP_NAME, UIFactory.ALLUP_POSITIONS, scene, scalar, baseBundle.allup, false);
                var ingotAS = UIFactory.createMeterBG(UIFactory.INGOT_NAME, UIFactory.INGOT_POSITIONS, scene, scalar, baseBundle.ingot, false);
                var turtleAS = UIFactory.createMeterBG(UIFactory.TURTLE_NAME, UIFactory.TURTLE_POSITIONS, scene, scalar, baseBundle.turtle, false);
                var junkAS = UIFactory.createMeterBG(UIFactory.JUNK_NAME, UIFactory.JUNK_POSITIONS, scene, scalar, baseBundle.junk, false);
                var phoenixAS = UIFactory.createMeterBG(UIFactory.PHOENIX_NAME, UIFactory.PHOENIX_POSITIONS, scene, scalar, baseBundle.phoenix, false);
            }
            else {
                var coinGoldAS = UIFactory.createMeterBG(UIFactory.COIN_GOLD_NAME, UIFactory.COIN_GOLD_POSITIONS_MOB, scene, scalar, baseBundle.coingold, false);
                var ingotGoldAS = UIFactory.createMeterBG(UIFactory.INGOT_GOLD_NAME, UIFactory.INGOT_GOLD_POSITIONS_MOB, scene, scalar, baseBundle.ingotgold, false);
                var turtleGoldAS = UIFactory.createMeterBG(UIFactory.TURTLE_GOLD_NAME, UIFactory.TURTLE_GOLD_POSITIONS_MOB, scene, scalar, baseBundle.turtlegold, false);
                var junkGoldAS = UIFactory.createMeterBG(UIFactory.JUNK_GOLD_NAME, UIFactory.JUNK_GOLD_POSITIONS_MOB, scene, scalar, baseBundle.junkgold, false);
                var phoenixGoldAS = UIFactory.createMeterBG(UIFactory.PHOENIX_GOLD_NAME, UIFactory.PHOENIX_GOLD_POSITIONS_MOB, scene, scalar, baseBundle.phoenixgold, false);
                var allup = UIFactory.createMeterBG(UIFactory.ALLUP_NAME, UIFactory.ALLUP_POSITIONS_MOB, scene, scalar, baseBundle.allup, false);
                var ingotAS = UIFactory.createMeterBG(UIFactory.INGOT_NAME, UIFactory.INGOT_POSITIONS_MOB, scene, scalar, baseBundle.ingot, false);
                var turtleAS = UIFactory.createMeterBG(UIFactory.TURTLE_NAME, UIFactory.TURTLE_POSITIONS_MOB, scene, scalar, baseBundle.turtle, false);
                var junkAS = UIFactory.createMeterBG(UIFactory.JUNK_NAME, UIFactory.JUNK_POSITIONS_MOB, scene, scalar, baseBundle.junk, false);
                var phoenixAS = UIFactory.createMeterBG(UIFactory.PHOENIX_NAME, UIFactory.PHOENIX_POSITIONS_MOB, scene, scalar, baseBundle.phoenix, false);
            }
            var balanceText = UIFactory.createProviewMeterText(scene, scalar, baseBundle.myriadProSemiBold, "55px", UIFactory.BALANCE_METER_TEXT_POSITIONS);
            balanceText.setName('dashboard-balanceMeter');
            var winMeterText = UIFactory.createProviewMeterText(scene, scalar, baseBundle.myriadProSemiBold, "55px", UIFactory.WIN_METER_TEXT_POSITIONS);
            var stakeMeter = UIFactory.createProviewMeterText(scene, scalar, baseBundle.myriadProSemiBold, "55px", UIFactory.STAKE_METER_TEXT_POSITIONS);
            var creditFont = "40px";
            if (translator.findByKey('Credits_txt').length > 11) {
                creditFont = "35px";
            }
            var creditLabel = UIFactory.createText(creditsMenuPanel, scene, scalar, baseBundle.myriadProSemiBold, creditFont, UIFactory.CREDITS_TEXT_POSITIONS, translator.findByKey('Credits_txt'), "#3b0c0f", 4, "#ffe63c", 1);
            var betLabel = UIFactory.createText(multiplierBG, scene, scalar, baseBundle.myriadProSemiBold, "40px", UIFactory.BET_TEXT_POSITIONS, translator.findByKey('bet_txt'), "#3b0c0f", 4, "#ffe63c", 1);
            var perSpintxt = UIFactory.createText(multiplierBG, scene, scalar, baseBundle.myriadProSemiBold, "30px", UIFactory.PER_SPIN_TEXT_POSITIONS, translator.findByKey('bet_txt1'), "#3b0c0f", 5, "#ffe63c", 1);
            if (UIFactory.scalar == 1) {
                var activeSymboltxt = UIFactory.createActiveSymbolTxt(scene, scalar, baseBundle.myriadProSemiBold, "30px", UIFactory.ACTIVE_SYMBOL_TEXT_POSITIONS, translator.findByKey('com.wms.eightyeightfortunes.Activesymbols'), "#330000", 3, "#ffe63c");
            }
            else {
                var activeSymboltxt = UIFactory.createActiveSymbolTxt(scene, scalar, baseBundle.myriadProSemiBold, "30px", UIFactory.ACTIVE_SYMBOL_TEXT_POSITIONS_MOB, translator.findByKey('com.wms.eightyeightfortunes.Activesymbols'), "#330000", 3, "#ffe63c");
            }
            var replayText = UIFactory.createReplayOverlay(scene, scalar, baseBundle.myriadProSemiBold, translator);
            var betMenuText = UIFactory.createMeterText({
                scene: scene,
                parent: stakePerlineBG,
                x: stakePerlineBG.getImage().getWidth() / 2 - 45,
                y: stakePerlineBG.getImage().getHeight() / 2 - 45,
                scalar: scalar,
                color: "#f5f500",
                bundle: baseBundle,
                fontSize: "48px ",
                maxwidth: 50
            });
            var betMenuText2 = UIFactory.createMeterText({
                scene: scene,
                parent: stakePerlineBG,
                x: stakePerlineBG.getImage().getWidth() / 2 - 45,
                y: stakePerlineBG.getImage().getHeight() / 2 - 25,
                scalar: scalar,
                color: "#f5f500",
                bundle: baseBundle,
                fontSize: "48px ",
                maxwidth: 50
            });
            var MultiplierMenuText = UIFactory.createBetMeterText({
                scene: scene,
                parent: multiplierBG,
                x: stakePerlineBG.getImage().getWidth() / 2 - 29,
                y: stakePerlineBG.getImage().getHeight() / 2 - 6,
                scalar: scalar,
                color: "#ffffff",
                bundle: baseBundle,
                fontSize: "34px ",
                maxwidth: 150
            });
            var balanceMeterLabel = UIFactory.createMeterLabel(scene, scalar, baseBundle.myriadProBold, translator.findByKey('Balance_Meter_Text'), "38px", UIFactory.BALANCE_TEXT_POSITIONS);
            var stakeMeterLabel = UIFactory.createMeterLabel(scene, scalar, baseBundle.myriadProBold, translator.findByKey('Stake_Meter_Text'), "38px", UIFactory.STAKE_TEXT_POSITIONS);
            var winMeterLabel = UIFactory.createMeterLabel(scene, scalar, baseBundle.myriadProBold, translator.findByKey('Win_Meter_Text'), "38px", UIFactory.WIN_TEXT_POSITIONS);
            betMenuText.getText().setFont("50px " + baseBundle.myriadProSemiBold.getFontName());
            betMenuText2.getText().setFont("50px " + baseBundle.myriadProSemiBold.getFontName());
            betMenuText.getTransform().setVisible(false);
            betMenuText2.getTransform().setVisible(false);
            var betSubMenu = new BetMenu(betMenu, betMenuText, currencyFormatter, inputHandler, MultiplierMenuText, betMenuPanel, betIcons, stakePerlineBG, scene, baseBundle, scalar, betMenuText2, creditsMenuPanel, audioController, translator);
            var spinButtonDisableActor = UIFactory.createSpinButton(scene, scalar, baseBundle.spinButtonDisable);
            spinButtonDisableActor.getTransform().setZOrder(1);
            var spinButtonActor = UIFactory.createSpinButton(scene, scalar, baseBundle.spinButton);
            var spinButton = new SpinButton(spinButtonActor, scalar, baseBundle.spinButton, baseBundle.autoPlaySpinButton, baseBundle.autoPlayStopButton, inputHandler);
            var spinsText = UIFactory.createAutoPlaySpinsRemainingText(scene, scalar, spinButtonActor, baseBundle.myriadProSemiBold.getFontName());
            var autoplaybutton = UIFactory.createButton1(UIFactory.AUTO_PLAY_BUTTON_NAME, UIFactory.AUTO_PLAY_BUTTON_POSITIONS, scene, scalar, baseBundle.autoplay);
            var autoPlayMenu = UIFactory.createSubMenu1(scene, autoPlayIcon, scalar, baseBundle.autoPlayMenu);
            var autoPlayIcons = UIFactory.createAutoPlayIcons(scene, scalar, autoPlayMenu, baseBundle.autoPlayIconBox, baseBundle.myriadProSemiBold);
            var autoPlayManager = new AutoPlayManager(spinsText);
            var autoPlaySubMenu = new AutoPlayMenu(autoPlayMenu, autoPlayIcons, autoPlayManager, spinButton, inputHandler, autoPlayIcon);
            var help = new HelpAndPays(translator, currencyFormatter, baseBundle, glsRequestor, gameElement, betSubMenu, metaData);
            var settings = new Settings(help, baseBundle, scalar, inputHandler, spinButton, helpButtonActor);
            var helpButtonActor = UIFactory.createButton(UIFactory.HELP_BUTTON_NAME, UIFactory.HELP_BUTTON_POSITIONS, scene, scalar, baseBundle.helpbutton);
            var setButtonActor = UIFactory.createButton(UIFactory.SET_BUTTON_NAME, UIFactory.SET_BUTTON_POSITIONS, scene, scalar, baseBundle.setbutton);
            var extHelpButtonActor = UIFactory.createButton(UIFactory.EXT_HELP_BUTTON_NAME, UIFactory.EXT_HELP_BUTTON_POSITIONS, scene, scalar, baseBundle.ext_help);
            var betminus = UIFactory.createButton(UIFactory.SET_BUTTON_NAME, UIFactory.BET_MINUS_BUTTON_POSITIONS, scene, scalar, baseBundle.betminus);
            var betMinusButton = new Button(betminus, null, scalar, inputHandler);
            var betplus = UIFactory.createButton(UIFactory.SET_BUTTON_NAME, UIFactory.BET_PLUS_BUTTON_POSITIONS, scene, scalar, baseBundle.betplus);
            var betPlusButton = new Button(betplus, null, scalar, inputHandler);
            var multiplierSubMenu = new multiplier(multiplierBG, multiplierMenuPanel, multiplierIcons, spinButton, inputHandler, scene, baseBundle, MultiplierMenuText, currencyFormatter, scalar, betminus, betplus, betPlusButton, betMinusButton);
            var jackpotDisplay = new JackpotBgAnim(miniBGLock, minorBGLock, majorBGLock, grandBGLock, activeHighlight, inputHandler, scene, baseBundle, currencyFormatter, scalar, betSubMenu);
            var activeSymbolDisplay = new ActiveSymbolAnim(coinGoldAS, ingotGoldAS, turtleGoldAS, junkGoldAS, phoenixGoldAS, ingotAS, turtleAS, junkAS, phoenixAS, allup, inputHandler, scene, baseBundle, scalar, betSubMenu, symbolHighlight, activeHighlight);
            var fuBatBg = UIFactory.createfuBatBg(scene, scalar, baseBundle.goldcoinFeatureBg);
            var coinIcons = UIFactory.createCoins(scene, scalar, fuBatBg, baseBundle.coin, baseBundle.myriadProSemiBold);
            var fubatjackpotview = new FubatJackpotView(scene, scalar, baseBundle, fuBatBg, coinIcons, inputHandler, translator, currencyFormatter, audioController);
            var maxWinBg = UIFactory.createMaxWinBg(scene, scalar, baseBundle.tally);
            var maxWinText = UIFactory.createMaxWinMeterTxt(maxWinBg, scene, scalar, baseBundle.myriadProSemiBold, "55px", UIFactory.MAX_WIN_TEXT_POSITIONS);
            var maxWinAmtText = UIFactory.createMaxWinMeterTxt(maxWinBg, scene, scalar, baseBundle.myriadProSemiBold, "100px", UIFactory.MAX_WIN_AMT_TEXT_POSITIONS);
            var flyBats = new FlyBats(allup, scene, scalar, audioController, baseBundle);
            var bowl = new Bowl(scene, scalar, baseBundle, UIFactory.BOWL_NAME, audioController, UIFactory.BOWL_POSITIONS);
            // Game Lanch Screen
            var gameLaunch = new GameLaunchView(scene, scalar, baseBundle, inputHandler, translator, audioController);
            var uiController = new UIController(winMeterLabel, winMeterText, balanceText, replayText, stakeMeter, betSubMenu, settings, spinButton, autoPlayManager, translator, glsRequestor, currencyFormatter, metaData.isRealMoney(), multiplierSubMenu, scene, baseBundle, MultiplierMenuText, fubatjackpotview, jackpotDisplay, help, activeSymbolDisplay, maxWinBg, maxWinText, maxWinAmtText, flyBats, bowl, bowlBG, autoPlayIcon, gameLaunch, helpButtonActor, setButtonActor, extHelpButtonActor, scalar, inputHandler, autoPlayButton, autoPlaySubMenu, partnerListener, metaData);
            return uiController;
        };
        /* creates meterbackground */
        UIFactory.createMeterBG = function (name, positions, scene, scalar, asset, visible) {
            if (visible === void 0) { visible = true; }
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName(name);
            actor.getImage().setVisible(visible);
            var transform = actor.getTransform();
            if (positions != null) {
                transform.setPosition(positions[0], positions[1]);
            }
            transform.setZOrder(EEFConfig.METER_BG_Z);
            return actor;
        };
        /**
         * Creates the icons for the auto play menu
         * @method EEF.UIFactory#createMultiplierIcons
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {abg2d.Actor} parent The parent actor used for positioning
         * @param {asset.ImageAsset} asset The image to use for the icon
         * @param {asset.FontAsset} font The font to use
         * @returns {abg2d.Actor[]} The list of icons
         */
        UIFactory.createMultiplierIcons = function (scene, scalar, parent, asset, font) {
            var actors = [];
            var y = 470;
            var y1 = 670;
            for (var i = 0; i < UIFactory.NUM_BET_MULTIPLIER_ICONS; i++) {
                var textValue = UIFactory.MULTIPLIER_SELECTIONS[i].toString();
                var dimensions = 66 * scalar;
                var backgroundActor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
                backgroundActor.setName(textValue);
                var bgTransform = backgroundActor.getTransform();
                bgTransform.setVisible(false);
                if (i < 5) {
                    bgTransform.setPosition(1640, y);
                }
                else {
                    bgTransform.setPosition(1640, y1);
                }
                bgTransform.setZOrder(EEFConfig.UI_SETTINGS_ITEM_Z);
                actors.push(backgroundActor);
            }
            return actors;
        };
        /* creates gold credit icons */
        UIFactory.createBetIcons = function (scene, scalar, parent, asset, font) {
            var actors = [];
            var y = 782;
            for (var i = 0; i < UIFactory.NUM_BET_ICONS; i++) {
                var textValue = UIFactory.BET_SELECTIONS[i].toString();
                var dimensions = 66 * scalar;
                var backgroundActor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
                backgroundActor.setName(textValue);
                //backgroundActor.getImage().setAlign(abg2d.Alignment.Center);
                var bgTransform = backgroundActor.getTransform();
                bgTransform.setVisible(true);
                //bgTransform.setPositionY(parent.getTransform().getPositionY());
                bgTransform.setPosition(21, y);
                y = y - 113;
                //y = y - (110 * 1);
                bgTransform.setZOrder(EEFConfig.CREDITS_ICON_Z);
                actors.push(backgroundActor);
            }
            return actors;
        };
        /**
         * Creates the spin button
         * @method eef.UIFactory#createSpinButton
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} asset The asset to use for the spin button
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createSpinButton = function (scene, scalar, asset) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName("spinButton");
            var transform = actor.getTransform();
            transform.setPosition(UIFactory.SPIN_BUTTON_POSITIONS[0], UIFactory.SPIN_BUTTON_POSITIONS[1]);
            transform.setZOrder(EEFConfig.SPIN_BUTTON_Z);
            return actor;
        };
        /**
         * Creates the button
         * @method sym.UIFactory#createSpinButton
         * @private static
         * @param {name} name for the button
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} asset The asset to use for the spin button
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createButton = function (name, positions, scene, scalar, asset, font, label) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName(name);
            var transform = actor.getTransform();
            transform.setPosition(positions[0], positions[1]);
            transform.setZOrder(EEFConfig.BUTTON_BG_Z);
            return actor;
        };
        /* creates button */
        UIFactory.createButton1 = function (name, positions, scene, scalar, asset, font, label) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName(name);
            var transform = actor.getTransform();
            transform.setVisible(false);
            transform.setPosition(positions[0], positions[1]);
            transform.setZOrder(31);
            return actor;
        };
        /*creates max win Background*/
        UIFactory.createMaxWinBg = function (scene, scalar, bg) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(bg, scalar));
            var image = actor.getImage();
            image.setAlign(6 /* Center */);
            var transform = actor.getTransform();
            transform.setVisible(false);
            transform.setZOrder(1000);
            transform.setPosition(1000, 600);
            return actor;
        };
        /* creates fubat feature background */
        UIFactory.createfuBatBg = function (scene, scalar, bg) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(bg, scalar));
            var image = actor.getImage();
            var transform = actor.getTransform();
            transform.setVisible(false);
            transform.setZOrder(35);
            return actor;
        };
        /* creates fubatfeature coins */
        UIFactory.createCoins = function (scene, scalar, parent, asset, font) {
            var actors = [];
            for (var i = 0; i < UIFactory.NUM_COINS; i++) {
                var backgroundActor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
                backgroundActor.setName(UIFactory.COIN_NAME);
                var bgTransform = backgroundActor.getTransform();
                bgTransform.setVisible(false);
                bgTransform.setPosition(UIFactory.COIN_START_X[i], UIFactory.COIN_START_Y[i]);
                bgTransform.setZOrder(EEFConfig.COIN_ITEM_Z);
                actors.push(backgroundActor);
            }
            return actors;
        };
        UIFactory.createHighlights = function (scene, scalar, asset, font) {
            var arrayActors = [];
            var x = 75;
            var y = 52;
            for (var i = 0; i < UIFactory.NUM_HIGHLIGHTS; i++) {
                var Actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
                Actor.setName(UIFactory.HIGHLIGHT_NAME);
                var bgTransform = Actor.getTransform();
                bgTransform.setVisible(false);
                bgTransform.setPosition(x, y);
                x = x + 59;
                bgTransform.setZOrder(19);
                arrayActors.push(Actor);
            }
            return arrayActors;
        };
        /**
         * Creates the auto play spins remaining text
         * @method eef.UIFactory#createAutoPlaySpinsRemainingText
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {abg2d.Actor} parent The parent actor
         * @param {string} fontName The name of the font to use
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createAutoPlaySpinsRemainingText = function (scene, scalar, parent, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var text = actor.getText();
            text.setFont("75px " + fontName);
            text.setMaxLineWidth(UIFactory.AUTO_PLAY_ICON_WIDTH + 100);
            text.setLineHeight(1.2);
            text.setScalar(scalar);
            abg2d.TextFactory.createFillText(text, "#0000ff");
            var parentImage = parent.getImage();
            var transform = actor.getTransform();
            transform.setVisible(false);
            transform.setZOrder(EEFConfig.SPIN_BUTTON_Z + 1);
            return actor;
        };
        /**
         * Creates the icons for the auto play menu
         * @method eef.UIFactory#createAutoPlayIcons
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {abg2d.Actor} parent The parent actor used for positioning
         * @param {asset.ImageAsset} asset The image to use for the icon
         * @param {asset.FontAsset} font The font to use
         * @returns {abg2d.Actor[]} The list of icons
         */
        UIFactory.createAutoPlayIcons = function (scene, scalar, parent, asset, font) {
            var actors = [];
            for (var i = 0; i < UIFactory.NUM_AUTO_PLAY_ICONS; i++) {
                var textValue = UIFactory.AUTO_PLAY_SELECTIONS[i].toString();
                var dimensions = 66 * scalar;
                var backgroundActor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
                backgroundActor.setName(textValue);
                var textActor = abg2d.Factory.composeText(scene, backgroundActor);
                var text = textActor.getText();
                text.setFont("45px " + font.getFontName());
                text.setText(textValue);
                text.setMaxLineWidth(UIFactory.AUTO_PLAY_ICON_WIDTH);
                text.setLineHeight(1.2);
                text.setScalar(scalar);
                abg2d.TextFactory.createFillText(text, "#ffffff");
                var textTransform = textActor.getTransform();
                var textX = (text.getText().length < 3) ? 20 : 5;
                textTransform.setPosition(textX, 12);
                var bgTransform = backgroundActor.getTransform();
                bgTransform.setVisible(false);
                bgTransform.setPositionY(1070);
                bgTransform.setZOrder(EEFConfig.UI_SETTINGS_ITEM_Z);
                actors.push(backgroundActor);
            }
            return actors;
        };
        /**
         * Creates a settings sub menu
         * @method eef.UIFactory#createSubMenu
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} asset The image
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createSubMenu = function (scene, parent, scalar, asset) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            var image = actor.getImage();
            image.setAlign(6 /* Center */);
            var transform = actor.getTransform();
            transform.setPosition(0, parent.getTransform().getPositionY() - image.getHeight() / 2);
            transform.setZOrder(EEFConfig.UI_SETTINGS_ITEM_Z);
            transform.setVisible(false);
            return actor;
        };
        /* creates autoplaymenu */
        UIFactory.createSubMenu1 = function (scene, parent, scalar, asset) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            var image = actor.getImage();
            image.setAlign(6 /* Center */);
            var transform = actor.getTransform();
            transform.setPosition(0, parent.getTransform().getPositionY() - image.getHeight() / 2);
            transform.setZOrder(EEFConfig.UI_SETTINGS_ITEM_Z);
            transform.setVisible(false);
            return actor;
        };
        /**
         * Creates an icon for the settings panel
         * @method eef.UIFactory#createIcon
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} asset The image to use
         * @param {string} name The name of the actor
         * @param {number} yOffset The y position of the actor
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createAutoPlayIcon = function (scene, parent, scalar, asset, name, yOffset) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName(name);
            var transform = actor.getTransform();
            transform.setPosition(1665, 810);
            transform.setVisible(false);
            transform.setZOrder(20);
            return actor;
        };
        /**
         * Creates the settings button
         * @method eef.UIFactory#createSettingsButton
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} asset The image for the settings button
         * @param {number} yPos The y position
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createSettingsButton = function (scene, scalar, asset, yPos) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName("settingsButton");
            var transform = actor.getTransform();
            transform.setPosition(-2, yPos - actor.getImage().getHeight() - 150);
            transform.setZOrder(EEFConfig.UI_SETTINGS_BUTTON_Z);
            return actor;
        };
        /**
         * Creates the settings menu panel
         * @method eef.UIFactory#createSettingsMenuPanel
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {asset.ImageAsset} asset The asset to use
         * @param {number} scalar The scale factor
         * @param {number} yPos The y position
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createSettingsMenuPanel = function (scene, scalar, asset, yPos) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName("settingsPanel");
            var image = actor.getImage();
            image.setOpacity(0.90);
            var transform = actor.getTransform();
            transform.setPosition(-image.getWidth(), yPos - image.getHeight() - 150);
            transform.setVisible(false);
            transform.setZOrder(EEFConfig.UI_SETTINGS_ITEM_Z);
            return actor;
        };
        /**
         * Creates the settings menu panel
         * @method eef.UIFactory#createSettingsMenuPanel
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {asset.ImageAsset} asset The asset to use
         * @param {number} scalar The scale factor
         * @param {number} yPos The y position
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createMultiplierMenuPanel = function (scene, scalar, asset, yPos) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName("multiplierPanel");
            var image = actor.getImage();
            image.setOpacity(0.90);
            var transform = actor.getTransform();
            transform.setPosition(-image.getWidth(), yPos - image.getHeight() - 150);
            transform.setVisible(false);
            transform.setZOrder(EEFConfig.UI_SETTINGS_ITEM_Z);
            return actor;
        };
        UIFactory.createCreditsMenuPanel = function (scene, scalar, asset, yPos) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName("creditsPanel");
            var image = actor.getImage();
            image.setOpacity(0.90);
            var transform = actor.getTransform();
            transform.setPosition(2, 262);
            transform.setVisible(true);
            transform.setZOrder(15);
            return actor;
        };
        UIFactory.createBetMenuPanel = function (scene, scalar, asset, yPos) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.setName("betPanel");
            var image = actor.getImage();
            image.setOpacity(0.90);
            var transform = actor.getTransform();
            transform.setPosition(-image.getWidth(), yPos - image.getHeight() - 150);
            transform.setVisible(false);
            transform.setZOrder(EEFConfig.UI_SETTINGS_ITEM_Z);
            return actor;
        };
        /**
         * Creates the background for the game
         * @method eef.UIFactory#createBackground
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} background The background image
         * @returns {abg2d.Actor} The background actor
         */
        UIFactory.createBackground = function (scene, scalar, background) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(background, scalar));
            actor.setName("background");
            var image = actor.getImage();
            image.setAlign(6 /* Center */);
            actor.getTransform().setPosition(image.getWidth() / 2, image.getHeight() / 2);
            return actor;
        };
        /**
         * Creates a clickable box
         * @method eef.UIFactory#createClickableBox
         * @public
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} posX The x position
         * @param {number} posY The y position
         * @param {number} width The width
         * @param {number} height The height
         * @param {function} touchHandler The callback to notify when the box has been clicked
         * @param {string} name An optional name for the clickable box
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createClickableBox = function (scene, posX, posY, width, height, inputHandler, touchHandler, name) {
            var actor = abg2d.Factory.composeBox(scene, null);
            actor.setName(name);
            var rect = new abg2d.Rect();
            var box = actor.getBox();
            box.setColor("blue");
            box.getBounds(rect);
            box.setSize(width, height);
            box.setOpacity(0.001);
            var transform = actor.getTransform();
            transform.setPosition(posX, posY);
            transform.setZOrder(EEFConfig.SPIN_BUTTON_Z);
            var inputResolver = new input.InputResolver(transform.getTranslatedPositionX(), transform.getTranslatedPositionY(), box.getDrawWidth(), box.getDrawHeight());
            abg2d.Factory.composeInputRegion(actor, inputResolver, rect, touchHandler);
            inputHandler.addResolver(inputResolver);
            return actor;
        };
        /**
         * Creates the meter text
         * @method eef.UIFactory#createMeterText
         * @private static
         * @param {UIMeterTextCreationData} data The data that defines the meter text layout
         * @returns {abg2d.Actor} The created actor
         */
        UIFactory.createMeterText = function (data) {
            var actor = abg2d.Factory.composeText(data.scene, data.parent);
            var maxWidth = 0;
            var text = actor.getText();
            maxWidth = data.maxwidth;
            text.setMaxLineWidth(maxWidth);
            text.setScalar(data.scalar);
            text.setFont(data.fontSize + data.bundle.myriadProSemiBold.getFontName());
            abg2d.TextFactory.createFillText(text, data.color);
            var transform = actor.getTransform();
            actor.getText().setAlign(6 /* Center */);
            transform.setPosition(data.x, data.y);
            return actor;
        };
        UIFactory.createBetMeterText = function (data) {
            var actor = abg2d.Factory.composeText(data.scene, data.parent);
            var maxWidth = 0;
            var text = actor.getText();
            maxWidth = data.maxwidth;
            text.setMaxLineWidth(maxWidth);
            text.setLineHeight(1);
            text.setScalar(data.scalar);
            text.setFont(data.fontSize + data.bundle.myriadProSemiBold.getFontName());
            if (!this.isMobile()) {
                var strokeEffect = new abg2d.SolidStrokeEffect("#660000", 4);
                text.addEffect(strokeEffect);
            }
            abg2d.TextFactory.createFillText(text, data.color);
            var transform = actor.getTransform();
            actor.getText().setAlign(6 /* Center */);
            transform.setPosition(data.x, data.y);
            return actor;
        };
        UIFactory.createMeterLabel = function (scene, scalar, font, label, fontSize, positions, visible) {
            if (visible === void 0) { visible = true; }
            var alignment = 6 /* Center */;
            var positions = [positions[0], positions[1]];
            var textActor = abg2d.Factory.composeText(scene, null);
            var text = textActor.getText();
            text.setAlign(alignment);
            text.setMaxLineWidth(600);
            text.setLineHeight(1.25);
            textActor.getTransform().setPosition(positions[0], positions[1]);
            textActor.getTransform().setZOrder(EEFConfig.METER_BG_Z);
            text.setScalar(scalar);
            text.setFont(fontSize + " " + font.getFontName());
            var strokeEffect = new abg2d.SolidStrokeEffect("#3b0c0f", 4);
            text.addEffect(strokeEffect);
            text.addEffect(new abg2d.GradientFillEffect(["#ffffff", "#ffde00", "#d90000"], [0.2, 0.6, 1], 1.0, 1, 1, 1));
            textActor.getText().setText(label);
            textActor.getText().setVisible(visible);
            return textActor;
        };
        UIFactory.isMobile = function () {
            return (navigator.userAgent.match(/Android/i) != null || navigator.userAgent.match(/iPhone|iPad|iPod/i) != null);
        };
        UIFactory.createMeter = function (parent, scene, scalar, font, fontSize, positions, visible) {
            if (visible === void 0) { visible = true; }
            var alignment = 6 /* Center */;
            var image = parent.getImage();
            var positions = [positions[0], positions[1]];
            var textActor = abg2d.Factory.composeText(scene, parent);
            var text = textActor.getText();
            text.setAlign(alignment);
            textActor.getTransform().setPosition(positions[0], positions[1]);
            text.setScalar(scalar);
            text.setFont(fontSize + " " + font.getFontName());
            abg2d.TextFactory.createFillText(text, "#ffad00");
            textActor.getText().setVisible(visible);
            return textActor;
        };
        UIFactory.createMaxWinMeterTxt = function (parent, scene, scalar, font, fontSize, positions, visible) {
            if (visible === void 0) { visible = true; }
            var alignment = 6 /* Center */;
            var image = parent.getImage();
            var positions = [positions[0], positions[1]];
            var textActor = abg2d.Factory.composeText(scene, parent);
            var text = textActor.getText();
            text.setAlign(alignment);
            textActor.getTransform().setPosition(positions[0], positions[1]);
            text.setScalar(scalar);
            text.setFont(fontSize + " " + font.getFontName());
            abg2d.TextFactory.createFillText(text, "black");
            text.addEffect(new abg2d.SolidStrokeEffect("#000000", 8));
            text.addEffect(new abg2d.SolidStrokeEffect("#ff0000", 4));
            text.addEffect(new abg2d.ShadowTextEffect("#ff6e02", 8, 8, "#000000", 15));
            text.addEffect(new abg2d.GradientFillEffect(["#f66d24", "#ffff00", "#f66d24"], [0, 0.5, 1], 1.0, 0.0, 0, 0)); //these last two params do nothing     
            textActor.getText().setVisible(visible);
            return textActor;
        };
        UIFactory.createProviewMeterText = function (scene, scalar, font, fontSize, positions, visible) {
            if (visible === void 0) { visible = true; }
            var alignment = 6 /* Center */;
            var positions = [positions[0], positions[1]];
            var textActor = abg2d.Factory.composeText(scene, null);
            var text = textActor.getText();
            text.setAlign(alignment);
            textActor.getTransform().setPosition(positions[0], positions[1]);
            text.setScalar(scalar);
            text.setFont(fontSize + " " + font.getFontName());
            var strokeEffect = new abg2d.SolidStrokeEffect("#200001", 3);
            text.addEffect(strokeEffect);
            text.addEffect(new abg2d.GradientFillEffect(["#ffffff", "#fdff41"], [0, 1], 1, 1, 1, 1));
            textActor.getText().setVisible(visible);
            return textActor;
        };
        UIFactory.createText = function (parent, scene, scalar, font, fontSize, positions, textValue, strokeColor, strokePx, fontColor, gradient, visible) {
            if (visible === void 0) { visible = true; }
            var alignment = 6 /* Center */;
            var image = parent.getImage();
            var positions = [positions[0], positions[1]];
            var textActor = abg2d.Factory.composeText(scene, parent);
            var text = textActor.getText();
            text.setAlign(alignment);
            textActor.getTransform().setPosition(positions[0], positions[1]);
            text.setText(textValue);
            text.setScalar(scalar);
            text.setLineHeight(1.2);
            text.setFont(fontSize + " " + font.getFontName());
            var strokeEffect = new abg2d.SolidStrokeEffect(strokeColor, strokePx);
            text.addEffect(strokeEffect);
            if (gradient == 0) {
                abg2d.TextFactory.createFillText(text, fontColor);
            }
            else {
                text.addEffect(new abg2d.GradientFillEffect(["#ffffff", "#ffde00", "#d90000"], [0.2, 0.6, 1], 1.0, 1, 1, 1));
            }
            textActor.getText().setVisible(visible);
            return textActor;
        };
        UIFactory.createActiveSymbolTxt = function (scene, scalar, font, fontSize, positions, textValue, strokeColor, strokePx, fontColor, visible) {
            if (visible === void 0) { visible = true; }
            var alignment = 6 /* Center */;
            var positions = [positions[0], positions[1]];
            var textActor = abg2d.Factory.composeText(scene, null);
            var text = textActor.getText();
            text.setAlign(alignment);
            textActor.getTransform().setPosition(positions[0], positions[1]);
            text.setText(textValue);
            text.setLineHeight(1.2);
            text.setScalar(scalar);
            text.setFont(fontSize + " " + font.getFontName());
            var strokeEffect = new abg2d.SolidStrokeEffect(strokeColor, strokePx);
            text.addEffect(strokeEffect);
            abg2d.TextFactory.createFillText(text, "#ffe63c");
            textActor.getText().setVisible(visible);
            return textActor;
        };
        /* Create replay over lay
        * @method EEF.UIFactory#createReplayOverlay
        * @private static
        * @param {abg2d.Scene} scene The scene to put actors in
        * @param {number} scalar The scale factor
        * @param {asset.FontAsset} Font data
        * @returns {locale.Translator} Transulator
        */
        UIFactory.createReplayOverlay = function (scene, scalar, font, translator) {
            var actor = abg2d.Factory.composeVectorGraphics(scene, null, 1920, 1200);
            actor.getTransform().setZOrder(EEFConfig.REPLAY_Z);
            actor.getTransform().setVisible(false);
            var diffY = 50;
            var vgfx = actor.getVectorGraphics();
            vgfx.setOpacity(0.5);
            vgfx.beginFill("#000000");
            vgfx.rect(0, 0, 1920, 1200);
            var textActor = abg2d.Factory.composeText(scene, actor);
            textActor.getTransform().setPosition(vgfx.getWidth() / 2, vgfx.getHeight() / 2 - diffY);
            var text = textActor.getText();
            text.setAlign(6 /* Center */);
            text.setScalar(scalar);
            text.setOpacity(0.3);
            text.setFont("240px " + font.getFontName());
            abg2d.TextFactory.createFillText(text, "#FFFFFF");
            text.setText(translator.findByKey("Replay_txt"));
            return actor;
        };
        /**
         * Constant for HELP  button position
         * @member sym.UIFactory#HELP_BUTTON_POSITIONS
         * @private static
         * @type {number[]}
         */
        UIFactory.HELP_BUTTON_POSITIONS = [1658, 816];
        /**
         * Constant for HELP  button position
         * @member sym.UIFactory#SET_BUTTON_POSITIONS
         * @private static
         * @type {number[]}
         */
        UIFactory.SET_BUTTON_POSITIONS = [1658, 937];
        UIFactory.EXT_HELP_BUTTON_POSITIONS = [1800, 1100];
        /**
         * Constant for HELP  button position
         * @member sym.UIFactory#AUTO_BUTTON_POSITIONS
         * @private static
         * @type {number[]}
         */
        UIFactory.AUTO_BUTTON_POSITIONS = [20, 1080];
        /**
        * Constant for PLUS  button position
        * @member sym.UIFactory#PLUS_BUTTON_POSITIONS
        * @private static
        * @type {number[]}*/
        UIFactory.PLUS_BUTTON_POSITIONS = [100, 540];
        UIFactory.BET_PLUS_BUTTON_POSITIONS = [230, 961];
        /**
         * Constant for MINUS button position
         * @member sym.UIFactory#MINUS_BUTTON_POSITIONS
         * @private static
         * @type {number[]}*/
        UIFactory.MINUS_BUTTON_POSITIONS = [100, 740];
        UIFactory.BET_MINUS_BUTTON_POSITIONS = [4, 961];
        /**
             * Constant for stake/per meter position
             * @member 88f.UIFactory#STAKEPERLINE_METER_POSITIONS
             * @private static
             * @type {number[]}
             */
        UIFactory.STAKEPERLINE_METER_POSITIONS = [2, 320];
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#STAKEPERLINE_METER_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.MULTIPLIERE_METER_POSITIONS = [73, 965];
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#BOWL_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.BOWL_POSITIONS = [757, 35];
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#GRAND_METER_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.GRAND_METER_POSITIONS = [1555, 44];
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#MAJOR_METER_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.MAJOR_METER_POSITIONS = [1590, 180];
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#MINOR_METER_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.MINOR_METER_POSITIONS = [1648, 319];
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#MINI_METER_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.MINI_METER_POSITIONS = [1669, 439];
        UIFactory.COIN_GOLD_POSITIONS = [19, 52];
        UIFactory.INGOT_GOLD_POSITIONS = [75, 52];
        UIFactory.TURTLE_GOLD_POSITIONS = [134, 52];
        UIFactory.JUNK_GOLD_POSITIONS = [192, 52];
        UIFactory.PHOENIX_GOLD_POSITIONS = [252, 52];
        UIFactory.ALLUP_POSITIONS = [310, 52];
        UIFactory.COIN_GOLD_POSITIONS_MOB = [19, 97];
        UIFactory.INGOT_GOLD_POSITIONS_MOB = [75, 97];
        UIFactory.TURTLE_GOLD_POSITIONS_MOB = [134, 97];
        UIFactory.JUNK_GOLD_POSITIONS_MOB = [192, 97];
        UIFactory.PHOENIX_GOLD_POSITIONS_MOB = [252, 97];
        UIFactory.ALLUP_POSITIONS_MOB = [310, 97];
        UIFactory.INGOT_POSITIONS = [75, 117];
        UIFactory.TURTLE_POSITIONS = [134, 117];
        UIFactory.JUNK_POSITIONS = [192, 117];
        UIFactory.PHOENIX_POSITIONS = [252, 117];
        UIFactory.INGOT_POSITIONS_MOB = [75, 161];
        UIFactory.TURTLE_POSITIONS_MOB = [134, 161];
        UIFactory.JUNK_POSITIONS_MOB = [192, 161];
        UIFactory.PHOENIX_POSITIONS_MOB = [252, 161];
        UIFactory.BALANCE_TEXT_POSITIONS = [423, 1076];
        UIFactory.STAKE_TEXT_POSITIONS = [967, 1076];
        UIFactory.WIN_TEXT_POSITIONS = [1511, 1076];
        UIFactory.MAX_WIN_TEXT_POSITIONS = [1000, 500];
        UIFactory.MAX_WIN_AMT_TEXT_POSITIONS = [950, 750];
        UIFactory.BALANCE_METER_TEXT_POSITIONS = [423, 1146];
        UIFactory.STAKE_METER_TEXT_POSITIONS = [967, 1146];
        UIFactory.WIN_METER_TEXT_POSITIONS = [1511, 1146];
        UIFactory.ACTIVE_HIGHLIGHT_POSITION = [0, 16];
        UIFactory.ACTIVE_HIGHLIGHT_POSITION_MOB = [0, 61];
        UIFactory.scalar = 1;
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#BALANCE_METER_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.BALANCE_METER_POSITIONS = [300, 1080];
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#STAKE_METER_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.TOTALSTAKE_METER_POSITIONS = [750, 1080];
        /**
          * Constant for stake/per meter position
          * @member 88f.UIFactory#WIN_METER_POSITIONS
          * @private static
          * @type {number[]}
          */
        UIFactory.WIN_METER_POSITIONS = [1200, 1080];
        /**
         * Constant for spin button position
         * @member eef.UIFactory#SPIN_BUTTON_POSITIONS
         * @private static
         * @type {number[]}
         * @default [1550, 425]
         */
        UIFactory.SPIN_BUTTON_POSITIONS = [1613, 516];
        UIFactory.AUTO_PLAY_BUTTON_POSITIONS = [1725, 785];
        UIFactory.CREDITS_TEXT_POSITIONS = [130, 25];
        UIFactory.BET_TEXT_POSITIONS = [87, -19];
        UIFactory.GOLD_TEXT_POSITIONS = [90, 20];
        UIFactory.SYMBOL_TEXT_POSITIONS = [90, 40];
        UIFactory.PER_SPIN_TEXT_POSITIONS = [78, 105];
        UIFactory.ACTIVE_SYMBOL_TEXT_POSITIONS = [220, 25];
        UIFactory.ACTIVE_SYMBOL_TEXT_POSITIONS_MOB = [220, 77];
        /**
         * Constant value for meter box color
         * @member eef.UIFactory#METER_BOX_COLOR
         * @private static
         * @type {string}
         * @default "#0c0c0d"
         */
        UIFactory.METER_BOX_COLOR = "#0c0c0d";
        /**
         * Constant value for meter font color
         * @member eef.UIFactory#METER_BOX_FONT_COLOR
         * @private static
         * @type {string}
         * @default #e8ddc8
         */
        UIFactory.METER_BOX_FONT_COLOR = "#e8ddc8";
        /**
         * Constant value for the meter box height
         * @member eef.UIFactory#METER_BOX_HEIGHT
         * @private static
         * @type {number}
         * @default 25
         */
        UIFactory.METER_BOX_HEIGHT = 65;
        /**
         * Constant value for the number of auto play icons to display
         * @member eef.UIFactory#NUM_AUTO_PLAY_ICONS
         * @private static
         * @type {number}
         * @default 5
         */
        UIFactory.NUM_AUTO_PLAY_ICONS = 5;
        /**
         * Constant values for the list of auto play options
         * @member eef.UIFactory#AUTO_PLAY_SELECTIONS
         * @private static
         * @type {number[]}
         * @default [10, 20, 30, 40, 150]
         */
        UIFactory.AUTO_PLAY_SELECTIONS = [10, 20, 30, 40, 150];
        UIFactory.NUM_BET_MULTIPLIER_ICONS = 8;
        UIFactory.MULTIPLIER_SELECTIONS = [1, 2, 3, 6, 10, 25, 50, 100];
        UIFactory.MULTIPLIER_PLAY_ICON_WIDTH = 100;
        UIFactory.NUM_BET_ICONS = 5;
        UIFactory.BET_SELECTIONS = [8, 18, 38, 68, 88];
        UIFactory.BET_ICON_WIDTH = 100;
        UIFactory.NUM_COINS = 12;
        UIFactory.NUM_HIGHLIGHTS = 4;
        UIFactory.COIN_START_X = [317, 635, 953, 1271, 317, 635, 953, 1271, 317, 635, 953, 1271];
        UIFactory.COIN_START_Y = [222, 266, 266, 222, 511, 555, 555, 511, 800, 844, 844, 800];
        /**
         * Constant value for the width of an icon in the auto play menu
         * @member eef.UIFactory#AUTO_PLAY_ICON_WIDTH
         * @private static
         * @type {number}
         * @default 66
         */
        UIFactory.AUTO_PLAY_ICON_WIDTH = 100;
        UIFactory.AUTO_PLAY_BUTTON_NAME = "help";
        /**
         * Constant for Help Spin button name
         * @member eef.UIFactory#HELP_BUTTON_NAME
         * @private static
         * @type string
         */
        UIFactory.HELP_BUTTON_NAME = "help";
        /**
         * Constant for Help Spin button name
         * @member eef.UIFactory#SET_BUTTON_NAME
         * @private static
         * @type string
         */
        UIFactory.SET_BUTTON_NAME = "setting";
        UIFactory.EXT_HELP_BUTTON_NAME = "externalhelp";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#STAKE_METER_NAME
         * @private static
         * @type string
         */
        UIFactory.STAKE_METER_NAME = "stakemeter";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#MULTIPLIER_NAME
         * @private static
         * @type string
         */
        UIFactory.MULTIPLIER_NAME = "multiplier";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#MINOR_NAME
         * @private static
         * @type string
         */
        UIFactory.MINOR_NAME = "minor";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#MINI_NAME
         * @private static
         * @type string
         */
        UIFactory.MINI_NAME = "mini";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#MAJOR_NAME
         * @private static
         * @type string
         */
        UIFactory.MAJOR_NAME = "major";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#GRAND_NAME
         * @private static
         * @type string
         */
        UIFactory.GRAND_NAME = "grand";
        UIFactory.HIGHLIGHT_NAME = "highlight";
        UIFactory.COIN_GOLD_NAME = "coingold";
        UIFactory.INGOT_GOLD_NAME = "ingotgold";
        UIFactory.TURTLE_GOLD_NAME = "turtlegold";
        UIFactory.JUNK_GOLD_NAME = "junkgold";
        UIFactory.PHOENIX_GOLD_NAME = "phoenixgold";
        UIFactory.ALLUP_NAME = "allup";
        UIFactory.INGOT_NAME = "ingot";
        UIFactory.TURTLE_NAME = "turtle";
        UIFactory.JUNK_NAME = "junk";
        UIFactory.PHOENIX_NAME = "phoenix";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#BOWL_NAME
         * @private static
         * @type string
         */
        UIFactory.BOWL_NAME = "bowl";
        UIFactory.COIN_NAME = "coin";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#BALANCE_METER_NAME
         * @private static
         * @type string
         */
        UIFactory.BALANCE_METER_NAME = "balancemeter";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#TOTALSTAKE_METER_NAME
         * @private static
         * @type string
         */
        UIFactory.TOTALSTAKE_METER_NAME = "totalstakemeter";
        /**
         * Constant for stake meter name
         * @member eef.UIFactory#WIN_METER_NAME
         * @private static
         * @type string
         */
        UIFactory.WIN_METER_NAME = "winmeter";
        UIFactory.BALANCE_METER_TEXT = "BALANCE";
        UIFactory.STAKE_METER_TEXT = "STAKE";
        UIFactory.WIN_METER_TEXT = "WIN";
        UIFactory.CREDIT_METER_TEXT = "CREDITS";
        UIFactory.BET_METER_TEXT = "BET";
        UIFactory.PER_SPIN_TEXT = "PER SPIN";
        UIFactory.GOLD_METER_TEXT = "GOLD";
        UIFactory.SYMBOL_METER_TEXT = "SYMBOL";
        UIFactory.ACTIVE_SYMBOL_TEXT = "ACTIVE SYMBOL";
        return UIFactory;
    })();
    exports.UIFactory = UIFactory;
    /**
     * BigWinFactory
     * @class eef.BigWinFactory
     * @classdesc Handles actor creation for the big win show
     */
    var BigWinFactory = (function () {
        function BigWinFactory() {
        }
        /**
         * Creates the big win coin shower effect
         * @method eef.BigWinFactory#createCoins
         * @private static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {BigWinBundle} bundle The big win bundle with the assets
         * @returns {bigwin.BigWinCoinEffect} The coin shower
         */
        BigWinFactory.createCoins = function (scene, scalar, bundle) {
            var up = 270;
            var actor = abg2d.Factory.composeParticleSystem(scene, null, BigWinFactory.MAX_PARTICLE_COUNT);
            var system = actor.getParticleSystem();
            system.scaleX = 2;
            system.scaleY = 2;
            actor.getTransform().setZOrder(EEFConfig.BIG_WIN_COIN_Z);
            var coinSheet = new abg2d.SpriteSheet(bundle.coins, scalar);
            var sheets = [
                coinSheet,
                coinSheet,
                coinSheet,
                coinSheet,
            ];
            system.setSpriteSheets(sheets);
            system.setFramerate(16);
            system.setGravity(BigWinFactory.GRAVITY);
            var centerEmitter = BigWinFactory.createEmitter(scene, [BigWinFactory.EMITTER_CENTER, BigWinFactory.EMITTER_HEIGHT + coinSheet.getFrame(0).w], up, BigWinFactory.EMITTER_SPEED[0], BigWinFactory.EMITTER_SPREAD[0]);
            var leftEmitter = BigWinFactory.createEmitter(scene, [-coinSheet.getFrame(0).w, BigWinFactory.EMITTER_HEIGHT], up + BigWinFactory.EMITTER_SPRAY_ANGLE, BigWinFactory.EMITTER_SPEED[1], BigWinFactory.EMITTER_SPREAD[1]);
            var rightEmitter = BigWinFactory.createEmitter(scene, [BigWinFactory.RIGHT_EMITTER_X_POSITION + coinSheet.getFrame(0).w, BigWinFactory.EMITTER_HEIGHT], up - BigWinFactory.EMITTER_SPRAY_ANGLE, BigWinFactory.EMITTER_SPEED[1], BigWinFactory.EMITTER_SPREAD[1]);
            return new bigwin.BigWinCoinEffect(system, centerEmitter, leftEmitter, rightEmitter);
        };
        /**
         * Creates an emitter for the coin shower
         * @method eef.BigWinFactory#createEmitter
         * @public static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number[]} positions The x, y positions for the coins
         * @param {number} direction The direction to emit from
         * @param {number[]} speeds The speeds of the coins
         * @param {number[]} spreads The spreads of the coins
         * @returns {particleeffect.BasicEmitter} The created emitter
         */
        BigWinFactory.createEmitter = function (scene, positions, direction, speeds, spread) {
            var emitterActor = abg2d.Factory.composeTransform(scene, null);
            var transform = emitterActor.getTransform();
            transform.setPosition(positions[0], positions[1]);
            var emitter = new particleeffect.BasicEmitter(transform);
            emitter.setRate(BigWinFactory.EMIT_RATE);
            emitter.setLifetime(BigWinFactory.LIFETIME);
            emitter.setSpraySpeed(speeds[0], speeds[1]);
            emitter.setSpraySpread(spread);
            emitter.setSprayDirection(direction);
            return emitter;
        };
        /**
         * Creates the big win text
         * @method eef.BigWinFactory#createText
         * @public static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {abg2d.Actor} parent The parent actor
         * @param {number} scalar The scale factor
         * @param {string} fontName The name of the font to use
         * @returns {abg2d.Actor} The created actor
         */
        BigWinFactory.createText = function (scene, parent, scalar, fontName) {
            var actor = abg2d.Factory.composeText(scene, parent);
            var parentImage = parent.getImage();
            var text = actor.getText();
            text.setScalar(scalar);
            text.setAlign(6 /* Center */);
            text.setFont("70px " + fontName);
            text.setMaxLineWidth(parentImage.getDrawWidth() + 200);
            text.setLineHeight(1.5);
            text.setText("123.45");
            abg2d.TextFactory.createFillText(text, "white");
            actor.getTransform().setPosition(parentImage.getWidth() / 2, parentImage.getHeight() / 2);
            return actor;
        };
        /**
         * Creates the big win marquee
         * @method eef.BigWinFactory#createMarquee
         * @public static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} asset The image to use for the sprite sheet
         * @returns {abg2d.Actor} The created actor
         */
        BigWinFactory.createMarquee = function (scene, scalar, asset) {
            var actor = abg2d.Factory.composeImage(scene, null, new abg2d.SpriteSheet(asset, scalar));
            actor.getImage().setAlign(6 /* Center */);
            var transform = actor.getTransform();
            transform.setPosition(955, 630);
            transform.setScale(0, 0);
            transform.setZOrder(EEFConfig.MARQUEE_Z);
            return actor;
        };
        /**
         * Creates the glow animation
         * @method eef.BigWinFactory#createGlow
         * @public static
         * @param {abg2d.Scene} scene The scene to put actors in
         * @param {number} scalar The scale factor
         * @param {asset.ImageAsset} asset The asset to use for the animation
         * @returns {abg2d.Actor} The created actor
         */
        BigWinFactory.createGlow = function (scene, scalar, asset) {
            var actor = abg2d.Factory.composeFramedAnimation(scene, null);
            var image = actor.getImage();
            image.setSpriteSheet(new abg2d.SpriteSheet(asset, scalar));
            image.setAlign(6 /* Center */);
            var transform = actor.getTransform();
            transform.setPosition(965, 625);
            transform.setScale(0, 0);
            transform.setZOrder(EEFConfig.MARQUEE_Z - 1);
            var animator = actor.getFrameAnimator();
            animator.setFramerate(16);
            return actor;
        };
        /**
         * Constant value for the max particle count of the coin shower
         * @member eef.BigWinFactory#MAX_PARTICLE_COUNT
         * @private static
         * @type {number}
         * @default 90
         */
        BigWinFactory.MAX_PARTICLE_COUNT = 90;
        /**
         * Constant value for gravity
         * @member eef.BigWinFactory#GRAVITY
         * @private static
         * @type {number}
         * @default 1200
         */
        BigWinFactory.GRAVITY = 1200;
        /**
         * Constant value for the center position of the emitter
         * @member eef.BigWinFactory#EMITTER_CENTER
         * @private static
         * @type {number}
         * @default 500
         */
        BigWinFactory.EMITTER_CENTER = 960;
        /**
         * Constant value for the height of the emitter
         * @member eef.BigWinFactory#EMITTER_HEIGHT
         * @private static
         * @type {number}
         * @default 500
         */
        BigWinFactory.EMITTER_HEIGHT = 1100;
        /**
         * Constant value for the right most position of the emitter
         * @member eef.BigWinFactory#RIGHT_EMITTER_X_POSITION
         * @private static
         * @type {number}
         * @default 500
         */
        BigWinFactory.RIGHT_EMITTER_X_POSITION = 1920;
        /**
         * Constant value for the speed of the emitter
         * @member eef.BigWinFactory#EMITTER_SPEED
         * @private static
         * @type {number[][]}
         * @default [[1000, 1500], [1200, 1450]]
         */
        BigWinFactory.EMITTER_SPEED = [[1000, 1500], [1200, 1450]];
        /**
         * Constant value for the spread of the emitter
         * @member eef.BigWinFactory#EMITTER_SPREAD
         * @private static
         * @type {number[]}
         * @default [30, 5]
         */
        BigWinFactory.EMITTER_SPREAD = [30, 5];
        /**
         * Constant value for the spray angle of the emitter
         * @member eef.BigWinFactory#EMITTER_SPRAY_ANGLE
         * @private static
         * @type {number}
         * @default 35
         */
        BigWinFactory.EMITTER_SPRAY_ANGLE = 35;
        /**
         * Constant value for the emit rate
         * @member eef.BigWinFactory#EMIT_RATE
         * @private static
         * @type {number}
         * @default 10
         */
        BigWinFactory.EMIT_RATE = 10;
        /**
         * Constant value for the lifetime of a particle
         * @member eef.BigWinFactory#LIFETIME
         * @private static
         * @type {number}
         * @default 3
         */
        BigWinFactory.LIFETIME = 3;
        return BigWinFactory;
    })();
    exports.BigWinFactory = BigWinFactory;
    /**
     * Double Buffalo Spirit specific configurations
     * @class eef.EEFConfig
     * @classdesc Constants and other declarations for 88fortunes
     */
    var EEFConfig = (function () {
        function EEFConfig() {
        }
        /**
            * Reference of the CDN_ROOT path
            * @member eef.Config#CDN_ROOT
            * @public
            * @type {string}
            */
        EEFConfig.CDN_ROOT = "";
        /**
         * Number of displayed reels
         * @member eef.EEFConfig#NUMBER_OF_REELS
         * @public
         * @type {number}
         */
        EEFConfig.NUMBER_OF_REELS = 5;
        /**
         * Number of visible symbols in the reel
         * @member eef.EEFConfig#SYMBOLS_IN_REEL
         * @public static
         * @type {number}
         * @default 4
         */
        EEFConfig.SYMBOLS_IN_REEL = 5;
        /**
         * Symbol id for the bonus symbol
         * @member eef.EEFConfig#BONUS_SYMBOL_ID
         * @public static
         * @type {number}
         * @default 14
         */
        EEFConfig.BONUS_SYMBOL_ID = 1;
        /**
         * Symbol id for the h1 symbol
         * @member eef.EEFConfig#H1_SYMBOL_ID
         * @public static
         * @type {number}
         * @default 1
         */
        EEFConfig.H1_SYMBOL_ID = 16;
        EEFConfig.H2_SYMBOL_ID = 15;
        EEFConfig.H3_SYMBOL_ID = 14;
        EEFConfig.H4_SYMBOL_ID = 13;
        EEFConfig.H5_SYMBOL_ID = 12;
        EEFConfig.M1_SYMBOL_ID = 11;
        EEFConfig.M2_SYMBOL_ID = 10;
        EEFConfig.M3_SYMBOL_ID = 9;
        EEFConfig.M4_SYMBOL_ID = 8;
        EEFConfig.M5_SYMBOL_ID = 7;
        EEFConfig.L1_SYMBOL_ID = 6;
        EEFConfig.L2_SYMBOL_ID = 5;
        EEFConfig.L3_SYMBOL_ID = 4;
        EEFConfig.L4_SYMBOL_ID = 3;
        EEFConfig.L5_SYMBOL_ID = 2;
        EEFConfig.Z_BONUS_SYMBOL_ID = 1;
        EEFConfig.WILD_SYMBOL_ID = 0;
        EEFConfig.INITIAL_BG_REEL_INDICES = [0, 0, 0, 0, 0];
        EEFConfig.BOWL_POS = [860, 140];
        /**
         * GLM properties
         * @member eef.EEFConfig#GLM_INFO
         * @public
         * @type {IGLMDescription}
         */
        EEFConfig.GLM_INFO = {
            id: "20077",
            version: "1_0"
        };
        /**
         * Z indices to use in the game
         */
        EEFConfig.SYMBOL_Z = 5;
        EEFConfig.REEL_FRAME_Z = 2;
        EEFConfig.PANEL_FRAME_Z = 3;
        EEFConfig.SYMBOL_PULSE_Z = 15;
        EEFConfig.BIG_WIN_COIN_Z = 20;
        EEFConfig.MARQUEE_Z = 25;
        EEFConfig.UI_Z = 30;
        EEFConfig.UI_SETTINGS_ITEM_Z = 50;
        EEFConfig.COIN_ITEM_Z = 50;
        EEFConfig.WINSTACK_Z = EEFConfig.UI_SETTINGS_ITEM_Z;
        EEFConfig.UI_SETTINGS_BUTTON_Z = 55;
        EEFConfig.SPIN_BUTTON_Z = 999;
        EEFConfig.CREDITS_ICON_Z = 20;
        EEFConfig.METER_BG_Z = 20;
        EEFConfig.BUTTON_BG_Z = 20;
        EEFConfig.REPLAY_Z = 1500;
        EEFConfig.LAUNCH_Z = 900;
        EEFConfig.INIT = "init";
        EEFConfig.WAGER = "wager";
        EEFConfig.OUTCOME = "outcome";
        EEFConfig.JACKPOT_TXT = 21;
        EEFConfig.CLIENT_VERSION = "1.3.50";
        EEFConfig.SERVER_VERSION = " ";
        EEFConfig.LANGUAGE_CODES = ['en_GB', 'en_US', 'bg_BG', 'ca_ES', 'cs_CZ', 'da_DK', 'de_DE', 'el_GR', 'es_ES', 'et_EE', 'fi_FI', 'fr_FR', 'hr_HR', 'hu_HU', 'it_IT', 'lt_LT', 'lv_LV', 'nl_NL', 'no_NO', 'pl_PL', 'pt_PT', 'ro_RO', 'ru_RU', 'sk_SK', 'sl_SI', 'sv_SE', 'tr_TR', 'fr_CA'];
        EEFConfig.DEFAULT_LANGUAGE = EEFConfig.LANGUAGE_CODES[0];
        EEFConfig.IDLE_STATE = false;
        EEFConfig.CURRENT_LANGUAGE = EEFConfig.DEFAULT_LANGUAGE;
        return EEFConfig;
    })();
    exports.EEFConfig = EEFConfig;
});
