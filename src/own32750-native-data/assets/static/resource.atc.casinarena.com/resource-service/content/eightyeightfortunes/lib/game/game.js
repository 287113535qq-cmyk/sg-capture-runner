define(["require", "exports", "TweenMax", "TimelineMax", "TweenLite", "abg2d/abg2d", "events/events"], function (require, exports, TweenMax, TimelineMax, TweenLite, abg2d, events) {
    (function (RotationAxis) {
        RotationAxis[RotationAxis["X"] = 0] = "X";
        RotationAxis[RotationAxis["Y"] = 1] = "Y";
        RotationAxis[RotationAxis["Z"] = 2] = "Z";
    })(exports.RotationAxis || (exports.RotationAxis = {}));
    var RotationAxis = exports.RotationAxis;
    /**
     * Contains helper methods that create tweens
     */
    var TweenUtil = (function () {
        function TweenUtil() {
        }
        /**
         * Setup tween that changes transform position
         *
         * @param  target  target transform
         * @param  x  target x position
         * @param  y  target y position
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.moveTo = function (target, x, y, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.to(target, duration, { setPositionX: x, setPositionY: y, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Setup a tween that changes transform position along a single axis.
         * Optimized speed mode for single-axis.
         *
         * @param  target  target transform
         * @param  pos  target position
         * @param  axis  axis that pos applies to
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.moveToAxis = function (target, pos, axisX, duration, easeMode, complete, reverseComplete, repeat, start) {
            var params = { ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false };
            params[axisX ? "setPositionX" : "setPositionY"] = pos;
            return TweenMax.to(target, duration, params);
        };
        /**
         * Setup tween that moves transform position by given distance
         *
         * @param  target  target transfor,
         * @param  dx  distance to move along x
         * @param  dy  distance to move along y
         * @param  duration  duration of tween
         * @param  rateType  treat rate as speed or duration
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.moveBy = function (target, dx, dy, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.to(target, duration, { setPositionX: "+=" + dx, setPositionY: "+=" + dy, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Setup a tween that moves transform position along a single axis
         *
         * @param  target  target transform
         * @param  delta  distance to move
         * @param  axis  axis that pos applies to
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.moveByAxis = function (target, delta, axisX, duration, easeMode, complete, reverseComplete, repeat, start) {
            var params = { ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false };
            params[axisX ? "setPositionX" : "setPositionY"] = "+=" + delta;
            return TweenMax.to(target, duration, params);
        };
        /**
         * Setup a tween that transform actor between two points
         *
         * @param  target  target transform
         * @param  x1  starting x position
         * @param  y1  starting y position
         * @param  x2  ending x position
         * @param  y2  ending y position
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.moveFromTo = function (target, x1, y1, x2, y2, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.fromTo(target, duration, { setPositionX: x1, setPositionY: y1 }, { setPositionX: x2, setPositionY: y2, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Setup a tween that moves transform between two points on a single axis
         *
         * @param  target  target transform
         * @param  pos1  starting position
         * @param  pos2  ending position
         * @param  axis  axis that pos applies to
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.moveFromToAxis = function (target, pos1, pos2, axisX, duration, easeMode, complete, reverseComplete, repeat, start) {
            var fromParams = {};
            fromParams[axisX ? "setPositionX" : "setPositionY"] = pos1;
            var toParams = { ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false };
            toParams[axisX ? "setPositionX" : "setPositionY"] = pos2;
            return TweenMax.fromTo(target, duration, fromParams, toParams);
        };
        /**
         * Setup tween that changes opacity
         *
         * @param  target  target fadable
         * @param  opacity  target opacity
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.fadeTo = function (target, opacity, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.to(target, duration, { opacity: opacity, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Setup tween that changes opacity between two values
         *
         * @param  target  target fadable
         * @param  opacity1  start opacity
         * @param  opacity2  end opacity
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.fadeFromTo = function (target, opacity1, opacity2, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.fromTo(target, duration, { opacity: opacity1 }, { opacity: opacity2, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Setup a tween that scales a transform between two values
         *
         * @param  target  target transform
         * @param  x1  starting x scale
         * @param  y1  starting y scale
         * @param  x2  ending x scale
         * @param  y2  ending y scale
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.scaleFromTo = function (target, sx1, sy1, sx2, sy2, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.fromTo(target, duration, { setScaleX: sx1, setScaleY: sy1 }, { setScaleX: sx2, setScaleY: sy2, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Setup a tween that bangs between values. Intermediate bangup values are rounded.
         *
         * @param  target  target object
         * @param  begin  starting value
         * @param  end  ending value
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.bangFromTo = function (target, begin, end, duration, easeMode, complete, reverseComplete, repeat, start) {
            //bug fix for roundProps property in TweenMax where extremely
            //large numbers eventually bang to a negative value
            //this is a hack to avoid changing all games
            var myObj = {
                setBangValue: function (value) {
                    target.setBangValue(Math.round(value));
                },
                getBangValue: function () {
                    return target.getBangValue();
                }
            };
            return TweenMax.fromTo(myObj, duration, { setBangValue: begin }, { setBangValue: end, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Setup a tween that zooms between values.
         *
         * @param  target  target object
         * @param  begin  starting value
         * @param  end  ending value
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.zoomFromTo = function (target, begin, end, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.fromTo(target, duration, { setZoom: begin }, { setZoom: end, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Rotate between two angles
         */
        TweenUtil.prototype.rotateFromTo = function (target, begin, end, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.fromTo(target, duration, { setRotation: begin }, { setRotation: end, ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete, onCompleteParams: ["{self}"], onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"], onRepeat: repeat, onRepeatParams: ["{self}"], immediateRender: false });
        };
        /**
         * Setup a tween that scales an HTML element between two values
         *
         * @param  target  target transform
         * @param  x1  starting x scale
         * @param  y1  starting y scale
         * @param  x2  ending x scale
         * @param  y2  ending y scale
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.cssScaleFromTo = function (target, sx1, sy1, sx2, sy2, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.fromTo(target, duration, { scaleX: sx1, scaleY: sy1 }, {
                scaleX: sx2,
                scaleY: sy2,
                ease: easeMode,
                onStart: start,
                onStartParams: ["{self}"],
                onComplete: complete,
                onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete,
                onReverseCompleteParams: ["{self}"],
                onRepeat: repeat,
                onRepeatParams: ["{self}"],
                immediateRender: false
            });
        };
        /**
         * Setup a tween that scales an HTML element to a value
         *
         * @param  target  target transform
         * @param  sx1  x scale
         * @param  sy1  y scale
         * @param  duration  duration of tween
         * @param  easeMode  easing mode
         * @param  complete  function to call when tween is complete
         * @param  reverseComplete  function to call when reversed tween is complete
         * @param  repeat  function to call each time the tween repeats
         * @param  start  function to call when the tween starts
         */
        TweenUtil.prototype.cssScaleTo = function (target, sx1, sy1, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.to(target, duration, {
                scaleX: sx1,
                scaleY: sy1,
                ease: easeMode,
                onStart: start,
                onStartParams: ["{self}"],
                onComplete: complete,
                onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete,
                onReverseCompleteParams: ["{self}"],
                onRepeat: repeat,
                onRepeatParams: ["{self}"],
                immediateRender: false
            });
        };
        /**
         * Setup a tween that rotates an HTML element between two values
         */
        TweenUtil.prototype.cssRotateFromTo = function (target, r1, r2, axis, duration, easeMode, complete, reverseComplete, repeat, start) {
            var toRotation = null;
            var fromRotation = null;
            switch (axis) {
                case 0 /* X */:
                    toRotation = { rotationX: r1, immediateRender: false };
                    fromRotation = {
                        rotationX: r2,
                        ease: easeMode,
                        onStart: start,
                        onStartParams: ["{self}"],
                        onComplete: complete,
                        onCompleteParams: ["{self}"],
                        onReverseComplete: reverseComplete,
                        onReverseCompleteParams: ["{self}"],
                        onRepeat: repeat,
                        onRepeatParams: ["{self}"]
                    };
                    break;
                case 1 /* Y */:
                    toRotation = { rotationY: r1, immediateRender: false };
                    fromRotation = {
                        rotationY: r2,
                        ease: easeMode,
                        onStart: start,
                        onStartParams: ["{self}"],
                        onComplete: complete,
                        onCompleteParams: ["{self}"],
                        onReverseComplete: reverseComplete,
                        onReverseCompleteParams: ["{self}"],
                        onRepeat: repeat,
                        onRepeatParams: ["{self}"]
                    };
                    break;
                case 2 /* Z */:
                    toRotation = { rotationZ: r1, immediateRender: false };
                    fromRotation = {
                        rotationZ: r2,
                        ease: easeMode,
                        onStart: start,
                        onStartParams: ["{self}"],
                        onComplete: complete,
                        onCompleteParams: ["{self}"],
                        onReverseComplete: reverseComplete,
                        onReverseCompleteParams: ["{self}"],
                        onRepeat: repeat,
                        onRepeatParams: ["{self}"]
                    };
                    break;
            }
            return TweenMax.fromTo(target, duration, toRotation, fromRotation);
        };
        return TweenUtil;
    })();
    exports.TweenUtil = TweenUtil;
    /**
    * @file Gaffing.ts
    *
    * Copyright (c) 2014 Williams Interactive, LLC. All Rights Reserved.
    */
    var Gaffing = (function () {
        /**
         * Constructor
         * @method game.DemoMenu#constructor
         * @public
         */
        function Gaffing() {
            this.userGaffStops = [0, 0, 0, 0, 0];
            this.gaffStops = {
                "User": this.userGaffStops,
            };
        }
        /**
        * Get collection of all supported gaffs
        * @method game.DemoMenu#getAllTypes
        * @public
        * @return  {string[]} All of the item names in gaffStops
        */
        Gaffing.prototype.getAllTypes = function () {
            var gaffs = new Array();
            for (var key in this.gaffStops) {
                if (this.gaffStops.hasOwnProperty(key)) {
                    gaffs.push(key);
                }
            }
            gaffs.splice(gaffs.indexOf("User"), 1);
            return gaffs;
        };
        /**
        * Add a new gaff to the Gaffing object
        * @method game.DemoMenu#addGaff
        * @public
        * @param  {string} name The name of the new gaff.
        * @param  {number[]} postions The stop positions of the new gaff.
        */
        Gaffing.prototype.addGaff = function (name, positions) {
            this.gaffStops[name] = positions;
        };
        /**
        * Set the current user gaff stops
        * @method game.DemoMenu#setUserGaffStops
        * @public
        * @param  {number[]} stops  User gaff stop positions
        */
        Gaffing.prototype.setUserGaffStops = function (stops) {
            this.userGaffStops[0] = stops[0];
            this.userGaffStops[1] = stops[1];
            this.userGaffStops[2] = stops[2];
            this.userGaffStops[3] = stops[3];
            this.userGaffStops[4] = stops[4];
        };
        /**
        * Get the stop positions for a certain gaff
        * @method game.DemoMenu#getStopPositions
        * @public
        * @param  {string} gaffType  Name of the gaff we are trying to retrive.
        */
        Gaffing.prototype.getStopPositions = function (gaffType) {
            return this.gaffStops[gaffType];
        };
        return Gaffing;
    })();
    exports.Gaffing = Gaffing;
    /**
     * @file StagedDownloader.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Singluar entity that represents a stage in the download process
     */
    var DownloadStage = (function () {
        function DownloadStage() {
        }
        return DownloadStage;
    })();
    exports.DownloadStage = DownloadStage;
    /**
     * Handles downloading of bundles in stages. Can be used to postpone the loading of bundles.
     */
    var StagedDownloader = (function () {
        /**
         * Create a StageDownloader object
         *
         * @param  stageSplitTime  time to wait to continue to next stage
         * @param  bundleLoader  resource bundle loader
         */
        function StagedDownloader(stageSplitTime, bundleLoader) {
            this.stages = new Array();
            this.stageSplitTime = stageSplitTime;
            this.bundleLoader = bundleLoader;
            this.currentStage = 0;
            this.continuousDownload = false;
            this.downloading = false;
        }
        /**
         * Set the profiler object used for profiling downloads
         *
         * @param  profiler  profiler object
         */
        StagedDownloader.prototype.setProfiler = function (profiler) {
            this.profiler = profiler;
        };
        /**
         * Add the bundle and callback that a stage will use
         *
         * @param  name  name of download stage
         * @param  bundle  bundle that will be loaded during stage
         * @param  onProgress  callback that is called with loading progress
         * @param  onComplete  callback that is called when bundle if finished loading
         */
        StagedDownloader.prototype.addStage = function (name, bundle, onProgress, onComplete) {
            var stage = new DownloadStage();
            stage.downloaded = false;
            stage.bundle = bundle;
            stage.name = name;
            stage.onProgress = onProgress;
            stage.onComplete = onComplete;
            this.stages.push(stage);
        };
        /**
         * Start the downloading process. This will continuously download bundles until it reaches
         * the last stage. This will also skip stages that have already been downloaded.
         */
        StagedDownloader.prototype.start = function () {
            console.log("StagedDownloader.start() length " + this.stages.length);
            this.currentStage = 0;
            this.continuousDownload = true;
            this.download(this.currentStage);
        };
        /**
         * Call to download a single stage. This will only download one stage and then stop.
         *
         * @param  stage  stage to download
         */
        StagedDownloader.prototype.download = function (stage) {
            var _this = this;
            console.log("StagedDownloader.download({})", stage);
            var theStage = this.stages[stage++];
            if (!this.continuousDownload && theStage.downloaded) {
                return;
            }
            while (theStage.downloaded && stage < this.stages.length) {
                theStage = this.stages[stage++];
            }
            if (!theStage.downloaded) {
                this.downloading = true;
                var onReady = function () { return _this.onStageComplete(theStage); };
                var onProgress = function (progress) {
                    if (theStage.onProgress != null) {
                        theStage.onProgress((progress * 100));
                    }
                };
                this.bundleLoader.load(theStage.bundle, onReady, onProgress);
            }
        };
        /**
         * Check to see if currently downloading
         */
        StagedDownloader.prototype.isDownloading = function () {
            return this.downloading;
        };
        /**
         * Get current stage that is being downloaded
         */
        StagedDownloader.prototype.getCurrentStage = function () {
            return this.stages[this.currentStage];
        };
        /**
         * Gets a specified stage by name
         *
         * @param  name  name of stage
         */
        StagedDownloader.prototype.getStage = function (name) {
            var stage = undefined;
            var stageCnt = this.stages.length;
            for (var i = 0; i < stageCnt; ++i) {
                if (this.stages[i].name == name) {
                    stage = this.stages[i];
                    break;
                }
            }
            return stage;
        };
        /**
         * Internal on complete handler for bundles
         *
         * @param  stage  the stage that just completed
         */
        StagedDownloader.prototype.onStageComplete = function (stage) {
            var _this = this;
            console.log("StageDownloader.onStageComplete:", stage.name, this.currentStage, this.stages.length, this.continuousDownload, this.continuousDownload && this.currentStage < this.stages.length);
            if (this.profiler != undefined) {
                this.profiler.log('DownloadStage Complete: ' + stage.name);
            }
            stage.downloaded = true;
            this.downloading = false;
            this.currentStage++;
            console.log("StageDownloader.onStageComplete NEXT:", stage.name, this.currentStage, this.stages.length, this.continuousDownload, this.continuousDownload && this.currentStage < this.stages.length);
            if (this.continuousDownload && this.currentStage < this.stages.length) {
                console.log("StageDownloader.onStageComplete download next stage");
                setTimeout(function () { return _this.download(_this.currentStage); }, this.stageSplitTime);
            }
            else {
                this.continuousDownload = false;
                this.currentStage = 0;
            }
            stage.onComplete(stage.bundle);
        };
        return StagedDownloader;
    })();
    exports.StagedDownloader = StagedDownloader;
    /**
     * Supports a menu system for demo functionality
     */
    var DemoMenu = (function () {
        /**
         * Constructor
         * @method game.DemoMenu#constructor
         * @public
         * @param  {input.InputResolver} inputResolver Resolver for input.
         * @param  {abg2d.Scene} scene Scene to add actors to.
         * @param  {number} width Width of demo menu.
         * @param  {number} height Height of demo menu.
         * @param  {Gaffing} gaffing Object holding the special gaffs for this game.
         * @param  {number} scalar Game scale factor.
         */
        function DemoMenu(inputResolver, scene, width, height, gaffing, scalar) {
            this.scalar = scalar;
            this.tweenUtil = new TweenUtil();
            this.tabs = new Array();
            this.gaffing = gaffing;
            //this is the vector graphic for the demo menu
            this.vgActor = abg2d.Factory.composeVectorGraphics(scene, null, width, height);
            this.vgActor.getTransform().setScale(scalar, scalar);
            //this is the "MENU" text
            this.title = abg2d.Factory.composeText(scene, this.vgActor);
            this.setupText(this.title.getText(), "DEMO");
            this.title.getTransform().setPosition(0, 75); //offset to avoid top header blocking input
            this.title.setName("demoMenu-toggle");
            //this is the gaff toggle text
            this.gaffToggle = abg2d.Factory.composeText(scene, this.vgActor);
            this.setupText(this.gaffToggle.getText(), "Gaffing OFF");
            this.gaffToggle.getTransform().setVisible(false);
            this.gaffToggle.getTransform().setPosition(0, 75);
            this.minimized = true;
            this.demoEnabled = true;
            this.show();
            //setup const values
            this.createConstants();
            //setup input
            this.createInputRegions(inputResolver);
            //create menu tabs
            this.createTabs(scene);
            //setup event dispatcher
            this.signal = {
                onItemClicked: null,
                onMenuOpened: null,
                onMenuClosed: null,
                onGaffToggled: null
            };
            this.eventDispatcher = new events.EventDispatcher(this.signal);
        }
        /**
         * Get the event dispatcher
         * @method game.DemoMenu#getEvents
         * @public
         * @return  {events.EventDispatcher<IDemoMenuListener>} The event dispatcher.
         */
        DemoMenu.prototype.getEvents = function () {
            return this.eventDispatcher;
        };
        /**
         * Retrieve the gaff stop positions for a demo menu item.
         * @method game.DemoMenu#getGaffPositions
         * @public
         * @param  {string} gaffItem The name of the item from the menu.
         * @return  {number[]} The gaff positions.
         */
        DemoMenu.prototype.getGaffPositions = function (gaffItem) {
            return this.gaffing.getStopPositions(gaffItem);
        };
        /**
         * Set Demo enabled state. Makes the "MENU" button visible.
         * @method game.DemoMenu#setDemoEnabled
         * @public
         * @param  {boolean} enabled Flag for enabling or disabling.
         */
        DemoMenu.prototype.setDemoEnabled = function (enabled) {
            this.demoEnabled = enabled;
            this.title.getTransform().setVisible(enabled);
        };
        /**
        * Set gaffing enabled state. Disabled gaffing also hides the gaff button.
        * @method game.DemoMenu#setGaffingEnabled
        * @public
        * @param  {boolean} enabled Flag for enabling or disabling.
        */
        DemoMenu.prototype.setGaffingEnabled = function (enabled) {
            this.gaffToggle.getTransform().setVisible(enabled);
        };
        /**
        * Set the gaffing state.
        * @method game.DemoMenu#setGaffingState
        * @public
        * @param  {boolean} gaffOn Flag for enabling or disabling.
        */
        DemoMenu.prototype.setGaffingState = function (gaffOn) {
            this.gaffOn = gaffOn;
            this.gaffToggle.getText().setText("Gaffing " + (this.gaffOn ? "ON" : "OFF"));
            this.signal.onGaffToggled(this.gaffOn);
        };
        /**
        * Add a tab to the menu
        * @method game.DemoMenu#addTab
        * @public
        * @param  {DemoMenuTab} tab Tab to add to menu.
        */
        DemoMenu.prototype.addTab = function (tab) {
            tab.id = this.tabs.length;
            this.tabs.push(tab);
            this.setActiveTab(this.tabs.length - 1);
        };
        /**
        * Set a tab as active
        * @method game.DemoMenu#setActiveTab
        * @public
        * @param  {number} tab Tab index to set active
        */
        DemoMenu.prototype.setActiveTab = function (tabIndex) {
            this.updateTabAsActive(tabIndex);
            this.redraw();
        };
        /**
        * Set postion of the menu vector graphics
        * @method game.DemoMenu#setPosition
        * @public
        * @param  {number} x X coordinate.
        * @param  {number} y Y coordinate.
        */
        DemoMenu.prototype.setPosition = function (x, y) {
            this.vgActor.getTransform().setPosition(x, y);
        };
        /**
        * Show the demo menu
        * @method game.DemoMenu#show
        * @public
        */
        DemoMenu.prototype.show = function () {
            this.vgActor.getTransform().setVisible(true);
        };
        /**
        * Hide the demo menu
        * @method game.DemoMenu#hide
        * @public
        */
        DemoMenu.prototype.hide = function () {
            this.vgActor.getTransform().setVisible(false);
        };
        /**
        * Minimize the demo menu to only show the demo text
        * @method game.DemoMenu#minimize
        * @public
        */
        DemoMenu.prototype.minimize = function () {
            this.minimized = true;
            this.hideAllTabs();
            this.vgActor.getVectorGraphics().setVisible(false);
            this.redraw();
            this.signal.onMenuClosed();
        };
        /**
        * Maximize the demo menu to show the whole menu
        * @method game.DemoMenu#maximize
        * @public
        */
        DemoMenu.prototype.maximize = function () {
            this.minimized = false;
            this.setActiveTab(0);
            this.vgActor.getVectorGraphics().setVisible(true);
            this.redraw();
            this.signal.onMenuOpened();
        };
        /**
         * Setup constant values used in Demo Menu
         * @method game.DemoMenu#createConstants
         * @private
         */
        DemoMenu.prototype.createConstants = function () {
            this.backingColor = "rgba(0,0,0,0.75)";
            this.backingGrad1 = "rgb(73,123,199)";
            this.backingGrad2 = "rgb(99,157,213)";
            this.buttonBackColor = "rgb(0,162,255)";
            this.buttonForeColor = "rgb(123,199,242)";
            this.buttonShadowColor = "rgba(62,102,158,0.5)";
            this.minimizeColor = "rgba(47,107,180,0.25)";
            this.buttonStartPosX = 100; //
            this.buttonStartPosY = 200; //
            this.backingInset = 4;
            this.tabWidth = 120;
            this.tabHeight = 50;
            this.buttonWidth = 440; //
            this.buttonHeight = 100; //
            this.buttonInset = 4; //
            this.buttonShadowOffsetX = 8; //
            this.buttonShadowOffsetY = 12; //
            this.buttonCornerRadius = 20; //
            this.minimizeWidth = 100;
            this.minimizeHeight = 100;
            this.buttonSpacingX = 20;
            this.buttonSpacingY = 30;
        };
        /**
         * Create the input regions used by the Demo Menu
         * @method game.DemoMenu#createInputRegions
         * @private
         * @param  {input.InputResolver} inputResolver Resolver for input.
         */
        DemoMenu.prototype.createInputRegions = function (inputResolver) {
            var _this = this;
            var xfm = this.vgActor.getTransform();
            xfm.setZOrder(10000);
            var vg = this.vgActor.getVectorGraphics();
            var openCloseRegion = {
                touchPosX: 0,
                touchPosY: 0,
                onStart: function (id, x, y) {
                    _this.handleOpenCloseAreaPress(x, y);
                },
                onMove: function (id, x, y) {
                },
                onEnd: function (id, x, y) {
                    _this.handleOpenCloseAreaRelease(x, y);
                },
                getX: function () {
                    return xfm.getPositionX();
                },
                getY: function () {
                    return xfm.getPositionY();
                },
                getWidth: function () {
                    return _this.minimizeWidth;
                },
                getHeight: function () {
                    return _this.minimizeHeight;
                },
                getLayer: function () {
                    return 10001;
                },
                isActive: function () {
                    return true;
                },
                isBlocking: function () {
                    return true;
                }
            };
            inputResolver.addRegion(openCloseRegion);
            var mainRegion = {
                onStart: function (id, x, y) {
                    _this.handleMenuInputPress(x, y);
                },
                onMove: function (id, x, y) {
                },
                onEnd: function (id, x, y) {
                    _this.handleMenuInputRelease(x, y);
                },
                getX: function () {
                    return xfm.getPositionX();
                },
                getY: function () {
                    return xfm.getPositionY();
                },
                getWidth: function () {
                    return vg.getDrawWidth();
                },
                getHeight: function () {
                    return vg.getDrawHeight();
                },
                getLayer: function () {
                    return 10000;
                },
                isActive: function () {
                    return true;
                },
                isBlocking: function () {
                    return !_this.minimized;
                }
            };
            inputResolver.addRegion(mainRegion);
            //Gaffing toggle config
            var gaffToggleWidth = 100;
            var gaffToggleHeight = 100;
            var gaffToggleSpacing = 20;
            this.gaffOn = false;
            this.gaffToggle.getTransform().setPositionX(this.minimizeWidth + gaffToggleSpacing);
            this.gaffToggle.getTransform().setVisible(false);
            var gaffRegion = {
                onStart: function (id, x, y) {
                },
                onMove: function (id, x, y) {
                },
                onEnd: function (id, x, y) {
                    _this.setGaffingState(!_this.gaffOn);
                },
                getX: function () {
                    return xfm.getTranslatedPositionX() + _this.gaffToggle.getTransform().getTranslatedPositionX();
                },
                getY: function () {
                    return xfm.getPositionY();
                },
                getWidth: function () {
                    return gaffToggleWidth;
                },
                getHeight: function () {
                    return gaffToggleHeight;
                },
                getLayer: function () {
                    return 10002;
                },
                isActive: function () {
                    return _this.gaffToggle.getTransform().getVisible();
                },
                isBlocking: function () {
                    return _this.gaffToggle.getTransform().getVisible();
                }
            };
            inputResolver.addRegion(gaffRegion);
        };
        /**
         * Create the tabs for the Demo Menu
         * @method game.DemoMenu#createTabs
         * @private
         * @param  {abg2d.Scene} scene Scene to add actors to.
         */
        DemoMenu.prototype.createTabs = function (scene) {
            var featuresTab = {
                name: "Features",
                items: []
            };
            var debugTab = {
                name: "Debug",
                items: [{ name: 'Console' }]
            };
            var gaffs = this.gaffing.getAllTypes();
            for (var i = 0; i < gaffs.length; ++i) {
                var itemConfig = {
                    name: gaffs[i]
                };
                featuresTab.items.push(itemConfig);
            }
            var tabs = [featuresTab]; //, debugTab];
            //for now there is only one tab (features)
            var tabCnt = tabs.length;
            for (var i = 0; i < tabCnt; ++i) {
                var tab = abg2d.Factory.composeText(scene, this.vgActor);
                var tabText = tab.getText();
                tab.getTransform().setUseTranslationScale(false);
                this.setupText(tabText, tabs[i].name);
                tabText.setAlign(6 /* Center */);
                var demoTab = { id: 0, text: null, x: 0, y: 0, active: false, items: [] };
                demoTab.text = tab;
                var itemCnt = tabs[i].items.length;
                for (var j = 0; j < itemCnt; ++j) {
                    var item = abg2d.Factory.composeText(scene, this.vgActor);
                    var itemText = item.getText();
                    item.getTransform().setUseTranslationScale(false);
                    this.setupText(itemText, tabs[i].items[j].name);
                    itemText.setAlign(6 /* Center */);
                    var demoItem = { text: null, x: 0, y: 0, pressed: false };
                    demoItem.text = item;
                    var buttonText = demoItem.text.getText().getText();
                    buttonText = buttonText.replace(/\s+/g, '');
                    demoItem.text.setName("demoMenu-" + buttonText);
                    demoTab.items.push(demoItem);
                }
                this.addTab(demoTab);
            }
            this.hideAllTabs();
        };
        /**
         * Default utility method for setting up text fields for the menu.
         * @method game.DemoMenu#setupText
         * @private
         * @param  {abg2d.Text} text The text actor to be set up.
         * @param  {string} content The text content to asign to the actor.
         */
        DemoMenu.prototype.setupText = function (text, content) {
            text.setFont("36px arial");
            text.setText(content);
            abg2d.TextFactory.createFillText(text, "rgb(255,255,255)");
        };
        /**
        * Handle menu open/close area press.
        * @method game.DemoMenu#handleOpenCloseAreaPress
        * @param  {number} x X coordinate.
        * @param  {number} y Y coordinate.
        */
        DemoMenu.prototype.handleOpenCloseAreaPress = function (x, y) {
        };
        /**
        * Handle menu open/close area release.
        * @method game.DemoMenu#handleOpenCloseAreaRelease
        * @param  {number} x X coordinate.
        * @param  {number} y Y coordinate.
        */
        DemoMenu.prototype.handleOpenCloseAreaRelease = function (x, y) {
            if (!this.demoEnabled) {
                return;
            }
            if (this.minimized) {
                this.maximize();
            }
            else {
                this.minimize();
            }
        };
        /**
        * Handle input press within the menu area.
        * @method game.DemoMenu#handleMenuInputPress
        * @param  {number} x X coordinate.
        * @param  {number} y Y coordinate.
        */
        DemoMenu.prototype.handleMenuInputPress = function (x, y) {
            if (this.minimized || !this.demoEnabled) {
                return;
            }
            var topLeftX = this.vgActor.getTransform().getTranslatedPositionX();
            var topLeftY = this.vgActor.getTransform().getTranslatedPositionY();
            var hitItem = this.buttonHitTest(x - topLeftX, y - topLeftY);
            if (hitItem != undefined) {
                hitItem.pressed = true;
                this.redraw();
            }
        };
        /**
        * Handle input release within the menu area.
        * @method game.DemoMenu#handleMenuInputRelease
        * @param  {number} x X coordinate.
        * @param  {number} y Y coordinate.
        */
        DemoMenu.prototype.handleMenuInputRelease = function (x, y) {
            if (!this.demoEnabled) {
                return;
            }
            var topLeftX = this.vgActor.getTransform().getTranslatedPositionX();
            var topLeftY = this.vgActor.getTransform().getTranslatedPositionY();
            if (x > topLeftX && x < topLeftX + this.minimizeWidth && y > topLeftY && y < topLeftY + this.minimizeHeight) {
                return;
            }
            var tabHitItem = this.tabHitTest(x - topLeftX, y - topLeftY);
            if (tabHitItem != undefined) {
                if (!tabHitItem.active) {
                    this.setActiveTab(tabHitItem.id);
                }
            }
            else {
                var hitItem = this.buttonHitTest(x - topLeftX, y - topLeftY);
                if (hitItem != undefined) {
                    hitItem.pressed = false;
                    var itemName = hitItem.text.getText().getText();
                    this.minimize();
                    this.signal.onItemClicked(itemName);
                }
                for (var i = 0; i < this.tabs.length; ++i) {
                    var tab = this.tabs[i];
                    for (var i = 0; i < tab.items.length; ++i) {
                        var item = tab.items[i];
                        item.pressed = false;
                    }
                }
                this.redraw();
            }
        };
        /**
        * Redraw the visuals for the menu
        * @method game.DemoMenu#redraw
        */
        DemoMenu.prototype.redraw = function () {
            var vg = this.vgActor.getVectorGraphics();
            vg.clear();
            if (!this.minimized) {
                this.drawMaximized(vg);
            }
        };
        /**
        * Handle input release within the menu area.
        * @method game.DemoMenu#handleMenuInputRelease
        * @param  {abg2d.VectorGraphics} vg Vector graphics component
        */
        DemoMenu.prototype.drawMaximized = function (vg) {
            this.drawBacking(vg);
            var topLeftX = this.vgActor.getTransform().getPositionX();
            var topLeftY = this.vgActor.getTransform().getPositionY();
            var width = vg.getDrawWidth();
            var height = vg.getDrawHeight();
            var btnPosX = this.buttonStartPosX;
            var btnPosY = this.buttonStartPosY;
            var tabPosX = 0;
            var tabPosY = height - this.tabHeight;
            for (var i = 0; i < this.tabs.length; ++i) {
                var tab = this.tabs[i];
                tab.x = tabPosX;
                tab.y = tabPosY;
                tab.text.getTransform().setPosition(tabPosX + this.tabWidth / 2, tabPosY + this.tabHeight / 2);
                this.drawTab(vg, tab.active, tabPosX, tabPosY);
                tabPosX += this.tabWidth;
                if (!tab.active) {
                    continue;
                }
                for (var j = 0; j < tab.items.length; ++j) {
                    var item = tab.items[j];
                    item.x = btnPosX * this.scalar;
                    item.y = btnPosY * this.scalar;
                    item.text.getTransform().setPosition(btnPosX + this.buttonWidth / 2, btnPosY + this.buttonHeight / 2);
                    this.drawButton(vg, item.pressed, btnPosX, btnPosY);
                    btnPosY += this.buttonHeight + this.buttonSpacingY;
                    if ((btnPosY + this.buttonHeight) > (topLeftY + height)) {
                        btnPosX += this.buttonWidth + this.buttonSpacingX;
                        btnPosY = this.buttonStartPosY;
                    }
                }
            }
        };
        /**
        * Draw the backing rect
        * @method game.DemoMenu#drawBacking
        * @param  {abg2d.VectorGraphics} vg Vector graphics component
        */
        DemoMenu.prototype.drawBacking = function (vg) {
            var width = vg.getDrawWidth();
            var height = vg.getDrawHeight();
            vg.beginFill(this.backingColor);
            vg.roundRect(0, 0, width, height, this.buttonCornerRadius);
            vg.endFill();
        };
        /**
         * Draw a tab
         * @method game.DemoMenu#drawTab
         * @param  {abg2d.VectorGraphics} vg  Vector graphics component.
         * @param  {boolean} active  True if tab is active.
         * @param  {number} x  X coordinate of the button on the backing rect
         * @param  {number} y  Y coordinate of the button on the backing rect
         */
        DemoMenu.prototype.drawTab = function (vg, active, x, y) {
            // Tab outline
            vg.beginFill(this.backingColor);
            vg.roundRect(x, y + 4, this.tabWidth, this.tabHeight, this.buttonCornerRadius);
            vg.endFill();
            var color = this.buttonForeColor;
            if (!active) {
                color = this.buttonBackColor;
            }
            // Button Fill
            vg.beginFill(color);
            vg.roundRect(x + 6, y + 8, this.tabWidth - 12, this.tabHeight, this.buttonCornerRadius - 2);
        };
        /**
         * Draw a button
         * @method game.DemoMenu#drawButton
         * @param  {abg2d.VectorGraphics} vg  vector graphics component
         * @param  {boolean} pressed  true if button is pressed
         * @param  {number} x  X coordinate of the button on the backing rect
         * @param  {number} y  Y coordinate of the button on the backing rect
         */
        DemoMenu.prototype.drawButton = function (vg, pressed, x, y) {
            // Button shadow
            vg.endFill();
            vg.beginFill(this.buttonShadowColor);
            vg.roundRect(x + this.buttonShadowOffsetX, y + this.buttonShadowOffsetY, this.buttonWidth, this.buttonHeight, this.buttonCornerRadius);
            vg.endFill();
            // Button outline
            vg.beginFill(this.buttonBackColor);
            vg.roundRect(x, y, this.buttonWidth, this.buttonHeight, this.buttonCornerRadius);
            vg.endFill();
            var colors = [this.buttonForeColor, this.buttonBackColor];
            if (pressed)
                colors = [this.buttonBackColor, this.buttonForeColor];
            // Button Fill
            vg.beginLinearGradientFill(colors, [0, 1], 0, y, 0, y + this.buttonHeight);
            vg.roundRect(x + this.buttonInset, y + this.buttonInset, this.buttonWidth - this.buttonInset * 2, this.buttonHeight - this.buttonInset * 2, this.buttonCornerRadius - 2);
        };
        /**
        * Perform a hit test to see if we hit any buttons
        * @method game.DemoMenu#buttonHitTest
        * @param  {number} x  X coordinate
        * @param  {number} y  Y coordinate
        * @return {DemoMenuItem} Demo item for button that was hit.
        */
        DemoMenu.prototype.buttonHitTest = function (x, y) {
            for (var i = 0; i < this.tabs.length; ++i) {
                var tab = this.tabs[i];
                if (!tab.active)
                    continue;
                for (var j = 0; j < tab.items.length; ++j) {
                    var item = tab.items[j];
                    if (item.x < x && (item.x + this.buttonWidth) > x) {
                        if (item.y < y && (item.y + this.buttonHeight) > y) {
                            return item;
                        }
                    }
                }
            }
            return undefined;
        };
        /**
        * Perform a hit test to see if we hit any tabs
        * @method game.DemoMenu#tabHitTest
        * @param  {number} x  X coordinate
        * @param  {number} y  Y coordinate
        * @return {DemoMenuTab} Demo tab for tab that was hit.
        */
        DemoMenu.prototype.tabHitTest = function (x, y) {
            for (var i = 0; i < this.tabs.length; ++i) {
                var tab = this.tabs[i];
                if (tab.x < x && (tab.x + this.buttonWidth) > x) {
                    if (tab.y < y && (tab.y + this.buttonHeight) > y) {
                        return tab;
                    }
                }
            }
            return undefined;
        };
        /**
        * Hide all the tabs
        * @method game.DemoMenu#hideAllTabs
        */
        DemoMenu.prototype.hideAllTabs = function () {
            for (var i = 0; i < this.tabs.length; ++i) {
                this.tabs[i].active = false;
                this.tabs[i].text.getTransform().setVisible(false);
                for (var j = 0; j < this.tabs[i].items.length; ++j) {
                    var item = this.tabs[i].items[j];
                    item.text.getTransform().setVisible(false);
                }
            }
        };
        /**
        * Internal method to handle showing and hiding items based on tab status
        * @method game.DemoMenu#updateTabAsActive
        * @param  {number} tabIndex  Index of tab to update as active.
        */
        DemoMenu.prototype.updateTabAsActive = function (tabIndex) {
            for (var i = 0; i < this.tabs.length; ++i) {
                if (i == tabIndex) {
                    this.tabs[i].active = true;
                    this.tabs[i].text.getTransform().setVisible(true);
                    for (var j = 0; j < this.tabs[i].items.length; ++j) {
                        var item = this.tabs[i].items[j];
                        item.text.getTransform().setVisible(true);
                    }
                }
                else {
                    this.tabs[i].active = false;
                    for (var j = 0; j < this.tabs[i].items.length; ++j) {
                        var item = this.tabs[i].items[j];
                        item.text.getTransform().setVisible(false);
                    }
                }
            }
        };
        return DemoMenu;
    })();
    exports.DemoMenu = DemoMenu;
    /**
     * @file Console.ts
     *
     * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
     */
    /**
     * Shows a graphical display of system information
     */
    var Console = (function () {
        /**
         * Create a Console object
         *
         * @param  win  the current window object
         * @param  doc  the current document object
         * @param  backingRect  the backing for the display
         * @param  metricsText  the text for the metrics
         */
        function Console(win, doc, backingRect, metricsText) {
            var _this = this;
            this.win = win;
            this.doc = doc;
            this.backingRect = backingRect;
            this.metricsText = metricsText;
            this.textLines = new Array();
            this.lastUpdateTime = 0;
            this.displayUpdateAccum = 0;
            this.times = new Array();
            this.ticks = new Array();
            this.gsapVersion = TimelineMax.version;
            this.gbVerify = false;
            this.lastUsedJSHeapSize = 0;
            if (win.performance && 'memory' in win.performance) {
                this.gbVerify = true;
                this.garbageCollections = 0;
                this.lastUsedJSHeapSize = win.performance.memory.usedJSHeapSize;
            }
            this.backingRect.getTransform().setZOrder(10000);
            this.backingRect.getBox().setColor('rgb(0,0,0)');
            this.backingRect.getBox().setOpacity(0.75);
            this.metricsText.getTransform().setPosition(10, 10);
            var scalar = this.backingRect.getTransform().getTranslationScale();
            this.metricsText.getText().setFont('16px arial');
            this.metricsText.getText().setLineHeight(1.2);
            this.metricsText.getText().setMaxLineWidth(this.backingRect.getBox().getWidth() * scalar);
            this.backingRect.getTransform().setVisible(false);
            TweenLite.ticker.addEventListener('tick', function (p) { return _this.update(p); }, this, true, 2);
        }
        /**
         * Set the profiler object to obtain profiles from
         *
         * @param  profiler  runtime profiler object
         */
        Console.prototype.setProfiler = function (profiler) {
            this.profiler = profiler;
        };
        /**
         * Set the system metadata
         *
         * @param  resourceVersion  the resource server version
         */
        Console.prototype.setMetaData = function (resourceVersion, assetResolutionW, assetResolutionH) {
            this.resourceVersion = resourceVersion;
            this.assetResolution = assetResolutionW + 'x' + assetResolutionH;
        };
        /**
         * Show the display
         */
        Console.prototype.show = function () {
            this.backingRect.getTransform().setVisible(true);
        };
        /**
         * Hide the display
         */
        Console.prototype.hide = function () {
            this.backingRect.getTransform().setVisible(false);
        };
        /**
         * Called on each frame tick of the runtime
         *
         * @param  time  current clock time
         * @param  elapsed  elapsed time since last frame tick. in seconds.
         */
        Console.prototype.tick = function (time, elapsed) {
            this.checkGarbageCollection();
            this.displayUpdateAccum += elapsed * 1000;
            if (this.displayUpdateAccum > 500) {
                this.updateText();
                this.displayUpdateAccum = 0;
            }
            this.trackFPS(time, elapsed);
        };
        /**
         * Update the the display
         */
        Console.prototype.update = function (e) {
            // Elapsed time
            var t = e.target.time - this.lastUpdateTime;
            this.checkGarbageCollection();
            this.displayUpdateAccum += t * 1000;
            if (this.displayUpdateAccum > 500) {
                this.updateText();
                this.displayUpdateAccum = 0;
            }
            this.trackFPS(e.target.time, t);
            this.lastUpdateTime = e.target.time;
        };
        /**
         * Checks to see if there was a garbage collection cycle that happened
         *
         * (<any>this.win.performance).memory.jsHeapSizeLimit
         * (<any>this.win.performance).memory.usedJSHeapSize
         * (<any>this.win.performance).memory.totalJSHeapSize
         */
        Console.prototype.checkGarbageCollection = function () {
            var collected = false;
            if (this.gbVerify) {
                if (this.win.performance.memory.usedJSHeapSize < this.lastUsedJSHeapSize) {
                    this.garbageCollections++;
                    // console.log("GARBAGE COLLECTED: " + this.garbageCollections)
                    // console.log("Total   : " + ((<any>this.win.performance).memory.totalJSHeapSize/(1000*1000)).toFixed(2) + "MB")
                    // console.log("LastUsed: " + (this.lastUsedJSHeapSize/(1000*1000)).toFixed(2) + "MB")
                    // console.log("Used    : " + ((<any>this.win.performance).memory.usedJSHeapSize/(1000*1000)).toFixed(2) + "MB")
                    collected = true;
                }
                this.lastUsedJSHeapSize = this.win.performance.memory.usedJSHeapSize;
            }
            return collected;
        };
        /**
         * Save framerate measure info
         *
         * @param  time  current time
         * @param  elapsed  elapse time since last frame tick. in seconds.
         */
        Console.prototype.trackFPS = function (time, elapsed) {
            this.ticks.unshift(elapsed);
            while (this.ticks.length > 100) {
                this.ticks.pop();
            }
            this.times.unshift(time);
            while (this.times.length > 100) {
                this.times.pop();
            }
        };
        /**
         * Gets the current measured framerate in frames per second
         *
         * @param  ticks  number of ticks to base the framerate on
         */
        Console.prototype.getMeasuredFPS = function (ticks) {
            if (this.times.length < 2) {
                return -1.0;
            }
            var chkTicks = 60;
            // By default, calculate FPS for the past 1 second
            if (ticks == undefined) {
                ticks = chkTicks | 0;
            }
            var tticks = Math.min(this.times.length - 1, ticks);
            return ((1000 / ((this.times[0] - this.times[tticks]) / tticks)) / 1000);
        };
        /**
         * Update the console text
         */
        Console.prototype.updateText = function () {
            var text = "FPS: " + this.getMeasuredFPS().toFixed();
            var viewportWidth = Math.max(this.win.innerWidth, this.doc.documentElement.clientWidth);
            var viewportHeight = Math.max(this.win.innerHeight, this.doc.documentElement.clientHeight);
            text += "    Viewport: " + viewportWidth + "x" + viewportHeight;
            text += "    AssetRes: " + this.assetResolution;
            text += "\nResourceVer: " + this.resourceVersion;
            text += "\nGSAPVer: " + this.gsapVersion;
            if (this.profiler != undefined) {
                text += "\n \nTime Profiles\n-----------------";
                var profiles = this.profiler.getTimeProfiles();
                for (var profile in profiles) {
                    if (profiles.hasOwnProperty(profile)) {
                        text += '\n' + profile + ": " + profiles[profile] + "ms";
                    }
                }
                profiles = this.profiler.getAccumulatedTimeProfiles();
                for (var profile in profiles) {
                    if (profiles.hasOwnProperty(profile)) {
                        text += '\n' + profile + ": " + profiles[profile].duration + "ms";
                    }
                }
                text += "\n \nInfo Profiles\n----------------";
                profiles = this.profiler.getInfoProfiles();
                for (var profile in profiles) {
                    if (profiles.hasOwnProperty(profile)) {
                        text += '\n' + profile + ": " + profiles[profile];
                    }
                }
                text += "\n \nSystem Info\n----------------";
                var sysInfo = this.profiler.getSystemInfo();
                for (var i = 0; i < sysInfo.length; ++i) {
                    text += '\n' + sysInfo[i];
                }
            }
            this.metricsText.getText().setText(text);
        };
        return Console;
    })();
    exports.Console = Console;
});
