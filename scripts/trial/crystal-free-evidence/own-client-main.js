var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var game;
(function (game) {
    var Main = (function (_super) {
        __extends(Main, _super);
        function Main(partnerAdapter, metadata, partnerEventModel, balanceService, balanceListener) {
            _super.call(this);
            var countryCode = Utils.MiscUtils.getCountryCode(partnerAdapter, metadata);
            var path = "content/crystalforesthd_prt/resources/art/all/loadscreen/loadscreen";
            if (countryCode.toUpperCase() != "DE") {
                this.addLogo(path + "/sgi_loadscreen_logo_white-1920x1080.png");
            }
            this.addLogo(path + "/wi_loadscreen_logo_white-1920x1080.png");
            this._context = new game.GameContext(partnerAdapter, metadata, partnerEventModel, balanceService, balanceListener);
        }
        Main.prototype.addLogo = function (path) {
            var div = document.createElement("div");
            div.style.top = "0";
            div.style.bottom = "0";
            div.style.left = "0";
            div.style.right = "0";
            div.style.display = "block";
            div.style.position = "fixed";
            div.style.backgroundImage = "url(" + path + ")";
            div.style.backgroundRepeat = "no-repeat";
            div.style.backgroundSize = "contain";
            div.style.backgroundPosition = "center";
            document.getElementById("progress-bar-modal").appendChild(div);
        };
        Main.prototype.resetHard = function () {
            this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.ExternalEvent.RESET_HARD));
        };
        Main.prototype.startAutoplay = function (numSpins) {
            var event = new game.ExternalEvent(game.ExternalEvent.START_AUTOPLAY);
            event.numSpins = numSpins;
            this._context.eventDispatcher.dispatchEvent(event);
        };
        Main.prototype.stopAutoplay = function () {
            this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.ExternalEvent.STOP_AUTOPLAY));
        };
        Main.prototype.pauseGame = function () {
            this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.ExternalEvent.STOP_AUTOPLAY));
            util.PauseManager.pause();
            // PauseManager unmutes so if we're muted via partnerAdapter we need to fixed
            this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.GameEvent.REFRESH_MUTE));
        };
        Main.prototype.resumeGame = function () {
            this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.ExternalEvent.STOP_AUTOPLAY));
            util.PauseManager.resume();
            // PauseManager unmutes so if we're muted via partnerAdapter we need to fixed
            this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.GameEvent.REFRESH_MUTE));
        };
        Main.prototype.setOrientation = function (mode) {
            if (mode == 1) {
                this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.ExternalEvent.STOP_AUTOPLAY));
                util.PauseManager.resume();
                // PauseManager unmutes so if we're muted via partnerAdapter we need to fixed
                this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.GameEvent.REFRESH_MUTE));
            }
            else {
                this._context.eventDispatcher.dispatchEvent(new game.ExternalEvent(game.ExternalEvent.STOP_AUTOPLAY));
                util.PauseManager.pause();
            }
        };
        return Main;
    }(rendering.DisplayObjectContainer));
    game.Main = Main;
})(game || (game = {}));
var game;
(function (game) {
    var AudioEngine = (function () {
        function AudioEngine() {
            this._reelStopSounds = [];
        }
        AudioEngine.prototype.init = function (listener) {
            this._eventListener = listener;
            this._global = new audio.AudioGlobal();
            this.setVisibilityAPI();
            this._assetCache = new assets.AssetCache();
            // Global
            this._eventListener.addEventListener(game.GameEvent.REFRESH_MUTE, this.refreshMute, this);
            this._eventListener.addEventListener(game.GameEvent.HARD_RESET, this.reset, this);
            // Spin
            this._eventListener.addEventListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed, this);
            // Reels
            this._eventListener.addEventListener(game.GameEvent.REEL_1_CASCADED, this.onReelCascaded, this);
            this._eventListener.addEventListener(game.GameEvent.REEL_2_CASCADED, this.onReelCascaded, this);
            this._eventListener.addEventListener(game.GameEvent.REEL_3_CASCADED, this.onReelCascaded, this);
            this._eventListener.addEventListener(game.GameEvent.REEL_4_CASCADED, this.onReelCascaded, this);
            this._eventListener.addEventListener(game.GameEvent.REEL_5_CASCADED, this.onReelCascaded, this);
            // Win Meter
            this._eventListener.addEventListener(game.GameEvent.WIN_COUNT_UP_COMPLETE, this.onWinCountUpComplete, this);
            // Symbols
            this._eventListener.addEventListener(game.GameEvent.REMOVE_SYMBOL, this.onSymbolExploded, this);
            // FSG Anticipation
            this._eventListener.addEventListener(game.GameEvent.FSG_ANTICIPATION, this.onFSGAnticipation, this);
            // FSG Siren
            this._eventListener.addEventListener(game.GameEvent.FSG_SIREN, this.onFSGSiren, this);
            // FSG Triggers
            this._eventListener.addEventListener(game.GameEvent.HAS_NO_WINS, this.onFSGTriggersReset, this);
            // FSG
            this._eventListener.addEventListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSG, this);
            this._eventListener.addEventListener(game.GameEvent.SHOWING_EXTRA_FREE_SPINS_COMPLETE, this.onShowingExtraSpinsComplete, this);
            this._eventListener.addEventListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onPlayFreeSpinsButtonsPressed, this);
            this._eventListener.addEventListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame, this);
            this._eventListener.addEventListener(game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME, this.onRecoveryIntoFG, this);
            // Help Exit/Prev/Next
            this._eventListener.addEventListener(game.GameEvent.HELP_BUTTON_PRESSED, this.onHelpButton, this);
            this._eventListener.addEventListener(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this.onHelpButton, this);
            this._eventListener.addEventListener(game.GameEvent.HELP_NEXT_BUTTON_PRESSED, this.onHelpButton, this);
            this._eventListener.addEventListener(game.GameEvent.HELP_PREVIOUS_BUTTON_PRESSED, this.onHelpButton, this);
            // Autoplay
            this._eventListener.addEventListener(game.GameEvent.AUTOPLAY_BUTTON_PRESSED, this.onAutoplayButton, this);
            this._eventListener.addEventListener(game.ExternalEvent.START_AUTOPLAY, this.onAutoplayStart, this);
            this._eventListener.addEventListener(game.AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED, this.onAutoplayStopped, this);
            // Big win
            this._eventListener.addEventListener(game.GameEvent.PLAY_BIG_WIN_SOUND, this.onPlayBigWinSound, this);
            this._eventListener.addEventListener(game.GameEvent.PLAY_SUPER_WIN_SOUND, this.onPlaySuperWinSound, this);
            this._eventListener.addEventListener(game.GameEvent.PLAY_MEGA_WIN_SOUND, this.onPlayMegaWinSound, this);
            this._eventListener.addEventListener(game.GameEvent.STOP_BIG_WIN_SOUNDS, this.onStopAllBigWinSounds, this);
            this._eventListener.addEventListener(game.GameEvent.STOP_BIG_WIN_SOUND, this.onStopBigWinSound, this);
            this._eventListener.addEventListener(game.GameEvent.STOP_SUPER_WIN_SOUND, this.onStopSuperWinSound, this);
            this._eventListener.addEventListener(game.GameEvent.STOP_MEGA_WIN_SOUND, this.onStopMegaWinSound, this);
            this._eventListener.addEventListener(game.GameEvent.PLAY_BIG_WIN_VOICE, this.onPlayBigWinVoice, this);
            this._eventListener.addEventListener(game.GameEvent.PLAY_SUPER_WIN_VOICE, this.onPlaySuperWinVoice, this);
            this._eventListener.addEventListener(game.GameEvent.PLAY_MEGA_WIN_VOICE, this.onPlayMegaWinVoice, this);
            this._eventListener.addEventListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange, this);
            this._eventListener.addEventListener(components.CyclerEvent.ON_NEXT_RESULT, this.onBankWin, this);
            this._eventListener.addEventListener(components.CyclerEvent.ON_DISPLAY, this.onCyclerStart, this);
            this._eventListener.addEventListener(components.CyclerEvent.ON_COMPLETE, this.onCyclerEnd, this);
            this._eventListener.addEventListener(game.GameEvent.PLAY_WIN_BANG_UP, this.onPlayWinBangUp, this);
            // Intro Panel audio
            this._eventListener.addEventListener(game.GameStateEvent.ExitSubgame(game.Subgame.PRE_GAME), this.onPreGameExit, this);
        };
        AudioEngine.prototype.partnerAdapterMute = function (value) {
            this._partnerAdapterMuted = value;
            this.mute(value);
        };
        AudioEngine.prototype.mute = function (value) {
            Utils.PSLog.log("AudioEngine::mute(" + value + ")");
            if (value) {
                this._global.mute();
            }
            else {
                if (!this._partnerAdapterMuted) {
                    this._global.unmute();
                }
            }
        };
        // Pre-create any crucially time sensitive sounds here to avoid delays
        AudioEngine.prototype.preload = function () {
            // Pre-create and trim the reel stop sound slightly to remove any potential delay
            var reelstopBase = game.AudioBundle.CF_ReelDrop1.name.slice(0, game.AudioBundle.CF_ReelDrop1.name.length - 1);
            for (var reelIdx = 1; reelIdx < 6; ++reelIdx) {
                var soundAsset = this._assetCache.getAssetById(reelstopBase + reelIdx.toString());
                var sound = new audio.AudioSound(soundAsset);
                sound.setVolume(1);
                sound.loop(false);
                this._reelStopSounds.push(sound);
            }
        };
        AudioEngine.prototype.play = function (name, volume) {
            if (volume === void 0) { volume = 0.5; }
            var soundAsset = this._assetCache.getAssetById(name);
            var sound = new audio.AudioSound(soundAsset);
            sound.setVolume(volume);
            sound.play();
            return sound;
        };
        AudioEngine.prototype.PlayLoopFull = function (name) {
            var soundAsset = this._assetCache.getAssetById(name);
            var sound = new audio.AudioSound(soundAsset);
            sound.loop(true);
            sound.play();
            return sound;
        };
        AudioEngine.prototype.playFromTo = function (name, startTime, playLength) {
            var soundAsset = this._assetCache.getAssetById(name);
            var playSpec = { duration: playLength, startTime: startTime };
            var sound = new audio.AudioSound(soundAsset, playSpec);
            sound.play();
            return sound;
        };
        AudioEngine.prototype.playLoop = function (name, loopStart, loopDuration, volume, fadeIn) {
            if (fadeIn === void 0) { fadeIn = 0; }
            var soundAsset = this._assetCache.getAssetById(name);
            var loopSpec = { duration: loopDuration, startTime: loopStart };
            var sound = new audio.AudioSound(soundAsset, loopSpec);
            sound.setVolume(volume);
            sound.loop(true);
            if (fadeIn > 0)
                sound.fadeIn(fadeIn);
            sound.play();
            return sound;
        };
        AudioEngine.prototype.refreshMute = function () {
            if (this._partnerAdapterMuted) {
                this.mute(true);
            }
            else {
                this.mute(false);
            }
        };
        // FSG Triggers
        AudioEngine.prototype.onFSGAnticipation = function () {
            this._fsgAnticipationLoop = this.PlayLoopFull(game.AudioBundle.CF_FSG_Anticipation.name);
        };
        AudioEngine.prototype.onFSGTriggersReset = function () {
            if (this._fsgAnticipationLoop) {
                this._fsgAnticipationLoop.stop();
            }
        };
        AudioEngine.prototype.onFSGSiren = function () {
            if (this._fsgAnticipationLoop) {
                this._fsgAnticipationLoop.stop();
            }
            this._fsgSirenLoop = this.PlayLoopFull(game.AudioBundle.CF_FSG_Siren.name);
        };
        AudioEngine.prototype.onEnterFSG = function () {
            if (this._fsgSirenLoop) {
                this._fsgSirenLoop.stop();
            }
            this._fsgIntroLoop = this.PlayLoopFull(game.AudioBundle.CF_FSG_Intro.name);
        };
        AudioEngine.prototype.onShowingExtraSpinsComplete = function () {
            if (this._fsgSirenLoop) {
                this._fsgSirenLoop.stop();
            }
        };
        AudioEngine.prototype.onPlayFreeSpinsButtonsPressed = function () {
            if (this._fsgIntroLoop) {
                this._fsgIntroLoop.stop();
                this._fsgIntroLoop = undefined;
            }
            this.play(game.AudioBundle.CF_FSG_Start.name);
            this._fsgBackgroundMusic = this.PlayLoopFull(game.AudioBundle.CF_FSG_Theme.name);
        };
        AudioEngine.prototype.onReturnToBaseGame = function () {
            if (this._fsgBackgroundMusic) {
                this._fsgBackgroundMusic.stop();
                this._fsgBackgroundMusic = undefined;
            }
        };
        AudioEngine.prototype.onReelCascaded = function (event) {
            switch (event.eventName) {
                case "GameEvent_REEL_1_CASCADED":
                    this.play(game.AudioBundle.CF_ReelDrop1.name, 0.25);
                    break;
                case "GameEvent_REEL_2_CASCADED":
                    this.play(game.AudioBundle.CF_ReelDrop2.name, 0.25);
                    break;
                case "GameEvent_REEL_3_CASCADED":
                    this.play(game.AudioBundle.CF_ReelDrop3.name, 0.25);
                    break;
                case "GameEvent_REEL_4_CASCADED":
                    this.play(game.AudioBundle.CF_ReelDrop4.name, 0.25);
                    break;
                case "GameEvent_REEL_5_CASCADED":
                    this.play(game.AudioBundle.CF_ReelDrop5.name, 0.25);
                    break;
            }
        };
        AudioEngine.prototype.onSymbolExploded = function () {
            this.play(game.AudioBundle.CF_Explode.name);
        };
        AudioEngine.prototype.onSpinButtonPressed = function () {
            Utils.PSLog.log("AudioEngine::onSpinButtonPressed()");
            this.play(game.AudioBundle.RG_SpinButton.name);
        };
        AudioEngine.prototype.onPlayWinBangUp = function () {
            if (this._hasWinsLoop) {
                this._hasWinsLoop.stop();
            }
            this._hasWinsLoop = this.PlayLoopFull(game.AudioBundle.CF_Has_Wins.name);
        };
        AudioEngine.prototype.onRecoveryIntoFG = function () {
            if (this._fsgIntroLoop) {
                this._fsgIntroLoop.stop();
                this._fsgIntroLoop = undefined;
            }
            this._fsgBackgroundMusic = this.PlayLoopFull(game.AudioBundle.CF_FSG_Theme.name);
        };
        AudioEngine.prototype.onWinCountUpComplete = function (e) {
            var didSkipPaycycles = e.id;
            if (!game.BigMegaWinParticlesView.isActive && this._hasWinsLoop) {
                this._hasWinsLoop.fadeOut(100);
            }
            /*
             Big win sounds have their own ending - do not play the standard bang up ending if we had a big win
             */
            if (game.BigMegaWinParticlesView.isActive && didSkipPaycycles) {
                // User has skipped a big win
                this.onBigWinSkipped();
            }
            else if (game.BigMegaWinParticlesView.isActive && !didSkipPaycycles) {
            }
            else if (didSkipPaycycles) {
                // User has skipped a non big win
                this.play(game.AudioBundle.CF_Show_Wins_Complete.name, 0.7);
            }
            else {
                // User has waited for the win count to complete
                this.play(game.AudioBundle.CF_Show_Wins_Complete.name, 0.7);
            }
        };
        AudioEngine.prototype.onPlayBigWinSound = function () {
            if (this._hasWinsLoop) {
                this._hasWinsLoop.stop();
            }
            // If FG background is playing, pause it
            if (this._fsgBackgroundMusic) {
                this._fsgBackgroundMusic.pause();
            }
            this._bigWinSound = this.play(game.AudioBundle.CF_Big_Win.name, 0.7);
        };
        AudioEngine.prototype.onPlaySuperWinSound = function () {
            this._superWinSound = this.play(game.AudioBundle.CF_Super_Win.name, 0.8);
            this._bigWinSound.setVolume(0.4);
        };
        AudioEngine.prototype.onPlayMegaWinSound = function () {
            this._megaWinSound = this.play(game.AudioBundle.CF_Mega_Win.name, 0.9);
            this._superWinSound.setVolume(0.5);
        };
        AudioEngine.prototype.onStopAllBigWinSounds = function () {
            this.onStopBigWinSound();
            this.onStopSuperWinSound();
            this.onStopMegaWinSound();
            this.checkIfFGBackgroundMusicShouldBeResumed();
        };
        AudioEngine.prototype.checkIfFGBackgroundMusicShouldBeResumed = function () {
            if (this._fsgBackgroundMusic) {
                this._fsgBackgroundMusic.fadeIn(100);
            }
        };
        AudioEngine.prototype.onBigWinSkipped = function () {
            if (this._bigWinSound) {
                this._bigWinSound.stop();
                this._bigWinSound = undefined;
                this.play(game.AudioBundle.CF_Big_Win_End.name);
            }
            if (this._superWinSound) {
                this._superWinSound.stop();
                this._superWinSound = undefined;
                this.play(game.AudioBundle.CF_Super_Win_End.name);
            }
            if (this._megaWinSound) {
                this._megaWinSound.stop();
                this._megaWinSound = undefined;
                this.play(game.AudioBundle.CF_Mega_Win_End.name);
            }
            this.checkIfFGBackgroundMusicShouldBeResumed();
        };
        AudioEngine.prototype.onPlayBigWinVoice = function () {
            var _this = this;
            var rand = Math.floor(Math.random() * 3) + 1;
            this._bigWinVoice = this.play(game.AudioBundle[("CF_Big_Win_Voice" + rand)].name, 0.65);
            if (this._bigWinSound) {
                this._bigWinSound.fadeTo(0.3, 75);
                TweenMax.delayedCall(0.9, function () {
                    _this._bigWinSound.fadeTo(0.7, 75);
                });
            }
        };
        AudioEngine.prototype.onPlaySuperWinVoice = function () {
            var _this = this;
            var rand = Math.floor(Math.random() * 2) + 1;
            this._superWinVoice = this.play(game.AudioBundle[("CF_Super_Win_Voice" + rand)].name, 0.75);
            if (this._superWinVoice) {
                this._superWinSound.fadeTo(0.4, 75);
                TweenMax.delayedCall(0.9, function () {
                    _this._superWinSound.fadeTo(0.8, 75);
                });
            }
        };
        AudioEngine.prototype.onPlayMegaWinVoice = function () {
            var _this = this;
            var rand = Math.floor(Math.random() * 2) + 1;
            this._megaWinVoice = this.play(game.AudioBundle[("CF_Mega_Win_Voice" + rand)].name, 0.85);
            if (this._megaWinSound) {
                this._megaWinSound.fadeTo(0.5, 75);
                TweenMax.delayedCall(0.9, function () {
                    _this._megaWinSound.fadeTo(0.9, 75);
                });
            }
        };
        AudioEngine.prototype.onStopBigWinSound = function () {
            if (this._bigWinSound) {
                this._bigWinSound.stop();
                this._bigWinSound = undefined;
            }
        };
        AudioEngine.prototype.onStopSuperWinSound = function () {
            if (this._superWinSound) {
                this._superWinSound.stop();
                this._superWinSound = undefined;
            }
        };
        AudioEngine.prototype.onStopMegaWinSound = function () {
            if (this._megaWinSound) {
                this._megaWinSound.stop();
                this._megaWinSound = undefined;
            }
        };
        // Help
        AudioEngine.prototype.onHelpButton = function (event) {
            switch (event.eventName) {
                case "GameEvent_HELP_BUTTON_PRESSED":
                    this.play(game.AudioBundle.CF_Help_Opened.name);
                    break;
                case "GameEvent_HELP_CLOSE_BUTTON_PRESSED":
                    this.play(game.AudioBundle.CF_Help_Closed.name);
                    break;
                case "GameEvent_HELP_NEXT_BUTTON_PRESSED":
                    this.play(game.AudioBundle.CF_Help_Next.name);
                    break;
                case "GameEvent_HELP_PREVIOUS_BUTTON_PRESSED":
                    this.play(game.AudioBundle.CF_Help_Previous.name);
                    break;
            }
        };
        /////////////////////////////////////////////////////////
        // Autoplay
        AudioEngine.prototype.onAutoplayButton = function () {
            this.play(game.AudioBundle.RG_SpinButton.name);
        };
        AudioEngine.prototype.onAutoplayStart = function () {
            this.play(game.AudioBundle.RG_SpinButton.name);
        };
        AudioEngine.prototype.onAutoplayStopped = function () {
            this.play(game.AudioBundle.RG_SpinButton.name);
        };
        /////////////////////////////////////////////////////////
        // Stake Changes
        AudioEngine.prototype.onStakeChange = function () {
            if (this.stateModel.currentSubgame === game.Subgame.BASE_GAME) {
                var currentStakeIndex = (this.stakeModel.getCurrStakeIdx() + 1) % 5;
                var audioAssetName;
                switch (currentStakeIndex) {
                    case 0:
                        audioAssetName = game.AudioBundle.CF_StakeChangeA.name;
                        break;
                    case 1:
                        audioAssetName = game.AudioBundle.CF_StakeChangeB.name;
                        break;
                    case 2:
                        audioAssetName = game.AudioBundle.CF_StakeChangeC.name;
                        break;
                    case 3:
                        audioAssetName = game.AudioBundle.CF_StakeChangeD.name;
                        break;
                    case 4:
                        audioAssetName = game.AudioBundle.CF_StakeChangeE.name;
                        break;
                }
                this.play(audioAssetName);
            }
        };
        /////////////////////////////////////////////////////////
        // Winlines
        AudioEngine.prototype.onBankWin = function (e) {
        };
        AudioEngine.prototype.onCyclerStart = function (e) {
        };
        AudioEngine.prototype.onCyclerEnd = function (e) {
        };
        // Intro
        AudioEngine.prototype.onPreGameExit = function () {
            this.play(game.AudioBundle.CF_Intro.name);
        };
        /////////////////////////////////////////////////////////
        // Hooks into external events
        AudioEngine.prototype.reset = function () {
            if (this._baseGameSpinLoop) {
                this._baseGameSpinLoop.stop();
                this._baseGameSpinLoop = undefined;
            }
        };
        AudioEngine.prototype.setVisibilityAPI = function () {
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
            if (typeof document.addEventListener === "undefined" ||
                typeof document[this._myHidden] === "undefined") {
                console.log("Page Visibility API not suppported, unable to stop audio on minimise");
            }
            else {
                // Handle page visibility change   
                document.addEventListener(this._myVisibilityChange, function () { _this.handleVisibilityChange(); }, false);
            }
        };
        AudioEngine.prototype.handleVisibilityChange = function () {
            if (document[this._myHidden]) {
                this.mute(true);
            }
            else {
                this.mute(false);
            }
        };
        return AudioEngine;
    }());
    game.AudioEngine = AudioEngine;
})(game || (game = {}));
var game;
(function (game) {
    var BaseCmd = (function (_super) {
        __extends(BaseCmd, _super);
        function BaseCmd() {
            _super.apply(this, arguments);
        }
        BaseCmd.prototype.doDeferredDispatch = function (event, delay, global) {
            if (delay === void 0) { delay = 0.1; }
            if (global === void 0) { global = false; }
            if (global) {
                TweenMax.delayedCall(delay, this.doGlobalDispatch, [event], this);
            }
            else {
                TweenMax.delayedCall(delay, this.deferredDispatch, [event], this);
            }
        };
        BaseCmd.prototype.doImmediateDispatch = function (event) {
            this.eventDispatcher.dispatchEvent(event);
        };
        BaseCmd.prototype.doGlobalDispatch = function (event) {
            this._dragonwingify.doGlobalDispatch(event);
        };
        BaseCmd.prototype.deferredDispatch = function (event) {
            this.eventDispatcher.dispatchEvent(event);
        };
        __decorate([
            inject('DragonWingify')
        ], BaseCmd.prototype, "_dragonwingify", void 0);
        return BaseCmd;
    }(dragonwings.Command));
    game.BaseCmd = BaseCmd;
})(game || (game = {}));
var game;
(function (game) {
    var DoNextAutoplayCmd = (function (_super) {
        __extends(DoNextAutoplayCmd, _super);
        function DoNextAutoplayCmd() {
            _super.apply(this, arguments);
        }
        DoNextAutoplayCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("DoNextAutoplayCmd");
            if (this._stateModel.currentSubgame == game.Subgame.BASE_GAME && this._stateModel.currentSubgameState === "idle" && this._autoplayModel.isInProgress()) {
                this._autoplayModel.doNextAutoplay();
            }
        };
        __decorate([
            inject('AutoPlayModel')
        ], DoNextAutoplayCmd.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('GameStateModel')
        ], DoNextAutoplayCmd.prototype, "_stateModel", void 0);
        return DoNextAutoplayCmd;
    }(dragonwings.Command));
    game.DoNextAutoplayCmd = DoNextAutoplayCmd;
})(game || (game = {}));
var game;
(function (game) {
    var InitAutoplayCmd = (function (_super) {
        __extends(InitAutoplayCmd, _super);
        function InitAutoplayCmd() {
            _super.apply(this, arguments);
        }
        InitAutoplayCmd.prototype.execute = function () {
            var _this = this;
            Utils.PSLog.log("InitAutoplayCmd - setManager and init");
            this._autoplayModel.setManager(this._partnerAdapter.partnerAutoplayManager);
            this._autoplayModel.init(this._stakeModel.getTotalStake(), this.getBalance(this._server.getInitResponse().balanceData));
            this._partnerAdapter.receivedGameLogicResponse(this._server.getInitResquester().getRequestObject());
            var cancelButton = document.getElementById("autoplay-setting-button-cancel");
            cancelButton.addEventListener('click', function () {
                _this.eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.AUTOPLAY_MENU_CANCELLED));
            });
        };
        InitAutoplayCmd.prototype.getBalance = function (balanceData) {
            var balance = -1;
            if (balanceData.hasBalance(server.BalanceType.CASH_BALANCE)) {
                balance = balanceData.getBalance(server.BalanceType.CASH_BALANCE);
            }
            return balance;
        };
        __decorate([
            inject('AutoPlayModel')
        ], InitAutoplayCmd.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('StakeModel')
        ], InitAutoplayCmd.prototype, "_stakeModel", void 0);
        __decorate([
            inject('GameServer')
        ], InitAutoplayCmd.prototype, "_server", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], InitAutoplayCmd.prototype, "_partnerAdapter", void 0);
        return InitAutoplayCmd;
    }(dragonwings.Command));
    game.InitAutoplayCmd = InitAutoplayCmd;
})(game || (game = {}));
var game;
(function (game) {
    var LaunchAutoplayCmd = (function (_super) {
        __extends(LaunchAutoplayCmd, _super);
        function LaunchAutoplayCmd() {
            _super.apply(this, arguments);
        }
        /**
         * Launch the external Autoplay interface
         * LaunchAutoplayCmd triggered by GameEvent.AUTOPLAY_BUTTON_PRESSED in GameContext
         */
        LaunchAutoplayCmd.prototype.execute = function () {
            Utils.PSLog.log("LaunchAutoplayCmd");
            this._autoplayModel.launch(this._stakeModel.getTotalStake(), this.getBalance(this._server.getInitResponse().balanceData));
        };
        LaunchAutoplayCmd.prototype.getBalance = function (balanceData) {
            var balance = -1;
            if (balanceData.hasBalance(server.BalanceType.CASH_BALANCE)) {
                balance = balanceData.getBalance(server.BalanceType.CASH_BALANCE);
            }
            return balance;
        };
        __decorate([
            inject('AutoPlayModel')
        ], LaunchAutoplayCmd.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('StakeModel')
        ], LaunchAutoplayCmd.prototype, "_stakeModel", void 0);
        __decorate([
            inject('GameServer')
        ], LaunchAutoplayCmd.prototype, "_server", void 0);
        return LaunchAutoplayCmd;
    }(dragonwings.Command));
    game.LaunchAutoplayCmd = LaunchAutoplayCmd;
})(game || (game = {}));
var game;
(function (game) {
    var StartAutoplayCmd = (function (_super) {
        __extends(StartAutoplayCmd, _super);
        function StartAutoplayCmd() {
            _super.apply(this, arguments);
        }
        StartAutoplayCmd.prototype.execute = function () {
            Utils.PSLog.log("StartAutoplayCmd");
            this._autoplayModel.start(this.event.numSpins);
            this._autoplayModel.doNextAutoplay();
        };
        __decorate([
            inject('AutoPlayModel')
        ], StartAutoplayCmd.prototype, "_autoplayModel", void 0);
        return StartAutoplayCmd;
    }(dragonwings.Command));
    game.StartAutoplayCmd = StartAutoplayCmd;
})(game || (game = {}));
var game;
(function (game) {
    var StopAutoplayCmd = (function (_super) {
        __extends(StopAutoplayCmd, _super);
        function StopAutoplayCmd() {
            _super.apply(this, arguments);
        }
        StopAutoplayCmd.prototype.execute = function () {
            Utils.PSLog.log("StopAutoplayCmd");
            this._autoplayModel.stop();
        };
        __decorate([
            inject('AutoPlayModel')
        ], StopAutoplayCmd.prototype, "_autoplayModel", void 0);
        return StopAutoplayCmd;
    }(dragonwings.Command));
    game.StopAutoplayCmd = StopAutoplayCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CheckForWinsCmd = (function (_super) {
        __extends(CheckForWinsCmd, _super);
        function CheckForWinsCmd() {
            _super.apply(this, arguments);
            this._historyReplay = false;
        }
        CheckForWinsCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CheckForWinsCmd->execute()");
            var logicResponse = this._server.getLogicResponse();
            var cascades = logicResponse.cascades;
            if (cascades.length > 0) {
                // if win model is empty, populate it with the results
                if (this._winInfoModel.isEmpty) {
                    Utils.PSLog.log("WinDataModel is empty - populate it with win result");
                    this._winInfoModel.set(cascades);
                    cascades.forEach(function (cascade) {
                        _this._winInfoModel.addCascadeWin(cascade.cascadeWins);
                    });
                }
                if (this._winInfoModel.getWinDataForCurrentCycle()) {
                    this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HAS_WINS, this));
                    this._winInfoModel.hasSkippedLastPayLines = false;
                    this._cyclers.startCyclers();
                }
                else {
                    Utils.PSLog.log("ShowWinsCmd::execute() - no win, sending SHOW_WINS_COMPLETE");
                    this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HAS_NO_WINS, this));
                    this._winInfoModel.clear();
                }
            }
            else {
                Utils.PSLog.log("ShowWinsCmd::execute() - no win, sending SHOW_WINS_COMPLETE");
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HAS_NO_WINS, this));
                this._winInfoModel.clear();
            }
        };
        __decorate([
            inject('GameServer')
        ], CheckForWinsCmd.prototype, "_server", void 0);
        __decorate([
            inject('CyclersModel')
        ], CheckForWinsCmd.prototype, "_cyclers", void 0);
        __decorate([
            inject('WinInfoModel')
        ], CheckForWinsCmd.prototype, "_winInfoModel", void 0);
        return CheckForWinsCmd;
    }(game.BaseCmd));
    game.CheckForWinsCmd = CheckForWinsCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CheckIfCanCascadeCmd = (function (_super) {
        __extends(CheckIfCanCascadeCmd, _super);
        function CheckIfCanCascadeCmd() {
            _super.apply(this, arguments);
        }
        CheckIfCanCascadeCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            // Reels will cascade if:
            // 1. Paycycles have rotated AT LEAST once AND The win count up animation has completed;
            // OR
            // 2. The player has decided to skip the cyclers by clicking on the UI
            if (this._winInfoModel.hasSkippedLastPayLines) {
                this.cascade();
            }
            else {
                CheckIfCanCascadeCmd.count++;
                if (CheckIfCanCascadeCmd.count % 2 === 0) {
                    if (CheckIfCanCascadeCmd.winLineCycleComplete && CheckIfCanCascadeCmd.winMeterCountUpComplete) {
                        this.cascade();
                    }
                    else {
                        this._cyclersModel.startCyclers();
                    }
                    CheckIfCanCascadeCmd.count = 0;
                }
            }
        };
        CheckIfCanCascadeCmd.prototype.cascade = function () {
            this._cyclersModel.stopCyclers();
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.CASCADE_REELS, this));
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.SHOW_WINS_COMPLETE));
            this._winInfoModel.incrementCycleCount();
            CheckIfCanCascadeCmd.winMeterCountUpComplete = false;
            CheckIfCanCascadeCmd.winLineCycleComplete = false;
            CheckIfCanCascadeCmd.count = 0;
        };
        CheckIfCanCascadeCmd.winLineCycleComplete = false;
        CheckIfCanCascadeCmd.winMeterCountUpComplete = false;
        CheckIfCanCascadeCmd.count = 0;
        __decorate([
            inject('CyclersModel')
        ], CheckIfCanCascadeCmd.prototype, "_cyclersModel", void 0);
        __decorate([
            inject('WinInfoModel')
        ], CheckIfCanCascadeCmd.prototype, "_winInfoModel", void 0);
        return CheckIfCanCascadeCmd;
    }(game.BaseCmd));
    game.CheckIfCanCascadeCmd = CheckIfCanCascadeCmd;
})(game || (game = {}));
var game;
(function (game) {
    var PickMeResult = (function () {
        function PickMeResult() {
        }
        return PickMeResult;
    }());
    game.PickMeResult = PickMeResult;
    var CheckPickMeCmd = (function (_super) {
        __extends(CheckPickMeCmd, _super);
        function CheckPickMeCmd() {
            _super.apply(this, arguments);
            this._stakeModel = new dragonwings.InjectProp(game.StakeModel).inject();
            this._historyReplay = false;
        }
        CheckPickMeCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CheckPickMeCmd->execute()");
            // var logicResponse: IFPMLogicResponse = this._server.getLogicResponse();
            // var gameResults: server.GameResultData = logicResponse.gameResultData;
            // var reelResults: server.ReelSpinData;
            // if (logicResponse.reelSpinData && logicResponse.reelSpinData[0]) {
            //     reelResults = logicResponse.reelSpinData[0];
            // }
            //
            // if (reelResults) {
            //     if (reelResults.bonusAwarded) {
            //         if (logicResponse.pickMeBonus) {
            //             var scatterPositions: number[] = logicResponse.scatterPositions;
            //             var pickMeIndex: number = logicResponse.pickMeBonus.pickMeIndex;
            //             var winVal: number = logicResponse.scatterWinVal;
            //             var multipliers: number[] = logicResponse.pickMeBonus.pickMeValues;
            //             Utils.PSLog.log(`CheckPickMeCmd: PickMe Bonus Awarded - positions: ${scatterPositions.toString()}, multipliers: ${multipliers.toString()}, winVal: ${winVal}, index: ${pickMeIndex}`);
            //             var pickMeResult: PickMeResult = new PickMeResult();
            //
            //             // Prepare and dispatch the pickme result
            //             pickMeResult.scatterPositions = scatterPositions;
            //             pickMeResult.winValue = winVal;
            //             pickMeResult.multipliers = multipliers;
            //             pickMeResult.pickMeIndex = pickMeIndex;
            //             this.doGlobalDispatch(new GameEvent(GameEvent.SHOW_PICKME, this, pickMeResult));
            //         } else {
            //             this.doGlobalDispatch(new GameEvent(GameEvent.NO_PICKME, this));
            //         }
            //     } else {
            //         this.doGlobalDispatch(new GameEvent(GameEvent.NO_PICKME, this));
            //     }
            // } else {
            //     throw "Expected reel results but none found";
            // }
        };
        __decorate([
            inject('GameStateModel')
        ], CheckPickMeCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('GameServer')
        ], CheckPickMeCmd.prototype, "_server", void 0);
        return CheckPickMeCmd;
    }(game.BaseCmd));
    game.CheckPickMeCmd = CheckPickMeCmd;
})(game || (game = {}));
var game;
(function (game) {
    var PaycycleChecker = (function (_super) {
        __extends(PaycycleChecker, _super);
        function PaycycleChecker() {
            _super.apply(this, arguments);
        }
        PaycycleChecker.prototype.execute = function () {
            _super.prototype.execute.call(this);
            PaycycleChecker.count += 1;
            if (PaycycleChecker.count % 2 === 0) {
                game.CheckIfCanCascadeCmd.winLineCycleComplete = true;
                PaycycleChecker.count = 0;
            }
        };
        PaycycleChecker.count = 0;
        __decorate([
            inject('WinInfoModel')
        ], PaycycleChecker.prototype, "_winInfoModel", void 0);
        return PaycycleChecker;
    }(game.BaseCmd));
    game.PaycycleChecker = PaycycleChecker;
})(game || (game = {}));
var game;
(function (game) {
    var ShowSpaghettiCmd = (function (_super) {
        __extends(ShowSpaghettiCmd, _super);
        function ShowSpaghettiCmd() {
            _super.apply(this, arguments);
        }
        // Gets executed on game entering state "showSpaghetti"
        ShowSpaghettiCmd.prototype.execute = function () {
            var onScreenTime = 0;
            _super.prototype.execute.call(this);
            Utils.PSLog.log("ShowSpaghettiCmd::execute()");
            // Tell the rest of the game it's what we're doing
            this.doImmediateDispatch(new game.GameEvent(game.GameEvent.SHOW_SPAGHETTI));
            var logicResponse = this._server.getLogicResponse();
            var gameResults = logicResponse.gameResultData;
            var reelResults;
            if (logicResponse.reelSpinData && logicResponse.reelSpinData[0]) {
                reelResults = logicResponse.reelSpinData[0];
            }
            if (reelResults) {
                if (reelResults.paylineWins.length > 0) {
                    Utils.PSLog.log("ShowSpaghettiCmd::execute() - showing " + reelResults.paylineWinCount + " lines: " + reelResults.paylineWins);
                    onScreenTime = game.CyclersModel.kPaylineDisplayTime;
                    this._cyclers.showSpaghetti();
                }
            }
            // Check for max win special case
            if (logicResponse.isMaxWin) {
                Utils.PSLog.log("ShowSpaghettiCmd::execute() - Showing MAX WIN Animation");
                this.doImmediateDispatch(new game.GameEvent(game.GameEvent.SHOW_MAX_WIN));
            }
            //this.doGlobalDispatch(new GameEvent(GameEvent.HIDE_SPAGHETTI, this));
            this.doDeferredDispatch(new game.GameEvent(game.GameEvent.HIDE_SPAGHETTI), onScreenTime, true);
        };
        __decorate([
            inject('GameStateModel')
        ], ShowSpaghettiCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('GameServer')
        ], ShowSpaghettiCmd.prototype, "_server", void 0);
        __decorate([
            inject('CyclersModel')
        ], ShowSpaghettiCmd.prototype, "_cyclers", void 0);
        return ShowSpaghettiCmd;
    }(game.BaseCmd));
    game.ShowSpaghettiCmd = ShowSpaghettiCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ShowWinsCmd = (function (_super) {
        __extends(ShowWinsCmd, _super);
        function ShowWinsCmd() {
            _super.apply(this, arguments);
        }
        ShowWinsCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("ShowWinsCmd->execute()");
        };
        return ShowWinsCmd;
    }(game.BaseCmd));
    game.ShowWinsCmd = ShowWinsCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CheckMaxWinCmd = (function (_super) {
        __extends(CheckMaxWinCmd, _super);
        function CheckMaxWinCmd() {
            _super.apply(this, arguments);
        }
        CheckMaxWinCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var logicResponse = this._server.getLogicResponse();
            if (logicResponse.isMaxWin || logicResponse.fsMaxWin) {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HAS_MAX_WIN, this));
            }
            else {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HAS_NO_MAX_WIN, this));
            }
        };
        __decorate([
            inject('GameServer')
        ], CheckMaxWinCmd.prototype, "_server", void 0);
        return CheckMaxWinCmd;
    }(game.BaseCmd));
    game.CheckMaxWinCmd = CheckMaxWinCmd;
})(game || (game = {}));
var game;
(function (game) {
    /**
    GameStateModel: Model built on FSM class to encapsulate a more
    "reel game" specific representation of game state
    The underlying design is that a full "game" is actually made up
    of several subgames. Each subgame has its own FSM. GameStateModel
    acts as the delegate for each of those subgame FSMs and pulls
    them all together into one cohesive model.  It is designed to
    operate as a singleton instance. It can also serve as a central
    point to log all state transitions (and failures) for diagnostic
    purpoes (on setting the debug flag) **/
    var GameStateModel = (function () {
        function GameStateModel() {
            this._subGames = {}; // A map of sub game name to sub game FSM
            this._subgameStack = []; // The current stack of active FSMs 
            this._diagnosticLog = []; // The current diagnostic "log"
            this._subgameEventTransitionMap = {}; // A map from borg / game events to FSM events
            this._debug = false;
        }
        Object.defineProperty(GameStateModel.prototype, "debug", {
            get: function () { return this._debug; },
            // Accessors 
            /** Setting debug true enables logging of all state transitions - in fact, all FSM related notifications
                including ignored and disallowed transitions. An essential debugging aid **/
            set: function (value) { this._debug = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateModel.prototype, "maxDepth", {
            /** this._subgameStack is used to keep a stack of FSMs that allow us to move from one
                subgame and then eventually exit back to the previous one at point it was left
                For any particular game, there would be an expected maximum stack size beyond which
                a bug had almost certainly crept in. This accessor allows us to specify that depth **/
            get: function () { return this._maxDepth; },
            set: function (value) { this._maxDepth = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateModel.prototype, "dispatcher", {
            /** We need an event dispatcher to both listen for and dispatch events from **/
            get: function () { return this._dispatcher; },
            set: function (value) { this._dispatcher = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateModel.prototype, "eventLog", {
            /** The "event log" that gets populated when debug is true **/
            get: function () { return this._diagnosticLog; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateModel.prototype, "currentSubgame", {
            /** The "current" subgame is the on on top of the stack - explicitly, the one
                at the end of the array of subgames **/
            get: function () {
                var subgame = "<Unknown>";
                var stackEnd = this._subgameStack.length - 1;
                if (stackEnd >= 0) {
                    subgame = this._subgameStack[stackEnd].name;
                }
                return subgame;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateModel.prototype, "currentSubgameState", {
            get: function () {
                var state = "<Unknown>";
                var stackEnd = this._subgameStack.length - 1;
                if (stackEnd >= 0) {
                    state = this._subgameStack[stackEnd].currentState;
                }
                return state;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateModel.prototype, "currentSubgameFSM", {
            get: function () {
                var fsm;
                var stackEnd = this._subgameStack.length - 1;
                if (stackEnd >= 0) {
                    fsm = this._subgameStack[stackEnd];
                }
                return fsm;
            },
            enumerable: true,
            configurable: true
        });
        /** A call to init clears the subgame stack and initialises the
            GameStateModel with the specified subgame - which may have been
            pre-initialised itself to any state required. On success, the
            model dispatches an "ENTERSUBGAME" GameStateEvent */
        GameStateModel.prototype.init = function (initSubgame) {
            var msg = "GameStateModel::init(" + initSubgame + ")";
            this._subgameStack = [];
            if (initSubgame in this._subGames) {
                this._subgameStack.push(this._subGames[initSubgame]);
                this._dispatcher.dispatchEvent(new game.GameStateEvent(game.GameStateEvent.EnterSubgame(initSubgame), this, initSubgame, this.currentSubgameState));
                msg += " - cuSubgame now: " + this.currentSubgame + ", currentState now: " + this.currentSubgameState;
                this.logDiagnostic(msg);
            }
            else {
                this.throwException("subgame " + initSubgame + " cannot be initialised - not found");
            }
        };
        // Might need this later for recovery but shouldn't use it under normal circumstances
        //public forceSubgameState(forceState: string): void {
        //    this._subgameStack[this._subgameStack.length - 1].forceState(forceState, true);
        //}
        /** Allows us to map general borg / game events to state transition event names
            Works by adding an event listener to the specified event which calls
            this.doEventMapping() for every mapped event **/
        GameStateModel.prototype.mapEventTransition = function (event, subgame, transition) {
            if (!event) {
                this.throwException("mapEventTransition() - invalid borgevent");
            }
            if (!transition) {
                this.throwException("mapEventTransition() - invalid transition");
            }
            if (!subgame) {
                this.throwException("mapEventTransition() - invalid subgame");
            }
            if (!(subgame in this._subGames)) {
                this.throwException("mapEventTransition() - subgame does not exist");
            }
            var fsm = this._subGames[subgame];
            if (fsm) {
                var subgameEventMap = {};
                if (subgame in this._subgameEventTransitionMap) {
                    subgameEventMap = this._subgameEventTransitionMap[subgame];
                }
                if (!(event in subgameEventMap)) {
                    // Only add the listener if the transition doesn't exist at all in ANY
                    // subgame - otherwise the listener could get called multiple times which
                    // will be very confusing. Check BEFORE adding it :-)
                    var addListener = !this.mappingExistsForAnySubgame(event);
                    // add the mapping
                    subgameEventMap[event] = transition;
                    this._subgameEventTransitionMap[subgame] = subgameEventMap;
                    // Add a listener if required
                    if (addListener) {
                        this._dispatcher.addEventListener(event, this.doEventMapping, this);
                    }
                }
                else {
                    this.throwException("mapEventTransition() - event already mapped " + event);
                }
            }
            else {
                this.throwException("mapEventTransition() - couldn't retrieve FSM for subgame: " + subgame);
            }
        };
        /** Used on initialisation of the model to add a subgame FSM to the collection
            The FSM's name property is used as the subgame name **/
        GameStateModel.prototype.addSubgame = function (stateMachine) {
            var msg = "addSubgame():";
            if (stateMachine.name in this._subGames) {
                msg += " subgame already exists: " + stateMachine.name;
                this.throwException(msg);
            }
            else {
                msg += " subgame: " + stateMachine.name + " added to GameStateModel";
                stateMachine.delegate = this;
                this._subGames[stateMachine.name] = stateMachine;
                this.logDiagnostic(msg);
            }
        };
        // Used to push the specified subgame on to the top of the stack
        // replacing it as the current subgame
        GameStateModel.prototype.changeSubgame = function (subgame, state, suppress) {
            if (suppress === void 0) { suppress = false; }
            var msg = "changeSubgame(" + subgame + ", " + state + "):";
            var currStackDepth = this._subgameStack.length;
            if (currStackDepth > 0) {
                if (this.currentSubgame === subgame) {
                    msg += " new subgame is a duplicate of current subgame - is this intended?";
                    this.throwException(msg);
                }
                if (currStackDepth >= this._maxDepth) {
                    msg += " stack depth would exceed expected maximum (" + this._maxDepth + ") - is this intended?";
                    this.throwException(msg);
                }
                var nextFSM = this._subGames[subgame];
                if (nextFSM) {
                    nextFSM.init(state);
                    if (!suppress) {
                        this._dispatcher.dispatchEvent(new game.GameStateEvent(game.GameStateEvent.EnterSubgame(subgame), this, subgame, state));
                        this._dispatcher.dispatchEvent(new game.GameStateEvent(game.GameStateEvent.CHANGE_SUBGAME, this, subgame, state));
                    }
                    this._subgameStack.push(nextFSM);
                    this.logDiagnostic(msg);
                }
                else {
                    msg += "specified subgame doesn't exist";
                    this.throwException(msg);
                }
            }
            else {
                msg += " sub game stack not initialised - did you call init()?";
                this.throwException(msg);
            }
        };
        // Used to pop the current subgame off the top of the stack and return
        // to the previous subgame; dispatching appropriate notifications in
        // the process
        GameStateModel.prototype.exitCurrentSubgame = function () {
            var basemsg = "GameStateModel::exitCurrentSubgame()";
            var currStackDepth = this._subgameStack.length;
            // Notify the game that the subgame has ended
            var msg = basemsg + (" leaving fsm: " + this.currentSubgame + " state: " + this.currentSubgameState);
            this.logDiagnostic(msg);
            var exitedGame = this._subgameStack.pop();
            this._dispatcher.dispatchEvent(new game.GameStateEvent(game.GameStateEvent.ExitSubgame(exitedGame.name), this, exitedGame.name));
            this._dispatcher.dispatchEvent(new game.GameStateEvent(game.GameStateEvent.CHANGE_SUBGAME, this, exitedGame.name, this.currentSubgameState));
            // Check if there is a previous subgame to re-enter
            if (currStackDepth > 1) {
                var reenterEvent = new game.GameStateEvent(game.GameStateEvent.ReturnToSubgame(this.currentSubgame), this, this.currentSubgame, this.currentSubgameState);
                msg = basemsg + (" returning to fsm: " + this.currentSubgame + " state: " + this.currentSubgameState);
                this.logDiagnostic(msg);
                this.doDeferredDispatch(reenterEvent);
            }
        };
        // IFSMDelegate implementation - mostly just check debug flag and log if appropriate
        GameStateModel.prototype.didExit = function (fsm) {
            var msg = "GameStateModel::IFSMDelegate::didExit(), fsm: " + fsm.name;
            this.logDiagnostic(msg);
            this.exitCurrentSubgame();
        };
        // This is the one where we can apply contraints and disallow transitions if required
        // simply return false on transitions we DON'T want to happen
        GameStateModel.prototype.willTransition = function (fsm, from, to) {
            var msg = "GameStateModel::IFSMDelegate::willTransition(), fsm: " + fsm.name + ", from: " + from + ", to: " + to;
            this.logDiagnostic(msg);
            return true;
        };
        GameStateModel.prototype.didTransition = function (fsm, from, to) {
            var msg = "GameStateModel::IFSMDelegate::didTransition(), fsm: " + fsm.name + ", from: " + from + ", to: " + to;
            if (from === game.FSM.kPreInitState) {
                msg = "GameStateModel::IFSMDelegate::didInit() fsm: " + fsm.name + ", state: " + to;
            }
            this.logDiagnostic(msg);
            this.doImmediateDispatch(new game.GameStateEvent(game.GameStateEvent.ExitState(this.currentSubgame, from), this, this.currentSubgame, from));
            this.doDeferredDispatch(new game.GameStateEvent(game.GameStateEvent.EnterState(this.currentSubgame, to), this, this.currentSubgame, to));
            this.doDeferredDispatch(new game.GameStateEvent(game.GameStateEvent.CHANGE_STATE, this, this.currentSubgame, to));
        };
        GameStateModel.prototype.ignoredEvent = function (fsm, event, currentState) {
            var msg = "GameStateModel::IFSMDelegate::ignoredEvent(), fsm: " + fsm.name + ", event: " + event + ", currState: " + currentState;
            this.logDiagnostic(msg);
        };
        GameStateModel.prototype.disallowedTransition = function (fsm, from, event) {
            var msg = "GameStateModel::IFSMDelegate::disallowedTransition(), fsm: " + fsm.name + ", from: " + from + ", event: " + event;
            this.logDiagnostic(msg);
        };
        GameStateModel.prototype.doDeferredDispatch = function (event, delay) {
            if (delay === void 0) { delay = 0.1; }
            var self = this;
            TweenMax.delayedCall(delay, self._dispatcher.dispatchEvent, [event, self, self.currentSubgame], self._dispatcher);
        };
        GameStateModel.prototype.doImmediateDispatch = function (event) {
            this._dispatcher.dispatchEvent(event);
        };
        GameStateModel.prototype.throwException = function (msg) {
            this.logDiagnostic(msg);
            var fullMsg = "GameStateModel Exception: " + msg;
            throw (fullMsg);
        };
        GameStateModel.prototype.logDiagnostic = function (msg) {
            if (this._debug) {
                this._diagnosticLog.push(msg);
                Utils.PSLog.log(msg, Utils.psLogLevel.BOLD);
            }
        };
        GameStateModel.prototype.mappingExistsForSubgame = function (event, subgame) {
            var exists = false;
            var transitionMap = this._subgameEventTransitionMap[subgame];
            if (transitionMap) {
                if (event in transitionMap) {
                    exists = true;
                }
            }
            return exists;
        };
        GameStateModel.prototype.mappingExistsForAnySubgame = function (event) {
            var exists = false;
            var subgameKeys = Object.keys(this._subgameEventTransitionMap);
            for (var i = 0; i < subgameKeys.length; ++i) {
                var transitionMap = this._subgameEventTransitionMap[subgameKeys[i]];
                if (transitionMap) {
                    if (event in transitionMap) {
                        exists = true;
                    }
                }
            }
            return exists;
        };
        GameStateModel.prototype.doEventMapping = function (event) {
            var msg = "GameStateModel::doEventMapping(" + event.eventName + ") ";
            var subgameMap = this._subgameEventTransitionMap[this.currentSubgame];
            if (subgameMap) {
                var transitionEvent = subgameMap[event.eventName];
                if (transitionEvent) {
                    var stackEnd = this._subgameStack.length - 1;
                    var currFSM = this._subgameStack[stackEnd];
                    msg += " successfully mapped to transition: " + transitionEvent + " - applying now...";
                    this.logDiagnostic(msg);
                    currFSM.doTransition(transitionEvent);
                }
            }
            else {
                msg += "current subgame (" + this.currentSubgame + ") has no mapping for event";
                this.logDiagnostic(msg);
            }
        };
        return GameStateModel;
    }());
    game.GameStateModel = GameStateModel;
})(game || (game = {}));
/// <reference path="../../generic/GameStateModel.ts" />
var game;
(function (game) {
    var CreateGameStatesCmd = (function (_super) {
        __extends(CreateGameStatesCmd, _super);
        function CreateGameStatesCmd() {
            _super.apply(this, arguments);
            // Create FiniteStateModels for each subgame
            this._preGamefsm = new game.FSM(game.Subgame.PRE_GAME);
            this._baseGamefsm = new game.FSM(game.Subgame.BASE_GAME);
            this._freeSpinsGamefsm = new game.FSM(game.Subgame.FREE_SPINS_GAME);
        }
        CreateGameStatesCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            this.initPreGameFSM();
            this.initBaseGameFSM();
            this.initFreeSpinsGameFSM();
            // Configure the "meta machine" which links and transitions between FSMs
            this._stateModel.maxDepth = 2; // Expected max depth of FSM stack
            this._stateModel.debug = true;
            this._stateModel.dispatcher = this.eventDispatcher;
            // Add the subgames
            this._stateModel.addSubgame(this._preGamefsm);
            this._stateModel.addSubgame(this._baseGamefsm);
            this._stateModel.addSubgame(this._freeSpinsGamefsm);
            // Configure the starting point 
            this._stateModel.init(game.Subgame.PRE_GAME);
            // Map game events to state machine transitions
            /*
             mapEventTransition = (event to listen for, the FSM this transition is association with, the transition name)
             The transition name matches up to the FSMTransition. e.g.
             this._stateModel.mapEventTransition(GameEvent.REEL_SPIN_STARTED, Subgame.BASE_GAME, "onSpin");
             matches to new FSMTransition("idle", "spinReels", "onSpin")
             So when the GameEvent.REEL_SPIN_STARTED event is triggered, it would move on to the next FSMTransition
             FSMTransition("spinReels", "stopReels", "onLogicResponse")
             */
            // First the preGame events
            this._stateModel.mapEventTransition(game.GameEvent.HISTORY_REPLAY_DETECTED, game.Subgame.PRE_GAME, "onReplay");
            this._stateModel.mapEventTransition(util.history.HistoryModelEvent.COMPLETE, game.Subgame.PRE_GAME, "onHistoryLoaded");
            this._stateModel.mapEventTransition(game.GameEvent.HISTORY_REPLAY_READY, game.Subgame.PRE_GAME, "onHistoryReady");
            // Normal route
            this._stateModel.mapEventTransition(game.GameEvent.MAIN_ASSETS_LOADED, game.Subgame.PRE_GAME, "onMainAssetsLoaded");
            this._stateModel.mapEventTransition(game.GameEvent.NORMAL_GAME_INIT, game.Subgame.PRE_GAME, "onNormalGame");
            this._stateModel.mapEventTransition(game.GameEvent.EXIT_INTRO, game.Subgame.PRE_GAME, "onExitIntro");
            // Recovery route
            this._stateModel.mapEventTransition(game.GameEvent.RECOVERY_GAME_INIT, game.Subgame.PRE_GAME, "onRecover");
            this._stateModel.mapEventTransition(game.GameEvent.RECOVERY_INPUTS_READY, game.Subgame.PRE_GAME, "onInputsReady");
            this._stateModel.mapEventTransition(game.GameEvent.RECOVERY_READY, game.Subgame.PRE_GAME, "onRecoveryReady");
            // Base game events-transitions
            this._stateModel.mapEventTransition(game.GameEvent.REEL_SPIN_STARTED, game.Subgame.BASE_GAME, "onSpin");
            this._stateModel.mapEventTransition(server.ServerResponseEvent.LOGIC_RESPONSE, game.Subgame.BASE_GAME, "onLogicResponse");
            this._stateModel.mapEventTransition(game.GameEvent.REELS_STOPPED, game.Subgame.BASE_GAME, "onReelsStopped");
            this._stateModel.mapEventTransition(game.GameEvent.HAS_WINS, game.Subgame.BASE_GAME, "onHasWins");
            this._stateModel.mapEventTransition(game.GameEvent.HAS_NO_WINS, game.Subgame.BASE_GAME, "onHasNoWins");
            this._stateModel.mapEventTransition(game.GameEvent.SHOW_WINS_COMPLETE, game.Subgame.BASE_GAME, "onShowingWinsComplete");
            this._stateModel.mapEventTransition(game.GameEvent.CASCADE_REELS_COMPLETE, game.Subgame.BASE_GAME, "onCascadingComplete");
            // Returning from free game
            this._stateModel.mapEventTransition(server.ServerResponseEvent.END_RESPONSE, game.Subgame.BASE_GAME, "onEndResponse");
            // Free spin transitions
            this._stateModel.mapEventTransition(game.GameEvent.NO_FREE_SPINS_AWARDED, game.Subgame.BASE_GAME, "onFreeSpinsGameNotAwarded");
            // Free game events-transitions
            this._stateModel.mapEventTransition(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, game.Subgame.FREE_SPINS_GAME, "onPlayFreeSpinsButtonPressed");
            this._stateModel.mapEventTransition(server.ServerResponseEvent.LOGIC_RESPONSE, game.Subgame.FREE_SPINS_GAME, "onLogicResponse");
            this._stateModel.mapEventTransition(game.GameEvent.FREE_SPIN_VALID, game.Subgame.FREE_SPINS_GAME, "onFreeSpinIsValid");
            this._stateModel.mapEventTransition(game.GameEvent.REELS_STOPPED, game.Subgame.FREE_SPINS_GAME, "onReelsStopped");
            this._stateModel.mapEventTransition(game.GameEvent.HAS_WINS, game.Subgame.FREE_SPINS_GAME, "onHasWins");
            this._stateModel.mapEventTransition(game.GameEvent.HAS_NO_WINS, game.Subgame.FREE_SPINS_GAME, "onHasNoWins");
            this._stateModel.mapEventTransition(game.GameEvent.SHOW_WINS_COMPLETE, game.Subgame.FREE_SPINS_GAME, "onShowingWinsComplete");
            this._stateModel.mapEventTransition(game.GameEvent.CASCADE_REELS_COMPLETE, game.Subgame.FREE_SPINS_GAME, "onCascadingComplete");
            this._stateModel.mapEventTransition(game.GameEvent.FREE_SPINS_GAME_COMPLETE, game.Subgame.FREE_SPINS_GAME, "onFreeSpinsGameComplete");
            this._stateModel.mapEventTransition(game.GameEvent.SHOW_TOTAL_WON_COMPLETE, game.Subgame.FREE_SPINS_GAME, "onShowingTotalWonComplete");
            this._stateModel.mapEventTransition(game.GameEvent.NO_MORE_FREE_SPINS, game.Subgame.FREE_SPINS_GAME, "onNoMoreFreeSpins");
            this._stateModel.mapEventTransition(game.GameEvent.RETURN_TO_BASE_GAME, game.Subgame.BASE_GAME, "onFreeSpinsGameEnded");
            this._stateModel.mapEventTransition(game.GameEvent.FINALISED_TOTAL_WINNINGS_FROM_BASE_AND_FREE_GAME, game.Subgame.BASE_GAME, "onFinalisedTotalWinnings");
            this._stateModel.mapEventTransition(game.GameEvent.HAS_EXTRA_FREE_SPINS, game.Subgame.FREE_SPINS_GAME, "onHasExtraFreeSpins");
            this._stateModel.mapEventTransition(game.GameEvent.HAS_NO_EXTRA_FREE_SPINS, game.Subgame.FREE_SPINS_GAME, "onHasNoExtraFreeSpins");
            this._stateModel.mapEventTransition(game.GameEvent.SHOWING_EXTRA_FREE_SPINS_COMPLETE, game.Subgame.FREE_SPINS_GAME, "onShowingExtraFreeSpinsComplete");
            this._stateModel.mapEventTransition(game.GameEvent.HAS_MAX_WIN, game.Subgame.FREE_SPINS_GAME, "onHasMaxWin");
            this._stateModel.mapEventTransition(game.GameEvent.HAS_NO_MAX_WIN, game.Subgame.FREE_SPINS_GAME, "onHasNoMaxWin");
            // Verify Starting State
            var cuSubgame = this._stateModel.currentSubgame;
            var currState = this._stateModel.currentSubgameState;
            if ((cuSubgame != game.Subgame.PRE_GAME) || (currState != "preGame")) {
                throw "InitStateMachineCmd failed to initialise state machine correctly";
            }
            // Notify the rest of the game that the state model is READY
            this.eventDispatcher.dispatchEvent(new game.GameStateEvent(game.GameStateEvent.STATE_MODEL_READY));
        };
        // For all FSMs below:
        /*
         FSMTransition is effectively (state currently in, state to go to, transition name associated mapEventTransition)
         So you can see how they fit together. e.g. (A, B, ET1), (B, C, ET2) and (C, A, ET3).
         The example would start on state A, the event specified in the associated mapEventTransition ET1 would happen,
         it would move to state B. The next FSTransition comes into play.
         So it's now on state B, then ET2 happens. It moves to state C, and so on back to A after ET3
         */
        CreateGameStatesCmd.prototype.initPreGameFSM = function () {
            //create an array of the pregame transitions
            var preGameTransitions = [
                // History replay init
                new game.FSMTransition("preGame", "loadHistory", "onReplay"),
                new game.FSMTransition("loadHistory", "historyInit", "onHistoryLoaded"),
                new game.FSMTransition("historyInit", game.Subgame.PRE_GAME_EXIT_STATE, "onHistoryReady"),
                // Recovery init
                new game.FSMTransition("preGame", "checkRecovery", "onMainAssetsLoaded"),
                new game.FSMTransition("checkRecovery", "awaitingInputs", "onRecover"),
                new game.FSMTransition("awaitingInputs", "recoveryInit", "onInputsReady"),
                new game.FSMTransition("recoveryInit", game.Subgame.PRE_GAME_EXIT_STATE, "onRecoveryReady"),
                // Normal Init
                new game.FSMTransition("checkRecovery", game.Subgame.PRE_GAME_EXIT_STATE, "onNormalGame"),
            ];
            // add the FSM transitions to the subGames.
            this.initFSMFromTransitions(this._preGamefsm, preGameTransitions);
            // Set the initial default state for the machine
            this._preGamefsm.init("preGame");
            // Set the exit state of the subgame
            this._preGamefsm.exitState = game.Subgame.PRE_GAME_EXIT_STATE;
        };
        CreateGameStatesCmd.prototype.initBaseGameFSM = function () {
            var baseGameTransitions = [
                new game.FSMTransition("idle", "spinRequested", "onSpin"),
                new game.FSMTransition("spinRequested", "reelsSpinning", "onLogicResponse"),
                new game.FSMTransition("reelsSpinning", "checkingForWins", "onReelsStopped"),
                new game.FSMTransition("checkingForWins", "showingWins", "onHasWins"),
                new game.FSMTransition("showingWins", "cascading", "onShowingWinsComplete"),
                new game.FSMTransition("cascading", "checkingForWins", "onReelsStopped"),
                new game.FSMTransition("checkingForWins", "checkingIfFreeSpinsGameHasBeenAwarded", "onHasNoWins"),
                new game.FSMTransition("checkingIfFreeSpinsGameHasBeenAwarded", "spinComplete", "onFreeSpinsGameNotAwarded"),
                new game.FSMTransition("checkingIfFreeSpinsGameHasBeenAwarded", "finalisingTotalWinnings", "onFreeSpinsGameEnded"),
                new game.FSMTransition("finalisingTotalWinnings", "spinComplete", "onFinalisedTotalWinnings"),
                new game.FSMTransition("spinComplete", "idle", "onEndResponse"),
            ];
            // add the FSM transitions to the subGames.
            this.initFSMFromTransitions(this._baseGamefsm, baseGameTransitions);
            // Set the initial default state for the machine
            this._baseGamefsm.init("idle"); //specify the initial state of the subgame
        };
        CreateGameStatesCmd.prototype.initFreeSpinsGameFSM = function () {
            var freeSpinsTransitions = [
                new game.FSMTransition("showFreeSpinsGameIntro", "requestFreeSpin", "onPlayFreeSpinsButtonPressed"),
                new game.FSMTransition("requestFreeSpin", "freeSpinValid", "onFreeSpinIsValid"),
                new game.FSMTransition("freeSpinValid", "reelsSpinning", "onLogicResponse"),
                new game.FSMTransition("requestFreeSpin", "showingTotalWon", "onNoMoreFreeSpins"),
                new game.FSMTransition("reelsSpinning", "checkingForMaxWin", "onReelsStopped"),
                new game.FSMTransition("checkingForMaxWin", "checkingForWins", "onHasNoMaxWin"),
                new game.FSMTransition("checkingForMaxWin", "showingMaxWin", "onHasMaxWin"),
                new game.FSMTransition("checkingForWins", "showingWins", "onHasWins"),
                new game.FSMTransition("showingWins", "cascading", "onShowingWinsComplete"),
                new game.FSMTransition("cascading", "checkingForWins", "onReelsStopped"),
                new game.FSMTransition("checkingForWins", "checkingForExtraFreeSpins", "onHasNoWins"),
                new game.FSMTransition("checkingForExtraFreeSpins", "showingExtraFreeSpins", "onHasExtraFreeSpins"),
                new game.FSMTransition("showingExtraFreeSpins", "requestFreeSpin", "onShowingExtraFreeSpinsComplete"),
                new game.FSMTransition("checkingForExtraFreeSpins", "requestFreeSpin", "onHasNoExtraFreeSpins"),
                new game.FSMTransition("showingTotalWon", game.Subgame.FREE_SPINS_EXIT_STATE, "onShowingTotalWonComplete"),
            ];
            this.initFSMFromTransitions(this._freeSpinsGamefsm, freeSpinsTransitions);
            this._freeSpinsGamefsm.exitState = game.Subgame.FREE_SPINS_EXIT_STATE;
        };
        // Iterate through transitions adding them to the specified machine
        CreateGameStatesCmd.prototype.initFSMFromTransitions = function (machine, transitions) {
            for (var idx = 0; idx < transitions.length; idx++) {
                machine.addTransition(transitions[idx]);
            }
            // Validate the machines
            this.validateMachine(machine, transitions);
        };
        // Validate specified state machine looking for invalid / missing transitions and general errors
        CreateGameStatesCmd.prototype.validateMachine = function (fsm, transitions) {
            for (var idx = 0; idx < transitions.length; ++idx) {
                var transition = transitions[idx];
                var triggerEvents = fsm.canTransition(transition.from, transition.to);
                if (triggerEvents.indexOf(transition.event) != -1) {
                    Utils.PSLog.log(fsm.name + " VERIFIED State: " + transition.from + " --> " + transition.to + " on " + transition.event);
                }
                else {
                    throw "InitStateMachineCmd FSM Integrity check FAILED: " + transition.from + " --> " + transition.to + " on " + transition.event;
                }
                var invalidTransition = new game.FSMTransition(transition.from, "NonsenseState", transition.to);
                var triggerEvents = fsm.canTransition(invalidTransition.from, invalidTransition.to);
                if (triggerEvents.length > 0) {
                    throw "InitStateMachineCmd FSM Integrity check FAILED: Accepts nonsense: " + invalidTransition.from + " --> " + invalidTransition.to + " ";
                }
            }
        };
        __decorate([
            inject('GameStateModel')
        ], CreateGameStatesCmd.prototype, "_stateModel", void 0);
        return CreateGameStatesCmd;
    }(dragonwings.Command));
    game.CreateGameStatesCmd = CreateGameStatesCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ExitPreGameCmd = (function (_super) {
        __extends(ExitPreGameCmd, _super);
        function ExitPreGameCmd() {
            _super.apply(this, arguments);
            this._historyReplay = false;
        }
        ExitPreGameCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            Utils.PSLog.log("ExitPreGameCmd::execute()");
            var initResponse = this._server.getInitResponse();
            var isReplay = this._historyModel.getIsHistoryReplay();
            if (!isReplay && initResponse.isRecovering) {
                // Recovery start
                Utils.PSLog.log("ExitPreGameCmd::execute() - configuring game for recovery....");
                this._stateModel.init(game.Subgame.BASE_GAME);
                var recoveryLogicResponse = this._server.getLogicResponse();
                var gameResultData = recoveryLogicResponse.gameResultData;
                // Ensure the stake is set to what it was on the spin which is being recovered
                this._stakeModel.setStakeFromRecovery(gameResultData.stakePerLine);
                if (recoveryLogicResponse.fsSpinNumber > 0) {
                    // in free spins game
                    this._stateModel.currentSubgameFSM.init("checkingIfFreeSpinsGameHasBeenAwarded");
                    this._stateModel.changeSubgame(game.Subgame.FREE_SPINS_GAME, "reelsSpinning");
                    this.doImmediateDispatch(new game.GameEvent(game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME, this));
                }
                else {
                    this._stateModel.currentSubgameFSM.init("reelsSpinning");
                }
                TweenMax.delayedCall(0.5, function () {
                    _this._partnerAdapter.hideProgressBar();
                    _this.doImmediateDispatch(new game.GameEvent(game.GameEvent.RECOVERY_SPIN, _this));
                });
                // Also reset the recovery flag on the logic reponse to signal that it has been dealt with
                recoveryLogicResponse.isRecovering = false;
            }
            else {
                if (isReplay) {
                    this._stateModel.init(game.Subgame.BASE_GAME);
                    this._stateModel.currentSubgameFSM.init("reelsSpinning");
                    this.doDeferredDispatch(new game.GameEvent(game.GameEvent.PLAY_REPLAY_SPIN, this), 2);
                }
                else {
                    // Just a normal startup
                    Utils.PSLog.log("ExitPreGameCmd::execute() - configuring game for normal startup....");
                    this._stateModel.init(game.Subgame.BASE_GAME);
                }
            }
        };
        __decorate([
            inject('GameStateModel')
        ], ExitPreGameCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('GameServer')
        ], ExitPreGameCmd.prototype, "_server", void 0);
        __decorate([
            inject('HistoryModel')
        ], ExitPreGameCmd.prototype, "_historyModel", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], ExitPreGameCmd.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('StakeModel')
        ], ExitPreGameCmd.prototype, "_stakeModel", void 0);
        return ExitPreGameCmd;
    }(game.BaseCmd));
    game.ExitPreGameCmd = ExitPreGameCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ExitSubgameCmd = (function (_super) {
        __extends(ExitSubgameCmd, _super);
        function ExitSubgameCmd() {
            _super.apply(this, arguments);
            this._server = new dragonwings.InjectProp(server.GLSServer).inject();
            this._stakeModel = new dragonwings.InjectProp(game.StakeModel).inject();
            this._historyReplay = false;
        }
        ExitSubgameCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var stateEvent = this.event;
            var stateMode = stateEvent.sender;
            var terminatedSubgame = stateEvent.subgame;
            var currState = stateEvent.state;
            if (terminatedSubgame === game.Subgame.PRE_GAME) {
                var initResponse = this._server.getInitResponse();
                if (!this._historyReplay && initResponse.isRecovering) {
                    // At this point, we know all assets are loaded and we have the
                    // initial logic response already so we just need to determine the
                    // recovery scenario and configure the state machine appropriately
                    var logicResponse = this._server.getLogicResponse();
                    var gameResults = logicResponse.gameResultData;
                    var stake = gameResults.stake;
                    var reelsetIdx = logicResponse.reelsetIndex;
                    var reelStops = logicResponse.reelSpinData[0].reelStops;
                }
                else {
                    // Just a normal game startup
                    this._stateModel.init(game.Subgame.BASE_GAME);
                }
            }
        };
        ExitSubgameCmd.prototype.forceStateAfterDelay = function (fsm, state, delay) {
            TweenMax.delayedCall(delay, this.forceState, [fsm, state], this);
        };
        ExitSubgameCmd.prototype.forceState = function (fsm, state) {
            fsm.forceState(state, false);
        };
        __decorate([
            inject('GameStateModel')
        ], ExitSubgameCmd.prototype, "_stateModel", void 0);
        return ExitSubgameCmd;
    }(game.BaseCmd));
    game.ExitSubgameCmd = ExitSubgameCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CheckForExtraFreeSpinsCmd = (function (_super) {
        __extends(CheckForExtraFreeSpinsCmd, _super);
        function CheckForExtraFreeSpinsCmd() {
            _super.apply(this, arguments);
        }
        CheckForExtraFreeSpinsCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CheckForExtraFreeSpinsCmd->execute()");
            var logicResponse = this._server.getLogicResponse();
            if (logicResponse.fsAwarded > 0) {
                var currentFreeSpins = (logicResponse.fsSpinsTotal - logicResponse.fsSpinNumber);
                this._freeSpinsGameModel.setNumberOfFreeSpins(currentFreeSpins);
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HAS_EXTRA_FREE_SPINS, this));
            }
            else {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HAS_NO_EXTRA_FREE_SPINS, this));
            }
        };
        __decorate([
            inject('GameServer')
        ], CheckForExtraFreeSpinsCmd.prototype, "_server", void 0);
        __decorate([
            inject('LayerManager')
        ], CheckForExtraFreeSpinsCmd.prototype, "_layerManager", void 0);
        __decorate([
            inject('FreeSpinsGameModel')
        ], CheckForExtraFreeSpinsCmd.prototype, "_freeSpinsGameModel", void 0);
        return CheckForExtraFreeSpinsCmd;
    }(game.BaseCmd));
    game.CheckForExtraFreeSpinsCmd = CheckForExtraFreeSpinsCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CheckingIfFreeSpinsGameHasBeenAwardedCmd = (function (_super) {
        __extends(CheckingIfFreeSpinsGameHasBeenAwardedCmd, _super);
        function CheckingIfFreeSpinsGameHasBeenAwardedCmd() {
            _super.apply(this, arguments);
        }
        CheckingIfFreeSpinsGameHasBeenAwardedCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CheckingIfFreeSpinsGameHasBeenAwardedCmd->execute()");
            var logicResponse = this._server.getLogicResponse();
            if (logicResponse.fsSpinsTotal > 0) {
                Utils.PSLog.log("CheckingIfFreeSpinsGameHasBeenAwardedCmd - Free game awarded");
                // Activate and update Free Spin Model with total number of free spins
                this._freeSpinsGameModel.activate();
                var currentFreeSpins = (logicResponse.fsSpinsTotal - logicResponse.fsSpinNumber);
                if (logicResponse.fsAwarded > 0 && logicResponse.fsAwarded < logicResponse.fsSpinsTotal) {
                    currentFreeSpins -= logicResponse.fsAwarded;
                }
                this._freeSpinsGameModel.setNumberOfFreeSpins(currentFreeSpins);
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.FREE_SPINS_GAME_AWARDED, this));
                // Change to Free Spin Games Subgame if we're not already there
                if (this._stateModel.currentSubgame !== game.Subgame.FREE_SPINS_GAME) {
                    this._stateModel.changeSubgame(game.Subgame.FREE_SPINS_GAME, "showFreeSpinsGameIntro");
                }
            }
            else {
                Utils.PSLog.log("CheckingIfFreeSpinsGameHasBeenAwardedCmd - No free game awarded");
                // Reset FS model
                this._freeSpinsGameModel.reset();
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.NO_FREE_SPINS_AWARDED, this));
            }
        };
        __decorate([
            inject('GameServer')
        ], CheckingIfFreeSpinsGameHasBeenAwardedCmd.prototype, "_server", void 0);
        __decorate([
            inject('GameStateModel')
        ], CheckingIfFreeSpinsGameHasBeenAwardedCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('FreeSpinsGameModel')
        ], CheckingIfFreeSpinsGameHasBeenAwardedCmd.prototype, "_freeSpinsGameModel", void 0);
        __decorate([
            inject('LayerManager')
        ], CheckingIfFreeSpinsGameHasBeenAwardedCmd.prototype, "_layerManager", void 0);
        return CheckingIfFreeSpinsGameHasBeenAwardedCmd;
    }(game.BaseCmd));
    game.CheckingIfFreeSpinsGameHasBeenAwardedCmd = CheckingIfFreeSpinsGameHasBeenAwardedCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ExitFreeSpinsGameCmd = (function (_super) {
        __extends(ExitFreeSpinsGameCmd, _super);
        function ExitFreeSpinsGameCmd() {
            _super.apply(this, arguments);
        }
        ExitFreeSpinsGameCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("ExitFreeSpinsGameCmd->execute()");
            this._freeSpinsGameModel.reset();
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.RETURN_TO_BASE_GAME, this));
        };
        __decorate([
            inject('FreeSpinsGameModel')
        ], ExitFreeSpinsGameCmd.prototype, "_freeSpinsGameModel", void 0);
        __decorate([
            inject('LayerManager')
        ], ExitFreeSpinsGameCmd.prototype, "_layerManager", void 0);
        return ExitFreeSpinsGameCmd;
    }(game.BaseCmd));
    game.ExitFreeSpinsGameCmd = ExitFreeSpinsGameCmd;
})(game || (game = {}));
var game;
(function (game) {
    var RequestFreeSpinCmd = (function (_super) {
        __extends(RequestFreeSpinCmd, _super);
        function RequestFreeSpinCmd() {
            _super.apply(this, arguments);
        }
        RequestFreeSpinCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            Utils.PSLog.log("RequestFreeSpinCmd->execute()");
            var logicResponse = this._server.getLogicResponse();
            if (logicResponse.fsSpinNumber === logicResponse.fsSpinsTotal) {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.NO_MORE_FREE_SPINS, this));
            }
            else {
                setTimeout(function () {
                    _this._freeSpinsGameModel.decrementFreeSpinCount();
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.FREE_SPIN_VALID, _this));
                }, 750);
            }
        };
        __decorate([
            inject('GameServer')
        ], RequestFreeSpinCmd.prototype, "_server", void 0);
        __decorate([
            inject('FreeSpinsGameModel')
        ], RequestFreeSpinCmd.prototype, "_freeSpinsGameModel", void 0);
        return RequestFreeSpinCmd;
    }(game.BaseCmd));
    game.RequestFreeSpinCmd = RequestFreeSpinCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ShowFreeSpinsGameLayerCmd = (function (_super) {
        __extends(ShowFreeSpinsGameLayerCmd, _super);
        function ShowFreeSpinsGameLayerCmd() {
            _super.apply(this, arguments);
        }
        ShowFreeSpinsGameLayerCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            Utils.PSLog.log("ShowFreeSpinsGameLayerCmd->execute()");
            this._layerManager.setVisible([
                new game.LayerVisibility(game.LayerViews.BASE, false),
                new game.LayerVisibility(game.LayerViews.FREE_SPINS, true),
                new game.LayerVisibility(game.LayerViews.FS_UI, true),
            ]);
            this._freeSpinsGameIntroView.reset();
            TweenLite.delayedCall(1, function () {
                _this._freeSpinsGameIntroView.reset();
                _this._layerManager.setVisible([
                    new game.LayerVisibility(game.LayerViews.FREE_SPINS_INTRO, false)
                ]);
            });
        };
        __decorate([
            inject('LayerManager')
        ], ShowFreeSpinsGameLayerCmd.prototype, "_layerManager", void 0);
        __decorate([
            inject('FreeSpinsGameIntroView')
        ], ShowFreeSpinsGameLayerCmd.prototype, "_freeSpinsGameIntroView", void 0);
        return ShowFreeSpinsGameLayerCmd;
    }(game.BaseCmd));
    game.ShowFreeSpinsGameLayerCmd = ShowFreeSpinsGameLayerCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ShowFreeSpinsIntroCmd = (function (_super) {
        __extends(ShowFreeSpinsIntroCmd, _super);
        function ShowFreeSpinsIntroCmd() {
            _super.apply(this, arguments);
            this._historyReplay = false;
        }
        ShowFreeSpinsIntroCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            Utils.PSLog.log("ShowFreeSpinsIntroCmd->execute()");
            // Disable force feature so it doesn't carry over into free spins
            // Don't enable during Replay
            if (this._metaData.isGaffingEnabled() && !this._historyModel.getIsHistoryReplay()) {
                this._forceModel.setEnabled(false);
            }
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.SHOW_FREE_SPINS_GAME_INTRO_VIEW, this));
            TweenLite.delayedCall(1, function () {
                _this._freeSpinsGameIntroView.reset();
                _this._layerManager.setVisible([
                    new game.LayerVisibility(game.LayerViews.FREE_SPINS_INTRO, true)
                ]);
            });
        };
        __decorate([
            inject('GameStateModel')
        ], ShowFreeSpinsIntroCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('GameServer')
        ], ShowFreeSpinsIntroCmd.prototype, "_server", void 0);
        __decorate([
            inject('LayerManager')
        ], ShowFreeSpinsIntroCmd.prototype, "_layerManager", void 0);
        __decorate([
            inject('ForceModel')
        ], ShowFreeSpinsIntroCmd.prototype, "_forceModel", void 0);
        __decorate([
            inject('FreeSpinsGameIntroView')
        ], ShowFreeSpinsIntroCmd.prototype, "_freeSpinsGameIntroView", void 0);
        __decorate([
            inject('HistoryModel')
        ], ShowFreeSpinsIntroCmd.prototype, "_historyModel", void 0);
        __decorate([
            inject('MetaData')
        ], ShowFreeSpinsIntroCmd.prototype, "_metaData", void 0);
        return ShowFreeSpinsIntroCmd;
    }(game.BaseCmd));
    game.ShowFreeSpinsIntroCmd = ShowFreeSpinsIntroCmd;
})(game || (game = {}));
var game;
(function (game) {
    var HardResetCmd = (function (_super) {
        __extends(HardResetCmd, _super);
        function HardResetCmd() {
            _super.apply(this, arguments);
        }
        HardResetCmd.prototype.execute = function () {
            Utils.PSLog.log("HardResetCmd::execute()");
            // console.info(`HardResetCmd::execute()`);
            this._partnerAdapter.finishedPlay();
            this._partnerAdapter.finishedPostGameAnimations();
            this._stateModel.init(game.Subgame.BASE_GAME);
            this._stateModel.currentSubgameFSM.init("idle");
            this._autoplayModel.stop();
            this._partnerAdapter.updateBet(this._stakeModel.getTotalStake());
        };
        __decorate([
            inject('PartnerAdapter')
        ], HardResetCmd.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('StakeModel')
        ], HardResetCmd.prototype, "_stakeModel", void 0);
        __decorate([
            inject('GameStateModel')
        ], HardResetCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('AutoPlayModel')
        ], HardResetCmd.prototype, "_autoplayModel", void 0);
        return HardResetCmd;
    }(dragonwings.Command));
    game.HardResetCmd = HardResetCmd;
})(game || (game = {}));
var game;
(function (game) {
    var HideProgressBarCmd = (function (_super) {
        __extends(HideProgressBarCmd, _super);
        function HideProgressBarCmd() {
            _super.apply(this, arguments);
        }
        HideProgressBarCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("HideProgressBarCmd::execute()");
            this._partnerAdapter.hideProgressBar();
        };
        __decorate([
            inject('PartnerAdapter')
        ], HideProgressBarCmd.prototype, "_partnerAdapter", void 0);
        return HideProgressBarCmd;
    }(dragonwings.Command));
    game.HideProgressBarCmd = HideProgressBarCmd;
})(game || (game = {}));
var game;
(function (game) {
    var InitLocalisationCmd = (function (_super) {
        __extends(InitLocalisationCmd, _super);
        function InitLocalisationCmd() {
            _super.apply(this, arguments);
        }
        InitLocalisationCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            this._currencyFormatter.setData(this._server.getInitResponse().currencyData);
            this._translator.setData(this._cache.getAssetById(game.TranslateBundle.TranslationsJson.name).data);
            util.ErrorReporter.setTranslator(this._translator);
        };
        __decorate([
            inject('CurrencyFormatter')
        ], InitLocalisationCmd.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('GameServer')
        ], InitLocalisationCmd.prototype, "_server", void 0);
        __decorate([
            inject('ITranslator')
        ], InitLocalisationCmd.prototype, "_translator", void 0);
        __decorate([
            inject('AssetCache')
        ], InitLocalisationCmd.prototype, "_cache", void 0);
        return InitLocalisationCmd;
    }(dragonwings.Command));
    game.InitLocalisationCmd = InitLocalisationCmd;
})(game || (game = {}));
var game;
(function (game) {
    var InitOpenBetCmd = (function (_super) {
        __extends(InitOpenBetCmd, _super);
        function InitOpenBetCmd() {
            _super.apply(this, arguments);
        }
        InitOpenBetCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            this.updateTopBarBalance();
        };
        InitOpenBetCmd.prototype.updateTopBarBalance = function () {
            Utils.PSLog.log("openbet-->InitOpenBetCmd::updateTopBarBalance()");
            if (this._partnerAdapterEventModel.gameInitializedEventListener) {
                var isRecovering = this._server.getInitResponse().isRecovering;
                var balance = this._server.getInitResponse().balanceData.getBalance(server.BalanceType.CASH_BALANCE);
                var cashBalance = 0;
                var freebetBalance = 0;
                if (this._server.getInitResponse().payloadData && this._server.getInitResponse().payloadData[game.PayloadData.TYPE_INIT]) {
                    var payload = this._server.getInitResponse().payloadData[game.PayloadData.TYPE_INIT];
                    cashBalance = payload.CASH;
                    freebetBalance = payload.FREEBET;
                }
                else {
                    cashBalance = balance;
                }
                var gameInitEvent = new util.GameInitializedEvent(isRecovering, cashBalance, freebetBalance, balance);
                Utils.PSLog.log("   openbet-->InitOpenBetCmd::updateTopBarBalance() - gameInitEvent.balanceAmount = " + gameInitEvent.balanceAmount);
                this._partnerAdapterEventModel.gameInitializedEventListener.handleGameInitializedEvent(gameInitEvent);
            }
            else {
                Utils.PSLog.log("   openbet-->InitOpenBetCmd::updateTopBarBalance() - can't update");
            }
        };
        __decorate([
            inject('GameServer')
        ], InitOpenBetCmd.prototype, "_server", void 0);
        __decorate([
            inject('PartnerAdapterEventModel')
        ], InitOpenBetCmd.prototype, "_partnerAdapterEventModel", void 0);
        return InitOpenBetCmd;
    }(game.BaseCmd));
    game.InitOpenBetCmd = InitOpenBetCmd;
})(game || (game = {}));
var game;
(function (game) {
    var InitPreGameCmd = (function (_super) {
        __extends(InitPreGameCmd, _super);
        function InitPreGameCmd() {
            _super.apply(this, arguments);
        }
        InitPreGameCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var currState = this._stateModel.currentSubgameState;
            var initResponseReceived = this._server.getInitResponse() != undefined;
            var primaryAssetsReady = this._assetMgr.isLoaderComplete(game.AssetStage.PRIMARY);
            if (initResponseReceived && primaryAssetsReady) {
                util.ErrorReporter.setPartnerAdapter(this._partnerAdapter);
                if (currState === "checkRecovery") {
                    var initResponse = this._server.getInitResponse();
                    if (initResponse.isRecovering) {
                        this.doDeferredDispatch(new game.GameEvent(game.GameEvent.RECOVERY_GAME_INIT));
                    }
                    else {
                        this.doDeferredDispatch(new game.GameEvent(game.GameEvent.NORMAL_GAME_INIT));
                    }
                    this.doImmediateDispatch(new game.GameEvent(game.GameEvent.GAME_INIT_COMPLETE));
                }
                else {
                    this.doDeferredDispatch(new game.GameEvent(game.GameEvent.NORMAL_GAME_INIT));
                    this.doImmediateDispatch(new game.GameEvent(game.GameEvent.GAME_INIT_COMPLETE));
                }
            }
        };
        __decorate([
            inject('GameServer')
        ], InitPreGameCmd.prototype, "_server", void 0);
        __decorate([
            inject('GameStateModel')
        ], InitPreGameCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('AssetManager')
        ], InitPreGameCmd.prototype, "_assetMgr", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], InitPreGameCmd.prototype, "_partnerAdapter", void 0);
        return InitPreGameCmd;
    }(game.BaseCmd));
    game.InitPreGameCmd = InitPreGameCmd;
})(game || (game = {}));
var game;
(function (game) {
    var InitStakesModelCmd = (function (_super) {
        __extends(InitStakesModelCmd, _super);
        function InitStakesModelCmd() {
            _super.apply(this, arguments);
        }
        InitStakesModelCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            this._stakeModel.eventListener = this.eventDispatcher;
            var initResponse = this._server.getInitResponse();
            //var custom: CustomInitData = initGameData.getCustomData();
            // fixed paylines
            var payLinesLen = initResponse.paylinesData.paylines.length;
            // calculate available stakes to meet total bet constraints
            var availableStakes = [];
            initResponse.betData[0].availableBets.map(function (data) {
                var stake = Number(data) / payLinesLen;
                availableStakes.push(stake);
            });
            this._stakeModel.setValidStakes(availableStakes, initResponse.betData[0].defaultBetIndex);
            this._stakeModel.setStakeThresholdIndex(initResponse.stakeThresholdIndex);
            this._stakeModel.setMaxWinValue(initResponse.maxWinValue);
            this._stakeModel.setRTPValues(initResponse.rtpBelow200, initResponse.rtpAtLeast200, initResponse.rtpBigBet);
        };
        __decorate([
            inject('GameServer')
        ], InitStakesModelCmd.prototype, "_server", void 0);
        __decorate([
            inject('StakeModel')
        ], InitStakesModelCmd.prototype, "_stakeModel", void 0);
        return InitStakesModelCmd;
    }(dragonwings.Command));
    game.InitStakesModelCmd = InitStakesModelCmd;
})(game || (game = {}));
var game;
(function (game) {
    var LoadAssetsCmd = (function (_super) {
        __extends(LoadAssetsCmd, _super);
        function LoadAssetsCmd() {
            _super.apply(this, arguments);
            this._prePrimaryLoader = new assets.AssetLoader();
            this._primaryLoader = new assets.AssetLoader();
            this._fsLoader = new assets.AssetLoader();
            this._helpLoader = new assets.AssetLoader();
        }
        LoadAssetsCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            Utils.PSLog.log("LoadAssetsCmd::execute() - Loading assests - implies spine load is complete");
            var cdnRoot = this._metaData.getCdnRoot();
            var gameCode = this._metaData.getGameCode();
            var deviceType = (this._deviceDetector.getDeviceClass() === util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation ? "desktop" : "mobile";
            var rootPath = cdnRoot + "/content/" + gameCode + "/resources";
            var audioBasePath = rootPath + "/audio";
            var artBasePath = rootPath + "/art/" + deviceType;
            if (this._device.getScalar() < .6) {
                artBasePath += "/540";
            }
            else if (this._device.getScalar() < 1) {
                artBasePath += "/702";
            }
            else {
                artBasePath += "/1080";
            }
            artBasePath += '/masterassets';
            var delay = this._launchParams.stageLoadDelay;
            this._assetManager.stageLoadDelay = delay;
            ////////////////////////////////////////////
            // Primary loader for essentials: base game, fonts, translations
            var bundle = new game.BaseGameBundle(artBasePath, rootPath);
            bundle.addAssets(this._primaryLoader);
            var translationsBundle = new game.TranslateBundle(rootPath + "/translations", this.getLocale(this._metaData.getLocale()));
            translationsBundle.addAssets(this._primaryLoader);
            var audioBundle = new game.AudioBundle(audioBasePath);
            audioBundle.addAssets(this._primaryLoader);
            this._audioEngine.init(this.eventDispatcher);
            this._partnerAdapter.setMenuHandler("MUTE", function (checked) {
                _this._audioEngine.partnerAdapterMute(checked);
            });
            this._prePrimaryLoader.addFile(rootPath + "/font/MyriadPro-Black.otf", "Myriad Pro Black");
            this._prePrimaryLoader.addFile(rootPath + "/font/MyriadPro-Regular.otf", "Myriad Pro Regular");
            this._prePrimaryLoader.addFile(rootPath + "/font/Myriad-Pro-Semibold-Condensed_0.otf", "Myriad Pro Semibold Condensed");
            // FS loader
            var fsBundle = new game.FSBundle(artBasePath);
            fsBundle.addAssets(this._fsLoader);
            // Help loader
            var helpLoader = new game.HelpBundle(artBasePath);
            helpLoader.addAssets(this._helpLoader);
            // Configure the asset manager with the loaders
            this._dragonwingify.makeEventsGlobal(this._primaryLoader);
            this._dragonwingify.makeEventsGlobal(this._fsLoader);
            this._dragonwingify.makeEventsGlobal(this._helpLoader);
            this._assetManager.addLoader(this._prePrimaryLoader, new game.GameEvent(game.GameEvent.FONT_ASSETS_LOADED));
            this._assetManager.addLoader(this._primaryLoader, new game.GameEvent(game.GameEvent.MAIN_ASSETS_LOADED));
            this._assetManager.addLoader(this._fsLoader, new game.GameEvent(game.GameEvent.FS_ASSETS_LOADED));
            this._assetManager.addLoader(this._helpLoader, new game.GameEvent(game.GameEvent.HELP_ASSETS_LOADED));
            this._assetManager.start();
        };
        LoadAssetsCmd.prototype.getLocale = function (localeCode) {
            var localeLookup = [
                ["bg_bg", "bg"],
                ["ca_es", "ca"],
                ["cs_cz", "cs"],
                ["da_dk", "da"],
                ["de_de", "de"],
                ["el_gr", "el"],
                ["en_gb", "en", ""],
                ["en_us"],
                ["es_es", "es"],
                ["et_ee", "et"],
                ["fi_fi", "fi"],
                ["fr_fr", "fr"],
                ["fr_ca",],
                ["hr_hr", "hr"],
                ["hu_hu", "hu"],
                ["it_it", "it"],
                ["lt_lt", "lt"],
                ["lv_lv", "lv"],
                ["nl_nl", "nl"],
                ["no_no", "no"],
                ["pl_pl", "pl"],
                ["pt_pt", "pt"],
                ["ro_ro", "ro"],
                ["ru_ru", "ru"],
                ["sk_sk", "sk"],
                ["sv_se", "sv"],
                ["sl_si", "sl"],
                ["tr_tr", "tr"]
            ];
            var locale = this._metaData ? this._metaData.getLocale().toLowerCase() : "en_gb";
            var found = false;
            for (var i = 0; i < localeLookup.length; i++) {
                if (localeLookup[i][0].indexOf(locale) > -1) {
                    locale = localeLookup[i][0];
                    found = true;
                    break;
                }
            }
            if (!found) {
                locale = "en_gb";
            }
            return locale;
        };
        __decorate([
            inject('AssetManager')
        ], LoadAssetsCmd.prototype, "_assetManager", void 0);
        __decorate([
            inject('AudioEngine')
        ], LoadAssetsCmd.prototype, "_audioEngine", void 0);
        __decorate([
            inject('AssetCache')
        ], LoadAssetsCmd.prototype, "_cache", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], LoadAssetsCmd.prototype, "_deviceDetector", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], LoadAssetsCmd.prototype, "_launchParams", void 0);
        __decorate([
            inject('DeviceContext')
        ], LoadAssetsCmd.prototype, "_device", void 0);
        __decorate([
            inject('MetaData')
        ], LoadAssetsCmd.prototype, "_metaData", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], LoadAssetsCmd.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('DragonWingify')
        ], LoadAssetsCmd.prototype, "_dragonwingify", void 0);
        return LoadAssetsCmd;
    }(dragonwings.Command));
    game.LoadAssetsCmd = LoadAssetsCmd;
})(game || (game = {}));
var game;
(function (game) {
    var PreloadAudioCmd = (function (_super) {
        __extends(PreloadAudioCmd, _super);
        function PreloadAudioCmd() {
            _super.apply(this, arguments);
        }
        PreloadAudioCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("PreloadAudioCmd::execute() - PreLoading audio assests");
            this._audioEngine.preload();
        };
        __decorate([
            inject('AudioEngine')
        ], PreloadAudioCmd.prototype, "_audioEngine", void 0);
        return PreloadAudioCmd;
    }(dragonwings.Command));
    game.PreloadAudioCmd = PreloadAudioCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ReHideProgressBarCmd = (function (_super) {
        __extends(ReHideProgressBarCmd, _super);
        function ReHideProgressBarCmd() {
            _super.apply(this, arguments);
        }
        ReHideProgressBarCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            (this._partnerAdapter).hideProgressBar();
        };
        __decorate([
            inject('PartnerAdapter')
        ], ReHideProgressBarCmd.prototype, "_partnerAdapter", void 0);
        return ReHideProgressBarCmd;
    }(game.BaseCmd));
    game.ReHideProgressBarCmd = ReHideProgressBarCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ReShowProgressBarCmd = (function (_super) {
        __extends(ReShowProgressBarCmd, _super);
        function ReShowProgressBarCmd() {
            _super.apply(this, arguments);
        }
        ReShowProgressBarCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            this._partnerAdapter.showProgressBar();
        };
        __decorate([
            inject('PartnerAdapter')
        ], ReShowProgressBarCmd.prototype, "_partnerAdapter", void 0);
        return ReShowProgressBarCmd;
    }(game.BaseCmd));
    game.ReShowProgressBarCmd = ReShowProgressBarCmd;
})(game || (game = {}));
var game;
(function (game) {
    // We call this Cmd on every state change
    var ContinueRecoveryCmd = (function (_super) {
        __extends(ContinueRecoveryCmd, _super);
        function ContinueRecoveryCmd() {
            _super.apply(this, arguments);
        }
        ContinueRecoveryCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("ContinueRecoveryCmd::execute() - all inputs now received, initialising recovery state....");
            //this._partnerAdapter.hideProgressBar();
            // Double check that everything is ready - if it isn't, someething is horribly wrong
            var ready = (this._server.getLogicResponse() != undefined);
            ready = ready && this._assetLoader.isLoaderComplete(game.AssetStage.FS);
            ready = ready && this._assetLoader.isLoaderComplete(game.AssetStage.HELP);
            if (ready) {
                // Decide what to do based on the recovery logic response
                // If all assets are loaded and we have the logic response then we can
                // jump to the appropriate game state
                Utils.PSLog.log("ContinueRecoveryCmd::execute() - recovery ready....");
                // This will trigger exit from the pre game checks and ExitPreGameCmd to
                // be executed.... which in turn will initialise the state machine appropriately
                // based on the recovery logic response that we now have
                this.doDeferredDispatch(new game.GameEvent(game.GameEvent.RECOVERY_READY));
            }
            else {
                throw "SHOULDN'T HAVE GOT HERE - assets not loaded!";
            }
        };
        ContinueRecoveryCmd.resumeShown = false;
        __decorate([
            inject('AudioEngine')
        ], ContinueRecoveryCmd.prototype, "_audioEngine", void 0);
        __decorate([
            inject('GameServer')
        ], ContinueRecoveryCmd.prototype, "_server", void 0);
        __decorate([
            inject('ITranslator')
        ], ContinueRecoveryCmd.prototype, "_translator", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], ContinueRecoveryCmd.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('AssetManager')
        ], ContinueRecoveryCmd.prototype, "_assetLoader", void 0);
        return ContinueRecoveryCmd;
    }(game.BaseCmd));
    game.ContinueRecoveryCmd = ContinueRecoveryCmd;
})(game || (game = {}));
var game;
(function (game) {
    // We call this Cmd on every state change
    var InitRecoveryCmd = (function (_super) {
        __extends(InitRecoveryCmd, _super);
        function InitRecoveryCmd() {
            _super.apply(this, arguments);
        }
        InitRecoveryCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("InitRecoveryCmd::execute() - initialising recovery state....");
            // Start the audio engine BEFORE the initial dialog asking for resume. This ensures
            // web audio kicks in (post initial touch) before recovery begins... so that audio 
            // plays correctly in recovery
            this._audioEngine.play(game.AudioBundle.RG_SpinButton.name);
            this.updateEventHub();
            this.showResumeMessage();
        };
        InitRecoveryCmd.prototype.showResumeMessage = function () {
            var message = this._translator.findByKey("com.williamsinteractive.mobile.mobile.INCOMPLETE_GAME");
            var self = this;
            InitRecoveryCmd.resumeShown = true;
            util.ErrorReporter.setPartnerAdapter(this._partnerAdapter);
            util.ErrorReporter.setTranslator(this._translator);
            util.ErrorReporter.showError(message, null, function () {
                // Trigger the recovery logic request on user pressing ok on dialog
                self.doImmediateDispatch(new game.GameEvent(game.GameEvent.RECOVERY_SEND_LOGIC));
            });
        };
        InitRecoveryCmd.prototype.updateEventHub = function () {
            // For recovery we need several pre-conditions to be met before recovering
            // 1) need ALL assets loaded (apart from help)
            // 2) need a logic request to have been send and a response received
            var recoveryInputs = [server.ServerResponseEvent.LOGIC_RESPONSE];
            // On a very fast server / connection the assets may already be loaded
            if (!this._assetLoader.isLoaderComplete(game.AssetStage.FS)) {
                recoveryInputs.push(game.GameEvent.FS_ASSETS_LOADED);
            }
            if (!this._assetLoader.isLoaderComplete(game.AssetStage.HELP)) {
                recoveryInputs.push(game.GameEvent.HELP_ASSETS_LOADED);
            }
            // Upda the event hub
            this._eventHub.addEventGate(recoveryInputs, new game.GameEvent(game.GameEvent.RECOVERY_INPUTS_READY, this));
        };
        InitRecoveryCmd.resumeShown = false;
        __decorate([
            inject('AudioEngine')
        ], InitRecoveryCmd.prototype, "_audioEngine", void 0);
        __decorate([
            inject('ITranslator')
        ], InitRecoveryCmd.prototype, "_translator", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], InitRecoveryCmd.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('AssetManager')
        ], InitRecoveryCmd.prototype, "_assetLoader", void 0);
        __decorate([
            inject('AsyncEventHub')
        ], InitRecoveryCmd.prototype, "_eventHub", void 0);
        return InitRecoveryCmd;
    }(game.BaseCmd));
    game.InitRecoveryCmd = InitRecoveryCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CheckHistoryCmd = (function (_super) {
        __extends(CheckHistoryCmd, _super);
        function CheckHistoryCmd() {
            _super.apply(this, arguments);
        }
        CheckHistoryCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            if (this._historyModel.getIsHistoryReplay()) {
                var logicResponse = this._server.getLogicResponse();
                this._stakeModel.setStakeIndexFromValue(logicResponse.gameResultData.stakePerLine);
            }
        };
        __decorate([
            inject('HistoryModel')
        ], CheckHistoryCmd.prototype, "_historyModel", void 0);
        __decorate([
            inject('GameServer')
        ], CheckHistoryCmd.prototype, "_server", void 0);
        __decorate([
            inject('StakeModel')
        ], CheckHistoryCmd.prototype, "_stakeModel", void 0);
        return CheckHistoryCmd;
    }(game.BaseCmd));
    game.CheckHistoryCmd = CheckHistoryCmd;
})(game || (game = {}));
var game;
(function (game) {
    var InitHistoryCmd = (function (_super) {
        __extends(InitHistoryCmd, _super);
        function InitHistoryCmd() {
            _super.apply(this, arguments);
        }
        InitHistoryCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var replay = this._historyModel.getIsHistoryReplay();
            if (replay) {
                this.loadHistoryModel();
            }
        };
        InitHistoryCmd.prototype.loadHistoryModel = function () {
            this._historyModel.eventDispatcher = this.eventDispatcher;
            this.updateEventHub();
            this._historyModel.loadHistoryData();
            this.eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.HISTORY_REPLAY_DETECTED));
        };
        InitHistoryCmd.prototype.updateEventHub = function () {
            // For history replay we need several pre-conditions to be met before starting
            // 1) need ALL assets loaded (apart from help)
            // 2) need history model data to have successfully loaded
            var replayInputs = [util.history.HistoryModelEvent.COMPLETE, server.ServerResponseEvent.INIT_RESPONSE];
            // Update the event hub
            this._eventHub.addEventGate(replayInputs, new game.GameEvent(game.GameEvent.HISTORY_REPLAY_READY, this));
        };
        __decorate([
            inject('HistoryModel')
        ], InitHistoryCmd.prototype, "_historyModel", void 0);
        __decorate([
            inject('AsyncEventHub')
        ], InitHistoryCmd.prototype, "_eventHub", void 0);
        return InitHistoryCmd;
    }(dragonwings.Command));
    game.InitHistoryCmd = InitHistoryCmd;
})(game || (game = {}));
var game;
(function (game) {
    var SetFeatureDetectorCmd = (function (_super) {
        __extends(SetFeatureDetectorCmd, _super);
        function SetFeatureDetectorCmd() {
            _super.apply(this, arguments);
        }
        SetFeatureDetectorCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            // Check device capabilities and restrict fps appropriately
            var i = 0;
            this._features.setDetector(this._detector);
            this._features.listFeatures();
            var defaultFPS = this._features.isSupported(util.Feature.SIXTY_FPS) ? 60 : 30;
            if (this._params.fps) {
                defaultFPS = this._params.fps;
            }
            (this._stage).fps = defaultFPS;
        };
        __decorate([
            inject('Stage')
        ], SetFeatureDetectorCmd.prototype, "_stage", void 0);
        __decorate([
            inject('IFeatureCapabilities')
        ], SetFeatureDetectorCmd.prototype, "_features", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], SetFeatureDetectorCmd.prototype, "_detector", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], SetFeatureDetectorCmd.prototype, "_params", void 0);
        return SetFeatureDetectorCmd;
    }(dragonwings.Command));
    game.SetFeatureDetectorCmd = SetFeatureDetectorCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ShowMaxWinCmd = (function (_super) {
        __extends(ShowMaxWinCmd, _super);
        function ShowMaxWinCmd() {
            _super.apply(this, arguments);
        }
        ShowMaxWinCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            this.doDeferredDispatch(new game.GameEvent(game.GameEvent.SHOW_MAX_WIN, this), 1);
            TweenMax.delayedCall(4, function () {
                _this.returnToBG();
                _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.SHOW_MAX_WIN_COMPLETE, _this));
            });
        };
        ShowMaxWinCmd.prototype.returnToBG = function () {
            this._stateModel.exitCurrentSubgame();
            var baseFSM = this._stateModel.currentSubgameFSM;
            baseFSM.init("spinComplete");
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.RETURN_TO_BASE_GAME, this));
            this._layerManager.setVisible([
                new game.LayerVisibility(game.LayerViews.BASE, true),
                new game.LayerVisibility(game.LayerViews.FREE_SPINS, false),
                new game.LayerVisibility(game.LayerViews.FS_UI, false)
            ]);
        };
        __decorate([
            inject('GameStateModel')
        ], ShowMaxWinCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('LayerManager')
        ], ShowMaxWinCmd.prototype, "_layerManager", void 0);
        return ShowMaxWinCmd;
    }(game.BaseCmd));
    game.ShowMaxWinCmd = ShowMaxWinCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ShowProgressBarCmd = (function (_super) {
        __extends(ShowProgressBarCmd, _super);
        function ShowProgressBarCmd() {
            _super.apply(this, arguments);
            this._partnerAdapter = new dragonwings.InjectProp(util.PartnerAdapter).inject();
            this._assetLoader = new dragonwings.InjectProp(game.AssetManager).inject();
        }
        ShowProgressBarCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("ShowProgressBarCmd::execute()");
            console.log('is loader complete', this._assetLoader.isLoaderComplete(game.AssetStage.HELP));
            // If secondary assets are not currently loaded, show the progress bar again until ALL assets are loaded
            if (!this._assetLoader.isLoaderComplete(game.AssetStage.HELP)) {
                Utils.PSLog.log("ShowProgressBarCmd::execute() - secondary assets not currently loaded");
                this._partnerAdapter.showProgressBar();
            }
        };
        return ShowProgressBarCmd;
    }(game.BaseCmd));
    game.ShowProgressBarCmd = ShowProgressBarCmd;
})(game || (game = {}));
var game;
(function (game) {
    var StartBaseGameCmd = (function (_super) {
        __extends(StartBaseGameCmd, _super);
        function StartBaseGameCmd() {
            _super.apply(this, arguments);
            this._historyReplay = false;
        }
        StartBaseGameCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var initResponse = this._server.getInitResponse();
            var isReplay = this._historyModel.getIsHistoryReplay();
            if (!isReplay && initResponse.isRecovering) {
            }
            else {
                // Just a normal startup
                this._stateModel.init(game.Subgame.BASE_GAME);
            }
        };
        __decorate([
            inject('GameStateModel')
        ], StartBaseGameCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('GameServer')
        ], StartBaseGameCmd.prototype, "_server", void 0);
        __decorate([
            inject('StakeModel')
        ], StartBaseGameCmd.prototype, "_stakeModel", void 0);
        __decorate([
            inject('HistoryModel')
        ], StartBaseGameCmd.prototype, "_historyModel", void 0);
        return StartBaseGameCmd;
    }(game.BaseCmd));
    game.StartBaseGameCmd = StartBaseGameCmd;
})(game || (game = {}));
var game;
(function (game) {
    var UpdateSpinModelCmd = (function (_super) {
        __extends(UpdateSpinModelCmd, _super);
        function UpdateSpinModelCmd() {
            _super.apply(this, arguments);
            this._server = new dragonwings.InjectProp(server.GLSServer).inject();
            this._spinModel = new dragonwings.InjectProp(game.SpinModel).inject(); // Singleton spin model
        }
        UpdateSpinModelCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            /*var logicResponse: IFPMLogicResponse = this._server.getLogicResponse();
            var gameResults: server.GameResultData = logicResponse.gameResultData;
            var reelsetIdx: number = logicResponse.reelsetIndex;
            var stackSymbolId: number = logicResponse.stackSymbolId;
            var reelStops: number[] = logicResponse.reelSpinData[0].reelStops;*/
            // For base game spins, we only animate scatters if they are sequential from 2nd reel
            // so we need to stagger delays on those reels appropriately 
            /*for (var reelNum: number = 1; reelNum < 4; ++reelNum) {
                if (this._spinModel.getScatter(reelNum) > -1) {
                    //if (!this._bbModel.isActive()) {
                        if (this._spinModel.getSequentialScatters(reelNum)) {
                            this.delayStop(reelNum);
                        }
                    //} else {
                    //    this.delayStop(reelNum);
                    //}
                } else {
                    this._spinModel.setStagger(reelNum, BaseGameUIConstants.scatterReelPause[0]);
                }
            }*/
        };
        return UpdateSpinModelCmd;
    }(game.BaseCmd));
    game.UpdateSpinModelCmd = UpdateSpinModelCmd;
})(game || (game = {}));
var game;
(function (game) {
    var UpdateProgressBarCmd = (function (_super) {
        __extends(UpdateProgressBarCmd, _super);
        function UpdateProgressBarCmd() {
            _super.apply(this, arguments);
        }
        UpdateProgressBarCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var assetEvent = this.event;
            var progress = Math.min(1, assetEvent.progress / 100);
            this._partnerAdapter.updatedLoadingProgress(progress);
        };
        __decorate([
            inject('PartnerAdapter')
        ], UpdateProgressBarCmd.prototype, "_partnerAdapter", void 0);
        return UpdateProgressBarCmd;
    }(dragonwings.Command));
    game.UpdateProgressBarCmd = UpdateProgressBarCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateFiveOfAKindCmd = (function (_super) {
        __extends(CreateFiveOfAKindCmd, _super);
        function CreateFiveOfAKindCmd() {
            _super.apply(this, arguments);
        }
        CreateFiveOfAKindCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateFiveOfAKindCmd::execute()");
            var fiveOfAKindLayer = this._layerMgr.getLayerWithId(game.LayerViews.FIVE_OF_A_KIND);
            fiveOfAKindLayer.eventDispatcher = this.eventDispatcher;
            this._fiverOfAKindView.construct();
            fiveOfAKindLayer.addChild(this._fiverOfAKindView);
        };
        __decorate([
            inject('LayerManager')
        ], CreateFiveOfAKindCmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('FiveOfAKindView')
        ], CreateFiveOfAKindCmd.prototype, "_fiverOfAKindView", void 0);
        return CreateFiveOfAKindCmd;
    }(game.BaseCmd));
    game.CreateFiveOfAKindCmd = CreateFiveOfAKindCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateReelsetCmd = (function (_super) {
        __extends(CreateReelsetCmd, _super);
        function CreateReelsetCmd() {
            _super.apply(this, arguments);
        }
        CreateReelsetCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var reelLayer = this._layerMgr.getLayerWithId(game.LayerViews.REELS);
            reelLayer.eventDispatcher = this.eventDispatcher;
            // add container to reel layer
            this._reels.construct();
            reelLayer.addChild(this._reels);
        };
        __decorate([
            inject('LayerManager')
        ], CreateReelsetCmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('ReelsView')
        ], CreateReelsetCmd.prototype, "_reels", void 0);
        __decorate([
            inject('GameServer')
        ], CreateReelsetCmd.prototype, "_server", void 0);
        __decorate([
            inject('AssetCache')
        ], CreateReelsetCmd.prototype, "_cache", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateReelsetCmd.prototype, "_deviceClass", void 0);
        __decorate([
            inject('ReelsForceTool')
        ], CreateReelsetCmd.prototype, "_reelsForce", void 0);
        return CreateReelsetCmd;
    }(game.BaseCmd));
    game.CreateReelsetCmd = CreateReelsetCmd;
})(game || (game = {}));
var game;
(function (game) {
    var SpinReelsCmd = (function (_super) {
        __extends(SpinReelsCmd, _super);
        function SpinReelsCmd() {
            _super.apply(this, arguments);
        }
        SpinReelsCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("SpinReelsCmd->execute()");
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.REEL_SPIN_STARTED));
        };
        return SpinReelsCmd;
    }(game.BaseCmd));
    game.SpinReelsCmd = SpinReelsCmd;
})(game || (game = {}));
var game;
(function (game) {
    var HandleGlsErrorCmd = (function (_super) {
        __extends(HandleGlsErrorCmd, _super);
        function HandleGlsErrorCmd() {
            _super.apply(this, arguments);
        }
        HandleGlsErrorCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            this.resetGame();
            this._partnerAdapter.finishedPlay();
            this._partnerAdapter.finishedPostGameAnimations();
            var serverEvent = this.event;
            var message = serverEvent.response.errorData.rawData.response;
            if (message == "" || message.indexOf("500 - Internal server error.") != -1) {
                message = this._translator.findByKey("com.williamsinteractive.mobile.mobile.ERROR_CONNECTION_BODY");
                util.ErrorReporter.showError(message, null, function () {
                    _this._partnerAdapter.reload();
                });
            }
            else if (serverEvent.response.errorData.message) {
                try {
                    this._partnerAdapter.receivedGameLogicResponse(serverEvent.response.errorData.rawData);
                }
                catch (e) {
                }
            }
        };
        HandleGlsErrorCmd.prototype.resetGame = function () {
            this._audioEngine.reset();
        };
        __decorate([
            inject('ITranslator')
        ], HandleGlsErrorCmd.prototype, "_translator", void 0);
        __decorate([
            inject('GameStateModel')
        ], HandleGlsErrorCmd.prototype, "_statesModel", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], HandleGlsErrorCmd.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('AudioEngine')
        ], HandleGlsErrorCmd.prototype, "_audioEngine", void 0);
        __decorate([
            inject('AutoPlayModel')
        ], HandleGlsErrorCmd.prototype, "_asModel", void 0);
        return HandleGlsErrorCmd;
    }(game.BaseCmd));
    game.HandleGlsErrorCmd = HandleGlsErrorCmd;
})(game || (game = {}));
var game;
(function (game) {
    var MakeEndRequestCmd = (function (_super) {
        __extends(MakeEndRequestCmd, _super);
        function MakeEndRequestCmd() {
            _super.apply(this, arguments);
        }
        MakeEndRequestCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("MakeEndRequestCmd::execute()");
            //End Request not required if history is running.
            var historyReplay = this._historyModel.getIsHistoryReplay();
            if (!historyReplay) {
                this._server.makeEndRequest(new server.GLSRequest([]));
            }
        };
        __decorate([
            inject('GameServer')
        ], MakeEndRequestCmd.prototype, "_server", void 0);
        __decorate([
            inject('HistoryModel')
        ], MakeEndRequestCmd.prototype, "_historyModel", void 0);
        __decorate([
            inject('FreeSpinsGameModel')
        ], MakeEndRequestCmd.prototype, "_freeSpinsGameModel", void 0);
        return MakeEndRequestCmd;
    }(dragonwings.Command));
    game.MakeEndRequestCmd = MakeEndRequestCmd;
})(game || (game = {}));
var game;
(function (game) {
    var MakeInitRequestCmd = (function (_super) {
        __extends(MakeInitRequestCmd, _super);
        function MakeInitRequestCmd() {
            _super.apply(this, arguments);
        }
        MakeInitRequestCmd.prototype.execute = function () {
            var _this = this;
            _super.prototype.execute.call(this);
            // Add HistoryReplay data if required
            var historyReplay = this._historyModel.getIsHistoryReplay();
            if (historyReplay && !this._historyModel.isLoaded()) {
                this.eventDispatcher.addEventListener(util.history.HistoryModelEvent.COMPLETE, function () { return _this.sendRequest(true); }, this);
                return;
            }
            this.sendRequest(historyReplay);
        };
        MakeInitRequestCmd.prototype.sendRequest = function (historyReplay) {
            var encoders = [
                new game.PageEncoder(this._server.getInitResponse() ? this._server.getInitResponse().pageData.pageIndex + 1 : 0)
            ];
            var initData = new server.GLSRequest(encoders);
            if (historyReplay) {
                var historyData = this._historyModel.getNextState(false);
                encoders.push(new game.ReplayEncoder(historyData));
            }
            this._server.makeInitRequest(initData);
        };
        __decorate([
            inject('GameServer')
        ], MakeInitRequestCmd.prototype, "_server", void 0);
        __decorate([
            inject('HistoryModel')
        ], MakeInitRequestCmd.prototype, "_historyModel", void 0);
        return MakeInitRequestCmd;
    }(dragonwings.Command));
    game.MakeInitRequestCmd = MakeInitRequestCmd;
})(game || (game = {}));
var game;
(function (game) {
    var MakePlayRequestCmd = (function (_super) {
        __extends(MakePlayRequestCmd, _super);
        function MakePlayRequestCmd() {
            _super.apply(this, arguments);
        }
        MakePlayRequestCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("MakePlayRequestCmd::execute()");
            this.sendRequest();
        };
        MakePlayRequestCmd.prototype.sendRequest = function () {
            var payload = [];
            var totalStake = this._stakeModel.getTotalStake();
            payload.push(new game.StakeEncoder(totalStake));
            payload.push(new server.GLSCurrencyEncoder(this._server.getInitResponse().platformData.currencyMultiplier));
            if (this._forceModel && this._forceModel.isEnabled) {
                var stops = this._forceModel.positions;
                if (stops.length > 0) {
                    Utils.PSLog.log("MakePlayRequestCmd::execute() - adding FORCE payload: " + stops);
                    payload.push(new game.ForceEncoder(this._forceModel.positions, this._forceModel.reelsetIndex));
                }
                // disable force so that it doesn't carry over to next spin
                this._forceModel.setEnabled(false);
            }
            // Add HistoryReplay data if required
            if (this._historyModel.getIsHistoryReplay()) {
                var historyData = this._historyModel.getNextState(true);
                if (historyData) {
                    Utils.PSLog.log("MakePlayRequestCmd::execute() - adding REPLAY payload");
                    payload.push(new game.ReplayEncoder(historyData));
                }
            }
            var data = new server.GLSRequest(payload);
            //////////////////////////////
            // Diagnostic purposes only
            var initResponse = this._server.getInitResponse();
            var recoveryRequest = initResponse.isRecovering;
            if (!recoveryRequest) {
                Utils.PSLog.log("MakePlayRequestCmd::execute() - normal logic request");
            }
            else {
                var initialRecoveryRequest = (this._server.getLogicResponse() == undefined);
                if (initialRecoveryRequest) {
                    Utils.PSLog.log("MakePlayRequestCmd::execute() - initial recovery logic request");
                }
                else {
                    Utils.PSLog.log("MakePlayRequestCmd::execute() - subsequent recovery logic request");
                }
            }
            this._server.makeLogicRequest(data);
            //(<any>this._partnerAdapter).updateBet(0);
            this._partnerAdapter.startedPlay();
        };
        __decorate([
            inject('GameServer')
        ], MakePlayRequestCmd.prototype, "_server", void 0);
        __decorate([
            inject('ForceModel')
        ], MakePlayRequestCmd.prototype, "_forceModel", void 0);
        __decorate([
            inject('StakeModel')
        ], MakePlayRequestCmd.prototype, "_stakeModel", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], MakePlayRequestCmd.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('HistoryModel')
        ], MakePlayRequestCmd.prototype, "_historyModel", void 0);
        return MakePlayRequestCmd;
    }(dragonwings.Command));
    game.MakePlayRequestCmd = MakePlayRequestCmd;
})(game || (game = {}));
var game;
(function (game) {
    var UpdatePartnerCmd = (function (_super) {
        __extends(UpdatePartnerCmd, _super);
        function UpdatePartnerCmd() {
            _super.apply(this, arguments);
        }
        UpdatePartnerCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var initResponse = this._server.getInitResponse();
            var response;
            var serverEvent = this.event;
            this._isRecovering = initResponse.isRecovering;
            if (serverEvent.eventName == server.ServerResponseEvent.LOGIC_RESPONSE ||
                serverEvent.eventName == game.StakeModelEvent.STAKE_MODEL_CHANGED) {
                this.updatePartnerStake();
            }
            var responseObject;
            if (serverEvent.eventName == server.ServerResponseEvent.INIT_RESPONSE) {
                responseObject = this._server.getInitResquester().getRequestObject();
            }
            else if (serverEvent.eventName == server.ServerResponseEvent.LOGIC_RESPONSE) {
                responseObject = this._server.getLogicResquester().getRequestObject();
            }
            else if (serverEvent.eventName == server.ServerResponseEvent.END_RESPONSE) {
                this.onEndResponse();
                responseObject = this._server.getEndResquester().getRequestObject();
            }
            if (responseObject != null) {
                Utils.PSLog.log("UpdatePartnerCmd::execute() - updating received game logic response");
                this._partnerAdapter.receivedGameLogicResponse(responseObject);
            }
        };
        UpdatePartnerCmd.prototype.updatePartnerStake = function () {
            // We'll need to update this to accomodate BigBet stakes later but for now...
            var stake = this._stakeModel.getTotalStake();
            var update = true;
            // Don't update the partner stake if we're recovering and still in pre-game state
            if ((this._stateModel.currentSubgame === game.Subgame.PRE_GAME) && (this._isRecovering)) {
                update = false;
            }
            if ((stake > 0) && (update)) {
                Utils.PSLog.log("UpdatePartnerCmd::updateStake() - updating partner stake: " + stake);
                this._partnerAdapter.updateBet(stake);
            }
        };
        UpdatePartnerCmd.prototype.onEndResponse = function () {
            this._partnerAdapter.finishedPlay();
            this._partnerAdapter.finishedPostGameAnimations();
            if (this._autoplayModel) {
                if (this._stateModel.currentSubgame == game.Subgame.BASE_GAME && this._autoplayModel.isInProgress()) {
                    var logicResponse = this._server.getLogicResponse();
                    this._autoplayModel.updateWinAndStake(logicResponse.totalWagerWin, this._stakeModel.getTotalStake());
                }
            }
        };
        __decorate([
            inject('PartnerAdapter')
        ], UpdatePartnerCmd.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('StakeModel')
        ], UpdatePartnerCmd.prototype, "_stakeModel", void 0);
        __decorate([
            inject('GameStateModel')
        ], UpdatePartnerCmd.prototype, "_stateModel", void 0);
        __decorate([
            inject('AutoPlayModel')
        ], UpdatePartnerCmd.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('GameServer')
        ], UpdatePartnerCmd.prototype, "_server", void 0);
        return UpdatePartnerCmd;
    }(dragonwings.Command));
    game.UpdatePartnerCmd = UpdatePartnerCmd;
})(game || (game = {}));
var game;
(function (game) {
    // Used to update the partner stake once we are sure the bet has been approved
    var UpdatePartnerStakeCmd = (function (_super) {
        __extends(UpdatePartnerStakeCmd, _super);
        function UpdatePartnerStakeCmd() {
            _super.apply(this, arguments);
            this._stakeModel = new dragonwings.InjectProp(game.StakeModel).inject();
            this._partnerAdapter = new dragonwings.InjectProp(util.PartnerAdapter).inject();
        }
        UpdatePartnerStakeCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var stake = -1;
            // We'll need to update this to accomodate BigBet stakes later but for now...
            stake = this._stakeModel.getTotalStake();
            if (stake > 0) {
                Utils.PSLog.log("UpdatePartnerStakeCmd::exexute() - updating partner stake: " + stake);
                this._partnerAdapter.updateBet(stake);
            }
        };
        return UpdatePartnerStakeCmd;
    }(dragonwings.Command));
    game.UpdatePartnerStakeCmd = UpdatePartnerStakeCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateBaseControlPanelView = (function (_super) {
        __extends(CreateBaseControlPanelView, _super);
        function CreateBaseControlPanelView() {
            _super.apply(this, arguments);
        }
        CreateBaseControlPanelView.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateFreeSpinsView::execute()");
            console.log(this._freeSpinsGameBackgroundView);
            // todo
            // - Add FS reelset to FS layer
            // - Add FS dashboard to FS layer
            var freeSpinsLayer = this._layerMgr.getLayerWithId(game.LayerViews.FREE_SPINS);
            freeSpinsLayer.eventDispatcher = this.eventDispatcher;
            this._freeSpinsGameBackgroundView.construct();
            freeSpinsLayer.addChild(this._freeSpinsGameBackgroundView);
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._freeSpinsGameBackgroundView));
        };
        __decorate([
            inject('LayerManager')
        ], CreateBaseControlPanelView.prototype, "_layerMgr", void 0);
        __decorate([
            inject('FreeSpinsGameBackgroundView')
        ], CreateBaseControlPanelView.prototype, "_freeSpinsGameBackgroundView", void 0);
        return CreateBaseControlPanelView;
    }(game.BaseCmd));
    game.CreateBaseControlPanelView = CreateBaseControlPanelView;
})(game || (game = {}));
var game;
(function (game) {
    var CreateBaseViewCmd = (function (_super) {
        __extends(CreateBaseViewCmd, _super);
        function CreateBaseViewCmd() {
            _super.apply(this, arguments);
        }
        CreateBaseViewCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateBaseViewCmd::execute()");
            var baseLayer = this._layerMgr.getLayerWithId(game.LayerViews.BASE);
            baseLayer.eventDispatcher = this.eventDispatcher;
            this._baseGameView.construct();
            baseLayer.addChild(this._baseGameView);
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.BASE_VIEW_READY, this));
            // Set default layer visibility
            this._layerMgr.setVisible([
                new game.LayerVisibility(game.LayerViews.BASE, true),
                new game.LayerVisibility(game.LayerViews.REELS, false),
                new game.LayerVisibility(game.LayerViews.REELS_OVERLAY, true),
                new game.LayerVisibility(game.LayerViews.FIVE_OF_A_KIND, true),
                new game.LayerVisibility(game.LayerViews.HUD, false),
                new game.LayerVisibility(game.LayerViews.UI, false),
                new game.LayerVisibility(game.LayerViews.FREE_SPINS_INTRO, false),
                new game.LayerVisibility(game.LayerViews.FREE_SPINS, false),
                new game.LayerVisibility(game.LayerViews.FS_UI, false),
                new game.LayerVisibility(game.LayerViews.HELP, false)
            ]);
        };
        __decorate([
            inject('LayerManager')
        ], CreateBaseViewCmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('BaseGameView')
        ], CreateBaseViewCmd.prototype, "_baseGameView", void 0);
        return CreateBaseViewCmd;
    }(game.BaseCmd));
    game.CreateBaseViewCmd = CreateBaseViewCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateCyclersCmd = (function (_super) {
        __extends(CreateCyclersCmd, _super);
        function CreateCyclersCmd() {
            _super.apply(this, arguments);
            this._isDesktop = false;
        }
        CreateCyclersCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            // Figure out scaling of the UI elements based on desktop / mobile
            var deviceClass = this._deviceClass.getDeviceClass();
            this._isDesktop = (deviceClass == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            var overlayLayer = this._layermgr.getLayerWithId(game.LayerViews.REELS_OVERLAY);
            overlayLayer.eventDispatcher = this.eventDispatcher;
            this.initialiseSymbols(overlayLayer);
        };
        CreateCyclersCmd.prototype.initialiseSymbols = function (layer) {
            var kCols = 5;
            var kRows = 3;
            var anchorX;
            var anchorY;
            var symbolWidth;
            var symbolHeight;
            var gridGap;
            if (this._isDesktop) {
                symbolWidth = game.BaseGameUIConstants.kDesktopPaylineSquareWidth;
                symbolHeight = game.BaseGameUIConstants.kDesktopSymbolHeight;
                anchorX = game.BaseGameUIConstants.kPaylineAnchorX;
                anchorY = game.BaseGameUIConstants.kPaylineAnchorY;
                gridGap = game.BaseGameUIConstants.kPaylineSquareGapX;
            }
            else {
                symbolWidth = game.BaseGameUIConstants.kMobilePaylineSquareWidth;
                symbolHeight = game.BaseGameUIConstants.kMobileSymbolHeight;
                anchorX = game.BaseGameUIConstants.kMobilePaylineAnchorX;
                anchorY = game.BaseGameUIConstants.kMobilePaylineAnchorY;
                gridGap = game.BaseGameUIConstants.kMobilePaylineSquareGapX;
            }
            this._grid = new components.PaylineGrid(anchorX, anchorY, kCols, kRows, symbolWidth, symbolHeight, gridGap, game.BaseGameUIConstants.kGridYGap);
            var paylines = this.getPaylines(kCols);
            // init payline display
            var paylineDisplay = new game.PaylineDisplay(this._grid, paylines);
            paylineDisplay.isDesktop = this._isDesktop;
            if (this._isDesktop) {
                paylineDisplay.scalar = this._device.getScalar();
            }
            // init payline cyclers
            var singleBlinkCycler = new components.CFPaylinesCycler(paylineDisplay, 1, 0.5);
            this._dragonwingify.makeEventsGlobal(singleBlinkCycler);
            singleBlinkCycler.setCycleCount(1);
            var doubleBlinkCycler = new components.CFPaylinesCycler(paylineDisplay, 2, 0.5);
            this._dragonwingify.makeEventsGlobal(doubleBlinkCycler);
            doubleBlinkCycler.setCycleCount(1);
            // set cyclers
            this._cyclers.setPaylineDisplay(paylineDisplay);
            this._cyclers.setPaylineCyclers(singleBlinkCycler, doubleBlinkCycler);
            layer.addChild(paylineDisplay);
        };
        CreateCyclersCmd.prototype.getPaylines = function (cols) {
            var paylines = [];
            var linesData = this._server.getInitResponse().paylinesData;
            var paylinesColours = this.getPaylineColours();
            for (var i = 0; i < linesData.paylines.length; i++) {
                var positions = [];
                var yPos;
                var xPos;
                for (var j = 0; j < linesData.paylines[i].offsets.length; j++) {
                    yPos = Math.floor(linesData.paylines[i].offsets[j] / cols);
                    xPos = linesData.paylines[i].offsets[j] % cols;
                    positions[xPos] = yPos;
                }
                var payline = new components.Payline(positions, game.BaseGameUIConstants.kPaylineLineWidth, game.BaseGameUIConstants.kPaylineShowOutline, paylinesColours[i], game.BaseGameUIConstants.kPaylineDarkPercent, game.BaseGameUIConstants.kPaylineOutlineColour, game.BaseGameUIConstants.kPaylineOutlineThickness);
                var xPos = 0;
                var yPos = 0;
                payline.setOffsets([
                    new util.Point(xPos, yPos),
                    new util.Point(xPos, yPos),
                    new util.Point(xPos, yPos),
                    new util.Point(xPos, yPos),
                    new util.Point(xPos, yPos)
                ]);
                paylines.push(payline);
            }
            return paylines;
        };
        // protected getDesktopBoxes(): assets.IFrame[] {
        //     var results: assets.IFrame[] = [];
        //     return results;
        // }
        // protected getDesktopPaylines(): rendering.Bitmap[] {
        //     var results: rendering.Bitmap[] = [];
        //     return results;
        // }
        // CFHD has 25 paylines
        CreateCyclersCmd.prototype.getPaylineColours = function () {
            var paylinesColours = [
                0xf19b0d,
                // 0x93600a,
                0xec6618,
                // 0x903f10,
                0xfae714,
                // 0x988d0e,
                0xfe1313,
                // 0x930707,
                0xfdf81e,
                // 0xa6a223,
                0xfe8618,
                // 0x974800,
                0xefbb23,
                // 0x97761a,
                0xdc1f13,
                // 0x891c15,
                0xdde737,
                // 0x858b1b,
                0xb62523,
                // 0x670503,
                0xc9fa22,
                // 0x7c9b11,
                0xe98200,
                // 0x8c4d00,
                0xeda300,
                // 0x875d00,
                0xf58500,
                // 0x934f00,
                0xf8d316,
                // 0x9e8716,
                0x14eaef,
                // 0x109396,
                0x583fed,
                // 0x312487,
                0xb3ff17,
                // 0x679605,
                0xff586b,
                // 0x902d38,
                0xbf228e,
                // 0x721455,
                0x66fe1f,
                // 0x449f19,
                0x22c40a,
                // 0x18790a,
                0xaa13e3,
                // 0x853ba0,
                0x08b6dc,
                // 0x046b81,
                0x054d9d,
            ];
            return paylinesColours;
        };
        __decorate([
            inject('DeviceContext')
        ], CreateCyclersCmd.prototype, "_device", void 0);
        __decorate([
            inject('LayerManager')
        ], CreateCyclersCmd.prototype, "_layermgr", void 0);
        __decorate([
            inject('GameServer')
        ], CreateCyclersCmd.prototype, "_server", void 0);
        __decorate([
            inject('CyclersModel')
        ], CreateCyclersCmd.prototype, "_cyclers", void 0);
        __decorate([
            inject('PaylineDisplay')
        ], CreateCyclersCmd.prototype, "_paylineDisplay", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateCyclersCmd.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], CreateCyclersCmd.prototype, "_launchParams", void 0);
        return CreateCyclersCmd;
    }(game.BaseCmd));
    game.CreateCyclersCmd = CreateCyclersCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateDebugOverlayCmd = (function (_super) {
        __extends(CreateDebugOverlayCmd, _super);
        function CreateDebugOverlayCmd() {
            _super.apply(this, arguments);
        }
        CreateDebugOverlayCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            var showDebugOverlay = this._launchParams.debugOverlay && this._metaData.isGaffingEnabled();
            if (showDebugOverlay) {
                this._debugOverlayView.construct();
                this._debugOverlayView.visible = false;
                this._stage.addChild(this._debugOverlayView);
                this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._debugOverlayView));
            }
            if (this._metaData.isGaffingEnabled()) {
                this._demoView.construct(isDesktop);
                this._demoView.visible = false;
                this._stage.addChild(this._demoView);
                this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._demoView));
            }
        };
        __decorate([
            inject('DebugOverlayView')
        ], CreateDebugOverlayCmd.prototype, "_debugOverlayView", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], CreateDebugOverlayCmd.prototype, "_launchParams", void 0);
        __decorate([
            inject('MetaData')
        ], CreateDebugOverlayCmd.prototype, "_metaData", void 0);
        __decorate([
            inject('Stage')
        ], CreateDebugOverlayCmd.prototype, "_stage", void 0);
        __decorate([
            inject('DemoView')
        ], CreateDebugOverlayCmd.prototype, "_demoView", void 0);
        __decorate([
            inject('DeviceContext')
        ], CreateDebugOverlayCmd.prototype, "_device", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateDebugOverlayCmd.prototype, "_deviceClass", void 0);
        return CreateDebugOverlayCmd;
    }(game.BaseCmd));
    game.CreateDebugOverlayCmd = CreateDebugOverlayCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateFSUICmd = (function (_super) {
        __extends(CreateFSUICmd, _super);
        function CreateFSUICmd() {
            _super.apply(this, arguments);
        }
        CreateFSUICmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateFSUICmd::execute()");
            var isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            var FSLayer = this._layerMgr.getLayerWithId(game.LayerViews.FREE_SPINS);
            FSLayer.eventDispatcher = this.eventDispatcher;
            var overlaysLayer = this._layerMgr.getLayerWithId(game.LayerViews.OVERLAYS);
            overlaysLayer.eventDispatcher = this.eventDispatcher;
            var fsuiLayer = this._layerMgr.getLayerWithId(game.LayerViews.FS_UI);
            fsuiLayer.eventDispatcher = this.eventDispatcher;
            this._fsBackgroundView.construct();
            FSLayer.addChild(this._fsBackgroundView);
            this._fsControlPanelView.construct(isDesktop);
            fsuiLayer.addChild(this._fsControlPanelView);
            this._fsReelsetFrameView.construct();
            FSLayer.addChild(this._fsReelsetFrameView);
            this._fsRemainingView.construct(isDesktop);
            fsuiLayer.addChild(this._fsRemainingView);
            this._maxWinView.construct();
            overlaysLayer.addChild(this._maxWinView);
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._fsgWinMeterTextView));
        };
        __decorate([
            inject('LayerManager')
        ], CreateFSUICmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('FreeSpinsGameBackgroundView')
        ], CreateFSUICmd.prototype, "_fsBackgroundView", void 0);
        __decorate([
            inject('FreeSpinsGameControlPanelView')
        ], CreateFSUICmd.prototype, "_fsControlPanelView", void 0);
        __decorate([
            inject('FSGWinMeterTextView')
        ], CreateFSUICmd.prototype, "_fsgWinMeterTextView", void 0);
        __decorate([
            inject('FreeSpinsGameReelsetFrameView')
        ], CreateFSUICmd.prototype, "_fsReelsetFrameView", void 0);
        __decorate([
            inject('FreeSpinsRemainingView')
        ], CreateFSUICmd.prototype, "_fsRemainingView", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateFSUICmd.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], CreateFSUICmd.prototype, "_launchParams", void 0);
        __decorate([
            inject('MaxWinView')
        ], CreateFSUICmd.prototype, "_maxWinView", void 0);
        return CreateFSUICmd;
    }(game.BaseCmd));
    game.CreateFSUICmd = CreateFSUICmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateForceCmd = (function (_super) {
        __extends(CreateForceCmd, _super);
        function CreateForceCmd() {
            _super.apply(this, arguments);
        }
        CreateForceCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            if (!this._metaData.isGaffingEnabled()) {
                return;
            }
            this._forceModel.eventListener = this.eventDispatcher;
            var uiLayer = this._layermgr.getLayerWithId(game.LayerViews.UI);
            uiLayer.eventDispatcher = this.eventDispatcher;
            var isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            this._forceView.construct();
            if (isDesktop) {
                this._forceView.x = game.BaseGameUIConstants.kDesktopReelsetFrameX + game.BaseGameUIConstants.kDesktopFrameWidth;
                this._forceView.y = game.BaseGameUIConstants.kDesktopReelsetFrameY - game.BaseGameUIConstants.kDesktopFrameHeight / 2;
            }
            else {
                this._forceView.x = game.BaseGameUIConstants.kMobileReelsetFrameX + game.BaseGameUIConstants.kMobileFrameWidth;
                this._forceView.y = game.BaseGameUIConstants.kMobileReelsetFrameY - game.BaseGameUIConstants.kMobileFrameHeight / 2;
            }
            this._forceView.visible = false;
            uiLayer.addChild(this._forceView);
            this._forceButtonView.construct(isDesktop);
            uiLayer.addChild(this._forceButtonView);
        };
        __decorate([
            inject('LayerManager')
        ], CreateForceCmd.prototype, "_layermgr", void 0);
        __decorate([
            inject('ForceView')
        ], CreateForceCmd.prototype, "_forceView", void 0);
        __decorate([
            inject('ForceButtonView')
        ], CreateForceCmd.prototype, "_forceButtonView", void 0);
        __decorate([
            inject('ReelsView')
        ], CreateForceCmd.prototype, "_reels", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateForceCmd.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], CreateForceCmd.prototype, "_launchParams", void 0);
        __decorate([
            inject('ForceModel')
        ], CreateForceCmd.prototype, "_forceModel", void 0);
        __decorate([
            inject('MetaData')
        ], CreateForceCmd.prototype, "_metaData", void 0);
        return CreateForceCmd;
    }(dragonwings.Command));
    game.CreateForceCmd = CreateForceCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateHelpUICmd = (function (_super) {
        __extends(CreateHelpUICmd, _super);
        function CreateHelpUICmd() {
            _super.apply(this, arguments);
        }
        CreateHelpUICmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateHelpViewCmd::execute()");
            game.HelpBundle.BundleLoaded = true;
            var helpLayer = this._layerMgr.getLayerWithId(game.LayerViews.HELP);
            helpLayer.eventDispatcher = this.eventDispatcher;
            this._helpView.construct();
            helpLayer.addChild(this._helpView);
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HELP_UI_READY, this));
        };
        __decorate([
            inject('LayerManager')
        ], CreateHelpUICmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('HelpView')
        ], CreateHelpUICmd.prototype, "_helpView", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateHelpUICmd.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], CreateHelpUICmd.prototype, "_launchParams", void 0);
        return CreateHelpUICmd;
    }(game.BaseCmd));
    game.CreateHelpUICmd = CreateHelpUICmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateOverlaysUICmd = (function (_super) {
        __extends(CreateOverlaysUICmd, _super);
        function CreateOverlaysUICmd() {
            _super.apply(this, arguments);
        }
        CreateOverlaysUICmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateOverlaysUICmd::execute()");
            var overlaysLayer = this._layerMgr.getLayerWithId(game.LayerViews.OVERLAYS);
            overlaysLayer.eventDispatcher = this.eventDispatcher;
            this._fsTotalWonView.construct();
            overlaysLayer.addChild(this._fsTotalWonView);
            this._fsgWhiteFlashView.construct();
            overlaysLayer.addChild(this._fsgWhiteFlashView);
        };
        __decorate([
            inject('LayerManager')
        ], CreateOverlaysUICmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('FreeSpinsGameTotalWonView')
        ], CreateOverlaysUICmd.prototype, "_fsTotalWonView", void 0);
        __decorate([
            inject('FSGWhiteFlashView')
        ], CreateOverlaysUICmd.prototype, "_fsgWhiteFlashView", void 0);
        return CreateOverlaysUICmd;
    }(game.BaseCmd));
    game.CreateOverlaysUICmd = CreateOverlaysUICmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateUICmd = (function (_super) {
        __extends(CreateUICmd, _super);
        function CreateUICmd() {
            _super.apply(this, arguments);
        }
        CreateUICmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var baseLayer = this._layerMgr.getLayerWithId(game.LayerViews.BASE);
            baseLayer.eventDispatcher = this.eventDispatcher;
            var uiLayer = this._layerMgr.getLayerWithId(game.LayerViews.UI);
            uiLayer.eventDispatcher = this.eventDispatcher;
            var reelsLayer = this._layerMgr.getLayerWithId(game.LayerViews.REELS);
            reelsLayer.eventDispatcher = this.eventDispatcher;
            this._isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            this.addSharedUI(baseLayer, uiLayer, reelsLayer);
            this._isDesktop ? this.addDesktopUI(baseLayer, uiLayer) : this.addMobileUI(baseLayer, uiLayer);
            // Make sure the GameButtonGroupMediator gets instantiated
            this.eventDispatcher.dispatchEvent(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._gameButtonGroup));
        };
        CreateUICmd.prototype.addSharedUI = function (baseLayer, uiLayer, reelsLayer) {
            this._baseGameReelsetFrameView.construct();
            baseLayer.addChild(this._baseGameReelsetFrameView);
            this._freeSpinTriggersView.construct(this._isDesktop);
            reelsLayer.addChild(this._freeSpinTriggersView);
        };
        CreateUICmd.prototype.addDesktopUI = function (baseLayer, uiLayer) {
            this._desktopUIView.construct();
            uiLayer.addChild(this._desktopUIView);
            this._replayView.construct(true);
            this._replayView.visible = false;
            uiLayer.addChild(this._replayView);
            this._skipPayCycleOverlayView.construct();
            uiLayer.addChild(this._skipPayCycleOverlayView);
            this.setVisibility();
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._desktopUIView.getStopAutoplayButton()));
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._desktopUIView.getLinesMeter()));
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._desktopUIView.getStakeMeter()));
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._desktopUIView.getTotalBetMeter()));
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._desktopUIView.getWinMeter()));
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._desktopUIView.getInfoBarMeter()));
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.UI_READY, this));
        };
        CreateUICmd.prototype.addMobileUI = function (baseLayer, uiLayer) {
            this._mobileUIView.construct();
            uiLayer.addChild(this._mobileUIView);
            uiLayer.addChild(this._clockView);
            this._mobileUIPopoutMenuView.construct();
            uiLayer.addChild(this._mobileUIPopoutMenuView);
            this._replayView.construct(true);
            this._replayView.visible = false;
            baseLayer.addChild(this._replayView);
            this._skipPayCycleOverlayView.construct();
            uiLayer.addChild(this._skipPayCycleOverlayView);
            this._mobileSpinButtonView.construct();
            uiLayer.addChild(this._mobileSpinButtonView);
            this._mobileChevronButtonView.construct();
            uiLayer.addChild(this._mobileChevronButtonView);
            this.setVisibility();
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._mobileUIView.getWinMeter()));
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._mobileUIView.getTotalBetMeter()));
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._mobileUIView.getInfoBarMeter()));
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._mobileUIView.getLinesMeter()));
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.UI_READY, this));
        };
        CreateUICmd.prototype.setVisibility = function () {
            this._layerMgr.setVisible([
                new game.LayerVisibility(game.LayerViews.BASE, true),
                new game.LayerVisibility(game.LayerViews.REELS, true),
                new game.LayerVisibility(game.LayerViews.HUD, true),
                new game.LayerVisibility(game.LayerViews.UI, true),
                new game.LayerVisibility(game.LayerViews.OVERLAYS, true)
            ]);
        };
        __decorate([
            inject('DesktopUIView')
        ], CreateUICmd.prototype, "_desktopUIView", void 0);
        __decorate([
            inject('BaseGameReelsetFrameView')
        ], CreateUICmd.prototype, "_baseGameReelsetFrameView", void 0);
        __decorate([
            inject('ReplayView')
        ], CreateUICmd.prototype, "_replayView", void 0);
        __decorate([
            inject('SkipPayCycleOverlayView')
        ], CreateUICmd.prototype, "_skipPayCycleOverlayView", void 0);
        __decorate([
            inject('MobileUIPopoutMenuView')
        ], CreateUICmd.prototype, "_mobileUIPopoutMenuView", void 0);
        __decorate([
            inject('MobileUIView')
        ], CreateUICmd.prototype, "_mobileUIView", void 0);
        __decorate([
            inject('FreeSpinTriggersView')
        ], CreateUICmd.prototype, "_freeSpinTriggersView", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateUICmd.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LayerManager')
        ], CreateUICmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('GameButtonGroup')
        ], CreateUICmd.prototype, "_gameButtonGroup", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], CreateUICmd.prototype, "_launchParams", void 0);
        __decorate([
            inject('ClockView')
        ], CreateUICmd.prototype, "_clockView", void 0);
        __decorate([
            inject('MobileChevronButtonView')
        ], CreateUICmd.prototype, "_mobileChevronButtonView", void 0);
        __decorate([
            inject('MobileSpinButtonView')
        ], CreateUICmd.prototype, "_mobileSpinButtonView", void 0);
        return CreateUICmd;
    }(game.BaseCmd));
    game.CreateUICmd = CreateUICmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateViewLayersCmd = (function (_super) {
        __extends(CreateViewLayersCmd, _super);
        function CreateViewLayersCmd() {
            _super.apply(this, arguments);
        }
        CreateViewLayersCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            this._layerMgr.init(this._stage, this._dragonwingify);
            this._freeSpinsLayer.id = game.LayerViews.FREE_SPINS;
            this._layerMgr.addLayer(this._freeSpinsLayer);
            this._stage.addChild(this._freeSpinsLayer);
            this._basegameLayer.id = game.LayerViews.BASE;
            this._layerMgr.addLayer(this._basegameLayer);
            this._stage.addChild(this._basegameLayer);
            this._reelsLayer.id = game.LayerViews.REELS;
            this._layerMgr.addLayer(this._reelsLayer);
            this._stage.addChild(this._reelsLayer);
            this._reelsOverlayLayer.id = game.LayerViews.REELS_OVERLAY;
            this._layerMgr.addLayer(this._reelsOverlayLayer);
            this._stage.addChild(this._reelsOverlayLayer);
            this._fiverOfAKindLayer.id = game.LayerViews.FIVE_OF_A_KIND;
            this._layerMgr.addLayer(this._fiverOfAKindLayer);
            this._stage.addChild(this._fiverOfAKindLayer);
            this._hudLayer.id = game.LayerViews.HUD;
            this._layerMgr.addLayer(this._hudLayer);
            this._stage.addChild(this._hudLayer);
            this._uiLayer.id = game.LayerViews.UI;
            this._layerMgr.addLayer(this._uiLayer);
            this._stage.addChild(this._uiLayer);
            this._fsuiLayer.id = game.LayerViews.FS_UI;
            this._layerMgr.addLayer(this._fsuiLayer);
            this._stage.addChild(this._fsuiLayer);
            this._footerLayer.id = game.LayerViews.FOOTER;
            this._layerMgr.addLayer(this._footerLayer);
            this._stage.addChild(this._footerLayer);
            this._helpLayer.id = game.LayerViews.HELP;
            this._layerMgr.addLayer(this._helpLayer);
            this._stage.addChild(this._helpLayer);
            this._freeSpinsIntroLayer.id = game.LayerViews.FREE_SPINS_INTRO;
            this._layerMgr.addLayer(this._freeSpinsIntroLayer);
            this._stage.addChild(this._freeSpinsIntroLayer);
            this._overlaysLayer.id = game.LayerViews.OVERLAYS;
            this._layerMgr.addLayer(this._overlaysLayer);
            this._stage.addChild(this._overlaysLayer);
        };
        __decorate([
            inject('LayerManager')
        ], CreateViewLayersCmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_basegameLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_reelsLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_reelsOverlayLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_fiverOfAKindLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_hudLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_uiLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_fsuiLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_freeSpinsLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_freeSpinsIntroLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_helpLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_overlaysLayer", void 0);
        __decorate([
            inject('LayerView')
        ], CreateViewLayersCmd.prototype, "_footerLayer", void 0);
        __decorate([
            inject('Stage')
        ], CreateViewLayersCmd.prototype, "_stage", void 0);
        __decorate([
            inject('DragonWingify')
        ], CreateViewLayersCmd.prototype, "_dragonwingify", void 0);
        return CreateViewLayersCmd;
    }(game.BaseCmd));
    game.CreateViewLayersCmd = CreateViewLayersCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateFooterViewCmd = (function (_super) {
        __extends(CreateFooterViewCmd, _super);
        function CreateFooterViewCmd() {
            _super.apply(this, arguments);
        }
        CreateFooterViewCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateFooterViewCmd::execute()");
            var footerLayer = this._layerMgr.getLayerWithId(game.LayerViews.FOOTER);
            footerLayer.eventDispatcher = this.eventDispatcher;
            var isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            this._balanceMeterView.construct(isDesktop);
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._balanceMeterView));
            this._clockView.construct(isDesktop);
            this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._clockView));
            if (isDesktop) {
                this._footerView.construct();
                this._footerView.addChild(this._balanceMeterView);
                this._footerInfoView.construct();
                this._footerView.addChild(this._footerInfoView);
                this.doImmediateDispatch(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, this._footerInfoView));
                footerLayer.addChild(this._footerView);
                this._desktopUIBottomButtonsView.construct();
                footerLayer.addChild(this._desktopUIBottomButtonsView);
            }
            else {
                this._mobileUIBottomButtonsView.construct();
                footerLayer.addChild(this._mobileUIBottomButtonsView);
                footerLayer.addChild(this._clockView);
            }
        };
        __decorate([
            inject('LayerManager')
        ], CreateFooterViewCmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('FooterView')
        ], CreateFooterViewCmd.prototype, "_footerView", void 0);
        __decorate([
            inject('ClockView')
        ], CreateFooterViewCmd.prototype, "_clockView", void 0);
        __decorate([
            inject('BalanceMeterView')
        ], CreateFooterViewCmd.prototype, "_balanceMeterView", void 0);
        __decorate([
            inject('FooterInfoView')
        ], CreateFooterViewCmd.prototype, "_footerInfoView", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateFooterViewCmd.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], CreateFooterViewCmd.prototype, "_launchParams", void 0);
        __decorate([
            inject('DesktopUIBottomButtonsView')
        ], CreateFooterViewCmd.prototype, "_desktopUIBottomButtonsView", void 0);
        __decorate([
            inject('MobileUIBottomButtonsView')
        ], CreateFooterViewCmd.prototype, "_mobileUIBottomButtonsView", void 0);
        return CreateFooterViewCmd;
    }(game.BaseCmd));
    game.CreateFooterViewCmd = CreateFooterViewCmd;
})(game || (game = {}));
var game;
(function (game) {
    var CreateFreeSpinsIntroView = (function (_super) {
        __extends(CreateFreeSpinsIntroView, _super);
        function CreateFreeSpinsIntroView() {
            _super.apply(this, arguments);
        }
        CreateFreeSpinsIntroView.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateFreeSpinsView::execute()");
            var deviceClass = this._deviceClass.getDeviceClass();
            var isDesktop = (deviceClass == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            var freeSpinsIntroLayer = this._layerMgr.getLayerWithId(game.LayerViews.FREE_SPINS_INTRO);
            freeSpinsIntroLayer.eventDispatcher = this.eventDispatcher;
            this._freeSpinsGameIntroView.construct(isDesktop);
            freeSpinsIntroLayer.addChild(this._freeSpinsGameIntroView);
        };
        __decorate([
            inject('LayerManager')
        ], CreateFreeSpinsIntroView.prototype, "_layerMgr", void 0);
        __decorate([
            inject('FreeSpinsGameIntroView')
        ], CreateFreeSpinsIntroView.prototype, "_freeSpinsGameIntroView", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], CreateFreeSpinsIntroView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], CreateFreeSpinsIntroView.prototype, "_launchParams", void 0);
        return CreateFreeSpinsIntroView;
    }(game.BaseCmd));
    game.CreateFreeSpinsIntroView = CreateFreeSpinsIntroView;
})(game || (game = {}));
var game;
(function (game) {
    var CreateBigWinViewCmd = (function (_super) {
        __extends(CreateBigWinViewCmd, _super);
        function CreateBigWinViewCmd() {
            _super.apply(this, arguments);
        }
        CreateBigWinViewCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("CreateBigWinViewCmd::execute()");
            var uiLayer = this._layerMgr.getLayerWithId(game.LayerViews.UI);
            uiLayer.eventDispatcher = this.eventDispatcher;
            var hudLayer = this._layerMgr.getLayerWithId(game.LayerViews.HUD);
            hudLayer.eventDispatcher = this.eventDispatcher;
            this._bigWinView.construct();
            hudLayer.addChild(this._bigWinView);
            this._bigMegaWinParticlesView.construct(20);
            hudLayer.addChild(this._bigMegaWinParticlesView);
        };
        __decorate([
            inject('LayerManager')
        ], CreateBigWinViewCmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('BigWinView')
        ], CreateBigWinViewCmd.prototype, "_bigWinView", void 0);
        __decorate([
            inject('BigMegaWinParticlesView')
        ], CreateBigWinViewCmd.prototype, "_bigMegaWinParticlesView", void 0);
        return CreateBigWinViewCmd;
    }(game.BaseCmd));
    game.CreateBigWinViewCmd = CreateBigWinViewCmd;
})(game || (game = {}));
var game;
(function (game) {
    var UpdateUIDebugCmd = (function (_super) {
        __extends(UpdateUIDebugCmd, _super);
        function UpdateUIDebugCmd() {
            _super.apply(this, arguments);
        }
        UpdateUIDebugCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            Utils.PSLog.log("UpdateUIDebugCmd::execute()");
            var e = this.event;
            var turnOn = (e.eventName === game.UIDebugButtonEvent.TURNED_ON);
            if (turnOn) {
                this._layerTool.open();
            }
            else {
                this._layerTool.close();
            }
        };
        __decorate([
            inject('LayerManager')
        ], UpdateUIDebugCmd.prototype, "_layerMgr", void 0);
        __decorate([
            inject('LayerTool')
        ], UpdateUIDebugCmd.prototype, "_layerTool", void 0);
        return UpdateUIDebugCmd;
    }(dragonwings.Command));
    game.UpdateUIDebugCmd = UpdateUIDebugCmd;
})(game || (game = {}));
var game;
(function (game) {
    (function (MobileUIPopoutMenuContent) {
        MobileUIPopoutMenuContent[MobileUIPopoutMenuContent["DEFAULT"] = 0] = "DEFAULT";
        MobileUIPopoutMenuContent[MobileUIPopoutMenuContent["HELP"] = 1] = "HELP";
        MobileUIPopoutMenuContent[MobileUIPopoutMenuContent["TOTAL_BET"] = 2] = "TOTAL_BET";
        MobileUIPopoutMenuContent[MobileUIPopoutMenuContent["AUTOPLAY"] = 3] = "AUTOPLAY";
    })(game.MobileUIPopoutMenuContent || (game.MobileUIPopoutMenuContent = {}));
    var MobileUIPopoutMenuContent = game.MobileUIPopoutMenuContent;
    var BaseGameUIConstants = (function () {
        function BaseGameUIConstants() {
        }
        BaseGameUIConstants.kGridYGap = 0;
        BaseGameUIConstants.kFontFamily = "Myriad Pro Semibold Condensed";
        BaseGameUIConstants.kReelFallDepth = 900;
        BaseGameUIConstants.kReelFallDuration = 0.5;
        BaseGameUIConstants.kReelFallDelayStep = 0.1;
        BaseGameUIConstants.kReelFallDelayOffsetFudge = 0.15;
        ///////////////////////////////
        ////////// Mobile UI //////////
        ///////////////////////////////
        // Reels
        BaseGameUIConstants.kMobileReelsetFrameX = 266;
        BaseGameUIConstants.kMobileReelsetFrameY = 142;
        BaseGameUIConstants.kMobileReelsContainerOffsetToReelFrameX = 19;
        BaseGameUIConstants.kMobileReelsContainerOffsetToReelFrameY = 20;
        BaseGameUIConstants.kMobileFirstReelX = 73;
        BaseGameUIConstants.kMobileReelSpacingX = 286;
        BaseGameUIConstants.kMobileSymbolWidth = 231;
        BaseGameUIConstants.kMobileSymbolHeight = 231;
        BaseGameUIConstants.kMobileFrameWidth = 92;
        BaseGameUIConstants.kMobileFrameHeight = 90;
        BaseGameUIConstants.kMobileSymbolBaseY = 20;
        BaseGameUIConstants.kMobileSymbolScaleX = 0.9;
        BaseGameUIConstants.kMobileSymbolScaleY = 0.9;
        BaseGameUIConstants.kMobileBalanceX = 196;
        BaseGameUIConstants.kMobileBalanceY = 970;
        BaseGameUIConstants.kMobileStakePanelWidth = 508;
        BaseGameUIConstants.kMobileStakePanelHeight = 188;
        BaseGameUIConstants.kMobileStakePanelButtonWidth = 160;
        BaseGameUIConstants.kMobileStakePanelButtonHeight = 40;
        BaseGameUIConstants.kMobileStakeMaxButtonX = 267;
        BaseGameUIConstants.kMobileStakeMinButtonX = 80;
        BaseGameUIConstants.kMobileStakeMaxButtonY = 154;
        BaseGameUIConstants.kDesktopCrystalPosX = [450, 680, 900, 1215, 1422];
        BaseGameUIConstants.kDesktopCrystalPosY = [97, 90, 68, 110, 112];
        BaseGameUIConstants.kMobileCrystalPosX = [370, 720, 900, 1174, 1522];
        BaseGameUIConstants.kMobileCrystalPosY = [90, 82, 60, 99, 102];
        // --- Desktop ---
        // Reels
        BaseGameUIConstants.kDesktopReelsetFrameX = 388;
        BaseGameUIConstants.kDesktopReelsetFrameY = 150;
        BaseGameUIConstants.kDesktopFirstReelX = 53;
        BaseGameUIConstants.kDesktopReelSpacingX = 238;
        BaseGameUIConstants.kDesktopSymbolWidth = 195;
        BaseGameUIConstants.kDesktopSymbolHeight = 185;
        BaseGameUIConstants.kDesktopSymbolBaseY = 15;
        BaseGameUIConstants.kDesktopSymbolScaleX = 0.82;
        BaseGameUIConstants.kDesktopSymbolScaleY = 0.82;
        BaseGameUIConstants.kDesktopFrameWidth = 40;
        BaseGameUIConstants.kDesktopFrameHeight = 77;
        BaseGameUIConstants.kReelSymbols = [
            'h2_fairy.png',
            'h2_unicorn.png',
            'h2_butterfly.png',
            'h2_ladybug.png',
            'h2_mushrooms.png',
            'h1_jackpot.png',
            'm3_wand.png',
            'l1_lantern.png',
            'l2_bottle.png',
            'l3_wreath.png',
            'h3_rabbit.png',
            'm1_flower.png',
            'm2_toadstool.png',
            'fet_wild.png',
            'fet_wild.png',
            'fet_wild.png'
        ];
        BaseGameUIConstants.kDefaultReelStops = [1, 1, 1, 1, 1];
        BaseGameUIConstants.kBaseReelLengths = [16, 110, 110, 60, 32];
        BaseGameUIConstants.kDesktopBalanceX = 470;
        BaseGameUIConstants.kDesktopBalanceY = -48;
        // base control panel
        BaseGameUIConstants.kDesktopBaseControlPanelX = 224;
        BaseGameUIConstants.kDesktopBaseControlPanelY = 784;
        BaseGameUIConstants.kDesktopMeterLabelTextColour = "#8FC4FF";
        BaseGameUIConstants.kDesktopInfoX = 484;
        BaseGameUIConstants.kDesktopInfoY = 62;
        BaseGameUIConstants.kDesktopInfoFontSize = 30;
        BaseGameUIConstants.kDesktopInfoBarMeterTextColour = "#8FC4FF";
        BaseGameUIConstants.kMobileInfoX = 1000;
        BaseGameUIConstants.kMobileInfoY = 1050;
        BaseGameUIConstants.kMobileInfoFontSize = 30;
        BaseGameUIConstants.kMobileBottomBarFontSize = 28;
        BaseGameUIConstants.kMobileInfoBarMeterTextColour = "#297D2D";
        // lines meter
        BaseGameUIConstants.kDesktopLinesMeterContainerX = 256;
        BaseGameUIConstants.kDesktopLinesMeterContainerY = 98;
        // stake meter
        BaseGameUIConstants.kDesktopStakeMeterContainerX = 468;
        BaseGameUIConstants.kDesktopStakeMeterContainerY = 118;
        BaseGameUIConstants.kDesktopIncreaseStakeX = 175;
        BaseGameUIConstants.kDesktopIncreaseStakeY = 10;
        BaseGameUIConstants.kDesktopIncreaseStakeIconOffsetX = 16;
        BaseGameUIConstants.kDesktopIncreaseStakeIconY = 20;
        BaseGameUIConstants.kDesktopDecreaseStakeX = 175;
        BaseGameUIConstants.kDesktopDecreaseStakeY = 55;
        BaseGameUIConstants.kDesktopDecreaseStakeIconOffsetX = 18;
        BaseGameUIConstants.kDesktopDecreaseStakeIconY = 68;
        // total bet meter
        BaseGameUIConstants.kDesktopTotalBetMeterContainerX = 683;
        BaseGameUIConstants.kDesktopTotalBetMeterContainerY = 98;
        // win meter
        BaseGameUIConstants.kDesktopWinMeterContainerX = 1034;
        BaseGameUIConstants.kDesktopWinMeterContainerY = 141;
        BaseGameUIConstants.kWinMeterIncrementDelay = 0.05;
        BaseGameUIConstants.kMobileWinMeterContainerX = 360;
        BaseGameUIConstants.kMobileWinMeterContainerY = 1036;
        // Spin button
        BaseGameUIConstants.kDesktopSpinX = 1244;
        BaseGameUIConstants.kDesktopSpinY = 54;
        BaseGameUIConstants.kDesktopSpinButtonScaleX = 0.82;
        BaseGameUIConstants.kMobileSpinX = 1584;
        BaseGameUIConstants.kMobileSpinY = 326;
        BaseGameUIConstants.kMobileSpinButtonScaleX = 1;
        // UI Panel
        BaseGameUIConstants.kMobilecontrolPanelY = 1012;
        BaseGameUIConstants.kMobilecontrolPanelX = 168;
        // Paytable button
        BaseGameUIConstants.kDesktopPaytableButtonX = 72;
        BaseGameUIConstants.kDesktopPaytableButtonY = 103;
        BaseGameUIConstants.kDesktopPaytableButtonScaleX = 0.5;
        BaseGameUIConstants.kDesktopPaytableButtonScaleY = 0.5;
        BaseGameUIConstants.kDesktopPaytableButtonIconX = 30;
        BaseGameUIConstants.kDesktopPaytableButtonIconY = 35;
        BaseGameUIConstants.kDesktopPaytableButtonIconScaleX = 1.6;
        BaseGameUIConstants.kDesktopPaytableButtonIconScaleY = 1.6;
        // Autoplay button
        BaseGameUIConstants.kDesktopAutoplayButtonX = 187;
        BaseGameUIConstants.kDesktopAutoplayButtonY = 103;
        BaseGameUIConstants.kDesktopAutoplayButtonScale = 0.5;
        BaseGameUIConstants.kDesktopAutoplayButtonIconX = 17;
        BaseGameUIConstants.kDesktopAutoplayButtonIconY = 30;
        BaseGameUIConstants.kDesktopAutoplayButtonIconScale = 2.5;
        BaseGameUIConstants.kDesktopStopAutoplayButtonIconScale = 2;
        // Help
        BaseGameUIConstants.kHelpSlideInOutSpeed = 0.15;
        BaseGameUIConstants.kHelpViewBottomTextXPositionOverridesByLocale = {
            "bg": 1030,
            "el": 1030,
            "et": 1030,
            "es": 1030,
            "fr": 1010,
            "lv": 1000,
            "ru": 1010,
            "ro": 1010,
            "de": 980,
            "pt": 980,
            "no": 1000,
            "pl": 960,
            "tr": 980,
            "sk": 980 //Slovak
        };
        // Pay/Winlines
        BaseGameUIConstants.kPaylineAnchorX = 420;
        BaseGameUIConstants.kPaylineAnchorY = 190;
        BaseGameUIConstants.kDesktopPaylineSquareWidth = 234;
        BaseGameUIConstants.kPaylineSquareGapX = 0;
        BaseGameUIConstants.kPaylineLineWidth = 16;
        BaseGameUIConstants.kPaylineShowOutline = true;
        BaseGameUIConstants.kPaylineDarkPercent = 50;
        BaseGameUIConstants.kPaylineOutlineColour = 0xFFFFFF;
        BaseGameUIConstants.kPaylineOutlineThickness = 0;
        BaseGameUIConstants.kDesktopHighlightTracerScaleX = 1;
        BaseGameUIConstants.kDesktopHighlightTracerScaleY = 0.93;
        BaseGameUIConstants.kMobilePaylineAnchorX = 310;
        BaseGameUIConstants.kMobilePaylineAnchorY = 190;
        BaseGameUIConstants.kMobilePaylineSquareWidth = 285;
        BaseGameUIConstants.kMobilePaylineSquareGapX = 0;
        BaseGameUIConstants.kMobileHighlightTracerScaleX = 1.1;
        BaseGameUIConstants.kMobileHighlightTracerScaleY = 0.98;
        // Big win
        BaseGameUIConstants.kBigWinBarX = 965;
        BaseGameUIConstants.kBigWinBarY = 140;
        BaseGameUIConstants.kSuperWinBarX = 1015;
        BaseGameUIConstants.kSuperWinBarY = 180;
        BaseGameUIConstants.kMegaWinBarX = 1005;
        BaseGameUIConstants.kMegaWinBarY = 194;
        BaseGameUIConstants.kBigWinAmountFontSize = 98;
        // Free spin triggers
        BaseGameUIConstants.kFreeSpinTriggerDisabledTextColour = "#5A56FF";
        BaseGameUIConstants.kFreeSpinTriggerEnabledTextColour = "#FEFD37";
        BaseGameUIConstants.kFreeSpinsUIAwardLevels = ["7", "10", "15", "25", "50"];
        // Free spin intro
        BaseGameUIConstants.kFSTransitionScaleX = 3;
        BaseGameUIConstants.kFSTransitionScaleY = 2.86;
        BaseGameUIConstants.kModalFrameScaleX = 1.6;
        BaseGameUIConstants.kModalFrameScaleY = 1.6;
        BaseGameUIConstants.kModalFrameMCFPS = 15;
        // Free spin control panel
        BaseGameUIConstants.kFreeSpinControlPanelX = 224;
        BaseGameUIConstants.kFreeSpinControlPanelY = 784;
        // public static kDesktopFreeSpinControlPanelPlaysRemainingX: number = 247;
        // public static kDesktopFreeSpinControlPanelPlaysRemainingY: number = 850;
        // public static kMobileFreePlaysRemainingX: number = 1350;
        // public static kMobileFreePlaysRemainingY: number = 50;
        BaseGameUIConstants.kFSControlPanelInfoMeterTextX = 939;
        BaseGameUIConstants.kFSControlPanelInfoMeterTextY = 59;
        BaseGameUIConstants.kFreeSpinControlPanelInfoMeterFontSize = 24;
        BaseGameUIConstants.kFSControlPanelTotalBetMeterTextX = 762;
        BaseGameUIConstants.kFSControlPanelTotalBetMeterTextY = 140;
        BaseGameUIConstants.kFreeSpinControlPanelTotalStakeMeterFontSize = 42;
        BaseGameUIConstants.kFSControlPanelWinMeterTextX = 1155;
        BaseGameUIConstants.kFSControlPanelWinMeterTextY = 143;
        BaseGameUIConstants.kFreeSpinControlPanelWinMeterFontSize = 72;
        BaseGameUIConstants.kFreeSpinControlPanelBoxTextColour = "#FF8CC6";
        BaseGameUIConstants.kFreeSpinControlPanelBoxLabelColour = "#FEBAFD";
        // Free spins intro modal
        BaseGameUIConstants.kFSGIntroTransitionMCFPS = 10;
        BaseGameUIConstants.kNumberOfFreeSpinsAwardedFontSize = 156;
        BaseGameUIConstants.kNumberOfFreeSpinsAwardedTextColour = "#FEFD37";
        BaseGameUIConstants.kNumberOfFreeSpinsAwardedTextOutlineSize = 15;
        BaseGameUIConstants.kNumberOfFreeSpinsAwardedTextOutlineColour = "#020766";
        BaseGameUIConstants.kFreeSpinsAwardedTextFontSize = 84;
        BaseGameUIConstants.kFreeSpinsAwardedTextColour = "#FEFD37";
        BaseGameUIConstants.kFreeSpinsAwardedTextOutlineSize = 15;
        BaseGameUIConstants.kFreeSpinsAwardedTextOutlineColour = "#020766";
        BaseGameUIConstants.kFreeSpinsAwardedTextY = 194;
        BaseGameUIConstants.kFSGIntroStartButtonLabelFontSize = 48;
        BaseGameUIConstants.kFSGIntroStartButtonLabelOutlineSize = 10;
        BaseGameUIConstants.kFSGIntroStartButtonLabelOutlineColour = "#000000";
        BaseGameUIConstants.kFSGIntroStartButtonLabelOffsetX = 8;
        BaseGameUIConstants.kFSGIntroStartButtonLabelOffsetY = 8;
        BaseGameUIConstants.kFSGIntroStartButtonY = 747;
        BaseGameUIConstants.kFSGIntroStartButtonScaleX = 0.8;
        BaseGameUIConstants.kFSGIntroStartButtonScaleY = 0.8;
        BaseGameUIConstants.kFSGStartButtonMCAnimationSpeed = 20;
        BaseGameUIConstants.kFSGStartButtonMCAnimationLoopDelay = 600;
        // Total won modal
        BaseGameUIConstants.kTotalWonPopupWinAmountTextY = 420;
        BaseGameUIConstants.kTotalWonPopupExtraAmountTextY = 500;
        BaseGameUIConstants.kTotalWonPopupWinAmountTextColour = "#FFC500";
        BaseGameUIConstants.kTotalWonPopupWinAmountFontSize = 200;
        BaseGameUIConstants.kTotalWonPopupTotalWonLabelText = "TOTAL WON";
        BaseGameUIConstants.kTotalWonPopupTotalWonLabelTextY = 260;
        BaseGameUIConstants.kTotalWonPopupExtraWonLabelTextY = 300;
        BaseGameUIConstants.kTotalWonPopupTotalWonLabelColour = "#FFFFFF";
        BaseGameUIConstants.kTotalWonPopupTotalWonFontSize = 80;
        BaseGameUIConstants.kTotalWonShowDelay = 2;
        BaseGameUIConstants.kTotalWonShowDuration = 3;
        // Free spin game
        BaseGameUIConstants.kExtraFreeSpinsPopupShowDuration = 3;
        BaseGameUIConstants.kFreeSpinGameControlPanelBoxOutline = 0x8FC4FF;
        BaseGameUIConstants.kFreeSpinGameControlPanelTextColour = "#8FC4FF";
        // White Flash Overlay
        BaseGameUIConstants.kWhiteFlashOverlayDuration = 1.25;
        // Mobile UI Mini Menu
        BaseGameUIConstants.kMobileExpandChevronX = 1300;
        BaseGameUIConstants.kMobileExpandChevronY = 810;
        BaseGameUIConstants.kMobileMiniMenuAnimationSpeed = 0.4;
        BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf = BaseGameUIConstants.kMobileMiniMenuAnimationSpeed / 2;
        BaseGameUIConstants.kMobileChevronFadeOutSpeed = 0.1;
        //Scatter Settings
        BaseGameUIConstants.scatterReelPause = [.5, 1.5]; // seconds to pause before next reel [normal pause, scatter pause]
        // Force
        BaseGameUIConstants.kForceButtonX = 0;
        BaseGameUIConstants.kForceButtonY = 100;
        BaseGameUIConstants.kForceButtonTextColour = "#eeeeee";
        BaseGameUIConstants.kForceToolPlusButtonBackgroundColour = 0xDD0000;
        BaseGameUIConstants.kDesktopForceToolPlusButtonY = 25;
        BaseGameUIConstants.kForceToolSelectorButtonOutlineColour = 0x000000;
        BaseGameUIConstants.kForceToolSelectorButtonFontSize = 40;
        BaseGameUIConstants.kForceToolSelectorButtonTextColour = "#EEEEEE";
        BaseGameUIConstants.kDesktopForceToolSelectorButtonStartingOffetX = 70;
        BaseGameUIConstants.kDesktopForceToolSelectorButtonSpacingX = 235;
        BaseGameUIConstants.kForceToolMinusButtonBackgroundColour = 0x0000DD;
        BaseGameUIConstants.kDesktopForceToolMinusButtonY = 615;
        BaseGameUIConstants.kMobileForceToolSelectorButtonStartingOffetX = 60;
        BaseGameUIConstants.kMobileForceToolSelectorButtonSpacingX = 285;
        BaseGameUIConstants.kMobileForceToolPlusButtonY = 30;
        BaseGameUIConstants.kMobileForceToolMinusButtonY = 750;
        // Footer
        BaseGameUIConstants.kDesktopFooterY = 1027;
        BaseGameUIConstants.kDesktopClockX = 106;
        BaseGameUIConstants.kDesktopClockY = 13;
        BaseGameUIConstants.kMobileClockX = 30;
        BaseGameUIConstants.kMobileClockY = 940;
        BaseGameUIConstants.kClockTextColour = "#FFFFFF";
        BaseGameUIConstants.kClockTextFontSize = 30;
        BaseGameUIConstants.kDesktopFooterInfoX = 1173;
        BaseGameUIConstants.kDesktopFooterInfoY = 18;
        BaseGameUIConstants.kDesktopFooterInfoFontSize = 20;
        BaseGameUIConstants.kDesktopFooterInfoTextColour = "#BA33D5";
        BaseGameUIConstants.kDesktopFooterGameNameX = 1648;
        BaseGameUIConstants.kDesktopFooterGameNameY = 17;
        BaseGameUIConstants.kDesktopFooterGameNameText = "CRYSTAL FOREST HD";
        BaseGameUIConstants.kDesktopFooterGameNameFontSize = 20;
        BaseGameUIConstants.kDesktopFooterGameNameTextColour = "#BA33D5";
        // Max win
        BaseGameUIConstants.kMaxWinPopupText1FontSize = 110;
        BaseGameUIConstants.kMaxWinPopupText2FontSize = 175;
        BaseGameUIConstants.kMaxWinPopupText3FontSize = 60;
        // Colours
        BaseGameUIConstants.kGameYellow1 = "#FBC92E";
        BaseGameUIConstants.kMobileMenuSlideSpeed = 0.5;
        BaseGameUIConstants.kMobileChevronRotationSpeed = 0.2;
        BaseGameUIConstants.kMobileChevronX = 1800;
        BaseGameUIConstants.kMobileChevronY = 812;
        return BaseGameUIConstants;
    }());
    game.BaseGameUIConstants = BaseGameUIConstants;
})(game || (game = {}));
var game;
(function (game) {
    var GameConstants = (function () {
        function GameConstants() {
        }
        GameConstants.BIG_WIN_MULTIPLIER = 25;
        GameConstants.SUPER_WIN_MULTIPLIER = 75;
        GameConstants.MEGA_WIN_MULTIPLIER = 150;
        return GameConstants;
    }());
    game.GameConstants = GameConstants;
})(game || (game = {}));
var game;
(function (game) {
    var BaseGameContext = (function (_super) {
        __extends(BaseGameContext, _super);
        function BaseGameContext(eventDispatcher, stage, singletonMap) {
            _super.call(this, new dragonwings.MetaInjector());
            this.contextView = stage;
            var eventStackHub = new game.EventStackHub(this.eventDispatcher);
            for (var model in singletonMap) {
                this.injector.mapSingletonTo(model, singletonMap[model]);
            }
            this.mapCommands();
            this.mapViewsAndMediators();
            this.createEventStackListeners(eventStackHub);
            this.mapModels();
            // Create a singleton gameButtonGroup and prepare the instantiation of the mediator
            var gbGroup = new game.GameButtonGroup();
            gbGroup.eventDispatcher = eventDispatcher;
            this.injector.mapSingletonTo('GameButtonGroup', gbGroup);
            this.injector.injectInto(gbGroup, false);
            this.mediatorMap.mapMediator(game.GameButtonGroupMediator, game.GameButtonGroup);
        }
        BaseGameContext.prototype.createEventStackListeners = function (eventStackHub) {
        };
        BaseGameContext.prototype.mapCommands = function () {
            this.mapCommand(game.CreateBaseViewCmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateDebugOverlayCmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateReelsetCmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateUICmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateCyclersCmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateForceCmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateBigWinViewCmd, game.GameEvent.GAME_INIT_COMPLETE);
            // this.mapCommand(CreateFreeSpinsIntroView, GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateOverlaysUICmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateFiveOfAKindCmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.CreateFooterViewCmd, game.GameEvent.GAME_INIT_COMPLETE);
            // Run only when FS assets have loaded
            this.mapCommand(game.CreateFSUICmd, game.GameEvent.FS_BUILD_UI);
            this.mapCommand(game.CreateFreeSpinsIntroView, game.GameEvent.FS_BUILD_UI);
            this.mapCommand(game.ReShowProgressBarCmd, game.GameEvent.RESHOW_PROGRESS_BAR);
            this.mapCommand(game.ReHideProgressBarCmd, game.GameEvent.REHIDE_PROGRESS_BAR);
            // Run only when Help assets have loaded
            this.mapCommand(game.CreateHelpUICmd, game.GameEvent.HELP_BUILD_UI);
            // Make a play request when the spin button is pressed
            this.mapCommand(game.MakePlayRequestCmd, game.GameEvent.SPIN_BUTTON_PRESSED);
            // Make a play request when the a Replay spin is loaded
            this.mapCommand(game.MakePlayRequestCmd, game.GameEvent.PLAY_REPLAY_SPIN);
            this.mapCommand(game.MakePlayRequestCmd, game.AutoPlayModelEvent.NEXT);
            // Fire SpinReelsCmd when entering spinReels state
            this.mapCommand(game.SpinReelsCmd, game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "spinReels"));
            this.mapCommand(game.CheckForWinsCmd, game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "checkingForWins"));
            this.mapCommand(game.ShowWinsCmd, game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "showingWins"));
            this.mapCommand(game.PaycycleChecker, components.CyclerEvent.ON_COMPLETE);
            this.mapCommand(game.CheckIfCanCascadeCmd, components.CyclerEvent.ON_COMPLETE);
            // Free spins command
            this.mapCommand(game.CheckingIfFreeSpinsGameHasBeenAwardedCmd, game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "checkingIfFreeSpinsGameHasBeenAwarded"));
            this.mapCommand(game.CheckingIfFreeSpinsGameHasBeenAwardedCmd, game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "checkingIfFreeSpinsGameHasBeenAwarded"));
            this.mapCommand(game.ShowFreeSpinsIntroCmd, game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME));
            this.mapCommand(game.ShowFreeSpinsGameLayerCmd, game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED);
            this.mapCommand(game.ShowFreeSpinsGameLayerCmd, game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME);
            this.mapCommand(game.RequestFreeSpinCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "requestFreeSpin"));
            this.mapCommand(game.MakePlayRequestCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "freeSpinValid"));
            this.mapCommand(game.CheckForWinsCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "checkingForWins"));
            this.mapCommand(game.ShowWinsCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingWins"));
            this.mapCommand(game.CheckForExtraFreeSpinsCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "checkingForExtraFreeSpins"));
            this.mapCommand(game.ExitFreeSpinsGameCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, game.Subgame.FREE_SPINS_EXIT_STATE));
            // Max win
            this.mapCommand(game.CheckMaxWinCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "checkingForMaxWin"));
            this.mapCommand(game.ShowMaxWinCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingMaxWin"));
            // End request command
            this.mapCommand(game.MakeEndRequestCmd, game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "spinComplete"));
            // OLG external balance update
            this.mapCommand(game.GameReadyCmd, game.GameStateEvent.ExitSubgame(game.Subgame.PRE_GAME));
            this.mapCommand(sgi.ExternalUpdateBalanceCmd, sgi.ExternalBalanceEvent.UPDATE_BALANCE);
            this.mapCommand(sgi.ExternalSetBalanceCmd, sgi.ExternalBalanceEvent.SET_BALANCE);
            this.mapCommand(sgi.ExternalBalanceDisplayCmd, sgi.ExternalBalanceEvent.DISPLAY_BALANCE);
        };
        BaseGameContext.prototype.mapViewsAndMediators = function () {
            this.mapView('LayerView', game.LayerView, game.LayerMediator);
            this.mapView('BaseGameView', game.BaseGameView, game.BaseGameViewMediator);
            this.mapView('DesktopUIView', game.DesktopUIView, game.DesktopUIMediator);
            this.mapView('MobileUIView', game.MobileUIView, game.MobileUIMediator);
            this.mapView('MobileUIPopoutMenuView', game.MobileUIPopoutMenuView, game.MobileUIPopoutMenuMediator);
            this.mapView('MobileUIBottomButtonsView', game.MobileUIBottomButtonsView, game.MobileUIBottomButtonsViewMediator);
            this.mapView('DesktopUIBottomButtonsView', game.DesktopUIBottomButtonsView, game.DesktopUIBottomButtonsViewMediator);
            this.mapView('DebugOverlayView', game.DebugOverlayView, game.DebugOverlayMediator);
            this.mapView('ReelsView', game.ReelsView, game.ReelsetMediator);
            this.mapView('FiveOfAKindView', game.FiveOfAKindView, game.FiveOfAKindViewMediator);
            this.mapView('ForceView', game.ForceView, game.ForceViewMediator);
            this.mapView('BalanceMeterView', game.BalanceMeterView, game.BalanceMeterMediator);
            this.mapView('LinesMeterView', game.LinesMeterView, game.LinesMeterMediator);
            this.mapView('StakeMeterView', game.StakeMeterView, game.StakeMeterMediator);
            this.mapView('TotalBetMeterView', game.TotalBetMeterView, game.TotalBetMeterMediator);
            this.mapView('WinMeterView', game.WinMeterView, game.WinMeterMediator);
            this.mapView('InfoBarMeterView', game.InfoBarMeterView, game.InfoBarMeterMediator);
            this.mapView('DemoView', game.DemoView, game.DemoViewMediator);
            this.mapView('BigWinView', game.BigWinView, game.BigWinViewMediator);
            this.mapView('BigMegaWinParticlesView', game.BigMegaWinParticlesView, game.BigWinParticlesViewMediator);
            this.mapView('FreeSpinsGameIntroView', game.FreeSpinsGameIntroView, game.FreeSpinsGameIntroViewMediator);
            this.mapView('HelpView', game.HelpView, game.HelpViewMediator);
            this.mapView('FreeSpinsGameBackgroundView', game.FreeSpinsGameBackgroundView);
            this.mapView('BaseGameReelsetFrameView', game.BaseGameReelsetFrameView);
            this.mapView('FreeSpinsGameReelsetFrameView', game.FreeSpinsGameReelsetFrameView);
            this.mapView('FreeSpinsGameControlPanelView', game.FreeSpinsGameControlPanelView, game.FreeSpinsGameControlPanelViewMediator);
            this.mapView('FSGWhiteFlashView', game.FSGWhiteFlashView, game.FSGWhiteFlashViewMediator);
            this.mapView('FSGWinMeterTextView', game.FSGWinMeterTextView, game.FSGWinMeterTextViewMediator);
            this.mapView('FreeSpinsRemainingView', game.FreeSpinsRemainingView, game.FreeSpinsRemainingViewMediator);
            this.mapView('FreeSpinsGameTotalWonView', game.FreeSpinsGameTotalWonView, game.FreeSpinsGameTotalWonMediator);
            this.mapView('ForceButtonView', game.ForceButtonView, game.ForceButtonViewMediator);
            this.mapView('ReplayView', game.ReplayView, game.ReplayViewMediator);
            this.mapView('FreeSpinTriggersView', game.FreeSpinTriggersView, game.FreeSpinTriggersViewMediator);
            this.mapView('FooterView', game.FooterView);
            this.mapView('FooterInfoView', game.FooterInfoView, game.FooterInfoViewMediator);
            this.mapView('SkipPayCycleOverlayView', game.SkipPayCycleOverlayView, game.SkipPayCycleOverlayViewMediator);
            this.mapView('ClockView', game.ClockView, game.ClockMediator);
            this.mapView('MaxWinView', game.MaxWinView, game.MaxWinViewMediator);
            this.mapView('StopAutoplayButtonView', game.StopAutoplayButtonView, game.StopAutoplayButtonViewMediator);
            this.mapView('MobileChevronButtonView', game.MobileChevronButtonView, game.MobileChevronButtonViewMediator);
            this.mapView('MobileSpinButtonView', game.MobileSpinButtonView, game.MobileSpinButtonViewMediator);
        };
        BaseGameContext.prototype.mapModels = function () {
            this.mapModel('ForceModel', game.ForceModel);
            this.mapModel('SpinModel', game.SpinModel);
            this.mapModel('CyclersModel', game.CyclersModel);
            this.mapModel('AutoPlayModel', game.AutoPlayModel);
            this.mapModel('WinInfoModel', game.WinInfoModel);
            this.mapModel('FreeSpinsGameModel', game.FreeSpinsGameModel);
        };
        /**
         * Shortcut for mapping a command
         */
        BaseGameContext.prototype.mapCommand = function (commandClass, eventType) {
            this.commandMap.mapCommand(commandClass, eventType);
        };
        /**
         * Shortcut for mapping a view + mediator
         */
        BaseGameContext.prototype.mapView = function (classType, toClass, mediatorClass) {
            if (mediatorClass === void 0) { mediatorClass = null; }
            this.viewMap.mapView(classType, toClass, null, true);
            if (mediatorClass) {
                this.mediatorMap.mapMediator(mediatorClass, toClass);
            }
        };
        return BaseGameContext;
    }(dragonwings.Context));
    game.BaseGameContext = BaseGameContext;
})(game || (game = {}));
var game;
(function (game) {
    var GameContext = (function (_super) {
        __extends(GameContext, _super);
        /**
         * Constructor
         */
        function GameContext(partnerAdapter, metaData, partnerEventModel, balanceService, balanceListener) {
            _super.call(this, new dragonwings.MetaInjector());
            // Root view
            this.contextView = this.createStage();
            if (balanceListener) {
                balanceListener.eventDispatcher = this.eventDispatcher;
            }
            // singletons
            var layerMgr = new game.LayerManager();
            var assetMgr = new game.AssetManager();
            assetMgr.eventDispatcher = this.eventDispatcher;
            var gameStateModel = new game.GameStateModel();
            var layerTool = new game.LayerTool();
            var eventHub = new game.AsyncEventHub();
            eventHub.dispatcher = this.eventDispatcher;
            var autoplayModel = new game.AutoPlayModel();
            autoplayModel.eventDispatcher = this.eventDispatcher;
            var stakeModel = new game.StakeModel();
            stakeModel.eventListener = this.eventDispatcher;
            var winInfoModel = new game.WinInfoModel();
            winInfoModel.eventListener = this.eventDispatcher;
            var audioEngine = new game.AudioEngine();
            audioEngine.stateModel = gameStateModel;
            audioEngine.stakeModel = stakeModel;
            this._metaData = new util.MetaData(metaData);
            var singletonMap = {
                'PartnerAdapter': partnerAdapter ? partnerAdapter : new util.PartnerAdapter(),
                'PartnerAdapterEventModel': partnerEventModel,
                'MetaData': this._metaData,
                'LayerManager': layerMgr,
                'AssetManager': assetMgr,
                'GameStateModel': gameStateModel,
                'LayerTool': layerTool,
                'StakeModel': stakeModel,
                'WinInfoModel': winInfoModel,
                'AudioEngine': audioEngine,
                'AsyncEventHub': eventHub,
                'AutoPlayModel': autoplayModel,
                'BalanceService': balanceService
            };
            for (var model in singletonMap) {
                this.injector.mapSingletonTo(model, singletonMap[model]);
            }
            // Child Contexts
            var baseGameContext = new game.BaseGameContext(this.eventDispatcher, this.contextView, singletonMap);
            this.addChildContext(baseGameContext);
            this.mapCommands();
            this.mapModels();
            this.mapViewsAndMediators();
            this.createEventGates(eventHub);
            // Setup the input manager to allow one InputEvent per frame
            rendering.InputManager.inputType = rendering.InputManager.ONE_PER_FRAME;
            // But only for the objects we register
            rendering.InputManager.filterRegisteredOnly = true;
            // Start the context which injects everything required to start and then dispatches ContextEvent.STARTUP_COMPLETE
            this.startup();
        }
        GameContext.prototype.createEventGates = function (hub) {
            // Create the FS UI only when the assets are loaded AND the UI Layers have been created
            var fsInputs = [game.GameEvent.FS_ASSETS_LOADED, game.GameEvent.BASE_VIEW_READY];
            hub.addEventGate(fsInputs, new game.GameEvent(game.GameEvent.FS_BUILD_UI, this));
            // Create the Help UI only when the assets are loaded AND the UI Layers have been created
            var helpInputs = [game.GameEvent.HELP_ASSETS_LOADED, game.GameEvent.BASE_VIEW_READY];
            hub.addEventGate(helpInputs, new game.GameEvent(game.GameEvent.HELP_BUILD_UI, this));
        };
        GameContext.prototype.mapCommands = function () {
            this.mapCommand(game.LoadAssetsCmd, dragonwings.ContextEvent.STARTUP_COMPLETE);
            this.mapCommand(game.CreateGameStatesCmd, dragonwings.ContextEvent.STARTUP_COMPLETE);
            this.mapCommand(game.SetFeatureDetectorCmd, dragonwings.ContextEvent.STARTUP_COMPLETE);
            this.mapCommand(game.InitHistoryCmd, dragonwings.ContextEvent.STARTUP_COMPLETE);
            this.mapCommand(game.UpdateProgressBarCmd, assets.AssetLoaderEvent.PROGRESS);
            this.mapCommand(game.MakeInitRequestCmd, game.GameEvent.MAIN_ASSETS_LOADED);
            // InitPreGameCmd needs both main assets loaded AND init response received
            // It then dispatches GAME_INIT_COMPLETE when bot conditions are met
            this.mapCommand(game.InitAutoplayCmd, server.ServerResponseEvent.INIT_RESPONSE);
            this.mapCommand(game.PreloadAudioCmd, game.GameEvent.MAIN_ASSETS_LOADED);
            this.mapCommand(game.MakePlayRequestCmd, game.GameEvent.RECOVERY_SEND_LOGIC);
            this.mapCommand(game.InitPreGameCmd, game.GameEvent.MAIN_ASSETS_LOADED);
            this.mapCommand(game.InitPreGameCmd, server.ServerResponseEvent.INIT_RESPONSE);
            this.mapCommand(game.InitStakesModelCmd, server.ServerResponseEvent.INIT_RESPONSE);
            this.mapCommand(game.InitAutoplayCmd, server.ServerResponseEvent.INIT_RESPONSE);
            this.mapCommand(game.CreateViewLayersCmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.InitLocalisationCmd, game.GameEvent.GAME_INIT_COMPLETE);
            this.mapCommand(game.HideProgressBarCmd, game.GameEvent.NORMAL_GAME_INIT);
            // Autoplay
            this.mapCommand(game.LaunchAutoplayCmd, game.GameEvent.AUTOPLAY_BUTTON_PRESSED);
            this.mapCommand(game.StartAutoplayCmd, game.ExternalEvent.START_AUTOPLAY);
            // Run DoNextAutoplayCmd when the game goes back to the idle state (a check is done in that command to see if autoplay is in progress)
            this.mapCommand(game.DoNextAutoplayCmd, game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"));
            this.mapCommand(game.StopAutoplayCmd, game.ExternalEvent.STOP_AUTOPLAY);
            this.mapCommand(game.StopAutoplayCmd, game.ExternalEvent.PAUSE_GAME);
            this.mapCommand(game.StopAutoplayCmd, game.AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED);
            this.mapCommand(game.StopAutoplayCmd, game.GameEvent.FREE_SPINS_GAME_AWARDED);
            this.mapCommand(game.HardResetCmd, game.ExternalEvent.RESET_HARD);
            this.mapCommand(game.HandleGlsErrorCmd, server.ServerResponseEvent.ERROR_RESPONSE);
            this.mapCommand(game.CheckHistoryCmd, server.ServerResponseEvent.LOGIC_RESPONSE);
            this.mapCommand(game.UpdatePartnerCmd, server.ServerResponseEvent.INIT_RESPONSE);
            this.mapCommand(game.UpdatePartnerCmd, server.ServerResponseEvent.LOGIC_RESPONSE);
            this.mapCommand(game.UpdatePartnerCmd, server.ServerResponseEvent.END_RESPONSE);
            this.mapCommand(game.UpdatePartnerCmd, game.StakeModelEvent.STAKE_MODEL_CHANGED);
            // Open bet commands
            this.mapCommand(game.InitOpenBetCmd, server.ServerResponseEvent.INIT_RESPONSE);
            this.mapCommand(game.UpdateUIDebugCmd, game.UIDebugButtonEvent.TURNED_ON);
            this.mapCommand(game.UpdateUIDebugCmd, game.UIDebugButtonEvent.TURNED_OFF);
            this.mapCommand(game.ExitPreGameCmd, game.GameStateEvent.ExitSubgame(game.Subgame.PRE_GAME));
            // Recovery
            this.mapCommand(game.InitRecoveryCmd, game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "awaitingInputs"));
            this.mapCommand(game.ContinueRecoveryCmd, game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"));
        };
        GameContext.prototype.mapModels = function () {
            //this.mapModel('AssetLoader', assets.AssetLoader);
            this.mapModel('AssetCache', assets.AssetCache);
            this.mapModel('GameServer', game.GameServer);
            this.mapModel('DragonWingify', game.DragonWingify);
            this.mapModel('CurrencyFormatter', util.CurrencyFormatter);
            this.mapModel('SpinModel', game.SpinModel);
            this.mapModel('ITranslator', util.Translator);
            this.mapModel('IDeviceClassDetector', util.ResolutionDeviceClassDetector);
            this.mapModel('IFeatureCapabilities', util.StandardFeatureCapabilities);
            this.mapModel('AudioEngine', game.AudioEngine);
            this.mapModel('AutoplayModel', game.AutoPlayModel);
            this.mapModel('HistoryModel', util.history.HistoryModel);
        };
        GameContext.prototype.mapViewsAndMediators = function () {
            this.mapView('StatsView', game.StatsView, game.StatsMediator);
            this.mapView('LayerView', game.LayerView, game.LayerMediator);
        };
        /**
         * Pulls some data from our url for configs
         */
        GameContext.prototype.createParams = function (url) {
            var params = new game.LaunchParametersModel();
            params.setData((url.queryData("packed") && url.queryData("packed") == "true"), (url.queryData("webgl") && url.queryData("webgl") == "false") ? false : true, (url.queryData("dombg") && url.queryData("dombg") == "true"), (url.queryData("fps") ? parseFloat(url.queryData("fps")) : 60), (url.queryData("stats") && url.queryData("stats") == "true"), (url.queryData("local") && url.queryData("local") == "true"), (url.queryData("CDN") && url.queryData("CDN") == "true"), (url.queryData("presentation") && url.queryData("presentation") == "mobile") ? true : false, (url.queryData("sldelay") ? parseFloat(url.queryData("sldelay")) : 0.001), (url.queryData("dbgovl") && url.queryData("dbgovl") == "false") ? false : true);
            return params;
        };
        /**
         * Creates our root view + it's dependencies
         */
        GameContext.prototype.createStage = function () {
            var url = new util.URL(window.location.href);
            var device = new game.DeviceContextModel(url);
            var params = this.createParams(url);
            rendering.ScaleManager.setPositionScale(device.getScalar());
            var responsiveDiv = new components.ResponsiveDiv(document.getElementById("game-container"));
            if (params.webgl) {
                var stage = new game.GameStage(responsiveDiv.getCanvasDiv(), device.getScaledScreenWidth(), device.getScaledScreenHeight(), this.eventDispatcher, [rendering.StageRenderStyle.WEBGL, rendering.StageRenderStyle.CANVAS]);
            }
            else {
                var stage = new game.GameStage(responsiveDiv.getCanvasDiv(), device.getScaledScreenWidth(), device.getScaledScreenHeight(), this.eventDispatcher, [rendering.StageRenderStyle.CANVAS]);
            }
            stage.fps = params.fps;
            stage.autoRender = true;
            responsiveDiv.setCanvas(stage.canvas);
            responsiveDiv.enableResponsiveScaling();
            responsiveDiv.setStage(stage);
            //util.PauseManager.setStage(stage);
            /**
             * Map these dependencies as singletons so other parts of the game can use them
             */
            this.injector.mapSingletonTo('ResponsiveDiv', responsiveDiv);
            this.injector.mapSingletonTo('Stage', stage);
            this.injector.mapSingletonTo('DeviceContext', device);
            this.injector.mapSingletonTo('LaunchParametersModel', params);
            return stage;
        };
        /**
         * Shortcut for mapping a command
         */
        GameContext.prototype.mapCommand = function (commandClass, eventType) {
            this.commandMap.mapCommand(commandClass, eventType);
        };
        /**
         * Shortcut for mapping a view + mediator
         */
        GameContext.prototype.mapView = function (classType, toClass, mediatorClass) {
            if (mediatorClass === void 0) { mediatorClass = null; }
            this.viewMap.mapView(classType, toClass);
            if (mediatorClass) {
                this.mediatorMap.mapMediator(mediatorClass, toClass);
            }
        };
        return GameContext;
    }(dragonwings.Context));
    game.GameContext = GameContext;
})(game || (game = {}));
var game;
(function (game) {
    var GameStage = (function (_super) {
        __extends(GameStage, _super);
        function GameStage(element, width, height, eventDispatcher, renderStyles) {
            _super.call(this, element, width, height, renderStyles);
            this._eventDispatcher = eventDispatcher;
        }
        GameStage.prototype.addChild = function (child) {
            _super.prototype.addChild.call(this, child);
            this._eventDispatcher.dispatchEvent(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, child));
            return child;
        };
        GameStage.prototype.removeChild = function (child) {
            _super.prototype.removeChild.call(this, child);
            this._eventDispatcher.dispatchEvent(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.REMOVED_FROM_STAGE, child));
            return child;
        };
        GameStage.prototype.postInject = function () {
        };
        GameStage.prototype.dispatchEvent = function (e) {
            _super.prototype.dispatchEvent.call(this, e);
            this._eventDispatcher.dispatchEvent(e);
        };
        GameStage.prototype.getWidth = function () {
            return this.stageWidth;
        };
        GameStage.prototype.getHeigth = function () {
            return this.stageHeight;
        };
        GameStage.prototype.render = function () {
            _super.prototype.render.call(this);
        };
        return GameStage;
    }(rendering.Stage));
    game.GameStage = GameStage;
})(game || (game = {}));
var game;
(function (game) {
    var AssetManager = (function () {
        function AssetManager() {
            this._loaders = [];
            this._loaderEvents = [];
            this._loaderComplete = [];
            this._currentLoaderIndex = -1;
            this._stageLoadDelay = 0;
        }
        AssetManager.prototype.addLoader = function (loader, event) {
            this._loaders.push(loader);
            this._loaderEvents.push(event);
            this._loaderComplete.push(false);
        };
        Object.defineProperty(AssetManager.prototype, "stageLoadDelay", {
            set: function (delay) {
                this._stageLoadDelay = delay;
            },
            enumerable: true,
            configurable: true
        });
        AssetManager.prototype.start = function () {
            var matchingLengths = (this._loaderEvents.length == this._loaders.length);
            var atLeastOneLoader = (this._loaders.length > 0);
            var alreadyRunning = (this._currentLoaderIndex > -1);
            if (atLeastOneLoader && matchingLengths && !alreadyRunning) {
                this._currentLoaderIndex = 0;
                this.startNextLoader();
            }
            else {
                throw ("AssetManager::start() - no loaders present or mismatch between loaders and events or start() already called");
            }
        };
        Object.defineProperty(AssetManager.prototype, "eventDispatcher", {
            get: function () { return this._eventDispatcher; },
            set: function (value) { this._eventDispatcher = value; },
            enumerable: true,
            configurable: true
        });
        AssetManager.prototype.isLoaderComplete = function (index) { return this._loaderComplete[index]; };
        AssetManager.prototype.startNextLoader = function () {
            var _this = this;
            var loaderIndex = this._currentLoaderIndex;
            var nextLoader = this._loaders[loaderIndex];
            var nextCompletionEvent = this._loaderEvents[loaderIndex];
            Utils.PSLog.log("AssetManager::startNextLoader() - STARTING: " + nextCompletionEvent.eventName);
            nextLoader.addEventListener(assets.AssetLoaderEvent.COMPLETE, function () {
                _this._loaderComplete[_this._currentLoaderIndex] = true;
                Utils.PSLog.log("AssetManager::startNextLoader() - FINISHED: " + _this._loaderEvents[_this._currentLoaderIndex].eventName);
                _this._eventDispatcher.dispatchEvent(nextCompletionEvent);
                _this._currentLoaderIndex++;
                if (_this._currentLoaderIndex < _this._loaders.length) {
                    TweenMax.delayedCall(_this._stageLoadDelay, _this.startNextLoader, [], _this);
                }
            }, this);
            // Start the loading process
            nextLoader.load();
        };
        return AssetManager;
    }());
    game.AssetManager = AssetManager;
})(game || (game = {}));
var game;
(function (game) {
    var AssetStage = (function () {
        function AssetStage() {
        }
        AssetStage.PRIMARY = 0;
        AssetStage.FS = 1;
        AssetStage.HELP = 2;
        return AssetStage;
    }());
    game.AssetStage = AssetStage;
})(game || (game = {}));
var game;
(function (game) {
    var AudioBundle = (function (_super) {
        __extends(AudioBundle, _super);
        function AudioBundle(basePath) {
            _super.call(this);
            AudioBundle.RG_SpinButton = Utils.MiscUtils.createAssetRef(basePath + "/base/spin_button.m4a", "RG_SpinButton", this);
            AudioBundle.CF_Intro = Utils.MiscUtils.createAssetRef(basePath + "/base/intro.m4a", "CF_Intro", this);
            AudioBundle.CF_StakeChangeA = Utils.MiscUtils.createAssetRef(basePath + "/base/stake_changeA.m4a", "CF_StakeChangeA", this);
            AudioBundle.CF_StakeChangeB = Utils.MiscUtils.createAssetRef(basePath + "/base/stake_changeB.m4a", "CF_StakeChangeB", this);
            AudioBundle.CF_StakeChangeC = Utils.MiscUtils.createAssetRef(basePath + "/base/stake_changeC.m4a", "CF_StakeChangeC", this);
            AudioBundle.CF_StakeChangeD = Utils.MiscUtils.createAssetRef(basePath + "/base/stake_changeD.m4a", "CF_StakeChangeD", this);
            AudioBundle.CF_StakeChangeE = Utils.MiscUtils.createAssetRef(basePath + "/base/stake_changeE.m4a", "CF_StakeChangeE", this);
            AudioBundle.CF_ReelDrop1 = Utils.MiscUtils.createAssetRef(basePath + "/base/reeldrop1.m4a", "CF_ReelDrop1", this);
            AudioBundle.CF_ReelDrop2 = Utils.MiscUtils.createAssetRef(basePath + "/base/reeldrop2.m4a", "CF_ReelDrop2", this);
            AudioBundle.CF_ReelDrop3 = Utils.MiscUtils.createAssetRef(basePath + "/base/reeldrop3.m4a", "CF_ReelDrop3", this);
            AudioBundle.CF_ReelDrop4 = Utils.MiscUtils.createAssetRef(basePath + "/base/reeldrop4.m4a", "CF_ReelDrop4", this);
            AudioBundle.CF_ReelDrop5 = Utils.MiscUtils.createAssetRef(basePath + "/base/reeldrop5.m4a", "CF_ReelDrop5", this);
            AudioBundle.CF_Explode = Utils.MiscUtils.createAssetRef(basePath + "/base/explosion.m4a", "CF_Explode", this);
            AudioBundle.CF_Has_Wins = Utils.MiscUtils.createAssetRef(basePath + "/base/has_wins.m4a", "CF_Has_Wins", this);
            AudioBundle.CF_Show_Wins_Complete = Utils.MiscUtils.createAssetRef(basePath + "/base/wins_complete.m4a", "CF_Show_Wins_Complete", this);
            AudioBundle.CF_Big_Win = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/bigwinsegment.m4a", "CF_Big_Win", this);
            AudioBundle.CF_Super_Win = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/super_big_win_with_rampup.m4a", "CF_Super_Win", this);
            AudioBundle.CF_Mega_Win = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/mega_big_win_with_rampup.m4a", "CF_Mega_Win", this);
            AudioBundle.CF_Big_Win_Voice1 = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/en_us_outstandingrev.m4a", "CF_Big_Win_Voice1", this);
            AudioBundle.CF_Big_Win_Voice2 = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/en_us_fantasticrev.m4a", "CF_Big_Win_Voice2", this);
            AudioBundle.CF_Big_Win_Voice3 = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/en_us_magnificent.m4a", "CF_Big_Win_Voice3", this);
            AudioBundle.CF_Super_Win_Voice1 = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/en_us_unbelievablerev.m4a", "CF_Super_Win_Voice1", this);
            AudioBundle.CF_Super_Win_Voice2 = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/en_us_incrediblerev.m4a", "CF_Super_Win_Voice2", this);
            AudioBundle.CF_Mega_Win_Voice1 = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/en_us_impossiblerev.m4a", "CF_Mega_Win_Voice1", this);
            AudioBundle.CF_Mega_Win_Voice2 = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/en_us_inconceivablerev.m4a", "CF_Mega_Win_Voice2", this);
            AudioBundle.CF_Big_Win_End = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/revisedbigwinwfx_end.m4a", "CF_Big_Win_End", this);
            AudioBundle.CF_Super_Win_End = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/revisedsuperwinwfx_end.m4a", "CF_Super_Win_End", this);
            AudioBundle.CF_Mega_Win_End = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/revisedmegawinwfx_end.m4a", "CF_Mega_Win_End", this);
            AudioBundle.CF_FSG_Anticipation = Utils.MiscUtils.createAssetRef(basePath + "/base/fsg_anticipation.m4a", "CF_FSG_Anticipation", this);
            AudioBundle.CF_FSG_Siren = Utils.MiscUtils.createAssetRef(basePath + "/base/fsg_siren.m4a", "CF_FSG_Siren", this);
            AudioBundle.CF_FSG_Intro = Utils.MiscUtils.createAssetRef(basePath + "/fsg/intro.m4a", "CF_FSG_Intro", this);
            AudioBundle.CF_FSG_Start = Utils.MiscUtils.createAssetRef(basePath + "/fsg/start.m4a", "CF_FSG_Start", this);
            AudioBundle.CF_FSG_Theme = Utils.MiscUtils.createAssetRef(basePath + "/fsg/theme.m4a", "CF_FSG_Theme", this);
            AudioBundle.CF_Help_Opened = Utils.MiscUtils.createAssetRef(basePath + "/help/help_opened.m4a", "CF_Help_Opened", this);
            AudioBundle.CF_Help_Closed = Utils.MiscUtils.createAssetRef(basePath + "/help/help_closed.m4a", "CF_Help_Closed", this);
            AudioBundle.CF_Help_Next = Utils.MiscUtils.createAssetRef(basePath + "/help/help_next.m4a", "CF_Help_Next", this);
            AudioBundle.CF_Help_Previous = Utils.MiscUtils.createAssetRef(basePath + "/help/help_previous.m4a", "CF_Help_Previous", this);
        }
        return AudioBundle;
    }(util.AssetBundle));
    game.AudioBundle = AudioBundle;
})(game || (game = {}));
var game;
(function (game) {
    var BaseGameBundle = (function (_super) {
        __extends(BaseGameBundle, _super);
        function BaseGameBundle(basePath, rootPath) {
            _super.call(this);
            BaseGameBundle.CF_Logo = Utils.MiscUtils.createAssetRef(basePath + "/basegame/background/packed.png", "CF_Logo", this);
            BaseGameBundle.CF_BaseBackground = Utils.MiscUtils.createAssetRef(basePath + "/basegame/background/basegame_background/packed.png", "CF_BaseBackground", this);
            BaseGameBundle.RG_IntroBackground = Utils.MiscUtils.createAssetRef(rootPath + "/art/all/loadscreen/loadscreen/loading.png", "RG_IntroBackground", this);
            // Buttons
            BaseGameBundle.RG_Buttons = Utils.MiscUtils.createAssetRef(basePath + "/desktopcontrols/button/packed.png", "RG_Buttons", this);
            BaseGameBundle.RG_ButtonsJson = Utils.MiscUtils.createAssetRef(basePath + "/desktopcontrols/button/packed.json", "RG_ButtonsJson", this);
            BaseGameBundle.CF_Buttons = Utils.MiscUtils.createAssetRef(basePath + "/buttons/packed.png", "CF_Buttons", this);
            BaseGameBundle.CF_ButtonsJson = Utils.MiscUtils.createAssetRef(basePath + "/buttons/packed.json", "CF_ButtonsJson", this);
            BaseGameBundle.CF_BigWin = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/packed.png", "CF_BigWin", this);
            BaseGameBundle.CF_BigWinJson = Utils.MiscUtils.createAssetRef(basePath + "/bigwin/packed.json", "CF_BigWinJson", this);
            // control panel
            BaseGameBundle.CF_ControlPanelJson = Utils.MiscUtils.createAssetRef(basePath + "/desktopcontrols/controlpanel/packed.json", "CF_ControlPanelJson", this);
            BaseGameBundle.CF_ControlPanel = Utils.MiscUtils.createAssetRef(basePath + "/desktopcontrols/controlpanel/packed.png", "CF_ControlPanel", this);
            // Base UI
            BaseGameBundle.CF_BaseUIJson = Utils.MiscUtils.createAssetRef(basePath + "/basegame/ui/packed.json", "CF_BaseUIJson", this);
            BaseGameBundle.CF_BaseUI = Utils.MiscUtils.createAssetRef(basePath + "/basegame/ui/packed.png", "CF_BaseUI", this);
            // reels
            BaseGameBundle.RG_ReelFrameJson = Utils.MiscUtils.createAssetRef(basePath + "/basegame/assets/packed.json", "RG_ReelFrameJson", this);
            BaseGameBundle.RG_ReelFrame = Utils.MiscUtils.createAssetRef(basePath + "/basegame/assets/packed.png", "RG_ReelFrame", this);
            BaseGameBundle.CF_ReelCrystal0Json = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_1/packed.json", "CF_ReelCrystal0Json", this);
            BaseGameBundle.CF_ReelCrystal0 = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_1/packed.png", "CF_ReelCrystal0", this);
            BaseGameBundle.CF_ReelCrystal1Json = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_2/packed.json", "CF_ReelCrystal1Json", this);
            BaseGameBundle.CF_ReelCrystal1 = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_2/packed.png", "CF_ReelCrystal1", this);
            BaseGameBundle.CF_ReelCrystal2Json = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_3/packed.json", "CF_ReelCrystal2Json", this);
            BaseGameBundle.CF_ReelCrystal2 = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_3/packed.png", "CF_ReelCrystal2", this);
            BaseGameBundle.CF_ReelCrystal3Json = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_4/packed.json", "CF_ReelCrystal3Json", this);
            BaseGameBundle.CF_ReelCrystal3 = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_4/packed.png", "CF_ReelCrystal3", this);
            BaseGameBundle.CF_ReelCrystal4Json = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_5/packed.json", "CF_ReelCrystal4Json", this);
            BaseGameBundle.CF_ReelCrystal4 = Utils.MiscUtils.createAssetRef(basePath + "/animations/basegame/crystals/crystal_glow_reel_5/packed.png", "CF_ReelCrystal4", this);
            // Animated symbols
            BaseGameBundle.CF_JackpotSymbolAnimationJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/jackpot_anim/packed.json", "CF_JackpotSymbolAnimationJson", this);
            BaseGameBundle.CF_JackpotSymbolAnimation = Utils.MiscUtils.createAssetRef(basePath + "/animations/jackpot_anim/packed.png", "CF_JackpotSymbolAnimation", this);
            BaseGameBundle.CF_WildAnimationJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/wild_anim/packed.json", "CF_WildAnimationJson", this);
            BaseGameBundle.CF_WildAnimation = Utils.MiscUtils.createAssetRef(basePath + "/animations/wild_anim/packed.png", "CF_WildAnimation", this);
            BaseGameBundle.CF_TracerJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/tracerfx/packed.json", "CF_TracerJson", this);
            BaseGameBundle.CF_Tracer = Utils.MiscUtils.createAssetRef(basePath + "/animations/tracerfx/packed.png", "CF_Tracer", this);
            // --- Explosions
            BaseGameBundle.CF_ExplosionJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/hit/explosion/packed.json", "CF_ExplosionJson", this);
            BaseGameBundle.CF_Explosion = Utils.MiscUtils.createAssetRef(basePath + "/animations/hit/explosion/packed.png", "CF_Explosion", this);
            BaseGameBundle.CF_Symbols = Utils.MiscUtils.createAssetRef(basePath + "/symbols/packed.png", "CF_Symbols", this);
            BaseGameBundle.CF_SymbolsJson = Utils.MiscUtils.createAssetRef(basePath + "/symbols/packed.json", "CF_SymbolsJson", this);
            // Free spins
            BaseGameBundle.CF_ModalFrame = Utils.MiscUtils.createAssetRef(basePath + "/animations/tally/packed.png", "CF_ModalFrame", this);
            BaseGameBundle.CF_ModalFrameJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/tally/packed.json", "CF_ModalFrameJson", this);
            BaseGameBundle.CF_FreeSpinTriggerCrystal = Utils.MiscUtils.createAssetRef(basePath + "/freespins/crystals/packed.png", "CF_FreeSpinTriggerCrystal", this);
            BaseGameBundle.CF_FreeSpinTriggerCrystalJson = Utils.MiscUtils.createAssetRef(basePath + "/freespins/crystals/packed.json", "CF_FreeSpinTriggerCrystalJson", this);
            BaseGameBundle.CF_FreeSpinTriggerText = Utils.MiscUtils.createAssetRef(basePath + "/freespins/text/packed.png", "CF_FreeSpinTriggerText", this);
            BaseGameBundle.CF_FreeSpinTriggerTextJson = Utils.MiscUtils.createAssetRef(basePath + "/freespins/text/packed.json", "CF_FreeSpinTriggerTextJson", this);
            // Big/Super/Mega win coins/diamons
            BaseGameBundle.CF_Coins = Utils.MiscUtils.createAssetRef(basePath + "/animations/coins_alt/packed.png", "CF_Coins", this);
            BaseGameBundle.CF_CoinsJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/coins_alt/packed.json", "CF_CoinsJson", this);
            BaseGameBundle.CF_Diamonds = Utils.MiscUtils.createAssetRef(basePath + "/animations/diamonds/packed.png", "CF_Diamonds", this);
            BaseGameBundle.CF_DiamondsJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/diamonds/packed.json", "CF_DiamondsJson", this);
            BaseGameBundle.CF_RedGems = Utils.MiscUtils.createAssetRef(basePath + "/animations/red_gems/packed.png", "CF_RedGems", this);
            BaseGameBundle.CF_RedGemsJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/red_gems/packed.json", "CF_RedGemsJson", this);
            BaseGameBundle.CF_GreenGems = Utils.MiscUtils.createAssetRef(basePath + "/animations/green_gems/packed.png", "CF_GreenGems", this);
            BaseGameBundle.CF_GreenGemsJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/green_gems/packed.json", "CF_GreenGemsJson", this);
            BaseGameBundle.CF_PurpleGems = Utils.MiscUtils.createAssetRef(basePath + "/animations/blue_gems/packed.png", "CF_PurpleGems", this);
            BaseGameBundle.CF_PurpleGemsJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/blue_gems/packed.json", "CF_PurpleGemsJson", this);
            // For directly accessing package.json to get the version number
            BaseGameBundle.PackageJson = this.create(rootPath + "/package.json", "PackageJson");
        }
        return BaseGameBundle;
    }(util.AssetBundle));
    game.BaseGameBundle = BaseGameBundle;
})(game || (game = {}));
var game;
(function (game) {
    var FSBundle = (function (_super) {
        __extends(FSBundle, _super);
        function FSBundle(basePath) {
            _super.call(this);
            FSBundle.CF_FSTransition = Utils.MiscUtils.createAssetRef(basePath + "/animations/transition/packed.png", "CF_FSTransition", this);
            FSBundle.CF_FSTransitionJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/transition/packed.json", "CF_FSTransitionJson", this);
            FSBundle.CF_FSG_Start_Button = Utils.MiscUtils.createAssetRef(basePath + "/animations/transition_button_glow/packed.png", "CF_FSG_Start_Button", this);
            FSBundle.CF_FSG_Start_ButtonJson = Utils.MiscUtils.createAssetRef(basePath + "/animations/transition_button_glow/packed.json", "CF_FSG_Start_ButtonJson", this);
            FSBundle.CF_FreeSpinsBackground = Utils.MiscUtils.createAssetRef(basePath + "/basegame/background/bonusgame_background/packed.png", "CF_FreeSpinsBackground", this);
            FSBundle.CF_FreeSpinsBackgroundJson = Utils.MiscUtils.createAssetRef(basePath + "/basegame/background/bonusgame_background/packed.json", "CF_FreeSpinsBackgroundJson", this);
            FSBundle.CF_PlaysRemaining = Utils.MiscUtils.createAssetRef(basePath + "/freespins/fg_counter/packed.png", "CF_PlaysRemaining", this);
            FSBundle.CF_PlaysRemainingJson = Utils.MiscUtils.createAssetRef(basePath + "/freespins/fg_counter/packed.json", "CF_PlaysRemainingJson", this);
            FSBundle.CF_MaxWinPopup = Utils.MiscUtils.createAssetRef(basePath + "/freespins/wincap/packed.png", "CF_MaxWinPopup", this);
            FSBundle.CF_MaxWinPopupJson = Utils.MiscUtils.createAssetRef(basePath + "/freespins/wincap/packed.json", "CF_MaxWinPopupJson", this);
        }
        return FSBundle;
    }(util.AssetBundle));
    game.FSBundle = FSBundle;
})(game || (game = {}));
var game;
(function (game) {
    var ForceEncoder = (function () {
        function ForceEncoder(stops, bandsetIndex) {
            this._stops = stops;
            this._bandsetIndex = bandsetIndex;
        }
        ForceEncoder.prototype.parse = function () {
            var xmlStr = "<FORCE><ReelSpin";
            xmlStr += " reelsetIndex=\"" + this._bandsetIndex.toString() + "\"";
            xmlStr += " stopIndices=\"" + this._stops.join('|') + "\"";
            xmlStr += "/></FORCE>";
            return xmlStr;
        };
        return ForceEncoder;
    }());
    game.ForceEncoder = ForceEncoder;
})(game || (game = {}));
var game;
(function (game) {
    var HelpBundle = (function (_super) {
        __extends(HelpBundle, _super);
        function HelpBundle(basePath) {
            _super.call(this);
            HelpBundle.Help_Page1 = Utils.MiscUtils.createAssetRef(basePath + "/help/page01/packed.png", "Help_Page1", this);
            HelpBundle.Help_Page1Json = Utils.MiscUtils.createAssetRef(basePath + "/help/page01/packed.json", "Help_Page1Json", this);
            HelpBundle.Help_Page2 = Utils.MiscUtils.createAssetRef(basePath + "/help/page02/packed.png", "Help_Page2", this);
            HelpBundle.Help_Page2Json = Utils.MiscUtils.createAssetRef(basePath + "/help/page02/packed.json", "Help_Page2Json", this);
            HelpBundle.Help_Page3 = Utils.MiscUtils.createAssetRef(basePath + "/help/page03/packed.png", "Help_Page3", this);
            HelpBundle.Help_Page3Json = Utils.MiscUtils.createAssetRef(basePath + "/help/page03/packed.json", "Help_Page3Json", this);
            HelpBundle.Help_Page4 = Utils.MiscUtils.createAssetRef(basePath + "/help/page04/packed.png", "Help_Page4", this);
            HelpBundle.Help_Page4Json = Utils.MiscUtils.createAssetRef(basePath + "/help/page04/packed.json", "Help_Page4Json", this);
            HelpBundle.Help_Page5 = Utils.MiscUtils.createAssetRef(basePath + "/help/page05/packed.png", "Help_Page5", this);
            HelpBundle.Help_Page5Json = Utils.MiscUtils.createAssetRef(basePath + "/help/page05/packed.json", "Help_Page5Json", this);
            HelpBundle.Help_Buttons = Utils.MiscUtils.createAssetRef(basePath + "/help/ui/packed.png", "Help_Buttons", this);
            HelpBundle.Help_ButtonsJson = Utils.MiscUtils.createAssetRef(basePath + "/help/ui/packed.json", "Help_ButtonsJson", this);
        }
        return HelpBundle;
    }(util.AssetBundle));
    game.HelpBundle = HelpBundle;
})(game || (game = {}));
var game;
(function (game) {
    var PageEncoder = (function () {
        function PageEncoder(page) {
            this._page = page;
        }
        PageEncoder.prototype.parse = function () {
            var xmlStr = "<Page";
            xmlStr += " number=\"" + this._page.toString() + "\"";
            xmlStr += "/>";
            return xmlStr;
        };
        return PageEncoder;
    }());
    game.PageEncoder = PageEncoder;
})(game || (game = {}));
var game;
(function (game) {
    var PayloadData = (function () {
        function PayloadData() {
            this.CASH = 0;
            this.FREEBET = 0;
            this.BONUS = 0;
        }
        PayloadData.TYPE_INIT = "init";
        PayloadData.TYPE_WAGER = "wager";
        PayloadData.TYPE_OUTCOME = "outcome";
        PayloadData.TYPE_EXTERNALEVENT = "externalevent";
        return PayloadData;
    }());
    game.PayloadData = PayloadData;
})(game || (game = {}));
var game;
(function (game) {
    var PayloadParser = (function () {
        function PayloadParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        PayloadParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("Payload")[0];
            if (node != null) {
                object.payloadData = [];
                for (var i = 0; i < node.childNodes.length; i++) {
                    var payloadItem = node.childNodes[i];
                    var requestType = payloadItem.attributes.getNamedItem("request").value;
                    var payloadNode = payloadItem.childNodes[0];
                    if (payloadNode != null) {
                        for (var j = 0; j < payloadNode.childNodes.length; j++) {
                            var data = this.parseMapItem(payloadNode.childNodes[j], requestType);
                            if (data) {
                                object.payloadData[requestType] = data;
                            }
                        }
                    }
                }
            }
        };
        PayloadParser.prototype.parseMapItem = function (mapItem, requestType) {
            var data = null;
            for (var i = 0; i < mapItem.childNodes.length; i++) {
                if (mapItem.childNodes[i].nodeName == "key") {
                }
                else if (mapItem.childNodes[i].nodeName == "value") {
                    data = new game.PayloadData();
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
                    // found a payload value
                    break;
                }
            }
            return data;
        };
        return PayloadParser;
    }());
    game.PayloadParser = PayloadParser;
})(game || (game = {}));
var game;
(function (game) {
    var RRDemoData = (function (_super) {
        __extends(RRDemoData, _super);
        function RRDemoData() {
            _super.apply(this, arguments);
        }
        return RRDemoData;
    }(components.DemoData));
    game.RRDemoData = RRDemoData;
})(game || (game = {}));
var game;
(function (game) {
    var ReplayEncoder = (function () {
        function ReplayEncoder(historyReplayStateData) {
            this._historyReplayStateData = historyReplayStateData;
        }
        ReplayEncoder.prototype.parse = function () {
            var xmlStr = "<REPLAY><Playback";
            xmlStr += " state=\"" + this._historyReplayStateData + "\"";
            xmlStr += "/></REPLAY>";
            return xmlStr;
        };
        return ReplayEncoder;
    }());
    game.ReplayEncoder = ReplayEncoder;
})(game || (game = {}));
var game;
(function (game) {
    var StakeEncoder = (function () {
        function StakeEncoder(stakeTotal) {
            this._stakeTotal = stakeTotal;
        }
        StakeEncoder.prototype.parse = function () {
            return "<Stake total=\"" + this._stakeTotal.toString() + "\" fsOn=\"1\" />";
        };
        return StakeEncoder;
    }());
    game.StakeEncoder = StakeEncoder;
})(game || (game = {}));
var game;
(function (game) {
    var Subgame = (function () {
        function Subgame() {
        }
        Subgame.PRE_GAME = "PreGame";
        Subgame.BASE_GAME = "BaseGame";
        Subgame.FREE_SPINS_GAME = "FreeSpinsGame";
        Subgame.RTR_GAME = "RTRGame";
        Subgame.PRE_GAME_EXIT_STATE = "enterBaseGame";
        Subgame.RTR_EXIT_STATE = "enterBaseGame";
        Subgame.FREE_SPINS_EXIT_STATE = "exitFreeSpinsGame";
        return Subgame;
    }());
    game.Subgame = Subgame;
})(game || (game = {}));
var game;
(function (game) {
    var TranslateBundle = (function (_super) {
        __extends(TranslateBundle, _super);
        function TranslateBundle(basePath, locale) {
            _super.call(this);
            TranslateBundle.TranslationsJson = Utils.MiscUtils.createAssetRef(basePath + "/" + locale.toLowerCase() + ".json", "TranslationsJson", this);
        }
        return TranslateBundle;
    }(util.AssetBundle));
    game.TranslateBundle = TranslateBundle;
})(game || (game = {}));
var game;
(function (game) {
    var ExternalEvent = (function (_super) {
        __extends(ExternalEvent, _super);
        function ExternalEvent(type) {
            _super.call(this, type);
        }
        ExternalEvent.RESET_HARD = "ExternalEvent_RESET_HARD";
        ExternalEvent.START_AUTOPLAY = "ExternalEvent_START_AUTOPLAY";
        ExternalEvent.STOP_AUTOPLAY = "ExternalEvent_STOP_AUTOPLAY";
        ExternalEvent.PAUSE_GAME = "ExternalEvent_PAUSE_GAME";
        ExternalEvent.RESUME_GAME = "ExternalEvent_RESUME_GAME";
        return ExternalEvent;
    }(borgevent.Event));
    game.ExternalEvent = ExternalEvent;
})(game || (game = {}));
var game;
(function (game) {
    var GameEvent = (function (_super) {
        __extends(GameEvent, _super);
        function GameEvent(eventName, sender, id) {
            _super.call(this, eventName);
            this._sender = sender;
            this._id = id;
        }
        Object.defineProperty(GameEvent.prototype, "sender", {
            get: function () {
                return this._sender;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameEvent.prototype, "id", {
            get: function () {
                return this._id;
            },
            enumerable: true,
            configurable: true
        });
        GameEvent.PREFIX = "GameEvent_";
        //
        GameEvent.HARD_RESET = GameEvent.PREFIX + "HARD_RESET";
        GameEvent.RESET_REELS = GameEvent.PREFIX + "RESET_REELS";
        GameEvent.GAME_INIT_COMPLETE = GameEvent.PREFIX + "GAME_INIT_COMPLETE"; // dispatched once Init response received AND MAIN_ASSETS_LOADED
        GameEvent.FONT_ASSETS_LOADED = GameEvent.PREFIX + "FONT_ASSETS_LOADED";
        GameEvent.MAIN_ASSETS_LOADED = GameEvent.PREFIX + "MAIN_ASSETS_LOADED"; // Essential assets
        GameEvent.FS_ASSETS_LOADED = GameEvent.PREFIX + "FS_ASSETS_LOADED"; // FS Assets
        GameEvent.HELP_ASSETS_LOADED = GameEvent.PREFIX + "HELP_ASSETS_LOADED";
        GameEvent.RECOVERY_INPUTS_READY = GameEvent.PREFIX + "RECOVERY_INPUTS_READY";
        // To avoid ambiguity in stage loading
        GameEvent.BASE_VIEW_READY = GameEvent.PREFIX + "BASE_VIEW_READY";
        GameEvent.FS_BUILD_UI = GameEvent.PREFIX + "FS_BUILD_UI";
        GameEvent.HELP_BUILD_UI = GameEvent.PREFIX + "HELP_BUILD_UI";
        GameEvent.HELP_VIEW_READY = GameEvent.PREFIX + "HELP_VIEW_READY";
        GameEvent.UI_READY = GameEvent.PREFIX + "UI_READY";
        GameEvent.REHIDE_PROGRESS_BAR = GameEvent.PREFIX + "REHIDE_PROGRESS_BAR";
        GameEvent.RESHOW_PROGRESS_BAR = GameEvent.PREFIX + "RESHOW_PROGRESS_BAR";
        // Intro
        GameEvent.INTRO_PANEL_CREATED = GameEvent.PREFIX + "INTRO_PANEL_CREATED";
        GameEvent.EXIT_INTRO = GameEvent.PREFIX + "EXIT_INTRO";
        // View show / hide
        GameEvent.SHOW_BASE_VIEW = GameEvent.PREFIX + "SHOW_BASE_VIEW";
        // In theory shouldn't need this but for whatever reason, PauseManager always unmutes
        // when resuming the game - even if partner adapter has muted it. So... quick fix....
        // Dispatch this when resuming game and AudioEngine will refresh appropriately
        GameEvent.REFRESH_MUTE = GameEvent.PREFIX + "REFRESH_MUTE";
        GameEvent.LAYER_CLICKED = GameEvent.PREFIX + "LAYER_CLICKED";
        GameEvent.AUDIO_TRIGGER_TOTALWIN = GameEvent.PREFIX + "AUDIO_TRIGGER_TOTALWIN";
        GameEvent.NORMAL_GAME_INIT = GameEvent.PREFIX + "NORMAL_GAME_INIT";
        GameEvent.RECOVERY_GAME_INIT = GameEvent.PREFIX + "RECOVERY_GAME_INIT";
        GameEvent.RECOVERY_SEND_LOGIC = GameEvent.PREFIX + "RECOVERY_SEND_LOGIC";
        GameEvent.RECOVERY_READY = GameEvent.PREFIX + "RECOVERY_READY";
        GameEvent.RECOVERY_SPIN = GameEvent.PREFIX + "RECOVERY_SPIN";
        GameEvent.SPIN_BUTTON_PRESSED = GameEvent.PREFIX + "SPIN_BUTTON_PRESSED";
        GameEvent.HELP_BUTTON_PRESSED = GameEvent.PREFIX + "HELP_BUTTON_PRESSED";
        GameEvent.STAKE_DOWN_BUTTON_PRESSED = GameEvent.PREFIX + "STAKE_DOWN_BUTTON_PRESSED";
        GameEvent.STAKE_UP_BUTTON_PRESSED = GameEvent.PREFIX + "STAKE_UP_BUTTON_PRESSED";
        GameEvent.LINES_DOWN_BUTTON_PRESSED = GameEvent.PREFIX + "LINES_DOWN_BUTTON_PRESSED";
        GameEvent.LINES_UP_BUTTON_PRESSED = GameEvent.PREFIX + "LINES_UP_BUTTON_PRESSED";
        //////////////////////////////
        // REPLAY ////////////////////
        //////////////////////////////
        GameEvent.HISTORY_REPLAY_DETECTED = GameEvent.PREFIX + "HISTORY_REPLAY_DETECTED";
        GameEvent.HISTORY_REPLAY_READY = GameEvent.PREFIX + "HISTORY_REPLAY_READY";
        GameEvent.HISTORY_REPLAY_SPIN = GameEvent.PREFIX + "HISTORY_REPLAY_SPIN";
        GameEvent.PLAY_REPLAY_SPIN = GameEvent.PREFIX + "PLAY_REPLAY_SPIN";
        //////////////////////////////
        // REELS /////////////////////
        //////////////////////////////
        GameEvent.ALL_SYMBOLS_FALLEN = GameEvent.PREFIX + "ALL_SYMBOLS_FALLEN";
        GameEvent.PLAY_WIN_BANG_UP = GameEvent.PREFIX + "PLAY_WIN_BANG_UP";
        //////////////////////////////
        // BIG/SUPER/MEGA ////////////
        //////////////////////////////
        GameEvent.CHECK_BIG_MEGA_WIN = GameEvent.PREFIX + "CHECK_BIG_MEGA_WIN";
        GameEvent.SHOW_BIG_WIN = GameEvent.PREFIX + "SHOW_BIG_WIN";
        GameEvent.PLAY_BIG_WIN_SOUND = GameEvent.PREFIX + "PLAY_BIG_WIN_SOUND";
        GameEvent.SHOW_SUPER_WIN = GameEvent.PREFIX + "SHOW_SUPER_WIN";
        GameEvent.PLAY_SUPER_WIN_SOUND = GameEvent.PREFIX + "PLAY_SUPER_WIN_SOUND";
        GameEvent.SHOW_MEGA_WIN = GameEvent.PREFIX + "SHOW_MEGA_WIN";
        GameEvent.PLAY_MEGA_WIN_SOUND = GameEvent.PREFIX + "PLAY_MEGA_WIN_SOUND";
        GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY = GameEvent.PREFIX + "CANCEL_BIGMEGA_WIN_DISPLAY";
        GameEvent.REMOVE_BIG_WIN_PARTICLES = GameEvent.PREFIX + "REMOVE_BIG_WIN_PARTICLES";
        GameEvent.ON_MEGAWIN_COMPLETE = GameEvent.PREFIX + "ON_MEGAWIN_COMPLETE";
        GameEvent.ON_BIGWIN_COMPLETE = GameEvent.PREFIX + "ON_BIGWIN_COMPLETE";
        GameEvent.STOP_BIG_WIN_SOUNDS = GameEvent.PREFIX + "STOP_BIG_WIN_SOUNDS";
        GameEvent.STOP_BIG_WIN_SOUND = GameEvent.PREFIX + "STOP_BIG_WIN_SOUND";
        GameEvent.STOP_SUPER_WIN_SOUND = GameEvent.PREFIX + "STOP_SUPER_WIN_SOUND";
        GameEvent.STOP_MEGA_WIN_SOUND = GameEvent.PREFIX + "STOP_MEGA_WIN_SOUND";
        GameEvent.PLAY_BIG_WIN_VOICE = GameEvent.PREFIX + "PLAY_BIG_WIN_VOICE";
        GameEvent.PLAY_SUPER_WIN_VOICE = GameEvent.PREFIX + "PLAY_SUPER_WIN_VOICE";
        GameEvent.PLAY_MEGA_WIN_VOICE = GameEvent.PREFIX + "PLAY_MEGA_WIN_VOICE";
        GameEvent.BIG_WIN_SKIPPED = GameEvent.PREFIX + "BIG_WIN_SKIPPED";
        //////////////////////////////
        // MAX WIN ///////////////////
        //////////////////////////////
        GameEvent.HAS_MAX_WIN = GameEvent.PREFIX + "HAS_MAX_WIN";
        GameEvent.HAS_NO_MAX_WIN = GameEvent.PREFIX + "HAS_NO_MAX_WIN";
        GameEvent.SHOW_MAX_WIN_COMPLETE = GameEvent.PREFIX + "SHOW_MAX_WIN_COMPLETE";
        GameEvent.SHOW_MAX_WIN = GameEvent.PREFIX + "SHOW_MAX_WIN";
        //////////////////////////////
        // AUTOPLAY //////////////////
        //////////////////////////////
        GameEvent.AUTOPLAY_BUTTON_PRESSED = GameEvent.PREFIX + "AUTOPLAY_BUTTON_PRESSED";
        GameEvent.AUTOPLAY_MENU_CANCELLED = GameEvent.PREFIX + "AUTOPLAY_MENU_CANCELLED";
        // anim events
        GameEvent.ANIMATE_REMOVE_SYMBOLS = GameEvent.PREFIX + "ANIMATE_REMOVE_SYMBOLS";
        // Used to show total win popup window
        GameEvent.TOTAL_WIN_SHOW = GameEvent.PREFIX + "TOTAL_WIN_SHOW";
        //
        GameEvent.SHOW_SPAGHETTI = GameEvent.PREFIX + "SHOW_SPAGHETTI";
        GameEvent.HIDE_SPAGHETTI = GameEvent.PREFIX + "HIDE_SPAGHETTI";
        GameEvent.REELSET_INITIALISED = GameEvent.PREFIX + "REELSET_INITIALISED";
        GameEvent.REEL_SPIN_COMPLETE = GameEvent.PREFIX + "REEL_SPIN_COMPLETE";
        GameEvent.REEL_SPIN_STARTED = GameEvent.PREFIX + "REEL_SPIN_STARTED";
        GameEvent.REEL_SINGLE_SPIN_COMPLETE = GameEvent.PREFIX + "REEL_SINGLE_SPIN_COMPLETE";
        GameEvent.REEL_SCATTERS_SET = GameEvent.PREFIX + "REEL_SCATTERS_SET";
        GameEvent.FORCE_VIEW_OPENED = GameEvent.PREFIX + "FORCE_VIEW_OPENED";
        GameEvent.FORCE_VIEW_CLOSED = GameEvent.PREFIX + "FORCE_VIEW_CLOSED";
        GameEvent.DEMO_VIEW_OPENED = GameEvent.PREFIX + "DEMO_VIEW_OPENED";
        GameEvent.DEMO_VIEW_CLOSED = GameEvent.PREFIX + "DEMO_VIEW_CLOSED";
        GameEvent.DEMO_DATA_SET = GameEvent.PREFIX + "DEMO_DATA_SET";
        GameEvent.REELSET_CLICK = GameEvent.PREFIX + "REELSET_CLICK";
        GameEvent.RECOVERY_BALANCE_UPDATE = GameEvent.PREFIX + "RECOVERY_BALANCE_UPDATE";
        GameEvent.HELP_UI_READY = GameEvent.PREFIX + "HELP_UI_READY";
        GameEvent.REELS_STOPPED = GameEvent.PREFIX + "REELS_STOPPED";
        // Reels
        GameEvent.REEL_CASCADED = GameEvent.PREFIX + "REEL_CASCADED";
        GameEvent.REEL_1_CASCADED = GameEvent.PREFIX + "REEL_1_CASCADED";
        GameEvent.REEL_2_CASCADED = GameEvent.PREFIX + "REEL_2_CASCADED";
        GameEvent.REEL_3_CASCADED = GameEvent.PREFIX + "REEL_3_CASCADED";
        GameEvent.REEL_4_CASCADED = GameEvent.PREFIX + "REEL_4_CASCADED";
        GameEvent.REEL_5_CASCADED = GameEvent.PREFIX + "REEL_5_CASCADED";
        GameEvent.HAS_WINS = GameEvent.PREFIX + "HAS_WINS";
        GameEvent.HAS_NO_WINS = GameEvent.PREFIX + "HAS_NO_WINS";
        GameEvent.WIN_COUNT_UP_COMPLETE = GameEvent.PREFIX + "WIN_COUNT_UP_COMPLETE";
        GameEvent.SHOW_WINS = GameEvent.PREFIX + "SHOW_WINS";
        GameEvent.SHOW_WINS_COMPLETE = GameEvent.PREFIX + "SHOWING_WINS_COMPLETE";
        GameEvent.REMOVE_SYMBOL = GameEvent.PREFIX + "REMOVE_SYMBOL";
        GameEvent.CASCADE_REELS = GameEvent.PREFIX + "CASCADE_REELS";
        GameEvent.CASCADE_REELS_COMPLETE = GameEvent.PREFIX + "CASCADE_REELS_COMPLETE";
        GameEvent.HIGHLIGHT_FIVE_OF_A_KIND = GameEvent.PREFIX + "HIGHLIGHT_FIVE_OF_A_KIND";
        // FSG Anticipation
        GameEvent.FSG_ANTICIPATION = GameEvent.PREFIX + "FSG_ANTICIPATION";
        // FSG Siren
        GameEvent.FSG_SIREN = GameEvent.PREFIX + "FSG_SIREN";
        // FSG
        GameEvent.FREE_SPINS_GAME_AWARDED = GameEvent.PREFIX + "FREE_SPINS_GAME_AWARDED";
        GameEvent.NO_FREE_SPINS_AWARDED = GameEvent.PREFIX + "NO_FREE_SPINS_AWARDED";
        GameEvent.SHOW_FREE_SPINS_GAME_INTRO_VIEW = GameEvent.PREFIX + "SHOW_FREE_SPINS_GAME_INTRO_VIEW";
        GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED = GameEvent.PREFIX + "PLAY_FREE_SPINS_BUTTON_PRESSED";
        GameEvent.FREE_SPIN_VALID = GameEvent.PREFIX + "FREE_SPIN_VALID";
        GameEvent.HAS_EXTRA_FREE_SPINS = GameEvent.PREFIX + "HAS_EXTRA_FREE_SPINS";
        GameEvent.HAS_NO_EXTRA_FREE_SPINS = GameEvent.PREFIX + "HAS_NO_EXTRA_FREE_SPINS";
        GameEvent.SHOWING_EXTRA_FREE_SPINS_COMPLETE = GameEvent.PREFIX + "SHOWING_EXTRA_FREE_SPINS_COMPLETE";
        GameEvent.FREE_SPINS_GAME_COMPLETE = GameEvent.PREFIX + "FREE_SPINS_GAME_COMPLETE";
        GameEvent.SHOW_TOTAL_WON = GameEvent.PREFIX + "SHOW_TOTAL_WON";
        GameEvent.SHOW_TOTAL_WON_COMPLETE = GameEvent.PREFIX + "SHOW_TOTAL_WON_COMPLETE";
        GameEvent.FREE_SPIN_COUNT_UPDATED = GameEvent.PREFIX + "FREE_SPIN_COUNT_UPDATED";
        GameEvent.NO_MORE_FREE_SPINS = GameEvent.PREFIX + "NO_MORE_FREE_SPINS";
        GameEvent.RUNNING_WINNINGS_FROM_FREE_SPINS_UPDATED = GameEvent.PREFIX + "RUNNING_WINNINGS_FROM_FREE_SPINS_UPDATED";
        GameEvent.TOTAL_WINNINGS_FROM_FREE_SPINS_UPDATED = GameEvent.PREFIX + "TOTAL_WINNINGS_FROM_FREE_SPINS_UPDATED";
        GameEvent.FINALISED_TOTAL_WINNINGS_FROM_BASE_AND_FREE_GAME = GameEvent.PREFIX + "FINALISED_TOTAL_WINNINGS_FROM_BASE_AND_FREE_GAME";
        GameEvent.WHITE_FLASH_FADE_IN_COMPLETE = GameEvent.PREFIX + "WHITE_FLASH_FADE_IN_COMPLETE";
        GameEvent.WHITE_FLASH_FADE_OUT_COMPLETE = GameEvent.PREFIX + "WHITE_FLASH_FADE_OUT_COMPLETE";
        GameEvent.RETURN_TO_BASE_GAME = GameEvent.PREFIX + "RETURN_TO_BASE_GAME";
        GameEvent.RECOVERY_INTO_FREE_SPINS_GAME = GameEvent.PREFIX + "RECOVERY_INTO_FREE_SPINS_GAME";
        // HELP
        GameEvent.HELP_CLOSE_BUTTON_PRESSED = GameEvent.PREFIX + "HELP_CLOSE_BUTTON_PRESSED";
        GameEvent.HELP_NEXT_BUTTON_PRESSED = GameEvent.PREFIX + "HELP_NEXT_BUTTON_PRESSED";
        GameEvent.HELP_PREVIOUS_BUTTON_PRESSED = GameEvent.PREFIX + "HELP_PREVIOUS_BUTTON_PRESSED";
        // FORCE
        GameEvent.FORCE_BUTTON_PRESSED = GameEvent.PREFIX + "FORCE_BUTTON_PRESSED";
        // MOBILE UI        
        GameEvent.MOBILE_POPOUT_MENU_OPEN = GameEvent.PREFIX + "MOBILE_POPOUT_MENU_OPEN";
        GameEvent.MOBILE_POPOUT_MENU_CLOSE = GameEvent.PREFIX + "MOBILE_POPOUT_MENU_CLOSE";
        GameEvent.MOBILE_POPOUT_MENU_CONTENT_CHANGED = GameEvent.PREFIX + "MOBILE_POPOUT_MENU_CONTENT_CHANGED";
        GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START = GameEvent.PREFIX + "MOBILE_POPOUT_MENU_ANIMATION_START";
        GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END = GameEvent.PREFIX + "MOBILE_POPOUT_MENU_ANIMATION_END";
        // Mobile
        GameEvent.MENU_BUTTON_PRESSED_IN = "GameEvent_MENU_BUTTON_PRESSED_IN";
        GameEvent.MENU_BUTTON_PRESSED_OUT = "GameEvent_MENU_BUTTON_PRESSED_OUT";
        GameEvent.MOBILE_MENU_OPEN = "GameEvent_MOBILE_MENU_OPEN";
        GameEvent.MOBILE_MENU_CLOSE = "GameEvent_MOBILE_MENU_CLOSE";
        GameEvent.MOBILE_MENU_BUTTON_PRESSED = "GameEvent_MOBILE_MENU_BUTTON_PRESSED";
        GameEvent.MOBILE_SPIN_BUTTON_FULLY_VISIBLE = "GameEvent_MOBILE_SPIN_BUTTON_FULLY_VISIBLE";
        GameEvent.MOBILE_CHEVRON_BUTTON_PRESSED = "GameEvent_MOBILE_CHEVRON_BUTTON_PRESSED";
        // CYCLER
        GameEvent.PAY_CYCLE_OVERLAY_PRESSED = GameEvent.PREFIX + "PAY_CYCLE_OVERLAY_PRESSED";
        GameEvent.CYCLER_BONUS_TRIGGER = GameEvent.PREFIX + "CYCLER_BONUS_TRIGGER";
        return GameEvent;
    }(borgevent.Event));
    game.GameEvent = GameEvent;
})(game || (game = {}));
var game;
(function (game) {
    var WinModelEvent = (function (_super) {
        __extends(WinModelEvent, _super);
        function WinModelEvent(eventName) {
            _super.call(this, eventName);
        }
        WinModelEvent.WIN_MODEL_CHANGED = "WinModelEvent_WIN_MODEL_CHANGED";
        return WinModelEvent;
    }(borgevent.Event));
    game.WinModelEvent = WinModelEvent;
})(game || (game = {}));
////////////////////////////////////////////////////////////////
// A minimalist stand-alone finite state machine implementation
// 
// class FSMTransition: Simple string based representation of 
// a state transition - from, to, event
// 
// class FSM: Simple state machine based on the above which
// tracks / logs/ reports current state and responds to events.  
//
// interface IFSMDelegate: allows FSM to inform a delegate object
// of transitions and internal changes to the FSM to support
// external extension of the state machine and external diagnostics
// and of course to allow the FSM itself to be completely stand
// alone / independent of all other classes and a game specific focus
var game;
(function (game) {
    /**
        FSMTransition: simple class representing a state transition
        in the FSM. Self explanatory via accessors **/
    var FSMTransition = (function () {
        function FSMTransition(from, to, event) {
            this._from = from;
            this._to = to;
            this._event = event;
        }
        Object.defineProperty(FSMTransition.prototype, "from", {
            get: function () {
                return this._from;
            },
            set: function (value) {
                this._from = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSMTransition.prototype, "to", {
            get: function () {
                return this._to;
            },
            set: function (value) {
                this._to = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSMTransition.prototype, "event", {
            get: function () {
                return this._event;
            },
            set: function (value) {
                this._event = value;
            },
            enumerable: true,
            configurable: true
        });
        return FSMTransition;
    }());
    game.FSMTransition = FSMTransition;
    /**
        FSM: Finite State Machine encapsulation
        Designed to be completely independent and reusable as well
        as being as simple as possible. States and transitions are
        just simle strings rather than potentially more complex
        classes themselves **/
    var FSM = (function () {
        function FSM(name) {
            this._validStates = []; // List of valid states built as transitions are added NOT in advance
            this._validEvents = []; // List of valid events that can trigger transitions. Build as above
            this._validTransitions = {}; // Map of 'from' states to an array of transitions - each state may have multiple transitions
            this._fsmName = name;
        }
        Object.defineProperty(FSM.prototype, "name", {
            ///////////////////////////////////////////////////////////////
            // Accessors
            get: function () {
                return this._fsmName;
            },
            set: function (value) {
                this._fsmName = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSM.prototype, "exitState", {
            /** These allow us to specify the "final" state of the FSM so that
                on reaching it, we can notify the delegate that the FSM has "exited" **/
            get: function () { return this._exitState; },
            set: function (value) {
                if (this._validStates.indexOf(value) == -1) {
                    this.throwException("exitState accessor - invalid state specified: " + value);
                }
                this._exitState = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSM.prototype, "previousState", {
            get: function () { return this._prevState; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSM.prototype, "currentState", {
            get: function () { return this._currState; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSM.prototype, "delegate", {
            get: function () { return this._delegate; },
            set: function (value) { this._delegate = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSM.prototype, "validStates", {
            get: function () { return this._validStates; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSM.prototype, "validEvents", {
            get: function () { return this._validEvents; },
            enumerable: true,
            configurable: true
        });
        /** Call to initialise the FSM to the designated state (if it exists) **/
        FSM.prototype.init = function (initialState, suppress) {
            if (suppress === void 0) { suppress = false; }
            if (this._validStates.indexOf(initialState) != -1) {
                this._currState = initialState;
                if (!suppress) {
                    this.notifyDelegateDidTransition(FSM.kPreInitState, initialState);
                }
            }
            else {
                this.throwException("Invalid initial state: " + initialState);
            }
            return this;
        };
        /** As transitions are added (a "from", "to", "event" triplet) the list of
            valid states and events is updated on the fly. We don't pre-specify the
            list of valid states. It's a choice of simplicity over robustness in this
            case **/
        FSM.prototype.addTransition = function (transition) {
            // Does this transition already exist
            if (this.transitionExists(transition)) {
                var msg = "Transition already exists: {" + transition.from + ", " + transition.to + ", " + transition.event + "}";
                this.throwException(msg);
            }
            else {
                // Update the lists of valid states and events if appropriate
                if (this._validStates.indexOf(transition.from) == -1) {
                    this._validStates.push(transition.from);
                }
                if (this._validStates.indexOf(transition.to) == -1) {
                    this._validStates.push(transition.to);
                }
                if (this._validEvents.indexOf(transition.event) == -1) {
                    this._validEvents.push(transition.event);
                }
                // Get the existing list of transitions for the specified state
                var existingTransitions = this.transitionsFromState(transition.from);
                // Update it to include the new transition and then update the map of transitions
                existingTransitions.push(transition);
                this._validTransitions[transition.from] = existingTransitions;
            }
            return this;
        };
        /** Checks if there is a transition between the 2 states and if there
            is then it returns the series of events that can trigger it **/
        FSM.prototype.canTransition = function (from, to) {
            var triggeringEvents = [];
            var fromExists = this._validStates.indexOf(from) > -1;
            var toExists = this._validStates.indexOf(to) > -1;
            if (fromExists && toExists) {
                var transitions = this.transitionsFromState(from);
                for (var idx = 0; idx < transitions.length; ++idx) {
                    var trans = transitions[idx];
                    if (trans.to === to) {
                        triggeringEvents.push(trans.event);
                    }
                }
            }
            return triggeringEvents;
        };
        /** The main "do work" method. Checks the current state and whether there is
            a specified transition from it to another state given the specified event **/
        FSM.prototype.doTransition = function (event) {
            var ignored = true;
            if (this._validStates.indexOf(this._currState) > -1) {
                var transitions = this.transitionsFromState(this._currState);
                for (var idx = 0; idx < transitions.length; ++idx) {
                    var trans = transitions[idx];
                    if (trans.event === event) {
                        var proceed = true;
                        // Ask delegate if we should proceed with valid transition
                        // (see comments on the delegate interface)
                        if (this._delegate) {
                            proceed = this.notifyDelegateWillTransition(this._currState, trans.to);
                        }
                        // If the delegate agrees that the transition can occur then do it
                        if (proceed) {
                            this._prevState = this._currState;
                            this._currState = trans.to;
                            this.notifyDelegateDidTransition(this._prevState, this._currState);
                            ignored = false;
                            break;
                        }
                        else {
                            // The delegate refused the transition to disallow it
                            ignored = false;
                            this.notifyDelegateDisallowed(event);
                        }
                    }
                }
            }
            // If there was no transition from the current state for the specified event
            // then ignore it and notify the delegate
            if (ignored) {
                this.notifyDelegateIgnoredEvent(event);
            }
            return this;
        };
        /** This allows us to jump directly to the specified state and optionally
            suppress the notification if required **/
        FSM.prototype.forceState = function (state, suppress) {
            if (suppress === void 0) { suppress = true; }
            if (this._validStates.indexOf(state) > -1) {
                this._prevState = this._currState;
                this._currState = state;
                if (!suppress) {
                    this.notifyDelegateDidTransition(this._prevState, this._currState);
                }
            }
            else {
                this.throwException("forceState(" + state + ") - specified state does not exist");
            }
            return this;
        };
        // Methods to send notifications to delegate - if it exists
        FSM.prototype.notifyDelegateWillTransition = function (from, to) {
            var allowTransition = true;
            if (this._delegate) {
                allowTransition = this._delegate.willTransition(this, from, to);
            }
            return allowTransition;
        };
        FSM.prototype.notifyDelegateDidTransition = function (from, to) {
            if (this._delegate) {
                this._delegate.didTransition(this, from, to);
                if (to === this._exitState) {
                    this._delegate.didExit(this);
                }
            }
        };
        FSM.prototype.notifyDelegateIgnoredEvent = function (event) {
            if (this._delegate) {
                this._delegate.ignoredEvent(this, event, this._currState);
            }
        };
        FSM.prototype.notifyDelegateDisallowed = function (event) {
            if (this._delegate) {
                this._delegate.disallowedTransition(this, this._currState, event);
            }
        };
        FSM.prototype.transitionExists = function (trans) {
            var exists = false;
            var transitions = this.transitionsFromState(trans.from);
            for (var idx = 0; idx < transitions.length; ++idx) {
                var thisTrans = transitions[idx];
                if ((thisTrans.to === trans.to) && (thisTrans.event === trans.event)) {
                    exists = true;
                }
            }
            return exists;
        };
        /** Return the array of FSMTransition objects that have the specified key
            returns an empty array if there are none **/
        FSM.prototype.transitionsFromState = function (state) {
            var transitions = [];
            var fromExists = this._validStates.indexOf(state) > -1;
            if (fromExists) {
                if (state in this._validTransitions) {
                    transitions = this._validTransitions[state];
                }
            }
            return transitions;
        };
        FSM.prototype.throwException = function (msg) {
            var fullMsg = "FSM Exception: " + msg;
            throw (fullMsg);
        };
        FSM.kPreInitState = "<pre-init>";
        return FSM;
    }());
    game.FSM = FSM;
})(game || (game = {}));
var game;
(function (game) {
    ///////////////////////////////////////////////////////////////
    // Game state specific event class
    // Self explanatory
    var GameStateEvent = (function (_super) {
        __extends(GameStateEvent, _super);
        function GameStateEvent(eventName, sender, subgame, state) {
            _super.call(this, eventName);
            this._sender = sender;
            this._subgame = subgame;
            this._state = state;
        }
        GameStateEvent.EnterState = function (subgame, stateName) {
            return GameStateEvent.ENTERSTATE + "_" + subgame + "_" + stateName;
        };
        GameStateEvent.ExitState = function (subgame, stateName) {
            return GameStateEvent.EXITSTATE + "_" + subgame + "_" + stateName;
        };
        GameStateEvent.EnterSubgame = function (subgame) {
            return GameStateEvent.ENTERSUBGAME + "_" + subgame;
        };
        GameStateEvent.ExitSubgame = function (subgame) {
            return GameStateEvent.EXITSUBGAME + "_" + subgame;
        };
        GameStateEvent.ReturnToSubgame = function (subgame) {
            return GameStateEvent.RETURNTOSUBGAME + "_" + subgame;
        };
        Object.defineProperty(GameStateEvent.prototype, "sender", {
            get: function () { return this._sender; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateEvent.prototype, "subgame", {
            get: function () { return this._subgame; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateEvent.prototype, "state", {
            get: function () { return this._state; },
            enumerable: true,
            configurable: true
        });
        GameStateEvent.STATE_MODEL_READY = "GameStateEvent_STATE_MODEL_READY";
        GameStateEvent.ENTERSUBGAME = "GameStateEvent_ENTERSUBGAME";
        GameStateEvent.RETURNTOSUBGAME = "GameStateEvent_RETURNTOSUBGAME";
        GameStateEvent.EXITSUBGAME = "GameStateEvent_EXITSUBGAME";
        GameStateEvent.ENTERSTATE = "GameStateEvent_ENTERSTATE";
        GameStateEvent.EXITSTATE = "GameStateEvent_EXITSTATE";
        GameStateEvent.CHANGE_STATE = "GameStateEvent_CHANGE_STATE";
        GameStateEvent.CHANGE_SUBGAME = "GameStateEvent_CHANGE_STATE";
        return GameStateEvent;
    }(borgevent.Event));
    game.GameStateEvent = GameStateEvent;
})(game || (game = {}));
var Utils;
(function (Utils) {
    var MiscUtils = (function () {
        function MiscUtils() {
        }
        MiscUtils.getCountryCode = function (partnerAdapter, metadata) {
            var code = "";
            // We *SHOULD* get country code from getCountryCode() on sec2 / pa01
            // but locally this (currently) gives "UNKNOWN" so we need a fallback
            if (metadata) {
                if (metadata.getCountryCode) {
                    code = metadata.getCountryCode();
                    // On local uber, code comes back as "UNKNOWN""
                    if (code === "UNKNOWN") {
                        code = "";
                    }
                }
                // Fallback for local uber and (possibly) dodgy deployments
                if (code === "") {
                    if (metadata.getLocale) {
                        code = metadata.getLocale();
                    }
                    else {
                        code = partnerAdapter.urlParams.locale;
                    }
                }
            }
            return code;
        };
        MiscUtils.getObjectClass = function (obj) {
            if (obj && obj.constructor && obj.constructor.toString) {
                var arr = obj.constructor.toString().match(/function\s*(\w+)/);
                if (arr && arr.length == 2) {
                    return arr[1];
                }
            }
            return undefined;
        };
        MiscUtils.getReelIndicesFromMask = function (mask) {
            var retVal = [];
            var compMask = 1;
            if (mask > 0) {
                for (var col = 0; col < 5; ++col) {
                    if (mask & compMask) {
                        retVal.push(col);
                    }
                    compMask = compMask << 1;
                }
            }
            return retVal;
        };
        MiscUtils.numToString = function (num, length) {
            var r = num.toString();
            while (r.length < length) {
                r = "0" + r;
            }
            return r;
        };
        MiscUtils.getAssetFrameWithName = function (name, bundle, jsonBundle, cache) {
            var jsonAsset = cache.getAssetById(jsonBundle);
            var imgAsset = cache.getAssetById(bundle);
            var spritesheet = new components.SpriteSheet(jsonAsset, imgAsset);
            var frame = spritesheet.getFrameByName(name);
            return frame;
        };
        MiscUtils.createBox = function (x, y, width, height, colour, fill, strokeThickness) {
            if (fill === void 0) { fill = true; }
            if (strokeThickness === void 0) { strokeThickness = 0; }
            var box = new rendering.Graphics();
            box.lineStyle(strokeThickness, colour, 1);
            if (fill) {
                box.beginFill(colour, 1);
            }
            box.drawRect(0, 0, width, height);
            if (fill) {
                box.endFill();
            }
            box.alpha = 1;
            box.x = x;
            box.y = y;
            return box;
        };
        MiscUtils.createRoundedBox = function (x, y, width, height, colour, fill, strokeThickness, radius) {
            if (fill === void 0) { fill = true; }
            if (strokeThickness === void 0) { strokeThickness = 0; }
            if (radius === void 0) { radius = 10; }
            var box = new rendering.Graphics();
            box.lineStyle(strokeThickness, colour, 1);
            if (fill) {
                box.beginFill(colour, 1);
            }
            box.drawRoundRect(0, 0, width, height, radius);
            if (fill) {
                box.endFill();
            }
            box.alpha = 1;
            box.x = x;
            box.y = y;
            return box;
        };
        /**
         *  Replace the text that should be sent as "sometext |||textToReplace||| sometext"
         */
        MiscUtils.searchAndReplace = function (textElement, searchElement, replacementElement, replaceAll) {
            if (replaceAll === void 0) { replaceAll = true; }
            var finalText = textElement;
            do {
                var found = finalText.indexOf(searchElement) > -1;
                if (found) {
                    finalText = finalText.replace(searchElement, replacementElement);
                    found = (finalText.indexOf(searchElement) > -1) && replaceAll;
                }
                else {
                    Utils.PSLog.log("MiscUtils::searchAndReplace() parsing error: text= " + textElement + " textToReplace= " + searchElement + " replacementText " + replacementElement);
                    finalText = "Parsing Error";
                }
            } while (found);
            return finalText;
        };
        /**
         * Create basic text
         * @param parent The item you wish to place the text into.
         * @param label - the text string itself
         * @param font e.g. "Myriad Pro Black"
         * @param fontSize as you would expect
         * @param alignment e.g. rendering.TextAlign.CENTER / LEFT / RIGHT
         * @param width field width
         * @param height field height
         * @param x based on top left
         * @param y based on top left
         * @param colour e.g. "#ffffff"
         * @param debug true provides border around field size
         */
        MiscUtils.createStandardText = function (parent, label, font, fontSize, alignment, width, height, x, y, colour, debug) {
            var txt = new rendering.Text(label);
            txt.font = font;
            txt.fontSize = fontSize;
            txt.textAlign = alignment;
            //txt.width = width;
            //txt.height = height;
            txt.scaleToWidth = width;
            txt.scaleToHeight = height;
            txt.x = x == null ? 0 : x;
            txt.y = y == null ? 0 : y;
            txt.colour = colour == null ? "#ffffff" : colour;
            txt.wrapWidth = width;
            txt.lineHeight = fontSize + 10;
            txt.debug = debug;
            parent.addChild(txt);
            return txt;
        };
        MiscUtils.createText = function (parent, label, fontSize, alignment, widthAndHeight, xyPos, colour, outlineCol, outlineSize, dropShadow, type, multiline, debug) {
            if (dropShadow === void 0) { dropShadow = false; }
            if (type === void 0) { type = "plain"; }
            if (multiline === void 0) { multiline = false; }
            if (debug === void 0) { debug = false; }
            // Drop Shadow control parameters
            var dropShadowBlur = type == "shadowGlow" ? 8 : 5;
            var dropShadowXOffset = type == "shadowGlow" ? 0 : 0;
            var dropShadowYOffset = type == "shadowGlow" ? 0 : 3;
            var txt = new rendering.Text(label);
            txt.width = txt.maxWidth = txt.scaleToWidth = widthAndHeight[0];
            if (multiline)
                txt.wrapWidth = widthAndHeight[0]; //having wrapWidth sets off multiline wrapping, otherwise we're single line
            txt.height = txt.scaleToHeight = widthAndHeight[1];
            txt.fontSize = fontSize;
            txt.colour = colour || "#FFFFFF";
            txt.font = "Myriad Pro Black";
            txt.outlineColour = outlineCol || "#000000";
            txt.outlineSize = outlineSize || 0;
            txt.textAlign = alignment;
            txt.x = xyPos[0];
            txt.y = xyPos[1];
            // if (alignment === rendering.TextAlign.CENTER) {
            //     txt.x =  xyPos[0] - (txt.width >> 1);
            //     txt.y =  xyPos[1] - (txt.height >> 1);
            // }
            //without scaleToWidth and scaleToHeight (see above), the debug property has no effect
            txt.debug = debug;
            txt.interactive = false;
            if (dropShadow) {
                var colour = type == "shadowGlow" ? "#333333" : "#000000";
                new filters.DropShadowFilter(txt, colour, dropShadowBlur, dropShadowXOffset, dropShadowYOffset);
                if (type == "shadowGlow")
                    new filters.DropShadowFilter(txt, colour, dropShadowBlur, dropShadowXOffset, dropShadowYOffset); //strengthen shadow
            }
            if (type == "gold") {
                var point1 = new util.Point(0, 0);
                var point2 = new util.Point(0, txt.height);
                new filters.LinearGradientFilter(txt, ["#fcc027", "#f89412", "#fbd678", "#fbd86c"], [1, 0.55, 0.45, 0], point1, point2);
            }
            parent.addChild(txt);
            return txt;
        };
        MiscUtils.createStyledText = function (label, font, fontSize, alignment, colour, width, height, outlineCols, outlineSizes, offsetX, offsetY, lineHeight, debug, dropShadow) {
            if (lineHeight === void 0) { lineHeight = fontSize + 10; }
            if (debug === void 0) { debug = false; }
            if (dropShadow === void 0) { dropShadow = true; }
            // Drop Shadow control parameters
            var kDropShadowBlur = 8;
            var kDropShadowXOffset = 1;
            var kDropShadowYOffset = 5;
            var styledText = [];
            for (var i = 0; i < outlineCols.length; i++) {
                var txt = new rendering.Text(label);
                txt.font = font;
                txt.fontSize = fontSize;
                txt.colour = colour;
                txt.outlineColour = outlineCols[i];
                txt.outlineSize = outlineSizes[i];
                txt.wrapWidth = width;
                txt.lineHeight = lineHeight;
                txt.textAlign = alignment;
                txt.x = offsetX;
                txt.y = offsetY;
                txt.debug = debug;
                // It seems that without these, the debug property has no effect
                // (or at least doesn't show on screen)
                txt.scaleToWidth = width;
                txt.scaleToHeight = height;
                if (alignment === rendering.TextAlign.CENTER) {
                    txt.x = offsetX + (width - txt.width) / 2;
                }
                if ((i == 0) && dropShadow) {
                    new filters.DropShadowFilter(txt, "#000000", kDropShadowBlur, kDropShadowXOffset, kDropShadowYOffset);
                }
                styledText.push(txt);
            }
            return styledText;
        };
        MiscUtils.createBasicText = function (parent, label, fontSize, alignment, widthAndHeight, xyPos, colour, outlineCol, outlineSize, dropShadow, type, debug) {
            if (dropShadow === void 0) { dropShadow = false; }
            if (type === void 0) { type = "plain"; }
            if (debug === void 0) { debug = false; }
            // Drop Shadow control parameters
            var dropShadowBlur = 5;
            var dropShadowXOffset = 0;
            var dropShadowYOffset = 3;
            var txt = new rendering.Text(label);
            txt.width = txt.maxWidth = txt.scaleToWidth = widthAndHeight[0];
            txt.height = txt.scaleToHeight = widthAndHeight[1];
            txt.fontSize = fontSize;
            txt.colour = colour || "#FFFFFF";
            txt.font = "Myriad Pro Black";
            txt.outlineColour = outlineCol || "#000000";
            txt.outlineSize = outlineSize || 0;
            txt.textAlign = alignment;
            txt.x = xyPos[0];
            txt.y = xyPos[1];
            if (alignment === rendering.TextAlign.CENTER) {
                txt.x = xyPos[0] - (txt.width >> 1);
                txt.y = xyPos[1] - (txt.height >> 1);
            }
            //without scaleToWidth and scaleToHeight (see above), the debug property has no effect
            txt.debug = debug;
            txt.interactive = false;
            if (dropShadow) {
                new filters.DropShadowFilter(txt, "#000000", dropShadowBlur, dropShadowXOffset, dropShadowYOffset);
            }
            if (type == "gold") {
                var point1 = new util.Point(0, 0);
                var point2 = new util.Point(0, txt.height);
                new filters.LinearGradientFilter(txt, ["#fcc027", "#f89412", "#fbd678", "#fbd86c"], [1, 0.55, 0.45, 0], point1, point2);
            }
            parent.addChild(txt);
            return txt;
        };
        /**
         * Create a new AssetRef (check for all lowercase paths first)
         * @param path Path of the asset to loader
         * @param name Alias that can be used to reference the asset from the asset cache
         * @param bundle So we can add the asset to the appropriate bundle before returning the reference
         */
        MiscUtils.createAssetRef = function (path, name, bundle) {
            var capCount = path.replace(/[^A-Z]/g, "").length;
            //if(capCount > 0){alert("Asset Path not all lower case. Path: " + path + " Asset: " + name)}
            var asset = bundle.create(path, name);
            return asset;
        };
        /**
         * Centre the registration point of an image or similar elements that uses 'pivot' such images or buttons
         * @param img - image/button/movieclip/Iframe elements
         */
        MiscUtils.centreReg = function (img, scalar) {
            if (scalar === void 0) { scalar = 1; }
            img.pivot.x = (img.width * scalar) >> 1;
            img.pivot.y = (img.height * scalar) >> 1;
        };
        // Spine Animation related
        MiscUtils.createSpineAnimator = function (basePath, scale, spineOptions, parent) {
            var renderer = new spine2d.Spine2dBitmapRenderer();
            renderer.visible = true;
            renderer.parent = parent;
            var animator = new spine2d.Spine2d(basePath, scale, renderer);
            // Note that the load method will retrieve the cached data if already loaded or will load if required
            animator.load(spineOptions);
            return animator;
        };
        /**
         * Apply multiplier and format
         */
        MiscUtils.currencyFormat = function (amount, server, formatter, useMultiplier) {
            if (useMultiplier === void 0) { useMultiplier = false; }
            var currencyMultiplier = useMultiplier ? server.getInitResponse().platformData.currencyMultiplier : 1;
            return formatter.format(amount * currencyMultiplier);
        };
        //////////////////////////////////////////////
        // Some functions to help with eliptical maths
        // which is always much harder than you imagine!
        MiscUtils.approximateEllipseCircumference = function (xRadius, yRadius) {
            // Distance (in radians) between angles
            var kDeltaTheta = 0.001;
            var numIntegrals = Math.round(Math.PI * 2.0 / kDeltaTheta);
            var length = 0;
            // Calculate approximation by integrating over the
            // elipse in order to get the circumference
            for (var i = 0; i < numIntegrals; i++) {
                length += this.computeArcOverAngle(xRadius, yRadius, i * kDeltaTheta, kDeltaTheta);
            }
            return length;
        };
        MiscUtils.computeArcOverAngle = function (radiusX, radiusY, angle, angleSeg) {
            var d1 = Math.pow(radiusX * Math.sin(angle), 2.0);
            var d2 = Math.pow(radiusY * Math.cos(angle), 2.0);
            var distance = Math.sqrt(d1 + d2);
            return distance * angleSeg;
        };
        MiscUtils.getAngleForArcLength = function (xRadius, yRadius, currentArcPos, goalArcPos, angle, angleSeg) {
            var kArcAccuracy = 0.1;
            // Calculate arc length at new angle
            var nextSegLength = MiscUtils.computeArcOverAngle(xRadius, yRadius, angle + angleSeg, angleSeg);
            // If we've overshot, reduce the delta angle and try again
            if (currentArcPos + nextSegLength > goalArcPos) {
                return MiscUtils.getAngleForArcLength(xRadius, yRadius, currentArcPos, goalArcPos, angle, angleSeg / 2);
            }
            else if (currentArcPos + nextSegLength < goalArcPos - ((goalArcPos - currentArcPos) * kArcAccuracy)) {
                return MiscUtils.getAngleForArcLength(xRadius, yRadius, currentArcPos + nextSegLength, goalArcPos, angle + angleSeg, angleSeg);
            }
            else {
                return angle;
            }
        };
        MiscUtils.animateToScale = function (object, scaleX, scaleY, speed) {
            if (speed === void 0) { speed = 0.15; }
            new TweenMax(object, speed, {
                scaleX: scaleX,
                scaleY: scaleY
            });
        };
        MiscUtils.getWinMeterIncrementMultiple = function (additionalWinnings, totalBet, stakePerLine) {
            return Math.max(1, Math.round(Math.ceil(additionalWinnings / totalBet) * (stakePerLine / 4)));
        };
        MiscUtils.composeBitmap = function (parent, asset, x, y) {
            var bitmap = new rendering.Bitmap(asset);
            bitmap.x = x;
            bitmap.y = y;
            parent.addChild(bitmap);
            return bitmap;
        };
        /**
         * Add a bitmap to the parent
         */
        MiscUtils.addBitmap = function (parent, cache, bundle, spritesheetName, pngName, x, y, centre, scalar) {
            if (centre === void 0) { centre = false; }
            if (scalar === void 0) { scalar = 1; }
            var frame;
            frame = Utils.MiscUtils.getAssetFrameWithName(pngName, bundle[spritesheetName].name, bundle[spritesheetName + "Json"].name, cache);
            var bitmap = Utils.MiscUtils.composeBitmap(parent, frame, x, y);
            if (centre) {
                Utils.MiscUtils.centreReg(bitmap, scalar);
            }
            return bitmap;
        };
        /**
         *
         */
        MiscUtils.addBasicButton = function (parent, x, y, cache, bundle, spritesheetName, pngNames, icon, iconXY, scalar) {
            if (icon === void 0) { icon = ""; }
            if (iconXY === void 0) { iconXY = []; }
            if (scalar === void 0) { scalar = -1; }
            var button = new game.ButtonView();
            //0 = up, 1 = down, 2 = over, 3 = dim
            var buttonsStates = [];
            for (var i = 0; i < 4; i++) {
                buttonsStates[i] = Utils.MiscUtils.getAssetFrameWithName(pngNames[i], bundle[spritesheetName].name, bundle[spritesheetName + "Json"].name, cache);
            }
            button.setAssets(buttonsStates[0], buttonsStates[1], buttonsStates[2], buttonsStates[3]);
            button.setPosition(x, y);
            button.getNativeDisplayObject().buttonMode = true;
            parent.addChild(button);
            if (scalar > 0)
                Utils.MiscUtils.centreReg(button, scalar);
            //add an overlaying icon if required
            //iconXY fine tunes in relation to centre position
            if (icon.length > 0) {
                var iconOverlay = Utils.MiscUtils.addBitmap(button, cache, bundle, spritesheetName, icon, 0, 0);
                //auto centre the overlayIcon
                iconOverlay.x = ((button.width - iconOverlay.width) >> 1) + (iconXY.length > 0 ? iconXY[0] : 0);
                iconOverlay.y = ((button.height - iconOverlay.height) >> 1) + (iconXY.length > 0 ? iconXY[1] : 0);
                iconOverlay.interactive = false;
                button.addChild(iconOverlay);
            }
            return button;
        };
        MiscUtils.addAutoRepeatButton = function (parent, x, y, cache, bundle, spritesheetName, pngNames, icon, iconXY, scalar) {
            if (icon === void 0) { icon = ""; }
            if (iconXY === void 0) { iconXY = []; }
            if (scalar === void 0) { scalar = -1; }
            var jsonAsset = cache.getAssetById(bundle[spritesheetName + "Json"].name);
            var imgAsset = cache.getAssetById(bundle[spritesheetName].name);
            var spritesheet = new components.SpriteSheet(jsonAsset, imgAsset);
            var upAsset = spritesheet.getFrameByName(pngNames[0]);
            var downAsset = spritesheet.getFrameByName(pngNames[1]);
            var overAsset = spritesheet.getFrameByName(pngNames[2]);
            var dimAsset = spritesheet.getFrameByName(pngNames[3]);
            var button = new game.AutoRepeatButtonView(upAsset, downAsset, overAsset, dimAsset);
            button.x = x;
            button.y = y;
            button.setMouseoverCursor();
            parent.addChild(button);
            if (scalar > 0)
                Utils.MiscUtils.centreReg(button, scalar);
            //add an overlaying icon if required
            //iconXY fine tunes in relation to centre position
            if (icon.length > 0) {
                var iconOverlay = Utils.MiscUtils.addBitmap(button, cache, bundle, spritesheetName, icon, 0, 0);
                //auto centre the overlayIcon
                iconOverlay.x = ((button.width - iconOverlay.width) >> 1) + (iconXY.length > 0 ? iconXY[0] : 0);
                iconOverlay.y = ((button.height - iconOverlay.height) >> 1) + (iconXY.length > 0 ? iconXY[1] : 0);
                iconOverlay.interactive = false;
                button.addChild(iconOverlay);
            }
            return button;
        };
        MiscUtils.addToolTip = function (parentContainer, tooltipRef, element, name, text, x, y, fontSize, fontColor, bgColor, borderColor, borderThickness) {
            if (fontSize === void 0) { fontSize = 24; }
            if (fontColor === void 0) { fontColor = "#000000"; }
            if (bgColor === void 0) { bgColor = "#ffffff"; }
            if (borderColor === void 0) { borderColor = 0x161FD4; }
            if (borderThickness === void 0) { borderThickness = 2; }
            var txtElem = new rendering.Text(text);
            txtElem.font = "Myriad Pro Black";
            txtElem.fontSize = fontSize;
            txtElem.x = fontSize * 0.1;
            txtElem.y = fontSize * 0.2;
            txtElem.colour = fontColor;
            txtElem.lineHeight = fontSize + 10;
            txtElem.getNativeDisplayObject().interactive = false;
            txtElem.interactive = false;
            var back = new rendering.Graphics();
            back.beginFill(0xffffff, 1);
            back.lineStyle(borderThickness, borderColor, 1);
            back.drawRoundRect(0, 0, txtElem.width + (fontSize * 0.3), txtElem.height, 8);
            back.endFill();
            back.getNativeDisplayObject().interactive = false;
            back.interactive = false;
            tooltipRef[name] = new rendering.DisplayObjectContainer();
            tooltipRef[name].x = x;
            tooltipRef[name].y = y;
            tooltipRef[name].alpha = 0;
            tooltipRef[name]['requestTooltip'] = false;
            tooltipRef[name].getNativeDisplayObject().interactive = false;
            tooltipRef[name].getNativeDisplayObject().interactiveChildren = false;
            tooltipRef[name].addChild(back);
            tooltipRef[name].addChild(txtElem);
            parentContainer.addChild(tooltipRef[name]);
            element.getNativeDisplayObject().on("mouseover", function () {
                tooltipRef[name]['requestTooltip'] = true;
                TweenLite.delayedCall(0.5, function () {
                    if (tooltipRef[name]['requestTooltip']) {
                        tooltipRef[name].alpha = 1;
                    }
                });
            });
            element.getNativeDisplayObject().on("mouseout", function () {
                tooltipRef[name].alpha = 0;
                tooltipRef[name]['requestTooltip'] = false;
            });
        };
        MiscUtils.countOccurances = function (arr, elem) {
            var count = 0;
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] === elem) {
                    count++;
                }
            }
            return count;
        };
        return MiscUtils;
    }());
    Utils.MiscUtils = MiscUtils;
})(Utils || (Utils = {}));
var Utils;
(function (Utils) {
    (function (psLogLevel) {
        psLogLevel[psLogLevel["INFO"] = 0] = "INFO";
        psLogLevel[psLogLevel["WARN"] = 1] = "WARN";
        psLogLevel[psLogLevel["ERR"] = 2] = "ERR";
        psLogLevel[psLogLevel["BOLD"] = 3] = "BOLD";
    })(Utils.psLogLevel || (Utils.psLogLevel = {}));
    var psLogLevel = Utils.psLogLevel;
    var PSLog = (function () {
        function PSLog() {
        }
        PSLog.log = function (msg, level) {
            if (level === void 0) { level = psLogLevel.INFO; }
            if (PSLog.enabled) {
                level = level < psLogLevel.INFO ? psLogLevel.INFO : level;
                level = level > psLogLevel.BOLD ? psLogLevel.BOLD : level;
                var style = PSLog._styleLookup[level];
                var prefix = PSLog._prefixLookup[level];
                console.log("%c %s %s", style, prefix, msg);
            }
        };
        PSLog._styleLookup = [
            'background: beige; color: blue; font-size: 110%;',
            'background: chocolate; color: yellow; font-weight:bold; font-size: 150%;',
            'background: black; color: red; font-weight:bold; font-size: 200%;',
            'background: beige; color: black; font-size: 110%;font-weight:bold;' // BOLD
        ];
        PSLog._prefixLookup = [
            'Info:',
            'Warning:',
            'ERROR:',
            'Note:' // BOLD 
        ];
        PSLog.enabled = true;
        return PSLog;
    }());
    Utils.PSLog = PSLog;
})(Utils || (Utils = {}));
var game;
(function (game) {
    var StyledText = (function (_super) {
        __extends(StyledText, _super);
        function StyledText() {
            _super.apply(this, arguments);
            this._fontSize = 100;
            this._debug = false;
            this._maxWidth = 100;
            this._maxHeight = 50;
            this._textFillColour = "#ffffff";
            this._textStyle = "plain";
            this._dropShadow = false;
            this._outerOutlineSize = 0;
            this._outerOutlineColour = "#000000";
            this._label = "<UNDEFINED>";
        }
        Object.defineProperty(StyledText.prototype, "fontSize", {
            ///////////////////////////////////////
            // Public setters / getters
            // The font size to use for the text
            get: function () {
                return this._fontSize;
            },
            set: function (value) {
                this._fontSize = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "textStyle", {
            // The masked text colour as a string - "#ffffff" for e.g
            get: function () {
                return this._textStyle;
            },
            set: function (value) {
                this._textStyle = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "textColour", {
            // The masked text colour as a string - "#ffffff" for e.g
            get: function () {
                return this._textFillColour;
            },
            set: function (value) {
                this._textFillColour = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "outerOutlineSize", {
            // The outer outline size
            get: function () {
                return this._outerOutlineSize;
            },
            set: function (value) {
                this._outerOutlineSize = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "outerOutlineColour", {
            // The outer outline colour as a string "#ffffff" for e.g
            get: function () {
                return this._outerOutlineColour;
            },
            set: function (value) {
                this._outerOutlineColour = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "text", {
            get: function () {
                return this._label;
            },
            // The string to be rendered
            set: function (label) {
                this._label = label;
                if (this._text1) {
                    this._text1.text = label;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "maxWidth", {
            // The max rendering width
            get: function () {
                return this._maxWidth;
            },
            set: function (value) {
                this._maxWidth = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "maxHeight", {
            // The min rendering height
            get: function () {
                return this._maxHeight;
            },
            set: function (value) {
                this._maxHeight = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "dropShadow", {
            // Drop Shadow rendering
            get: function () {
                return this._dropShadow;
            },
            set: function (value) {
                this._dropShadow = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "debug", {
            // Debug rendering
            get: function () {
                return this._debug;
            },
            set: function (value) {
                this._debug = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "renderedWidth", {
            // The rendered width
            get: function () {
                return this._text1.width;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StyledText.prototype, "renderedHeight", {
            // The rendered height
            get: function () {
                return this._text1.height;
            },
            enumerable: true,
            configurable: true
        });
        /////////////////////////////////////////////////
        // General Public API
        // Construct based on current parameter settings
        StyledText.prototype.construct = function () {
            var font = "Myriad Pro Black";
            var widthAndHeight = [this._maxWidth, this._maxHeight];
            var bOffsetX = (this._outerOutlineSize / 4);
            var bOffsetY = (this._outerOutlineSize / 4);
            var cOffsetX = bOffsetX + (this._outerOutlineSize / 4);
            var cOffsetY = bOffsetY + (this._outerOutlineSize / 4);
            this._text1 = this.createText(this._label, font, this._fontSize, rendering.TextAlign.CENTER, this._maxWidth, this._maxHeight, 0, 0, this._textFillColour, this._outerOutlineColour, this._outerOutlineSize, this._dropShadow, this._textStyle, this._debug);
            this.addChild(this._text1);
        };
        StyledText.prototype.createText = function (label, font, fontSize, alignment, width, height, x, y, colour, outlineCol, outlineSize, dropShadow, type, debug) {
            // Drop Shadow control parameters
            var dropShadowBlur = 5;
            var dropShadowXOffset = 0;
            var dropShadowYOffset = 3;
            var txt = new rendering.Text(label);
            txt.scaleToWidth = width;
            txt.scaleToHeight = height;
            txt.fontSize = fontSize;
            txt.colour = colour;
            txt.font = font;
            txt.outlineColour = outlineCol;
            txt.outlineSize = outlineSize;
            txt.textAlign = alignment;
            txt.x = x;
            txt.y = y;
            //without scaleToWidth and scaleToHeight (see above), the debug property has no effect
            txt.debug = debug;
            txt.interactive = false;
            if (dropShadow) {
                new filters.DropShadowFilter(txt, "#000000", dropShadowBlur, dropShadowXOffset, dropShadowYOffset);
            }
            if (type == "gradient") {
                var point1 = new util.Point(0, 0);
                var point2 = new util.Point(0, txt.height);
                new filters.LinearGradientFilter(txt, ["#fcc027", "#f89412", "#fbd678", "#fbd86c"], [1, 0.55, 0.45, 0], point1, point2);
            }
            return txt;
        };
        return StyledText;
    }(rendering.DisplayObjectContainer));
    game.StyledText = StyledText;
})(game || (game = {}));
var game;
(function (game) {
    var TexturedText = (function (_super) {
        __extends(TexturedText, _super);
        function TexturedText() {
            _super.apply(this, arguments);
            this._fontSize = 100;
            this._debug = false;
            this._maxWidth = 100;
            this._maxHeight = 50;
            this._textColour = "#ffffff";
            this._outerOutlineSize = 16;
            this._innerOutlineSize = 8;
            this._outerOutlineColour = "#000000";
            this._innerOutlineColour = "#ff0c13";
            this._label = "<UNDEFINED>";
        }
        Object.defineProperty(TexturedText.prototype, "texture", {
            ///////////////////////////////////////
            // Public setters / getters
            // The bitmap to use as a texture
            get: function () {
                return this._texture;
            },
            set: function (value) {
                this._texture = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "fontSize", {
            // The font size to use for the text
            get: function () {
                return this._fontSize;
            },
            set: function (value) {
                this._fontSize = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "textColour", {
            // The masked text colour as a string - "#ffffff" for e.g
            get: function () {
                return this._textColour;
            },
            set: function (value) {
                this._textColour = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "outerOutlineSize", {
            // The outer outline size
            get: function () {
                return this._outerOutlineSize;
            },
            set: function (value) {
                this._outerOutlineSize = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "innerOutlineSize", {
            // The inner outline size
            get: function () {
                return this._innerOutlineSize;
            },
            set: function (value) {
                this._innerOutlineSize = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "outerOutlineColour", {
            // The outer outline colour as a string "#ffffff" for e.g
            get: function () {
                return this._outerOutlineColour;
            },
            set: function (value) {
                this._outerOutlineColour = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "innerOutlineColour", {
            // The inner outline colour as a string "#ffffff" for e.g
            get: function () {
                return this._innerOutlineColour;
            },
            set: function (value) {
                this._innerOutlineColour = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "text", {
            get: function () {
                return this._label;
            },
            // The string to be rendered
            set: function (label) {
                this._label = label;
                if (this._text1) {
                    this._text1.text = label;
                    this._text2.text = label;
                    this._text3.text = label;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "maxWidth", {
            // The max rendering width
            get: function () {
                return this._maxWidth;
            },
            set: function (value) {
                this._maxWidth = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "maxHeight", {
            // The min rendering height
            get: function () {
                return this._maxHeight;
            },
            set: function (value) {
                this._maxHeight = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "debug", {
            // Debug rendering
            get: function () {
                return this._debug;
            },
            set: function (value) {
                this._debug = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "renderedWidth", {
            // The rendered width
            get: function () {
                return this._text1.width;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TexturedText.prototype, "renderedHeight", {
            // The rendered height
            get: function () {
                return this._text1.height;
            },
            enumerable: true,
            configurable: true
        });
        /////////////////////////////////////////////////
        // General Public API
        // Construct based on current parameter settings
        TexturedText.prototype.construct = function () {
            var dropShadow = false;
            var font = "Myriad Pro Black";
            var widthAndHeight = [this._maxWidth, this._maxHeight];
            var bOffsetX = (this._outerOutlineSize / 4);
            var bOffsetY = (this._outerOutlineSize / 4);
            var cOffsetX = bOffsetX + (this._outerOutlineSize / 4);
            var cOffsetY = bOffsetY + (this._outerOutlineSize / 4);
            this._text1 = this.createText(this._label, font, this._fontSize, rendering.TextAlign.CENTER, this._maxWidth, this._maxHeight, 0, 0, "#ffffff", this._outerOutlineColour, this._outerOutlineSize, this._debug);
            this._text2 = this.createText(this._label, font, this._fontSize, rendering.TextAlign.CENTER, this._maxWidth, this._maxHeight, bOffsetX, bOffsetY, "#ffffff", this._innerOutlineColour, this._innerOutlineSize, this._debug);
            this.addChild(this._text1);
            this.addChild(this._text2);
            if (this._texture) {
                this._texture.scaleX = this.renderedWidth / this._texture.width;
                this._texture.scaleY = this.renderedHeight / this._texture.height;
                this.addChild(this._texture);
            }
            this._text3 = this.createText(this._label, font, this._fontSize, rendering.TextAlign.CENTER, this._maxWidth, this._maxHeight, cOffsetX, cOffsetY, this._textColour, "#000000", 0, this._debug);
            if (this._texture) {
                this._texture.getNativeDisplayObject().mask = this._text3.getNativeDisplayObject();
            }
            this.addChild(this._text3);
        };
        TexturedText.prototype.createText = function (label, font, fontSize, alignment, width, height, x, y, colour, outlineCol, outlineSize, debug) {
            var txt = new rendering.Text(label);
            txt.font = font;
            txt.fontSize = fontSize;
            txt.textAlign = alignment;
            txt.scaleToWidth = width;
            txt.scaleToHeight = height;
            txt.outlineSize = outlineSize;
            txt.outlineColour = outlineCol;
            txt.x = x == null ? 0 : x;
            txt.y = y == null ? 0 : y;
            txt.colour = colour == null ? "#ffffff" : colour;
            txt.wrapWidth = width;
            txt.lineHeight = fontSize + 10;
            txt.debug = debug;
            return txt;
        };
        return TexturedText;
    }(rendering.DisplayObjectContainer));
    game.TexturedText = TexturedText;
})(game || (game = {}));
var game;
(function (game) {
    var EventGateItem = (function () {
        function EventGateItem(eventName) {
            this._eventName = eventName;
            this._hasFired = false;
        }
        Object.defineProperty(EventGateItem.prototype, "hasFired", {
            get: function () {
                return this._hasFired;
            },
            set: function (value) {
                this._hasFired = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(EventGateItem.prototype, "eventName", {
            get: function () {
                return this._eventName;
            },
            enumerable: true,
            configurable: true
        });
        return EventGateItem;
    }());
    game.EventGateItem = EventGateItem;
    var EventGate = (function () {
        function EventGate(inputEvents, outputEvent) {
            this._gateItems = [];
            if (inputEvents.length == 0) {
                this.throwMsg("constructor", "Empty input event list");
            }
            if (!outputEvent) {
                this.throwMsg("constructor", "Empty output event");
            }
            this._outputEvent = outputEvent;
            this._cleared = false;
            for (var i = 0; i < inputEvents.length; ++i) {
                var inputEventName = inputEvents[i];
                if (inputEventName) {
                    var newItem = new EventGateItem(inputEventName);
                    this._gateItems.push(newItem);
                }
                else {
                    this.throwMsg("constructor", "undefined input event item");
                }
            }
        }
        Object.defineProperty(EventGate.prototype, "hasCleared", {
            get: function () {
                return this._cleared;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(EventGate.prototype, "outputEvent", {
            get: function () {
                return this._outputEvent;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(EventGate.prototype, "outputEventName", {
            get: function () {
                return this._outputEvent.eventName;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(EventGate.prototype, "items", {
            get: function () {
                return this._gateItems;
            },
            enumerable: true,
            configurable: true
        });
        // Update this gate to reflect the fact that the named event fired
        // Returns true if all input events on this gate have fired. False otherwise
        EventGate.prototype.eventFired = function (eventName) {
            var gateCleared = true;
            for (var i = 0; i < this._gateItems.length; ++i) {
                var item = this._gateItems[i];
                if (item.eventName === eventName) {
                    item.hasFired = true;
                }
                gateCleared = gateCleared && item.hasFired;
            }
            this._cleared = gateCleared;
            return this._cleared;
        };
        EventGate.prototype.throwMsg = function (methodName, msg) {
            var diagnostic = "EventGate::" + methodName + " - " + msg;
            throw diagnostic;
        };
        return EventGate;
    }());
    game.EventGate = EventGate;
    var EventGateListenerItem = (function () {
        function EventGateListenerItem(eventName) {
            this._listenerCount = 0;
            this._eventName = eventName;
            this._listenerCount = 1;
        }
        Object.defineProperty(EventGateListenerItem.prototype, "listenerCount", {
            get: function () {
                return this._listenerCount;
            },
            set: function (value) {
                this._listenerCount = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(EventGateListenerItem.prototype, "eventName", {
            get: function () {
                return this._eventName;
            },
            enumerable: true,
            configurable: true
        });
        return EventGateListenerItem;
    }());
    game.EventGateListenerItem = EventGateListenerItem;
    var AsyncEventHub = (function () {
        function AsyncEventHub() {
            this._listeners = [];
            this._eventGates = [];
        }
        /*
            inputEvents is an array of events to listen for
            trigger is a single event to fire once ALL of the inputEvents have occured
        */
        AsyncEventHub.prototype.addEventGate = function (inputEvents, outputEvent) {
            var index = this.indexOfEvent(outputEvent);
            if (index == -1) {
                Utils.PSLog.log("AsyncEventHub::addEventGate() - adding gate for output event: " + outputEvent.eventName);
                var newGate = new EventGate(inputEvents, outputEvent);
                this._eventGates.push(newGate);
                for (var j = 0; j < inputEvents.length; ++j) {
                    var newListener = new EventGateListenerItem(inputEvents[j]);
                    var listenerIndex = this.indexOfListener(newListener);
                    if (listenerIndex > -1) {
                        var existingListener = this._listeners[listenerIndex];
                        existingListener.listenerCount++;
                        Utils.PSLog.log("AsyncEventHub::addEventGate() - existing listener for input event: " + newListener.eventName + " - new count: " + existingListener.listenerCount);
                    }
                    else {
                        Utils.PSLog.log("AsyncEventHub::addEventGate() - adding new listener for input event: " + newListener.eventName);
                        this._listeners.push(newListener);
                        this._eventDispatcher.addEventListener(newListener.eventName, this.onInputEvent, this);
                    }
                }
            }
            else {
                this.throwMsg("addEventGate", "duplicates not permitted");
            }
        };
        Object.defineProperty(AsyncEventHub.prototype, "dispatcher", {
            set: function (dispatcher) {
                this._eventDispatcher = dispatcher;
            },
            enumerable: true,
            configurable: true
        });
        // On receiving an input event, update the hasFired flag of all
        // associated EventGateItems
        AsyncEventHub.prototype.onInputEvent = function (e) {
            Utils.PSLog.log("AsyncEventHub::onInputEvent() - received input event: " + e.eventName);
            for (var i = 0; i < this._eventGates.length; ++i) {
                var gate = this._eventGates[i];
                var gateCleared = gate.eventFired(e.eventName);
                if (gateCleared) {
                    var outputEvent = gate.outputEvent;
                    Utils.PSLog.log("AsyncEventHub::onInputEvent() - gate cleared for output event: " + outputEvent.eventName + ", dispatching...");
                    this._eventDispatcher.dispatchEvent(outputEvent);
                    // Update the internal event listeners
                    var listener = this.listenerForEventName(e.eventName);
                    listener.listenerCount--;
                    if (listener.listenerCount == 0) {
                        this.removeListener(listener);
                    }
                }
            }
            // Now remove any cleared gates
            this.removeClearedGates();
        };
        AsyncEventHub.prototype.removeClearedGates = function () {
            var updated = false;
            var remainingGates = [];
            for (var i = 0; i < this._eventGates.length; ++i) {
                var gate = this._eventGates[i];
                if (gate.hasCleared) {
                    // Update listeners for previously fired events that *may* now have cleared
                    for (var j = 0; j < gate.items.length; ++j) {
                        var gateItem = gate.items[j];
                        var listener = this.listenerForEventName(gateItem.eventName);
                        if (listener) {
                            listener.listenerCount--;
                            if (listener.listenerCount == 0) {
                                this.removeListener(listener);
                            }
                        }
                    }
                    updated = true;
                    Utils.PSLog.log("AsyncEventHub::removeClearedGates() - removing gate for output event: " + gate.outputEventName);
                }
                else {
                    remainingGates.push(gate);
                }
            }
            this._eventGates = remainingGates;
            if (updated) {
                Utils.PSLog.log("AsyncEventHub::removeClearedGates() - UPDATED: gates remaining: " + this._eventGates.length);
            }
        };
        AsyncEventHub.prototype.removeListener = function (listener) {
            this._eventDispatcher.removeEventListener(listener.eventName, this.onInputEvent, this);
            var idx = this.indexOfListener(listener);
            if (idx > -1) {
                Utils.PSLog.log("AsyncEventHub::removeListener() - removing listener for input event: " + listener.eventName);
                this._listeners.splice(idx, 1);
            }
            else {
                Utils.PSLog.log("AsyncEventHub::removeListener() - FAILED TO FIND listener for input event: " + listener.eventName);
            }
            Utils.PSLog.log("AsyncEventHub::removeListener() - " + this._listeners.length + " listeners remaining");
        };
        AsyncEventHub.prototype.indexOfEvent = function (e) {
            var result = -1;
            for (var i = 0; i < this._eventGates.length; ++i) {
                var gate = this._eventGates[i];
                if (gate.outputEventName === e.eventName) {
                    result = i;
                    break;
                }
            }
            return result;
        };
        AsyncEventHub.prototype.listenerForEventName = function (name) {
            var result;
            for (var i = 0; i < this._listeners.length; ++i) {
                var stashedListener = this._listeners[i];
                if (stashedListener.eventName === name) {
                    result = stashedListener;
                    break;
                }
            }
            return result;
        };
        AsyncEventHub.prototype.indexOfListener = function (listener) {
            var result = -1;
            for (var i = 0; i < this._listeners.length; ++i) {
                var stashedListener = this._listeners[i];
                if (stashedListener.eventName === listener.eventName) {
                    result = i;
                    break;
                }
            }
            return result;
        };
        AsyncEventHub.prototype.throwMsg = function (methodName, msg) {
            var diagnostic = "AsyncEventHub::" + methodName + " - " + msg;
            throw diagnostic;
        };
        return AsyncEventHub;
    }());
    game.AsyncEventHub = AsyncEventHub;
})(game || (game = {}));
var game;
(function (game) {
    var AutoPlayModelEvent = (function (_super) {
        __extends(AutoPlayModelEvent, _super);
        function AutoPlayModelEvent(type, count) {
            _super.call(this, type);
            this._count = count;
        }
        Object.defineProperty(AutoPlayModelEvent.prototype, "count", {
            get: function () {
                return this._count;
            },
            enumerable: true,
            configurable: true
        });
        AutoPlayModelEvent.INITIALISED = "AutoPlayModelEvent_INITIALISED";
        AutoPlayModelEvent.STARTED = "AutoPlayModelEvent_STARTED";
        AutoPlayModelEvent.STOPPED = "AutoPlayModelEvent_STOPPED";
        AutoPlayModelEvent.NEXT = "AutoPlayModelEvent_NEXT";
        AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED = "AutoPlayModelEvent_STOP_AUTOPLAY_BUTTON_PRESSED";
        return AutoPlayModelEvent;
    }(dragonwings.Event));
    game.AutoPlayModelEvent = AutoPlayModelEvent;
    var AutoPlayModel = (function () {
        function AutoPlayModel() {
            // NEW AUTOPLAY VARS
            this._autoplayManager = new util.AutoplayManager();
            this._isEnabled = false;
            this._numSpins = 0;
            this._inProgress = false;
            this._paused = false;
            this._doNextOnResume = false;
            this._autoplayManager = new util.AutoplayManager();
        }
        Object.defineProperty(AutoPlayModel.prototype, "eventDispatcher", {
            get: function () {
                return this._eventDispatcher;
            },
            set: function (value) {
                this._eventDispatcher = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(AutoPlayModel.prototype, "numSpins", {
            get: function () {
                return this._numSpins;
            },
            enumerable: true,
            configurable: true
        });
        AutoPlayModel.prototype.setManager = function (manager) {
            this._autoplayManager = manager;
        };
        AutoPlayModel.prototype.isEnabled = function () {
            return this._isEnabled;
        };
        AutoPlayModel.prototype.isInProgress = function () {
            return this._inProgress;
        };
        AutoPlayModel.prototype.init = function (stake, balance) {
            var _this = this;
            this._autoplayManager.initPartnerAutoplay(stake, balance, function (isEnabled) {
                _this.initCallback(isEnabled);
            });
        };
        AutoPlayModel.prototype.launch = function (stake, balance) {
            var _this = this;
            Utils.PSLog.log("Launching Autoplay: stake-" + stake + " balance-" + balance);
            this._autoplayManager.launchPartnerAutoplay(stake, balance, function (isEnabled) {
                _this.launchCallback(isEnabled);
            });
        };
        AutoPlayModel.prototype.start = function (numSpins) {
            //The spin itself will be started by StartAutoplayCmd triggering this and doNextAutoplay()
            //StartAutoplayCmd is triggered by ExternalEvent.START_AUTOPLAY from Main.ts.startAutoplay()
            //Main.ts.startAutoplay is triggered by <name>.game.js, which is in turn triggered by the Autoplay interface
            Utils.PSLog.log("Starting Autoplay: " + numSpins);
            this._numSpins = numSpins;
            this._inProgress = true;
            this._eventDispatcher.dispatchEvent(new AutoPlayModelEvent(AutoPlayModelEvent.STARTED, this._numSpins));
            return this;
        };
        AutoPlayModel.prototype.stop = function () {
            Utils.PSLog.log("zero-ing numSpins");
            this._numSpins = 0;
            this._inProgress = false;
            this._paused = false;
            this._doNextOnResume = false;
            this._eventDispatcher.dispatchEvent(new AutoPlayModelEvent(AutoPlayModelEvent.STOPPED, this._numSpins));
            return this;
        };
        AutoPlayModel.prototype.pause = function () {
            this._paused = true;
        };
        AutoPlayModel.prototype.resume = function () {
            this._paused = false;
            if (this._doNextOnResume) {
                this._doNextOnResume = false;
                this.doNextAutoplay();
            }
        };
        AutoPlayModel.prototype.doNextAutoplay = function () {
            var done = false;
            if (this._paused) {
                this._doNextOnResume = true;
            }
            else {
                Utils.PSLog.log("doNextAutoplay: " + this._numSpins);
                if (this._numSpins > 0) {
                    this._numSpins--;
                    done = true;
                    this._autoplayManager.updateAutoPlayStatus(util.AutoplayStatus.IN_PROGRESS, this._numSpins);
                    this._eventDispatcher.dispatchEvent(new AutoPlayModelEvent(AutoPlayModelEvent.NEXT, this._numSpins));
                }
                else {
                    this.stop();
                    this._inProgress = false;
                    this._autoplayManager.updateAutoPlayStatus(util.AutoplayStatus.FINISHED, this._numSpins);
                }
            }
            return done;
        };
        AutoPlayModel.prototype.updateWinAndStake = function (win, stake) {
            this._autoplayManager.updateWinAndStake(win, stake);
            // console.info(" - win: " + win + ", stake: " + stake);
        };
        AutoPlayModel.prototype.initCallback = function (isEnabled) {
            // console.info("initCallback:", isEnabled);
            this._isEnabled = isEnabled;
            this._eventDispatcher.dispatchEvent(new AutoPlayModelEvent(AutoPlayModelEvent.INITIALISED, 0));
        };
        AutoPlayModel.prototype.launchCallback = function (isEnabled) {
            // console.info("launchCallback:", isEnabled);
        };
        return AutoPlayModel;
    }());
    game.AutoPlayModel = AutoPlayModel;
})(game || (game = {}));
var game;
(function (game) {
    var BGRecoveryInfoParser = (function () {
        function BGRecoveryInfoParser() {
        }
        BGRecoveryInfoParser.prototype.parse = function (input, logicResponseObject) {
            var bgRecoveryNode = input.getElementsByTagName("BaseGameRecoveryInfo")[0];
            if (bgRecoveryNode) {
                var reelResultsNode = bgRecoveryNode.childNodes[0];
                var reelSpinRecoveryNode = reelResultsNode.childNodes[0];
                logicResponseObject.bgRecoveryInfo = {
                    spinIndex: parseInt(reelSpinRecoveryNode.attributes.getNamedItem("spinIndex").value),
                    reelsetIndex: parseInt(reelSpinRecoveryNode.attributes.getNamedItem("reelsetIndex").value),
                    cascadeCount: parseInt(reelSpinRecoveryNode.attributes.getNamedItem("cascadeCount").value),
                    winCountPL: parseInt(reelSpinRecoveryNode.attributes.getNamedItem("winCountPL").value),
                    winCountSC: parseInt(reelSpinRecoveryNode.attributes.getNamedItem("winCountSC").value)
                };
            }
        };
        return BGRecoveryInfoParser;
    }());
    game.BGRecoveryInfoParser = BGRecoveryInfoParser;
})(game || (game = {}));
var game;
(function (game) {
    var CyclersModelEvent = (function (_super) {
        __extends(CyclersModelEvent, _super);
        function CyclersModelEvent(type, result) {
            if (result === void 0) { result = null; }
            _super.call(this, type);
            this.result = result;
        }
        // public static PAYLINES_COMPLETE: string = "CyclersModelEvent_PAYLINES_COMPLETE";
        CyclersModelEvent.PAYLINES_DISPLAY = "CyclersModelEvent_PAYLINES_DISPLAY";
        CyclersModelEvent.PAYLINES_CYCLER_STARTED = "CyclersModelEvent_PAYLINES_CYCLER_STARTED";
        CyclersModelEvent.PAYLINES_CYCLER_STOPPED = "CyclersModelEvent_PAYLINES_CYCLER_STOPPED";
        CyclersModelEvent.PAYLINES_CYCLER_COMPLETE = "CyclersModelEvent_PAYLINES_CYCLER_COMPLETE";
        return CyclersModelEvent;
    }(borgevent.Event));
    game.CyclersModelEvent = CyclersModelEvent;
    var CyclersModel = (function () {
        function CyclersModel() {
        }
        CyclersModel.prototype.setPaylineDisplay = function (paylineDisplay) {
            this._paylineDisplay = paylineDisplay;
        };
        CyclersModel.prototype.getPaylineDisplay = function () {
            return this._paylineDisplay;
        };
        CyclersModel.prototype.setPaylineCyclers = function (singleBlinkCycler, doubleBlinkCycler) {
            this._paylinesCyclerSingleBlink = singleBlinkCycler;
            this._paylinesCyclerDoubleBlink = doubleBlinkCycler;
            this._paylinesCycler = doubleBlinkCycler;
            this._paylinesCyclerSingleBlink.addEventListener(components.CyclerEvent.ON_DISPLAY, this.onPaylineDisplay, this);
            this._paylinesCyclerSingleBlink.addEventListener(components.CyclerEvent.ON_COMPLETE, this.onCycleComplete, this);
            this._paylinesCyclerDoubleBlink.addEventListener(components.CyclerEvent.ON_DISPLAY, this.onPaylineDisplay, this);
            this._paylinesCyclerDoubleBlink.addEventListener(components.CyclerEvent.ON_COMPLETE, this.onCycleComplete, this);
        };
        Object.defineProperty(CyclersModel.prototype, "paylinesCycler", {
            get: function () {
                return this._paylinesCycler;
            },
            enumerable: true,
            configurable: true
        });
        CyclersModel.prototype.showSpaghetti = function () {
            var logicResponse = this._server.getLogicResponse();
            var results = logicResponse.reelSpinData[0].paylineWins;
            var cycleResults = [];
            this._activeSpaghetti = this._paylinesCycler.getPaylineDisplay();
            var kLineParts = [components.PaylinePart.Line, components.PaylinePart.Line,
                components.PaylinePart.Line, components.PaylinePart.Line, components.PaylinePart.Line];
            var winLines = [];
            var lineParts = [];
            for (var idx = 0; idx < results.length; ++idx) {
                winLines.push(results[idx].index);
                lineParts.push(kLineParts);
            }
            Utils.PSLog.log("CyclersModel::showSpaghetti() - win lines: " + winLines);
            this._activeSpaghetti.showLines(winLines, lineParts, false);
        };
        CyclersModel.prototype.hideSpaghetti = function () {
            this._activeSpaghetti.hide();
        };
        CyclersModel.prototype.startCyclers = function () {
            if (this._paylinesCycler) {
                if (this._fsModel.isInProgress() || this._asModel.isInProgress()) {
                    this._paylinesCycler = this._paylinesCyclerSingleBlink;
                }
                else {
                    this._paylinesCycler = this._paylinesCyclerDoubleBlink;
                }
                var initResponse = this._server.getInitResponse();
                if (!this._winInfoModel.isEmpty) {
                    var paylinesForThisCycle = this._winInfoModel.getWinDataForCurrentCycle().paylineWins;
                    var cycleResults = [];
                    Utils.PSLog.log("CyclersModel::startCyclers()");
                    for (var i = 0; i < paylinesForThisCycle.length; i++) {
                        var paylineResult = paylinesForThisCycle[i];
                        var paylineIndex = paylinesForThisCycle[i].index;
                        Utils.PSLog.log("CyclersModel::startCyclers() : index: " + paylineResult.index + " Positions: " + paylineResult.reelPositions);
                        var awardTableIdx = paylineResult.awardTableIndex;
                        var awardTable = initResponse.awardsData[awardTableIdx].awards;
                        var symbolID = awardTable[paylineResult.awardIndex].id;
                        var symbolLayout = this.getLayout(paylineResult.reelPositions);
                        var cycleResult = {
                            payline: paylineIndex,
                            winAmount: paylineResult.winVal,
                            multiplier: 1,
                            scatter: false,
                            layout: symbolLayout,
                            symbolId: symbolID,
                            clear: true
                        };
                        cycleResults.push(cycleResult);
                    }
                    this._paylinesCycler.start(cycleResults);
                    this._eventDispatcher.dispatchEvent(new CyclersModelEvent(CyclersModelEvent.PAYLINES_CYCLER_STARTED));
                }
            }
        };
        CyclersModel.prototype.onPaylineDisplay = function (e) {
            this._eventDispatcher.dispatchEvent(new CyclersModelEvent(CyclersModelEvent.PAYLINES_DISPLAY, e.result));
        };
        CyclersModel.prototype.stopCyclers = function () {
            if (this._stateModel.currentSubgameState === "showingWins" && this._paylinesCycler && !this._winInfoModel.hasSkippedLastPayLines) {
                this._winInfoModel.hasSkippedLastPayLines = true;
                this._paylinesCycler.stop();
                this._eventDispatcher.dispatchEvent(new CyclersModelEvent(CyclersModelEvent.PAYLINES_CYCLER_STOPPED));
                this._eventDispatcher.dispatchEvent(new CyclersModelEvent(CyclersModelEvent.PAYLINES_CYCLER_COMPLETE));
            }
        };
        CyclersModel.prototype.onCycleComplete = function () {
            if (this._paylinesCycler.getCurrentCycle() === this._paylinesCycler.getCycles()) {
                this._eventDispatcher.dispatchEvent(new CyclersModelEvent(CyclersModelEvent.PAYLINES_CYCLER_COMPLETE));
            }
        };
        CyclersModel.prototype.getLayout = function (offsets) {
            var positions = [];
            for (var i = 0; i < offsets.length; i++) {
                positions[offsets[i] % 5] = Math.floor(offsets[i] / 5);
            }
            Utils.PSLog.log("CyclersModel::startCyclers() - Positions: " + positions);
            return positions;
        };
        CyclersModel.kPaylineDisplayTime = 4;
        __decorate([
            inject('IEventDispatcher')
        ], CyclersModel.prototype, "_eventDispatcher", void 0);
        __decorate([
            inject('GameServer')
        ], CyclersModel.prototype, "_server", void 0);
        __decorate([
            inject('GameStateModel')
        ], CyclersModel.prototype, "_stateModel", void 0);
        __decorate([
            inject('WinInfoModel')
        ], CyclersModel.prototype, "_winInfoModel", void 0);
        __decorate([
            inject('ReelsView')
        ], CyclersModel.prototype, "_reelsView", void 0);
        __decorate([
            inject('AutoPlayModel')
        ], CyclersModel.prototype, "_asModel", void 0);
        __decorate([
            inject('FreeSpinsGameModel')
        ], CyclersModel.prototype, "_fsModel", void 0);
        return CyclersModel;
    }());
    game.CyclersModel = CyclersModel;
})(game || (game = {}));
var game;
(function (game) {
    var DeviceContextModel = (function (_super) {
        __extends(DeviceContextModel, _super);
        function DeviceContextModel(url) {
            // First array is DESKTOP supported dimensions
            var dimensions = new util.FixedDimensions([
                new util.Resolution(1920, 1080)
            ], 
            // 2nd array is MOBILE
            [
                //new util.Resolution(1920, 1080),
                new util.Resolution(1248, 702),
                new util.Resolution(960, 540)
            ]);
            if (url.queryData('resolution')) {
                var parts = url.queryData('resolution').split("x");
                var resolution = new util.Resolution(parseInt(parts[0]), parseInt(parts[1]));
                dimensions = new util.FixedDimensions([resolution], [resolution]);
            }
            _super.call(this, dimensions, 1920, 1080);
        }
        return DeviceContextModel;
    }(util.DeviceContext));
    game.DeviceContextModel = DeviceContextModel;
})(game || (game = {}));
var game;
(function (game) {
    var DragonWingify = (function () {
        function DragonWingify() {
        }
        DragonWingify.prototype.makeEventsGlobal = function (dispatcher) {
            DragonWingify.makeEventsGlobal(dispatcher, this._eventDispatcher);
        };
        DragonWingify.makeEventsGlobal = function (dispatcher, eventDispatcher) {
            var oldFunction = dispatcher.dispatchEvent;
            dispatcher.dispatchEvent = function (e) {
                oldFunction.apply(dispatcher, [e]);
                eventDispatcher.dispatchEvent(e);
            };
        };
        DragonWingify.prototype.doGlobalDispatch = function (e) {
            this._eventDispatcher.dispatchEvent(e);
        };
        __decorate([
            inject('IEventDispatcher')
        ], DragonWingify.prototype, "_eventDispatcher", void 0);
        return DragonWingify;
    }());
    game.DragonWingify = DragonWingify;
})(game || (game = {}));
var game;
(function (game) {
    var EventStack = (function () {
        function EventStack(eventDispatcher, hub, inputEventStack, outputEvent, count, resetEvent) {
            this._inputEventStack = {};
            this._hub = hub;
            this._count = count;
            this._outputEvent = outputEvent;
            this._resetEvent = resetEvent;
            this._eventDispatcher = eventDispatcher;
            this.registerListeners(inputEventStack);
        }
        EventStack.prototype.registerListeners = function (inputEventStack) {
            for (var e = 0; e < inputEventStack.length; e++) {
                this._inputEventStack[inputEventStack[e]] = false;
                this._eventDispatcher.addEventListener(inputEventStack[e], this.onInputEventReceived, this);
            }
            if (this._resetEvent !== null) {
                this.registerResetListener();
            }
        };
        EventStack.prototype.unregisterListeners = function () {
            for (var e in this._inputEventStack) {
                this._inputEventStack[e] = false;
                this._eventDispatcher.removeEventListener(e, this.onInputEventReceived, this);
            }
            if (this._resetEvent !== null) {
                this.unRegisterResetListener();
            }
        };
        EventStack.prototype.registerResetListener = function () {
            this._eventDispatcher.addEventListener(this._resetEvent, this.resetListeners, this);
        };
        EventStack.prototype.unRegisterResetListener = function () {
            this._eventDispatcher.removeEventListener(this._resetEvent, this.resetListeners, this);
        };
        EventStack.prototype.resetListeners = function (evt) {
            for (var e in this._inputEventStack) {
                this._inputEventStack[e] = false;
            }
        };
        EventStack.prototype.onInputEventReceived = function (evt) {
            this._inputEventStack[evt.eventName] = true;
            console.info("EventStackHub.onInputEventReceived()", evt);
            this.checkStackComplete();
        };
        EventStack.prototype.checkStackComplete = function () {
            var fired = 0;
            for (var e in this._inputEventStack) {
                if (this._inputEventStack[e] === true) {
                    fired++;
                }
            }
            if (fired === Object.keys(this._inputEventStack).length) {
                this._count--;
                this._eventDispatcher.dispatchEvent(this._outputEvent);
                if (this._count <= 0) {
                    this.unregisterListeners();
                    this._hub.notifyComplete(this);
                }
                else {
                    this.resetListeners();
                }
            }
        };
        return EventStack;
    }());
    game.EventStack = EventStack;
    var EventStackHub = (function () {
        function EventStackHub(eventDispatcher) {
            this._eventStacks = [];
            this._eventDispatcher = eventDispatcher;
        }
        EventStackHub.prototype.addEventStackListener = function (eventDispatcher, inputEventStack, outputEvent, count, resetEvent) {
            if (count === void 0) { count = 1; }
            this._eventStacks.push(new EventStack(eventDispatcher, this, inputEventStack, outputEvent, count, resetEvent));
        };
        EventStackHub.prototype.notifyComplete = function (eventStack) {
            var index = this._eventStacks.indexOf(eventStack);
            this._eventStacks.splice(index, 1);
        };
        return EventStackHub;
    }());
    game.EventStackHub = EventStackHub;
})(game || (game = {}));
var game;
(function (game) {
    var ForceModelEvent = (function (_super) {
        __extends(ForceModelEvent, _super);
        function ForceModelEvent(eventName) {
            _super.call(this, eventName);
        }
        ForceModelEvent.FORCE_MODEL_CHANGED = "ForceModelEvent_FORCE_MODEL_OPENED";
        ForceModelEvent.FORCE_ENABLED = "ForceModelEvent_FORCE_ENABLED";
        ForceModelEvent.FORCE_DISABLED = "ForceModelEvent_FORCE_DISABLED";
        return ForceModelEvent;
    }(borgevent.Event));
    game.ForceModelEvent = ForceModelEvent;
    var ForceModel = (function () {
        function ForceModel() {
            this._enabled = false;
            this._index = 0;
            this._positions = [1, 1, 1, 1, 1];
        }
        Object.defineProperty(ForceModel.prototype, "eventListener", {
            get: function () {
                return this._eventListener;
            },
            set: function (value) {
                this._eventListener = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ForceModel.prototype, "positions", {
            get: function () {
                return this._positions;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ForceModel.prototype, "isEnabled", {
            get: function () {
                return this._enabled;
            },
            enumerable: true,
            configurable: true
        });
        ForceModel.prototype.setPositions = function (positions, shouldSendChangedEvent) {
            if (shouldSendChangedEvent === void 0) { shouldSendChangedEvent = false; }
            this._positions = positions;
            if (shouldSendChangedEvent) {
                this._eventListener.dispatchEvent(new ForceModelEvent(ForceModelEvent.FORCE_MODEL_CHANGED));
            }
        };
        ForceModel.prototype.setEnabled = function (enable, shouldSendChangedEvent) {
            if (enable === void 0) { enable = false; }
            if (shouldSendChangedEvent === void 0) { shouldSendChangedEvent = false; }
            this._enabled = enable;
            if (this._enabled) {
                this._eventListener.dispatchEvent(new ForceModelEvent(ForceModelEvent.FORCE_ENABLED));
            }
            else {
                this._eventListener.dispatchEvent(new ForceModelEvent(ForceModelEvent.FORCE_DISABLED));
            }
            if (shouldSendChangedEvent) {
                this._eventListener.dispatchEvent(new ForceModelEvent(ForceModelEvent.FORCE_MODEL_CHANGED));
            }
        };
        Object.defineProperty(ForceModel.prototype, "reelsetIndex", {
            get: function () {
                return this._index;
            },
            set: function (index) {
                this._index = index;
            },
            enumerable: true,
            configurable: true
        });
        return ForceModel;
    }());
    game.ForceModel = ForceModel;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsGameModel = (function () {
        function FreeSpinsGameModel() {
            this._previousRunningTotalWinnings = 0;
            this._currentRunningTotalWinnings = 0;
            this._inProgress = false;
        }
        FreeSpinsGameModel.prototype.setNumberOfFreeSpins = function (freeSpinsRemaining) {
            this._freeSpinsRemaining = freeSpinsRemaining;
            this._eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.FREE_SPIN_COUNT_UPDATED, this, this._freeSpinsRemaining));
            // console.log('free spins game model - set number of free spins', this._freeSpinsRemaining);
        };
        FreeSpinsGameModel.prototype.isInProgress = function () {
            return this._inProgress;
        };
        Object.defineProperty(FreeSpinsGameModel.prototype, "numberOfSpinsRemaining", {
            get: function () {
                return this._freeSpinsRemaining;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FreeSpinsGameModel.prototype, "currentRunningTotalWinnings", {
            get: function () {
                return this._currentRunningTotalWinnings;
            },
            enumerable: true,
            configurable: true
        });
        FreeSpinsGameModel.prototype.decrementFreeSpinCount = function () {
            this.setNumberOfFreeSpins(--this._freeSpinsRemaining);
        };
        FreeSpinsGameModel.prototype.reset = function () {
            this.setNumberOfFreeSpins(0);
            this.setTotalWinningsFromFreeSpins(0);
            this._inProgress = false;
        };
        FreeSpinsGameModel.prototype.activate = function () {
            this._inProgress = true;
        };
        FreeSpinsGameModel.prototype.setTotalWinningsFromFreeSpins = function (totalWinningsFromFreeSpins) {
            this._totalWinningsFromFreeSpins = totalWinningsFromFreeSpins;
            this._eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.TOTAL_WINNINGS_FROM_FREE_SPINS_UPDATED, this, this._totalWinningsFromFreeSpins));
            // console.info("setTotalWinningsFromFreeSpins", totalWinningsFromFreeSpins);
        };
        __decorate([
            inject('IEventDispatcher')
        ], FreeSpinsGameModel.prototype, "_eventDispatcher", void 0);
        return FreeSpinsGameModel;
    }());
    game.FreeSpinsGameModel = FreeSpinsGameModel;
})(game || (game = {}));
var game;
(function (game) {
    /*
     Singleton class to act as a central store for "gameplay" related buttons
     so that we avoid lots of mediators acting in much the same way but in
     multiple locations and responding to all sorts of events and state changes.

     The core "gameplay" buttons generally act in a similar fashion - all enabled
     when the game is idle (subject to additional constraints) and all disabled
     once the reels are spinning and the game is in motion.
     */
    var GameButtonGroup = (function () {
        function GameButtonGroup() {
            // For stage loading purposes help and big bet buttons may be pressed
            // before assets are loaded. If so, we temporarily show the loading screen
            // again until the assets are ready
            this._showHelpPending = false;
            this._lastSpinTime = 0;
            this._groupEnabled = true;
            this._groupVisible = true;
        }
        Object.defineProperty(GameButtonGroup.prototype, "eventDispatcher", {
            // Public API
            set: function (value) {
                this._eventDispatcher = value;
            },
            enumerable: true,
            configurable: true
        });
        GameButtonGroup.prototype.setGroupVisible = function (visible) {
            if (this._spinButton) {
                this._spinButton.visible = visible;
            }
            if (this._autoplayButton) {
                this._autoplayButton.visible = visible && this._autoplayModel.isEnabled();
            }
            if (this._helpButton) {
                this._helpButton.visible = visible;
            }
            if (this._stakeUpButton) {
                this._stakeUpButton.visible = visible;
            }
            if (this._stakeDownButton) {
                this._stakeDownButton.visible = visible;
            }
            if (this._mobileLinesButton) {
                this._mobileLinesButton.visible = visible;
            }
            if (this._mobileStakeButton) {
                this._mobileStakeButton.visible = visible;
            }
        };
        GameButtonGroup.prototype.setGroupEnabled = function (enable) {
            if (this._spinButton) {
                var nowTm = (new Date()).getTime();
                if (enable && this._lastSpinTime > 0 && nowTm - this._lastSpinTime < GameButtonGroup.SPIN_ALLOWED_INTERVAL) {
                    var timeLeft = GameButtonGroup.SPIN_ALLOWED_INTERVAL - (nowTm - this._lastSpinTime);
                    var self = this;
                    if (this._spinButtonEnableDelay) {
                        clearTimeout(this._spinButtonEnableDelay);
                    }
                    Utils.PSLog.log("setting timeout of " + timeLeft + " to enable spin button");
                    this._spinButtonEnableDelay = setTimeout(function () {
                        self._spinButton.enabled = enable;
                        if (enable) {
                            Utils.PSLog.log("spin button enabled after timeout");
                        }
                        else {
                            Utils.PSLog.log("spin button disabled after timeout");
                        }
                        this._spinButtonEnableDelay = false;
                    }, timeLeft);
                }
                else {
                    if (enable) {
                        Utils.PSLog.log("spin button enabled normally");
                    }
                    else {
                        Utils.PSLog.log("spin button disabled normally");
                    }
                    this._spinButton.enabled = enable;
                }
            }
            if (this._autoplayButton) {
                this._autoplayButton.enabled = enable && this._autoplayModel.isEnabled();
            }
            if (this._helpButton) {
                this._helpButton.enabled = enable;
            }
            if (this._stakeDownButton) {
                this._stakeDownButton.enabled = !this._stakeModel.isMinStake() && !this._autoplayModel.isInProgress() && enable;
            }
            if (this._stakeUpButton) {
                this._stakeUpButton.enabled = !this._stakeModel.isMaxStake() && !this._autoplayModel.isInProgress() && enable;
            }
            if (this._mobileLinesButton) {
                this._mobileLinesButton.enabled = !this._autoplayModel.isInProgress() && enable;
            }
            if (this._mobileStakeButton) {
                this._mobileStakeButton.enabled = !this._autoplayModel.isInProgress() && enable;
            }
        };
        Object.defineProperty(GameButtonGroup.prototype, "groupEnabled", {
            get: function () {
                return this._groupEnabled;
            },
            set: function (enable) {
                this._groupEnabled = enable;
                this.setGroupEnabled(enable);
            },
            enumerable: true,
            configurable: true
        });
        GameButtonGroup.prototype.setButtonVisibility = function (buttonName, isVisible) {
            if (this["_" + buttonName]) {
                this["_" + buttonName].visible = isVisible;
            }
        };
        Object.defineProperty(GameButtonGroup.prototype, "spinButton", {
            get: function () {
                return this._spinButton;
            },
            // Accessors
            // Spin Button
            set: function (button) {
                this._spinButton = button;
                rendering.InputManager.registerObject(this._spinButton);
                this._spinButton.addEventListener(rendering.InputEvent.DOWN, this.onSpinButtonDown, this);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameButtonGroup.prototype, "autoplayButton", {
            get: function () {
                return this._autoplayButton;
            },
            // Autoplay Button
            set: function (button) {
                this._autoplayButton = button;
                rendering.InputManager.registerObject(this._autoplayButton);
                this._autoplayButton.addEventListener(rendering.InputEvent.DOWN, this.onAutoplayButtonDown, this);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameButtonGroup.prototype, "helpButton", {
            get: function () {
                return this._helpButton;
            },
            // Help Button
            set: function (button) {
                this._helpButton = button;
                rendering.InputManager.registerObject(this._helpButton);
                this._helpButton.addEventListener(rendering.InputEvent.DOWN, this.onHelpButtonDown, this);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameButtonGroup.prototype, "stakeUpButton", {
            get: function () {
                return this._stakeUpButton;
            },
            // Stake Up Button
            set: function (button) {
                this._stakeUpButton = button;
                rendering.InputManager.registerObject(this._stakeUpButton);
                this._stakeUpButton.addEventListener(game.AutoRepeatButtonEvent.DOWN, this.onStakeUpButtonDown, this);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameButtonGroup.prototype, "stakeDownButton", {
            get: function () {
                return this._stakeDownButton;
            },
            // Stake Down Button
            set: function (button) {
                this._stakeDownButton = button;
                rendering.InputManager.registerObject(this._stakeDownButton);
                this._stakeDownButton.addEventListener(game.AutoRepeatButtonEvent.DOWN, this.onStakeDownButtonDown, this);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameButtonGroup.prototype, "mobileNumLinesButton", {
            get: function () {
                return this._mobileLinesButton;
            },
            // Mobile number of lines Button
            set: function (button) {
                this._mobileLinesButton = button;
                rendering.InputManager.registerObject(this._mobileLinesButton);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameButtonGroup.prototype, "mobileStakeButton", {
            get: function () {
                return this._mobileStakeButton;
            },
            // Mobile bet / line button
            set: function (button) {
                this._mobileStakeButton = button;
                rendering.InputManager.registerObject(this._mobileStakeButton);
            },
            enumerable: true,
            configurable: true
        });
        GameButtonGroup.prototype.onHelpUIReady = function () {
            if (this._showHelpPending) {
                this.showHelp();
            }
        };
        GameButtonGroup.prototype.dispatchEvent = function (e) {
            if (this._eventDispatcher) {
                this._eventDispatcher.dispatchEvent(e);
            }
            else {
                throw "No event dispatcher";
            }
        };
        /////////////////////////////////////////////////////
        // Button event handlers
        GameButtonGroup.prototype.onSpinButtonDown = function (e) {
            if (this._spinButton.enabled) {
                this._lastSpinTime = (new Date()).getTime();
                Utils.PSLog.log("GameButtonGroup::onSpinButtonDown()");
                this.setGroupEnabled(false);
                //this.context.parent.eventDispatcher.dispatchEvent(e);
                this.dispatchEvent(new game.GameEvent(game.GameEvent.SPIN_BUTTON_PRESSED, this));
                this.dispatchEvent(new game.GameEvent(game.GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY, this));
                this.buttonPressed();
            }
        };
        GameButtonGroup.prototype.onAutoplayButtonDown = function (e) {
            if ((this._autoplayButton.enabled) && (this._autoplayModel.isEnabled())) {
                Utils.PSLog.log("GameButtonGroup::onAutoplayButtonDown()");
                // NOTE: We don't disable the buttons because there doesn't appear
                // to be a way to detect cancelling of the autoplay popup to re-enable
                // them. Instead we rely on them not responding because the popup has focus
                this.dispatchEvent(new game.GameEvent(game.GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY, this));
                this.dispatchEvent(new game.GameEvent(game.GameEvent.AUTOPLAY_BUTTON_PRESSED, this));
                this.buttonPressed();
            }
        };
        GameButtonGroup.prototype.onHelpButtonDown = function (e) {
            if (this._helpButton.enabled) {
                Utils.PSLog.log("GameButtonGroup::onHelpButtonDown()");
                if (game.HelpBundle.BundleLoaded) {
                    this.dispatchEvent(new game.GameEvent(game.GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY, this));
                    this.showHelp();
                }
                else {
                    this._showHelpPending = true;
                    this.dispatchEvent(new game.GameEvent(game.GameEvent.RESHOW_PROGRESS_BAR, this));
                }
                this.buttonPressed();
            }
        };
        GameButtonGroup.prototype.onStakeUpButtonDown = function (e) {
            if (this._stakeUpButton.enabled) {
                Utils.PSLog.log("GameButtonGroup::onStakeUpButtonDown()");
                this.dispatchEvent(new game.GameEvent(game.GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY, this));
                this._stakeModel.increaseStakePerLine();
                this.updateStakeButtons();
                this.dispatchEvent(new game.GameEvent(game.GameEvent.STAKE_UP_BUTTON_PRESSED, this));
                this.buttonPressed();
            }
        };
        GameButtonGroup.prototype.onStakeDownButtonDown = function (e) {
            if (this._stakeDownButton.enabled) {
                Utils.PSLog.log("GameButtonGroup::onStakeDownButtonDown()");
                this.dispatchEvent(new game.GameEvent(game.GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY, this));
                this._stakeModel.decreaseStakePerLine();
                this.updateStakeButtons();
                this.dispatchEvent(new game.GameEvent(game.GameEvent.STAKE_DOWN_BUTTON_PRESSED, this));
                this.buttonPressed();
            }
        };
        GameButtonGroup.prototype.updateStakeButtons = function () {
            this._stakeUpButton.enabled = !this._stakeModel.isMaxStake();
            this._stakeDownButton.enabled = !this._stakeModel.isMinStake();
        };
        ///////////////////////////////////
        // Other
        GameButtonGroup.prototype.showHelp = function () {
            if (game.HelpBundle.BundleLoaded) {
                this._showHelpPending = false;
                this.setGroupEnabled(false);
                // hide the progress bar again and pretend the help button was just pressed 
                this.dispatchEvent(new game.GameEvent(game.GameEvent.REHIDE_PROGRESS_BAR, this));
                this.dispatchEvent(new game.GameEvent(game.GameEvent.HELP_BUTTON_PRESSED, this));
                this.buttonPressed();
            }
            else {
                throw "Help not ready!";
            }
        };
        GameButtonGroup.prototype.buttonPressed = function () {
            GameButtonGroup.introClose = false;
        };
        GameButtonGroup.introClose = true;
        GameButtonGroup.SPIN_ALLOWED_INTERVAL = 3000; //time between spins cannot be less than this
        __decorate([
            inject('AutoPlayModel')
        ], GameButtonGroup.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('StakeModel')
        ], GameButtonGroup.prototype, "_stakeModel", void 0);
        return GameButtonGroup;
    }());
    game.GameButtonGroup = GameButtonGroup;
})(game || (game = {}));
var game;
(function (game) {
    var GameButtonGroupMediator = (function (_super) {
        __extends(GameButtonGroupMediator, _super);
        function GameButtonGroupMediator() {
            _super.apply(this, arguments);
            this._recoveryInProgress = false;
        }
        GameButtonGroupMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            Utils.PSLog.log("GameButtonGroupMediator::onAdded()");
            this.addContextListener(game.GameEvent.HARD_RESET, this.hardReset);
            // All buttons must be disabled in the following scenarios:
            // 1. Spin button is clicked
            // 2. Autoplay is started
            // 3. In Recovery mode
            this.addContextListener(game.GameEvent.NORMAL_GAME_INIT, this.updateGroupButtonState);
            this.addContextListener(game.GameEvent.RECOVERY_GAME_INIT, this.disableAllButtons);
            this.addContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.disableAllButtons);
            this.addContextListener(game.GameEvent.AUTOPLAY_BUTTON_PRESSED, this.disableAllButtons);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_OPEN, this.disableAllButtons);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_CLOSE, this.enableAllButtons);
            this.addContextListener(game.GameEvent.AUTOPLAY_MENU_CANCELLED, this.autoplayMenunCancelled);
            this.addContextListener(game.ExternalEvent.START_AUTOPLAY, this.disableAllButtons);
            this.addContextListener(game.ExternalEvent.START_AUTOPLAY, this.hideSpinButton);
            this.addContextListener(game.AutoPlayModelEvent.STOPPED, this.updateGroupButtonState);
            this.addContextListener(game.AutoPlayModelEvent.STOPPED, this.showSpinButton);
            // handle refreshing the help buttons under stage loading conditions
            this.addContextListener(game.GameEvent.HELP_UI_READY, this.onHelpUIReady);
            this.addContextListener(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this.onHelpExit);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
        };
        GameButtonGroupMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            Utils.PSLog.log("GameButtonGroupMediator::onRemove()");
            this.removeContextListener(game.GameEvent.HARD_RESET, this.hardReset);
            this.removeContextListener(game.GameEvent.NORMAL_GAME_INIT, this.updateGroupButtonState);
            this.removeContextListener(game.GameEvent.RECOVERY_GAME_INIT, this.disableAllButtons);
            this.removeContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.disableAllButtons);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_OPEN, this.disableAllButtons);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_CLOSE, this.enableAllButtons);
            this.removeContextListener(game.GameEvent.AUTOPLAY_BUTTON_PRESSED, this.disableAllButtons);
            this.removeContextListener(game.GameEvent.AUTOPLAY_MENU_CANCELLED, this.autoplayMenunCancelled);
            this.removeContextListener(game.ExternalEvent.START_AUTOPLAY, this.disableAllButtons);
            this.removeContextListener(game.ExternalEvent.START_AUTOPLAY, this.hideSpinButton);
            this.removeContextListener(game.AutoPlayModelEvent.STOPPED, this.updateGroupButtonState);
            this.removeContextListener(game.AutoPlayModelEvent.STOPPED, this.showSpinButton);
            this.removeContextListener(game.GameEvent.HELP_UI_READY, this.onHelpUIReady);
            this.removeContextListener(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this.onHelpExit);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
        };
        GameButtonGroupMediator.prototype.updateGroupButtonState = function () {
            var subGame = this._stateModel.currentSubgame;
            var subGameState = this._stateModel.currentSubgameState;
            var autoplayInProgress = this._autoplayModel.isInProgress();
            var shouldEnableButtons = (subGame === "BaseGame" && subGameState === "idle" && !autoplayInProgress);
            this._gameButtonGroup.groupEnabled = shouldEnableButtons ? true : false;
        };
        GameButtonGroupMediator.prototype.disableAllButtons = function () {
            this._gameButtonGroup.groupEnabled = false;
        };
        GameButtonGroupMediator.prototype.enableAllButtons = function () {
            this._gameButtonGroup.groupEnabled = true;
        };
        GameButtonGroupMediator.prototype.onHelpUIReady = function () {
            this._gameButtonGroup.onHelpUIReady();
        };
        GameButtonGroupMediator.prototype.showSpinButton = function () {
            this._gameButtonGroup.setButtonVisibility('stopAutoplayButton', false);
            this._gameButtonGroup.setButtonVisibility('spinButton', true);
        };
        GameButtonGroupMediator.prototype.hideSpinButton = function () {
            this._gameButtonGroup.setButtonVisibility('stopAutoplayButton', true);
            //this._gameButtonGroup.setButtonVisibility('spinButton', false);
        };
        GameButtonGroupMediator.prototype.autoplayMenunCancelled = function () {
            this.updateGroupButtonState();
        };
        GameButtonGroupMediator.prototype.onEndResponse = function () {
            this._recoveryInProgress = false;
            this.updateGroupButtonState();
        };
        GameButtonGroupMediator.prototype.hardReset = function () {
            this.updateGroupButtonState();
        };
        GameButtonGroupMediator.prototype.onHelpExit = function () {
            this.updateGroupButtonState();
        };
        __decorate([
            inject('GameButtonGroup')
        ], GameButtonGroupMediator.prototype, "_gameButtonGroup", void 0);
        __decorate([
            inject('GameStateModel')
        ], GameButtonGroupMediator.prototype, "_stateModel", void 0);
        __decorate([
            inject('AutoPlayModel')
        ], GameButtonGroupMediator.prototype, "_autoplayModel", void 0);
        return GameButtonGroupMediator;
    }(dragonwings.Mediator));
    game.GameButtonGroupMediator = GameButtonGroupMediator;
})(game || (game = {}));
var game;
(function (game) {
    var GameServer = (function (_super) {
        __extends(GameServer, _super);
        function GameServer() {
            _super.call(this, null, "", "", null, null);
        }
        GameServer.prototype.postInject = function () {
            this._dragonWingify.makeEventsGlobal(this);
            this.init(this._metaData.getLogicUrl(), "20142", "1_0", this._metaData, this._partnerAdapter);
            var initRequester;
            initRequester = new server.GLSInitRequester(game.IFPMInitResponse);
            var logicRequester;
            logicRequester = new server.GLSLogicRequester(game.IFPMLogicResponse);
            var endRequester;
            endRequester = new server.GLSEndRequester(server.GLSEndResponse);
            this.setInitRequester(initRequester);
            this.setLogicRequester(logicRequester);
            this.setEndRequester(endRequester);
        };
        __decorate([
            inject('IEventDispatcher')
        ], GameServer.prototype, "_eventDispatcher", void 0);
        __decorate([
            inject('DragonWingify')
        ], GameServer.prototype, "_dragonWingify", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], GameServer.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('MetaData')
        ], GameServer.prototype, "_metaData", void 0);
        return GameServer;
    }(server.GLSServer));
    game.GameServer = GameServer;
})(game || (game = {}));
var util;
(function (util) {
    var IHistoryModelAbstract = (function () {
        function IHistoryModelAbstract() {
        }
        IHistoryModelAbstract.prototype.getIsHistoryReplay = function () {
            return false;
        };
        IHistoryModelAbstract.prototype.loadHistoryData = function () {
        };
        IHistoryModelAbstract.prototype.restart = function () {
        };
        IHistoryModelAbstract.prototype.getNextState = function (remove) {
            return null;
        };
        IHistoryModelAbstract.prototype.isLoaded = function () {
            return false;
        };
        return IHistoryModelAbstract;
    }());
    util.IHistoryModelAbstract = IHistoryModelAbstract;
    var HistoryModel = (function () {
        function HistoryModel() {
            this._url = new util.URL(window.location.href);
            this._historyUrl = this._url.queryData('HistoryServerURL');
            this._betUrl = this._url.queryData('betID');
            this._removed = [];
        }
        HistoryModel.prototype.getIsHistoryReplay = function () {
            return this._url.queryData('HistoryServerURL') != null;
        };
        HistoryModel.prototype.loadHistoryData = function () {
            if (this._historyUrl == null || this._betUrl == null) {
                util.ErrorReporter.showError('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_BODY', 'Malformed history data.');
            }
            else {
                var endpoint = this._historyUrl + this._betUrl;
                var factory = new http.HttpConnectionFactory();
                var connection = factory.createConnection(endpoint, null, http.HttpMethod.GET);
                connection.addEventListener(http.HttpConnectionEvent.COMPLETE, this.onHistoryConnectionComplete, this);
                connection.addEventListener(http.HttpConnectionEvent.FAIL, this.onHistoryConnectionFail, this);
                connection.addEventListener(http.HttpConnectionEvent.PROGRESS, this.onHistoryConnectionProgress, this);
                connection.send();
            }
        };
        HistoryModel.prototype.isLoaded = function () {
            return this._loaded;
        };
        HistoryModel.prototype.onHistoryConnectionProgress = function (e) {
            this._eventDispatcher.dispatchEvent(new util.HistoryModelEvent(util.HistoryModelEvent.PROGRESS));
        };
        HistoryModel.prototype.onHistoryConnectionComplete = function (e) {
            console.log('onHistoryDataResponse' +
                '\n\turl: ' + e.url +
                '\n\tresponseText: ' + e.response.responseText +
                '\n\tresponseHeaders: ' + e.responseHeaders);
            var data = JSON.parse(e.response.responseText);
            var totalBet = data[0].Stake;
            //this.bet = new Bet(40, totalBet / 40);
            var states = data[0].Data;
            this._historyStates = [];
            for (var i = 0; i < states.length; i++) {
                this._historyStates.push(states[i].Comment);
            }
            this.restart();
            this._loaded = true;
            this._eventDispatcher.dispatchEvent(new util.HistoryModelEvent(util.HistoryModelEvent.COMPLETE));
        };
        HistoryModel.prototype.onHistoryConnectionFail = function (e) {
            util.ErrorReporter.showError('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_BODY', 'Error retrieving history data from service.');
            this._eventDispatcher.dispatchEvent(new util.HistoryModelEvent(util.HistoryModelEvent.FAILED));
        };
        HistoryModel.prototype.restart = function () {
            this._historyStatesStack = this._historyStates.concat();
        };
        HistoryModel.prototype.getPreviousState = function () {
            return this._removed[this._removed.length - 1];
        };
        HistoryModel.prototype.getNextState = function (remove) {
            if (remove === void 0) { remove = true; }
            if (this._historyStatesStack && this._historyStatesStack.length > 0) {
                if (remove) {
                    var result = this._historyStatesStack.shift();
                    this._removed.push(result);
                }
                else {
                    var result = this._historyStatesStack[0];
                }
                return result;
            }
            return null;
        };
        __decorate([
            inject('IEventDispatcher')
        ], HistoryModel.prototype, "_eventDispatcher", void 0);
        return HistoryModel;
    }());
    util.HistoryModel = HistoryModel;
})(util || (util = {}));
var util;
(function (util) {
    var HistoryModelEvent = (function (_super) {
        __extends(HistoryModelEvent, _super);
        function HistoryModelEvent(type) {
            _super.call(this, type);
        }
        HistoryModelEvent.COMPLETE = "HistoryModelEvent_COMPLETE";
        HistoryModelEvent.FAILED = "HistoryModelEvent_FAILED";
        HistoryModelEvent.PROGRESS = "HistoryModelEvent_PROGRESS";
        return HistoryModelEvent;
    }(dragonwings.Event));
    util.HistoryModelEvent = HistoryModelEvent;
})(util || (util = {}));
var game;
(function (game) {
    var IFPMAwardsParser = (function () {
        function IFPMAwardsParser() {
        }
        // Parses the server init awards data and sets it on an IResponse object
        IFPMAwardsParser.prototype.parse = function (input, object) {
            var awardsData = [];
            var awardNodes = input.getElementsByTagName("AwardsInfo");
            for (var nodeIdx = 0; nodeIdx < awardNodes.length; ++nodeIdx) {
                if (awardNodes[nodeIdx]) {
                    var awardsTable = this.parseAwardNode(awardNodes[nodeIdx]);
                    awardsData.push(awardsTable);
                }
            }
            object.awardsData = awardsData;
        };
        IFPMAwardsParser.prototype.parseAwardNode = function (awardNode) {
            var awardTable = new server.AwardsData();
            awardTable.awards = [];
            var attributes = awardNode.attributes;
            // Extract slot award data
            var numAwards = parseInt(attributes.getNamedItem("awardCount").value, 10);
            var nodeChildren = awardNode.childNodes;
            for (var awardIndex = 0; awardIndex < numAwards; ++awardIndex) {
                var awardDataSource = nodeChildren[awardIndex];
                var paySummary = awardDataSource.textContent.split("|");
                var pay = new server.AwardData();
                pay.id = parseInt(paySummary[0], 10);
                pay.numSymbols = parseInt(paySummary[1], 10);
                pay.value = parseFloat(paySummary[2]); //parseInt(paySummary[2], 10);
                awardTable.awards.push(pay);
            }
            return awardTable;
        };
        return IFPMAwardsParser;
    }());
    game.IFPMAwardsParser = IFPMAwardsParser;
})(game || (game = {}));
var game;
(function (game) {
    var IFPMGameResultParser = (function (_super) {
        __extends(IFPMGameResultParser, _super);
        function IFPMGameResultParser() {
            _super.apply(this, arguments);
        }
        // Just override the populateResults() method of the base class
        // to parse the additional non-standard nodes / attributes 
        IFPMGameResultParser.prototype.parse = function (input, object) {
            _super.prototype.parse.call(this, input, object);
            var node = input.getElementsByTagName("GameResult")[0];
            var resultNodes = node.childNodes;
            for (var nodeIndex = 0; nodeIndex < resultNodes.length; ++nodeIndex) {
                var childNode = resultNodes[nodeIndex];
                if (childNode.nodeName == "BGInfo") {
                    var totalWagerWinStr = childNode.attributes.getNamedItem("totalWagerWin").value;
                    var totalWagerWin = parseInt(totalWagerWinStr);
                    object.totalWagerWin = totalWagerWin;
                    var bgWinningsStr = childNode.attributes.getNamedItem("bgWinnings").value;
                    var bgWinnings = parseInt(bgWinningsStr);
                    object.bgWinnings = bgWinnings;
                    /*var bgSpinsRemainingStr: string = childNode.attributes.getNamedItem("baseGameSpinsRemaining").value;
                    var bgSpinsRemaining: number = parseInt(bgSpinsRemainingStr);
                    object.bgSpinsRemaining = bgSpinsRemaining;*/
                    /*var isBigBetStr: string = childNode.attributes.getNamedItem("isBigBet").value;
                    var isBigBet: boolean = (isBigBetStr === "1") ? true : false;
                    object.isBigBet = isBigBet;*/
                    var isMaxWinStr = childNode.attributes.getNamedItem("isMaxWin").value;
                    var isMaxWin = (isMaxWinStr === "1") ? true : false;
                    object.isMaxWin = isMaxWin;
                }
                if (childNode.nodeName == "FSInfo") {
                    var fsWinningsStr = childNode.attributes.getNamedItem("fsWinnings").value;
                    var fsWinnings = parseInt(fsWinningsStr);
                    object.fsWinnings = fsWinnings;
                    var fsSpinsTotalStr = childNode.attributes.getNamedItem("freeSpinsTotal").value;
                    var fsSpinsTotal = parseInt(fsSpinsTotalStr);
                    object.fsSpinsTotal = fsSpinsTotal;
                    var fsSpinNumberStr = childNode.attributes.getNamedItem("freeSpinNumber").value;
                    var fsSpinNumber = parseInt(fsSpinNumberStr);
                    object.fsSpinNumber = fsSpinNumber;
                    var fsMaxWinStr = childNode.attributes.getNamedItem("isMaxWin").value;
                    var fsMaxWin = parseInt(fsMaxWinStr);
                    object.fsMaxWin = fsMaxWin;
                    var fsAwardedStr = childNode.attributes.getNamedItem("freeSpinsAwarded").value;
                    var fsAwarded = parseInt(fsAwardedStr);
                    object.fsAwarded = fsAwarded;
                }
            }
        };
        return IFPMGameResultParser;
    }(server.GLSGameResultParser));
    game.IFPMGameResultParser = IFPMGameResultParser;
})(game || (game = {}));
var game;
(function (game) {
    var IFPMInitResponse = (function (_super) {
        __extends(IFPMInitResponse, _super);
        function IFPMInitResponse() {
            _super.apply(this, arguments);
        }
        IFPMInitResponse.prototype.getParsers = function () {
            return [
                new server.GLSBalanceParser(),
                new game.IFPMStakesParser(),
                new server.GLSReelParser(),
                new server.GLSPlatformParser(),
                new game.IFPMRecoveryParser(),
                new server.GLSPaylinesParser,
                new game.IFPMAwardsParser(),
                new server.GLSCurrencyParser(),
                new game.PayloadParser()
            ];
        };
        return IFPMInitResponse;
    }(server.GLSInitResponse));
    game.IFPMInitResponse = IFPMInitResponse;
})(game || (game = {}));
var game;
(function (game) {
    var IFPMLogicResponse = (function (_super) {
        __extends(IFPMLogicResponse, _super);
        function IFPMLogicResponse() {
            _super.apply(this, arguments);
        }
        IFPMLogicResponse.prototype.getParsers = function () {
            return [
                new server.GLSBalanceParser(),
                new server.GLSPlatformParser(),
                new game.IFPMGameResultParser(),
                new game.IFPMReelResultParser(),
                new game.PayloadParser(),
                new game.IFPMRecoveryParser(),
                new game.BGRecoveryInfoParser()
            ];
        };
        IFPMLogicResponse.prototype.getSessionId = function () { return this.platformData.sessionId; };
        Object.defineProperty(IFPMLogicResponse.prototype, "reelsetIndex", {
            get: function () { return this.reelSpinData[0].reelsetIndex; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(IFPMLogicResponse.prototype, "freeSpin", {
            get: function () { return this.reelSpinData[0].freeSpin; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(IFPMLogicResponse.prototype, "bonusAwarded", {
            get: function () { return this.reelSpinData[0].bonusAwarded; },
            enumerable: true,
            configurable: true
        });
        return IFPMLogicResponse;
    }(server.LogicResponse));
    game.IFPMLogicResponse = IFPMLogicResponse;
})(game || (game = {}));
var game;
(function (game) {
    var IFPMRecoveryParser = (function () {
        function IFPMRecoveryParser() {
        }
        IFPMRecoveryParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("Header")[0];
            var isRecovering = false;
            if (node != null) {
                var attributes = node.attributes;
                isRecovering = attributes.getNamedItem("isRecovering").value == "Y";
            }
            object.isRecovering = isRecovering;
        };
        return IFPMRecoveryParser;
    }());
    game.IFPMRecoveryParser = IFPMRecoveryParser;
})(game || (game = {}));
var game;
(function (game) {
    var PickMeBonus = (function () {
        function PickMeBonus() {
        }
        return PickMeBonus;
    }());
    game.PickMeBonus = PickMeBonus;
    var IFPMReelResultParser = (function (_super) {
        __extends(IFPMReelResultParser, _super);
        function IFPMReelResultParser() {
            _super.apply(this, arguments);
        }
        // Just override the populateResults() method of the base class
        // to parse the additional non-standard nodes / attributes 
        IFPMReelResultParser.prototype.populateResults = function (object, node) {
            _super.prototype.populateResults.call(this, object, node);
            var resultNodes = node.childNodes;
            var cascades = [];
            for (var nodeIndex = 0; nodeIndex < resultNodes.length; ++nodeIndex) {
                var childNode = resultNodes[nodeIndex];
                if (childNode.nodeName == "ReelSpin") {
                    var strReelsetIdx = childNode.attributes.getNamedItem("reelsetIndex").value;
                    var reelsetIndex = parseInt(strReelsetIdx);
                    object.reelsetIndex = reelsetIndex;
                    var strSpinIdx = childNode.attributes.getNamedItem("spinIndex").value;
                    var spinIndex = parseInt(strSpinIdx);
                    object.spinIndex = spinIndex;
                    var strSpinWins = childNode.attributes.getNamedItem("spinWins").value;
                    var spinWins = parseInt(strSpinWins);
                    object.spinWins = spinWins;
                    var strBonusAwarded = childNode.attributes.getNamedItem("bonusAwarded").value;
                    var bonusAwarded = (strBonusAwarded == "Y") ? true : false;
                    object.bonusAwarded = bonusAwarded;
                    var cascadeCount = childNode.attributes.getNamedItem("cascadeCount").value;
                    object.cascadeCount = parseInt(cascadeCount);
                    for (var childIndex = 0; childIndex < childNode.childNodes.length; ++childIndex) {
                        var childchild = childNode.childNodes[childIndex];
                        var paylineWins = [];
                        if (childchild.nodeName == "Cascade") {
                            for (var greatGrandchildIndex = 0; greatGrandchildIndex < childchild.childNodes.length; ++greatGrandchildIndex) {
                                var grandchild = childchild.childNodes[greatGrandchildIndex];
                                if (grandchild.nodeName == "PaylineWin") {
                                    paylineWins.push({
                                        index: parseInt(grandchild.attributes.getNamedItem("index").value),
                                        winVal: parseInt(grandchild.attributes.getNamedItem("winVal").value),
                                        awardIndex: parseInt(grandchild.attributes.getNamedItem("awardIndex").value),
                                        awardTableIndex: parseInt(grandchild.attributes.getNamedItem("awardTableIndex").value),
                                        reelPositions: grandchild.textContent.split("|")
                                    });
                                }
                            }
                            cascades.push({
                                index: parseInt(childchild.attributes.getNamedItem("index").value),
                                winCountPL: parseInt(childchild.attributes.getNamedItem("winCountPL").value),
                                winCountSC: parseInt(childchild.attributes.getNamedItem("winCountSC").value),
                                cascadeWins: parseInt(childchild.attributes.getNamedItem("cascadeWins").value),
                                cascadeMask: parseInt(childchild.attributes.getNamedItem("cascadeMask").value),
                                paylineWins: paylineWins
                            });
                        }
                    }
                }
            }
            object.cascades = cascades.slice(0, -1);
        };
        return IFPMReelResultParser;
    }(server.GLSReelResultParser));
    game.IFPMReelResultParser = IFPMReelResultParser;
})(game || (game = {}));
var game;
(function (game) {
    var IFPMStakesParser = (function () {
        function IFPMStakesParser() {
        }
        // Need a custom parser because there are two stakes to read
        IFPMStakesParser.prototype.parse = function (input, object) {
            var stakesData = [];
            var stakeNodes = input.getElementsByTagName("Stakes");
            for (var nodeIdx = 0; nodeIdx < stakeNodes.length; ++nodeIdx) {
                if (stakeNodes[nodeIdx]) {
                    var node = stakeNodes[nodeIdx];
                    var stake = this.parseStake(node);
                    stakesData.push(stake);
                }
            }
            object.betData = stakesData;
            // Parse the MaxWin value
            var awardNodes = input.getElementsByTagName("AwardsInfo");
            if (awardNodes[0] != null) {
                object.maxWinValue = parseInt(awardNodes[0].attributes.getNamedItem("maxWin").value, 10);
            }
            // and game variant info - seems OTT to add a new parser just for this
            // even though arguably it has nothing to do with stakes
            var gameVariantNode = input.getElementsByTagName("GameVariantInfo")[0];
            if (gameVariantNode != null) {
                var attributes = gameVariantNode.attributes;
            }
        };
        IFPMStakesParser.prototype.parseStake = function (node) {
            var stake = new server.BetData();
            if (node != null) {
                var attributes = node.attributes;
                stake.setDefaultIndex(parseInt(attributes.getNamedItem("defaultIndex").value, 10));
                stake.setAvailableBets(node.textContent.split("|").map(Number));
            }
            return stake;
        };
        return IFPMStakesParser;
    }());
    game.IFPMStakesParser = IFPMStakesParser;
})(game || (game = {}));
var game;
(function (game) {
    var LaunchParametersModel = (function () {
        function LaunchParametersModel() {
            this._fps = 60;
            this._mobilePresentation = false;
        }
        LaunchParametersModel.prototype.setData = function (packed, webgl, dombg, fps, stats, local, useCDN, useMobile, stageDelay, debugOverlay) {
            this._packed = packed;
            this._webgl = webgl;
            this._dombg = dombg;
            this._fps = fps;
            this._stats = stats;
            this._local = local;
            this._useCDN = useCDN;
            this._mobilePresentation = useMobile;
            this._stageLoadDelay = stageDelay;
            this._debugOverlay = debugOverlay;
        };
        Object.defineProperty(LaunchParametersModel.prototype, "packed", {
            get: function () {
                return this._packed;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "webgl", {
            get: function () {
                return this._webgl;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "dombg", {
            get: function () {
                return this._dombg;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "fps", {
            get: function () {
                return this._fps;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "stats", {
            get: function () {
                return this._stats;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "debugOverlay", {
            get: function () {
                return this._debugOverlay;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "local", {
            get: function () {
                return this._local;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "mobilePresentation", {
            get: function () {
                return this._mobilePresentation;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "useCDN", {
            get: function () {
                return this._useCDN;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LaunchParametersModel.prototype, "stageLoadDelay", {
            get: function () {
                return this._stageLoadDelay;
            },
            enumerable: true,
            configurable: true
        });
        return LaunchParametersModel;
    }());
    game.LaunchParametersModel = LaunchParametersModel;
})(game || (game = {}));
var game;
(function (game) {
    var PartnerAdapterEventModel = (function () {
        function PartnerAdapterEventModel() {
        }
        Object.defineProperty(PartnerAdapterEventModel.prototype, "winDisplayEventListener", {
            get: function () {
                return this._winDisplayEventListener;
            },
            set: function (value) {
                this._winDisplayEventListener = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PartnerAdapterEventModel.prototype, "balanceDisplayEventListener", {
            get: function () {
                return this._balanceDisplayEventListener;
            },
            set: function (value) {
                this._balanceDisplayEventListener = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PartnerAdapterEventModel.prototype, "gameInitializedEventListener", {
            get: function () {
                return this._gameInitializedEventListener;
            },
            set: function (value) {
                this._gameInitializedEventListener = value;
            },
            enumerable: true,
            configurable: true
        });
        return PartnerAdapterEventModel;
    }());
    game.PartnerAdapterEventModel = PartnerAdapterEventModel;
})(game || (game = {}));
var game;
(function (game) {
    var RemoveSymbolAnimationData = (function () {
        function RemoveSymbolAnimationData(reelView, symbol) {
            this.reelView = reelView;
            this.reelViewIndex = reelView.id;
            this.symbol = symbol;
        }
        return RemoveSymbolAnimationData;
    }());
    game.RemoveSymbolAnimationData = RemoveSymbolAnimationData;
})(game || (game = {}));
var game;
(function (game) {
    var SpinModel = (function () {
        function SpinModel() {
        }
        SpinModel.prototype.throwException = function (msg) {
            var fullMsg = "SpinModel Exception: " + msg;
            throw (fullMsg);
        };
        return SpinModel;
    }());
    game.SpinModel = SpinModel;
})(game || (game = {}));
var game;
(function (game) {
    var StakeModelEvent = (function (_super) {
        __extends(StakeModelEvent, _super);
        function StakeModelEvent(eventName) {
            _super.call(this, eventName);
        }
        StakeModelEvent.STAKE_MODEL_CHANGED = "StakeModelEvent_STAKE_MODEL_CHANGED";
        return StakeModelEvent;
    }(borgevent.Event));
    game.StakeModelEvent = StakeModelEvent;
    var StakeModel = (function () {
        function StakeModel() {
            this._server = new dragonwings.InjectProp(server.GLSServer).inject();
            this._lines = StakeModel.kLines;
            this._validStakes = [25, 30, 50, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250];
            this._currStakeIdx = 0;
            this._defaultStakeIdx = 0;
            this._emergencyStake = -1;
            this._emergencyStakeActive = false;
        }
        Object.defineProperty(StakeModel.prototype, "eventListener", {
            // We need an event dispatcher to both listen for and dispatch events from
            get: function () { return this._eventListener; },
            set: function (value) { this._eventListener = value; },
            enumerable: true,
            configurable: true
        });
        StakeModel.prototype.isMinStake = function () { return (this._currStakeIdx == 0); };
        StakeModel.prototype.isMaxStake = function () { return (this._currStakeIdx == this._validStakes.length - 1); };
        StakeModel.prototype.isMinLines = function () { return (this._lines == StakeModel.kLines); };
        StakeModel.prototype.isMaxLines = function () { return (this._lines == StakeModel.kLines); };
        StakeModel.prototype.getMaxStakePerLine = function () {
            return this._validStakes[this._validStakes.length - 1];
        };
        StakeModel.prototype.getMinStakePerLine = function () {
            return this._validStakes[0];
        };
        // 
        StakeModel.prototype.getMinLines = function () {
            return StakeModel.kLines;
        };
        StakeModel.prototype.getMaxLines = function () {
            return StakeModel.kLines;
        };
        // MaxWin value
        StakeModel.prototype.setMaxWinValue = function (index) {
            this._maxWinValue = index;
        };
        StakeModel.prototype.getMaxWinValue = function () {
            return this._maxWinValue;
        };
        // RTP values
        StakeModel.prototype.setRTPValues = function (rtpBelow200, rtpAtLeast200, rtpBigBet) {
            this._rtpBelow200 = rtpBelow200;
            this._rtpAtLeast200 = rtpAtLeast200;
            this._rtpBigBet = rtpBigBet;
        };
        StakeModel.prototype.getRTPBelow200 = function () {
            return this._rtpBelow200;
        };
        StakeModel.prototype.getRTPAtLeast200 = function () {
            return this._rtpAtLeast200;
        };
        StakeModel.prototype.getRTPBigBet = function () {
            return this._rtpBigBet;
        };
        //Stake Threshold
        StakeModel.prototype.setStakeThresholdIndex = function (index) {
            this._thresholdIdx = index;
        };
        StakeModel.prototype.getStakeThresholdIndex = function () {
            return this._thresholdIdx;
        };
        StakeModel.prototype.getThresholdStakeValue = function () {
            return this._validStakes[this._thresholdIdx];
        };
        StakeModel.prototype.getCurrStakeIdx = function () {
            return this._currStakeIdx;
        };
        StakeModel.prototype.reset = function () {
            this._currStakeIdx = this._defaultStakeIdx;
            this._emergencyStake = -1;
        };
        StakeModel.prototype.updateStake = function () {
            this._eventListener.dispatchEvent(new StakeModelEvent(StakeModelEvent.STAKE_MODEL_CHANGED));
        };
        // Used during history replay & recovery - we get the stake in the logic response
        StakeModel.prototype.setStakeIndexFromValue = function (value) {
            this._currStakeIdx = this._validStakes.indexOf(value);
            if (this._currStakeIdx == -1) {
                this._emergencyStake = value;
                Utils.PSLog.log("StakeModel::setStakeIndexFromValue(" + this._emergencyStake + ") - Invalid Stake detected - Emergency Stake used");
            }
            this.updateStake();
        };
        StakeModel.prototype.setStakeByIndex = function (index) {
            if (this._emergencyStakeActive) {
                this.resetEmergencyStake();
            }
            this._currStakeIdx = index;
            this.updateStake();
        };
        StakeModel.prototype.setStakeFromRecovery = function (value) {
            this._recoveryStake = value;
            this._currStakeIdx = this._validStakes.indexOf(value);
            // The stake list may have been updated since recovery. Check if the recovery stake is still valid, if not, set stake index to 0 to pick up the new lowest possible stake
            // if (this._currStakeIdx === -1) {
            //     this._currStakeIdx = 0;
            // }
            this._emergencyStake = this._recoveryStake;
            this._emergencyStakeActive = true;
            this.updateStake();
        };
        StakeModel.prototype.setValidStakes = function (stakes, defaultStakeIdx) {
            this._validStakes = stakes;
            this._currStakeIdx = defaultStakeIdx;
            this._defaultStakeIdx = defaultStakeIdx;
            this.updateStake();
        };
        StakeModel.prototype.increaseStakePerLine = function () {
            if (this._emergencyStakeActive) {
                this.resetEmergencyStake();
            }
            else if (this._currStakeIdx < this._validStakes.length - 1) {
                ++this._currStakeIdx;
                this.updateStake();
            }
        };
        StakeModel.prototype.decreaseStakePerLine = function () {
            if (this._emergencyStakeActive) {
                this.resetEmergencyStake();
            }
            else if (this._currStakeIdx > 0) {
                --this._currStakeIdx;
                this.updateStake();
            }
        };
        StakeModel.prototype.resetEmergencyStake = function () {
            this._currStakeIdx = 0;
            this._emergencyStakeActive = false;
            this.updateStake();
        };
        StakeModel.prototype.setMinStakePerLine = function () {
            this._currStakeIdx = 0;
            this.updateStake();
        };
        StakeModel.prototype.setMaxStakePerLine = function () {
            this._currStakeIdx = this._validStakes.length - 1;
            this.updateStake();
        };
        StakeModel.prototype.setMaxLines = function () {
            this._lines = StakeModel.kLines;
            this.updateStake();
        };
        StakeModel.prototype.setMinLines = function () {
            this._lines = StakeModel.kLines;
            this.updateStake();
        };
        StakeModel.prototype.increaseLines = function () {
            if (this._lines < StakeModel.kLines) {
                ++this._lines;
                this.updateStake();
            }
        };
        StakeModel.prototype.decreaseLines = function () {
            if (this._lines > StakeModel.kLines) {
                --this._lines;
                this.updateStake();
            }
        };
        StakeModel.prototype.isMegaWin = function (winValue) {
            var threshold = this.getTotalStake() * StakeModel.kMegaWinMultiplier;
            var megaWin = (winValue >= threshold);
            return megaWin;
        };
        StakeModel.prototype.isBigWin = function (winValue) {
            var threshold = this.getTotalStake() * StakeModel.kBigWinMultiplier;
            var bigWin = (winValue >= threshold);
            return bigWin;
        };
        StakeModel.prototype.getTotalStake = function () {
            return this.getStakePerLine() * this.getLines();
        };
        StakeModel.prototype.getLines = function () {
            return this._lines;
        };
        StakeModel.prototype.getStakePerLine = function () {
            var spl = this._validStakes[this._currStakeIdx];
            if (this._emergencyStakeActive) {
                spl = this._emergencyStake;
            }
            spl = Math.round(spl);
            return spl;
        };
        StakeModel.prototype.getTotalBet = function () {
            return (this.getLines() * this.getStakePerLine());
        };
        StakeModel.prototype.getRecoveryStake = function () {
            return this._recoveryStake;
        };
        StakeModel.kBigWinMultiplier = 15;
        StakeModel.kMegaWinMultiplier = 50;
        StakeModel.kLines = 25;
        return StakeModel;
    }());
    game.StakeModel = StakeModel;
})(game || (game = {}));
var game;
(function (game) {
    var WinInfoModel = (function () {
        function WinInfoModel() {
            this._winInfo = [];
            this._currentCycle = 0;
            this.canPaylinesBeSkipped = false;
            this.winCountUpComplete = false;
            this._cascadeWins = [];
            this._runningTotalWinnings = 0;
            this._numberOfTimesPaylinesHaveBeenRepeated = 0;
            this._hasSkippedLastPayLines = false;
        }
        Object.defineProperty(WinInfoModel.prototype, "eventListener", {
            get: function () { return this._eventListener; },
            set: function (value) { this._eventListener = value; },
            enumerable: true,
            configurable: true
        });
        WinInfoModel.prototype.set = function (winInfo) {
            this._winInfo = winInfo;
        };
        WinInfoModel.prototype.getWinDataForCurrentCycle = function () {
            return this._winInfo[this._currentCycle];
        };
        WinInfoModel.prototype.incrementCycleCount = function () {
            this._currentCycle++;
        };
        Object.defineProperty(WinInfoModel.prototype, "isEmpty", {
            get: function () {
                return this._winInfo.length === 0;
            },
            enumerable: true,
            configurable: true
        });
        WinInfoModel.prototype.addCascadeWin = function (cascadeWin) {
            this._cascadeWins.push(cascadeWin);
        };
        WinInfoModel.prototype.getNextCascadeWin = function () {
            this._lastCascadeWin = this._cascadeWins[this._currentCycle];
            this._eventListener.dispatchEvent(new game.WinModelEvent(game.WinModelEvent.WIN_MODEL_CHANGED));
            return this._lastCascadeWin;
        };
        Object.defineProperty(WinInfoModel.prototype, "lastCascadeWin", {
            get: function () {
                return this._lastCascadeWin;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WinInfoModel.prototype, "runningTotalWinnings", {
            get: function () {
                return this._runningTotalWinnings;
            },
            set: function (runningTotalWinnings) {
                this._runningTotalWinnings = runningTotalWinnings;
                this._eventListener.dispatchEvent(new game.WinModelEvent(game.WinModelEvent.WIN_MODEL_CHANGED));
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WinInfoModel.prototype, "hasSkippedLastPayLines", {
            get: function () {
                return this._hasSkippedLastPayLines;
            },
            set: function (hasSkippedLastPayLines) {
                this._hasSkippedLastPayLines = hasSkippedLastPayLines;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WinInfoModel.prototype, "numberOfTimesPaylinesHaveBeenRepeated", {
            get: function () {
                return this._numberOfTimesPaylinesHaveBeenRepeated;
            },
            set: function (numberOfTimesPaylinesHaveBeenRepeated) {
                this._numberOfTimesPaylinesHaveBeenRepeated = numberOfTimesPaylinesHaveBeenRepeated;
            },
            enumerable: true,
            configurable: true
        });
        WinInfoModel.prototype.clear = function () {
            this._winInfo = [];
            this._currentCycle = 0;
            this._cascadeWins = [];
            this.runningTotalWinnings = 0;
            this._lastCascadeWin = void 0;
            this._hasSkippedLastPayLines = false;
            this.numberOfTimesPaylinesHaveBeenRepeated = 0;
        };
        return WinInfoModel;
    }());
    game.WinInfoModel = WinInfoModel;
})(game || (game = {}));
var sgi;
(function (sgi) {
    var BalanceListener = (function () {
        function BalanceListener(eventDispatcher, metaData) {
            this.eventDispatcher = eventDispatcher;
            this._metaData = metaData;
        }
        // partner wants us to get the balance from the wallet
        BalanceListener.prototype.balanceNotificationFromPartnerAdapter = function () {
            // Only dispatch to the game if this is real money
            if (this._metaData.isRealMoney()) {
                console.log('PA called this method to Game : [To verify the Game Idle state]');
                var event = new sgi.ExternalBalanceEvent(sgi.ExternalBalanceEvent.UPDATE_BALANCE);
                this.eventDispatcher.dispatchEvent(event);
            }
            else {
                console.log('PA called Balance Listener for fun play. Ignoring.');
            }
        };
        // partner wants to set out balance directly
        BalanceListener.prototype.handleSetBalance = function (setBalanceEvent) {
            var event = new sgi.ExternalBalanceEvent(sgi.ExternalBalanceEvent.SET_BALANCE);
            event.balance = setBalanceEvent.getBalanceAmount();
            this.eventDispatcher.dispatchEvent(event);
        };
        return BalanceListener;
    }());
    sgi.BalanceListener = BalanceListener;
})(sgi || (sgi = {}));
var sgi;
(function (sgi) {
    var ExternalBalanceDisplayCmd = (function (_super) {
        __extends(ExternalBalanceDisplayCmd, _super);
        function ExternalBalanceDisplayCmd() {
            _super.apply(this, arguments);
        }
        ExternalBalanceDisplayCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var balanceEvent = this.event;
            // show the new balance in the UI
            if (this._commonuiData) {
                this._commonuiData.balance = balanceEvent.balance;
            }
            else {
            }
        };
        __decorate([
            inject('CommonUIData')
        ], ExternalBalanceDisplayCmd.prototype, "_commonuiData", void 0);
        return ExternalBalanceDisplayCmd;
    }(dragonwings.Command));
    sgi.ExternalBalanceDisplayCmd = ExternalBalanceDisplayCmd;
})(sgi || (sgi = {}));
var sgi;
(function (sgi) {
    var ExternalBalanceEvent = (function (_super) {
        __extends(ExternalBalanceEvent, _super);
        function ExternalBalanceEvent(type) {
            _super.call(this, type);
        }
        ExternalBalanceEvent.UPDATE_BALANCE = "ExternalBalanceEvent_UPDATE_BALANCE";
        ExternalBalanceEvent.SET_BALANCE = "ExternalBalanceEvent_SET_BALANCE";
        ExternalBalanceEvent.DISPLAY_BALANCE = "ExternalBalanceEvent_DISPLAY_BALANCE";
        return ExternalBalanceEvent;
    }(borgevent.Event));
    sgi.ExternalBalanceEvent = ExternalBalanceEvent;
})(sgi || (sgi = {}));
var sgi;
(function (sgi) {
    var ExternalSetBalanceCmd = (function (_super) {
        __extends(ExternalSetBalanceCmd, _super);
        function ExternalSetBalanceCmd() {
            _super.apply(this, arguments);
        }
        ExternalSetBalanceCmd.prototype.execute = function () {
            console.log('Game verifing the IDLE STATE......');
            // only set the balance if we are idle
            if (this._statesModel.currentSubgameState == "idle") {
                var balanceEvent = this.event;
                this.setBalance(balanceEvent.balance);
            }
            else {
                console.log('Game is not in IDLE STATE......will not set balance');
            }
        };
        ExternalSetBalanceCmd.prototype.setBalance = function (balance) {
            console.log('Game setting balance from partner : ' + balance);
            var event = new sgi.ExternalBalanceEvent(sgi.ExternalBalanceEvent.DISPLAY_BALANCE);
            event.balance = balance;
            this.eventDispatcher.dispatchEvent(event);
        };
        __decorate([
            inject('GameStateModel')
        ], ExternalSetBalanceCmd.prototype, "_statesModel", void 0);
        return ExternalSetBalanceCmd;
    }(dragonwings.Command));
    sgi.ExternalSetBalanceCmd = ExternalSetBalanceCmd;
})(sgi || (sgi = {}));
var sgi;
(function (sgi) {
    var ExternalUpdateBalanceCmd = (function (_super) {
        __extends(ExternalUpdateBalanceCmd, _super);
        function ExternalUpdateBalanceCmd() {
            _super.apply(this, arguments);
        }
        ExternalUpdateBalanceCmd.prototype.execute = function () {
            // only fetch the balance if we are idle
            if (this._statesModel.currentSubgameState == "idle") {
                var balanceEvent = this.event;
                this.fetchBalance();
            }
            else {
                console.log('Game is not in IDLE STATE......will not fetch balance');
            }
        };
        ExternalUpdateBalanceCmd.prototype.fetchBalance = function () {
            if (this._balanceService) {
                var successHandler = this.onSuccess.bind(this);
                var failureHandler = this.onFailure.bind(this);
                this._balanceService.fetchBalance(successHandler, failureHandler);
            }
        };
        ExternalUpdateBalanceCmd.prototype.onSuccess = function (message) {
            console.log('Game received balance from PA : ' + message.realBalance + ' : ' + message.statusCode + ' : ' + message.Message);
            var event = new sgi.ExternalBalanceEvent(sgi.ExternalBalanceEvent.DISPLAY_BALANCE);
            event.balance = message.realBalance;
            this.eventDispatcher.dispatchEvent(event);
        };
        ExternalUpdateBalanceCmd.prototype.onFailure = function (message) {
            console.log('ERROR fetching balance: ' + message);
        };
        __decorate([
            inject('GameStateModel')
        ], ExternalUpdateBalanceCmd.prototype, "_statesModel", void 0);
        __decorate([
            inject('BalanceService')
        ], ExternalUpdateBalanceCmd.prototype, "_balanceService", void 0);
        return ExternalUpdateBalanceCmd;
    }(dragonwings.Command));
    sgi.ExternalUpdateBalanceCmd = ExternalUpdateBalanceCmd;
})(sgi || (sgi = {}));
var game;
(function (game) {
    /**
     * Game Ready command from Gamesys OLG requirements.
     */
    var GameReadyCmd = (function (_super) {
        __extends(GameReadyCmd, _super);
        function GameReadyCmd() {
            _super.apply(this, arguments);
        }
        GameReadyCmd.prototype.execute = function () {
            _super.prototype.execute.call(this);
            var partnerAdapterInstance = this._partnerAdapter;
            if (partnerAdapterInstance.gameReady) {
                partnerAdapterInstance.gameReady();
            }
        };
        __decorate([
            inject('PartnerAdapter')
        ], GameReadyCmd.prototype, "_partnerAdapter", void 0);
        return GameReadyCmd;
    }(dragonwings.Command));
    game.GameReadyCmd = GameReadyCmd;
})(game || (game = {}));
var game;
(function (game) {
    var ButtonView = (function (_super) {
        __extends(ButtonView, _super);
        function ButtonView() {
            _super.call(this);
        }
        ButtonView.prototype.setAssets = function (up, down, over, dim, useDown) {
            if (useDown === void 0) { useDown = true; }
            if (!this.button) {
                this.button = new components.Button(up, down, over, dim);
                this.button.useDownState = useDown;
                this.addChild(this.button);
            }
        };
        ButtonView.prototype.setFrames = function (up, down, over, dim, useDown) {
            if (useDown === void 0) { useDown = true; }
            if (!this.button) {
                this.button = new components.Button(up, down, over, dim);
                this.button.useDownState = useDown;
                this.addChild(this.button);
            }
        };
        ButtonView.prototype.setMouseoverCursor = function (cursor) {
            var _this = this;
            if (cursor === void 0) { cursor = "pointer"; }
            this.addEventListener(rendering.InputEvent.OVER, function () {
                if (_this.button.enabled) {
                    document.body.style.cursor = cursor;
                }
            }, this);
            this.addEventListener(rendering.InputEvent.OUT, function () {
                document.body.style.cursor = "default";
            }, this);
        };
        ButtonView.prototype.setPosition = function (x, y) {
            this.x = x;
            this.y = y;
        };
        Object.defineProperty(ButtonView.prototype, "enabled", {
            get: function () {
                return this.button.enabled;
            },
            set: function (value) {
                this.button.enabled = value;
            },
            enumerable: true,
            configurable: true
        });
        return ButtonView;
    }(rendering.DisplayObjectContainer));
    game.ButtonView = ButtonView;
})(game || (game = {}));
///<reference path="../BaseClasses/ButtonView.ts" />
var game;
(function (game) {
    var StopAutoplayButtonView = (function (_super) {
        __extends(StopAutoplayButtonView, _super);
        function StopAutoplayButtonView() {
            _super.call(this);
        }
        StopAutoplayButtonView.prototype.construct = function (scalar) {
            this._scalar = scalar;
            var spritesheet = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.RG_ButtonsJson.name), this._cache.getAssetById(game.BaseGameBundle.RG_Buttons.name));
            this.setAssets(spritesheet.getFrameByName("button_on.png"), spritesheet.getFrameByName("button_dim.png"), spritesheet.getFrameByName("button_over.png"), spritesheet.getFrameByName("button_dim.png"));
            this.scaleX = this.scaleY = game.BaseGameUIConstants.kDesktopAutoplayButtonScale;
            var stopAutoplayIconAsset = Utils.MiscUtils.getAssetFrameWithName("autoplay_stop.png", game.BaseGameBundle.RG_Buttons.name, game.BaseGameBundle.RG_ButtonsJson.name, this._cache);
            var stopAutoplayBitmap = new rendering.Bitmap(stopAutoplayIconAsset);
            stopAutoplayBitmap.scaleX = stopAutoplayBitmap.scaleY = game.BaseGameUIConstants.kDesktopStopAutoplayButtonIconScale;
            stopAutoplayBitmap.x = 16;
            stopAutoplayBitmap.y = 27;
            stopAutoplayBitmap.interactive = false;
            this.addChild(stopAutoplayBitmap);
            this.x = game.BaseGameUIConstants.kDesktopAutoplayButtonX;
            this.y = game.BaseGameUIConstants.kDesktopAutoplayButtonY;
            rendering.InputManager.registerObject(this);
            this.addEventListener(rendering.InputEvent.DOWN, this.onPress, this);
            this.hide();
        };
        StopAutoplayButtonView.prototype.onPress = function () {
            this.dispatchEvent(new game.AutoPlayModelEvent(game.AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED, 0));
            this.hide();
        };
        StopAutoplayButtonView.prototype.show = function () {
            this.visible = true;
        };
        StopAutoplayButtonView.prototype.hide = function () {
            this.visible = false;
        };
        __decorate([
            inject('AssetCache')
        ], StopAutoplayButtonView.prototype, "_cache", void 0);
        return StopAutoplayButtonView;
    }(game.ButtonView));
    game.StopAutoplayButtonView = StopAutoplayButtonView;
})(game || (game = {}));
var game;
(function (game) {
    var StopAutoplayButtonViewMediator = (function (_super) {
        __extends(StopAutoplayButtonViewMediator, _super);
        function StopAutoplayButtonViewMediator() {
            _super.apply(this, arguments);
        }
        StopAutoplayButtonViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this._view = this.getViewComponent();
            this.addContextListener(game.AutoPlayModelEvent.STARTED, this.onAutoplayStarted);
            this.addContextListener(game.AutoPlayModelEvent.STOPPED, this.onAutoplayStopped);
            this._view.addEventListener(game.AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED, this.broadcastGameEvent, this);
        };
        StopAutoplayButtonViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.AutoPlayModelEvent.STARTED, this.onAutoplayStarted);
            this.removeContextListener(game.AutoPlayModelEvent.STOPPED, this.onAutoplayStopped);
            this._view.removeEventListener(game.AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED, this.broadcastGameEvent, this);
        };
        StopAutoplayButtonViewMediator.prototype.broadcastGameEvent = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        StopAutoplayButtonViewMediator.prototype.onAutoplayStarted = function () {
            this._view.show();
        };
        StopAutoplayButtonViewMediator.prototype.onAutoplayStopped = function () {
            this._view.hide();
        };
        return StopAutoplayButtonViewMediator;
    }(dragonwings.Mediator));
    game.StopAutoplayButtonViewMediator = StopAutoplayButtonViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var AutoRepeatButtonEvent = (function (_super) {
        __extends(AutoRepeatButtonEvent, _super);
        function AutoRepeatButtonEvent(eventName, sender, id) {
            _super.call(this, eventName);
            this._sender = sender;
            this._id = id;
        }
        Object.defineProperty(AutoRepeatButtonEvent.prototype, "sender", {
            get: function () { return this._sender; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(AutoRepeatButtonEvent.prototype, "id", {
            get: function () { return this._id; },
            enumerable: true,
            configurable: true
        });
        AutoRepeatButtonEvent.DOWN = "AutoRepeatButtonEvent_DOWN";
        AutoRepeatButtonEvent.UP = "AutoRepeatButtonEvent_UP";
        AutoRepeatButtonEvent.OUT = "AutoRepeatButtonEvent_OUT";
        return AutoRepeatButtonEvent;
    }(borgevent.Event));
    game.AutoRepeatButtonEvent = AutoRepeatButtonEvent;
    var AutoRepeatButtonView = (function (_super) {
        __extends(AutoRepeatButtonView, _super);
        function AutoRepeatButtonView(upAsset, downAsset, overAsset, disabledAsset) {
            _super.call(this, upAsset, downAsset, overAsset, disabledAsset);
            this.addEventListener(rendering.InputEvent.DOWN, this.onBtnDown, this);
            this.addEventListener(rendering.InputEvent.UP, this.onBtnUp, this);
            this.addEventListener(rendering.InputEvent.OUT, this.onBtnOut, this);
            this._repeatRate = 0.1; // default repeat rate = 1/10s
            //this._acceleration = 1;     // no acceleration by default
        }
        Object.defineProperty(AutoRepeatButtonView.prototype, "repeatRate", {
            get: function () {
                return this._repeatRate;
            },
            set: function (value) {
                this._repeatRate = value;
            },
            enumerable: true,
            configurable: true
        });
        AutoRepeatButtonView.prototype.setMouseoverCursor = function (cursor) {
            var _this = this;
            if (cursor === void 0) { cursor = "pointer"; }
            this.addEventListener(rendering.InputEvent.OVER, function () {
                if (_this.enabled) {
                    document.body.style.cursor = cursor;
                }
            }, this);
            this.addEventListener(rendering.InputEvent.OUT, function () {
                document.body.style.cursor = "default";
            }, this);
        };
        Object.defineProperty(AutoRepeatButtonView.prototype, "buttonId", {
            get: function () {
                return this._buttonId;
            },
            /**
             * Parameter in the range [0, 1] to determine percentage increase in
             * repeat rate per event generated
             */
            /*public set acceleration(value: number) {
                this._acceleration = value;
            }
    
            public get acceleration(): number {
                return this._acceleration;
            }*/
            set: function (value) {
                this._buttonId = value;
            },
            enumerable: true,
            configurable: true
        });
        AutoRepeatButtonView.prototype.onBtnDown = function (e) {
            var _this = this;
            Utils.PSLog.log("AutoRepeatButtonView::onBtnDown()");
            this.resetTween();
            this._repeatCount = 0;
            this._activeTween = new TimelineMax({
                repeat: -1,
                repeatDelay: this._repeatRate,
                onStart: function () {
                    var buttonEvent = new AutoRepeatButtonEvent(AutoRepeatButtonEvent.DOWN, _this, _this._repeatCount);
                    _this.dispatchEvent(buttonEvent);
                },
                onRepeat: function () {
                    _this._repeatCount++;
                    var buttonEvent = new AutoRepeatButtonEvent(AutoRepeatButtonEvent.DOWN, _this, _this._repeatCount);
                    _this.dispatchEvent(buttonEvent);
                    // NOTE: Shou;d update this to be externally configurable when we have time
                    var newTS = _this._repeatCount > 8 ? 12 : (_this._repeatCount > 4) ? 6 : 1;
                    //Utils.PSLog.log(`repeatCount: ${this._repeatCount} newTS: ${newTS}`);
                    _this._activeTween.timeScale(newTS);
                },
                onRepeatScope: this,
            });
        };
        AutoRepeatButtonView.prototype.onBtnUp = function (e) {
            Utils.PSLog.log("AutoRepeatButtonView::onBtnUp()");
            this.resetTween();
            var buttonEvent = new AutoRepeatButtonEvent(AutoRepeatButtonEvent.UP, this, this._repeatCount);
            this.dispatchEvent(buttonEvent);
        };
        AutoRepeatButtonView.prototype.onBtnOut = function (e) {
            Utils.PSLog.log("AutoRepeatButtonView::onBtnOut()");
            this.resetTween();
            var buttonEvent = new AutoRepeatButtonEvent(AutoRepeatButtonEvent.OUT, this, this._repeatCount);
            this.dispatchEvent(buttonEvent);
        };
        AutoRepeatButtonView.prototype.resetTween = function () {
            if (this._activeTween) {
                this._activeTween.pause();
                this._activeTween.kill();
                this._activeTween = undefined;
            }
        };
        return AutoRepeatButtonView;
    }(components.Button));
    game.AutoRepeatButtonView = AutoRepeatButtonView;
})(game || (game = {}));
var game;
(function (game) {
    var BaseInfoBarMeterMediator = (function (_super) {
        __extends(BaseInfoBarMeterMediator, _super);
        function BaseInfoBarMeterMediator() {
            _super.apply(this, arguments);
            this._totalFGWinningsWithoutNextSpin = 0;
            this._isMaxWin = false;
            this._isInFG = false;
            this._isRecovering = false;
        }
        BaseInfoBarMeterMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.addContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
            this.addContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.addContextListener(game.AutoPlayModelEvent.STOPPED, this.onAutoplayStopped);
            this.addContextListener(components.CyclerEvent.ON_NEXT_RESULT, this.onNextCycle);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.addContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSGame);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "reelsSpinning"), this.onSpinStarted);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "reelsSpinning"), this.onFreeSpinStarted);
            this.addContextListener(game.GameEvent.RECOVERY_SPIN, this.onRecoverySpin);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "checkingForExtraFreeSpins"), this.onStakeChange);
            this.addContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBG);
            this.addContextListener(game.GameEvent.HAS_MAX_WIN, this.onShowingMaxWinComplete);
            this.addContextListener(game.GameEvent.SHOW_MAX_WIN_COMPLETE, this.onShowingMaxWinComplete);
            this.addContextListener(game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME, this.onRecoveryIntoFSGame);
        };
        BaseInfoBarMeterMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
            this.removeContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.removeContextListener(game.AutoPlayModelEvent.STOPPED, this.onAutoplayStopped);
            this.removeContextListener(components.CyclerEvent.ON_NEXT_RESULT, this.onNextCycle);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.removeContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSGame);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "reelsSpinning"), this.onSpinStarted);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "reelsSpinning"), this.onFreeSpinStarted);
            this.removeContextListener(game.GameEvent.RECOVERY_SPIN, this.onRecoverySpin);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "checkingForExtraFreeSpins"), this.onStakeChange);
            this.removeContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBG);
            this.removeContextListener(game.GameEvent.HAS_MAX_WIN, this.onShowingMaxWinComplete);
            this.removeContextListener(game.GameEvent.SHOW_MAX_WIN_COMPLETE, this.onShowingMaxWinComplete);
            this.removeContextListener(game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME, this.onRecoveryIntoFSGame);
        };
        BaseInfoBarMeterMediator.prototype.setView = function (view) {
            this._view = view;
        };
        Object.defineProperty(BaseInfoBarMeterMediator.prototype, "view", {
            get: function () {
                return this._view;
            },
            enumerable: true,
            configurable: true
        });
        BaseInfoBarMeterMediator.prototype.setInitialValue = function () {
            this.setText("");
        };
        BaseInfoBarMeterMediator.prototype.onSpinStarted = function () {
            if (this._autoPlayModel.isInProgress() || this._isInFG) {
                return;
            }
            this.setText(this._translator.findByKey("framework_com_wms_framework_MsgBar_GoodLuck"));
        };
        BaseInfoBarMeterMediator.prototype.onRecoveryIntoFSGame = function () {
            this._isInFG = true;
            this._isRecovering = true;
        };
        BaseInfoBarMeterMediator.prototype.onRecoverySpin = function () {
            if (!this._isInFG) {
                return;
            }
            this.onFreeSpinStarted();
        };
        BaseInfoBarMeterMediator.prototype.onFreeSpinStarted = function () {
            var logicResponse = this._server.getLogicResponse();
            var freeSpinsRemaining;
            var freeSpinsRemainingText;
            if (this._isRecovering) {
                this._totalFGWinningsWithoutNextSpin = logicResponse.fsWinnings - logicResponse.spinWins;
                this._isRecovering = false;
                this._isInFG = false;
            }
            freeSpinsRemaining = logicResponse.fsSpinsTotal - logicResponse.fsSpinNumber;
            // Do not display any extra free spins in the info bar prematurely
            freeSpinsRemaining -= logicResponse.fsAwarded;
            freeSpinsRemainingText = this._translator.findByKey("framework_com_wms_framework_AutoPlay_FreeGamesRemaining");
            freeSpinsRemainingText = freeSpinsRemainingText.replace(/\{0\}/, freeSpinsRemaining.toString());
            freeSpinsRemainingText = freeSpinsRemainingText.replace(/\{1\}/, this._currencyFormatter.format(this._totalFGWinningsWithoutNextSpin) || "0.00");
            this.setText(freeSpinsRemainingText);
            this._totalFGWinningsWithoutNextSpin = logicResponse.fsWinnings;
        };
        BaseInfoBarMeterMediator.prototype.onNextAutoplay = function () {
            var autoplaysRemainingText = this._translator.findByKey("framework_com_wms_framework_AutoPlay_GamesRemaining");
            autoplaysRemainingText = autoplaysRemainingText.replace(/\{0\}/, this._autoPlayModel.numSpins.toString());
            this.setText(autoplaysRemainingText);
        };
        BaseInfoBarMeterMediator.prototype.onAutoplayStopped = function () {
            this.onStakeChange();
        };
        BaseInfoBarMeterMediator.prototype.onNextCycle = function (e) {
            var winValue = e.result.winAmount;
            var winLine = e.result.payline + 1;
            var formattedWinValue = this._currencyFormatter.format(winValue);
            this._view.visible = true;
            var infoStr = this._translator.findByKey("framework_com_wms_framework_MsgBar_LinePay");
            infoStr = infoStr.replace(/\{0\}/, winLine.toString());
            infoStr = infoStr.replace(/\{1\}/, formattedWinValue);
            this.setText(infoStr);
        };
        BaseInfoBarMeterMediator.prototype.onStakeChange = function () {
            if (!this._freeGamesModel.isInProgress()) {
                var lines = this._stakeModel.getLines();
                var stake = this._stakeModel.getStakePerLine();
                var totalBet = this._stakeModel.getTotalStake();
                var linesFmttd = lines.toString();
                var stakeFmttd = this._currencyFormatter.format(stake);
                var totalBetFmttd = this._currencyFormatter.format(totalBet);
                var translation = this._translator.findByKey("framework_com_wms_framework_MsgBar_DetailedBetFormula");
                translation = translation.replace(/\{4\}/, linesFmttd);
                translation = translation.replace(/\{1\}/, stakeFmttd);
                translation = translation.replace(/\{3\}/, totalBetFmttd);
                this.setText(translation);
            }
        };
        BaseInfoBarMeterMediator.prototype.onEnterFSGame = function () {
            this._view.setText(this._translator.findByKey("framework_com_wms_framework_MsgBar_ZeroValueScatterPay"));
        };
        BaseInfoBarMeterMediator.prototype.onReturnToBG = function () {
            var logicResponse = this._server.getLogicResponse();
            var featurePayText = this._translator.findByKey("Game_Locales_FeaturePay");
            featurePayText = featurePayText.replace(/\{0\}/, this._currencyFormatter.format(logicResponse.fsWinnings));
            this._view.setText(featurePayText);
            // Reset total FG winnings for potential next free game
            this._totalFGWinningsWithoutNextSpin = 0;
        };
        BaseInfoBarMeterMediator.prototype.onEndResponse = function () {
            if (!this._freeGamesModel.isInProgress() && !this._autoPlayModel.isInProgress() && !this._isMaxWin) {
                this.onStakeChange();
            }
            if (this._isMaxWin) {
                this._isMaxWin = false;
            }
        };
        BaseInfoBarMeterMediator.prototype.onShowingMaxWinComplete = function () {
            this._isMaxWin = true;
            var initResponse = this._server.getInitResponse();
            var maxWinText = this._translator.findByKey("framework_com_wms_framework_WinCap_MaxAmountAchieved");
            maxWinText = maxWinText.replace(/\{0\}/, this._currencyFormatter.format(initResponse.maxWinValue));
            this.setText(maxWinText);
        };
        BaseInfoBarMeterMediator.prototype.setText = function (text) {
            this._view.setText(text);
        };
        __decorate([
            inject('AutoPlayModel')
        ], BaseInfoBarMeterMediator.prototype, "_autoPlayModel", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], BaseInfoBarMeterMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('GameServer')
        ], BaseInfoBarMeterMediator.prototype, "_server", void 0);
        __decorate([
            inject('ITranslator')
        ], BaseInfoBarMeterMediator.prototype, "_translator", void 0);
        __decorate([
            inject('StakeModel')
        ], BaseInfoBarMeterMediator.prototype, "_stakeModel", void 0);
        __decorate([
            inject('WinInfoModel')
        ], BaseInfoBarMeterMediator.prototype, "_winInfoModel", void 0);
        __decorate([
            inject('FreeSpinsGameModel')
        ], BaseInfoBarMeterMediator.prototype, "_freeGamesModel", void 0);
        return BaseInfoBarMeterMediator;
    }(dragonwings.Mediator));
    game.BaseInfoBarMeterMediator = BaseInfoBarMeterMediator;
})(game || (game = {}));
var game;
(function (game) {
    var BaseWinMeterMediator = (function (_super) {
        __extends(BaseWinMeterMediator, _super);
        function BaseWinMeterMediator() {
            _super.apply(this, arguments);
            this._currentIncrementTo = 0;
            this._currentIncrementMultiple = 0;
            this._currentRunningTotalWon = 0;
            this._returningFromFSGame = false;
            this._hasMaxWin = false;
        }
        BaseWinMeterMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.addContextListener(game.GameEvent.HAS_MAX_WIN, this.onHasMaxWin);
            this.addContextListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onFGButtonPressed);
        };
        BaseWinMeterMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.HAS_MAX_WIN, this.onHasMaxWin);
            this.removeContextListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onFGButtonPressed);
        };
        BaseWinMeterMediator.prototype.setView = function (view) {
            this._view = view;
        };
        Object.defineProperty(BaseWinMeterMediator.prototype, "view", {
            get: function () {
                return this._view;
            },
            enumerable: true,
            configurable: true
        });
        BaseWinMeterMediator.prototype.setWin = function (value) {
            var formattedValue = "";
            if (value > 0) {
                formattedValue += this._currencyFormatter.format(value);
            }
            this._view.value = formattedValue;
            if (value == 0) {
                this.updatePartner(value);
            }
        };
        BaseWinMeterMediator.prototype.initBigWinSounds = function (bigWinLevel, additionalWinnings) {
            var _this = this;
            this._currentIncrementTo = this._currentRunningTotalWon + additionalWinnings;
            // Create a new TimelineMax object
            this._bigWinTimeline = new TimelineMax();
            this._bigWinLevel = bigWinLevel;
            // If bigWinLevel > 0, then we must start the big win sound immediately
            if (bigWinLevel > 0) {
                this._bigWinTimeline.add(function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.PLAY_BIG_WIN_SOUND, _this));
                }, 0);
                this._bigWinTimeline.add(function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.PLAY_BIG_WIN_VOICE, _this));
                }, 1.967);
                this._bigWinTimeline.add(function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.SHOW_BIG_WIN, _this));
                    if (bigWinLevel > 1) {
                        _this._currentIncrementMultiple = Math.floor((_this._stakeModel.getTotalBet() * game.GameConstants.BIG_WIN_MULTIPLIER) / 245);
                    }
                    else {
                        _this._currentIncrementMultiple = _this.getRemainingWinAmountToTween();
                        _this._bigWinTimeline.add(function () {
                            _this.completeIncrementWinAmountTween();
                        }, 15.207);
                    }
                    new TweenMax(_this, game.BaseGameUIConstants.kWinMeterIncrementDelay, {
                        repeat: -1,
                        onRepeat: _this.onIncrementWinAmount,
                        onRepeatScope: _this
                    });
                }, 3);
                // Big wins can only be skipped after 7 seconds have passed
                this._bigWinTimeline.add(function () {
                    _this._winInfoModel.canPaylinesBeSkipped = true;
                }, 7);
            }
            if (bigWinLevel > 1) {
                this._bigWinTimeline.add(function () { _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.PLAY_SUPER_WIN_SOUND, _this)); }, 9.367);
                this._bigWinTimeline.add(function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.STOP_BIG_WIN_SOUND, _this));
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.SHOW_SUPER_WIN, _this));
                    // At this point we will need to adjust the "increment by" value, if this is the final big win segment
                    if (bigWinLevel > 2) {
                        _this._currentIncrementMultiple = Math.floor((_this._stakeModel.getTotalBet() * game.GameConstants.SUPER_WIN_MULTIPLIER) / 245);
                    }
                    else {
                        _this._currentIncrementMultiple = _this.getRemainingWinAmountToTween();
                        _this._bigWinTimeline.add(function () {
                            _this.completeIncrementWinAmountTween();
                        }, 24.685);
                    }
                }, 12.533);
                this._bigWinTimeline.add(function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.PLAY_SUPER_WIN_VOICE, _this));
                }, 14.333);
            }
            if (bigWinLevel > 2) {
                this._bigWinTimeline.add(function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.PLAY_MEGA_WIN_SOUND, _this));
                }, 18.733);
                this._bigWinTimeline.add(function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.STOP_SUPER_WIN_SOUND, _this));
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.SHOW_MEGA_WIN, _this));
                    _this._currentIncrementMultiple = _this.getRemainingWinAmountToTween();
                }, 21.9);
                this._bigWinTimeline.add(function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.PLAY_MEGA_WIN_VOICE, _this));
                }, 23.7);
                this._bigWinTimeline.add(function () {
                    _this.completeIncrementWinAmountTween();
                }, 34.067);
            }
            if (bigWinLevel === 0) {
                this._winInfoModel.canPaylinesBeSkipped = true;
                // this._currentIncrementMultiple = Math.max(1, Math.round(Math.ceil(additionalWinnings / this._stakeModel.getTotalBet()) * (this._stakeModel.getStakePerLine() / 4)));
                this._currentIncrementMultiple = Utils.MiscUtils.getWinMeterIncrementMultiple(additionalWinnings, this._stakeModel.getTotalBet(), this._stakeModel.getStakePerLine());
                var incrementStartDelay = 0;
                if (this._returningFromFSGame) {
                    incrementStartDelay = 3;
                }
                TweenLite.delayedCall(incrementStartDelay, function () {
                    new TweenMax(_this, game.BaseGameUIConstants.kWinMeterIncrementDelay, {
                        repeat: -1,
                        onRepeat: _this.onIncrementWinAmount,
                        onRepeatScope: _this
                    });
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.PLAY_WIN_BANG_UP, _this));
                });
            }
            else {
                this._winInfoModel.canPaylinesBeSkipped = false;
            }
        };
        BaseWinMeterMediator.prototype.getBigWinLevel = function (totalWonFromCascade) {
            var bigWinLevel = 0;
            if (totalWonFromCascade >= (this._stakeModel.getTotalBet() * game.GameConstants.BIG_WIN_MULTIPLIER))
                bigWinLevel++;
            if (totalWonFromCascade >= (this._stakeModel.getTotalBet() * game.GameConstants.SUPER_WIN_MULTIPLIER))
                bigWinLevel++;
            if (totalWonFromCascade >= (this._stakeModel.getTotalBet() * game.GameConstants.MEGA_WIN_MULTIPLIER))
                bigWinLevel++;
            return bigWinLevel;
        };
        BaseWinMeterMediator.prototype.onIncrementWinAmount = function () {
            if (this._currentRunningTotalWon >= this._currentIncrementTo) {
                this.completeIncrementWinAmountTween();
            }
            else {
                this._currentRunningTotalWon += this._currentIncrementMultiple;
                this._winInfoModel.runningTotalWinnings = this._currentRunningTotalWon;
                if (this._currentRunningTotalWon > this._currentIncrementTo) {
                    this._currentRunningTotalWon = this._currentIncrementTo;
                }
                this.setWin(this._currentRunningTotalWon);
            }
        };
        BaseWinMeterMediator.prototype.completeIncrementWinAmountTween = function (didSkipPaycycles) {
            var _this = this;
            if (didSkipPaycycles === void 0) { didSkipPaycycles = false; }
            // Ensure Tweens are killed off
            TweenMax.killTweensOf(this);
            // Kill the big win timeline to ensure no more sounds or particles are emitted
            if (this._bigWinTimeline) {
                this._bigWinTimeline.kill();
            }
            // Reset current increment multiple and update running total won so that it's brought in line with correct winnings thus far
            this._currentIncrementMultiple = 0;
            this._currentRunningTotalWon = this._currentIncrementTo;
            // Immediately display the amount won
            this.setWin(this._currentRunningTotalWon);
            this.updatePartner(this._currentRunningTotalWon);
            // If we are in a free game, update the free game model winnings, otherwise update the win info model
            this._winInfoModel.runningTotalWinnings = this._currentRunningTotalWon;
            if (!this._winInfoModel.winCountUpComplete) {
                if (!this._returningFromFSGame) {
                    this.doGlobalDispatch(new game.GameEvent(game.GameEvent.WIN_COUNT_UP_COMPLETE, this, didSkipPaycycles));
                }
                if (game.BigMegaWinParticlesView.isActive) {
                    this.doGlobalDispatch(new game.GameEvent(game.GameEvent.REMOVE_BIG_WIN_PARTICLES, this));
                }
                TweenMax.delayedCall(1.5, function () {
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.STOP_BIG_WIN_SOUNDS, _this));
                    _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY, _this));
                });
                // Set flag to say win meter count up has completed
                game.CheckIfCanCascadeCmd.winMeterCountUpComplete = true;
                this._winInfoModel.winCountUpComplete = true;
            }
            // If the player is returning from FS game, then we must wait until the combined winnings have been counted up before re-enabling the buttons
            if (this._returningFromFSGame) {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.WIN_COUNT_UP_COMPLETE, this, didSkipPaycycles));
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.FINALISED_TOTAL_WINNINGS_FROM_BASE_AND_FREE_GAME, this));
                this._returningFromFSGame = false;
            }
            // this._winInfoModel.canPaylinesBeSkipped = false;
        };
        BaseWinMeterMediator.prototype.getRemainingWinAmountToTween = function () {
            return Math.floor((this._currentIncrementTo - this._currentRunningTotalWon) / 245);
        };
        BaseWinMeterMediator.prototype.onSpinButtonPressed = function () {
            this._view.visible = true;
            this.resetValues();
            this.setWin(0);
        };
        BaseWinMeterMediator.prototype.onStakeChange = function () {
            this.setWin(0);
        };
        BaseWinMeterMediator.prototype.onPayCycleOverlayPressed = function () {
            if (this._winInfoModel.canPaylinesBeSkipped) {
                if (game.BigMegaWinParticlesView.isActive) {
                    this.doGlobalDispatch(new game.GameEvent(game.GameEvent.BIG_WIN_SKIPPED, this, this._bigWinLevel));
                }
                this._cyclersModel.stopCyclers();
                this.completeIncrementWinAmountTween(true);
            }
        };
        BaseWinMeterMediator.prototype.onEnterFSGame = function () {
            this.resetValues();
        };
        BaseWinMeterMediator.prototype.onFGButtonPressed = function () {
            this.setWin(0);
        };
        BaseWinMeterMediator.prototype.resetValues = function () {
            this._currentIncrementTo = 0;
            this._currentIncrementMultiple = 0;
            this._currentRunningTotalWon = 0;
            this._winInfoModel.clear();
        };
        BaseWinMeterMediator.prototype.updatePartner = function (amount) {
            if (this._partnerAdapterEventModel.winDisplayEventListener) {
                var event = new util.WinDisplayEvent(amount);
                this._partnerAdapterEventModel.winDisplayEventListener.handleWinDisplayEvent(event);
            }
        };
        BaseWinMeterMediator.prototype.doGlobalDispatch = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        BaseWinMeterMediator.prototype.onHasMaxWin = function () {
            this._hasMaxWin = true;
        };
        __decorate([
            inject('CyclersModel')
        ], BaseWinMeterMediator.prototype, "_cyclersModel", void 0);
        __decorate([
            inject('WinInfoModel')
        ], BaseWinMeterMediator.prototype, "_winInfoModel", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], BaseWinMeterMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('GameServer')
        ], BaseWinMeterMediator.prototype, "_server", void 0);
        __decorate([
            inject('ITranslator')
        ], BaseWinMeterMediator.prototype, "_translator", void 0);
        __decorate([
            inject('PartnerAdapterEventModel')
        ], BaseWinMeterMediator.prototype, "_partnerAdapterEventModel", void 0);
        __decorate([
            inject('StakeModel')
        ], BaseWinMeterMediator.prototype, "_stakeModel", void 0);
        return BaseWinMeterMediator;
    }(dragonwings.Mediator));
    game.BaseWinMeterMediator = BaseWinMeterMediator;
})(game || (game = {}));
var rendering;
(function (rendering) {
    var CustomMovieClip = (function (_super) {
        __extends(CustomMovieClip, _super);
        function CustomMovieClip(frames) {
            _super.call(this, frames);
            this._repetitions = 1;
            this._onCompleteCallback = null;
            this._isPlaying = false;
            this.delay = 0;
            this.destroyOnComplete = false;
            this.hideOnComplete = false;
        }
        Object.defineProperty(CustomMovieClip.prototype, "anchor", {
            // public set loop(shouldLoop: boolean) {
            //     this.getNativeDisplayObject().loop = shouldLoop;
            // }
            set: function (anchorPoint) {
                this.getNativeDisplayObject().anchor = anchorPoint;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(CustomMovieClip.prototype, "point", {
            get: function () {
                return this.getNativeDisplayObject().anchor;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(CustomMovieClip.prototype, "repetitions", {
            get: function () {
                return this._repetitions;
            },
            set: function (timesToRepeat) {
                this._repetitions = timesToRepeat ? timesToRepeat : 1;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(CustomMovieClip.prototype, "onCompleteCallback", {
            get: function () {
                return this._onCompleteCallback;
            },
            set: function (callback) {
                this._onCompleteCallback = callback;
            },
            enumerable: true,
            configurable: true
        });
        CustomMovieClip.prototype.addChildAnim = function (symbolFrames) {
            var childAnim = new CustomMovieClip(symbolFrames);
            this.addChild(childAnim);
            return childAnim;
        };
        CustomMovieClip.prototype.playDelayedLoop = function (delay) {
            if (delay === void 0) { delay = 1000; }
            setTimeout(this.play.bind(this), delay);
        };
        CustomMovieClip.prototype.playRepetitions = function (repetitions) {
            if (!this._isPlaying) {
                this._isPlaying = true;
                repetitions = repetitions ? repetitions : this._repetitions;
                var intervalSecs = this._interval / 1000;
                for (var i = 1; i <= this.totalFrames * repetitions; i++) {
                    TweenLite.delayedCall(this.delay + (intervalSecs * i), this.nextFrame, null, this);
                }
                TweenLite.delayedCall(this.delay + ((this.totalFrames * intervalSecs) * repetitions), this.finish, null, this);
            }
        };
        CustomMovieClip.prototype.playRange = function (from, to, callback) {
            if (to === void 0) { to = this.totalFrames; }
            if (!this._isPlaying) {
                this._isPlaying = true;
                if (callback) {
                    this.onCompleteCallback = callback;
                }
                var totalFrames = to - from;
                var intervalSecs = this._interval / 1000;
                for (var i = 1; i <= totalFrames; i++) {
                    TweenLite.delayedCall(this.delay + (intervalSecs * i), this.nextFrame, null, this);
                }
                TweenLite.delayedCall(this.delay + ((totalFrames * intervalSecs)), this.finish, null, this);
            }
        };
        CustomMovieClip.prototype.playCustom = function (indexes) {
            var intervalSecs = this._interval / 1000;
            for (var i = 0; i < indexes.length; i++) {
                TweenLite.delayedCall(this.delay + (intervalSecs * i), this.setFrame.bind(this, indexes[i]), null, this);
            }
            TweenLite.delayedCall(this.delay + ((indexes.length * intervalSecs)), this.finish, null, this);
        };
        CustomMovieClip.prototype.setMouseoverCursor = function (cursor) {
            if (cursor === void 0) { cursor = "pointer"; }
            var native = this.getNativeDisplayObject();
            native.on("mouseover", function () {
                document.body.style.cursor = cursor;
            });
            native.on("mouseout", function () {
                document.body.style.cursor = "default";
            });
        };
        CustomMovieClip.prototype.setFrame = function (frame) {
            this.currentFrame = frame;
        };
        CustomMovieClip.prototype.nextFrame = function () {
            this.gotoNextFrame();
        };
        CustomMovieClip.prototype.reset = function () {
            this.gotoAndStop(0);
        };
        CustomMovieClip.prototype.finish = function () {
            this.visible = this.hideOnComplete ? false : this.visible;
            if (this.destroyOnComplete) {
                this.destroy();
            }
            if (this._onCompleteCallback) {
                this._onCompleteCallback();
            }
            this._isPlaying = false;
        };
        CustomMovieClip.prototype.destroy = function () {
            this.parent.removeChild(this);
        };
        return CustomMovieClip;
    }(rendering.MovieClip));
    rendering.CustomMovieClip = CustomMovieClip;
})(rendering || (rendering = {}));
var game;
(function (game) {
    var LayerViews = (function () {
        function LayerViews() {
        }
        LayerViews.BASE = "BASE";
        LayerViews.REELS = "REELS";
        LayerViews.REELS_OVERLAY = "REELS_OVERLAY";
        LayerViews.FIVE_OF_A_KIND = "FIVE_OF_A_KIND";
        LayerViews.HUD = "HUD";
        LayerViews.UI = "UI";
        LayerViews.FS_UI = "FS_UI";
        LayerViews.FREE_SPINS_INTRO = "FREE_SPINS_INTRO";
        LayerViews.FREE_SPINS = "FREE_SPINS";
        LayerViews.HELP = "HELP";
        LayerViews.OVERLAYS = "OVERLAYS";
        LayerViews.FOOTER = "FOOTER";
        return LayerViews;
    }());
    game.LayerViews = LayerViews;
})(game || (game = {}));
var game;
(function (game) {
    var MeterView = (function (_super) {
        __extends(MeterView, _super);
        function MeterView() {
            _super.call(this);
        }
        MeterView.prototype.setProperties = function (textX, textY, maxWidth, maxHeight, font, fontSize, colour, alignment, asset) {
            if (!this.meter) {
                this.meter = new components.Meter(textX, textY, maxWidth, maxHeight, font, fontSize, colour, alignment, asset);
                this.addChild(this.meter);
            }
        };
        Object.defineProperty(MeterView.prototype, "value", {
            set: function (text) {
                this.meter.value = text;
                if (!this.meter.image) {
                    this.meter.text.x = this.meter.text.scaleToWidth / 2 - this.meter.text.width / 2;
                    this.meter.text.y = this.meter.text.scaleToHeight / 2 - this.meter.text.height / 2;
                }
            },
            enumerable: true,
            configurable: true
        });
        return MeterView;
    }(rendering.DisplayObjectContainer));
    game.MeterView = MeterView;
})(game || (game = {}));
var game;
(function (game) {
    var SubgameView = (function (_super) {
        __extends(SubgameView, _super);
        function SubgameView() {
            _super.call(this);
            this._background = undefined;
        }
        SubgameView.prototype.getButton = function (bundle, jsonBundle, names) {
            var jsonAsset = this._cache.getAssetById(jsonBundle);
            var imgAsset = this._cache.getAssetById(bundle);
            var spritesheet = new components.SpriteSheet(jsonAsset, imgAsset);
            var button = new game.ButtonView();
            button.setAssets(
            //Standard Order = up/down/over/dim
            spritesheet.getFrameByName(names[0]), spritesheet.getFrameByName(names[1]), spritesheet.getFrameByName(names[2]), spritesheet.getFrameByName(names[3]));
            //if(this._historyReplayModel.isHistoryReplay)button.enabled = false;
            return button;
        };
        SubgameView.prototype.setBackgroundBitmap = function (bgAsset, scale) {
            if (scale === void 0) { scale = 1; }
            this.removeExistingBg();
            this._background = new rendering.Bitmap(bgAsset);
            this._background.scaleX = scale;
            this._background.scaleY = scale;
            this.addChild(this._background);
        };
        SubgameView.prototype.setBackgroundColour = function (colour) {
            this.removeExistingBg();
            var bg = Utils.MiscUtils.createBox(0, 0, 1920, 1080, 0x111111, true);
            this.addChild(bg);
        };
        SubgameView.prototype.removeExistingBg = function () {
            if (this._background) {
                this._background.parent.removeChild(this._background);
                this._background = undefined;
            }
        };
        __decorate([
            inject('AssetCache')
        ], SubgameView.prototype, "_cache", void 0);
        return SubgameView;
    }(rendering.DisplayObjectContainer));
    game.SubgameView = SubgameView;
})(game || (game = {}));
var game;
(function (game) {
    (function (ValueSpinnerDirection) {
        ValueSpinnerDirection[ValueSpinnerDirection["VERTICAL"] = 0] = "VERTICAL";
        ValueSpinnerDirection[ValueSpinnerDirection["HORIZONTAL"] = 1] = "HORIZONTAL";
    })(game.ValueSpinnerDirection || (game.ValueSpinnerDirection = {}));
    var ValueSpinnerDirection = game.ValueSpinnerDirection;
    var ValueSpinnerEvent = (function (_super) {
        __extends(ValueSpinnerEvent, _super);
        function ValueSpinnerEvent(eventName, data) {
            _super.call(this, eventName);
            this.data = data;
        }
        ValueSpinnerEvent.PREFIX = "CyclersModelEvent_";
        ValueSpinnerEvent.ON_SPINNER_SLIDE = ValueSpinnerEvent.PREFIX + "ON_SPINNER_SLIDE";
        ValueSpinnerEvent.ON_SPINNER_VALUE_CHANGED = ValueSpinnerEvent.PREFIX + "ON_SPINNER_VALUE_CHANGED";
        return ValueSpinnerEvent;
    }(borgevent.Event));
    game.ValueSpinnerEvent = ValueSpinnerEvent;
    var ValueSpinner = (function (_super) {
        __extends(ValueSpinner, _super);
        function ValueSpinner(direction) {
            if (direction === void 0) { direction = ValueSpinnerDirection.HORIZONTAL; }
            _super.call(this);
            this.dragStart = false;
            this.lowerSlideLimit = 0;
            this.upperSlideLimit = 0;
            this.direction = direction;
            this.getNativeDisplayObject().on('touchstart', this.slide, this);
            this.getNativeDisplayObject().on('touchend', this.slide, this);
            this.getNativeDisplayObject().on('touchcancel', this.slide, this);
            this.getNativeDisplayObject().on('touchendoutside', this.slide, this);
            this.getNativeDisplayObject().on('touchmove', this.slide, this);
        }
        ValueSpinner.prototype.configure = function (width, height, values, snapPos, fontSize, spacing) {
            if (fontSize === void 0) { fontSize = 85; }
            if (spacing === void 0) { spacing = 100; }
            this.width = width;
            this.height = height;
            this.snapPosition = snapPos;
            this.slideContainer = new rendering.DisplayObjectContainer();
            this.addChild(this.slideContainer);
            var mask = new rendering.Graphics();
            mask.beginFill(0xff0000, 0.5);
            mask.drawRect(0, 0, width, height);
            mask.endFill();
            mask.interactive = false;
            this.addChild(mask);
            this.snapPositions = [];
            this.values = [];
            for (var i = 0; i < values.length; i++) {
                var xPos = this.direction === ValueSpinnerDirection.HORIZONTAL ? spacing * (i) : this.width / 2;
                var yPos = this.direction === ValueSpinnerDirection.VERTICAL ? spacing * (i) : this.height / 2;
                var text = Utils.MiscUtils.createStandardText(this.slideContainer, values[i], game.BaseGameUIConstants.kFontFamily, 50, rendering.TextAlign.CENTER, 220, 200, xPos, 0, "#FFFFFF");
                text.x = 105 - (text.width / 2);
                text.y = yPos - (text.height / 2);
                text.interactive = false;
                this.values.push(text);
                var snapPt = this.direction === ValueSpinnerDirection.VERTICAL ? (snapPos - yPos) : (snapPos - xPos);
                this.snapPositions.push(snapPt);
            }
            this.slideContainer.mask = mask;
            this.slideContainer.y = snapPos;
            this.lowerSlideLimit = -(spacing * (this.values.length - 1));
            this.upperSlideLimit = this.direction === ValueSpinnerDirection.VERTICAL ? this.height : this.width;
        };
        ValueSpinner.prototype.slide = function (e) {
            if (e.type == "touchstart") {
                this.dragPrevY = e.data.getLocalPosition(e.target).y;
                this.dragStart = true;
            }
            else if (e.type == "touchmove" && this.dragStart) {
                var newY = e.data.getLocalPosition(e.target).y;
                var oldY = this.dragPrevY;
                this.dragDist = oldY - newY;
                if (this.slideContainer.y - this.dragDist > this.lowerSlideLimit && this.slideContainer.y - this.dragDist < this.upperSlideLimit) {
                    this.slideContainer.y -= this.dragDist;
                    this.dragPrevY = newY;
                    this.dispatchEvent(new ValueSpinnerEvent(ValueSpinnerEvent.ON_SPINNER_SLIDE));
                }
            }
            else if (e.type == "touchend" || e.type == "touchcancel" || e.type == "touchendoutside") {
                this.dragStart = false;
                this.focusNearestValue();
            }
        };
        ValueSpinner.prototype.findClosestNumber = function (array, goal) {
            var closest = this.snapPositions.reduce(function (prev, curr) {
                return (Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev);
            });
            return closest;
        };
        ValueSpinner.prototype.focusNearestValue = function () {
            var closest = this.findClosestNumber(this.snapPositions, this.slideContainer.y);
            this.currentValueIndex = this.snapPositions.indexOf(closest);
            TweenLite.to(this.slideContainer, 0.1, { ease: Power2.easeOut, y: closest });
            this.dispatchEvent(new ValueSpinnerEvent(ValueSpinnerEvent.ON_SPINNER_VALUE_CHANGED, this.getCurrentValue()));
        };
        ValueSpinner.prototype.setByValue = function (value) {
            for (var i = 0; i < this.values.length; i++) {
                if (this.values[i].getNativeDisplayObject().text === value) {
                    this.setByValueIndex(i);
                    break;
                }
            }
        };
        ValueSpinner.prototype.getCurrentValue = function () {
            return this.currentValueIndex;
        };
        ValueSpinner.prototype.setByValueIndex = function (i) {
            if (this.snapPositions[i]) {
                this.currentValueIndex = i;
                this.slideContainer.y = this.snapPositions[i];
            }
        };
        return ValueSpinner;
    }(rendering.DisplayObjectContainer));
    game.ValueSpinner = ValueSpinner;
})(game || (game = {}));
var game;
(function (game) {
    var FooterInfoView = (function (_super) {
        __extends(FooterInfoView, _super);
        function FooterInfoView() {
            _super.call(this, "");
        }
        FooterInfoView.prototype.construct = function () {
            this.font = game.BaseGameUIConstants.kFontFamily;
            this.fontSize = game.BaseGameUIConstants.kDesktopFooterInfoFontSize;
            this.colour = game.BaseGameUIConstants.kDesktopFooterInfoTextColour;
            this.x = game.BaseGameUIConstants.kDesktopFooterInfoX;
            this.y = game.BaseGameUIConstants.kDesktopFooterInfoY;
        };
        FooterInfoView.prototype.setText = function (text) {
            this.text = text;
            this.x = game.BaseGameUIConstants.kDesktopFooterInfoX - (this.width / 2);
        };
        return FooterInfoView;
    }(rendering.Text));
    game.FooterInfoView = FooterInfoView;
})(game || (game = {}));
var game;
(function (game) {
    var FooterInfoViewMediator = (function (_super) {
        __extends(FooterInfoViewMediator, _super);
        function FooterInfoViewMediator() {
            _super.apply(this, arguments);
        }
        FooterInfoViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.setView(this.getViewComponent());
        };
        FooterInfoViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
        };
        return FooterInfoViewMediator;
    }(game.BaseInfoBarMeterMediator));
    game.FooterInfoViewMediator = FooterInfoViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var FooterView = (function (_super) {
        __extends(FooterView, _super);
        function FooterView() {
            _super.call(this);
        }
        FooterView.prototype.construct = function () {
            // Footer background image
            Utils.MiscUtils.addBitmap(this, this._cache, game.BaseGameBundle, "CF_BaseUI", "sgi_databar_desktop.png", 0, 0, false, this._device.getScalar());
            // Clock
            this.addChild(this._clockView);
            // Game name text
            Utils.MiscUtils.createText(this, game.BaseGameUIConstants.kDesktopFooterGameNameText, game.BaseGameUIConstants.kDesktopFooterGameNameFontSize, rendering.TextAlign.CENTER, [350, 100], [game.BaseGameUIConstants.kDesktopFooterGameNameX, game.BaseGameUIConstants.kDesktopFooterGameNameY], game.BaseGameUIConstants.kDesktopFooterGameNameTextColour, "#000000", 3);
            this.y = game.BaseGameUIConstants.kDesktopFooterY;
        };
        __decorate([
            inject('AssetCache')
        ], FooterView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], FooterView.prototype, "_device", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], FooterView.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('ClockView')
        ], FooterView.prototype, "_clockView", void 0);
        return FooterView;
    }(rendering.DisplayObjectContainer));
    game.FooterView = FooterView;
})(game || (game = {}));
var game;
(function (game) {
    var ForceButtonView = (function (_super) {
        __extends(ForceButtonView, _super);
        function ForceButtonView() {
            _super.call(this);
            this._isOpen = false;
        }
        ForceButtonView.prototype.construct = function (isDesktop) {
            var g = new rendering.Graphics();
            g.lineStyle(4, 0x000000, 1);
            g.beginFill(0xdd0000, 1);
            g.drawRect(0, 0, 200, 75);
            g.endFill();
            g.x = game.BaseGameUIConstants.kForceButtonX;
            g.y = game.BaseGameUIConstants.kForceButtonY;
            this._txt = new rendering.Text("FORCE");
            this._txt.fontSize = 50;
            this._txt.colour = game.BaseGameUIConstants.kForceButtonTextColour;
            this._txt.font = game.BaseGameUIConstants.kFontFamily;
            this._txt.y = (g.height / 2) - (this._txt.height / 2);
            this._txt.x = (g.width / 2) - (this._txt.width / 2);
            this._txt.interactive = false;
            if (!isDesktop) {
                this.scaleX = this.scaleY = 0.65;
                g.y += 50;
            }
            g.addChild(this._txt);
            this.addChild(g);
            this.addEventListener(rendering.InputEvent.UP, this.onGraphicsClick, this);
        };
        ForceButtonView.prototype.onGraphicsClick = function () {
            this._isOpen = !this._isOpen;
            // Enable force only when the force view is closed
            if (!this._isOpen) {
                this._forceModel.setEnabled(true, true);
                this.dispatchEvent(new game.GameEvent(game.GameEvent.FORCE_VIEW_CLOSED, this));
                this._txt.text = "FORCE";
            }
            else {
                this.dispatchEvent(new game.GameEvent(game.GameEvent.FORCE_VIEW_OPENED, this));
                this._forceModel.setEnabled(false, true);
                this._txt.text = "CLOSE";
            }
        };
        __decorate([
            inject('ForceModel')
        ], ForceButtonView.prototype, "_forceModel", void 0);
        return ForceButtonView;
    }(rendering.DisplayObjectContainer));
    game.ForceButtonView = ForceButtonView;
})(game || (game = {}));
var game;
(function (game) {
    var ForceButtonViewMediator = (function (_super) {
        __extends(ForceButtonViewMediator, _super);
        function ForceButtonViewMediator() {
            _super.apply(this, arguments);
        }
        ForceButtonViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(server.ServerResponseEvent.LOGIC_RESPONSE, this.onLogicResponse);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.addContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this.view.addEventListener(game.GameEvent.FORCE_VIEW_OPENED, this.doGlobalDispatch, this);
            this.view.addEventListener(game.GameEvent.FORCE_VIEW_CLOSED, this.doGlobalDispatch, this);
        };
        ForceButtonViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(server.ServerResponseEvent.LOGIC_RESPONSE, this.onLogicResponse);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.removeContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this.view.removeEventListener(game.GameEvent.FORCE_VIEW_OPENED, this.doGlobalDispatch, this);
            this.view.removeEventListener(game.GameEvent.FORCE_VIEW_CLOSED, this.doGlobalDispatch, this);
        };
        ForceButtonViewMediator.prototype.onLogicResponse = function () {
            this.view.visible = false;
        };
        ForceButtonViewMediator.prototype.onEndResponse = function () {
            this.view.visible = true;
        };
        ForceButtonViewMediator.prototype.onHardReset = function () {
            this.view.visible = true;
        };
        ForceButtonViewMediator.prototype.doGlobalDispatch = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        return ForceButtonViewMediator;
    }(dragonwings.Mediator));
    game.ForceButtonViewMediator = ForceButtonViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var ForceView = (function (_super) {
        __extends(ForceView, _super);
        function ForceView() {
            _super.call(this);
            this._isDesktop = false;
            this._reelIndexTexts = [];
        }
        ForceView.prototype.construct = function () {
            this._isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            function onPlusButtonPressed(e) {
                var clickedIndex = this.children.indexOf(e.displayObject) / 2;
                console.log('clickedIndex', clickedIndex);
                var currentForcePositions = this._forceModel.positions;
                if (currentForcePositions[clickedIndex] >= game.BaseGameUIConstants.kBaseReelLengths[clickedIndex] - 1) {
                    currentForcePositions[clickedIndex] = 0;
                }
                else {
                    currentForcePositions[clickedIndex] += 1;
                }
                this._forceModel.setPositions(currentForcePositions, true);
            }
            function onMinusButtonPressed(e) {
                var clickedIndex = this.children.indexOf(e.displayObject) % 5;
                var currentForcePositions = this._forceModel.positions;
                if (currentForcePositions[clickedIndex] <= 0) {
                    currentForcePositions[clickedIndex] = game.BaseGameUIConstants.kBaseReelLengths[clickedIndex] - 1;
                }
                else {
                    currentForcePositions[clickedIndex] -= 1;
                }
                this._forceModel.setPositions(currentForcePositions, true);
            }
            for (var i = 0; i < 5; i++) {
                // + button
                var g = new rendering.Graphics();
                g.lineStyle(4, game.BaseGameUIConstants.kForceToolSelectorButtonOutlineColour, 1);
                g.beginFill(game.BaseGameUIConstants.kForceToolPlusButtonBackgroundColour, 0.9);
                g.drawRect(0, 0, 75, 75);
                g.endFill();
                g.x = (this._isDesktop ? game.BaseGameUIConstants.kDesktopForceToolSelectorButtonStartingOffetX : game.BaseGameUIConstants.kMobileForceToolSelectorButtonStartingOffetX) + (i * (this._isDesktop ? game.BaseGameUIConstants.kDesktopForceToolSelectorButtonSpacingX : game.BaseGameUIConstants.kMobileForceToolSelectorButtonSpacingX));
                g.y = this._isDesktop ? game.BaseGameUIConstants.kDesktopForceToolPlusButtonY : game.BaseGameUIConstants.kMobileForceToolPlusButtonY;
                this.addChild(g);
                var txt = new rendering.Text("+");
                txt.fontSize = game.BaseGameUIConstants.kForceToolSelectorButtonFontSize;
                txt.colour = game.BaseGameUIConstants.kForceToolSelectorButtonTextColour;
                txt.font = game.BaseGameUIConstants.kFontFamily;
                txt.y = g.height / 2 - (txt.height / 2);
                txt.x = g.width / 2 - (txt.width / 2);
                g.addChild(txt);
                // Current reel index
                this._reelIndexGraphic = new rendering.Graphics();
                this._reelIndexGraphic.lineStyle(4, game.BaseGameUIConstants.kForceToolSelectorButtonOutlineColour, 1);
                this._reelIndexGraphic.beginFill(game.BaseGameUIConstants.kForceToolPlusButtonBackgroundColour, 1);
                this._reelIndexGraphic.drawRect(0, 0, 75, 40);
                this._reelIndexGraphic.endFill();
                this._reelIndexGraphic.x = g.x;
                this._reelIndexGraphic.y = this._isDesktop ? -20 : -20;
                var reelIndexText = new rendering.Text("0");
                reelIndexText.fontSize = game.BaseGameUIConstants.kForceToolSelectorButtonFontSize - 10;
                reelIndexText.colour = game.BaseGameUIConstants.kForceToolSelectorButtonTextColour;
                reelIndexText.font = game.BaseGameUIConstants.kFontFamily;
                reelIndexText.y = this._reelIndexGraphic.height / 2 - (reelIndexText.height / 2);
                reelIndexText.x = this._reelIndexGraphic.width / 2 - (reelIndexText.width / 2);
                this._reelIndexTexts.push(reelIndexText);
                this._reelIndexGraphic.addChild(reelIndexText);
                this.addChild(this._reelIndexGraphic);
                g.addEventListener(rendering.InputEvent.UP, onPlusButtonPressed, this);
            }
            for (var i = 0; i < 5; i++) {
                var g = new rendering.Graphics();
                g.lineStyle(4, game.BaseGameUIConstants.kForceToolSelectorButtonOutlineColour, 1);
                g.beginFill(game.BaseGameUIConstants.kForceToolMinusButtonBackgroundColour, 0.9);
                g.drawRect(0, 0, 75, 75);
                g.endFill();
                g.x = (this._isDesktop ? game.BaseGameUIConstants.kDesktopForceToolSelectorButtonStartingOffetX : game.BaseGameUIConstants.kMobileForceToolSelectorButtonStartingOffetX) + (i * (this._isDesktop ? game.BaseGameUIConstants.kDesktopForceToolSelectorButtonSpacingX : game.BaseGameUIConstants.kMobileForceToolSelectorButtonSpacingX));
                g.y = this._isDesktop ? game.BaseGameUIConstants.kDesktopForceToolMinusButtonY : game.BaseGameUIConstants.kMobileForceToolMinusButtonY;
                this.addChild(g);
                var txt = new rendering.Text("-");
                txt.fontSize = game.BaseGameUIConstants.kForceToolSelectorButtonFontSize;
                txt.colour = game.BaseGameUIConstants.kForceToolSelectorButtonTextColour;
                txt.font = game.BaseGameUIConstants.kFontFamily;
                txt.y = g.height / 2 - (txt.height / 2);
                txt.x = g.width / 2 - (txt.width / 2);
                g.addChild(txt);
                g.addEventListener(rendering.InputEvent.UP, onMinusButtonPressed, this);
            }
            this.updateForceIndexes();
        };
        ForceView.prototype.updateForceIndexes = function () {
            var _this = this;
            this._reelIndexTexts.forEach(function (reelIndexText, index) {
                reelIndexText.text = _this._forceModel.positions[index].toString();
                reelIndexText.x = (_this._reelIndexGraphic.width / 2) - (reelIndexText.width / 2);
            });
        };
        __decorate([
            inject('ForceModel')
        ], ForceView.prototype, "_forceModel", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], ForceView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], ForceView.prototype, "_launchParams", void 0);
        return ForceView;
    }(rendering.DisplayObjectContainer));
    game.ForceView = ForceView;
})(game || (game = {}));
var game;
(function (game) {
    var ForceViewMediator = (function (_super) {
        __extends(ForceViewMediator, _super);
        function ForceViewMediator() {
            _super.apply(this, arguments);
        }
        ForceViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this._view = this.getViewComponent();
            this.addContextListener(game.ForceModelEvent.FORCE_MODEL_CHANGED, this.onForceModelChanged);
            this.addContextListener(game.ForceModelEvent.FORCE_ENABLED, this.onForceEnabled);
            this.addContextListener(game.GameEvent.DEMO_DATA_SET, this.onDemoDataSet);
            this.addContextListener(game.GameEvent.FORCE_VIEW_OPENED, this.onForceViewOpened);
            this.addContextListener(game.GameEvent.FORCE_VIEW_CLOSED, this.onForceViewClosed);
        };
        ForceViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.ForceModelEvent.FORCE_MODEL_CHANGED, this.onForceModelChanged);
            this.removeContextListener(game.ForceModelEvent.FORCE_ENABLED, this.onForceEnabled);
            this.removeContextListener(game.GameEvent.DEMO_DATA_SET, this.onDemoDataSet);
            this.removeContextListener(game.GameEvent.FORCE_VIEW_OPENED, this.onForceViewOpened);
            this.removeContextListener(game.GameEvent.FORCE_VIEW_CLOSED, this.onForceViewClosed);
        };
        ForceViewMediator.prototype.onForceEnabled = function () {
            this._view.updateForceIndexes();
        };
        ForceViewMediator.prototype.onForceModelChanged = function () {
            this._view.updateForceIndexes();
        };
        ForceViewMediator.prototype.onDemoDataSet = function () {
            this._view.visible = false;
        };
        ForceViewMediator.prototype.onForceViewOpened = function () {
            this._view.visible = true;
        };
        ForceViewMediator.prototype.onForceViewClosed = function () {
            this._view.visible = false;
        };
        ForceViewMediator.prototype.doGlobalDispatch = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        __decorate([
            inject('ForceModel')
        ], ForceViewMediator.prototype, "_forceModel", void 0);
        return ForceViewMediator;
    }(dragonwings.Mediator));
    game.ForceViewMediator = ForceViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinTriggerView = (function (_super) {
        __extends(FreeSpinTriggerView, _super);
        function FreeSpinTriggerView(frames, scalar, translator, textLabel, isDesktop) {
            if (isDesktop === void 0) { isDesktop = true; }
            _super.call(this, frames);
            this._textObjects = [];
            this._textLabel = textLabel;
            this.gotoAndStop(0);
            if (this._textLabel) {
                var valX, valY, amtSize, fsX, fsY, lblSize;
                if (isDesktop) {
                    valX = 46;
                    valY = 34;
                    amtSize = 48;
                }
                else {
                    valX = 64;
                    valY = 50;
                    amtSize = 70;
                }
                var freePlaysAmountLabel = Utils.MiscUtils.createText(this, this._textLabel, amtSize, rendering.TextAlign.CENTER, [80, 200], [valX, valY], game.BaseGameUIConstants.kFreeSpinTriggerDisabledTextColour, "#ffffff", 0);
                Utils.MiscUtils.centreReg(freePlaysAmountLabel, scalar);
                this._textObjects.push(freePlaysAmountLabel);
            }
        }
        FreeSpinTriggerView.prototype.enable = function () {
            this.gotoAndStop(1);
            if (this._textLabel) {
                this._textObjects.forEach(function (textObject) {
                    textObject.colour = game.BaseGameUIConstants.kFreeSpinTriggerEnabledTextColour;
                });
            }
        };
        FreeSpinTriggerView.prototype.disable = function () {
            this.gotoAndStop(0);
            if (this._textLabel) {
                this._textObjects.forEach(function (textObject) {
                    textObject.colour = game.BaseGameUIConstants.kFreeSpinTriggerDisabledTextColour;
                });
            }
        };
        return FreeSpinTriggerView;
    }(rendering.MovieClip));
    game.FreeSpinTriggerView = FreeSpinTriggerView;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinTriggersView = (function (_super) {
        __extends(FreeSpinTriggersView, _super);
        function FreeSpinTriggersView() {
            _super.call(this);
            this._freeSpinTriggers = [];
        }
        FreeSpinTriggersView.prototype.construct = function (isDesktop) {
            Utils.PSLog.log("FreeSpinTriggersView->construct()");
            this._isDesktop = isDesktop;
            this._scalar = this._device.getScalar();
            if (isDesktop) {
                var baseX = 280;
                var baseY = 720;
                var stepY = 78;
                var headingX = 330;
                var headingY = 148;
                var dividerX = headingX - 50;
            }
            else {
                var baseX = 150;
                var baseY = 820;
                var stepY = 92;
                var headingX = 220;
                var headingY = 142;
                var dividerX = headingX - 50;
            }
            var freeSpinTriggerCrystalFrames = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.CF_FreeSpinTriggerCrystalJson.name), this._cache.getAssetById(game.BaseGameBundle.CF_FreeSpinTriggerCrystal.name)).getFrames();
            var freeSpinTriggerTextFrames = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.CF_FreeSpinTriggerTextJson.name), this._cache.getAssetById(game.BaseGameBundle.CF_FreeSpinTriggerText.name)).getFrames();
            // Free plays heading
            var freePlaysHeading = Utils.MiscUtils.createText(this, this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Freespin_FreePlays"), 20, rendering.TextAlign.CENTER, [100, 100], [0, 0], "#ffffff", "#000000", 3, false, "plain", true);
            freePlaysHeading.x = headingX - (freePlaysHeading.width / 2);
            freePlaysHeading.y = headingY - freePlaysHeading.height;
            // Divider
            var dividerGraphic = new rendering.Graphics();
            dividerGraphic.beginFill(0xCCCCCC, 1);
            dividerGraphic.drawRect(0, 0, 101, 2);
            dividerGraphic.endFill();
            dividerGraphic.x = dividerX;
            dividerGraphic.y = freePlaysHeading.y + freePlaysHeading.height;
            this.addChild(dividerGraphic);
            var textValues = game.BaseGameUIConstants.kFreeSpinsUIAwardLevels;
            for (var i = 0; i < 8; i++) {
                var freeSpinTrigger = (i < 3) ? new game.FreeSpinTriggerView(freeSpinTriggerCrystalFrames, this._scalar, this._translator) : new game.FreeSpinTriggerView(freeSpinTriggerTextFrames, this._scalar, this._translator, textValues[i - 3], this._isDesktop);
                freeSpinTrigger.x = baseX;
                freeSpinTrigger.y = baseY - (stepY * i);
                this.addChild(freeSpinTrigger);
                this._freeSpinTriggers.push(freeSpinTrigger);
            }
        };
        FreeSpinTriggersView.prototype.enableTrigger = function (triggerIndex) {
            if (this._freeSpinTriggers[triggerIndex]) {
                this._freeSpinTriggers[triggerIndex].enable();
            }
        };
        FreeSpinTriggersView.prototype.disabledAllTriggers = function () {
            this._freeSpinTriggers.forEach(function (freeSpinTrigger) {
                freeSpinTrigger.disable();
            });
        };
        __decorate([
            inject('AssetCache')
        ], FreeSpinTriggersView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], FreeSpinTriggersView.prototype, "_device", void 0);
        __decorate([
            inject('ITranslator')
        ], FreeSpinTriggersView.prototype, "_translator", void 0);
        return FreeSpinTriggersView;
    }(rendering.DisplayObjectContainer));
    game.FreeSpinTriggersView = FreeSpinTriggersView;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinTriggersViewMediator = (function (_super) {
        __extends(FreeSpinTriggersViewMediator, _super);
        function FreeSpinTriggersViewMediator() {
            _super.apply(this, arguments);
            this._lastTriggerIndexEnabled = 0;
        }
        FreeSpinTriggersViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            Utils.PSLog.log("FreeSpinTriggersView added");
            this.addContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.addContextListener(game.GameEvent.HAS_WINS, this.onHasWins);
            this.addContextListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onFreeSpinsButtonPressed);
            this.addContextListener(game.GameEvent.FREE_SPIN_VALID, this.onFreeSpinValid);
            this.addContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.addContextListener(game.GameEvent.WHITE_FLASH_FADE_IN_COMPLETE, this.onWhiteFlashFadeInComplete);
            this.addContextListener(game.GameEvent.WHITE_FLASH_FADE_OUT_COMPLETE, this.onWhiteFlashFadeOutComplete);
        };
        FreeSpinTriggersViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.removeContextListener(game.GameEvent.HAS_WINS, this.onHasWins);
            this.removeContextListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onFreeSpinsButtonPressed);
            this.removeContextListener(game.GameEvent.FREE_SPIN_VALID, this.onFreeSpinValid);
            this.removeContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.removeContextListener(game.GameEvent.WHITE_FLASH_FADE_IN_COMPLETE, this.onWhiteFlashFadeInComplete);
            this.removeContextListener(game.GameEvent.WHITE_FLASH_FADE_OUT_COMPLETE, this.onWhiteFlashFadeOutComplete);
        };
        FreeSpinTriggersViewMediator.prototype.doGlobalDispatch = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        FreeSpinTriggersViewMediator.prototype.onHasWins = function () {
            if (this._lastTriggerIndexEnabled < 8) {
                this.view.enableTrigger(this._lastTriggerIndexEnabled);
            }
            if (this._lastTriggerIndexEnabled === 2) {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.FSG_ANTICIPATION, this));
            }
            if (this._lastTriggerIndexEnabled === 3) {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.FSG_SIREN, this));
            }
            this._lastTriggerIndexEnabled++;
        };
        FreeSpinTriggersViewMediator.prototype.onSpinButtonPressed = function () {
            this.resetTriggers();
        };
        FreeSpinTriggersViewMediator.prototype.onFreeSpinsButtonPressed = function () {
            this.resetTriggers();
        };
        FreeSpinTriggersViewMediator.prototype.onFreeSpinValid = function () {
            this.resetTriggers();
        };
        FreeSpinTriggersViewMediator.prototype.onNextAutoplay = function () {
            this.resetTriggers();
        };
        FreeSpinTriggersViewMediator.prototype.resetTriggers = function () {
            this.view.disabledAllTriggers();
            this._lastTriggerIndexEnabled = 0;
        };
        FreeSpinTriggersViewMediator.prototype.onWhiteFlashFadeInComplete = function (e) {
            // .. 
        };
        FreeSpinTriggersViewMediator.prototype.onWhiteFlashFadeOutComplete = function (e) {
            var logicResponse = this._server.getLogicResponse();
            if (logicResponse.bgRecoveryInfo) {
                for (var i = 0; i < logicResponse.bgRecoveryInfo.cascadeCount - 1; i++) {
                    this.view.enableTrigger(i);
                }
            }
        };
        __decorate([
            inject('GameStateModel')
        ], FreeSpinTriggersViewMediator.prototype, "_stateModel", void 0);
        __decorate([
            inject('GameServer')
        ], FreeSpinTriggersViewMediator.prototype, "_server", void 0);
        return FreeSpinTriggersViewMediator;
    }(dragonwings.Mediator));
    game.FreeSpinTriggersViewMediator = FreeSpinTriggersViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var FSGIntroPlaysAwardedNumberView = (function (_super) {
        __extends(FSGIntroPlaysAwardedNumberView, _super);
        function FSGIntroPlaysAwardedNumberView(position) {
            _super.call(this, "50");
            this.font = game.BaseGameUIConstants.kFontFamily;
            this.fontSize = game.BaseGameUIConstants.kNumberOfFreeSpinsAwardedFontSize;
            this.colour = game.BaseGameUIConstants.kNumberOfFreeSpinsAwardedTextColour;
            this.outlineColour = game.BaseGameUIConstants.kNumberOfFreeSpinsAwardedTextOutlineColour;
            this.outlineSize = game.BaseGameUIConstants.kNumberOfFreeSpinsAwardedTextOutlineSize;
            this.x = position[0] - (this.width / 2);
            this.y = position[1];
        }
        return FSGIntroPlaysAwardedNumberView;
    }(rendering.Text));
    game.FSGIntroPlaysAwardedNumberView = FSGIntroPlaysAwardedNumberView;
})(game || (game = {}));
var game;
(function (game) {
    var FSGWhiteFlashView = (function (_super) {
        __extends(FSGWhiteFlashView, _super);
        function FSGWhiteFlashView() {
            _super.call(this);
        }
        FSGWhiteFlashView.prototype.construct = function () {
            this.beginFill(0xFFFFFF, 1);
            this.drawRect(0, 0, this._device.getBaselineWidth(), this._device.getBaselineHeight());
            this.endFill();
            this.alpha = 0;
            this.visible = false;
        };
        FSGWhiteFlashView.prototype.play = function (speed, completeEvent, callback) {
            var _this = this;
            this.visible = true;
            new TweenMax(this, speed, {
                alpha: 1,
                onComplete: function () {
                    _this.dispatchEvent(completeEvent);
                    if (callback) {
                        callback();
                    }
                    new TweenMax(_this, speed, {
                        alpha: 0,
                        onComplete: function () {
                            _this.visible = false;
                        }
                    });
                }
            });
        };
        __decorate([
            inject('DeviceContext')
        ], FSGWhiteFlashView.prototype, "_device", void 0);
        return FSGWhiteFlashView;
    }(rendering.Graphics));
    game.FSGWhiteFlashView = FSGWhiteFlashView;
})(game || (game = {}));
var game;
(function (game) {
    var FSGWhiteFlashViewMediator = (function (_super) {
        __extends(FSGWhiteFlashViewMediator, _super);
        function FSGWhiteFlashViewMediator() {
            _super.apply(this, arguments);
        }
        FSGWhiteFlashViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.show);
            this.addContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame);
            this.view.addEventListener(game.GameEvent.WHITE_FLASH_FADE_IN_COMPLETE, this.fadeComplete, this);
            this.view.addEventListener(game.GameEvent.WHITE_FLASH_FADE_OUT_COMPLETE, this.fadeComplete, this);
        };
        FSGWhiteFlashViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.show);
            this.removeContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame);
            this.view.removeEventListener(game.GameEvent.WHITE_FLASH_FADE_IN_COMPLETE, this.fadeComplete, this);
            this.view.removeEventListener(game.GameEvent.WHITE_FLASH_FADE_OUT_COMPLETE, this.fadeComplete, this);
        };
        FSGWhiteFlashViewMediator.prototype.show = function () {
            this.view.play(game.BaseGameUIConstants.kWhiteFlashOverlayDuration, new game.GameEvent(game.GameEvent.WHITE_FLASH_FADE_IN_COMPLETE, this.view));
        };
        FSGWhiteFlashViewMediator.prototype.onReturnToBaseGame = function () {
            var _this = this;
            this.view.play(game.BaseGameUIConstants.kWhiteFlashOverlayDuration, new game.GameEvent(game.GameEvent.WHITE_FLASH_FADE_OUT_COMPLETE, this.view), function () {
                _this._layerManager.setVisible([
                    new game.LayerVisibility(game.LayerViews.BASE, true),
                    new game.LayerVisibility(game.LayerViews.FREE_SPINS, false),
                    new game.LayerVisibility(game.LayerViews.FS_UI, false)
                ]);
            });
        };
        FSGWhiteFlashViewMediator.prototype.fadeComplete = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        __decorate([
            inject('LayerManager')
        ], FSGWhiteFlashViewMediator.prototype, "_layerManager", void 0);
        return FSGWhiteFlashViewMediator;
    }(dragonwings.Mediator));
    game.FSGWhiteFlashViewMediator = FSGWhiteFlashViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var FSGWinMeterTextView = (function (_super) {
        __extends(FSGWinMeterTextView, _super);
        function FSGWinMeterTextView() {
            _super.call(this);
        }
        Object.defineProperty(FSGWinMeterTextView.prototype, "isDesktop", {
            set: function (value) {
                this._isDesktop = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSGWinMeterTextView.prototype, "isDesktopUI", {
            get: function () {
                return this._isDesktop;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FSGWinMeterTextView.prototype, "value", {
            set: function (newValue) {
                this.meter.value = newValue;
                if (this._isDesktop) {
                    this.x = game.BaseGameUIConstants.kFSControlPanelWinMeterTextX - (this.width / 2);
                    this.y = game.BaseGameUIConstants.kFSControlPanelWinMeterTextY - (this.height / 2);
                }
                else {
                    this.x = 400;
                    this.y = 251;
                }
            },
            enumerable: true,
            configurable: true
        });
        return FSGWinMeterTextView;
    }(game.MeterView));
    game.FSGWinMeterTextView = FSGWinMeterTextView;
})(game || (game = {}));
var game;
(function (game) {
    var FSGWinMeterTextViewMediator = (function (_super) {
        __extends(FSGWinMeterTextViewMediator, _super);
        function FSGWinMeterTextViewMediator() {
            _super.apply(this, arguments);
            this._isInFreeGame = false;
        }
        FSGWinMeterTextViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingWins"), this.onCyclesStarted);
            this.addContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSGame);
            this.addContextListener(game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME, this.onRecoveryIntoFSGame);
            this.addContextListener(game.GameEvent.PAY_CYCLE_OVERLAY_PRESSED, this.onPayCycleOverlayPressed);
            this.addContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame);
            this.addContextListener(game.GameEvent.HAS_MAX_WIN, this.onHasMaxWin);
            this.setView(this.getViewComponent());
        };
        FSGWinMeterTextViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingWins"), this.onCyclesStarted);
            this.removeContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSGame);
            this.removeContextListener(game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME, this.onRecoveryIntoFSGame);
            this.removeContextListener(game.GameEvent.PAY_CYCLE_OVERLAY_PRESSED, this.onPayCycleOverlayPressed);
            this.removeContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame);
            this.removeContextListener(game.GameEvent.HAS_MAX_WIN, this.onHasMaxWin);
        };
        FSGWinMeterTextViewMediator.prototype.onRecoveryIntoFSGame = function () {
            var logicResponse = this._server.getLogicResponse();
            // Here we are grabbing the logic response for the next spin
            // This contains the total FS winnings so far AFTER THIS SPIN
            // There we will need to subtract the amount won from this spin (if any) to get the correct value to display
            this._currentRunningTotalWon = logicResponse.fsWinnings - logicResponse.spinWins;
            this.setWin(this._currentRunningTotalWon);
        };
        FSGWinMeterTextViewMediator.prototype.onCyclesStarted = function (e) {
            if (!this._isInFreeGame) {
                return;
            }
            var totalWonFromCascade = this._winInfoModel.getNextCascadeWin();
            if (this._winInfoModel.getWinDataForCurrentCycle()) {
                game.CheckIfCanCascadeCmd.winMeterCountUpComplete = false;
                this._winInfoModel.winCountUpComplete = false;
                this.initBigWinSounds(this.getBigWinLevel(totalWonFromCascade), totalWonFromCascade);
            }
        };
        FSGWinMeterTextViewMediator.prototype.onEnterFSGame = function () {
            this._isInFreeGame = true;
            _super.prototype.onEnterFSGame.call(this);
            this.view.visible = true;
        };
        FSGWinMeterTextViewMediator.prototype.onReturnToBaseGame = function () {
            this._isInFreeGame = false;
            this.view.visible = false;
        };
        FSGWinMeterTextViewMediator.prototype.onPayCycleOverlayPressed = function () {
            if (this._isInFreeGame) {
                _super.prototype.onPayCycleOverlayPressed.call(this);
            }
        };
        FSGWinMeterTextViewMediator.prototype.onHasMaxWin = function () {
            var initResponse = this._server.getInitResponse();
            this.setWin(initResponse.maxWinValue);
        };
        return FSGWinMeterTextViewMediator;
    }(game.BaseWinMeterMediator));
    game.FSGWinMeterTextViewMediator = FSGWinMeterTextViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsGameBackgroundView = (function (_super) {
        __extends(FreeSpinsGameBackgroundView, _super);
        function FreeSpinsGameBackgroundView() {
            _super.call(this);
        }
        FreeSpinsGameBackgroundView.prototype.construct = function () {
            var background = new rendering.Bitmap(Utils.MiscUtils.getAssetFrameWithName("bonusbackground.png", game.FSBundle.CF_FreeSpinsBackground.name, game.FSBundle.CF_FreeSpinsBackgroundJson.name, this._cache));
            this.addChild(background);
        };
        __decorate([
            inject('AssetCache')
        ], FreeSpinsGameBackgroundView.prototype, "_cache", void 0);
        return FreeSpinsGameBackgroundView;
    }(rendering.DisplayObjectContainer));
    game.FreeSpinsGameBackgroundView = FreeSpinsGameBackgroundView;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsGameControlPanelView = (function (_super) {
        __extends(FreeSpinsGameControlPanelView, _super);
        function FreeSpinsGameControlPanelView() {
            _super.call(this);
        }
        FreeSpinsGameControlPanelView.prototype.construct = function (isDesktop) {
            this._scalar = this._device.getScalar();
            this.x = game.BaseGameUIConstants.kFreeSpinControlPanelX;
            this.y = game.BaseGameUIConstants.kFreeSpinControlPanelY;
            if (isDesktop) {
                var controlPanelAsset = Utils.MiscUtils.getAssetFrameWithName("ui_fg_background.png", game.BaseGameBundle.CF_ControlPanel.name, game.BaseGameBundle.CF_ControlPanelJson.name, this._cache);
                var controlPanelBitmap = new rendering.Bitmap(controlPanelAsset);
                this.addChild(controlPanelBitmap);
            }
            this._infoBoxText = new rendering.Text("");
            this._infoBoxText.colour = game.BaseGameUIConstants.kFreeSpinControlPanelBoxTextColour;
            this._infoBoxText.font = game.BaseGameUIConstants.kFontFamily;
            this._infoBoxText.fontSize = game.BaseGameUIConstants.kFreeSpinControlPanelInfoMeterFontSize;
            this._infoBoxText.x = game.BaseGameUIConstants.kFSControlPanelInfoMeterTextX - (this._infoBoxText.width / 2);
            this._infoBoxText.y = game.BaseGameUIConstants.kFSControlPanelInfoMeterTextY;
            this.addChild(this._infoBoxText);
            this._tbText = new rendering.Text("");
            this._tbText.colour = game.BaseGameUIConstants.kFreeSpinControlPanelBoxTextColour;
            this._tbText.font = game.BaseGameUIConstants.kFontFamily;
            this._tbText.fontSize = game.BaseGameUIConstants.kFreeSpinControlPanelTotalStakeMeterFontSize;
            this._tbText.x = game.BaseGameUIConstants.kFSControlPanelTotalBetMeterTextX - (this._tbText.width / 2);
            this._tbText.y = game.BaseGameUIConstants.kFSControlPanelTotalBetMeterTextY - (this._tbText.height / 2);
            this.addChild(this._tbText);
            if (!isDesktop) {
                this._fsgWinMeterTextView.setProperties(0, 0, 260, 100, game.BaseGameUIConstants.kFontFamily, 28, "#FFFFFF", rendering.TextAlign.CENTER);
                this._infoBoxText.visible = false;
                this._tbText.visible = false;
            }
            else {
                this._fsgWinMeterTextView.setProperties(0, 0, 260, 100, game.BaseGameUIConstants.kFontFamily, game.BaseGameUIConstants.kFreeSpinControlPanelWinMeterFontSize, game.BaseGameUIConstants.kFreeSpinControlPanelBoxTextColour, rendering.TextAlign.CENTER);
                // Labels
                var winLabel = this.addChild(new game.MeterLabelView(this._translator.findByKey("framework_com_wms_framework_Dash_Win"), 40, game.BaseGameUIConstants.kFreeSpinControlPanelBoxLabelColour, 1158, 204));
                Utils.MiscUtils.centreReg(winLabel, this._scalar);
                var totalBetLabel = this.addChild(new game.MeterLabelView(this._translator.findByKey("framework_com_wms_framework_Dash_TotalBet"), 36, game.BaseGameUIConstants.kFreeSpinControlPanelBoxLabelColour, 760, 191));
                Utils.MiscUtils.centreReg(totalBetLabel, this._scalar);
            }
            this._fsgWinMeterTextView.isDesktop = isDesktop;
            this.addChild(this._fsgWinMeterTextView);
        };
        FreeSpinsGameControlPanelView.prototype.updateFSStake = function (text) {
            this._tbText.text = text;
            this._tbText.x = game.BaseGameUIConstants.kFSControlPanelTotalBetMeterTextX - (this._tbText.width / 2);
        };
        FreeSpinsGameControlPanelView.prototype.updateInfoMeter = function (text) {
            this._infoBoxText.text = text;
            this._infoBoxText.x = game.BaseGameUIConstants.kFSControlPanelInfoMeterTextX - (this._infoBoxText.width / 2);
        };
        __decorate([
            inject('AssetCache')
        ], FreeSpinsGameControlPanelView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], FreeSpinsGameControlPanelView.prototype, "_device", void 0);
        __decorate([
            inject('FSGWinMeterTextView')
        ], FreeSpinsGameControlPanelView.prototype, "_fsgWinMeterTextView", void 0);
        __decorate([
            inject('ITranslator')
        ], FreeSpinsGameControlPanelView.prototype, "_translator", void 0);
        return FreeSpinsGameControlPanelView;
    }(rendering.DisplayObjectContainer));
    game.FreeSpinsGameControlPanelView = FreeSpinsGameControlPanelView;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsGameControlPanelViewMediator = (function (_super) {
        __extends(FreeSpinsGameControlPanelViewMediator, _super);
        function FreeSpinsGameControlPanelViewMediator() {
            _super.apply(this, arguments);
        }
        FreeSpinsGameControlPanelViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(components.CyclerEvent.ON_NEXT_RESULT, this.onNextCycle);
            this.addContextListener(server.ServerResponseEvent.LOGIC_RESPONSE, this.clearInfoMeter);
            this.addContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSGame);
        };
        FreeSpinsGameControlPanelViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(components.CyclerEvent.ON_NEXT_RESULT, this.onNextCycle);
            this.removeContextListener(server.ServerResponseEvent.LOGIC_RESPONSE, this.clearInfoMeter);
            this.removeContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSGame);
        };
        FreeSpinsGameControlPanelViewMediator.prototype.onNextCycle = function (e) {
            var winValue = e.result.winAmount;
            var winLine = e.result.payline + 1;
            var formattedWinValue = this._currencyFormatter.format(winValue);
            var infoStr = this._translator.findByKey("framework_com_wms_framework_MsgBar_LinePay");
            infoStr = infoStr.replace(/\{0\}/, winLine.toString());
            infoStr = infoStr.replace(/\{1\}/, formattedWinValue);
            this.view.updateInfoMeter(infoStr);
        };
        FreeSpinsGameControlPanelViewMediator.prototype.onEnterFSGame = function () {
            this.view.updateFSStake(this._currencyFormatter.format(this._stakeModel.getTotalBet()));
            this.clearInfoMeter();
        };
        FreeSpinsGameControlPanelViewMediator.prototype.clearInfoMeter = function () {
            this.view.updateInfoMeter("");
        };
        __decorate([
            inject('CurrencyFormatter')
        ], FreeSpinsGameControlPanelViewMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('ITranslator')
        ], FreeSpinsGameControlPanelViewMediator.prototype, "_translator", void 0);
        __decorate([
            inject('StakeModel')
        ], FreeSpinsGameControlPanelViewMediator.prototype, "_stakeModel", void 0);
        return FreeSpinsGameControlPanelViewMediator;
    }(dragonwings.Mediator));
    game.FreeSpinsGameControlPanelViewMediator = FreeSpinsGameControlPanelViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsGameIntroView = (function (_super) {
        __extends(FreeSpinsGameIntroView, _super);
        function FreeSpinsGameIntroView() {
            _super.call(this);
        }
        FreeSpinsGameIntroView.prototype.construct = function (isDesktop) {
            // Transition animation
            this._FSTransitionFrames = new components.SpriteSheet(this._cache.getAssetById(game.FSBundle.CF_FSTransitionJson.name), this._cache.getAssetById(game.FSBundle.CF_FSTransition.name)).getFrames();
            this._FSTransitionMC = new rendering.CustomMovieClip(this._FSTransitionFrames);
            this._FSTransitionMC.scaleX = game.BaseGameUIConstants.kFSTransitionScaleX;
            this._FSTransitionMC.scaleY = game.BaseGameUIConstants.kFSTransitionScaleY;
            this._FSTransitionMC.fps = game.BaseGameUIConstants.kFSGIntroTransitionMCFPS;
            this.addChild(this._FSTransitionMC);
            this._modalFrames = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.CF_ModalFrameJson.name), this._cache.getAssetById(game.BaseGameBundle.CF_ModalFrame.name)).getFrames();
            this._modalFrameMC = new rendering.CustomMovieClip(this._modalFrames);
            this._modalFrameMC.getNativeDisplayObject().anchor.set(0.5, 0.5);
            this._modalFrameMC.scaleX = game.BaseGameUIConstants.kModalFrameScaleX;
            this._modalFrameMC.scaleY = game.BaseGameUIConstants.kModalFrameScaleY;
            this._modalFrameMC.x = (this._device.getBaselineWidth() / 2) - (this._modalFrameMC.scaleX / 2);
            this._modalFrameMC.y = (this._device.getBaselineHeight() / 2) - (this._modalFrameMC.scaleY / 2);
            this._modalFrameMC.fps = game.BaseGameUIConstants.kModalFrameMCFPS;
            this.addChild(this._modalFrameMC);
            this._textContainer = new rendering.DisplayObjectContainer();
            this._freePlaysAwardedNumberView = new game.FSGIntroPlaysAwardedNumberView([this._device.getBaselineWidth() / 2, 0]);
            this._textContainer.addChild(this._freePlaysAwardedNumberView);
            var translation = this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Freespin_FreePlays");
            var text = Utils.MiscUtils.createStyledText(translation, game.BaseGameUIConstants.kFontFamily, game.BaseGameUIConstants.kFSGIntroStartButtonLabelFontSize, rendering.TextAlign.CENTER, game.BaseGameUIConstants.kFreeSpinsAwardedTextColour, 850, 100, [game.BaseGameUIConstants.kFSGIntroStartButtonLabelOutlineColour], [game.BaseGameUIConstants.kFSGIntroStartButtonLabelOutlineSize], 550, 200);
            for (var i = 0; i < text.length; i++) {
                this._textContainer.addChild(text[i]);
            }
            this._textContainer.y = 335;
            this.addChild(this._textContainer);
            this._fsgStartButtonFrames = new components.SpriteSheet(this._cache.getAssetById(game.FSBundle.CF_FSG_Start_ButtonJson.name), this._cache.getAssetById(game.FSBundle.CF_FSG_Start_Button.name)).getFrames();
            // Start button movie clip
            this._fsgStartButtonMC = new rendering.CustomMovieClip(this._fsgStartButtonFrames);
            this._fsgStartButtonMC.getNativeDisplayObject().anchor.set(0.5, 0.5);
            this._fsgStartButtonMC.scaleX = game.BaseGameUIConstants.kFSGIntroStartButtonScaleX;
            this._fsgStartButtonMC.scaleY = game.BaseGameUIConstants.kFSGIntroStartButtonScaleY;
            this._fsgStartButtonMC.x = (this._device.getBaselineWidth() / 2) - (this._fsgStartButtonMC.scaleX / 2);
            this._fsgStartButtonMC.y = game.BaseGameUIConstants.kFSGIntroStartButtonY;
            this._fsgStartButtonMC.fps = game.BaseGameUIConstants.kFSGStartButtonMCAnimationSpeed;
            this._fsgStartButtonMC.setMouseoverCursor();
            this.addChild(this._fsgStartButtonMC);
            var desktopTranslation = this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Freespin_PressToStart");
            var mobileTranslation = this._translator.findByKey("TOUCH_TO_PLAY");
            var text = Utils.MiscUtils.createStyledText(isDesktop ? desktopTranslation : mobileTranslation, game.BaseGameUIConstants.kFontFamily, game.BaseGameUIConstants.kFSGIntroStartButtonLabelFontSize, rendering.TextAlign.CENTER, game.BaseGameUIConstants.kFreeSpinsAwardedTextColour, 600, 100, [game.BaseGameUIConstants.kFSGIntroStartButtonLabelOutlineColour], [game.BaseGameUIConstants.kFSGIntroStartButtonLabelOutlineSize], -300, -25);
            for (var i = 0; i < text.length; i++) {
                this._fsgStartButtonMC.addChild(text[i]);
            }
            rendering.InputManager.registerObject(this._fsgStartButtonMC);
            this._fsgStartButtonMC.addEventListener(rendering.InputEvent.DOWN, this.onStartButtonPressed, this);
            // By default, all intro component must be hidden
            this.reset();
        };
        FreeSpinsGameIntroView.prototype.playTransition = function () {
            var _this = this;
            this._FSTransitionMC.visible = true;
            this._modalFrameMC.visible = true;
            this._modalFrameMC.alpha = 0;
            this._textContainer.visible = true;
            this._textContainer.alpha = 0;
            this._fsgStartButtonMC.visible = true;
            this._fsgStartButtonMC.alpha = 0;
            this._FSTransitionMC.playRange(0, this._FSTransitionMC.totalFrames - 1, function () {
                _this.fadeIn(1);
            });
            TweenMax.to(this, 0.5, {
                repeat: Infinity,
                repeatDelay: 0.5,
                onRepeat: function () {
                    _this._fsgStartButtonMC.playRange(0);
                }
            });
        };
        FreeSpinsGameIntroView.prototype.updateNumberOfFreeSpinsAwarded = function (value) {
            this._freePlaysAwardedNumberView.text = value;
            this._freePlaysAwardedNumberView.x = (this._device.getBaselineWidth() / 2) - (this._freePlaysAwardedNumberView.width / 2);
        };
        FreeSpinsGameIntroView.prototype.onStartButtonPressed = function () {
            TweenMax.killTweensOf(this);
            this._fsgStartButtonMC.gotoAndStop(0);
            this.dispatchEvent(new game.GameEvent(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this));
            document.body.style.cursor = "default";
        };
        FreeSpinsGameIntroView.prototype.reset = function () {
            this._FSTransitionMC.visible = false;
            this._modalFrameMC.visible = false;
            this._textContainer.visible = false;
            this._fsgStartButtonMC.visible = false;
            this._modalFrameMC.alpha = 0;
            this._textContainer.alpha = 0;
            this._fsgStartButtonMC.alpha = 0;
            this._fsgStartButtonMC.gotoAndStop(0);
        };
        FreeSpinsGameIntroView.prototype.fadeOut = function (duration) {
            TweenLite.to(this._modalFrameMC, duration, { alpha: 0 });
            TweenLite.to(this._textContainer, duration, { alpha: 0 });
            TweenLite.to(this._fsgStartButtonMC, duration, { alpha: 0 });
        };
        FreeSpinsGameIntroView.prototype.fadeIn = function (duration) {
            TweenLite.to(this._modalFrameMC, duration, { alpha: 1 });
            TweenLite.to(this._textContainer, duration, { alpha: 1 });
            TweenLite.to(this._fsgStartButtonMC, duration, { alpha: 1 });
        };
        __decorate([
            inject('AssetCache')
        ], FreeSpinsGameIntroView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], FreeSpinsGameIntroView.prototype, "_device", void 0);
        __decorate([
            inject('ITranslator')
        ], FreeSpinsGameIntroView.prototype, "_translator", void 0);
        return FreeSpinsGameIntroView;
    }(rendering.DisplayObjectContainer));
    game.FreeSpinsGameIntroView = FreeSpinsGameIntroView;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsGameIntroViewMediator = (function (_super) {
        __extends(FreeSpinsGameIntroViewMediator, _super);
        function FreeSpinsGameIntroViewMediator() {
            _super.apply(this, arguments);
            this._isRecovering = false;
        }
        FreeSpinsGameIntroViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this._view = this.getViewComponent();
            Utils.PSLog.log("FreeSpinsGameIntroViewMediator added");
            this.addContextListener(game.GameEvent.RECOVERY_GAME_INIT, this.onRecoveryGameInit);
            this.addContextListener(game.GameEvent.WHITE_FLASH_FADE_IN_COMPLETE, this.onFadeInComplete);
            this._view.addEventListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onButtonPressed, this);
        };
        FreeSpinsGameIntroViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.RECOVERY_GAME_INIT, this.onRecoveryGameInit);
            this.removeContextListener(game.GameEvent.WHITE_FLASH_FADE_IN_COMPLETE, this.onFadeInComplete);
            this._view.removeEventListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onButtonPressed, this);
        };
        /*
         ** When recovering into a free spin game, set a flag so other methods in this class know about it
         */
        FreeSpinsGameIntroViewMediator.prototype.onRecoveryGameInit = function () {
            this._isRecovering = true;
        };
        FreeSpinsGameIntroViewMediator.prototype.fakePressButton = function (delay) {
            var _this = this;
            TweenLite.delayedCall(delay, function () {
                _this._view.onStartButtonPressed();
            });
        };
        FreeSpinsGameIntroViewMediator.prototype.onFadeInComplete = function () {
            var logicResponse = this._server.getLogicResponse();
            this._view.playTransition();
            this._view.updateNumberOfFreeSpinsAwarded(this._server.getLogicResponse().fsSpinsTotal.toString());
            if (logicResponse.fsSpinNumber < 1) {
                // If in Replay mode, bypass FG intro for convenience
                if (this._historyModel.getIsHistoryReplay()) {
                    this.fakePressButton(1.5);
                }
            }
        };
        FreeSpinsGameIntroViewMediator.prototype.onButtonPressed = function () {
            this.context.parent.eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this));
        };
        __decorate([
            inject("GameServer")
        ], FreeSpinsGameIntroViewMediator.prototype, "_server", void 0);
        __decorate([
            inject("HistoryModel")
        ], FreeSpinsGameIntroViewMediator.prototype, "_historyModel", void 0);
        __decorate([
            inject('LayerManager')
        ], FreeSpinsGameIntroViewMediator.prototype, "_layerManager", void 0);
        return FreeSpinsGameIntroViewMediator;
    }(dragonwings.Mediator));
    game.FreeSpinsGameIntroViewMediator = FreeSpinsGameIntroViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsGameReelsetFrameView = (function (_super) {
        __extends(FreeSpinsGameReelsetFrameView, _super);
        function FreeSpinsGameReelsetFrameView() {
            _super.call(this);
        }
        FreeSpinsGameReelsetFrameView.prototype.construct = function () {
            var frameAsset = Utils.MiscUtils.getAssetFrameWithName("bonusreelframe.png", game.BaseGameBundle.RG_ReelFrame.name, game.BaseGameBundle.RG_ReelFrameJson.name, this._cache);
            this._isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            this._bgAlpha = new rendering.Graphics();
            this._bgAlpha.beginFill(0x000000, 0.5);
            if (this._isDesktop) {
                this.x = game.BaseGameUIConstants.kDesktopReelsetFrameX;
                this.y = game.BaseGameUIConstants.kDesktopReelsetFrameY;
                this._bgAlpha.drawRect(15, 15, 1200, 600);
            }
            else {
                this.x = game.BaseGameUIConstants.kMobileReelsetFrameX;
                this.y = game.BaseGameUIConstants.kMobileReelsetFrameY;
                this._bgAlpha.drawRect(15, 15, 1450, 750);
            }
            this.addChild(this._bgAlpha);
            this.addChild(new rendering.Bitmap(frameAsset));
        };
        __decorate([
            inject('AssetCache')
        ], FreeSpinsGameReelsetFrameView.prototype, "_cache", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], FreeSpinsGameReelsetFrameView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], FreeSpinsGameReelsetFrameView.prototype, "_launchParams", void 0);
        return FreeSpinsGameReelsetFrameView;
    }(rendering.DisplayObjectContainer));
    game.FreeSpinsGameReelsetFrameView = FreeSpinsGameReelsetFrameView;
})(game || (game = {}));
var game;
(function (game) {
    (function (FreeSpinsTotalWonLayout) {
        FreeSpinsTotalWonLayout[FreeSpinsTotalWonLayout["FREE_SPINS_POPUP_EXTRA_SPINS"] = 0] = "FREE_SPINS_POPUP_EXTRA_SPINS";
        FreeSpinsTotalWonLayout[FreeSpinsTotalWonLayout["FREE_SPINS_POPUP_TOTAL_WON"] = 1] = "FREE_SPINS_POPUP_TOTAL_WON";
    })(game.FreeSpinsTotalWonLayout || (game.FreeSpinsTotalWonLayout = {}));
    var FreeSpinsTotalWonLayout = game.FreeSpinsTotalWonLayout;
    var FreeSpinsGameTotalWonMediator = (function (_super) {
        __extends(FreeSpinsGameTotalWonMediator, _super);
        function FreeSpinsGameTotalWonMediator() {
            _super.apply(this, arguments);
        }
        FreeSpinsGameTotalWonMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingTotalWon"), this.onShowingTotalWon);
            this.addContextListener(game.GameEvent.HAS_EXTRA_FREE_SPINS, this.onHasExtraFreeSpins);
        };
        FreeSpinsGameTotalWonMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingTotalWon"), this.onShowingTotalWon);
            this.removeContextListener(game.GameEvent.HAS_EXTRA_FREE_SPINS, this.onHasExtraFreeSpins);
        };
        FreeSpinsGameTotalWonMediator.prototype.onShowingTotalWon = function () {
            var _this = this;
            var logicResponse = this._server.getLogicResponse();
            var winMultiple = logicResponse.fsWinnings / this._stakeModel.getTotalStake();
            if (winMultiple >= 2) {
                this.view.updateLayout(FreeSpinsTotalWonLayout.FREE_SPINS_POPUP_TOTAL_WON);
                this.view.updateLabel(this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_InvadersFreeSpinOutro_TotalWon"));
                this.view.updateTotalWonAmount(this._currencyFormatter.format(logicResponse.fsWinnings));
                TweenLite.delayedCall(game.BaseGameUIConstants.kTotalWonShowDelay, function () {
                    _this.view.show();
                    TweenLite.delayedCall(game.BaseGameUIConstants.kTotalWonShowDuration, function () {
                        _this.context.parent.eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.SHOW_TOTAL_WON_COMPLETE, _this));
                        _this.view.hide();
                    });
                });
            }
            else {
                this.context.parent.eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.SHOW_TOTAL_WON_COMPLETE, this));
                this.view.hide();
            }
        };
        FreeSpinsGameTotalWonMediator.prototype.onHasExtraFreeSpins = function () {
            var _this = this;
            var logicResponse = this._server.getLogicResponse();
            this.view.updateLayout(FreeSpinsTotalWonLayout.FREE_SPINS_POPUP_EXTRA_SPINS);
            this.view.updateLabel(this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Freespin_MoreFreePlays"));
            this.view.updateTotalWonAmount(logicResponse.fsAwarded.toString());
            this.view.show();
            TweenLite.delayedCall(game.BaseGameUIConstants.kExtraFreeSpinsPopupShowDuration, function () {
                _this.context.parent.eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.SHOWING_EXTRA_FREE_SPINS_COMPLETE, _this));
                _this.view.hide();
            });
        };
        __decorate([
            inject('CurrencyFormatter')
        ], FreeSpinsGameTotalWonMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('ITranslator')
        ], FreeSpinsGameTotalWonMediator.prototype, "_translator", void 0);
        __decorate([
            inject('GameServer')
        ], FreeSpinsGameTotalWonMediator.prototype, "_server", void 0);
        __decorate([
            inject('StakeModel')
        ], FreeSpinsGameTotalWonMediator.prototype, "_stakeModel", void 0);
        return FreeSpinsGameTotalWonMediator;
    }(dragonwings.Mediator));
    game.FreeSpinsGameTotalWonMediator = FreeSpinsGameTotalWonMediator;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsGameTotalWonView = (function (_super) {
        __extends(FreeSpinsGameTotalWonView, _super);
        function FreeSpinsGameTotalWonView() {
            _super.apply(this, arguments);
        }
        FreeSpinsGameTotalWonView.prototype.construct = function () {
            this._modalFrames = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.CF_ModalFrameJson.name), this._cache.getAssetById(game.BaseGameBundle.CF_ModalFrame.name)).getFrames();
            this._modalFrameMC = new rendering.CustomMovieClip(this._modalFrames);
            this._modalFrameMC.scaleX = game.BaseGameUIConstants.kModalFrameScaleX;
            this._modalFrameMC.scaleY = game.BaseGameUIConstants.kModalFrameScaleY;
            this._modalFrameMC.x = (this._device.getBaselineWidth() / 2) - ((this._modalFrameMC.width * this._modalFrameMC.scaleX) / 2);
            this._modalFrameMC.y = (this._device.getBaselineHeight() / 2) - ((this._modalFrameMC.height * this._modalFrameMC.scaleY) / 1.6);
            this._modalFrameMC.fps = game.BaseGameUIConstants.kModalFrameMCFPS;
            this.addChild(this._modalFrameMC);
            this._winAmountText = Utils.MiscUtils.createBasicText(this, "0", game.BaseGameUIConstants.kTotalWonPopupWinAmountFontSize, rendering.TextAlign.CENTER, [700, 200], [550, game.BaseGameUIConstants.kTotalWonPopupWinAmountTextY], game.BaseGameUIConstants.kTotalWonPopupWinAmountTextColour, "#020766", 10);
            this._winAmountText.x = (this._device.getBaselineWidth() / 2) - (this._winAmountText.width / 2);
            this._totalWonLabel = Utils.MiscUtils.createBasicText(this, "0", game.BaseGameUIConstants.kTotalWonPopupTotalWonFontSize, rendering.TextAlign.CENTER, [700, 220], [550, game.BaseGameUIConstants.kTotalWonPopupTotalWonLabelTextY], game.BaseGameUIConstants.kTotalWonPopupTotalWonLabelColour, "#020766", 10);
            this._totalWonLabel.x = (this._device.getBaselineWidth() / 2) - (this._totalWonLabel.width / 2);
            this.addChild(this._winAmountText);
            this.addChild(this._totalWonLabel);
            this.visible = false;
        };
        FreeSpinsGameTotalWonView.prototype.updateTotalWonAmount = function (totalWonFormatted) {
            this._winAmountText.text = totalWonFormatted || "0.00";
            this._winAmountText.x = (this._device.getBaselineWidth() / 2) - (this._winAmountText.width / 2);
        };
        FreeSpinsGameTotalWonView.prototype.updateLabel = function (label) {
            this._totalWonLabel.text = label;
            this._totalWonLabel.x = (this._device.getBaselineWidth() / 2) - (this._totalWonLabel.width / 2);
        };
        FreeSpinsGameTotalWonView.prototype.show = function () {
            var _this = this;
            this.visible = true;
            TweenLite.to(this, 1, {
                alpha: 1,
                onComplete: function () {
                    _this._modalFrameMC.play();
                }
            });
        };
        FreeSpinsGameTotalWonView.prototype.hide = function () {
            var _this = this;
            TweenLite.to(this, 1, {
                alpha: 0,
                onComplete: function () {
                    _this.visible = false;
                    _this._modalFrameMC.stop();
                }
            });
        };
        FreeSpinsGameTotalWonView.prototype.updateLayout = function (layout) {
            switch (layout) {
                case game.FreeSpinsTotalWonLayout.FREE_SPINS_POPUP_EXTRA_SPINS:
                    this._winAmountText.y = game.BaseGameUIConstants.kTotalWonPopupExtraWonLabelTextY;
                    this._totalWonLabel.y = game.BaseGameUIConstants.kTotalWonPopupExtraAmountTextY;
                    this._totalWonLabel.colour = game.BaseGameUIConstants.kTotalWonPopupWinAmountTextColour;
                    break;
                case game.FreeSpinsTotalWonLayout.FREE_SPINS_POPUP_TOTAL_WON:
                    this._winAmountText.y = game.BaseGameUIConstants.kTotalWonPopupWinAmountTextY;
                    this._totalWonLabel.y = game.BaseGameUIConstants.kTotalWonPopupTotalWonLabelTextY;
                    this._totalWonLabel.colour = game.BaseGameUIConstants.kTotalWonPopupTotalWonLabelColour;
                    break;
                default:
            }
        };
        __decorate([
            inject('AssetCache')
        ], FreeSpinsGameTotalWonView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], FreeSpinsGameTotalWonView.prototype, "_device", void 0);
        return FreeSpinsGameTotalWonView;
    }(rendering.DisplayObjectContainer));
    game.FreeSpinsGameTotalWonView = FreeSpinsGameTotalWonView;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsRemainingView = (function (_super) {
        __extends(FreeSpinsRemainingView, _super);
        function FreeSpinsRemainingView() {
            _super.call(this);
        }
        FreeSpinsRemainingView.prototype.construct = function (isDesktop) {
            var playsRemainingContainer = new rendering.DisplayObjectContainer();
            this.addChild(playsRemainingContainer);
            var bgAsset = Utils.MiscUtils.getAssetFrameWithName("fg_counter_background.png", game.FSBundle.CF_PlaysRemaining.name, game.FSBundle.CF_PlaysRemainingJson.name, this._cache);
            var bgBitmap = Utils.MiscUtils.composeBitmap(playsRemainingContainer, bgAsset, 0, 0);
            var bgGlowAsset = Utils.MiscUtils.getAssetFrameWithName("fg_counter_background_glow.png", game.FSBundle.CF_PlaysRemaining.name, game.FSBundle.CF_PlaysRemainingJson.name, this._cache);
            var bgGlowBitmap = Utils.MiscUtils.composeBitmap(playsRemainingContainer, bgGlowAsset, 0, 0);
            bgGlowBitmap.alpha = 0;
            if (isDesktop) {
                playsRemainingContainer.x = 288;
                playsRemainingContainer.y = 850;
            }
            else {
                playsRemainingContainer.x = 1240;
                playsRemainingContainer.y = 0;
            }
            this._glowTween = TweenMax.to(bgGlowBitmap, 1, {
                repeat: Infinity,
                alpha: 1,
                yoyo: true
            });
            var translation = this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Freespin_PlaysRemaining");
            this._playsRemainingLabels = Utils.MiscUtils.createStyledText(translation, game.BaseGameUIConstants.kFontFamily, 34, rendering.TextAlign.LEFT, '#ffffff', 200, 300, ['#000000'], [2], 120, 35);
            for (var i = 0; i < this._playsRemainingLabels.length; i++) {
                playsRemainingContainer.addChild(this._playsRemainingLabels[i]);
            }
            this._playsRemainingTexts = Utils.MiscUtils.createStyledText("0", game.BaseGameUIConstants.kFontFamily, 84, rendering.TextAlign.CENTER, '#ffffff', 200, 300, ['#000000'], [2], 350, 20);
            for (var i = 0; i < this._playsRemainingTexts.length; i++) {
                this._playsRemainingTexts[i].x = 350 - (this._playsRemainingTexts[i].width / 2);
                playsRemainingContainer.addChild(this._playsRemainingTexts[i]);
            }
        };
        FreeSpinsRemainingView.prototype.updatePlaysRemaining = function (playsRemaining) {
            for (var i = 0; i < this._playsRemainingTexts.length; i++) {
                this._playsRemainingTexts[i].text = playsRemaining.toString();
                this._playsRemainingTexts[i].x = 350 - (this._playsRemainingTexts[i].width / 2);
            }
        };
        __decorate([
            inject('ITranslator')
        ], FreeSpinsRemainingView.prototype, "_translator", void 0);
        __decorate([
            inject('AssetCache')
        ], FreeSpinsRemainingView.prototype, "_cache", void 0);
        return FreeSpinsRemainingView;
    }(rendering.DisplayObjectContainer));
    game.FreeSpinsRemainingView = FreeSpinsRemainingView;
})(game || (game = {}));
var game;
(function (game) {
    var FreeSpinsRemainingViewMediator = (function (_super) {
        __extends(FreeSpinsRemainingViewMediator, _super);
        function FreeSpinsRemainingViewMediator() {
            _super.apply(this, arguments);
        }
        FreeSpinsRemainingViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(game.GameEvent.FREE_SPIN_COUNT_UPDATED, this.onFreeSpinsCountUpdated);
        };
        FreeSpinsRemainingViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.FREE_SPIN_COUNT_UPDATED, this.onFreeSpinsCountUpdated);
        };
        FreeSpinsRemainingViewMediator.prototype.onFreeSpinsCountUpdated = function (e) {
            this.view.updatePlaysRemaining(e.id);
        };
        __decorate([
            inject('GameServer')
        ], FreeSpinsRemainingViewMediator.prototype, "_server", void 0);
        __decorate([
            inject('WinInfoModel')
        ], FreeSpinsRemainingViewMediator.prototype, "_winInfoModel", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], FreeSpinsRemainingViewMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('ITranslator')
        ], FreeSpinsRemainingViewMediator.prototype, "_translator", void 0);
        __decorate([
            inject('HistoryModel')
        ], FreeSpinsRemainingViewMediator.prototype, "_historyModel", void 0);
        __decorate([
            inject('FreeSpinsGameModel')
        ], FreeSpinsRemainingViewMediator.prototype, "_freeSpinsGameModel", void 0);
        return FreeSpinsRemainingViewMediator;
    }(dragonwings.Mediator));
    game.FreeSpinsRemainingViewMediator = FreeSpinsRemainingViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var ToggleButtonView = (function (_super) {
        __extends(ToggleButtonView, _super);
        function ToggleButtonView(upAsset, downAsset, overAsset, disabledAsset) {
            _super.call(this, upAsset, downAsset, overAsset, disabledAsset);
            this._inDownState = false;
        }
        ToggleButtonView.prototype.toggleDownState = function () {
            if (this._inDownState) {
                this._inDownState = false;
                this._down = false;
                this.setState();
            }
            else {
                this._inDownState = true;
                this._down = true;
                this.setState();
            }
        };
        Object.defineProperty(ToggleButtonView.prototype, "isDown", {
            get: function () {
                return this._inDownState;
            },
            enumerable: true,
            configurable: true
        });
        // Override base methods to allow us to use as a toggle button
        ToggleButtonView.prototype.onUp = function (event) { };
        ToggleButtonView.prototype.onOver = function (event) { };
        ToggleButtonView.prototype.onOut = function (event) { };
        return ToggleButtonView;
    }(components.Button));
    game.ToggleButtonView = ToggleButtonView;
})(game || (game = {}));
var game;
(function (game) {
    var UIDebugButtonEvent = (function (_super) {
        __extends(UIDebugButtonEvent, _super);
        function UIDebugButtonEvent(eventName) {
            _super.call(this, eventName);
        }
        //
        UIDebugButtonEvent.TURNED_ON = "UIDebugButtonEvent_TURNED_ON";
        UIDebugButtonEvent.TURNED_OFF = "UIDebugButtonEvent_TURNED_OFF";
        return UIDebugButtonEvent;
    }(borgevent.Event));
    game.UIDebugButtonEvent = UIDebugButtonEvent;
    var UIDebugButton = (function (_super) {
        __extends(UIDebugButton, _super);
        function UIDebugButton(isDesktop) {
            _super.call(this);
            this.drawButton(isDesktop);
        }
        UIDebugButton.prototype.drawButton = function (isDesktop) {
            var buttonBox = Utils.MiscUtils.createBox(0, 0, 200, 75, 0xff00ff, true);
            buttonBox.interactive = false;
            this._buttonLabel = new rendering.Text(UIDebugButton.ButtonLabels[0]);
            this._buttonLabel.width = 200;
            this._buttonLabel.fontSize = 30;
            this._buttonLabel.colour = "#eeeeee";
            this._buttonLabel.font = "Myriad Pro Black";
            this._buttonLabel.y = (buttonBox.height - this._buttonLabel.height) / 2;
            this._buttonLabel.x = (buttonBox.width - this._buttonLabel.width) / 2;
            this._buttonLabel.interactive = false;
            this.addChild(buttonBox);
            this.addChild(this._buttonLabel);
            // Setup hit / touch handling
            if (!isDesktop) {
                // For some reason we don't get events on the button in mobile UI
                // unless we add a hitArea. But if we DO add it in desktop, we get
                // doubled up events
                buttonBox.hitArea = new rendering.Rectangle(0, 0, 200, 75);
                buttonBox.interactive = true;
            }
            buttonBox.addEventListener(rendering.InputEvent.DOWN, this.onClick, this);
        };
        UIDebugButton.prototype.onClick = function (e) {
            Utils.PSLog.log("UIDebugButton::onClick()");
            this._isOpen = !this._isOpen;
            var eventName = this._isOpen ? UIDebugButtonEvent.TURNED_ON : UIDebugButtonEvent.TURNED_OFF;
            this._buttonLabel.text = this._isOpen ? UIDebugButton.ButtonLabels[1] : UIDebugButton.ButtonLabels[0];
            this.dispatchEvent(new UIDebugButtonEvent(eventName));
        };
        UIDebugButton.ButtonLabels = ["UI Layers", "CLOSE"];
        return UIDebugButton;
    }(rendering.DisplayObjectContainer));
    game.UIDebugButton = UIDebugButton;
})(game || (game = {}));
// WheelView is a quickly ported version of what we did in Flame of Fortune
// It could do with a little "upgrading" to bring it in line with the style
// of current code but that will happen if we have time
var game;
(function (game) {
    var WheelViewEvent = (function (_super) {
        __extends(WheelViewEvent, _super);
        function WheelViewEvent(type, view) {
            _super.call(this, type);
            this._view = view;
        }
        Object.defineProperty(WheelViewEvent.prototype, "view", {
            get: function () {
                return this._view;
            },
            enumerable: true,
            configurable: true
        });
        WheelViewEvent.ON_START = "WheelViewEvent_ON_START";
        WheelViewEvent.ON_STOP = "WheelViewEvent_ON_STOP";
        WheelViewEvent.INIT_ANIMATION_COMPLETE = "WheelViewEvent_INIT_ANIMATION_COMPLETE";
        return WheelViewEvent;
    }(dragonwings.Event));
    game.WheelViewEvent = WheelViewEvent;
    var WheelView = (function (_super) {
        __extends(WheelView, _super);
        function WheelView() {
            _super.call(this);
            this._animateTweens = new Array();
            this._elements = [];
            this._maxBrakingFactor = 0.2;
            this._animationStopping = false;
            this._stopAnchorIndex = 0;
            this._fake3dScaleFactor = 1;
            this._rotationBrake = undefined;
        }
        WheelView.prototype.addElement = function (element) {
            this._elements.push(element);
            this.addChild(element);
        };
        Object.defineProperty(WheelView.prototype, "stopAnchorIndex", {
            get: function () {
                return this._stopAnchorIndex;
            },
            // Accessors    
            set: function (index) {
                this._stopAnchorIndex = index;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WheelView.prototype, "wheelId", {
            //
            get: function () {
                return this._wheelId;
            },
            set: function (id) {
                this._wheelId = id;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WheelView.prototype, "fake3dScaleFactor", {
            //
            get: function () {
                return this._fake3dScaleFactor;
            },
            set: function (factor) {
                this._fake3dScaleFactor = factor;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WheelView.prototype, "selectedElement", {
            //
            get: function () {
                var retVal = this._elements[this._stopIndex];
                return retVal;
            },
            enumerable: true,
            configurable: true
        });
        WheelView.prototype.show = function () {
            this.visible = true;
            this._animationStopping = false;
        };
        WheelView.prototype.hide = function () {
            this.visible = false;
        };
        WheelView.prototype.positionElements = function () {
            this._anchorPoints = WheelView.getAnchorPoints(this._xRadius, this._yRadius, this._elements.length);
            this.resetElementPositions();
        };
        WheelView.prototype.startAnimation = function (initialSpeed) {
            this._stopAtProgress = undefined;
            this._rotationBrake = undefined;
            this.positionElements();
            this._initialSpeed = initialSpeed;
            this._animateTweens = [];
            this._animationStopping = false;
            for (var i = 0; i < this._elements.length; ++i) {
                var circleTween = this.getElementAnimation(i);
                circleTween.duration(initialSpeed);
                circleTween.data = i;
                this._animateTweens.push(circleTween);
                circleTween.play();
            }
        };
        // Stops rotation animation immediately & notifies the world
        WheelView.prototype.stopRotation = function (supressEvent) {
            var sendEvent = true;
            if (supressEvent) {
                sendEvent = !supressEvent;
            }
            // Reset braking conditions
            if (this._brakeTween) {
                this._brakeTween.kill();
                this._brakeTween = undefined;
            }
            this._rotationBrake = undefined;
            for (var i = 0; i < this._animateTweens.length; ++i) {
                var circleTween = this._animateTweens[i];
                if ((circleTween.data == this._animateTweens.length - 1) && sendEvent) {
                    this.dispatchEvent(new WheelViewEvent(WheelViewEvent.ON_STOP, this));
                }
                circleTween.kill();
            }
            this._animationStopping = false;
            this._animateTweens = [];
        };
        // Once called, _stopAtProgress is set which will be picked up by
        // the rotation animation tween update function. This will in turn
        // cause the animation to slow and stop at the appropriate place  
        WheelView.prototype.stopAnimationAtIndex = function (elementIdx) {
            Utils.PSLog.log("WheelView::stopAnimationAtIndex(" + elementIdx + ")");
            this._animationStopping = true;
            this._stopIndex = elementIdx;
            // Given the index of the element we want to stop on along with 
            // the target stop anchor index we calculate a target animation progress
            // (in [0..1]) to stop at for the selected element
            this._stopAtProgress = (this._stopAnchorIndex - elementIdx) * 1 / this._elements.length;
            //Utils.PSLog.getInstance().log(`WheelView::stopAnimationAtIndex() - calculated stopAtProgress =${this._stopAtProgress}`);
            if (this._stopAtProgress < 0) {
                this._stopAtProgress += 1;
            }
        };
        WheelView.prototype.construct = function (xRadius, yRadius) {
            this._xRadius = xRadius;
            this._yRadius = yRadius;
        };
        WheelView.prototype.removeAllElements = function () {
            for (var i = 0; i < this._elements.length; ++i) {
                var elmnt = this._elements[i];
                this.removeChild(elmnt);
            }
            this._elements = [];
            for (var i = 0; i < this._animateTweens.length; ++i) {
                this._animateTweens[i].kill();
                delete this._animateTweens[i];
            }
            this._animateTweens = [];
        };
        WheelView.prototype.elementInitAnimationComplete = function () {
            this.dispatchEvent(new WheelViewEvent(WheelViewEvent.INIT_ANIMATION_COMPLETE, this));
        };
        WheelView.prototype.resetElementPositions = function () {
            for (var i = 0; i < this._elements.length; ++i) {
                var elmnt = this._elements[i];
                elmnt.x = this._anchorPoints[i].x;
                elmnt.y = this._anchorPoints[i].y;
                // If we're faking 3d, we need to scale the element if its
                // y pos is in the top half of the wheel
                if (this._fake3dScaleFactor < 1) {
                    if (elmnt.y < 0) {
                        var linearScale = (Math.abs(elmnt.y) / this._yRadius) * this._fake3dScaleFactor;
                        elmnt.scaleX = 1 - linearScale;
                        elmnt.scaleY = 1 - linearScale;
                    }
                    else {
                        elmnt.scaleX = 1;
                        elmnt.scaleY = 1;
                    }
                }
            }
        };
        WheelView.prototype.getElementAnimation = function (elementIdx) {
            // Get the path for this element by slicing & concatenating
            // the array of element points appropriately
            var points = this._anchorPoints.slice(elementIdx, this._anchorPoints.length).concat(this._anchorPoints.slice(0, elementIdx));
            // append starting point as final point to close the path
            points.push(points[0]);
            // Now generate a smooth cubic bezier from these anchor points
            var elementCubic = WheelView.getCubicForPoints(points);
            var circlePos = points[0];
            var element = this._elements[elementIdx];
            var self = this;
            var circleTween = TweenMax.to(circlePos, this._initialSpeed, {
                force3D: true,
                bezier: {
                    type: "cubic",
                    values: elementCubic
                },
                ease: Linear.easeNone,
                paused: true,
                repeat: -1,
                onUpdate: self.onRotateUpdate,
                onUpdateParams: [elementIdx, element, circlePos, self]
            });
            return circleTween;
        };
        // Called from the rotation tween to update wheel element positions and
        // handle slowing / stopping of the rotation. 
        WheelView.prototype.onRotateUpdate = function (elementIdx, element, circlePos, wheelView) {
            // Grab the animation tween for the selected element
            var elementAnimation = wheelView._animateTweens[elementIdx];
            // Update the position of the element
            element.x = circlePos.x;
            element.y = circlePos.y;
            // If we're faking 3d, we need to scale the element if its
            // y pos is in the top half of the wheel
            if (wheelView._fake3dScaleFactor < 1) {
                if (element.y < 0) {
                    var linearScale = (Math.abs(element.y) / wheelView._yRadius) * wheelView._fake3dScaleFactor;
                    element.scaleX = 1 - linearScale;
                    element.scaleY = 1 - linearScale;
                }
                else {
                    element.scaleX = 1;
                    element.scaleY = 1;
                }
            }
            // Update speed via timeScale if _rotationBrake is set
            if (wheelView._rotationBrake) {
                elementAnimation.timeScale(wheelView._rotationBrake);
            }
            // If a stop index has been set, _stopAtProgress will be set to the final
            // progress value required in order for the animation to stop at the correct
            // point
            if (elementIdx == wheelView._stopIndex) {
                // Update the braking factor and apply
                var diff = wheelView.getDistanceToStop();
                // If we're already braking...
                if (wheelView._rotationBrake) {
                    var absStopMargin = 0.004;
                    // Check if we're close enough to the stop point to .... stop                    
                    // If we're less than some sensible epsilon either side then stop
                    if ((diff < absStopMargin) || ((1.0 - diff) < absStopMargin)) {
                        //Utils.PSLog.getInstance().log(`WheelView::onRotateUpdate() - stopping rotation @ diff = ${diff}`);
                        wheelView.stopRotation();
                    }
                }
                else {
                    // Define bounds between which rotation braking can be initiated
                    var kSlowingUpperConstraint = 0.4;
                    var kSlowingLowerConstraint = 0.1;
                    // if rotation progress is between defined bounds then start to
                    // slow the animation by calculating braking factor
                    if ((diff < kSlowingUpperConstraint) && (diff > kSlowingLowerConstraint)) {
                        //Utils.PSLog.getInstance().log(`WheelView::onRotateUpdate() - initating braking @ diff = ${diff}`);
                        var initialBrake = 1.0 - (kSlowingUpperConstraint - diff);
                        initialBrake = initialBrake < wheelView._maxBrakingFactor ? wheelView._maxBrakingFactor : initialBrake;
                        // initiate braking 
                        //Utils.PSLog.getInstance().log(`WheelView::onRotateUpdate() - initial brake = ${initialBrake}`);
                        // Create a tween to apply braking with an ease function
                        // - makes it easier to tweak the results for pleasing visuals
                        var tweenableBrake = { brake: initialBrake };
                        var brakeTotalTime = diff * wheelView._initialSpeed * 2;
                        //Utils.PSLog.getInstance().log(`WheelView::onRotateUpdate() - brakeTotalTime = ${brakeTotalTime}`);
                        wheelView._brakeTween = TweenMax.to(tweenableBrake, brakeTotalTime, {
                            brake: wheelView._maxBrakingFactor,
                            ease: Sine.easeOut,
                            onUpdate: function () {
                                wheelView._rotationBrake = tweenableBrake.brake < wheelView._maxBrakingFactor ? wheelView._maxBrakingFactor : tweenableBrake.brake;
                            }
                        });
                    }
                }
            }
        };
        WheelView.prototype.getDistanceToStop = function (doModulo) {
            if (doModulo === void 0) { doModulo = true; }
            var diff = undefined;
            if (this._animationStopping) {
                // Only relevent to the element at the stop index
                var elementAnimation = this._animateTweens[this._stopIndex];
                var currProgress = elementAnimation.progress();
                // Get the distance (in terms of rotation progress) to the stop point
                diff = this._stopAtProgress - currProgress;
                if (doModulo) {
                    // modulo the circle when we're already past the stop point 
                    if (diff <= 0) {
                        diff += 1;
                    }
                }
            }
            return diff;
        };
        /*public replaceElement(index: number, newImage: compimage.IImage, animation: compimage.IImage): void {
    if ((index < 0) || (index >= this._elements.length)) {
        throw("WheelView::replaceElement() - Index out of bounds");
    }
    
    // Check if we have an animation and if it is playable
    var animator: abg2d.FrameAnimator;
    var self: WheelView = this;
    
    if (animation) {
        animator = animation.getAnimation();
        animator.setEndMode(abg2d.AnimationEndMode.Hide);
    }

    if (animator) {
        this._elements[index].addChild(animation);
        animator.setOnComplete(() => {
            self.changeElementImage(index, newImage, self);
            self._elements[index].removeChild(animation);
        });
        animator.play();
        this._audioModel.play(this._bundleModel.getBundle<Game.AudioBundle>(Game.AudioBundle).SW_Upgrade);
    } else {
        this.changeElementImage(index, newImage, this);
    }
}*/
        /*private changeElementImage(index: number, newImage: compimage.IImage, self: WheelView): void {
            self.removeChild(self._elements[index]);
            self._elements[index] = newImage;
            self._elements[index].setPosition(self._anchorPoints[index].x, self._anchorPoints[index].y);
            self.addChild(self._elements[index]);
        }*/
        // Given x & y radii and number of elements, calculate element positions
        // which also server as bezier anchor points - not this is trickier now 
        // we support eliptical paths. Elipses are always much harder to deal with
        WheelView.getAnchorPoints = function (xRadius, yRadius, numPoints) {
            var MinPoints = 4;
            var result = [];
            var xVal;
            var yVal;
            var pointCount = (numPoints < MinPoints) ? MinPoints : numPoints;
            var circumference = Utils.MiscUtils.approximateEllipseCircumference(xRadius, yRadius);
            var arcLength = circumference / pointCount;
            var deltaTheta = 0.001;
            var angleIncrement = Math.PI * 2 / pointCount;
            var angle = -Math.PI / 2;
            //console.log(`pointCount = ${pointCount}, angleInc = ${angleIncrement}`);
            for (var i = 0; i < pointCount; ++i) {
                xVal = Math.floor(xRadius * (Math.cos(angle) + 0.0001));
                yVal = Math.floor(yRadius * (Math.sin(angle) + 0.0001));
                result.push({ x: xVal, y: yVal });
                //angle += angleIncrement;
                angle = Utils.MiscUtils.getAngleForArcLength(xRadius, yRadius, angle, arcLength, angle, deltaTheta);
            }
            return result;
        };
        // The "simple bezier" generated by TweenMax wasn't smooth enough
        // so we generate proper cubic control points here and massage the
        // results into an appropriate form for tweening 
        WheelView.getCubicForPoints = function (points) {
            var result = [];
            var cubicData = BezierPlugin.bezierThrough(points);
            var xData = cubicData.x;
            var yData = cubicData.y;
            for (var i = 0; i < xData.length; ++i) {
                var a = { x: Math.floor(xData[i].a), y: Math.floor(yData[i].a) };
                var b = { x: Math.floor(xData[i].b), y: Math.floor(yData[i].b) };
                var c = { x: Math.floor(xData[i].c), y: Math.floor(yData[i].c) };
                var d = { x: Math.floor(xData[i].d), y: Math.floor(yData[i].d) };
                if (i == 0) {
                    result.push(a);
                }
                result.push(b);
                result.push(c);
                result.push(d);
            }
            return result;
        };
        return WheelView;
    }(rendering.DisplayObjectContainer));
    game.WheelView = WheelView;
})(game || (game = {}));
var game;
(function (game) {
    var HelpPage1View = (function (_super) {
        __extends(HelpPage1View, _super);
        function HelpPage1View(cache, translator, metaData, server, currencyFormatter, awardsData, isDesktop) {
            _super.call(this);
            this._dynamicTexts = {};
            this._cache = cache;
            this._translator = translator;
            this._metaData = metaData;
            this._server = server;
            this._currencyFormatter = currencyFormatter;
            this._awardsData = awardsData;
            this._isDesktop = isDesktop;
        }
        HelpPage1View.prototype.construct = function () {
            this.addBackground();
            this.addStaticTexts();
            this.addDynamicTexts();
            return this;
        };
        HelpPage1View.prototype.addBackground = function () {
            var background = new rendering.Bitmap(Utils.MiscUtils.getAssetFrameWithName("help_page_1.png", game.HelpBundle.Help_Page1.name, game.HelpBundle.Help_Page1Json.name, this._cache));
            this.addChild(background);
        };
        HelpPage1View.prototype.addStaticTexts = function () {
            var translations = {};
            translations['pageTitle'] = this._translator.findByKey("framework_com_wms_framework_Paytable_PaytableHeader");
            translations['text1'] = this._translator.findByKey("FreeSpin_com_wms_Wild");
            translations['text2'] = this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Help_Paytables_WildExplanation");
            translations['text3'] = this._translator.findByKey("framework_com_wms_framework_Paytable_PayReflectsBet") + " "
                + this._translator.findByKey("framework_com_wms_framework_Paytable_LeftmostAdjacentPaylines") + " "
                + this._translator.findByKey("framework_com_wms_framework_Paytable_HighestWinnerPaid") + " "
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Help_Paytables_MixedStandardLinePay");
            var pageTitle = Utils.MiscUtils.createBasicText(this, translations['pageTitle'], 40, rendering.TextAlign.CENTER, [200, 50], [1580, 50], "#fecbff", "#6600cc", 6);
            var text1 = Utils.MiscUtils.createBasicText(this, translations['text1'], 40, rendering.TextAlign.CENTER, [170, 50], [440, 210], "#ffffff", "#000000", 4);
            var text2 = Utils.MiscUtils.createBasicText(this, translations['text2'], 32, rendering.TextAlign.CENTER, [800, 100], [1160, 190], "#ffffff", "#000000", 4);
            text2.wrapWidth = 700;
            var mixedText = Utils.MiscUtils.createBasicText(this, "MIXED", 32, rendering.TextAlign.CENTER, [800, 100], [1124, 320], "#ffffff", "#000000", 4);
            var x = 1020;
            var y = 915;
            var wrapWidth = 1270;
            var fontSize = 22;
            var shortLocale = this._metaData.getLocale().toLowerCase().substr(0, 2);
            if (game.BaseGameUIConstants.kHelpViewBottomTextXPositionOverridesByLocale[shortLocale]) {
                x = game.BaseGameUIConstants.kHelpViewBottomTextXPositionOverridesByLocale[shortLocale];
            }
            if (!this._isDesktop) {
                y = 930;
                wrapWidth = 1250;
                fontSize = 26;
            }
            var text3 = Utils.MiscUtils.createBasicText(this, translations['text3'], fontSize, rendering.TextAlign.CENTER, [1350, 120], [x, y], "#ffffff", "#000000", 2);
            text3.wrapWidth = wrapWidth;
        };
        HelpPage1View.prototype.addDynamicTexts = function () {
            // jackpot
            this._dynamicTexts[1] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[1][5]), 32, rendering.TextAlign.LEFT, [130, 50], [435, 562], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[1][4]), 32, rendering.TextAlign.LEFT, [130, 50], [435, 605], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[1][3]), 32, rendering.TextAlign.LEFT, [130, 50], [435, 649], "#ffffff", "#000000", 4)
            };
            // fairy, unicorn, butterfly, ladybug, mushroom
            this._dynamicTexts[0] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[0][5]), 32, rendering.TextAlign.LEFT, [130, 50], [1115, 562], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[0][4]), 32, rendering.TextAlign.LEFT, [130, 50], [1115, 605], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[0][3]), 32, rendering.TextAlign.LEFT, [130, 50], [1115, 649], "#ffffff", "#000000", 4)
            };
            // rabbit
            this._dynamicTexts[6] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[6][5]), 32, rendering.TextAlign.LEFT, [130, 50], [615, 764], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[6][4]), 32, rendering.TextAlign.LEFT, [130, 50], [615, 810], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[6][3]), 32, rendering.TextAlign.LEFT, [130, 50], [615, 854], "#ffffff", "#000000", 4)
            };
            // flower
            this._dynamicTexts[7] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[7][5]), 32, rendering.TextAlign.LEFT, [130, 50], [1035, 764], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[7][4]), 32, rendering.TextAlign.LEFT, [130, 50], [1035, 810], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[7][3]), 32, rendering.TextAlign.LEFT, [130, 50], [1035, 854], "#ffffff", "#000000", 4)
            };
            // toadstool
            this._dynamicTexts[8] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[8][5]), 32, rendering.TextAlign.LEFT, [130, 50], [1455, 764], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[8][4]), 32, rendering.TextAlign.LEFT, [130, 50], [1455, 810], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[8][3]), 32, rendering.TextAlign.LEFT, [130, 50], [1455, 854], "#ffffff", "#000000", 4)
            };
            if (!this._isDesktop) {
                for (var group in this._dynamicTexts) {
                    for (var numSyms in this._dynamicTexts[group]) {
                        this._dynamicTexts[group][numSyms].y += 10;
                    }
                }
            }
        };
        HelpPage1View.prototype.updateDynamicValuesForStake = function (stake) {
            for (var group in this._dynamicTexts) {
                for (var numSyms in this._dynamicTexts[group]) {
                    this._dynamicTexts[group][numSyms].text = this._currencyFormatter.format(this._awardsData[group][numSyms] * stake);
                    Utils.MiscUtils.centreReg(this._dynamicTexts[group][numSyms], 1);
                    this._dynamicTexts[group][numSyms].pivot.x = 0;
                }
            }
        };
        return HelpPage1View;
    }(rendering.DisplayObjectContainer));
    game.HelpPage1View = HelpPage1View;
})(game || (game = {}));
var game;
(function (game) {
    var HelpPage2View = (function (_super) {
        __extends(HelpPage2View, _super);
        function HelpPage2View(cache, translator, metaData, server, currencyFormatter, awardsData, isDesktop) {
            _super.call(this);
            this._dynamicTexts = {};
            this._cache = cache;
            this._translator = translator;
            this._metaData = metaData;
            this._server = server;
            this._currencyFormatter = currencyFormatter;
            this._awardsData = awardsData;
            this._isDesktop = isDesktop;
        }
        HelpPage2View.prototype.construct = function () {
            this.visible = false;
            this.addBackground();
            this.addStaticTexts();
            this.addDynamicTexts();
            return this;
        };
        HelpPage2View.prototype.addBackground = function () {
            var background = new rendering.Bitmap(Utils.MiscUtils.getAssetFrameWithName("help_page_2.png", game.HelpBundle.Help_Page2.name, game.HelpBundle.Help_Page2Json.name, this._cache));
            this.addChild(background);
        };
        HelpPage2View.prototype.addStaticTexts = function () {
            var translations = {};
            translations['pageTitle'] = this._translator.findByKey("framework_com_wms_framework_Paytable_PaytableHeader");
            translations['text1'] = this._translator.findByKey("FreeSpin_com_wms_Wild");
            translations['text2'] = this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Help_Paytables_WildExplanation");
            translations['text3'] = this._translator.findByKey("framework_com_wms_framework_Paytable_PayReflectsBet") + " "
                + this._translator.findByKey("framework_com_wms_framework_Paytable_LeftmostAdjacentPaylines") + " "
                + this._translator.findByKey("framework_com_wms_framework_Paytable_HighestWinnerPaid") + " "
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Help_Paytables_MixedStandardLinePay");
            var pageTitle = Utils.MiscUtils.createBasicText(this, translations['pageTitle'], 40, rendering.TextAlign.CENTER, [200, 50], [1580, 50], "#fecbff", "#6600cc", 6);
            var text1 = Utils.MiscUtils.createBasicText(this, translations['text1'], 40, rendering.TextAlign.CENTER, [170, 50], [440, 260], "#ffffff", "#000000", 4);
            var text2 = Utils.MiscUtils.createBasicText(this, translations['text2'], 32, rendering.TextAlign.CENTER, [800, 100], [1160, 240], "#ffffff", "#000000", 4);
            text2.wrapWidth = 700;
            var x = 1020, y = 870, shortLocale = this._metaData.getLocale().toLowerCase().substr(0, 2);
            if (game.BaseGameUIConstants.kHelpViewBottomTextXPositionOverridesByLocale[shortLocale]) {
                x = game.BaseGameUIConstants.kHelpViewBottomTextXPositionOverridesByLocale[shortLocale];
            }
            if (!this._isDesktop) {
                y = 930;
            }
            var text3 = Utils.MiscUtils.createBasicText(this, translations['text3'], 28, rendering.TextAlign.CENTER, [1350, 120], [x, y], "#ffffff", "#000000", 2);
            text3.wrapWidth = 1250;
        };
        HelpPage2View.prototype.addDynamicTexts = function () {
            // wand
            this._dynamicTexts[2] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[2][5]), 32, rendering.TextAlign.CENTER, [130, 50], [510, 655], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[2][4]), 32, rendering.TextAlign.CENTER, [130, 50], [510, 698], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[2][3]), 32, rendering.TextAlign.CENTER, [130, 50], [510, 742], "#ffffff", "#000000", 4)
            };
            // lantern
            this._dynamicTexts[3] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[3][5]), 32, rendering.TextAlign.CENTER, [130, 50], [830, 655], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[3][4]), 32, rendering.TextAlign.CENTER, [130, 50], [830, 698], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[3][3]), 32, rendering.TextAlign.CENTER, [130, 50], [830, 742], "#ffffff", "#000000", 4)
            };
            // bottle
            this._dynamicTexts[4] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[4][5]), 32, rendering.TextAlign.CENTER, [130, 50], [1160, 655], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[4][4]), 32, rendering.TextAlign.CENTER, [130, 50], [1160, 698], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[4][3]), 32, rendering.TextAlign.CENTER, [130, 50], [1160, 742], "#ffffff", "#000000", 4)
            };
            // wreath
            this._dynamicTexts[5] = {
                '5': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[5][5]), 32, rendering.TextAlign.CENTER, [130, 50], [1500, 655], "#ffffff", "#000000", 4),
                '4': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[5][4]), 32, rendering.TextAlign.CENTER, [130, 50], [1500, 698], "#ffffff", "#000000", 4),
                '3': Utils.MiscUtils.createBasicText(this, this._currencyFormatter.format(this._awardsData[5][3]), 32, rendering.TextAlign.CENTER, [130, 50], [1500, 742], "#ffffff", "#000000", 4)
            };
            if (!this._isDesktop) {
                for (var group in this._dynamicTexts) {
                    for (var numSyms in this._dynamicTexts[group]) {
                        this._dynamicTexts[group][numSyms].y += 10;
                    }
                }
            }
        };
        HelpPage2View.prototype.updateDynamicValuesForStake = function (stake) {
            for (var group in this._dynamicTexts) {
                for (var numSyms in this._dynamicTexts[group]) {
                    this._dynamicTexts[group][numSyms].text = this._currencyFormatter.format(this._awardsData[group][numSyms] * stake);
                    Utils.MiscUtils.centreReg(this._dynamicTexts[group][numSyms], 1);
                    this._dynamicTexts[group][numSyms].pivot.x = 0;
                }
            }
        };
        return HelpPage2View;
    }(rendering.DisplayObjectContainer));
    game.HelpPage2View = HelpPage2View;
})(game || (game = {}));
var game;
(function (game) {
    var HelpPage3View = (function (_super) {
        __extends(HelpPage3View, _super);
        function HelpPage3View(cache, translator, metaData, server, currencyFormatter, awardsData) {
            _super.call(this);
            this._dynamicTexts = {};
            this._cache = cache;
            this._translator = translator;
            this._metaData = metaData;
            this._server = server;
            this._currencyFormatter = currencyFormatter;
            this._awardsData = awardsData;
        }
        HelpPage3View.prototype.construct = function () {
            this.visible = false;
            this.addBackground();
            this.addStaticTexts();
            return this;
        };
        HelpPage3View.prototype.addBackground = function () {
            var background = new rendering.Bitmap(Utils.MiscUtils.getAssetFrameWithName("help_page_3.png", game.HelpBundle.Help_Page3.name, game.HelpBundle.Help_Page3Json.name, this._cache));
            this.addChild(background);
        };
        HelpPage3View.prototype.addStaticTexts = function () {
            var translations = {};
            translations['pageTitle'] = this._translator.findByKey("framework_com_wms_framework_Paytable_PaylinesHeader");
            translations['text1'] = this._translator.findByKey("framework_com_wms_framework_Paytable_FollowingLinesContribute") + " "
                + this._translator.findByKey("framework_com_wms_framework_Paytable_AnyOrAllLines") + " "
                + this._translator.findByKey("framework_com_wms_framework_Paytable_PaylinesAdded") + " "
                + this._translator.findByKey("framework_com_wms_framework_Paytable_TotalBetDividedEqually") + " "
                + this._translator.findByKey("framework_com_wms_framework_Paytable_TotalBetLinesTimesBet");
            translations['text2'] = this._translator.findByKey("framework_com_wms_framework_Paytable_WinCap");
            translations['text3'] = this._translator.findByKey("framework_com_wms_framework_Paytable_MalfunctionDisclaimer");
            translations['text4'] = this._translator.findByKeyAndReplace("framework_com_wms_framework_Paytable_ReturnToPlayer", ["{0}"], ["96"]);
            translations['text5'] = this._translator.findByKey("framework_com_wms_framework_Paytable_ActivePaylinesWin");
            translations['text6'] = "\u00a92014-2017 Scientific Games Corporation." + this._translator.findByKey("framework_com_wms_framework_Help_AllRightsReserved");
            translations['text7'] = this._translator.findByKey("framework_com_wms_framework_Help_ClientVersionLabel") + this._cache.getAssetById(game.BaseGameBundle.PackageJson.name).data.version;
            var pageTitle = Utils.MiscUtils.createBasicText(this, translations['pageTitle'], 40, rendering.TextAlign.CENTER, [200, 50], [1580, 50], "#fecbff", "#6600cc", 6);
            var text1 = Utils.MiscUtils.createText(this, translations['text1'], 23, rendering.TextAlign.CENTER, [1250, 150], [370, 142], "#FFFFFF", "#000000", 2, false, "plain", true, false);
            if (this._metaData.getMaxWinStatus) {
                if (this._metaData.getMaxWinStatus()) {
                    var winCap = this._server.getInitResponse().maxWinValue;
                    var winCapStr = this._currencyFormatter.format(winCap);
                    translations['text2'] = Utils.MiscUtils.searchAndReplace(translations['text2'], "{0}", winCapStr);
                    var text2 = Utils.MiscUtils.createText(this, translations['text2'], 23, rendering.TextAlign.CENTER, [1250, 120], [370, 290], "#FFFFFF", "#000000", 2, false, "plain", true, false);
                }
            }
            var text3 = Utils.MiscUtils.createBasicText(this, translations['text3'], 22, rendering.TextAlign.CENTER, [1250, 300], [990, 710], "#ffffff", "#000000", 2);
            var text4 = Utils.MiscUtils.createBasicText(this, translations['text4'], 22, rendering.TextAlign.CENTER, [1250, 300], [990, 750], "#ffffff", "#000000", 2);
            var text4a = Utils.MiscUtils.createBasicText(this, "96% Crystal Forest HD", 22, rendering.TextAlign.CENTER, [1250, 300], [990, 790], "#ffffff", "#000000", 2);
            var text5 = Utils.MiscUtils.createBasicText(this, translations['text5'], 22, rendering.TextAlign.CENTER, [1250, 300], [990, 840], "#ffffff", "#000000", 2);
            //var text5a: rendering.Text = Utils.MiscUtils.createBasicText(this, "\u00a9 2014 Williams Interactive", 22, rendering.TextAlign.CENTER, [1250, 300], [990, 885], "#ffffff", "#000000", 2);
            var text6 = Utils.MiscUtils.createBasicText(this, translations['text6'], 22, rendering.TextAlign.CENTER, [1250, 300], [990, 880], "#ffffff", "#000000", 2);
            var text7 = Utils.MiscUtils.createBasicText(this, translations['text7'], 22, rendering.TextAlign.CENTER, [1250, 300], [990, 920], "#ffffff", "#000000", 2);
        };
        return HelpPage3View;
    }(rendering.DisplayObjectContainer));
    game.HelpPage3View = HelpPage3View;
})(game || (game = {}));
var game;
(function (game) {
    var HelpPage4View = (function (_super) {
        __extends(HelpPage4View, _super);
        function HelpPage4View(cache, translator, metaData, server, currencyFormatter, awardsData) {
            _super.call(this);
            this._dynamicTexts = {};
            this._cache = cache;
            this._translator = translator;
            this._metaData = metaData;
            this._server = server;
            this._currencyFormatter = currencyFormatter;
            this._awardsData = awardsData;
        }
        HelpPage4View.prototype.construct = function () {
            this.visible = false;
            this.addBackground();
            this.addStaticTexts();
            return this;
        };
        HelpPage4View.prototype.addBackground = function () {
            var background = new rendering.Bitmap(Utils.MiscUtils.getAssetFrameWithName("help_page_4.png", game.HelpBundle.Help_Page4.name, game.HelpBundle.Help_Page4Json.name, this._cache));
            this.addChild(background);
        };
        HelpPage4View.prototype.addStaticTexts = function () {
            var translations = {};
            translations['pageTitle'] = this._translator.findByKey("framework_com_wms_framework_Rules_FeatureDescriptionHeader").toLocaleUpperCase();
            translations['text1'] = this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_Trigger") + " \n\n"
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_4CascadesAwards7") + " \n"
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_5CascadesAwards10") + " \n"
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_6CascadesAwards15") + " \n"
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_7CascadesAwards25") + " \n"
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_8CascadesAwards50") + " \n\n"
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_AlternateReels") + " "
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_BetAndPaylinesRemainSame") + " "
                + this._translator.findByKey("FreeSpin_com_wms_freespin_IdenticalCombos") + " "
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_4CascadesAddFreePlays") + " "
                + this._translator.findByKey("Game_Locales_com_wms_invadersfromtheplanetmoolah_Rules_Feature_TriggerRandomly") + " "
                + this._translator.findByKey("Game_Locales_com_wms_crystalforest_Rules_Feature_ClickToStartFeature");
            var pageTitle = Utils.MiscUtils.createBasicText(this, translations['pageTitle'], 40, rendering.TextAlign.CENTER, [300, 50], [1580, 50], "#fecbff", "#6600cc", 6);
            var text1 = Utils.MiscUtils.createBasicText(this, translations['text1'], 40, rendering.TextAlign.CENTER, [1020, 700], [1070, 260], "#ffffff", "#000000", 4);
            text1.wrapWidth = text1.width;
        };
        return HelpPage4View;
    }(rendering.DisplayObjectContainer));
    game.HelpPage4View = HelpPage4View;
})(game || (game = {}));
var game;
(function (game) {
    var HelpPage5View = (function (_super) {
        __extends(HelpPage5View, _super);
        function HelpPage5View(cache, translator, metaData, server, currencyFormatter, awardsData) {
            _super.call(this);
            this._dynamicTexts = {};
            this._cache = cache;
            this._translator = translator;
            this._metaData = metaData;
            this._server = server;
            this._currencyFormatter = currencyFormatter;
            this._awardsData = awardsData;
        }
        HelpPage5View.prototype.construct = function () {
            this.visible = false;
            this.addBackground();
            this.addStaticTexts();
            return this;
        };
        HelpPage5View.prototype.addBackground = function () {
            var background = new rendering.Bitmap(Utils.MiscUtils.getAssetFrameWithName("help_page_5.png", game.HelpBundle.Help_Page5.name, game.HelpBundle.Help_Page5Json.name, this._cache));
            this.addChild(background);
        };
        HelpPage5View.prototype.addStaticTexts = function () {
            var translations = {};
            translations['pageTitle'] = this._translator.findByKey("CascadingReels_com_wms_cascadingreels_CascadingReelsHeader").toLocaleUpperCase();
            ;
            translations['text1'] = this._translator.findByKey("CascadingReels_com_wms_cascadingreels_ReelsFallIntoPosition") + " \n\n"
                + this._translator.findByKey("CascadingReels_com_wms_cascadingreels_SymbolsInCombinationDisappear") + " \n\n"
                + this._translator.findByKey("CascadingReels_com_wms_cascadingreels_RemainingSymbolsDrop") + " \n\n"
                + this._translator.findByKey("CascadingReels_com_wms_cascadingreels_ProcessContinues");
            var pageTitle = Utils.MiscUtils.createBasicText(this, translations['pageTitle'], 40, rendering.TextAlign.CENTER, [300, 50], [1580, 50], "#fecbff", "#6600cc", 6);
            var text1 = Utils.MiscUtils.createBasicText(this, translations['text1'], 40, rendering.TextAlign.CENTER, [1070, 700], [1030, 340], "#ffffff", "#000000", 4);
            text1.wrapWidth = text1.width;
        };
        return HelpPage5View;
    }(rendering.DisplayObjectContainer));
    game.HelpPage5View = HelpPage5View;
})(game || (game = {}));
var game;
(function (game) {
    var HelpView = (function (_super) {
        __extends(HelpView, _super);
        function HelpView() {
            _super.call(this);
            this._currentSlideIndex = 0;
            this._slides = [];
            this._currentDynamicValuesStake = -1;
            this._open = false;
            this._openTime = 0;
            this._autoCloseDurationSecs = 60;
            this._desktopNavButtonY = 1010;
        }
        HelpView.prototype.construct = function () {
            var _this = this;
            var deviceClass = this._deviceDetector.getDeviceClass();
            this._isDesktop = (deviceClass == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            this._awardsData = this.parseAwardTable();
            this._slides.push(new game.HelpPage1View(this._cache, this._translator, this._metaData, this._server, this._currencyFormatter, this._awardsData, this._isDesktop));
            this._slides.push(new game.HelpPage2View(this._cache, this._translator, this._metaData, this._server, this._currencyFormatter, this._awardsData, this._isDesktop));
            if (!this._isDesktop) {
                this._slides.push(new game.HelpPage4View(this._cache, this._translator, this._metaData, this._server, this._currencyFormatter, this._awardsData));
                this._slides.push(new game.HelpPage5View(this._cache, this._translator, this._metaData, this._server, this._currencyFormatter, this._awardsData));
            }
            this._slides.push(new game.HelpPage3View(this._cache, this._translator, this._metaData, this._server, this._currencyFormatter, this._awardsData));
            this._slides.forEach(function (slide, count) {
                _this.addChild(slide.construct());
            });
            this._slides[0].visible = true;
            var buttonsSpritesheet = new components.SpriteSheet(this._cache.getAssetById(game.HelpBundle.Help_ButtonsJson.name), this._cache.getAssetById(game.HelpBundle.Help_Buttons.name));
            // Close button
            var closeButton = new game.ButtonView();
            if (this._isDesktop) {
                closeButton.setAssets(buttonsSpritesheet.getFrameByName("home_button_on.png"), buttonsSpritesheet.getFrameByName("home_button_down.png"), buttonsSpritesheet.getFrameByName("home_button_hover.png"), buttonsSpritesheet.getFrameByName("home_button_dim.png"));
            }
            else {
                closeButton.setAssets(buttonsSpritesheet.getFrameByName("home_button.png"), buttonsSpritesheet.getFrameByName("home_button_dwn.png"), buttonsSpritesheet.getFrameByName("home_button_hov.png"), buttonsSpritesheet.getFrameByName("home_button_dim.png"));
            }
            closeButton.setMouseoverCursor();
            closeButton.x = this._isDesktop ? (this.width / 2) - (closeButton.width / 2) : 1640;
            closeButton.y = this._isDesktop ? this._desktopNavButtonY : 140;
            rendering.InputManager.registerObject(closeButton);
            closeButton.addEventListener(rendering.InputEvent.DOWN, this.onCloseHelpButtonPressed, this);
            this.addChild(closeButton);
            // Prev button
            var previousButton = new game.ButtonView();
            if (this._isDesktop) {
                previousButton.setAssets(buttonsSpritesheet.getFrameByName("previous_button_on.png"), buttonsSpritesheet.getFrameByName("previous_button_down.png"), buttonsSpritesheet.getFrameByName("previous_button_hover.png"), buttonsSpritesheet.getFrameByName("previous_button_dim.png"));
            }
            else {
                previousButton.setAssets(buttonsSpritesheet.getFrameByName("previous_button.png"), buttonsSpritesheet.getFrameByName("previous_button_down.png"), buttonsSpritesheet.getFrameByName("previous_button_hov.png"), buttonsSpritesheet.getFrameByName("previous_button_dim.png"));
            }
            previousButton.setMouseoverCursor();
            previousButton.x = this._isDesktop ? closeButton.x - 101 : 180;
            previousButton.y = this._isDesktop ? this._desktopNavButtonY : 500;
            rendering.InputManager.registerObject(previousButton);
            previousButton.addEventListener(rendering.InputEvent.DOWN, this.onPreviousButtonPressed, this);
            this.addChild(previousButton);
            // Next button
            var nextButton = new game.ButtonView();
            if (this._isDesktop) {
                nextButton.setAssets(buttonsSpritesheet.getFrameByName("next_button_on.png"), buttonsSpritesheet.getFrameByName("next_button_down.png"), buttonsSpritesheet.getFrameByName("next_button_hover.png"), buttonsSpritesheet.getFrameByName("next_button_dim.png"));
            }
            else {
                nextButton.setAssets(buttonsSpritesheet.getFrameByName("next_button.png"), buttonsSpritesheet.getFrameByName("next_button_down.png"), buttonsSpritesheet.getFrameByName("next_button_hov.png"), buttonsSpritesheet.getFrameByName("next_button_dim.png"));
            }
            nextButton.setMouseoverCursor();
            nextButton.x = this._isDesktop ? closeButton.x + closeButton.width + 5 : 1720;
            nextButton.y = this._isDesktop ? this._desktopNavButtonY : 500;
            rendering.InputManager.registerObject(nextButton);
            nextButton.addEventListener(rendering.InputEvent.DOWN, this.onNextButtonPressed, this);
            this.addChild(nextButton);
            TweenMax.to(this, 1, {
                repeat: Infinity,
                onRepeat: function () {
                    if (_this._open) {
                        if (Date.now() > _this._openTime + (_this._autoCloseDurationSecs * 1000)) {
                            _this.onCloseHelpButtonPressed();
                        }
                    }
                }
            });
        };
        HelpView.prototype.setVisiblePage = function (page) {
            for (var i = 0; i < this._slides.length; i++) {
                this._slides[i].visible = i === page;
            }
            this._currentSlideIndex = page;
        };
        HelpView.prototype.parseAwardTable = function (set) {
            if (set === void 0) { set = 0; }
            var initResponse = this._server.getInitResponse();
            var awardTable = initResponse.awardsData[set].awards;
            var awardsData = new Object();
            for (var i = 0; i < Object.keys(awardTable).length; i++) {
                if (!awardsData[awardTable[i].id]) {
                    awardsData[awardTable[i].id] = {};
                }
                awardsData[awardTable[i].id][awardTable[i].numSymbols] = awardTable[i].value;
            }
            return awardsData;
        };
        HelpView.prototype.updateDynamicValues = function () {
            var currentStake = this._stakeModel.getStakePerLine();
            if (this._currentDynamicValuesStake !== currentStake) {
                this._currentDynamicValuesStake = currentStake;
                this._slides[0].updateDynamicValuesForStake(currentStake);
                this._slides[1].updateDynamicValuesForStake(currentStake);
            }
        };
        HelpView.prototype.onCloseHelpButtonPressed = function () {
            this.dispatchEvent(new game.GameEvent(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this));
        };
        HelpView.prototype.onPreviousButtonPressed = function () {
            this._currentSlideIndex = (this._currentSlideIndex <= 0) ? this._slides.length - 1 : this._currentSlideIndex - 1;
            this._slides.forEach(function (slide) {
                slide.visible = false;
            });
            this._slides[this._currentSlideIndex].visible = true;
            this.dispatchEvent(new game.GameEvent(game.GameEvent.HELP_PREVIOUS_BUTTON_PRESSED, this));
            this._openTime = Date.now();
        };
        HelpView.prototype.onNextButtonPressed = function () {
            this._currentSlideIndex = (this._currentSlideIndex >= this._slides.length - 1) ? 0 : this._currentSlideIndex + 1;
            this._slides.forEach(function (slide) {
                slide.visible = false;
            });
            this._slides[this._currentSlideIndex].visible = true;
            this.dispatchEvent(new game.GameEvent(game.GameEvent.HELP_NEXT_BUTTON_PRESSED, this));
            this._openTime = Date.now();
        };
        HelpView.prototype.setOffscreen = function () {
            this.x = -this.width;
        };
        HelpView.prototype.tweenIn = function () {
            var _this = this;
            new TweenMax(this, game.BaseGameUIConstants.kHelpSlideInOutSpeed, {
                ease: Linear.easeNone,
                x: 0,
                onComplete: function () {
                    _this._openTime = Date.now();
                    _this._open = true;
                }
            });
        };
        HelpView.prototype.tweenOut = function (callback) {
            var _this = this;
            return new TweenMax(this, game.BaseGameUIConstants.kHelpSlideInOutSpeed, {
                ease: Linear.easeNone,
                x: this.width,
                onComplete: function () {
                    _this._open = false;
                    if (callback) {
                        callback();
                    }
                }
            });
        };
        __decorate([
            inject('ITranslator')
        ], HelpView.prototype, "_translator", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], HelpView.prototype, "_deviceDetector", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], HelpView.prototype, "_launchParams", void 0);
        __decorate([
            inject('AssetCache')
        ], HelpView.prototype, "_cache", void 0);
        __decorate([
            inject('StakeModel')
        ], HelpView.prototype, "_stakeModel", void 0);
        __decorate([
            inject('MetaData')
        ], HelpView.prototype, "_metaData", void 0);
        __decorate([
            inject('GameServer')
        ], HelpView.prototype, "_server", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], HelpView.prototype, "_currencyFormatter", void 0);
        return HelpView;
    }(rendering.DisplayObjectContainer));
    game.HelpView = HelpView;
})(game || (game = {}));
var game;
(function (game) {
    var HelpViewMediator = (function (_super) {
        __extends(HelpViewMediator, _super);
        function HelpViewMediator() {
            _super.apply(this, arguments);
        }
        HelpViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            Utils.PSLog.log("HelpView added");
            this.addContextListener(game.GameEvent.HELP_BUTTON_PRESSED, this.onHelpButtonPressed);
            this.view.addEventListener(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this.onCloseHelpButtonPressed, this);
            this.view.addEventListener(game.GameEvent.HELP_NEXT_BUTTON_PRESSED, this.onHelpNextButtonPressed, this);
            this.view.addEventListener(game.GameEvent.HELP_PREVIOUS_BUTTON_PRESSED, this.onHelpPreviousButtonPressed, this);
        };
        HelpViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.HELP_BUTTON_PRESSED, this.onHelpButtonPressed);
            this.view.removeEventListener(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this.onCloseHelpButtonPressed, this);
            this.view.removeEventListener(game.GameEvent.HELP_NEXT_BUTTON_PRESSED, this.onHelpNextButtonPressed, this);
            this.view.removeEventListener(game.GameEvent.HELP_PREVIOUS_BUTTON_PRESSED, this.onHelpPreviousButtonPressed, this);
        };
        HelpViewMediator.prototype.doGlobalDispatch = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        HelpViewMediator.prototype.onHelpButtonPressed = function () {
            Utils.PSLog.log("HelpViewMediator->onHelpButtonPressed()");
            this.view.setOffscreen();
            this.view.updateDynamicValues();
            this.view.setVisiblePage(0);
            this._layerMgr.setVisible([
                new game.LayerVisibility(game.LayerViews.HELP, true)
            ]);
            this.view.tweenIn();
        };
        HelpViewMediator.prototype.onHelpNextButtonPressed = function () {
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HELP_NEXT_BUTTON_PRESSED, this));
        };
        HelpViewMediator.prototype.onHelpPreviousButtonPressed = function () {
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HELP_PREVIOUS_BUTTON_PRESSED, this));
        };
        HelpViewMediator.prototype.onCloseHelpButtonPressed = function () {
            var _this = this;
            Utils.PSLog.log("HelpViewMediator->onCloseHelpButtonPressed()");
            this.view.tweenOut(function () {
                _this._layerMgr.setVisible([new game.LayerVisibility(game.LayerViews.HELP, false)]);
            });
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this));
        };
        __decorate([
            inject('LayerManager')
        ], HelpViewMediator.prototype, "_layerMgr", void 0);
        return HelpViewMediator;
    }(dragonwings.Mediator));
    game.HelpViewMediator = HelpViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var MeterLabelView = (function (_super) {
        __extends(MeterLabelView, _super);
        function MeterLabelView(text, fontSize, colour, x, y) {
            _super.call(this, "");
            this.text = text;
            this.font = game.BaseGameUIConstants.kFontFamily;
            this.fontSize = fontSize;
            this.colour = colour;
            this.x = x;
            this.y = y;
        }
        return MeterLabelView;
    }(rendering.Text));
    game.MeterLabelView = MeterLabelView;
})(game || (game = {}));
var game;
(function (game) {
    var LayerVisibility = (function () {
        function LayerVisibility(id, visible) {
            this.layerId = id;
            this.visible = visible;
        }
        return LayerVisibility;
    }());
    game.LayerVisibility = LayerVisibility;
    var LayerManager = (function () {
        function LayerManager() {
            this._debug = false;
            this._layers = [];
            this._zOrder = [];
        }
        LayerManager.prototype.init = function (stage, dragonwingify) {
            this._stage = stage;
            this._dragonwingify = dragonwingify;
        };
        LayerManager.prototype.getLayers = function () {
            return this._layers;
        };
        Object.defineProperty(LayerManager.prototype, "debug", {
            get: function () { return this._debug; },
            set: function (value) {
                if (value != this._debug) {
                    this._debug = value;
                    for (var i = 0; i < this._layers.length; ++i) {
                        var layer = this._layers[i];
                        if (layer.visible) {
                            layer.debug = value;
                        }
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
        LayerManager.prototype.addLayer = function (layer) {
            if (this.indexOfLayerWithId(layer.id) < 0) {
                layer.delegate = this;
                this._layers.push(layer);
                this._zOrder.push(layer);
            }
            else {
                var msg = "LayerManager::adding layer with duplicate id: " + layer.id;
                throw msg;
            }
        };
        LayerManager.prototype.removeLayer = function (layer) {
            var idx = this.indexOfLayerWithId(layer.id);
            var removed = undefined;
            if (idx >= 0) {
                removed = this._layers.splice(idx, 1)[0];
                removed.delegate = undefined;
                this._zOrder = this._zOrder.splice(idx, 1);
            }
            else {
                var msg = "LayerManager:: layer with id: " + layer.id + " not found";
                throw msg;
            }
            return removed;
        };
        LayerManager.prototype.getLayerWithId = function (id) {
            var layer = undefined;
            var idx = this.indexOfLayerWithId(id);
            if (idx >= 0) {
                layer = this._layers[idx];
            }
            return layer;
        };
        LayerManager.prototype.transitionTo = function (layerId, duration) {
            var newActiveLayer = this.findLayerWithId(layerId);
            var topmost = this.getTopmostActiveLayer();
            topmost.transitionOut(duration / 2);
            TweenMax.delayedCall(duration, newActiveLayer.transitionIn, [duration / 2], newActiveLayer);
        };
        LayerManager.prototype.setVisible = function (visibility) {
            for (var i = 0; i < visibility.length; ++i) {
                var layerIdx = this.indexOfLayerWithId(visibility[i].layerId);
                if (layerIdx >= 0) {
                    this._layers[layerIdx].visible = visibility[i].visible;
                }
                else {
                    throw "layer not found!";
                }
            }
        };
        /*
            The order of the layers BOTTOM to TOP by id
        */
        LayerManager.prototype.setZOrder = function (ids) {
            var valid = this._layers.length == ids.length;
            var newOrder = [];
            if (valid) {
                for (var i = 0; i < ids.length; ++i) {
                    var found = this.indexOfLayerWithId(ids[i].id) >= 0;
                    valid = valid && found;
                    newOrder.push(i);
                }
                if (valid) {
                    this.reorderLayers(newOrder);
                }
            }
        };
        LayerManager.prototype.getZOrderOfId = function (id) {
            var z;
            for (var i = 0; i < this._zOrder.length; ++i) {
                if (this._zOrder[i].id === id) {
                    z = i;
                }
            }
            return z;
        };
        ////////////////////////////////////////////////////////////////
        // ILayerViewDelegate methods
        LayerManager.prototype.didStartTransitionOut = function (sender) {
            this._dragonwingify.doGlobalDispatch(new game.LayerViewEvent(game.LayerViewEvent.TRANSITION_OUT_STARTED, sender, sender.id));
        };
        LayerManager.prototype.didCompleteTransitionOut = function (sender) {
            this._dragonwingify.doGlobalDispatch(new game.LayerViewEvent(game.LayerViewEvent.TRANSITION_OUT_COMPLETE, sender, sender.id));
        };
        LayerManager.prototype.didStartTransitionIn = function (sender) {
            this._dragonwingify.doGlobalDispatch(new game.LayerViewEvent(game.LayerViewEvent.TRANSITION_IN_STARTED, sender, sender.id));
        };
        LayerManager.prototype.didCompleteTransitionIn = function (sender) {
            this._dragonwingify.doGlobalDispatch(new game.LayerViewEvent(game.LayerViewEvent.TRANSITION_IN_COMPLETE, sender, sender.id));
        };
        ////////////////////////////////////////////////////////////////
        // Internal methods
        /*protected fadeToColour(colour: number, duration: number, completionHandler: ()=> any): void {
            this._fadeChild = Utils.MiscUtils.createBox(0, 0, 1920, 1080, colour);
            this.addChild(this._fadeChild);
            TweenMax.to(this._fadeChild, duration, {
                alpha: 1,
                onComplete: completionHandler
            });
        }*/
        LayerManager.prototype.reorderLayers = function (order) {
            this._zOrder = [];
            for (var i = 0; i < this._layers.length; ++i) {
                this._stage.removeChild(this._layers[i]);
            }
            for (var i = 0; i < this._layers.length; ++i) {
                var selectedLayer = this._layers[order[i]];
                this._stage.addChild(selectedLayer);
                this._zOrder.push(selectedLayer);
            }
        };
        LayerManager.prototype.indexOfLayerWithId = function (id) {
            var found = -1;
            for (var i = 0; i < this._layers.length; ++i) {
                if (this._layers[i].id === id) {
                    found = i;
                }
            }
            return found;
        };
        LayerManager.prototype.findLayerWithId = function (id) {
            var found = undefined;
            var idx = this.indexOfLayerWithId(id);
            if (idx >= 0) {
                found = this._layers[idx];
            }
            return found;
        };
        LayerManager.prototype.getTopmostActiveLayer = function () {
            var topMost = undefined;
            if (this._layers.length == this._zOrder.length) {
                for (var i = (this._zOrder.length - 1); i >= 0; --i) {
                    if (this._zOrder[i].visible) {
                        topMost = this._zOrder[i];
                    }
                }
            }
            else {
                throw "Layers / Z order array length discrepancy";
            }
            return topMost;
        };
        return LayerManager;
    }());
    game.LayerManager = LayerManager;
})(game || (game = {}));
var game;
(function (game) {
    var LayerMediator = (function (_super) {
        __extends(LayerMediator, _super);
        function LayerMediator() {
            _super.apply(this, arguments);
        }
        LayerMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.view.addEventListener(rendering.InputEvent.DOWN, this.onDown, this);
        };
        LayerMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.view.removeEventListener(rendering.InputEvent.DOWN, this.onDown, this);
        };
        LayerMediator.prototype.onDown = function (event) {
            Utils.PSLog.log("LayerView with id: " + this.view.id + " Clicked");
            this.dispatchContextEvent(new game.GameEvent(game.GameEvent.LAYER_CLICKED, this, this.view.id));
        };
        return LayerMediator;
    }(dragonwings.Mediator));
    game.LayerMediator = LayerMediator;
})(game || (game = {}));
var game;
(function (game) {
    var LayerToolEvent = (function (_super) {
        __extends(LayerToolEvent, _super);
        function LayerToolEvent(eventName, sender, id) {
            _super.call(this, eventName);
            this._sender = sender;
            this._id = id;
        }
        Object.defineProperty(LayerToolEvent.prototype, "sender", {
            get: function () { return this._sender; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerToolEvent.prototype, "id", {
            get: function () { return this._id; },
            enumerable: true,
            configurable: true
        });
        //
        LayerToolEvent.VISIBILITY_PRESSED = "LayerToolEvent_VISIBILITY_PRESSED";
        LayerToolEvent.BOUNDS_PRESSED = "LayerToolEvent_BOUNDS_PRESSED";
        return LayerToolEvent;
    }(borgevent.Event));
    game.LayerToolEvent = LayerToolEvent;
    var LayerTool = (function (_super) {
        __extends(LayerTool, _super);
        function LayerTool() {
            _super.call(this);
            this._menuItems = [];
            this._buttonXPadding = 10;
            this._buttonYPadding = 10;
            this._buttonContainer = new rendering.DisplayObjectContainer();
        }
        LayerTool.prototype.init = function (layerMgr) {
            var layers = layerMgr.getLayers();
            this._layerManager = layerMgr;
            var y = this._buttonYPadding;
            var self = this;
            for (var i = 0; i < layers.length; ++i) {
                var layer = layers[i];
                if (layer) {
                    var menuItem = new game.LayerToolMenuItem();
                    menuItem.init(layer.id, 200, 50);
                    menuItem.layerZLabel = "CURRENT Z: " + this._layerManager.getZOrderOfId(layer.id).toString();
                    menuItem.x = this._buttonXPadding;
                    menuItem.y = y;
                    menuItem.addEventListener(LayerToolEvent.VISIBILITY_PRESSED, this.onButtonClick, this);
                    menuItem.addEventListener(LayerToolEvent.BOUNDS_PRESSED, this.onButtonClick, this);
                    this._buttonContainer.addChild(menuItem);
                    this._menuItems.push(menuItem);
                    y += this._buttonYPadding + menuItem.height;
                }
            }
            this._width = 2 * this._buttonXPadding;
            this._height = this._buttonYPadding;
            if (this._menuItems.length > 0) {
                this._width += this._menuItems[0].width;
                this._height += this._menuItems.length * (this._buttonYPadding + this._menuItems[0].height);
            }
            this.addBackground();
            this.addChild(this._buttonContainer);
        };
        LayerTool.prototype.open = function () {
            var layers = this._layerManager.getLayers();
            for (var i = 0; i < layers.length; ++i) {
                this._menuItems[i].visibilityOn = layers[i].visible;
            }
            this.visible = true;
        };
        LayerTool.prototype.close = function () {
            this.visible = false;
        };
        LayerTool.prototype.addBackground = function () {
            var bg = new rendering.Graphics();
            bg.beginFill(0x000000, 0.7);
            bg.lineStyle(4, 0x00ddcc, 1);
            bg.drawRect(0, 0, this._width, this._height);
            bg.endFill();
            this.addChild(bg);
        };
        LayerTool.prototype.removeChildren = function () {
            while (this._buttonContainer.children.length > 0) {
                this._buttonContainer.removeChild(this._buttonContainer.children[0]);
            }
            this._menuItems = [];
        };
        LayerTool.prototype.onButtonClick = function (e) {
            //Utils.PSLog.log(`LayerTool::onButtonClick() - ${e.eventName} id: ${e.id}`);
            var menuItem = e.sender;
            if (e.eventName === LayerToolEvent.VISIBILITY_PRESSED) {
                var visibleStr = menuItem.visibilityOn ? "VISIBLE" : "INVISIBLE";
                Utils.PSLog.log("LayerTool::onButtonClick() - setting layer " + e.id + " " + visibleStr);
                this._layerManager.setVisible([new game.LayerVisibility(e.id, menuItem.visibilityOn)]);
            }
            if (e.eventName === LayerToolEvent.BOUNDS_PRESSED) {
                var onStr = menuItem.boundsOn ? "BOUNDS BOXES ON" : "BOUNDS BOXES OFF";
                Utils.PSLog.log("LayerTool::onButtonClick() - " + onStr + " for layer " + e.id);
                var layer = this._layerManager.getLayerWithId(e.id);
                layer.debug = menuItem.boundsOn;
            }
        };
        return LayerTool;
    }(rendering.DisplayObjectContainer));
    game.LayerTool = LayerTool;
})(game || (game = {}));
var game;
(function (game) {
    var LayerToolButton = (function (_super) {
        __extends(LayerToolButton, _super);
        function LayerToolButton() {
            _super.apply(this, arguments);
            this._buttonWidth = 50;
            this._buttonHeight = 40;
            this._buttonId = "<UNDEFINED>";
            this._buttonHandler = function (id) { };
            this._toggleLabels = ["ON", "OFF"];
        }
        LayerToolButton.prototype.init = function (id, isOn) {
            this._buttonId = id;
            this._buttonOn = isOn;
            var colour = isOn ? LayerToolButton.Colours[0] : LayerToolButton.Colours[1];
            this._buttonGraphic = Utils.MiscUtils.createBox(0, 0, this._buttonWidth, this._buttonHeight, colour, true);
            var label = isOn ? this._toggleLabels[0] : this._toggleLabels[1];
            this._buttonText = new rendering.Text(label);
            this._buttonText.maxWidth = this._buttonWidth;
            this._buttonText.fontSize = 20;
            this._buttonText.scaleToWidth = this._buttonWidth - (this._buttonWidth / 10);
            this._buttonText.colour = "#333333";
            this._buttonText.font = "Myriad Pro Black";
            this._buttonText.y = (this._buttonHeight - this._buttonText.height) / 2;
            this._buttonText.x = (this._buttonWidth - this._buttonText.width) / 2;
            this._buttonText.interactive = false;
            this.addChild(this._buttonGraphic);
            this.addChild(this._buttonText);
            this._buttonGraphic.addEventListener(rendering.InputEvent.DOWN, this.localButtonHandler, this);
        };
        LayerToolButton.prototype.setLabelStrings = function (onLabel, offLabel) {
            this._toggleLabels = [onLabel, offLabel];
        };
        LayerToolButton.prototype.getLabelStrings = function () {
            return this._toggleLabels;
        };
        Object.defineProperty(LayerToolButton.prototype, "buttonOn", {
            get: function () {
                return this._buttonOn;
            },
            set: function (value) {
                if (value != this._buttonOn) {
                    this._buttonOn = value;
                    this.setButtonOn(value);
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerToolButton.prototype, "buttonHandler", {
            get: function () {
                return this._buttonHandler;
            },
            set: function (handler) {
                this._buttonHandler = handler;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerToolButton.prototype, "buttonWidth", {
            get: function () {
                return this._buttonWidth;
            },
            set: function (value) {
                this._buttonWidth = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerToolButton.prototype, "buttonHeight", {
            get: function () {
                return this._buttonHeight;
            },
            set: function (value) {
                this._buttonHeight = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerToolButton.prototype, "buttonId", {
            get: function () {
                return this._buttonId;
            },
            set: function (value) {
                this._buttonId = value;
            },
            enumerable: true,
            configurable: true
        });
        LayerToolButton.prototype.setButtonOn = function (value) {
            var label = value ? this._toggleLabels[0] : this._toggleLabels[1];
            var colour = value ? LayerToolButton.Colours[0] : LayerToolButton.Colours[1];
            this._buttonText.text = label;
            this.removeChild(this._buttonGraphic);
            this._buttonGraphic.removeEventListener(rendering.InputEvent.DOWN, this.localButtonHandler, this);
            this.removeChild(this._buttonText);
            this._buttonGraphic = Utils.MiscUtils.createBox(0, 0, this._buttonWidth, this._buttonHeight, colour, true);
            this.addChild(this._buttonGraphic);
            this.addChild(this._buttonText);
            this._buttonGraphic.addEventListener(rendering.InputEvent.DOWN, this.localButtonHandler, this);
        };
        LayerToolButton.prototype.localButtonHandler = function () {
            this._buttonOn = !this._buttonOn;
            this.setButtonOn(this._buttonOn);
            this._buttonHandler(this._buttonId);
        };
        LayerToolButton.Colours = [0x00ff33, 0xff0033];
        return LayerToolButton;
    }(rendering.DisplayObjectContainer));
    game.LayerToolButton = LayerToolButton;
})(game || (game = {}));
var game;
(function (game) {
    var LayerToolMenuItem = (function (_super) {
        __extends(LayerToolMenuItem, _super);
        function LayerToolMenuItem() {
            _super.apply(this, arguments);
            this._diagnosticsWidth = 130;
            this._diagnosticsHeight = 40;
            this._xPadding = 10;
            this._yPadding = 4;
        }
        LayerToolMenuItem.prototype.init = function (buttonId, width, height) {
            var self = this;
            this._layerVisibilityButton = new game.LayerToolButton();
            this._layerVisibilityButton.init(buttonId, false);
            this._layerVisibilityButton.x = 0;
            this._layerVisibilityButton.y = 0;
            this._layerVisibilityButton.buttonHandler = function (id) { self.onVisibilityClick(id); };
            this.addChild(this._layerVisibilityButton);
            this._layerIdLabel = new rendering.Text(buttonId.toString());
            this._layerIdLabel.maxWidth = this._diagnosticsWidth;
            this._layerIdLabel.fontSize = 12;
            this._layerIdLabel.scaleToWidth = this._diagnosticsWidth - (this._diagnosticsWidth / 10);
            this._layerIdLabel.colour = "#ffffff";
            this._layerIdLabel.font = "Myriad Pro Black";
            this._layerIdLabel.y = (this._diagnosticsHeight / 2 - this._layerIdLabel.height) / 2;
            this._layerIdLabel.x = this._layerVisibilityButton.buttonWidth + this._yPadding;
            this._layerIdLabel.interactive = false;
            this.addChild(this._layerIdLabel);
            this._layerZLabel = new rendering.Text("");
            this._layerZLabel.maxWidth = this._diagnosticsWidth;
            this._layerZLabel.fontSize = 12;
            this._layerZLabel.scaleToWidth = this._diagnosticsWidth - (this._diagnosticsWidth / 10);
            this._layerZLabel.colour = "#ffffff";
            this._layerZLabel.font = "Myriad Pro Black";
            this._layerZLabel.y = this._yPadding + this._layerIdLabel.height + this._layerZLabel.height / 2;
            this._layerZLabel.x = this._layerIdLabel.x;
            this._layerZLabel.interactive = false;
            this.addChild(this._layerZLabel);
            this._layerBoundsButton = new game.LayerToolButton();
            this._layerBoundsButton.setLabelStrings("BOUNDS ON", "BOUNDS OFF");
            this._layerBoundsButton.init(buttonId, false);
            this._layerBoundsButton.x = this._xPadding * 3 + this._diagnosticsWidth;
            this._layerBoundsButton.y = 0;
            this._layerBoundsButton.buttonHandler = function (id) { self.onBoundsClick(id); };
            this.addChild(this._layerBoundsButton);
        };
        Object.defineProperty(LayerToolMenuItem.prototype, "visibilityOn", {
            get: function () {
                return this._layerVisibilityButton.buttonOn;
            },
            set: function (value) {
                this._layerVisibilityButton.buttonOn = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerToolMenuItem.prototype, "boundsOn", {
            get: function () {
                return this._layerBoundsButton.buttonOn;
            },
            set: function (value) {
                this._layerBoundsButton.buttonOn = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerToolMenuItem.prototype, "layerIdLabel", {
            get: function () {
                var label;
                if (this._layerIdLabel.text) {
                    label = this._layerIdLabel.text;
                }
                return label;
            },
            set: function (label) {
                if (this._layerIdLabel.text) {
                    this._layerIdLabel.text = label;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerToolMenuItem.prototype, "layerZLabel", {
            get: function () {
                var label;
                if (this._layerZLabel) {
                    label = this._layerZLabel.text;
                }
                return label;
            },
            set: function (label) {
                if (this._layerZLabel) {
                    this._layerZLabel.text = label;
                }
            },
            enumerable: true,
            configurable: true
        });
        LayerToolMenuItem.prototype.onVisibilityClick = function (id) {
            //Utils.PSLog.log(`LayerToolMenuItem::onVisibilityClick() - id ${id}`);
            var event = new game.LayerToolEvent(game.LayerToolEvent.VISIBILITY_PRESSED, this, id);
            this.dispatchEvent(event);
        };
        LayerToolMenuItem.prototype.onBoundsClick = function (id) {
            //Utils.PSLog.log(`LayerToolMenuItem::onBoundsClick() - id ${id}`);
            var event = new game.LayerToolEvent(game.LayerToolEvent.BOUNDS_PRESSED, this, id);
            this.dispatchEvent(event);
        };
        return LayerToolMenuItem;
    }(rendering.DisplayObjectContainer));
    game.LayerToolMenuItem = LayerToolMenuItem;
})(game || (game = {}));
var game;
(function (game) {
    var LayerView = (function (_super) {
        __extends(LayerView, _super);
        function LayerView() {
            _super.apply(this, arguments);
            this.id = "<Unknown>";
            this.debugColour = 0xFF0000;
            this._debug = false;
            this._debugBounds = [];
        }
        Object.defineProperty(LayerView.prototype, "debug", {
            get: function () { return this._debug; },
            set: function (value) {
                if (value != this._debug) {
                    this._debug = value;
                    if (value) {
                        this.addChildBounds();
                    }
                    else {
                        this.removeChildBounds();
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerView.prototype, "isVisible", {
            get: function () {
                return this.visible;
            },
            set: function (value) {
                this.visible = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerView.prototype, "eventDispatcher", {
            get: function () {
                return this._eventDispatcher;
            },
            set: function (dispatcher) {
                this._eventDispatcher = dispatcher;
            },
            enumerable: true,
            configurable: true
        });
        LayerView.prototype.addChild = function (child) {
            _super.prototype.addChild.call(this, child);
            this._eventDispatcher.dispatchEvent(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, child));
            return child;
        };
        LayerView.prototype.removeChild = function (child) {
            _super.prototype.removeChild.call(this, child);
            this._eventDispatcher.dispatchEvent(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.REMOVED_FROM_STAGE, child));
            return child;
        };
        LayerView.prototype.addChildToStage = function (child) {
            this.stage.addChild(child);
            this._eventDispatcher.dispatchEvent(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.ADDED_TO_STAGE, child));
            return child;
        };
        LayerView.prototype.removeChildfromStage = function (child) {
            this.stage.removeChild(child);
            this._eventDispatcher.dispatchEvent(new dragonwings.MediatorEvent(dragonwings.MediatorEvent.REMOVED_FROM_STAGE, child));
            return child;
        };
        ///////////////////////////////////////////////////////////////////////
        // transitionIn/Out should be overridden by descendent classes to animate
        // as appropriate for the specfic game
        LayerView.prototype.transitionIn = function (duration) {
            var self = this;
            this.alpha = 0;
            //this.alpha = 1;
            if (this.delegate) {
                this.delegate.didStartTransitionIn(this);
            }
            TweenMax.to(this, duration, {
                alpha: 1,
                onComplete: self.onTransitionInComplete
            });
            //self.onTransitionInComplete();
        };
        LayerView.prototype.transitionOut = function (duration) {
            var self = this;
            if (this.delegate) {
                this.delegate.didStartTransitionOut(this);
            }
            TweenMax.to(this, duration, {
                alpha: 0,
                onComplete: self.onTransitionOutComplete
            });
        };
        LayerView.prototype.onTransitionInComplete = function () {
            if (this.delegate) {
                this.delegate.didCompleteTransitionIn(this);
            }
        };
        LayerView.prototype.onTransitionOutComplete = function () {
            if (this.delegate) {
                this.delegate.didCompleteTransitionOut(this);
            }
        };
        LayerView.prototype.removeChildBounds = function () {
            for (var i = 0; i < this._debugBounds.length; ++i) {
                this.removeChild(this._debugBounds[i]);
                this._debugBounds[i] = undefined;
            }
            this._debugBounds = [];
        };
        LayerView.prototype.addChildBounds = function () {
            if (this._debugBounds.length > 0) {
                throw "UNEXPECTED: layer already has an array of child bounds defined";
            }
            if (this.children) {
                if (this.children.length > 0) {
                    this.processObjects(this.children);
                }
                this.drawDebugBounds();
            }
        };
        LayerView.prototype.processObjects = function (displayObjects) {
            for (var i = 0; i < displayObjects.length; ++i) {
                var child = displayObjects[i];
                var isContainer = (child instanceof game.SubgameView);
                isContainer = isContainer || (Utils.MiscUtils.getObjectClass(child) === "DisplayObjectContainer");
                if (!isContainer) {
                    this.addBoundsForObject(child);
                }
                if (child.children) {
                    this.processObjects(child.children);
                }
            }
        };
        LayerView.prototype.addBoundsForObject = function (obj) {
            // There must be a better way of converting an objects coordinates from local (containing view) to
            // stage but for now use this brute force approach
            var objParent = obj.parent;
            var containedObj = obj;
            var x = containedObj.x * objParent.scaleX;
            ;
            var y = containedObj.y * objParent.scaleY;
            while (objParent) {
                x += objParent.x;
                y += objParent.y;
                containedObj = objParent;
                objParent = objParent.parent;
                if (objParent) {
                    x *= objParent.scaleX;
                    y *= objParent.scaleY;
                }
            }
            var border = Utils.MiscUtils.createBox(x, y, obj.width, obj.height, this.debugColour, false, 1);
            this._debugBounds.push(border);
        };
        LayerView.prototype.drawDebugBounds = function () {
            //var offset: number = 0;
            for (var i = 0; i < this._debugBounds.length; ++i) {
                var box = this._debugBounds[i];
                Utils.PSLog.log("LayerView::drawDebugBounds() - adding bounds (" + box.x + ", " + box.y + ", " + box.width + ", " + box.height + ")");
                //box.x += offset;
                //offset += 300
                this.addChild(box);
            }
        };
        return LayerView;
    }(rendering.DisplayObjectContainer));
    game.LayerView = LayerView;
})(game || (game = {}));
var game;
(function (game) {
    var LayerViewEvent = (function (_super) {
        __extends(LayerViewEvent, _super);
        function LayerViewEvent(eventName, sender, id) {
            _super.call(this, eventName);
            this._sender = sender;
            this._id = id;
        }
        Object.defineProperty(LayerViewEvent.prototype, "sender", {
            get: function () { return this._sender; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LayerViewEvent.prototype, "id", {
            get: function () { return this._id; },
            enumerable: true,
            configurable: true
        });
        //
        LayerViewEvent.TRANSITION_OUT_STARTED = "LayerViewEvent_TRANSITION_OUT_STARTED";
        LayerViewEvent.TRANSITION_OUT_COMPLETE = "LayerViewEvent_TRANSITION_OUT_COMPLETE";
        LayerViewEvent.TRANSITION_IN_STARTED = "LayerViewEvent_TRANSITION_IN_STARTED";
        LayerViewEvent.TRANSITION_IN_COMPLETE = "LayerViewEvent_TRANSITION_IN_COMPLETE";
        return LayerViewEvent;
    }(borgevent.Event));
    game.LayerViewEvent = LayerViewEvent;
})(game || (game = {}));
var game;
(function (game) {
    var MaxWinView = (function (_super) {
        __extends(MaxWinView, _super);
        function MaxWinView() {
            _super.apply(this, arguments);
        }
        MaxWinView.prototype.construct = function () {
            this._scalar = this._device.getScalar();
            this._background = new rendering.Bitmap(Utils.MiscUtils.getAssetFrameWithName("cf_wincap.png", game.FSBundle.CF_MaxWinPopup.name, game.FSBundle.CF_MaxWinPopupJson.name, this._cache));
            this._background.x = (this._device.getBaselineWidth() / 2) - (this._background.width / 2);
            this._background.y = (this._device.getBaselineHeight() / 2) - (this._background.height / 2);
            this.addChild(this._background);
            // Congratulations text
            this._text1 = new rendering.Text(this._translator.findByKey("framework_com_wms_framework_WinCap_ScreenTitle"));
            this._text1.fontSize = game.BaseGameUIConstants.kMaxWinPopupText1FontSize;
            this._text1.colour = game.BaseGameUIConstants.kGameYellow1;
            this._text1.font = game.BaseGameUIConstants.kFontFamily;
            this._text1.scaleToWidth = 900;
            Utils.MiscUtils.centreReg(this._text1, this._scalar);
            this._text1.x = 960;
            this._text1.y = 320;
            // Max win amount text
            this._text2 = new rendering.Text("");
            this._text2.fontSize = game.BaseGameUIConstants.kMaxWinPopupText2FontSize;
            this._text2.colour = game.BaseGameUIConstants.kGameYellow1;
            this._text2.font = game.BaseGameUIConstants.kFontFamily;
            this._text2.y = 510;
            // Max win amount text
            this._text3 = new rendering.Text(this._translator.findByKey("framework_com_wms_framework_WinCap_ScreenMessage"));
            this._text3.fontSize = game.BaseGameUIConstants.kMaxWinPopupText3FontSize;
            this._text3.colour = game.BaseGameUIConstants.kGameYellow1;
            this._text3.font = game.BaseGameUIConstants.kFontFamily;
            this._text3.textAlign = rendering.TextAlign.CENTER;
            this._text3.scaleToWidth = 900;
            Utils.MiscUtils.centreReg(this._text3, this._scalar);
            this._text3.x = 960;
            this._text3.y = 740;
            this.addChild(this._text1);
            this.addChild(this._text2);
            this.addChild(this._text3);
            this.hide();
        };
        MaxWinView.prototype.show = function () {
            this.visible = true;
            var maxWinValue = this._stakeModel.getMaxWinValue();
            this._text2.text = this._currencyFormatter.format(maxWinValue);
            Utils.MiscUtils.centreReg(this._text2, this._scalar);
            this._text2.x = 960;
        };
        MaxWinView.prototype.hide = function () {
            this.visible = false;
        };
        __decorate([
            inject('AssetCache')
        ], MaxWinView.prototype, "_cache", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], MaxWinView.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('DeviceContext')
        ], MaxWinView.prototype, "_device", void 0);
        __decorate([
            inject('ITranslator')
        ], MaxWinView.prototype, "_translator", void 0);
        __decorate([
            inject('StakeModel')
        ], MaxWinView.prototype, "_stakeModel", void 0);
        return MaxWinView;
    }(rendering.DisplayObjectContainer));
    game.MaxWinView = MaxWinView;
})(game || (game = {}));
var game;
(function (game) {
    var MaxWinViewMediator = (function (_super) {
        __extends(MaxWinViewMediator, _super);
        function MaxWinViewMediator() {
            _super.apply(this, arguments);
        }
        MaxWinViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this._view = this.getViewComponent();
            this.addContextListener(game.GameEvent.SHOW_MAX_WIN, this.onShowingMaxWin);
            this.addContextListener(game.GameEvent.SHOW_MAX_WIN_COMPLETE, this.onShowingMaxWinComplete);
        };
        MaxWinViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SHOW_MAX_WIN, this.onShowingMaxWin);
            this.removeContextListener(game.GameEvent.SHOW_MAX_WIN_COMPLETE, this.onShowingMaxWinComplete);
        };
        MaxWinViewMediator.prototype.onShowingMaxWin = function () {
            this._view.show();
        };
        MaxWinViewMediator.prototype.onShowingMaxWinComplete = function () {
            this._view.hide();
        };
        return MaxWinViewMediator;
    }(dragonwings.Mediator));
    game.MaxWinViewMediator = MaxWinViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var MobileChevronButtonView = (function (_super) {
        __extends(MobileChevronButtonView, _super);
        function MobileChevronButtonView() {
            _super.call(this);
            this._isExpanded = false;
        }
        MobileChevronButtonView.prototype.construct = function () {
            this._scalar = this._device.getScalar();
            var buttonsSpritesheet = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.CF_BaseUIJson.name), this._cache.getAssetById(game.BaseGameBundle.CF_BaseUI.name));
            this.setAssets(buttonsSpritesheet.getFrameByName("chevron_backer.png"), buttonsSpritesheet.getFrameByName("chevron_backer.png"), buttonsSpritesheet.getFrameByName("chevron_backer.png"), buttonsSpritesheet.getFrameByName("chevron_backer.png"));
            Utils.MiscUtils.addBitmap(this, this._cache, game.BaseGameBundle, "CF_Buttons", "chevron_icon.png", 19, 37, false);
            this.rotation = 0;
            this.addEventListener(rendering.InputEvent.DOWN, this.onPress, this);
            Utils.MiscUtils.centreReg(this, this._scalar);
            this.x = game.BaseGameUIConstants.kMobileChevronX;
            this.y = game.BaseGameUIConstants.kMobileChevronY;
        };
        MobileChevronButtonView.prototype.onPress = function () {
            if (!this.enabled) {
                return;
            }
            if (!this._isExpanded) {
                this.animateOut();
            }
            else {
                this.animateIn();
            }
            this.dispatchEvent(new game.GameEvent(game.GameEvent.MOBILE_CHEVRON_BUTTON_PRESSED, this));
        };
        MobileChevronButtonView.prototype.hide = function () {
            this.visible = false;
            this.disableButton();
        };
        MobileChevronButtonView.prototype.show = function () {
            this.visible = true;
            this.enableButton();
        };
        MobileChevronButtonView.prototype.animateIn = function () {
            var _this = this;
            this.disableButton();
            TweenLite.to(this, 0.5, {
                x: game.BaseGameUIConstants.kMobileChevronX,
                rotation: 0,
                onComplete: function () {
                    _this._isExpanded = false;
                    _this.enableButton();
                }
            });
        };
        MobileChevronButtonView.prototype.animateOut = function () {
            var _this = this;
            this.disableButton();
            TweenLite.to(this, 0.5, {
                x: 1501,
                rotation: 180,
                onComplete: function () {
                    _this._isExpanded = true;
                    _this.enableButton();
                }
            });
        };
        MobileChevronButtonView.prototype.enableButton = function () {
            this.enabled = true;
        };
        MobileChevronButtonView.prototype.disableButton = function () {
            this.enabled = false;
        };
        __decorate([
            inject('AssetCache')
        ], MobileChevronButtonView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], MobileChevronButtonView.prototype, "_device", void 0);
        return MobileChevronButtonView;
    }(game.ButtonView));
    game.MobileChevronButtonView = MobileChevronButtonView;
})(game || (game = {}));
var game;
(function (game) {
    var MobileChevronButtonViewMediator = (function (_super) {
        __extends(MobileChevronButtonViewMediator, _super);
        function MobileChevronButtonViewMediator() {
            _super.apply(this, arguments);
        }
        MobileChevronButtonViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this._view = this.getViewComponent();
            this.addContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.addContextListener(game.GameEvent.AUTOPLAY_BUTTON_PRESSED, this.onAutoplayButtonPressed);
            this.addContextListener(game.AutoPlayModelEvent.STARTED, this.onAutoplayStarted);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.addContextListener(game.GameStateEvent.ExitState(game.Subgame.PRE_GAME, "historyInit"), this.onReplay);
            this.addContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START, this.onMobilePopoutMenuAnimationStart);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END, this.onMobilePopoutMenuAnimationEnd);
            this._view.addEventListener(game.GameEvent.MOBILE_CHEVRON_BUTTON_PRESSED, this.doGlobalDispatch, this);
        };
        MobileChevronButtonViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.removeContextListener(game.GameEvent.AUTOPLAY_BUTTON_PRESSED, this.onAutoplayButtonPressed);
            this.removeContextListener(game.AutoPlayModelEvent.STARTED, this.onAutoplayStarted);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.removeContextListener(game.GameStateEvent.ExitState(game.Subgame.PRE_GAME, "historyInit"), this.onReplay);
            this.removeContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START, this.onMobilePopoutMenuAnimationStart);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END, this.onMobilePopoutMenuAnimationEnd);
            this._view.removeEventListener(game.GameEvent.MOBILE_CHEVRON_BUTTON_PRESSED, this.doGlobalDispatch, this);
        };
        MobileChevronButtonViewMediator.prototype.onRecovery = function () {
            this._view.hide();
        };
        MobileChevronButtonViewMediator.prototype.onReplay = function () {
            this._view.hide();
        };
        MobileChevronButtonViewMediator.prototype.onEnterBonusIntroState = function () {
            this._view.hide();
        };
        MobileChevronButtonViewMediator.prototype.onSpinButtonPressed = function () {
            if (this._showTween) {
                this._showTween.kill();
            }
            this._view.hide();
        };
        MobileChevronButtonViewMediator.prototype.onEndResponse = function () {
            var _this = this;
            if (this._autoplayModel.isInProgress() && this._autoplayModel.numSpins > 0) {
                return;
            }
            this._showTween = TweenMax.delayedCall(1, function () {
                _this._view.show();
            });
        };
        MobileChevronButtonViewMediator.prototype.onAutoplayButtonPressed = function () {
            this._view.animateIn();
        };
        MobileChevronButtonViewMediator.prototype.onAutoplayStarted = function () {
            this._view.hide();
        };
        MobileChevronButtonViewMediator.prototype.onHardReset = function () {
            this._view.show();
        };
        MobileChevronButtonViewMediator.prototype.onMobilePopoutMenuAnimationStart = function () {
            this._view.disableButton();
        };
        MobileChevronButtonViewMediator.prototype.onMobilePopoutMenuAnimationEnd = function () {
            this._view.enableButton();
        };
        MobileChevronButtonViewMediator.prototype.doGlobalDispatch = function (e) {
            this.context.eventDispatcher.dispatchEvent(e);
        };
        __decorate([
            inject('AutoPlayModel')
        ], MobileChevronButtonViewMediator.prototype, "_autoplayModel", void 0);
        return MobileChevronButtonViewMediator;
    }(dragonwings.Mediator));
    game.MobileChevronButtonViewMediator = MobileChevronButtonViewMediator;
})(game || (game = {}));
/// <reference path="../Generic/ToggleButtonView.ts" />
var game;
(function (game) {
    var MobilePlatformButtonView = (function (_super) {
        __extends(MobilePlatformButtonView, _super);
        function MobilePlatformButtonView() {
            var cache = new assets.AssetCache();
            var jsonAsset = cache.getAssetById(game.BaseGameBundle.CF_BaseUIJson.name);
            var imgAsset = cache.getAssetById(game.BaseGameBundle.CF_BaseUI.name);
            var spritesheet = new components.SpriteSheet(jsonAsset, imgAsset);
            var upAsset = spritesheet.getFrameByName("topbar_button_up.png");
            var downAsset = spritesheet.getFrameByName("topbar_button_down.png");
            _super.call(this, upAsset, downAsset, upAsset, upAsset);
            this._spriteSheet = spritesheet;
            this._cache = cache;
            this._inDownState = false;
        }
        MobilePlatformButtonView.prototype.construct = function (labelStr, valueStr) {
            var upAsset = this._spriteSheet.getFrameByName("topbar_button_up.png");
            var kTextHeightScale = 0.7;
            this._label1Text = new rendering.Text(valueStr);
            this._label1Text.textAlign = rendering.TextAlign.CENTER;
            this._label1Text.font = "Myriad Pro Black";
            this._label1Text.fontSize = 18;
            this._label1Text.colour = "#ffffff";
            this._label1Text.scaleToWidth = upAsset.width;
            this._label1Text.scaleToHeight = upAsset.height * kTextHeightScale;
            this._label1Text.y = 3;
            this._label1Text.interactive = false;
            //this._label1Text.debug = true;
            this.addChild(this._label1Text);
            this._label2Text = new rendering.Text(labelStr);
            this._label2Text.textAlign = rendering.TextAlign.CENTER;
            this._label2Text.font = "Myriad Pro Black";
            this._label2Text.fontSize = 18;
            this._label2Text.colour = "#ffffff";
            this._label2Text.scaleToWidth = upAsset.width;
            this._label2Text.scaleToHeight = upAsset.height * kTextHeightScale;
            this._label2Text.y = this._label1Text.y + this._label1Text.height;
            this._label2Text.interactive = false;
            //this._label2Text.debug = true;
            this.addChild(this._label2Text);
            this.label1 = valueStr;
            this.label2 = labelStr;
            this.interactive = true;
            this.hitArea = new rendering.Rectangle(0, 0, upAsset.width, upAsset.height);
        };
        Object.defineProperty(MobilePlatformButtonView.prototype, "label1", {
            get: function () {
                return this._label1Text.text;
            },
            set: function (value) {
                this._label1Text.text = value;
                this._label1Text.x = (this._label1Text.scaleToWidth - this._label1Text.width) / 2;
                this._label1Text.interactive = false;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MobilePlatformButtonView.prototype, "label2", {
            get: function () {
                return this._label2Text.text;
            },
            set: function (value) {
                this._label2Text.text = value;
                this._label2Text.x = (this._label2Text.scaleToWidth - this._label2Text.width) / 2;
                this._label2Text.interactive = false;
            },
            enumerable: true,
            configurable: true
        });
        return MobilePlatformButtonView;
    }(game.ToggleButtonView));
    game.MobilePlatformButtonView = MobilePlatformButtonView;
})(game || (game = {}));
var game;
(function (game) {
    var MobileSpinButtonView = (function (_super) {
        __extends(MobileSpinButtonView, _super);
        function MobileSpinButtonView() {
            _super.call(this);
        }
        MobileSpinButtonView.prototype.construct = function () {
            var buttonsSpritesheet = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.CF_BaseUIJson.name), this._cache.getAssetById(game.BaseGameBundle.CF_BaseUI.name));
            this.setAssets(buttonsSpritesheet.getFrameByName("spin_backer.png"), buttonsSpritesheet.getFrameByName("spin_backer.png"), buttonsSpritesheet.getFrameByName("spin_backer.png"), buttonsSpritesheet.getFrameByName("spin_backer.png"));
            var icon = Utils.MiscUtils.addBitmap(this, this._cache, game.BaseGameBundle, "CF_Buttons", "spin_icon.png", 0, 0, false);
            icon.x = this.width / 2 - icon.width / 2 + 10;
            icon.y = this.height / 2 - icon.height / 2;
            rendering.InputManager.registerObject(this);
            this.addEventListener(rendering.InputEvent.DOWN, this.onPress, this);
            this.x = 1600;
            this.y = 360;
        };
        MobileSpinButtonView.prototype.onPress = function () {
            if (!this.enabled) {
                return;
            }
            this.dispatchEvent(new game.GameEvent(game.GameEvent.SPIN_BUTTON_PRESSED, this));
        };
        MobileSpinButtonView.prototype.hide = function (delay, duration) {
            var _this = this;
            if (delay === void 0) { delay = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf; }
            if (duration === void 0) { duration = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf; }
            if (!this._isHidden) {
                this.enabled = false;
                this._isHidden = true;
                TweenMax.to(this, 0.5, {
                    delay: 0,
                    x: 2100,
                    onComplete: function () {
                        _this.enabled = true;
                    }
                });
            }
        };
        MobileSpinButtonView.prototype.show = function (delay, duration) {
            var _this = this;
            if (delay === void 0) { delay = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf; }
            if (duration === void 0) { duration = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf; }
            if (this._isHidden) {
                this.enabled = false;
                this._isHidden = false;
                TweenMax.to(this, 0.5, {
                    delay: 0,
                    x: 1600,
                    onComplete: function () {
                        _this.enabled = true;
                    }
                });
            }
        };
        __decorate([
            inject('AssetCache')
        ], MobileSpinButtonView.prototype, "_cache", void 0);
        return MobileSpinButtonView;
    }(game.ButtonView));
    game.MobileSpinButtonView = MobileSpinButtonView;
})(game || (game = {}));
var game;
(function (game) {
    var MobileSpinButtonViewMediator = (function (_super) {
        __extends(MobileSpinButtonViewMediator, _super);
        function MobileSpinButtonViewMediator() {
            _super.apply(this, arguments);
        }
        MobileSpinButtonViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this._view = this.getViewComponent();
            this.addContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_OPEN, this.onMobilePopoutMenuOpen);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_CLOSE, this.onMobilePopoutMenuClosed);
            this.addContextListener(game.AutoPlayModelEvent.STARTED, this.onAutoplayStarted);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.addContextListener(game.GameStateEvent.ExitState(game.Subgame.PRE_GAME, "historyInit"), this.onReplay);
            this.addContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this._view.addEventListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.doGlobalDispatch, this);
        };
        MobileSpinButtonViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_OPEN, this.onMobilePopoutMenuOpen);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_CLOSE, this.onMobilePopoutMenuClosed);
            this.removeContextListener(game.AutoPlayModelEvent.STARTED, this.onAutoplayStarted);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.removeContextListener(game.GameStateEvent.ExitState(game.Subgame.PRE_GAME, "historyInit"), this.onReplay);
            this.removeContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this._view.removeEventListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.doGlobalDispatch, this);
        };
        MobileSpinButtonViewMediator.prototype.onRecovery = function () {
            this._view.hide();
        };
        MobileSpinButtonViewMediator.prototype.onReplay = function () {
            this._view.hide();
        };
        MobileSpinButtonViewMediator.prototype.onSpinButtonPressed = function () {
            this._view.hide();
        };
        MobileSpinButtonViewMediator.prototype.onMobilePopoutMenuOpen = function () {
            this._view.hide();
        };
        MobileSpinButtonViewMediator.prototype.onMobilePopoutMenuClosed = function () {
            this._view.show();
        };
        MobileSpinButtonViewMediator.prototype.onEndResponse = function () {
            if (this._autoplayModel.isInProgress() && this._autoplayModel.numSpins > 0) {
                return;
            }
            this._view.show();
        };
        MobileSpinButtonViewMediator.prototype.onAutoplayStarted = function () {
            this._view.hide();
        };
        MobileSpinButtonViewMediator.prototype.onHardReset = function () {
            this._view.show();
        };
        MobileSpinButtonViewMediator.prototype.doGlobalDispatch = function (e) {
            this.context.eventDispatcher.dispatchEvent(e);
        };
        __decorate([
            inject('AutoPlayModel')
        ], MobileSpinButtonViewMediator.prototype, "_autoplayModel", void 0);
        return MobileSpinButtonViewMediator;
    }(dragonwings.Mediator));
    game.MobileSpinButtonViewMediator = MobileSpinButtonViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    (function (StakePointerPosition) {
        StakePointerPosition[StakePointerPosition["POINTER_LEFT"] = 0] = "POINTER_LEFT";
        StakePointerPosition[StakePointerPosition["POINTER_RIGHT"] = 1] = "POINTER_RIGHT";
    })(game.StakePointerPosition || (game.StakePointerPosition = {}));
    var StakePointerPosition = game.StakePointerPosition;
    // Base class for the mobile bet/line and lines panels
    var MobileStakePanel = (function (_super) {
        __extends(MobileStakePanel, _super);
        function MobileStakePanel() {
            _super.call(this);
        }
        MobileStakePanel.prototype.construct = function (maxStr, minStr) {
            var panelBg = this.createBg();
            this.addChild(panelBg);
            this.plusButton = this.createPlusButton();
            this.plusButton.x = 400;
            this.plusButton.y = 52;
            this.plusButton.interactive = true;
            panelBg.addChild(this.plusButton);
            this.minusButton = this.createMinusButton();
            this.minusButton.x = 28;
            this.minusButton.y = 52;
            this.minusButton.interactive = true;
            panelBg.addChild(this.minusButton);
            this.maxButton = this.createButton(maxStr);
            this.maxButton.x = game.BaseGameUIConstants.kMobileStakeMaxButtonX;
            this.maxButton.y = game.BaseGameUIConstants.kMobileStakeMaxButtonY;
            this.maxButton.interactive = true;
            this.addChild(this.maxButton);
            this.minButton = this.createButton(minStr);
            this.minButton.x = game.BaseGameUIConstants.kMobileStakeMinButtonX;
            this.minButton.y = game.BaseGameUIConstants.kMobileStakeMaxButtonY;
            this.minButton.interactive = true;
            this.addChild(this.minButton);
            this.setPointerPosition(StakePointerPosition.POINTER_LEFT);
            rendering.InputManager.registerObject(this.plusButton);
            rendering.InputManager.registerObject(this.minusButton);
            rendering.InputManager.registerObject(this.minButton);
            rendering.InputManager.registerObject(this.maxButton);
            /*this.plusButton.addEventListener(rendering.InputEvent.DOWN, this.onPlus, this);
            this.minusButton.addEventListener(rendering.InputEvent.DOWN, this.onMinus, this);
            this.minButton.addEventListener(rendering.InputEvent.DOWN, this.onMin, this);
            this.maxButton.addEventListener(rendering.InputEvent.DOWN, this.onMax, this);*/
            //this.addEventListener(rendering.InputEvent.DOWN, this.onPlus, this);
        };
        /*protected onPlus(e: rendering.InputEvent): void {
            Utils.PSLog.log(`MobileStakePanel::onPlus(${e.eventName})`);
        }

        protected onMinus(e: rendering.InputEvent): void {
            Utils.PSLog.log(`MobileStakePanel::onMinus(${e.eventName})`);
        }

        protected onMax(e: rendering.InputEvent): void {
            Utils.PSLog.log(`MobileStakePanel::onMax(${e.eventName})`);
        }

        protected onMin(e: rendering.InputEvent): void {
            Utils.PSLog.log(`MobileStakePanel::onMin(${e.eventName})`);
        }*/
        MobileStakePanel.prototype.setPointerPosition = function (pos) {
            var ptrXOffset = 80;
            var left = (pos == StakePointerPosition.POINTER_LEFT);
            this._ptrGraphic.x = left ? ptrXOffset : (game.BaseGameUIConstants.kMobileStakePanelWidth - ptrXOffset);
        };
        MobileStakePanel.prototype.createBg = function () {
            var kAlpha = 0.8;
            var ptrWidth = 36;
            var container = new rendering.DisplayObjectContainer();
            var panelBg = Utils.MiscUtils.createRoundedBox(0, 0, game.BaseGameUIConstants.kMobileStakePanelWidth, game.BaseGameUIConstants.kMobileStakePanelHeight, 0x000000, true);
            panelBg.alpha = kAlpha;
            panelBg.x = 0;
            panelBg.y = ptrWidth / 2;
            container.addChild(panelBg);
            this._ptrGraphic = new rendering.Graphics();
            this._ptrGraphic.lineStyle(0, 0x000000, kAlpha);
            this._ptrGraphic.beginFill(0x000000, kAlpha);
            this._ptrGraphic.moveTo(ptrWidth / 2, 0);
            this._ptrGraphic.lineTo(ptrWidth, ptrWidth / 2);
            this._ptrGraphic.lineTo(0, ptrWidth / 2);
            this._ptrGraphic.lineTo(ptrWidth / 2, 0);
            this._ptrGraphic.endFill();
            container.addChild(this._ptrGraphic);
            return container;
        };
        MobileStakePanel.prototype.createPlusButton = function () {
            var kRadius = 40;
            var kLineLen = 34;
            var container = new rendering.DisplayObjectContainer();
            var plus = new rendering.Graphics();
            plus.lineStyle(3, 0x7b7b7b, 1);
            plus.drawCircle(kRadius, kRadius, kRadius);
            plus.lineStyle(10, 0xffffff, 1);
            plus.moveTo(kRadius, kRadius - kLineLen / 2);
            plus.lineTo(kRadius, kRadius + kLineLen / 2);
            plus.moveTo(kRadius - kLineLen / 2, kRadius);
            plus.lineTo(kRadius + kLineLen / 2, kRadius);
            var hitArea = new rendering.Ellipse(kRadius, kRadius, kRadius, kRadius);
            container.hitArea = hitArea;
            container.addChild(plus);
            return container;
        };
        MobileStakePanel.prototype.createMinusButton = function () {
            var kRadius = 40;
            var kLineLen = 34;
            var container = new rendering.DisplayObjectContainer();
            var minus = new rendering.Graphics();
            minus.lineStyle(3, 0x7b7b7b, 1);
            minus.drawCircle(kRadius, kRadius, kRadius);
            minus.lineStyle(10, 0xffffff, 1);
            minus.moveTo(kRadius - kLineLen / 2, kRadius);
            minus.lineTo(kRadius + kLineLen / 2, kRadius);
            var hitArea = new rendering.Ellipse(kRadius, kRadius, kRadius, kRadius);
            container.hitArea = hitArea;
            container.addChild(minus);
            return container;
        };
        MobileStakePanel.prototype.createButton = function (labelStr) {
            var container = new rendering.DisplayObjectContainer();
            var buttonBox = Utils.MiscUtils.createRoundedBox(0, 0, game.BaseGameUIConstants.kMobileStakePanelButtonWidth, game.BaseGameUIConstants.kMobileStakePanelButtonHeight, 0x7b7b7b, false, 2, 6);
            var buttonText = new rendering.Text(labelStr);
            buttonText.textAlign = rendering.TextAlign.CENTER;
            buttonText.font = "Myriad Pro Black";
            buttonText.fontSize = 18;
            buttonText.colour = "#ffffff";
            buttonText.scaleToWidth = game.BaseGameUIConstants.kMobileStakePanelButtonWidth;
            buttonText.scaleToHeight = game.BaseGameUIConstants.kMobileStakePanelButtonHeight;
            buttonText.x = (buttonText.scaleToWidth - buttonText.width) / 2;
            buttonText.y = (buttonText.scaleToHeight - buttonText.height) / 2;
            buttonText.interactive = false;
            buttonBox.addChild(buttonText);
            container.addChild(buttonBox);
            var hitArea = new rendering.Rectangle(0, 0, game.BaseGameUIConstants.kMobileStakePanelButtonWidth, game.BaseGameUIConstants.kMobileStakePanelButtonHeight);
            container.hitArea = hitArea;
            return container;
        };
        return MobileStakePanel;
    }(rendering.DisplayObjectContainer));
    game.MobileStakePanel = MobileStakePanel;
})(game || (game = {}));
var game;
(function (game) {
    var SkipPayCycleOverlayView = (function (_super) {
        __extends(SkipPayCycleOverlayView, _super);
        function SkipPayCycleOverlayView() {
            _super.call(this);
        }
        SkipPayCycleOverlayView.prototype.construct = function () {
            var overlay = new rendering.Graphics();
            overlay.beginFill(0x00ff00, 0);
            overlay.moveTo(0, 0);
            overlay.lineTo(1920, 0);
            overlay.lineTo(1920, 1080);
            // overlay.lineTo(1620, 1080);
            // overlay.lineTo(1620, 810);
            // overlay.lineTo(290, 810);
            // overlay.lineTo(290, 1080);
            overlay.lineTo(0, 1080);
            overlay.endFill();
            overlay.x = 0;
            overlay.y = 0;
            this.addChild(overlay);
            rendering.InputManager.registerObject(overlay);
            overlay.addEventListener(rendering.InputEvent.DOWN, this.onOverlayPressed, this);
            this.hide();
        };
        SkipPayCycleOverlayView.prototype.onOverlayPressed = function () {
            this.dispatchEvent(new game.GameEvent(game.GameEvent.PAY_CYCLE_OVERLAY_PRESSED, this));
        };
        SkipPayCycleOverlayView.prototype.show = function () {
            this.visible = true;
        };
        SkipPayCycleOverlayView.prototype.hide = function () {
            this.visible = false;
        };
        return SkipPayCycleOverlayView;
    }(rendering.DisplayObjectContainer));
    game.SkipPayCycleOverlayView = SkipPayCycleOverlayView;
})(game || (game = {}));
var game;
(function (game) {
    var SkipPayCycleOverlayViewMediator = (function (_super) {
        __extends(SkipPayCycleOverlayViewMediator, _super);
        function SkipPayCycleOverlayViewMediator() {
            _super.apply(this, arguments);
        }
        SkipPayCycleOverlayViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            Utils.PSLog.log("SkipPayCycleOverlayView added");
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "showingWins"), this.onShowingWins);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "cascading"), this.onCascading);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingWins"), this.onShowingWins);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "cascading"), this.onCascading);
            this.view.addEventListener(game.GameEvent.PAY_CYCLE_OVERLAY_PRESSED, this.onOverlayPressed, this);
        };
        SkipPayCycleOverlayViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "showingWins"), this.onShowingWins);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "cascading"), this.onCascading);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingWins"), this.onShowingWins);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "cascading"), this.onCascading);
            this.view.removeEventListener(game.GameEvent.PAY_CYCLE_OVERLAY_PRESSED, this.onOverlayPressed, this);
        };
        SkipPayCycleOverlayViewMediator.prototype.onShowingWins = function () {
            this.view.show();
        };
        SkipPayCycleOverlayViewMediator.prototype.onCascading = function () {
            this.view.hide();
        };
        SkipPayCycleOverlayViewMediator.prototype.onOverlayPressed = function () {
            if (!this._historyModel.getIsHistoryReplay()) {
                this.context.parent.eventDispatcher.dispatchEvent(new game.GameEvent(game.GameEvent.PAY_CYCLE_OVERLAY_PRESSED));
            }
        };
        __decorate([
            inject('CyclersModel')
        ], SkipPayCycleOverlayViewMediator.prototype, "_cyclersModel", void 0);
        __decorate([
            inject('HistoryModel')
        ], SkipPayCycleOverlayViewMediator.prototype, "_historyModel", void 0);
        return SkipPayCycleOverlayViewMediator;
    }(dragonwings.Mediator));
    game.SkipPayCycleOverlayViewMediator = SkipPayCycleOverlayViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var PaylineDisplay = (function (_super) {
        __extends(PaylineDisplay, _super);
        function PaylineDisplay(grid, lines, fullLine) {
            _super.call(this, grid, lines, fullLine);
            this._previousAngle = "straight";
            this._innerBoxes = [];
            this._cache = new assets.AssetCache();
            this._dropShadowFilter = new PIXI.filters.DropShadowFilter();
            this._dropShadowFilter.alpha = 0.5;
            this._dropShadowFilter.distance = 30;
        }
        Object.defineProperty(PaylineDisplay.prototype, "isDesktop", {
            get: function () {
                return this._isDesktop;
            },
            set: function (value) {
                this._isDesktop = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PaylineDisplay.prototype, "desktopLines", {
            set: function (value) {
                this._desktopLines = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PaylineDisplay.prototype, "desktopBoxes", {
            set: function (value) {
                this._desktopBoxes = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PaylineDisplay.prototype, "scalar", {
            set: function (value) {
                this._scalar = value;
            },
            enumerable: true,
            configurable: true
        });
        PaylineDisplay.prototype.unhide = function () {
            this.container.visible = true;
        };
        PaylineDisplay.prototype.hide = function () {
            _super.prototype.hide.call(this);
        };
        PaylineDisplay.prototype.drawLines = function (paylines, parts, darken, clear) {
            var _this = this;
            if (clear === void 0) { clear = true; }
            if (clear) {
                this.clear();
            }
            for (var i = 0; i < paylines.length; ++i) {
                var line = this.lines[paylines[i]];
                var g = this.getCachedLine(paylines[i], parts[i]); //new rendering.Graphics();
                if (g == null) {
                    g = new rendering.Graphics();
                    if (line.outline) {
                        g.lineStyle(line.lineWidth + line.outlineThickness, line.outlineColor, 1, rendering.CapStyle.ROUND, rendering.JointStyle.MITER);
                        this.tracePath(g, line, parts[i], true);
                    }
                    g.lineStyle(line.lineWidth, line.getLineColor(darken), 1, rendering.CapStyle.ROUND, rendering.JointStyle.MITER);
                    this.tracePath(g, line, parts[i], true);
                    this.lineCache[paylines[i]] = g;
                }
                // Add the payline graphic
                this.container.addChild(g);
                // Add the inner boxes
                this._innerBoxes.forEach(function (innerBox) {
                    _this.container.addChild(innerBox);
                });
                // Clear the innerBoxes ready for next payline
                this._innerBoxes = [];
            }
        };
        /**
         * Draws a target box
         *
         * @param  i  part index
         * @param  vgComp  vector graphics component
         * @param  line  the payline
         * @param  tw  target box width
         * @param  th  target box height
         * @param  tlcx  top left corner x
         * @param  tlcy  top left corner y
         * @param  brcx  bottom right corner x
         * @param  brcy  bottom right corner y
         */
        PaylineDisplay.prototype.drawBox = function (i, vgComp, line, parts, drawLines, tw, th, tlcx, tlcy, brcx, brcy) {
            vgComp.drawRect(tlcx, tlcy, tw, th);
        };
        PaylineDisplay.prototype.drawInnerBox = function (xPos, yPos, targetWidth, targetHeight, payline) {
            var innerBox = new rendering.Graphics();
            innerBox.beginFill(0x000000, 0);
            innerBox.lineStyle(3, 0x333333, 1);
            innerBox.drawRect(0, 0, targetWidth, targetHeight - 2);
            innerBox.endFill();
            innerBox.x = xPos + 1;
            innerBox.y = yPos + 1;
            this._innerBoxes.push(innerBox);
        };
        /**
         * Overridden to more closely match/blend the ends of paylines at angles
         * For differences just see **THE NEW BIT** below, otherwise this is the same as in game_libs
         */
        PaylineDisplay.prototype.tracePath = function (vgComp, payline, parts, drawLines, outline) {
            if (outline === void 0) { outline = false; }
            for (var i = 0; i < payline.targets.length; ++i) {
                if (parts[i] == components.PaylinePart.None) {
                    continue;
                }
                var columnIndex = i + payline.columnStartIndex;
                var targetWidth = this.grid.getTargetPosWidth(columnIndex, payline.targets[i]);
                var targetHeight = this.grid.getTargetPosHeight(columnIndex, payline.targets[i]);
                var targetPosition = [
                    this.grid.getTargetPosX(columnIndex, payline.targets[i]),
                    this.grid.getTargetPosY(columnIndex, payline.targets[i])
                ];
                var targetTopLeftX = targetPosition[0] - (targetWidth * 0.5);
                var targetTopLeftY = targetPosition[1] - (targetHeight * 0.5);
                var targetBottomRightX = targetPosition[0] + (targetWidth * 0.5);
                var targetBottomRightY = targetPosition[1] + (targetHeight * 0.5);
                if (parts[i] == components.PaylinePart.Box) {
                    this.drawBox(i, vgComp, payline, parts, drawLines, targetWidth, targetHeight, targetTopLeftX, targetTopLeftY, targetBottomRightX, targetBottomRightY);
                    this.drawInnerBox(targetTopLeftX, targetTopLeftY, targetWidth, targetHeight, payline);
                }
                if (drawLines) {
                    var toBox = false;
                    var startX = targetPosition[0] - (this.fullLine ? (targetWidth * 0.5) : 0);
                    var startY = targetPosition[1] - (this.fullLine ? (targetHeight * 0.5) : 0); // <--------
                    var endX = targetPosition[0] - (this.fullLine ? (targetWidth * 0.5) : 0);
                    var endY = targetPosition[1] - (this.fullLine ? (targetHeight * 0.5) : 0);
                    if (payline.getOffset(i) == null) {
                        endX += targetWidth / 2;
                        endY += targetHeight / 2;
                    }
                    else {
                        endX += payline.getOffset(i).x + (this.fullLine ? (targetWidth * 0.5) : 0);
                        endY += payline.getOffset(i).y + (this.fullLine ? (targetHeight * 0.5) : 0);
                    }
                    if (i == 0) {
                        startY = endY;
                        if (parts[i] == components.PaylinePart.Box) {
                            endX = startX;
                        }
                    }
                    else {
                        startX = this.grid.getTargetPosX(columnIndex - 1, payline.targets[i - 1]) - (this.fullLine ? (targetWidth * 0.5) : 0);
                        startY = this.grid.getTargetPosY(columnIndex - 1, payline.targets[i - 1]) - (this.fullLine ? (targetHeight * 0.5) : 0);
                        if (payline.getOffset(i - 1) == null) {
                            startX += targetWidth / 2;
                            startY += targetHeight / 2;
                        }
                        else {
                            startX += payline.getOffset(i - 1).x + (this.fullLine ? (targetWidth * 0.5) : 0);
                            startY += payline.getOffset(i - 1).y + (this.fullLine ? (targetHeight * 0.5) : 0);
                        }
                        //POSSIBLY EDIT THIS
                        var line = new util.Line(new util.Point(startX, startY - 1), new util.Point(endX, endY));
                        var intersectPoint = new util.Point();
                        var rect = new util.Rect();
                        var intersects = false;
                        if (parts[i - 1] == components.PaylinePart.Box) {
                            rect.set(this.grid.getTargetPosX(columnIndex - 1, payline.targets[i - 1]) - (targetWidth * 0.5), this.grid.getTargetPosY(columnIndex - 1, payline.targets[i - 1]) - (targetHeight * 0.5), targetWidth, targetHeight);
                            intersects = line.intersectionRect(rect, intersectPoint);
                            if (intersects) {
                                startX = intersectPoint.x;
                                startY = intersectPoint.y;
                            }
                        }
                        if (parts[i] == components.PaylinePart.Box) {
                            rect.set(targetTopLeftX, targetTopLeftY, targetWidth, targetHeight);
                            intersects = line.intersectionRect(rect, intersectPoint);
                            if (intersects) {
                                endX = intersectPoint.x;
                                endY = intersectPoint.y;
                            }
                        }
                    }
                    //This is the normal main line
                    //vgComp.moveTo(startX, startY).lineTo(endX, endY);
                    //**********************THE NEW BIT***************************
                    //Now let's add some extra to the ends, so things join up on angle joints.
                    var straight = (startY >> 0) == (endY >> 0) ? true : false;
                    var angledUp = (startY >> 0) > (endY >> 0) ? true : false;
                    //draw the secondary inner line
                    if (straight && i > 0) {
                        //this adds extra to the ends of straight lines so they meet up with any angled ones
                        vgComp.moveTo(startX - 3, startY).lineTo(endX + 3, endY);
                    }
                    else {
                        //normal line draw
                        var angleModY = i > 0 ? (angledUp ? -1 : 1) : 0;
                        var angleModX = i > 0 ? 1 : 0;
                        vgComp.moveTo(startX - angleModX, startY - angleModY).lineTo(endX + angleModX, endY + angleModY);
                    }
                    //draw an extra little connector for acute angles
                    if (parts[i] != components.PaylinePart.Box && i > 0) {
                        if (!straight && ((angledUp && this._previousAngle == "down") || (!angledUp && this._previousAngle == "up"))) {
                            vgComp.moveTo(startX - 3, startY).lineTo(startX + 3, startY);
                        }
                    }
                    this._previousAngle = straight ? "straight" : (angledUp ? "up" : "down");
                    //************************************************************
                    if (parts[i] != components.PaylinePart.Box && i == payline.targets.length - 1) {
                        startX = endX;
                        startY = endY;
                        endX = targetBottomRightX;
                        if (this.fullLine)
                            vgComp.moveTo(startX, startY).lineTo(endX, endY);
                    }
                }
            }
        };
        return PaylineDisplay;
    }(components.PaylineDisplay));
    game.PaylineDisplay = PaylineDisplay;
})(game || (game = {}));
var components;
(function (components) {
    var CFPaylinesCycler = (function (_super) {
        __extends(CFPaylinesCycler, _super);
        /**
         * Create a new PaylinesCycler object
         *
         * @param  paylineDisplay  paylines display used to show wins
         * @param  blinkCycles  number of times to blink. 0 shows only light phase, no dark.
         * @param  cycleTime  time to wait between each blink and next result. In seconds.
         */
        function CFPaylinesCycler(paylineDisplay, blinkCycles, cycleTime) {
            _super.call(this, paylineDisplay, blinkCycles, cycleTime);
        }
        CFPaylinesCycler.prototype.advance = function () {
            _super.prototype.advance.call(this);
        };
        CFPaylinesCycler.prototype.getCycles = function () {
            return this.cycles;
        };
        CFPaylinesCycler.prototype.getCurrentCycle = function () {
            return this.currentCycle;
        };
        /**
         * @inheritdoc
         * @param dark @inheritdoc
         */
        CFPaylinesCycler.prototype.display = function (dark) {
            if (this.results.length > 0) {
                var sr = this.results[this.currentResult];
                var parts = new Array();
                var targets;
                if (sr.scatter) {
                    targets = [0, 0, 0, 0, 0];
                }
                for (var i = 0; i < sr.layout.length; ++i) {
                    if (sr.layout[i] >= 0) {
                        parts.push(components.PaylinePart.Box);
                        if (sr.scatter) {
                            targets[i] = sr.layout[i];
                        }
                    }
                    else if (sr.scatter) {
                        parts.push(components.PaylinePart.None);
                    }
                    else {
                        parts.push(components.PaylinePart.Line);
                    }
                }
                var event = new components.CyclerEvent(components.CyclerEvent.ON_DISPLAY);
                event.result = sr;
                event.parts = parts;
                event.dark = dark;
                this.dispatchEvent(event);
                if (sr.scatter && this.showScatters) {
                    this.displayer.showCustom(sr.payline, parts, targets, dark, false, sr.clear);
                }
                else {
                    this.displayer.show(sr.payline, parts, dark, sr.clear);
                }
            }
        };
        return CFPaylinesCycler;
    }(components.Cycler));
    components.CFPaylinesCycler = CFPaylinesCycler;
})(components || (components = {}));
var game;
(function (game) {
    var BaseGameReelsetFrameView = (function (_super) {
        __extends(BaseGameReelsetFrameView, _super);
        function BaseGameReelsetFrameView() {
            _super.call(this);
        }
        BaseGameReelsetFrameView.prototype.construct = function () {
            var frameAsset = Utils.MiscUtils.getAssetFrameWithName("reel.png", game.BaseGameBundle.RG_ReelFrame.name, game.BaseGameBundle.RG_ReelFrameJson.name, this._cache);
            this._isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            this._bgAlpha = new rendering.Graphics();
            this._bgAlpha.beginFill(0x000000, 0.5);
            if (this._isDesktop) {
                this.x = game.BaseGameUIConstants.kDesktopReelsetFrameX;
                this.y = game.BaseGameUIConstants.kDesktopReelsetFrameY;
                this._bgAlpha.drawRect(15, 15, 1200, 600);
            }
            else {
                this.x = game.BaseGameUIConstants.kMobileReelsetFrameX;
                this.y = game.BaseGameUIConstants.kMobileReelsetFrameY;
                this._bgAlpha.drawRect(15, 15, 1450, 750);
            }
            this.addChild(this._bgAlpha);
            this.addChild(new rendering.Bitmap(frameAsset));
        };
        __decorate([
            inject('AssetCache')
        ], BaseGameReelsetFrameView.prototype, "_cache", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], BaseGameReelsetFrameView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], BaseGameReelsetFrameView.prototype, "_launchParams", void 0);
        return BaseGameReelsetFrameView;
    }(rendering.DisplayObjectContainer));
    game.BaseGameReelsetFrameView = BaseGameReelsetFrameView;
})(game || (game = {}));
var rendering;
(function (rendering) {
    var CustomBitmap = (function (_super) {
        __extends(CustomBitmap, _super);
        function CustomBitmap(frameName, assetOrFrame) {
            _super.call(this, assetOrFrame);
            this.frameName = frameName;
            this.assetOrFrame = assetOrFrame;
        }
        return CustomBitmap;
    }(rendering.Bitmap));
    rendering.CustomBitmap = CustomBitmap;
})(rendering || (rendering = {}));
var game;
(function (game) {
    var FiveOfAKindView = (function (_super) {
        __extends(FiveOfAKindView, _super);
        function FiveOfAKindView() {
            _super.call(this);
            this.fiveOfAKindHighlightTracers = [];
            this._isDesktop = true;
        }
        FiveOfAKindView.prototype.construct = function () {
            this._isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            this.addFiveOfAKindHighlightTracers();
        };
        FiveOfAKindView.prototype.addFiveOfAKindHighlightTracers = function () {
            this.fiveOfAKindContainer = new rendering.DisplayObjectContainer();
            var frames = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.CF_TracerJson.name), this._cache.getAssetById(game.BaseGameBundle.CF_Tracer.name)).getFrames();
            var baseX = this._isDesktop ? game.BaseGameUIConstants.kPaylineAnchorX : game.BaseGameUIConstants.kMobilePaylineAnchorX;
            this._baseY = this._isDesktop ? game.BaseGameUIConstants.kPaylineAnchorY + game.BaseGameUIConstants.kDesktopSymbolBaseY : game.BaseGameUIConstants.kMobilePaylineAnchorY + game.BaseGameUIConstants.kMobileSymbolBaseY;
            var xOffset = this._isDesktop ? -42 : -46;
            for (var i = 0; i < 5; i++) {
                this.fiveOfAKindHighlightTracers[i] = new rendering.CustomMovieClip(frames);
                this.fiveOfAKindHighlightTracers[i].fps = 15;
                this.fiveOfAKindHighlightTracers[i].scaleX = this._isDesktop ? game.BaseGameUIConstants.kDesktopHighlightTracerScaleX : game.BaseGameUIConstants.kMobileHighlightTracerScaleX;
                this.fiveOfAKindHighlightTracers[i].scaleY = this._isDesktop ? game.BaseGameUIConstants.kDesktopHighlightTracerScaleY : game.BaseGameUIConstants.kMobileHighlightTracerScaleY;
                this.fiveOfAKindHighlightTracers[i].x = baseX + ((this.fiveOfAKindHighlightTracers[i].width * 0.76) * i) + xOffset;
                this.fiveOfAKindHighlightTracers[i].y = this._baseY - (this.fiveOfAKindHighlightTracers[i].height * 0.2);
                this.fiveOfAKindHighlightTracers[i].visible = false;
                this.fiveOfAKindContainer.addChild(this.fiveOfAKindHighlightTracers[i]);
            }
            this.addChild(this.fiveOfAKindContainer);
        };
        FiveOfAKindView.prototype.onDisplayPayline = function (cycleResult) {
            var frameNames = [];
            for (var x = 0; x < cycleResult.layout.length; x++) {
                frameNames[x] = this._reelsView.getSymbolForXY(x, cycleResult.layout[x]).id.substr(0, 3);
            }
            var wilds = frameNames.filter(function (elem) { return elem === "fet"; });
            var syms = frameNames.filter(function (elem) { return elem !== "fet"; });
            var symCount = Utils.MiscUtils.countOccurances(syms, syms[0]);
            var wildCount = wilds.length;
            if (symCount === syms.length && syms.length + wildCount === 5) {
                for (var i = 0; i < 5; i++) {
                    this.fiveOfAKindHighlightTracers[i].y = this._baseY - (this.fiveOfAKindHighlightTracers[i].height * 0.2) + ((this._isDesktop ? game.BaseGameUIConstants.kDesktopSymbolHeight : game.BaseGameUIConstants.kMobileSymbolHeight) * cycleResult.layout[i]);
                    this.fiveOfAKindHighlightTracers[i].visible = true;
                    this.fiveOfAKindHighlightTracers[i].gotoAndStop(0);
                    this.fiveOfAKindHighlightTracers[i].play();
                }
                this.dispatchEvent(new game.GameEvent(game.GameEvent.HIGHLIGHT_FIVE_OF_A_KIND));
            }
            else {
                this.hideHighlightTracers();
            }
        };
        FiveOfAKindView.prototype.hideHighlightTracers = function () {
            for (var i = 0; i < 5; i++) {
                this.fiveOfAKindHighlightTracers[i].visible = false;
                this.fiveOfAKindHighlightTracers[i].gotoAndStop(0);
            }
        };
        __decorate([
            inject('AssetCache')
        ], FiveOfAKindView.prototype, "_cache", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], FiveOfAKindView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], FiveOfAKindView.prototype, "_launchParams", void 0);
        __decorate([
            inject('ReelsView')
        ], FiveOfAKindView.prototype, "_reelsView", void 0);
        return FiveOfAKindView;
    }(rendering.DisplayObjectContainer));
    game.FiveOfAKindView = FiveOfAKindView;
})(game || (game = {}));
var game;
(function (game) {
    var FiveOfAKindViewMediator = (function (_super) {
        __extends(FiveOfAKindViewMediator, _super);
        function FiveOfAKindViewMediator() {
            _super.apply(this, arguments);
            this._currentPayline = -1;
        }
        FiveOfAKindViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            Utils.PSLog.log("FiveOfAKindViewMediator onAdded");
            this.addContextListener(game.CyclersModelEvent.PAYLINES_CYCLER_STARTED, this.onPaylineCyclerStarted);
            this.addContextListener(game.CyclersModelEvent.PAYLINES_DISPLAY, this.onPaylinesDisplay);
            this.addContextListener(game.GameEvent.SHOW_WINS_COMPLETE, this.onWinsComplete);
        };
        FiveOfAKindViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            Utils.PSLog.log("FiveOfAKindViewMediator onRemove");
            this.removeContextListener(game.CyclersModelEvent.PAYLINES_CYCLER_STARTED, this.onPaylineCyclerStarted);
            this.removeContextListener(game.CyclersModelEvent.PAYLINES_DISPLAY, this.onPaylinesDisplay);
            this.removeContextListener(game.GameEvent.SHOW_WINS_COMPLETE, this.onWinsComplete);
        };
        FiveOfAKindViewMediator.prototype.doGlobalDispatch = function (e) {
            this.eventDispatcher.dispatchEvent(e);
        };
        FiveOfAKindViewMediator.prototype.onPaylineCyclerStarted = function (e) {
            this._currentPayline = -1;
        };
        FiveOfAKindViewMediator.prototype.onPaylinesDisplay = function (e) {
            if (this._currentPayline !== e.result.payline) {
                this._currentPayline = e.result.payline;
                this.view.onDisplayPayline(e.result);
            }
        };
        FiveOfAKindViewMediator.prototype.onWinsComplete = function (e) {
            this.view.hideHighlightTracers();
        };
        return FiveOfAKindViewMediator;
    }(dragonwings.Mediator));
    game.FiveOfAKindViewMediator = FiveOfAKindViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    // Note: This class needs tidying up - possibly split into a couple of classes so it's easier to read
    // Other "cascading-reel" games may use this code also so that's an even better reason to split it out
    var ReelView = (function (_super) {
        __extends(ReelView, _super);
        function ReelView(reelsView, id, isDesktop, cache) {
            _super.call(this);
            this.symbolMap = [];
            this.symbolsForCurrentSpin = [];
            this.cascades = [];
            this.stopIndex = 109;
            this.additionalSymbolsInReel = 0;
            this.cascadeRemainingSymbolsRemoved = 0;
            this.cascadeCount = 0;
            this.symbolHeight = 0;
            this.reelsView = reelsView;
            this.id = id;
            this._isDesktop = isDesktop;
            this._cache = cache;
            this.x = isDesktop ? (game.BaseGameUIConstants.kDesktopFirstReelX + (id * game.BaseGameUIConstants.kDesktopReelSpacingX)) : (game.BaseGameUIConstants.kMobileFirstReelX + (id * game.BaseGameUIConstants.kMobileReelSpacingX));
            this.symbolHeight = isDesktop ? game.BaseGameUIConstants.kDesktopSymbolHeight : game.BaseGameUIConstants.kMobileSymbolHeight;
            this.explosionFrames = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle.CF_ExplosionJson.name), this._cache.getAssetById(game.BaseGameBundle.CF_Explosion.name)).getFrames();
            this.spinDelay = 0;
            this.setPosition();
        }
        /**
         * Sets the Y position of the reel
         */
        ReelView.prototype.setPosition = function () {
            this.y = 35;
        };
        /**
         * Sets the symbols for the reel
         * @param {Array} symbols
         */
        ReelView.prototype.setSymbols = function (symbols) {
            this.additionalSymbolsInReel = 0;
            this.symbolMap = symbols;
            this.setPosition();
        };
        ReelView.prototype.prepareCascadeInformation = function (dispatchEvent) {
            var _this = this;
            this.cascadeBlock = this.cascades.shift();
            this.cascadeSymbolCount = 0;
            this.cascadeRemainingSymbolsRemoved = 0;
            this.cascadeMap = null;
            this._animDataArray = [];
            this.cascadeBlock.forEach(function (bit, index) {
                if (parseInt(bit) === 1) {
                    var indexToRemove = (_this.children.length - 1) - index;
                    var symbol = _this.children[indexToRemove];
                    symbol.symbolIndex = _this.children.indexOf(symbol) - (_this.children.length - 3);
                    var anim = new game.RemoveSymbolAnimationData(_this, symbol);
                    _this._animDataArray.push(anim);
                    _this.cascadeSymbolCount++;
                }
            });
        };
        ReelView.prototype.cascade = function () {
            var _this = this;
            if (this.cascadeSymbolCount > 0) {
                if (game.BigWinView.bigWinShowing) {
                    TweenLite.delayedCall(2, function () {
                        _this.reelsView.dispatchEvent(new game.GameEvent(game.GameEvent.ANIMATE_REMOVE_SYMBOLS, _this, _this._animDataArray));
                    });
                }
                else {
                    this.reelsView.dispatchEvent(new game.GameEvent(game.GameEvent.ANIMATE_REMOVE_SYMBOLS, this, this._animDataArray));
                }
            }
            else {
                this.reelsView.onReelCascaded(this.id);
            }
        };
        ReelView.prototype.populate = function (stopIndex) {
            this.setStopIndex(stopIndex);
            this.symbolsForCurrentSpin = this.getSymbols();
            this.addSymbols();
        };
        ReelView.prototype.setStopIndex = function (stopIndex) {
            this.stopIndex = stopIndex;
        };
        ReelView.prototype.addCascadePattern = function (cascade) {
            this.additionalSymbolsInReel += cascade.filter(function (i) {
                return parseInt(i) === 1;
            }).length;
            this.cascades.push(cascade);
        };
        ReelView.prototype.spin = function (stopIndex, callback) {
            var _this = this;
            this.additionalSymbolsInReel = 0;
            TweenLite.delayedCall(this.id * 0.05, function () {
                _this.populate(stopIndex);
                _this.slideIn(function () { });
            });
        };
        ReelView.prototype.getSymbolForIndex = function (index) {
            return this.children[this.children.length - 3 + index];
        };
        ReelView.prototype.getSymbols = function () {
            var reel = [];
            var reelLength = 3 + this.additionalSymbolsInReel;
            var runningStopIndex = (this.stopIndex + 1 === this.symbolMap.length) ? 0 : this.stopIndex + 1;
            while (reelLength > 0) {
                reel.unshift({
                    id: this.symbolMap[runningStopIndex],
                    distanceToTween: 0
                });
                runningStopIndex--;
                if (runningStopIndex < 0) {
                    runningStopIndex = this.symbolMap.length - 1;
                }
                reelLength--;
            }
            return reel;
        };
        ReelView.prototype.addSymbols = function () {
            var _this = this;
            this.removeAllSymbols();
            var cache = new assets.AssetCache();
            var spritesheet = new components.SpriteSheet(cache.getAssetById(game.BaseGameBundle.CF_SymbolsJson.name), cache.getAssetById(game.BaseGameBundle.CF_Symbols.name));
            var _symbol;
            this.symbolsForCurrentSpin.forEach(function (symbol, index) {
                var frameName = game.BaseGameUIConstants.kReelSymbols[symbol.id];
                // - jackpot
                if (frameName === game.BaseGameUIConstants.kReelSymbols[5]) {
                    var frames = new components.SpriteSheet(cache.getAssetById(game.BaseGameBundle.CF_JackpotSymbolAnimationJson.name), cache.getAssetById(game.BaseGameBundle.CF_JackpotSymbolAnimation.name)).getFrames();
                    _symbol = new rendering.CustomMovieClip(frames);
                    _symbol.id = frameName;
                    _symbol.gotoAndStop(21);
                    _symbol.fps = 20;
                }
                else if (frameName === game.BaseGameUIConstants.kReelSymbols[13]) {
                    var frames = new components.SpriteSheet(cache.getAssetById(game.BaseGameBundle.CF_WildAnimationJson.name), cache.getAssetById(game.BaseGameBundle.CF_WildAnimation.name)).getFrames();
                    _symbol = new rendering.CustomMovieClip(frames);
                    _symbol.id = frameName;
                    _symbol.gotoAndStop(7);
                    _symbol.fps = 12;
                }
                else {
                    var spriteSheet = spritesheet.getFrameByName(frameName);
                    _symbol = new rendering.CustomBitmap(frameName, spriteSheet);
                    _symbol.id = frameName;
                }
                _symbol.y = (_this._isDesktop ? game.BaseGameUIConstants.kDesktopSymbolBaseY : game.BaseGameUIConstants.kMobileSymbolBaseY) + (index * _this.symbolHeight);
                _symbol.scaleX = (_this._isDesktop ? game.BaseGameUIConstants.kDesktopSymbolScaleX : game.BaseGameUIConstants.kMobileSymbolScaleX);
                _symbol.scaleY = (_this._isDesktop ? game.BaseGameUIConstants.kDesktopSymbolScaleY : game.BaseGameUIConstants.kMobileSymbolScaleY);
                _this.addChild(_symbol);
            });
        };
        ReelView.prototype.removeAllSymbols = function () {
            while (this.children[0]) {
                this.removeChild(this.children[0]);
            }
        };
        ReelView.prototype.fall = function () {
            var _this = this;
            var count = 1, offset = 0, tweensCompleted = 0;
            for (var i = this.children.length - 1; i >= 0; i--) {
                offset = Math.random() * game.BaseGameUIConstants.kReelFallDelayOffsetFudge;
                new TweenLite(this.children[i], game.BaseGameUIConstants.kReelFallDuration, {
                    ease: Power1.easeIn,
                    y: this.children[i].y + game.BaseGameUIConstants.kReelFallDepth,
                    delay: game.BaseGameUIConstants.kReelFallDelayStep * count + offset,
                    onComplete: function (elem) {
                        elem.y -= game.BaseGameUIConstants.kReelFallDepth * 2.2;
                        // Ensure that all children have completed their "fall" tween before sliding in the new symbols
                        if (tweensCompleted === _this.children.length - 1) {
                            TweenLite.delayedCall(_this.id * 0.05, function () {
                                // DISPATCH EVENT LETTING THE GAME KNOW THAT ALL SYMBOLS HAVE FALLEN
                                _this.reelsView.onSymbolsFallen();
                            });
                        }
                        tweensCompleted++;
                    },
                    onCompleteParams: [this.children[i]]
                });
                count++;
            }
            this.cascadeCount = 0;
        };
        ReelView.prototype.removeSymbol = function (symbol) {
            var _this = this;
            this.removeChild(symbol);
            var explosion = new rendering.CustomMovieClip(this.explosionFrames);
            explosion.fps = 20;
            explosion.currentFrame--;
            explosion.destroyOnComplete = true;
            explosion.anchor = new PIXI.Point(0.5, 0);
            explosion.x = symbol.x + (symbol.width / 2);
            explosion.y = symbol.y - (symbol.height / 3);
            this.addChild(explosion);
            explosion.playRange(0, this.explosionFrames.length - 1);
            TweenLite.delayedCall(1, function () {
                _this.cascadeRemainingSymbolsRemoved++;
                if (_this.cascadeRemainingSymbolsRemoved === _this.cascadeSymbolCount) {
                    _this.cascadeRemainingSymbols();
                }
            });
        };
        ReelView.prototype.slideIn = function (callback) {
            this.y = (this.symbolHeight * -(this.children.length) + 30);
            this.cascadeRemainingSymbols(callback);
        };
        ReelView.prototype.cascadeRemainingSymbols = function (callback) {
            var _this = this;
            var i = this.children.length;
            var prevLen = this.symbolsForCurrentSpin.length;
            var baseMultiplier = prevLen + 2;
            var baseY = (this._isDesktop ? game.BaseGameUIConstants.kDesktopSymbolBaseY : game.BaseGameUIConstants.kMobileSymbolBaseY) + (this.symbolHeight * baseMultiplier);
            var offset = 0;
            var tweenCount = 0;
            for (var count = 0; count < this.children.length; count++) {
                i--;
                offset = Math.random() * game.BaseGameUIConstants.kReelFallDelayOffsetFudge;
                var symbolMultiplier = Math.max(count - this.cascadeRemainingSymbolsRemoved - 1, count);
                var targetY = (baseY - (this.symbolHeight * symbolMultiplier));
                var symbol = this.children[i];
                new TweenLite(symbol, game.BaseGameUIConstants.kReelFallDuration / 3, {
                    ease: Linear.easeNone,
                    delay: (this.id * 0.05) + (0.05 * count),
                    y: targetY,
                    onComplete: function () {
                        if (tweenCount === _this.children.length - 1) {
                            _this.reelsView.onReelCascaded(_this.id, true);
                        }
                        tweenCount++;
                    }
                });
            }
            this.cascadeCount++;
            if (callback) {
                TweenLite.delayedCall(game.BaseGameUIConstants.kReelFallDuration, callback, [this.id], this);
            }
        };
        ReelView.prototype.changePosition = function (position) {
            this.additionalSymbolsInReel = 0;
            this.setPosition();
            this.populate(position);
        };
        ReelView.prototype.highlightSymbolAtIndex = function (index) {
            var cascadeOffset = this.children.length - 3;
            var symbol = this.children[index + cascadeOffset];
            if (symbol instanceof rendering.CustomMovieClip) {
                var mc = symbol;
                mc.gotoAndStop(0);
                if (mc.id === game.BaseGameUIConstants.kReelSymbols[5]) {
                    mc.playRange(0, mc.totalFrames, function () {
                        mc.gotoAndStop(21);
                    });
                }
                else if (mc.id === game.BaseGameUIConstants.kReelSymbols[13]) {
                    mc.playRange(0, mc.totalFrames, function () {
                        mc.gotoAndStop(7);
                    });
                }
            }
        };
        __decorate([
            inject('BigWinView')
        ], ReelView.prototype, "_bigWinView", void 0);
        return ReelView;
    }(rendering.DisplayObjectContainer));
    game.ReelView = ReelView;
})(game || (game = {}));
var game;
(function (game) {
    var ReelsView = (function (_super) {
        __extends(ReelsView, _super);
        function ReelsView() {
            _super.call(this);
            this.reelViews = [];
            this._numberOfReelsCascaded = 0;
            this._symbolsFallenReelCount = 0;
            this._crystals = [];
        }
        ReelsView.prototype.construct = function () {
            this._isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            this._scalar = this._device.getScalar();
            this.addReelsContainer();
            this.addReels();
            this.addCrystals();
            this.addMask();
        };
        ReelsView.prototype.addReelsContainer = function () {
            this._reelsContainer = new rendering.DisplayObjectContainer();
            if (this._isDesktop) {
                this._reelsContainer.x = game.BaseGameUIConstants.kDesktopReelsetFrameX;
                this._reelsContainer.y = game.BaseGameUIConstants.kDesktopReelsetFrameY;
            }
            else {
                this._reelsContainer.x = game.BaseGameUIConstants.kMobileReelsetFrameX + game.BaseGameUIConstants.kMobileReelsContainerOffsetToReelFrameX;
                this._reelsContainer.y = game.BaseGameUIConstants.kMobileReelsetFrameY + game.BaseGameUIConstants.kMobileReelsContainerOffsetToReelFrameY;
            }
            this.addChild(this._reelsContainer);
        };
        ReelsView.prototype.addReels = function () {
            for (var i = 0; i < 5; i++) {
                var reelView = new game.ReelView(this, i, this._isDesktop, this._cache);
                this._reelsContainer.addChild(reelView);
                this.reelViews.push(reelView);
            }
        };
        ReelsView.prototype.addCrystals = function () {
            for (var i = 0; i < 5; i++) {
                var crystalFrames = new components.SpriteSheet(this._cache.getAssetById(game.BaseGameBundle['CF_ReelCrystal' + i + 'Json'].name), this._cache.getAssetById(game.BaseGameBundle['CF_ReelCrystal' + i].name)).getFrames();
                this._crystals[i] = new rendering.CustomMovieClip(crystalFrames);
                this._crystals[i].scaleX = this._crystals[i].scaleY = 0.8;
                this._crystals[i].fps = 12;
                if (this._isDesktop) {
                    this._crystals[i].x = game.BaseGameUIConstants.kDesktopCrystalPosX[i];
                    this._crystals[i].y = game.BaseGameUIConstants.kDesktopCrystalPosY[i];
                }
                else {
                    this._crystals[i].x = game.BaseGameUIConstants.kMobileCrystalPosX[i];
                    this._crystals[i].y = game.BaseGameUIConstants.kMobileCrystalPosY[i];
                }
                this.addChild(this._crystals[i]);
            }
        };
        ReelsView.prototype.addMask = function () {
            var reelContainerMask = new rendering.Graphics();
            reelContainerMask.beginFill(0x00ff00, 0.4);
            if (this._isDesktop) {
                reelContainerMask.drawRect(410, 180, 1190, 580);
            }
            else {
                reelContainerMask.drawRect(300, 180, 1440, 710);
            }
            reelContainerMask.endFill();
            this.addChild(reelContainerMask);
            this._reelsContainer.mask = reelContainerMask;
        };
        ReelsView.prototype.setSymbols = function (strips) {
            this.reelViews.forEach(function (reelView, reelIndex) {
                reelView.setSymbols(strips[reelIndex].symbols);
            });
        };
        ReelsView.prototype.populateReels = function (stopIndexes) {
            this.reelViews.forEach(function (reelView, reelIndex) {
                reelView.populate(stopIndexes[reelIndex]);
            });
        };
        ReelsView.prototype.convertToBinary = function (number) {
            return Number(number).toString(2);
        };
        ReelsView.prototype.padZeroLeft = function (numberString) {
            while (numberString.length < 15) {
                numberString = "0" + numberString;
            }
            return numberString;
        };
        ReelsView.prototype.spin = function (stopIndexes, cascades) {
            var _this = this;
            this.reelViews.forEach(function (reelView, reelIndex) {
                reelView.spin(stopIndexes[reelIndex], function () { });
            });
            if (cascades.length > 0) {
                cascades.forEach(function (cascade) {
                    var paddedBinaryNumber = _this.padZeroLeft(_this.convertToBinary(cascade.cascadeMask));
                    _this.reelViews[0].addCascadePattern([paddedBinaryNumber[4], paddedBinaryNumber[9], paddedBinaryNumber[14]]);
                    _this.reelViews[1].addCascadePattern([paddedBinaryNumber[3], paddedBinaryNumber[8], paddedBinaryNumber[13]]);
                    _this.reelViews[2].addCascadePattern([paddedBinaryNumber[2], paddedBinaryNumber[7], paddedBinaryNumber[12]]);
                    _this.reelViews[3].addCascadePattern([paddedBinaryNumber[1], paddedBinaryNumber[6], paddedBinaryNumber[11]]);
                    _this.reelViews[4].addCascadePattern([paddedBinaryNumber[0], paddedBinaryNumber[5], paddedBinaryNumber[10]]);
                });
            }
        };
        ReelsView.prototype.prepareCascadeInformation = function (dispatchEvent) {
            if (dispatchEvent === void 0) { dispatchEvent = true; }
            this.reelViews.forEach(function (reelView) {
                reelView.prepareCascadeInformation(dispatchEvent);
            });
        };
        ReelsView.prototype.cascade = function () {
            this.reelViews.forEach(function (reelView) {
                reelView.cascade();
            });
            this._infoMeter.text = "";
            this._fsControlPanel.updateInfoMeter("");
        };
        ReelsView.prototype.onReelCascaded = function (reelIndex, playReelDropSound) {
            if (playReelDropSound === void 0) { playReelDropSound = false; }
            this._numberOfReelsCascaded++;
            if (playReelDropSound) {
                this.dispatchEvent(new game.GameEvent(game.GameEvent["REEL_CASCADED"], this, reelIndex));
            }
            if (this._numberOfReelsCascaded === this.reelViews.length) {
                this._numberOfReelsCascaded = 0;
                this.dispatchEvent(new game.GameEvent(game.GameEvent.REELS_STOPPED, this));
            }
        };
        ReelsView.prototype.changeReelPositions = function (positions) {
            this.reelViews.forEach(function (reelView, reelIndex) {
                reelView.changePosition(positions[reelIndex]);
            });
        };
        ReelsView.prototype.makeSymbolsFall = function () {
            this.reelViews.forEach(function (reelView) {
                reelView.fall();
            });
        };
        ReelsView.prototype.onSymbolsFallen = function () {
            this._symbolsFallenReelCount++;
            if (this._symbolsFallenReelCount === this.reelViews.length) {
                this._symbolsFallenReelCount = 0;
                this.dispatchEvent(new game.GameEvent(game.GameEvent.ALL_SYMBOLS_FALLEN, this));
            }
        };
        ReelsView.prototype.getSymbolForXY = function (x, y) {
            return this.reelViews[x].getSymbolForIndex(y);
        };
        ReelsView.prototype.onDisplayPayline = function (cycleResult) {
            for (var i = 0; i < cycleResult.layout.length; i++) {
                this.reelViews[i].highlightSymbolAtIndex(cycleResult.layout[i]);
            }
        };
        ReelsView.prototype.highlightCrystalAtIndex = function (index) {
            this._crystals[index].playRange(0);
        };
        __decorate([
            inject('LayerManager')
        ], ReelsView.prototype, "_layerMgr", void 0);
        __decorate([
            inject('AssetCache')
        ], ReelsView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], ReelsView.prototype, "_device", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], ReelsView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], ReelsView.prototype, "_launchParams", void 0);
        __decorate([
            inject('InfoBarMeterView')
        ], ReelsView.prototype, "_infoMeter", void 0);
        __decorate([
            inject('FreeSpinsGameControlPanelView')
        ], ReelsView.prototype, "_fsControlPanel", void 0);
        return ReelsView;
    }(rendering.DisplayObjectContainer));
    game.ReelsView = ReelsView;
})(game || (game = {}));
var game;
(function (game) {
    var ReelsetMediator = (function (_super) {
        __extends(ReelsetMediator, _super);
        function ReelsetMediator() {
            _super.apply(this, arguments);
            this._currentReelsetIndex = 0;
            this._currentPayline = -1;
            this._canSlideInSymbolsChecksPassed = 0;
        }
        ReelsetMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            var initResponse = this._server.getInitResponse();
            Utils.PSLog.log("ReelView added");
            this.addContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.addContextListener(game.GameEvent.FREE_SPIN_VALID, this.onSpinButtonPressed);
            // Recovery spins and autoplay do not require the user to press the spin button which would normally drop the symbols
            this.addContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.addContextListener(game.GameEvent.RECOVERY_SPIN, this.onRecoverySpin);
            this.addContextListener(game.GameEvent.PLAY_REPLAY_SPIN, this.onPlayReplaySpin);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "cascading"), this.cascadeReels);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "cascading"), this.cascadeReels);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "showingWins"), this.onHasWins);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "showingWins"), this.onHasWins);
            this.addContextListener(server.ServerResponseEvent.LOGIC_RESPONSE, this.onLogicResponse);
            // this.addContextListener(GameEvent.INSUFFICIENT_FUNDS, this.insufficientFunds);
            this.addContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this.addContextListener(game.GameEvent.ANIMATE_REMOVE_SYMBOLS, this.animateRemoveSymbols);
            this.addContextListener(game.GameEvent.REEL_CASCADED, this.onReelCascaded);
            this.addContextListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onPlayFreeSpinsButtonPressed);
            this.addContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame);
            this.addContextListener(game.GameEvent.HAS_MAX_WIN, this.onHasMaxWin);
            this.addContextListener(game.ForceModelEvent.FORCE_MODEL_CHANGED, this.onForceModelChanged);
            this.addContextListener(game.CyclersModelEvent.PAYLINES_CYCLER_STARTED, this.onPaylineCyclerStarted);
            this.addContextListener(game.CyclersModelEvent.PAYLINES_DISPLAY, this.onPaylinesDisplay);
            this.view.addEventListener(game.GameEvent.ANIMATE_REMOVE_SYMBOLS, this.doGlobalDispatch, this);
            this.view.addEventListener(game.GameEvent.REELS_STOPPED, this.onReelsStopped, this);
            this.view.addEventListener(game.GameEvent.REEL_CASCADED, this.doGlobalDispatch, this);
            this.view.addEventListener(game.GameEvent.HIGHLIGHT_FIVE_OF_A_KIND, this.doGlobalDispatch, this);
            this.view.addEventListener(game.GameEvent.ALL_SYMBOLS_FALLEN, this.onAllSymbolsFallen, this);
            this._baseGameReelset = initResponse.reelsData.reels[0].getAllStrips();
            this._freeSpinGameReelset = initResponse.reelsData.reels[1].getAllStrips();
            // Set reelset symbols - by default we will use the base game reelset (reelsetIndex = 0)
            this.changeReelset(this._currentReelsetIndex);
        };
        ReelsetMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "cascading"), this.cascadeReels);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "cascading"), this.cascadeReels);
            this.removeContextListener(server.ServerResponseEvent.LOGIC_RESPONSE, this.onLogicResponse);
            // this.removeContextListener(GameEvent.INSUFFICIENT_FUNDS, this.insufficientFunds);
            this.removeContextListener(game.GameEvent.REEL_CASCADED, this.onReelCascaded);
            this.removeContextListener(game.GameEvent.PLAY_FREE_SPINS_BUTTON_PRESSED, this.onPlayFreeSpinsButtonPressed);
            this.removeContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame);
            this.removeContextListener(game.ForceModelEvent.FORCE_MODEL_CHANGED, this.onForceModelChanged);
            this.removeContextListener(game.GameEvent.ANIMATE_REMOVE_SYMBOLS, this.animateRemoveSymbols);
            this.removeContextListener(game.CyclersModelEvent.PAYLINES_CYCLER_STARTED, this.onPaylineCyclerStarted);
            this.removeContextListener(game.CyclersModelEvent.PAYLINES_DISPLAY, this.onPaylinesDisplay);
            this.view.removeEventListener(game.GameEvent.ANIMATE_REMOVE_SYMBOLS, this.doGlobalDispatch, this);
            this.view.removeEventListener(game.GameEvent.REELS_STOPPED, this.onReelsStopped, this);
            this.view.removeEventListener(game.GameEvent.REEL_CASCADED, this.doGlobalDispatch, this);
            this.view.removeEventListener(game.GameEvent.HIGHLIGHT_FIVE_OF_A_KIND, this.doGlobalDispatch, this);
        };
        ReelsetMediator.prototype.doGlobalDispatch = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        ReelsetMediator.prototype.onSpinButtonPressed = function () {
            this.reelSpinStarted();
            this.view.makeSymbolsFall();
        };
        ReelsetMediator.prototype.onAllSymbolsFallen = function () {
            this._canSlideInSymbolsChecksPassed++;
            this.checkIfWeCanShowSymbols();
        };
        ReelsetMediator.prototype.onPlayReplaySpin = function () {
            this.reelSpinStarted();
            this.view.makeSymbolsFall();
        };
        ReelsetMediator.prototype.onRecoverySpin = function () {
            var _this = this;
            var logicResponse = this._server.getLogicResponse();
            // If we are recovering into a FG, change to FG reelset
            if (logicResponse.fsSpinNumber > 0) {
                this.changeReelset(1);
            }
            this.reelSpinStarted();
            TweenMax.delayedCall(0.5, function () {
                _this.view.makeSymbolsFall();
            });
        };
        ReelsetMediator.prototype.reelSpinStarted = function () {
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.REEL_SPIN_STARTED));
        };
        ReelsetMediator.prototype.onNextAutoplay = function () {
            this.reelSpinStarted();
            this.view.makeSymbolsFall();
        };
        ReelsetMediator.prototype.onLogicResponse = function (event) {
            this._canSlideInSymbolsChecksPassed++;
            this.checkIfWeCanShowSymbols();
        };
        ReelsetMediator.prototype.checkIfWeCanShowSymbols = function () {
            if (this._canSlideInSymbolsChecksPassed === 2) {
                // This means that all symbols have fallen AND we have received a logic response
                // We now slide in the symbols
                var logicResponse = this._server.getLogicResponse();
                this.view.spin(logicResponse.reelSpinData[0].reelStops, logicResponse.cascades);
                this._canSlideInSymbolsChecksPassed = 0;
            }
        };
        ReelsetMediator.prototype.onForceModelChanged = function () {
            // Let the player alter the reelset only if we are in a base game idle state
            if (this._stateModel.currentSubgame === "BaseGame" && this._stateModel.currentSubgameState === "idle") {
                this.view.changeReelPositions(this._forceModel.positions);
            }
        };
        ReelsetMediator.prototype.cascadeReels = function () {
            this.view.cascade();
        };
        ReelsetMediator.prototype.onReelsStopped = function () {
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.REELS_STOPPED));
        };
        ReelsetMediator.prototype.onHasWins = function () {
            this.view.prepareCascadeInformation();
        };
        ReelsetMediator.prototype.onHasMaxWin = function () {
            this.view.prepareCascadeInformation(false);
        };
        /**
         * In the scenario of insufficientFunds, stop the reels spinning and make sure they're on a non-winning scenario
         */
        ReelsetMediator.prototype.onInsufficientFunds = function () {
            //this.resetReelset();
        };
        ReelsetMediator.prototype.onHardReset = function () {
            this.resetReelset();
        };
        ReelsetMediator.prototype.resetReelset = function () {
            this._canSlideInSymbolsChecksPassed = 0;
            this.changeReelset(0);
        };
        ReelsetMediator.prototype.onPlayFreeSpinsButtonPressed = function () {
            this.changeReelset(1);
        };
        ReelsetMediator.prototype.onReturnToBaseGame = function () {
            this.changeReelset(0);
        };
        ReelsetMediator.prototype.changeReelset = function (reelsetIndex) {
            this.view.setSymbols(reelsetIndex === 0 ? this._baseGameReelset : this._freeSpinGameReelset);
            this.view.populateReels(game.BaseGameUIConstants.kDefaultReelStops);
            this._currentReelsetIndex = reelsetIndex;
        };
        ReelsetMediator.prototype.animateRemoveSymbols = function (event) {
            var animDataArray = event.id;
            for (var i = 0; i < animDataArray.length; i++) {
                var animData = animDataArray[i];
                this.removeSymbolFromReelView(this.view.reelViews[animData.reelViewIndex], animData.symbol);
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.REMOVE_SYMBOL, this, animData));
            }
        };
        ReelsetMediator.prototype.onReelCascaded = function (event) {
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent[("REEL_" + (event.id + 1) + "_CASCADED")], this));
        };
        ReelsetMediator.prototype.removeSymbolFromReelView = function (reelView, symbol) {
            reelView.removeSymbol(symbol);
            this.view.highlightCrystalAtIndex(reelView.id);
        };
        ReelsetMediator.prototype.onPaylineCyclerStarted = function (e) {
            this._currentPayline = -1;
        };
        ReelsetMediator.prototype.onPaylinesDisplay = function (e) {
            if (this._currentPayline !== e.result.payline) {
                this._currentPayline = e.result.payline;
                this.view.onDisplayPayline(e.result);
            }
        };
        __decorate([
            inject('GameServer')
        ], ReelsetMediator.prototype, "_server", void 0);
        __decorate([
            inject('GameStateModel')
        ], ReelsetMediator.prototype, "_stateModel", void 0);
        __decorate([
            inject('ForceModel')
        ], ReelsetMediator.prototype, "_forceModel", void 0);
        __decorate([
            inject('CyclersModel')
        ], ReelsetMediator.prototype, "_cyclersModel", void 0);
        return ReelsetMediator;
    }(dragonwings.Mediator));
    game.ReelsetMediator = ReelsetMediator;
})(game || (game = {}));
var game;
(function (game) {
    var ReplayView = (function (_super) {
        __extends(ReplayView, _super);
        function ReplayView() {
            _super.apply(this, arguments);
        }
        ReplayView.prototype.construct = function (isDesktop) {
            // Use isDesktop to determine x,y for the 2 texts
            // Add the line 1 Text
            this._line1Text = this.getReplayText();
            this._line1Text.x = 10;
            this._line1Text.y = 40;
            this.addChild(this._line1Text);
            // Add the line 2 Text
            this._line2Text = this.getReplayText();
            this._line2Text.x = 1500;
            this._line2Text.y = 40;
            this.addChild(this._line2Text);
        };
        ReplayView.prototype.getReplayText = function () {
            var lineText = new game.StyledText();
            lineText.textColour = "#ffff4a";
            lineText.maxWidth = 400;
            lineText.maxHeight = 120;
            lineText.fontSize = 120;
            lineText.textStyle = "plain";
            lineText.outerOutlineSize = 4;
            lineText.outerOutlineColour = "#000000";
            lineText.text = "** REPLAY **";
            lineText.construct();
            return lineText;
        };
        __decorate([
            inject('AssetCache')
        ], ReplayView.prototype, "_cache", void 0);
        return ReplayView;
    }(rendering.DisplayObjectContainer));
    game.ReplayView = ReplayView;
})(game || (game = {}));
var game;
(function (game) {
    var ReplayViewMediator = (function (_super) {
        __extends(ReplayViewMediator, _super);
        function ReplayViewMediator() {
            _super.apply(this, arguments);
        }
        ReplayViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            Utils.PSLog.log("ReplayViewMediator::onAdded()");
            this.view = this.getViewComponent();
            this.addContextListener(game.GameEvent.HISTORY_REPLAY_READY, this.onHistoryReady);
        };
        ReplayViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.HISTORY_REPLAY_READY, this.onHistoryReady);
        };
        ReplayViewMediator.prototype.onHistoryReady = function () {
            this.view.visible = true;
        };
        return ReplayViewMediator;
    }(dragonwings.Mediator));
    game.ReplayViewMediator = ReplayViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var BaseGameView = (function (_super) {
        __extends(BaseGameView, _super);
        function BaseGameView() {
            _super.call(this);
        }
        BaseGameView.prototype.construct = function () {
            var deviceClass = this._deviceClass.getDeviceClass();
            var isDesktop = (deviceClass == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            var bgAsset = this._cache.getAssetById(game.BaseGameBundle.CF_BaseBackground.name);
            this.setBackgroundBitmap(bgAsset);
            var logoAsset = this._cache.getAssetById(game.BaseGameBundle.CF_Logo.name);
            var logoBitmap = new rendering.Bitmap(logoAsset);
            this.addChild(logoBitmap);
        };
        __decorate([
            inject('IDeviceClassDetector')
        ], BaseGameView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], BaseGameView.prototype, "_launchParams", void 0);
        __decorate([
            inject('ITranslator')
        ], BaseGameView.prototype, "_translator", void 0);
        return BaseGameView;
    }(game.SubgameView));
    game.BaseGameView = BaseGameView;
})(game || (game = {}));
var game;
(function (game) {
    var BaseGameViewMediator = (function (_super) {
        __extends(BaseGameViewMediator, _super);
        function BaseGameViewMediator() {
            _super.apply(this, arguments);
        }
        BaseGameViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            Utils.PSLog.log("BaseGameViewMediator::onAdded()");
            this.view = this.getViewComponent();
            this.addContextListener(game.GameEvent.SHOW_BASE_VIEW, this.onShowBase);
            this.addContextListener(game.LayerViewEvent.TRANSITION_IN_STARTED, this.onTransitionInStarted);
        };
        BaseGameViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SHOW_BASE_VIEW, this.onShowBase);
            this.removeContextListener(game.LayerViewEvent.TRANSITION_IN_STARTED, this.onTransitionInStarted);
        };
        BaseGameViewMediator.prototype.onTransitionInStarted = function (event) {
            if (event.id === game.LayerViews.BASE) {
                this._layerMgr.setVisible([
                    new game.LayerVisibility(game.LayerViews.BASE, true),
                    new game.LayerVisibility(game.LayerViews.REELS, false),
                    new game.LayerVisibility(game.LayerViews.REELS_OVERLAY, false),
                    new game.LayerVisibility(game.LayerViews.FIVE_OF_A_KIND, false),
                    new game.LayerVisibility(game.LayerViews.FREE_SPINS_INTRO, false),
                    new game.LayerVisibility(game.LayerViews.FREE_SPINS, false),
                    new game.LayerVisibility(game.LayerViews.HELP, false)
                ]);
            }
        };
        BaseGameViewMediator.prototype.onShowBase = function () {
            this._layerMgr.transitionTo(game.LayerViews.BASE, 0.5);
        };
        __decorate([
            inject('DragonWingify')
        ], BaseGameViewMediator.prototype, "_dragonwingify", void 0);
        __decorate([
            inject('LayerManager')
        ], BaseGameViewMediator.prototype, "_layerMgr", void 0);
        return BaseGameViewMediator;
    }(dragonwings.Mediator));
    game.BaseGameViewMediator = BaseGameViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var BigMegaWinParticlesView = (function (_super) {
        __extends(BigMegaWinParticlesView, _super);
        function BigMegaWinParticlesView() {
            _super.call(this);
            this._particleTypes = [];
            this._stopped = true;
        }
        BigMegaWinParticlesView.prototype.construct = function (fps, particleLevel) {
            var _this = this;
            if (particleLevel === void 0) { particleLevel = 1; }
            this._particleLevel = particleLevel;
            this._particleLayer = new rendering.DisplayObjectContainer();
            this._proton = new Proton();
            var renderer = new proton.ProtonRenderer(this._proton, this._particleLayer, 0);
            renderer.start();
            // Get the particles and push them into an array
            this._particleTypes.push(this.getParticleFrames(game.BaseGameBundle.CF_Coins.name, game.BaseGameBundle.CF_CoinsJson.name));
            this._particleTypes.push(this.getParticleFrames(game.BaseGameBundle.CF_Diamonds.name, game.BaseGameBundle.CF_DiamondsJson.name));
            this._particleTypes.push(this.getParticleFrames(game.BaseGameBundle.CF_RedGems.name, game.BaseGameBundle.CF_RedGemsJson.name));
            this._particleTypes.push(this.getParticleFrames(game.BaseGameBundle.CF_GreenGems.name, game.BaseGameBundle.CF_GreenGemsJson.name));
            this._particleTypes.push(this.getParticleFrames(game.BaseGameBundle.CF_PurpleGems.name, game.BaseGameBundle.CF_PurpleGemsJson.name));
            // emitter positions
            var startLeftX = 0;
            var startCenterX = 1920 >> 1;
            var startRightX = 1920;
            var startY = 1080;
            // For each particle type, create three emitters (left, center and right) and add them to the proton object
            this._particleTypes.forEach(function (particleType) {
                _this._proton.addEmitter(_this.createEmitter(startLeftX, startY, 10, 30, particleType, true));
                _this._proton.addEmitter(_this.createEmitter(startCenterX, startY, -15, 15, particleType, true));
                _this._proton.addEmitter(_this.createEmitter(startRightX, startY, -10, -30, particleType, true));
            });
            //add the particle layer, that holds proton
            this.addChild(this._particleLayer);
            // Start loop
            new TimelineMax({
                repeat: -1,
                repeatDelay: 1 / fps,
                delay: 1 / fps,
                onRepeat: this.onEnterFrame,
                onRepeatScope: this
            });
        };
        BigMegaWinParticlesView.prototype.onEnterFrame = function () {
            if (this._proton && !this._stopped) {
                this._proton.update();
            }
        };
        BigMegaWinParticlesView.prototype.showBigWin = function (winType) {
            if (winType == "bigWin") {
                BigMegaWinParticlesView.isActive = true;
                this._particleLayer.visible = true;
                this._stopped = false;
                this._proton.emitters[1].emit();
            }
            else if (winType == "superWin") {
                this._proton.emitters[1].stopEmit();
                this._proton.emitters[4].emit();
            }
            else if (winType == "megaWin") {
                this._proton.emitters[4].stopEmit();
                this._proton.emitters[6].emit();
                this._proton.emitters[7].emit();
                this._proton.emitters[8].emit();
                this._proton.emitters[9].emit();
                this._proton.emitters[10].emit();
                this._proton.emitters[11].emit();
                this._proton.emitters[12].emit();
                this._proton.emitters[13].emit();
                this._proton.emitters[14].emit();
            }
        };
        BigMegaWinParticlesView.prototype.stopEmitters = function () {
            this._proton.emitters.forEach(function (emitter) {
                emitter.stopEmit();
            });
            // Give the particles time to fall away naturally
            TweenMax.delayedCall(5, this.disableParticlesView, [], this);
            BigMegaWinParticlesView.isActive = false;
        };
        BigMegaWinParticlesView.prototype.disableParticlesView = function () {
            this._stopped = true;
            this._particleLayer.visible = false;
        };
        BigMegaWinParticlesView.prototype.createEmitter = function (x, y, angleA, angleB, particles, isClip) {
            var particleWidth = 128;
            var particleHeight = 128;
            var particleVelocity = 12;
            var fps = 30;
            var imageTarget = new proton.ProtonImageTarget(particles, true, particleWidth, particleHeight, fps, !isClip);
            var emitter = new Proton.Emitter();
            var rate = 1;
            emitter.rate = new Proton.Rate(rate, .15 * this._particleLevel);
            emitter.addInitialize(new Proton.ImageTarget(imageTarget, particleWidth, particleHeight));
            emitter.addInitialize(new Proton.Position(new Proton.PointZone(x, y)));
            emitter.addInitialize(new Proton.Mass(1));
            emitter.addInitialize(new Proton.Position(new Proton.CircleZone(x, y, 10)));
            emitter.addInitialize(new Proton.Life(5, 7));
            emitter.addInitialize(new Proton.Velocity(new Proton.Span(particleVelocity, particleVelocity), new Proton.Span(angleA, angleB), 'polar'));
            emitter.addBehaviour(new Proton.Gravity(11));
            emitter.addBehaviour(new Proton.Alpha(1, 0, .5));
            return emitter;
        };
        BigMegaWinParticlesView.prototype.getParticleFrames = function (assetName, jsonAssetName) {
            var asset = this._cache.getAssetById(assetName);
            var jsonAsset = this._cache.getAssetById(jsonAssetName);
            var spriteSheet = new components.SpriteSheet(jsonAsset, asset);
            return spriteSheet.getFrames();
        };
        BigMegaWinParticlesView.isActive = false;
        __decorate([
            inject('AssetCache')
        ], BigMegaWinParticlesView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], BigMegaWinParticlesView.prototype, "_device", void 0);
        __decorate([
            inject('ITranslator')
        ], BigMegaWinParticlesView.prototype, "_translator", void 0);
        __decorate([
            inject('AutoPlayModel')
        ], BigMegaWinParticlesView.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('StakeModel')
        ], BigMegaWinParticlesView.prototype, "_stakeModel", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], BigMegaWinParticlesView.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], BigMegaWinParticlesView.prototype, "_partnerAdapter", void 0);
        return BigMegaWinParticlesView;
    }(rendering.DisplayObjectContainer));
    game.BigMegaWinParticlesView = BigMegaWinParticlesView;
})(game || (game = {}));
var game;
(function (game) {
    var BigWinParticlesViewMediator = (function (_super) {
        __extends(BigWinParticlesViewMediator, _super);
        function BigWinParticlesViewMediator() {
            _super.apply(this, arguments);
        }
        BigWinParticlesViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this._view = this.getViewComponent();
            this.addContextListener(game.GameEvent.PLAY_BIG_WIN_SOUND, this.showBigWin.bind(this, "bigWin"));
            this.addContextListener(game.GameEvent.SHOW_SUPER_WIN, this.showBigWin.bind(this, "superWin"));
            this.addContextListener(game.GameEvent.SHOW_MEGA_WIN, this.showBigWin.bind(this, "megaWin"));
            this.addContextListener(game.GameEvent.REMOVE_BIG_WIN_PARTICLES, this.onCancelBigWinDisplay);
        };
        BigWinParticlesViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.PLAY_BIG_WIN_SOUND, this.showBigWin.bind(this, "bigWin"));
            this.removeContextListener(game.GameEvent.SHOW_SUPER_WIN, this.showBigWin.bind(this, "superWin"));
            this.removeContextListener(game.GameEvent.SHOW_MEGA_WIN, this.showBigWin.bind(this, "megaWin"));
            this.removeContextListener(game.GameEvent.REMOVE_BIG_WIN_PARTICLES, this.onCancelBigWinDisplay);
        };
        BigWinParticlesViewMediator.prototype.showBigWin = function (bigWinType) {
            this._view.showBigWin(bigWinType);
        };
        BigWinParticlesViewMediator.prototype.onCancelBigWinDisplay = function () {
            this._view.stopEmitters();
        };
        return BigWinParticlesViewMediator;
    }(dragonwings.Mediator));
    game.BigWinParticlesViewMediator = BigWinParticlesViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var BigWinView = (function (_super) {
        __extends(BigWinView, _super);
        function BigWinView() {
            _super.call(this);
            this._winBarBitmaps = [];
        }
        BigWinView.prototype.construct = function () {
            var baselineWidthMidPoint = this._device.getBaselineWidth() / 2;
            var bigWinBar = Utils.MiscUtils.addBitmap(this, this._cache, game.BaseGameBundle, "CF_BigWin", "bigwin.png", baselineWidthMidPoint, 125, true, this._device.getScalar());
            var superWinBar = Utils.MiscUtils.addBitmap(this, this._cache, game.BaseGameBundle, "CF_BigWin", "bigwin_super.png", baselineWidthMidPoint, 160, true, this._device.getScalar());
            var megaWinBar = Utils.MiscUtils.addBitmap(this, this._cache, game.BaseGameBundle, "CF_BigWin", "bigwin_mega.png", baselineWidthMidPoint, 175, true, this._device.getScalar());
            var bigWinTranslation = this._translator.findByKey("framework_com_wms_framework_Anim_BigWin");
            var bigWinText = Utils.MiscUtils.createText(bigWinBar, bigWinTranslation, 100, rendering.TextAlign.CENTER, [600, 200], [bigWinBar.width * 0.5, bigWinBar.height * 0.5], "#40c3ea", "#ffffff", 10);
            Utils.MiscUtils.centreReg(bigWinText, this._device.getScalar());
            bigWinText.x = bigWinBar.width * 0.5;
            bigWinText.y = 180;
            // bigWinText.debug = true;
            var superWinTranslation = this._translator.findByKey("framework_com_wms_framework_Anim_SuperBigWin");
            var superWinText = Utils.MiscUtils.createText(superWinBar, superWinTranslation, 100, rendering.TextAlign.CENTER, [600, 200], [superWinBar.width * 0.65, superWinBar.height * 0.55], "#ffffff", "#0066ff", 10);
            Utils.MiscUtils.centreReg(superWinText, this._device.getScalar());
            superWinText.x = superWinBar.width * 0.5;
            superWinText.y = 220;
            // superWinText.debug = true;
            var megaWinTranslation = this._translator.findByKey("framework_com_wms_framework_Anim_MegaBigWin");
            var megaWinText = Utils.MiscUtils.createText(megaWinBar, megaWinTranslation, 100, rendering.TextAlign.CENTER, [600, 200], [megaWinBar.width * 0.6, megaWinBar.height * 0.55], "#ffffff", "#0066ff", 10);
            Utils.MiscUtils.centreReg(megaWinText, this._device.getScalar());
            megaWinText.x = megaWinBar.width * 0.5;
            megaWinText.y = 250;
            // megaWinText.debug = true;
            // Win amount text
            this._winAmountText = Utils.MiscUtils.createText(this, "", 90, rendering.TextAlign.CENTER, [300, 240], [superWinBar.width >> 1, superWinBar.height >> 1], "#ffffff", "#0066ff", 10);
            this.formatWinAmount(0);
            this._winAmountText.y = 115;
            this._winBarBitmaps.push(bigWinBar);
            this._winBarBitmaps.push(superWinBar);
            this._winBarBitmaps.push(megaWinBar);
            this.hideBigWins();
        };
        BigWinView.prototype.formatWinAmount = function (winAmount) {
            this._winAmountText.text = this._currencyFormatter.format(winAmount);
            Utils.MiscUtils.centreReg(this._winAmountText, this._device.getScalar());
            this._winAmountText.x = 960;
        };
        BigWinView.prototype.showBigWinType = function (index) {
            BigWinView.bigWinShowing = true;
            this._winBarBitmaps.forEach(function (winBarBitmap) {
                winBarBitmap.visible = false;
            });
            var scale = 1 + (index / 10); //@Luke - DE29945 pt5 "Each placard (big, super, mega) should be slightly bigger than the previous one"
            Utils.MiscUtils.animateToScale(this._winBarBitmaps[index], scale, scale);
            this._winBarBitmaps[index].visible = true;
            this.toggleWinAmountText(true);
        };
        BigWinView.prototype.hideBigWins = function () {
            BigWinView.bigWinShowing = false;
            this._winBarBitmaps.forEach(function (winBarBitmap) {
                TweenMax.killTweensOf(winBarBitmap);
                winBarBitmap.getNativeDisplayObject().scale.set(0, 0);
            });
            this.toggleWinAmountText(false);
        };
        BigWinView.prototype.toggleWinAmountText = function (visibility) {
            this._winAmountText.visible = visibility;
        };
        BigWinView.prototype.skipToBigWinBanner = function (bannerIndexToSkipTo) {
            this._winBarBitmaps.forEach(function (winBarBitmap) {
                winBarBitmap.visible = false;
            });
            this._winBarBitmaps[bannerIndexToSkipTo].visible = true;
            Utils.MiscUtils.animateToScale(this._winBarBitmaps[bannerIndexToSkipTo], 1, 1, 0.1);
        };
        BigWinView.bigWinShowing = false;
        __decorate([
            inject('AssetCache')
        ], BigWinView.prototype, "_cache", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], BigWinView.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('DeviceContext')
        ], BigWinView.prototype, "_device", void 0);
        __decorate([
            inject('ITranslator')
        ], BigWinView.prototype, "_translator", void 0);
        return BigWinView;
    }(rendering.DisplayObjectContainer));
    game.BigWinView = BigWinView;
})(game || (game = {}));
var game;
(function (game) {
    var BigWinViewMediator = (function (_super) {
        __extends(BigWinViewMediator, _super);
        function BigWinViewMediator() {
            _super.apply(this, arguments);
        }
        //protected _bigWinSkipped: boolean = false;
        BigWinViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(game.GameEvent.SHOW_BIG_WIN, this.onShowBigWin);
            this.addContextListener(game.GameEvent.SHOW_SUPER_WIN, this.onShowSuperWin);
            this.addContextListener(game.GameEvent.SHOW_MEGA_WIN, this.onShowMegaWin);
            this.addContextListener(game.GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY, this.onCancelBigWinDisplay);
            this.addContextListener(game.GameEvent.BIG_WIN_SKIPPED, this.onBigWinSkipped);
            this.addContextListener(game.WinModelEvent.WIN_MODEL_CHANGED, this.onWinModelChanged);
        };
        BigWinViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SHOW_BIG_WIN, this.onShowBigWin);
            this.removeContextListener(game.GameEvent.SHOW_SUPER_WIN, this.onShowSuperWin);
            this.removeContextListener(game.GameEvent.SHOW_MEGA_WIN, this.onShowMegaWin);
            this.removeContextListener(game.GameEvent.CANCEL_BIGMEGA_WIN_DISPLAY, this.onCancelBigWinDisplay);
            this.removeContextListener(game.GameEvent.BIG_WIN_SKIPPED, this.onBigWinSkipped);
            this.removeContextListener(game.WinModelEvent.WIN_MODEL_CHANGED, this.onWinModelChanged);
        };
        BigWinViewMediator.prototype.onShowBigWin = function () {
            this.view.showBigWinType(0);
        };
        BigWinViewMediator.prototype.onShowSuperWin = function () {
            this.view.showBigWinType(1);
        };
        BigWinViewMediator.prototype.onShowMegaWin = function () {
            this.view.showBigWinType(2);
        };
        BigWinViewMediator.prototype.onCancelBigWinDisplay = function () {
            this.view.hideBigWins();
        };
        BigWinViewMediator.prototype.onBigWinSkipped = function (event) {
            this.view.skipToBigWinBanner(event.id - 1);
        };
        BigWinViewMediator.prototype.onWinModelChanged = function () {
            this.view.formatWinAmount(this._winInfoModel.runningTotalWinnings);
        };
        __decorate([
            inject('WinInfoModel')
        ], BigWinViewMediator.prototype, "_winInfoModel", void 0);
        return BigWinViewMediator;
    }(dragonwings.Mediator));
    game.BigWinViewMediator = BigWinViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var WinAmountTextView = (function (_super) {
        __extends(WinAmountTextView, _super);
        function WinAmountTextView() {
            _super.call(this, "");
        }
        WinAmountTextView.prototype.setPosition = function (x, y) {
            this.x = x;
            this.y = y;
        };
        WinAmountTextView.prototype.setFont = function (fontFamily, fontSize) {
            this.font = fontFamily;
            this.fontSize = fontSize;
        };
        WinAmountTextView.prototype.setColour = function (colour) {
            this.colour = colour;
        };
        return WinAmountTextView;
    }(rendering.Text));
    game.WinAmountTextView = WinAmountTextView;
})(game || (game = {}));
var game;
(function (game) {
    var ClockMediator = (function (_super) {
        __extends(ClockMediator, _super);
        function ClockMediator() {
            _super.apply(this, arguments);
        }
        ClockMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.onTick();
            new TweenMax(this, 1, { repeat: -1, onRepeat: this.onTick, onRepeatScope: this });
        };
        ClockMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            TweenMax.killTweensOf(this);
        };
        ClockMediator.prototype.onTick = function () {
            this.view.text = this.getTimeFormattedasHHMM(new Date());
        };
        ClockMediator.prototype.getTimeFormattedasHHMM = function (date) {
            return this.getFormattedHours(date) + ":" + this.getFormattedMinutes(date);
        };
        ClockMediator.prototype.getFormattedMinutes = function (date) {
            return this.formatToLeadingZero(date.getMinutes());
        };
        ClockMediator.prototype.getFormattedHours = function (date) {
            return this.formatToLeadingZero(date.getHours());
        };
        ClockMediator.prototype.formatToLeadingZero = function (num) {
            return (num < 10 ? "0" : "") + num;
        };
        return ClockMediator;
    }(dragonwings.Mediator));
    game.ClockMediator = ClockMediator;
})(game || (game = {}));
var game;
(function (game) {
    var ClockView = (function (_super) {
        __extends(ClockView, _super);
        function ClockView() {
            _super.call(this, "");
        }
        ClockView.prototype.construct = function (isDesktop) {
            this.colour = game.BaseGameUIConstants.kClockTextColour;
            this.font = game.BaseGameUIConstants.kFontFamily;
            this.fontSize = game.BaseGameUIConstants.kClockTextFontSize;
            if (isDesktop) {
                this.x = game.BaseGameUIConstants.kDesktopClockX;
                this.y = game.BaseGameUIConstants.kDesktopClockY;
            }
            else {
                this.x = game.BaseGameUIConstants.kMobileClockX;
                this.y = game.BaseGameUIConstants.kMobileClockY;
            }
        };
        return ClockView;
    }(rendering.Text));
    game.ClockView = ClockView;
})(game || (game = {}));
var game;
(function (game) {
    var DebugOverlayMediator = (function (_super) {
        __extends(DebugOverlayMediator, _super);
        function DebugOverlayMediator() {
            _super.apply(this, arguments);
        }
        DebugOverlayMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            Utils.PSLog.log("DebugOverlayMediator::onAdded()");
            this.view = this.getViewComponent();
            this.addContextListener(game.GameStateEvent.ExitSubgame(game.Subgame.PRE_GAME), this.onExitIntro);
        };
        DebugOverlayMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.ExitSubgame(game.Subgame.PRE_GAME), this.onExitIntro);
        };
        DebugOverlayMediator.prototype.onExitIntro = function () {
            this.view.visible = true;
        };
        __decorate([
            inject('LayerManager')
        ], DebugOverlayMediator.prototype, "_layerMgr", void 0);
        return DebugOverlayMediator;
    }(dragonwings.Mediator));
    game.DebugOverlayMediator = DebugOverlayMediator;
})(game || (game = {}));
var game;
(function (game) {
    var DebugOverlayView = (function (_super) {
        __extends(DebugOverlayView, _super);
        function DebugOverlayView() {
            _super.apply(this, arguments);
        }
        DebugOverlayView.prototype.construct = function () {
            var isDesktop = this._deviceDetector.getDeviceClass() == util.DeviceClass.DESKTOP && !this._launchParams.mobilePresentation;
            var data = this._cache.getAssetById(game.BaseGameBundle.PackageJson.name).data;
            console.log("-----VERSION: " + data.version);
            console.log("-----WIDTH: " + this._device.getScaledScreenWidth());
            console.log("-----HEIGHT: " + this._device.getScaledScreenHeight());
            var deviceStr = "";
            deviceStr += isDesktop ? "Desk" : "Mob";
            deviceStr += this._deviceDetector.getDeviceClass() == util.DeviceClass.HIGH_PERFORMANCE_PHONE ? " High" : "";
            deviceStr += this._deviceDetector.getDeviceClass() == util.DeviceClass.MEDIUM_PERFORMANCE_PHONE ? " Med" : "";
            deviceStr += this._deviceDetector.getDeviceClass() == util.DeviceClass.LOW_PERFORMANCE_PHONE ? " Low" : "";
            var text = new rendering.Text("V " + data.version);
            text.colour = "#ffffff";
            text.outlineColour = "#000000";
            text.font = "Myriad Pro Black";
            text.outlineSize = 8;
            text.fontSize = 35;
            text.y = 5;
            this.addChild(text);
            deviceStr += " " + this._device.getScaledScreenWidth() + " x " + this._device.getScaledScreenHeight();
            var text = new rendering.Text(deviceStr);
            text.colour = "#ffffff";
            text.outlineColour = "#000000";
            text.font = "Myriad Pro Black";
            text.outlineSize = 8;
            text.fontSize = 35;
            text.y = 5;
            text.x = 1920 - text.width;
            this.addChild(text);
            var debugButton = new game.UIDebugButton(isDesktop);
            debugButton.x = 0;
            debugButton.y = 400;
            this._dragonwingify.makeEventsGlobal(debugButton);
            this.addChild(debugButton);
            // Initialise the LayerTool and add to the view
            this._layerTool.init(this._layerMgr);
            this._layerTool.x = debugButton.x;
            this._layerTool.y = debugButton.y + 90;
            this._layerTool.visible = false;
            this.addChild(this._layerTool);
            // Ensure we don't get multiple events per "human" click
            rendering.InputManager.registerObject(debugButton);
            if (!isDesktop) {
                debugButton.scaleX = 0.65;
                debugButton.scaleY = 0.65;
            }
        };
        __decorate([
            inject('AssetCache')
        ], DebugOverlayView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], DebugOverlayView.prototype, "_device", void 0);
        __decorate([
            inject('IDeviceClassDetector')
        ], DebugOverlayView.prototype, "_deviceDetector", void 0);
        __decorate([
            inject('DragonWingify')
        ], DebugOverlayView.prototype, "_dragonwingify", void 0);
        __decorate([
            inject('LayerTool')
        ], DebugOverlayView.prototype, "_layerTool", void 0);
        __decorate([
            inject('LayerManager')
        ], DebugOverlayView.prototype, "_layerMgr", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], DebugOverlayView.prototype, "_launchParams", void 0);
        return DebugOverlayView;
    }(rendering.DisplayObjectContainer));
    game.DebugOverlayView = DebugOverlayView;
})(game || (game = {}));
var game;
(function (game) {
    var DemoView = (function (_super) {
        __extends(DemoView, _super);
        function DemoView() {
            _super.call(this);
            this._demoTool = new components.DemoTool(250, 200, 1000, 700);
        }
        DemoView.prototype.construct = function (isDesktop) {
            // Add demo button
            this._demoButton = new components.DemoButton();
            this.addChild(this._demoButton);
            // Add pause button
            this._pauseButton = new components.PauseButton();
            this.addChild(this._pauseButton);
            //Set up the demotool and button if required
            if (this._metaData.isDemoEnabled()) {
                this._demoButton.x = 0; //this._demoButton.width + 150;
                this._demoButton.y = 200;
                this._demoTool.addDataItems(this.createDemoDataItems());
                this._demoTool.visible = false;
                //this._demoTool.scaleX = this._demoTool.scaleY = .9;
                this._demoButton.setTools([this._demoTool]);
                this.addChild(this._demoTool);
                this._pauseButton.x = this._demoButton.x;
                this._pauseButton.y = this._demoButton.y + 100;
            }
            else {
                this._demoButton.visible = false;
                this._pauseButton.visible = false;
            }
            if (!isDesktop) {
                this._demoButton.scaleX = this._demoButton.scaleY = 0.65;
                this._pauseButton.scaleX = this._pauseButton.scaleY = 0.65;
            }
            return this;
        };
        Object.defineProperty(DemoView.prototype, "demoButton", {
            get: function () { return this._demoButton; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DemoView.prototype, "demoTool", {
            get: function () { return this._demoTool; },
            enumerable: true,
            configurable: true
        });
        /**
         * Create the array of settings for the different demo buttons
         */
        DemoView.prototype.createDemoDataItems = function () {
            var items = [
                new game.RRDemoData("No Win", [1, 1, 1, 1, 1], 0),
                new game.RRDemoData("Big Win", [4, 42, 89, 41, 10], 0),
                new game.RRDemoData("Super Win", [6, 16, 15, 15, 14], 0),
                new game.RRDemoData("Mega Win", [0, 14, 14, 14, 14], 0),
                new game.RRDemoData("Jackpot Wild", [4, 16, 67, 15, 22], 0),
                new game.RRDemoData("Jackpot 5oAK 0", [5, 43, 90, 42, 23], 0),
                new game.RRDemoData("Jackpot 5oAK 1", [4, 42, 89, 41, 22], 0),
                new game.RRDemoData("Jackpot 5oAK 2", [3, 41, 88, 40, 21], 0),
                new game.RRDemoData("Cascade x 1", [13, 2, 1, 19, 16], 0),
                new game.RRDemoData("Cascade x 2", [14, 3, 7, 1, 1], 0),
                new game.RRDemoData("Cascade x 3", [9, 14, 20, 1, 1], 0),
                new game.RRDemoData("Cascade x 4", [14, 17, 0, 57, 1], 0),
                new game.RRDemoData("Cascade x 5", [0, 12, 3, 0, 0], 0),
                new game.RRDemoData("Cascade x 6", [0, 18, 24, 0, 0], 0),
                new game.RRDemoData("Cascade x 7", [0, 18, 70, 0, 0], 0),
                new game.RRDemoData("Cascade x 8", [1, 18, 25, 0, 0], 0),
                new game.RRDemoData("FG only - 50 Extra Spins", [0, 19, 27, 0, 0], 0),
                new game.RRDemoData("FG only - 25 Extra Spins", [0, 21, 40, 0, 0], 0),
                new game.RRDemoData("FG only - 15 Extra Spins", [0, 21, 64, 0, 0], 0),
                new game.RRDemoData("FG only - 10 Extra Spins", [0, 21, 65, 0, 0], 0),
                new game.RRDemoData("FG only - Jackpot 5oAK", [4, 45, 70, 36, 10], 0),
                new game.RRDemoData("FG only - Flower 5oAK", [12, 2, 24, 9, 4], 0)
            ];
            return items;
        };
        DemoView.prototype.showDemoButton = function () {
            this._demoButton.visible = true;
        };
        DemoView.prototype.hideDemoButton = function () {
            this._demoButton.visible = false;
        };
        __decorate([
            inject('MetaData')
        ], DemoView.prototype, "_metaData", void 0);
        return DemoView;
    }(rendering.DisplayObjectContainer));
    game.DemoView = DemoView;
})(game || (game = {}));
var game;
(function (game) {
    var DemoViewMediator = (function (_super) {
        __extends(DemoViewMediator, _super);
        function DemoViewMediator() {
            _super.apply(this, arguments);
        }
        DemoViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.view.demoTool.addEventListener(components.DemoToolEvent.SET_DATA, this.onSetData, this);
            this.view.demoButton.addEventListener(components.DemoButtonEvent.DEMO_OPENED, this.openedDemo, this);
            this.addContextListener(game.GameStateEvent.ExitSubgame(game.Subgame.PRE_GAME), this.onExitIntro);
        };
        DemoViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.view.demoTool.removeEventListener(components.DemoToolEvent.SET_DATA, this.onSetData, this);
            this.view.demoButton.removeEventListener(components.DemoButtonEvent.DEMO_OPENED, this.openedDemo, this);
            this.removeContextListener(game.GameStateEvent.ExitSubgame(game.Subgame.PRE_GAME), this.onExitIntro);
        };
        DemoViewMediator.prototype.onSetData = function (e) {
            Utils.PSLog.log("onSetData");
            if (e.data) {
                this._forceModel.setEnabled(true);
                this._forceModel.setPositions(e.data.positions, true);
                this.dispatchContextEvent(new game.GameEvent(game.GameEvent.DEMO_DATA_SET));
            }
            this.dispatchContextEvent(new game.GameEvent(game.GameEvent.DEMO_VIEW_CLOSED));
        };
        DemoViewMediator.prototype.openedDemo = function (e) {
            this.dispatchContextEvent(new game.GameEvent(game.GameEvent.DEMO_VIEW_OPENED));
        };
        DemoViewMediator.prototype.show = function () {
            this.view.visible = true;
        };
        DemoViewMediator.prototype.hide = function () {
            this.view.visible = false;
        };
        DemoViewMediator.prototype.onExitIntro = function () {
            this.show();
        };
        __decorate([
            inject('ForceModel')
        ], DemoViewMediator.prototype, "_forceModel", void 0);
        return DemoViewMediator;
    }(dragonwings.Mediator));
    game.DemoViewMediator = DemoViewMediator;
})(game || (game = {}));
///<reference path="../BaseClasses/CustomMovieClip.ts" />
var game;
(function (game) {
    var FreeSpinsUIClip = (function (_super) {
        __extends(FreeSpinsUIClip, _super);
        function FreeSpinsUIClip(frames, awardLevelFrame) {
            _super.call(this, frames);
            this.awardLevelFrame = awardLevelFrame;
            if (awardLevelFrame) {
            }
        }
        FreeSpinsUIClip.prototype.enable = function () {
            this.gotoAndStop(3);
        };
        FreeSpinsUIClip.prototype.disable = function () {
            this.gotoAndStop(0);
        };
        return FreeSpinsUIClip;
    }(rendering.CustomMovieClip));
    game.FreeSpinsUIClip = FreeSpinsUIClip;
})(game || (game = {}));
var game;
(function (game) {
    var BalanceMeterMediator = (function (_super) {
        __extends(BalanceMeterMediator, _super);
        function BalanceMeterMediator() {
            _super.apply(this, arguments);
            this._historyReplay = false;
            this._isInFreeGame = false;
        }
        BalanceMeterMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(server.ServerResponseEvent.LOGIC_RESPONSE, this.onReceiveLogic);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onReceiveEnd);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.addContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFG);
            this.addContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBG);
            this.addContextListener(game.GameEvent.HAS_NO_WINS, this.onHasNoWins);
            this.addContextListener(game.GameEvent.HAS_MAX_WIN, this.forcedBalanceRefresh);
            this.addContextListener(sgi.ExternalBalanceEvent.DISPLAY_BALANCE, this.onExternalBalanceUpdate);
            this.setInitialBalance();
        };
        BalanceMeterMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(server.ServerResponseEvent.LOGIC_RESPONSE, this.onReceiveLogic);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onReceiveEnd);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.removeContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFG);
            this.removeContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBG);
            this.removeContextListener(game.GameEvent.HAS_NO_WINS, this.onHasNoWins);
            this.removeContextListener(game.GameEvent.HAS_MAX_WIN, this.forcedBalanceRefresh);
            this.removeContextListener(sgi.ExternalBalanceEvent.DISPLAY_BALANCE, this.onExternalBalanceUpdate);
        };
        BalanceMeterMediator.prototype.setInitialBalance = function () {
            this._historyReplay = this._historyModel.getIsHistoryReplay();
            var initResponse = this._server.getInitResponse();
            if (!initResponse.isRecovering) {
                var balance = this.getBalanceFrom(initResponse.balanceData, game.PayloadData.TYPE_INIT);
                Utils.PSLog.log("BalanceMeterMediator::setInitialBalance() - setting balance to: " + balance);
                BalanceMeterMediator._cachedBalance = balance;
                this.setDisplayValue(BalanceMeterMediator._cachedBalance, game.PayloadData.TYPE_INIT);
            }
            else {
                BalanceMeterMediator._cachedBalance = 0;
                this.setDisplayValue(BalanceMeterMediator._cachedBalance, game.PayloadData.TYPE_INIT);
            }
        };
        BalanceMeterMediator.prototype.onReceiveLogic = function (e) {
            var logicResponse = this._server.getLogicResponse();
            // Balance should not be updated at any point in a FG - only once the user has returned to BG
            if (this._isInFreeGame) {
                return;
            }
            if (logicResponse && logicResponse.balanceData && logicResponse.balanceData.hasBalance(server.BalanceType.CASH_BALANCE)) {
                if (logicResponse.bonusAwarded) {
                    this.refreshBalance();
                }
                else {
                    this.refreshBalance(true);
                }
            }
        };
        BalanceMeterMediator.prototype.onReceiveEnd = function (e) {
            var endResponse = this._server.getEndResponse();
            if (this._isInFreeGame) {
                return;
            }
            if (endResponse && endResponse.balanceData) {
                var balance = this.getBalanceFrom(endResponse.balanceData, game.PayloadData.TYPE_OUTCOME);
                // On realmoney, the End response sets the final balance to -1 and we ignore it
                if (balance != -1) {
                    Utils.PSLog.log("BalanceMeterMediator::onReceiveEnd() - updating from endResponse to: " + balance);
                    this.updateCachedBalance(balance);
                    this.setDisplayValue(BalanceMeterMediator._cachedBalance, game.PayloadData.TYPE_OUTCOME);
                }
                else {
                    this.refreshBalance(false);
                }
            }
        };
        BalanceMeterMediator.prototype.onRecovery = function (e) {
            var initResponse = this._server.getInitResponse();
            var logicResponse = this._server.getLogicResponse();
            if (initResponse) {
                var balance = this.getBalanceFrom(initResponse.balanceData, game.PayloadData.TYPE_WAGER);
                var winnings = logicResponse.gameResultData.totalWin;
                var fsWinnings = logicResponse.fsWinnings;
                var isMaxWin = logicResponse.isMaxWin;
                Utils.PSLog.log("BalanceMeterMediator::onRecovery() - RECOVERY logicResponse says balance: " + balance);
                Utils.PSLog.log("BalanceMeterMediator::onRecovery() - RECOVERY winnings: " + winnings);
                /*
                 If this is a free spin (i.e. we are recovering into a free game), do not deduct winnings, just show the the balance after the base game spin
                 */
                //Case 1: This is a bonus spin
                if (logicResponse.freeSpin) {
                    // Last bonus spin (via max win or no fs left)
                    if (logicResponse.isMaxWin || logicResponse.fsSpinNumber === logicResponse.fsSpinsTotal) {
                        balance = balance - fsWinnings - logicResponse.bgWinnings;
                    }
                }
                else if (!logicResponse.freeSpin) {
                    // Recovered base spin does not trigger a bonus
                    if (!logicResponse.bonusAwarded) {
                        balance = balance - winnings;
                    }
                }
                Utils.PSLog.log("BalanceMeterMediator::onRecovery() - RECOVERY updating displayed balance to: " + balance);
                this.updateCachedBalance(balance);
                this.setDisplayValue(BalanceMeterMediator._cachedBalance, game.PayloadData.TYPE_WAGER);
            }
        };
        BalanceMeterMediator.prototype.forcedBalanceRefresh = function (e) {
            this.refreshBalance(false);
        };
        BalanceMeterMediator.prototype.onHasNoWins = function (e) {
            if (!this._isInFreeGame) {
                this.refreshBalance();
            }
        };
        BalanceMeterMediator.prototype.refreshBalance = function (subtractWin) {
            if (subtractWin === void 0) { subtractWin = false; }
            var logicResponse = this._server.getLogicResponse();
            var initResponse = this._server.getInitResponse();
            var balanceType = game.PayloadData.TYPE_OUTCOME;
            if (logicResponse && logicResponse.balanceData) {
                var balance = this.getBalanceFrom(logicResponse.balanceData, game.PayloadData.TYPE_OUTCOME);
                if ((balance == -1) && (initResponse.isRecovering)) {
                    balance = this.getBalanceFrom(initResponse.balanceData, game.PayloadData.TYPE_OUTCOME);
                    Utils.PSLog.log("BalanceMeterMediator::refreshBalance() - logicResponse gives NO balance - using initResponse balance: " + winnings);
                }
                else {
                    var winnings = logicResponse.gameResultData.totalWin;
                    if (subtractWin) {
                        if (winnings || logicResponse.bonusAwarded) {
                            Utils.PSLog.log("BalanceMeterMediator::refreshBalance() - logicResponse gives FINAL: " + balance + " but subtracting wins: " + winnings);
                            balance -= winnings;
                            balanceType = game.PayloadData.TYPE_WAGER;
                        }
                    }
                    else if (logicResponse.bonusAwarded) {
                        balanceType = game.PayloadData.TYPE_WAGER;
                    }
                    Utils.PSLog.log("BalanceMeterMediator::refreshBalance() - updating from logicResponse to: " + balance);
                }
                this.updateCachedBalance(balance);
                this.setDisplayValue(BalanceMeterMediator._cachedBalance, balanceType);
            }
            this.view.visible = true;
        };
        BalanceMeterMediator.prototype.getBalanceFrom = function (balanceData, type) {
            var balance = -1;
            if (balanceData.hasBalance(server.BalanceType.CASH_BALANCE)) {
                balance = balanceData.getBalance(server.BalanceType.CASH_BALANCE);
            }
            else {
                Utils.PSLog.log("BalanceMeterMediator::getBalanceFrom() cannot retrieve value - returning -1");
            }
            return balance;
        };
        BalanceMeterMediator.prototype.updateCachedBalance = function (value) {
            Utils.PSLog.log("BalanceMeterMediator::updateCachedBalance(" + value + ")");
            BalanceMeterMediator._cachedBalance = value;
        };
        BalanceMeterMediator.prototype.setDisplayValue = function (value, type, e) {
            if (e === void 0) { e = null; }
            if (!this._historyReplay) {
                var formattedValue = "";
                value = (value > 0) ? value : 0;
                formattedValue = this._currencyFormatter.format(value);
                Utils.PSLog.log("BalanceMeterMediator::setDisplayValue() - updating meter to: " + formattedValue);
                this.view.value = formattedValue;
                this.updateTopBarBalance(value, type, e);
            }
        };
        BalanceMeterMediator.prototype.updateTopBarBalance = function (value, type, e) {
            if (e === void 0) { e = null; }
            if (this._partnerAdapterEventModel.balanceDisplayEventListener && value > 0) {
                var cashBalance = 0;
                var freebetBalance = 0;
                var balance = value;
                if (this._metaData.isRealMoney()) {
                    if (type == game.PayloadData.TYPE_EXTERNALEVENT) {
                        if (this._partnerAdapterEventModel.balanceDisplayEventListener && e.balance != undefined) {
                            //this could be OLG
                            var event = new util.BalanceDisplayEvent(cashBalance, freebetBalance, balance);
                            this._partnerAdapterEventModel.balanceDisplayEventListener.handlePlatformDisplayEvent(event);
                        }
                    }
                    else if (this._server.getLogicResponse() && !this._server.getLogicResponse().isRecovering) {
                        if (this._server.getLogicResponse().payloadData && this._server.getLogicResponse().payloadData[type]) {
                            var payloadData = this._server.getLogicResponse().payloadData[type];
                            cashBalance = payloadData.CASH;
                            freebetBalance = payloadData.FREEBET;
                            var event = new util.BalanceDisplayEvent(cashBalance, freebetBalance, balance);
                            Utils.PSLog.log("   openbet-->BalanceMeterMediator::updateTopBarBalance() - setting logic balance: " + event.balanceAmount + ", type: " + type);
                            this._partnerAdapterEventModel.balanceDisplayEventListener.handlePlatformDisplayEvent(event);
                        }
                        else if (this._partnerAdapterEventModel.balanceDisplayEventListener) {
                            //this could be OLG
                            var event = new util.BalanceDisplayEvent(cashBalance, freebetBalance, balance);
                            this._partnerAdapterEventModel.balanceDisplayEventListener.handlePlatformDisplayEvent(event);
                        }
                    }
                    else if (this._server.getInitResponse()) {
                        if (this._server.getInitResponse().payloadData && this._server.getInitResponse().payloadData[game.PayloadData.TYPE_INIT]) {
                            var payloadData = this._server.getInitResponse().payloadData[game.PayloadData.TYPE_INIT];
                            cashBalance = payloadData.CASH;
                            freebetBalance = payloadData.FREEBET;
                            var event = new util.BalanceDisplayEvent(cashBalance, freebetBalance, balance);
                            Utils.PSLog.log("openbet-->BalanceMeterMediator::updateTopBarBalance() - setting init balance: " + event.balanceAmount + ", type: " + type);
                            this._partnerAdapterEventModel.balanceDisplayEventListener.handlePlatformDisplayEvent(event);
                        }
                        else if (this._partnerAdapterEventModel.balanceDisplayEventListener) {
                            //this could be OLG
                            var event = new util.BalanceDisplayEvent(cashBalance, freebetBalance, balance);
                            this._partnerAdapterEventModel.balanceDisplayEventListener.handlePlatformDisplayEvent(event);
                        }
                    }
                }
                else {
                    cashBalance = value;
                    var event = new util.BalanceDisplayEvent(cashBalance, freebetBalance, balance);
                    this._partnerAdapterEventModel.balanceDisplayEventListener.handlePlatformDisplayEvent(event);
                }
            }
        };
        BalanceMeterMediator.prototype.onEnterFG = function () {
            this._isInFreeGame = true;
        };
        BalanceMeterMediator.prototype.onReturnToBG = function () {
            this._isInFreeGame = false;
        };
        BalanceMeterMediator.prototype.onExternalBalanceUpdate = function (e) {
            var balance = e.balance;
            if (balance > 0) {
                Utils.PSLog.log("BalanceMeterMediator::onExternalBalanceUpdate() - updating from event to: " + e.balance);
            }
            this.updateCachedBalance(balance);
            this.setDisplayValue(BalanceMeterMediator._cachedBalance, game.PayloadData.TYPE_EXTERNALEVENT, e);
        };
        __decorate([
            inject('CurrencyFormatter')
        ], BalanceMeterMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('GameServer')
        ], BalanceMeterMediator.prototype, "_server", void 0);
        __decorate([
            inject('PartnerAdapterEventModel')
        ], BalanceMeterMediator.prototype, "_partnerAdapterEventModel", void 0);
        __decorate([
            inject('MetaData')
        ], BalanceMeterMediator.prototype, "_metaData", void 0);
        __decorate([
            inject('HistoryModel')
        ], BalanceMeterMediator.prototype, "_historyModel", void 0);
        __decorate([
            inject('GameStateModel')
        ], BalanceMeterMediator.prototype, "_stateModel", void 0);
        return BalanceMeterMediator;
    }(dragonwings.Mediator));
    game.BalanceMeterMediator = BalanceMeterMediator;
})(game || (game = {}));
/// <reference path="../../BaseClasses/MeterView.ts" />
var game;
(function (game) {
    var BalanceMeterView = (function (_super) {
        __extends(BalanceMeterView, _super);
        function BalanceMeterView() {
            _super.call(this);
        }
        BalanceMeterView.prototype.construct = function (isDesktop) {
            this._isDesktop = isDesktop;
            this._title = Utils.MiscUtils.createBasicText(this, this._translator.findByKey("FreeSpin_com_wms_Balance"), game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [130, 50], [42, 80], "#FFFFFF");
            this._seperator = Utils.MiscUtils.createBasicText(this, " : ", game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [90, 50], [120, 80], "#AA1A29");
            this._value = Utils.MiscUtils.createBasicText(this, "", game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [150, 50], [150, 80], "#FFFFFF");
            if (isDesktop) {
                this.x = game.BaseGameUIConstants.kDesktopBalanceX;
                this.y = game.BaseGameUIConstants.kDesktopBalanceY;
            }
            else {
                this.x = game.BaseGameUIConstants.kMobileBalanceX;
                this.y = game.BaseGameUIConstants.kMobileBalanceY;
            }
        };
        Object.defineProperty(BalanceMeterView.prototype, "isDesktopUI", {
            get: function () {
                return this._isDesktop;
            },
            set: function (value) {
                this._isDesktop = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(BalanceMeterView.prototype, "value", {
            // Override base class set
            set: function (text) {
                this._value.text = text;
            },
            enumerable: true,
            configurable: true
        });
        __decorate([
            inject('ITranslator')
        ], BalanceMeterView.prototype, "_translator", void 0);
        return BalanceMeterView;
    }(game.MeterView));
    game.BalanceMeterView = BalanceMeterView;
})(game || (game = {}));
var game;
(function (game) {
    var InfoBarMeterMediator = (function (_super) {
        __extends(InfoBarMeterMediator, _super);
        function InfoBarMeterMediator() {
            _super.apply(this, arguments);
        }
        InfoBarMeterMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.setView(this.getViewComponent());
        };
        InfoBarMeterMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
        };
        return InfoBarMeterMediator;
    }(game.BaseInfoBarMeterMediator));
    game.InfoBarMeterMediator = InfoBarMeterMediator;
})(game || (game = {}));
var game;
(function (game) {
    var InfoBarMeterView = (function (_super) {
        __extends(InfoBarMeterView, _super);
        function InfoBarMeterView() {
            _super.call(this, "");
            this.maskX = 780;
            this.maskY = 1020;
            this.maskWidth = 450;
            this.maskHeight = 60;
            this.textPadding = 50;
        }
        InfoBarMeterView.prototype.construct = function (isDesktop, scalar, controlPanelContainer) {
            this._isDesktop = isDesktop;
            this._scalar = scalar;
            this.font = game.BaseGameUIConstants.kFontFamily;
            this.textAlign = rendering.TextAlign.CENTER;
            if (isDesktop) {
                this.fontSize = game.BaseGameUIConstants.kDesktopInfoFontSize;
                this.colour = game.BaseGameUIConstants.kDesktopInfoBarMeterTextColour;
                this.x = game.BaseGameUIConstants.kDesktopInfoX;
                this.y = game.BaseGameUIConstants.kDesktopInfoY;
                this.width = this.maxWidth = this.scaleToWidth = 800;
                this.height = this.scaleToHeight = 80;
            }
            else {
                this.fontSize = game.BaseGameUIConstants.kMobileInfoFontSize;
                this.colour = game.BaseGameUIConstants.kMobileInfoBarMeterTextColour;
                this.x = game.BaseGameUIConstants.kMobileInfoX;
                this.y = game.BaseGameUIConstants.kMobileInfoY;
                // this.width = this.maxWidth = this.scaleToWidth = 400;
                // this.height = this.scaleToHeight = 80;
                this._mask = new rendering.Graphics();
                this._mask.beginFill(0x00ff00, 0.2);
                this._mask.drawRect(this.maskX, this.maskY, this.maskWidth, this.maskHeight);
                this._mask.endFill();
                this.mask = this._mask;
                controlPanelContainer.addChild(this._mask);
            }
        };
        InfoBarMeterView.prototype.setText = function (text) {
            this.text = text;
            this.x = this._isDesktop ? game.BaseGameUIConstants.kDesktopInfoX : game.BaseGameUIConstants.kMobileInfoX;
            Utils.MiscUtils.centreReg(this, this._scalar);
            if (!this._isDesktop) {
                this._tween ? this._tween.kill() : null;
                // scroll, fade out, loop
                this.x = game.BaseGameUIConstants.kMobileInfoX + (this.width * 0.5) - ((this.maskWidth * 0.5) - this.textPadding);
                this._tween = new TimelineMax({ repeat: Infinity, repeatDelay: 0.4 });
                this._tween.add(TweenLite.to(this, 0.1, { alpha: 1 }));
                this._tween.add(TweenLite.to(this, 1.5, {
                    ease: Linear.easeNone,
                    x: game.BaseGameUIConstants.kMobileInfoX - (this.width * 0.5) + ((this.maskWidth * 0.5) - this.textPadding)
                }));
                this._tween.add(TweenLite.to(this, 0.1, { alpha: 0, delay: 0.25 }));
                this._tween.play();
            }
        };
        return InfoBarMeterView;
    }(rendering.Text));
    game.InfoBarMeterView = InfoBarMeterView;
})(game || (game = {}));
var game;
(function (game) {
    var LinesMeterMediator = (function (_super) {
        __extends(LinesMeterMediator, _super);
        function LinesMeterMediator() {
            _super.apply(this, arguments);
        }
        LinesMeterMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.onIdle);
            this.addContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
            this.setInitialValue();
        };
        LinesMeterMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.onIdle);
            this.removeContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
        };
        LinesMeterMediator.prototype.setInitialValue = function () {
            this.setLines(this._stakeModel.getLines());
        };
        LinesMeterMediator.prototype.onRecovery = function (e) {
        };
        LinesMeterMediator.prototype.onIdle = function (e) {
            //this.view.visible = true;
            this.setLines(this._stakeModel.getLines());
        };
        LinesMeterMediator.prototype.setLines = function (value) {
            if ((value < this._stakeModel.getMinLines()) || (value > this._stakeModel.getMaxLines())) {
                throw "Lines value out of range";
            }
            this.view.value = value.toString();
            this.updateTopBarBalance(value);
        };
        LinesMeterMediator.prototype.updateTopBarBalance = function (value) {
        };
        LinesMeterMediator.prototype.onStakeChange = function (e) {
            this.setLines(this._stakeModel.getLines());
        };
        __decorate([
            inject('CurrencyFormatter')
        ], LinesMeterMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('GameServer')
        ], LinesMeterMediator.prototype, "_server", void 0);
        __decorate([
            inject('StakeModel')
        ], LinesMeterMediator.prototype, "_stakeModel", void 0);
        __decorate([
            inject('SpinModel')
        ], LinesMeterMediator.prototype, "_spinModel", void 0);
        __decorate([
            inject('PartnerAdapterEventModel')
        ], LinesMeterMediator.prototype, "_partnerAdapterEventModel", void 0);
        __decorate([
            inject('MetaData')
        ], LinesMeterMediator.prototype, "_metaData", void 0);
        return LinesMeterMediator;
    }(dragonwings.Mediator));
    game.LinesMeterMediator = LinesMeterMediator;
})(game || (game = {}));
/// <reference path="../../BaseClasses/MeterView.ts" />
var game;
(function (game) {
    var LinesMeterView = (function (_super) {
        __extends(LinesMeterView, _super);
        function LinesMeterView() {
            _super.call(this);
        }
        return LinesMeterView;
    }(game.MeterView));
    game.LinesMeterView = LinesMeterView;
})(game || (game = {}));
var game;
(function (game) {
    var StakeMeterMediator = (function (_super) {
        __extends(StakeMeterMediator, _super);
        function StakeMeterMediator() {
            _super.apply(this, arguments);
            this._isRecovering = false;
            this._isReplay = false;
        }
        StakeMeterMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.addContextListener(game.GameStateEvent.ExitState(game.Subgame.PRE_GAME, "historyInit"), this.onReplay);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.onIdle);
            this.addContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
            this.setInitialValue();
        };
        StakeMeterMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.removeContextListener(game.GameStateEvent.ExitState(game.Subgame.PRE_GAME, "historyInit"), this.onReplay);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.onIdle);
            this.removeContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
        };
        StakeMeterMediator.prototype.setInitialValue = function () {
            this.setStake(this._stakeModel.getStakePerLine());
        };
        StakeMeterMediator.prototype.onRecovery = function (e) {
            this._isRecovering = true;
        };
        StakeMeterMediator.prototype.onReplay = function (e) {
            this._isReplay = true;
            this.view.value = "";
        };
        StakeMeterMediator.prototype.onIdle = function (e) {
            if (!this._isRecovering) {
                this.setStake(this._stakeModel.getStakePerLine());
            }
            else {
                this._isRecovering = false;
            }
        };
        StakeMeterMediator.prototype.setStake = function (value, isRecovering) {
            if (isRecovering === void 0) { isRecovering = false; }
            if (!this._isReplay && !isRecovering && (value < this._stakeModel.getMinStakePerLine()) || (value > this._stakeModel.getMaxStakePerLine())) {
                throw "stake per line looks suspicious";
            }
            this.view.value = this._currencyFormatter.format(value);
        };
        StakeMeterMediator.prototype.onStakeChange = function (e) {
            if (this._isRecovering) {
                this.setStake(this._stakeModel.getRecoveryStake(), true);
            }
            else {
                this.setStake(this._stakeModel.getStakePerLine());
            }
        };
        __decorate([
            inject('CurrencyFormatter')
        ], StakeMeterMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('StakeModel')
        ], StakeMeterMediator.prototype, "_stakeModel", void 0);
        return StakeMeterMediator;
    }(dragonwings.Mediator));
    game.StakeMeterMediator = StakeMeterMediator;
})(game || (game = {}));
/// <reference path="../../BaseClasses/MeterView.ts" />
var game;
(function (game) {
    var StakeMeterView = (function (_super) {
        __extends(StakeMeterView, _super);
        function StakeMeterView() {
            _super.call(this);
        }
        StakeMeterView.prototype.construct = function (cache) {
            this._cache = cache;
            var baseX = 0;
            var baseY = 0;
            this.incButton = Utils.MiscUtils.addAutoRepeatButton(this, 218, 6, this._cache, game.BaseGameBundle, "RG_Buttons", ["arrow_on.png", "arrow_dim.png", "arrow_over.png", "arrow_dim.png"], "plus_on.png", [1, 6]);
            this.decButton = Utils.MiscUtils.addAutoRepeatButton(this, 182, 60, this._cache, game.BaseGameBundle, "RG_Buttons", ["arrow_down_on.png", "arrow_down_dim.png", "arrow_down_over.png", "arrow_down_dim.png"], "minus_on.png", [1, -4]);
            this.incButton.scaleX = -1;
            this.incButton.repeatRate = 0.3;
            this.decButton.repeatRate = 0.3;
        };
        return StakeMeterView;
    }(game.MeterView));
    game.StakeMeterView = StakeMeterView;
})(game || (game = {}));
var game;
(function (game) {
    var TotalBetMeterMediator = (function (_super) {
        __extends(TotalBetMeterMediator, _super);
        function TotalBetMeterMediator() {
            _super.apply(this, arguments);
            this._isRecovering = false;
        }
        // protected _scalar: number;
        TotalBetMeterMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            // this._scalar = this._device.getScalar();
            this.view = this.getViewComponent();
            // this.view.scalar = this._scalar;
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.onIdle);
            this.addContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
            this.addContextListener(game.GameEvent.HISTORY_REPLAY_READY, this.hideTotalBetForHistoryInit);
            this.setInitialValue();
        };
        TotalBetMeterMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.PRE_GAME, "recoveryInit"), this.onRecovery);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.onIdle);
            this.removeContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
            this.addContextListener(game.GameEvent.HISTORY_REPLAY_READY, this.hideTotalBetForHistoryInit);
        };
        TotalBetMeterMediator.prototype.setInitialValue = function () {
            this.setTotalBet(this._stakeModel.getTotalBet());
        };
        TotalBetMeterMediator.prototype.onRecovery = function (e) {
            this._isRecovering = true;
        };
        TotalBetMeterMediator.prototype.hideTotalBetForHistoryInit = function (e) {
            this.view.value = "";
        };
        TotalBetMeterMediator.prototype.onIdle = function (e) {
            this.view.visible = true;
            if (!this._isRecovering) {
                this.setTotalBet(this._stakeModel.getTotalBet());
            }
            else {
                this._isRecovering = false;
            }
        };
        TotalBetMeterMediator.prototype.setTotalBet = function (value) {
            var formattedValue = this._currencyFormatter.format(value);
            this.view.value = formattedValue;
        };
        TotalBetMeterMediator.prototype.onStakeChange = function (e) {
            if (this._isRecovering) {
                this.setTotalBet(this._stakeModel.getRecoveryStake() * this._stakeModel.getLines());
            }
            else {
                this.setTotalBet(this._stakeModel.getTotalBet());
            }
        };
        __decorate([
            inject('DeviceContext')
        ], TotalBetMeterMediator.prototype, "_device", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], TotalBetMeterMediator.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('GameServer')
        ], TotalBetMeterMediator.prototype, "_server", void 0);
        __decorate([
            inject('StakeModel')
        ], TotalBetMeterMediator.prototype, "_stakeModel", void 0);
        __decorate([
            inject('SpinModel')
        ], TotalBetMeterMediator.prototype, "_spinModel", void 0);
        __decorate([
            inject('PartnerAdapterEventModel')
        ], TotalBetMeterMediator.prototype, "_partnerAdapterEventModel", void 0);
        __decorate([
            inject('MetaData')
        ], TotalBetMeterMediator.prototype, "_metaData", void 0);
        __decorate([
            inject('ITranslator')
        ], TotalBetMeterMediator.prototype, "_translator", void 0);
        return TotalBetMeterMediator;
    }(dragonwings.Mediator));
    game.TotalBetMeterMediator = TotalBetMeterMediator;
})(game || (game = {}));
/// <reference path="../../BaseClasses/MeterView.ts" />
var game;
(function (game) {
    var TotalBetMeterView = (function (_super) {
        __extends(TotalBetMeterView, _super);
        function TotalBetMeterView() {
            _super.call(this);
            this._title = [];
        }
        TotalBetMeterView.prototype.construct = function (isDesktop, scalar) {
            this._isDesktop = isDesktop;
            this._scalar = scalar;
            if (isDesktop) {
                this._title = Utils.MiscUtils.createStyledText(this._translator.findByKey("framework_com_wms_framework_Dash_TotalBet"), game.BaseGameUIConstants.kFontFamily, 30, rendering.TextAlign.CENTER, game.BaseGameUIConstants.kDesktopMeterLabelTextColour, 190, 100, ['#000000'], [1], 89, 90, 90, false, true);
                for (var i = 0; i < this._title.length; i++) {
                    this.addChild(this._title[i]);
                    this._title[i].x = 800;
                    this._title[i].y = 228;
                    Utils.MiscUtils.centreReg(this._title[i], this._scalar);
                }
                this._value = Utils.MiscUtils.createBasicText(this, "", 56, rendering.TextAlign.CENTER, [180, 80], [800, 180], "#FFFFFF");
            }
            else {
                this._title[0] = Utils.MiscUtils.createBasicText(this, this._translator.findByKey("framework_com_wms_framework_Dash_TotalBet"), game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [150, 50], [1310, 1050], "#ffffff");
                this._seperator = Utils.MiscUtils.createBasicText(this, " : ", game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [30, 50], [1400, 1050], "#103B62");
                this._value = Utils.MiscUtils.createBasicText(this, "", game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [150, 50], [1430, 1050], "#FFFFFF");
            }
        };
        Object.defineProperty(TotalBetMeterView.prototype, "isDesktopUI", {
            get: function () {
                return this._isDesktop;
            },
            set: function (value) {
                this._isDesktop = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TotalBetMeterView.prototype, "value", {
            // Override base class set
            set: function (text) {
                if (this._value) {
                    this._value.text = text;
                    if (this._isDesktop) {
                        Utils.MiscUtils.centreReg(this._value);
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
        __decorate([
            inject('ITranslator')
        ], TotalBetMeterView.prototype, "_translator", void 0);
        return TotalBetMeterView;
    }(game.MeterView));
    game.TotalBetMeterView = TotalBetMeterView;
})(game || (game = {}));
var game;
(function (game) {
    var WinMeterMediator = (function (_super) {
        __extends(WinMeterMediator, _super);
        function WinMeterMediator() {
            _super.apply(this, arguments);
            this._isReturningFromFSGame = false;
            this._isInBaseGame = true;
        }
        WinMeterMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "showingWins"), this.onCyclesStarted);
            this.addContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.addContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
            this.addContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.addContextListener(game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME, this.onRecoveryIntoFSGame);
            this.addContextListener(game.GameEvent.PAY_CYCLE_OVERLAY_PRESSED, this.onPayCycleOverlayPressed);
            this.addContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSGame);
            this.addContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame);
            this.setView(this.getViewComponent());
            this.setInitialValue();
        };
        WinMeterMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "showingWins"), this.onCyclesStarted);
            this.removeContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.removeContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeChange);
            this.removeContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.removeContextListener(game.GameEvent.RECOVERY_INTO_FREE_SPINS_GAME, this.onRecoveryIntoFSGame);
            this.removeContextListener(game.GameEvent.PAY_CYCLE_OVERLAY_PRESSED, this.onPayCycleOverlayPressed);
            this.removeContextListener(game.GameStateEvent.EnterSubgame(game.Subgame.FREE_SPINS_GAME), this.onEnterFSGame);
            this.removeContextListener(game.GameEvent.RETURN_TO_BASE_GAME, this.onReturnToBaseGame);
        };
        WinMeterMediator.prototype.setInitialValue = function () {
            this.setWin(0);
        };
        WinMeterMediator.prototype.onNextAutoplay = function () {
            _super.prototype.resetValues.call(this);
            this.setWin(0);
        };
        WinMeterMediator.prototype.onRecoveryIntoFSGame = function () {
            var logicResponse = this._server.getLogicResponse();
            this._currentRunningTotalWon = logicResponse.bgWinnings;
            this.setWin(this._currentRunningTotalWon);
        };
        WinMeterMediator.prototype.onCyclesStarted = function (e) {
            if (!this._isInBaseGame) {
                return;
            }
            var totalWonFromCascade = this._winInfoModel.getNextCascadeWin();
            if (this._winInfoModel.getWinDataForCurrentCycle()) {
                game.CheckIfCanCascadeCmd.winMeterCountUpComplete = false;
                this._winInfoModel.winCountUpComplete = false;
                this.initBigWinSounds(this.getBigWinLevel(totalWonFromCascade), totalWonFromCascade);
            }
        };
        WinMeterMediator.prototype.resetValues = function () {
            _super.prototype.resetValues.call(this);
            this._isReturningFromFSGame = false;
        };
        WinMeterMediator.prototype.onEnterFSGame = function () {
            this._isInBaseGame = false;
            _super.prototype.onEnterFSGame.call(this);
        };
        WinMeterMediator.prototype.onReturnToBaseGame = function () {
            this._isInBaseGame = true;
            this._returningFromFSGame = true;
            this._winInfoModel.winCountUpComplete = false;
            // if max win there is no need to count up, just set the meter to the maximum win value
            if (this._hasMaxWin) {
                this.completeIncrementWinAmountTween();
                var initResponse = this._server.getInitResponse();
                this.setWin(initResponse.maxWinValue);
                this._hasMaxWin = false;
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.FINALISED_TOTAL_WINNINGS_FROM_BASE_AND_FREE_GAME, this));
                this._returningFromFSGame = false;
            }
            else {
                var logicResponse = this._server.getLogicResponse();
                var fgWinnings = logicResponse.fsWinnings;
                // Set base winnings, before starting FG win count up
                this._currentRunningTotalWon = logicResponse.bgWinnings;
                this.setWin(this._currentRunningTotalWon);
                this.initBigWinSounds(this.getBigWinLevel(fgWinnings), fgWinnings);
            }
        };
        WinMeterMediator.prototype.onPayCycleOverlayPressed = function () {
            if (this._isInBaseGame) {
                _super.prototype.onPayCycleOverlayPressed.call(this);
            }
        };
        __decorate([
            inject('StakeModel')
        ], WinMeterMediator.prototype, "_stakeModel", void 0);
        __decorate([
            inject('WinInfoModel')
        ], WinMeterMediator.prototype, "_winInfoModel", void 0);
        return WinMeterMediator;
    }(game.BaseWinMeterMediator));
    game.WinMeterMediator = WinMeterMediator;
})(game || (game = {}));
/// <reference path="../../BaseClasses/MeterView.ts" />
var game;
(function (game) {
    var WinMeterView = (function (_super) {
        __extends(WinMeterView, _super);
        function WinMeterView() {
            _super.call(this);
        }
        Object.defineProperty(WinMeterView.prototype, "isDesktopUI", {
            get: function () {
                return this._isDesktop;
            },
            set: function (value) {
                this._isDesktop = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WinMeterView.prototype, "value", {
            // Override base class set
            set: function (text) {
                this.meter.value = text;
                if (this._isDesktop) {
                    this.meter.text.x = (this.meter.text.scaleToWidth - this.meter.text.width) / 2;
                }
            },
            enumerable: true,
            configurable: true
        });
        return WinMeterView;
    }(game.MeterView));
    game.WinMeterView = WinMeterView;
})(game || (game = {}));
var game;
(function (game) {
    var StatsMediator = (function (_super) {
        __extends(StatsMediator, _super);
        function StatsMediator() {
            _super.apply(this, arguments);
        }
        StatsMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.getViewComponent();
            this.addContextListener(rendering.DisplayEvent.ENTER_FRAME, this.onStageEnterFrame);
        };
        StatsMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(rendering.DisplayEvent.ENTER_FRAME, this.onStageEnterFrame);
        };
        StatsMediator.prototype.onStageEnterFrame = function (event) {
            this.view.stats.begin();
            this.view.stats.end();
        };
        return StatsMediator;
    }(dragonwings.Mediator));
    game.StatsMediator = StatsMediator;
})(game || (game = {}));
var game;
(function (game) {
    var StatsView = (function () {
        function StatsView() {
            this.stats = new Stats();
        }
        return StatsView;
    }());
    game.StatsView = StatsView;
})(game || (game = {}));
var game;
(function (game) {
    var AbstractUIBottomButtonsView = (function (_super) {
        __extends(AbstractUIBottomButtonsView, _super);
        function AbstractUIBottomButtonsView() {
            _super.apply(this, arguments);
            this._backButtonAllowed = false;
            this._mobileUI = false;
            this._btnProps = {
                "_backBtn": {
                    bundle: "CF_Buttons",
                    frames: ["back_icon_sm_on.png", "back_icon_sm_dim.png", "back_icon_sm_on.png", "back_icon_sm_dim.png"],
                    x: 230 + 9,
                    y: 1029 + 9
                },
                "_settingsBtn": {
                    bundle: "CF_Buttons",
                    frames: ["settings_icon_sm_on.png", "settings_icon_sm_dim.png", "settings_icon_sm_on.png", "settings_icon_sm_dim.png"],
                    x: 300 + 9,
                    y: 1029 + 9
                },
                "_helpBtn": {
                    bundle: "CF_Buttons",
                    frames: ["help_icon_sm_on.png", "help_icon_sm_dim.png", "help_icon_sm_on.png", "help_icon_sm_dim.png"],
                    x: 368 + 9,
                    y: 1029 + 9
                }
            };
        }
        AbstractUIBottomButtonsView.prototype.construct = function (isMobileUI) {
            if (isMobileUI === void 0) { isMobileUI = false; }
            this._mobileUI = isMobileUI;
            this._scalar = this._device.getScalar();
            Utils.PSLog.log("AbstractUIBottomButtonsView.construct()");
            this._buttonsContainer = this.getButtonsContainer();
            this.addButtons();
            this.applyButtonProperties();
            var initResponse = this._server.getInitResponse();
            // If we are in replay mode, disable the footer buttons
            if (initResponse.isRecovering) {
                this.enableButtons(false);
            }
            // If we are in replay mode, disable the footer buttons
            if (this._historyModel.getIsHistoryReplay()) {
                this.enableButtons(false);
            }
            var adapter = this._partnerAdapter;
            if (adapter.logics) {
                if (adapter.logics.pageNavigator) {
                    if (adapter.logics.pageNavigator.canGoToLobby()) {
                        this._backButtonAllowed = true;
                    }
                }
            }
            this._backBtn.enabled = this._backButtonAllowed;
            this._backBtn.visible = this._backButtonAllowed;
        };
        AbstractUIBottomButtonsView.prototype.enableButtons = function (boo) {
            if (boo === void 0) { boo = true; }
            for (var b in this._btnProps) {
                this[b].enabled = boo;
                this[b].alpha = boo ? 1 : 0.6;
            }
        };
        AbstractUIBottomButtonsView.prototype.getButtonsContainer = function () {
            return this;
        };
        AbstractUIBottomButtonsView.prototype.addButtons = function () {
            for (var b in this._btnProps) {
                this[b] = Utils.MiscUtils.addBasicButton(this._buttonsContainer, 100, 100, this._cache, game.BaseGameBundle, this._btnProps[b].bundle, this._btnProps[b].frames);
                Utils.MiscUtils.centreReg(this[b], this._scalar);
                rendering.InputManager.registerObject(this[b]);
                this[b].addEventListener(rendering.InputEvent.DOWN, this[b.substr(1) + "OnPressed"], this);
            }
        };
        AbstractUIBottomButtonsView.prototype.applyButtonProperties = function () {
            var button;
            for (var b in this._btnProps) {
                button = this[b];
                if (button) {
                    for (var prop in this._btnProps[b]) {
                        button[prop] = this._btnProps[b][prop];
                    }
                }
                if (!this._mobileUI) {
                    button.x += (button.width >> 1);
                    button.y += (button.height >> 1);
                }
            }
        };
        AbstractUIBottomButtonsView.prototype.backBtnOnPressed = function (e) {
            if (this._backButtonAllowed && this._backBtn.enabled) {
                Utils.PSLog.log("on back button pressed");
                this._partnerAdapter.logics.pageNavigator.goToLobby();
            }
        };
        AbstractUIBottomButtonsView.prototype.settingsBtnOnPressed = function (e) {
            if (this._settingsBtn.enabled) {
                Utils.PSLog.log("on settings button pressed");
                this._settingsBtnHandler = this._partnerAdapter.setMenuHandler("SETTINGS", function (data) { });
                this._settingsBtnHandler({ open: true });
            }
        };
        __decorate([
            inject('AssetCache')
        ], AbstractUIBottomButtonsView.prototype, "_cache", void 0);
        __decorate([
            inject('DeviceContext')
        ], AbstractUIBottomButtonsView.prototype, "_device", void 0);
        __decorate([
            inject('GameServer')
        ], AbstractUIBottomButtonsView.prototype, "_server", void 0);
        __decorate([
            inject('GameStateModel')
        ], AbstractUIBottomButtonsView.prototype, "_stateModel", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], AbstractUIBottomButtonsView.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('AutoPlayModel')
        ], AbstractUIBottomButtonsView.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('MetaData')
        ], AbstractUIBottomButtonsView.prototype, "_metaData", void 0);
        __decorate([
            inject('HistoryModel')
        ], AbstractUIBottomButtonsView.prototype, "_historyModel", void 0);
        return AbstractUIBottomButtonsView;
    }(rendering.DisplayObjectContainer));
    game.AbstractUIBottomButtonsView = AbstractUIBottomButtonsView;
})(game || (game = {}));
var game;
(function (game) {
    var AbstractUIBottomButtonsViewMediator = (function (_super) {
        __extends(AbstractUIBottomButtonsViewMediator, _super);
        function AbstractUIBottomButtonsViewMediator() {
            _super.apply(this, arguments);
            this._isRecovering = false;
        }
        AbstractUIBottomButtonsViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            Utils.PSLog.log("AbstractUIBottomButtonsViewMediator::onAdded()");
            this.view = this.getViewComponent();
            this.addContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.onEnterIdleState);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.addContextListener(game.ExternalEvent.START_AUTOPLAY, this.onAutoplayStart);
            this.addContextListener(game.GameEvent.RECOVERY_SPIN, this.onRecoverySpin);
        };
        AbstractUIBottomButtonsViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinButtonPressed);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.onEnterIdleState);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.removeContextListener(game.ExternalEvent.START_AUTOPLAY, this.onAutoplayStart);
            this.removeContextListener(game.GameEvent.RECOVERY_SPIN, this.onRecoverySpin);
        };
        AbstractUIBottomButtonsViewMediator.prototype.onSpinButtonPressed = function (e) {
            this.view.enableButtons(false);
        };
        AbstractUIBottomButtonsViewMediator.prototype.onEnterIdleState = function (e) {
            if (!this._autoplayModel.isInProgress()) {
                this.view.enableButtons(true);
            }
        };
        AbstractUIBottomButtonsViewMediator.prototype.onEndResponse = function (e) {
            if (!this._autoplayModel.isInProgress()) {
                this.view.enableButtons(true);
            }
        };
        AbstractUIBottomButtonsViewMediator.prototype.onAutoplayStart = function (e) {
            this.view.enableButtons(false);
        };
        AbstractUIBottomButtonsViewMediator.prototype.onRecoverySpin = function () {
            this._isRecovering = true;
        };
        AbstractUIBottomButtonsViewMediator.prototype.enable = function () {
            this.view.enableButtons(true);
        };
        AbstractUIBottomButtonsViewMediator.prototype.disable = function () {
            this.view.enableButtons(false);
        };
        __decorate([
            inject("GameStateModel")
        ], AbstractUIBottomButtonsViewMediator.prototype, "_stateModel", void 0);
        __decorate([
            inject("AutoplayModel")
        ], AbstractUIBottomButtonsViewMediator.prototype, "_autoplayModel", void 0);
        return AbstractUIBottomButtonsViewMediator;
    }(dragonwings.Mediator));
    game.AbstractUIBottomButtonsViewMediator = AbstractUIBottomButtonsViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var AbstractUIMediator = (function (_super) {
        __extends(AbstractUIMediator, _super);
        function AbstractUIMediator() {
            _super.apply(this, arguments);
        }
        AbstractUIMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            Utils.PSLog.log("AbstractUIMediator::onAdded()");
            this.view = this.getViewComponent();
            this.addContextListener(game.GameEvent.SHOW_BASE_VIEW, this.onShowBase);
            this.addContextListener(game.LayerViewEvent.TRANSITION_IN_STARTED, this.onTransitionInStarted);
        };
        AbstractUIMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SHOW_BASE_VIEW, this.onShowBase);
            this.removeContextListener(game.LayerViewEvent.TRANSITION_IN_STARTED, this.onTransitionInStarted);
        };
        AbstractUIMediator.prototype.onTransitionInStarted = function (event) {
            if (event.id === game.LayerViews.BASE) {
                this._layerMgr.setVisible([
                    new game.LayerVisibility(game.LayerViews.BASE, true),
                    new game.LayerVisibility(game.LayerViews.REELS, false),
                    new game.LayerVisibility(game.LayerViews.REELS_OVERLAY, false),
                    new game.LayerVisibility(game.LayerViews.FIVE_OF_A_KIND, false),
                    new game.LayerVisibility(game.LayerViews.HUD, true),
                    new game.LayerVisibility(game.LayerViews.UI, true),
                    new game.LayerVisibility(game.LayerViews.FREE_SPINS, false),
                    new game.LayerVisibility(game.LayerViews.FS_UI, false),
                    new game.LayerVisibility(game.LayerViews.HELP, false)
                ]);
            }
        };
        AbstractUIMediator.prototype.onShowBase = function () {
            this._layerMgr.transitionTo(game.LayerViews.BASE, 0.5);
        };
        __decorate([
            inject('LayerManager')
        ], AbstractUIMediator.prototype, "_layerMgr", void 0);
        __decorate([
            inject('ITranslator')
        ], AbstractUIMediator.prototype, "_translator", void 0);
        return AbstractUIMediator;
    }(dragonwings.Mediator));
    game.AbstractUIMediator = AbstractUIMediator;
})(game || (game = {}));
var game;
(function (game) {
    var DesktopUIBottomButtonsView = (function (_super) {
        __extends(DesktopUIBottomButtonsView, _super);
        function DesktopUIBottomButtonsView() {
            _super.apply(this, arguments);
            this._btnProps = {
                "_backBtn": {
                    bundle: "CF_Buttons",
                    frames: ["back_icon_sm_on.png", "back_icon_sm_dim.png", "back_icon_sm_on.png", "back_icon_sm_dim.png"],
                    x: 230 + 9,
                    y: 1029 + 9
                },
                "_settingsBtn": {
                    bundle: "CF_Buttons",
                    frames: ["settings_icon_sm_on.png", "settings_icon_sm_dim.png", "settings_icon_sm_on.png", "settings_icon_sm_dim.png"],
                    x: 300 + 9,
                    y: 1029 + 9
                },
                "_helpBtn": {
                    bundle: "CF_Buttons",
                    frames: ["help_icon_sm_on.png", "help_icon_sm_dim.png", "help_icon_sm_on.png", "help_icon_sm_dim.png"],
                    x: 368 + 9,
                    y: 1029 + 9
                }
            };
        }
        DesktopUIBottomButtonsView.prototype.construct = function () {
            _super.prototype.construct.call(this);
        };
        DesktopUIBottomButtonsView.prototype.helpBtnOnPressed = function (e) {
            var locale = Utils.MiscUtils.getCountryCode(this._partnerAdapter, this._metaData).substr(0, 2);
            {
                var url = "content/crystalforesthd_prt/resources/help/rules.html?language=" + locale;
                window.open(url, "Help", "width=600, height=400, resizable=yes, scrollbars=yes");
            }
        };
        return DesktopUIBottomButtonsView;
    }(game.AbstractUIBottomButtonsView));
    game.DesktopUIBottomButtonsView = DesktopUIBottomButtonsView;
})(game || (game = {}));
var game;
(function (game) {
    var DesktopUIBottomButtonsViewMediator = (function (_super) {
        __extends(DesktopUIBottomButtonsViewMediator, _super);
        function DesktopUIBottomButtonsViewMediator() {
            _super.apply(this, arguments);
        }
        DesktopUIBottomButtonsViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            // this.view = <AbstractUIBottomButtonsView>this.getViewComponent();
            Utils.PSLog.log("DesktopUIBottomButtonsViewMediator::onAdded()");
        };
        DesktopUIBottomButtonsViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
        };
        return DesktopUIBottomButtonsViewMediator;
    }(game.AbstractUIBottomButtonsViewMediator));
    game.DesktopUIBottomButtonsViewMediator = DesktopUIBottomButtonsViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var DesktopUIMediator = (function (_super) {
        __extends(DesktopUIMediator, _super);
        function DesktopUIMediator() {
            _super.apply(this, arguments);
        }
        DesktopUIMediator.prototype.onAdded = function () {
            this.view = this.getViewComponent();
            this.addContextListener(game.AutoPlayModelEvent.INITIALISED, this.onAutoplayInitialised);
        };
        DesktopUIMediator.prototype.onRemove = function () {
            this.removeContextListener(game.AutoPlayModelEvent.INITIALISED, this.onAutoplayInitialised);
        };
        DesktopUIMediator.prototype.onAutoplayInitialised = function (e) {
            this.view.setAutoplayEnabled(this._autoplayModel.isEnabled());
        };
        __decorate([
            inject('AutoPlayModel')
        ], DesktopUIMediator.prototype, "_autoplayModel", void 0);
        return DesktopUIMediator;
    }(game.AbstractUIMediator));
    game.DesktopUIMediator = DesktopUIMediator;
})(game || (game = {}));
var game;
(function (game) {
    var DesktopUIView = (function (_super) {
        __extends(DesktopUIView, _super);
        function DesktopUIView() {
            _super.call(this);
            this._tooltips = {};
        }
        DesktopUIView.prototype.construct = function () {
            this._scalar = this._device.getScalar();
            this.addChild(this.createControlPanel());
            this._gameButtonGroup.spinButton = this.spinButton;
            this._gameButtonGroup.autoplayButton = this.autoplayButton;
            this._gameButtonGroup.helpButton = this.helpButton;
            this._gameButtonGroup.stakeUpButton = this.incStakeButton;
            this._gameButtonGroup.stakeDownButton = this.decStakeButton;
            var spinTranslation = this._translator.findByKey("framework_com_wms_framework_Dash_Spin");
            var paytableTranslation = this._translator.findByKey("framework_com_wms_framework_Dash_PayTable");
            var autoplayTranslation = this._translator.findByKey("framework_com_wms_framework_Dash_AutoPlayToolTip");
            Utils.MiscUtils.addToolTip(this, this._tooltips, this.spinButton, "spin", spinTranslation, 1480, 800);
            Utils.MiscUtils.addToolTip(this, this._tooltips, this.helpButton, "paytable", paytableTranslation, 300, 840);
            Utils.MiscUtils.addToolTip(this, this._tooltips, this.autoplayButton, "autoplay", autoplayTranslation, 400, 840);
        };
        DesktopUIView.prototype.getLinesMeter = function () {
            return this._linesMeter;
        };
        DesktopUIView.prototype.getStakeMeter = function () {
            return this._stakeMeter;
        };
        DesktopUIView.prototype.getTotalBetMeter = function () {
            return this._totalBetMeter;
        };
        DesktopUIView.prototype.getWinMeter = function () {
            return this._winMeter;
        };
        DesktopUIView.prototype.getInfoBarMeter = function () {
            return this._infoMeter;
        };
        DesktopUIView.prototype.getStopAutoplayButton = function () {
            return this._stopAutoplayButtonView;
        };
        DesktopUIView.prototype.createControlPanel = function () {
            // create control panel container
            var controlPanelContainer = new rendering.DisplayObjectContainer();
            var controlPanelAsset = Utils.MiscUtils.getAssetFrameWithName("ui_bsg_background.png", game.BaseGameBundle.CF_ControlPanel.name, game.BaseGameBundle.CF_ControlPanelJson.name, this._cache);
            var controlPanelBitmap = new rendering.Bitmap(controlPanelAsset);
            var isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            controlPanelContainer.addChild(controlPanelBitmap);
            controlPanelContainer.addChild(this.createPaytableButton());
            controlPanelContainer.addChild(this.createAutoplayButton());
            controlPanelContainer.addChild(this.createSpinButton());
            controlPanelContainer.addChild(this.createLinesMeterView());
            controlPanelContainer.addChild(this.createStakeMeterView());
            controlPanelContainer.addChild(this.createWinMeterView());
            this._stopAutoplayButtonView.construct(this._scalar);
            controlPanelContainer.addChild(this._stopAutoplayButtonView);
            this._totalBetMeter.construct(true, this._scalar);
            controlPanelContainer.addChild(this._totalBetMeter);
            this._infoMeter.construct(true, this._scalar);
            controlPanelContainer.addChild(this._infoMeter);
            controlPanelContainer.x = game.BaseGameUIConstants.kDesktopBaseControlPanelX;
            controlPanelContainer.y = game.BaseGameUIConstants.kDesktopBaseControlPanelY;
            return controlPanelContainer;
        };
        DesktopUIView.prototype.createSpinButton = function () {
            // Get spin button graphic
            this.spinButton = this.getButton(game.BaseGameBundle.RG_Buttons.name, game.BaseGameBundle.RG_ButtonsJson.name, [
                "button_on.png",
                "button_dim.png",
                "button_over.png",
                "button_dim.png"
            ]);
            // scale button
            this.spinButton.scaleX = game.BaseGameUIConstants.kDesktopSpinButtonScaleX;
            this.spinButton.scaleY = game.BaseGameUIConstants.kDesktopSpinButtonScaleX;
            // add spin icon bitmap to spin button
            var spinIconAsset = Utils.MiscUtils.getAssetFrameWithName("spin_icon.png", game.BaseGameBundle.RG_Buttons.name, game.BaseGameBundle.RG_ButtonsJson.name, this._cache);
            var spinIconBitmap = new rendering.Bitmap(spinIconAsset);
            spinIconBitmap.scaleX = -1.2;
            spinIconBitmap.scaleY = 1.2;
            spinIconBitmap.x = 160;
            spinIconBitmap.y = 32;
            spinIconBitmap.interactive = false;
            this.spinButton.addChild(spinIconBitmap);
            // position spin button container
            this.spinButton.x = game.BaseGameUIConstants.kDesktopSpinX;
            this.spinButton.y = game.BaseGameUIConstants.kDesktopSpinY;
            this.spinButton.setMouseoverCursor();
            return this.spinButton;
        };
        DesktopUIView.prototype.createPaytableButton = function () {
            var paytableButtonContainer = new rendering.DisplayObjectContainer();
            // Get spin button graphic
            this.helpButton = this.getButton(game.BaseGameBundle.RG_Buttons.name, game.BaseGameBundle.RG_ButtonsJson.name, [
                "button_on.png",
                "button_dim.png",
                "button_over.png",
                "button_dim.png"
            ]);
            paytableButtonContainer.addChild(this.helpButton);
            var paytableIconAsset = Utils.MiscUtils.getAssetFrameWithName("paytables.png", game.BaseGameBundle.RG_Buttons.name, game.BaseGameBundle.RG_ButtonsJson.name, this._cache);
            var paytableIconBitmap = new rendering.Bitmap(paytableIconAsset);
            // control panel position
            paytableIconBitmap.x = game.BaseGameUIConstants.kDesktopPaytableButtonIconX;
            paytableIconBitmap.y = game.BaseGameUIConstants.kDesktopPaytableButtonIconY;
            // scale paytable icon
            paytableIconBitmap.scaleX = game.BaseGameUIConstants.kDesktopPaytableButtonIconScaleX;
            paytableIconBitmap.scaleY = game.BaseGameUIConstants.kDesktopPaytableButtonIconScaleY;
            paytableIconBitmap.interactive = false;
            // add spin icon to spin button
            this.helpButton.addChild(paytableIconBitmap);
            // scale button
            this.helpButton.scaleX = game.BaseGameUIConstants.kDesktopPaytableButtonScaleX;
            this.helpButton.scaleY = game.BaseGameUIConstants.kDesktopPaytableButtonScaleY;
            // position spin button container
            paytableButtonContainer.x = game.BaseGameUIConstants.kDesktopPaytableButtonX;
            paytableButtonContainer.y = game.BaseGameUIConstants.kDesktopPaytableButtonY;
            this.helpButton.setMouseoverCursor();
            return paytableButtonContainer;
        };
        DesktopUIView.prototype.createAutoplayButton = function () {
            var autoplayButtonContainer = new rendering.DisplayObjectContainer();
            this.autoplayButton = this.getButton(game.BaseGameBundle.RG_Buttons.name, game.BaseGameBundle.RG_ButtonsJson.name, [
                "button_on.png",
                "button_dim.png",
                "button_over.png",
                "button_dim.png"
            ]);
            autoplayButtonContainer.addChild(this.autoplayButton);
            var autoplayIconBitmap = new rendering.Bitmap(Utils.MiscUtils.getAssetFrameWithName("autoplaybutton.png", game.BaseGameBundle.RG_Buttons.name, game.BaseGameBundle.RG_ButtonsJson.name, this._cache));
            autoplayIconBitmap.x = game.BaseGameUIConstants.kDesktopAutoplayButtonIconX;
            autoplayIconBitmap.y = game.BaseGameUIConstants.kDesktopAutoplayButtonIconY;
            autoplayIconBitmap.scaleX = autoplayIconBitmap.scaleY = game.BaseGameUIConstants.kDesktopAutoplayButtonIconScale;
            autoplayIconBitmap.interactive = false;
            this.autoplayButton.addChild(autoplayIconBitmap);
            // scale button
            this.autoplayButton.scaleX = this.autoplayButton.scaleY = game.BaseGameUIConstants.kDesktopAutoplayButtonScale;
            autoplayButtonContainer.x = game.BaseGameUIConstants.kDesktopAutoplayButtonX;
            autoplayButtonContainer.y = game.BaseGameUIConstants.kDesktopAutoplayButtonY;
            this.autoplayButton.setMouseoverCursor();
            this.autoplayButton.visible = false;
            return autoplayButtonContainer;
        };
        DesktopUIView.prototype.createWinMeterView = function () {
            var meterView = new rendering.DisplayObjectContainer();
            var txtStr = this._translator.findByKey("framework_com_wms_framework_Dash_Win");
            var label = Utils.MiscUtils.createText(meterView, txtStr, 40, rendering.TextAlign.CENTER, [500, 100], [46, 70], game.BaseGameUIConstants.kDesktopMeterLabelTextColour, null, 0, false, "plain", false, false);
            Utils.MiscUtils.centreReg(label, this._scalar);
            // the meter itself
            this._winMeter.setProperties(0, 0, 200, 150, game.BaseGameUIConstants.kFontFamily, 80, "#ffffff", rendering.TextAlign.CENTER);
            // this._winMeter.meter.text.debug = true;
            this._winMeter.value = "";
            this._winMeter.x = -50;
            this._winMeter.y = -50;
            this._winMeter.isDesktopUI = true;
            meterView.addChild(this._winMeter);
            meterView.x = game.BaseGameUIConstants.kDesktopWinMeterContainerX;
            meterView.y = game.BaseGameUIConstants.kDesktopWinMeterContainerY;
            return meterView;
        };
        DesktopUIView.prototype.createLinesMeterView = function () {
            var meterView = new rendering.DisplayObjectContainer();
            // Add the text
            var txtStr = this._translator.findByKey("framework_com_wms_framework_Dash_Lines");
            var label = Utils.MiscUtils.createStyledText(txtStr, game.BaseGameUIConstants.kFontFamily, 30, rendering.TextAlign.CENTER, game.BaseGameUIConstants.kDesktopMeterLabelTextColour, 130, 40, // width/height
            ["#000000"], [1], // outline colours / thickness
            48, 86, // offset
            40, false, true // lineheight, debug, dropshadow
            );
            for (var i = 0; i < label.length; ++i) {
                meterView.addChild(label[i]);
            }
            // meter showing lines
            // this._linesMeter.construct(this._cache);
            this._linesMeter.setProperties(0, 0, 200, 100, game.BaseGameUIConstants.kFontFamily, 56, "#ffffff", rendering.TextAlign.CENTER);
            this._linesMeter.value = "";
            this._linesMeter.x = 15;
            meterView.addChild(this._linesMeter);
            meterView.x = game.BaseGameUIConstants.kDesktopLinesMeterContainerX;
            meterView.y = game.BaseGameUIConstants.kDesktopLinesMeterContainerY;
            return meterView;
        };
        DesktopUIView.prototype.createStakeMeterView = function () {
            var meterView = new rendering.DisplayObjectContainer();
            // label
            var txtStr = this._translator.findByKey("framework_com_wms_framework_Dash_Bet");
            var label = Utils.MiscUtils.createStyledText(txtStr, game.BaseGameUIConstants.kFontFamily, 30, rendering.TextAlign.CENTER, game.BaseGameUIConstants.kDesktopMeterLabelTextColour, 175, 40, // width/height
            ['#000000'], [1], // outline colours / thickness
            -10, 66, // offset
            40, false, true // lineheight, debug, dropshadow
            );
            for (var i = 0; i < label.length; i++) {
                meterView.addChild(label[i]);
            }
            // the meter itself
            this._stakeMeter.construct(this._cache);
            this._stakeMeter.setProperties(0, 0, 140, 60, game.BaseGameUIConstants.kFontFamily, 56, "#ffffff", rendering.TextAlign.CENTER);
            this._stakeMeter.value = "";
            meterView.addChild(this._stakeMeter);
            this._stakeMeter.incButton.x = 185;
            this._stakeMeter.incButton.y = -15;
            this._stakeMeter.decButton.x = 150;
            this._stakeMeter.decButton.y = 38;
            meterView.x = game.BaseGameUIConstants.kDesktopStakeMeterContainerX;
            meterView.y = game.BaseGameUIConstants.kDesktopStakeMeterContainerY;
            this.incStakeButton = this._stakeMeter.incButton;
            this.decStakeButton = this._stakeMeter.decButton;
            return meterView;
        };
        // protected createTotalBetMeterView(): rendering.DisplayObjectContainer {
        //     var meterView: rendering.DisplayObjectContainer = new rendering.DisplayObjectContainer();
        // Add the text
        // var txtStr: string = this._translator.findByKey("framework_com_wms_framework_Dash_TotalBet");
        // var label = Utils.MiscUtils.createText(meterView, txtStr, 30, rendering.TextAlign.CENTER, [225, 100], [113, 118], BaseGameUIConstants.kDesktopMeterLabelTextColour, null, 0, false, "plain", false, false);
        // Utils.MiscUtils.centreReg(label, this._scalar);
        // // meter showing total stake amount
        // this._totalBetMeter.setProperties(0, 0, 200, 100, BaseGameUIConstants.kFontFamily, 56, "#ffffff", rendering.TextAlign.CENTER);
        // this._totalBetMeter.value = "";
        // this._totalBetMeter.x = 110;
        // this._totalBetMeter.y = 50;
        // this._totalBetMeter.isDesktopUI = true;
        // meterView.addChild(this._totalBetMeter);
        // meterView.x = BaseGameUIConstants.kDesktopTotalBetMeterContainerX;
        // meterView.y = BaseGameUIConstants.kDesktopTotalBetMeterContainerY;
        //     return meterView;
        // }
        DesktopUIView.prototype.setAutoplayEnabled = function (enabled) {
            this.autoplayButton.visible = enabled;
        };
        __decorate([
            inject('IDeviceClassDetector')
        ], DesktopUIView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], DesktopUIView.prototype, "_launchParams", void 0);
        __decorate([
            inject('DeviceContext')
        ], DesktopUIView.prototype, "_device", void 0);
        __decorate([
            inject('LinesMeterView')
        ], DesktopUIView.prototype, "_linesMeter", void 0);
        __decorate([
            inject('StakeMeterView')
        ], DesktopUIView.prototype, "_stakeMeter", void 0);
        __decorate([
            inject('TotalBetMeterView')
        ], DesktopUIView.prototype, "_totalBetMeter", void 0);
        __decorate([
            inject('InfoBarMeterView')
        ], DesktopUIView.prototype, "_infoMeter", void 0);
        __decorate([
            inject('GameButtonGroup')
        ], DesktopUIView.prototype, "_gameButtonGroup", void 0);
        __decorate([
            inject('ITranslator')
        ], DesktopUIView.prototype, "_translator", void 0);
        __decorate([
            inject('StopAutoplayButtonView')
        ], DesktopUIView.prototype, "_stopAutoplayButtonView", void 0);
        __decorate([
            inject('WinMeterView')
        ], DesktopUIView.prototype, "_winMeter", void 0);
        return DesktopUIView;
    }(game.SubgameView));
    game.DesktopUIView = DesktopUIView;
})(game || (game = {}));
var game;
(function (game) {
    var MobileUIBottomButtonsView = (function (_super) {
        __extends(MobileUIBottomButtonsView, _super);
        function MobileUIBottomButtonsView() {
            _super.apply(this, arguments);
            this.animationDuration = 0.2;
            this._toggleInProgress = false;
            this._btnProps = {
                "_backBtn": {
                    bundle: "CF_Buttons",
                    frames: ["back_icon.png", "back_icon_dim.png", "back_icon.png", "back_icon_dim.png"],
                    x: 35,
                    y: 815
                },
                "_settingsBtn": {
                    bundle: "CF_Buttons",
                    frames: ["settings_icon.png", "settings_icon_dim.png", "settings_icon.png", "settings_icon_dim.png"],
                    x: 35,
                    y: 700
                }
            };
        }
        MobileUIBottomButtonsView.prototype.construct = function (isMobileUI) {
            if (isMobileUI === void 0) { isMobileUI = false; }
            _super.prototype.construct.call(this, isMobileUI);
            Utils.PSLog.log("MobileUIBottomButtonsView.construct()");
            // "sgi_mobile_menu_bar.png"
            this.menuOpenBack = Utils.MiscUtils.addBitmap(this, this._cache, game.BaseGameBundle, "CF_BaseUI", "sgi_menu_expanded.png", 0, 642, false, this._scalar);
            this.getNativeDisplayObject().setChildIndex(this.menuOpenBack.getNativeDisplayObject(), 0);
            // this.menuOpenBack.visible = false;
            this.menuClosedBack = Utils.MiscUtils.addBitmap(this, this._cache, game.BaseGameBundle, "CF_BaseUI", "sgi_menu_small.png", 0, 912, false, this._scalar);
            this.getNativeDisplayObject().setChildIndex(this.menuClosedBack.getNativeDisplayObject(), 1);
            this.menuOpenMask = new rendering.Graphics();
            this.menuOpenMask.beginFill(0xff0000, 0.2);
            this.menuOpenMask.drawRect(0, 638, 140, 290);
            this.menuOpenMask.endFill();
            this.menuOpenMask.interactive = false;
            this.addChild(this.menuOpenMask);
            this.menuOpenBack.mask = this.menuOpenMask;
            this.menuClosedMask = new rendering.Graphics();
            this.menuClosedMask.beginFill(0x00ff00, 0.2);
            this.menuClosedMask.drawRect(0, 927, 140, 400);
            this.menuClosedMask.endFill();
            this.menuClosedMask.interactive = false;
            this.addChild(this.menuClosedMask);
            this.menuClosedBack.mask = this.menuClosedMask;
            this.buttonsMask = new rendering.Graphics();
            this.buttonsMask.beginFill(0x00ff00, 0.2);
            this.buttonsMask.drawRect(0, 0, 136, 290);
            this.buttonsMask.endFill();
            this.buttonsMask.interactive = false;
            this.buttonsMask.y = 646;
            this.addChild(this.buttonsMask);
            this._buttonsContainer.mask = this.buttonsMask;
        };
        MobileUIBottomButtonsView.prototype.getButtonsContainer = function () {
            var bc = new rendering.DisplayObjectContainer();
            this.addChild(bc);
            return bc;
        };
        MobileUIBottomButtonsView.prototype.showMenu = function (boo, shouldAnimate) {
            if (boo === void 0) { boo = true; }
            if (shouldAnimate === void 0) { shouldAnimate = true; }
            if (this.menuOpenBack.visible !== boo) {
                this.toggleMenu(shouldAnimate);
            }
        };
        MobileUIBottomButtonsView.prototype.toggleMenu = function (shouldAnimate) {
            var _this = this;
            var tweenDist = 290;
            if (!this.menuOpenBack.visible) {
                this.menuOpenBack.visible = !this.menuOpenBack.visible;
                this.menuClosedMask.y += 5;
                if (!shouldAnimate) {
                    this.buttonsMask.scaleY = 1;
                    this.buttonsMask.y -= tweenDist;
                    this.menuOpenBack.y -= tweenDist;
                }
                else {
                    TweenLite.to(this.buttonsMask, this.animationDuration, { ease: Linear.easeNone, scaleY: 1 });
                    TweenLite.to(this.buttonsMask, this.animationDuration, { ease: Linear.easeNone, y: "-=" + tweenDist });
                    TweenLite.to(this.menuOpenBack, this.animationDuration, { ease: Linear.easeNone, y: "-=" + tweenDist });
                }
            }
            else {
                if (!shouldAnimate) {
                    this.buttonsMask.scaleY = 0;
                    this.buttonsMask.y += tweenDist;
                    this.menuOpenBack.y += tweenDist;
                    this.menuOpenBack.visible = !this.menuOpenBack.visible;
                    this.menuClosedMask.y -= 5;
                }
                else {
                    TweenLite.to(this.buttonsMask, this.animationDuration, { ease: Linear.easeNone, scaleY: 0 });
                    TweenLite.to(this.buttonsMask, this.animationDuration, { ease: Linear.easeNone, y: "+=" + tweenDist });
                    TweenLite.to(this.menuOpenBack, this.animationDuration, { ease: Linear.easeNone, y: "+=" + tweenDist,
                        onComplete: function () {
                            _this.menuOpenBack.visible = !_this.menuOpenBack.visible;
                            _this.menuClosedMask.y -= 5;
                        }
                    });
                }
            }
        };
        return MobileUIBottomButtonsView;
    }(game.AbstractUIBottomButtonsView));
    game.MobileUIBottomButtonsView = MobileUIBottomButtonsView;
})(game || (game = {}));
var game;
(function (game) {
    var MobileUIBottomButtonsViewMediator = (function (_super) {
        __extends(MobileUIBottomButtonsViewMediator, _super);
        function MobileUIBottomButtonsViewMediator() {
            _super.apply(this, arguments);
        }
        MobileUIBottomButtonsViewMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this.view = this.view;
            Utils.PSLog.log("MobileUIBottomButtonsViewMediator::onAdded()");
            this.addContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinStarted);
            this.addContextListener(game.GameEvent.MENU_BUTTON_PRESSED_IN, this.onMainMenuOpen);
            this.addContextListener(game.GameEvent.MOBILE_MENU_CLOSE, this.onMainMenuClosed);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_OPEN, this.onPopoutMenuOpen);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_CLOSE, this.onPopoutMenuClose);
            this.addContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.stateChange);
            this.addContextListener(game.ExternalEvent.START_AUTOPLAY, this.onStartAutoplay);
            this.addContextListener(game.ExternalEvent.STOP_AUTOPLAY, this.onStopAutoplay);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
        };
        MobileUIBottomButtonsViewMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.GameEvent.SPIN_BUTTON_PRESSED, this.onSpinStarted);
            this.removeContextListener(game.GameEvent.MENU_BUTTON_PRESSED_IN, this.onMainMenuOpen);
            this.removeContextListener(game.GameEvent.MOBILE_MENU_CLOSE, this.onMainMenuClosed);
            this.removeContextListener(game.GameStateEvent.EnterState(game.Subgame.BASE_GAME, "idle"), this.stateChange);
            this.removeContextListener(game.ExternalEvent.START_AUTOPLAY, this.onStartAutoplay);
            this.removeContextListener(game.ExternalEvent.STOP_AUTOPLAY, this.onStopAutoplay);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
        };
        MobileUIBottomButtonsViewMediator.prototype.stateChange = function (e) {
            if (!this._autoplayModel.isInProgress()) {
                this.showMenu();
            }
        };
        MobileUIBottomButtonsViewMediator.prototype.onPopoutMenuOpen = function (e) {
            this.hideMenu();
        };
        MobileUIBottomButtonsViewMediator.prototype.onPopoutMenuClose = function (e) {
            this.showMenu();
        };
        MobileUIBottomButtonsViewMediator.prototype.onMainMenuOpen = function (e) {
            this.hideMenu();
        };
        MobileUIBottomButtonsViewMediator.prototype.onMainMenuClosed = function (e) {
            this.showMenu();
        };
        MobileUIBottomButtonsViewMediator.prototype.onStartAutoplay = function (e) {
            this.hideMenu();
        };
        MobileUIBottomButtonsViewMediator.prototype.onStopAutoplay = function (e) {
            if (this._autoplayModel.isInProgress()) {
                this.showMenu();
            }
        };
        MobileUIBottomButtonsViewMediator.prototype.onSpinStarted = function (e) {
            this.hideMenu();
        };
        MobileUIBottomButtonsViewMediator.prototype.onEndResponse = function (e) {
            if (!this._autoplayModel.isInProgress()) {
                this.showMenu();
            }
        };
        MobileUIBottomButtonsViewMediator.prototype.onEnterIdleState = function (e) {
            _super.prototype.onEnterIdleState.call(this, e);
        };
        MobileUIBottomButtonsViewMediator.prototype.hideMenu = function (shouldAnimate) {
            if (shouldAnimate === void 0) { shouldAnimate = true; }
            this.view.showMenu(false, shouldAnimate);
        };
        MobileUIBottomButtonsViewMediator.prototype.showMenu = function (shouldAnimate) {
            if (shouldAnimate === void 0) { shouldAnimate = true; }
            this.view.showMenu(true, shouldAnimate);
        };
        MobileUIBottomButtonsViewMediator.prototype.toggleMenu = function (shouldAnimate) {
            if (shouldAnimate === void 0) { shouldAnimate = true; }
            this.view.showMenu(null, shouldAnimate);
        };
        __decorate([
            inject('AutoPlayModel')
        ], MobileUIBottomButtonsViewMediator.prototype, "_autoplayModel", void 0);
        return MobileUIBottomButtonsViewMediator;
    }(game.AbstractUIBottomButtonsViewMediator));
    game.MobileUIBottomButtonsViewMediator = MobileUIBottomButtonsViewMediator;
})(game || (game = {}));
var game;
(function (game) {
    var MobileUIMediator = (function (_super) {
        __extends(MobileUIMediator, _super);
        function MobileUIMediator() {
            _super.apply(this, arguments);
        }
        MobileUIMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            Utils.PSLog.log("MobileUIMediator::onAdded()");
            this.addContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_CONTENT_CHANGED, this.onMobilePopoutMenuContentChanged);
            this.addContextListener(game.ExternalEvent.START_AUTOPLAY, this.onStartAutoplay);
            this.addContextListener(game.AutoPlayModelEvent.STOPPED, this.onAutoplayStopped);
            this.addContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.addContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.view.addEventListener(game.GameEvent.MOBILE_SPIN_BUTTON_FULLY_VISIBLE, this.broadcastGameEvent, this);
            this.view.addEventListener(game.AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED, this.broadcastGameEvent, this);
        };
        MobileUIMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            Utils.PSLog.log("MobileUIMediator::onRemove()");
            this.removeContextListener(game.ExternalEvent.RESET_HARD, this.onHardReset);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_CONTENT_CHANGED, this.onMobilePopoutMenuContentChanged);
            this.removeContextListener(game.ExternalEvent.START_AUTOPLAY, this.onStartAutoplay);
            this.removeContextListener(game.AutoPlayModelEvent.STOPPED, this.onAutoplayStopped);
            this.removeContextListener(game.AutoPlayModelEvent.NEXT, this.onNextAutoplay);
            this.removeContextListener(server.ServerResponseEvent.END_RESPONSE, this.onEndResponse);
            this.view.removeEventListener(game.GameEvent.MOBILE_SPIN_BUTTON_FULLY_VISIBLE, this.broadcastGameEvent, this);
            this.view.removeEventListener(game.AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED, this.broadcastGameEvent, this);
        };
        MobileUIMediator.prototype.broadcastGameEvent = function (e) {
            this.context.parent.eventDispatcher.dispatchEvent(e);
        };
        MobileUIMediator.prototype.onHardReset = function () {
            this.view.resetButtonStates();
        };
        MobileUIMediator.prototype.onMobilePopoutMenuContentChanged = function (e) {
            this.currentMenuContent = e.id;
        };
        MobileUIMediator.prototype.onStartAutoplay = function (e) {
            this.view.setAutoplayCountText(this._autoplayModel.numSpins);
            this.view.showAutoplayButton();
        };
        MobileUIMediator.prototype.onAutoplayStopped = function (e) {
            this.view.hideAutoplayButton();
        };
        MobileUIMediator.prototype.onNextAutoplay = function (e) {
            this.view.setAutoplayCountText(this._autoplayModel.numSpins);
        };
        MobileUIMediator.prototype.onEndResponse = function (e) {
            if (this._autoplayModel.isInProgress() && this._autoplayModel.numSpins > 0) {
                return;
            }
            this.view.hideAutoplayButton();
        };
        __decorate([
            inject('AutoPlayModel')
        ], MobileUIMediator.prototype, "_autoplayModel", void 0);
        return MobileUIMediator;
    }(game.AbstractUIMediator));
    game.MobileUIMediator = MobileUIMediator;
})(game || (game = {}));
var game;
(function (game) {
    var MobileUIPopoutMenuMediator = (function (_super) {
        __extends(MobileUIPopoutMenuMediator, _super);
        function MobileUIPopoutMenuMediator() {
            _super.apply(this, arguments);
            this._visible = false;
            this._isAnimating = false;
        }
        MobileUIPopoutMenuMediator.prototype.onAdded = function () {
            _super.prototype.onAdded.call(this);
            this._view = this.getViewComponent();
            this.addContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeModelChanged);
            //this.addContextListener(AutoPlayModelEvent.INITIALISED, this.onAutoplayInitialised);
            this.addContextListener(game.GameEvent.MOBILE_CHEVRON_BUTTON_PRESSED, this.toggleVisibility);
            this.addContextListener(game.GameEvent.HELP_BUTTON_PRESSED, this.onHelpOpened);
            this.addContextListener(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this.onHelpClosed);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START, this.onMobilePopoutMenuAnimationStart);
            this.addContextListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END, this.onMobilePopoutMenuAnimationEnd);
            this._view.addEventListener(game.GameEvent.AUTOPLAY_BUTTON_PRESSED, this.onAutoplayButtonPressed, this);
            this._view.addEventListener(game.GameEvent.HELP_BUTTON_PRESSED, this.doGlobalDispatch, this);
            this._view.addEventListener(game.GameEvent.MOBILE_POPOUT_MENU_OPEN, this.doGlobalDispatch, this);
            this._view.addEventListener(game.GameEvent.MOBILE_POPOUT_MENU_CLOSE, this.doGlobalDispatch, this);
            this._view.addEventListener(game.GameEvent.MOBILE_POPOUT_MENU_CONTENT_CHANGED, this.doGlobalDispatch, this);
            this._view.addEventListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START, this.doGlobalDispatch, this);
            this._view.addEventListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END, this.doGlobalDispatch, this);
        };
        MobileUIPopoutMenuMediator.prototype.onRemove = function () {
            _super.prototype.onRemove.call(this);
            this.removeContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeModelChanged);
            //this.removeContextListener(AutoPlayModelEvent.INITIALISED, this.onAutoplayInitialised);
            this.removeContextListener(game.GameEvent.MOBILE_CHEVRON_BUTTON_PRESSED, this.toggleVisibility);
            this.removeContextListener(game.GameEvent.HELP_BUTTON_PRESSED, this.onHelpOpened);
            this.removeContextListener(game.GameEvent.HELP_CLOSE_BUTTON_PRESSED, this.onHelpClosed);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START, this.onMobilePopoutMenuAnimationStart);
            this.removeContextListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END, this.onMobilePopoutMenuAnimationEnd);
            this._view.removeEventListener(game.GameEvent.AUTOPLAY_BUTTON_PRESSED, this.onAutoplayButtonPressed, this);
            this._view.removeEventListener(game.GameEvent.HELP_BUTTON_PRESSED, this.doGlobalDispatch, this);
            this._view.removeEventListener(game.GameEvent.MOBILE_POPOUT_MENU_OPEN, this.doGlobalDispatch, this);
            this._view.removeEventListener(game.GameEvent.MOBILE_POPOUT_MENU_CLOSE, this.doGlobalDispatch, this);
            this._view.removeEventListener(game.GameEvent.MOBILE_POPOUT_MENU_CONTENT_CHANGED, this.doGlobalDispatch, this);
            this._view.removeEventListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START, this.doGlobalDispatch, this);
            this._view.removeEventListener(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END, this.doGlobalDispatch, this);
        };
        MobileUIPopoutMenuMediator.prototype.toggleVisibility = function () {
            var _this = this;
            if (this._isAnimating) {
                return;
            }
            this._isAnimating = true;
            this._view.setIsAnimatingFlag(true);
            if (!this._visible) {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_OPEN, this));
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START, this));
                TweenLite.to(this._view, 0.5, {
                    x: 0,
                    onComplete: function () {
                        _this._visible = true;
                        _this._isAnimating = false;
                        _this._view.setIsAnimatingFlag(false);
                        _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END, _this));
                    }
                });
            }
            else {
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_CLOSE, this));
                this.doGlobalDispatch(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START, this));
                TweenLite.to(this._view, 0.5, {
                    x: 500,
                    onComplete: function () {
                        _this._visible = false;
                        _this._isAnimating = false;
                        _this._view.setIsAnimatingFlag(false);
                        _this.doGlobalDispatch(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END, _this));
                        _this._view.populate(game.MobileUIPopoutMenuContent.DEFAULT);
                        _this._view.resetStakeBetSpinner();
                    }
                });
            }
        };
        MobileUIPopoutMenuMediator.prototype.doGlobalDispatch = function (e) {
            this.context.eventDispatcher.dispatchEvent(e);
        };
        MobileUIPopoutMenuMediator.prototype.onStakeModelChanged = function (e) {
            this._view.addTotalBetMenuContent();
            this.removeContextListener(game.StakeModelEvent.STAKE_MODEL_CHANGED, this.onStakeModelChanged);
            this._view.resetStakeBetSpinner();
        };
        MobileUIPopoutMenuMediator.prototype.onAutoplayButtonPressed = function (e) {
            if (this._visible) {
                this.toggleVisibility();
            }
            this.doGlobalDispatch(new game.GameEvent(game.GameEvent.AUTOPLAY_BUTTON_PRESSED));
        };
        MobileUIPopoutMenuMediator.prototype.onHelpOpened = function () {
            this._view.toggleMenuButtonStates(false);
        };
        MobileUIPopoutMenuMediator.prototype.onHelpClosed = function () {
            this._view.toggleMenuButtonStates(true);
        };
        MobileUIPopoutMenuMediator.prototype.onMobilePopoutMenuAnimationStart = function () {
            this._view.toggleMenuButtonStates(false);
        };
        MobileUIPopoutMenuMediator.prototype.onMobilePopoutMenuAnimationEnd = function () {
            this._view.toggleMenuButtonStates(true);
        };
        __decorate([
            inject('AutoPlayModel')
        ], MobileUIPopoutMenuMediator.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('GameServer')
        ], MobileUIPopoutMenuMediator.prototype, "_server", void 0);
        __decorate([
            inject('StakeModel')
        ], MobileUIPopoutMenuMediator.prototype, "_stakeModel", void 0);
        return MobileUIPopoutMenuMediator;
    }(dragonwings.Mediator));
    game.MobileUIPopoutMenuMediator = MobileUIPopoutMenuMediator;
})(game || (game = {}));
/// <reference path="../../../BaseClasses/ValueSpinner.ts" />
var game;
(function (game) {
    var MobileUIPopoutMenuView = (function (_super) {
        __extends(MobileUIPopoutMenuView, _super);
        function MobileUIPopoutMenuView() {
            _super.apply(this, arguments);
            this.menuOpen = false;
            this.popoutMenuAnimating = false;
            this._allowMenu = true;
            this.popoutMenuOpen = false;
        }
        MobileUIPopoutMenuView.prototype.construct = function () {
            Utils.PSLog.log("MobileUIPopoutMenuView::construct()");
            this._scalar = this._device.getScalar();
            this.uiElements = new Object();
            var back = this.drawMenuBack(1500, 50, 1200, 950, 0x000000, 0.7, ["left", "left"], 20, 80, 760);
            back.alpha = 0.7;
            this.addChild(back);
            this.x += 500;
            this.addDefaultMenuContent();
        };
        /**
         * Make the mobile menu background
         */
        MobileUIPopoutMenuView.prototype.drawMenuBack = function (x, y, width, height, colour, alpha, anchorXY, radius, buttonRadius, buttonY, scalar) {
            if (scalar === void 0) { scalar = 0; }
            var g = new rendering.Graphics();
            var rads = 0.0174533;
            g.beginFill(colour, alpha);
            //start rectangle top line
            g.moveTo(radius, 0);
            g.lineTo(width - radius, 0);
            g.arc(width - radius, radius, radius, 270 * rads, 0);
            g.lineTo(width, height - radius);
            g.arc(width - radius, height - radius, radius, 0, 90 * rads);
            g.lineTo(radius, height);
            g.arc(radius, height - radius, radius, 90 * rads, 180 * rads);
            //insert the chunk 'bitten out' of the menu back, that the button slots into
            g.lineTo(0, buttonY + radius);
            g.arc(0, buttonY, buttonRadius, -90 * rads, 90 * rads);
            //end of chunk
            g.lineTo(0, radius);
            g.arc(radius, radius, radius, 180 * rads, 270 * rads);
            g.endFill();
            g.x = x + (anchorXY[0] == "centre" ? -(width >> 1) : (anchorXY[0] == "right" ? -width : 0));
            g.y = y + (anchorXY[1] == "centre" ? -(height >> 1) : (anchorXY[0] == "bottom" ? -height : 0));
            if (scalar > 0) {
                Utils.MiscUtils.centreReg(g, scalar);
            }
            return g;
        };
        MobileUIPopoutMenuView.prototype.onHelpButtonPressed = function (e) {
            if (this._isAnimating) {
                return;
            }
            this.dispatchEvent(new game.GameEvent(game.GameEvent.HELP_BUTTON_PRESSED));
        };
        MobileUIPopoutMenuView.prototype.onTotalBetButtonPressed = function (e) {
            if (this._isAnimating) {
                return;
            }
            this.switchMenuContent(game.MobileUIPopoutMenuContent.TOTAL_BET);
        };
        MobileUIPopoutMenuView.prototype.onAutoplayButtonPressed = function (e) {
            if (this._isAnimating) {
                return;
            }
            this.dispatchEvent(new game.GameEvent(game.GameEvent.AUTOPLAY_BUTTON_PRESSED));
        };
        MobileUIPopoutMenuView.prototype.onAcceptTotalBetButtonPressed = function (e) {
            Utils.PSLog.log("MobileUIPopoutMenuView::onAcceptTotalBetButtonPressed()");
            var currentValueIndex = this.stakeBetSpinner.getCurrentValue();
            this._stakeModel.setStakeByIndex(currentValueIndex);
            this.switchMenuContent(game.MobileUIPopoutMenuContent.DEFAULT);
        };
        MobileUIPopoutMenuView.prototype.onCancelTotalBetButtonPressed = function (e) {
            Utils.PSLog.log("MobileUIPopoutMenuView::onCancelTotalBetButtonPressed()");
            this.switchMenuContent(game.MobileUIPopoutMenuContent.DEFAULT);
            TweenLite.delayedCall(game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeed / 2, this.resetStakeBetSpinner.bind(this));
        };
        MobileUIPopoutMenuView.prototype.onAcceptAutoplayButtonPressed = function (e) {
            Utils.PSLog.log("MobileUIPopoutMenuView::onAcceptAutoplayButtonPressed()");
        };
        MobileUIPopoutMenuView.prototype.onCancelAutoplayButtonPressed = function (e) {
            Utils.PSLog.log("MobileUIPopoutMenuView::onCancelAutoplayButtonPressed()");
            this.switchMenuContent(game.MobileUIPopoutMenuContent.DEFAULT);
            TweenLite.delayedCall(game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeed / 2, this.resetAutoplaySpinners.bind(this));
        };
        MobileUIPopoutMenuView.prototype.resetStakeBetSpinner = function () {
            var curStakeIndex = this._stakeModel.getCurrStakeIdx();
            this.stakeBetSpinner.setByValueIndex(curStakeIndex);
        };
        MobileUIPopoutMenuView.prototype.resetAutoplaySpinners = function () {
            Utils.PSLog.log("MobileUIPopoutMenuView::resetAutoplaySpinners()");
        };
        MobileUIPopoutMenuView.prototype.addDefaultMenuContent = function () {
            this.uiElements[game.MobileUIPopoutMenuContent.DEFAULT] = [];
            var helppayIcon = this.getButton(game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, ["helppay_Icon.png", "helppay_Icon.png", "helppay_Icon.png", "helppay_Icon.png"]);
            helppayIcon.setPosition(1660, 150);
            helppayIcon.addEventListener(rendering.InputEvent.DOWN, this.onHelpButtonPressed, this);
            this.addChild(helppayIcon);
            this.uiElements[game.MobileUIPopoutMenuContent.DEFAULT].push(helppayIcon);
            var totalBetButton = this.getButton(game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, ["totalbet_icon.png", "totalbet_icon.png", "totalbet_icon.png", "totalbet_icon.png"]);
            totalBetButton.setPosition(1660, 475);
            totalBetButton.addEventListener(rendering.InputEvent.DOWN, this.onTotalBetButtonPressed, this);
            this.addChild(totalBetButton);
            this.uiElements[game.MobileUIPopoutMenuContent.DEFAULT].push(totalBetButton);
            if (this._autoplayModel.isEnabled()) {
                var autoplayButton = this.getButton(game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, ["autoplay_icon.png", "autoplay_icon.png", "autoplay_icon.png", "autoplay_icon.png"]);
                autoplayButton.setPosition(1660, 800);
                autoplayButton.addEventListener(rendering.InputEvent.DOWN, this.onAutoplayButtonPressed, this);
                this.addChild(autoplayButton);
                this.uiElements[game.MobileUIPopoutMenuContent.DEFAULT].push(autoplayButton);
            }
        };
        MobileUIPopoutMenuView.prototype.addTotalBetMenuContent = function () {
            var _this = this;
            this.uiElements[game.MobileUIPopoutMenuContent.TOTAL_BET] = [];
            var totalBetIndicatorAsset = Utils.MiscUtils.getAssetFrameWithName("autoplay_divider.png", game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, this._cache);
            var totalBetIndicatorBitmap = new rendering.Bitmap(totalBetIndicatorAsset);
            totalBetIndicatorBitmap.x = 1876;
            totalBetIndicatorBitmap.y = 295;
            totalBetIndicatorBitmap.interactive = false;
            totalBetIndicatorBitmap.visible = false;
            this.addChild(totalBetIndicatorBitmap);
            this.uiElements[game.MobileUIPopoutMenuContent.TOTAL_BET].push(totalBetIndicatorBitmap);
            var totalBetIconAsset = Utils.MiscUtils.getAssetFrameWithName("totalbet_icon.png", game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, this._cache);
            var totalBetBitmap = new rendering.Bitmap(totalBetIconAsset);
            totalBetBitmap.x = 1650;
            totalBetBitmap.y = 100;
            totalBetBitmap.interactive = false;
            totalBetBitmap.visible = false;
            this.addChild(totalBetBitmap);
            this.uiElements[game.MobileUIPopoutMenuContent.TOTAL_BET].push(totalBetBitmap);
            var betLineText = Utils.MiscUtils.createBasicText(this, "BET / LINE", 30, rendering.TextAlign.CENTER, [150, 50], [1720, 280], "#FFFFFF");
            betLineText.interactive = false;
            betLineText.visible = false;
            this.uiElements[game.MobileUIPopoutMenuContent.TOTAL_BET].push(betLineText);
            //get available stakes
            var initResponse = this._server.getInitResponse();
            var payLinesLen = initResponse.paylinesData.paylines.length;
            var availableStakes = [];
            initResponse.betData[0].availableBets.map(function (data) {
                var stake = _this._currencyFormatter.format(Number(data) / payLinesLen);
                availableStakes.push(stake);
            });
            this.stakeBetSpinner = new game.ValueSpinner(game.ValueSpinnerDirection.VERTICAL);
            this.stakeBetSpinner.x = 1620;
            this.stakeBetSpinner.y = 320;
            this.stakeBetSpinner.configure(300, 500, availableStakes, 250, 100, 180);
            this.stakeBetSpinner.visible = false;
            this.addChild(this.stakeBetSpinner);
            this.uiElements[game.MobileUIPopoutMenuContent.TOTAL_BET].push(this.stakeBetSpinner);
            // set current selected stake
            var curStakeIndex = this._stakeModel.getCurrStakeIdx();
            this.stakeBetSpinner.setByValueIndex(curStakeIndex);
            var acceptButon = this.getButton(game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, ["accept_icon.png", "accept_icon.png", "accept_icon.png", "accept_icon.png"]);
            acceptButon.setPosition(1580, 860);
            acceptButon.visible = false;
            acceptButon.addEventListener(rendering.InputEvent.DOWN, this.onAcceptTotalBetButtonPressed, this);
            this.addChild(acceptButon);
            this.uiElements[game.MobileUIPopoutMenuContent.TOTAL_BET].push(acceptButon);
            var cancelButon = this.getButton(game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, ["exit_icon.png", "exit_icon.png", "exit_icon.png", "exit_icon.png"]);
            cancelButon.setPosition(1780, 860);
            cancelButon.visible = false;
            cancelButon.addEventListener(rendering.InputEvent.DOWN, this.onCancelTotalBetButtonPressed, this);
            this.addChild(cancelButon);
            this.uiElements[game.MobileUIPopoutMenuContent.TOTAL_BET].push(cancelButon);
        };
        MobileUIPopoutMenuView.prototype.hideAllContent = function () {
            for (var i in this.uiElements) {
                for (var j = 0; j < this.uiElements[i].length; j++) {
                    this.uiElements[i][j].visible = false;
                }
            }
        };
        MobileUIPopoutMenuView.prototype.populate = function (content) {
            this.hideAllContent();
            for (var i in this.uiElements[content]) {
                this.uiElements[content][i].visible = true;
            }
            this.currentMenuContent = content;
            this.dispatchEvent(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_CONTENT_CHANGED, this, content));
        };
        MobileUIPopoutMenuView.prototype.switchMenuContent = function (content) {
            var _this = this;
            if (this._isAnimating) {
                return;
            }
            this.dispatchEvent(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_START));
            this.setIsAnimatingFlag(true);
            this.popoutMenuAnimating = true;
            var fullDur = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeed;
            var halfDur = fullDur / 2;
            var xDistR = this.currentMenuContent === game.MobileUIPopoutMenuContent.AUTOPLAY ? 1200 : 500;
            var xDistL = content === game.MobileUIPopoutMenuContent.AUTOPLAY ? 1200 : 500;
            TweenLite.to(this, halfDur, {
                x: "+=" + xDistR,
                delay: halfDur,
                onComplete: function () {
                    _this.populate(content);
                },
            });
            TweenLite.to(this, halfDur, {
                x: "-=" + xDistL,
                delay: fullDur,
                onComplete: function () {
                    _this.popoutMenuAnimating = false;
                    _this.dispatchEvent(new game.GameEvent(game.GameEvent.MOBILE_POPOUT_MENU_ANIMATION_END));
                    _this.setIsAnimatingFlag(false);
                },
            });
        };
        MobileUIPopoutMenuView.prototype.toggleMenuButtonStates = function (enable, toggleChevron) {
            if (toggleChevron === void 0) { toggleChevron = false; }
            for (var i in this.uiElements) {
                for (var j = 0; j < this.uiElements[i].length; j++) {
                    this.uiElements[i][j].interactive = enable;
                }
            }
        };
        MobileUIPopoutMenuView.prototype.setIsAnimatingFlag = function (isAnimating) {
            this._isAnimating = isAnimating;
        };
        __decorate([
            inject('AssetCache')
        ], MobileUIPopoutMenuView.prototype, "_cache", void 0);
        __decorate([
            inject('AutoPlayModel')
        ], MobileUIPopoutMenuView.prototype, "_autoplayModel", void 0);
        __decorate([
            inject('CurrencyFormatter')
        ], MobileUIPopoutMenuView.prototype, "_currencyFormatter", void 0);
        __decorate([
            inject('DeviceContext')
        ], MobileUIPopoutMenuView.prototype, "_device", void 0);
        __decorate([
            inject('StakeModel')
        ], MobileUIPopoutMenuView.prototype, "_stakeModel", void 0);
        __decorate([
            inject('GameServer')
        ], MobileUIPopoutMenuView.prototype, "_server", void 0);
        return MobileUIPopoutMenuView;
    }(game.SubgameView));
    game.MobileUIPopoutMenuView = MobileUIPopoutMenuView;
})(game || (game = {}));
var game;
(function (game) {
    var MobileUIView = (function (_super) {
        __extends(MobileUIView, _super);
        function MobileUIView() {
            _super.call(this);
            this.autoplayStopButtonAnimating = false;
            this.autoplayStopButtonShowing = false;
        }
        MobileUIView.prototype.construct = function () {
            this._scalar = this._device.getScalar();
            this.addChild(this.createControlPanel());
        };
        MobileUIView.prototype.getBalanceMeter = function () {
            return this._balanceMeter;
        };
        MobileUIView.prototype.getLinesMeter = function () {
            return this._linesMeter;
        };
        MobileUIView.prototype.getStakeMeter = function () {
            return this._stakeMeter;
        };
        MobileUIView.prototype.getTotalBetMeter = function () {
            return this._totalBetMeter;
        };
        MobileUIView.prototype.getWinMeter = function () {
            return this._winMeter;
        };
        MobileUIView.prototype.getInfoBarMeter = function () {
            return this._infoMeter;
        };
        MobileUIView.prototype.createControlPanel = function () {
            // create control panel container
            var controlPanelContainer = new rendering.DisplayObjectContainer();
            var dataBarAsset = Utils.MiscUtils.getAssetFrameWithName("sgi_mobile_data_bar.png", game.BaseGameBundle.CF_BaseUI.name, game.BaseGameBundle.CF_BaseUIJson.name, this._cache);
            var dataBarBitmap = new rendering.Bitmap(dataBarAsset);
            dataBarBitmap.x = game.BaseGameUIConstants.kMobilecontrolPanelX;
            dataBarBitmap.y = game.BaseGameUIConstants.kMobilecontrolPanelY;
            controlPanelContainer.addChild(dataBarBitmap);
            var isDesktop = (this._deviceClass.getDeviceClass() == util.DeviceClass.DESKTOP) && !this._launchParams.mobilePresentation;
            controlPanelContainer.addChild(this.createAutoplayButton());
            controlPanelContainer.addChild(this.createLinesMeterView());
            controlPanelContainer.addChild(this.createWinMeterView());
            this.createGameName(controlPanelContainer);
            // controlPanelContainer.addChild(this.createFSWinMeterView());
            this._totalBetMeter.construct(false, this._scalar);
            controlPanelContainer.addChild(this._totalBetMeter);
            controlPanelContainer.addChild(this.getBalanceMeter());
            this._infoMeter.construct(false, this._scalar, controlPanelContainer);
            controlPanelContainer.addChild(this._infoMeter);
            return controlPanelContainer;
        };
        MobileUIView.prototype.createUserMenu = function () {
            var userMenuContainer = new rendering.DisplayObjectContainer();
            var userMenuAsset = Utils.MiscUtils.getAssetFrameWithName("sgi_menu_expanded.png", game.BaseGameBundle.CF_BaseUI.name, game.BaseGameBundle.CF_BaseUIJson.name, this._cache);
            var userMenuBitmap = new rendering.Bitmap(userMenuAsset);
            userMenuBitmap.getNativeDisplayObject().anchor = new PIXI.Point(0, 1);
            userMenuContainer.addChild(userMenuBitmap);
            var settingsIcon = Utils.MiscUtils.addBitmap(userMenuContainer, this._cache, game.BaseGameBundle, "IFPM_Mobile_Buttons", "settings_icon.png", 85, -342, true, this._scalar);
            Utils.MiscUtils.centreReg(settingsIcon, this._scalar);
            settingsIcon.addEventListener(rendering.InputEvent.UP, this.onSettingsIconPressed, this);
            var backIcon = Utils.MiscUtils.addBitmap(userMenuContainer, this._cache, game.BaseGameBundle, "IFPM_Mobile_Buttons", "back_icon.png", 85, -220, true, this._scalar);
            Utils.MiscUtils.centreReg(backIcon, this._scalar);
            backIcon.addEventListener(rendering.InputEvent.UP, this.onBackToLobbyIconPressed, this);
            userMenuContainer.addChild(this._clockView);
            userMenuContainer.x = 0;
            userMenuContainer.y = 1080;
            return userMenuContainer;
        };
        MobileUIView.prototype.createAutoplayButton = function () {
            this.autoplayStopButtonContainer = new rendering.DisplayObjectContainer();
            this.autoplayButton = this.getButton(game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, [
                "stop_backer.png",
                "stop_backer.png",
                "stop_backer.png",
                "stop_backer.png"
            ]);
            this.autoplayStopButtonContainer.addChild(this.autoplayButton);
            // position autoplay button container hidden initially
            this.autoplayStopButtonContainer.x = game.BaseGameUIConstants.kMobileSpinX + 640;
            this.autoplayStopButtonContainer.y = game.BaseGameUIConstants.kMobileSpinY + 80;
            var autoplayStopIconAsset = Utils.MiscUtils.getAssetFrameWithName("autoplay_counter.png", game.BaseGameBundle.CF_Buttons.name, game.BaseGameBundle.CF_ButtonsJson.name, this._cache);
            this._autoplayStopIconBitmap = new rendering.Bitmap(autoplayStopIconAsset);
            this._autoplayStopIconBitmap.x = (this.autoplayButton.width / 2) - (this._autoplayStopIconBitmap.width / 2);
            this._autoplayStopIconBitmap.y = (this.autoplayButton.height / 2) - (this._autoplayStopIconBitmap.height / 2);
            this._autoplayStopIconBitmap.interactive = false;
            this.autoplayStopButtonContainer.addChild(this._autoplayStopIconBitmap);
            this.autoplayCount = Utils.MiscUtils.createBasicText(this.autoplayStopButtonContainer, "5", 38, rendering.TextAlign.CENTER, [50, 50], [0, 0], "#000000");
            Utils.MiscUtils.centreReg(this.autoplayCount, this._scalar);
            this.autoplayCount.x = this._autoplayStopIconBitmap.x + this._autoplayStopIconBitmap.width / 2;
            this.autoplayCount.y = this._autoplayStopIconBitmap.y + this._autoplayStopIconBitmap.height / 2;
            this.autoplayStopButtonContainer.addEventListener(rendering.InputEvent.DOWN, this.onAutoplayStopButtonPressed, this);
            return this.autoplayStopButtonContainer;
        };
        MobileUIView.prototype.createWinMeterView = function () {
            var meterView = new rendering.DisplayObjectContainer();
            // Add the text
            var translation = this._translator.findByKey("framework_com_wms_framework_Dash_Win");
            var txt = Utils.MiscUtils.createBasicText(meterView, translation, game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [90, 50], [180, 14], "#ffffff");
            var sep = Utils.MiscUtils.createBasicText(meterView, " : ", game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [90, 50], [230, 12], "#AA1F4E");
            // the meter itself
            this._winMeter.setProperties(0, 0, 150, 100, game.BaseGameUIConstants.kFontFamily, game.BaseGameUIConstants.kMobileBottomBarFontSize, "#ffffff", rendering.TextAlign.CENTER);
            // this._winMeter.meter.text.debug = true;
            this._winMeter.value = "";
            this._winMeter.x = 220;
            this._winMeter.y = 0;
            this._winMeter.isDesktopUI = true; // leave this as true so its value does not include the 'WIN' text as well
            meterView.addChild(this._winMeter);
            meterView.x = game.BaseGameUIConstants.kMobileWinMeterContainerX;
            meterView.y = game.BaseGameUIConstants.kMobileWinMeterContainerY;
            return meterView;
        };
        MobileUIView.prototype.createLinesMeterView = function () {
            var meterView = new rendering.DisplayObjectContainer();
            // Add the text
            var translation = this._translator.findByKey("framework_com_wms_framework_Dash_Lines");
            var txt = Utils.MiscUtils.createBasicText(meterView, translation, game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [90, 50], [180, 14], "#ffffff");
            var sep = Utils.MiscUtils.createBasicText(meterView, " : ", game.BaseGameUIConstants.kMobileBottomBarFontSize, rendering.TextAlign.CENTER, [90, 50], [244, 12], "#00416A");
            // meter showing lines
            this._linesMeter.setProperties(0, 0, 200, 100, game.BaseGameUIConstants.kFontFamily, game.BaseGameUIConstants.kMobileBottomBarFontSize, "#ffffff", rendering.TextAlign.CENTER);
            this._linesMeter.value = "";
            this._linesMeter.x = 186;
            this._linesMeter.y = -36;
            meterView.addChild(this._linesMeter);
            meterView.x = 1530;
            meterView.y = 1036;
            return meterView;
        };
        MobileUIView.prototype.createGameName = function (controlPanelContainer) {
            var text = Utils.MiscUtils.createBasicText(controlPanelContainer, "Crystal Forest HD", 28, rendering.TextAlign.CENTER, [450, 50], [0, 0], "#ffffff");
            text.pivot = new rendering.Point(text.width * 0.5, text.height * 0.5);
            text.x = 1050;
            text.y = 1000;
            return text;
        };
        MobileUIView.prototype.hideAutoplayButton = function (delay, duration) {
            var _this = this;
            if (delay === void 0) { delay = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf; }
            if (duration === void 0) { duration = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf; }
            if (this.autoplayStopButtonShowing && !this.autoplayStopButtonAnimating) {
                this.autoplayStopButtonAnimating = true;
                TweenLite.to(this.autoplayStopButtonContainer, duration, { delay: delay, x: "+=500", onComplete: function () {
                        _this.autoplayStopButtonAnimating = false;
                        _this.autoplayStopButtonShowing = false;
                    } });
            }
        };
        MobileUIView.prototype.showAutoplayButton = function (delay, duration) {
            var _this = this;
            if (delay === void 0) { delay = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf; }
            if (duration === void 0) { duration = game.BaseGameUIConstants.kMobileMiniMenuAnimationSpeedHalf; }
            if (!this.autoplayStopButtonShowing && !this.autoplayStopButtonAnimating) {
                this.autoplayStopButtonAnimating = true;
                TweenLite.to(this.autoplayStopButtonContainer, duration, { delay: delay, x: "-=500", onComplete: function () {
                        _this.autoplayStopButtonAnimating = false;
                        _this.autoplayStopButtonShowing = true;
                    } });
            }
        };
        MobileUIView.prototype.setAutoplayCountText = function (numSpins) {
            this.autoplayCount.text = numSpins.toString();
            var offsetDivide = numSpins > 9 ? 2.4 : 2;
            this.autoplayCount.x = this._autoplayStopIconBitmap.x + this._autoplayStopIconBitmap.width / offsetDivide;
        };
        MobileUIView.prototype.onAutoplayStopButtonPressed = function (e) {
            this.dispatchEvent(new game.AutoPlayModelEvent(game.AutoPlayModelEvent.STOP_AUTOPLAY_BUTTON_PRESSED, 0));
        };
        MobileUIView.prototype.onBackToLobbyIconPressed = function () {
            this._partnerAdapter['logics']['pageNavigator']['goToLobby']();
        };
        MobileUIView.prototype.onSettingsIconPressed = function () {
            this._settingsButtonHandler = this._partnerAdapter.setMenuHandler("SETTINGS", function () { });
            this._settingsButtonHandler({ open: true });
        };
        MobileUIView.prototype.resetAutoplayButtonState = function () {
            // Autoplay button should be hidden
            TweenMax.killTweensOf(this.autoplayStopButtonContainer);
            this.autoplayStopButtonShowing = false;
            this.autoplayStopButtonAnimating = false;
            // Reset position
            this.autoplayStopButtonContainer.x = game.BaseGameUIConstants.kMobileSpinX + 650;
            this.autoplayStopButtonContainer.y = game.BaseGameUIConstants.kMobileSpinY + 80;
        };
        MobileUIView.prototype.resetButtonStates = function () {
            this.resetAutoplayButtonState();
        };
        __decorate([
            inject('IDeviceClassDetector')
        ], MobileUIView.prototype, "_deviceClass", void 0);
        __decorate([
            inject('LaunchParametersModel')
        ], MobileUIView.prototype, "_launchParams", void 0);
        __decorate([
            inject('BalanceMeterView')
        ], MobileUIView.prototype, "_balanceMeter", void 0);
        __decorate([
            inject('DeviceContext')
        ], MobileUIView.prototype, "_device", void 0);
        __decorate([
            inject('LinesMeterView')
        ], MobileUIView.prototype, "_linesMeter", void 0);
        __decorate([
            inject('StakeMeterView')
        ], MobileUIView.prototype, "_stakeMeter", void 0);
        __decorate([
            inject('TotalBetMeterView')
        ], MobileUIView.prototype, "_totalBetMeter", void 0);
        __decorate([
            inject('InfoBarMeterView')
        ], MobileUIView.prototype, "_infoMeter", void 0);
        __decorate([
            inject('GameButtonGroup')
        ], MobileUIView.prototype, "_gameButtonGroup", void 0);
        __decorate([
            inject('ITranslator')
        ], MobileUIView.prototype, "_translator", void 0);
        __decorate([
            inject('PartnerAdapter')
        ], MobileUIView.prototype, "_partnerAdapter", void 0);
        __decorate([
            inject('WinMeterView')
        ], MobileUIView.prototype, "_winMeter", void 0);
        __decorate([
            inject('ClockView')
        ], MobileUIView.prototype, "_clockView", void 0);
        return MobileUIView;
    }(game.SubgameView));
    game.MobileUIView = MobileUIView;
})(game || (game = {}));
//# sourceMappingURL=main.js.map