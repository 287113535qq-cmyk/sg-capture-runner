var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var audio;
(function (audio) {
    /**
     * AudioEvent's are dispatched by IAudioSound implementations to listeners when it has loaded, failed to load, played, paused or ended.
     */
    var AudioEvent = (function (_super) {
        __extends(AudioEvent, _super);
        /**
         * @param eventName The type of event.
         * @param sound IAudioSound instance that dispatched the event.
         */
        function AudioEvent(eventName, sound) {
            _super.call(this, eventName);
            this._sound = sound;
        }
        Object.defineProperty(AudioEvent.prototype, "sound", {
            /**
             * IAudioSound instance that dispatched the event.
             */
            get: function () {
                return this._sound;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatched when the IAudioSound asset is sucessfully loaded.
         */
        AudioEvent.LOADED = "SoundEvent_LOADED";
        /**
         * Dispatched if the IAudioSound asset fails to load.
         */
        AudioEvent.LOAD_ERROR = "SoundEvent_LOAD_ERROR";
        /**
         * Dispatches when the IAudioSound completes a single playback.
         */
        AudioEvent.ENDED = "SoundEvent_ENDED";
        /**
         * Dispatched when the IAudioSound has been paused.
         */
        AudioEvent.PAUSED = "SoundEvent_PAUSED";
        /**
         * Dispatched when the IAudioSound begins playback.
         */
        AudioEvent.PLAYED = "SoundEvent_PLAYED";
        return AudioEvent;
    })(borgevent.Event);
    audio.AudioEvent = AudioEvent;
})(audio || (audio = {}));
/// <reference path="../interface/AudioEvent.ts"/>
var audio;
(function (audio) {
    var AudioGlobal = (function (_super) {
        __extends(AudioGlobal, _super);
        //protected howler: HowlerGlobal;
        function AudioGlobal() {
            _super.call(this);
            //this.howler = new HowlerGlobal();
        }
        AudioGlobal.prototype.mute = function () {
            //this.howler.mute();
            Howler.mute(true);
        };
        AudioGlobal.prototype.unmute = function () {
            //this.howler.unmute();
            Howler.mute(false);
        };
        return AudioGlobal;
    })(borgevent.EventDispatcher);
    audio.AudioGlobal = AudioGlobal;
})(audio || (audio = {}));
/// <reference path="../interface/AudioEvent.ts"/>
var audio;
(function (audio) {
    /**
     * The AudioSound class loads, plays and manipulates external sounds.
     *
     * The AudioSound class also dispatches AudioEvent's to listeners when it has loaded, failed to load, played, paused or ended.
     */
    var AudioSound = (function (_super) {
        __extends(AudioSound, _super);
        /**
         * Creates an instance of AudioSound.
         *
         * @param {assets.IAsset} asset The asset to use for playback, this should have already been processed by an AssetLoader.
         * @param {IAudioSpriteDefinition} [spriteDef] Optional, used to set the start and end times for playback.
         */
        function AudioSound(asset, spriteDef, streaming) {
            var _this = this;
            _super.call(this);
            var howlProperties = {
                src: [asset.path],
                onload: function () { _this.onLoad(); },
                onloaderror: function () { _this.onLoadError(); },
                onend: function () { _this.onEnd(); },
                onpause: function () { _this.onPause(); },
                onplay: function () { _this.onPlay(); },
                html5: streaming
            };
            if (spriteDef) {
                this._spriteName = asset.id;
                var sprite = {};
                sprite[asset.id] = [spriteDef.startTime, spriteDef.duration];
                howlProperties.sprite = sprite;
            }
            this._howlerSound = new Howl(howlProperties);
            this._playing = false;
        }
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
            this.onEnd();
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
        AudioSound.prototype.getPan = function () {
            return this._howlerSound.stereo();
        };
        /**
         * @inheritdoc
         */
        AudioSound.prototype.setPan = function (value) {
            this._howlerSound.stereo(value);
            return this;
        };
        /**
         * @inheritdoc
         */
        AudioSound.prototype.getPlayhead = function () {
            return this._howlerSound.seek();
        };
        /**
         * @inheritdoc
         */
        AudioSound.prototype.setPlayhead = function (value) {
            this._howlerSound.seek(value);
            return this;
        };
        /**
         * @inheritdoc
         */
        AudioSound.prototype.getRate = function () {
            return this._howlerSound.rate();
        };
        /**
         * @inheritdoc
         */
        AudioSound.prototype.setRate = function (value) {
            this._howlerSound.rate(value);
            return this;
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
            this.dispatchEvent(new audio.AudioEvent(audio.AudioEvent.LOADED, this));
        };
        /**
         * Dispatches AudioEvent.LOAD_ERROR if the asset fails to load.
         */
        AudioSound.prototype.onLoadError = function () {
            var _this = this;
            setTimeout(function () {
                _this._loadFailed = true;
                _this.dispatchEvent(new audio.AudioEvent(audio.AudioEvent.LOAD_ERROR, _this));
            });
        };
        /**
         * Dispatches AudioEvent.ENDED when the sound completes a single playback.
         */
        AudioSound.prototype.onEnd = function () {
            if (!this._howlerSound.loop()) {
                this._playing = false;
                this.dispatchEvent(new audio.AudioEvent(audio.AudioEvent.ENDED, this));
            }
        };
        /**
         * Dispatches AudioEvent.PAUSED when the sound has been paused.
         */
        AudioSound.prototype.onPause = function () {
            this.dispatchEvent(new audio.AudioEvent(audio.AudioEvent.PAUSED, this));
        };
        /**
         * Dispatches AudioEvent.PLAYED when the sound begins playback.
         */
        AudioSound.prototype.onPlay = function () {
            this.dispatchEvent(new audio.AudioEvent(audio.AudioEvent.PLAYED, this));
        };
        return AudioSound;
    })(borgevent.EventDispatcher);
    audio.AudioSound = AudioSound;
})(audio || (audio = {}));
