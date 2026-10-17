var animatecc;
(function (animatecc) {
    var BitmapData = (function () {
        function BitmapData() {
        }
        BitmapData.prototype.createObject = function (command) {
            this._instanceName = command.instanceName;
            if (animatecc.SymbolCache.cache[this.charid]) {
                for (var i = 0; i < animatecc.SymbolCache.cache[this.charid].length; i++) {
                    if (!animatecc.SymbolCache.cache[this.charid][i].parent) {
                        var ob = animatecc.SymbolCache.cache[this.charid][i];
                        ob.x = command.transformMatrix.tx;
                        ob.y = command.transformMatrix.ty;
                        return ob;
                    }
                }
            }
            var asset = new assets.AssetCache().getAssetById(this.bitmapPath);
            var bitmap = new rendering.Bitmap(asset);
            if (!animatecc.SymbolCache.cache[this.charid]) {
                animatecc.SymbolCache.cache[this.charid] = [];
            }
            animatecc.SymbolCache.cache[this.charid].push(bitmap);
            bitmap.x = command.transformMatrix.tx;
            bitmap.y = command.transformMatrix.ty;
            //bitmap.scaleX =
            return bitmap;
        };
        BitmapData.prototype.getInstanceName = function () {
            return this._instanceName;
        };
        return BitmapData;
    })();
    animatecc.BitmapData = BitmapData;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var Frame = (function () {
        function Frame() {
        }
        return Frame;
    })();
    animatecc.Frame = Frame;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var Logger = (function () {
        function Logger() {
        }
        Logger.log = function (value) {
            console.log("");
            console.log(value);
        };
        return Logger;
    })();
    animatecc.Logger = Logger;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var TimelineCommand = (function () {
        function TimelineCommand() {
        }
        return TimelineCommand;
    })();
    animatecc.TimelineCommand = TimelineCommand;
})(animatecc || (animatecc = {}));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="TimelineCommand.ts" />
var animatecc;
(function (animatecc) {
    var MaskCommand = (function (_super) {
        __extends(MaskCommand, _super);
        function MaskCommand() {
            _super.apply(this, arguments);
        }
        return MaskCommand;
    })(animatecc.TimelineCommand);
    animatecc.MaskCommand = MaskCommand;
})(animatecc || (animatecc = {}));
/// <reference path="TimelineCommand.ts" />
var animatecc;
(function (animatecc) {
    var MoveCommand = (function (_super) {
        __extends(MoveCommand, _super);
        function MoveCommand() {
            _super.apply(this, arguments);
        }
        return MoveCommand;
    })(animatecc.TimelineCommand);
    animatecc.MoveCommand = MoveCommand;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var Parser = (function () {
        function Parser() {
        }
        Parser.parseBitmaps = function (data) {
            console.log("");
            console.log("Parsing Bitmap data");
            var bitmaps = [];
            for (var i = 0; i < data.DOMDocument.Bitmaps.length; i++) {
                var bitmap = new animatecc.BitmapData();
                bitmap.charid = parseFloat(data.DOMDocument.Bitmaps[i].charid);
                bitmap.height = parseFloat(data.DOMDocument.Bitmaps[i].height);
                bitmap.width = parseFloat(data.DOMDocument.Bitmaps[i].width);
                bitmap.bitmapPath = data.DOMDocument.Bitmaps[i].bitmapPath;
                bitmaps[bitmap.charid] = bitmap;
            }
            console.log("Bitmap Data parsed:");
            //console.log(bitmaps);
            return bitmaps;
        };
        Parser.parseText = function (data, creatables) {
            console.log("");
            console.log("Parsing Text data");
            for (var i = 0; i < data.DOMDocument.Text.length; i++) {
                var txt = new animatecc.TextData();
                txt.charid = parseFloat(data.DOMDocument.Text[i].charid);
                txt.displayText = data.DOMDocument.Text[i].displayText;
                txt.font = data.DOMDocument.Text[i].font;
                txt.fontSize = parseFloat(data.DOMDocument.Text[i].fontSize);
                txt.color = data.DOMDocument.Text[i].color;
                txt.align = data.DOMDocument.Text[i].align;
                if (data.DOMDocument.Text[i].instanceName) {
                    txt.instanceName = data.DOMDocument.Text[i].instanceName;
                }
                creatables[txt.charid] = txt;
            }
            console.log("Text Data parsed:");
            //console.log(bitmaps);
            return creatables;
        };
        Parser.parseShapes = function (data, creatables) {
            console.log("");
            console.log("Parsing Shape data");
            for (var i = 0; i < data.DOMDocument.Shape.length; i++) {
                var shape = new animatecc.Shape();
                shape.charid = parseFloat(data.DOMDocument.Shape[i].charid);
                shape.path = new animatecc.ShapePath();
                shape.path.color = data.DOMDocument.Shape[i].path[0].color;
                shape.path.colorOpacity = data.DOMDocument.Shape[i].path[0].colorOpacity;
                if (data.DOMDocument.Shape[i].path[0].linearGradient) {
                    if (data.DOMDocument.Shape[i].path[0].linearGradient.stop) {
                        if (data.DOMDocument.Shape[i].path[0].linearGradient.stop[0]) {
                            shape.path.color = data.DOMDocument.Shape[i].path[0].linearGradient.stop[0].stopColor;
                            shape.path.colorOpacity = data.DOMDocument.Shape[i].path[0].linearGradient.stop[0].stopOpacity;
                        }
                    }
                }
                shape.path.pathType = data.DOMDocument.Shape[i].path[0].pathType;
                shape.path.stroke = data.DOMDocument.Shape[i].path[0].stroke;
                shape.path.path = [];
                var pathData = data.DOMDocument.Shape[i].path[0].d.split("|");
                for (var j = 0; j < pathData.length; j++) {
                    var part = new animatecc.PathPart;
                    var d = pathData[j].split(",");
                    part.type = d[0];
                    part.x = parseFloat(d[1]);
                    part.y = parseFloat(d[2]);
                    if (d[3]) {
                        part.controlX = parseFloat(d[3]);
                    }
                    if (d[4]) {
                        part.controlY = parseFloat(d[4]);
                    }
                    shape.path.path.push(part);
                }
                creatables[shape.charid] = shape;
            }
            console.log("Shape Data parsed:");
            //console.log(creatables);
            return creatables;
        };
        Parser.parseTimelines = function (data) {
            console.log("");
            console.log("Parsing Timeline data");
            var timelines = [];
            for (var i = 0; i < data.DOMDocument.Timeline.length; i++) {
                var timeline = new animatecc.TimelineData();
                if (data.DOMDocument.Timeline[i].charid) {
                    timeline.charid = parseFloat(data.DOMDocument.Timeline[i].charid);
                }
                this.createFrames(timeline, data.DOMDocument.Timeline[i]);
                timelines.push(timeline);
            }
            console.log("Timeline data parsed:");
            //console.log(timelines);
            return timelines;
        };
        Parser.createFrames = function (timeline, data) {
            console.log("Parsing Frame data for timeline");
            timeline.frames = [];
            for (var i = 0; i < data.Frame.length; i++) {
                var frame = new animatecc.Frame();
                frame.num = parseFloat(data.Frame[i].num);
                timeline.frames.push(frame);
                this.createCommands(frame, data.Frame[i]);
            }
        };
        Parser.createCommands = function (frame, data) {
            console.log("Parsing Command data for frame");
            frame.commands = [];
            for (var i = 0; i < data.Command.length; i++) {
                var commandType = data.Command[i].cmdType;
                if (commandType.toLowerCase() == "place") {
                    frame.commands.push(this.parsePlaceCommand(data.Command[i]));
                }
                else if (commandType.toLowerCase() == "move") {
                    frame.commands.push(this.parseMoveCommand(data.Command[i]));
                }
                else if (commandType.toLowerCase() == "remove") {
                    frame.commands.push(this.parseRemoveCommand(data.Command[i]));
                }
                else if (commandType.toLowerCase() == "updatevisibility") {
                    frame.commands.push(this.parseVisibilityCommand(data.Command[i]));
                }
                else if (commandType.toLowerCase() == "updatemask") {
                    frame.commands.push(this.parseMaskCommand(data.Command[i]));
                }
                else if (commandType.toLowerCase() == "updatezorder") {
                    frame.commands.push(this.parseOrderCommand(data.Command[i]));
                }
                else if (commandType.toLowerCase() == "updatecolortransform") {
                    frame.commands.push(this.parseColorCommand(data.Command[i]));
                }
                else {
                    console.log("Error - Unknown Command Type: " + commandType);
                    console.log("Command will be omitted");
                }
            }
        };
        Parser.parseColorCommand = function (data) {
            var command = new animatecc.UpdateColorCommand();
            command.cmdType = data.cmdType;
            command.objectId = parseFloat(data.objectId);
            command.alpha = parseFloat(data.transformMatrix.split(",")[18]);
            return command;
        };
        Parser.parseOrderCommand = function (data) {
            var command = new animatecc.UpdateOrderCommand();
            command.cmdType = data.cmdType;
            command.objectId = parseFloat(data.objectId);
            command.placeAfter = parseFloat(data.placeAfter);
            return command;
        };
        Parser.parsePlaceCommand = function (data) {
            var command = new animatecc.PlaceCommand();
            command.cmdType = data.cmdType;
            command.charid = parseFloat(data.charid);
            command.objectId = parseFloat(data.objectId);
            command.placeAfter = parseFloat(data.placeAfter);
            if (data.isButton) {
                command.isButton = parseFloat(data.isButton);
            }
            if (data.transformMatrix) {
                var tData = data.transformMatrix.split(",");
                command.transformMatrix = new animatecc.TransformMatrix(parseFloat(tData[0]), parseFloat(tData[1]), parseFloat(tData[2]), parseFloat(tData[3]), parseFloat(tData[4]), parseFloat(tData[5]));
            }
            if (data.bounds) {
                var rData = data.bounds.split(",");
                command.bounds = new rendering.Rectangle(parseFloat(rData[0]), parseFloat(rData[1]), parseFloat(rData[2]), parseFloat(rData[3]));
            }
            if (data.instanceName) {
                command.instanceName = data.instanceName;
            }
            return command;
        };
        Parser.parseMaskCommand = function (data) {
            var command = new animatecc.MaskCommand();
            command.cmdType = data.cmdType;
            command.objectId = parseFloat(data.objectId);
            command.maskTill = parseFloat(data.maskTill);
            return command;
        };
        Parser.parseVisibilityCommand = function (data) {
            var command = new animatecc.UpdateVisibilityCommand();
            command.cmdType = data.cmdType;
            command.visibility = data.visibility.toLowerCase() == "true";
            command.objectId = parseFloat(data.objectId);
            return command;
        };
        Parser.parseRemoveCommand = function (data) {
            var command = new animatecc.RemoveCommand();
            command.cmdType = data.cmdType;
            command.objectId = parseFloat(data.objectId);
            return command;
        };
        Parser.parseMoveCommand = function (data) {
            var command = new animatecc.MoveCommand();
            command.cmdType = data.cmdType;
            command.objectId = parseFloat(data.objectId);
            if (data.transformMatrix) {
                var tData = data.transformMatrix.split(",");
                command.transformMatrix = new animatecc.TransformMatrix(parseFloat(tData[0]), parseFloat(tData[1]), parseFloat(tData[2]), parseFloat(tData[3]), parseFloat(tData[4]), parseFloat(tData[5]));
            }
            return command;
        };
        return Parser;
    })();
    animatecc.Parser = Parser;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var PathPart = (function () {
        function PathPart() {
        }
        return PathPart;
    })();
    animatecc.PathPart = PathPart;
})(animatecc || (animatecc = {}));
/// <reference path="TimelineCommand.ts" />
var animatecc;
(function (animatecc) {
    var PlaceCommand = (function (_super) {
        __extends(PlaceCommand, _super);
        function PlaceCommand() {
            _super.apply(this, arguments);
        }
        return PlaceCommand;
    })(animatecc.TimelineCommand);
    animatecc.PlaceCommand = PlaceCommand;
})(animatecc || (animatecc = {}));
/// <reference path="TimelineCommand.ts" />
var animatecc;
(function (animatecc) {
    var RemoveCommand = (function (_super) {
        __extends(RemoveCommand, _super);
        function RemoveCommand() {
            _super.apply(this, arguments);
        }
        return RemoveCommand;
    })(animatecc.TimelineCommand);
    animatecc.RemoveCommand = RemoveCommand;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var Shape = (function () {
        function Shape() {
        }
        Shape.prototype.createObject = function (command) {
            this._instanceName = command.instanceName;
            if (animatecc.SymbolCache.cache[this.charid]) {
                for (var i = 0; i < animatecc.SymbolCache.cache[this.charid].length; i++) {
                    if (!animatecc.SymbolCache.cache[this.charid][i].parent) {
                        return animatecc.SymbolCache.cache[this.charid][i];
                    }
                }
            }
            var g = new rendering.Graphics();
            if (this.path.pathType.toLowerCase() == "fill") {
                if (this.path.color) {
                    g.beginFill(parseInt(this.path.color.replace(/^#/, ''), 16), this.path.colorOpacity);
                }
                else {
                    g.beginFill(0x000000, 1);
                }
            }
            if (this.path.pathType.toLowerCase() == "stroke") {
            }
            for (var i = 0; i < this.path.path.length; i++) {
                var part = this.path.path[i];
                if (part.type.toLowerCase() == "m") {
                    g.moveTo(part.x, part.y);
                }
                if (part.type.toLowerCase() == "l") {
                    g.lineTo(part.x, part.y);
                }
                if (part.type.toLowerCase() == "q") {
                    g.quadraticCurveTo(part.controlX, part.controlY, part.x, part.y);
                }
            }
            if (this.path.pathType.toLowerCase() == "fill") {
                g.endFill();
            }
            g.x = command.transformMatrix.tx;
            g.y = command.transformMatrix.ty;
            if (!animatecc.SymbolCache.cache[this.charid]) {
                animatecc.SymbolCache.cache[this.charid] = [];
            }
            animatecc.SymbolCache.cache[this.charid].push(g);
            return g;
        };
        Shape.prototype.getInstanceName = function () {
            return this._instanceName;
        };
        return Shape;
    })();
    animatecc.Shape = Shape;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var ShapePath = (function () {
        function ShapePath() {
        }
        return ShapePath;
    })();
    animatecc.ShapePath = ShapePath;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var SymbolCache = (function () {
        function SymbolCache() {
        }
        SymbolCache.cache = [];
        return SymbolCache;
    })();
    animatecc.SymbolCache = SymbolCache;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var TextData = (function () {
        function TextData() {
        }
        TextData.prototype.createObject = function (command) {
            var container = new rendering.DisplayObjectContainer();
            var text = new rendering.Text(this.displayText);
            text.font = this.font;
            text.fontSize = this.fontSize;
            text.colour = this.color;
            text.scaleToWidth = command.bounds.width;
            text.scaleToHeight = command.bounds.height;
            text.debug = false;
            container.x = command.transformMatrix.tx;
            container.y = command.transformMatrix.ty;
            if (this.align == "center") {
                text.x = command.bounds.width / 2 - text.width / 2;
            }
            else {
                container.x += command.bounds.x;
                container.y += command.bounds.y;
            }
            container.addChild(text);
            return container;
        };
        TextData.prototype.getInstanceName = function () {
            return this.instanceName;
        };
        return TextData;
    })();
    animatecc.TextData = TextData;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var Timeline = (function (_super) {
        __extends(Timeline, _super);
        function Timeline(timelineData) {
            _super.call(this);
            this._then = Date.now();
            this._fps = timelineData.fps;
            this._interval = 1000 / this._fps;
            this._useMs = timelineData.useMs;
            this._timelineData = timelineData;
            this._totalFrames = this._timelineData.frames.length;
            this._currentFrame = 0;
            this._objects = [];
            this._frameCount = 0;
        }
        Timeline.prototype.play = function (stopFrame) {
            if (stopFrame === void 0) { stopFrame = -1; }
            this._playing = true;
            this._stopFrame = stopFrame;
            this.gotoNextFrame();
        };
        Timeline.prototype.stop = function () {
            this._playing = false;
            this.recurseChildrenTimelinesStop(this);
        };
        Timeline.prototype.getInstanceNames = function () {
            return this._instanceNames;
        };
        Timeline.prototype.gotoNextFrame = function () {
            if (this._currentFrame == 0) {
                this._instanceNames = [];
                this.flushView(this);
            }
            this.processFrame(this._currentFrame);
            if (this._currentFrame == this._stopFrame) {
                this.stop();
            }
            var f = this._currentFrame + 1;
            if (f >= this._totalFrames) {
                f = 0;
            }
            this._currentFrame = f;
            var event = new animatecc.TimelineEvent(animatecc.TimelineEvent.ENTER_FRAME);
            event.timeline = this;
            this.dispatchEvent(event);
        };
        Object.defineProperty(Timeline.prototype, "currentFrame", {
            get: function () {
                return this._currentFrame;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Timeline.prototype, "totalFrames", {
            get: function () {
                return this._totalFrames;
            },
            enumerable: true,
            configurable: true
        });
        Timeline.prototype.gotoAndPlay = function (frame, stopFrame) {
            if (stopFrame === void 0) { stopFrame = -1; }
            this.gotoAndStop(frame);
            this.play(stopFrame);
        };
        Timeline.prototype.gotoAndStop = function (frame) {
            this._playing = false;
            this._currentFrame = 0;
            while (this._currentFrame != frame) {
                this.gotoNextFrame();
                this.recurseChildrenTimelinesNext(this);
            }
        };
        Timeline.prototype.recurseChildrenTimelinesNext = function (object) {
            for (var i = 0; i < object.children.length; i++) {
                if (object.children[i].gotoNextFrame) {
                    object.children[i].stop();
                    object.children[i].gotoNextFrame();
                    this.recurseChildrenTimelinesNext(object.children[i]);
                }
            }
        };
        Timeline.prototype.recurseChildrenTimelinesStop = function (object) {
            for (var i = 0; i < object.children.length; i++) {
                if (object.children[i].gotoNextFrame) {
                    object.children[i].stop();
                    this.recurseChildrenTimelinesStop(object.children[i]);
                }
            }
        };
        Timeline.prototype.flushView = function (view) {
            //console.log("Loop Complete - Flushing View")
            while (view.children.length > 0) {
                this.flushView(view.children[0]);
                view.removeChild(view.children[0]);
            }
        };
        Timeline.prototype.processFrame = function (frame) {
            var j;
            var len = this._timelineData.frames.length;
            var frames = this._timelineData.frames;
            var k;
            for (j = 0; j < len; j++) {
                if (frames[j].num == frame) {
                    var cLen = frames[j].commands.length;
                    var commands = frames[j].commands;
                    for (k = 0; k < cLen; k++) {
                        this.executeCommand(commands[k]);
                    }
                }
            }
        };
        Timeline.prototype.executeCommand = function (command) {
            if (command.cmdType.toLowerCase() == "place") {
                this.executePlaceCommand(command);
            }
            else if (command.cmdType.toLowerCase() == "move") {
                this.executeMoveCommand(command);
            }
            else if (command.cmdType.toLowerCase() == "remove") {
                this.executeRemoveCommand(command);
            }
            else if (command.cmdType.toLowerCase() == "updatevisibility") {
                this.executeVisibilityCommand(command);
            }
            else if (command.cmdType.toLowerCase() == "updatemask") {
                this.executeMaskCommand(command);
            }
            else if (command.cmdType.toLowerCase() == "updatezorder") {
                this.executeOrderCommand(command);
            }
            else if (command.cmdType.toLowerCase() == "updatecolortransform") {
                this.executeColorCommand(command);
            }
        };
        Timeline.prototype.executeOrderCommand = function (command) {
            var display = this._objects[command.objectId];
            var parent = display.parent;
            if (parent) {
                parent.removeChild(display);
                var subIndex = parent.children.indexOf(this._objects[command.placeAfter]);
                if (subIndex != -1) {
                    parent.addChildAt(display, subIndex);
                }
                else {
                    parent.addChild(display);
                    console.log("cannot move z order to index " + subIndex);
                }
            }
        };
        Timeline.prototype.executeMaskCommand = function (command) {
            var display = this._objects[command.objectId];
            if (display) {
                var i = command.objectId + 1;
                /*while(i != command.maskTill) {
                    if(this._objects[i]) {
                        this.performMask(display, this._objects[i]);
                    }
                    i++;
                    if(i>=this._objects.length) {
                        i = 0;
                    }
                }*/
                this.performMask(display, this._objects[command.maskTill]);
            }
            else {
                console.log("Failed mask command");
            }
        };
        Timeline.prototype.performMask = function (display, displayToMask) {
            var mask = this.getMask([display]);
            if (mask) {
                displayToMask.mask = mask;
            }
            else {
                console.log("Failed mask command");
            }
        };
        Timeline.prototype.getMask = function (ob) {
            var g;
            var children = [];
            for (var j = 0; j < ob.length; j++) {
                if (ob[j].getGraphics) {
                    return ob[j];
                }
                for (var i = 0; i < ob[j].children.length; i++) {
                    if (ob[j].children[i].getGraphics) {
                        return ob[j].children[i];
                    }
                    children.push(ob[j].children[i]);
                }
            }
            if (children.length > 0) {
                return this.getMask(children);
            }
            return null;
        };
        Timeline.prototype.executeColorCommand = function (command) {
            var display = this._objects[command.objectId];
            if (display) {
                display.alpha = command.alpha;
            }
            else {
                console.log("Failed color command");
            }
        };
        Timeline.prototype.executeVisibilityCommand = function (command) {
            var display = this._objects[command.objectId];
            if (display) {
                display.visible = command.visibility;
            }
            else {
                console.log("Failed visibility command");
            }
        };
        Timeline.prototype.executeMoveCommand = function (command) {
            var bitmap = this._objects[command.objectId];
            var scaleX, scaleY, rotation, skewX, skewY;
            var matrix = command.transformMatrix;
            var angle = Math.atan2(matrix.b, matrix.a);
            if (matrix.a < 0 && matrix.d >= 0) {
                angle += (angle <= 0) ? Math.PI : -Math.PI;
            }
            scaleX = Math.sqrt((matrix.a * matrix.a) + (matrix.b * matrix.b));
            if (matrix.a < 0 && matrix.d > 0) {
                scaleX = -scaleX;
            }
            scaleY = Math.sqrt((matrix.c * matrix.c) + (matrix.d * matrix.d));
            if (matrix.d < 0 && matrix.a > 0) {
                scaleY = -scaleY;
            }
            skewX = Math.atan2(-(matrix.c), matrix.d);
            skewY = Math.atan2(matrix.b, matrix.a);
            skewX = skewX * (180 * 7 / 22);
            skewY = skewY * (180 * 7 / 22);
            if (bitmap) {
                bitmap.x = command.transformMatrix.tx;
                bitmap.y = command.transformMatrix.ty;
                bitmap.scaleX = scaleX;
                bitmap.scaleY = scaleY;
                bitmap.rotation = angle / (Math.PI / 180);
            }
            else {
                console.log("Failed move command");
            }
        };
        Timeline.prototype.executePlaceCommand = function (command) {
            var creatable = this._timelineData.creatables[command.charid];
            if (creatable) {
                var scaleX, scaleY, rotation, skewX, skewY;
                var matrix = command.transformMatrix;
                var angle = Math.atan2(matrix.b, matrix.a);
                if (matrix.a < 0 && matrix.d >= 0) {
                    angle += (angle <= 0) ? Math.PI : -Math.PI;
                }
                scaleX = Math.sqrt((matrix.a * matrix.a) + (matrix.b * matrix.b));
                if (matrix.a < 0 && matrix.d > 0) {
                    scaleX = -scaleX;
                }
                scaleY = Math.sqrt((matrix.c * matrix.c) + (matrix.d * matrix.d));
                if (matrix.d < 0 && matrix.a > 0) {
                    scaleY = -scaleY;
                }
                skewX = Math.atan2(-(matrix.c), matrix.d);
                skewY = Math.atan2(matrix.b, matrix.a);
                skewX = skewX * (180 * 7 / 22);
                skewY = skewY * (180 * 7 / 22);
                var display = creatable.createObject(command);
                if (creatable.getInstanceName() && creatable.getInstanceName() != "") {
                    this._instanceNames[creatable.getInstanceName()] = display;
                }
                display.scaleX = scaleX;
                display.scaleY = scaleY;
                display.rotation = angle / (Math.PI / 180);
                this._objects[command.objectId] = display;
                if (command.placeAfter != undefined && command.placeAfter != 0) {
                    var subIndex = this.children.indexOf(this._objects[command.placeAfter]);
                    if (subIndex > -1) {
                        display.debugId = Math.random() * 100;
                        this.addChildAt(display, subIndex);
                    }
                    else {
                        if (command.placeAfter != 0) {
                            console.log("cannot place at z order " + command.placeAfter);
                        }
                        this.addChild(display);
                    }
                }
                else {
                    this.addChild(display);
                }
            }
            else {
                console.log("Failed place command");
            }
        };
        Timeline.prototype.executeRemoveCommand = function (command) {
            if (this._objects[command.objectId] && this._objects[command.objectId].parent) {
                this._objects[command.objectId].parent.removeChild(this._objects[command.objectId]);
                var instanceIndex = this._instanceNames.indexOf(this._objects[command.objectId]);
                if (instanceIndex != -1) {
                    this._instanceNames[instanceIndex] = null;
                }
                this.flushView(this._objects[command.objectId]);
            }
            else {
                console.log("Failed remove command");
            }
        };
        Timeline.prototype.onUpdate = function () {
            _super.prototype.onUpdate.call(this);
            if (!this.parent) {
                return;
            }
            if (this._playing) {
                if (this._useMs) {
                    this._now = Date.now();
                    this._delta = this._now - this._then;
                    if (this._delta > this._interval) {
                        this._then = this._now - (this._delta % this._interval);
                        while (this._delta > this._interval && this._playing) {
                            this._delta -= this._interval;
                            this.gotoNextFrame();
                        }
                    }
                }
                else {
                    this._frameCount += this._fps / 60;
                    while (this._frameCount > 1) {
                        this._frameCount -= 1;
                        this.gotoNextFrame();
                    }
                }
            }
        };
        return Timeline;
    })(rendering.DisplayObjectContainer);
    animatecc.Timeline = Timeline;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var TimelineAnimator = (function (_super) {
        __extends(TimelineAnimator, _super);
        function TimelineAnimator(data, fps, useMs, attemptLoad) {
            if (useMs === void 0) { useMs = true; }
            if (attemptLoad === void 0) { attemptLoad = false; }
            _super.call(this);
            this._jsonData = data;
            this._creatables = animatecc.Parser.parseBitmaps(this._jsonData);
            this._creatables = animatecc.Parser.parseShapes(this._jsonData, this._creatables);
            this._creatables = animatecc.Parser.parseText(this._jsonData, this._creatables);
            this._timelines = [];
            var timelines = animatecc.Parser.parseTimelines(this._jsonData);
            for (var i = 0; i < timelines.length; i++) {
                timelines[i].fps = fps;
                timelines[i].useMs = useMs;
                timelines[i].creatables = this._creatables;
                if (timelines[i].charid == undefined) {
                    this._timelines.push(new animatecc.Timeline(timelines[i]));
                }
                else {
                    this._creatables[timelines[i].charid] = timelines[i];
                }
            }
            if (attemptLoad) {
                this.loadAssets();
            }
        }
        TimelineAnimator.prototype.play = function () {
            for (var i = 0; i < this._timelines.length; i++) {
                this.addChild(this._timelines[i]);
                this._timelines[i].play();
            }
        };
        TimelineAnimator.prototype.loadAssets = function () {
            console.log("");
            console.log("Loading assets for timline");
            var loader = new assets.AssetLoader();
            var hasFiles = false;
            for (var i = 0; i < this._creatables.length; i++) {
                if (this._creatables[i] && this._creatables[i].bitmapPath) {
                    loader.addFile(this._creatables[i].bitmapPath, this._creatables[i].bitmapPath);
                    hasFiles = true;
                }
            }
            if (hasFiles) {
                loader.addEventListener(assets.AssetLoaderEvent.COMPLETE, this.loadAssetsComplete, this);
                loader.load();
            }
            else {
                this.loadAssetsComplete(null);
            }
        };
        TimelineAnimator.prototype.loadAssetsComplete = function (e) {
            console.log("Assets Loaded");
            for (var i = 0; i < this._timelines.length; i++) {
                this.addChild(this._timelines[i]);
                this._timelines[i].play();
            }
            console.log("Starting Animations");
        };
        TimelineAnimator.prototype.getTimelines = function () {
            return this._timelines;
        };
        TimelineAnimator.prototype.getSymbolById = function (name) {
            var instances = [];
            this.getInstances(this, instances, name);
            return instances;
        };
        TimelineAnimator.prototype.getInstances = function (ob, instances, name) {
            for (var i = 0; i < ob.children.length; i++) {
                if (ob.children[i].getInstanceNames) {
                    if (ob.children[i].getInstanceNames()[name] && ob.children[i].getInstanceNames()[name].parent) {
                        instances.push(ob.children[i].getInstanceNames()[name]);
                    }
                }
                this.getInstances(ob.children[i], instances, name);
            }
        };
        return TimelineAnimator;
    })(rendering.DisplayObjectContainer);
    animatecc.TimelineAnimator = TimelineAnimator;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var TimelineButton = (function (_super) {
        __extends(TimelineButton, _super);
        function TimelineButton() {
            _super.call(this);
        }
        TimelineButton.prototype.setData = function (timelineData, objectId) {
            this._objects = [];
            this._objectId = objectId;
            this.upImg = new rendering.DisplayObjectContainer();
            this.addChild(this.upImg);
            this.overImg = new rendering.DisplayObjectContainer();
            this.addChild(this.overImg);
            this.downImg = new rendering.DisplayObjectContainer();
            this.addChild(this.downImg);
            this.hitImg = new rendering.DisplayObjectContainer();
            this.addChild(this.hitImg);
            this.setImage(timelineData, 0, this.upImg);
            this.setImage(timelineData, 1, this.overImg);
            this.setImage(timelineData, 2, this.downImg);
            this.setImage(timelineData, 3, this.hitImg);
            /*if(TimelineButton.cachedStates[this._objectId]) {
                if(TimelineButton.cachedStates[this._objectId] == "down") {
                    this._down = true;
                }
                else if(TimelineButton.cachedStates[this._objectId] == "over") {
                    this._over = true;
                }
            }*/
            this.setState();
        };
        TimelineButton.prototype.setState = function () {
            this.upImg.visible = false;
            this.overImg.visible = false;
            this.downImg.visible = false;
            this.hitImg.visible = false;
            if (this._down && this.downImg.children.length > 0) {
                this.downImg.visible = true;
                TimelineButton.cachedStates[this._objectId] = "down";
            }
            else if (this._over && this.overImg.children.length > 0) {
                this.overImg.visible = true;
                TimelineButton.cachedStates[this._objectId] = "over";
            }
            else {
                this.upImg.visible = true;
            }
        };
        TimelineButton.prototype.onDown = function (event) {
            _super.prototype.onDown.call(this, event);
            this._down = true;
            this.setState();
        };
        /**
         * @inheritdoc
         */
        TimelineButton.prototype.onUp = function (event) {
            _super.prototype.onUp.call(this, event);
            this._down = false;
            this.setState();
        };
        /**
         * @inheritdoc
         */
        TimelineButton.prototype.onOver = function (event) {
            _super.prototype.onOver.call(this, event);
            this._over = true;
            this.setState();
        };
        /**
         * @inheritdoc
         */
        TimelineButton.prototype.onOut = function (event) {
            _super.prototype.onOut.call(this, event);
            this._over = false;
            this._down = false;
            this.setState();
        };
        TimelineButton.prototype.setImage = function (timelineData, frame, img) {
            if (timelineData.frames[frame]) {
                for (var i = 0; i < timelineData.frames[frame].commands.length; i++) {
                    var command = timelineData.frames[frame].commands[i];
                    if (command.cmdType.toLowerCase() == "place") {
                        this.executePlaceCommand(timelineData, command, img);
                    }
                }
            }
        };
        TimelineButton.prototype.executePlaceCommand = function (timelineData, command, img) {
            var creatable = timelineData.creatables[command.charid];
            if (creatable) {
                var scaleX, scaleY, rotation, skewX, skewY;
                var matrix = command.transformMatrix;
                var angle = Math.atan2(matrix.b, matrix.a);
                if (matrix.a < 0 && matrix.d >= 0) {
                    angle += (angle <= 0) ? Math.PI : -Math.PI;
                }
                scaleX = Math.sqrt((matrix.a * matrix.a) + (matrix.b * matrix.b));
                if (matrix.a < 0 && matrix.d > 0) {
                    scaleX = -scaleX;
                }
                scaleY = Math.sqrt((matrix.c * matrix.c) + (matrix.d * matrix.d));
                if (matrix.d < 0 && matrix.a > 0) {
                    scaleY = -scaleY;
                }
                skewX = Math.atan2(-(matrix.c), matrix.d);
                skewY = Math.atan2(matrix.b, matrix.a);
                skewX = skewX * (180 * 7 / 22);
                skewY = skewY * (180 * 7 / 22);
                var display = creatable.createObject(command);
                display.scaleX = scaleX;
                display.scaleY = scaleY;
                display.rotation = angle / (Math.PI / 180);
                this._objects[command.objectId] = display;
                if (command.placeAfter != undefined && command.placeAfter != 0) {
                    var subIndex = img.children.indexOf(this._objects[command.placeAfter]);
                    if (subIndex > -1) {
                        display.debugId = Math.random() * 100;
                        this.addChildAt(display, subIndex);
                    }
                    else {
                        if (command.placeAfter != 0) {
                            console.log("cannot place at z order " + command.placeAfter);
                        }
                        this.addChild(display);
                    }
                }
                else {
                    img.addChild(display);
                }
            }
            else {
                console.log("Failed place command");
            }
        };
        TimelineButton.cachedStates = [];
        return TimelineButton;
    })(rendering.DisplayObjectContainer);
    animatecc.TimelineButton = TimelineButton;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var TimelineData = (function () {
        function TimelineData() {
        }
        TimelineData.prototype.createObject = function (command) {
            this._instanceName = command.instanceName;
            if (command.isButton) {
                if (animatecc.SymbolCache.cache[this.charid]) {
                    for (var i = 0; i < animatecc.SymbolCache.cache[this.charid].length; i++) {
                        if (!animatecc.SymbolCache.cache[this.charid][i].parent) {
                            var ob = animatecc.SymbolCache.cache[this.charid][i];
                            ob.setData(this, command.objectId);
                            ob.x = command.transformMatrix.tx;
                            ob.y = command.transformMatrix.ty;
                            return ob;
                        }
                    }
                }
                var button = new animatecc.TimelineButton();
                button.setData(this, command.objectId);
                button.x = command.transformMatrix.tx;
                button.y = command.transformMatrix.ty;
                if (!animatecc.SymbolCache.cache[this.charid]) {
                    animatecc.SymbolCache.cache[this.charid] = [];
                }
                animatecc.SymbolCache.cache[this.charid].push(button);
                return button;
            }
            var timeline = new animatecc.Timeline(this);
            timeline.x = command.transformMatrix.tx;
            timeline.y = command.transformMatrix.ty;
            timeline.play();
            return timeline;
        };
        TimelineData.prototype.getInstanceName = function () {
            return this._instanceName;
        };
        return TimelineData;
    })();
    animatecc.TimelineData = TimelineData;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var TimelineEvent = (function (_super) {
        __extends(TimelineEvent, _super);
        function TimelineEvent() {
            _super.apply(this, arguments);
        }
        TimelineEvent.ENTER_FRAME = "TimelineEvent_ENTER_FRAME";
        return TimelineEvent;
    })(borgevent.Event);
    animatecc.TimelineEvent = TimelineEvent;
})(animatecc || (animatecc = {}));
var animatecc;
(function (animatecc) {
    var TransformMatrix = (function () {
        function TransformMatrix(a, b, c, d, tx, ty) {
            this.a = a;
            this.b = b;
            this.c = c;
            this.d = d;
            this.tx = tx;
            this.ty = ty;
        }
        return TransformMatrix;
    })();
    animatecc.TransformMatrix = TransformMatrix;
})(animatecc || (animatecc = {}));
/// <reference path="TimelineCommand.ts" />
var animatecc;
(function (animatecc) {
    var UpdateColorCommand = (function (_super) {
        __extends(UpdateColorCommand, _super);
        function UpdateColorCommand() {
            _super.apply(this, arguments);
        }
        return UpdateColorCommand;
    })(animatecc.TimelineCommand);
    animatecc.UpdateColorCommand = UpdateColorCommand;
})(animatecc || (animatecc = {}));
/// <reference path="TimelineCommand.ts" />
var animatecc;
(function (animatecc) {
    var UpdateOrderCommand = (function (_super) {
        __extends(UpdateOrderCommand, _super);
        function UpdateOrderCommand() {
            _super.apply(this, arguments);
        }
        return UpdateOrderCommand;
    })(animatecc.TimelineCommand);
    animatecc.UpdateOrderCommand = UpdateOrderCommand;
})(animatecc || (animatecc = {}));
/// <reference path="TimelineCommand.ts" />
var animatecc;
(function (animatecc) {
    var UpdateVisibilityCommand = (function (_super) {
        __extends(UpdateVisibilityCommand, _super);
        function UpdateVisibilityCommand() {
            _super.apply(this, arguments);
        }
        return UpdateVisibilityCommand;
    })(animatecc.TimelineCommand);
    animatecc.UpdateVisibilityCommand = UpdateVisibilityCommand;
})(animatecc || (animatecc = {}));
var audio;
(function (audio) {
    /**
     * The audio model provides a centralised location for managing AudioSounds. It handles storing/retrieving AudioSounds, muting and interacting with the partner adapter.
     *
     * @export
     * @class AudioModel
     */
    var AudioModel = (function () {
        /**
         * Creates an instance of AudioModel.
         */
        function AudioModel() {
            this._global = new audio.AudioGlobal();
            this._sounds = [];
            this.setVisibilityAPI();
        }
        /**
         * (description)
         *
         * @param {assets.IAsset} asset (description)
         * @param {audio.IAudioSpriteDefinition} [sprite] (description)
         * @returns {audio.AudioSound} (description)
         */
        AudioModel.prototype.addSound = function (asset, sprite) {
            this._sounds[asset.id] = new audio.AudioSound(asset);
            return this._sounds[asset.id];
        };
        /**
         * (description)
         *
         * @param {string} name (description)
         * @returns {audio.AudioSound} (description)
         */
        AudioModel.prototype.getSound = function (name) {
            console.log("AudioModel getSound:", name);
            if (this._sounds[name]) {
                return this._sounds[name];
            }
            return new audio.AudioSound(new assets.Asset("", "", null));
        };
        /**
         * (description)
         *
         * @param {boolean} value (description)
         */
        AudioModel.prototype.partnerAdapterMute = function (value) {
            util.PartnerAdapter.PartnerAdapterMuted = value;
            this.mute(value);
        };
        /**
         * (description)
         *
         * @param {boolean} value (description)
         */
        AudioModel.prototype.mute = function (value) {
            console.log("Audio is muted", value);
            if (value) {
                this._global.mute();
            }
            else {
                if (!util.PartnerAdapter.PartnerAdapterMuted) {
                    this._global.unmute();
                }
            }
        };
        /**
         * (description)
         *
         * @protected
         */
        AudioModel.prototype.setVisibilityAPI = function () {
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
        /**
         * (description)
         *
         * @protected
         */
        AudioModel.prototype.handleVisibilityChange = function () {
            if (document[this._myHidden]) {
                this.mute(true);
            }
            else {
                this.mute(false);
            }
        };
        /**
         * (description)
         *
         * @public
         */
        AudioModel.prototype.pauseAllSounds = function () {
            this._pausedSounds = [];
            for (var sndName in this._sounds) {
                if (this._sounds[sndName].isPlaying()) {
                    var sound = this._sounds[sndName].pause();
                    var snd = {
                        sound: sound,
                        playhead: sound.getPlayhead()
                    };
                    this._pausedSounds.push(snd);
                }
            }
        };
        /**
         * (description)
         *
         * @public
         */
        AudioModel.prototype.resumeAllSounds = function () {
            if (this._pausedSounds && this._pausedSounds.length > 0) {
                for (var i = 0; i < this._pausedSounds.length; i++) {
                    var snd = this._pausedSounds[i];
                    //snd.sound.setPlayhead(snd.playhead);
                    snd.sound.play();
                }
            }
            this._pausedSounds = [];
        };
        return AudioModel;
    })();
    audio.AudioModel = AudioModel;
})(audio || (audio = {}));
var components;
(function (components) {
    /**
     * @class CycleResultsFactory
     *
     * @description Factory methods for cycle results
     */
    var CycleResultsFactory = (function () {
        function CycleResultsFactory() {
        }
        /**
         * Create the cycle timeline
         *
         * @param  target  the cycle results to animate
         * @param  blinkCycles  number of times to blink. 0 shows only light phase, no dark.
         * @param  cycleTime  time to wait between each blink and next result. In seconds.
         */
        CycleResultsFactory.createCycleTimeline = function (target, blinkCycles, cycleTime) {
            var cycleDelay = cycleTime;
            var timeline = new TimelineMax({ paused: true, repeat: -1 });
            // Show light right away
            timeline.add(function () { return target.display(false); });
            if (blinkCycles > 0) {
                cycleDelay = 0;
                timeline.add(CycleResultsFactory.createBlinkTimeline(target, blinkCycles, cycleTime));
            }
            // Advance to next result
            timeline.add(function () { return target.advance(); }, "+=" + cycleDelay);
            return timeline;
        };
        /**
         * Create the blink timeline
         *
         * @param  target  the cycle results to animate
         * @param  blinkCycles  number of times to blink. 0 shows only light phase, no dark.
         * @param  cycleTime  time to wait between each blink and next result. In seconds.
         */
        CycleResultsFactory.createBlinkTimeline = function (target, blinkCycles, cycleTime) {
            // Repeat light and dark blink for blinkCycles
            var timeline = new TimelineMax({ repeat: blinkCycles - 1 });
            // Show dark
            timeline.add(function () { return target.display(true); }, "+=" + cycleTime);
            // Show light
            timeline.add(function () { return target.display(false); }, "+=" + cycleTime);
            return timeline;
        };
        return CycleResultsFactory;
    })();
    components.CycleResultsFactory = CycleResultsFactory;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class Cycler<T>
     *
     * @description Class that handles cycling through payline wins. This class acts as a base class for SymbolsCycler and PaylinesCycler, see these classes for examples.
     */
    var Cycler = (function (_super) {
        __extends(Cycler, _super);
        /**
         * Create a new CycleResults object
         *
         * @param  paylineDisplay  paylines display used to show wins
         * @param  blinkCycles  number of times to blink. 0 shows only light phase, no dark.
         * @param  cycleTime  time to wait between each blink and next result. In seconds.
         */
        function Cycler(paylineDisplay, blinkCycles, cycleTime) {
            _super.call(this);
            this.cycles = -1;
            this.displayer = paylineDisplay;
            this.currentResult = 0;
            this.currentCycle = 0;
            this.isCycling = false;
            this.showScatters = true;
            this.cycleTimeline = components.CycleResultsFactory.createCycleTimeline(this, blinkCycles, cycleTime);
        }
        /**
         * @inheritdoc
         * @param  cycles @inheritdoc
         */
        Cycler.prototype.setCycleCount = function (cycles) {
            this.cycles = cycles;
        };
        /**
         * @inheritdoc
         * @param  show @inheritdoc
         */
        Cycler.prototype.setShowScatters = function (show) {
            this.showScatters = show;
        };
        /**
         * @inheritdoc
         */
        Cycler.prototype.getIsCycling = function () {
            return this.isCycling;
        };
        /**
         * @inheritdoc
         */
        Cycler.prototype.getPaylineDisplay = function () {
            return this.displayer;
        };
        /**
         * @inheritdoc
         * @param  results @inheritdoc
         */
        Cycler.prototype.start = function (results) {
            if (results.length == 0) {
                return;
            }
            this.results = results;
            this.currentResult = 0;
            this.currentCycle = 0;
            this.isCycling = true;
            this.cycleTimeline.play(0);
            //Advance isn't called until the 2nd result so we need to call it manually
            //for the first result to play symbol animations
            var event = new components.CyclerEvent(components.CyclerEvent.ON_NEXT_RESULT);
            event.result = this.results[this.currentResult];
            this.dispatchEvent(event);
        };
        /**
         * @inheritdoc
         * @param suppressEvents @inheritdoc
         */
        Cycler.prototype.stop = function (suppressEvents) {
            if (suppressEvents === void 0) { suppressEvents = false; }
            var wasCycling = this.isCycling;
            this.displayer.hide();
            this.cycleTimeline.pause();
            this.isCycling = false;
            if (wasCycling && !suppressEvents) {
                this.dispatchEvent(new components.CyclerEvent(components.CyclerEvent.ON_COMPLETE));
            }
        };
        /**
         * @inheritdoc
         * @param  dark @inheritdoc
         */
        Cycler.prototype.display = function (dark) {
            //Abstract
        };
        /**
         * @inheritdoc
         */
        Cycler.prototype.advance = function () {
            // Check if all results have been displayed
            if (++this.currentResult == this.results.length) {
                this.currentResult = 0;
                this.dispatchEvent(new components.CyclerEvent(components.CyclerEvent.ON_COMPLETE));
                //Check if the cycle count has been reached
                if ((this.cycles > 0) && (++this.currentCycle == this.cycles)) {
                    this.stop();
                }
            }
            // Callback may have called stop or cycle count may have been reached,
            // so make sure we aren't stopped before advancing
            if (!this.cycleTimeline.paused()) {
                var sr = this.results[this.currentResult];
                var event = new components.CyclerEvent(components.CyclerEvent.ON_NEXT_RESULT);
                event.result = sr;
                this.dispatchEvent(event);
            }
        };
        Cycler.prototype.getDuration = function () {
            return this.cycleTimeline.duration() * this.results.length;
        };
        return Cycler;
    })(borgevent.EventDispatcher);
    components.Cycler = Cycler;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class CyclerEvent<T>
     *
     * @description CyclerEvents are dispatched by ICycler implementations to listeners
     */
    var CyclerEvent = (function (_super) {
        __extends(CyclerEvent, _super);
        /**
         * @param type @inheritdoc
         */
        function CyclerEvent(type) {
            _super.call(this, type);
        }
        /**
         * Dispatched when all results have been cycled through
         */
        CyclerEvent.ON_COMPLETE = "CyclerEvent_ON_COMPLETE";
        /**
         * Dispatched when the next result is going to be displayed
         */
        CyclerEvent.ON_NEXT_RESULT = "CyclerEvent_ON_NEXT_RESULT";
        /**
         * Dispatched every time a result is displayed, including when it is dark, it may dispatched multiple times for a single result
         */
        CyclerEvent.ON_DISPLAY = "CyclerEvent_ON_DISPLAY";
        return CyclerEvent;
    })(borgevent.Event);
    components.CyclerEvent = CyclerEvent;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class PaylinesCycler
     *
     * @description Class that handles cycling through payline wins and displaying the payline
     *
     * @example
     * ```typescript
     *
     * protected _cycler: components.ICycler;
     *
     * //Create a new paylines cycler
     * protected createCycler() {
     *     this._cycler = new components.PaylinesCycler(paylineDisplay, 2, .3);
     *     this._cycler.addEventListener(components.CyclerEvent.ON_DISPLAY, this.onCyclerDisplay, this);
     * }
     * //Trace some info when it display each result
     * protected onCyclerDisplay(e: components.CyclerEvent<any>): void {
     *     console.log("Win Amount: " + e.result.winAmount);
     * }
     * //Start the cycler with results based on a server response
     * protected showResults(response: server.GLSLogicResponse): void {
     *     var results: server.PaylineWinData[] = response.reelSpinData[0].paylineWins;
     *     var cycleResults: components.ICycleResult[] = [];
     *
     *     for (var i: number = 0; i < results.length; i++) {
     *         console.log(results[i]);
     *         var cycleResult: components.ICycleResult =
     *             {
     *                 payline: results[i].index,
     *                 winAmount: results[i].winVal,
     *                 multiplier: 1,
     *                 scatter: false,
     *                 layout: this.getLayout(results[i].reelPositions),
     *                 symbolId: this._initData.awardsData.awards[results[i].awardIndex].id
     *             }
     *         cycleResults.push(cycleResult);
     *
     *     }
     *     this._cycler.start(cycleResults);
     * }
     * //Convert positions
     * protected getLayout(offsets: number[]): number[] {
     *     var positions: number[] = [];
     *     for (var i: number = 0; i < offsets.length; i++) {
     *         positions[offsets[i] % 5] = 1;
     *     }
     *     return positions;
     * }
     * ```
     */
    var PaylinesCycler = (function (_super) {
        __extends(PaylinesCycler, _super);
        /**
         * Create a new PaylinesCycler object
         *
         * @param  paylineDisplay  paylines display used to show wins
         * @param  blinkCycles  number of times to blink. 0 shows only light phase, no dark.
         * @param  cycleTime  time to wait between each blink and next result. In seconds.
         */
        function PaylinesCycler(paylineDisplay, blinkCycles, cycleTime) {
            _super.call(this, paylineDisplay, blinkCycles, cycleTime);
        }
        /**
         * @inheritdoc
         * @param dark @inheritdoc
         */
        PaylinesCycler.prototype.display = function (dark) {
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
                else if (sr.scatter || sr.layout[i] == -2) {
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
        };
        return PaylinesCycler;
    })(components.Cycler);
    components.PaylinesCycler = PaylinesCycler;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class SymbolsCycler
     *
     * @description Class that handles cycling through payline wins and displaying the symbol animation
     *
     * @example
     * ```typescript
     *
     * protected _cycler: components.ICycler;
     *
     * //Create a new symbols cycler
     * protected createCycler() {
     *     this._cycler = new components.SymbolsCycler(symbolDisplay, 0, 1.2, [0, 0.1, 0.2, 0.3, 0.4]);
     *     this._cycler.addEventListener(components.CyclerEvent.ON_DISPLAY, this.onCyclerDisplay, this);
     * }
     * //Trace some info when it display each result
     * protected onCyclerDisplay(e: components.CyclerEvent<any>): void {
     *     console.log("Win Amount: " + e.result.winAmount);
     * }
     * //Start the cycler with results based on a server response
     * protected showResults(response: server.GLSLogicResponse): void {
     *     var results: server.PaylineWinData[] = response.reelSpinData[0].paylineWins;
     *     var cycleResults: components.ICycleResult[] = [];
     *
     *     for (var i: number = 0; i < results.length; i++) {
     *         console.log(results[i]);
     *         var cycleResult: components.ICycleResult =
     *             {
     *                 payline: results[i].index,
     *                 winAmount: results[i].winVal,
     *                 multiplier: 1,
     *                 scatter: false,
     *                 layout: this.getLayout(results[i].reelPositions),
     *                 symbolId: this._initData.awardsData.awards[results[i].awardIndex].id
     *             }
     *         cycleResults.push(cycleResult);
     *
     *     }
     *     this._cycler.start(cycleResults);
     * }
     * //Convert positions
     * protected getLayout(offsets: number[]): number[] {
     *     var positions: number[] = [];
     *     for (var i: number = 0; i < offsets.length; i++) {
     *         positions[offsets[i] % 5] = 1;
     *     }
     *     return positions;
     * }
     * ```
     */
    var SymbolsCycler = (function (_super) {
        __extends(SymbolsCycler, _super);
        /**
         * Create a new SymbolsCycler object
         *
         * @param symbolDisplay SymbolDisplay instance that will show the results.
         * @param blinkCycles Number of times to blink. 0 shows only light phase, no dark.
         * @param cycleTime Time to wait between each blink and next result. In seconds.
         * @param delayTimes Delay between symbols showing on the SymbolDisplay.
         */
        function SymbolsCycler(symbolDisplay, blinkCycles, cycleTime, delayTimes) {
            _super.call(this, symbolDisplay, blinkCycles, cycleTime);
            this._delays = delayTimes;
        }
        /**
         * @inheritdoc
         * @param dark @inheritdoc
         */
        SymbolsCycler.prototype.display = function (dark) {
            var sr = this.results[this.currentResult];
            var parts = new Array();
            var targets;
            if (sr.scatter) {
                targets = [0, 0, 0, 0, 0];
            }
            for (var i = 0; i < sr.layout.length; ++i) {
                var symbolId = sr.symbolId;
                if (sr.symbolIds) {
                    symbolId = sr.symbolIds[i];
                }
                if (sr.layout[i] >= 0) {
                    parts.push(new components.Symbol(components.SymbolPart.Show, symbolId, this._delays[i]));
                    if (sr.scatter) {
                        targets[i] = sr.layout[i];
                    }
                }
                else if (sr.scatter) {
                    parts.push(new components.Symbol(components.SymbolPart.Hide, symbolId));
                }
                else {
                    parts.push(new components.Symbol(components.SymbolPart.Hide, symbolId));
                }
            }
            var event = new components.CyclerEvent(components.CyclerEvent.ON_DISPLAY);
            event.result = sr;
            event.parts = parts;
            event.dark = dark;
            this.dispatchEvent(event);
            if (sr.scatter && this.showScatters) {
                this.displayer.showCustom(sr.payline, parts, targets, dark, false);
            }
            else {
                this.displayer.show(sr.payline, parts, dark);
            }
        };
        return SymbolsCycler;
    })(components.Cycler);
    components.SymbolsCycler = SymbolsCycler;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * A button to open and close a set of DemoTools
     *
     * @export
     * @class DemoButton
     * @extends {rendering.DisplayObjectContainer}
     */
    var DemoButton = (function (_super) {
        __extends(DemoButton, _super);
        /**
         * Creates an instance of DemoButton.
         */
        function DemoButton() {
            _super.call(this);
            this.drawBtn();
        }
        /**
         * Renders the button and adds as a child
         *
         * @protected
         */
        DemoButton.prototype.drawBtn = function () {
            var g = new rendering.Graphics();
            g.lineStyle(4, 0x000000, 1);
            g.beginFill(0x00dd00, 1);
            g.drawRect(0, 0, 200, 75);
            g.endFill();
            g.interactive = false;
            this._txt = new rendering.Text("DEMO");
            this._txt.width = 200;
            this._txt.fontSize = 50;
            this._txt.colour = "#eeeeee";
            this._txt.font = "Myriad Pro Black";
            this._txt.y = (g.height - this._txt.height) / 2;
            this._txt.x = (g.width - this._txt.width) / 2;
            this._txt.interactive = false;
            this.addChild(g);
            this.addChild(this._txt);
            this.addEventListener(rendering.InputEvent.UP, this.onGraphicsClick, this);
        };
        /**
         * Handles click events on this button
         *
         * @protected
         */
        DemoButton.prototype.onGraphicsClick = function (e) {
            this._isOpen = !this._isOpen;
            this._txt.text = this._isOpen ? "CLOSE" : "DEMO";
            for (var i = 0; i < this._tools.length; i++) {
                this._tools[i].visible = this._isOpen;
                if (this._isOpen) {
                    this._tools[i].onOpened();
                }
                else {
                    this._tools[i].onClosed();
                }
            }
            this.dispatchEvent(new components.DemoButtonEvent(this._isOpen ? components.DemoButtonEvent.DEMO_OPENED : components.DemoButtonEvent.DEMO_CLOSED));
        };
        /**
         * Sets the DemoTools to be controlled by this buton
         *
         * @param {IDemoTool[]} tools The Array of DemoTools to be controlled by this button
         */
        DemoButton.prototype.setTools = function (tools) {
            this._tools = tools;
        };
        return DemoButton;
    })(rendering.DisplayObjectContainer);
    components.DemoButton = DemoButton;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * Events dispatched by a DemoButton
     *
     * @export
     * @class DemoButtonEvent
     * @extends {borgevent.Event}
     */
    var DemoButtonEvent = (function (_super) {
        __extends(DemoButtonEvent, _super);
        /**
         * Creates an instance of DemoButtonEvent.
         *
         * @param {string} type The event type
         */
        function DemoButtonEvent(type) {
            _super.call(this, type);
        }
        /**
         * Event indicating the DemoButton has been opened
         *
         * @static
         * @type {string}
         */
        DemoButtonEvent.DEMO_OPENED = "DemoButtonEvent_DEMO_OPENED";
        /**
         * Event indicating the DemoButton has been closed
         *
         * @static
         * @type {string}
         */
        DemoButtonEvent.DEMO_CLOSED = "DemoButtonEvent_DEMO_CLOSED";
        return DemoButtonEvent;
    })(borgevent.Event);
    components.DemoButtonEvent = DemoButtonEvent;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * A Class to encapsulate the data for an item in the DemoTool
     *
     * @export
     * @class DemoData
     */
    var DemoData = (function () {
        /**
         * Creates an instance of DemoData.
         *
         * @param {string} name The label associated with this data item
         * @param {number[]} positions The reel stop positions associated with this demo item
         * @param {number} index The reelset index associated witht this demo item
         */
        function DemoData(name, positions, index) {
            this.name = name;
            this.positions = positions;
            this.index = index;
        }
        return DemoData;
    })();
    components.DemoData = DemoData;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * A class to display a set of DemoData
     *
     * @export
     * @class DemoTool
     * @extends {rendering.DisplayObjectContainer}
     * @implements {IDemoTool}
     */
    var DemoTool = (function (_super) {
        __extends(DemoTool, _super);
        /**
         * Creates an instance of DemoTool.
         *
         * @param {number} [x=0] The x position of the DemoTool
         * @param {number} [y=0] The y position of the DemoTool
         * @param {number} [maxWidth=1920] The maximum width used to layout the DemoTool
         * @param {number} [maxHeight=1080] The maximum height used to layout the DemoTool
         */
        function DemoTool(x, y, maxWidth, maxHeight, _buttonWidth) {
            if (x === void 0) { x = 0; }
            if (y === void 0) { y = 0; }
            if (maxWidth === void 0) { maxWidth = 1920; }
            if (maxHeight === void 0) { maxHeight = 1080; }
            if (_buttonWidth === void 0) { _buttonWidth = 200; }
            _super.call(this);
            this.x = x;
            this.y = y;
            this.maxWidth = maxWidth;
            this.maxHeight = maxHeight;
            this.buttonWidth = _buttonWidth;
            this.dataItems = [];
            this.currentDataItem = null;
            this.drawBackground();
            this.buttonContainer = new rendering.DisplayObjectContainer();
            this.addChild(this.buttonContainer);
        }
        /**
         * This should be called when the DemoTool is opened
         */
        DemoTool.prototype.onOpened = function () {
            this.currentDataItem = null;
            this.drawDataItems();
        };
        /**
         * This should be called when the DemoTool is closed
         */
        DemoTool.prototype.onClosed = function () {
            this.dispatchEvent(new components.DemoToolEvent(components.DemoToolEvent.SET_DATA, this.currentDataItem));
        };
        /**
         * Add a single DemoData
         *
         * @param {DemoData} item The item to be added
         * @returns {DemoData} The item that was added
         */
        DemoTool.prototype.addDataItem = function (item) {
            this.dataItems.push(item);
            this.drawDataItems();
            return item;
        };
        /**
         * Add a single DemoData at a specified position
         *
         * @param {DemoData} item The Item to be added
         * @param {number} index The index at which the item should be added
         * @returns {DemoData} The item that was added
         */
        DemoTool.prototype.addDataItemAt = function (item, index) {
            this.dataItems.splice(index, 0, item);
            this.drawDataItems();
            return item;
        };
        /**
         * Add an array for DemoData
         *
         * @param {DemoData[]} items The items that were added
         */
        DemoTool.prototype.addDataItems = function (items) {
            this.dataItems = this.dataItems.concat(items);
            this.drawDataItems();
        };
        /**
         * Remove a single DemoData
         *
         * @param {DemoData} item The DemoData to be removed
         * @returns {DemoData} Returns null if the DemoData does not exist, otherwise returns the removed DemoData
         */
        DemoTool.prototype.removeDataItem = function (item) {
            var index = this.dataItems.indexOf(item);
            var item = null;
            if (index > -1) {
                item = this.removeDataItemAt(index);
            }
            return item;
        };
        /**
         * Remove a single Demo by index
         *
         * @param {number} index The index of the DemoData to remove
         * @returns {DemoData} The removed DemoData
         */
        DemoTool.prototype.removeDataItemAt = function (index) {
            var item = this.dataItems.splice(index, 1)[0];
            this.drawDataItems();
            return item;
        };
        /**
         * Draws a faded background
         *
         * @protected
         */
        DemoTool.prototype.drawBackground = function () {
            var g = new rendering.Graphics();
            g.beginFill(0x000000, 0.9);
            g.lineStyle(4, 0x00dd00, 1);
            g.drawRect(0, 0, this.maxWidth, this.maxHeight);
            g.endFill();
            this.addChild(g);
        };
        /**
         * Draws all the DemoData as buttons
         *
         * @protected
         */
        DemoTool.prototype.drawDataItems = function () {
            this.removeAllChildren();
            var xPos = 10;
            var yPos = 10;
            for (var i = 0; i < this.dataItems.length; i++) {
                this.drawDataItem(this.dataItems[i], xPos, yPos);
                yPos += 95;
                if (yPos + 95 > this.maxHeight) {
                    yPos = 10;
                    xPos += (this.buttonWidth + (this.buttonWidth / 10));
                }
            }
        };
        /**
         * Draws a single DemoData as a button
         *
         * @protected
         * @param {DemoData} item The DemoData to draw
         * @param {number} xOffset The x position to draw the DemoData
         * @param {number} yOffset The y position to draw the DemoData
         */
        DemoTool.prototype.drawDataItem = function (item, xOffset, yOffset) {
            var g = new rendering.Graphics();
            g.x = xOffset;
            g.y = yOffset;
            if (this.currentDataItem == item) {
                g.lineStyle(4, 0xdd0000, 1);
            }
            else {
                g.lineStyle(4, 0x000000, 1);
            }
            g.beginFill(0x0000dd, 1);
            g.drawRect(0, 0, this.buttonWidth, 75);
            g.endFill();
            var txt = new rendering.Text(item.name);
            txt.maxWidth = this.buttonWidth;
            txt.fontSize = 50;
            txt.scaleToWidth = this.buttonWidth - (this.buttonWidth / 10);
            txt.colour = "#eeeeee";
            txt.font = "Myriad Pro Black";
            txt.y = yOffset + (g.height - txt.height) / 2;
            txt.x = xOffset + (g.width - txt.width) / 2;
            txt.interactive = false;
            this.buttonContainer.addChild(g);
            this.buttonGraphics.push(g);
            this.buttonContainer.addChild(txt);
            g.addEventListener(rendering.InputEvent.UP, this.onGraphicsClick, this);
        };
        /**
         * Removes all DisplayObjects used to represent the DemoData set
         *
         * @protected
         */
        DemoTool.prototype.removeAllChildren = function () {
            while (this.buttonContainer.children.length > 0) {
                this.buttonContainer.removeChild(this.buttonContainer.children[0]);
            }
            this.buttonGraphics = [];
        };
        /**
         * Handles the click events for all DemoData buttons
         *
         * @protected
         * @param {rendering.InputEvent} e (description)
         */
        DemoTool.prototype.onGraphicsClick = function (e) {
            var dataIndex = this.buttonGraphics.indexOf(e.displayObject);
            if (dataIndex >= 0) {
                var dataItem = this.dataItems[dataIndex];
                this.currentDataItem = dataItem;
                this.drawDataItems();
            }
        };
        return DemoTool;
    })(rendering.DisplayObjectContainer);
    components.DemoTool = DemoTool;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * Events dispatched by the DemoTool
     *
     * @export
     * @class DemoToolEvent
     * @extends {borgevent.Event}
     * @template T
     */
    var DemoToolEvent = (function (_super) {
        __extends(DemoToolEvent, _super);
        /**
         * Creates an instance of DemoToolEvent.
         *
         * @param {string} type The Event type
         * @param {T} data The data assocaied with the event
         */
        function DemoToolEvent(type, data) {
            _super.call(this, type);
            this.data = data;
        }
        /**
         * Event indicating that DemoData has been set
         *
         * @static
         * @type {string}
         */
        DemoToolEvent.SET_DATA = "DemoToolEvent_SET_DATA";
        return DemoToolEvent;
    })(borgevent.Event);
    components.DemoToolEvent = DemoToolEvent;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class ResponsiveDiv
     *
     * @description Creates a div element to contain the games content and automatically handles scaling to the browsers window
     *
     * @example
     * ```typescript
     *
     * //Create the responsive div inside the game-container element
     * var responsiveDiv = new components.ResponsiveDiv(<HTMLDivElement>document.getElementById("game-container"));
     *
     * //Create the stage using the responsive div's canvas div
     * var stage: rendering.Stage = new rendering.Stage(responsiveDiv.getCanvasDiv(),
     *     stageWidth, stageHeight, [rendering.StageRenderStyle.CANVAS]);
     *
     * //Pass the actual canvas element to the responsive div
     * responsiveDiv.setCanvas(stage.canvas);
     *
     * //Enable responsive scaling
     * responsiveDiv.enableResponsiveScaling();
     * ```
     */
    var ResponsiveDiv = (function (_super) {
        __extends(ResponsiveDiv, _super);
        /**
         * Create Canvas object
         *
         * @param  parentDiv  the parent div object the canvas is on
         */
        function ResponsiveDiv(parentDiv) {
            _super.call(this);
            this.responsive = false;
            this.fitWindow = false;
            this.parentDiv = parentDiv;
            if (parentDiv != undefined && parentDiv != null) {
                this.canvasDiv = document.createElement('div');
                this.canvasDiv.className = 'game-canvas-div';
                this.canvasDiv.id = 'game-canvas-div';
                this.canvasDiv.style.position = 'absolute';
                this.canvasDiv.style.overflow = 'hidden';
                this.canvasDiv.style.width = '100%';
                this.canvasDiv.style.height = '100%';
            }
            if (parentDiv != undefined && parentDiv != null) {
                parentDiv.appendChild(this.canvasDiv);
            }
            this.responsivePaddingX = 1;
            this.responsivePaddingY = 1;
            this.responsiveScaleX = 1;
            this.responsiveScaleY = 1;
            this.checkResponsiveTime = 0;
            this.checkResponsiveTimeout = 0.5;
            this.currentWindowWidth = 0;
            this.currentWindowHeight = 0;
            this.currentWindowArea = 0;
        }
        /**
         * Get's the div that the canvas element should be added to
         */
        ResponsiveDiv.prototype.getCanvasDiv = function () {
            return this.canvasDiv;
        };
        /**
         * Set the stage to listen for resizing
         */
        ResponsiveDiv.prototype.setStage = function (stage) {
            if (this.stage) {
                this.stage.removeEventListener(rendering.StageEvent.STAGE_RESIZED, this.onStageResize, this);
            }
            this.stage = stage;
            this.stage.addEventListener(rendering.StageEvent.STAGE_RESIZED, this.onStageResize, this);
        };
        /**
         * Set the games canvas so it can be styled
         */
        ResponsiveDiv.prototype.setCanvas = function (canvas) {
            this.canvas = canvas;
            this.canvas.id = "game-canvas-area";
            this.canvas.className = 'game-canvas';
            this.canvas.style.position = 'absolute';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
        };
        /**
         * Get the associated canvas
         */
        ResponsiveDiv.prototype.getCanvas = function () {
            return this.canvas;
        };
        /**
         * Get the scaling factor used for respsonsive
         */
        ResponsiveDiv.prototype.getWidth = function () {
            return this.canvas.width;
        };
        /**
         * Get the scaling factor used for respsonsive
         */
        ResponsiveDiv.prototype.getHeight = function () {
            return this.canvas.height;
        };
        /**
         * Get the scaling factor used for respsonsive
         */
        ResponsiveDiv.prototype.getResponsiveScaleX = function () {
            return this.responsiveScaleX;
        };
        /**
         * Get the scaling factor used for respsonsive
         */
        ResponsiveDiv.prototype.getResponsiveScaleY = function () {
            return this.responsiveScaleY;
        };
        /**
         * Setup the canvas to be responsize
         */
        ResponsiveDiv.prototype.enableResponsiveScaling = function () {
            var _this = this;
            this.handleResponsive();
            TweenLite.ticker.addEventListener('tick', function (e) { return _this.handleTick(e); }, this, true, 1);
            this.currentWindowWidth = this.parentDiv.clientWidth;
            ;
            this.currentWindowHeight = this.parentDiv.clientHeight;
            this.currentWindowArea = this.parentDiv.clientWidth * this.parentDiv.clientHeight;
        };
        /**
         * Set the flag to override the responsive scaling of the Canvas and have the canvas will the
         * window that it is in.
         */
        ResponsiveDiv.prototype.fitToWindow = function () {
            var _this = this;
            this.fitWindow = true;
            TweenLite.ticker.addEventListener('tick', function (e) { return _this.handleTick(e); }, this, true, 1);
            this.handleResponsive();
        };
        /**
         * Set the dimensions of the canvas in percentage
         *
         * @param  paddingX  normalized padding percentage on the X
         * @param  paddingY  normalized padding percentage on the Y
         */
        ResponsiveDiv.prototype.setResponsivePadding = function (paddingX, paddingY) {
            this.responsivePaddingX = paddingX;
            this.responsivePaddingY = paddingY;
            this.handleResponsive();
        };
        /**
         * Set the z index of the canvas in the DOM
         *
         * @param  z  the z index in the DOM
         */
        ResponsiveDiv.prototype.setZOrder = function (z) {
            if (this.canvasDiv != undefined) {
                this.canvasDiv.style.zIndex = String(z);
            }
            else {
                this.canvas.style.zIndex = String(z);
            }
        };
        /**
         * Set the dimensions of the canvas
         *
         * @param  width  the width in pixels of the canvas
         * @param  height  the height in pixels of the canvas
         */
        ResponsiveDiv.prototype.setSize = function (width, height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
        };
        /**
         * Set the dimensions of the canvas in percentage
         *
         * @param  width  the width in pixels of the canvas
         * @param  height  the height in pixels of the canvas
         */
        ResponsiveDiv.prototype.setSizePercent = function (width, height) {
            if (this.canvasDiv != undefined) {
                this.canvasDiv.style.width = width + '%';
                this.canvasDiv.style.height = height + '%';
            }
            else {
                this.canvas.width = width;
                this.canvas.height = height;
                this.canvas.style.width = width + '%';
                this.canvas.style.height = height + '%';
            }
        };
        /**
         * Set the position on screen of the canvas. All positions are based on the style of the
         * canvas.
         *
         * @param  x  the x position on screen
         * @param  y  the y position on screen
         */
        ResponsiveDiv.prototype.setPosition = function (x, y) {
            this.canvas.style.left = x + 'px';
            this.canvas.style.top = y + 'px';
        };
        /**
         * Set the position in percentage on screen of the canvas.
         * All positions are based on the style of the canvas.
         *
         * @param  x  the x position on screen
         * @param  y  the y position on screen
         */
        ResponsiveDiv.prototype.setPositionPercent = function (x, y) {
            if (this.canvasDiv != undefined) {
                this.canvasDiv.style.left = x + '%';
                this.canvasDiv.style.top = y + '%';
            }
            else {
                this.canvas.style.left = x + '%';
                this.canvas.style.top = y + '%';
            }
        };
        /**
         * Handles resizing when the stage does
         *
         * @param  event  StageEvent
         */
        ResponsiveDiv.prototype.onStageResize = function (event) {
            this.setSize(event.width, event.height);
            this.setCanvas(event.stage.canvas);
            this.enableResponsiveScaling();
        };
        /**
         *Checks the current orientation
         */
        ResponsiveDiv.prototype.readDeviceOrientation = function () {
            var orientation = this.currentWindowWidth > this.currentWindowHeight ? "landscape" : "portrait";
            if (orientation != this.orientation) {
                var event = new components.ResponsiveDivEvent(components.ResponsiveDivEvent.ON_ROTATION_CHANGE);
                event.orientation = orientation;
                this.dispatchEvent(event);
            }
            this.orientation = orientation;
            return orientation;
        };
        /**
         * Handles the tick event from GSAP
         *
         * @param  tickerEvent  contains time info
         */
        ResponsiveDiv.prototype.handleTick = function (tickerEvent) {
            this.checkResponsiveTime += tickerEvent.target.time;
            if (this.checkResponsiveTime >= this.checkResponsiveTimeout) {
                this.checkResponsiveTime = 0;
                this.checkWindowSize();
                this.readDeviceOrientation();
            }
        };
        /**
         * Check to see window size has changed so we can respond
         */
        ResponsiveDiv.prototype.checkWindowSize = function () {
            var windowWidth = this.parentDiv.clientWidth;
            var windowHeight = this.parentDiv.clientHeight;
            var windowArea = this.parentDiv.clientWidth * this.parentDiv.clientHeight;
            if (windowWidth != this.currentWindowWidth ||
                windowHeight != this.currentWindowHeight ||
                windowArea != this.currentWindowArea) {
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
        ResponsiveDiv.prototype.handleResponsive = function () {
            var widthToHeight = (this.canvas.width / this.canvas.height);
            var newWidth = this.parentDiv.offsetWidth * this.responsivePaddingX;
            var newHeight = this.parentDiv.offsetHeight * this.responsivePaddingY;
            var newWidthToHeight = newWidth / newHeight;
            if (newWidthToHeight > widthToHeight) {
                newWidth = newHeight * widthToHeight;
            }
            else {
                newHeight = newWidth / widthToHeight;
            }
            if (this.fitWindow) {
                newWidth = this.parentDiv.offsetWidth;
                newHeight = this.parentDiv.offsetHeight;
            }
            if (this.canvasDiv != undefined) {
                this.canvasDiv.style.width = newWidth + 'px';
                this.canvasDiv.style.height = newHeight + 'px';
                // Make the canvas element be in the middle of the parent element
                this.canvasDiv.style.top = '50%';
                this.canvasDiv.style.marginTop = '-' + (newHeight / 2) + 'px';
                this.canvasDiv.style.left = '50%';
                this.canvasDiv.style.marginLeft = '-' + (newWidth / 2) + 'px';
            }
            else {
                this.canvas.style.width = newWidth + 'px';
                this.canvas.style.height = newHeight + 'px';
                // Make the canvas element be in the middle of the parent element
                this.canvas.style.top = '50%';
                this.canvas.style.marginTop = '-' + (newHeight / 2) + 'px';
                this.canvas.style.left = '50%';
                this.canvas.style.marginLeft = '-' + (newWidth / 2) + 'px';
            }
            this.responsiveScaleX = this.canvas.width / newWidth;
            this.responsiveScaleY = this.canvas.height / newHeight;
            this.canvas.setAttribute('responsiveWidth', newWidth.toString());
            this.canvas.setAttribute('responsiveHeight', newHeight.toString());
            this.canvas.setAttribute('responsiveScaleX', this.responsiveScaleX.toString());
            this.canvas.setAttribute('responsiveScaleY', this.responsiveScaleY.toString());
        };
        return ResponsiveDiv;
    })(borgevent.EventDispatcher);
    components.ResponsiveDiv = ResponsiveDiv;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class ResponsiveDivEvent
     *
     * @description ResponsiveDivEvent's are dispatched by ResponsiveDiv's to listeners
     */
    var ResponsiveDivEvent = (function (_super) {
        __extends(ResponsiveDivEvent, _super);
        /**
         * @param type @inheritdoc
         */
        function ResponsiveDivEvent(type) {
            _super.call(this, type);
        }
        /**
         * Dispatched when device rotates
         */
        ResponsiveDivEvent.ON_ROTATION_CHANGE = "ResponsiveDivEvent_ON_ROTATION_CHANGE";
        return ResponsiveDivEvent;
    })(borgevent.Event);
    components.ResponsiveDivEvent = ResponsiveDivEvent;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class DomImage
     *
     * @description Creates a DOM Image on the specified HTML element
     */
    var DomImage = (function () {
        /**
         * Creates an instance of DomImage.
         *
         * @param {HTMLDivElement} parentDiv
         * @param {assets.IAsset} asset
         */
        function DomImage(parentDiv, asset) {
            this._element = document.createElement("img");
            this._element.setAttribute("src", asset.path);
            parentDiv.appendChild(this._element);
        }
        Object.defineProperty(DomImage.prototype, "width", {
            /**
             * Sets the width of the image
             */
            set: function (value) {
                this._element.setAttribute("width", value.toString());
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DomImage.prototype, "height", {
            /**
             * Sets the height of the image
             */
            set: function (value) {
                this._element.setAttribute("height", value.toString());
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Fills the image to the parent's size
         */
        DomImage.prototype.fillToDiv = function () {
            this._element.style.height = "100%";
            this._element.style.width = "100%";
        };
        return DomImage;
    })();
    components.DomImage = DomImage;
})(components || (components = {}));
var components;
(function (components) {
    var ForceButton = (function (_super) {
        __extends(ForceButton, _super);
        function ForceButton() {
            _super.call(this);
            this.drawBtn();
        }
        ForceButton.prototype.drawBtn = function () {
            var g = new rendering.Graphics();
            g.lineStyle(4, 0x000000, 1);
            g.beginFill(0xdd0000, 1);
            g.drawRect(0, 0, 200, 75);
            g.endFill();
            g.interactive = false;
            this._txt = new rendering.Text("FORCE");
            this._txt.width = 200;
            this._txt.fontSize = 50;
            this._txt.colour = "#eeeeee";
            this._txt.font = "Myriad Pro Black";
            this._txt.y = (g.height - this._txt.height) / 2;
            this._txt.x = (g.width - this._txt.width) / 2;
            this._txt.interactive = false;
            this.addChild(g);
            this.addChild(this._txt);
            this.addEventListener(rendering.InputEvent.UP, this.onGraphicsClick, this);
        };
        ForceButton.prototype.onGraphicsClick = function (e) {
            this._isOpen = !this._isOpen;
            this._txt.text = this._isOpen ? "CLOSE" : "FORCE";
            for (var i = 0; i < this._tools.length; i++) {
                this._tools[i].visible = this._isOpen;
                if (this._isOpen) {
                    this._tools[i].onOpened();
                }
                else {
                    this._tools[i].onClosed();
                }
            }
            this.dispatchEvent(new components.ForceButtonEvent(this._isOpen ? components.ForceButtonEvent.FORCE_OPENED : components.ForceButtonEvent.FORCE_CLOSED));
        };
        ForceButton.prototype.setTools = function (tools) {
            this._tools = tools;
        };
        return ForceButton;
    })(rendering.DisplayObjectContainer);
    components.ForceButton = ForceButton;
})(components || (components = {}));
var components;
(function (components) {
    var ForceButtonEvent = (function (_super) {
        __extends(ForceButtonEvent, _super);
        function ForceButtonEvent(type) {
            _super.call(this, type);
        }
        ForceButtonEvent.FORCE_OPENED = "ForceButtonEvent_FORCE_OPENED";
        ForceButtonEvent.FORCE_CLOSED = "ForceButtonEvent_FORCE_CLOSED";
        return ForceButtonEvent;
    })(borgevent.Event);
    components.ForceButtonEvent = ForceButtonEvent;
})(components || (components = {}));
var components;
(function (components) {
    var ForceToolEvent = (function (_super) {
        __extends(ForceToolEvent, _super);
        function ForceToolEvent(type, data) {
            _super.call(this, type);
            this.data = data;
        }
        ForceToolEvent.SET_DATA = "ForceToolEvent_SET_DATA";
        return ForceToolEvent;
    })(borgevent.Event);
    components.ForceToolEvent = ForceToolEvent;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * A button to pause/resume the game
     *
     * @export
     * @class PauseButton
     * @extends {rendering.DisplayObjectContainer}
     */
    var PauseButton = (function (_super) {
        __extends(PauseButton, _super);
        /**
         * Creates an instance of PauseButton.
         */
        function PauseButton() {
            _super.call(this);
            this.drawBtn();
        }
        /**
         * Renders the button and adds as a child
         *
         * @protected
         */
        PauseButton.prototype.drawBtn = function () {
            var g = new rendering.Graphics();
            g.lineStyle(4, 0x000000, 1);
            g.beginFill(0x0000dd, 1);
            g.drawRect(0, 0, 200, 75);
            g.endFill();
            g.interactive = false;
            this._graphic = g;
            this._txt = new rendering.Text("PAUSE");
            this._txt.width = 200;
            this._txt.fontSize = 45;
            this._txt.colour = "#eeeeee";
            this._txt.font = "Myriad Pro Black";
            this._txt.y = (g.height - this._txt.height) / 2;
            this._txt.x = (g.width - this._txt.width) / 2;
            this._txt.interactive = false;
            this.addChild(g);
            this.addChild(this._txt);
            this.addEventListener(rendering.InputEvent.UP, this.onGraphicsClick, this);
        };
        /**
         * Handles click events on this button
         *
         * @protected
         */
        PauseButton.prototype.onGraphicsClick = function (e) {
            var _this = this;
            this._isOpen = !this._isOpen;
            this._txt.text = this._isOpen ? "RESUME" : "PAUSE";
            this._txt.x = (this._graphic.width - this._txt.width) / 2;
            TweenMax.delayedCall(0.01, function () {
                if (_this._isOpen) {
                    util.PauseManager.pause();
                }
                else {
                    util.PauseManager.resume();
                }
            }, [], this);
        };
        return PauseButton;
    })(rendering.DisplayObjectContainer);
    components.PauseButton = PauseButton;
})(components || (components = {}));
var components;
(function (components) {
    var ReelsForceData = (function () {
        function ReelsForceData() {
        }
        return ReelsForceData;
    })();
    components.ReelsForceData = ReelsForceData;
})(components || (components = {}));
var components;
(function (components) {
    var ReelsForceTool = (function (_super) {
        __extends(ReelsForceTool, _super);
        function ReelsForceTool() {
            _super.apply(this, arguments);
            this.isOpen = false;
        }
        ReelsForceTool.prototype.setReels = function (reels, reelSets, startIndex, endIndex, topOffset, bottomOffset, singleReelSet) {
            if (topOffset === void 0) { topOffset = 0; }
            this._reels = reels;
            this._reelSets = reelSets;
            this._startIndex = startIndex;
            this._endIndex = endIndex;
            this._currentIndex = startIndex;
            if (bottomOffset == undefined) {
                bottomOffset = topOffset;
            }
            this._incBtns = [];
            this._decBtns = [];
            this._reelPosTxt = [];
            this._singleReelSet = singleReelSet ? singleReelSet : false;
            if (!this._singleReelSet) {
                this.drawReelSetControl();
            }
            this.drawReelControls(topOffset, bottomOffset);
        };
        ReelsForceTool.prototype.onOpened = function () {
            this.changeReelSet(this._currentIndex);
            this.isOpen = true;
        };
        ReelsForceTool.prototype.onClosed = function () {
            var data = new components.ReelsForceData();
            data.positions = [];
            data.index = this._currentIndex;
            for (var i = 0; i < this._reels.getReelCount(); i++) {
                data.positions.push(this._reels.getController(i).getLayout().getCurrentStripIndex());
            }
            this.dispatchEvent(new components.ForceToolEvent(components.ForceToolEvent.SET_DATA, data));
            this.isOpen = false;
        };
        ReelsForceTool.prototype.drawReelControls = function (topOffset, bottomOffset) {
            for (var i = 0; i < this._reels.getReelCount(); i++) {
                var symW = this._reels.getController(i).getLayout().getSymbolWidth();
                var bg = new rendering.Graphics();
                bg.lineStyle(3, 0x000000, 1);
                bg.beginFill(0x444444, 1);
                bg.drawRect(0, 0, 100, 50);
                bg.endFill();
                bg.x = (symW - bg.width) / 2 + this._reels.x + this._reels.getController(i).getLayout().x + this._reels.getController(i).getLayout().getAnchor().x;
                bg.y = -bg.height + this._reels.y + this._reels.getController(i).getLayout().y - topOffset;
                this.addChild(bg);
                var text = new rendering.Text(this._currentIndex.toString());
                text.width = 50;
                text.fontSize = 40;
                text.colour = "#ffffff";
                text.font = "Myriad Pro Black";
                text.x = bg.x + (bg.width - text.width) / 2;
                text.y = bg.y;
                text.textAlign = rendering.TextAlign.CENTER;
                this._reelPosTxt[i] = text;
                this.addChild(text);
                var g = new rendering.Graphics();
                g.lineStyle(3, 0x000000, 1);
                g.beginFill(0x00ff00, 1);
                g.drawRect(0, 0, 100, 50);
                g.endFill();
                g.lineStyle(10, 0x000000, 1);
                g.moveTo(50, 10 - 2);
                g.lineTo(50, 40 + 2);
                g.moveTo(35 - 2, 25);
                g.lineTo(65 + 2, 25);
                g.lineStyle(6, 0xffffff, 1);
                g.moveTo(50, 10);
                g.lineTo(50, 40);
                g.moveTo(35, 25);
                g.lineTo(65, 25);
                g.x = bg.x;
                g.y = bg.y + bg.height;
                this.addChild(g);
                this._incBtns.push(g);
                g.addEventListener(rendering.InputEvent.DOWN, this.onIncDown, this);
                g.addEventListener(rendering.InputEvent.UP, this.onIncUp, this);
                g.addEventListener(rendering.InputEvent.OUT, this.onIncUp, this);
                var g = new rendering.Graphics();
                g.lineStyle(3, 0x000000, 1);
                g.beginFill(0xff0000, 1);
                g.drawRect(0, 0, 100, 50);
                g.endFill();
                g.lineStyle(10, 0x000000, 1);
                g.moveTo(35 - 2, 25);
                g.lineTo(65 + 2, 25);
                g.lineStyle(6, 0xffffff, 1);
                g.moveTo(35, 25);
                g.lineTo(65, 25);
                var symW = this._reels.getController(i).getLayout().getSymbolWidth();
                g.x = (symW - g.width) / 2 + this._reels.x + this._reels.getController(i).getLayout().x + this._reels.getController(i).getLayout().getAnchor().x;
                g.y = this._reels.y + this._reels.getController(i).getLayout().y + (this._reels.getController(i).getLayout().getWindowSize() - 2) * this._reels.getController(i).getLayout().getSymbolHeight() + bottomOffset;
                this.addChild(g);
                this._decBtns.push(g);
                g.addEventListener(rendering.InputEvent.DOWN, this.onDecDown, this);
                g.addEventListener(rendering.InputEvent.UP, this.onDecUp, this);
                g.addEventListener(rendering.InputEvent.OUT, this.onDecUp, this);
            }
        };
        ReelsForceTool.prototype.drawReelSetControl = function () {
            var halfReelWidth = this._reels.getController(0).getLayout().getSymbolWidth() * this._reels.getReelCount() / 2;
            var halfReelHeight = (this._reels.getController(0).getLayout().getWindowSize() - 2) * this._reels.getController(0).getLayout().getSymbolHeight() / 2;
            var bg = new rendering.Graphics();
            bg.lineStyle(3, 0x000000, 1);
            bg.beginFill(0x444444, 1);
            bg.drawRect(0, 0, 100, 50);
            bg.endFill();
            bg.x = this._reels.x + halfReelWidth + this._reels.getController(0).getLayout().x - bg.width / 2;
            bg.y = this._reels.y + halfReelHeight + this._reels.getController(0).getLayout().y - bg.height / 2;
            this.addChild(bg);
            this._txt = new rendering.Text(this._currentIndex.toString());
            this._txt.width = 50;
            this._txt.fontSize = 40;
            this._txt.colour = "#ffffff";
            this._txt.font = "Myriad Pro Black";
            this._txt.x = this._reels.x + halfReelWidth + this._reels.getController(0).getLayout().x - this._txt.width / 2;
            this._txt.y = this._reels.y + halfReelHeight + this._reels.getController(0).getLayout().y - this._txt.height / 2;
            this.addChild(this._txt);
            var g = new rendering.Graphics();
            g.lineStyle(3, 0x000000, 1);
            g.beginFill(0x00ff00, 1);
            g.drawRect(0, 0, 50, 50);
            g.endFill();
            g.lineStyle(10, 0x000000, 1);
            g.moveTo(25, 10 - 2);
            g.lineTo(25, 40 + 2);
            g.moveTo(10 - 2, 25);
            g.lineTo(40 + 2, 25);
            g.lineStyle(6, 0xffffff, 1);
            g.moveTo(25, 10);
            g.lineTo(25, 40);
            g.moveTo(10, 25);
            g.lineTo(40, 25);
            g.x = this._reels.x + halfReelWidth + this._reels.getController(0).getLayout().x - g.width / 2;
            g.y = this._reels.y + halfReelHeight + this._reels.getController(0).getLayout().y - g.height / 2 - bg.height - 5;
            this.addChild(g);
            g.addEventListener(rendering.InputEvent.DOWN, this.onIncReelSetDown, this);
            var g = new rendering.Graphics();
            g.lineStyle(3, 0x000000, 1);
            g.beginFill(0xff0000, 1);
            g.drawRect(0, 0, 50, 50);
            g.endFill();
            g.lineStyle(10, 0x000000, 1);
            g.moveTo(10 - 2, 25);
            g.lineTo(40 + 2, 25);
            g.lineStyle(6, 0xffffff, 1);
            g.moveTo(10, 25);
            g.lineTo(40, 25);
            g.x = this._reels.x + halfReelWidth + this._reels.getController(0).getLayout().x - g.width / 2;
            g.y = this._reels.y + halfReelHeight + this._reels.getController(0).getLayout().y - g.height / 2 + bg.height + 5;
            this.addChild(g);
            g.addEventListener(rendering.InputEvent.DOWN, this.onDecReelSetDown, this);
        };
        ReelsForceTool.prototype.onIncDown = function (e) {
            var _this = this;
            if (this._tween) {
                this._tween.pause();
                this._tween.kill();
            }
            this._tween = TweenMax.to(this, 0.1, {
                repeat: -1,
                onStart: function () {
                    _this._repeatCount = 0;
                    _this.setPosition(_this._incBtns.indexOf(e.displayObject), 1);
                },
                onRepeat: function () {
                    _this._repeatCount++;
                    _this.setPosition(_this._incBtns.indexOf(e.displayObject), 1);
                    var timescale = _this._repeatCount > 20 ? 1.5 : (_this._repeatCount < 10 ? 0.5 : 1);
                    _this._tween.timeScale(timescale);
                },
                onRepeatScope: this
            });
        };
        ReelsForceTool.prototype.onIncUp = function (e) {
            if (this._tween) {
                this._tween.pause();
                this._tween.kill();
                this._tween = null;
            }
        };
        ReelsForceTool.prototype.onDecDown = function (e) {
            var _this = this;
            if (this._tween) {
                this._tween.pause();
                this._tween.kill();
            }
            this._tween = TweenMax.to(this, 0.1, {
                repeat: -1,
                onStart: function () {
                    _this._repeatCount = 0;
                    _this.setPosition(_this._decBtns.indexOf(e.displayObject), -1);
                },
                onRepeat: function () {
                    _this._repeatCount++;
                    _this.setPosition(_this._decBtns.indexOf(e.displayObject), -1);
                    var timescale = _this._repeatCount > 20 ? 1.5 : (_this._repeatCount < 10 ? 0.5 : 1);
                    _this._tween.timeScale(timescale);
                },
                onRepeatScope: this
            });
        };
        ReelsForceTool.prototype.onDecUp = function (e) {
            if (this._tween) {
                this._tween.pause();
                this._tween.kill();
                this._tween = null;
            }
        };
        ReelsForceTool.prototype.onIncReelSetDown = function (e) {
            this.changeReelSet(this._currentIndex + 1);
        };
        ReelsForceTool.prototype.onDecReelSetDown = function (e) {
            this.changeReelSet(this._currentIndex - 1);
        };
        ReelsForceTool.prototype.changeReelSet = function (index) {
            if (index > this._endIndex) {
                index = this._startIndex;
            }
            if (index < this._startIndex) {
                index = this._endIndex;
            }
            this._currentIndex = index;
            this.updateStrips();
            for (var i = 0; i < this._reels.getReelCount(); i++) {
                this.setPosition(i, 0);
            }
        };
        ReelsForceTool.prototype.updateStrips = function () {
            if (!this._singleReelSet) {
                var reelWidth = this._reels.getController(0).getLayout().getSymbolWidth() * this._reels.getReelCount();
                this._txt.text = this._currentIndex.toString();
                this._txt.x = this._reels.x + reelWidth / 2 + this._reels.getController(0).getLayout().x - this._txt.width / 2;
                for (var i = 0; i < this._reels.getReelCount(); i++) {
                    var symbols = this._reelSets[this._currentIndex].getAllStrips()[i].getSymbols().concat();
                    var strip = new reels.williams.Strip(symbols);
                    this._reels.getController(i).getLayout().getReel().setStrip(strip);
                }
            }
        };
        ReelsForceTool.prototype.setPosition = function (index, offset) {
            this.updateStrips();
            var currentIndex = this._reels.getController(index).getLayout().getCurrentStripIndex();
            var length = this._reels.getController(index).getLayout().getReel().getStrip().getTableLength();
            currentIndex += offset;
            if (currentIndex >= length) {
                currentIndex = 0;
            }
            if (currentIndex < 0) {
                currentIndex = length;
            }
            this._reels.getController(index).forceStop(currentIndex);
            this._reelPosTxt[index].x += this._reelPosTxt[index].width / 2;
            this._reelPosTxt[index].text = currentIndex.toString();
            this._reelPosTxt[index].x -= this._reelPosTxt[index].width / 2;
        };
        return ReelsForceTool;
    })(rendering.DisplayObjectContainer);
    components.ReelsForceTool = ReelsForceTool;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class GambleWheel
     *
     * @extends {rendering.DisplayObjectContainer}
     *
     * @description Basic gamble wheel class consisting of an pie shaped fail area and a spinning pin
     */
    var GambleWheel = (function (_super) {
        __extends(GambleWheel, _super);
        /**
         * Creates an instance of GambleWheel.
         */
        function GambleWheel() {
            _super.call(this);
            this._tolerance = 0;
        }
        Object.defineProperty(GambleWheel.prototype, "tolerance", {
            /**
             * The tolerance used to prevent the pin stopping on the pass/fail line
             */
            get: function () {
                return this._tolerance;
            },
            /**
             * The tolerance used to prevent the pin stopping on the pass/fail line
             */
            set: function (value) {
                this._tolerance = value;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Draws the fail cirlce/pie area
         *
         * @param {number} radius Total radius to draw
         * @param {number} percentage Percentage of the circle to draw
         * @param {number} colour Colour to fill
         */
        GambleWheel.prototype.drawFailZone = function (radius, percentage, colour) {
            if (!this._failGraphics) {
                this._failGraphics = new rendering.Graphics();
                this.addChild(this._failGraphics);
            }
            this._failGraphics.clear();
            this._failPercentage = percentage;
            this._failGraphics.beginFill(colour, 1);
            this._failGraphics.lineStyle(0.1, 0, 0);
            this._failGraphics.moveTo(radius, radius);
            this._failGraphics.arc(radius, radius, radius, (Math.PI * 2) * -0.25 + ((Math.PI * 2) * ((1 - percentage) / 2)), (Math.PI * 2) * -0.25 + (Math.PI * 2) * percentage + ((Math.PI * 2) * ((1 - percentage) / 2)));
            this._failGraphics.lineTo(radius, radius);
            this._failGraphics.endFill();
            this._failGraphics.x = -radius;
            this._failGraphics.y = -radius;
        };
        /**
         * Adds the pin that will spin. Pin will spin on 0,0 co-ordinates
         *
         * @param {rendering.DisplayObject<any>} pin
         */
        GambleWheel.prototype.addPin = function (pin) {
            this._pin = pin;
            this.addChild(pin);
        };
        /**
         * Starts the spin so it can be stopped later
         *
         * @param {number} spinTime How many seconds a single spin should take
         */
        GambleWheel.prototype.startSpin = function (spinTime) {
            TweenMax.to(this._pin, spinTime, { rotation: this._pin.rotation + 360, ease: Linear.easeNone, repeat: -1 });
            this._spinning = true;
        };
        /**
         * Stops the wheels current spin
         *
         * @param {boolean} win Whether it should display a win or fail
         * @param {number} spinTime How many seconds a single spin should take
         * @param {number} repeats Total amount of spins during decelleration
         */
        GambleWheel.prototype.stopSpin = function (win, spinTime, repeats) {
            TweenMax.killTweensOf(this._pin);
            this.spin(win, spinTime, repeats);
        };
        /**
         * Reset the wheel and pin to default
         */
        GambleWheel.prototype.reset = function () {
            this._pin.rotation = 0;
            TweenMax.killTweensOf(this._pin);
            this._spinning = false;
        };
        /**
         * Perform a complete spin of the wheel
         *
         * @param {boolean} win Whether it should display a win or fail
         * @param {number} spinTime How many seconds a single spin should take
         * @param {number} repeats Total amount of spins during decelleration
         */
        GambleWheel.prototype.spin = function (win, spinTime, repeats) {
            this._spinning = true;
            this._pin.rotation = this._pin.rotation;
            var winDist = 360 * (1 - this._failPercentage);
            var winMin = -winDist / 2;
            var winMax = winDist / 2;
            var stopRand = winMin + this.getRandom(this._tolerance, 1 - this._tolerance) * winDist;
            var failDist = 360 * (this._failPercentage);
            var failMin = -failDist / 2 + 180;
            var failMax = failDist / 2 + 180;
            if (!win) {
                stopRand = failMin + this.getRandom(this._tolerance, 1 - this._tolerance) * failDist;
            }
            stopRand = (360 * repeats) + stopRand;
            TweenMax.to(this._pin, spinTime * repeats, { rotation: stopRand, ease: Power1.easeOut, onComplete: this.onPinStop, onCompleteScope: this });
        };
        /**
         * Called when the spin is complete and dispatches GambleWheelEvent.COMPLETE
         *
         * @protected
         */
        GambleWheel.prototype.onPinStop = function () {
            while (this._pin.rotation > 360) {
                this._pin.rotation -= 360;
            }
            this._spinning = false;
            this.dispatchEvent(new components.GambleWheelEvent(components.GambleWheelEvent.COMPLETE, this));
        };
        /**
         * Generates a random number between 0 and 1
         *
         * @protected
         * @param {number} [min=0] minimum number to be generated must be less than or equal to max
         * @param {number} [max=1] maximum number to be generated must be grather than or equal to min
         * @returns {number}
         */
        GambleWheel.prototype.getRandom = function (min, max) {
            if (min === void 0) { min = 0; }
            if (max === void 0) { max = 1; }
            return min + Math.random() * (max - min);
        };
        return GambleWheel;
    })(rendering.DisplayObjectContainer);
    components.GambleWheel = GambleWheel;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class GambleWheelEvent
     *
     * @extends {borgevent.Event}
     *
     * @description Event for GambleWheel
     */
    var GambleWheelEvent = (function (_super) {
        __extends(GambleWheelEvent, _super);
        /**
         * Creates an instance of GambleWheelEvent.
         *
         * @param {string} eventName Type of event
         * @param {GambleWheel} wheel Wheel that dispatched the event
         */
        function GambleWheelEvent(eventName, wheel) {
            _super.call(this, eventName);
            this.wheel = wheel;
        }
        /**
         * Dispatched when the wheel completes it's spin
         *
         * @static
         * @type {string}
         */
        GambleWheelEvent.COMPLETE = "GambleWheelEvent_COMPLETE";
        return GambleWheelEvent;
    })(borgevent.Event);
    components.GambleWheelEvent = GambleWheelEvent;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class Payline
     *
     * @description Contains settings of a payline
     */
    var Payline = (function () {
        /**
         * Create a new Payline object
         *
         * @param  targets  coordinates in grid space
         * @param  lineWidth  size of the line in pixels
         * @param  outline  specifies if the line has an outline or not
         * @param  color  main line color
         * @param  darkPercent  percentage of the main color to use when darkening the line
         * @param  outlineColor  color of the line outline
         * @param  columnIndex  the reel column to start drawing the payline from
         */
        function Payline(targets, lineWidth, outline, color, darkPercent, outlineColor, outlineThickness, columnStartIndex) {
            if (columnStartIndex === void 0) { columnStartIndex = 0; }
            this.targets = targets;
            this.lineWidth = lineWidth;
            this.outline = outline;
            this.color = color;
            this.darkPercent = darkPercent;
            this.outlineColor = outlineColor;
            this.outlineThickness = outlineThickness;
            this.columnStartIndex = columnStartIndex;
            this.offsets = [];
            for (var i = 0; i < this.targets.length; i++) {
                this.offsets[i] = new util.Point();
            }
        }
        /**
         * Set the offsets the payline should be drawn at relative to the top left position of each box in the grid
         * @param offsets List offsets
         */
        Payline.prototype.setOffsets = function (offsets) {
            for (var i = 0; i < this.targets.length && i < offsets.length; i++) {
                this.offsets[i] = new util.Point(offsets[i].x, offsets[i].y);
            }
        };
        /**
         * Get the offset the payline should be drawn at for a box in the grid
         * @param index The index of the box in the grid
         */
        Payline.prototype.getOffset = function (index) {
            if (index < 0 || index >= this.offsets.length) {
                return null;
            }
            return this.offsets[index];
        };
        /**
         * Get the color string for the main line color
         * @param  darken  true to darken the line based on the dark percent
         */
        Payline.prototype.getLineColor = function (darken) {
            if (darken) {
                return util.ColorUtil.shadeColor1(this.color, this.darkPercent * -1);
            }
            return this.color;
        };
        return Payline;
    })();
    components.Payline = Payline;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class PaylinePart
     *
     * @description Payline part enumeration
     */
    (function (PaylinePart) {
        PaylinePart[PaylinePart["None"] = 0] = "None";
        PaylinePart[PaylinePart["Line"] = 1] = "Line";
        PaylinePart[PaylinePart["Box"] = 2] = "Box";
    })(components.PaylinePart || (components.PaylinePart = {}));
    var PaylinePart = components.PaylinePart;
    /**
     * @class PaylineDisplay
     *
     * @description Contains functionality for displaying a lines and boxes display of paylines
     *
     * @example
     * ```typescript
     *
     * //Setup variables
     * var symbolW: number = 276;
     * var symbolH: number = 218;
     * var lineThickness: number = 15;
     * var paylines: components.Payline[] = [];
     * var linesData: server.PaylinesData = initData.paylinesData;
     *
     * //Cycle through and create our payline data
     * for (var i: number = 0; i < linesData.paylines.length; i++) {
     *     var positions: number[] = [];
     *     var yPos: number;
     *     var xPos: number;
     *
     *     for (var j: number = 0; j < linesData.paylines[i].offsets.length; j++) {
     *         yPos = Math.floor(linesData.paylines[i].offsets[j] / 5);
     *         xPos = linesData.paylines[i].offsets[j] % 5;
     *         positions[xPos] = yPos;
     *     }
     *
     *     var payline: components.Payline = new components.Payline(positions,
     *         lineThickness, true, 0xff0000, 50, 0xffffff, 5);
     *
     *     //Offset all paylines to be centered on the symbol
     *     payline.setOffsets([
     *         new util.Point(symbolW / 2, symbolH / 2),
     *         new util.Point(symbolW / 2, symbolH / 2),
     *         new util.Point(symbolW / 2, symbolH / 2),
     *         new util.Point(symbolW / 2, symbolH / 2),
     *         new util.Point(symbolW / 2, symbolH / 2)
     *     ]);
     *
     *     paylines.push(payline)
     * }
     *
     * //Create a grid for the layout
     * var grid: components.PaylineGrid = new components.PaylineGrid(280 - lineThickness,
     *     270 + lineThickness / 2, 5, 3, symbolW, symbolH, 3, 0);
     *
     * //Create the display
     * var paylineDisplay: components.PaylineDisplay = new components.PaylineDisplay(grid, paylines);
     * this.addChild(paylineDisplay);
     *
     * //Show payline 0 with three box parts and two line parts
     * var parts: components.PaylinePart[][] =[
     *     [
     *         components.PaylinePart.Box,
     *         components.PaylinePart.Box,
     *         components.PaylinePart.Box,
     *         components.PaylinePart.Line,
     *         components.PaylinePart.Line
     *     ]
     * ]
     * paylineDisplay.showLines([0], parts, false)
     * ```
     */
    var PaylineDisplay = (function (_super) {
        __extends(PaylineDisplay, _super);
        /**
         * Create a new PaylineDisplay object
         *
         * @param  grid  grid that will be used to draw the lines
         * @param  lines  collection of line grid coordinates
         */
        function PaylineDisplay(grid, lines, fullLine) {
            _super.call(this);
            this.grid = grid;
            //this.vgActor = new rendering.Graphics();
            this.lines = lines;
            this.fullLine = fullLine;
            this.container = new rendering.DisplayObjectContainer();
            this.container.visible = false;
            this.addChild(this.container);
            this.lineCache = [];
            this.cacheLines = false;
            //this.vgActor.visible = false;
            //this.addChild(this.vgActor);
        }
        /**
         * Sets whether or not to only draw the lines once and then cache them
         */
        PaylineDisplay.prototype.setCacheLines = function (value) {
            this.cacheLines = value;
        };
        /**
         * @inheritdoc
         */
        PaylineDisplay.prototype.getPaylineGrid = function () {
            return this.grid;
        };
        /**
         * @inheritdoc
         * @param  id  @inheritdoc
         */
        PaylineDisplay.prototype.getPayline = function (id) {
            return this.lines[id];
        };
        /**
         * @inheritdoc
         */
        PaylineDisplay.prototype.getPaylineCount = function () {
            return this.lines.length;
        };
        /**
         * Redraws the display based to show a single payline
         *
         * @param  payline  payline number to show. 0 based.
         * @param  parts  collection of payline parts. Number of parts must match number of payline
         *                targets.
         * @param  darken  true to darken the lines
         */
        PaylineDisplay.prototype.show = function (payline, parts, darken, clear) {
            if (clear === void 0) { clear = true; }
            this.drawLines([payline], [parts], darken, clear);
            this.container.visible = true;
        };
        /**
         * Redraws the display based to show multiple paylines
         *
         * @param  paylines list of payline indexes to show
         * @param  parts  collection of payline parts. Number of parts must match number of payline
         *                targets.
         * @param  darken  true to darken the lines
         */
        PaylineDisplay.prototype.showLines = function (paylines, parts, darken, clear) {
            if (clear === void 0) { clear = true; }
            this.drawLines(paylines, parts, darken, clear);
            this.container.visible = true;
        };
        /**
         * Redraws the display based to show a single payline
         *
         * @param  payline  payline number to show. 0 based.
         * @param  parts  collection of payline parts. Number of parts must match number of payline
         *                targets.
         * @param  targets  custom payline targets
         * @param  darken  true to darken the lines
         * @param  drawLines  true to always draw lines from box to box
         */
        PaylineDisplay.prototype.showCustom = function (payline, parts, targets, darken, drawLines, clear) {
            if (clear === void 0) { clear = true; }
            this.drawLineCustom(payline, parts, targets, darken, drawLines, clear);
            this.container.visible = true;
        };
        /**
         * @inheritdoc
         */
        PaylineDisplay.prototype.hide = function () {
            this.container.visible = false;
        };
        /**
         * @inheritdoc
         */
        PaylineDisplay.prototype.clear = function () {
            while (this.container.children.length > 0) {
                this.container.removeChild(this.container.children[0]);
            }
            /*var newContainer: rendering.DisplayObjectContainer = new rendering.DisplayObjectContainer();
            newContainer.visible = this.container.visible;
            this.removeChild(this.container);
            this.addChild(newContainer);
            this.container = newContainer;*/
        };
        /**
         * Draws a set of the lines in the display. This will draw all lines
         * in the collection up to a certain index.
         *
         * @param  paylines  list of line indexes
         * @param  parts  collection of payline parts.
         * @param  darken  true to darken the lines
         */
        PaylineDisplay.prototype.drawLines = function (paylines, parts, darken, clear) {
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
                this.container.addChild(g);
            }
        };
        /**
         * Gets the cached line if it is available
         *
         * @param  lineIndex  index of the line
         * @param  parts  collection of payline parts. Only caches if they are all PaylinePart.Line
         *
         */
        PaylineDisplay.prototype.getCachedLine = function (lineIndex, parts) {
            if (!this.cacheLines) {
                return null;
            }
            var isLine = true;
            for (var i = 0; i < parts.length; i++) {
                if (parts[i] != PaylinePart.Line) {
                    isLine = false;
                }
            }
            if (isLine && this.lineCache[lineIndex]) {
                return this.lineCache[lineIndex];
            }
            return null;
        };
        /**
         * Draws a payline on the display.
         *
         * @param  lineIndex  index of the line
         * @param  parts  collection of payline parts.
         * @param  darken  true to darken the lines
         * @param  drawLines  true to always draw lines from box to box
         */
        PaylineDisplay.prototype.drawLineCustom = function (lineIndex, parts, targets, darken, drawLines, clear) {
            if (clear === void 0) { clear = true; }
            if (clear)
                this.clear();
            var line = this.lines[lineIndex];
            line.targets = targets;
            var g = this.getCachedLine(lineIndex, parts); //new rendering.Graphics();
            if (g == null) {
                g = new rendering.Graphics();
                if (line.outline) {
                    g.lineStyle(line.lineWidth + line.outlineThickness, line.outlineColor, 1, rendering.CapStyle.ROUND, rendering.JointStyle.MITER);
                    this.tracePath(g, line, parts, drawLines);
                }
                g.lineStyle(line.lineWidth, line.getLineColor(darken), 1, rendering.CapStyle.ROUND, rendering.JointStyle.MITER);
                this.tracePath(g, line, parts, drawLines);
                this.lineCache[lineIndex] = g;
            }
            this.container.addChild(g);
        };
        /**
         * Draws the path based on the line targets
         *
         * @param  vgComp  the vector graphics component
         * @param  payline  the payline to draw
         * @param  parts  payline part spec
         * @param  drawLines  true to always draw lines from box to box
         */
        PaylineDisplay.prototype.tracePath = function (vgComp, payline, parts, drawLines) {
            for (var i = 0; i < payline.targets.length; ++i) {
                if (parts[i] == PaylinePart.None) {
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
                if (parts[i] == PaylinePart.Box) {
                    this.drawBox(i, vgComp, payline, parts, drawLines, targetWidth, targetHeight, targetTopLeftX, targetTopLeftY, targetBottomRightX, targetBottomRightY);
                }
                if (drawLines) {
                    var toBox = false;
                    var startX = targetPosition[0] - (this.fullLine ? (targetWidth * 0.5) : 0);
                    var startY = targetPosition[1] - (this.fullLine ? (targetHeight * 0.5) : 0);
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
                        if (parts[i] == PaylinePart.Box) {
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
                        var line = new util.Line(new util.Point(startX, startY), new util.Point(endX, endY));
                        var intersectPoint = new util.Point();
                        var rect = new util.Rect();
                        var intersects = false;
                        if (parts[i - 1] == PaylinePart.Box) {
                            rect.set(this.grid.getTargetPosX(columnIndex - 1, payline.targets[i - 1]) - (targetWidth * 0.5), this.grid.getTargetPosY(columnIndex - 1, payline.targets[i - 1]) - (targetHeight * 0.5), targetWidth, targetHeight);
                            intersects = line.intersectionRect(rect, intersectPoint);
                            if (intersects) {
                                startX = intersectPoint.x;
                                startY = intersectPoint.y;
                            }
                        }
                        if (parts[i] == PaylinePart.Box) {
                            rect.set(targetTopLeftX, targetTopLeftY, targetWidth, targetHeight);
                            intersects = line.intersectionRect(rect, intersectPoint);
                            if (intersects) {
                                endX = intersectPoint.x;
                                endY = intersectPoint.y;
                            }
                        }
                    }
                    //if (parts[i] == PaylinePart.Box || parts[i - 1] == PaylinePart.Box || i == 0) {
                    vgComp.moveTo(startX, startY).lineTo(endX, endY);
                    //}
                    //else{
                    //vgComp.lineTo(endX, endY);
                    //}
                    if (parts[i] != PaylinePart.Box && i == payline.targets.length - 1) {
                        startX = endX;
                        startY = endY;
                        endX = targetBottomRightX;
                        if (this.fullLine)
                            vgComp.moveTo(startX, startY).lineTo(endX, endY);
                    }
                }
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
        /**
          * Draws a line from a box to anohther box
          *
          * @param  i  part index
          * @param  vgComp  vector graphics component
          * @param  line  the payline
          * @param  tw  target box width
          * @param  th  target box height
          * @param  ltx  line target x
          * @param  lty  line target y
          * @param  t  target position
          */
        PaylineDisplay.prototype.drawLineFromBoxToBox = function (i, vgComp, line, tw, th, ltx, lty, t) {
            ltx = this.grid.getTargetPosX(i + 1, line.targets[i + 1]);
            lty = this.grid.getTargetPosY(i + 1, line.targets[i + 1]);
            if (t[1] < (lty - th)) {
                ltx = ltx - (tw * 0.25);
                lty = lty - (th * 0.5);
            }
            else if (t[1] > (lty + th)) {
                ltx = ltx - (tw * 0.25);
                lty = lty + (th * 0.5);
            }
            else {
                ltx = ltx - (tw * 0.5);
            }
            vgComp.moveTo(t[0], t[1]).lineTo(ltx, lty);
        };
        return PaylineDisplay;
    })(rendering.DisplayObjectContainer);
    components.PaylineDisplay = PaylineDisplay;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class PaylineGrid
     *
     * @description Contains layout data and functionality for the underlying grid for paylines.
     */
    var PaylineGrid = (function () {
        /**
         * Create a new Grid object
         *
         * @param  anchorX  left most extent of grid
         * @param  anchorY  upper most extent of grid
         * @param  width  the number of targets horizontally
         * @param  height  the number of targets vertically
         * @param  targetWidth  width of a target on the grid
         * @param  targetHeight  height of a target on the grid
         * @param  gridSpacingX  spacing on the X used to separate grid targets
         * @param  gridSpacingY  spacing on the Y used to separate grid targets
         */
        function PaylineGrid(anchorX, anchorY, width, height, targetWidth, targetHeight, gridSpacingX, gridSpacingY) {
            this.anchorX = anchorX;
            this.anchorY = anchorY;
            this.width = width;
            this.height = height;
            this.targetWidth = targetWidth;
            this.targetHeight = targetHeight;
            this.gridSpacingX = gridSpacingX;
            this.gridSpacingY = gridSpacingY;
            this.generate();
        }
        /**
         * Get the x position of a grid target
         *
         * @param  targetPosX  x position of the target in the grid
         * @param  targetPosY  y position of the target in the grid
         */
        PaylineGrid.prototype.getTargetPosX = function (targetPosX, targetPosY) {
            return this.targets[targetPosY][targetPosX][0];
        };
        /**
         * Get the y position of a grid target
         *
         * @param  targetPosX  x position of the target in the grid
         * @param  targetPosY  y position of the target in the grid
         */
        PaylineGrid.prototype.getTargetPosY = function (targetPosX, targetPosY) {
            return this.targets[targetPosY][targetPosX][1];
        };
        PaylineGrid.prototype.getTargetPosWidth = function (targetPosX, targetPosY) {
            return this.targets[targetPosY][targetPosX][2];
        };
        PaylineGrid.prototype.getTargetPosHeight = function (targetPosX, targetPosY) {
            return this.targets[targetPosY][targetPosX][3];
        };
        /**
         * Get the width in pixels of the target
         */
        PaylineGrid.prototype.getTargetWidth = function () {
            return this.targetWidth;
        };
        /**
         * Get the width in pixels of the target
         */
        PaylineGrid.prototype.getTargetHeight = function () {
            return this.targetHeight;
        };
        /**
         * Get the targets
         */
        PaylineGrid.prototype.getTargets = function () {
            return this.targets;
        };
        /**
         * Set the targets
         *
         * @param   targets the new targets
         */
        PaylineGrid.prototype.setTargets = function (targets) {
            this.targets = targets;
        };
        /**
         * Called to generate the grid targets
         *
         * @param  translationScale  scale factor to calculate anchor
         */
        PaylineGrid.prototype.generate = function () {
            var x = this.anchorX;
            var y = this.anchorY;
            this.targets = new Array();
            for (var row = 0; row < this.height; ++row) {
                this.targets.push(new Array());
                for (var col = 0; col < this.width; ++col) {
                    this.targets[row].push([
                        x + ((col + 1) * this.targetWidth) - this.targetWidth * 0.5,
                        y + ((row + 1) * this.targetHeight) - this.targetHeight * 0.5,
                        this.targetWidth,
                        this.targetHeight
                    ]);
                    if (col != 0) {
                        this.targets[row][col][0] += this.gridSpacingX * col;
                    }
                    if (row != 0) {
                        this.targets[row][col][1] += this.gridSpacingY * row;
                    }
                }
            }
        };
        PaylineGrid.prototype.addToGrid = function (x, y, startColumn, startRow, width, height, targetWidth, targetHeight, spacingX, spacingY) {
            for (var row = startRow; row < height + startRow; ++row) {
                //if(!this.targets[row])
                this.targets.push(new Array());
                for (var col = startColumn; col < width + startColumn; ++col) {
                    console.log(row, col);
                    this.targets[this.targets.length - 1].push([
                        x + ((col + 1) * targetWidth) - targetWidth * 0.5,
                        y + ((row + 1) * targetHeight) - targetHeight * 0.5,
                        targetWidth,
                        targetHeight
                    ]);
                    if (col != 0) {
                        this.targets[this.targets.length - 1][col - startColumn][0] += spacingX * col;
                    }
                    if (row != 0) {
                        this.targets[this.targets.length - 1][col - startColumn][1] += spacingY * row;
                    }
                }
            }
        };
        PaylineGrid.prototype.debugDraw = function () {
            var g = new rendering.Graphics();
            for (var x = 0; x < this.targets.length; x++) {
                for (var y = 0; y < this.targets[x].length; y++) {
                    g.lineStyle(5, 0x000000, 1);
                    g.beginFill(0xff0000, 0.5);
                    g.drawRect(this.targets[x][y][0] - this.targets[x][y][2] * 0.5, this.targets[x][y][1] - this.targets[x][y][3] * 0.5, this.targets[x][y][2], this.targets[x][y][3]);
                    g.endFill();
                }
            }
            return g;
        };
        return PaylineGrid;
    })();
    components.PaylineGrid = PaylineGrid;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class SymbolClip
     *
     * @description Custom Movieclip to display symbols on the SymbolDisplay class
     */
    var SymbolClip = (function (_super) {
        __extends(SymbolClip, _super);
        /**
         * @inheritdoc
         * @assetsOrFrames @inheritdoc
         */
        function SymbolClip(assetsOrFrames) {
            _super.call(this, assetsOrFrames, true);
            this._resetOnEnd = true;
        }
        Object.defineProperty(SymbolClip.prototype, "resetOnEnd", {
            /**
             * Whether or not the Clip should reset to first frame when finished playing
             *
             * @type {boolean}
             */
            get: function () {
                return this._resetOnEnd;
            },
            /**
             * Whether or not the Clip should reset to first frame when finished playing
             */
            set: function (value) {
                this._resetOnEnd = value;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Play's the clip after the specified delay
         *
         * @param {number} [delay=0] Delay in seconds before the clip is played
         */
        SymbolClip.prototype.start = function (delay) {
            var _this = this;
            if (delay === void 0) { delay = 0; }
            TweenMax.delayedCall(delay, function () {
                _this.gotoAndPlay(0);
                _this.addEventListener(rendering.DisplayEvent.ENTER_FRAME, _this.onMcFrame, _this);
                _this._isPlaying = true;
            });
        };
        /**
         * Stop the clip playing and remove it from the display
         */
        SymbolClip.prototype.kill = function () {
            if (this._isPlaying) {
                this.removeEventListener(rendering.DisplayEvent.ENTER_FRAME, this.onMcFrame, this);
                this.stop();
            }
            if (this.parent) {
                this.parent.removeChild(this);
            }
        };
        /**
         * Resets and pauses the clip when all frames have been played
         * @param e Event
         */
        SymbolClip.prototype.onMcFrame = function (e) {
            if (this.currentFrame == this.totalFrames - 1) {
                if (this._resetOnEnd) {
                    this.gotoAndStop(0);
                }
                else {
                    this.stop();
                }
                this.removeEventListener(rendering.DisplayEvent.ENTER_FRAME, this.onMcFrame, this);
                this._isPlaying = false;
            }
        };
        return SymbolClip;
    })(rendering.MovieClip);
    components.SymbolClip = SymbolClip;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class
     *
     * @description Symbol part enumeration
     */
    (function (SymbolPart) {
        SymbolPart[SymbolPart["Hide"] = 0] = "Hide";
        SymbolPart[SymbolPart["Show"] = 1] = "Show";
    })(components.SymbolPart || (components.SymbolPart = {}));
    var SymbolPart = components.SymbolPart;
    /**
     * @class Symbol
     *
     * @description Symbol data used with the SymbolDisplay
     */
    var Symbol = (function () {
        /**
         * Creates a new Symbol
         * @param part Whether or not the symbol is shown
         * @param part The index of the Symbol
         * @param delay Delay before the animation should be played
         */
        function Symbol(part, symbolId, delay) {
            if (delay === void 0) { delay = 0; }
            this.part = part;
            this.symbolId = symbolId;
            this.delay = delay;
        }
        return Symbol;
    })();
    components.Symbol = Symbol;
    /**
     * @class SymbolDisplay
     *
     * @description Contains functionality for displaying symbol animations on a specified line
     *
     * @example
     * ```typescript
     *
     * //Setup variables
     * var symbolW: number = 276;
     * var symbolH: number = 218;
     * var lineThickness: number = 15;
     * var paylines: components.Payline[] = [];
     * var linesData: server.PaylinesData = initData.paylinesData;
     *
     * //Cycle through and create our payline data
     * for (var i: number = 0; i < linesData.paylines.length; i++) {
     *     var positions: number[] = [];
     *     var yPos: number;
     *     var xPos: number;
     *
     *     for (var j: number = 0; j < linesData.paylines[i].offsets.length; j++) {
     *         yPos = Math.floor(linesData.paylines[i].offsets[j] / 5);
     *         xPos = linesData.paylines[i].offsets[j] % 5;
     *         positions[xPos] = yPos;
     *     }
     *
     *     var payline: components.Payline = new components.Payline(positions,
     *         lineThickness, true, 0xff0000, 50, 0xffffff, 5);
     *
     *     //Offset all paylines to be centered on the symbol
     *     payline.setOffsets([
     *         new util.Point(symbolW / 2, symbolH / 2),
     *         new util.Point(symbolW / 2, symbolH / 2),
     *         new util.Point(symbolW / 2, symbolH / 2),
     *         new util.Point(symbolW / 2, symbolH / 2),
     *         new util.Point(symbolW / 2, symbolH / 2)
     *     ]);
     *
     *     paylines.push(payline)
     * }
     *
     * //Create a grid for the layout
     * var grid: components.PaylineGrid = new components.PaylineGrid(280 - lineThickness,
     *     270 + lineThickness / 2, 5, 3, symbolW, symbolH, 3, 0);
     *
     * //Create the display
     * var cache: assets.AssetCache = new assets.AssetCache();
     * var animations: assets.IFrame[][] = [
     *      new components.SpriteSheet(
     *          cache.getAssetById(MainBundle.Rg_Symbol_Cherry_json.name),
     *          cache.getAssetById(MainBundle.Rg_Symbol_Cherry_img.name)
     *      ).getFrames(1)
     * ];
     * var symbolDisplay: components.SymbolDisplay = new SymbolDisplay(grid, paylines.paylines, animations);
     * this.addChild(symbolDisplay);
     *
     * //Show payline 0 with three symbols
     * var symbols: components.Symbol[] =
     * [
     *      new components.Symbol(components.SymbolPart.Show, 0),
     *      new components.Symbol(components.SymbolPart.Show, 0),
     *      new components.Symbol(components.SymbolPart.Show, 0),
     *      new components.Symbol(components.SymbolPart.Hide, 0),
     *      new components.Symbol(components.SymbolPart.Hide, 0)
     * ];
     * symbolDisplay.show(0, symbols, false);
     * ```
     */
    var SymbolDisplay = (function (_super) {
        __extends(SymbolDisplay, _super);
        function SymbolDisplay(grid, lines, animations) {
            _super.call(this);
            this.grid = grid;
            this.lines = lines;
            this._activeSymbols = [];
            this._fps = 30;
            if (animations[0][0] instanceof assets.Asset) {
                this._assets = animations;
            }
            else {
                this._frames = animations;
            }
            this._resetOnEnd = [];
            for (var i = 0; i < animations.length; i++) {
                this._resetOnEnd[i] = true;
            }
        }
        SymbolDisplay.prototype.resetOnEndForClip = function (index, value) {
            this._resetOnEnd[index] = value;
        };
        Object.defineProperty(SymbolDisplay.prototype, "fps", {
            /**
             * Get the framerate of playback
             *
             * @type {number}
             */
            get: function () {
                return this._fps;
            },
            /**
             * Set the framerate of playback
             */
            set: function (value) {
                this._fps = value;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * @inheritdoc
         */
        SymbolDisplay.prototype.getPaylineGrid = function () {
            return this.grid;
        };
        /**
         * @inheritdoc         *
         * @param  id  @inheritdoc
         */
        SymbolDisplay.prototype.getPayline = function (id) {
            return this.lines[id];
        };
        /**
         * @inheritdoc
         */
        SymbolDisplay.prototype.getPaylineCount = function () {
            return this.lines.length;
        };
        /**
         * Redraws the display based to show a single paylines animation
         *
         * @param  payline  payline number to show. 0 based.
         * @param  symbols  collection of symbols. Number of symbols must match number of payline
         *                targets.
         * @param  darken  true to darken the symbols
         */
        SymbolDisplay.prototype.show = function (payline, symbols, darken) {
            this.drawLines([payline], [symbols], darken);
            this.visible = true;
        };
        /**
         * Redraws the display based to show multiple paylines animations
         *
         * @param  paylines  list of payline indexes to show
         * @param  symbols  collection of symbols. Number of symbols must match number of payline
         *                targets.
         * @param  darken  true to darken the lines
         */
        SymbolDisplay.prototype.showLines = function (paylines, symbols, darken) {
            this.drawLines(paylines, symbols, darken);
            this.visible = true;
        };
        /**
         * Redraws the display based to show a single paylines animation
         *
         * @param  payline  payline number to show. 0 based.
         * @param  symbols  collection of symbols. Number of symbols must match number of payline
         *                targets.
         * @param  targets  custom payline targets
         * @param  darken  true to darken the lines
         * @param  drawLines  true to always draw lines from box to box
         */
        SymbolDisplay.prototype.showCustom = function (payline, symbols, targets, darken, drawLines) {
            this.drawLineCustom(payline, symbols, targets, darken);
            this.visible = true;
        };
        /**
         * @inheritdoc
         */
        SymbolDisplay.prototype.hide = function () {
            this.visible = false;
        };
        /**
         * @inheritdoc
         */
        SymbolDisplay.prototype.clear = function () {
            this.stopAll();
        };
        /**
         * Stops all the currently playing animations and removes them from the display
         */
        SymbolDisplay.prototype.stopAll = function () {
            for (var i = 0; i < this._activeSymbols.length; i++) {
                this._activeSymbols[i].kill();
            }
        };
        /**
         * Plays a set of symbol animations on a set of paylines.
         *
         * @param  paylines  list of payline indexes to show
         * @param  drawToIndex  lines array index to draw all lines up to
         * @param  symbols  collection of symbols. Number of symbols must match number of payline
         *                targets..
         * @param  darken  true to darken the lines
         */
        SymbolDisplay.prototype.drawLines = function (paylines, symbols, darken) {
            this.stopAll();
            for (var i = 0; i < paylines.length; ++i) {
                var line = this.lines[paylines[i]];
                this.tracePath(line, symbols[i]);
            }
        };
        /**
         * Plays a set of symbol animations on a payline.
         *
         * @param  drawFromIndex  lines array index to draw lines from
         * @param  drawToIndex  lines array index to draw all lines up to
         * @param  symbols  collection of symbols. Number of symbols must match number of payline
         *                targets.
         * @param  darken  true to darken the lines
         * @param  drawLines  true to always draw lines from box to box
         */
        SymbolDisplay.prototype.drawLineCustom = function (lineIndex, symbols, targets, darken) {
            this.stopAll();
            var line = this.lines[lineIndex];
            line.targets = targets;
            this.tracePath(line, symbols);
        };
        /**
         * Plays the symbols on a specified line
         *
         * @param  payline  the payline to draw
         * @param  symbols  collection of symbols. Number of symbols must match number of payline
         *                targets.
         */
        SymbolDisplay.prototype.tracePath = function (payline, symbols) {
            for (var i = 0; i < symbols.length; ++i) {
                if (symbols[i].part == SymbolPart.Hide) {
                    continue;
                }
                var targetWidth = this.grid.getTargetWidth();
                var targetHeight = this.grid.getTargetHeight();
                var columnIndex = i + payline.columnStartIndex;
                var targetPosition = [
                    this.grid.getTargetPosX(columnIndex, payline.targets[i]),
                    this.grid.getTargetPosY(columnIndex, payline.targets[i])
                ];
                var targetTopLeftX = targetPosition[0] - (targetWidth * 0.5);
                var targetTopLeftY = targetPosition[1] - (targetHeight * 0.5);
                var targetBottomRightX = targetPosition[0] + (targetWidth * 0.5);
                var targetBottomRightY = targetPosition[1] + (targetHeight * 0.5);
                if (symbols[i].part == SymbolPart.Show) {
                    var mc;
                    if (this._assets) {
                        mc = new components.SymbolClip(this._assets[symbols[i].symbolId]);
                    }
                    else {
                        mc = new components.SymbolClip(this._frames[symbols[i].symbolId]);
                    }
                    mc.resetOnEnd = this._resetOnEnd[symbols[i].symbolId];
                    mc.x = targetTopLeftX;
                    mc.y = targetTopLeftY;
                    mc.fps = this._fps;
                    mc.start(symbols[i].delay);
                    this.addChild(mc);
                    this._activeSymbols.push(mc);
                }
            }
        };
        return SymbolDisplay;
    })(rendering.DisplayObjectContainer);
    components.SymbolDisplay = SymbolDisplay;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * The reel shifter steps a reel to a specific index
     *
     * @export
     * @class ReelShifter
     */
    var ReelShifter = (function () {
        /**
         * Creates an instance of ReelShifter.
         *
         * @param {reels.williams.Controller} controller The reel controller to step
         * @param {number} target The target position to step to
         * @param {boolean} direction The direction of the steps
         */
        function ReelShifter(controller, target, direction) {
            var _this = this;
            this._controller = controller;
            this._target = target;
            this._direction = direction;
            this._controller.setOnSpinStepComplete(function (controller) { return _this.onSpinStep(controller); });
        }
        /**
         * Start stepping the reels
         */
        ReelShifter.prototype.start = function () {
            this._controller.spinStep(true, this._direction, true);
        };
        /**
         * Callback from the reel controller
         *
         * @protected
         * @param {reels.williams.Controller} controller (description)
         * @returns {boolean} (description)
         */
        ReelShifter.prototype.onSpinStep = function (controller) {
            if (this._controller.getLayout().getCurrentStripIndex() == this._target) {
                return false;
            }
            return true;
        };
        return ReelShifter;
    })();
    components.ReelShifter = ReelShifter;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class Button
     *
     * @description Basic button that supports up/down/over/disabled states
     * @example
     * ```typescript
     *
     * export class tester
     * {
     *     constructor()
     *     {
     *          var btn: components.Button = new components.Button(
     *                 MainBundle.Rg_Button_Spin_Up,
     *                 MainBundle.Rg_Button_Spin_Down,
     *                 MainBundle.Rg_Button_Spin_Dim,
     *                 MainBundle.Rg_Button_Spin_Dim);
     *
     *          btn.x = 100;
     *          btn.y = 200;
     *          btn.addEventListener(rendering.InputEvent.DOWN, this.onSpinDown, this);
     *     }
     *
     *     protected onSpinDown(e: rendering.InputEvent): void {
     *         console.log("Btn pressed");
     *     }
     * }
     * ```
     */
    var Button = (function (_super) {
        __extends(Button, _super);
        function Button(upAsset, downAsset, overAsset, disabledAsset) {
            _super.call(this);
            this._movieClip = new rendering.MovieClip([upAsset, downAsset, overAsset, disabledAsset]);
            this.addChild(this._movieClip);
            this._enabled = true;
            this._useDownState = true;
            this.setState();
        }
        Object.defineProperty(Button.prototype, "enabled", {
            /**
             * Whether or not input is enabled
             */
            get: function () { return this._enabled; },
            /**
             * Whether or not input is enabled
             */
            set: function (value) {
                this._enabled = value;
                this.setState();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Button.prototype, "useDownState", {
            get: function () {
                return this._useDownState;
            },
            set: function (value) {
                this._useDownState = value;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * @inheritdoc
         */
        Button.prototype.onClick = function (event) {
            _super.prototype.onClick.call(this, event);
        };
        /**
         * @inheritdoc
         */
        Button.prototype.onDown = function (event) {
            _super.prototype.onDown.call(this, event);
            if (this._useDownState) {
                this._down = true;
                this.setState();
            }
        };
        /**
         * @inheritdoc
         */
        Button.prototype.onUp = function (event) {
            _super.prototype.onUp.call(this, event);
            this._down = false;
            this.setState();
        };
        /**
         * @inheritdoc
         */
        Button.prototype.onOver = function (event) {
            _super.prototype.onOver.call(this, event);
            this._over = true;
            this.setState();
        };
        /**
         * @inheritdoc
         */
        Button.prototype.onOut = function (event) {
            _super.prototype.onOut.call(this, event);
            this._over = false;
            this._down = false;
            this.setState();
        };
        /**
         * Changed state every time the player interacts or enabled is changed
         */
        Button.prototype.setState = function () {
            if (!this._enabled) {
                this._movieClip.gotoAndStop(Button.DISABLED);
            }
            else if (this._down) {
                this._movieClip.gotoAndStop(Button.DOWN);
            }
            else if (this._over) {
                this._movieClip.gotoAndStop(Button.OVER);
            }
            else {
                this._movieClip.gotoAndStop(Button.UP);
            }
        };
        /**
         * Button state
         */
        Button.UP = 0;
        /**
         * Button state
         */
        Button.DOWN = 1;
        /**
         * Button state
         */
        Button.OVER = 2;
        /**
         * Button state
         */
        Button.DISABLED = 3;
        return Button;
    })(rendering.DisplayObjectContainer);
    components.Button = Button;
})(components || (components = {}));
var components;
(function (components) {
    var CycleMenu = (function (_super) {
        __extends(CycleMenu, _super);
        function CycleMenu() {
            _super.call(this);
        }
        CycleMenu.prototype.setOptions = function (xDistance, zDistance, speed, items, hitAreas) {
            var scale = 1;
            this._speed = speed;
            this._items = items;
            this._hitAreas = hitAreas;
            this._cyclePositions = [];
            for (var i = 0; i < this._items.length; i++) {
                this.addChild(this._items[i]);
                if (hitAreas && hitAreas[i]) {
                    hitAreas[i].addEventListener(rendering.InputEvent.DOWN, this.onItemUp, this);
                }
                else {
                    this._items[i].addEventListener(rendering.InputEvent.DOWN, this.onItemUp, this);
                }
            }
            for (var i = -this._items.length + 1; i < this._items.length; i++) {
                var pos = new CyclePosition();
                pos.x = xDistance * i;
                pos.y = 0;
                pos.scale = 1;
                for (var j = 0; j < Math.abs(i); j++) {
                    pos.scale *= zDistance;
                }
                this._cyclePositions.push(pos);
            }
            this._selectedIndex = 0;
            this.layout();
        };
        CycleMenu.prototype.goto = function (index, tween, force) {
            if (tween === void 0) { tween = true; }
            if (force === void 0) { force = false; }
            if (index == this._selectedIndex && !force) {
                return;
            }
            this._selectedIndex = index;
            this.layout(tween);
        };
        CycleMenu.prototype.next = function () {
            if (this._selectedIndex < this._items.length - 1) {
                this._selectedIndex++;
                this.layout(true);
            }
        };
        CycleMenu.prototype.previous = function () {
            if (this._selectedIndex > 0) {
                this._selectedIndex--;
                this.layout(true);
            }
        };
        CycleMenu.prototype.layout = function (tween) {
            if (tween === void 0) { tween = false; }
            for (var i = 0; i < this._items.length; i++) {
                var positionIndex = i - this._selectedIndex + this._items.length - 1;
                var item = this._items[i];
                var pos = this._cyclePositions[positionIndex];
                TweenMax.to(item, tween ? this._speed : 0, {
                    scaleX: pos.scale,
                    scaleY: pos.scale,
                    x: pos.x * pos.scale - ((item.width / item.scaleX) * pos.scale) / 2,
                    y: pos.y - ((item.height / item.scaleY) * pos.scale) / 2
                });
            }
            TweenMax.to(this, this._speed, { onUpdate: this.reOrder, onUpdateScope: this });
        };
        CycleMenu.prototype.onItemUp = function (e) {
            var itemIndex = this._items.indexOf(e.displayObject);
            if (this._hitAreas) {
                itemIndex = this._hitAreas.indexOf(e.displayObject);
            }
            else {
                itemIndex = this._items.indexOf(e.displayObject);
            }
            var positionIndex = itemIndex - this._selectedIndex + this._items.length - 1;
            var isSelected = positionIndex == this._items.length - 1;
            this.dispatchEvent(new components.CycleMenuEvent(components.CycleMenuEvent.SELECTED, itemIndex, positionIndex, isSelected));
        };
        CycleMenu.prototype.reOrder = function () {
            var itemsToAdd = this._items.concat();
            for (var i = 0; i < this._items.length; i++) {
                this.removeChild(this._items[i]);
            }
            while (itemsToAdd.length > 0) {
                var selected = null;
                for (var i = 0; i < itemsToAdd.length; i++) {
                    if (!selected || itemsToAdd[i].scaleY < selected.scaleY) {
                        selected = itemsToAdd[i];
                    }
                }
                this.addChild(selected);
                itemsToAdd.splice(itemsToAdd.indexOf(selected), 1);
            }
        };
        return CycleMenu;
    })(rendering.DisplayObjectContainer);
    components.CycleMenu = CycleMenu;
    var CyclePosition = (function () {
        function CyclePosition() {
        }
        return CyclePosition;
    })();
    components.CyclePosition = CyclePosition;
})(components || (components = {}));
var components;
(function (components) {
    var CycleMenuEvent = (function (_super) {
        __extends(CycleMenuEvent, _super);
        function CycleMenuEvent(type, itemIndex, positionIndex, isSelected) {
            _super.call(this, type);
            this.itemIndex = itemIndex;
            this.positionIndex = positionIndex;
            this.isSelected = isSelected;
        }
        CycleMenuEvent.SELECTED = "CycleMenuEvent_SELECTED";
        return CycleMenuEvent;
    })(borgevent.Event);
    components.CycleMenuEvent = CycleMenuEvent;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class Meter
     *
     * @description Composed of a Bitmap and Text object
     *
     * This class provides an easy way to setup text contained within a specified area on top of an image
     */
    var Meter = (function (_super) {
        __extends(Meter, _super);
        function Meter(textX, textY, maxWidth, maxHeight, font, fontSize, colour, alignment, assetOrFrame) {
            if (fontSize === void 0) { fontSize = 30; }
            if (colour === void 0) { colour = "#000000"; }
            if (alignment === void 0) { alignment = "center"; }
            if (assetOrFrame === void 0) { assetOrFrame = null; }
            _super.call(this);
            if (assetOrFrame) {
                this._image = new rendering.Bitmap(assetOrFrame);
                this.addChild(this._image);
            }
            this._tx = textX;
            this._ty = textY;
            this._text = new rendering.Text(" ");
            this._text.fontSize = fontSize;
            this._text.colour = colour;
            if (maxHeight > 0) {
                this._text.scaleToHeight = maxHeight;
            }
            this._text.scaleToWidth = maxWidth;
            this._text.font = font;
            this._text.textAlign = alignment;
            this.value = " ";
            this.addChild(this._text);
        }
        Object.defineProperty(Meter.prototype, "text", {
            /**
             * Get the text object for additional user modifications
             */
            get: function () {
                return this._text;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Meter.prototype, "image", {
            /**
             * Get the image object for additional user modifications
             */
            get: function () {
                return this._image;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Meter.prototype, "value", {
            /**
             * Set the text value of the meter
             */
            set: function (text) {
                this._text.text = text;
                if (this._image) {
                    this._text.x = this._image.width / 2 - this._text.width / 2 + this._tx;
                    this._text.y = this._image.height / 2 - this._text.height / 2 + this._ty;
                }
            },
            enumerable: true,
            configurable: true
        });
        return Meter;
    })(rendering.DisplayObjectContainer);
    components.Meter = Meter;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class SlidingMenu
     *
     * @extends {rendering.DisplayObjectContainer}
     *
     * @description Menu that slides to/from a set position. Can be masked.
     */
    var SlidingMenu = (function (_super) {
        __extends(SlidingMenu, _super);
        /**
         * Creates an instance of SlidingMenu.
         *
         * @param {number} x x position when open
         * @param {number} y y position when open
         * @param {number} [verticalSlideDistance=0] Distance to slide when closed
         * @param {number} [horizontalSlideDistance=0] Distance to slide when closed
         * @param {number} [speed=1] Speed of opening/closing in seconds
         * @param {number} [maskWidth=-1] Width of the mask for the closed section, -1 for no masking
         * @param {number} [maskHeight=-1] Height of the mask for the closed section, -1 for no masking
         */
        function SlidingMenu(x, y, verticalSlideDistance, horizontalSlideDistance, speed, maskWidth, maskHeight) {
            if (verticalSlideDistance === void 0) { verticalSlideDistance = 0; }
            if (horizontalSlideDistance === void 0) { horizontalSlideDistance = 0; }
            if (speed === void 0) { speed = 1; }
            if (maskWidth === void 0) { maskWidth = -1; }
            if (maskHeight === void 0) { maskHeight = -1; }
            _super.call(this);
            this._maskHeight = maskHeight;
            this._maskWidth = maskWidth;
            this._verticalSlideDistance = verticalSlideDistance;
            this._horizontalSlideDistance = horizontalSlideDistance;
            this._speed = speed;
            this._x = this.x = x;
            this._y = this.y = y;
            this._open = true;
            this._ease = Linear.easeNone;
            this.setMask();
        }
        /**
         *
         *
         * @param {Ease} ease
         */
        SlidingMenu.prototype.setEase = function (ease) {
            this._ease = ease;
        };
        /**
         * Creates the mask for the closed section
         *
         * @protected
         */
        SlidingMenu.prototype.setMask = function () {
            if (this._maskHeight > 0 && this._maskWidth > 0) {
                this._maskClip = new rendering.Graphics();
                this._maskClip.beginFill(0xff0000, 0.5);
                this._maskClip.drawRect(this._x, this._y, this._maskWidth, this._maskHeight);
                this._maskClip.endFill();
                this.mask = this._maskClip;
            }
        };
        SlidingMenu.prototype.configure = function (x, y, verticalSlideDistance, horizontalSlideDistance, speed, maskWidth, maskHeight) {
            if (verticalSlideDistance === void 0) { verticalSlideDistance = 0; }
            if (horizontalSlideDistance === void 0) { horizontalSlideDistance = 0; }
            if (speed === void 0) { speed = 1; }
            if (maskWidth === void 0) { maskWidth = -1; }
            if (maskHeight === void 0) { maskHeight = -1; }
            this._maskHeight = maskHeight;
            this._maskWidth = maskWidth;
            this._verticalSlideDistance = verticalSlideDistance;
            this._horizontalSlideDistance = horizontalSlideDistance;
            this._speed = speed;
            this._x = this.x = x;
            this._y = this.y = y;
            this._open = true;
            this.setMask();
        };
        /**
         * Open the menu if it is closed
         */
        SlidingMenu.prototype.open = function () {
            var _this = this;
            if (this._closeTween && this._closeTween.isTweening) {
                TweenMax.delayedCall(0.1, this.open, [], this);
                return;
            }
            if (!this._openTween || !this._openTween.isTweening) {
                this._openTween = TweenMax.to(this, this._speed, { x: this._x, y: this._y, ease: this._ease,
                    onComplete: function () { _this.dispatchEvent(new components.SlidingMenuEvent(components.SlidingMenuEvent.OPEN_COMPLETE)); },
                    onCompelteScope: this
                });
                this._open = true;
            }
        };
        /**
         * Close the menu if it is open
         */
        SlidingMenu.prototype.close = function () {
            var _this = this;
            if (this._openTween && this._openTween.isTweening) {
                TweenMax.delayedCall(0.1, this.close, [], this);
                return;
            }
            if (!this._closeTween || !this._closeTween.isTweening) {
                this._closeTween = TweenMax.to(this, this._speed, { x: this._x + this._horizontalSlideDistance, y: this._y + this._verticalSlideDistance, ease: this._ease,
                    onComplete: function () { _this.dispatchEvent(new components.SlidingMenuEvent(components.SlidingMenuEvent.CLOSE_COMPLETE)); },
                    onCompelteScope: this
                });
                this._open = false;
            }
        };
        /**
         * Instantly close the menu
         */
        SlidingMenu.prototype.fastClose = function () {
            this._open = false;
            this.x = this._x + this._horizontalSlideDistance;
            this.y = this._y + this._verticalSlideDistance;
            this.dispatchEvent(new components.SlidingMenuEvent(components.SlidingMenuEvent.CLOSE_COMPLETE));
        };
        /**
         * Instantly close the menu
         */
        SlidingMenu.prototype.fastOpen = function () {
            this._open = true;
            this.x = this._x;
            this.y = this._y;
            this.dispatchEvent(new components.SlidingMenuEvent(components.SlidingMenuEvent.OPEN_COMPLETE));
        };
        /**
         * Set a custom mask for the menu
         *
         * @param {rendering.Graphics} mask Graphics to use for the mask
         */
        SlidingMenu.prototype.setCustomMask = function (mask) {
            this._maskClip = mask;
            this.mask = this._maskClip;
        };
        Object.defineProperty(SlidingMenu.prototype, "isOpen", {
            /**
             * Whether or not the menu is open
             *
             * @readonly
             * @type {boolean}
             */
            get: function () {
                return this._open;
            },
            enumerable: true,
            configurable: true
        });
        return SlidingMenu;
    })(rendering.DisplayObjectContainer);
    components.SlidingMenu = SlidingMenu;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * Events for the SlidingMenu
     *
     * @export
     * @class SlidingMenuEvent
     * @extends {borgevent.Event}
     */
    var SlidingMenuEvent = (function (_super) {
        __extends(SlidingMenuEvent, _super);
        function SlidingMenuEvent() {
            _super.apply(this, arguments);
        }
        /**
         * Dispatched when the Sliding Menu has finished opening
         *
         * @static
         * @type {string}
         */
        SlidingMenuEvent.OPEN_COMPLETE = "SlidingMenuEvent_OPEN_COMPLETE";
        /**
         * Dispatched when the Sliding Menu has finished closing
         *
         * @static
         * @type {string}
         */
        SlidingMenuEvent.CLOSE_COMPLETE = "SlidingMenuEvent_CLOSE_COMPLETE";
        return SlidingMenuEvent;
    })(borgevent.Event);
    components.SlidingMenuEvent = SlidingMenuEvent;
})(components || (components = {}));
var components;
(function (components) {
    /**
     * @class SpriteSheet
     *
     * @description The spritesheet class takes a json asset and image asset and builds a set of Frame's to be used with DisplayObject's
     */
    var SpriteSheet = (function () {
        /**
         * Creates a new SpriteSheet object
         *
         * @param jsonAsset json data asset
         * @param imageAsset image asset
         */
        function SpriteSheet(jsonAsset, imageAsset) {
            this._frames = [];
            this._frameNames = [];
            var ob;
            if (typeof jsonAsset.data == "string") {
                ob = JSON.parse(jsonAsset.data);
            }
            else {
                ob = jsonAsset.data;
            }
            if (ob) {
                var frames = ob.frames;
                for (var key in frames) {
                    var frameOb = frames[key];
                    var frame = new assets.Frame(imageAsset, frameOb.frame.x, frameOb.frame.y, frameOb.frame.w, frameOb.frame.h, frameOb.pivot.x, frameOb.pivot.y);
                    this._frameNames.push(frameOb.filename ? frameOb.filename : key);
                    this._frames.push(frame);
                }
            }
        }
        /**
         * Convert json to scaled variant, useful for conversions
         *
         * @param jsonAsset Asset to convert
         * @param scale Amount to scale the frame values by
         */
        SpriteSheet.convertToOutput = function (jsonAsset, scale) {
            var ob;
            var math = new util.MathUtil();
            if (typeof jsonAsset.data == "string") {
                ob = JSON.parse(jsonAsset.data);
            }
            else {
                ob = jsonAsset.data;
            }
            if (ob) {
                var frames = ob.frames;
                for (var key in frames) {
                    var frameOb = frames[key];
                    frameOb.frame.x = math.round(frameOb.frame.x * scale, 0);
                    frameOb.frame.y = math.round(frameOb.frame.y * scale, 0);
                    frameOb.frame.w = math.round(frameOb.frame.w * scale, 0);
                    frameOb.frame.h = math.round(frameOb.frame.h * scale, 0);
                    frameOb.pivot.x = math.round(frameOb.pivot.x * scale, 0);
                    frameOb.pivot.y = math.round(frameOb.pivot.y * scale, 0);
                }
            }
            return JSON.stringify(ob);
        };
        /**
         * Return's the Frame's generated from the json/image, a scale can be specified to handle multiple resolutions with a single json file
         * @param scale Optional scales the Frames x/y/width/height values for smaller images
         */
        SpriteSheet.prototype.getFrames = function (scale) {
            if (scale === void 0) { scale = 1; }
            var modifiedFrames = [];
            for (var i = 0; i < this._frames.length; i++) {
                var frame = new assets.Frame(this._frames[i].imageAsset, this._frames[i].x * scale, this._frames[i].y * scale, this._frames[i].width * scale, this._frames[i].height * scale, this._frames[i].pivotX * scale, this._frames[i].pivotY * scale);
                if (frame.x + frame.width > frame.imageAsset.data.width) {
                    frame.width = frame.imageAsset.data.width - frame.x;
                }
                if (frame.y + frame.height > frame.imageAsset.data.height) {
                    frame.height = frame.imageAsset.data.height - frame.y;
                }
                modifiedFrames.push(frame);
            }
            return modifiedFrames;
        };
        /**
         * Gets a frame using the filename from the json, both the name and filename are reduced to lowercase
         * @param name The filename from the json
         * @param scale Optional scales the Frames x/y/width/height values for smaller images
         */
        SpriteSheet.prototype.getFrameByName = function (name, scale) {
            if (scale === void 0) { scale = 1; }
            for (var i = 0; i < this._frameNames.length; i++) {
                if (this._frameNames[i].toLowerCase() == name.toLowerCase()) {
                    var frame = new assets.Frame(this._frames[i].imageAsset, this._frames[i].x * scale, this._frames[i].y * scale, this._frames[i].width * scale, this._frames[i].height * scale, this._frames[i].pivotX * scale, this._frames[i].pivotY * scale);
                    return frame;
                }
            }
            throw "Error - frame " + name + " not found in spritesheet";
            return null;
        };
        return SpriteSheet;
    })();
    components.SpriteSheet = SpriteSheet;
})(components || (components = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class Command
     *
     * @description Commands are short lived logic that execute and then dispose of themselves. Commands should never retain data, listen for events or callbacks.
     *
     * A command can be linked to an event via the Context and every time the specified event is dispatched context wide the command is executed.
     */
    var Command = (function () {
        function Command() {
        }
        /**
         * Sets the event that tirggered the command
         */
        Command.prototype.setEvent = function (event) {
            this.event = event;
        };
        /**
         * Performs all the logic of the command.
         */
        Command.prototype.execute = function () {
            //Stub for real Commands
        };
        return Command;
    })();
    dragonwings.Command = Command;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class CommandMap
     *
     * @description Commands are short lived logic that execute and then dispose of themselves. Commands should never retain data, listen for events or callbacks.
     *
     * A command can be linked to an event with the command map and every time the specified event is dispatched context wide the command is executed.
     */
    var CommandMap = (function () {
        /**
         * Creates a new CommandMap object
         */
        function CommandMap(context) {
            this.context = context;
            this._commandClasses = [];
            this._eventTypes = [];
        }
        /**
         * Links a command to an event type, the command is then executed whenever the event is triggered context wide
         * @param commandClass The command to linked
         * @param eventType The event to link
         */
        CommandMap.prototype.mapCommand = function (commandClass, eventType) {
            this._commandClasses.push(commandClass);
            this._eventTypes.push(eventType);
            return this;
        };
        /**
         * Setup after injection
         */
        CommandMap.prototype.postInject = function () {
            //console.log("--Adding Command Event Listeners");
            this.listenForEvents(this.context.eventDispatcher);
            var parent = this.context.parent;
            //console.log("--Adding Parent Command Event Listeners");
            while (parent != null) {
                this.listenForEvents(parent.eventDispatcher);
                parent = parent.parent;
            }
            //console.log("--Adding Child Command Event Listeners");
            for (var i = 0; i < this.context.children.length; i++) {
                this.listenForEvents(this.context.children[i].eventDispatcher);
            }
        };
        /**
         * Gets all the commands for given event
         * @param event the event to get commands for
         */
        CommandMap.prototype.getCommands = function (event) {
            var commands = [];
            for (var i = 0; i < this._eventTypes.length; i++) {
                if (this._eventTypes[i] == event.eventName) {
                    var commandInstance = new this._commandClasses[i]();
                    if (commandInstance != null) {
                        commandInstance.setEvent(event);
                        commands.push(commandInstance);
                    }
                }
            }
            return commands;
        };
        /**
         * Get's all the event types
         */
        CommandMap.prototype.getAllEventTypes = function () {
            var uniqueEvents = [];
            for (var i = 0; i < this._eventTypes.length; i++) {
                if (uniqueEvents.indexOf(this._eventTypes[i]) < 0) {
                    uniqueEvents.push(this._eventTypes[i]);
                }
            }
            return uniqueEvents;
        };
        /**
         * Add's a listener for all the registered events
         * @param eventDispatcher The event dispatcher to use for listening
         */
        CommandMap.prototype.listenForEvents = function (eventDispatcher) {
            var events = this.getAllEventTypes();
            for (var i = 0; i < events.length; i++) {
                //console.log("----Listening for event: " + events[i]);
                eventDispatcher.addEventListener(events[i], this.onEventReceived, this);
            }
        };
        /**
         * Executes commands for the given event
         * @param event The event to find commands for
         */
        CommandMap.prototype.onEventReceived = function (event) {
            //console.log("--Received event: " + event.eventName);
            var commands = this.getCommands(event);
            for (var i = 0; i < commands.length; i++) {
                //console.log("----Executing Command for event");
                commands[i].eventDispatcher = this.context.eventDispatcher;
                commands[i].contextView = this.context.getContextView();
                this.context.injector.injectInto(commands[i], false);
                commands[i].execute();
            }
            /*if (this.context.parent != null) {
                this.context.parent.commandMap.onEventReceived(event);
            }*/
        };
        return CommandMap;
    })();
    dragonwings.CommandMap = CommandMap;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var interfaces;
    (function (interfaces) {
        /**
         * @class ICommandMapAbstract
         *
         * @description Commands are short lived logic that execute and then dispose of themselves. Commands should never retain data, listen for events or callbacks.
         *
         * A command can be linked to an event with the command map and every time the specified event is dispatched context wide the command is executed.
         */
        var ICommandMapAbstract = (function () {
            function ICommandMapAbstract() {
            }
            /**
             * Links a command to an event type, the command is then executed whenever the event is triggered context wide
             * @param commandClass The command to linked
             * @param eventType The event to link
             */
            ICommandMapAbstract.prototype.mapCommand = function (commandClass, eventType) { return this; };
            /**
             * Executes commands for the given event
             * @param event The event to find commands for
             */
            ICommandMapAbstract.prototype.onEventReceived = function (event) { };
            return ICommandMapAbstract;
        })();
        interfaces.ICommandMapAbstract = ICommandMapAbstract;
    })(interfaces = dragonwings.interfaces || (dragonwings.interfaces = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class Context
     *
     * @description The context is the centralised class for configuring an application. Views, commands and mediators can be mapped here.
     */
    var Context = (function () {
        /**
         * Creates new Context object
         */
        function Context(injector) {
            if (injector === void 0) { injector = null; }
            if (!injector) {
                this.injector = new dragonwings.DI();
            }
            else {
                this.injector = injector;
            }
            this.children = [];
            this.eventDispatcher = new dragonwings.EventDispatcher();
            this.commandMap = new dragonwings.CommandMap(this);
            this.mediatorMap = new dragonwings.MediatorMap(this.injector, this.eventDispatcher, this);
            this.viewMap = new dragonwings.ViewMap(this.injector);
            this._started = false;
        }
        Context.prototype.describe = function () {
        };
        /**
         * Gets the contex view
         */
        Context.prototype.getContextView = function () {
            return this._contextView;
        };
        /**
         * Begins the bootstrapping process and dependency injection
         */
        Context.prototype.startup = function () {
            if (this._started)
                return;
            console.log("Beginning Startup of Context");
            this.startInjectionStack();
            console.log("Startup process complete beginning child context startup process: ");
            console.log("");
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].startup();
            }
            this._started = true;
            if (this.parent == null) {
                console.log("All Startups Complete, dispatching STARTUP_COMPLETE");
                this.eventDispatcher.dispatchEvent(new dragonwings.ContextEvent(dragonwings.ContextEvent.STARTUP_COMPLETE));
            }
        };
        /**
         * Adds a child context for complex applications
         * @param child The conext that becomes a child of this one
         */
        Context.prototype.addChildContext = function (child) {
            this.children.push(child);
            child.parent = this;
            child.injector.parent = this.injector;
            return this;
        };
        /*
         * Map a model class/interface to a concrete singleton class
         * @param classType The type to mapModel
         * @param toClass The concrete type
         */
        Context.prototype.mapModel = function (classType, toClass) {
            this.injector.mapSingletonOf(classType, toClass);
            return this;
        };
        /*
         * Setting the context view begins the instantiation of the view stack via dependency injection
         * This in turn instantiates all mapped models in views
         * Behaviours then need to be instantiated seperately
         */
        Context.prototype.startInjectionStack = function () {
            if (this._contextView != null) {
                console.log("Beginning Injection of Core Classes");
                //Map Event Dispatcher
                this.injector.mapSingletonTo(dragonwings.interfaces.IEventDispatcherAbstract, this.eventDispatcher);
                this.injector.mapSingletonTo('IEventDispatcher', this.eventDispatcher);
                if (this.parent == null || this.parent == undefined) {
                    this.injector.mapSingletonTo(dragonwings.interfaces.IContextViewStageAbstract, this._contextView);
                }
                this.injector.mapSingletonTo(dragonwings.interfaces.IContextAbstract, this);
                this.injector.mapSingletonTo('IContext', this);
                this.injector.mapSingletonTo(dragonwings.interfaces.IContextViewAbstract, this._contextView);
                this.injector.mapSingletonTo('IContextView', this._contextView);
                this.injector.injectInto(this._contextView, false);
                this.injector.mapSingletonTo(dragonwings.interfaces.IMediatorMapAbstract, this.mediatorMap);
                this.injector.mapSingletonTo('IMediatorMap', this.mediatorMap);
                this.injector.injectInto(this.mediatorMap, false);
                this.injector.mapSingletonTo(dragonwings.interfaces.ICommandMapAbstract, this.commandMap);
                this.injector.mapSingletonTo('ICommandMap', this.commandMap);
                this.injector.injectInto(this.commandMap, false);
                this.injector.mapSingletonTo(dragonwings.interfaces.IViewAbstract, this.viewMap);
                this.injector.mapSingletonTo('IView', this.viewMap);
                this.injector.injectInto(this.viewMap, false);
            }
        };
        Object.defineProperty(Context.prototype, "contextView", {
            /**
             * The root view of the context
             */
            get: function () {
                return this._contextView;
            },
            /**
             * The root view of the context
             */
            set: function (value) {
                this._contextView = value;
                if (this._started) {
                    this.startInjectionStack();
                }
            },
            enumerable: true,
            configurable: true
        });
        return Context;
    })();
    dragonwings.Context = Context;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var interfaces;
    (function (interfaces) {
        /**
         * @class IContextAbstract
         *
         * @description The context is the centralised class for configuring an application. Views, commands and mediators can be mapped here.
         */
        var IContextAbstract = (function () {
            function IContextAbstract() {
            }
            /**
             * Gets the contex view
             */
            IContextAbstract.prototype.getContextView = function () {
                return null;
            };
            return IContextAbstract;
        })();
        interfaces.IContextAbstract = IContextAbstract;
    })(interfaces = dragonwings.interfaces || (dragonwings.interfaces = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var interfaces;
    (function (interfaces) {
        /**
         * @class IContextViewAbstract
         *
         * @description Inteface for the root view of the context that can be implemented by the user
         *
         * This class is automatically injected and available via depenedncy injection
         */
        var IContextViewAbstract = (function () {
            function IContextViewAbstract() {
            }
            /**
             * Remove a child from the view
             */
            IContextViewAbstract.prototype.removeChild = function (value) { };
            /**
             * Add a child to the view
             */
            IContextViewAbstract.prototype.addChild = function (value) { };
            /**
             * Called after injection
             */
            IContextViewAbstract.prototype.postInject = function () { };
            /**
             * Gets the width of the view
             */
            IContextViewAbstract.prototype.getWidth = function () { return 0; };
            /**
             * Gets the height of the view
             */
            IContextViewAbstract.prototype.getHeigth = function () { return 0; };
            return IContextViewAbstract;
        })();
        interfaces.IContextViewAbstract = IContextViewAbstract;
        /**
         * @class IContextViewAbstract
         *
         * @description Inteface for the root view of the context that can be implemented by the user
         *
         * This class is automatically injected and available via depenedncy injection
         */
        var IContextViewStageAbstract = (function () {
            function IContextViewStageAbstract() {
            }
            /**
             * Remove a child from the view
             */
            IContextViewStageAbstract.prototype.removeChild = function (value) { };
            /**
             * Add a child to the view
             */
            IContextViewStageAbstract.prototype.addChild = function (value) { };
            /**
             * Called after injection
             */
            IContextViewStageAbstract.prototype.postInject = function () { };
            /**
             * Gets the width of the view
             */
            IContextViewStageAbstract.prototype.getWidth = function () { return 0; };
            /**
             * Gets the height of the view
             */
            IContextViewStageAbstract.prototype.getHeigth = function () { return 0; };
            return IContextViewStageAbstract;
        })();
        interfaces.IContextViewStageAbstract = IContextViewStageAbstract;
    })(interfaces = dragonwings.interfaces || (dragonwings.interfaces = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class Event
     *
     * @description Default implementation of the event class
     */
    var Event = (function () {
        /**
         * Creates a new Event object
         * @param eventName Type of event
         */
        function Event(eventName) {
            this.eventName = eventName;
        }
        return Event;
    })();
    dragonwings.Event = Event;
})(dragonwings || (dragonwings = {}));
/// <reference path="Event.ts" />
var dragonwings;
(function (dragonwings) {
    /**
     * @class ContextEvent
     *
     * @description Context events are dispatched by the framework automatically
     */
    var ContextEvent = (function (_super) {
        __extends(ContextEvent, _super);
        function ContextEvent() {
            _super.apply(this, arguments);
        }
        /**
         * Dispatched after startup() has finished on a context
         */
        ContextEvent.STARTUP_COMPLETE = "ContextEvent_STARTUP_COMPLETE";
        return ContextEvent;
    })(dragonwings.Event);
    dragonwings.ContextEvent = ContextEvent;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class EventDispatcher
     *
     * @description Implementation of an event dispatcher. Event dispatchers are used for dispatching events throughout the application.
     */
    var EventDispatcher = (function () {
        /**
         * Creates a new EventDispatcher object
         */
        function EventDispatcher() {
            this._eventNames = [];
            this._listeners = [];
            this._listenerContexts = [];
        }
        /**
         * Dispatches an event into the event flow.
         * @param event The event object dispatched into the event flow.
         */
        EventDispatcher.prototype.dispatchEvent = function (e) {
            var index = this._eventNames.indexOf(e.eventName);
            if (index > -1) {
                var listeners = this._listeners[index].concat();
                var contexts = this._listenerContexts[index].concat();
                for (var i = 0; i < listeners.length; i++) {
                    listeners[i].apply(contexts[i], [e]);
                }
            }
        };
        /**
         * Registers an event listener object with an EventDispatcher object so that the listener receives notification of an event.
         * @param eventName The type of event.
         * @param listener The listener function that processes the event.
         * @param listenerContext The object context in which the listener function is executed. The object given will become "this" in the body of the listener function.
         */
        EventDispatcher.prototype.addEventListener = function (eventName, listener, listenerContext) {
            if (this._eventNames.indexOf(eventName) < 0) {
                this._eventNames.push(eventName);
                this._listeners.push([]);
                this._listenerContexts.push([]);
            }
            var index = this._eventNames.indexOf(eventName);
            this._listeners[index].push(listener);
            this._listenerContexts[index].push(listenerContext);
        };
        /**
         * Removes a listener from the EventDispatcher object.
         * @param eventName The type of event.
         * @param listener The listener function to remove.
         * @param listenerContext The object context of the listener function.
         */
        EventDispatcher.prototype.removeEventListener = function (eventName, listener, listenerContext) {
            var index = this._eventNames.indexOf(eventName);
            if (index > -1) {
                this._listeners[index].splice(this._listeners[index].indexOf(listener), 1);
                this._listenerContexts[index].splice(this._listenerContexts[index].indexOf(listenerContext), 1);
            }
        };
        return EventDispatcher;
    })();
    dragonwings.EventDispatcher = EventDispatcher;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var interfaces;
    (function (interfaces) {
        /**
         * @class IEventDispatcherAbstract
         *
         * @description Implementation of an event dispatcher. Event dispatchers are used for dispatching events throughout the application.
         */
        var IEventDispatcherAbstract = (function () {
            function IEventDispatcherAbstract() {
            }
            /**
             * Dispatches an event into the event flow.
             * @param event The event object dispatched into the event flow.
             */
            IEventDispatcherAbstract.prototype.dispatchEvent = function (event) { };
            /**
             * Registers an event listener object with an EventDispatcher object so that the listener receives notification of an event.
             * @param eventName The type of event.
             * @param listener The listener function that processes the event.
             * @param listenerContext The object context in which the listener function is executed. The object given will become "this" in the body of the listener function.
             */
            IEventDispatcherAbstract.prototype.addEventListener = function (eventName, listener, listenerContext) { };
            /**
             * Removes a listener from the EventDispatcher object.
             * @param eventName The type of event.
             * @param listener The listener function to remove.
             * @param listenerContext The object context of the listener function.
             */
            IEventDispatcherAbstract.prototype.removeEventListener = function (eventName, listener, listenerContext) { };
            return IEventDispatcherAbstract;
        })();
        interfaces.IEventDispatcherAbstract = IEventDispatcherAbstract;
    })(interfaces = dragonwings.interfaces || (dragonwings.interfaces = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class DI
     *
     * @description Dependency Injector that can map singletons and classes
     */
    var DI = (function () {
        function DI() {
            //Crude dependency injection making the best of JS's piss poor reflection
            /**
             * List of mappings for singletons
             */
            this.singletonMap = [];
            /**
             * List of mappings for classes
             */
            this.classMap = [];
            /**
             * List of objects depenedncy injection has already been performed on
             */
            this.postInjectComplete = [];
            /**
             * Dispatched when a class has been instantiated
             */
            this.onInstatiate = new dragonwings.signal.Signal();
        }
        /**
         * Maps one class type or initerface to an instanced object
         * @param classType The class type to map
         * @param instance The instance of the class to map
         */
        DI.prototype.mapValue = function (classType, instance) {
            var mapping = new dragonwings.DIMapping(classType, classType);
            mapping.instance = instance;
            this.singletonMap.push(mapping);
        };
        /**
         * Maps a class as a singleton so only one instance is ever returned when requested
         * @param classType The class type to map
         */
        DI.prototype.mapSingleton = function (classType) {
            this.singletonMap.push(new dragonwings.DIMapping(classType, classType));
        };
        /**
         * Maps a class as a signleton so only a specific instance is ever returned when requested
         * @param classType The class type to map
         * @param toClass The instance type to give when requested
         */
        DI.prototype.mapSingletonOf = function (classType, toClass) {
            this.singletonMap.push(new dragonwings.DIMapping(classType, toClass));
        };
        /**
         * Maps a class as singleton to the specified instance
         * @param classType The class type to map
         * @param instance The instance to give when requested
         */
        DI.prototype.mapSingletonTo = function (classType, instance) {
            var diMapping = new dragonwings.DIMapping(classType, classType);
            diMapping.instance = instance;
            this.singletonMap.push(diMapping);
        };
        /**
         * Maps one class type or initerface to a specific class tyep
         * @param classType The class type to map
         * @param toClass The instance type to give when requested
         */
        DI.prototype.mapClass = function (classType, toClass) {
            this.classMap.push(new dragonwings.DIMapping(classType, toClass));
        };
        /**
         * Cretaes a new DI object
         */
        DI.prototype.createChild = function () {
            return new DI();
        };
        /**
         * Creates a new class
         * @param classType The type to instantiate
         */
        DI.prototype.instantiate = function (classType, properties) {
            //console.log("instantiating: " + classType);
            var instance;
            if (properties) {
                instance = new (classType.bind.apply(classType, [null].concat(properties)));
            }
            else {
                instance = new classType();
            }
            this.injectInto(instance);
            this.onInstatiate.dispatch(instance);
            return instance;
        };
        /**
         * Performs depenedncy injection on an object
         * @param instance The object to inject
         * @param isParent Is false post inject callback is avoided
         */
        DI.prototype.injectInto = function (instance, isParent) {
            //console.log("Injecting into: " + instance);
            if (isParent === void 0) { isParent = false; }
            //console.log("InjectInto: " + instance);
            if (instance instanceof Object == false) {
                return;
            }
            var keys = Object.keys(instance);
            for (var i = 0; i < keys.length; i++) {
                var propertyName = keys[i];
                if (instance[propertyName] instanceof dragonwings.InjectProp) {
                    var injectProp = instance[propertyName];
                    //console.log("--Injecting property: " + injectProp.property + " with class type " + injectProp.classType);
                    var newValue = this.resolveClass(injectProp.classType, injectProp);
                    if (newValue != null) {
                        //instance[injectProp.property] = newValue;
                        instance[propertyName] = newValue;
                    }
                }
            }
            //If not defined in our scope, fill it from parents scope
            var parent = this.parent;
            var parentStack = [];
            while (parent != null) {
                //console.log("parent found");
                parentStack.push(parent);
                parent = parent.parent;
            }
            while (parentStack.length > 0) {
                parentStack[parentStack.length - 1].injectInto(instance, true);
                parentStack.pop();
            }
            if (!isParent) {
                //console.log("Doing post inject for:");
                //console.log(instance);
                if (instance.postInject != null && instance.postInject != undefined) {
                    if (this.postInjectComplete.indexOf(instance) == -1) {
                        this.postInjectComplete.push(instance);
                        instance.postInject();
                    }
                }
            }
        };
        /**
         * Finds the singleton mapping or class mapping for the class type and creates a new instance of it
         * @param classType The class type to look for mappings
         */
        DI.prototype.resolveClass = function (classType, injectProp) {
            var singletonMapping = this.getMapping(classType, this.singletonMap);
            if (singletonMapping != null) {
                //console.log("Found singleton: " + singletonMapping.mappedClassType + " for class type: " + singletonMapping.classType);
                if (singletonMapping.instance == null) {
                    singletonMapping.instance = this.instantiate(singletonMapping.mappedClassType, injectProp.properties);
                }
                return singletonMapping.instance;
            }
            var classMapping = this.getMapping(classType, this.classMap);
            if (classMapping != null) {
                //console.log("Found mapped class: " + classMapping.mappedClassType + " for class type: " + classMapping.classType);
                return this.instantiate(classMapping.mappedClassType, injectProp.properties);
            }
            return null;
        };
        /**
         * Looks for the mapping for the given class type
         * @param classTypes The class to look for mappings
         * @param map List of mappings
         */
        DI.prototype.getMapping = function (classType, map) {
            for (var j = 0; j < map.length; j++) {
                if (map[j].classType == classType) {
                    return map[j];
                }
            }
        };
        return DI;
    })();
    dragonwings.DI = DI;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class DIMapping
     *
     * @description Mapping for dependency injection, lists the class and what type and the created instance
     */
    var DIMapping = (function () {
        /**
         * Creates a new DIMapping object
         * @param classType Type to map
         * @param  mappedClassType Type to map to
         */
        function DIMapping(classType, mappedClassType) {
            this.mappedClassType = mappedClassType;
            this.classType = classType;
        }
        return DIMapping;
    })();
    dragonwings.DIMapping = DIMapping;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class InjectProp
     *
     * @description Injection properties are used to inject instances within other classes. When the injector finds any variables set as an injection property on an object it finds the corresponding mapping for it's class and replaces the variable with the correct object.
     */
    var InjectProp = (function () {
        //public property: any;
        /**
         * Creates a new InjectProp object
         */
        function InjectProp(classType) {
            //this.property = property;
            this.classType = classType;
            this.properties = null;
        }
        /**
         * Parameters to pass to the constructor
         */
        InjectProp.prototype.withProperties = function (properties) {
            this.properties = properties;
            return this;
        };
        /**
         * Can be called to return this object as 'any' type. This allows it to be assigned to any variable.
         */
        InjectProp.prototype.inject = function () {
            return this;
        };
        return InjectProp;
    })();
    dragonwings.InjectProp = InjectProp;
})(dragonwings || (dragonwings = {}));
/**
 * Decorates a Class with a PropertyInjection point.
 *
 * <pre>
 *     class MyActor {
 *       @inject('firstName')
 *       name : String;
 *     }
 * </pre>
 *
 * @decorator
 * @param {string} injectionKey
 * @returns {function(Object, string): void}
 */
function inject(injectionKey, params) {
    if (params === void 0) { params = null; }
    // Our decorator provides a factory function which will be invoked with an
    // instance of the decorated Class and the name of the decorated property.
    return function recordInjection(target, decoratedPropertyName) {
        // Get a reference to the Class of the target object which has been
        // decorated.
        var targetType = target.constructor;
        if (!targetType.hasOwnProperty('__inject__')) {
            targetType.__inject__ = {};
        }
        if (!targetType.hasOwnProperty('__injectProps__')) {
            targetType.__injectProps__ = {};
        }
        // Associate this property with the injectionKey provided in the
        // decorator call
        targetType.__inject__[decoratedPropertyName] = injectionKey;
        targetType.__injectProps__[decoratedPropertyName] = params;
    };
}
var dragonwings;
(function (dragonwings) {
    var MetaInjector = (function () {
        function MetaInjector() {
            //Crude dependency injection making the best of JS's piss poor reflection
            /**
             * List of mappings for singletons
             */
            this.singletonMap = [];
            /**
             * List of mappings for classes
             */
            this.classMap = [];
            /**
             * List of objects depenedncy injection has already been performed on
             */
            this.postInjectComplete = [];
            /**
             * Dispatched when a class has been instantiated
             */
            this.onInstatiate = new dragonwings.signal.Signal();
        }
        /**
         * Maps one class type or initerface to an instanced object
         * @param classType The class type to map
         * @param instance The instance of the class to map
         */
        MetaInjector.prototype.mapValue = function (classType, instance) {
            var mapping = new dragonwings.DIMapping(classType, classType);
            mapping.instance = instance;
            this.singletonMap.push(mapping);
        };
        /**
         * Maps a class as a singleton so only one instance is ever returned when requested
         * @param classType The class type to map
         */
        MetaInjector.prototype.mapSingleton = function (classType) {
            this.singletonMap.push(new dragonwings.DIMapping(classType, classType));
        };
        /**
         * Maps a class as a signleton so only a specific instance is ever returned when requested
         * @param classType The class type to map
         * @param toClass The instance type to give when requested
         */
        MetaInjector.prototype.mapSingletonOf = function (classType, toClass) {
            this.singletonMap.push(new dragonwings.DIMapping(classType, toClass));
        };
        /**
         * Maps a class as singleton to the specified instance
         * @param classType The class type to map
         * @param instance The instance to give when requested
         */
        MetaInjector.prototype.mapSingletonTo = function (classType, instance) {
            var diMapping = new dragonwings.DIMapping(classType, null);
            diMapping.instance = instance;
            this.singletonMap.push(diMapping);
        };
        /**
         * Maps one class type or initerface to a specific class tyep
         * @param classType The class type to map
         * @param toClass The instance type to give when requested
         */
        MetaInjector.prototype.mapClass = function (classType, toClass) {
            this.classMap.push(new dragonwings.DIMapping(classType, toClass));
        };
        /**
         * Cretaes a new DI object
         */
        MetaInjector.prototype.createChild = function () {
            return new MetaInjector();
        };
        /**
         * Performs depenedncy injection on an object
         * @param instance The object to inject
         * @param isParent Is false post inject callback is avoided
         */
        MetaInjector.prototype.injectInto = function (instance, isParent) {
            if (isParent === void 0) { isParent = false; }
            // Loop through all properties decorated with `@inject()` in this Class and
            // try to satisfy them if there is a mapped value.
            for (var _i = 0, _a = this.getInjectionPoints(instance); _i < _a.length; _i++) {
                var injectionPoint = _a[_i];
                var injectProps = this.getInjectionProps(instance);
                var params = null;
                for (var i = 0; i < injectProps.length; i++) {
                    if (injectProps[i].propertyName == injectionPoint.propertyName) {
                        params = injectProps[i].propertyParams;
                    }
                }
                var injectionValue = this.resolveClass(injectionPoint.injectionKey, params); //this.valuesByInjectionKey[injectionPoint.injectionKey];
                // Perform the injection if we have a value assigned to this injectionKey.
                if (injectionValue && !instance[injectionPoint.propertyName]) {
                    instance[injectionPoint.propertyName] = injectionValue;
                }
            }
            //If not defined in our scope, fill it from parents scope
            var parent = this.parent;
            var parentStack = [];
            while (parent != null) {
                //console.log("parent found");
                parentStack.push(parent);
                parent = parent.parent;
            }
            while (parentStack.length > 0) {
                parentStack[parentStack.length - 1].injectInto(instance, true);
                parentStack.pop();
            }
            if (!isParent) {
                if (instance.postInject != null && instance.postInject != undefined) {
                    if (this.postInjectComplete.indexOf(instance) == -1) {
                        this.postInjectComplete.push(instance);
                        instance.postInject();
                    }
                }
            }
        };
        /**
         * Finds the singleton mapping or class mapping for the class type and creates a new instance of it
         * @param classType The class type to look for mappings
         */
        MetaInjector.prototype.resolveClass = function (classType, properties) {
            var singletonMapping = this.getMapping(classType, this.singletonMap);
            if (singletonMapping != null) {
                //console.log("Found singleton: " + singletonMapping.mappedClassType + " for class type: " + singletonMapping.classType);
                if (singletonMapping.instance == null) {
                    singletonMapping.instance = this.instantiate(singletonMapping.mappedClassType, properties);
                }
                return singletonMapping.instance;
            }
            var classMapping = this.getMapping(classType, this.classMap);
            if (classMapping != null) {
                //console.log("Found mapped class: " + classMapping.mappedClassType + " for class type: " + classMapping.classType);
                return this.instantiate(classMapping.mappedClassType, properties);
            }
            return null;
        };
        MetaInjector.prototype.getInjectionPoints = function (Class) {
            var result = [];
            var parent = Class;
            if (Class.constructor.hasOwnProperty("__inject__")) {
                result = Object.keys(Class.constructor["__inject__"])
                    .map(function (propertyName) {
                    return {
                        propertyName: propertyName,
                        injectionKey: Class.constructor["__inject__"][propertyName],
                    };
                });
            }
            return result;
        };
        MetaInjector.prototype.getInjectionProps = function (Class) {
            var result = [];
            var parent = Class;
            if (Class.constructor.hasOwnProperty("__injectProps__")) {
                result = Object.keys(Class.constructor["__injectProps__"])
                    .map(function (propertyName) {
                    return {
                        propertyName: propertyName,
                        propertyParams: Class.constructor["__injectProps__"][propertyName],
                    };
                });
            }
            return result;
        };
        /**
         * Creates a new class
         * @param classType The type to instantiate
         * @param properties Option properties to pass to the constructor
         */
        MetaInjector.prototype.instantiate = function (classType, properties) {
            // Start by creating a new instance of the target Class
            var instance;
            if (properties) {
                instance = new (classType.bind.apply(classType, [null].concat(properties)));
            }
            else {
                if (classType) {
                    instance = new classType();
                }
            }
            this.injectInto(instance);
            this.onInstatiate.dispatch(instance);
            return instance;
        };
        /**
         * Looks for the mapping for the given class type
         * @param classTypes The class to look for mappings
         * @param map List of mappings
         */
        MetaInjector.prototype.getMapping = function (classType, map) {
            for (var j = 0; j < map.length; j++) {
                if (map[j].classType == classType) {
                    return map[j];
                }
            }
        };
        return MetaInjector;
    })();
    dragonwings.MetaInjector = MetaInjector;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var interfaces;
    (function (interfaces) {
        /**
         * @class IMediatorMapAbstract
         *
         * @description The mediator map handles linking views to mediators and creates a new instance of the mediator when the view is added to the display. It also removes the mediator when the view is removed from the display.
         */
        var IMediatorMapAbstract = (function () {
            function IMediatorMapAbstract() {
            }
            /**
             * Links a mediator class to a concrete view class
             *
             * @param mediatorClass The mediator type to use
             * @param viewClass The view class that should be mediated
             */
            IMediatorMapAbstract.prototype.mapMediator = function (mediatorClass, viewClass) { return this; };
            return IMediatorMapAbstract;
        })();
        interfaces.IMediatorMapAbstract = IMediatorMapAbstract;
    })(interfaces = dragonwings.interfaces || (dragonwings.interfaces = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class Mediator
     *
     * @description Mediators are responsible for providing application specific logic to views. They can listen for local events from the view, perform logic and dispatch context wide events. They can also listen for context wide events and perform work on the view in response.
     */
    var Mediator = (function () {
        function Mediator() {
        }
        /**
         * Called when the view is added to the display, the best point for setting up event listeners
         */
        Mediator.prototype.onAdded = function () {
        };
        /**
         * Called when the view is removed from the display, the best point for removing event listeners
         */
        Mediator.prototype.onRemove = function () {
        };
        /**
         * Sets the view to mediate
         *
         * @param view The view to set
         */
        Mediator.prototype.setViewComponent = function (view) {
            this._viewComponent = view;
        };
        /**
         * Gets the view being mediated
         */
        Mediator.prototype.getViewComponent = function () {
            return this._viewComponent;
        };
        /**
         * Shortcut for listening to context wide listeners
         *
         * @param eventName The type of event to listen for
         * @param listener The function to call
         */
        Mediator.prototype.addContextListener = function (eventName, listener) {
            this.eventDispatcher.addEventListener(eventName, listener, this);
            var parent = this.context.parent;
            while (parent != null) {
                parent.eventDispatcher.addEventListener(eventName, listener, this);
                parent = parent.parent;
            }
        };
        /**
         * Shortcut for listing to view events if they implement the IView interface
         *
         * @param eventName The type of event to listen for
         * @param listener The function to call
         */
        Mediator.prototype.addViewListener = function (eventName, listener) {
            this._viewComponent.viewEventDispatcher.addEventListener(eventName, listener, this);
        };
        /**
         * Shortcut for removing context wide listeners
         *
         * @param eventName The type of event to listen for
         * @param listener The function to call
         */
        Mediator.prototype.removeContextListener = function (eventName, listener) {
            this.eventDispatcher.removeEventListener(eventName, listener, this);
            var parent = this.context.parent;
            while (parent != null) {
                parent.eventDispatcher.removeEventListener(eventName, listener, this);
                parent = parent.parent;
            }
        };
        /**
         * Shortcut for removing view event listeners if they implement the IView interface
         *
         * @param eventName The type of event to listen for
         * @param listener The function to call
         */
        Mediator.prototype.removeViewListener = function (eventName, listener) {
            this._viewComponent.viewEventDispatcher.removeEventListener(eventName, listener, this);
        };
        /**
         * Dispatches a context wide event
         *
         * @param event The event to dispatch
         */
        Mediator.prototype.dispatchContextEvent = function (event) {
            this.eventDispatcher.dispatchEvent(event);
        };
        return Mediator;
    })();
    dragonwings.Mediator = Mediator;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class MediatorEvent
     *
     * @description The mediator map listens for mediator events to handle activating and deactivating mediators for views when they are added or removed from the display. These can be dispatched manually or implemented within a rendering framework.
     */
    var MediatorEvent = (function (_super) {
        __extends(MediatorEvent, _super);
        /**
         * Creates a new MediatorEvent object
         *
         * @param eventName The event type
         * @param view The view which has been added/removed
         */
        function MediatorEvent(eventName, view) {
            _super.call(this, eventName);
            this.view = view;
        }
        /**
         * Dispatch when a view is added to the display
         */
        MediatorEvent.ADDED_TO_STAGE = "MediatorEvent_ADDED_TO_STAGE";
        /**
         * Dispatch when a view is remvoed from the display
         */
        MediatorEvent.REMOVED_FROM_STAGE = "MediatorEvent_REMOVED_FROM_STAGE";
        return MediatorEvent;
    })(dragonwings.Event);
    dragonwings.MediatorEvent = MediatorEvent;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class MediatorMap
     *
     * @description The mediator map handles linking views to mediators and creates a new instance of the mediator when the view is added to the display. It also removes the mediator when the view is removed from the display.
     */
    var MediatorMap = (function () {
        /**
         * Creates a new MediatorMap object
         *
         * @param injector The contexts injector to use for injecting into mediators
         */
        function MediatorMap(injector, eventDispatcher, context) {
            this._injector = injector;
            this._eventDispatcher = eventDispatcher;
            this._context = context;
            this._viewClasses = [];
            this._mediatorClasses = [];
            this._activeMediators = [];
        }
        /**
         * Links a mediator class to a concrete view class
         *
         * @param mediatorClass The mediator type to use
         * @param viewClass The view class that should be mediated
         */
        MediatorMap.prototype.mapMediator = function (mediatorClass, viewClass) {
            this._mediatorClasses.push(mediatorClass);
            if (!viewClass.name) {
                var name = viewClass.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];
                this._viewClasses.push(name);
            }
            else {
                this._viewClasses.push(viewClass.name);
            }
            return this;
        };
        /**
         * Listens for events when injection has finished
         */
        MediatorMap.prototype.postInject = function () {
            this._eventDispatcher.addEventListener(dragonwings.MediatorEvent.ADDED_TO_STAGE, this.onAdded, this);
            this._eventDispatcher.addEventListener(dragonwings.MediatorEvent.REMOVED_FROM_STAGE, this.onRemoved, this);
        };
        /**
         * Creates and activates a mediator for the view if a mapping exists
         *
         * @param e Event that contains the view details
         */
        MediatorMap.prototype.onAdded = function (e) {
            var className = this.getClassName(e.view);
            for (var i = 0; i < this._viewClasses.length; i++) {
                if (className == this._viewClasses[i]) {
                    var mediator = new this._mediatorClasses[i]();
                    if (mediator != null) {
                        mediator.eventDispatcher = this._eventDispatcher;
                        mediator.context = this._context;
                        mediator.setViewComponent(e.view);
                        this._injector.injectInto(mediator, false);
                        mediator.onAdded();
                        this._activeMediators.push(mediator);
                    }
                }
            }
        };
        /**
         * Removes the active mediator for the view if any exist
         *
         * @param e Event that contains the view details
         */
        MediatorMap.prototype.onRemoved = function (e) {
            var toRemove = [];
            for (var i = 0; i < this._activeMediators.length; i++) {
                if (this._activeMediators[i].getViewComponent() == e.view) {
                    this._activeMediators[i].onRemove();
                    toRemove.push(this._activeMediators[i]);
                }
            }
            for (var j = 0; j < toRemove.length; j++) {
                var index = this._activeMediators.indexOf(toRemove[j]);
                this._activeMediators.splice(index, 1);
            }
        };
        /**
         * Get's an objects class name
         *
         * @param instance The object to get the class name for
         */
        MediatorMap.prototype.getClassName = function (instance) {
            var funcNameRegex = /function (.{1,})\(/;
            var constructorName = instance["constructor"].toString();
            var results = (funcNameRegex).exec(constructorName);
            if (!results) {
                constructorName = instance['__proto__']["constructor"].toString();
                results = (funcNameRegex).exec(constructorName);
            }
            return (results && results.length > 1) ? results[1] : "";
        };
        return MediatorMap;
    })();
    dragonwings.MediatorMap = MediatorMap;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var signal;
    (function (signal) {
        var Signal = (function () {
            function Signal() {
                this._shouldPropagate = true;
                this.active = true;
                this._bindings = [];
                this._prevParams = null;
            }
            Signal.prototype.add = function (listener, listenerContext, priority) {
                this.validateListener(listener, 'add');
                return this._registerListener(listener, false, listenerContext, priority);
            };
            Signal.prototype.addOnce = function (listener, listenerContext, priority) {
                this.validateListener(listener, 'addOnce');
                return this._registerListener(listener, true, listenerContext, priority);
            };
            Signal.prototype.dispatch = function () {
                var params = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    params[_i - 0] = arguments[_i];
                }
                if (!this.active) {
                    return;
                }
                var paramsArr = Array.prototype.slice.call(arguments);
                var n = this._bindings.length;
                var bindings;
                if (this.memorize) {
                    this._prevParams = paramsArr;
                }
                if (!n) {
                    //  Should come after memorize
                    return;
                }
                bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
                this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.
                //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
                //reverse loop since listeners with higher priority will be added at the end of the list
                do {
                    n--;
                } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
            };
            Signal.prototype.dispose = function () {
                this.removeAll();
                delete this._bindings;
                delete this._prevParams;
            };
            Signal.prototype.forget = function () {
                this._prevParams = null;
            };
            Signal.prototype.getNumListeners = function () {
                return this._bindings.length;
            };
            Signal.prototype.halt = function () {
                this._shouldPropagate = false;
            };
            Signal.prototype.has = function (listener, context) {
                return this._indexOfListener(listener, context) !== -1;
            };
            Signal.prototype.remove = function (listener, context) {
                this.validateListener(listener, 'remove');
                var i = this._indexOfListener(listener, context);
                if (i !== -1) {
                    this._bindings[i]._destroy(); //no reason to a Phaser.SignalBinding exist if it isn't attached to a signal
                    this._bindings.splice(i, 1);
                }
                return listener;
            };
            Signal.prototype.removeAll = function (context) {
                var n = this._bindings.length;
                while (n--) {
                    this._bindings[n]._destroy();
                }
                this._bindings.length = 0;
            };
            Signal.prototype.toString = function () {
                return '[Phaser.Signal active:' + this.active + ' numListeners:' + this.getNumListeners() + ']';
            };
            Signal.prototype.validateListener = function (listener, fnName) {
                if (typeof listener !== 'function') {
                    throw new Error('listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName));
                }
            };
            Signal.prototype._registerListener = function (listener, isOnce, listenerContext, priority) {
                var prevIndex = this._indexOfListener(listener, listenerContext);
                var binding;
                if (prevIndex !== -1) {
                    binding = this._bindings[prevIndex];
                    if (binding.isOnce() !== isOnce) {
                        throw new Error('You cannot add' + (isOnce ? '' : 'Once') + '() then add' + (!isOnce ? '' : 'Once') + '() the same listener without removing the relationship first.');
                    }
                }
                else {
                    binding = new signal.SignalBinding(this, listener, isOnce, listenerContext, priority);
                    this._addBinding(binding);
                }
                if (this.memorize && this._prevParams) {
                    binding.execute(this._prevParams);
                }
                return binding;
            };
            Signal.prototype._addBinding = function (binding) {
                //simplified insertion sort
                var n = this._bindings.length;
                do {
                    --n;
                } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
                this._bindings.splice(n + 1, 0, binding);
            };
            Signal.prototype._indexOfListener = function (listener, context) {
                var n = this._bindings.length;
                var cur;
                while (n--) {
                    cur = this._bindings[n];
                    if (cur._listener === listener && cur.context === context) {
                        return n;
                    }
                }
                return -1;
            };
            return Signal;
        })();
        signal.Signal = Signal;
    })(signal = dragonwings.signal || (dragonwings.signal = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var signal;
    (function (signal_1) {
        var SignalBinding = (function () {
            function SignalBinding(signal, listener, isOnce, listenerContext, priority) {
                this.active = true;
                this._listener = listener;
                this._isOnce = isOnce;
                this.context = listenerContext;
                this._signal = signal;
                this._priority = priority || 0;
            }
            SignalBinding.prototype.execute = function (paramsArr) {
                var handlerReturn;
                var params;
                if (this.active && !!this._listener) {
                    params = this.params ? this.params.concat(paramsArr) : paramsArr;
                    handlerReturn = this._listener.apply(this.context, params);
                    if (this._isOnce) {
                        this.detach();
                    }
                }
                return handlerReturn;
            };
            SignalBinding.prototype.detach = function () {
                return this.isBound() ? this._signal.remove(this._listener, this.context) : null;
            };
            SignalBinding.prototype.isBound = function () {
                return (!!this._signal && !!this._listener);
            };
            SignalBinding.prototype.isOnce = function () {
                return this._isOnce;
            };
            SignalBinding.prototype.getListener = function () {
                return this._listener;
            };
            SignalBinding.prototype.getSignal = function () {
                return this._signal;
            };
            SignalBinding.prototype.toString = function () {
                return '[Phaser.SignalBinding isOnce:' + this._isOnce + ', isBound:' + this.isBound() + ', active:' + this.active + ']';
            };
            SignalBinding.prototype._destroy = function () {
                delete this._signal;
                delete this._listener;
                delete this.context;
            };
            return SignalBinding;
        })();
        signal_1.SignalBinding = SignalBinding;
    })(signal = dragonwings.signal || (dragonwings.signal = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var interfaces;
    (function (interfaces) {
        /**
         * @class IViewAbstract
         *
         * @description Class that can be extended and easily used with mediators, this however is not a requirement.
         */
        var IViewAbstract = (function () {
            function IViewAbstract() {
            }
            /**
             * Sets the views model
             *
             * @param viewModel the views model
             */
            IViewAbstract.prototype.setViewModel = function (viewModel) { };
            /**
             * Gets the views model
             */
            IViewAbstract.prototype.getViewModel = function () { return null; };
            /**
             * Dispatches a context wide event
             *
             * @param event The event to dispatch
             */
            IViewAbstract.prototype.dispatchContextEvent = function (event) { };
            /**
             * Dispatches a context wide event
             *
             * @param event The event to dispatch
             */
            IViewAbstract.prototype.dispatchViewEvent = function (event) { };
            /**
             * Adds a listener to the view model
             *
             * @param eventName The type of event
             * @param listener The function to call
             */
            IViewAbstract.prototype.addViewModelListener = function (eventName, listener) { };
            /**
             * Removes a listener from the view model
             *
             * @param eventName The type of event
             * @param listener The function to call
             */
            IViewAbstract.prototype.removeViewModelListener = function (eventName, listener) { };
            return IViewAbstract;
        })();
        interfaces.IViewAbstract = IViewAbstract;
    })(interfaces = dragonwings.interfaces || (dragonwings.interfaces = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var interfaces;
    (function (interfaces) {
        /**
         * @class IViewMapAbstract
         *
         * @description Handles mapping view classes to concrete types and optionally providing them with a view model instance when they are created.
         */
        var IViewMapAbstract = (function () {
            function IViewMapAbstract() {
            }
            /**
             * Maps a view class to a conrete types
             *
             * @param classType The class to be mapped
             * @param toClass The class type to get when requested
             * @param viewModelClass The view model to provide to the view
             * @param isSingleton Maps the view as a singleton, not many use cases
             *
             */
            IViewMapAbstract.prototype.mapView = function (classType, toClass, viewModelClass, isSingleton) { return this; };
            return IViewMapAbstract;
        })();
        interfaces.IViewMapAbstract = IViewMapAbstract;
    })(interfaces = dragonwings.interfaces || (dragonwings.interfaces = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    var interfaces;
    (function (interfaces) {
        /**
         * @class IViewModelAbstract
         *
         * @description View models can be used to handle the generic logic of a view. Some components may have various different views with the same logic that can be consolidated into a view model
         */
        var IViewModelAbstract = (function () {
            function IViewModelAbstract() {
            }
            /**
             * Dispatches a view model event
             *
             * @param event The event to dispatch
             */
            IViewModelAbstract.prototype.dispatchViewModelEvent = function (event) { };
            return IViewModelAbstract;
        })();
        interfaces.IViewModelAbstract = IViewModelAbstract;
    })(interfaces = dragonwings.interfaces || (dragonwings.interfaces = {}));
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class View
     *
     * @description Class that can be extended and easily used with mediators, this however is not a requirement.
     */
    var View = (function () {
        function View(eventDispatcher) {
            /**
             * Local event dispatcher
             */
            this.viewEventDispatcher = new dragonwings.EventDispatcher();
            this.eventDispatcher = eventDispatcher;
        }
        /**
         * Adds a listener to the view model
         *
         * @param eventName The type of event
         * @param listener The function to call
         */
        View.prototype.addViewModelListener = function (eventName, listener) {
            this._viewModel.viewModelEventDispatcher.addEventListener(eventName, listener, this);
        };
        /**
         * Removes a listener from the view model
         *
         * @param eventName The type of event
         * @param listener The function to call
         */
        View.prototype.removeViewModelListener = function (eventName, listener) {
            this._viewModel.viewModelEventDispatcher.addEventListener(eventName, listener, this);
        };
        /**
         * Dispatches a context wide event
         *
         * @param event The event to dispatch
         */
        View.prototype.dispatchContextEvent = function (event) {
            this.eventDispatcher.dispatchEvent(event);
        };
        /**
         * Dispatches a context wide event
         *
         * @param event The event to dispatch
         */
        View.prototype.dispatchViewEvent = function (event) {
            this.viewEventDispatcher.dispatchEvent(event);
        };
        /**
         * Sets the views model
         *
         * @param viewModel the views model
         */
        View.prototype.setViewModel = function (viewModel) {
            this._viewModel = viewModel;
        };
        /**
         * Gets the views model
         */
        View.prototype.getViewModel = function () {
            return this._viewModel;
        };
        return View;
    })();
    dragonwings.View = View;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class ViewMap
     *
     * @description Handles mapping view classes to concrete types and optionally providing them with a view model instance when they are created.
     */
    var ViewMap = (function () {
        /**
         * Creates a new ViewMap object
         *
         * @param injector Context injector for injecting into view models
         */
        function ViewMap(injector) {
            this._injector = injector;
            this._viewClasses = [];
            this._modelClasses = [];
            this._injector.onInstatiate.add(this.onInstantiated, this);
        }
        /**
         * Maps a view class to a conrete types
         *
         * @param classType The class to be mapped
         * @param toClass The class type to get when requested
         * @param viewModelClass The view model to provide to the view
         * @param isSingleton Maps the view as a singleton, not many use cases
         *
         */
        ViewMap.prototype.mapView = function (classType, toClass, viewModelClass, isSingleton) {
            if (viewModelClass === void 0) { viewModelClass = null; }
            if (isSingleton === void 0) { isSingleton = false; }
            if (isSingleton)
                this._injector.mapSingletonOf(classType, toClass);
            else
                this._injector.mapClass(classType, toClass);
            if (viewModelClass != null) {
                this._modelClasses.push(viewModelClass);
                if (!toClass.name) {
                    var name = toClass.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];
                    this._viewClasses.push(name);
                }
                else {
                    this._viewClasses.push(toClass.name);
                }
            }
            return this;
        };
        /**
         * Called whenever the injector instantiates a new class
         *
         * @param object The object that was created
         */
        ViewMap.prototype.onInstantiated = function (object) {
            var view = object;
            if (view != null) {
                var className = this.getClassName(view);
                for (var i = 0; i < this._viewClasses.length; i++) {
                    if (className == this._viewClasses[i]) {
                        var viewModel = new this._modelClasses[i]();
                        if (viewModel != null) {
                            this._injector.injectInto(viewModel, false);
                            view.setViewModel(viewModel);
                        }
                    }
                }
            }
        };
        /**
         * Get's an objects class name
         *
         * @param instance The object to get the class name for
         */
        ViewMap.prototype.getClassName = function (instance) {
            var funcNameRegex = /function (.{1,})\(/;
            var results = (funcNameRegex).exec(instance["constructor"].toString());
            return (results && results.length > 1) ? results[1] : "";
        };
        return ViewMap;
    })();
    dragonwings.ViewMap = ViewMap;
})(dragonwings || (dragonwings = {}));
var dragonwings;
(function (dragonwings) {
    /**
     * @class ViewModel
     *
     * @description View models can be used to handle the generic logic of a view. Some components may have various different views with the same logic that can be consolidated into a view model
     */
    var ViewModel = (function () {
        function ViewModel() {
            /**
             * Event dispatcher that a view can use to listen for view model events
             */
            this.viewModelEventDispatcher = new dragonwings.EventDispatcher();
        }
        /**
         * Dispatches a view model event
         *
         * @param event The event to dispatch
         */
        ViewModel.prototype.dispatchViewModelEvent = function (event) {
            this.viewModelEventDispatcher.dispatchEvent(event);
        };
        return ViewModel;
    })();
    dragonwings.ViewModel = ViewModel;
})(dragonwings || (dragonwings = {}));
var filters;
(function (filters) {
    var Filter = (function () {
        function Filter(displayObject) {
            this._displayObject = displayObject;
            this._displayObject.enablePrePostRendering();
            this._displayObject.addEventListener(rendering.DisplayEvent.PRE_RENDER, this.onDisplayPre, this);
            this._displayObject.addEventListener(rendering.DisplayEvent.POST_RENDER, this.onDisplayPost, this);
        }
        Filter.prototype.kill = function () {
            this._displayObject.removeEventListener(rendering.DisplayEvent.PRE_RENDER, this.onDisplayPre, this);
            this._displayObject.removeEventListener(rendering.DisplayEvent.POST_RENDER, this.onDisplayPost, this);
        };
        Filter.prototype.preRender = function () {
        };
        Filter.prototype.postRender = function () {
        };
        Filter.prototype.onDisplayPre = function (e) {
            this._canvas = e.canvas;
            this._customProperties = e.customProperties;
            this.preRender();
        };
        Filter.prototype.onDisplayPost = function (e) {
            this._canvas = e.canvas;
            this._customProperties = e.customProperties;
            this.postRender();
        };
        Object.defineProperty(Filter.prototype, "canvas", {
            get: function () {
                return this._canvas;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Filter.prototype, "context2d", {
            get: function () {
                if (this._displayObject && this.canvas) {
                    return this.canvas.getContext("2d");
                }
                return null;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Filter.prototype, "context3d", {
            get: function () {
                if (this._displayObject && this.canvas) {
                    return this.canvas.getContext("webgl");
                }
                return null;
            },
            enumerable: true,
            configurable: true
        });
        return Filter;
    })();
    filters.Filter = Filter;
})(filters || (filters = {}));
/// <reference path="Filter.ts" />
var filters;
(function (filters) {
    var DropShadowFilter = (function (_super) {
        __extends(DropShadowFilter, _super);
        function DropShadowFilter(displayObject, colour, blur, xOff, yOff) {
            _super.call(this, displayObject);
            this.colour = colour;
            this.blur = blur;
            this.xOff = xOff;
            this.yOff = yOff;
        }
        DropShadowFilter.prototype.preRender = function () {
            if (this.context2d) {
                this.context2d.save();
                this.context2d.shadowColor = this.colour;
                this.context2d.shadowOffsetX = this.xOff * rendering.ScaleManager.getPositionScale();
                this.context2d.shadowOffsetY = this.yOff * rendering.ScaleManager.getPositionScale();
                this.context2d.shadowBlur = this.blur * rendering.ScaleManager.getPositionScale();
            }
        };
        DropShadowFilter.prototype.postRender = function () {
            if (this.context2d) {
                this.context2d.restore();
            }
        };
        return DropShadowFilter;
    })(filters.Filter);
    filters.DropShadowFilter = DropShadowFilter;
})(filters || (filters = {}));
var filters;
(function (filters) {
    var GlowFilter = (function (_super) {
        __extends(GlowFilter, _super);
        function GlowFilter(displayObject, colour, blur) {
            _super.call(this, displayObject);
            this.colour = colour;
            this.blur = blur;
        }
        GlowFilter.prototype.preRender = function () {
            if (this.context2d) {
                this.context2d.save();
                this.context2d.shadowColor = this.colour;
                this.context2d.shadowOffsetX = 0;
                this.context2d.shadowOffsetY = 0;
                this.context2d.shadowBlur = this.blur * rendering.ScaleManager.getPositionScale();
            }
        };
        GlowFilter.prototype.postRender = function () {
            if (this.context2d) {
                this.context2d.restore();
            }
        };
        return GlowFilter;
    })(filters.Filter);
    filters.GlowFilter = GlowFilter;
})(filters || (filters = {}));
var filters;
(function (filters) {
    var LinearGradientFilter = (function (_super) {
        __extends(LinearGradientFilter, _super);
        function LinearGradientFilter(displayObject, colours, percentages, startPosition, endPosition) {
            _super.call(this, displayObject);
            this.colours = colours;
            this.percentages = percentages;
            this.start = startPosition;
            this.end = endPosition;
        }
        LinearGradientFilter.prototype.preRender = function () {
            if (this.context2d) {
                this.context2d.save();
                var y = 0;
                if (this._customProperties && this._customProperties["y"]) {
                    y = this._customProperties["y"];
                }
                var grd = this.context2d.createLinearGradient(this.start.x * rendering.ScaleManager.getPositionScale(), this.start.y * rendering.ScaleManager.getPositionScale() + y, this.end.x * rendering.ScaleManager.getPositionScale(), this.end.y * rendering.ScaleManager.getPositionScale() + y);
                for (var i = 0; i < this.colours.length; i++) {
                    grd.addColorStop(this.percentages[i], this.colours[i]);
                }
                this.context2d.fillStyle = grd;
            }
        };
        LinearGradientFilter.prototype.postRender = function () {
            if (this.context2d) {
                this.context2d.restore();
            }
        };
        return LinearGradientFilter;
    })(filters.Filter);
    filters.LinearGradientFilter = LinearGradientFilter;
})(filters || (filters = {}));
var http;
(function (http) {
    /**
     * @class Header
     * @classdesc Simple key-value data structure for headers
     */
    var Header = (function () {
        function Header() {
        }
        return Header;
    })();
    http.Header = Header;
})(http || (http = {}));
var http;
(function (http) {
    /**
     * HTTP requests
     * @class http-connection.HttpConnection
     * @classdesc XMLHttpRequest wrapper for making HTTP requests
     */
    var HttpConnection = (function (_super) {
        __extends(HttpConnection, _super);
        /**
         * Event dispatcher for responses
         * @member http-connection.HttpConnection#eventDispatcher
         * @private
         * @type {events.EventDispatcher<IHTTPResponseListener>}
         */
        //private eventDispatcher: events.EventDispatcher<IHTTPResponseListener>;
        /**
         * @constructor
         */
        function HttpConnection(xhrObject, url, xmlData, requestHeaders, httpMethod, async) {
            _super.call(this);
            //this.eventDispatcher = new events.EventDispatcher(this.signal);
            this.xhrObject = xhrObject;
            this.requestHeaders = requestHeaders;
            this.httpMethod = httpMethod;
            this.url = url;
            this.async = async;
            this.xmlData = xmlData;
            this.retry = 0;
        }
        /**
         * Retrieve event dispatcher to add listeners
         * @method http-connection.HttpConnection#getEvents
         * @public
         * @returns {events.EventDispatcher<IHTTPResponseListener>} HttpConnection event dispatcher
         */
        //public getEvents(): events.EventDispatcher<IHTTPResponseListener> {
        //    return this.eventDispatcher;
        //}
        /**
         * Send the HTTP request
         * @method http-connection.HttpConnection#send
         * @public
         * @param {ResponseType} responseType Expected data type for response payload
         * @param {boolean} sendWithCredentials True if send with credentials, false otherwise
         */
        HttpConnection.prototype.send = function (responseType, sendWithCredentials) {
            var _this = this;
            if (responseType === void 0) { responseType = http.ResponseType.DEFAULT; }
            if (sendWithCredentials === void 0) { sendWithCredentials = false; }
            this.rt = responseType;
            this.swc = sendWithCredentials;
            var httpMethodString = http.HttpMethod[this.httpMethod]; // convert to string value
            var httpResponseTypeString;
            if (responseType === http.ResponseType.DEFAULT) {
                httpResponseTypeString = ""; // that is the default
            }
            else {
                httpResponseTypeString = http.ResponseType[responseType].toLowerCase(); // converts to string value and lowercase
            }
            this.xhrObject.onreadystatechange = function (event) { return _this.handleStateChange(event); };
            this.xhrObject.onerror = function (event) { return _this.handleError(event); };
            this.xhrObject.onprogress = function (event) { return _this.handleProgress(event); };
            this.xhrObject.open(httpMethodString, this.url, this.async);
            if (sendWithCredentials) {
                this.xhrObject.withCredentials = true;
            }
            this.xhrObject.responseType = httpResponseTypeString;
            this.requestHeaders.setHeadersOnXHRRequest(this.xhrObject);
            // Sometimes the message fails directly on send.
            // Maybe when there is no connection at all.
            // in that case catch and report down
            try {
                this.xhrObject.send(this.xmlData);
            }
            catch (error) {
                var httpEvent = new http.HttpConnectionEvent(http.HttpConnectionEvent.COMPLETE);
                httpEvent.url = this.url;
                httpEvent.error = "failed sending request";
                httpEvent.status = 0;
                this.dispatchEvent(httpEvent);
            }
        };
        /**
         * Abort the HTTP reuqest
         * @method http-connection.HttpConnection#abort
         * @public
         */
        HttpConnection.prototype.abort = function () {
            this.xhrObject.onerror = null;
            this.xhrObject.onreadystatechange = null;
            this.xhrObject.abort();
        };
        /**
         * Handle connection state change
         * @method http-connection.HttpConnection#handleStateChange
         * @private
         * @param {Event} event HTTP request event
         */
        HttpConnection.prototype.handleStateChange = function (event) {
            var _this = this;
            this.xhrObject.onerror = null;
            if (this.xhrObject.readyState == 4) {
                console.log("XHR: handleStateChange[status: " + this.xhrObject.status + "]");
                if (this.xhrObject.status == 200) {
                    var responseHeaders = this.getResponseHeaders();
                    var httpEvent = new http.HttpConnectionEvent(http.HttpConnectionEvent.COMPLETE);
                    httpEvent.url = this.url;
                    httpEvent.response = this.xhrObject;
                    httpEvent.responseHeaders = responseHeaders;
                    this.dispatchEvent(httpEvent);
                }
                else if (this.xhrObject.status) {
                    console.log("XHR: handleStateChange[failed]");
                    // Accessing the response text will be throwing exception
                    // if the response type is not string or default
                    // e.g. when using "arraybuffer"
                    // catch this and throw a generic message back instead.
                    var message;
                    try {
                        message = this.xhrObject.responseText;
                    }
                    catch (error) {
                        message = "unable to read response text";
                    }
                    var httpEvent = new http.HttpConnectionEvent(http.HttpConnectionEvent.FAIL);
                    httpEvent.url = this.url;
                    httpEvent.error = message;
                    httpEvent.status = this.xhrObject.status;
                    this.dispatchEvent(httpEvent);
                }
                else {
                    // Ok, a completed XHR with a status code of 0 means that the request probably didn't
                    // get out of the front door. It could be for any reason, including the server
                    // is not reachable. Since the request has not reached the server, we aren't worried
                    // about idempotent behavior. So, let's wait a second and then retry the request.
                    // If the server is down, the retry (max == 5) will prevent this from reoccuring
                    // indefinitely. If there's a networking hiccup on the host device (ahem, iOS 8!!)
                    // this will hopefully find a timeslice where it will work. -RF
                    console.log("XHR: handleStateChange[unknown status code: " + this.xhrObject.status + "]");
                    if (this.retry-- > 0) {
                        setTimeout(function () {
                            _this.xhrObject = new XMLHttpRequest();
                            _this.send(_this.rt, _this.swc);
                        }, 1000);
                    }
                    else {
                        var message = "unable to connect";
                        var httpEvent = new http.HttpConnectionEvent(http.HttpConnectionEvent.COMPLETE);
                        httpEvent.url = this.url;
                        httpEvent.error = message;
                        httpEvent.status = this.xhrObject.status;
                        this.dispatchEvent(httpEvent);
                    }
                }
            }
        };
        /**
         * Handle connection progress change
         * @method http-connection.HttpConnection#handleProgress
         * @private
         * @param {Event} event HTTP request event
         */
        HttpConnection.prototype.handleProgress = function (event) {
            var target = event.target;
            if (target.responseType != "arraybuffer") {
                var httpEvent = new http.HttpConnectionEvent(http.HttpConnectionEvent.PROGRESS);
                this.dispatchEvent(httpEvent);
            }
        };
        /**
         * Handle connection error
         * @method http-connection.HttpConnection#handleError
         * @private
         * @param {Event} event HTTP request event
         */
        HttpConnection.prototype.handleError = function (event) {
            this.xhrObject.onreadystatechange = null;
            var httpEvent = new http.HttpConnectionEvent(http.HttpConnectionEvent.COMPLETE);
            httpEvent.url = this.url;
            httpEvent.error = event.message;
            httpEvent.status = this.xhrObject.status;
            this.dispatchEvent(httpEvent);
        };
        /**
         * Extract response headers
         * @method http-connection.HttpConnection#getResponseHeaders
         * @private
         * @returns {string} XMLHttpRequest response header
         */
        HttpConnection.prototype.getResponseHeaders = function () {
            return this.xhrObject.getAllResponseHeaders();
        };
        return HttpConnection;
    })(borgevent.EventDispatcher);
    http.HttpConnection = HttpConnection;
})(http || (http = {}));
var http;
(function (http) {
    var HttpConnectionEvent = (function (_super) {
        __extends(HttpConnectionEvent, _super);
        function HttpConnectionEvent(type) {
            _super.call(this, type);
        }
        HttpConnectionEvent.PROGRESS = "HttpConnectionEvent_PROGRESS";
        HttpConnectionEvent.COMPLETE = "HttpConnectionEvent_COMPLETE";
        HttpConnectionEvent.FAIL = "HttpConnectionEvent_FAIL";
        return HttpConnectionEvent;
    })(borgevent.Event);
    http.HttpConnectionEvent = HttpConnectionEvent;
})(http || (http = {}));
var http;
(function (http) {
    var HttpConnectionFactory = (function () {
        function HttpConnectionFactory() {
        }
        HttpConnectionFactory.prototype.createRequestHeaders = function () {
            var requestHeaders = new http.RequestHeaders();
            return requestHeaders;
        };
        HttpConnectionFactory.prototype.createResponseHeaders = function () {
            var responseHeaders = new http.ResponseHeaders();
            return responseHeaders;
        };
        /**
        * @param url the url to request
        * @param data the body of the request
        */
        HttpConnectionFactory.prototype.createHttpConnection = function (url, data) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            var httpMethod = http.HttpMethod.GET;
            return new http.HttpConnection(xhrObject, url, data, requestHeaders, httpMethod, true);
        };
        HttpConnectionFactory.prototype.createConnection = function (url, data, method) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            var httpMethod = method;
            return new http.HttpConnection(xhrObject, url, data, requestHeaders, httpMethod, true);
        };
        /**
        * @param url the url to request
        * @param data the body of the request
        * @param requestHeaders
        */
        HttpConnectionFactory.prototype.createHttpConnectionWithHeaders = function (url, data, requestHeaders) {
            var xhrObject = new XMLHttpRequest();
            var httpMethod = http.HttpMethod.GET;
            return new http.HttpConnection(xhrObject, url, data, requestHeaders, httpMethod, true);
        };
        /**
        *
        * @deprecated Use regular HttpConnectionFactory.createHttpConnection
        *
        * @param url the url to request
        * @param data the body of the request
        */
        HttpConnectionFactory.prototype.createHttpSpecificErrorConnection = function (url, data) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            var httpMethod = http.HttpMethod.GET;
            return new http.HttpSpecificErrorConnection(xhrObject, url, data, requestHeaders, httpMethod, true, window);
        };
        /**
        *
        * @deprecated Use regular HttpConnectionFactory.createHttpConnection
        *
        * @param url the url to request
        * @param data the body of the request
        */
        HttpConnectionFactory.prototype.createSynchronousHttpSpecificErrorConnection = function (url, data) {
            var xhrObject = new XMLHttpRequest();
            var requestHeaders = this.createRequestHeaders();
            var httpMethod = http.HttpMethod.GET;
            return new http.HttpSpecificErrorConnection(xhrObject, url, data, requestHeaders, httpMethod, false, window);
        };
        return HttpConnectionFactory;
    })();
    http.HttpConnectionFactory = HttpConnectionFactory;
})(http || (http = {}));
var http;
(function (http) {
    /**
     * @class HttpMethod
     * @classdesc Enumeration of HTTP methods
     */
    (function (HttpMethod) {
        HttpMethod[HttpMethod["GET"] = 0] = "GET";
        HttpMethod[HttpMethod["POST"] = 1] = "POST";
    })(http.HttpMethod || (http.HttpMethod = {}));
    var HttpMethod = http.HttpMethod;
})(http || (http = {}));
var http;
(function (http) {
    var HttpSpecificErrorConnection = (function () {
        function HttpSpecificErrorConnection(xhrObject, url, xmlData, requestHeaders, httpMethod, async, win) {
            var _this = this;
            this.xhrObject = xhrObject;
            this.requestHeaders = requestHeaders;
            this.httpMethod = httpMethod;
            this.xmlHttpTimeoutId = -1;
            this.xmlHttpTimeoutMs = -1;
            this.url = url;
            this.async = async;
            this.xmlData = xmlData;
            this.timedOut = false;
            this.retryCallback = function () { };
            this.recoveredConnectionDelegator = function () { };
            this.win = win;
            this.win.addEventListener("online", function () { return _this.handleRestoredConnection(); });
        }
        HttpSpecificErrorConnection.prototype.setUrl = function (url) {
            this.url = url;
        };
        HttpSpecificErrorConnection.prototype.send = function (doneCallback, failCallback, metadataCallback) {
            var _this = this;
            this.doneCallback = doneCallback;
            this.failCallback = failCallback;
            this.metadataCallback = metadataCallback;
            var httpMethodString = http.HttpMethod[this.httpMethod]; // convert to string value
            this.xhrObject.onreadystatechange = function (event) { return _this.handleStateChange(event); };
            this.xhrObject.onerror = function (event) { return _this.handleError(event); };
            this.xhrObject.open(httpMethodString, this.url, this.async);
            this.requestHeaders.setHeadersOnXHRRequest(this.xhrObject);
            this.xhrObject.send(this.xmlData);
        };
        HttpSpecificErrorConnection.prototype.sendWithTimeout = function (doneCallback, failCallback, timeoutCallback, timeoutInMs, retryCallback, metadataCallback, lostConnectionCallback, recoveredFromLostConectionCallback) {
            var _this = this;
            this.recoveredFromLostConnectionCallback = recoveredFromLostConectionCallback;
            this.lostConnectionCallback = lostConnectionCallback;
            if (!this.win.navigator.onLine) {
                this.recoveredConnectionDelegator = this.recoveredFromLostConnectionCallback;
                this.lostConnectionCallback();
                return;
            }
            var httpMethodString = http.HttpMethod[this.httpMethod]; // convert to string value
            this.doneCallback = doneCallback;
            this.failCallback = failCallback;
            this.timeoutCallback = timeoutCallback;
            this.retryCallback = retryCallback;
            this.metadataCallback = metadataCallback;
            this.xhrObject.onreadystatechange = function (event) { return _this.handleStateChange(event); };
            this.xhrObject.onerror = function (event) { return _this.handleError(event); };
            this.xhrObject.onprogress = function (event) { return _this.handleProgress(event); };
            this.xhrObject.open(httpMethodString, this.url, this.async);
            this.requestHeaders.setHeadersOnXHRRequest(this.xhrObject);
            // timeout property is (yet) only supported in some browsers, see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Browser_Compatibility
            //this.xhrObject.timeout = timeoutInMs;
            //this.xhrObject.ontimeout = (event: Event) => this.timeoutCallback();
            this.xhrObject.send(this.xmlData);
            this.xmlHttpTimeoutMs = timeoutInMs;
            this.xmlHttpTimeoutId = setTimeout(function () { return _this.handleTimeout(); }, this.xmlHttpTimeoutMs);
        };
        HttpSpecificErrorConnection.prototype.handleProgress = function (event) {
            var _this = this;
            //break timeout and set it up again
            if (this.xmlHttpTimeoutId < 0) {
                return;
            }
            // remove old timeout
            clearTimeout(this.xmlHttpTimeoutId);
            //add new timeout
            this.xmlHttpTimeoutId = setTimeout(function () { return _this.handleTimeout(); }, this.xmlHttpTimeoutMs);
        };
        HttpSpecificErrorConnection.prototype.handleStateChange = function (event) {
            if (this.timedOut) {
                this.timedOut = false;
                return;
            }
            this.xhrObject.onerror = null;
            if (this.xhrObject.readyState == 4) {
                clearTimeout(this.xmlHttpTimeoutId);
                this.timedOut = false;
                switch (this.xhrObject.status) {
                    case 200:
                        this.metadataCallback(this.compileMetaData());
                        this.doneCallback(this.url, this.xhrObject.responseText);
                        break;
                    case 202:
                        this.metadataCallback(this.compileMetaData());
                        this.retryCallback(this.xhrObject.responseText);
                        break;
                    default:
                        this.failCallback(this.url, this.xhrObject.responseText);
                        break;
                }
            }
        };
        // TODO: This need to be re-done with a header response translator of some kind!
        HttpSpecificErrorConnection.prototype.compileMetaData = function () {
            var _this = this;
            return { getProxySessionId: function () { return _this.xhrObject.getResponseHeader("x-wms-proxysessionid"); } };
        };
        HttpSpecificErrorConnection.prototype.handleError = function (event) {
            this.xhrObject.onreadystatechange = null;
            this.failCallback(this.url, this.xhrObject.responseText);
        };
        HttpSpecificErrorConnection.prototype.handleTimeout = function () {
            this.timedOut = true;
            this.xhrObject.abort();
            this.timeoutCallback();
        };
        /**
         Handle restoration of connection by calling the recover connection
         delegate which referens a recover callback if no connection exist
         when trying to send. This callback needs to be reset after called to
         avoid alerting restored connection events when no sending has occured.
        */
        HttpSpecificErrorConnection.prototype.handleRestoredConnection = function () {
            this.recoveredConnectionDelegator();
            this.recoveredConnectionDelegator = function () { };
        };
        /**
         Removes the online event listener on window object. Should always be called before this object is destroyed
         */
        HttpSpecificErrorConnection.prototype.clean = function () {
            var _this = this;
            this.win.removeEventListener("online", function () { return _this.handleRestoredConnection(); });
        };
        return HttpSpecificErrorConnection;
    })();
    http.HttpSpecificErrorConnection = HttpSpecificErrorConnection;
})(http || (http = {}));
var http;
(function (http) {
    /**
     * @class QueryStringBuilder
     * @classdesc Utility class to build HTTP query strings
     */
    var QueryStringBuilder = (function () {
        function QueryStringBuilder() {
            this.nameValues = [];
            this.nameValues = [];
        }
        QueryStringBuilder.prototype.add = function (name, value) {
            this.nameValues.push({ name: name, value: value });
        };
        QueryStringBuilder.prototype.toQueryString = function () {
            var segments = [], nameValue;
            for (var i = 0, len = this.nameValues.length; i < len; i++) {
                nameValue = this.nameValues[i];
                segments[i] = encodeURIComponent(nameValue.name) + "=" + encodeURIComponent(nameValue.value);
            }
            var queryString = segments.join("&");
            return (queryString == "" ? queryString : "?" + queryString);
        };
        return QueryStringBuilder;
    })();
    http.QueryStringBuilder = QueryStringBuilder;
})(http || (http = {}));
var http;
(function (http) {
    /**
     * @class QueryStringBuilderFactory
     * @classdesc Factory for constructing QueryStringBuilders
     */
    var QueryStringBuilderFactory = (function () {
        function QueryStringBuilderFactory() {
        }
        QueryStringBuilderFactory.prototype.createQueryStringBuilder = function () {
            return new http.QueryStringBuilder();
        };
        return QueryStringBuilderFactory;
    })();
    http.QueryStringBuilderFactory = QueryStringBuilderFactory;
})(http || (http = {}));
var http;
(function (http) {
    /**
     * @class RequestHeaders
     * @classdesc Utility class for constructing HTTP request headers
     */
    var RequestHeaders = (function () {
        function RequestHeaders() {
            this.headers = new Array();
        }
        RequestHeaders.prototype.setContentTypeJSON = function () {
            this.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        };
        RequestHeaders.prototype.setCacheControlMaxAge = function (maxAge) {
            this.setRequestHeader("Cache-Control", "max-age=" + maxAge);
        };
        RequestHeaders.prototype.setHeadersOnXHRRequest = function (xhrObject) {
            // copy all headers to the xhrObject
            if (this.headers != null) {
                this.headers.forEach(function (header) {
                    xhrObject.setRequestHeader(header.key, header.value);
                });
            }
        };
        RequestHeaders.prototype.setRequestHeaders = function (headers) {
            this.headers = headers;
        };
        RequestHeaders.prototype.setRequestHeader = function (key, value) {
            var requestHeader = new http.Header();
            requestHeader.key = key;
            requestHeader.value = value;
            this.headers.push(requestHeader);
        };
        return RequestHeaders;
    })();
    http.RequestHeaders = RequestHeaders;
})(http || (http = {}));
var http;
(function (http) {
    /**
     * @class ResponseHeaders
     * @classdesc Utility class to construct HTTP response headers
     */
    var ResponseHeaders = (function () {
        function ResponseHeaders() {
            this.headers = new Array();
        }
        ResponseHeaders.prototype.addFromResponseHeadersString = function (str) {
            var responseObj = this.parseHeaders(str);
            for (var key in responseObj) {
                var header = new http.Header();
                header.key = key;
                header.value = responseObj[key];
                this.headers.push(header);
            }
        };
        ResponseHeaders.prototype.parseHeaders = function (headers) {
            var obj = new Object();
            // split on linefeed
            var headersArray = headers.split("\n");
            for (var i = 0; i < headersArray.length; i++) {
                var headerString = headersArray[i];
                // get the first colon. That splits the key and value
                var splitIndex = headerString.indexOf(":");
                var key = headerString.substring(0, splitIndex);
                var value = headerString.substring(splitIndex + 2);
                // Headers are terminated by \n\r. Just drop the \r if its present.
                value = value.replace("\r", "");
                obj[key] = value;
            }
            return obj;
        };
        ResponseHeaders.prototype.getHeader = function (name) {
            for (var i = 0; i < this.headers.length; i++) {
                if (this.headers[i].key == name) {
                    return this.headers[i];
                }
            }
            return null;
        };
        return ResponseHeaders;
    })();
    http.ResponseHeaders = ResponseHeaders;
})(http || (http = {}));
var http;
(function (http) {
    /**
     * @class ResponseType
     * @classdesc Enumeration of HTTP response payload types
     */
    (function (ResponseType) {
        ResponseType[ResponseType["DEFAULT"] = 0] = "DEFAULT";
        ResponseType[ResponseType["ARRAYBUFFER"] = 1] = "ARRAYBUFFER";
        ResponseType[ResponseType["BLOB"] = 2] = "BLOB";
        ResponseType[ResponseType["DOCUMENT"] = 3] = "DOCUMENT";
        ResponseType[ResponseType["JSON"] = 4] = "JSON";
        ResponseType[ResponseType["TEXT"] = 5] = "TEXT";
    })(http.ResponseType || (http.ResponseType = {}));
    var ResponseType = http.ResponseType;
})(http || (http = {}));
var proton;
(function (proton) {
    /**
     * @class ProtonImageTarget
     *
     * @description Custom image target to use with the proton ImageTarget initialzer
     */
    var ProtonImageTarget = (function () {
        function ProtonImageTarget(assetsOrFrames, isClip, width, height, fps, stopClip) {
            if (fps === void 0) { fps = 60; }
            if (stopClip === void 0) { stopClip = false; }
            this.assetsOrFrames = assetsOrFrames;
            this.isClip = isClip;
            this.width = width;
            this.height = height;
            this.fps = fps;
            this.stopClip = stopClip;
        }
        return ProtonImageTarget;
    })();
    proton.ProtonImageTarget = ProtonImageTarget;
})(proton || (proton = {}));
var proton;
(function (proton_1) {
    /**
     * @class ProtonRenderer
     *
     * @description Custom renderer for Proton particle effects that uses the borg rendering engine.
     */
    var ProtonRenderer = (function (_super) {
        __extends(ProtonRenderer, _super);
        /**
         * Creates a new ProtonRenderer object
         *
         * @param proton The Proton instance
         * @param element The display object to add the particles to
         * @param stroke Stroke colour to apply to graphics
         */
        function ProtonRenderer(proton, element, stroke) {
            _super.call(this, proton, element);
            /**
             * Radians to degrees
             */
            this.PI_180 = Math.PI / 180;
            this.stroke = stroke;
        }
        /**
         * Not used
         */
        ProtonRenderer.prototype.resize = function (width, height) {
        };
        /**
         * Starts the renderer
         */
        ProtonRenderer.prototype.start = function () {
            _super.prototype.start.call(this);
        };
        /**
         * Callback for when proton updates
         */
        ProtonRenderer.prototype.onProtonUpdate = function () {
        };
        /**
         * Callback for when a new particle is added
         *
         * @param particle The particle that was created
         */
        ProtonRenderer.prototype.onParticleCreated = function (particle) {
            if (particle.target) {
                var displayOb = new rendering.DisplayObjectContainer();
                var bitmap;
                if (!particle.target.isClip) {
                    bitmap = new rendering.Bitmap(particle.target.assetsOrFrames[0]);
                }
                else {
                    var clips = particle.target.assetsOrFrames;
                    var mc = new rendering.MovieClip(clips);
                    mc.gotoAndPlay(Math.floor(Math.random() * mc.totalFrames));
                    if (particle.target.stopClip) {
                        mc.stop();
                    }
                    mc.fps = particle.target.fps;
                    bitmap = mc;
                }
                bitmap.scaleX = particle.target.width / bitmap.width;
                bitmap.scaleY = particle.target.height / bitmap.height;
                bitmap.x = -(bitmap.width * bitmap.scaleX) / 2;
                bitmap.y = -(bitmap.height * bitmap.scaleY) / 2;
                displayOb.interactive = false;
                bitmap.interactive = false;
                displayOb.addChild(bitmap);
                particle.target = displayOb;
                //particle.target.anchor.x = 0.5;
                //particle.target.anchor.y = 0.5;
                this.element.addChild(particle.target);
            }
            else {
                var graphics = new rendering.Graphics();
                if (this.stroke) {
                    if (this.stroke == true) {
                        graphics.lineStyle(1, 0x000000, 1);
                    }
                    else if (this.stroke != null) {
                        graphics.lineStyle(1, this.stroke, 1);
                    }
                }
                var col = parseInt("0x" + particle.color);
                graphics.beginFill(col, 1);
                graphics.drawCircle(0, 0, particle.radius);
                particle.target = graphics;
                this.element.addChild(particle.target);
            }
        };
        /**
         * Callback when a particle is updated
         *
         * @param particle The particle that was updated
         */
        ProtonRenderer.prototype.onParticleUpdate = function (particle) {
            if (particle.target) {
                particle.target.x = particle.p.x;
                particle.target.y = particle.p.y;
                particle.target.alpha = particle.alpha;
                particle.target.scaleX = particle.scale;
                particle.target.scaleY = particle.scale;
                // using cached version of Math.PI / 180 for slight performance increase.
                particle.target.rotation = particle.rotation * this.PI_180; // Math.PI / 180;
            }
        };
        /**
         * Callback when a particle has ended
         *
         * @param particle The particle that has ended
         */
        ProtonRenderer.prototype.onParticleDead = function (particle) {
            if (particle.target) {
                this.element.removeChild(particle.target);
            }
        };
        return ProtonRenderer;
    })(Proton.BaseRender);
    proton_1.ProtonRenderer = ProtonRenderer;
})(proton || (proton = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class
         *
         * @description Slow reel animation
         */
        var SlowReelAnimation = (function () {
            function SlowReelAnimation() {
                /**
                 * @inheritdoc
                 */
                this.accelDuration = 1;
                /**
                 * @inheritdoc
                 */
                this.accelEase = Sine.easeIn;
                /**
                 * @inheritdoc
                 */
                this.deccelDuration = 1;
                /**
                 * @inheritdoc
                 */
                this.deccelEase = Sine.easeOut;
                /**
                 * @inheritdoc
                 */
                this.snapOffset = .1;
                /**
                 * @inheritdoc
                 */
                this.snapDuration = .75;
                /**
                 * @inheritdoc
                 */
                this.snapEase = Back.easeOut;
                /**
                 * @inheritdoc
                 */
                this.constSpeed = 6;
            }
            return SlowReelAnimation;
        })();
        barcrest.SlowReelAnimation = SlowReelAnimation;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class
         *
         * @description Standard reel animation
         */
        var StandardReelAnimation = (function () {
            function StandardReelAnimation() {
                /**
                 * @inheritdoc
                 */
                this.accelDuration = 1;
                /**
                 * @inheritdoc
                 */
                this.accelEase = Sine.easeIn;
                /**
                 * @inheritdoc
                 */
                this.deccelDuration = 1;
                /**
                 * @inheritdoc
                 */
                this.deccelEase = Sine.easeOut;
                /**
                 * @inheritdoc
                 */
                this.snapOffset = .1;
                /**
                 * @inheritdoc
                 */
                this.snapDuration = .75;
                /**
                 * @inheritdoc
                 */
                this.snapEase = Back.easeOut;
                /**
                 * @inheritdoc
                 */
                this.constSpeed = 8;
            }
            return StandardReelAnimation;
        })();
        barcrest.StandardReelAnimation = StandardReelAnimation;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class ReelEvent
         *
         * @description Events dispatched by individual IReelModel's
         */
        var ReelEvent = (function (_super) {
            __extends(ReelEvent, _super);
            /**
             * Creates a new ReelEvent
             * @param type Type of event
             * @param config Reel set settings
             */
            function ReelEvent(type, config) {
                _super.call(this, type);
                this.config = config;
            }
            /**
             * Dispatched when the reel is initialises
             */
            ReelEvent.ON_INIT = "ReelEvent_ON_INIT";
            /**
             * Dispatched each time the reel renders
             */
            ReelEvent.ON_RENDER = "ReelEvent_ON_RENDER";
            /**
             * Dispatched when the reel changes phase, see ReelStages
             */
            ReelEvent.ON_STAGE_CHANGE = "ReelEvent_ON_STAGE_CHANGE";
            /**
             * Dispatched when the reel visibility is toggled
             */
            ReelEvent.ON_VISIBLE_CHANGED = "ReelEvent_ON_HIDE";
            /**
             * Dispatched when the reel begins spinning
             */
            ReelEvent.ON_START = "ReelEvent_ON_START";
            /**
             * Dispatched when the reel has completed spinning
             */
            ReelEvent.ON_COMPLETE = "ReelEvent_ON_COMPLETE";
            /**
             * Dispatched when symbols are removed
             */
            ReelEvent.ON_REMOVE = "ReelEvent_ON_REMOVE";
            return ReelEvent;
        })(borgevent.Event);
        barcrest.ReelEvent = ReelEvent;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class ReelSetEvent
         *
         * @description Events dispatched by the reel set
         */
        var ReelSetEvent = (function (_super) {
            __extends(ReelSetEvent, _super);
            /**
             * Creates a new ReelEvent
             * @param type Type of event
             * @param config Reel set settings
             */
            function ReelSetEvent(type, config) {
                _super.call(this, type);
                this.config = config;
            }
            /**
             * Dispatched when the reel set is initialised
             */
            ReelSetEvent.ON_INIT = "ReelEvent_ON_INIT";
            /**
             * Dispatched when the reel set starts spinning
             */
            ReelSetEvent.ON_REEL_STARTED = "ReelEvent_ON_REEL_STARTED";
            /**
             * Dispatched when a valid scatter has landed
             */
            ReelSetEvent.ON_VALID_SCATTER_HIT = "ReelEvent_ON_VALID_SCATTER_HIT";
            /**
             * Dispatched when each reel snaps
             */
            ReelSetEvent.ON_REEL_SNAP = "ReelEvent_ON_REEL_SNAP";
            /**
             * Dispatched when the reel set stops spinning
             */
            ReelSetEvent.ON_SPIN_COMPLETE = "ReelEvent_ON_SPIN_COMPLETE";
            return ReelSetEvent;
        })(borgevent.Event);
        barcrest.ReelSetEvent = ReelSetEvent;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class GsapReelModel
         *
         * @description Individual reel that handles spinning, stopping and updating
         */
        var GsapReelModel = (function (_super) {
            __extends(GsapReelModel, _super);
            /**
             * Creates a new GsapReelModel
             * @param config The reel set configuration
             * @param id The index of this reel
             * @param animation The animation to use for this reel
             */
            function GsapReelModel(config, id, animation) {
                _super.call(this);
                /**
                 * Amount of symbols to loop during constant acceleration
                 */
                this._loopSectionLength = 30;
                this._animation = animation;
                this._reelId = id;
                this._reelSetConfig = (config == null) ? new barcrest.ReelSetVO() : config;
            }
            /**
             * @inheritdoc
             */
            GsapReelModel.prototype.init = function () {
                this._activeSymbolMap = this._reelSetConfig.symbolMaps.getSymbolSet(0);
                var reelEvent = new barcrest.ReelEvent(barcrest.ReelEvent.ON_INIT, this._reelSetConfig);
                reelEvent.reelId = this._reelId;
                this.dispatchEvent(reelEvent);
                this._activeReelSetDefinition = this._reelSetConfig.reelSetDefinition.getReelSet(0);
            };
            /**
             * @inheritdoc
             * @param symbolsToRemove @inheritdoc
             */
            GsapReelModel.prototype.removeSymbols = function (symbolsToRemove) {
                var reelEvent = new barcrest.ReelEvent(barcrest.ReelEvent.ON_REMOVE, this._reelSetConfig);
                reelEvent.reelId = this._reelId;
                reelEvent.symbolsToRemove = symbolsToRemove;
                this.dispatchEvent(reelEvent);
            };
            /**
             * @inheritdoc
             * @param symbols @inheritdoc
             * @param updateEndSymbols @inheritdoc
             */
            GsapReelModel.prototype.updateSymbols = function (symbols, updateEndSymbols) {
                if (symbols === void 0) { symbols = null; }
                if (updateEndSymbols === void 0) { updateEndSymbols = false; }
                if (symbols == null) {
                    symbols = this.reverseArray(this._renderSymbolsList);
                }
                if (updateEndSymbols) {
                    this._endSymbols = this.reverseArray(symbols);
                }
                this._renderSymbolsList = this.reverseArray(symbols); // reverse the symbols so they are in same renderable order as the main reel lists
                this.render(0);
            };
            /**
             * @inheritdoc
             * @param index @inheritdoc
             */
            GsapReelModel.prototype.changeReelSymbolSet = function (index) {
                this._activeSymbolMap = this._reelSetConfig.symbolMaps.getSymbolSet(index);
            };
            /**
             * @inheritdoc
             * @param index @inheritdoc
             */
            GsapReelModel.prototype.changeReelSet = function (index) {
                this._activeReelSetDefinition = this._reelSetConfig.reelSetDefinition.getReelSet(index);
            };
            /**
             * @inheritdoc
             * @param animObj @inheritdoc
             */
            GsapReelModel.prototype.changeAnimObj = function (animObj) {
                this._animation = animObj;
            };
            /**
             * @inheritdoc
             */
            GsapReelModel.prototype.startSpin = function () {
                this.resetReel();
                this.beginAcceleration();
                this.dispatchEvent(new barcrest.ReelEvent(barcrest.ReelEvent.ON_START, this._reelSetConfig));
            };
            /**
             * @inheritdoc
             * @param symbols @inheritdoc
             */
            GsapReelModel.prototype.completeSpin = function (symbols) {
                this._endSymbols = this.reverseArray(symbols);
                TweenMax.delayedCall(.1, this.onCompleteSpin, [], this, false);
            };
            /**
             * @inheritdoc
             * @param visible @inheritdoc
             */
            GsapReelModel.prototype.setVisible = function (visible) {
                var reelEvent = new barcrest.ReelEvent(barcrest.ReelEvent.ON_VISIBLE_CHANGED, this._reelSetConfig);
                reelEvent.visible = visible;
                this.dispatchEvent(reelEvent);
            };
            /**
             * @inheritdoc
             * @param symbols @inheritdoc
             */
            GsapReelModel.prototype.cancelSpin = function (symbols) {
                TweenMax.killTweensOf(this);
                this.updateSymbols(symbols);
                this.resetReel();
            };
            /**
             * Get the calculated distance to travel for the decelleration phase
             */
            GsapReelModel.prototype.getDeccDistance = function () {
                return this._animation.constSpeed * this._animation.deccelDuration - 1;
            };
            /**
             * Render the reel
             * @param distance poisition to render at
             */
            GsapReelModel.prototype.render = function (distance) {
                var reelEvent = new barcrest.ReelEvent(barcrest.ReelEvent.ON_RENDER, this._reelSetConfig);
                reelEvent.reelId = this._reelId;
                reelEvent.distance = distance;
                reelEvent.renderSymbolsList = this._renderSymbolsList;
                reelEvent.motionStage = this._motionStage;
                reelEvent.loopSectionLength = this._loopSectionLength;
                reelEvent.activeSymbolMap = this._activeSymbolMap;
                this.dispatchEvent(reelEvent);
            };
            /**
             * Reverses the order of an array
             * @param array The array to reverse
             */
            GsapReelModel.prototype.reverseArray = function (a) {
                var out = new Array();
                for (var i = 0; i < a.length; i++) {
                    out.push(a[a.length - i - 1]);
                }
                return out;
            };
            /**
             * Returns a number in range 0.0 - max
             * deal with range : n > -2*max    n < infinity
             * @param	n Number to wrap
             * @param	max Maximum value the number can be before wrapping round to 0
             */
            GsapReelModel.prototype.wrapTo = function (n, max) {
                n += 2 * max; // ensure non negative
                return n % max;
            };
            /**
             * Dispatches an event for the current phase
             */
            GsapReelModel.prototype.emitStageChangeEvent = function () {
                var reelEvent = new barcrest.ReelEvent(barcrest.ReelEvent.ON_STAGE_CHANGE, this._reelSetConfig);
                reelEvent.reelId = this._reelId;
                reelEvent.motionStage = this._motionStage;
                this.dispatchEvent(reelEvent);
            };
            /**
             * Reset's the reel so it can be spun again
             */
            GsapReelModel.prototype.resetReel = function () {
                this._distance = 0;
                this._motionStage = barcrest.ReelStages.STAGE_INIT;
                this.emitStageChangeEvent();
                this.createInitialList();
                this.render(0);
            };
            /**
             * Handles moving to the decelleration phase once the reel is in the constant phase
             */
            GsapReelModel.prototype.onCompleteSpin = function () {
                if (this._motionStage == barcrest.ReelStages.STAGE_CONST) {
                    TweenMax.killTweensOf(this);
                    this.beginDecceleration();
                }
                else {
                    TweenMax.delayedCall(.1, this.onCompleteSpin, [], this, false);
                }
            };
            /**
             * Callback for animation tweens
             */
            GsapReelModel.prototype.onUpdate = function () {
                this.render(this._distance);
            };
            /**
             * Begins the acceleration phase of the reels
             */
            GsapReelModel.prototype.beginAcceleration = function () {
                this._motionStage = barcrest.ReelStages.STAGE_ACC;
                this.emitStageChangeEvent();
                this.animateReels(this._animation.accelDuration, this._animation.constSpeed * this._animation.accelDuration, this._animation.accelEase, this.beginConstant);
            };
            /**
             * Begins the constant phase of the reels
             */
            GsapReelModel.prototype.beginConstant = function () {
                this._motionStage = barcrest.ReelStages.STAGE_CONST;
                this.emitStageChangeEvent();
                var dur = 1;
                this.animateReels(dur, this._distance + this._animation.constSpeed * dur * 1.75, Linear.easeNone, this.onConstantComplete);
            };
            /**
             * Begins the decceleration phase of the reels
             */
            GsapReelModel.prototype.beginDecceleration = function () {
                this._motionStage = barcrest.ReelStages.STAGE_DECC;
                this.createFinalSymbolList();
                this.emitStageChangeEvent();
                this.animateReels(this._animation.deccelDuration, this._calculatedDistance + this._animation.snapOffset, this._animation.deccelEase, this.beginSnap);
            };
            /**
             * Begins the snap phase of the reels
             */
            GsapReelModel.prototype.beginSnap = function () {
                this._motionStage = barcrest.ReelStages.STAGE_SNAP;
                this.emitStageChangeEvent();
                this.animateReels(this._animation.snapDuration, this._calculatedDistance, this._animation.snapEase, this.onSnapComplete);
            };
            /**
             * Begins an GSAP animation for the reels
             */
            GsapReelModel.prototype.animateReels = function (duration, distance, ease, onComplete) {
                TweenMax.to(this, duration, {
                    _distance: distance,
                    ease: ease,
                    onComplete: onComplete,
                    onCompleteScope: this,
                    onUpdate: this.onUpdate,
                    onUpdateScope: this
                });
            };
            /**
             * Updates reels to end symbols and dispatches ReelEvent.ON_COMPLETE after the final phase
             */
            GsapReelModel.prototype.onSnapComplete = function () {
                this._motionStage = barcrest.ReelStages.STAGE_ENDING;
                this.updateSymbols(this.reverseArray(this._endSymbols));
                this.emitStageChangeEvent();
                this.dispatchEvent(new barcrest.ReelEvent(barcrest.ReelEvent.ON_COMPLETE, this._reelSetConfig));
            };
            /**
             * Redoes the constant animation again until completeSpin() is called
             */
            GsapReelModel.prototype.onConstantComplete = function () {
                this.beginConstant();
            };
            /**
             * Creates the final symbol list to be rendered when stopping the reels
             */
            GsapReelModel.prototype.createFinalSymbolList = function () {
                this._calculatedDistance = Math.ceil(this._distance + this.getDeccDistance());
                var newRenderSymbolList = [];
                var noSymbolsToAdd = this._calculatedDistance;
                var i;
                for (i = 0; i < noSymbolsToAdd; i++) {
                    var indx = i; //Math.floor(this.positionOffset) + (i - this.calculatedTargetStep + this.calculatedDeccelerationSteps);
                    newRenderSymbolList.push(this._renderSymbolsList[this.wrapTo(indx, this._renderSymbolsList.length)]);
                }
                for (i = 0; i < this._reelSetConfig.symbolsPerReel[this._reelId]; i++) {
                    newRenderSymbolList.push(this._endSymbols[i]);
                }
                for (i = 0; i < 5; i++) {
                    newRenderSymbolList.push(this.getRandomSymbolIndex());
                }
                this._renderSymbolsList = newRenderSymbolList;
            };
            /**
             * Creates a symbol list to be rendered when spinning the reels
             */
            GsapReelModel.prototype.createInitialList = function () {
                this.reverseArray(this._renderSymbolsList);
                var i = 0;
                var stripIndex = Math.ceil(Math.random() * this._activeReelSetDefinition.symbols[this._reelId].length);
                for (i = 0; i < this._activeReelSetDefinition.symbols[this._reelId].length; i++) {
                    stripIndex++;
                    if (stripIndex >= this._activeReelSetDefinition.symbols[this._reelId].length) {
                        stripIndex = 0;
                    }
                    this._renderSymbolsList.push(this._activeReelSetDefinition.symbols[this._reelId][stripIndex]);
                }
                for (i = 0; i < this._reelSetConfig.symbolsPerReel[this._reelId] + 1; i++) {
                    this._renderSymbolsList.push(this._renderSymbolsList[this._renderSymbolsList.length - this._loopSectionLength]);
                }
            };
            /**
             * Gets a random symbol for the current reel set
             */
            GsapReelModel.prototype.getRandomSymbolIndex = function () {
                var index = Math.floor(Math.random() * this._activeReelSetDefinition.symbols[this._reelId].length);
                return this._activeReelSetDefinition.symbols[this._reelId][index];
            };
            return GsapReelModel;
        })(borgevent.EventDispatcher);
        barcrest.GsapReelModel = GsapReelModel;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class ReelSetData
         *
         * @description Contains all the symbols for a reel set
         */
        var ReelSetData = (function () {
            /**
             * Creates a new ReelSet object
             * @param symbols 2d array of symbols for the reels
             */
            function ReelSetData(symbols) {
                this._symbols = symbols;
            }
            Object.defineProperty(ReelSetData.prototype, "symbols", {
                /**
                 * 2d array of symbols for the reels
                 */
                get: function () {
                    return this._symbols;
                },
                enumerable: true,
                configurable: true
            });
            return ReelSetData;
        })();
        barcrest.ReelSetData = ReelSetData;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class ReelSetModel
         *
         * @description Handles spinning, stopping and updating a set of reels
         */
        var ReelSetModel = (function (_super) {
            __extends(ReelSetModel, _super);
            /**
             * Creates a new ReelSetModel object
             * @param config The configuration data for the reels
             */
            function ReelSetModel(config) {
                if (config === void 0) { config = null; }
                _super.call(this);
                /**
                 * Order in which to spin each reel
                 */
                this.spinOrderArray = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                this._config = (config == null) ? new barcrest.ReelSetVO() : config;
            }
            Object.defineProperty(ReelSetModel.prototype, "reels", {
                /**
                 * @inheritdoc
                 */
                get: function () {
                    return this._reels;
                },
                enumerable: true,
                configurable: true
            });
            /**
             * @inheritdoc
             */
            ReelSetModel.prototype.init = function () {
                this._reels = new Array();
                for (var i = 0; i < this._config.reelCount; i++) {
                    this._reels[i] = new barcrest.GsapReelModel(this._config, i, this._config.animationClasses ? new this._config.animationClasses[i]() : new this._config.animationClass());
                    this._reels[i].addEventListener(barcrest.ReelEvent.ON_STAGE_CHANGE, this.onReelStageChange, this);
                    this._reels[i].addEventListener(barcrest.ReelEvent.ON_START, this.onReelStart, this);
                }
                this._reelSound = null;
                this.staggerEndTimes = this._config.staggerEndTimesPerReel;
                this.staggerStartTime = this._config.staggerTimePerReel;
                var reelSetEvent = new barcrest.ReelSetEvent(barcrest.ReelSetEvent.ON_INIT, this._config);
                reelSetEvent.reels = this.reels;
                this.dispatchEvent(reelSetEvent);
                this.updateSymbols(this._config.defaultSymbols);
            };
            /**
             * @inheritdoc
             * @param symbolMatrix @inheritdoc
             * @param updateEndSymbols @inheritdoc
             */
            ReelSetModel.prototype.updateSymbols = function (symbolMatrix, updateEndSymbols) {
                if (updateEndSymbols === void 0) { updateEndSymbols = false; }
                if (updateEndSymbols) {
                    this.endSymbolMatrix = symbolMatrix;
                }
                var r;
                for (var i = 0; i < this._reels.length; i++) {
                    r = this._reels[i];
                    r.updateSymbols(symbolMatrix[i], updateEndSymbols);
                }
            };
            /**
             * @inheritdoc
             * @param spinOrder @inheritdoc
             */
            ReelSetModel.prototype.startSpin = function (spinOrder) {
                if (spinOrder === void 0) { spinOrder = null; }
                //Store the order in which the reels will trigger/stop
                this.spinOrderArray = new Array();
                for (var i = 0; i < this._config.reelCount; i++) {
                    this.spinOrderArray[i] = spinOrder ? spinOrder[i] : i;
                }
                this.completeSpinWaiting = false;
                this._spinCompleteCount = 0;
                this._staggerStartCompleteCount = 0;
                this._staggerEndCompleteCount = 0;
                this.onStaggerStart();
                this._staggerTimer = new TimelineMax({ repeat: -1, repeatDelay: this.staggerStartTime, delay: this.staggerStartTime, onRepeat: this.onStaggerStart, onRepeatScope: this });
            };
            /**
             * @inheritdoc
             * @param reelIndex @inheritdoc
             * @param animation @inheritdoc
             */
            ReelSetModel.prototype.changeReelAnimation = function (reelIndex, animation) {
                var r = this._reels[reelIndex];
                r.changeAnimObj(animation);
            };
            /**
             * @inheritdoc
             */
            ReelSetModel.prototype.getStaggerEndTimes = function () {
                return this.staggerEndTimes;
            };
            /**
             * @inheritdoc
             * @param startStaggerTime @inheritdoc
             * @param endStaggerTimes @inheritdoc
             */
            ReelSetModel.prototype.setStaggerTimes = function (startStaggerTime, endStaggerTimes) {
                this.staggerStartTime = startStaggerTime;
                this.staggerEndTimes = endStaggerTimes;
            };
            /**
             * @inheritdoc
             * @param symbolMatrix @inheritdoc
             */
            ReelSetModel.prototype.completeSpin = function (symbolMatrix) {
                var defaultStaggerTimer;
                this.endSymbolMatrix = symbolMatrix;
                var extraStaggerTime = 0;
                this._endStaggerTimer = new TimelineMax({ repeat: 1, delay: this.staggerEndTimes[0], onUpdate: this.onStaggerEnd, onUpdateScope: this });
            };
            /**
             * @inheritdoc
             * @param reelSetIndex @inheritdoc
             * @param positions @inheritdoc
             * @param delay @inheritdoc
             * @param stopOffsets @inheritdoc
             */
            ReelSetModel.prototype.stop = function (reelSetIndex, positions, delay, stopOffsets) {
                var _this = this;
                if (delay === void 0) { delay = 1; }
                if (stopOffsets === void 0) { stopOffsets = [-1, 0, 1]; }
                var reelSet = this._config.reelSetDefinition.getReelSet(0).symbols;
                var symbolMatrix = [];
                for (var i = 0; i < positions.length; i++) {
                    symbolMatrix[i] = [];
                    for (var j = 0; j < stopOffsets.length; j++) {
                        var index = positions[i] + stopOffsets[j];
                        index = index > reelSet[i].length - 1 ? 0 : index;
                        index = index < 0 ? reelSet[i].length - 1 : index;
                        symbolMatrix[i][j] = reelSet[i][index]; //, reelSet[i][positions[i+1]], reelSet[i][positions[i+2]
                    }
                }
                if (delay > 0) {
                    TweenMax.delayedCall(delay, function () { _this.completeSpin(symbolMatrix); });
                }
                else {
                    this.completeSpin(symbolMatrix);
                }
            };
            /**
             * @inheritdoc
             * @param symbolMatrix @inheritdoc
             */
            ReelSetModel.prototype.cancelSpin = function (symbolMatrix) {
                if (this._staggerTimer)
                    this._staggerTimer.kill();
                if (this._endStaggerTimer)
                    this._endStaggerTimer.kill();
                if (this._reelSound) {
                    this._reelSound.stop();
                }
                for (var i = 0; i < this._reels.length; i++) {
                    this._reels[i].cancelSpin(symbolMatrix[i]);
                }
            };
            /**
             * @inheritdoc
             * @param removedSymbolMatrix @inheritdoc
             */
            ReelSetModel.prototype.removeSymbols = function (removedSymbolMatrix) {
                var r;
                for (var i = 0; i < this._reels.length; i++) {
                    r = this._reels[i];
                    r.removeSymbols(removedSymbolMatrix[i]);
                }
            };
            /**
             * @inheritdoc
             * @param index @inheritdoc
             */
            ReelSetModel.prototype.changeReelSets = function (index) {
                for (var i = 0; i < this._reels.length; i++) {
                    var aReel = this._reels[i];
                    aReel.changeReelSet(index);
                }
            };
            /**
             * @inheritdoc
             * @param index @inheritdoc
             */
            ReelSetModel.prototype.changeReelSymbolSets = function (index) {
                for (var i = 0; i < this._reels.length; i++) {
                    var aReel = this._reels[i];
                    aReel.changeReelSymbolSet(index);
                }
            };
            /**
             * Callback for the spin stagger timer to start each reel spinning
             */
            ReelSetModel.prototype.onStaggerStart = function () {
                // set next reel in motion
                if (this._staggerStartCompleteCount != this._reels.length) {
                    var i = this.spinOrderArray[this._staggerStartCompleteCount];
                    var r = this._reels[i];
                    r.startSpin();
                    this._staggerStartCompleteCount++;
                }
                // on end of all reels start
                if (this._staggerStartCompleteCount == this._reels.length) {
                    if (this._config.reelSpinLoopSound != null) {
                        this._reelSound = new audio.AudioSound(this._config.reelSpinLoopSound);
                        this._reelSound.play();
                    }
                    this._staggerTimer.kill();
                    if (this.completeSpinWaiting) {
                        this.completeSpin(this.endSymbolMatrix);
                    }
                }
            };
            /**
             * Callback for the end stagger timer to stop each reel spinning
             */
            ReelSetModel.prototype.onStaggerEnd = function () {
                if (this._staggerEndCompleteCount != this._reels.length) {
                    //(_reels[_staggerEndCompleteCount] as Reel).completeSpin( endSymbolMatrix[_staggerEndCompleteCount]);
                    //Get the index for which reel to stop
                    var i = this.spinOrderArray[this._staggerEndCompleteCount];
                    (this._reels[i]).completeSpin(this.endSymbolMatrix[i]);
                    this._staggerEndCompleteCount++;
                    if (this._staggerEndCompleteCount < this._reels.length) {
                        // this._endStaggerTimer.stop();
                        this._endStaggerTimer.kill();
                        this._endStaggerTimer = new TimelineMax({ repeat: 1, delay: this.staggerEndTimes[this._staggerEndCompleteCount], onUpdate: this.onStaggerEnd, onUpdateScope: this });
                    }
                    else {
                        this._endStaggerTimer.kill();
                    }
                }
                else {
                    this.completeSpinWaiting = true;
                }
            };
            /**
             * Disptaches ReelSetEvent.ON_REEL_STARTED each time a reel starts spinning
             * @param event ReelEvent.ON_START
             */
            ReelSetModel.prototype.onReelStart = function (event) {
                var reelSetEvent = new barcrest.ReelSetEvent(barcrest.ReelSetEvent.ON_REEL_STARTED, this._config);
                reelSetEvent.reelId = event.reelId;
                this.dispatchEvent(reelSetEvent);
            };
            /**
             * Dispatches ReelEvent's for different phases of each reel
             * @param event ReelEvent.ON_STAGE_CHANGE
             */
            ReelSetModel.prototype.onReelStageChange = function (event) {
                var reelSetEvent;
                if (event.motionStage == barcrest.ReelStages.STAGE_SNAP) {
                    this.playReelStopSound(event.reelId);
                    if (this.isValidScatter(event.reelId) && this.checkBitmask(event.reelId)) {
                        reelSetEvent = new barcrest.ReelSetEvent(barcrest.ReelSetEvent.ON_VALID_SCATTER_HIT, this._config);
                        reelSetEvent.reelId = event.reelId;
                        this.dispatchEvent(reelSetEvent);
                    }
                    reelSetEvent = new barcrest.ReelSetEvent(barcrest.ReelSetEvent.ON_REEL_SNAP, this._config);
                    reelSetEvent.reelId = event.reelId;
                    this.dispatchEvent(reelSetEvent);
                }
                if (event.motionStage == barcrest.ReelStages.STAGE_ENDING) {
                    this._spinCompleteCount++;
                    reelSetEvent = new barcrest.ReelSetEvent(barcrest.ReelSetEvent.ON_SPIN_COMPLETE, this._config);
                    reelSetEvent.reelId = event.reelId;
                    reelSetEvent.allComplete = false;
                    this.dispatchEvent(reelSetEvent);
                }
                if (this._spinCompleteCount == this._reels.length) {
                    if (this._reelSound != null) {
                        this._reelSound.stop();
                    }
                    reelSetEvent = new barcrest.ReelSetEvent(barcrest.ReelSetEvent.ON_SPIN_COMPLETE, this._config);
                    reelSetEvent.reelId = event.reelId;
                    reelSetEvent.allComplete = true;
                    this.dispatchEvent(reelSetEvent);
                }
            };
            /**
             * Plays the reel stop sound or scatter sound
             * @param currentReel The index of the reel
             */
            ReelSetModel.prototype.playReelStopSound = function (currentReel) {
                if (this.isValidScatter(currentReel) && this.checkBitmask(currentReel)) {
                    new audio.AudioSound(this._config.scatterHitSounds[currentReel]).play();
                }
                else {
                    if (this._config.reelStopSounds != null) {
                        new audio.AudioSound(this._config.reelStopSounds[currentReel]).play();
                    }
                }
            };
            /**
             * Checks if a reel has a valid scatter
             * @param currentReel The index of the reel
             */
            ReelSetModel.prototype.isValidScatter = function (currentReel) {
                var isValid = false;
                if (this._config.scatterSymbolID == -1)
                    return false;
                if (this._config.scatterHitSounds == null)
                    return false;
                for (var i = 0; i < this._config.scatterMasks.length; i++) {
                    var t = this._config.scatterMasks[i].toString().slice(0, currentReel + 1).split("");
                    var s = this.getScatterMask().slice(0, currentReel + 1);
                    if (t.toString() == s.toString()) {
                        isValid = true;
                        break;
                    }
                }
                return isValid;
            };
            /**
             * Checks a reel's bitmask
             * @param id The id of the reel to check
             */
            ReelSetModel.prototype.checkBitmask = function (id) {
                var valid = false;
                var t = this.getScatterMask();
                if (t[id] == "X") {
                    valid = true;
                }
                return valid;
            };
            /**
             * Get's a scatter mask
             */
            ReelSetModel.prototype.getScatterMask = function () {
                var scatterMask = this._config.scatterMaskDefault.concat();
                var symbol;
                for (var i = 0; i < this._config.reelCount; i++) {
                    var a = this.endSymbolMatrix[i];
                    for (var j = 0; j < a.length; j++) {
                        symbol = a[j];
                        if (symbol == this._config.scatterSymbolID) {
                            scatterMask[i] = "X";
                        }
                    }
                }
                return scatterMask;
            };
            return ReelSetModel;
        })(borgevent.EventDispatcher);
        barcrest.ReelSetModel = ReelSetModel;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class ReelSetVO
         *
         * @description Configuration data for a reel set
         */
        var ReelSetVO = (function () {
            function ReelSetVO() {
                /**
                 * Position of the reels
                 */
                this.x = 0;
                /**
                 * Position of the reels
                 */
                this.y = 0;
                /**
                 * Amount of symbols displayed on each reel
                 */
                this.symbolsPerReel = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
                /**
                 * Width for individual symbols
                 */
                this.symbolWidth = 100;
                /**
                 * Height for individual symbols
                 */
                this.symbolHeight = 75;
                /**
                 * Class that draws each reel
                 */
                this.reelViewClass = barcrest.SpriteReelView;
                /**
                 * Y offset for each reel
                 */
                this.reelOffsets = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                /**
                 * Default symbols to be dispayed when first displayed
                 */
                this.reelSpacing = 10;
                /**
                 * Delay between individual reels spinning
                 */
                this.defaultSymbols = [[0, 4, 6, 7], [6, 1, 5, 2], [0, 0, 5, 4], [7, 3, 2, 5], [1, 3, 2, 5]];
                /**
                 * Animation class for handling the spin
                 */
                this.animationClass = barcrest.StandardReelAnimation;
                /**
                 * Reel model that handles the reel functionality
                 */
                this.reelClass = barcrest.GsapReelModel;
                /**
                 * Horizontal spacing between reels
                 */
                this.staggerTimePerReel = 0.1;
                /**
                 * Delay between individual reels stopping
                 */
                this.staggerEndTimesPerReel = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]; //used for multi endtimes only
                /**
                 * Default scatter mask when creating a scatter comparison e.g. ["O", "O", "O", "O", "O"]
                 */
                this.scatterMaskDefault = [];
                /**
                 * List of scatter masks for the reel in ["X", "O", "X", "O", "X"] were X is a scatter position
                 */
                this.scatterMasks = [];
                /**
                 * Symbol id for the scatter
                 */
                this.scatterSymbolID = -1;
            }
            Object.defineProperty(ReelSetVO.prototype, "reelCount", {
                /**
                 * Get's the total number of reels
                 */
                get: function () {
                    return this.reelSetDefinition.getReelSet(0).symbols.length;
                },
                enumerable: true,
                configurable: true
            });
            return ReelSetVO;
        })();
        barcrest.ReelSetVO = ReelSetVO;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class ReelSetsData
         *
         * @description Contains all the reels and their symbols
         */
        var ReelSetsData = (function () {
            /**
             * Creates a new ReelSets object
             * @param reelSets List of reel sets for the game
             */
            function ReelSetsData(reelSets) {
                if (reelSets === void 0) { reelSets = []; }
                this._reelSets = reelSets;
            }
            /**
             * Add a reel set data to the list
             * @param reelSet The reel set data
             */
            ReelSetsData.prototype.addReelSet = function (reelSet) {
                this._reelSets.push(reelSet);
            };
            Object.defineProperty(ReelSetsData.prototype, "reelSets", {
                /**
                 * Get all the available reel sets for the game
                 */
                get: function () {
                    return this._reelSets;
                },
                enumerable: true,
                configurable: true
            });
            /**
             * Get a specific reel set for the game
             * @param index The index of the reel set data
             */
            ReelSetsData.prototype.getReelSet = function (index) {
                return this._reelSets[index];
            };
            Object.defineProperty(ReelSetsData.prototype, "total", {
                /**
                 * Get the total amount of reel sets available
                 */
                get: function () {
                    return this._reelSets.length;
                },
                enumerable: true,
                configurable: true
            });
            return ReelSetsData;
        })();
        barcrest.ReelSetsData = ReelSetsData;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @enum ReelStages
         *
         * @description Reel stages enumeration
         */
        (function (ReelStages) {
            ReelStages[ReelStages["STAGE_INIT"] = 0] = "STAGE_INIT";
            ReelStages[ReelStages["STAGE_ACC"] = 1] = "STAGE_ACC";
            ReelStages[ReelStages["STAGE_CONST"] = 2] = "STAGE_CONST";
            ReelStages[ReelStages["STAGE_DECC"] = 3] = "STAGE_DECC";
            ReelStages[ReelStages["STAGE_SNAP"] = 4] = "STAGE_SNAP";
            ReelStages[ReelStages["STAGE_ENDING"] = 5] = "STAGE_ENDING";
        })(barcrest.ReelStages || (barcrest.ReelStages = {}));
        var ReelStages = barcrest.ReelStages;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class SymbolMap
         *
         * @description Contains a symbol map for the game
         */
        var SymbolMap = (function () {
            /**
             * Creates a new SymbolMap object
             * @param symbols Ordered list of symbol id's
             */
            function SymbolMap(symbols) {
                this._symbols = symbols;
            }
            Object.defineProperty(SymbolMap.prototype, "symbols", {
                /**
                 * Ordered list of symbol id's
                 */
                get: function () {
                    return this._symbols;
                },
                enumerable: true,
                configurable: true
            });
            return SymbolMap;
        })();
        barcrest.SymbolMap = SymbolMap;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class SymbolMapSet
         *
         * @description Contains all the symbol maps for a game
         */
        var SymbolMapSet = (function () {
            /**
             * Creates a new SymbolMapSet object
             * @param symbols List of symbol maps for the game, most only have one
             */
            function SymbolMapSet(symbols) {
                if (symbols === void 0) { symbols = []; }
                this._symbols = symbols;
            }
            /**
             * Add a symbol map to the game
             */
            SymbolMapSet.prototype.addSymbols = function (symbols) {
                this._symbols.push(symbols);
            };
            Object.defineProperty(SymbolMapSet.prototype, "symbols", {
                /**
                 * List of symbol maps for the game, most only have one
                 */
                get: function () {
                    return this._symbols;
                },
                enumerable: true,
                configurable: true
            });
            /**
             * Get a specific symbol map for the game
             * @param index The index of the symbol map
             */
            SymbolMapSet.prototype.getSymbolSet = function (index) {
                return this._symbols[index];
            };
            Object.defineProperty(SymbolMapSet.prototype, "total", {
                /**
                 * Get the total number of symbol maps available
                 */
                get: function () {
                    return this._symbols.length;
                },
                enumerable: true,
                configurable: true
            });
            return SymbolMapSet;
        })();
        barcrest.SymbolMapSet = SymbolMapSet;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class ReelSetView
         *
         * @decsription Standard implementation of a reel set view
         *
         * Contains multiple IReelViews as children
         */
        var ReelSetView = (function (_super) {
            __extends(ReelSetView, _super);
            /**
             * Creates a new ReelSetView object
             */
            function ReelSetView() {
                _super.call(this);
            }
            /**
             * @inheritdoc
             * @param model @inheritdoc
             */
            ReelSetView.prototype.setModel = function (model) {
                this.model = model;
                this.model.addEventListener(barcrest.ReelSetEvent.ON_INIT, this.onInit, this);
            };
            Object.defineProperty(ReelSetView.prototype, "reels", {
                /**
                 * List of individual reel view
                 */
                get: function () {
                    return this._reels;
                },
                enumerable: true,
                configurable: true
            });
            /**
             * Set's up the individual reel views and adds them to the display
             * @param event ReelSetEvent.ON_INIT
             */
            ReelSetView.prototype.onInit = function (event) {
                this.x = event.config.x;
                this.y = event.config.y;
                this._reels = [];
                var r;
                for (var i = 0; i < event.config.reelCount; i++) {
                    r = new event.config.reelViewClass();
                    r.setModel(event.reels[i]);
                    event.reels[i].init();
                    r.x = i * (event.config.symbolWidth) + (i * event.config.reelSpacing);
                    r.y = event.config.reelOffsets[i];
                    this.addChild(r); //addChild(r);
                    this._reels[i] = r;
                }
            };
            return ReelSetView;
        })(rendering.DisplayObjectContainer);
        barcrest.ReelSetView = ReelSetView;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var barcrest;
    (function (barcrest) {
        /**
         * @class SpriteReelView
         *
         * @description Standard implementation of a reel view
         *
         * Uses MovieClips to display visible symbols
         */
        var SpriteReelView = (function (_super) {
            __extends(SpriteReelView, _super);
            /**
             * Creates a new SpriteReelView object
             * @param model Model that drives the view
             */
            function SpriteReelView() {
                _super.call(this);
            }
            /**
             * @inheritdoc
             * @param model @inheritdoc
             */
            SpriteReelView.prototype.setModel = function (model) {
                this._model = model;
                this._model.addEventListener(barcrest.ReelEvent.ON_INIT, this.onInit, this);
                this._model.addEventListener(barcrest.ReelEvent.ON_RENDER, this.onRender, this);
                this._model.addEventListener(barcrest.ReelEvent.ON_VISIBLE_CHANGED, this.onVisibleChange, this);
                this._model.addEventListener(barcrest.ReelEvent.ON_REMOVE, this.onRemove, this);
            };
            /**
             * Setup the reel
             * @param event ReelEvent.ON_INIT
             */
            SpriteReelView.prototype.onInit = function (event) {
                this._symbolFrames = event.config.symbolAssets;
                this.prepareSymbols(event.config, event.reelId);
            };
            /**
             * Render the symbols at the current distance
             * @param event ReelEvent.ON_RENDER
             */
            SpriteReelView.prototype.onRender = function (event) {
                var symbol = -1;
                var x = 0;
                var y = 0;
                var c = event.config.symbolsPerReel[event.reelId] + 1;
                var offset = event.distance - Math.ceil(event.distance) + 1; // symbol position       
                var symIndex;
                for (var i = 0; i < c; i++) {
                    y = (offset + i - 1) * event.config.symbolHeight;
                    symIndex = this.wrapSymbolsByPhase(Math.ceil(event.distance) + (event.config.symbolsPerReel[event.reelId] - 1) - i, event.config, event.renderSymbolsList, event.motionStage, event.loopSectionLength, event.config.symbolsPerReel[event.reelId], event.reelId);
                    symbol = event.renderSymbolsList[symIndex];
                    symbol = event.activeSymbolMap.symbols[symbol];
                    this._symbolClips[i].x = x;
                    this._symbolClips[i].y = y;
                    this._symbolClips[i].gotoAndStop(symbol);
                    this._symbolClips[i].visible = true;
                }
            };
            /**
             * Show/Hide the reel
             * @param event ReelEvent.ON_VISIBLE_CHANGED
             */
            SpriteReelView.prototype.onVisibleChange = function (event) {
                this.visible = event.visible;
            };
            /**
             * Remove an array of symbols from the reels
             */
            SpriteReelView.prototype.onRemove = function (event) {
                for (var i = 0; i < event.symbolsToRemove.length; i++) {
                    this._symbolClips[i].visible = event.symbolsToRemove[i] == 1;
                }
            };
            /**
             * Creates a set of movieclips for the amount of displayed symbols
             * Masks the symbols so they cut off when rendered outside the display area
             */
            SpriteReelView.prototype.prepareSymbols = function (config, index) {
                this._symbolClips = [];
                var spTemp;
                var masker = new rendering.Graphics();
                masker.beginFill(0x000000, 1);
                masker.drawRect(0, 0, config.symbolWidth, config.symbolHeight * config.symbolsPerReel[index]);
                this.addChild(masker);
                for (var j = 0; j < config.symbolsPerReel[index] + 1; j++) {
                    if (this._symbolFrames != null) {
                        spTemp = new rendering.MovieClip(this._symbolFrames);
                        spTemp.mask = masker;
                    }
                    spTemp.scaleX = config.symbolWidth / spTemp.width;
                    spTemp.scaleY = config.symbolHeight / spTemp.height;
                    this.addChild(spTemp);
                    this._symbolClips[j] = spTemp; //[i] = spTemp;
                }
            };
            /**
             * If symbolIndex < 0 then wrapped to other end
             * If symbolIndex > length then wrapped according to phase
             * 		if constant speed phase wrapped to beginning of constant section
             * 		else
             * 		wrapped to beginning
             */
            SpriteReelView.prototype.wrapSymbolsByPhase = function (symbolIndex, config, renderSymbolsList, motionStage, loopSectionLength, symbolsPerReel, reelId) {
                if (motionStage == barcrest.ReelStages.STAGE_CONST) {
                    return config.symbolsPerReel[reelId] + 1 + this.wrapTo(symbolIndex - (config.symbolsPerReel[reelId] + 1), config.symbolsPerReel[reelId] + 1 + loopSectionLength);
                }
                return this.wrapTo(symbolIndex, renderSymbolsList.length);
            };
            /**
             * Returns a number in range 0.0 - max
             * deal with range : n > -2*max    n < infinity
             * @param	n Number to wrap
             * @param	max Maximum value the number can be before wrapping round to 0
             */
            SpriteReelView.prototype.wrapTo = function (n, max) {
                n += 2 * max; // ensure non negative
                return n % max;
            };
            return SpriteReelView;
        })(rendering.DisplayObjectContainer);
        barcrest.SpriteReelView = SpriteReelView;
    })(barcrest = reels.barcrest || (reels.barcrest = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @class Layout
         *
         * @description Displays symbols for reels in a configured layout
         */
        var Layout = (function (_super) {
            __extends(Layout, _super);
            /**
             * Create a new Layout object
             *
             * @param  reel  the logical reel
             * @param  symbolSet  source of symbol images
             * @param  anchor  parent of all symbols
             * @param  symbols  symbol actors
             * @param  bounds  rect used for reel bounds
             */
            function Layout(reel, symbolSet, symbols) {
                _super.call(this);
                this.reel = reel;
                this.symbolSet = symbolSet;
                this.anchor = new rendering.DisplayObjectContainer();
                //
                this.bottomLayer = new rendering.DisplayObjectContainer();
                this.topLayer = new rendering.DisplayObjectContainer();
                this.symbols = symbols;
                this.symbolWindow = new Array();
                this.symbolWindow.length = this.symbols.length;
                this.stopWindow = new Array();
                this.stopWindow.length = this.symbols.length;
                this.spacingY = 0;
                this.symbolOffsets = new Array();
                this.refreshSymbols();
                this.addChild(this.anchor);
                this.anchor.addChild(this.bottomLayer);
                this.anchor.addChild(this.topLayer);
                this._symbolSet = symbolSet;
                var clip = new rendering.Graphics();
                clip.beginFill(0, 1);
                clip.drawRect(0, this.symbolSet.height, this.getBounds().width, this.getBounds().height);
                clip.endFill();
                this.interactive = false;
                //this.anchor.addChild(clip);
                this.updateSymbols(symbols);
            }
            /**
             * Create a background image to animate behind the symbols.
             *
             * @param  reelBackground  An image asset to use as a bitmap.
             */
            Layout.prototype.createReelBackground = function (reelBackground) {
                var displayObject = this.children[0];
                this.children.splice(0, 1);
                // use two backgrounds for each reel, one in the reel frame and one above it
                for (var i = 0; i < 2; i++) {
                    var reelBG = new rendering.Bitmap(reelBackground);
                    reelBG.x = this.anchor.x;
                    reelBG.y = reelBG.height * (i - 1) + this.symbolSet.height;
                    this.addChild(reelBG);
                }
                // put the background underneath symbols
                this.addChild(displayObject);
            };
            /**
             * @inheritdoc
             *
             * @param {rendering.MovieClip[]} symbols @inheritdoc
             */
            Layout.prototype.updateSymbols = function (symbols) {
                for (var i = 0; i < this.symbols.length; i++) {
                    if (this.symbols[i].parent) {
                        this.symbols[i].parent.removeChild(this.symbols[i]);
                    }
                }
                this.symbols = symbols;
                for (var i = 0; i < this.symbols.length; i++) {
                    //this.anchor.addChild(this.symbols[i]);
                    this.bottomLayer.addChild(this.symbols[i]);
                    this.symbols[i].interactive = false;
                    this.symbols[i].scaleX = this._symbolSet.width / this.symbols[i].width;
                    this.symbols[i].scaleY = this._symbolSet.height / this.symbols[i].height;
                }
            };
            /**
             * Return the symbols used in the Layout.
             */
            Layout.prototype.getSymbols = function () {
                return this.symbols;
            };
            /**
             * Set the anchor offset as a multiple of the symbol size. For example, an offset of -1
             * on the y would move the anchor such that one full symbol is off-screen. The offset
             * is relative to the origin. The origin is in world coordinates.
             *
             * @param  originX  location on x axis if offsetX is 0
             * @param  originX  location on y axis if offsetY is 0
             * @param  spacingX  extra space on x to add to each symbol-sized step
             * @param  spacingY  extra space on y to add to each symbol-sized step
             * @param  offsetX  number of symbol-sized steps to take along x axis
             * @param  offsetY  number of symbol-sized steps to take along y axis
             */
            Layout.prototype.setOffset = function (originX, originY, spacingX, spacingY, offsetX, offsetY) {
                this.spacingY = spacingY;
                this.anchor.x = Math.floor(originX + (offsetX * (this.symbolSet.width + spacingX)));
                this.anchor.y = Math.floor(originY + (offsetY * (this.symbolSet.height + spacingY)));
            };
            /**
             * Set the distance to offset a symbol. This is used to
             * make a symbol overlap the neighboring symbol. Positive numbers offset up.
             */
            Layout.prototype.setSymbolOffset = function (symbolId, offset) {
                this.symbolOffsets[symbolId] = offset;
            };
            /**
             * Get the bounding rect that contains the visible portion of the reel
             */
            Layout.prototype.getBounds = function () {
                var w = this.symbolSet.width;
                var h = this.symbolSet.height;
                var spacing = this.spacingY;
                var visible = this.symbolWindow.length - 2;
                var rect = new util.Rect();
                rect.x = this.anchor.x;
                rect.y = this.anchor.y;
                rect.width = w;
                rect.height = (h + spacing) * visible;
                return rect;
            };
            /**
             * Get the unscaled bounding rect that contains the visible portion of the reel
             */
            Layout.prototype.getUnscaledBounds = function () {
                var w = this.symbolSet.width;
                var h = this.symbolSet.height;
                var visible = this.symbolWindow.length - 2;
                return { x: this.anchor.x, y: this.anchor.y, w: w, h: h * visible };
            };
            /**
             * Set the anchor visibility
             *
             * @param  visible  the visibility
             */
            Layout.prototype.setVisible = function (visible) {
                this.anchor.visible = visible;
            };
            /**
             * Position symbols in proper locations using default order (order of actors
             * when setSymbols was called)
             */
            Layout.prototype.layout = function () {
                this.endPosition = this.getSymbolPosition(this.symbols.length);
                for (var i = 0; i < this.symbols.length; ++i) {
                    this.symbols[i].x = 0;
                    this.symbols[i].y = this.getSymbolPosition(i);
                }
            };
            /**
             * Set correct images on symbol actors
             *
             * @param  symbolOrder  list of indices into symbol array that represent the order
             *                      symbol actors appear on-screen
             */
            Layout.prototype.swapSymbols = function (symbolOrder) {
                this.reel.getSymbolWindow(this.symbolWindow);
                for (var i = 0; i < this.symbolWindow.length; ++i) {
                    var symbol = this.getSymbolActor(i, symbolOrder);
                    var symId = this.symbolWindow[i];
                    var frame = this.symbolSet.getSymbol(symId);
                    // Select layer based on symbol size.
                    /*var oversized = this.symbolSet.isOversized(symId);
                    if (oversized) {
                        this.topLayer.addChild(symbol);
                    } else {
                        this.bottomLayer.addChild(symbol);
                    }*/
                    symbol.gotoAndStop(frame);
                    //Update the symbol offset
                    if (this.symbolOffsets[symId] != undefined) {
                        //symbol.getTransform().setZOrder(1);
                        //symbol.getTransform().setPivotY(this.symbolOffsets[symId]);
                        //symbol.y = this.symbolOffsets[symId];
                        //console.log(this.symbolOffsets[symId]);
                        symbol.pivot = new rendering.Point(0, this.symbolOffsets[symId]);
                        this.bottomLayer.addChild(symbol);
                    }
                    else {
                        // symbol.getTransform().setZOrder(0);
                        //symbol.getTransform().setPivotY(0);
                        symbol.pivot = new rendering.Point(0, 0);
                    }
                }
            };
            /**
             * Set the image of a symbol actor from symbol id
             */
            Layout.prototype.setSymbol = function (windowIndex, symbolId, symbolOrder) {
                var symbol = this.getSymbolActor(windowIndex, symbolOrder);
                var frame = this.symbolSet.getSymbol(symbolId);
                // Select layer based on symbol size.
                var oversized = this.symbolSet.isOversized(symbolId);
                if (oversized) {
                    this.topLayer.addChild(symbol);
                }
                else {
                    this.bottomLayer.addChild(symbol);
                }
                symbol.gotoAndStop(frame);
            };
            /**
             * Set the current index
             *
             * @param  index  the current index
             * @param  symbolOrder  list of indices into symbol array that represent the order
             *                      symbol actors appear on-screen
             */
            Layout.prototype.setCurrentIndex = function (index, symbolOrder) {
                this.reel.setCurrentIndex(index);
                this.swapSymbols(symbolOrder);
            };
            /**
             * Advance the logical reels and refresh the symbols
             *
             * @param  advanceAmount  number of steps to take in the logical reel
             * @param  symbolOrder  list of indices into symbol array that represent the order
             *                      symbol actors appear on-screen
             */
            Layout.prototype.advance = function (advanceAmount, symbolOrder) {
                this.reel.advance(advanceAmount);
                this.swapSymbols(symbolOrder);
            };
            /**
             * Put the reel into splice mode
             *
             * @param  stopIndex  index in strip space to base splicing on
             * @param  forward  true if splicing should happen forward on the strip
             */
            Layout.prototype.startSplicing = function (stopIndex, forward) {
                return this.reel.startSplicing(stopIndex, forward);
            };
            /**
             * Get the position that represents the first place a symbol should be during a spin
             */
            Layout.prototype.getStartPosition = function () {
                //Not especially useful right now since the start is always zero,
                //but this magic number is better here rather than in Controller
                //so the Controller won't have to change if this condition changes. - Robby
                return 0;
            };
            /**
             * Get the position that represents the last place a symbol should be during a spin
             */
            Layout.prototype.getEndPosition = function () {
                return this.endPosition;
            };
            /**
             * Get the number of symbol actors in the symbol window
             */
            Layout.prototype.getWindowSize = function () {
                return this.symbolWindow.length;
            };
            /**
             * Get the width of symbols
             */
            Layout.prototype.getSymbolWidth = function () {
                return this.symbolSet.width;
            };
            /**
             * Get the height of symbols
             */
            Layout.prototype.getSymbolHeight = function () {
                return this.symbolSet.height;
            };
            /**
             * Get the space between symbols
             */
            Layout.prototype.getSymbolSpacing = function () {
                return this.spacingY;
            };
            /**
             * Get the symbol actor that's at the given index
             *
             * @param  windowIndex  index of symbol actor in symbol window
             * @param  symbolOrder  list of indices into symbol array that represent the order
             *                      symbol actors appear on-screen
             */
            Layout.prototype.getSymbolActor = function (windowIndex, symbolOrder) {
                return this.symbols[symbolOrder[windowIndex]];
            };
            /**
             * Get the symbol id that's at the given index
             *
             * @param  windowIndex  index of symbol in symbol window
             */
            Layout.prototype.getSymbolId = function (windowIndex) {
                var result;
                if (windowIndex < 0 || windowIndex >= this.symbolWindow.length) {
                    result = this.reel.getSymbolId(windowIndex);
                }
                else {
                    result = this.symbolWindow[windowIndex];
                }
                return result;
            };
            /**
             * Predict the symbol ids that will be in the window once the reel stops
             *
             * @param  stopIndex  the stop index
             * @param  range  the array to populate with the symbol ids
             */
            Layout.prototype.getStopWindow = function (stopIndex, range) {
                this.reel.getStopWindow(stopIndex, range);
            };
            /**
             * Get the position of a symbol on the reel
             *
             * @param  windowIndex  index of symbol actor in symbol window
             */
            Layout.prototype.getSymbolPosition = function (windowIndex) {
                return this.getStartPosition() + ((this.getSymbolHeight() + this.getSymbolSpacing()) * windowIndex);
            };
            /**
             * Get the current index into the reel strip. The index of the center symbol.
             */
            Layout.prototype.getCurrentStripIndex = function () {
                return this.reel.getCurrentIndex();
            };
            /**
             * Get the anchor
             */
            Layout.prototype.getAnchor = function () {
                return this.anchor;
            };
            /**
             * Get the logical reel
             */
            Layout.prototype.getReel = function () {
                return this.reel;
            };
            /**
             * Make sure symbol actors have the correct spritesheet
             */
            Layout.prototype.refreshSymbols = function () {
                this.reel.getSymbolWindow(this.symbolWindow);
                if (this.symbols != null && this.symbolSet != null) {
                    for (var i = 0; i < this.symbols.length; ++i) {
                    }
                }
            };
            return Layout;
        })(rendering.DisplayObjectContainer);
        williams.Layout = Layout;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @enum UnbreakableGroupType
         *
         * @description Settings that can be used with addUnbreakableGroup
         */
        (function (UnbreakableGroupType) {
            UnbreakableGroupType[UnbreakableGroupType["Extend"] = -1] = "Extend";
            UnbreakableGroupType[UnbreakableGroupType["Neighbor"] = -2] = "Neighbor"; // Don't break up a symbol and single contiguous symbol
        })(williams.UnbreakableGroupType || (williams.UnbreakableGroupType = {}));
        var UnbreakableGroupType = williams.UnbreakableGroupType;
        /**
         * @class Strip
         *
         * @description Contains collections of symbol ids that descrive the backing layout of a reel
         */
        var Strip = (function () {
            /**
             * Create a new Strip object
             *
             * @param  table  base symbol table filled with ids
             */
            function Strip(table) {
                this.unbreakableGroups = [];
                this.baseSymbolTable = table;
                this.reset();
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
             * Called to get a partial range of symbol ids from an index.
             * So the array must be initialized to the amount of symbols needed.
             *
             * @param  index  starting table index
             * @param  rangeIndex  starting index in range
             * @param  rangeCount  number of values to fill in range
             * @param  range  array to place symbol ids
             */
            Strip.prototype.getPartialRange = function (index, rangeIndex, rangeCount, range) {
                for (var i = 0; i < rangeCount; ++i) {
                    range[rangeIndex + i] = this.liveSymbolTable[this.wrapIndex(index + i)];
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
                return !(this.baseSymbolTable < this.liveSymbolTable ||
                    this.liveSymbolTable < this.baseSymbolTable);
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
                            case UnbreakableGroupType.Extend:
                                //Search for end of clump and offset by that amount
                                var prevId = this.getSymbolId(stripIndex - step);
                                var extendOffset = this.findExtendOffset(stripIndex, prevId, step);
                                groupData.stripOffset += extendOffset;
                                break;
                            case UnbreakableGroupType.Neighbor:
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
                //Search each unbreakable group for the current id
                for (var groupId = 0; groupId < this.unbreakableGroups.length; ++groupId) {
                    var group = this.unbreakableGroups[groupId];
                    //Scan current group in both directions in case we're
                    //looking at a top or bottom neighbor
                    for (var i = 0; i < 2; ++i) {
                        var direction = (i == 0 ? forward : !forward);
                        var stripOffset = 0;
                        var step = (direction ? 1 : -1);
                        for (var groupIndex = (direction ? 0 : group.length - 1); groupIndex >= 0 && groupIndex < group.length; groupIndex += step) {
                            var fail = false;
                            switch (group[groupIndex]) {
                                case UnbreakableGroupType.Extend:
                                    //fall through
                                    break;
                                case UnbreakableGroupType.Neighbor:
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
                                    else if (group[groupIndex] != UnbreakableGroupType.Extend &&
                                        group[groupIndex] != UnbreakableGroupType.Neighbor) {
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
            return Strip;
        })();
        williams.Strip = Strip;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
/// <reference path="Strip.ts" />
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @class MysteryStripEvent
         *
         * @description The ON_STRIP_UPDATED event is fired when all of the mystery symbols have been updated.
         */
        var MysteryStripEvent = (function (_super) {
            __extends(MysteryStripEvent, _super);
            function MysteryStripEvent(type) {
                _super.call(this, type);
            }
            MysteryStripEvent.ON_STRIP_UPDATED = "MysteryStripEvent_ON_STRIP_UPDATED";
            return MysteryStripEvent;
        })(borgevent.Event);
        williams.MysteryStripEvent = MysteryStripEvent;
        /**
         * @class MysteryStrip
         *
         * @description The MysteryStrip is a special purpose real strip that can replace symbols while spinning.
         */
        var MysteryStrip = (function (_super) {
            __extends(MysteryStrip, _super);
            /**
             * Create a new MysteryStrip. Must be linked to a Reel with setReel before spinning.
             *
             * @param  strip  The initial reel strip symbols.
             * @param  mysteryStrip  The mystery index for each strip symbol - zero indicates no replacement.
             */
            function MysteryStrip(strip, mysteryStrip) {
                _super.call(this, strip);
                /** Stores whether the reel strip still needs replacements **/
                this.needsReplacing = false;
                this.eventHandler = new borgevent.EventDispatcher();
                if (strip.length !== mysteryStrip.length) {
                    console.log("!! WARNING Mystery strip not the same length as the reel strip.");
                }
                //
                this.mysterySymbolLookup = mysteryStrip;
                this.clear();
            }
            /**
             * Create a reference to the Reel displaying this MysteryStrip. This is necessary for the MysteryStrip to work.
             *
             * @param  reel  The target Reel.
             */
            MysteryStrip.prototype.setReel = function (reel) {
                this.reel = reel;
            };
            /**
             * @inheritdoc
             */
            MysteryStrip.prototype.dispatchEvent = function (e) {
                this.eventHandler.dispatchEvent(e);
            };
            /**
             * @inheritdoc
             */
            MysteryStrip.prototype.addEventListener = function (eventName, listener, listenerContext) {
                this.eventHandler.addEventListener(eventName, listener, listenerContext);
            };
            /**
             * @inheritdoc
             */
            MysteryStrip.prototype.removeEventListener = function (eventName, listener, listenerContext) {
                this.eventHandler.removeEventListener(eventName, listener, listenerContext);
            };
            /**
             * Returns the status of the MysteryStrip update.
             */
            MysteryStrip.prototype.finishedUpdating = function () {
                return (!this.needsReplacing);
            };
            /**
             * Replace symbols in the reel strip based on the mystery index..
             *
             * @param  mysteryNumbers  An array of mystery indices to replace in the strip.
             * @param  symbolIds  An array of symbol ids to replace in the strip, for each mystery index.
             */
            MysteryStrip.prototype.setMysterySymbols = function (mysteryNumbers, symbolIds) {
                this.clear();
                this.needsReplacing = true;
                this.markDirtySymbols();
                // make mystery symbol replacements
                for (var i = 0; i < this.replacementStrip.length; i++) {
                    for (var m = 0; m < mysteryNumbers.length; m++) {
                        var mysteryNumber = mysteryNumbers[m];
                        var symbolId = symbolIds[m];
                        // replace all mystery symbols in the replacement table
                        if (this.mysterySymbolLookup[i] === mysteryNumber) {
                            this.replacementStrip[i] = symbolId;
                        }
                    }
                }
            };
            /**
             * Reset the replacementStrip and mark the status as updated.
             */
            MysteryStrip.prototype.clear = function () {
                this.dirtySymbols = [];
                for (var i = 0; i < this.baseSymbolTable.length; i++) {
                    this.dirtySymbols.push(false);
                }
                this.replacementStrip = this.liveSymbolTable.slice(0);
                this.needsReplacing = false;
            };
            /**
             * @inheritdoc
             *
             * Update symbols that are not visible when processing the symbols for the Reel.
             */
            MysteryStrip.prototype.getSymbolRange = function (index, range) {
                this.clearCleanSymbols(index, range.length);
                _super.prototype.getSymbolRange.call(this, index, range);
            };
            /**
             * @inheritdoc
             */
            MysteryStrip.prototype.getPartialRange = function (index, rangeIndex, rangeCount, range) {
                //this.clearCleanSymbols();
                _super.prototype.getPartialRange.call(this, index, rangeIndex, rangeCount, range);
            };
            /**
             * Update which symbols are dirty or visible.
             */
            MysteryStrip.prototype.markDirtySymbols = function () {
                for (var i = 0; i < this.dirtySymbols.length; i++) {
                    this.dirtySymbols[i] = true;
                }
            };
            /**
             * Find out if the update is complete by seeing which symbols are updated.
             */
            MysteryStrip.prototype.clearCleanSymbols = function (start, range) {
                if (this.needsReplacing) {
                    // assume all symbols are clean
                    var cleanSymbols = [];
                    for (var i = 0; i < this.baseSymbolTable.length; i++) {
                        cleanSymbols.push(true);
                    }
                    // mark the onscreen symbols as dirty
                    for (var index = 0; index < range; index++) {
                        cleanSymbols[this.wrapIndex(start + index)] = false;
                    }
                    // check for symbols that were dirty and are now clean
                    this.needsReplacing = false;
                    for (var i = 0; i < this.dirtySymbols.length; i++) {
                        if (this.dirtySymbols[i]) {
                            if (cleanSymbols[i]) {
                                // replace the live symbol id with the replacement
                                this.dirtySymbols[i] = false;
                                this.liveSymbolTable[i] = this.replacementStrip[i];
                            }
                            else {
                                // some replacement entries are still dirty
                                this.needsReplacing = true;
                            }
                        }
                    }
                    // done updating all symbols
                    if (!this.needsReplacing) {
                        this.eventHandler.dispatchEvent(new MysteryStripEvent(MysteryStripEvent.ON_STRIP_UPDATED));
                    }
                }
            };
            return MysteryStrip;
        })(williams.Strip);
        williams.MysteryStrip = MysteryStrip;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
        * @class Reel
        *
        * @description Logical reel that maintains the symbol layout
        */
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
                    if (this.spliceCount == 0)
                        this.currentIndex = this.spliceIndex;
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
                    this.strip.getPartialRange(startSpliceIndex, 0, spliceRangeCount, range);
                    this.strip.getPartialRange(startIndex, spliceRangeCount, nonSpliceRangeCount, range);
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
            return Reel;
        })();
        williams.Reel = Reel;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @class SymbolSet
         *
         * @description Describes a set of reel symbols.
         */
        var SymbolSet = (function () {
            /**
             * Create a new SymbolSet object
             *
            * @param  mapping    mapping of symbol Ids (index) to image frames (value)
            * @param  spriteSheet  SpriteSheet to use for symbols
            * @param  oversized  Optional parameter. An array of booleans indicating whether each symbol is oversized or not.
            */
            function SymbolSet(mapping, width, height, oversized) {
                if (oversized === void 0) { oversized = null; }
                /** Flag whether a symbol is oversized **/
                this.oversized = null;
                this.symbols = mapping;
                this.width = width;
                this.height = height;
                if (oversized) {
                    this.oversized = oversized;
                }
            }
            /**
             * Get the frame id based on a symbol id
             *
            * @param  symbolId  the zero based symbol id
            */
            SymbolSet.prototype.getSymbol = function (symbolId) {
                return this.symbols[symbolId];
            };
            /*
            * Return whether a symbol is an oversized symbol.
            * @param symbolId the zero based symbol id
            */
            SymbolSet.prototype.isOversized = function (symbolId) {
                if (this.oversized) {
                    return this.oversized[symbolId];
                }
                else {
                    return false;
                }
            };
            return SymbolSet;
        })();
        williams.SymbolSet = SymbolSet;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @enum SpinState
         *
         * @description SpinState enumeration
         */
        (function (SpinState) {
            SpinState[SpinState["Stopped"] = 0] = "Stopped";
            SpinState[SpinState["Spinning"] = 1] = "Spinning";
            SpinState[SpinState["Stepping"] = 2] = "Stepping";
            SpinState[SpinState["Splicing"] = 3] = "Splicing";
            SpinState[SpinState["Stopping"] = 4] = "Stopping"; // Bouncing and stopping
        })(williams.SpinState || (williams.SpinState = {}));
        var SpinState = williams.SpinState;
        /**
         * @class Controller
         *
         * @description Manages a reel and controls the reel spin animations
         */
        var Controller = (function () {
            /**
             * Create a new Controller object
             *
             * @param  layout   the reel layout
             * @param  profile  the settings that affect spin behavior
             * @param  actorUtil  actor utility
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             */
            function Controller(layout, profile, tweenUtil, mathUtil) {
                this.onSpinComplete = function () { };
                this.onHitAction = function () { };
                this.onAdvance = function () { };
                this.onSpinStepComplete = function () { return false; };
                this.layout = layout;
                this.profile = profile;
                this.state = SpinState.Stopped;
                this.spliceCount = 0;
                this.tweenUtil = tweenUtil;
                this.mathUtil = mathUtil;
                //Set initial symbol order
                this.symbolOrder = new Array(layout.getWindowSize());
                this.resetSymbolOrder();
                this.createSpins();
                this.createBounces();
                this.createSpinSteps();
            }
            /**
             * Set the spin complete callback
             *
             * @param  func  the callback function
             */
            Controller.prototype.setOnSpinComplete = function (func) {
                this.onSpinComplete = func;
            };
            /**
             * Set the hit action callback
             *
             * @param  func  the callback function
             */
            Controller.prototype.setOnHitAction = function (func) {
                this.onHitAction = func;
            };
            /**
             * Set the advance callback
             *
             * @param  func  the callback function
             */
            Controller.prototype.setOnAdvance = function (func) {
                this.onAdvance = func;
            };
            /**
             * Set the spin step complete callback
             *
             * @param  func  the callback function
             */
            Controller.prototype.setOnSpinStepComplete = function (func) {
                this.onSpinStepComplete = func;
            };
            /**
             * Get the spin step complete callback
             */
            Controller.prototype.getOnSpinStepComplete = function () {
                return this.onSpinStepComplete;
            };
            /**
             * Set a multiplier on the spin step so it goes faster
             */
            Controller.prototype.setSpinStepMultiplier = function (value) {
                this.forwardSpinSteps.timeScale(value);
                this.reverseSpinSteps.timeScale(value);
            };
            /**
             * Report if the reel is spinning
             */
            Controller.prototype.isSpinning = function () {
                return (this.state != SpinState.Stopped);
            };
            /**
             * Get the current state
             */
            Controller.prototype.getState = function () {
                return this.state;
            };
            /**
             * Get the layout
             */
            Controller.prototype.getLayout = function () {
                return this.layout;
            };
            /**
             * Get the symbol window order
             */
            Controller.prototype.getSymbolOrder = function () {
                return this.symbolOrder;
            };
            /**
             * Get the spin profile
             */
            Controller.prototype.getSpinProfile = function () {
                return this.profile;
            };
            /**
             * Start the reel spinning
             */
            Controller.prototype.spin = function () {
                if (this.state == SpinState.Stopped) {
                    this.state = SpinState.Spinning;
                    this.spins.timeScale(1.0);
                    this.spins.play(0);
                    if (this.reelBGSpins !== undefined) {
                        this.reelBGSpins.resume();
                    }
                }
            };
            /**
             * Make the reel spin by one symbol
             *
             * @param  animate  do an animated step
             * @param  forward  true to advance in forward direction
             * @param  overrideState true to spin step the reels regardless of state
             */
            Controller.prototype.spinStep = function (animate, forward, overrideState) {
                if (overrideState === void 0) { overrideState = false; }
                if (this.state == SpinState.Stopped || overrideState) {
                    if (animate) {
                        this.state = SpinState.Stepping;
                        this.spinSteps = (forward ? this.forwardSpinSteps : this.reverseSpinSteps);
                        this.spinSteps.play(0);
                    }
                    else {
                        this.layout.advance(forward ? 1 : -1, this.symbolOrder);
                    }
                }
            };
            /**
             * Begin the stop sequence ASAP. Returns the number of symbols that will be spliced.
             *
             * @param  stopIndex  index in strip space to stop at home position
             */
            Controller.prototype.stop = function (stopIndex) {
                if (this.state == SpinState.Spinning) {
                    this.state = SpinState.Splicing;
                    this.spliceCount = this.layout.startSplicing(stopIndex, true);
                }
                return this.spliceCount;
            };
            /**
             * Stop instantly and snap to the given stop
             *
             * @param  stopIndex  index in strip space to stop at home position
             */
            Controller.prototype.forceStop = function (stopIndex) {
                this.resetSpin();
                this.layout.setCurrentIndex(stopIndex, this.symbolOrder);
                this.state = SpinState.Stopped;
            };
            /**
             * Set the time scale of the reel spin animation
             *
             * @param  scale  amount to scale the spin speed
             * @param  delay  time to wait before applying the time scale
             */
            Controller.prototype.scaleSpin = function (scale, delay) {
                var _this = this;
                TweenLite.delayedCall(delay, function () { return _this.spins.timeScale(scale); });
            };
            /**
             * Overshoot the reel stop and snap back
             */
            Controller.prototype.bounce = function () {
                this.bounces.play(0);
                if (this.reelBGSpins !== undefined) {
                    this.reelBGSpins.pause();
                    this.reelBGBounces.play(0);
                }
            };
            /**
             * Create the spin timelines
             */
            Controller.prototype.createSpins = function () {
                var _this = this;
                var symbols = new Array();
                for (var i = 0; i < this.layout.getWindowSize(); i++) {
                    symbols.push(this.layout.getSymbolActor(i, this.symbolOrder));
                }
                if (this.spins) {
                    this.spins.pause();
                    TweenMax.killTweensOf(this.spins);
                    TweenMax.killChildTweensOf(this.spins);
                    this.spins.clear();
                    this.spins.kill();
                }
                this.spins = williams.SpinFactory.createReelSpin(symbols, this.tweenUtil, this.mathUtil, this.layout.getStartPosition(), this.layout.getEndPosition(), this.profile.spinSpeed, function () { return _this.handleAdvance(); });
                if (this.reelBGSpins) {
                    this.reelBGSpins.pause();
                    TweenMax.killTweensOf(this.reelBGSpins);
                    TweenMax.killChildTweensOf(this.reelBGSpins);
                    this.reelBGSpins.clear();
                    this.reelBGSpins.kill();
                }
                if (this.getReelBackGround().length !== 0) {
                    this.reelBGSpins = williams.SpinFactory.createReelBackgroundSpin(this.getReelBackGround(), this.tweenUtil, this.mathUtil, this.layout.getStartPosition(), this.layout.getEndPosition(), this.profile.spinSpeed, function () { return _this.handleAdvance(); });
                }
            };
            /**
             * Create the bounce timelines
             */
            Controller.prototype.createBounces = function () {
                var _this = this;
                var symbols = new Array();
                for (var i = 0; i < this.layout.getWindowSize(); i++) {
                    symbols.push(this.layout.getSymbolActor(i, this.symbolOrder));
                }
                if (this.bounces) {
                    this.bounces.pause();
                    TweenMax.killTweensOf(this.bounces);
                    TweenMax.killChildTweensOf(this.bounces);
                    this.bounces.clear();
                    this.bounces.kill();
                }
                this.bounces = williams.SpinFactory.createReelBounce(symbols, this.tweenUtil, this.mathUtil, this.profile.bounceDistance, this.profile.bounceSpeed, this.profile.bounceEaseOut, this.profile.bounceEaseBack, function () { return _this.handleBounceComplete(); });
                if (this.reelBGBounces) {
                    this.reelBGBounces.pause();
                    TweenMax.killTweensOf(this.reelBGBounces);
                    TweenMax.killChildTweensOf(this.reelBGBounces);
                    this.reelBGBounces.clear();
                    this.reelBGBounces.kill();
                }
                if (this.getReelBackGround().length !== 0) {
                    this.reelBGBounces = williams.SpinFactory.createReelBGBounce(this.getReelBackGround(), this.tweenUtil, this.mathUtil, this.profile.bounceDistance, this.profile.bounceSpeed, this.profile.bounceEaseOut, this.profile.bounceEaseBack, function () { });
                }
            };
            /**
             * Update the symbols the reelset uses for display e.g. seperate symbol set for freespins
             *
             * @param {rendering.MovieClip[]} symbols List of movieclips to use for the reel symbols.
             */
            Controller.prototype.updateSymbols = function (symbols) {
                this.layout.updateSymbols(symbols);
                this.layout.layout();
                this.resetSymbolOrder();
                this.createSpins();
                this.createBounces();
                this.createSpinSteps();
            };
            /**
             * Create the spin step timelines
             */
            Controller.prototype.createSpinSteps = function () {
                var _this = this;
                var symbols = new Array();
                for (var i = 0; i < this.layout.getWindowSize(); i++) {
                    symbols.push(this.layout.getSymbolActor(i, this.symbolOrder));
                }
                if (this.forwardSpinSteps) {
                    this.forwardSpinSteps.pause();
                    TweenMax.killTweensOf(this.forwardSpinSteps);
                    TweenMax.killChildTweensOf(this.forwardSpinSteps);
                    this.forwardSpinSteps.clear();
                    this.forwardSpinSteps.kill();
                }
                if (this.reverseSpinSteps) {
                    this.reverseSpinSteps.pause();
                    TweenMax.killTweensOf(this.reverseSpinSteps);
                    TweenMax.killChildTweensOf(this.reverseSpinSteps);
                    this.reverseSpinSteps.clear();
                    this.reverseSpinSteps.kill();
                }
                this.forwardSpinSteps = williams.SpinFactory.createReelSpinStep(symbols, this.tweenUtil, this.mathUtil, this.layout.getSymbolSpacing() + this.layout.getSymbolHeight(), this.profile.stepSpeed, function () { return _this.handleSpinStepComplete(true); });
                this.reverseSpinSteps = williams.SpinFactory.createReelSpinStep(symbols, this.tweenUtil, this.mathUtil, -this.layout.getSymbolSpacing() - this.layout.getSymbolHeight(), this.profile.stepSpeed, function () { return _this.handleSpinStepComplete(false); });
            };
            /**
             * Reset symbol order back to the default
             */
            Controller.prototype.resetSymbolOrder = function () {
                for (var i = 0; i < this.symbolOrder.length; i++) {
                    this.symbolOrder[i] = i;
                }
            };
            /**
             * A symbol has reached the end of its current spin animation and is wrapping
             * back around to the begin a new cycle.
             */
            Controller.prototype.handleAdvance = function () {
                switch (this.state) {
                    case SpinState.Spinning:
                        {
                            this.advance(false);
                        }
                        break;
                    case SpinState.Splicing:
                        {
                            this.spliceCount--;
                            if (this.spliceCount > 0) {
                                this.advance(false);
                            }
                            else {
                                this.state = SpinState.Stopping;
                                this.advance(true);
                                this.bounce();
                                this.onHitAction(this);
                            }
                        }
                        break;
                }
                this.onAdvance(this);
            };
            /**
             * The bounce animation is over and the reel is now stopped
             */
            Controller.prototype.handleBounceComplete = function () {
                this.state = SpinState.Stopped;
                this.onSpinComplete(this);
            };
            /**
             * The spin step animation is over
             *
             * @param  forward  true to advance in forward direction
             */
            Controller.prototype.handleSpinStepComplete = function (forward) {
                this.state = SpinState.Stopped;
                this.layout.advance(forward ? 1 : -1, this.symbolOrder);
                if (this.onSpinStepComplete(this)) {
                    this.spinStep(true, forward);
                }
            };
            /**
             * Advance the reels one step
             *
             * @param  true to reset symbol order
             */
            Controller.prototype.advance = function (reset) {
                if (reset) {
                    this.resetSpin();
                }
                else {
                    this.symbolOrder.unshift(this.symbolOrder.pop());
                }
                this.layout.advance(1, this.symbolOrder);
            };
            /**
             * Pause and reset the spin animations
             */
            Controller.prototype.resetSpin = function () {
                this.spins.pause(0);
                this.resetSymbolOrder();
            };
            /**
             * Return the reel background that animates when spinning.
             */
            Controller.prototype.getReelBackGround = function () {
                var reelBG = new Array();
                for (var i = 0; i < this.layout.children.length; i++) {
                    var child = this.layout.children[i];
                    if (child.constructor["name"] === "Bitmap") {
                        reelBG.push(child);
                    }
                }
                return reelBG;
            };
            return Controller;
        })();
        williams.Controller = Controller;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @file Group.ts
         *
        * Copyright (c) 2013 Williams Interactive, LLC. All Rights Reserved.
        */
        /**
         * Describes a set of reel spins
         */
        var Group = (function (_super) {
            __extends(Group, _super);
            /**
             * Create a new Group object
             *
            * @param  controllers  the controllers for each reel
            * @param  spinStagger  the time to wait between each reel spin
            * @param  stopStagger  the time to wait between each reel stop
            */
            function Group(controllers, spinStagger, stopStagger) {
                _super.call(this);
                this.controllers = controllers;
                this.stops = new Array();
                this.anticipationDelay = 0;
                this.spinsStarted = false;
                this.stopRequested = false;
                this.delayedStop = null;
                this.stopStagger = new Array();
                this.lockedReels = new Array();
                this.stopOrder = new Array();
                for (var reelId = 0; reelId < this.controllers.length; ++reelId) {
                    this.lockedReels.push(false);
                    this.stopStagger.push(stopStagger);
                    this.stopOrder.push(reelId);
                    this.addChild(this.controllers[reelId].getLayout());
                }
                this.createStopWindows();
                this.connectEvents();
                this.createSpin(spinStagger);
            }
            Group.prototype.createMask = function () {
                var clip = new rendering.Graphics();
                clip.beginFill(0xff0000, .2);
                for (var reelId = 0; reelId < this.controllers.length; ++reelId) {
                    var sx = this.controllers[reelId].getLayout().x + this.controllers[reelId].getLayout().getAnchor().x;
                    var ex = this.controllers[reelId].getLayout().getBounds().width + sx;
                    var sy = this.controllers[reelId].getLayout().getSymbolHeight() + this.controllers[reelId].getLayout().y + this.controllers[reelId].getLayout().getAnchor().y;
                    var ey = this.controllers[reelId].getLayout().getBounds().height + sy;
                    clip.drawRect(sx, sy, ex - sx, ey - sy);
                }
                clip.endFill();
                clip.interactive = false;
                this.addChild(clip);
                this.mask = clip;
            };
            /**
             * Set the time to spin when in anticipation mode
             *
            * @param  anticipationDelay  time in seconds for anticipation delay
            */
            Group.prototype.setAnticipationDelay = function (anticipationDelay) {
                this.anticipationDelay = anticipationDelay;
            };
            /**
             * Set function that allows game to force more time to pass before stopping a reel.
             * Return true to enter anticipation mode and delay stop.
             *
            * @param  func  function to call when asking about anticipation
            */
            Group.prototype.setOnConfirmAnticipation = function (func) {
                this.onConfirmAnticipation = func;
            };
            /**
             * Set the visability of the reels
             *
            * @param  visible  the visibility
            */
            Group.prototype.setVisible = function (visible) {
                for (var i = 0; i < this.controllers.length; i++) {
                    this.controllers[i].getLayout().setVisible(visible);
                }
            };
            /**
             * Set a custom stop stagger value
             *
            * @param  reelId  the reelId that the stop stagger applies to
            * @param  delay  the delay in seconds before the given reel stops
            */
            Group.prototype.setStopStagger = function (reelId, delay) {
                this.stopStagger[reelId] = delay;
            };
            /**
             * Set the order the reels will stop
             *
            * @param  order  an array containing reel IDs in the order they should be stopped
            */
            Group.prototype.setStopOrder = function (order) {
                this.stopOrder = order.slice(0);
            };
            /**
             * Lock a reel so it doesn't spin
             *
            * @param  id  the reel id
            */
            Group.prototype.lockReel = function (id) {
                this.lockedReels[id] = true;
            };
            /**
             * Reset the locks on all reels
             */
            Group.prototype.resetLocks = function () {
                for (var id = 0; id < this.lockedReels.length; ++id) {
                    this.lockedReels[id] = false;
                }
            };
            /**
             * Start the reel spins
             */
            Group.prototype.spin = function () {
                if (!this.isSpinning()) {
                    this.spinsStarted = false;
                    this.stopRequested = false;
                    this.reelSpin.play(0);
                }
            };
            /**
             * Stop the reel spins ASAP
             *
            * @param  stops  stop positions for reels
            * @param  immediate  should stop all reels at once
            */
            Group.prototype.stop = function (stops, immediate) {
                this.stops = stops.slice(0);
                for (var i = 0; i < stops.length; i++) {
                    this.controllers[i].getLayout().getStopWindow(stops[i], this.stopWindows[i]);
                }
                if (this.isSpinning()) {
                    if (immediate) {
                        //If there is already a delayed stop scheduled, kill it and stop immediately
                        if (this.delayedStop != null) {
                            this.delayedStop.kill();
                            this.delayedStop = null;
                        }
                        var controllerCnt = this.controllers.length;
                        for (var i = 0; i < controllerCnt; ++i) {
                            this.controllers[i].stop(this.stops[i]);
                        }
                    }
                    else {
                        this.handleStop(0);
                    }
                }
                else if (!immediate) {
                    this.stopRequested = true;
                }
            };
            /**
             * Stop instantly and snap to the given stops
             *
            * @param  stops  stop positions for reels
            */
            Group.prototype.forceStop = function (stops) {
                this.stops = stops.slice(0);
                for (var i = 0; i < stops.length; i++) {
                    this.controllers[i].getLayout().getStopWindow(stops[i], this.stopWindows[i]);
                }
                var controllerCnt = this.controllers.length;
                for (var i = 0; i < controllerCnt; ++i) {
                    this.controllers[i].forceStop(this.stops[i]);
                }
                this.reelSpin.pause();
            };
            /**
             * Check if any of the reels are spinning
             */
            Group.prototype.isSpinning = function () {
                if (!this.spinsStarted)
                    return false;
                var spinning = false;
                for (var i = 0; i < this.controllers.length; i++) {
                    if (this.controllers[i].isSpinning()) {
                        spinning = true;
                        break;
                    }
                }
                return spinning;
            };
            /**
             * Get the number of reels in the group
             */
            Group.prototype.getReelCount = function () {
                return this.controllers.length;
            };
            /**
             * Get the reel id of the controller
             *
            * @param  controller  get the reel id of this controller
            */
            Group.prototype.getReelId = function (controller) {
                return this.controllers.indexOf(controller);
            };
            /**
             * The the controller associated with a reel id
             *
            * @param  reelId  the reel id
            */
            Group.prototype.getController = function (reelId) {
                return this.controllers[reelId];
            };
            /**
             * Get the symbol id that will be at the given location when the reels stop
             *
            * @param  reelId  the reel id
            * @param  windowIndex  the window index
            */
            Group.prototype.getStopId = function (reelId, windowIndex) {
                return this.stopWindows[reelId][windowIndex];
            };
            /**
             * Create the timeline that spins the reels
             *
            * @param  stagger  the reel spin stagger time
            */
            Group.prototype.createSpin = function (stagger) {
                var _this = this;
                this.reelSpin = new TimelineMax({ paused: true,
                    onComplete: function () {
                        _this.spinsStarted = true;
                        if (_this.stopRequested) {
                            _this.stop(_this.stops, false);
                        }
                    }
                });
                var spinList = new Array();
                var that = this;
                this.controllers.forEach(function (currentValue, index) {
                    spinList.push(function (id) {
                        return function () { return that.spinReel(id); };
                    }(index));
                });
                //Start time non-zero as a workaround for a TimelineMax bug - Robby
                this.reelSpin.add(spinList, 0.001, "normal", stagger);
            };
            /**
             * Spin a reel if it's not locked
             *
            * @param  id  the reel id
            */
            Group.prototype.spinReel = function (id) {
                if (!this.lockedReels[id]) {
                    this.controllers[id].spin();
                }
            };
            /**
             * Connect controller callbacks
             */
            Group.prototype.connectEvents = function () {
                var _this = this;
                for (var i = 0; i < this.controllers.length; i++) {
                    this.controllers[i].setOnSpinComplete(function (controller) {
                        _this.handleSpinComplete(controller);
                    });
                    this.controllers[i].setOnHitAction(function (controller) {
                        _this.dispatchEvent(new williams.ReelGroupEvent(williams.ReelGroupEvent.ON_HIT_ACTION, _this.getReelId(controller)));
                    });
                    this.controllers[i].setOnAdvance(function (controller) {
                        _this.dispatchEvent(new williams.ReelGroupEvent(williams.ReelGroupEvent.ON_ADVANCE, _this.getReelId(controller)));
                    });
                }
            };
            /**
             * Event handler for spinComplete callback
             *
            * @param  controller  event source
            */
            Group.prototype.handleSpinComplete = function (controller) {
                this.dispatchEvent(new williams.ReelGroupEvent(williams.ReelGroupEvent.ON_REEL_SPIN_COMPLETE, this.getReelId(controller)));
                if (!this.isSpinning()) {
                    this.dispatchEvent(new williams.ReelGroupEvent(williams.ReelGroupEvent.ON_SPIN_COMPLETE, -1));
                }
            };
            /**
             * Event handler for stop
             *
            * @param  stopIndex  the index into stopOrder selecting the reel to stop
            */
            Group.prototype.handleStop = function (stopIndex) {
                var _this = this;
                var reelId = this.stopOrder[stopIndex];
                if (this.anticipationDelay > 0 && this.onConfirmAnticipation(reelId)) {
                    this.delayedStop = TweenLite.delayedCall(this.anticipationDelay, function () {
                        _this.stopReel(stopIndex);
                    });
                }
                else {
                    this.stopReel(stopIndex);
                }
            };
            /**
             * Stop a reel
             *
            * @param  stopIndex  the index into stopOrder selecting the reel to stop
            */
            Group.prototype.stopReel = function (stopIndex) {
                var _this = this;
                var reelId = this.stopOrder[stopIndex];
                this.delayedStop = null;
                var controller = this.controllers[reelId];
                var layout = controller.getLayout();
                var profile = controller.getSpinProfile();
                var spliceCount = controller.stop(this.stops[reelId]);
                var stopCount = spliceCount - layout.getWindowSize();
                var stopTime = (stopCount * layout.getSymbolSpacing()) / profile.spinSpeed;
                var staggerTime = stopTime + this.stopStagger[reelId];
                if (++stopIndex < this.stopOrder.length) {
                    TweenLite.delayedCall(staggerTime, function () { return _this.handleStop(stopIndex); });
                }
            };
            /**
             * Create the stop windows
             */
            Group.prototype.createStopWindows = function () {
                this.stopWindows = new Array();
                for (var i = 0; i < this.controllers.length; i++) {
                    var stopWindow = new Array();
                    var windowSize = this.controllers[i].getLayout().getWindowSize();
                    for (var j = 0; j < windowSize; j++) {
                        stopWindow.push(-1);
                    }
                    this.stopWindows.push(stopWindow);
                }
            };
            return Group;
        })(rendering.DisplayObjectContainer);
        williams.Group = Group;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @class ReelGroupEvent
         *
         * @description Dispatched by Group's for different reel events
         */
        var ReelGroupEvent = (function (_super) {
            __extends(ReelGroupEvent, _super);
            /**
             * Creates a new ReelGroupEvent object
             * @param type The type of events
             * @param reelId Index of the reel
             */
            function ReelGroupEvent(type, reelId) {
                _super.call(this, type);
                this.reelId = reelId;
            }
            /**
             * Dispatched when the reels complete a spin
             */
            ReelGroupEvent.ON_SPIN_COMPLETE = "ReelGroupEvent_ON_SPIN_COMPLETE";
            /**
             * Dispatched when eac reel stops spinning
             */
            ReelGroupEvent.ON_REEL_SPIN_COMPLETE = "ReelGroupEvent_ON_REEL_SPIN_COMPLETE";
            /**
             * Dispatched when a reel "hits"
             */
            ReelGroupEvent.ON_HIT_ACTION = "ReelGroupEvent_ON_HIT_ACTION";
            /**
             * Dispatched when the reel "advances"
             */
            ReelGroupEvent.ON_ADVANCE = "ReelGroupEvent_ON_ADVANCE";
            return ReelGroupEvent;
        })(borgevent.Event);
        williams.ReelGroupEvent = ReelGroupEvent;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @class SpinFactory
         *
         * @description Factory class used to create reels spin animations
         */
        var SpinFactory = (function () {
            function SpinFactory() {
            }
            /**
             * Create a timeline with a symbol spin for each symbol
             *
             * @param  symbols  the symbols to spin
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             * @param  start  the starting point of the spin
             * @param  end  the ending point of the spin
             * @param  speed  the speed of the spin
             * @param  onAdvance  the function to call when a symbol has reached the end
             *                          of its current cycle
             */
            SpinFactory.createReelSpin = function (symbols, tweenUtil, mathUtil, start, end, speed, onAdvance) {
                var spin = new TimelineMax({ paused: true });
                var spinList = new Array();
                for (var i = 0; i < symbols.length; i++) {
                    spinList.push(SpinFactory.createSymbolSpin(symbols[i], tweenUtil, mathUtil, start, end, speed, onAdvance));
                }
                spin.add(spinList);
                return spin;
            };
            /**
             * Create a timeline that spins a symbol forever
             *
             * @param  symbol   the target symbol
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             * @param  start  the starting point of the spin
             * @param  end  the ending point of the spin
             * @param  speed  the speed of the spin
             * @param  onAdvance  the function to call when a symbol has reached the end
             *                          of its current cycle
             */
            SpinFactory.createSymbolSpin = function (symbol, tweenUtil, mathUtil, start, end, speed, onAdvance) {
                var spin = new TimelineMax();
                //First exit
                var duration = mathUtil.speedToDurationFromValues1D(symbol.y, end, speed);
                spin.add(tweenUtil.moveToAxis(symbol, end, false, duration, Linear.easeNone, onAdvance));
                //Normal spin cycle
                duration = mathUtil.speedToDurationFromValues1D(start, end, speed);
                spin.add(tweenUtil.moveFromToAxis(symbol, start, end, false, duration, Linear.easeNone, null, null, onAdvance).repeat(-1));
                return spin;
            };
            /**
             * Create a timeline that spins a reel background
             *
             * @param  backgroundList   all the reel backgrounds
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             * @param  start  the starting point of the spin
             * @param  end  the ending point of the spin
             * @param  speed  the speed of the spin
             * @param  onAdvance  the function to call when a symbol has reached the end
             *                          of its current cycle
             */
            SpinFactory.createReelBackgroundSpin = function (backgroundList, tweenUtil, mathUtil, start, end, speed, onAdvance) {
                var masterSpin = new TimelineMax({ paused: true });
                var spinList = new Array();
                for (var i = 0; i < backgroundList.length; i++) {
                    var spin = new TimelineMax();
                    var duration = mathUtil.speedToDurationFromValues1D(backgroundList[i].y, backgroundList[i].y + backgroundList[i].height, speed);
                    spin.add(tweenUtil.moveToAxis(backgroundList[i], backgroundList[i].y + backgroundList[i].height * 3 / 4, false, duration, Linear.easeNone, onAdvance).repeat(-1));
                    spinList.push(spin);
                }
                masterSpin.add(spinList);
                return masterSpin;
            };
            /**
             * Create a timeline for reel backgrounds to bounce
             *
             * @param  backgroundList  the backgrounds to bounce
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             * @param  distance  the distance the symbol should move before snapping back
             * @param  speed  the average speed of the move
             * @param  easeOut  the ease mode applied to the overshoot motion
             * @param  easeBack  the ease mode applied to the snap back motion
             * @param  onComplete  function to call when bounce is finished
             */
            SpinFactory.createReelBGBounce = function (backgroundList, tweenUtil, mathUtil, distance, speed, easeOut, easeBack, onComplete) {
                var masterBounce = new TimelineMax({ paused: true });
                var bounceList = new Array();
                for (var i = 0; i < backgroundList.length; i++) {
                    var bounce = new TimelineMax();
                    var duration = mathUtil.speedToDuration1D(distance, speed);
                    bounce.add(tweenUtil.moveByAxis(backgroundList[i], distance, false, duration, easeOut));
                    duration = mathUtil.speedToDuration1D(distance, speed);
                    bounce.add(tweenUtil.moveByAxis(backgroundList[i], -distance, false, duration, easeBack));
                    bounceList.push(bounce);
                }
                masterBounce.add(bounceList);
                masterBounce.add(function () { return onComplete(); });
                return masterBounce;
            };
            /**
             * Create a timeline with a symbol bounce for each symbol
             *
             * @param  symbols  the symbols to bounce
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             * @param  distance  the distance the symbol should move before snapping back
             * @param  speed  the average speed of the move
             * @param  easeOut  the ease mode applied to the overshoot motion
             * @param  easeBack  the ease mode applied to the snap back motion
             * @param  onComplete  function to call when bounce is finished
             */
            SpinFactory.createReelBounce = function (symbols, tweenUtil, mathUtil, distance, speed, easeOut, easeBack, onComplete) {
                var bounce = new TimelineMax({ paused: true });
                var bounceList = new Array();
                for (var i = 0; i < symbols.length; i++) {
                    bounceList.push(SpinFactory.createSymbolBounce(symbols[i], tweenUtil, mathUtil, distance, speed, easeOut, easeBack));
                }
                bounce.add(bounceList);
                bounce.add(function () { return onComplete(); });
                return bounce;
            };
            /**
             * Create a timeline that makes a symbol overshoot its current position and snap back
             * as if it's attached to a spring
             *
             * @param  symbol  the symbol to bounce
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             * @param  distance  the distance the symbol should move before snapping back
             * @param  speed  the average speed of the move
             * @param  easeOut  the ease mode applied to the overshoot motion
             * @param  easeBack  the ease mode applied to the snap back motion
             */
            SpinFactory.createSymbolBounce = function (symbol, tweenUtil, mathUtil, distance, speed, easeOut, easeBack) {
                var bounce = new TimelineMax();
                //Overshoot
                var duration = mathUtil.speedToDuration1D(distance, speed);
                bounce.add(tweenUtil.moveByAxis(symbol, distance, false, duration, easeOut));
                //Snap
                duration = mathUtil.speedToDuration1D(distance, speed);
                bounce.add(tweenUtil.moveByAxis(symbol, -distance, false, duration, easeBack));
                return bounce;
            };
            /**
             * Create a timeline with a symbol spin step for each symbol
             *
             * @param  symbols  the symbols to spin
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             * @param  distance  the distance to move
             * @param  speed  the speed of the spin
             * @param  onComplete  the function to call when the step is complete
             */
            SpinFactory.createReelSpinStep = function (symbols, tweenUtil, mathUtil, distance, speed, onComplete) {
                var spin = new TimelineMax({ paused: true, onComplete: onComplete });
                var spinList = new Array();
                for (var i = 0; i < symbols.length; i++) {
                    spinList.push(SpinFactory.createSymbolSpinStep(symbols[i], tweenUtil, mathUtil, distance, speed));
                }
                spin.add(spinList);
                return spin;
            };
            /**
             * Create a timeline that spins a symbol one step
             *
             * @param  symbol   the target symbol
             * @param  tweenUtil  tween utility
             * @param  mathUtil  math utility
             * @param  distance  the distance to move
             * @param  speed  the speed of the spin
             */
            SpinFactory.createSymbolSpinStep = function (symbol, tweenUtil, mathUtil, distance, speed) {
                var spin = new TimelineMax();
                var duration = mathUtil.speedToDuration1D(distance, speed);
                spin.add(tweenUtil.moveByAxis(symbol, distance, false, duration, Linear.easeNone, function () { symbol.y = symbol.y - distance; }));
                return spin;
            };
            return SpinFactory;
        })();
        williams.SpinFactory = SpinFactory;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var reels;
(function (reels) {
    var williams;
    (function (williams) {
        /**
         * @class SpinProfile
         *
         * @description Describes the behavior of a reel spin
         */
        var SpinProfile = (function () {
            function SpinProfile() {
                /** The speed the reel should move during the normal spin */
                this.spinSpeed = 1800;
                /** The speed the reel should move during the bounce */
                this.bounceSpeed = 500;
                /** The speed the reel should move during a spin step */
                this.stepSpeed = 1800;
                /** The distance to overshoot during the bounce */
                this.bounceDistance = 85;
                /** The ease mode to use during the bounce overshoot */
                this.bounceEaseOut = Power1.easeOut;
                /** The ease mode to use during the bounce snap */
                this.bounceEaseBack = Linear.easeNone;
            }
            return SpinProfile;
        })();
        williams.SpinProfile = SpinProfile;
    })(williams = reels.williams || (reels.williams = {}));
})(reels || (reels = {}));
var selenium;
(function (selenium) {
    /**
     * @class SeleniumControl
     *
     * @description Custom state control that can be used within selenium to read the current game state
     */
    var SeleniumControl = (function () {
        function SeleniumControl() {
        }
        /**
         * Creates the element and adds it to the DOM
         *
         * @param element Html element to add the control to
         * @param width Width to draw the element
         * @param height Height to draw the element
         */
        SeleniumControl.createConsole = function (element, width, height) {
            this._root = element;
            this._textDiv = document.createElement("div");
            //this._textDiv.style.display = 'none';
            this._textDiv.id = "selenium-control";
            this._textDiv.style.width = width.toString() + "px";
            this._textDiv.style.height = height.toString() + "px";
            this._textDiv.style.zIndex = "1";
            this._textDiv.style.position = "absolute";
            this._textDiv.style.bottom = "10pt";
            this._textDiv.style.left = "10pt";
            this._textDiv.style.visibility = "visible";
            this._textElement = document.createElement("TEXTAREA");
            this._textElement.setAttribute("value", "");
            this._textElement.setAttribute("name", "Test Name");
            this._textElement.setAttribute("style", "width:100%; height:100%");
            this._textDiv.appendChild(this._textElement);
            this._root.appendChild(this._textDiv);
        };
        /**
         * Set's the current state of the game
         */
        SeleniumControl.setText = function (txt) {
            this._textElement.textContent = txt;
        };
        return SeleniumControl;
    })();
    selenium.SeleniumControl = SeleniumControl;
})(selenium || (selenium = {}));
var selenium;
(function (selenium) {
    /**
     * @class SeleniumDivTree
     *
     * @description Recursively creates a list of div elements that describe a display object and all it's children
     *
     * This can be used in conjunction with selenium scripts or IDE to find canvas elements and their attributes to automate testing
     */
    var SeleniumDivTree = (function () {
        /**
         * Creates a new SeleniumDivTree
         *
         * @param htmlParent The html element to add the div's to, normally 'game-canvas-div'
         * @param display Display object that we want to represent
         */
        function SeleniumDivTree(htmlParent, display) {
            this._root = htmlParent;
            this._rootDisplay = display;
        }
        /**
         * Recreates the div tree
         *
         * @param xScale The current scale of the canvas container
         * @param yScale The current scale of the canvas container
         */
        SeleniumDivTree.prototype.draw = function (xScale, yScale) {
            if (this._container) {
                this._root.removeChild(this._container);
            }
            this._container = document.createElement('div');
            this._container.setAttribute('id', "selenium-div-tree");
            this.describe(this._rootDisplay, this._container, xScale, yScale);
            this._root.appendChild(this._container);
        };
        /**
         * Creates a div for the given display object
         *
         * @param ob The display object to create a div for
         * @param htmlParent Parent div to add this one to
         * @param xScale The current scale of the canvas container
         * @param yScale The current scale of the canvas container
         */
        SeleniumDivTree.prototype.describe = function (ob, htmlParent, xScale, yScale) {
            var elem = document.createElement('div');
            elem.style.display = 'none';
            if (ob.seleniumId) {
                elem.setAttribute('id', ob.seleniumId);
            }
            else {
                elem.setAttribute('id', this.getClassName(ob));
            }
            htmlParent.appendChild(elem);
            var x = ob.x;
            var y = ob.y;
            var parent = ob.parent;
            while (parent) {
                x += parent.x;
                y += parent.y;
                parent = parent.parent;
            }
            x = Math.ceil(x / xScale * rendering.ScaleManager.getPositionScale());
            y = Math.ceil(y / yScale * rendering.ScaleManager.getPositionScale());
            elem.setAttribute('x', x.toString());
            elem.setAttribute('y', y.toString());
            elem.setAttribute('centerX', (x + Math.ceil(ob.width / xScale * rendering.ScaleManager.getPositionScale()) / 2).toString());
            elem.setAttribute('centerY', (y + Math.ceil(ob.height / yScale * rendering.ScaleManager.getPositionScale()) / 2).toString());
            elem.setAttribute('visible', ob.visible.toString());
            elem.setAttribute('alpha', ob.alpha.toString());
            elem.setAttribute('scaleX', ob.scaleX.toString());
            elem.setAttribute('scaleY', ob.scaleY.toString());
            elem.setAttribute('rotation', ob.rotation.toString());
            if (ob.seleniumDescribe) {
                var dataPairs = ob.seleniumDescribe();
                for (var i = 0; i < dataPairs.length; i++) {
                    elem.setAttribute(dataPairs[i][0], dataPairs[i][1]);
                }
            }
            elem.style.position = "absolute";
            elem.style.left = Math.ceil(ob.x / xScale * rendering.ScaleManager.getPositionScale()).toString() + "px";
            elem.style.top = Math.ceil(ob.y / yScale * rendering.ScaleManager.getPositionScale()).toString() + "px";
            elem.style.width = Math.ceil(ob.width / xScale * rendering.ScaleManager.getPositionScale()).toString() + "px";
            elem.style.height = Math.ceil(ob.height / yScale * rendering.ScaleManager.getPositionScale()).toString() + "px";
            for (var i = 0; i < ob.children.length; i++) {
                this.describe(ob.children[i], elem, xScale, yScale);
            }
            return elem;
        };
        /**
         * Gets the class name of the object to set the div id
         *
         * @instance The display object
         */
        SeleniumDivTree.prototype.getClassName = function (instance) {
            var funcNameRegex = /function (.{1,})\(/;
            var results = (funcNameRegex).exec(instance["constructor"].toString());
            return (results && results.length > 1) ? results[1] : "";
        };
        return SeleniumDivTree;
    })();
    selenium.SeleniumDivTree = SeleniumDivTree;
})(selenium || (selenium = {}));
var server;
(function (server) {
    /**
     * @class AwardData
     *
     * @description Data for individual slot awards
     *
     * Given on INIT responses
     */
    var AwardData = (function () {
        function AwardData() {
        }
        return AwardData;
    })();
    server.AwardData = AwardData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class AwardsData
     *
     * @description List of slot awards
     *
     * Given on INIT responses
     */
    var AwardsData = (function () {
        function AwardsData() {
        }
        return AwardsData;
    })();
    server.AwardsData = AwardsData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class BalanceType
     *
     * @description Balance type enumeration
     *
     * Given on INIT, LOGIC and END responses
     */
    (function (BalanceType) {
        BalanceType[BalanceType["CASH_BALANCE"] = 0] = "CASH_BALANCE";
        BalanceType[BalanceType["BONUS_BALANCE"] = 1] = "BONUS_BALANCE";
    })(server.BalanceType || (server.BalanceType = {}));
    var BalanceType = server.BalanceType;
    /**
     * @class BalanceData
     *
     * @description List of played balances
     */
    var BalanceData = (function () {
        /**
         * Creates a new BalanceData object
         * @param balanceData list of balances with string keys
         */
        function BalanceData(balanceData) {
            this.balances = balanceData;
        }
        /**
         * Get's the balance for the specified balance type
         * @param type balance type
         */
        BalanceData.prototype.getBalance = function (type) {
            var value = 0;
            var name = BalanceType[type];
            if (name != null &&
                this.balances[name] != null) {
                value = this.balances[name];
            }
            return value;
        };
        /**
         * Checks if the balance type is available
         * @param type balance type
         */
        BalanceData.prototype.hasBalance = function (type) {
            var name = BalanceType[type];
            if (name != null &&
                this.balances[name] != null) {
                return true;
            }
            return false;
        };
        return BalanceData;
    })();
    server.BalanceData = BalanceData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class BetData
     *
     * @description Data for bet's available to the player
     *
     * Given on INIT responses
     */
    var BetData = (function () {
        function BetData() {
            /**
             * List of bet's available
             */
            this.availableBets = [1];
            /**
             * Index of the bet that should be selected by default
             */
            this.defaultBetIndex = 0;
        }
        /**
         * Set the default bet index
         */
        BetData.prototype.setDefaultIndex = function (index) {
            this.defaultBetIndex = index;
        };
        /**
         * Get the default bet index
         */
        BetData.prototype.getDefaultIndex = function () {
            return this.defaultBetIndex;
        };
        /**
         * Set the list of bet's available
         */
        BetData.prototype.setAvailableBets = function (bets) {
            this.availableBets = bets;
        };
        /**
         * Get the list of bet's available
         */
        BetData.prototype.getAvailableBets = function () {
            return this.availableBets;
        };
        return BetData;
    })();
    server.BetData = BetData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class ErrorData
     *
     * @description Data for any errors returned by the server
     *
     * Given on INIT, LOGIC and END responses
     */
    var ErrorData = (function () {
        function ErrorData() {
        }
        return ErrorData;
    })();
    server.ErrorData = ErrorData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GameResultData
     *
     * @description Data for a single game result
     *
     * Given on LOGIC responses
     */
    var GameResultData = (function () {
        /**
         * Creates a new GameResultData object
         * @param stake The total stake of the wager the player placed
         * @param stakePerLine The stake for each individual payline of the wager the player placed
         * @param paylineCount Total number of paylines the player placed their wager on
         * @param totalWin The total amount the player won for this wager
         */
        function GameResultData(stake, stakePerLine, paylineCount, totalWin) {
            this.stake = stake;
            this.stakePerLine = stakePerLine;
            this.paylineCount = paylineCount;
            this.totalWin = totalWin;
        }
        return GameResultData;
    })();
    server.GameResultData = GameResultData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class PaylineData
     *
     * @description Data for the display configuration for a single payline
     *
     * Given on INIT responses
     */
    var PaylineData = (function () {
        function PaylineData() {
        }
        return PaylineData;
    })();
    server.PaylineData = PaylineData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class PaylineWinData
     *
     * @description Data for a single payline win
     *
     * Given on LOGIC responses
     */
    var PaylineWinData = (function () {
        /**
         * Creates a new PaylineWinData object
         * @param index Index of the payline
         * @param winVal Amount won on the payline
         * @param awardIndex Index of the award from the INIT response
         * @param awardTableIndex Index of the award table if there is multiple award sets
         * @param reelPositions Positions on the reels that contain a winning symbol
         */
        function PaylineWinData(index, winVal, awardIndex, awardTableIndex, reelPositions) {
            this.index = index;
            this.winVal = winVal;
            this.awardIndex = awardIndex;
            this.awardTableIndex = awardTableIndex;
            this.reelPositions = reelPositions;
        }
        return PaylineWinData;
    })();
    server.PaylineWinData = PaylineWinData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class PaylinesData
     *
     * @description Data for all payline display configurations
     *
     * Given on INIT responses
     */
    var PaylinesData = (function () {
        function PaylinesData() {
        }
        return PaylinesData;
    })();
    server.PaylinesData = PaylinesData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class PlatformData
     *
     * @description Platform data
     *
     * Given on INIT, LOGIC AND END responses
     */
    var PlatformData = (function () {
        function PlatformData() {
        }
        return PlatformData;
    })();
    server.PlatformData = PlatformData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class ReelData
     *
     * @description Data for a set of reels
     *
     * Given on INIT responses
     */
    var ReelData = (function () {
        /**
         * Creates a new ReelData object
         * @param id Index of the reel set for games that have multiple reel sets
         */
        function ReelData(id) {
            this.id = id;
            this.strips = [];
            this.featureId = 0;
        }
        /**
         * Get the index of the reel set, for games that have multiple reel sets
         */
        ReelData.prototype.getId = function () {
            return this.id;
        };
        /**
         * Set the index of the feature this reel belongs to such as the base game or a free spins game
         * @param id Undex
         */
        ReelData.prototype.setFeatureId = function (id) {
            this.featureId = id;
        };
        /**
         * Get the index of the feature this reel belongs to such as the base game or a free spins game
         */
        ReelData.prototype.getFeatureId = function () {
            return this.featureId;
        };
        /**
         * Set a strip containing the symbols for and individual reel
         * @param index The index of the reel
         * @param strip Data for the reel
         */
        ReelData.prototype.addStrip = function (index, strip) {
            this.strips[index] = strip;
        };
        /**
         * Get a strip containing the symbols for and individual reel
         * @param index The index of the reel
         */
        ReelData.prototype.getStrip = function (index) {
            return this.strips[index];
        };
        /**
         * Get all the strips containing the symbols for individual reels
         */
        ReelData.prototype.getAllStrips = function () {
            return this.strips;
        };
        return ReelData;
    })();
    server.ReelData = ReelData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class ReelSpinData
     *
     * @description Data for a single reel spin result
     *
     * Given on LOGIC responses
     */
    var ReelSpinData = (function () {
        /**
         * Creates a new ReelSpinData object
         * @param spinIndex Index of the spin, some games have multiple spins per response
         * @param paylineWinCount Amount of paylines that contain a win
         * @param scatterWinCount Amount of scatter wins
         * @param reelsetIndex Index of the reel set used for the reel spin
         * @param spinWins Total win for the reel spin result
         * @param freeSpin Whether or not this spin was a freespin
         * @param bonusAwarded Whether or not this spin triggered a bonus
         * @param reelStops Stop indexes for the reel set
         * @param paylineWins List of individual payline wins if applicable
         */
        function ReelSpinData(spinIndex, paylineWinCount, scatterWinCount, reelsetIndex, spinWins, freeSpin, bonusAwarded, reelStops, paylineWins) {
            this.spinIndex = spinIndex;
            this.paylineWinCount = paylineWinCount;
            this.scatterWinCount = scatterWinCount;
            this.reelsetIndex = reelsetIndex;
            this.spinWins = spinWins;
            this.freeSpin = freeSpin;
            this.bonusAwarded = bonusAwarded;
            this.reelStops = reelStops;
            this.paylineWins = paylineWins;
        }
        return ReelSpinData;
    })();
    server.ReelSpinData = ReelSpinData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class ReelStripData
     *
     * @description Data for the symbols on a reel
     *
     * Given on INIT responses
     */
    var ReelStripData = (function () {
        /**
         * Creates a new ReelStripData object
         * @param id Index of the reel
         */
        function ReelStripData(id) {
            this.symbols = [];
        }
        /**
         * Gets the reel index
         */
        ReelStripData.prototype.getId = function () {
            return this.id;
        };
        /**
         * Set the symbols for the reel
         * @param symbols List of symbols id's
         */
        ReelStripData.prototype.setSymbols = function (symbols) {
            this.symbols = symbols;
        };
        /**
         * Get the symbols for the reel
         */
        ReelStripData.prototype.getSymbols = function () {
            return this.symbols;
        };
        return ReelStripData;
    })();
    server.ReelStripData = ReelStripData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class ReelsData
     *
     * @description Data for all reel sets
     *
     * Given on INIT responses
     */
    var ReelsData = (function () {
        function ReelsData() {
        }
        return ReelsData;
    })();
    server.ReelsData = ReelsData;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class RequesterEvent<T>
     *
     * @description Dispatched by IRequester implementations when they recieve a server response
     */
    var RequesterEvent = (function (_super) {
        __extends(RequesterEvent, _super);
        /**
         * Creates a new RequesterEvent
         */
        function RequesterEvent(type, errorData) {
            if (errorData === void 0) { errorData = null; }
            _super.call(this, type);
            this.errorData = errorData;
        }
        /**
         * Dispatched when a non error response is received from the server
         */
        RequesterEvent.RESPONSE_RECEIVED = "RequesterEvent_RESPONSE_RECEIVED";
        /**
         * Dispatched when a error response is received from the server
         */
        RequesterEvent.RESPONSE_ERROR = "RequesterEvent_RESPONSE_ERROR";
        return RequesterEvent;
    })(borgevent.Event);
    server.RequesterEvent = RequesterEvent;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class EndResponse
     *
     * @description Basic implementation of an EndResponse, designed to be extended by server specific version e.g. GLSEndResponse
     */
    var EndResponse = (function () {
        function EndResponse() {
        }
        /**
         * @inheritdoc
         */
        EndResponse.prototype.getParsers = function () {
            return [];
        };
        return EndResponse;
    })();
    server.EndResponse = EndResponse;
})(server || (server = {}));
var server;
(function (server) {
    /**
    * @class ErrorResponse
    *
    * @description Basic implementation of an ErrorResponse, designed to be extended by server specific version e.g. GLSErrorResponse
    */
    var ErrorResponse = (function () {
        function ErrorResponse() {
        }
        /**
         * @inheritdoc
         */
        ErrorResponse.prototype.getParsers = function () {
            return [];
        };
        return ErrorResponse;
    })();
    server.ErrorResponse = ErrorResponse;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class InitResponse
     *
     * @description Basic implementation of an InitResponse, designed to be extended by server specific version e.g. GLSInitResponse
     */
    var InitResponse = (function () {
        function InitResponse() {
        }
        /**
         * @inheritdoc
         */
        InitResponse.prototype.getParsers = function () {
            return [];
        };
        return InitResponse;
    })();
    server.InitResponse = InitResponse;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class LogicResponse
     *
     * @description Basic implementation of an LogicResponse, designed to be extended by server specific version e.g. GLSLogicResponse
     */
    var LogicResponse = (function () {
        function LogicResponse() {
        }
        /**
         * @inheritdoc
         */
        LogicResponse.prototype.getParsers = function () {
            return [];
        };
        return LogicResponse;
    })();
    server.LogicResponse = LogicResponse;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class ServerResponseEvent<T>
     *
     * @description Events dispatched by a specific server implementation
     */
    var ServerResponseEvent = (function (_super) {
        __extends(ServerResponseEvent, _super);
        /**
         * Creates a new ServerResponseEvent object
         * @param eventName The type of eventName
         * @param response The response in a specified format
         */
        function ServerResponseEvent(eventName, response) {
            _super.call(this, eventName);
            this._reponse = response;
        }
        Object.defineProperty(ServerResponseEvent.prototype, "response", {
            /**
             * The response in a specified type
             */
            get: function () {
                return this._reponse;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatched when an INIT response has been received from the server
         */
        ServerResponseEvent.INIT_RESPONSE = "ServerResponseEvent_INIT_RESPONSE";
        /**
         * Dispatched when an LOGIC response has been received from the server
         */
        ServerResponseEvent.LOGIC_RESPONSE = "ServerResponseEvent_LOGIC_RESPONSE";
        /**
         * Dispatched when an END response has been received from the server
         */
        ServerResponseEvent.END_RESPONSE = "ServerResponseEvent_END_RESPONSE";
        /**
         * Dispatched when an ERROR response has been received from the server
         */
        ServerResponseEvent.ERROR_RESPONSE = "ServerResponseEvent_ERROR_RESPONSE";
        return ServerResponseEvent;
    })(borgevent.Event);
    server.ServerResponseEvent = ServerResponseEvent;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSServer
     *
     * @description This class act's as centralised object for making different types of requests to the GLSErrorResponse
     *
     * User must specify the Init/Logic/End response/request data class types
     *
     * User must set an Init/Logic/End GLSRequester implementation
     */
    var GLSServer = (function (_super) {
        __extends(GLSServer, _super);
        /**
         * Creates a new GLSServer object
         * @param url GLS url to make requests to
         * @param glmId GLM numbered ID
         * @param glmVersion GLM version
         * @param metaData Metadata from the partner adapater
         * @param partnerAdapter Partner adapter that wraps the game
         */
        function GLSServer(url, glmId, glmVersion, metaData, partnerAdapter) {
            _super.call(this);
            this.init(url, glmId, glmVersion, metaData, partnerAdapter);
        }
        /**
        * Sets up data
        * @param url GLS url to make requests to
        * @param glmId GLM numbered ID
        * @param glmVersion GLM version
        * @param metaData Metadata from the partner adapater
        * @param partnerAdapter Partner adapter that wraps the game
        */
        GLSServer.prototype.init = function (url, glmId, glmVersion, metaData, partnerAdapter) {
            this._url = url;
            this._glmId = glmId;
            this._glmVersion = glmVersion;
            this._metaData = metaData;
            this._partnerAdapter = partnerAdapter;
            if (this._partnerAdapter) {
                this._sessionId = this._partnerAdapter.getSessionData().getSessionID();
            }
        };
        /**
         * Set the INIT GLSRequester object
         */
        GLSServer.prototype.setInitRequester = function (initRequester) {
            this._initRequester = initRequester;
            this._initRequester.addEventListener(server.RequesterEvent.RESPONSE_RECEIVED, this.onInitResponse, this);
            this._initRequester.addEventListener(server.RequesterEvent.RESPONSE_ERROR, this.onErrorResponse, this);
        };
        /**
         * Set the LOGIC GLSRequester object
         */
        GLSServer.prototype.setLogicRequester = function (logicRequester) {
            this._logicRequester = logicRequester;
            this._logicRequester.addEventListener(server.RequesterEvent.RESPONSE_RECEIVED, this.onLogicResponse, this);
            this._logicRequester.addEventListener(server.RequesterEvent.RESPONSE_ERROR, this.onErrorResponse, this);
        };
        /**
         * Set the END GLSRequester object
         */
        GLSServer.prototype.setEndRequester = function (endRequester) {
            this._endRequester = endRequester;
            this._endRequester.addEventListener(server.RequesterEvent.RESPONSE_RECEIVED, this.onEndResponse, this);
            this._endRequester.addEventListener(server.RequesterEvent.RESPONSE_ERROR, this.onErrorResponse, this);
        };
        /**
         * Make an INIT request to the server
         * @param data Data to be encoded for the request
         */
        GLSServer.prototype.makeInitRequest = function (data) {
            this._initRequester.setProperties(this._url, this._glmId, this._glmVersion, this._metaData, this._partnerAdapter, this._sessionId);
            this._initRequester.makeRequest(data);
        };
        /**
         * Make an LOGIC request to the server
         * @param data Data to be encoded for the request
         */
        GLSServer.prototype.makeLogicRequest = function (data) {
            this._logicRequester.setProperties(this._url, this._glmId, this._glmVersion, this._metaData, this._partnerAdapter, this._sessionId);
            this._logicRequester.makeRequest(data);
        };
        /**
         * Make an END request to the server
         * @param data Data to be encoded for the request
         */
        GLSServer.prototype.makeEndRequest = function (data) {
            this._endRequester.setProperties(this._url, this._glmId, this._glmVersion, this._metaData, this._partnerAdapter, this._sessionId);
            this._endRequester.makeRequest(data);
        };
        /**
         * Disptach ServerResponseEvent.INIT_RESPONSE with the game response data as a payload
         */
        GLSServer.prototype.onInitResponse = function (e) {
            this._sessionId = this._initRequester.getResponse().getSessionId();
            var event = new server.ServerResponseEvent(server.ServerResponseEvent.INIT_RESPONSE, this._initRequester.getResponse());
            this.dispatchEvent(event);
        };
        /**
         * Disptach ServerResponseEvent.LOGIC_RESPONSE with the game response data as a payload
         */
        GLSServer.prototype.onLogicResponse = function (e) {
            this._sessionId = this._logicRequester.getResponse().getSessionId();
            var event = new server.ServerResponseEvent(server.ServerResponseEvent.LOGIC_RESPONSE, this._logicRequester.getResponse());
            this.dispatchEvent(event);
        };
        /**
         * Disptach ServerResponseEvent.END_RESPONSE with the game response data as a payload
         */
        GLSServer.prototype.onEndResponse = function (e) {
            this._sessionId = this._endRequester.getResponse().getSessionId();
            var event = new server.ServerResponseEvent(server.ServerResponseEvent.END_RESPONSE, this._endRequester.getResponse());
            this.dispatchEvent(event);
        };
        /**
         * Disptach ServerResponseEvent.ERROR_RESPONSE with the game error data as a payload
         */
        GLSServer.prototype.onErrorResponse = function (e) {
            var xmlParser = new DOMParser();
            var xmlDoc = xmlParser.parseFromString(e.errorData.responseText, "text/xml");
            var response = new server.GLSErrorResponse();
            for (var i = 0; i < response.getParsers().length; i++) {
                response.getParsers()[i].parse(xmlDoc, response);
            }
            response.errorData.rawData = e.errorData;
            var event = new server.ServerResponseEvent(server.ServerResponseEvent.ERROR_RESPONSE, response);
            this.dispatchEvent(event);
        };
        /**
         * Gets the last LOGIC game response data
         */
        GLSServer.prototype.getLogicResponse = function () {
            return this._logicRequester.getResponse();
        };
        /**
         * Gets the last INIT game response data
         */
        GLSServer.prototype.getInitResponse = function () {
            return this._initRequester.getResponse();
        };
        /**
         * Gets the last END game response data
         */
        GLSServer.prototype.getEndResponse = function () {
            return this._endRequester.getResponse();
        };
        /**
         * Gets the Logic Requester
         */
        GLSServer.prototype.getLogicResquester = function () {
            return this._logicRequester;
        };
        /**
         * Gets the Init Requester
         */
        GLSServer.prototype.getInitResquester = function () {
            return this._initRequester;
        };
        /**
         * Gets the End Requester
         */
        GLSServer.prototype.getEndResquester = function () {
            return this._endRequester;
        };
        return GLSServer;
    })(borgevent.EventDispatcher);
    server.GLSServer = GLSServer;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSEndResponse
     *
     * @description GLS implementation of an EndResponse, uses GLSBalanceParser, GLSPlatformParser
     */
    var GLSEndResponse = (function (_super) {
        __extends(GLSEndResponse, _super);
        function GLSEndResponse() {
            _super.apply(this, arguments);
        }
        /**
         * @inheritdoc
         */
        GLSEndResponse.prototype.getParsers = function () {
            return [
                new server.GLSBalanceParser(),
                new server.GLSPlatformParser()
            ];
        };
        /**
         * Gets the session id of the response
         */
        GLSEndResponse.prototype.getSessionId = function () {
            return this.platformData.sessionId;
        };
        return GLSEndResponse;
    })(server.EndResponse);
    server.GLSEndResponse = GLSEndResponse;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSErrorResponse
     *
     * @description GLS implementation of an ErrorResponse, uses GLSErrorParser
     */
    var GLSErrorResponse = (function (_super) {
        __extends(GLSErrorResponse, _super);
        function GLSErrorResponse() {
            _super.apply(this, arguments);
        }
        /**
         * @inheritdoc
         */
        GLSErrorResponse.prototype.getParsers = function () {
            return [
                new server.GLSErrorParser()
            ];
        };
        return GLSErrorResponse;
    })(server.ErrorResponse);
    server.GLSErrorResponse = GLSErrorResponse;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSHeader
     *
     * @description Header required by the GLS, this is constructed automatically unlike other IEncoder implementations
     */
    var GLSHeader = (function () {
        /**
         * Creates a new GLSHeader
         * @param metadata Partneradapter metadata that we can get data from
         * @param sessionData Partneradapter sessiondata that we can get data from
         * @param glsServerSessionId The current session id form the GLS
         * @param gameId GLM numbered game code
         * @param gameVersion GLM version
         */
        function GLSHeader(metadata, sessionData, glsServerSessionId, gameId, gameVersion) {
            /**
             * ID of casinarena's GLS
             */
            this.GLSID_CASINARENA = "4";
            /**
             * ID of freeplay's GLS
             */
            this.GLSID_FREEPLAY = "65535";
            this.affiliate = sessionData.getContextID();
            this.freePlay = !metadata.isRealMoney();
            this.gameCodeRGI = metadata.getGameCode();
            this.gameId = gameId;
            this.glsId = (this.freePlay ? this.GLSID_FREEPLAY : this.GLSID_CASINARENA);
            this.langCode = metadata.getLocale();
            this.sessionId = glsServerSessionId;
            this.userId = sessionData.getPlayerID();
            this.version = gameVersion;
            this.promotions = false;
            this.channel = "I";
            this.userType = "C";
            this.currencyCode = "";
        }
        /**
         * Converts the data to an xml string to be sent to the GLS
         */
        GLSHeader.prototype.parse = function () {
            var xmlString = ""; //"<GameRequest type=\"Init\">"
            xmlString += "<Header";
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
            xmlString += "/>";
            //xmlString += "</GameRequest>"
            return xmlString;
        };
        return GLSHeader;
    })();
    server.GLSHeader = GLSHeader;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSInitResponse
     *
     * @description GLS implementation of an InitResponse
     *
     * Uses GLSBalanceParser, GLSBetParser, GLSReelParser, GLSPlatformParser, GLSPaylinesParser, GLSAwardsParser, GLSCurrencyParser
     */
    var GLSInitResponse = (function (_super) {
        __extends(GLSInitResponse, _super);
        function GLSInitResponse() {
            _super.apply(this, arguments);
        }
        /**
         * @inheritdoc
         */
        GLSInitResponse.prototype.getParsers = function () {
            return [
                new server.GLSBalanceParser(),
                new server.GLSBetParser(),
                new server.GLSReelParser(),
                new server.GLSPlatformParser(),
                new server.GLSPaylinesParser(),
                new server.GLSAwardsParser(),
                new server.GLSCurrencyParser()
            ];
        };
        /**
         * @inheritdoc
         */
        GLSInitResponse.prototype.getSessionId = function () {
            return this.platformData.sessionId;
        };
        return GLSInitResponse;
    })(server.InitResponse);
    server.GLSInitResponse = GLSInitResponse;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSLogicResponse
     *
     * @description GLS implementation of an LogicResponse
     *
     * Uses GLSBalanceParser, GLSPlatformParser, GLSGameResultParser, GLSReelResultParser
     */
    var GLSLogicResponse = (function (_super) {
        __extends(GLSLogicResponse, _super);
        function GLSLogicResponse() {
            _super.apply(this, arguments);
        }
        /**
         * @inheritdoc
         */
        GLSLogicResponse.prototype.getParsers = function () {
            return [
                new server.GLSBalanceParser(),
                new server.GLSPlatformParser(),
                new server.GLSGameResultParser(),
                new server.GLSReelResultParser()
            ];
        };
        /**
         * @inheritdoc
         */
        GLSLogicResponse.prototype.getSessionId = function () {
            return this.platformData.sessionId;
        };
        return GLSLogicResponse;
    })(server.LogicResponse);
    server.GLSLogicResponse = GLSLogicResponse;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSRequest
     *
     * @description GLS implementation of IRequest<string>
     *
     * User can specify a set of encoders before sending it via an IRequester
     */
    var GLSRequest = (function () {
        /**
         * Creates a new GLSRequest object
         * @param encoders List of encoders to format data to xml strings
         */
        function GLSRequest(encoders) {
            this._encoders = encoders;
        }
        /**
         * @inheritdoc
         */
        GLSRequest.prototype.getEncoders = function () {
            return this._encoders;
        };
        return GLSRequest;
    })();
    server.GLSRequest = GLSRequest;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSCurrencyEncoder
     *
     * @description Encodes the currency multiplier to an xml string
     */
    var GLSCurrencyEncoder = (function () {
        /**
         * Creates a new GLSCurrencyEncoder object
         * @param currencyMultiplier Currency multiplier from CA
         */
        function GLSCurrencyEncoder(currencyMultiplier) {
            this._currencyMultiplier = currencyMultiplier;
        }
        /**
         * @inheritdoc
         */
        GLSCurrencyEncoder.prototype.parse = function () {
            var xmlStr = "<AccountData><CurrencyMultiplier>";
            xmlStr += this._currencyMultiplier.toString();
            xmlStr += "</CurrencyMultiplier></AccountData>";
            return xmlStr;
        };
        return GLSCurrencyEncoder;
    })();
    server.GLSCurrencyEncoder = GLSCurrencyEncoder;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSStakeEncoder
     *
     * @description Encodes the stake and lines
     */
    var GLSStakeEncoder = (function () {
        /**
         * Cretaes a new GLSStakeEncoder object
         * @param stakePerLine Wager per line
         * @param lines Total lines bet on
         */
        function GLSStakeEncoder(stakePerLine, lines) {
            this._stakePerLine = stakePerLine;
            this._lines = lines;
        }
        /**
         * @inheritdoc
         */
        GLSStakeEncoder.prototype.parse = function () {
            var xmlStr = "<Stake ";
            xmlStr += " total=\"" + (this._stakePerLine * this._lines).toString() + "\"";
            xmlStr += " lines=\"" + this._lines.toString() + "\"";
            xmlStr += "/>";
            return xmlStr;
        };
        return GLSStakeEncoder;
    })();
    server.GLSStakeEncoder = GLSStakeEncoder;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSAwardsParser
     *
     * @description Parses the awards from an INIT response and sets it to object.awardsData
     *
     * object.awardsData is expected to be an AwardsData variable
     */
    var GLSAwardsParser = (function () {
        function GLSAwardsParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSAwardsParser.prototype.parse = function (input, object) {
            var data = new server.AwardsData();
            data.awards = [];
            var node = input.getElementsByTagName("AwardsInfo")[0];
            if (node) {
                var attributes = node.attributes;
                var maxWin = parseInt(attributes.getNamedItem("maxWin").value, 10);
                data.maxWin = maxWin;
                // Extract slot award data
                var numAwards = parseInt(attributes.getNamedItem("awardCount").value, 10);
                var nodeChildren = node.childNodes;
                for (var awardIndex = 0; awardIndex < numAwards; ++awardIndex) {
                    var awardDataSource = nodeChildren[awardIndex];
                    var paySummary = awardDataSource.textContent.split("|");
                    var pay = new server.AwardData();
                    pay.id = parseInt(paySummary[0], 10);
                    pay.numSymbols = parseInt(paySummary[1], 10);
                    pay.value = parseInt(paySummary[2], 10);
                    data.awards.push(pay);
                }
                object.awardsData = data;
            }
        };
        return GLSAwardsParser;
    })();
    server.GLSAwardsParser = GLSAwardsParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSBalanceParser
     *
     * @description Parses the balances from an INIT, LOGIC or Error response and sets it to object.balanceData
     *
     * object.balanceData is expected to be an BalanceData variable
     */
    var GLSBalanceParser = (function () {
        function GLSBalanceParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSBalanceParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("Balances")[0];
            var data = {};
            if (node) {
                var nodeChildren = node.childNodes;
                var numChildren = nodeChildren.length;
                for (var childIndex = 0; childIndex < numChildren; ++childIndex) {
                    var balanceSource = nodeChildren[childIndex];
                    if (balanceSource.nodeName == "Balance") {
                        var attributes = balanceSource.attributes;
                        data[attributes.getNamedItem("name").value] = parseInt(attributes.getNamedItem("value").value, 10);
                    }
                }
                object.balanceData = new server.BalanceData(data);
            }
        };
        return GLSBalanceParser;
    })();
    server.GLSBalanceParser = GLSBalanceParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSBetParser
     *
     * @description Parses the available bets from an INIT response and sets it to object.betData
     *
     * object.betData is expected to be an BetData variable
     */
    var GLSBetParser = (function () {
        function GLSBetParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSBetParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("Stakes")[0];
            var data = new server.BetData();
            if (node != null) {
                var attributes = node.attributes;
                data.setDefaultIndex(parseInt(attributes.getNamedItem("defaultIndex").value, 10));
                data.setAvailableBets(node.textContent.split("|").map(Number));
            }
            object.betData = data;
        };
        return GLSBetParser;
    })();
    server.GLSBetParser = GLSBetParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSCurrencyParser
     *
     * @description Parses the currency data from an INIT response and sets it to object.currencyData
     *
     * object.currencyData is expected to be an CurrencyData variable
     */
    var GLSCurrencyParser = (function () {
        function GLSCurrencyParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSCurrencyParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("CurrencyInformation")[0];
            var data = new util.CurrencyData();
            //Default
            data.name = "";
            data.symbol = "";
            data.exchangeRate = 1;
            data.grouping = 3;
            data.groupingSeparator = ",";
            data.fractionalDigits = 2;
            data.fractionalSeparator = ".";
            data.currencyCodeSpacing = 1;
            data.currencyCodeBeforeAmount = false;
            data.currencySymbolSpacing = 0;
            data.currencySymbolBeforeAmount = false;
            if (node != null) {
                var cNode = node.childNodes;
                for (var i = 0; i < cNode.length; i++) {
                    switch (cNode[i].nodeName) {
                        case 'Currency':
                            data.name = cNode[i].textContent;
                            break;
                        case 'ExchangeRate':
                            data.exchangeRate = parseInt(cNode[i].textContent, 10);
                            break;
                        case 'CurrencySymbol':
                            data.symbol = cNode[i].textContent;
                            break;
                        case 'Grouping':
                            data.grouping = parseInt(cNode[i].textContent, 10);
                            break;
                        case 'GroupingSeperator':
                            data.groupingSeparator = cNode[i].textContent;
                            break;
                        case 'GroupingSeparator':
                            data.groupingSeparator = cNode[i].textContent;
                            break;
                        case 'FracDigits':
                            data.fractionalDigits = parseInt(cNode[i].textContent, 10);
                            break;
                        case 'DecimalSeperator':
                            data.fractionalSeparator = cNode[i].textContent;
                            break;
                        case 'DecimalSeparator':
                            data.fractionalSeparator = cNode[i].textContent;
                            break;
                        case 'CurrencyCodeSpacing':
                            data.currencyCodeSpacing = parseInt(cNode[i].textContent, 10);
                            break;
                        case 'CodeBeforeAmount':
                            data.currencyCodeBeforeAmount = (cNode[i].textContent == 'true');
                            break;
                        case 'CurrencySymbolSpacing':
                            data.currencySymbolSpacing = parseInt(cNode[i].textContent, 10);
                            break;
                        case 'SymbolBeforeAmount':
                            data.currencySymbolBeforeAmount = (cNode[i].textContent == 'true');
                            break;
                    }
                }
            }
            object.currencyData = data;
        };
        return GLSCurrencyParser;
    })();
    server.GLSCurrencyParser = GLSCurrencyParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSErrorParser
     *
     * @description Parses the error data from an ERROR response and sets it to object.errorData
     *
     * object.errorData is expected to be an ErrorData variable
     */
    var GLSErrorParser = (function () {
        function GLSErrorParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSErrorParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("GameResponse")[0];
            var data = new server.ErrorData();
            if (node) {
                var errorNode = node.firstChild;
                if (errorNode != null) {
                    var attributes = node.attributes;
                    data.message = errorNode.attributes.getNamedItem("msg").value;
                    data.instruction = errorNode.attributes.getNamedItem("instruction").value;
                }
            }
            data.rawData = input;
            object.errorData = data;
        };
        return GLSErrorParser;
    })();
    server.GLSErrorParser = GLSErrorParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSGameResultParser
     *
     * @description Parses the basic game result data from a LOGIC response and sets it to object.gameResultData
     *
     * object.gameResultData is expected to be an GameResultData variable
     */
    var GLSGameResultParser = (function () {
        function GLSGameResultParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSGameResultParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("GameResult")[0];
            var attributes = node.attributes;
            var nodeChildren = node.childNodes;
            var stake = parseInt(node.attributes.getNamedItem("stake").value);
            var stakePerLine = parseInt(node.attributes.getNamedItem("stakePerLine").value);
            var paylineCount = parseInt(node.attributes.getNamedItem("paylineCount").value);
            var totalWin = parseInt(node.attributes.getNamedItem("totalWin").value);
            object.gameResultData = new server.GameResultData(stake, stakePerLine, paylineCount, totalWin);
        };
        return GLSGameResultParser;
    })();
    server.GLSGameResultParser = GLSGameResultParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSPaylinesParser
     *
     * @description Parses the paylines data from an INIT response and sets it to object.paylinesData
     *
     * object.paylinesData is expected to be an PaylinesData variable
     */
    var GLSPaylinesParser = (function () {
        function GLSPaylinesParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSPaylinesParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("PaylineInfo")[0];
            var data = new server.PaylinesData();
            data.paylines = [];
            if (node != null) {
                var attributes = node.attributes;
                var nodeChildren = node.childNodes;
                var numPaylines = parseInt(attributes.getNamedItem("paylineCount").value, 10);
                for (var paylineIndex = 0; paylineIndex < numPaylines; ++paylineIndex) {
                    var paylineDataSource = nodeChildren[paylineIndex];
                    var offsets = paylineDataSource.textContent.split("|").map(Number);
                    var selectable = (attributes.getNamedItem("paylineCount").value == "y");
                    var payline = new server.PaylineData();
                    payline.offsets = offsets;
                    payline.selectable = selectable;
                    data.paylines.push(payline);
                }
            }
            object.paylinesData = data;
        };
        return GLSPaylinesParser;
    })();
    server.GLSPaylinesParser = GLSPaylinesParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSPlatformParser
     *
     * @description Parses the platform data from an INIT, LOGIC or END response and sets it to object.platformData
     *
     * object.platformData is expected to be an PlatformData variable
     */
    var GLSPlatformParser = (function () {
        function GLSPlatformParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSPlatformParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("Header")[0];
            var data = new server.PlatformData();
            if (node != null) {
                var attr = node.attributes;
                var attrLength = attr.length;
                for (var i = 0; i < attrLength; ++i) {
                    switch (attr[i].nodeName) {
                        case 'sessionID':
                            data.sessionId = attr[i].nodeValue;
                            break;
                        case 'gameID':
                            data.gameId = attr[i].nodeValue;
                            break;
                        case 'lang':
                            data.languageCode = attr[i].nodeValue;
                            break;
                        case 'versionID':
                            data.version = attr[i].nodeValue;
                            break;
                    }
                }
                var currencyMultiplierNode = input.getElementsByTagName("CurrencyMultiplier")[0];
                if (currencyMultiplierNode != null) {
                    data.currencyMultiplier = parseInt(currencyMultiplierNode.textContent, 10);
                }
                else {
                    data.currencyMultiplier = 1;
                }
            }
            object.platformData = data;
        };
        return GLSPlatformParser;
    })();
    server.GLSPlatformParser = GLSPlatformParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSPlatformParser
     *
     * @description Parses the reel set data from an INIT response and sets it to object.reelsData
     *
     * object.reelsData is expected to be an ReelsData variable
     */
    var GLSReelParser = (function () {
        function GLSReelParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSReelParser.prototype.parse = function (input, object) {
            var node = input.getElementsByTagName("ReelInfo")[0];
            var reels = new server.ReelsData();
            reels.reels = [];
            var attributes = node.attributes;
            var nodeChildren = node.childNodes;
            // Retrieve all node children and look for ReelSet identifier to parse reel group
            var numChildren = nodeChildren.length;
            for (var childIndex = 0; childIndex < numChildren; ++childIndex) {
                var groupDataSource = nodeChildren[childIndex];
                if (groupDataSource.nodeName == "ReelSet") {
                    var groupAttributes = groupDataSource.attributes;
                    var reel = new server.ReelData(parseInt(groupAttributes.getNamedItem("reelSetIndex").value, 10));
                    reel.setFeatureId(parseInt(groupAttributes.getNamedItem("featIndex").value, 10));
                    // Retrieve all node children and look for Reel identifier to parse reel strip
                    var stripSourceLength = groupDataSource.childNodes.length;
                    for (var stripSourceIndex = 0; stripSourceIndex < stripSourceLength; ++stripSourceIndex) {
                        var stripDataSource = groupDataSource.childNodes[stripSourceIndex];
                        if (stripDataSource.nodeName == "Reel") {
                            var stripIndex = parseInt(stripDataSource.attributes.getNamedItem("reelIndex").value, 10);
                            var strip = new server.ReelStripData(stripIndex);
                            strip.setSymbols(stripDataSource.textContent.split("|").map(Number));
                            reel.addStrip(stripIndex, strip);
                        }
                    }
                    reels.reels.push(reel);
                }
                object.reelsData = reels;
            }
        };
        return GLSReelParser;
    })();
    server.GLSReelParser = GLSReelParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSPlatformParser
     *
     * @description Parses the reel spin results data from a LOGIC response and sets it to object.reelSpinData
     *
     * object.reelSpinData is expected to be an ReelSpinData[] variable
     */
    var GLSReelResultParser = (function () {
        function GLSReelResultParser() {
        }
        /**
         * Parses the server input data and sets it on an IResponse object
         */
        GLSReelResultParser.prototype.parse = function (input, object) {
            object.reelSpinData = [];
            var node = input.getElementsByTagName("GameResult")[0];
            var attributes = node.attributes;
            var nodeChildren = node.childNodes;
            for (var i = 0; i < nodeChildren.length; ++i) {
                if (nodeChildren[i].nodeName == "ReelResults") {
                    this.populateResults(object, nodeChildren[i]);
                }
            }
        };
        GLSReelResultParser.prototype.populateResults = function (object, node) {
            var spinNode = node.childNodes;
            for (var spinNodeIndex = 0; spinNodeIndex < spinNode.length; ++spinNodeIndex) {
                // Parse spin data child nodes
                var spinDataSource = spinNode[spinNodeIndex].childNodes;
                var reelStops;
                var paylineWins = [];
                for (var spinDataIndex = 0; spinDataIndex < spinDataSource.length; ++spinDataIndex) {
                    var spinDataSubType = spinDataSource[spinDataIndex];
                    var nodeType = spinDataSubType.nodeName;
                    if (nodeType == "ReelStops") {
                        reelStops = spinDataSubType.textContent.split("|").map(Number);
                    }
                    else if (nodeType == "PaylineWin") {
                        var paylineIndex = 0;
                        var paylineWinVal = 0;
                        var paylineAwardIndex = 0;
                        var paylineAwardTableIndex = 0;
                        var paylineReelPositions = [];
                        if (spinDataSubType.attributes.getNamedItem("index")) {
                            paylineIndex = parseInt(spinDataSubType.attributes.getNamedItem("index").value);
                        }
                        if (spinDataSubType.attributes.getNamedItem("winVal")) {
                            paylineWinVal = parseInt(spinDataSubType.attributes.getNamedItem("winVal").value);
                        }
                        if (spinDataSubType.attributes.getNamedItem("awardIndex")) {
                            paylineAwardIndex = parseInt(spinDataSubType.attributes.getNamedItem("awardIndex").value);
                        }
                        if (spinDataSubType.attributes.getNamedItem("awardTableIndex")) {
                            paylineAwardTableIndex = parseInt(spinDataSubType.attributes.getNamedItem("awardTableIndex").value);
                        }
                        if (spinDataSubType.textContent) {
                            paylineReelPositions = spinDataSubType.textContent.split("|").map(Number);
                        }
                        paylineWins.push(new server.PaylineWinData(paylineIndex, paylineWinVal, paylineAwardIndex, paylineAwardTableIndex, paylineReelPositions));
                    }
                }
                if (spinNode[spinNodeIndex].nodeName == "ReelSpin") {
                    // Parse spin data attributes (at root level of this node only)
                    var spinIndex = 0;
                    var paylineWinCount = 0;
                    var scatterWinCount = 0;
                    var reelsetIndex = 0;
                    var spinWins = 0;
                    var freeSpin = false;
                    var bonusAwarded = false;
                    if (spinNode[spinNodeIndex].attributes.getNamedItem("spinIndex")) {
                        spinIndex = parseInt(spinNode[spinNodeIndex].attributes.getNamedItem("spinIndex").value);
                    }
                    if (spinNode[spinNodeIndex].attributes.getNamedItem("winCountPL")) {
                        paylineWinCount = parseInt(spinNode[spinNodeIndex].attributes.getNamedItem("winCountPL").value);
                    }
                    if (spinNode[spinNodeIndex].attributes.getNamedItem("winCountSC")) {
                        scatterWinCount = parseInt(spinNode[spinNodeIndex].attributes.getNamedItem("winCountSC").value);
                    }
                    if (spinNode[spinNodeIndex].attributes.getNamedItem("reelsetIndex")) {
                        reelsetIndex = parseInt(spinNode[spinNodeIndex].attributes.getNamedItem("reelsetIndex").value);
                    }
                    if (spinNode[spinNodeIndex].attributes.getNamedItem("spinWins")) {
                        spinWins = parseInt(spinNode[spinNodeIndex].attributes.getNamedItem("spinWins").value);
                    }
                    if (spinNode[spinNodeIndex].attributes.getNamedItem("freeSpin")) {
                        freeSpin = spinNode[spinNodeIndex].attributes.getNamedItem("freeSpin").value == "Y" ? true : false;
                    }
                    if (spinNode[spinNodeIndex].attributes.getNamedItem("bonusAwarded")) {
                        bonusAwarded = spinNode[spinNodeIndex].attributes.getNamedItem("bonusAwarded").value == "Y" ? true : false;
                    }
                    object.reelSpinData.push(new server.ReelSpinData(spinIndex, paylineWinCount, scatterWinCount, reelsetIndex, spinWins, freeSpin, bonusAwarded, reelStops, paylineWins));
                }
            }
        };
        return GLSReelResultParser;
    })();
    server.GLSReelResultParser = GLSReelResultParser;
})(server || (server = {}));
var server;
(function (server) {
    /**
     * @class GLSRequester<DataType extends GLSRequest, ResponseType extends IGLSResponse>
     *
     * @description GLS implementation of IRequester, designed to be extended for different request types
     *
     * Handles making XMLHttp requests from encoder output, parsing xml responses and applying them to game data response object via parsers
     *
     * The RequestType and ResponseType can be specified by the user
     */
    var GLSRequester = (function (_super) {
        __extends(GLSRequester, _super);
        /**
         * Creates a new GLSRequester object
         * @param type Response constructor so we can create new instances, this should be the same as the Genric type specified
         */
        function GLSRequester(type) {
            _super.call(this);
            this._type = type;
            this._timeout = 10000;
        }
        /**
         * @inheritdoc
         */
        GLSRequester.prototype.setProperties = function (url, glmId, glmVersion, metaData, partnerAdapter, sessionId) {
            this._url = url;
            this._glmId = glmId;
            this._glmVersion = glmVersion;
            this._metaData = metaData;
            this._partnerAdapter = partnerAdapter;
            this._sessionId = sessionId;
        };
        Object.defineProperty(GLSRequester.prototype, "timeout", {
            get: function () {
                return this._timeout;
            },
            set: function (value) {
                this._timeout = Math.max(0, value);
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Encode the request data, to be overrwritten by sub classes
         */
        GLSRequester.prototype.parseRequestData = function (data) {
            return "";
        };
        /**
         * Create a new game response object and grab data using it's specified parsers
         */
        GLSRequester.prototype.parseResponse = function (xmlHttp) {
            this._response = new this._type();
            var xmlParser = new DOMParser();
            var xmlDoc = xmlParser.parseFromString(xmlHttp.response, "text/xml");
            if (!(xmlDoc.getElementsByTagName("GameResponse")[0]) || (xmlDoc.getElementsByTagName("GameResponse")[0]).attributes.getNamedItem("type").value != this.getResponseType()) {
                this.dispatchEvent(new server.RequesterEvent(server.RequesterEvent.RESPONSE_ERROR, xmlHttp));
                return false;
            }
            else {
                for (var i = 0; i < this._response.getParsers().length; i++) {
                    this._response.getParsers()[i].parse(xmlDoc, this._response);
                }
            }
            console.log(this._response);
            return true;
        };
        /**
         * Response type e.g. INIT, to be overwritten by sub classes
         */
        GLSRequester.prototype.getResponseType = function () {
            return "";
        };
        /**
         * Make the server request with the specified game data
         */
        GLSRequester.prototype.makeRequest = function (data) {
            this.doRequest(this.parseRequestData(data), this._url);
        };
        /**
         * Performs the XMLHttprequest
         */
        GLSRequester.prototype.doRequest = function (xmlStr, url) {
            var request = new XMLHttpRequest();
            request.onloadend = this.onResponse.bind(this);
            request.ontimeout = this.onTimeout.bind(this);
            request.open("POST", url, true);
            request.timeout = this._timeout;
            request.setRequestHeader("Content-Type", "text/xml");
            request.send(xmlStr);
        };
        /**
         * Parse the resposne and dispatch RequesterEvent.RESPONSE_RECEIVED
         */
        GLSRequester.prototype.onResponse = function (e) {
            this._xmlHttpRequest = e.target;
            if (this.parseResponse(e.target)) {
                this._sessionId = this._response.getSessionId();
                this.dispatchEvent(new server.RequesterEvent(server.RequesterEvent.RESPONSE_RECEIVED));
            }
        };
        /**
         * If request times out dispatch RequesterEvent.RESPONSE_ERROR
         *
         * @protected
         * @param {any} e
         */
        GLSRequester.prototype.onTimeout = function (e) {
            this.dispatchEvent(new server.RequesterEvent(server.RequesterEvent.RESPONSE_ERROR));
        };
        /**
         * Get's the game data response that's been created
         */
        GLSRequester.prototype.getResponse = function () {
            return this._response;
        };
        /**
         * Get's the XMLHttpRequest object for this requester
         *
         * @returns {XMLHttpRequest}
         */
        GLSRequester.prototype.getRequestObject = function () {
            return this._xmlHttpRequest;
        };
        return GLSRequester;
    })(borgevent.EventDispatcher);
    server.GLSRequester = GLSRequester;
})(server || (server = {}));
/// <reference path="GLSRequester.ts" />
var server;
(function (server) {
    /**
     * @class GLSEndRequester<DataType extends GLSRequest, ResponseType extends IGLSResponse>
     *
     * @description GLS END implementation of IRequester, designed to be extended for different request types
     *
     * Handles making XMLHttp requests from encoder output, parsing xml responses and applying them to game data response object via parsers
     *
     * The RequestType and ResponseType can be specified by the user
     */
    var GLSEndRequester = (function (_super) {
        __extends(GLSEndRequester, _super);
        /**
         * Creates a new GLSEndRequester object
         * @param type Response constructor so we can create new instances, this should be the same as the Genric type specified
         */
        function GLSEndRequester(type) {
            _super.call(this, type);
            this._type = type;
        }
        /**
         * Encode the request data using the game datas specified encoders
         */
        GLSEndRequester.prototype.parseRequestData = function (data) {
            var sessionData = this._partnerAdapter.getSessionData();
            var header = new server.GLSHeader(this._metaData, sessionData, this._sessionId, this._glmId, this._glmVersion);
            var xmlString = "<GameRequest type=\"EndGame\">";
            xmlString += header.parse();
            for (var i = 0; i < data.getEncoders().length; i++) {
                xmlString += data.getEncoders()[i].parse();
            }
            xmlString += "</GameRequest>";
            return xmlString;
        };
        /**
         * Specifies that this is an 'EndGame' request
         */
        GLSEndRequester.prototype.getResponseType = function () {
            return "EndGame";
        };
        return GLSEndRequester;
    })(server.GLSRequester);
    server.GLSEndRequester = GLSEndRequester;
})(server || (server = {}));
/// <reference path="GLSRequester.ts" />
var server;
(function (server) {
    /**
     * @class GLSInitRequester<DataType extends GLSRequest, ResponseType extends IGLSResponse>
     *
     * @description GLS INIT implementation of IRequester, designed to be extended for different request types
     *
     * Handles making XMLHttp requests from encoder output, parsing xml responses and applying them to game data response object via parsers
     *
     * The RequestType and ResponseType can be specified by the user
     */
    var GLSInitRequester = (function (_super) {
        __extends(GLSInitRequester, _super);
        /**
         * Creates a new GLSInitRequester object
         * @param type Response constructor so we can create new instances, this should be the same as the Genric type specified
         */
        function GLSInitRequester(type) {
            _super.call(this, type);
            this._type = type;
        }
        /**
         * Encode the request data using the game datas specified encoders
         */
        GLSInitRequester.prototype.parseRequestData = function (data) {
            var sessionData = this._partnerAdapter.getSessionData();
            var header = new server.GLSHeader(this._metaData, sessionData, this._sessionId, this._glmId, this._glmVersion);
            var xmlString = "<GameRequest type=\"Init\">";
            xmlString += header.parse();
            for (var i = 0; i < data.getEncoders().length; i++) {
                xmlString += data.getEncoders()[i].parse();
            }
            xmlString += "</GameRequest>";
            return xmlString;
        };
        /**
         * Specifies that this is an 'EndGame' request
         */
        GLSInitRequester.prototype.getResponseType = function () {
            return "Init";
        };
        return GLSInitRequester;
    })(server.GLSRequester);
    server.GLSInitRequester = GLSInitRequester;
})(server || (server = {}));
/// <reference path="GLSRequester.ts" />
var server;
(function (server) {
    /**
     * @class GLSLogicRequester<DataType extends GLSRequest, ResponseType extends IGLSResponse>
     *
     * @description GLS INIT implementation of IRequester, designed to be extended for different request types
     *
     * Handles making XMLHttp requests from encoder output, parsing xml responses and applying them to game data response object via parsers
     *
     * The RequestType and ResponseType can be specified by the user
     */
    var GLSLogicRequester = (function (_super) {
        __extends(GLSLogicRequester, _super);
        /**
         * Creates a new GLSLogicRequester object
         * @param type Response constructor so we can create new instances, this should be the same as the Genric type specified
         */
        function GLSLogicRequester(type) {
            _super.call(this, type);
            this._type = type;
        }
        /**
         * Encode the request data using the game datas specified encoders
         */
        GLSLogicRequester.prototype.parseRequestData = function (data) {
            var sessionData = this._partnerAdapter.getSessionData();
            var header = new server.GLSHeader(this._metaData, sessionData, this._sessionId, this._glmId, this._glmVersion);
            var xmlString = "<GameRequest type=\"Logic\">";
            xmlString += header.parse();
            for (var i = 0; i < data.getEncoders().length; i++) {
                xmlString += data.getEncoders()[i].parse();
            }
            xmlString += "</GameRequest>";
            return xmlString;
        };
        /**
         * Specifies that this is an 'EndGame' request
         */
        GLSLogicRequester.prototype.getResponseType = function () {
            return "Logic";
        };
        return GLSLogicRequester;
    })(server.GLSRequester);
    server.GLSLogicRequester = GLSLogicRequester;
})(server || (server = {}));
var spine2d;
(function (spine2d) {
    /**
     * @class Ajax
     *
     * @description Utility class for loading assets used for Spine
     */
    var Ajax = (function () {
        function Ajax() {
        }
        /**
         * Loads an assets
         *
         * @param url Path of the assets
         * @param callback Function to be called when loaded
         */
        Ajax.get = function (url, callback) {
            var http = undefined;
            if (typeof ActiveXObject != 'undefined') {
                try {
                    http = new ActiveXObject("Msxml2.XMLHTTP");
                }
                catch (e) {
                    try {
                        http = new ActiveXObject("Microsoft.XMLHTTP");
                    }
                    catch (E) {
                        http = undefined;
                    }
                }
            }
            else if (XMLHttpRequest) {
                try {
                    http = new XMLHttpRequest();
                }
                catch (e) {
                    http = false;
                }
            }
            if (!http || !url)
                return;
            if (http.overrideMimeType)
                http.overrideMimeType('text/xml');
            //avoid cache
            var now = "uid=" + Date.now();
            url += (url.indexOf("?") + 1) ? "&" : "?";
            url += now;
            http.open("GET", url, true);
            var local = (url.indexOf('http') != 0);
            http.onreadystatechange = function () {
                if (http.readyState == 4) {
                    if (http.status == 200 || (local && http.responseText != '')) {
                        var result = "";
                        if (http.responseText)
                            result = http.responseText;
                        if (callback)
                            callback(result);
                    }
                    else {
                        console.log('Error ', http.status);
                    }
                }
            };
            http.send(null);
        };
        return Ajax;
    })();
    spine2d.Ajax = Ajax;
})(spine2d || (spine2d = {}));
var spine2d;
(function (spine2d) {
    /**
     * @class Spine2d
     *
     * @description Default implementation of Spine, handles the loading and playing of a Spine animation
     */
    var Spine2d = (function (_super) {
        __extends(Spine2d, _super);
        /**
         * Creates a new Spine2d object
         *
         * @param basePath Directory containing the Spine files
         * @param scale Scale to apply when drawing the animation
         * @param renderer Render that draws the animation
         */
        function Spine2d(basePath, scale, renderer) {
            _super.call(this);
            this._basePath = basePath;
            this._lastTime = 0;
            this._readyToRender = false;
            this._scale = scale;
            this._renderer = renderer;
            this.addChild(this._renderer);
        }
        /**
         * @inheritdoc
         *
         * @param animation @inheritdoc
         * @param repeat @inheritdoc
         */
        Spine2d.prototype.setAnimation = function (animation, repeat) {
            if (repeat === void 0) { repeat = false; }
            this._options.animation = animation;
            this._animationName = animation;
            console.log("setAnimation:", animation);
            this._animation = this._skeleton.data.findAnimation(animation);
        };
        /**
         * @inheritdoc
         *
         * @param from @inheritdoc
         * @param to @inheritdoc
         * @param repeatCount @inheritdoc
         * @param reverse @inheritdoc
         */
        Spine2d.prototype.playFrom = function (from, to, repeatCount, reverse) {
            if (to === void 0) { to = 0; }
            if (repeatCount === void 0) { repeatCount = 0; }
            if (reverse === void 0) { reverse = false; }
            this._lastTime = 0;
            this._animationTime - from * 1000;
            this._playOffset = from;
            this._playTo = to;
            this.doPlay(repeatCount, to, reverse);
        };
        /**
         * @inheritdoc
         *
         * @param repeatCount @inheritdoc
         * @param to @inheritdoc
         * @param reverse @inheritdoc
         */
        Spine2d.prototype.play = function (repeatCount, to, reverse) {
            if (repeatCount === void 0) { repeatCount = 0; }
            if (to === void 0) { to = 0; }
            if (reverse === void 0) { reverse = false; }
            this._animationTime = 0;
            this._lastTime = 0;
            this._playOffset = 0;
            this._playTo = to;
            this.doPlay(repeatCount, to, reverse);
        };
        /**
         * @inheritdoc
         *
         * @param reset @inheritdoc
         */
        Spine2d.prototype.stop = function (reset) {
            if (reset === void 0) { reset = false; }
            if (this._tween) {
                if (reset) {
                    this._tween.pause(0);
                }
                else {
                    this._tween.pause();
                }
            }
        };
        /**
         * @inheritdoc
         *
         * @param options @inheritdoc
         */
        Spine2d.prototype.load = function (options) {
            var _this = this;
            this._readyToRender = false;
            this._options = options;
            var loader = new spine2d.Spine2dLoader();
            loader.load(this._basePath, this._scale, options, function (data) { _this.onSpineLoaded(data); });
        };
        /**
         * @inheritdoc
         *
         * @returns {boolean} @inheritdoc
         */
        Spine2d.prototype.isPlaying = function () {
            var playing = false;
            if (this._tween) {
                playing = TweenMax.isTweening(this);
            }
            return playing;
        };
        /**
         * Create the sekeleton and animation when data has loaded
         *
         * Dispatches SpineEvent.ON_LOADED
         *
         * @param data Loaded data
         */
        Spine2d.prototype.onSpineLoaded = function (data) {
            this._data = data;
            spine.Bone.yDown = true;
            this._skeleton = new spine.Skeleton(data.skeletonData);
            this._skeleton.updateWorldTransform();
            var stateData = new spine.AnimationStateData(data.skeletonData);
            this._animation = data.skeletonData.findAnimation(this._options.animation);
            if (this._options.mix) {
                for (var i = 0; i < this._options.mix.length; i++) {
                    stateData.setMixByName.apply(stateData, this._options.mix[i]);
                }
            }
            if (this._options.skin) {
                this._skeleton.setSkinByName(this._options.skin);
                this._skeleton.setSlotsToSetupPose();
            }
            this.setAnimation(this._options.animation, this._options.repeat);
            this._readyToRender = true;
            if (this._playWhenLoaded) {
                this.playFrom(this._playOffset, this._playTo, this._repeatCount, this._reverse);
                this._playWhenLoaded = false;
            }
            this.dispatchEvent(new spine2d.SpineEvent(spine2d.SpineEvent.ON_LOADED, this));
        };
        /**
         * Creates a tween to update the animation updating
         *
         * @param repeatCount Amount of time to repeat the animation
         * @param to Time when the animation should stop/repeat, 0 for default
         * @param reverse Whether the animation should be played in reverse
         */
        Spine2d.prototype.doPlay = function (repeatCount, to, reverse) {
            if (repeatCount === void 0) { repeatCount = 0; }
            if (to === void 0) { to = 0; }
            if (reverse === void 0) { reverse = false; }
            if (this._tween) {
                this._tween.kill();
            }
            if (!this._readyToRender) {
                this._repeatCount = repeatCount;
                this._playWhenLoaded = true;
                return;
            }
            this._reverse = reverse;
            this.setAnimation(this._options.animation, this._options.repeat);
            var duration = this._data.skeletonData.findAnimation(this._options.animation).duration;
            if (to > 0) {
                duration = to;
            }
            this._animationTime = reverse ? duration : 0;
            this._tween = TweenMax.to(this, duration - this._playOffset, { repeat: repeatCount,
                onComplete: this.handleTweenComplete, onCompleteScope: this,
                onUpdate: this.handleTweenUpdate, onUpdateScope: this,
                onRepeat: this.handleTweenRepeat, onRepeatScope: this });
            this.handleTweenUpdate();
        };
        /**
         * Draws the animation via the set renderer
         */
        Spine2d.prototype.draw = function () {
            this._renderer.draw(this._skeleton, this._scale);
        };
        /**
         * Update the skeleton, animation state and time
         */
        Spine2d.prototype.update = function (dt) {
            if (!this._readyToRender) {
                return;
            }
            if (this._reverse)
                dt = -dt;
            this._animation.apply(this._skeleton, this._animationTime, this._animationTime + dt, false, null);
            this._skeleton.updateWorldTransform();
            this._animationTime += dt;
            var duration = this._data.skeletonData.findAnimation(this._options.animation).duration;
            while (this._animationTime < 0) {
                this._animationTime += duration;
            }
            while (this._animationTime > duration) {
                this._animationTime -= duration;
            }
        };
        /**
         * Callback for the tween
         *
         * Dispatches SpineEvent.ON_UPDATE
         */
        Spine2d.prototype.handleTweenUpdate = function () {
            this.update(this._tween.time() - this._lastTime);
            this.draw();
            if (this.onUpdate) {
                this.dispatchEvent(new spine2d.SpineEvent(spine2d.SpineEvent.ON_UPDATE, this, this._tween.time() + this._playOffset));
            }
            this._lastTime = this._tween.time();
        };
        /**
         * Dispatches SpineEvent.ON_COMPLETE every time the animation completes
         */
        Spine2d.prototype.handleTweenComplete = function () {
            this.dispatchEvent(new spine2d.SpineEvent(spine2d.SpineEvent.ON_COMPLETE, this));
        };
        /**
         * Dispatches SpineEvent.ON_REPEAT every time the animation repeats
         *
         * @protected
         */
        Spine2d.prototype.handleTweenRepeat = function () {
            this.dispatchEvent(new spine2d.SpineEvent(spine2d.SpineEvent.ON_REPEAT, this));
        };
        return Spine2d;
    })(rendering.DisplayObjectContainer);
    spine2d.Spine2d = Spine2d;
})(spine2d || (spine2d = {}));
var spine2d;
(function (spine2d) {
    /**
     * @class Spine2dAtlas
     *
     * @description Data from the .atlas file for the Spine animation
     */
    var Spine2dAtlas = (function (_super) {
        __extends(Spine2dAtlas, _super);
        /**
         * Creates a new Spine2dAtlas object
         *
         * @param atlasText Content from the .atlas file
         * @param basePath Directory containing the Spine files
         */
        function Spine2dAtlas(atlasText, basePath) {
            var _this = this;
            this._basePath = basePath;
            this._textureCount = 0;
            _super.call(this, atlasText, {
                load: function (page, path) {
                    _this.onAtlasLoaded(page, path);
                },
                unload: function (texture) {
                    _this.onAtlasUnload(texture);
                }
            });
        }
        /**
         * Cretaes a new image and properties for the atlas
         *
         * @param page The page of the atlas
         * @path The url of the image within the directory
         */
        Spine2dAtlas.prototype.onAtlasLoaded = function (page, path) {
            var _this = this;
            this._textureCount++;
            page.img = new Image();
            page.img.onload = function () {
                page.width = page.img.width;
                page.height = page.img.height;
                _this.updateUVs(page);
                _this._textureCount--;
            };
            page.img.crossOrigin = "anonymous";
            page.img.src = this._basePath + path;
        };
        /**
         * Delete the image data
         */
        Spine2dAtlas.prototype.onAtlasUnload = function (texture) {
            texture.destroy();
        };
        Object.defineProperty(Spine2dAtlas.prototype, "textureCount", {
            /**
             * Amount of images left to load
             */
            get: function () {
                return this._textureCount;
            },
            enumerable: true,
            configurable: true
        });
        return Spine2dAtlas;
    })(spine.Atlas);
    spine2d.Spine2dAtlas = Spine2dAtlas;
})(spine2d || (spine2d = {}));
var spine2d;
(function (spine2d) {
    /**
     * @class Spine2dCache
     *
     * @description Utility class for handling cached data so the same files aren't re-loaded
     */
    var Spine2dCache = (function () {
        function Spine2dCache() {
        }
        /**
         * Get's data from the cache if it exists
         *
         * @param name Unique ID of the data
         */
        Spine2dCache.getItem = function (name) {
            for (var i = 0; i < this._cacheNames.length; i++) {
                if (this._cacheNames[i] == name) {
                    return this._cache[i];
                }
            }
            return null;
        };
        /**
         * Adds data to the cache
         *
         * @param name Unique ID of the data
         * @param item Loaded data to add
         */
        Spine2dCache.addItem = function (name, item) {
            this._cache.push(item);
            this._cacheNames.push(name);
        };
        /**
         * List of data that has already been loaded
         */
        Spine2dCache._cache = [];
        /**
         * Unique ID's for the data
         */
        Spine2dCache._cacheNames = [];
        return Spine2dCache;
    })();
    spine2d.Spine2dCache = Spine2dCache;
})(spine2d || (spine2d = {}));
var spine2d;
(function (spine2d) {
    /**
     * @class Spine2dData
     *
     * @description Contains data that has been loaded by Spine
     */
    var Spine2dData = (function () {
        function Spine2dData() {
        }
        return Spine2dData;
    })();
    spine2d.Spine2dData = Spine2dData;
})(spine2d || (spine2d = {}));
var spine2d;
(function (spine2d) {
    /**
     * @class Spine2dLoader
     *
     * @description Handles the loading of all spine files and data
     */
    var Spine2dLoader = (function () {
        /**
         * Creates a new Spine2dLoader object
         */
        function Spine2dLoader() {
            this._spineData = new spine2d.Spine2dData();
        }
        /**
         * Loads the files
         *
         * @param path Path within the base directory to the files
         * @param scale Scale to apply to the loaded json
         * @param options Contains names of the files to load
         * @param onLoaded Callback function for when the data has been loaded
         */
        Spine2dLoader.prototype.load = function (path, scale, options, onLoaded) {
            if (onLoaded === void 0) { onLoaded = null; }
            this._basePath = path;
            this._scale = scale;
            this._cachedName = path + options.skeletonName;
            this._onLoaded = onLoaded;
            if (spine2d.Spine2dCache.getItem(this._cachedName)) {
                this._spineData = spine2d.Spine2dCache.getItem(this._cachedName);
                this.completeLoad();
            }
            else {
                this.loadAtlas(options.skeletonName, options.skin, options.mix);
            }
        };
        /**
         * Loads the .atlas file
         */
        Spine2dLoader.prototype.loadAtlas = function (skeletonName, skin, mix) {
            var _this = this;
            spine2d.Ajax.get(this._basePath + skeletonName + ".atlas", function (result) {
                _this.atlasLoaded(result, skeletonName, skin, mix);
            });
        };
        /**
         * Set's the loaded atlas data and waits for images to load
         */
        Spine2dLoader.prototype.atlasLoaded = function (atlasText, skeletonName, skin, mix) {
            this._spineData.atlas = new spine2d.Spine2dAtlas(atlasText, this._basePath);
            this.waitForTextures(skeletonName, skin, mix);
        };
        /**
         * Loads the json file if all images have been loaded
         */
        Spine2dLoader.prototype.waitForTextures = function (skeletonName, skin, mix) {
            var _this = this;
            if (!this._spineData.atlas.textureCount)
                spine2d.Ajax.get(this._basePath + skeletonName + ".json", function (skeletonText) {
                    _this._spineData.skeletonText = skeletonText;
                    _this.completeLoad();
                    spine2d.Spine2dCache.addItem(_this._cachedName, _this._spineData);
                    for (var i = 0; i < _this._spineData.atlas.pages.length; i++) {
                        var asset = new assets.Asset(_this._spineData.atlas.pages[i].img.src, _this._spineData.atlas.pages[i].img.src, _this._spineData.atlas.pages[i].img);
                    }
                });
            else {
                setTimeout(function () { _this.waitForTextures(skeletonName, skin, mix); }, 100);
            }
        };
        /**
         * Sets data and calls the onComplete callback function when all data is loaded
         */
        Spine2dLoader.prototype.completeLoad = function () {
            var json = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(this._spineData.atlas));
            json.scale = this._scale;
            this._spineData.json = json;
            this._spineData.skeletonData = json.readSkeletonData(JSON.parse(this._spineData.skeletonText));
            if (this._onLoaded) {
                this._onLoaded(this._spineData);
            }
        };
        return Spine2dLoader;
    })();
    spine2d.Spine2dLoader = Spine2dLoader;
})(spine2d || (spine2d = {}));
var spine2d;
(function (spine2d) {
    /**
     * @class SpineEvent
     *
     * @description Dispatched by ISpine2d objects
     */
    var SpineEvent = (function (_super) {
        __extends(SpineEvent, _super);
        /**
         * Creates a new SpineEvent objects
         *
         * @param type The name of the event
         * @param time Current time of the animation
         */
        function SpineEvent(type, spine, time) {
            if (time === void 0) { time = 0; }
            _super.call(this, type);
            this._spine = spine;
            this._time = time;
        }
        Object.defineProperty(SpineEvent.prototype, "spine", {
            /**
             * Object that dispatched the event
             */
            get: function () {
                return this._spine;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(SpineEvent.prototype, "time", {
            /**
             * Current time of the animation
             */
            get: function () {
                return this._time;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatched each time the animation completes
         */
        SpineEvent.ON_COMPLETE = "SpinEvent_ON_COMPLETE";
        /**
         * Dispatched when the data has finished loading
         */
        SpineEvent.ON_LOADED = "SpinEvent_ON_LOADED";
        /**
         * Dispatched every time data is updated and redrawn
         */
        SpineEvent.ON_UPDATE = "SpinEvent_ON_UPDATE";
        /**
         * Dispatched every time the animation is repeated
         *
         * @static
         * @type {string}
         */
        SpineEvent.ON_REPEAT = "SpinEvent_ON_REPEAT";
        return SpineEvent;
    })(borgevent.Event);
    spine2d.SpineEvent = SpineEvent;
})(spine2d || (spine2d = {}));
/**
 * testy tesy
 */ 
var spine2d;
(function (spine2d) {
    /**
     * @class Spine2dBitmapRenderer
     *
     * @description Basic Spine renderer that uses bitmaps to draw each part of the skeleton. Bitmaps are recreated and added as a child every update.
     */
    var Spine2dBitmapRenderer = (function (_super) {
        __extends(Spine2dBitmapRenderer, _super);
        /**
         * Creates a new Spine2dBitmapRenderer object
         */
        function Spine2dBitmapRenderer() {
            _super.call(this);
        }
        /**
         * Creates a new bitmap for a skeleton's attachment
         *
         * @param name The name of the attachment
         * @param attachment The Spine attachment
         */
        Spine2dBitmapRenderer.prototype.createBitmap = function (name, attachment) {
            var descriptor = attachment.rendererObject;
            if (!Spine2dBitmapRenderer._cacheImage) {
                Spine2dBitmapRenderer._cacheImage = [];
                Spine2dBitmapRenderer._cacheName = [];
                Spine2dBitmapRenderer._cacheNumber = 0;
            }
            var img = attachment.rendererObject.page.img;
            var asset;
            for (var i = 0; i < Spine2dBitmapRenderer._cacheImage.length; i++) {
                if (Spine2dBitmapRenderer._cacheImage[i] == img) {
                    asset = new assets.Asset(Spine2dBitmapRenderer._cacheName[i], "", img);
                    break;
                }
            }
            if (!asset) {
                asset = new assets.Asset(img.src, img.src, img);
                Spine2dBitmapRenderer._cacheNumber++;
                Spine2dBitmapRenderer._cacheName.push(img.src);
                Spine2dBitmapRenderer._cacheImage.push(img);
            }
            var frame = new assets.Frame(asset, descriptor.x, descriptor.y, descriptor.rotate ? descriptor.height : descriptor.width, descriptor.rotate ? descriptor.width : descriptor.height);
            var sprite = new rendering.Bitmap(frame);
            sprite.scaleX = attachment.width / descriptor.originalWidth * attachment.scaleX;
            sprite.scaleY = attachment.height / descriptor.originalHeight * attachment.scaleY;
            sprite.x = (0.5 * descriptor.originalWidth - descriptor.offsetX) / descriptor.width;
            sprite.y = 1.0 - ((0.5 * descriptor.originalHeight - descriptor.offsetY) / descriptor.height);
            sprite.x *= sprite.width * sprite.scaleX * -1;
            sprite.y *= sprite.height * sprite.scaleY * -1;
            sprite.alpha = attachment.a;
            return sprite;
        };
        /**
         * @inheritdoc
         *
         * @param skeleton inheritdoc
         * @param scale inheritdoc
         */
        Spine2dBitmapRenderer.prototype.draw = function (skeleton, scale) {
            while (this.children.length > 0) {
                this.removeChild(this.children[0]);
            }
            if (!skeleton)
                return;
            var drawOrder = skeleton.drawOrder;
            var vertices;
            for (var i = 0, n = drawOrder.length; i < n; i++) {
                var slot = drawOrder[i];
                var attachment = slot.attachment;
                var bone = slot.bone;
                if (!(attachment instanceof spine.RegionAttachment))
                    continue;
                var container = new rendering.DisplayObjectContainer();
                var actor = this.createBitmap(slot.data.attachmentName, attachment);
                var drawPositionX = bone.worldX + attachment.x * bone.m00 + attachment.y * bone.m01;
                var drawPositionY = bone.worldY + attachment.x * bone.m10 + attachment.y * bone.m11;
                var rotation = -(bone.worldRotation + attachment.rotation) * Spine2dBitmapRenderer.PI_BY_180;
                container.x = drawPositionX / scale;
                container.y = drawPositionY / scale;
                container.scaleX = bone.worldScaleX;
                container.scaleY = bone.worldScaleY;
                container.rotation = -(bone.worldRotation + attachment.rotation);
                container.alpha = slot.a;
                container.addChild(actor);
                this.addChild(container);
            }
        };
        Spine2dBitmapRenderer.PI_BY_180 = Math.PI / 180;
        return Spine2dBitmapRenderer;
    })(rendering.DisplayObjectContainer);
    spine2d.Spine2dBitmapRenderer = Spine2dBitmapRenderer;
})(spine2d || (spine2d = {}));
var states;
(function (states) {
    /**
     * States contain data relating to itself as well as the next state and sub game. This data is read by the IGameStateModel to transition between states.
     *
     * @export
     * @class GameState
     * @implements {IGameState}
     */
    var GameState = (function () {
        /**
         * Creates an instance of GameState.
         *
         * @param {string} stateName
         * @param {string} nextState
         * @param {string} nextSubGame
         */
        function GameState(stateName, nextState, nextSubGame) {
            this.stateName = stateName;
            this._defaultNextSubGame = nextSubGame;
            this._defaultNextState = nextState;
        }
        /**
         * @inheritdoc
         */
        GameState.prototype.getNextState = function () {
            this.nextState = this._defaultNextState;
            this.nextSubGame = this._defaultNextSubGame;
        };
        /**
         * @inheritdoc
         */
        GameState.prototype.reset = function () {
            this.nextState = "";
            this.nextSubGame = "";
        };
        return GameState;
    })();
    states.GameState = GameState;
})(states || (states = {}));
var states;
(function (states) {
    /**
     * Event dispatched by IGameStateModel's when transitioning between states
     *
     * @export
     * @class GameStateEvent
     * @extends {borgevent.Event}
     */
    var GameStateEvent = (function (_super) {
        __extends(GameStateEvent, _super);
        /**
         * Creates an instance of GameStateEvent.
         *
         * @param {string} type (description)
         * @param {string} stateName (description)
         * @param {string} subGameName (description)
         */
        function GameStateEvent(type, stateName, subGameName) {
            _super.call(this, type);
            this._stateName = stateName;
            this._subGameName = subGameName;
        }
        /**
         * Dispatched when entering a specific state/subgame, comprimises of "StateEvent_ENTER_STATE_"+state+"_"+subGame
         *
         * @static
         * @param {string} state (description)
         * @param {string} subGame (description)
         * @returns {string} (description)
         */
        GameStateEvent.EnterState = function (state, subGame) {
            return "StateEvent_ENTER_STATE_" + state + "_" + subGame;
        };
        /**
         * Dispatched when exiting a specific state/subgame, comprimises of "StateEvent_EXIT_STATE_"+state+"_"+subGame
         *
         * @static
         * @param {string} state (description)
         * @param {string} subGame (description)
         * @returns {string} (description)
         */
        GameStateEvent.ExitState = function (state, subGame) {
            return "StateEvent_EXIT_STATE_" + state + "_" + subGame;
        };
        Object.defineProperty(GameStateEvent.prototype, "stateName", {
            /**
             * The state name
             *
             * @readonly
             * @type {string}
             */
            get: function () {
                return this._stateName;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GameStateEvent.prototype, "subGameName", {
            /**
             * The subgame name
             *
             * @readonly
             * @type {string}
             */
            get: function () {
                return this._subGameName;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Dispatched when entering a new state
         *
         * @static
         * @type {string}
         */
        GameStateEvent.ENTER_STATE = "StateEvent_ENTER_STATE";
        /**
         * Dsipatched when exiting the current state
         *
         * @static
         * @type {string}
         */
        GameStateEvent.EXIT_STATE = "StateEvent_EXIT_STATE";
        return GameStateEvent;
    })(borgevent.Event);
    states.GameStateEvent = GameStateEvent;
})(states || (states = {}));
var states;
(function (states) {
    /**
     * The model handles transitioning between states and dispatching related events.
     *
     * @export
     * @class GameStateModel
     * @implements {IGameStateModel}
     */
    var GameStateModel = (function () {
        /**
         * Creates an instance of GameStateModel.
         */
        function GameStateModel() {
            this._currentSubGame = "";
            this._currentState = null;
            this._states = [];
            this._subGames = [];
        }
        /**
         * @inheritdoc
         */
        GameStateModel.prototype.getCurrentState = function () {
            return this._currentState;
        };
        /**
         * @inheritdoc
         */
        GameStateModel.prototype.getSubGame = function () {
            return this._currentSubGame;
        };
        /**
         * @inheritdoc
         */
        GameStateModel.prototype.init = function (subGame, stateName) {
            console.log("init states");
            this._currentSubGame = subGame;
            this.changeStateByName(stateName);
            return this;
        };
        /**
         * @inheritdoc
         */
        GameStateModel.prototype.changeSubGame = function (subGame, state) {
            if (state === void 0) { state = ""; }
            TweenMax.delayedCall(1, this.doChangeSubGame, [subGame, state], this, true);
            return this;
        };
        /**
         * Delayed function to change sub game
         *
         * @protected
         * @param {string} subGame (description)
         * @param {string} state (description)
         */
        GameStateModel.prototype.doChangeSubGame = function (subGame, state) {
            if (this._currentSubGame != "" && this._currentState != null) {
                this.broadcastPrevious();
            }
            this._currentSubGame = subGame;
            if (state == "") {
                this._currentState = this._states[this.getSubGameIndex(this._currentSubGame)][0];
            }
            else {
                this._currentState = this.getStateByName(state);
            }
            this.broadcastCurrent();
        };
        /**
         * @inheritdoc
         */
        GameStateModel.prototype.changeStateByName = function (stateName) {
            TweenMax.delayedCall(1, this.doChangeStateByName, [stateName], this, true);
            return this;
        };
        /**
         * Delayed function to change state by name
         *
         * @param {string} stateName (description)
         */
        GameStateModel.prototype.doChangeStateByName = function (stateName) {
            var state = this.getStateByName(stateName);
            var index = this.getStateIndex(state);
            if (state != null && index != -1) {
                this.broadcastPrevious();
                this._currentState = state; //this._states[this.getSubGameIndex(this._currentSubGame)][index];
                this.broadcastCurrent();
            }
        };
        /**
         * @inheritdoc
         */
        GameStateModel.prototype.gotoNextState = function () {
            TweenMax.delayedCall(1, this.doGotoNextState, null, this, true);
            return this;
        };
        /**
         * Delayed function to go to the next state
         *
         * @protected
         * @returns {void} (description)
         */
        GameStateModel.prototype.doGotoNextState = function () {
            this._currentState.getNextState();
            var nextState = this._currentState.nextState;
            var nextSubGame = this._currentState.nextSubGame;
            if (nextState == "" || nextState == this._currentState.stateName) {
                return;
            }
            this.broadcastPrevious();
            if (nextSubGame != "" && nextSubGame != this._currentSubGame) {
                this._currentSubGame = nextSubGame;
            }
            this._currentState.reset();
            this._currentState = this.getStateByName(nextState);
            this.broadcastCurrent();
        };
        /**
         * @inheritdoc
         */
        GameStateModel.prototype.addState = function (subGame, state) {
            if (this._subGames.indexOf(subGame) == -1) {
                this._subGames.push(subGame);
                this._states.push([]);
            }
            var index = this._subGames.indexOf(subGame);
            this._states[index].push(state);
            return this;
        };
        /**
         * Finds a state instance based on it's name
         *
         * @protected
         * @param {string} stateName (description)
         * @returns {IGameState} (description)
         */
        GameStateModel.prototype.getStateByName = function (stateName) {
            var list = this._states[this.getSubGameIndex(this._currentSubGame)];
            for (var i = 0; i < list.length; i++) {
                if (list[i].stateName == stateName) {
                    return list[i];
                }
            }
            return null;
        };
        /**
         * Gets the index of the state in the _states array
         *
         * @protected
         * @param {IGameState} state (description)
         * @returns {number} (description)
         */
        GameStateModel.prototype.getStateIndex = function (state) {
            var list = this._states[this.getSubGameIndex(this._currentSubGame)];
            for (var i = 0; i < list.length; i++) {
                if (list[i] == state) {
                    return i;
                }
            }
            return -1;
        };
        /**
         * Gets the index of the subgame in the _subGames array
         *
         * @protected
         * @param {string} subGameName (description)
         * @returns {number} (description)
         */
        GameStateModel.prototype.getSubGameIndex = function (subGameName) {
            for (var i = 0; i < this._subGames.length; i++) {
                if (this._subGames[i] == subGameName) {
                    return i;
                }
            }
            return -1;
        };
        /**
         * Dispatches the GameStateEvent.EXIT_STATE and GameStateEvent.ExitState() events
         *
         * @protected
         */
        GameStateModel.prototype.broadcastPrevious = function () {
            if (this._currentState) {
                var event = new states.GameStateEvent(states.GameStateEvent.EXIT_STATE, this._currentState.stateName, this._currentSubGame);
                this.eventDispatcher.dispatchEvent(event);
                var event = new states.GameStateEvent(states.GameStateEvent.ExitState(this._currentState.stateName, this._currentSubGame), this._currentState.stateName, this._currentSubGame);
                this.eventDispatcher.dispatchEvent(event);
            }
        };
        /**
         * Dispatches the GameStateEvent.ENTER_STATE and GameStateEvent.EnterState() events
         *
         * @protected
         */
        GameStateModel.prototype.broadcastCurrent = function () {
            if (this._currentState) {
                console.log("Enter State: " + this._currentState.stateName + " SubGame: " + this._currentSubGame);
                var event = new states.GameStateEvent(states.GameStateEvent.ENTER_STATE, this._currentState.stateName, this._currentSubGame);
                this.eventDispatcher.dispatchEvent(event);
                event = new states.GameStateEvent(states.GameStateEvent.EnterState(this._currentState.stateName, this._currentSubGame), this._currentState.stateName, this._currentSubGame);
                this.eventDispatcher.dispatchEvent(event);
            }
        };
        return GameStateModel;
    })();
    states.GameStateModel = GameStateModel;
})(states || (states = {}));
var util;
(function (util) {
    /**
     * @class AssetBundle
     *
     * @description AssetBundle objects provide an easy way to create AssetRef's and add them to an AssetLoader
     *
     * This makes grouping and adding "bundles" of assets easier and less bloated
     */
    var AssetBundle = (function () {
        /**
         * Creates a new AssetBundle object
         */
        function AssetBundle() {
            this._assetList = [];
        }
        /**
         * Create a new AssetRef
         * @param path Path of the asset to loader
         * @param name Alias that can be used to reference the asset from the asset cache
         */
        AssetBundle.prototype.create = function (path, name) {
            var ref = new util.AssetRef(path, name);
            this._assetList.push(ref);
            return ref;
        };
        /**
         * Add's all the bundles assets to a loader's queue
         * @param loader The loader to add the assets to
         */
        AssetBundle.prototype.addAssets = function (loader) {
            for (var i = 0; i < this._assetList.length; i++) {
                loader.addFile(this._assetList[i].path, this._assetList[i].name);
            }
        };
        return AssetBundle;
    })();
    util.AssetBundle = AssetBundle;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class AssetRef
     *
     * @description Class for storing the path and name/alias of an asset
     */
    var AssetRef = (function () {
        /**
         * Create a new AssetRef object
         * @param path Path of the asset
         * @param name Name/alias of the asset that can be used with the asset cache
         */
        function AssetRef(path, name) {
            this.path = path;
            this.name = name;
        }
        return AssetRef;
    })();
    util.AssetRef = AssetRef;
})(util || (util = {}));
var util;
(function (util) {
    var loading;
    (function (loading) {
        /**
         * Dispatched as each stage loads
         *
         * @export
         * @class StageLoadModelEvent
         * @extends {borgevent.Event}
         */
        var StageLoadModelEvent = (function (_super) {
            __extends(StageLoadModelEvent, _super);
            /**
             * Creates an instance of StageLoadModelEvent.
             *
             * @param {string} eventName (description)
             * @param {number} stage The stage currently loading
             * @param {assets.IAssetLoader} loader The loader that belongs to the current stage
             * @param {number} [progress=-1] The progress of the current stage
             */
            function StageLoadModelEvent(eventName, stage, loader, progress) {
                if (progress === void 0) { progress = -1; }
                _super.call(this, eventName);
                this.stage = stage;
                this.loader = loader;
                this.progress = progress;
            }
            /**
             * Creates a custom progress event for the specific stage comprimising of "StageLoadModelEvent_PROGRESS_"+stage
             *
             * @static
             * @param {number} stage (description)
             * @returns {string} (description)
             */
            StageLoadModelEvent.ProgressState = function (stage) {
                return "StageLoadModelEvent_PROGRESS_" + stage;
            };
            /**
             * Creates a custom complete event for the specific stage comprimising of "StageLoadModelEvent_COMPLETE_"+stage
             *
             * @static
             * @param {number} stage (description)
             * @returns {string} (description)
             */
            StageLoadModelEvent.CompleteState = function (stage) {
                return "StageLoadModelEvent_COMPLETE_" + stage;
            };
            /**
             * Dispatched preiodically as stages load
             *
             * @static
             * @type {string}
             */
            StageLoadModelEvent.PROGRESS = "StageLoadModelEvent_PROGRESS";
            /**
             * Dispatched every time a stage completes loading
             *
             * @static
             * @type {string}
             */
            StageLoadModelEvent.COMPLETE = "StageLoadModelEvent_COMPLETE";
            return StageLoadModelEvent;
        })(borgevent.Event);
        loading.StageLoadModelEvent = StageLoadModelEvent;
    })(loading = util.loading || (util.loading = {}));
})(util || (util = {}));
var util;
(function (util) {
    var loading;
    (function (loading) {
        /**
         * The stage load model handles loading multiple bundles/files in stages and informing other classes when they complete
         *
         * @export
         * @class StageLoadModel
         */
        var StageLoadModel = (function () {
            function StageLoadModel() {
            }
            /**
             * Add a list of bundles and individual assets to load for a stage
             *
             * @param {util.AssetBundle[]} bundles List of bundles for the stage
             * @param {string[]} filePaths List of files for the stage
             * @param {string[]} fileAliases List of aliases for the files
             */
            StageLoadModel.prototype.addStage = function (bundles, filePaths, fileAliases) {
                if (!this._loaders) {
                    this._loaders = [];
                }
                var loader = new assets.AssetLoader();
                for (var i = 0; i < bundles.length; i++) {
                    bundles[i].addAssets(loader);
                }
                for (var i = 0; i < filePaths.length; i++) {
                    loader.addFile(filePaths[i], fileAliases[i]);
                }
                this._loaders.push(loader);
            };
            /**
             * Begin loading all stages
             *
             * @returns {void} (description)
             */
            StageLoadModel.prototype.start = function () {
                if (this._started) {
                    return;
                }
                this._started = true;
                this._currentStage = 0;
                this._stageComplete = -1;
                this.loadNextBundle();
            };
            /**
             * Starts loading the next stage
             *
             * @protected
             */
            StageLoadModel.prototype.loadNextBundle = function () {
                var loader = this._loaders[this._currentStage];
                loader.addEventListener(assets.AssetLoaderEvent.PROGRESS, this.onCurrentProgress, this);
                loader.addEventListener(assets.AssetLoaderEvent.COMPLETE, this.onCurrentComplete, this);
                loader.load();
            };
            /**
             * Dispatches progress events periodically
             *
             * @protected
             * @param {assets.AssetLoaderEvent} e (description)
             */
            StageLoadModel.prototype.onCurrentProgress = function (e) {
                this.eventDispatcher.dispatchEvent(new loading.StageLoadModelEvent(loading.StageLoadModelEvent.PROGRESS, this._currentStage, this._loaders[this._currentStage], e.progress));
                this.eventDispatcher.dispatchEvent(new loading.StageLoadModelEvent(loading.StageLoadModelEvent.ProgressState(this._currentStage), this._currentStage, this._loaders[this._currentStage], e.progress));
            };
            /**
             * Dispatches completion events when loaders complete
             *
             * @protected
             * @param {assets.AssetLoaderEvent} e (description)
             */
            StageLoadModel.prototype.onCurrentComplete = function (e) {
                this._stageComplete++;
                this.eventDispatcher.dispatchEvent(new loading.StageLoadModelEvent(loading.StageLoadModelEvent.COMPLETE, this._currentStage, this._loaders[this._currentStage], e.progress));
                this.eventDispatcher.dispatchEvent(new loading.StageLoadModelEvent(loading.StageLoadModelEvent.CompleteState(this._currentStage), this._currentStage, this._loaders[this._currentStage], e.progress));
                this._currentStage++;
                if (this._currentStage < this._loaders.length) {
                    this.loadNextBundle();
                }
            };
            /**
             * Checks whether a specific stage has complete loading
             *
             * @param {number} stage (description)
             * @returns {boolean} (description)
             */
            StageLoadModel.prototype.getStageComplete = function (stage) {
                return this._stageComplete >= stage;
            };
            return StageLoadModel;
        })();
        loading.StageLoadModel = StageLoadModel;
    })(loading = util.loading || (util.loading = {}));
})(util || (util = {}));
var util;
(function (util) {
    var autoplay;
    (function (autoplay) {
        /**
         * Dispatched by the autoplay model when autoplay has been initialised, started, stopped or updated
         *
         * @export
         * @class AutoplayEvent
         * @extends {borgevent.Event}
         */
        var AutoplayEvent = (function (_super) {
            __extends(AutoplayEvent, _super);
            /**
             * Creates an instance of AutoplayEvent.
             *
             * @param {string} eventName (description)
             */
            function AutoplayEvent(eventName) {
                _super.call(this, eventName);
            }
            /**
             * Dispatched when the initialised callback has been received from the partner adapter
             *
             * @static
             * @type {string}
             */
            AutoplayEvent.INITIALISED = "AutoplayEvent_INITIALISED";
            /**
             * Dispatched when start() has been called on the model
             *
             * @static
             * @type {string}
             */
            AutoplayEvent.STARTED = "AutoplayEvent_STARTED";
            /**
             * Dispatched when stop() has been called on the model
             *
             * @static
             * @type {string}
             */
            AutoplayEvent.STOPPED = "AutoplayEvent_STOPPED";
            /**
             * Dispatched when doNextAutoplay() has been called on the model and there is spins remaining
             *
             * @static
             * @type {string}
             */
            AutoplayEvent.NEXT = "AutoplayEvent_NEXT";
            return AutoplayEvent;
        })(borgevent.Event);
        autoplay.AutoplayEvent = AutoplayEvent;
    })(autoplay = util.autoplay || (util.autoplay = {}));
})(util || (util = {}));
var util;
(function (util) {
    var autoplay;
    (function (autoplay) {
        /**
         * The autoplay model is a utility class for managing autoplay within the game client. It interacts with the partner adapter and dispatches events to inform other classes when it starts, stops and updates.
         *
         * @export
         * @class AutoplayModel
         */
        var AutoplayModel = (function () {
            /**
             * Creates an instance of AutoplayModel.
             */
            function AutoplayModel() {
                this._isEnabled = false;
                this._numSpins = 0;
                this._inProgress = false;
                this._autoplayManager = new util.AutoplayManager();
            }
            /**
             * Set the partner adapters autoplay manager
             *
             * @param {util.IAutoplayManager} manager The partner adapter autoplay manager
             */
            AutoplayModel.prototype.setManager = function (manager) {
                this._autoplayManager = manager;
            };
            /**
             * Whether autoplay has been enabled by the partner adapter
             *
             * @returns {boolean} (description)
             */
            AutoplayModel.prototype.isEnabled = function () {
                return this._isEnabled;
            };
            /**
             * Whether autoplay is currently playing or not
             *
             * @returns {boolean} (description)
             */
            AutoplayModel.prototype.isInProgress = function () {
                return this._inProgress; // = true;
            };
            /**
             * The amount of autoplay spins remaining
             *
             * @returns {number} (description)
             */
            AutoplayModel.prototype.getSpinsRemaining = function () {
                return this._numSpins;
            };
            /**
             * Initialises the autplay manager and callback. setManager() must be called first
             *
             * @param {number} totalStake Current total stake of the game
             * @param {number} balance Current player balance
             */
            AutoplayModel.prototype.init = function (totalStake, balance) {
                var _this = this;
                this._autoplayManager.initPartnerAutoplay(totalStake, balance, function (isEnabled) { _this.initCallback(isEnabled); });
            };
            /**
             * Launches the autoplay UI
             *
             * @param {number} totalStake Current total stake of the game
             * @param {number} balance Current player balance
             */
            AutoplayModel.prototype.launch = function (totalStake, balance) {
                var _this = this;
                this._autoplayManager.launchPartnerAutoplay(totalStake, balance, function (isEnabled) { _this.launchCallback(isEnabled); });
            };
            /**
             * Starts autoplay, doNextAutoplay() must also be called to start spins fully
             *
             * @param {number} numSpins Amount of spins to start
             */
            AutoplayModel.prototype.start = function (numSpins) {
                this._numSpins = numSpins;
                this._inProgress = true;
                this.eventDispatcher.dispatchEvent(new autoplay.AutoplayEvent(autoplay.AutoplayEvent.STARTED));
            };
            /**
             * Stops autoplay
             */
            AutoplayModel.prototype.stop = function () {
                this._numSpins = 0;
                this.eventDispatcher.dispatchEvent(new autoplay.AutoplayEvent(autoplay.AutoplayEvent.STOPPED));
            };
            /**
             * Continues autoplay, should be called after every spin/round has completed
             *
             * @returns {boolean} Returns true if there is still spins remaining
             */
            AutoplayModel.prototype.doNextAutoplay = function () {
                var done = false;
                if (this._numSpins > 0) {
                    this._numSpins--;
                    done = true;
                    this._autoplayManager.updateAutoPlayStatus(util.AutoplayStatus.IN_PROGRESS, this._numSpins);
                    this.eventDispatcher.dispatchEvent(new autoplay.AutoplayEvent(autoplay.AutoplayEvent.NEXT));
                }
                else {
                    this.stop();
                    this._inProgress = false;
                    this._autoplayManager.updateAutoPlayStatus(util.AutoplayStatus.FINISHED, this._numSpins);
                }
                return done;
            };
            /**
             * Updates the win and stake on the partner adapter, should be called after every spin/round has completed
             *
             * @param {number} win Total amount won this spin/round
             * @param {number} stake Total stake for this spin/round
             */
            AutoplayModel.prototype.updateWinAndStake = function (win, stake) {
                this._autoplayManager.updateWinAndStake(win, stake);
            };
            /**
             * Called when the partner adapter has initialised the manager
             *
             * @protected
             * @param {boolean} isEnabled (description)
             */
            AutoplayModel.prototype.initCallback = function (isEnabled) {
                console.log("initCallback:", isEnabled);
                this._isEnabled = isEnabled;
                this.eventDispatcher.dispatchEvent(new autoplay.AutoplayEvent(autoplay.AutoplayEvent.INITIALISED));
            };
            /**
             * Called when the partner adapter UI has launched
             *
             * @protected
             * @param {boolean} isEnabled (description)
             */
            AutoplayModel.prototype.launchCallback = function (isEnabled) {
                console.log("launchCallback:", isEnabled);
            };
            return AutoplayModel;
        })();
        autoplay.AutoplayModel = AutoplayModel;
    })(autoplay = util.autoplay || (util.autoplay = {}));
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class ColorUtil
     *
     * @description Static utility class that provides methods for performing colour operations
     */
    var ColorUtil = (function () {
        function ColorUtil() {
        }
        /**
         * Lightens/Darkens a colour by a specific amount
         * @param color Colour value to shade in 0x000000 format
         * @param percent Amount to shade the colour by from -100 to 100
         */
        ColorUtil.shadeColor1 = function (color, percent) {
            var num = color, amt = Math.round(2.55 * percent), R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
            return (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255));
        };
        /**
         * Lightens/Darkens a colour by a specific amount
         * @param color Colour value to shade in 0x000000 format
         * @param percent Amount to shade the colour by from -100 to 100
         */
        ColorUtil.shadeColor2 = function (color, percent) {
            var f = color, t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
            return 0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B);
        };
        return ColorUtil;
    })();
    util.ColorUtil = ColorUtil;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class CurrencyData
     *
     * @description Data relating to currency for use primarily with the CurrencyFormatter class
     */
    var CurrencyData = (function () {
        function CurrencyData() {
        }
        return CurrencyData;
    })();
    util.CurrencyData = CurrencyData;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class CurrencyFormatter
     *
     * @description Class that formats currencies
     */
    var CurrencyFormatter = (function () {
        /**
         * @constructor
         */
        function CurrencyFormatter() {
        }
        /**
         * Sets the JSON data
         * @method locale.CurrencyFormatter#setData
         * @public
         * @param {any} data The data from the server
         */
        CurrencyFormatter.prototype.setData = function (data) {
            this.data = data;
        };
        /**
         * Formats a value in the locales currency
         * @method locale.CurrencyFormatter#formatValue
         * @public
         * @param {any} value The value to format in either string or number format
         * @returns {string} The formatted value
         */
        CurrencyFormatter.prototype.format = function (value) {
            if (typeof value != "string" && typeof value != "number") {
                return null;
            }
            if (value == "") {
                return "";
            }
            value = this.clean(value);
            value = this.attachDecimal(value);
            value = this.attachThousands(value);
            value = this.attachSymbol(value);
            return value;
        };
        /**
         * Cleans the passed in value of all decimals, symbols, and Separators
         * @method locale.CurrencyFormatter#clean
         * @param {any} value The value to clean
         * @protected
         */
        CurrencyFormatter.prototype.clean = function (value) {
            if (typeof value == "string") {
                var decimalRegEx = null;
                if (this.data.fractionalSeparator == ".") {
                    decimalRegEx = new RegExp("\\" + this.data.fractionalSeparator, "g");
                }
                else {
                    decimalRegEx = new RegExp(this.data.fractionalSeparator, "g");
                }
                var thousandRegEx = null;
                if (this.data.groupingSeparator == ".") {
                    thousandRegEx = new RegExp("\\" + this.data.groupingSeparator, "g");
                }
                else {
                    thousandRegEx = new RegExp(this.data.groupingSeparator, "g");
                }
                value = value.replace(this.data.symbol, "");
                value = value.replace(decimalRegEx, "");
                value = value.replace(thousandRegEx, "");
                if (this.data.fractionalDigits == 0) {
                    value += "00";
                }
            }
            else {
                value = value.toString();
            }
            value = (value.length < 3) ? (Number(value) / 100).toFixed(2) : value;
            return value;
        };
        /**
         * Attaches the currency symbol to the value
         * @method locale.CurrencyFormatter#attachSymbol
         * @protected
         */
        CurrencyFormatter.prototype.attachSymbol = function (value) {
            if (this.data.symbol != undefined && this.data.symbol != null && this.data.symbol.length > 0) {
                if (this.data.currencySymbolBeforeAmount) {
                    value = this.data.symbol + this.attachSpacing(this.data.currencySymbolSpacing) + value;
                }
                else {
                    value += this.attachSpacing(this.data.currencySymbolSpacing) + this.data.symbol;
                }
            }
            else {
                if (this.data.currencyCodeBeforeAmount) {
                    value = this.data.name + this.attachSpacing(this.data.currencySymbolSpacing) + value;
                }
                else {
                    value += this.attachSpacing(this.data.currencySymbolSpacing) + this.data.name;
                }
            }
            return value;
        };
        CurrencyFormatter.prototype.attachSpacing = function (amount) {
            var spacing = "";
            for (var i = 0; i < amount; i++) {
                spacing += " "; // this is a non-breaking space (&nbsp; or &#160;. In Unicode, it is encoded as U+00A0) NOT a normal space
            }
            return spacing;
        };
        /**
         * Attaches a decimal
         * @method locale.CurrencyFormatter#attachDecimal
         * @protected
         */
        CurrencyFormatter.prototype.attachDecimal = function (value) {
            var newValue;
            if (value.indexOf(".") >= 0) {
                newValue = value.replace(".", this.data.fractionalSeparator);
            }
            else {
                var index = value.length - 2;
                newValue = value.slice(0, index);
                if (this.data.fractionalDigits > 0) {
                    newValue = newValue + this.data.fractionalSeparator + value.slice(index, value.length);
                }
            }
            return newValue;
        };
        /**
         * Attach thousands Separator
         * @method locale.CurrencyFormatter#attachThousands
         * @protected
         */
        CurrencyFormatter.prototype.attachThousands = function (value) {
            var values = value.split(this.data.fractionalSeparator);
            var dollars = "";
            if (values[0].length > 0) {
                dollars = values[0].split("").reverse().join("").match(/.{1,3}/g).join(this.data.groupingSeparator);
            }
            value = dollars.split("").reverse().join("");
            if (this.data.fractionalDigits > 0) {
                value = value + this.data.fractionalSeparator + values[1];
            }
            return value;
        };
        return CurrencyFormatter;
    })();
    util.CurrencyFormatter = CurrencyFormatter;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class DeviceContext
     *
     * @description Holds information for a game to figure out scale and device type
     */
    var DeviceContext = (function () {
        /**
         * @constructor
         */
        function DeviceContext(dimensions, baselineWidth, baselineHeight) {
            this.dimensions = dimensions;
            if (baselineHeight == null) {
                baselineHeight = 1080;
            }
            if (baselineWidth == null) {
                baselineWidth = 1920;
            }
            this.baselineHeight = baselineHeight;
            this.baselineWidth = baselineWidth;
        }
        /**
         * Getst the baseline width
         * @method Game.DeviceContext#getBaselineWidth
         * @public
         * @returns {number} The baseline width
         */
        DeviceContext.prototype.getBaselineWidth = function () {
            return this.baselineWidth;
        };
        /**
         * Gets the baseline height
         * @method Game.DeviceContext#getBaselineHeight
         * @public
         * @returns {number} The baseline height
         */
        DeviceContext.prototype.getBaselineHeight = function () {
            return this.baselineHeight;
        };
        /**
         * Gets the scaled user screen width
         * @method Game.DeviceContext#getScaledScreenWidth
         * @public
         * @returns {number} The scaled screen width
         */
        DeviceContext.prototype.getScaledScreenWidth = function () {
            return this.baselineWidth * this.getScalar();
        };
        /**
         * Gets the scaled user screen height
         * @method Game.DeviceContext#getScaledScreenHeight
         * @public
         * @returns {number} The scaled screen height
         */
        DeviceContext.prototype.getScaledScreenHeight = function () {
            return this.baselineHeight * this.getScalar();
        };
        /**
          * Computes and returns the scale factor
          * @method Game.DeviceContext#getScalar
          * @public
          * @returns {number} The scale factor to be us`ed by the game
          */
        DeviceContext.prototype.getScalar = function () {
            var ratioX = this.dimensions.getWidth() / this.baselineWidth;
            var ratioY = this.dimensions.getHeight() / this.baselineHeight;
            return Math.min(1.0, Math.min(ratioX, ratioY));
            if (DeviceContext.isMobile()) {
                var ratioX = this.dimensions.getWidth() / this.baselineWidth;
                var ratioY = this.dimensions.getHeight() / this.baselineHeight;
                return Math.min(1.0, Math.min(ratioX, ratioY));
            }
            else {
                return 1.0;
            }
        };
        /**
         * Determines if the device is mobile or desktop
         * @method Game.DeviceContext#isMobile
         * @private
         * @returns {boolean} True if the device is a mobile device
         */
        DeviceContext.isMobile = function () {
            return (navigator.userAgent.match(/Android/i) != null ||
                navigator.userAgent.match(/iPhone|iPad|iPod/i) != null);
        };
        return DeviceContext;
    })();
    util.DeviceContext = DeviceContext;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class FixedDimensions
     *
     * @description Calculates the width and height a game should be displayed at
     *
     * User can specify a list of supported Resolutions for desktop and mobile
     *
     * This class then chooses the closest resolution based on the devices current resolution
     */
    var FixedDimensions = (function () {
        /**
         * Creates a new FixedDimensions object
         * @param supportedResolutions List of supported desktop resolutions
         * @param mobileResolutions List of supported mobile resolutions
         */
        function FixedDimensions(supportedResolutions, mobileResolutions) {
            this._resolutions = supportedResolutions;
            this._mobileResolutions = mobileResolutions;
        }
        /**
         * @inheritdoc
         */
        FixedDimensions.prototype.getWidth = function () {
            var w = screen.width * window.devicePixelRatio;
            var h = screen.height * window.devicePixelRatio;
            var width = w > h ? w : h;
            var resolutions = util.DeviceContext.isMobile() ? this._mobileResolutions : this._resolutions;
            var supportedWidths = [];
            for (var i = 0; i < resolutions.length; i++) {
                supportedWidths.push(resolutions[i].width);
            }
            return this.getClosest(width, supportedWidths);
        };
        /**
         * @inheritdoc
         */
        FixedDimensions.prototype.getHeight = function () {
            var w = screen.width * window.devicePixelRatio;
            var h = screen.height * window.devicePixelRatio;
            var height = w > h ? h : w;
            var resolutions = util.DeviceContext.isMobile() ? this._mobileResolutions : this._resolutions;
            var supportedHeights = [];
            for (var i = 0; i < resolutions.length; i++) {
                supportedHeights.push(resolutions[i].height);
            }
            return this.getClosest(height, supportedHeights);
        };
        /**
         * Get's the closest number from a list
         * @param value The number to find the closest value to
         * @param sizes List of numbers to compare
         */
        FixedDimensions.prototype.getClosest = function (value, sizes) {
            var lowestDiff = 999999999;
            var selectedIndex = 0;
            for (var i = 0; i < sizes.length; i++) {
                var diff = Math.abs(value - sizes[i]);
                if (diff < lowestDiff) {
                    lowestDiff = diff;
                    selectedIndex = i;
                }
            }
            return sizes[selectedIndex];
        };
        return FixedDimensions;
    })();
    util.FixedDimensions = FixedDimensions;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class Resolution
     *
     * @description Class for describing a fixed resolution
     */
    var Resolution = (function () {
        /**
         * Creates a new Resolution object
         * @param width Width in pixels
         * @param height Height in pixels
         */
        function Resolution(width, height) {
            this._width = width;
            this._height = height;
        }
        Object.defineProperty(Resolution.prototype, "width", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._width;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Resolution.prototype, "height", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._height;
            },
            enumerable: true,
            configurable: true
        });
        return Resolution;
    })();
    util.Resolution = Resolution;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * Utility class that can enable any event dispatcher to dispatch events context wide so all mediators/commands can receive them
     *
     * @export
     * @class DragonWingify
     */
    var DragonWingify = (function () {
        function DragonWingify() {
        }
        /**
         * Overrides the event dispatchers dispatchEvent to apply then call the contexts event dispatchers dispatchEvent function
         *
         * @param {borgevent.IEventDispatcher} dispatcher (description)
         */
        DragonWingify.prototype.makeEventsGlobal = function (dispatcher) {
            DragonWingify.makeEventsGlobal(dispatcher, this.eventDispatcher);
        };
        /**
         * Overrides the first event dispatchers dispatchEvent to apply then call the 2nd event dispatchers dispatchEvent function
         *
         * @static
         * @param {borgevent.IEventDispatcher} dispatcher First event dispatcher to override
         * @param {dragonwings.interfaces.IEventDispatcher} eventDispatcher Second event dispatcher
         */
        DragonWingify.makeEventsGlobal = function (dispatcher, eventDispatcher) {
            var oldFunction = dispatcher.dispatchEvent;
            dispatcher.dispatchEvent = function (e) {
                oldFunction.apply(dispatcher, [e]);
                eventDispatcher.dispatchEvent(e);
            };
        };
        return DragonWingify;
    })();
    util.DragonWingify = DragonWingify;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * List of devices used to group feature capabilities
     *
     * @export
     * @enum {number}
     */
    (function (DeviceClass) {
        /**
         * Low performance phone/tablet, typically relates to older devices with a resolution less than 1248x702 such as iPhone 4S, iPad Mini 1st gen
         */
        DeviceClass[DeviceClass["LOW_PERFORMANCE_PHONE"] = 0] = "LOW_PERFORMANCE_PHONE";
        /**
         * Medium performance phone/tablet, typically relates to devices with a resolution less than 1920x1080 such as iPhone 5
         */
        DeviceClass[DeviceClass["MEDIUM_PERFORMANCE_PHONE"] = 1] = "MEDIUM_PERFORMANCE_PHONE";
        /**
         * High performance phone/tablet, typically relates to newer devices with a full native 1920x1080 resolution such as iPhone 6S
         */
        DeviceClass[DeviceClass["HIGH_PERFORMANCE_PHONE"] = 2] = "HIGH_PERFORMANCE_PHONE";
        /**
         * Desktop computers, typically the highest performing device
         */
        DeviceClass[DeviceClass["DESKTOP"] = 3] = "DESKTOP";
    })(util.DeviceClass || (util.DeviceClass = {}));
    var DeviceClass = util.DeviceClass;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * List of game features that can be supported by different devices
     *
     * @export
     * @enum {number}
     */
    (function (Feature) {
        /**
         * High amount of particle effects
         */
        Feature[Feature["HIGH_PARTICLES"] = 0] = "HIGH_PARTICLES";
        /**
         * Medium amount of particle effects
         */
        Feature[Feature["MEDIUM_PARTICLES"] = 1] = "MEDIUM_PARTICLES";
        /**
         * Low amount of particle effects
         */
        Feature[Feature["LOW_PARTICLES"] = 2] = "LOW_PARTICLES";
        /**
         * 60 frames per second target
         */
        Feature[Feature["SIXTY_FPS"] = 3] = "SIXTY_FPS";
        /**
         * 30 frames per second target
         */
        Feature[Feature["THIRTY_FPS"] = 4] = "THIRTY_FPS";
        /**
         * Advanced bangup that refreshes text quickly
         */
        Feature[Feature["ADVANCED_BANG_UP"] = 5] = "ADVANCED_BANG_UP";
    })(util.Feature || (util.Feature = {}));
    var Feature = util.Feature;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * Classifies devices based on their resolution.
     * HIGH_PERFORMANCE_PHONE   = 1080p or higher
     * MEDIUM_PERFORMANCE_PHONE = above 540p
     * HIGH_PERFORMANCE_PHONE   = 540p and lower
     * DESKTOP                  = desktop computers only
     *
     * @export
     * @class ResolutionDeviceClassDetector
     * @implements {IDeviceClassDetector}
     */
    var ResolutionDeviceClassDetector = (function () {
        function ResolutionDeviceClassDetector() {
        }
        /**
         * @inheritdoc
         */
        ResolutionDeviceClassDetector.prototype.getDeviceClass = function () {
            if (util.DeviceContext.isMobile()) {
                if (this.getHeight() >= 1080) {
                    return util.DeviceClass.HIGH_PERFORMANCE_PHONE;
                }
                else if (this.getHeight() > 540) {
                    return util.DeviceClass.MEDIUM_PERFORMANCE_PHONE;
                }
                else {
                    return util.DeviceClass.LOW_PERFORMANCE_PHONE;
                }
            }
            else {
                return util.DeviceClass.DESKTOP;
            }
        };
        /**
         * Gets the width of the current device
         *
         * @returns {number}
         */
        ResolutionDeviceClassDetector.prototype.getWidth = function () {
            var w = screen.width * window.devicePixelRatio;
            var h = screen.height * window.devicePixelRatio;
            var width = w > h ? w : h;
            return width;
        };
        /**
         * Gets the height of the current device
         *
         * @returns {number}
         */
        ResolutionDeviceClassDetector.prototype.getHeight = function () {
            var w = screen.width * window.devicePixelRatio;
            var h = screen.height * window.devicePixelRatio;
            var height = w > h ? h : w;
            return height;
        };
        return ResolutionDeviceClassDetector;
    })();
    util.ResolutionDeviceClassDetector = ResolutionDeviceClassDetector;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * Standard feature capabilities implementation. Individual games can implement the IFeatureCapabilities interface if they have different requirements.
     *
     * @export
     * @class StandardFeatureCapabilities
     * @implements {IFeatureCapabilities}
     */
    var StandardFeatureCapabilities = (function () {
        function StandardFeatureCapabilities() {
        }
        /**
         * @inheritdoc
         */
        StandardFeatureCapabilities.prototype.setDetector = function (detector) {
            this._detector = detector;
        };
        /**
         * @inheritdoc
         */
        StandardFeatureCapabilities.prototype.isSupported = function (feature) {
            if (feature == util.Feature.HIGH_PARTICLES) {
                return this._detector.getDeviceClass() >= util.DeviceClass.DESKTOP;
            }
            if (feature == util.Feature.MEDIUM_PARTICLES) {
                return this._detector.getDeviceClass() >= util.DeviceClass.MEDIUM_PERFORMANCE_PHONE;
            }
            if (feature == util.Feature.LOW_PARTICLES) {
                return this._detector.getDeviceClass() >= util.DeviceClass.LOW_PERFORMANCE_PHONE;
            }
            if (feature == util.Feature.SIXTY_FPS) {
                return this._detector.getDeviceClass() >= util.DeviceClass.HIGH_PERFORMANCE_PHONE;
            }
            if (feature == util.Feature.THIRTY_FPS) {
                return this._detector.getDeviceClass() >= util.DeviceClass.LOW_PERFORMANCE_PHONE;
            }
            if (feature == util.Feature.ADVANCED_BANG_UP) {
                return this._detector.getDeviceClass() >= util.DeviceClass.DESKTOP;
            }
            return false;
        };
        /**
         * @inheritdoc
         */
        StandardFeatureCapabilities.prototype.listFeatures = function () {
            var output = "";
            var dClass = this._detector.getDeviceClass();
            output += "Device Class: ";
            output += dClass == util.DeviceClass.DESKTOP ? "Desktop\n" : "";
            output += dClass == util.DeviceClass.HIGH_PERFORMANCE_PHONE ? "High Performance Phone\n" : "";
            output += dClass == util.DeviceClass.MEDIUM_PERFORMANCE_PHONE ? "Medium Performance Phone\n" : "";
            output += dClass == util.DeviceClass.LOW_PERFORMANCE_PHONE ? "Low Performance Phone\n" : "";
            output += "Particle Support: ";
            output += this.isSupported(util.Feature.HIGH_PARTICLES) ? "High\n"
                : this.isSupported(util.Feature.MEDIUM_PARTICLES) ? "Medium\n"
                    : this.isSupported(util.Feature.LOW_PARTICLES) ? "Low\n"
                        : "None";
            output += "Target FPS: ";
            output += this.isSupported(util.Feature.SIXTY_FPS) ? "60\n"
                : this.isSupported(util.Feature.THIRTY_FPS) ? "30\n"
                    : "0";
            output += "Advanced bang up support: ";
            output += this.isSupported(util.Feature.ADVANCED_BANG_UP) ? "true"
                : "false";
            return output;
        };
        return StandardFeatureCapabilities;
    })();
    util.StandardFeatureCapabilities = StandardFeatureCapabilities;
})(util || (util = {}));
var util;
(function (util) {
    var history;
    (function (history) {
        /**
         * The history model loads the history data specified by the client url. It also provides functions to manage and retrieve the current history state.
         *
         * @export
         * @class HistoryModel
         * @implements {IHistoryModel}
         */
        var HistoryModel = (function () {
            /**
             * Creates an instance of HistoryModel.
             */
            function HistoryModel() {
                this._url = new util.URL(window.location.href);
                this._historyUrl = this._url.queryData('HistoryServerURL');
                this._betUrl = this._url.queryData('betID');
                this._removed = [];
            }
            /**
             * @inheritdoc
             */
            HistoryModel.prototype.getIsHistoryReplay = function () {
                return this._url.queryData('HistoryServerURL') != null;
            };
            /**
             * @inheritdoc
             */
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
            /**
             * @inheritdoc
             */
            HistoryModel.prototype.isLoaded = function () {
                return this._loaded;
            };
            /**
             * @inheritdoc
             */
            HistoryModel.prototype.onHistoryConnectionProgress = function (e) {
                this.eventDispatcher.dispatchEvent(new history.HistoryModelEvent(history.HistoryModelEvent.PROGRESS));
            };
            /**
             * @inheritdoc
             */
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
                this.eventDispatcher.dispatchEvent(new history.HistoryModelEvent(history.HistoryModelEvent.COMPLETE));
            };
            /**
             * @inheritdoc
             */
            HistoryModel.prototype.onHistoryConnectionFail = function (e) {
                util.ErrorReporter.showError('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_BODY', 'Error retrieving history data from service.');
                this.eventDispatcher.dispatchEvent(new history.HistoryModelEvent(history.HistoryModelEvent.FAILED));
            };
            /**
             * @inheritdoc
             */
            HistoryModel.prototype.restart = function () {
                this._historyStatesStack = this._historyStates.concat();
            };
            /**
             * @inheritdoc
             */
            HistoryModel.prototype.getPreviousState = function () {
                return this._removed[this._removed.length - 1];
            };
            /**
             * @inheritdoc
             */
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
            return HistoryModel;
        })();
        history.HistoryModel = HistoryModel;
    })(history = util.history || (util.history = {}));
})(util || (util = {}));
var util;
(function (util) {
    var history;
    (function (history) {
        /**
         * Dispatched by the history model when the model loads
         *
         * @export
         * @class HistoryModelEvent
         * @extends {dragonwings.Event}
         */
        var HistoryModelEvent = (function (_super) {
            __extends(HistoryModelEvent, _super);
            /**
             * Creates an instance of HistoryModelEvent.
             *
             * @param {string} type (description)
             */
            function HistoryModelEvent(type) {
                _super.call(this, type);
            }
            /**
             * Dispatched when loading has sucessfully completed
             *
             * @static
             * @type {string}
             */
            HistoryModelEvent.COMPLETE = "HistoryModelEvent_COMPLETE";
            /**
             * Dispatched when loading fails
             *
             * @static
             * @type {string}
             */
            HistoryModelEvent.FAILED = "HistoryModelEvent_FAILED";
            /**
             * Dispatched periodically when loading
             *
             * @static
             * @type {string}
             */
            HistoryModelEvent.PROGRESS = "HistoryModelEvent_PROGRESS";
            return HistoryModelEvent;
        })(dragonwings.Event);
        history.HistoryModelEvent = HistoryModelEvent;
    })(history = util.history || (util.history = {}));
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class Line
     *
     * @description Represent's a line between two fixed points and performs related calculations
     */
    var Line = (function () {
        /**
         * Creates a new Line object
         * @param start Start point of the line
         * @param end End point of the line
         */
        function Line(start, end) {
            this.start = start;
            this.end = end;
        }
        /**
         * Compares a line to see if it has the same start/end points
         * @param line Line to compare against
         */
        Line.prototype.equals = function (l) {
            return this.start == l.start && this.end == l.end;
        };
        Object.defineProperty(Line.prototype, "length", {
            /**
             * Total distance from the start point to the end point
             */
            get: function () {
                return this.start.distance(this.end);
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Checks if a line intersects with this one
         * @param line Line to check against
         * @param p Point will be set to the intersecting point
         */
        Line.prototype.intersection = function (l, p) {
            var x1 = this.start.x;
            var y1 = this.start.y;
            var x2 = this.end.x;
            var y2 = this.end.y;
            var x3 = l.start.x;
            var y3 = l.start.y;
            var x4 = l.end.x;
            var y4 = l.end.y;
            var a1 = y2 - y1;
            var b1 = x1 - x2;
            var c1 = x2 * y1 - x1 * y2;
            var r3 = a1 * x3 + b1 * y3 + c1;
            var r4 = a1 * x4 + b1 * y4 + c1;
            if (r3 != 0 && r4 != 0 && this.sameSigns(r3, r4)) {
                //console.error("Lines dont intersect");
                return false;
            }
            var a2 = y4 - y3;
            var b2 = x3 - x4;
            var c2 = x4 * y3 - x3 * y4;
            var r1 = a2 * x1 + b2 * y1 + c2;
            var r2 = a2 * x2 + b2 * y2 + c2;
            if (r1 != 0 && r2 != 0 && this.sameSigns(r1, r2)) {
                //console.error("Lines dont intersect");
                return false;
            }
            var denom = a1 * b2 - a2 * b1;
            if (denom == 0) {
                //console.error("Lines are colinear");
                return false;
            }
            var offset = Math.floor(Math.abs(denom) / 2); // dont know if i should be flooring here
            var num = b1 * c2 - b2 * c1;
            var x = (num < 0 ? num - offset : num + offset) / denom;
            num = a2 * c1 - a1 * c2;
            var y = (num < 0 ? num - offset : num + offset) / denom;
            p.set(x, y);
            return true;
        };
        /**
         * Checks if a rectangle intersects with this line
         * @param r Rectangle to check against
         * @param p Point will be set to the intersecting point
         */
        Line.prototype.intersectionRect = function (r, p) {
            var intersects = false;
            var topLeft = new util.Point(r.getLeft(), r.getTop());
            var topRight = new util.Point(r.getRight(), r.getTop());
            var bottomLeft = new util.Point(r.getLeft(), r.getBottom());
            var bottomRight = new util.Point(r.getRight(), r.getBottom());
            var line = new Line(topLeft, topRight);
            intersects = this.intersection(line, p);
            if (!intersects) {
                line = new Line(topLeft, bottomLeft);
                intersects = this.intersection(line, p);
            }
            if (!intersects) {
                line = new Line(topRight, bottomRight);
                intersects = this.intersection(line, p);
            }
            if (!intersects) {
                line = new Line(bottomLeft, bottomRight);
                intersects = this.intersection(line, p);
            }
            return intersects;
        };
        /**
         * Checks to see if two numbers are both positive or both negative
         * @param a First number
         * @param b Second number
         */
        Line.prototype.sameSigns = function (a, b) {
            return a * b >= 0;
        };
        return Line;
    })();
    util.Line = Line;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class MathUtil
     *
     * @description Utility class containing math functionality
     */
    var MathUtil = (function () {
        function MathUtil() {
        }
        /**
         * Calculate cubic root (using exponential and log identities).
         *
         * @param  val  value whose cubic root to calculate.
         */
        MathUtil.prototype.cbrt = function (val) {
            if (val > 0) {
                return Math.exp(Math.log(val) / 3.0);
            }
            else if (val < 0) {
                return -Math.exp(Math.log(-val) / 3.0);
            }
            return 0;
        };
        /**
         * Perform a floating point compare between 2 values. This will check
         * if 2 floating point numbers have opposite signs (one is +, other is -).
         * Zero is considered non-opposite in all cases.
         *
         * @param  a  left hand value
         * @param  b  right hand value
         */
        MathUtil.prototype.isOpposite = function (a, b) {
            return ((a < 0 && b > 0) || (a > 0 && b < 0));
        };
        /**
         * Compare two floating point numbers
         *
         * @param  a  left hand value
         * @param  b  right hand value
         */
        MathUtil.prototype.fltCmp = function (a, b) {
            return (Math.abs(a - b) <= MathUtil.EPSILON);
        };
        /**
         * Get rounded value, only works on positive values. This is the fast version that is
         * not implemented in the browser.
         *
         * @param  val  value to round
         */
        MathUtil.prototype.roundP = function (val) {
            return ((0.5 + val) | 0);
        };
        /**
         * Clamps a number between a given range.
         *
         * @param  u  the number to clamp
         * @param  min  low end range to clamp number to
         * @param  max  high end range to clamp number to
         */
        MathUtil.prototype.clamp = function (u, min, max) {
            return Math.max(min, Math.min(u, max));
        };
        /**
         * Generates a random number between 0 and RAND_MAX.
         */
        MathUtil.prototype.genRand = function () {
            return Math.floor((Math.random() * MathUtil.RAND_MAX) + 1);
        };
        /**
         * Generates a random floating point number between 0 and 1 (inclusive).
         */
        MathUtil.prototype.genRandNormalized = function () {
            return Math.random();
        };
        /**
         * Gets a random integer between min and max (inclusive)
         *
         * @param  mi  low end range to clamp number to
         * @param  ma  high end range to clamp number to
         */
        MathUtil.prototype.genRandRange = function (mi, ma) {
            return Math.round(mi + this.genRandNormalized() * (ma - mi));
        };
        /**
         * Checks a number and returns true if it is a power-of-two, false otherwise
         *
         * @param  num  number to check
         */
        MathUtil.prototype.isPowerOfTwo = function (num) {
            return (num && !(num & (num - 1)));
        };
        /**
         * Returns the next number that is a power of 2.
         *
         * @param  num  place to start pow2 search
         */
        MathUtil.prototype.nextPowerOfTwo = function (num) {
            num--;
            num |= num >> 1;
            num |= num >> 2;
            num |= num >> 4;
            num |= num >> 8;
            num |= num >> 16;
            num++;
            return num;
        };
        /**
         * Returns the next number that is divisible by a given power-of-two
         *
         * @param  num  number to check
         * @param  n  number that the return value must be divisible by
         *            (must be a power-of-two for the below algorithm to work).
         */
        MathUtil.prototype.nextDivisibleByAPowerOfTwo = function (num, n) {
            return (num + (n - 1)) & ~(n - 1);
        };
        /**
         * Checks whether a number is divisible by a given power-of-two
         *
         * @param  num  number to check
         * @param  n  number that the return value must be divisible by
         *            (must be a power-of-two for the below algorithm to work).
         */
        MathUtil.prototype.isDivisibleByAPowerOfTwo = function (num, n) {
            return (this.nextDivisibleByAPowerOfTwo(num, n) == num);
        };
        /**
         * Returns the next number that is divisible by 4.
         *
         * @param  num  place to start div4 search
         */
        MathUtil.prototype.nextDivisibleByFour = function (num) {
            var temp = num;
            var mask = -4;
            while ((temp | mask) & ~mask)
                temp++;
            return temp;
        };
        /**
         * Converts radians to degrees
         *
         * @param  radians  amount in radians
         */
        MathUtil.prototype.toDegrees = function (radians) {
            return radians * 180.0 / MathUtil.PI;
        };
        /**
         * Converts degrees to radians
         *
         * @param  degrees  amount in degrees
         */
        MathUtil.prototype.toRadians = function (degrees) {
            return degrees * MathUtil.PI / 180.0;
        };
        /**
         * Clamp an angle in degrees between 0 and 360
         *
         * @param  degrees  angle in degrees
         */
        MathUtil.prototype.clampAngle = function (degrees) {
            var ret = degrees;
            if (ret > 360) {
                var t = Math.floor(ret / 360);
                ret -= 360 * t;
            }
            else if (ret < -360) {
                var t = Math.floor(Math.abs(ret) / 360);
                ret += 360 * t;
            }
            return ret;
        };
        /**
         * Linearly interpolate between two values.
         *
         * @param  u  The normalized weight value
         * @param  a  Starting value
         * @param  b  End value
         */
        MathUtil.prototype.lerp = function (u, a, b) {
            u = this.clamp(u, 0, 1);
            return a * (1 - u) + b * u;
        };
        /**
         * Calculate the time it will take to interpolate given 2 values
         *
         * @param  x1  first point on the x
         * @param  x2  second point on the x
         * @param  speed  interpolation rate
         */
        MathUtil.prototype.speedToDurationFromValues1D = function (x1, x2, speed) {
            return this.speedToDuration1D(Math.abs(x1 - x2), speed);
        };
        /**
         * Calculate the time it will take to interpolate given a speed and distance
         *
         * @param  delta  distance to interpolate
         * @param  speed  interpolation rate
         */
        MathUtil.prototype.speedToDuration1D = function (delta, speed) {
            return Math.abs((speed == 0) ? 0 : delta / speed);
        };
        /**
         * Calculate the time it will take to interpolate given 2 points
         *
         * @param  x1  first point on the x
         * @param  y1  first point on the y
         * @param  x2  second point on the x
         * @param  y2  second point on the y
         * @param  speed  interpolation rate
         */
        MathUtil.prototype.speedToDurationFromPoints2D = function (x1, y1, x2, y2, speed) {
            return this.speedToDuration2D(Math.abs(x1 - x2), Math.abs(y1 - y2), speed);
        };
        /**
         * Calculate the time it will take to interpolate given a speed and distance
         *
         * @param  dx  distance to interpolate along the first axis
         * @param  dy  distance to interpolate along the second axis
         * @param  speed  interpolation rate
         */
        MathUtil.prototype.speedToDuration2D = function (dx, dy, speed) {
            return Math.abs((speed == 0) ? 0 : ((Math.sqrt(dx * dx + dy * dy)) / speed));
        };
        /**
         * Rounds a number to a fixed amount of decimal places
         *
         * @param val the value to round
         * @param exp amount of decimal places to round to
         */
        MathUtil.prototype.round = function (val, exp) {
            var value = val;
            if (typeof exp === 'undefined' || +exp === 0)
                return Math.round(value);
            value = +value;
            exp = +exp;
            if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0))
                return NaN;
            // Shift
            value = value.toString().split('e');
            value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)));
            // Shift back
            value = value.toString().split('e');
            return +(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp));
        };
        /** Value of PI. 3.141592653589793. */
        MathUtil.PI = 3.141592653589793;
        /** Value of PI * 2. 6.283185307179586 */
        MathUtil.PI2 = 6.283185307179586;
        /** Value of PI / 2. 1.570796326794897 */
        MathUtil.HALFPI = 1.570796326794897;
        /** Value of PI / 180. 0.017453292519943 */
        MathUtil.PI180 = 0.017453292519943;
        /** Value of the square root of 2. 1.4142135623730951 */
        MathUtil.SQRT2 = 1.4142135623730951;
        /** Epsilon value approaching zero. 0.00001 */
        MathUtil.EPSILON = 0.00001;
        /** Color normalizer. Multiplying this by a 0-255 color will normalize the color value. 0.00392156862745 */
        MathUtil.CLR_NORM = 0.00392156862745;
        /** Maxumimum value of a random number. 2147483647 */
        MathUtil.RAND_MAX = 2147483647;
        return MathUtil;
    })();
    util.MathUtil = MathUtil;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class Point
     *
     * @description Fixed 2d position
     */
    var Point = (function () {
        /**
         * Creates a new Point object
         */
        function Point(x, y) {
            if (x === void 0) { x = 0; }
            if (y === void 0) { y = 0; }
            this.x = x;
            this.y = y;
        }
        /**
         * Update the position
         * @param x Horizontal position
         * @param y Vertical position
         */
        Point.prototype.set = function (x, y) {
            this.x = x;
            this.y = y;
        };
        /**
         * Update the position by an additional amount
         * @param dx Amount to add to the X position
         * @param dy Amount to add to the Y position
         */
        Point.prototype.move = function (dx, dy) {
            this.x += dx;
            this.y += dy;
        };
        /**
         * Add two points together creating a new Point
         * @param p Point to add to this one
         */
        Point.prototype.add = function (p) {
            return new Point(this.x + p.x, this.y + p.y);
        };
        /**
         * Calculates the distance between two points
         * @param p Point to compare to
         */
        Point.prototype.distance = function (p) {
            var dx = this.x - p.x;
            var dy = this.y - p.y;
            return Math.sqrt(dx * dx + dy * dy);
        };
        /**
         * Checks if two points have the same X and Y values
         * @param p Point to compare to
         */
        Point.prototype.equals = function (p) {
            return this.x == p.x && this.y == p.y;
        };
        return Point;
    })();
    util.Point = Point;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class Rect
     *
     * @description Rectangular region container
     */
    var Rect = (function () {
        /**
         * Create a Rect object
         */
        function Rect() {
            this.x = 0;
            this.y = 0;
            this.width = 0;
            this.height = 0;
        }
        /**
         * Set the parameters of the rect
         *
         * @param  x  x position
         * @param  y  y position
         * @param  w  width of rect
         * @param  h  height of rect
         */
        Rect.prototype.set = function (x, y, w, h) {
            this.x = x;
            this.y = y;
            this.width = w;
            this.height = h;
        };
        /**
         * Set the position of the rect
         *
         * @param  x  x position of rect
         * @param  y  y position of rect
         */
        Rect.prototype.setPosition = function (x, y) {
            this.x = x;
            this.y = y;
        };
        /**
         * Set the size of the rect
         *
         * @param  w  width of rect
         * @param  h  height of rect
         */
        Rect.prototype.setSize = function (w, h) {
            this.width = w;
            this.height = h;
        };
        /**
         * Move the position of the rect by a delta
         *
         * @param  dx  delta to move x position of rect
         * @param  dy  delta to move y position of rect
         */
        Rect.prototype.move = function (dx, dy) {
            this.x += dx;
            this.y += dy;
        };
        /**
         * Modify the size of the rect by a delta
         *
         * @param  dw  delta to modify rect width
         * @param  dh  delta to modify rect height
         */
        Rect.prototype.sizeMod = function (dw, dh) {
            this.width += dw;
            this.height += dh;
        };
        /**
         * Shrinks or grows the rect by an amount in each direction
         *
         * @param  x  amount to adjust the width
         * @param  y  amount to adjust the height
         */
        Rect.prototype.adjust = function (x, y) {
            this.x = this.x - x * 0.5;
            this.y = this.y - y * 0.5;
            this.width = this.width + x * 0.5;
            this.height = this.height + y * 0.5;
        };
        /**
         * Scales the rect by an amount in each direction. Scales the rect according
         * to the center of the rect.
         *
         * @param  x  amount to scale the width
         * @param  y  amount to scale the height
         */
        Rect.prototype.scale = function (x, y) {
            var diffx = (this.width - this.width * x);
            var diffy = (this.height - this.height * y);
            this.x = this.x + diffx * 0.5;
            this.y = this.y + diffy * 0.5;
            this.width = this.width - diffx;
            this.height = this.height - diffy;
        };
        /**
         * Create a scaled rect by scaling the rect by an amount in each direction.
         * Scales the rect according to the center of the rect.
         *
         * @param  x  amount to scale the width
         * @param  y  amount to scale the height
         */
        Rect.prototype.scaled = function (x, y) {
            var s = new Rect();
            s.set(this.x, this.y, this.width, this.height);
            s.scale(x, y);
            return s;
        };
        /**
         * Modifies the rect to be the intersection of itself and another rect.
         *
         * @param  rect  rect to intersect with
         */
        Rect.prototype.intersect = function (rect) {
            var bx = Math.min(this.x + this.width, rect.x + rect.width);
            var by = Math.min(this.y + this.height, rect.y + rect.height);
            this.x = Math.max(this.x, rect.x);
            this.y = Math.max(this.y, rect.y);
            this.width = bx - this.x;
            this.height = by - this.y;
            return ((this.width == 0) && (this.height == 0));
        };
        /**
         * Extends this rectangle so that it contains the point.
         *
         * @param  x  x coordinate of point.
         * @param  y  y coordinate of point.
         */
        Rect.prototype.unionPoint = function (x, y) {
            var px = this.x + this.width;
            var py = this.y + this.height;
            this.x = Math.min(this.x, x);
            this.y = Math.min(this.y, y);
            this.width = Math.max(px, x);
            this.height = Math.max(py, y);
        };
        /**
         * Modifies this rect to be the union of itself and another rect
         *
         * @param  rect  rect to create union with
         */
        Rect.prototype.unionRect = function (r) {
            this.unionPoint(r.getLeft(), r.getTop());
            this.unionPoint(r.getRight(), r.getBottom());
        };
        /**
         * Tests to see if a rect intersects this rect
         *
         * @param  rect  rect to test intersection
         */
        Rect.prototype.intersects = function (r) {
            if (this.equals(r))
                return true;
            if ((this.x + this.width) < r.x)
                return false;
            if ((this.y + this.height) < r.y)
                return false;
            if ((r.x + r.width) <= this.x)
                return false;
            if ((r.y + r.height) <= this.y)
                return false;
            return true;
        };
        /**
         * Tests if this rect contains a point
         *
         * @param  px  x position of point
         * @param  py  y position of point
         */
        Rect.prototype.containsPoint = function (px, py) {
            if ((px < this.x) || (px > (this.x + this.width)))
                return false;
            if ((py < this.y) || (py > (this.y + this.height)))
                return false;
            return true;
        };
        /**
         * Tests if this rect contains another rect
         *
         * @param  rect  rect to test if it is inside this rect
         */
        Rect.prototype.containsRect = function (r) {
            if ((this.x <= r.x) && (this.y <= r.y)) {
                if ((r.getRight() <= this.getRight()) && (r.getBottom() <= this.getBottom()))
                    return true;
            }
            return false;
        };
        /**
         * Get the center point of the rect
         */
        Rect.prototype.getCenter = function () {
            var v = new util.Vector2();
            v.set(this.x + (this.width * 0.5), this.y + (this.height * 0.5));
            return v;
        };
        /**
         * Converts the floating point rect values to the ceiling of their values.
         * Calls the ceil() function the position and size of rect
         */
        Rect.prototype.convertValuesToCeiling = function () {
            this.x = Math.ceil(this.x);
            this.y = Math.ceil(this.y);
            this.width = Math.ceil(this.width);
            this.height = Math.ceil(this.height);
        };
        /**
         * Converts the floating point rect values to the floor of their values.
         * Calls the floor() function the position and size of rect
         */
        Rect.prototype.convertValuesToFloor = function () {
            this.x = Math.floor(this.x);
            this.y = Math.floor(this.y);
            this.width = Math.floor(this.width);
            this.height = Math.floor(this.height);
        };
        /**
         * Equality
         *
         * @param  r  RHS
         */
        Rect.prototype.equals = function (r) {
            return ((this.x == r.x) && (this.y == r.y) && (this.width == r.width) &&
                (this.height == r.height));
        };
        /**
         * Get the left x position
         */
        Rect.prototype.getLeft = function () {
            return this.x;
        };
        /**
         * Get the top y position
         */
        Rect.prototype.getTop = function () {
            return this.y;
        };
        /**
         * Get the right x position
         */
        Rect.prototype.getRight = function () {
            return this.x + this.width;
        };
        /**
         * Get the bottom y position
         */
        Rect.prototype.getBottom = function () {
            return this.y + this.height;
        };
        /**
         * Get the width of the rect
         */
        Rect.prototype.getWidth = function () {
            return this.width;
        };
        /**
         * Get the height of the rect
         */
        Rect.prototype.getHeight = function () {
            return this.height;
        };
        /**
         * Get the center X position
         */
        Rect.prototype.getCenterX = function () {
            return this.x + this.width * 0.5;
        };
        /**
         * Get the center Y position
         */
        Rect.prototype.getCenterY = function () {
            return this.y + this.height * 0.5;
        };
        /**
         * Checks to see if the rect has valid dimensions
         */
        Rect.prototype.isValid = function () {
            return ((this.width > util.MathUtil.EPSILON) && (this.height > util.MathUtil.EPSILON));
        };
        return Rect;
    })();
    util.Rect = Rect;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class Vector2
     *
     * @description Two Dimensional vector container
     */
    var Vector2 = (function () {
        /**
         * Create a Vector2 object
         */
        function Vector2() {
            this.x = 0;
            this.y = 0;
        }
        /**
         * Set the vector values
         *
         * @param  x  x value
         * @param  y  y value
         */
        Vector2.prototype.set = function (x, y) {
            this.x = x;
            this.y = y;
            this.lengthCalc = false;
        };
        /**
         * Normalize the vector
         */
        Vector2.prototype.normalize = function () {
            var u = this.unit();
            this.set(u.x, u.y);
            this.lengthCalc = false;
        };
        /**
         * Floors the floating point values of the vector
         */
        Vector2.prototype.clamp = function () {
            this.x = Math.floor(this.x);
            this.y = Math.floor(this.y);
            this.lengthCalc = false;
        };
        /**
         * Create a clamped vector based on the vector
         */
        Vector2.prototype.clamped = function () {
            var c = new Vector2();
            c.set(this.x, this.y);
            c.clamp();
            return c;
        };
        /**
         * Move the vector by a delta distance
         *
         * @param  deltaX  delta of the X value
         * @param  deltaY  delta of the Y value
         */
        Vector2.prototype.move = function (deltaX, deltaY) {
            this.set(this.x + deltaX, this.y + deltaY);
        };
        /**
         * Rotate the vector about a pivot point. px,py should be zero if rotate about itself.
         *
         * @param  rotation  rotation in degrees
         * @param  px  pivot point on x
         * @param  py  pivot point on y
         */
        Vector2.prototype.rotate = function (rotation, px, py) {
            var rx = this.x - px;
            var ry = this.y - py;
            var theta = (new util.MathUtil()).toRadians(rotation);
            var c = Math.cos(theta);
            var s = Math.sin(theta);
            this.x = (rx * c - ry * s) + px;
            this.y = (rx * s + ry * c) + py;
        };
        /**
         * Get the vector length
         */
        Vector2.prototype.getLength = function () {
            this.computeLength();
            return this.length;
        };
        /**
         * Get the squared vector length
         */
        Vector2.prototype.lengthSquared = function () {
            return ((this.x * this.x) + (this.y * this.y));
        };
        /**
         * Get the normal vector
         */
        Vector2.prototype.normal = function () {
            var v = new Vector2();
            v.set(this.y, -this.x);
            return v;
        };
        /**
         * Get the normalized unit vector
         */
        Vector2.prototype.unit = function () {
            this.computeLength();
            if ((new util.MathUtil()).fltCmp(this.length, 0))
                return new Vector2();
            var v = new Vector2();
            v.set(this.x / this.length, this.y / this.length);
            return v;
        };
        /**
         * Computes the angle between 2 vectors.
         *
         * @param  vec  Other vector to calculate angle against
         */
        Vector2.prototype.angle = function (vec) {
            this.computeLength();
            if ((new util.MathUtil()).fltCmp(this.length, 0) || (new util.MathUtil()).fltCmp(vec.getLength(), 0))
                return 0;
            return Math.atan2(vec.y, vec.x) - Math.atan2(this.y, this.x);
        };
        /**
         * Compute the dot product of the vector and another vector
         *
         * @param  vec  other vector to compute dot against
         */
        Vector2.prototype.dot = function (vec) {
            return (this.x * vec.x + this.y * vec.y);
        };
        /**
         * Vector subtraction
         *
         * @param  v  RHS of subtraction
         */
        Vector2.prototype.sub = function (vec) {
            var v = new Vector2();
            v.set(this.x - vec.x, this.y - vec.y);
            return v;
        };
        /**
         * Vector addition
         *
         * @param  v  RHS of addition
         */
        Vector2.prototype.add = function (vec) {
            var v = new Vector2();
            v.set(this.x + vec.x, this.y + vec.y);
            return v;
        };
        /**
         * Performs scalar multiplication on the vector
         *
         * @param  scalar  multiplier to perform scalar multiplication on vector
         */
        Vector2.prototype.mul = function (scalar) {
            var v = new Vector2();
            v.set(this.x * scalar, this.y * scalar);
            return v;
        };
        /**
         * Performs scalar division on the vector
         *
         * @param  scalar  dividend to perform scalar division on vector
         */
        Vector2.prototype.div = function (scalar) {
            var v = new Vector2();
            v.set(this.x / scalar, this.y / scalar);
            return v;
        };
        /**
         * Check if this is the zero vector
         */
        Vector2.prototype.isZero = function () {
            return (this.x == 0 && this.y == 0);
        };
        /**
         * Check if this is the one vector
         */
        Vector2.prototype.isOne = function () {
            return (this.x == 1 && this.y == 1);
        };
        /**
         * Check if this is hte normalized vector that represents the X axis
         */
        Vector2.prototype.isXAxis = function () {
            return (this.x == 1 && this.y == 0);
        };
        /**
         * Check if this is hte normalized vector that represents the Y axis
         */
        Vector2.prototype.isYAxis = function () {
            return (this.x == 0 && this.y == 1);
        };
        /**
         * Vector equality
         *
         * @param  v  vector to compare
         */
        Vector2.prototype.equals = function (vec) {
            return ((this.x == vec.x) && (this.y == vec.y));
        };
        /**
         * Create string representation of Vector2
         */
        Vector2.prototype.toString = function () {
            return ("Vector2 (x=" + this.x + " y=" + this.y + ")");
        };
        /**
         * Compute the length of the vector. Will first check if the
         * vector has changed lately and will only recompute if vector has changed.
         */
        Vector2.prototype.computeLength = function () {
            if (!this.lengthCalc) {
                this.length = Math.sqrt((this.x * this.x) + (this.y * this.y));
                this.lengthCalc = true;
            }
        };
        return Vector2;
    })();
    util.Vector2 = Vector2;
})(util || (util = {}));
var util;
(function (util) {
    var PauseManager = (function () {
        function PauseManager() {
        }
        PauseManager.setStage = function (stage) {
            this._stage = stage;
        };
        PauseManager.addCallback = function (callback) {
            if (!this._callbacks) {
                this._callbacks = [];
            }
            this._callbacks.push(callback);
        };
        PauseManager.pause = function () {
            if (this._paused) {
                return;
            }
            var anims = TweenMax.getAllTweens(true);
            this._activeAnims = [];
            for (var i = 0; i < anims.length; i++) {
                if (!anims[i].paused()) {
                    this._activeAnims.push(anims[i]);
                    anims[i].pause();
                }
            }
            this._paused = true;
            if (this._stage) {
                this._stage.paused = true;
            }
            if (!this._global) {
                this._global = new audio.AudioGlobal();
            }
            this._global.mute();
            if (this._callbacks) {
                for (var i = 0; i < this._callbacks.length; i++) {
                    this._callbacks[i](true);
                }
            }
        };
        PauseManager.resume = function () {
            if (!this._activeAnims || !this._paused) {
                return;
            }
            for (var i = 0; i < this._activeAnims.length; i++) {
                this._activeAnims[i].resume();
            }
            this._paused = false;
            if (this._stage) {
                this._stage.paused = false;
            }
            if (!this._global) {
                this._global = new audio.AudioGlobal();
            }
            if (!util.PartnerAdapter.PartnerAdapterMuted) {
                this._global.unmute();
            }
            if (this._callbacks) {
                for (var i = 0; i < this._callbacks.length; i++) {
                    this._callbacks[i](false);
                }
            }
        };
        Object.defineProperty(PauseManager, "paused", {
            get: function () {
                return this._paused;
            },
            enumerable: true,
            configurable: true
        });
        return PauseManager;
    })();
    util.PauseManager = PauseManager;
})(util || (util = {}));
var util;
(function (util) {
    var stakes;
    (function (stakes) {
        /**
         * The stakes model handles increasing/decresing the available bet levels and informs other classes via an event dispatcher
         *
         * @export
         * @class StakesModel
         */
        var StakesModel = (function () {
            function StakesModel() {
            }
            /**
             * Sets the required data for the model
             *
             * @param {server.BetData} data Bet data from the init response
             * @param {number[]} lineCounts List of line counts for the different stakes
             * @param {number} currencyMultipler Currency multiplier to use for teh threshold
             * @param {number} stakeThreshold Stakes threshold for the help pages
             */
            StakesModel.prototype.setData = function (data, lineCounts, currencyMultipler, stakeThreshold) {
                this._data = data;
                this._lineCounts = lineCounts;
                this._stakeThreshold = stakeThreshold;
                this._currencyMultipler = currencyMultipler;
                this._selectedIndex = data.getDefaultIndex();
                this.calculateLines();
                this.broadcast();
            };
            /**
             * Increases the stake
             */
            StakesModel.prototype.increase = function () {
                this._selectedIndex++;
                if (this._selectedIndex >= this._data.getAvailableBets().length) {
                    this._selectedIndex = this._data.getAvailableBets().length - 1;
                }
                this.calculateLines();
                this.broadcast();
            };
            /**
             * Decreases the stake
             */
            StakesModel.prototype.decrease = function () {
                this._selectedIndex--;
                if (this._selectedIndex < 0) {
                    this._selectedIndex = 0;
                }
                this.calculateLines();
                this.broadcast();
            };
            /**
             * Set the stake with a valid value
             *
             * @param {number} value The total stake amount, must be valid
             */
            StakesModel.prototype.setStake = function (value) {
                for (var i = 0; i < this._data.getAvailableBets().length; i++) {
                    if (value == this._data.getAvailableBets()[i]) {
                        this._selectedIndex = i;
                    }
                }
                this.calculateLines();
                this.broadcast();
            };
            /**
             * Calculates the lines based on the current index
             *
             * @protected
             */
            StakesModel.prototype.calculateLines = function () {
                this._lines = this._lineCounts[this._selectedIndex];
            };
            /**
             * Dispatches StakesModelEvent.CHANGED when the stake changes
             *
             * @protected
             */
            StakesModel.prototype.broadcast = function () {
                var event = new stakes.StakesModelEvent(stakes.StakesModelEvent.CHANGED, this.getTotalBet(), this.getBetPerLine(), this.getLines(), this.getIsMax(), this.getIsMin());
                this.eventDispatcher.dispatchEvent(event);
            };
            /**
             * Gets the total bet
             *
             * @returns {number} (description)
             */
            StakesModel.prototype.getTotalBet = function () {
                return this._data.getAvailableBets()[this._selectedIndex];
            };
            /**
             * Gets the current bet per line
             *
             * @returns {number} (description)
             */
            StakesModel.prototype.getBetPerLine = function () {
                return this._data.getAvailableBets()[this._selectedIndex] / this._lines;
            };
            /**
             * Gets the line amount for the current stake
             *
             * @returns {number} (description)
             */
            StakesModel.prototype.getLines = function () {
                return this._lines;
            };
            /**
             * True if the current selected stake is the highest available
             *
             * @returns {boolean} (description)
             */
            StakesModel.prototype.getIsMax = function () {
                return this._selectedIndex == this._data.getAvailableBets().length - 1;
            };
            /**
             * True if the current selected stake is the lowest available
             *
             * @returns {boolean} (description)
             */
            StakesModel.prototype.getIsMin = function () {
                return this._selectedIndex == 0;
            };
            /**
             * Set the stake threshold for the help pages
             *
             * @param {number} value (description)
             */
            StakesModel.prototype.setStakeThreshold = function (value) {
                this._stakeThreshold = value;
            };
            /**
             * Get the stake threshold for the help pages with the currency multiplier applied
             *
             * @returns {number} (description)
             */
            StakesModel.prototype.getStakeThreshold = function () {
                return this._stakeThreshold * this._currencyMultipler;
            };
            return StakesModel;
        })();
        stakes.StakesModel = StakesModel;
    })(stakes = util.stakes || (util.stakes = {}));
})(util || (util = {}));
var util;
(function (util) {
    var stakes;
    (function (stakes) {
        /**
         * Dispatched by the stakes model when the stake changes
         *
         * @export
         * @class StakesModelEvent
         * @extends {borgevent.Event}
         */
        var StakesModelEvent = (function (_super) {
            __extends(StakesModelEvent, _super);
            /**
             * Creates an instance of StakesModelEvent.
             *
             * @param {string} eventName (description)
             * @param {number} totalBet The total stake
             * @param {number} betPerLine The bet per line
             * @param {number} lines The amount of lines for the current stake
             * @param {boolean} isMax Whether this is the highest available stake
             * @param {boolean} isMin Whether this is the lowest available stake
             */
            function StakesModelEvent(eventName, totalBet, betPerLine, lines, isMax, isMin) {
                _super.call(this, eventName);
                this.totalBet = totalBet;
                this.betPerLine = betPerLine;
                this.lines = lines;
                this.isMax = isMax;
                this.isMin = isMin;
            }
            /**
             * Dispatched whenever the selected stake changes
             *
             * @static
             * @type {string}
             */
            StakesModelEvent.CHANGED = "StakesModelEvent_CHANGED";
            return StakesModelEvent;
        })(borgevent.Event);
        stakes.StakesModelEvent = StakesModelEvent;
    })(stakes = util.stakes || (util.stakes = {}));
})(util || (util = {}));
var util;
(function (util) {
    var Translator = (function () {
        function Translator() {
        }
        Translator.prototype.setData = function (data) {
            var keys = Object.keys(data);
            var n = keys.length;
            while (n--) {
                var key = keys[n]; // "cache" it, for less lookups to the array
                if (key !== key.toLowerCase()) {
                    data[key.toLowerCase()] = data[key]; // swap the value to a new lower case key
                    delete data[key]; // delete the old key
                }
            }
            this._data = data;
        };
        Translator.prototype.setDebug = function (value) {
            this._debug = value;
        };
        Translator.prototype.findByKey = function (key) {
            if (this._data && this._data[key.toLowerCase()] && !this._debug) {
                return this._data[key.toLowerCase()];
            }
            else {
                return key;
            }
        };
        Translator.prototype.findByKeyAndReplace = function (key, sources, replacements) {
            var text = key;
            if (this._data && this._data[key.toLowerCase()] && !this._debug) {
                text = this._data[key.toLowerCase()];
            }
            for (var i = 0; i < sources.length; i++) {
                text = text.split(sources[i]).join(replacements[i]);
            }
            return text;
        };
        return Translator;
    })();
    util.Translator = Translator;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @enum  RotationAxis
     *
     * @description Rotation enumeration
     */
    (function (RotationAxis) {
        RotationAxis[RotationAxis["X"] = 0] = "X";
        RotationAxis[RotationAxis["Y"] = 1] = "Y";
        RotationAxis[RotationAxis["Z"] = 2] = "Z";
    })(util.RotationAxis || (util.RotationAxis = {}));
    var RotationAxis = util.RotationAxis;
    /**
     * @class TweenUtil
     *
     * @description Contains helper methods that create tweens
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
            return TweenMax.to(target, duration, { x: x, y: y, ease: easeMode,
                onStart: start, onStartParams: ["{self}"], onComplete: complete,
                onCompleteParams: ["{self}"], onReverseComplete: reverseComplete,
                onReverseCompleteParams: ["{self}"], onRepeat: repeat,
                onRepeatParams: ["{self}"],
                immediateRender: false });
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
            var params = { ease: easeMode, onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false };
            params[axisX ? "x" : "y"] = pos;
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
            return TweenMax.to(target, duration, { x: "+=" + dx, y: "+=" + dy,
                ease: easeMode, onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false });
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
            var params = { ease: easeMode, onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false };
            params[axisX ? "x" : "y"] = "+=" + delta;
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
            return TweenMax.fromTo(target, duration, { x: x1, y: y1 }, { setPositionX: x2, setPositionY: y2, ease: easeMode,
                onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false });
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
            fromParams[axisX ? "x" : "y"] = pos1;
            var toParams = { ease: easeMode, onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false };
            toParams[axisX ? "x" : "y"] = pos2;
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
            return TweenMax.to(target, duration, { opacity: opacity, ease: easeMode,
                onStart: start, onStartParams: ["{self}"], onComplete: complete,
                onCompleteParams: ["{self}"], onReverseComplete: reverseComplete,
                onReverseCompleteParams: ["{self}"], onRepeat: repeat,
                onRepeatParams: ["{self}"],
                immediateRender: false });
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
            return TweenMax.fromTo(target, duration, { opacity: opacity1 }, { opacity: opacity2,
                ease: easeMode, onStart: start, onStartParams: ["{self}"], onComplete: complete,
                onCompleteParams: ["{self}"], onReverseComplete: reverseComplete,
                onReverseCompleteParams: ["{self}"], onRepeat: repeat,
                onRepeatParams: ["{self}"],
                immediateRender: false });
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
            return TweenMax.fromTo(target, duration, { scaleZ: sx1, scaleY: sy1 }, { setScaleX: sx2, setScaleY: sy2, ease: easeMode,
                onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false });
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
            return TweenMax.fromTo(myObj, duration, { setBangValue: begin }, { setBangValue: end, ease: easeMode,
                onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false });
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
            return TweenMax.fromTo(target, duration, { setZoom: begin }, { setZoom: end, ease: easeMode,
                onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false });
        };
        /**
         * Rotate between two angles
         */
        TweenUtil.prototype.rotateFromTo = function (target, begin, end, duration, easeMode, complete, reverseComplete, repeat, start) {
            return TweenMax.fromTo(target, duration, { setRotation: begin }, { setRotation: end, ease: easeMode,
                onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
                immediateRender: false });
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
                scaleX: sx2, scaleY: sy2, ease: easeMode,
                onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
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
                scaleX: sx1, scaleY: sy1, ease: easeMode,
                onStart: start, onStartParams: ["{self}"],
                onComplete: complete, onCompleteParams: ["{self}"],
                onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                onRepeat: repeat, onRepeatParams: ["{self}"],
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
                case RotationAxis.X:
                    toRotation = { rotationX: r1,
                        immediateRender: false };
                    fromRotation = {
                        rotationX: r2, ease: easeMode,
                        onStart: start, onStartParams: ["{self}"],
                        onComplete: complete, onCompleteParams: ["{self}"],
                        onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                        onRepeat: repeat, onRepeatParams: ["{self}"] };
                    break;
                case RotationAxis.Y:
                    toRotation = { rotationY: r1,
                        immediateRender: false };
                    fromRotation = {
                        rotationY: r2, ease: easeMode,
                        onStart: start, onStartParams: ["{self}"],
                        onComplete: complete, onCompleteParams: ["{self}"],
                        onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                        onRepeat: repeat, onRepeatParams: ["{self}"] };
                    break;
                case RotationAxis.Z:
                    toRotation = { rotationZ: r1,
                        immediateRender: false };
                    fromRotation = {
                        rotationZ: r2, ease: easeMode,
                        onStart: start, onStartParams: ["{self}"],
                        onComplete: complete, onCompleteParams: ["{self}"],
                        onReverseComplete: reverseComplete, onReverseCompleteParams: ["{self}"],
                        onRepeat: repeat, onRepeatParams: ["{self}"] };
                    break;
            }
            return TweenMax.fromTo(target, duration, toRotation, fromRotation);
        };
        return TweenUtil;
    })();
    util.TweenUtil = TweenUtil;
})(util || (util = {}));
var util;
(function (util) {
    /**
     *
     *
     * @export
     * @class AutoplayManager
     * @implements {IAutoplayManager}
     */
    var AutoplayManager = (function () {
        function AutoplayManager() {
        }
        /**
         * @inheritdoc
         */
        AutoplayManager.prototype.initPartnerAutoplay = function (currentTotalSTake, currentBalance, callback) {
        };
        /**
         * @inheritdoc
         */
        AutoplayManager.prototype.launchPartnerAutoplay = function (currentTotalSTake, currentBalance, callback) {
        };
        /**
         * @inheritdoc
         */
        AutoplayManager.prototype.updateWinAndStake = function (win, stake) {
        };
        /**
         * @inheritdoc
         */
        AutoplayManager.prototype.updateAutoPlayStatus = function (status, remainingSpins) {
        };
        return AutoplayManager;
    })();
    util.AutoplayManager = AutoplayManager;
})(util || (util = {}));
var util;
(function (util) {
    /**
     *
     *
     * @export
     * @class AutoplayStatus
     */
    var AutoplayStatus = (function () {
        function AutoplayStatus() {
        }
        /**
         *
         *
         * @type {string}
         */
        AutoplayStatus.IN_PROGRESS = "progress";
        /**
         *
         *
         * @type {string}
         */
        AutoplayStatus.FINISHED = "finished";
        return AutoplayStatus;
    })();
    util.AutoplayStatus = AutoplayStatus;
})(util || (util = {}));
var util;
(function (util) {
    var BalanceDisplayEvent = (function () {
        function BalanceDisplayEvent(cash, freebet, balance) {
            this.CASH = cash;
            this.FREEBET = freebet;
            this.balanceAmount = balance;
        }
        return BalanceDisplayEvent;
    })();
    util.BalanceDisplayEvent = BalanceDisplayEvent;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * Wraps the PartnerAdapter to make a few functions available statically.
     */
    var ErrorReporter = (function () {
        function ErrorReporter() {
        }
        /**
         * Set the static instance of the partner adapter.
         */
        ErrorReporter.setPartnerAdapter = function (partnerAdapter) {
            ErrorReporter.partnerAdapter = partnerAdapter;
        };
        /**
         * Set the static instance of the translator, required for translating error dialog text.
         */
        ErrorReporter.setTranslator = function (translator) {
            ErrorReporter.translator = translator;
        };
        /**
         * Display an error to the user and optionally log some diagnostic information.
         *
         * @param displayError The message to display. Translation will be attempted.
         * @param diagnosticError An optional technical message to log. Not translated.
         * @param callback An optional function to call after the message has been displayed.
         */
        ErrorReporter.showError = function (displayError, diagnosticError, callback) {
            if (callback == null) {
                callback = function () { }; // Don't pass an undefined callback to the partnerAdapter.
            }
            if (diagnosticError != null) {
                console.error(diagnosticError);
            }
            if (ErrorReporter.partnerAdapter != null) {
                var heading = ErrorReporter.tryToTranslate('com.williamsinteractive.mobile.casinarena.common.ERROR_GENERIC_HEADER');
                var message = ErrorReporter.tryToTranslate(displayError);
                var button = ErrorReporter.tryToTranslate('com.williamsinteractive.mobile.mobile.OK');
                ErrorReporter.partnerAdapter.showError(heading, message, button, callback);
            }
            else {
                // If the partner adapter wasn't available, log the message and call back back right away.
                console.log('ErrorReporter called without PartnerAdapter: ' + ErrorReporter.tryToTranslate(displayError));
                callback();
            }
        };
        /**
         * Attempt to translate the given string.
         * If translation fails, the text will be returned unmodified.
         */
        ErrorReporter.tryToTranslate = function (text) {
            if (ErrorReporter.translator != null) {
                var output = ErrorReporter.translator.findByKey(text);
                if (output != null) {
                    return output;
                }
            }
            return text;
        };
        return ErrorReporter;
    })();
    util.ErrorReporter = ErrorReporter;
})(util || (util = {}));
var util;
(function (util) {
    var GameInitializedEvent = (function () {
        function GameInitializedEvent(resume, cash, freebet, balance) {
            this.isResumeGame = resume;
            this.CASH = cash;
            this.FREEBET = freebet;
            this.balanceAmount = balance;
        }
        return GameInitializedEvent;
    })();
    util.GameInitializedEvent = GameInitializedEvent;
})(util || (util = {}));
var util;
(function (util) {
    var LeanView = (function () {
        function LeanView() {
            this._pageNavigator = new util.URLParamPageNavigator();
        }
        LeanView.prototype.canGoToExternalHelp = function () {
            return false;
        };
        Object.defineProperty(LeanView.prototype, "pageNavigator", {
            get: function () {
                return this._pageNavigator;
            },
            enumerable: true,
            configurable: true
        });
        return LeanView;
    })();
    util.LeanView = LeanView;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class MetaData
     *
     * @description Mock representation of metadata provided by the partner adapter
     */
    var MetaData = (function () {
        function MetaData(metaData) {
            this._metaData = metaData;
        }
        /**
         * @inheritdoc
         */
        MetaData.prototype.isRealMoney = function () {
            return this._metaData ? this._metaData.isRealMoney() : false;
        };
        /**
         * @inheritdoc
         */
        MetaData.prototype.getGameCode = function () {
            return this._metaData ? this._metaData.getGameCode() : "gamecode";
        };
        /**
         * @inheritdoc
         */
        MetaData.prototype.getLocale = function () {
            var locale = this._metaData ? this._metaData.getLocale().toLowerCase() : "en_gb";
            var found = false;
            for (var i = 0; i < MetaData.LOCALE_LOOKUP.length; i++) {
                if (MetaData.LOCALE_LOOKUP[i].indexOf(locale) > -1) {
                    locale = MetaData.LOCALE_LOOKUP[i][0];
                    found = true;
                    break;
                }
            }
            if (!found) {
                locale = "en_gb";
            }
            return locale;
        };
        /**
         * @inheritdoc
         */
        MetaData.prototype.getLogicUrl = function () {
            return this._metaData ? this._metaData.getLogicUrl() : "https://pa02-gls-web.wi-gameserver.com/gls.rgsx";
        };
        /**
         * @inheritdoc
         */
        MetaData.prototype.isGaffingEnabled = function () {
            return this._metaData ? this._metaData.isGaffingEnabled() : true;
        };
        /**
         * @inheritdoc
         */
        MetaData.prototype.isDemoEnabled = function () {
            return this._metaData ? this._metaData.isDemoEnabled() : true;
        };
        /**
         * @inheritdoc
         */
        MetaData.prototype.getCdnRoot = function () {
            return this._metaData ? this._metaData.getCdnRoot() : "";
        };
        /**
         * @inheritdoc
         */
        MetaData.prototype.getMaxWinStatus = function () {
            return this._metaData ? this._metaData.getMaxWinStatus() : true;
        };
        /**
         * @inheritdoc
         */
        MetaData.prototype.getSkillStopStatus = function () {
            return this._metaData ? this._metaData.getSkillStopStatus() : false;
        };
        MetaData.prototype.getPartnerCode = function () {
            return this._metaData ? this._metaData.getPartnerCode() : "";
        };
        MetaData.LOCALE_LOOKUP = [
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
        return MetaData;
    })();
    util.MetaData = MetaData;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class PartnerAdapter
     *
     * @description Mock representation of the partner adapter
     */
    var PartnerAdapter = (function () {
        /**
         * Creates a new PartnerAdapter instance
         */
        function PartnerAdapter() {
            this._sessionData = new util.SessionData();
            this._autoplayManager = new util.AutoplayManager();
            this._view = new util.LeanView();
        }
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.getSessionData = function () {
            return this._sessionData;
        };
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.hideProgressBar = function () {
            return this._sessionData;
        };
        /**
        * @inheritdoc
        */
        PartnerAdapter.prototype.showProgressBar = function () {
            return this._sessionData;
        };
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.updatedLoadingProgress = function (amount) {
        };
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.setMenuHandler = function (menuType, callback) {
        };
        Object.defineProperty(PartnerAdapter.prototype, "partnerAutoplayManager", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._autoplayManager;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.receivedGameLogicResponse = function (response) {
        };
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.startedPlay = function () {
        };
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.finishedPlay = function () {
        };
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.finishedPostGameAnimations = function () {
        };
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.updateBet = function (bet) {
        };
        /**
         * @inheritdoc
         */
        PartnerAdapter.prototype.goHome = function () {
        };
        Object.defineProperty(PartnerAdapter.prototype, "view", {
            /**
             * @inheritdoc
             */
            get: function () {
                return this._view;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * let us know, whether PartnerAdapter is muted or not
         */
        PartnerAdapter.PartnerAdapterMuted = false;
        return PartnerAdapter;
    })();
    util.PartnerAdapter = PartnerAdapter;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * (description)
     *
     * @export
     * @class PartnerAdapterEventModel
     */
    var PartnerAdapterEventModel = (function () {
        function PartnerAdapterEventModel() {
        }
        Object.defineProperty(PartnerAdapterEventModel.prototype, "winDisplayEventListener", {
            /**
             * (description)
             *
             * @type {util.IWinDisplayEventListener}
             */
            get: function () {
                return this._winDisplayEventListener;
            },
            /**
             * (description)
             */
            set: function (value) {
                this._winDisplayEventListener = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PartnerAdapterEventModel.prototype, "balanceDisplayEventListener", {
            /**
             * (description)
             *
             * @type {util.IBalanceDisplayEventListener}
             */
            get: function () {
                return this._balanceDisplayEventListener;
            },
            /**
             * (description)
             */
            set: function (value) {
                this._balanceDisplayEventListener = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PartnerAdapterEventModel.prototype, "gameInitializedEventListener", {
            /**
             * (description)
             *
             * @type {util.IGameInitializedEventListener}
             */
            get: function () {
                return this._gameInitializedEventListener;
            },
            /**
             * (description)
             */
            set: function (value) {
                this._gameInitializedEventListener = value;
            },
            enumerable: true,
            configurable: true
        });
        return PartnerAdapterEventModel;
    })();
    util.PartnerAdapterEventModel = PartnerAdapterEventModel;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class SessionData
     *
     * @description Mock representation of the session data provided by the partner adapter
     */
    var SessionData = (function () {
        function SessionData() {
        }
        /**
         * @inheritdoc
         */
        SessionData.prototype.getPlayerID = function () {
            return "";
        };
        /**
         * @inheritdoc
         */
        SessionData.prototype.getContextID = function () {
            return "0";
        };
        /**
         * @inheritdoc
         */
        SessionData.prototype.getSessionID = function () {
            return "";
        };
        return SessionData;
    })();
    util.SessionData = SessionData;
})(util || (util = {}));
var util;
(function (util) {
    var URLParamPageNavigator = (function () {
        function URLParamPageNavigator() {
        }
        URLParamPageNavigator.prototype.goToExternalHelp = function () {
        };
        return URLParamPageNavigator;
    })();
    util.URLParamPageNavigator = URLParamPageNavigator;
})(util || (util = {}));
var util;
(function (util) {
    /**
     * @class URLParts
     *
     * @description Indexers for url match data
     */
    var URLParts = (function () {
        function URLParts() {
        }
        URLParts.URL = 0;
        URLParts.PROTOCOL = 1;
        URLParts.USERINFO = 2;
        URLParts.DOMAIN = 3;
        URLParts.PORT = 4;
        URLParts.PATH = 5;
        URLParts.PAGE = 6;
        URLParts.EXT = 7;
        URLParts.QUERY = 8;
        URLParts.ANCHOR = 9;
        return URLParts;
    })();
    util.URLParts = URLParts;
    /**
     * @class URL
     *
     * @description Provides data about and manipulates URLs
     */
    var URL = (function () {
        /**
         * @constructor
         * @param {string} url The full URL path
         */
        function URL(url) {
            /**
             * URL regex 1.2
             * http://someweblog.com/url-regular-expression-javascript-link-shortener/
             */
            this.regex = /\(?(?:(http|https|ftp):\/\/)?(?:((?:[^\W\s]|\.|-|[:]{1})+)@{1})?((?:www.)?(?:[^\W\s]|\.|-)+[\.][^\W\s]{2,4}|localhost(?=\/|:)|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|(?=\/|[^\W\s])+)(?::(\d*))?([\/]?[^\s\?]*[\/]{1})*(?:\/?([^\s\n\?\[\]\{\}\#]*(?:(?=\.)){1}|[^\s\n\?\[\]\{\}\.\#]*)?([\.]{1}[^\s\?\#]*)?)?(?:\?{1}([^\s\n\#\[\]]*))?([\#][^\s\n]*)?\)?/;
            /**
             * Query string regex
             */
            this.query = /([^?=&]+)(=([^&]*))?/g;
            /**
            * Entire URL – url being parsed
            */
            this.url = "";
            /**
             * Protocol – http, https, ftp
             */
            this.protocol = "";
            /**
             * Userinfo – username:password
             */
            this.userinfo = "";
            /**
             * Domain – www.mydomain.com, mydomain.com, 127.0.0.1, localhost…
             */
            this.domain = "";
            /**
             * Port – 80
             */
            this.port = 0;
            /**
             * Path / Folders – /folder/dir/
             */
            this.pathname = "";
            /**
             * Page / Filename – eg. index
             */
            this.basename = "";
            /**
             * File extension – .html, .php…
             */
            this.extension = "";
            /**
             * filename + extension - index.html, image.png
             */
            this.fullname = "";
            /**
             * Query string – item=value&item2=value2
             */
            this.querystring = "";
            /**
             * Query object - {item: value, item2: value2}
             */
            this.querydata = {};
            /**
             * Anchor – #home
             */
            this.anchor = "";
            this.url = url;
            var result = url.match(this.regex);
            if (result) {
                this.url = result[URLParts.URL] || "";
                this.protocol = result[URLParts.PROTOCOL] || "";
                this.userinfo = result[URLParts.USERINFO] || "";
                this.domain = result[URLParts.DOMAIN] || "";
                this.port = parseInt(result[URLParts.PORT] || "0");
                this.pathname = result[URLParts.PATH] || "";
                this.basename = result[URLParts.PAGE] || "";
                this.extension = result[URLParts.EXT] || "";
                this.fullname = this.basename + this.extension;
                this.querystring = result[URLParts.QUERY] || "";
                this.anchor = result[URLParts.ANCHOR] || "";
                this.parseQuery();
            }
        }
        /**
         * Parse the query string into an object
         */
        URL.prototype.parseQuery = function () {
            var _this = this;
            this.querystring.replace(this.query, function ($0, $1, $2, $3) {
                _this.querydata[$1] = $3;
                return $0;
            });
        };
        /**
         * Returns the url parameter data
         * @param data the parameter name
         */
        URL.prototype.queryData = function (data) {
            return this.querydata[data];
        };
        return URL;
    })();
    util.URL = URL;
})(util || (util = {}));
var util;
(function (util) {
    var WinDisplayEvent = (function () {
        function WinDisplayEvent(winnings) {
            this.winAmount = winnings;
        }
        return WinDisplayEvent;
    })();
    util.WinDisplayEvent = WinDisplayEvent;
})(util || (util = {}));
