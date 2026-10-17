// Make sure to namespace the code so it doesn't leak too much into the global namespace
var zeus3_prt;
(function (zeus3_prt) {
    /**
    * Main game implementation class
    */
    var Game = (function () {

        /************************************************************
         * Partner Adapter API
         *
        /**
        * Get the session data
        * /
        getSessionData(): partneradapterapi.ISessionData;

        /**
        * Get the root element that the game should create its view inside. Parents or siblings of
        * this element MUST NOT be manipulated or accessed by the game.
        * /
        getGameDomElement(): HTMLDivElement;

        /**
         * Shows the progress bar
         *
         * @param  isFullScreen  show in full screen mode
         * @param  displayPercentage  true to have percentage shown
         * /
        showProgressBar( isFullScreen: boolean, displayPercentage: boolean): void;

        /**
         * Hides the progress bar
         * /
        hideProgressBar(): void;

        /**
         * Update the progression of the loading bar
         *
         * @param  value  progress from 0.0 to 1.0 inclusive.
         * @param  message  loading message to display
         * /
        updatedLoadingProgress( value: number, message: string): void;

        /**
        * Inform that a new play has started i.e. a spin
        * /
        startedPlay(): void;

        /**
        * Inform that a play has ended i.e. a spin including bonus games and all that
        * /
        finishedPlay(): void;

        /**
        * When the game has finished showing all the win animation and such call this function
        * /
        finishedPostGameAnimations(): void;

        /**
        * When the game has received a response from the game server it should send this to the partner adapter
        * /
        receivedGameLogicResponse( response: XMLHttpRequest ):void;

        /**
         * Update the bet. Should be called on startup and when the user changes the bet.
         * @param bet in cents
         * /
        updateBet(bet: number):void;

        /**
        * Show error. Errors that is received from the game server will be handled by the partner adapter so the game should
        * not call this function when such error occurs.
        * /
        showError(heading:string, message:string, button: string, callback: ()=>void): void;

        /**
         * Reload the game page
         * /
        reload(): void;

        /**
         * Redirect the browser to the lobby URL
         * /
        goHome(): void;

        /**
         * Call this method to register a callback handler for type of menu item.
         * @param type Type of handler to register. Only supported type is 'MUTE'
         * @param handler The handler called when the menu item is selected from the menu.
         *
         * @return updateMenu(data: any): void returns a method the game can use to update the menu state.
                                                the data parameter is of the same type and semantic as the handler parameter
         *
         * The handler argument (data) is any data relevant to the menu item.
         * For 'MUTE', this will be a boolean value indicating whether the audio should be MUTEd or not.

         * /
        setMenuHandler(type:string, handler: (data: any) => void): (data: any)=>void;

        /**
         * Format a number to a string displayed as a money value
         * /
        formatCurrency(cents: number): string;
        */

        var partnerAdapter;
        var partnerAdapterEventModel;
        var gameDiv;
        var affiliateID;
        var userID;
        var sessionID;
        var metadata;
        var main;
        var orientationMode;

        var updateMuteMenuItem;

        var platformModel;

        function Game() {
            this.partnerAdapterEventModel = {};
             this.orientationMode = 0;
        }

        /*
        * Set the partner adapter
        */
        Game.prototype.setPartnerAdapter = function (partnerAdapter) {
            var _this = this;

            this.partnerAdapter = partnerAdapter;
            //partnerAdapter.setMenuHandler("SETTINGS", (data)=> {})({visible: false});

            //main.load();
            // updating the progressbar like this will probably not show since it's not asynchronous. But this is an example :)
            /**this.partnerAdapter.updatedLoadingProgress(0.2);
            this.partnerAdapter.updatedLoadingProgress(0.4);
            this.partnerAdapter.updatedLoadingProgress(0.6);
            this.partnerAdapter.updatedLoadingProgress(0.8);
            this.partnerAdapter.updatedLoadingProgress(1.0);**/

            // lets hide that progress bar. If you load bonus game assets later you can show the progressbar again.
            //this.partnerAdapter.showProgressBar();

            // get/save session/player information
            var sessionData = this.partnerAdapter.getSessionData();
            this.affiliateID = sessionData.getContextID();
            this.userID = sessionData.getPlayerID();
            this.sessionID = sessionData.getSessionID();
            // this.updateMuteMenuItem(false); //tell the partner adapter to update the menu 'MUTE' item

            this.metadata = new zeus3_prt.MetaDataBundle();
            console.log("Looks like this version is: " + this.metadata.getResourceVersion() );
            console.log("entry point");
            require(["content/zeus3_prt/lib/require/require_cfg.js?resourceversion=5.0.4.1-1787670669&appcode=zeus3_prt&gaffingenabled=false&demoenabled=false&debugenabled=false&touchdevice=false&partnercode=nyx_draftkings_nj&realmoney=false&gamecode=zeus3_prt&locale=en_US&webaudio=true&countrycode=US&jurisdiction=us-nj"], function () {
                require(["../app/js/main"], function() {
                    _this.platformModel = new sgigame.PlatformModel();
                    _this.main = new sgigame.Main(_this.partnerAdapter, _this.metadata, _this.partnerAdapterEventModel, _this.platformModel, _this.balanceService);  
                });
            });
            //this.partnerAdapter.hideProgressBar();
        };

        /*
        * Reset the game to replayable state.
        * Implementations should stop all game animations, ie. Stop spinning reels and reset the game to
        * a state where a new game can be started.
        * This is called if there is some condition where the current game is aborted, but a new one
        * can be started. For example, if the current wager fails due to insufficient funds, then
        * the player may make a deposit and try again.
        */
        Game.prototype.resetHard = function () {
            console.log("I will reset my state");
            this.main.resetHard();
            // we need to forget everything we know and reset back to the initial state
        };

        /**
         */
        Game.prototype.startAutoplay = function(playCount) {
            this.main.startAutoplay(playCount);
        };

        /**
         * Stops the autoplay if running autoplay.
         * Finish any active games, but do not advance to the next game.
         */
        Game.prototype.stopAutoplay = function() {
            this.main.stopAutoplay();
        };

        /**
         * Resume the game round.
         * For example, the player switches back to the game from another tab. The game regains focus.
         */
        Game.prototype.resumeGame = function() {
            this.main.resumeGame();
        };

        /**
        * Pause the game. Any game animations and server interactions should be paused.
        * For example, the player may switch to another browser tab losing focus on the game.
        */
        Game.prototype.pauseGame = function() {
            this.main.pauseGame();
        };

        Game.prototype.setBet = function(betPerUnit, units, lockUI) {
        };

        Game.prototype.play = function(requestHeaders) {
        };

        Game.prototype.addWinDisplayListener = function (listener) {
            this.partnerAdapterEventModel.winDisplayEventListener = listener;
        };

        Game.prototype.addPlatformBalanceListener = function (listener) {
            this.partnerAdapterEventModel.balanceDisplayEventListener = listener;
        };

        Game.prototype.addGamePlayEventListener = function (listener) {
            this.partnerAdapterEventModel.gameInitializedEventListener = listener;
        };

        /*
        * Set the partner adapter
        */
        Game.prototype.setBalanceService = function (balanceService) {
            this.balanceService = balanceService;
        }

        /**
         * set orientations for landscape.
         * This is a signal to the game the orientation of the screen is now landscape.
         */       
        Game.prototype.setOrientationLandscape = function() {
			//console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ :: setOrientationLandscape");
            this.orientationMode = 0;
			if(this.main != undefined){
				this.main.setOrientation(this.orientationMode);
                
			}
		}
        
        /**
         * set orientations for portrait.
         * This is a signal to the game the orientation of the screen is now portrait.
         */        
		Game.prototype.setOrientationPortrait = function() {
			//console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ :: setOrientationPortrait");
            this.orientationMode = 1;
			if(this.main != undefined){
				this.main.setOrientation(this.orientationMode);                
			}
        }
        
        Game.prototype.handleFreeRoundsUpdate = function (freeRoundInfo) {
            this.main.handleFreeRoundsUpdate(freeRoundInfo);
        };

        Game.prototype.gameRevealed = function () {
            this.main.unLockUI();
        };

        return Game;
    })();

    // export the class into the rainbowrichespicknmix namespace
    zeus3_prt.Game = Game;
})(zeus3_prt || (zeus3_prt = {}));
